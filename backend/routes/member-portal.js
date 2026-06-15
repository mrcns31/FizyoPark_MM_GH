import express from 'express';
import { body, validationResult } from 'express-validator';
import db from '../config/database.js';
import { verifyToken } from './auth.js';
import { log as activityLog } from '../utils/activityLogger.js';
import { cancelPackageSessionsAtSlot } from '../utils/packageSessions.js';
import { checkInSessionForMember } from '../utils/packageSessionCounts.js';
import {
  buildPackageWithSessions,
  loadStaffMap,
  sessionToDto,
} from '../utils/memberPackageDto.js';
import { isMemberPackageActive, localTodayDateStr } from '../utils/memberPackageStatus.js';
import { createMemberAccessToken, verifyMemberAccessToken } from '../utils/memberAccessQr.js';
import { logWalkInQrAccess } from '../utils/facilityAccess.js';
import { getInstitutionWhatsApp } from '../utils/appSettings.js';
import QRCode from 'qrcode';

const router = express.Router();

// Kapı okuyucu doğrulama (auth gerektirmez — mikrodenetleyici kullanacak)
router.post('/verify-access', async (req, res) => {
  try {
    const { token } = req.body || {};
    const result = verifyMemberAccessToken(token);
    if (!result.valid) {
      return res.status(401).json({ valid: false, reason: result.reason || 'invalid' });
    }

    let checkIn = { checkedIn: false, reason: 'no_session' };
    try {
      checkIn = await checkInSessionForMember(db, result.memberId);
    } catch (checkInErr) {
      if (checkInErr.code !== '42703') throw checkInErr;
      console.warn('verify-access: checked_in_at sütunu yok; migration_sessions_check_in.sql çalıştırın');
    }

    if (checkIn.checkedIn) {
      let memberName = null;
      let memberUserId = null;
      try {
        const memberRow = await db.query(
          'SELECT name, user_id FROM members WHERE id = $1',
          [result.memberId]
        );
        memberName = memberRow.rows[0]?.name || null;
        memberUserId = memberRow.rows[0]?.user_id || null;
      } catch (_) {}

      await activityLog(req, {
        action: 'session.check_in_qr',
        entityType: 'session',
        entityId: checkIn.sessionId,
        ...(memberUserId
          ? { actorId: memberUserId, actorType: 'user', actorName: memberName || undefined }
          : { actorName: memberName ? `Üye: ${memberName}` : `Üye#${result.memberId}` }),
        details: {
          memberId: result.memberId,
          memberName: memberName || undefined,
          startTs: checkIn.startTs,
          checkInMethod: 'qr',
        },
      }).catch(() => {});
    } else {
      await logWalkInQrAccess(db, result.memberId);
    }

    res.json({
      valid: true,
      memberId: result.memberId,
      checkIn: checkIn.checkedIn
        ? { ok: true, sessionId: checkIn.sessionId, startTs: checkIn.startTs }
        : { ok: false, reason: checkIn.reason || 'no_session' },
    });
  } catch (error) {
    console.error('Verify access error:', error);
    res.status(500).json({ error: 'Doğrulama hatası' });
  }
});

router.use(verifyToken);

function requireMember(req, res, next) {
  if (req.user.role !== 'member') {
    return res.status(403).json({ error: 'Bu işlem yalnızca üyeler içindir' });
  }
  next();
}

async function getMemberIdForUser(userId) {
  const res = await db.query(
    'SELECT id FROM members WHERE user_id = $1 AND (deleted_at IS NULL)',
    [userId]
  );
  return res.rows[0]?.id ?? null;
}

