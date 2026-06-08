import express from 'express';
import db from '../config/database.js';
import { verifyToken } from './auth.js';
import { log as activityLog } from '../utils/activityLogger.js';
import { addNextSessionAfterLastForPackage } from '../utils/packageSessions.js';

const router = express.Router();
router.use(verifyToken);

const TWO_HOURS_MS = 2 * 60 * 60 * 1000;

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

function startOfTodayMs() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function sessionToDto(row, staffMap, packageType) {
  const now = Date.now();
  const startTs = Number(row.start_ts);
  const isPast = startTs < startOfTodayMs();
  const isFlexible = packageType === 'flexible';
  let canCancel = false;
  let cancelReason = null;

  if (isPast) {
    cancelReason = 'Geçmiş seanslar iptal edilemez';
  } else if (!isFlexible) {
    cancelReason = 'Sabit pakette seans iptali yapılamaz';
  } else if (startTs - now < TWO_HOURS_MS) {
    cancelReason = 'Seans saatine 2 saatten az kaldı; seans yapılmış sayılır';
  } else {
    canCancel = true;
  }

  const staff = staffMap[row.staff_id];
  return {
    id: row.id,
    staffId: row.staff_id,
    staffName: staff ? `${staff.first_name || ''} ${staff.last_name || ''}`.trim() : '',
    roomId: row.room_id,
    startTs,
    endTs: Number(row.end_ts),
    note: row.note || '',
    isPast,
    canCancel,
    cancelReason,
    status: isPast ? 'completed' : (startTs - now < TWO_HOURS_MS && isFlexible ? 'locked' : 'scheduled'),
  };
}

async function loadStaffMap() {
  const res = await db.query('SELECT id, first_name, last_name FROM staff');
  const map = {};
  for (const row of res.rows) map[row.id] = row;
  return map;
}

async function buildPackageWithSessions(mpRow, memberId, staffMap) {
  const sessionsRes = await db.query(
    `SELECT * FROM sessions
     WHERE member_package_id = $1 AND member_id = $2 AND (deleted_at IS NULL)
     ORDER BY start_ts ASC`,
    [mpRow.id, memberId]
  );

  const packageType = mpRow.package_type || 'fixed';
  const sessions = sessionsRes.rows.map((s) => sessionToDto(s, staffMap, packageType));
  const now = Date.now();
  const futureSessions = sessions.filter((s) => s.startTs > now);
  const pastSessions = sessions.filter((s) => s.startTs <= now);
  const remainingCount = futureSessions.length;

  return {
    id: mpRow.id,
    packageId: mpRow.package_id,
    packageName: mpRow.package_name || '',
    packageType,
    lessonCount: mpRow.lesson_count,
    startDate: mpRow.start_date,
    endDate: mpRow.end_date,
    status: mpRow.status,
    remainingSessions: remainingCount,
    usedSessions: pastSessions.length,
    totalSessions: sessions.length,
    sessions,
  };
}

// Üye portalı ana veri: profil, paketler, bildirimler
router.get('/dashboard', requireMember, async (req, res) => {
  try {
    const memberId = await getMemberIdForUser(req.user.userId);
    if (!memberId) {
      return res.status(404).json({ error: 'Üye kaydı bulunamadı' });
    }

    const memberRes = await db.query(
      `SELECT id, member_no, first_name, last_name, name, phone, email,
              birth_date, profession, address, contact_name, contact_phone,
              systemic_diseases, clinical_conditions, past_operations, notes
       FROM members WHERE id = $1`,
      [memberId]
    );
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
    const activeRows = packagesRes.rows.filter((r) => r.status === 'active');
    const pastRows = packagesRes.rows.filter((r) => r.status !== 'active');

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
        message: 'Aktif paketinizde planlanmış seans kalmadı.',
        remainingSessions: 0,
      });
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
      },
      activePackage,
      pastPackages,
      notifications,
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

    // Aynı tarih/saatte mükerrer kayıtlar varsa hepsini iptal et
    const cancelRes = await db.query(
      `UPDATE sessions SET deleted_at = CURRENT_TIMESTAMP, deleted_by = $3
       WHERE member_id = $1 AND start_ts = $2 AND (deleted_at IS NULL)
       RETURNING id`,
      [memberId, session.start_ts, req.user.userId]
    );

    let replenished = { added: false };
    if (session.member_package_id) {
      replenished = await addNextSessionAfterLastForPackage(db, session.member_package_id, {
        afterCancelTs: session.start_ts,
        skipStartTs: session.start_ts,
      });
    }

    await activityLog(req, {
      action: 'session.cancel_by_member',
      entityType: 'session',
      entityId: id,
      details: {
        memberId,
        startTs: session.start_ts,
        cancelledIds: cancelRes.rows.map((r) => r.id),
        replenished: replenished.added,
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

export default router;