// Üye portalı ana veri: profil, paketler, bildirimler
router.get('/dashboard', requireMember, async (req, res) => {
  try {
    const memberId = await getMemberIdForUser(req.user.userId);
    if (!memberId) {
      return res.status(404).json({ error: 'Üye kaydı bulunamadı' });
    }

    let memberRes;
    try {
      memberRes = await db.query(
        `SELECT id, member_no, first_name, last_name, name, phone, email,
                birth_date, profession, address, contact_name, contact_phone,
                systemic_diseases, clinical_conditions, past_operations, notes,
                deletion_requested_at
         FROM members WHERE id = $1`,
        [memberId]
      );
    } catch (colErr) {
      if (colErr.code !== '42703') throw colErr;
      memberRes = await db.query(
        `SELECT id, member_no, first_name, last_name, name, phone, email,
                birth_date, profession, address, contact_name, contact_phone,
                systemic_diseases, clinical_conditions, past_operations, notes
         FROM members WHERE id = $1`,
        [memberId]
      );
    }
    if (memberRes.rows.length === 0) {
      return res.status(404).json({ error: 'Üye bulunamadı' });
    }
    const member = memberRes.rows[0];

    const packagesRes = await db.query(
      `SELECT mp.*, p.name AS package_name, p.lesson_count, p.package_type
       FROM member_packages mp
       JOIN packages p ON p.id = mp.package_id
       WHERE mp.member_id = $1
       ORDER BY mp.start_date DESC`,
      [memberId]
    );

    const staffMap = await loadStaffMap();
    const todayStr = localTodayDateStr();
    const activeRows = packagesRes.rows.filter((r) => isMemberPackageActive(r, todayStr));
    const pastRows = packagesRes.rows.filter((r) => !isMemberPackageActive(r, todayStr));

    const activePackage = activeRows.length > 0
      ? await buildPackageWithSessions(activeRows[0], memberId, staffMap)
      : null;

    const pastPackages = [];
    for (const row of pastRows) {
      pastPackages.push(await buildPackageWithSessions(row, memberId, staffMap));
    }

    const notifications = [];
    if (activePackage && activePackage.remainingSessions < 4 && activePackage.remainingSessions > 0) {
      notifications.push({
        type: 'package_low',
        message: `Paketiniz bitmek üzere. Kalan seans: ${activePackage.remainingSessions}`,
        remainingSessions: activePackage.remainingSessions,
      });
    } else if (activePackage && activePackage.remainingSessions === 0) {
      notifications.push({
        type: 'package_empty',
        message: 'Aktif paketinizde kullanılabilir seans hakkı kalmadı.',
        remainingSessions: 0,
      });
    }

    const deletionRequestedAt = member.deletion_requested_at || null;
    if (deletionRequestedAt) {
      notifications.push({
        type: 'deletion_pending',
        message: 'Üyelik iptal talebiniz alındı. Onaylandıktan sonra bilgilendirileceksiniz.',
      });
    }

    let pendingPackageRequest = null;
    let catalogPackages = [];
    try {
      const catalogRes = await db.query(
        'SELECT id, name, lesson_count, package_type FROM packages ORDER BY name'
      );
      catalogPackages = catalogRes.rows.map((p) => ({
        id: p.id,
        name: p.name,
        lessonCount: p.lesson_count,
        packageType: p.package_type,
      }));

      if (!activePackage) {
        const reqRes = await db.query(
          `SELECT pr.id, pr.package_id, pr.requested_at, p.name AS package_name
           FROM package_requests pr
           JOIN packages p ON p.id = pr.package_id
           WHERE pr.member_id = $1 AND pr.status = 'pending'
           ORDER BY pr.requested_at DESC LIMIT 1`,
          [memberId]
        );
        if (reqRes.rows.length > 0) {
          const r = reqRes.rows[0];
          pendingPackageRequest = {
            id: r.id,
            packageId: r.package_id,
            packageName: r.package_name,
            requestedAt: r.requested_at ? new Date(r.requested_at).toISOString() : null,
          };
          notifications.push({
            type: 'package_request_pending',
            message: `«${r.package_name}» paket talebiniz alındı. Onaylandıktan sonra bilgilendirileceksiniz.`,
          });
        }
      }
    } catch (pkgReqErr) {
      if (pkgReqErr.code !== '42P01') throw pkgReqErr;
    }

    res.json({
      profile: {
        id: member.id,
        memberNo: member.member_no,
        firstName: member.first_name,
        lastName: member.last_name,
        fullName: member.name || `${member.first_name || ''} ${member.last_name || ''}`.trim(),
        phone: member.phone,
        email: member.email,
        birthDate: member.birth_date,
        profession: member.profession,
        address: member.address,
        contactName: member.contact_name,
        contactPhone: member.contact_phone,
        systemicDiseases: member.systemic_diseases,
        clinicalConditions: member.clinical_conditions,
        pastOperations: member.past_operations,
        notes: member.notes,
        deletionRequestedAt: deletionRequestedAt ? new Date(deletionRequestedAt).toISOString() : null,
      },
      activePackage,
      pastPackages,
      notifications,
      contactWhatsApp: await getInstitutionWhatsApp(),
      pendingPackageRequest,
      catalogPackages,
    });
  } catch (error) {
    console.error('Member dashboard error:', error);
    res.status(500).json({ error: 'Üye bilgileri alınırken hata oluştu' });
  }
});

// Seans iptal (esnek paket, 2 saat kuralı)
router.post('/sessions/:id/cancel', requireMember, async (req, res) => {
  try {
    const memberId = await getMemberIdForUser(req.user.userId);
    if (!memberId) {
      return res.status(404).json({ error: 'Üye kaydı bulunamadı' });
    }

    const { id } = req.params;
    const sessionRes = await db.query(
      `SELECT s.*, p.package_type, mp.status AS package_status, mp.start_date
       FROM sessions s
       LEFT JOIN member_packages mp ON mp.id = s.member_package_id
       LEFT JOIN packages p ON p.id = mp.package_id
       WHERE s.id = $1 AND (s.deleted_at IS NULL)`,
      [id]
    );
    if (sessionRes.rows.length === 0) {
      return res.status(404).json({ error: 'Seans bulunamadı' });
    }

    const session = sessionRes.rows[0];
    if (session.member_id !== memberId) {
      return res.status(403).json({ error: 'Bu seans size ait değil' });
    }
    if (session.package_status !== 'active') {
      return res.status(400).json({ error: 'Yalnızca aktif paketinizdeki seanslar iptal edilebilir' });
    }

    const staffMap = await loadStaffMap();
    const dto = sessionToDto(session, staffMap, session.package_type || 'fixed');
    if (!dto.canCancel) {
      return res.status(400).json({ error: dto.cancelReason || 'Bu seans iptal edilemez' });
    }

    const { reason, requestNewAppointment } = req.body || {};
    const cancelReasonText = typeof reason === 'string' ? reason.trim().slice(0, 300) : '';

    const { cancelledIds, replenished } = await cancelPackageSessionsAtSlot(db, {
      memberId,
      startTs: session.start_ts,
      memberPackageId: session.member_package_id,
      deletedBy: req.user.userId,
    });

    if (cancelledIds.length === 0) {
      return res.status(404).json({ error: 'Seans bulunamadı' });
    }

    await activityLog(req, {
      action: 'session.cancel_by_member',
      entityType: 'session',
      entityId: id,
      details: {
        memberId,
        startTs: session.start_ts,
        cancelledIds,
        replenished: replenished.added,
        cancelReason: cancelReasonText || null,
        requestNewAppointment: !!requestNewAppointment,
      },
      actorId: req.user.userId,
      actorType: 'member',
    }).catch(() => {});

    res.json({
      message: replenished.added
        ? 'Seans iptal edildi, paket sonuna yeni seans eklendi'
        : 'Seans iptal edildi',
      replenished: replenished.added,
      replenishedReason: replenished.added ? null : (replenished.reason || null),
    });
  } catch (error) {
    console.error('Member session cancel error:', error);
    res.status(500).json({ error: 'Seans iptal edilirken hata oluştu' });
  }
});

// Üye giriş QR (45 sn'de bir yenilenir; kapı okuyucu doğrulaması için)
router.get('/access-qr', requireMember, async (req, res) => {
  try {
    const memberId = await getMemberIdForUser(req.user.userId);
    if (!memberId) {
      return res.status(404).json({ error: 'Üye kaydı bulunamadı' });
    }
    const access = createMemberAccessToken(memberId);
    const qrDataUrl = await QRCode.toDataURL(access.qrPayload, {
      errorCorrectionLevel: 'M',
      margin: 1,
      width: 280,
      color: { dark: '#0b1020', light: '#ffffff' },
    });
    res.json({
      qrDataUrl,
      expiresIn: access.expiresIn,
      windowSec: access.windowSec,
      memberId: access.memberId,
    });
  } catch (error) {
    console.error('Member access QR error:', error);
    res.status(500).json({ error: 'QR oluşturulurken hata oluştu' });
  }
});

// Üyelik iptal talebi (admin onayı bekler)
router.post('/request-account-deletion', requireMember, async (req, res) => {
  try {
    const memberId = await getMemberIdForUser(req.user.userId);
    if (!memberId) {
      return res.status(404).json({ error: 'Üye kaydı bulunamadı' });
    }

    let memberRes;
    try {
      memberRes = await db.query(
        'SELECT id, deletion_requested_at FROM members WHERE id = $1 AND (deleted_at IS NULL)',
        [memberId]
      );
    } catch (colErr) {
      if (colErr.code === '42703') {
        return res.status(503).json({
          error: 'Üyelik iptal talebi henüz etkin değil. Lütfen migration_members_deletion_request.sql çalıştırın.',
        });
      }
      throw colErr;
    }

    if (memberRes.rows.length === 0) {
      return res.status(404).json({ error: 'Üye bulunamadı' });
    }

    const member = memberRes.rows[0];
    if (member.deletion_requested_at) {
      return res.json({
        message: 'Üyelik iptal talebiniz zaten iletilmiş. Onaylandıktan sonra bilgilendirileceksiniz.',
        alreadyRequested: true,
        deletionRequestedAt: new Date(member.deletion_requested_at).toISOString(),
      });
    }

    const updateRes = await db.query(
      `UPDATE members SET deletion_requested_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND (deleted_at IS NULL)
       RETURNING deletion_requested_at`,
      [memberId]
    );

    await activityLog(req, {
      action: 'member.request_deletion',
      entityType: 'member',
      entityId: memberId,
      actorId: req.user.userId,
      actorType: 'member',
    }).catch(() => {});

    res.json({
      message: 'Üyelik iptal talebiliniz iletilmiştir. Onaylandıktan sonra bilgilendirileceksiniz.',
      deletionRequestedAt: updateRes.rows[0]?.deletion_requested_at
        ? new Date(updateRes.rows[0].deletion_requested_at).toISOString()
        : new Date().toISOString(),
    });
  } catch (error) {
    console.error('Member deletion request error:', error);
    res.status(500).json({ error: 'Üyelik iptal talebi iletilirken hata oluştu' });
  }
});

// Yeni paket talebi (aktif paketi olmayan üye)
router.post('/package-request', requireMember, [
  body('package_id').isInt({ min: 1 }),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const memberId = await getMemberIdForUser(req.user.userId);
    if (!memberId) {
      return res.status(404).json({ error: 'Üye kaydı bulunamadı' });
    }

    const { package_id: packageId } = req.body;

    const activeRes = await db.query(
      'SELECT id FROM member_packages WHERE member_id = $1 AND status = $2 LIMIT 1',
      [memberId, 'active']
    );
    if (activeRes.rows.length > 0) {
      return res.status(400).json({ error: 'Aktif paketiniz varken yeni paket talebi gönderemezsiniz.' });
    }

    const pkgRes = await db.query('SELECT id, name FROM packages WHERE id = $1', [packageId]);
    if (pkgRes.rows.length === 0) {
      return res.status(404).json({ error: 'Paket bulunamadı' });
    }

    let insertRes;
    try {
      insertRes = await db.query(
        `INSERT INTO package_requests (member_id, package_id, status)
         VALUES ($1, $2, 'pending')
         RETURNING id, requested_at`,
        [memberId, packageId]
      );
    } catch (insErr) {
      if (insErr.code === '42P01') {
        return res.status(503).json({
          error: 'Paket talebi henüz etkin değil. migration_package_requests.sql çalıştırın.',
        });
      }
      if (insErr.code === '23505') {
        return res.status(400).json({ error: 'Zaten bekleyen bir paket talebiniz var.' });
      }
      throw insErr;
    }

    const memberRes = await db.query(
      `SELECT COALESCE(TRIM(first_name || ' ' || last_name), name, '') AS member_name, member_no
       FROM members WHERE id = $1`,
      [memberId]
    );
    const memberName = memberRes.rows[0]?.member_name || '';
    const packageName = pkgRes.rows[0].name;

    await activityLog(req, {
      action: 'package_request.create',
      entityType: 'package_request',
      entityId: insertRes.rows[0].id,
      details: {
        member_id: memberId,
        member_name: memberName,
        package_id: packageId,
        package_name: packageName,
      },
    }).catch(() => {});

    res.status(201).json({
      id: insertRes.rows[0].id,
      packageId,
      packageName,
      requestedAt: insertRes.rows[0].requested_at
        ? new Date(insertRes.rows[0].requested_at).toISOString()
        : new Date().toISOString(),
      message: `«${packageName}» paket talebiniz iletildi. Onaylandıktan sonra bilgilendirileceksiniz.`,
    });
  } catch (error) {
    console.error('Member package request error:', error);
    res.status(500).json({ error: 'Paket talebi iletilirken hata oluştu' });
  }
});

export default router;
