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
import { normalizePhoneFlexible } from '../utils/phone.js';
import { logWalkInQrAccess, logStaffAccess } from '../utils/facilityAccess.js';
import { resolveLocalDateRangeMs } from '../utils/staffWorkingHours.js';
import { getInstitutionWhatsApp } from '../utils/appSettings.js';
import QRCode from 'qrcode';

const router = express.Router();

const METHOD_LABEL = { qr: 'QR', card: 'KART', phone: 'TELEFON' };

async function expoPush(messages) {
  if (!messages.length) return;
  try {
    const res = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(messages),
    });
    const data = await res.json().catch(() => null);
    if (data?.data) {
      data.data.forEach((ticket, i) => {
        if (ticket.status === 'error') {
          console.error(`[expoPush] hata ticket[${i}]: ${ticket.message}`, ticket.details ?? '');
        }
      });
    }
  } catch (err) {
    console.error('[expoPush] fetch hatası:', err.message);
  }
}

async function sendDeletionRequestPush(memberName, memberId) {
  try {
    const title = 'Üyelik İptal Talebi';
    const bodyText = `${memberName} üyelik iptali talebinde bulundu.`;

    const { rows: adminRows } = await db.query(
      `SELECT u.id AS user_id, pt.token
       FROM users u
       LEFT JOIN push_tokens pt ON pt.user_id = u.id
       WHERE u.role IN ('admin', 'manager')`
    );

    const payload = JSON.stringify({ memberId });
    const seenUsers = new Set();
    for (const r of adminRows) {
      if (!r.user_id || seenUsers.has(r.user_id)) continue;
      seenUsers.add(r.user_id);
      db.query(
        `INSERT INTO staff_notifications (user_id, type, title, body, payload) VALUES ($1, $2, $3, $4, $5)`,
        [r.user_id, 'deletion_request', title, bodyText, payload]
      ).catch(() => {});
    }

    const seenTokens = new Set();
    const messages = adminRows
      .filter((r) => {
        if (!r.token) return false;
        if (seenTokens.has(r.token)) return false;
        seenTokens.add(r.token);
        return true;
      })
      .map((r) => ({ to: r.token, title, body: bodyText, sound: 'natification.caf', priority: 'high', channelId: 'fizyopark', interruptionLevel: 'active' }));

    await expoPush(messages);
  } catch {
    // push hatası talebi engellemesin
  }
}

async function sendCancellationPush(memberName, startTs, staffName, staffId) {
  try {
    const TZ = 3 * 60 * 60 * 1000;
    const d = new Date(Number(startTs) + TZ);
    const dd = String(d.getUTCDate()).padStart(2, '0');
    const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
    const yyyy = d.getUTCFullYear();
    const hh = String(d.getUTCHours()).padStart(2, '0');
    const min = String(d.getUTCMinutes()).padStart(2, '0');
    const DAYS = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];
    const dateStr = `${dd}.${mm}.${yyyy}`;
    const dayName = DAYS[d.getUTCDay()];
    const timeStr = `${hh}:${min}`;
    const staffPart = staffName ? ` ${staffName} ile olan` : '';

    const title = 'Üye Randevu İptali';
    const bodyText = `${memberName} - ${dateStr} ${dayName} ${timeStr}${staffPart} randevusunu iptal etmiştir.`;

    // Admin/Manager: push token olmayan kullanıcılar da bildirim listesinde görsün (LEFT JOIN)
    const { rows: adminRows } = await db.query(
      `SELECT u.id AS user_id, pt.token
       FROM users u
       LEFT JOIN push_tokens pt ON pt.user_id = u.id
       WHERE u.role IN ('admin', 'manager')`
    );

    // Personel sadece BUGÜNKÜ iptal ise alır
    const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date();   endOfDay.setHours(23, 59, 59, 999);
    const isToday = Number(startTs) >= startOfDay.getTime() && Number(startTs) <= endOfDay.getTime();

    let staffRows = [];
    if (isToday && staffId) {
      const { rows } = await db.query(
        `SELECT s.user_id, pt.token
         FROM staff s
         LEFT JOIN push_tokens pt ON pt.user_id = s.user_id
         WHERE s.id = $1 AND s.user_id IS NOT NULL`,
        [staffId]
      );
      staffRows = rows;
    }

    // staff_notifications tablosuna kaydet → tablet sidebar'ında "İptaller" filtresinde görünür
    const payload = JSON.stringify({ startTs: Number(startTs), memberName });
    const seenUsers = new Set();
    for (const r of [...adminRows, ...staffRows]) {
      if (!r.user_id || seenUsers.has(r.user_id)) continue;
      seenUsers.add(r.user_id);
      db.query(
        `INSERT INTO staff_notifications (user_id, type, title, body, payload) VALUES ($1, $2, $3, $4, $5)`,
        [r.user_id, 'cancel', title, bodyText, payload]
      ).catch(() => {});
    }

    // Push bildirimleri (token olanlar)
    const seenTokens = new Set();
    const messages = [...adminRows, ...staffRows]
      .filter((r) => {
        if (!r.token) return false;
        if (seenTokens.has(r.token)) return false;
        seenTokens.add(r.token);
        return true;
      })
      .map((r) => ({ to: r.token, title, body: bodyText, sound: 'natification.caf', priority: 'high', channelId: 'fizyopark', interruptionLevel: 'active' }));

    await expoPush(messages);
  } catch {
    // push hatası iptal işlemini engellemesin
  }
}

async function sendEntryPush(memberName, method, startTs, sessionId, memberId) {
  try {
    const methodLabel = METHOD_LABEL[method] || method.toUpperCase();
    const entryBody = startTs
      ? `${memberName} - ${methodLabel} ile ${new Date(Number(startTs)).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Istanbul' })}'deki randevusu için giriş yapmıştır.`
      : `${memberName} - ${methodLabel} ile randevusuz giriş yapmıştır.`;

    // Admin/Manager token'ları
    const { rows: adminRows } = await db.query(
      `SELECT pt.token FROM push_tokens pt
       JOIN users u ON u.id = pt.user_id
       WHERE u.role IN ('admin', 'manager')`
    );

    // O saatteki sorumlu personelin token'ı
    let staffRows = [];
    if (sessionId) {
      const { rows } = await db.query(
        `SELECT pt.token FROM push_tokens pt
         JOIN staff s ON s.user_id = pt.user_id
         JOIN sessions ses ON ses.staff_id = s.id
         WHERE ses.id = $1`,
        [sessionId]
      );
      staffRows = rows;
    }

    // Tekrar eden token'ları filtrele
    const seen = new Set();
    const entryMessages = [...adminRows, ...staffRows]
      .filter((r) => { if (seen.has(r.token)) return false; seen.add(r.token); return true; })
      .map((r) => ({ to: r.token, title: 'Kapı Girişi', body: entryBody, sound: 'natification.caf', priority: 'high', channelId: 'fizyopark', interruptionLevel: 'active' }));

    if (!entryMessages.length) {
      console.warn(`[sendEntryPush] token bulunamadı — üye: ${memberName}, method: ${method}`);
    }

    // Üyenin kendi bildirimi
    let memberMessages = [];
    if (memberId) {
      const { rows: mRows } = await db.query(
        `SELECT pt.token FROM push_tokens pt
         JOIN members m ON m.user_id = pt.user_id
         WHERE m.id = $1`,
        [memberId]
      );
      if (mRows.length) {
        const { rows: pkgRows } = await db.query(
          `SELECT p.name, mp.id AS mp_id FROM member_packages mp
           JOIN packages p ON p.id = mp.package_id
           WHERE mp.member_id = $1 AND mp.status = 'active' AND mp.deleted_at IS NULL
           ORDER BY mp.created_at DESC LIMIT 1`,
          [memberId]
        );
        let memberBody = 'Giriş kaydedildi.';
        if (pkgRows.length) {
          const stats = await getActivePackageStats(db, memberId, sessionId);
          if (stats) memberBody = `${pkgRows[0].name} paketinizden kalan seans: ${stats.remainingSessions}`;
        }
        memberMessages = mRows.map((r) => ({ to: r.token, title: `Merhaba ${memberName}`, body: memberBody, sound: 'natification.caf', priority: 'high', interruptionLevel: 'active' }));
      }
    }

    await Promise.all([expoPush(entryMessages), expoPush(memberMessages)]);
  } catch (err) {
    console.error('[sendEntryPush] hata:', err.message);
  }
}

async function getActivePackageStats(db, memberId, sessionId) {
  try {
    // 1. member_package_id bul
    let mpId = null;
    if (sessionId) {
      const r = await db.query(
        'SELECT member_package_id FROM sessions WHERE id = $1 LIMIT 1',
        [sessionId]
      );
      mpId = r.rows[0]?.member_package_id ?? null;
    }
    if (!mpId) {
      const r = await db.query(
        'SELECT id FROM member_packages WHERE member_id = $1 ORDER BY start_date DESC LIMIT 1',
        [memberId]
      );
      mpId = r.rows[0]?.id ?? null;
    }
    if (!mpId) {
      console.warn('[getActivePackageStats] member_package_id bulunamadı, memberId:', memberId);
      return null;
    }

    // 2. Toplam seans sayısını ve paket adını packages tablosundan al
    const pkgR = await db.query(
      'SELECT p.lesson_count, p.name AS package_name FROM member_packages mp JOIN packages p ON p.id = mp.package_id WHERE mp.id = $1 LIMIT 1',
      [mpId]
    );
    const total = pkgR.rows[0]?.lesson_count ? Number(pkgR.rows[0].lesson_count) : null;
    const packageName = pkgR.rows[0]?.package_name || null;
    if (!total) {
      console.warn('[getActivePackageStats] lesson_count alınamadı, mpId:', mpId);
      return null;
    }

    // 3. Kullanılan seans sayısını say — isSessionConsumed mantığıyla eşleşmeli:
    //    - explicit giriş veya no_show, VEYA
    //    - seans saati geçmiş (otomatik no-show), iptal edilmemiş
    const usedR = await db.query(
      `SELECT COUNT(*)::int AS used_count
       FROM sessions
       WHERE member_package_id = $1
         AND deleted_at IS NULL
         AND (
           checked_in_at IS NOT NULL
           OR attendance_outcome = 'no_show'
           OR end_ts < EXTRACT(EPOCH FROM NOW()) * 1000
         )`,
      [mpId]
    );
    const used = Number(usedR.rows[0]?.used_count ?? 0);

    return { packageName, totalSessions: total, remainingSessions: Math.max(0, total - used) };
  } catch (err) {
    console.error('[getActivePackageStats] hata:', err.message, '| memberId:', memberId, '| sessionId:', sessionId);
    return null;
  }
}

function requireKioskToken(req, res, next) {
  const expected = process.env.KIOSK_TOKEN;
  if (expected && req.headers['x-kiosk-token'] !== expected) {
    return res.status(403).json({ valid: false, reason: 'unauthorized' });
  }
  next();
}

// Kapı okuyucu doğrulama (auth gerektirmez — mikrodenetleyici kullanacak)
router.post('/verify-access', requireKioskToken, async (req, res) => {
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

    let memberName = null;
    let memberUserId = null;
    try {
      const memberRow = await db.query(
        'SELECT name, first_name, last_name, user_id FROM members WHERE id = $1',
        [result.memberId]
      );
      const r = memberRow.rows[0];
      memberName = r ? (r.name || `${r.first_name || ''} ${r.last_name || ''}`.trim() || null) : null;
      memberUserId = r?.user_id || null;
    } catch (_) {}

    if (checkIn.checkedIn) {
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

    if (memberName) {
      sendEntryPush(memberName, 'qr', checkIn.checkedIn ? checkIn.startTs : null, checkIn.checkedIn ? checkIn.sessionId : null, result.memberId).catch(() => {});
    }

    const packageStats = await getActivePackageStats(db, result.memberId, checkIn.checkedIn ? checkIn.sessionId : null);

    res.json({
      valid: true,
      memberId: result.memberId,
      memberName,
      checkIn: checkIn.checkedIn
        ? { ok: true, sessionId: checkIn.sessionId, startTs: checkIn.startTs }
        : { ok: false, reason: checkIn.reason || 'no_session' },
      packageStats,
    });
  } catch (error) {
    console.error('Verify access error:', error);
    res.status(500).json({ error: 'Doğrulama hatası' });
  }
});

// RFID kart numarasıyla kapı erişimi (auth gerektirmez — kiosk kullanacak)
router.post('/verify-card-access', requireKioskToken, async (req, res) => {
  try {
    const { card } = req.body || {};
    const normalized = card ? String(card).trim() : null;
    if (!normalized) {
      return res.status(401).json({ valid: false, reason: 'format' });
    }

    // Önce üye tablosunu kontrol et (member_cards tablosundan çok kartlı arama)
    let memberRow;
    try {
      memberRow = await db.query(
        `SELECT m.id, m.name, m.first_name, m.last_name, m.user_id
         FROM members m
         JOIN member_cards mc ON mc.member_id = m.id
         WHERE mc.card_no = $1 AND m.deleted_at IS NULL`,
        [normalized]
      );
    } catch (err) {
      if (err.code !== '42703') throw err;
      console.warn('verify-card-access: first_name/last_name sütunu yok; migration_members_kimlik.sql çalıştırın');
      memberRow = await db.query(
        `SELECT m.id, m.name, m.user_id
         FROM members m
         JOIN member_cards mc ON mc.member_id = m.id
         WHERE mc.card_no = $1 AND m.deleted_at IS NULL`,
        [normalized]
      );
    }

    if (memberRow.rows.length) {
      const _mr = memberRow.rows[0];
      const memberId = _mr.id;
      const memberName = _mr.name || `${_mr.first_name || ''} ${_mr.last_name || ''}`.trim() || null;
      const memberUserId = _mr.user_id;

      let checkIn = { checkedIn: false, reason: 'no_session' };
      try {
        checkIn = await checkInSessionForMember(db, memberId, Date.now(), 'card');
      } catch (checkInErr) {
        if (checkInErr.code !== '42703') throw checkInErr;
        console.warn('verify-card-access: checked_in_at sütunu yok; migration_sessions_check_in.sql çalıştırın');
      }

      if (checkIn.checkedIn) {
        await activityLog(req, {
          action: 'session.check_in_qr',
          entityType: 'session',
          entityId: checkIn.sessionId,
          ...(memberUserId
            ? { actorId: memberUserId, actorType: 'user', actorName: memberName || undefined }
            : { actorName: memberName ? `Üye: ${memberName}` : `Üye#${memberId}` }),
          details: { memberId, memberName: memberName || undefined, startTs: checkIn.startTs, checkInMethod: 'card' },
        }).catch(() => {});
      } else {
        await logWalkInQrAccess(db, memberId, 'card');
      }

      sendEntryPush(memberName, 'card', checkIn.checkedIn ? checkIn.startTs : null, checkIn.checkedIn ? checkIn.sessionId : null, memberId).catch(() => {});

      const packageStats = await getActivePackageStats(db, memberId, checkIn.checkedIn ? checkIn.sessionId : null);
      return res.json({
        valid: true,
        memberId,
        memberName,
        checkIn: checkIn.checkedIn
          ? { ok: true, sessionId: checkIn.sessionId, startTs: checkIn.startTs }
          : { ok: false, reason: checkIn.reason || 'no_session' },
        packageStats,
      });
    }

    // Personel tablosunu kontrol et
    const staffRow = await db.query(
      `SELECT s.id, s.first_name, s.last_name, u.role
       FROM staff s LEFT JOIN users u ON u.id = s.user_id
       WHERE s.card_no = $1`,
      [normalized]
    );
    if (!staffRow.rows.length) {
      return res.status(401).json({ valid: false, reason: 'card_not_found' });
    }

    const sf = staffRow.rows[0];
    const staffName = `${sf.first_name} ${sf.last_name}`.trim();
    await logStaffAccess(db, sf.id, 'card');
    await activityLog(req, {
      action: 'facility.staff_access',
      entityType: 'staff',
      entityId: sf.id,
      actorName: staffName,
      details: { checkInMethod: 'card' },
    }).catch(() => {});

    return res.json({ valid: true, memberId: null, memberName: staffName, isStaff: true, checkIn: { ok: true, isStaff: true }, packageStats: null });
  } catch (error) {
    console.error('Verify card access error:', error);
    res.status(500).json({ error: 'Doğrulama hatası' });
  }
});

// Telefon numarasıyla kapı erişimi (auth gerektirmez — kiosk kullanacak)
router.post('/verify-phone-access', requireKioskToken, async (req, res) => {
  try {
    const { phone } = req.body || {};
    console.log('[verify-phone-access] gelen:', phone);
    const normalized = normalizePhoneFlexible(phone);
    console.log('[verify-phone-access] normalize:', normalized);
    if (!normalized) {
      return res.status(401).json({ valid: false, reason: 'format' });
    }
    // DB'deki numaralar farklı formatlarda olabilir; her iki tarafı rakama indirgeyerek karşılaştır
    const digits = normalized.replace(/\D/g, '');

    // Önce üye tablosunu kontrol et
    let memberRow;
    try {
      memberRow = await db.query(
        `SELECT id, name, first_name, last_name, user_id FROM members
         WHERE REGEXP_REPLACE(phone, '[^0-9]', '', 'g') = $1 AND deleted_at IS NULL`,
        [digits]
      );
    } catch (err) {
      if (err.code !== '42703') throw err;
      console.warn('verify-phone-access: first_name/last_name sütunu yok; migration_members_kimlik.sql çalıştırın');
      memberRow = await db.query(
        `SELECT id, name, user_id FROM members
         WHERE REGEXP_REPLACE(phone, '[^0-9]', '', 'g') = $1 AND deleted_at IS NULL`,
        [digits]
      );
    }

    if (memberRow.rows.length) {
      const _mr = memberRow.rows[0];
      const memberId = _mr.id;
      const memberName = _mr.name || `${_mr.first_name || ''} ${_mr.last_name || ''}`.trim() || null;
      const memberUserId = _mr.user_id;

      let checkIn = { checkedIn: false, reason: 'no_session' };
      try {
        checkIn = await checkInSessionForMember(db, memberId, Date.now(), 'phone');
      } catch (checkInErr) {
        if (checkInErr.code !== '42703') throw checkInErr;
        console.warn('verify-phone-access: checked_in_at sütunu yok; migration_sessions_check_in.sql çalıştırın');
      }

      if (checkIn.checkedIn) {
        await activityLog(req, {
          action: 'session.check_in_qr',
          entityType: 'session',
          entityId: checkIn.sessionId,
          ...(memberUserId
            ? { actorId: memberUserId, actorType: 'user', actorName: memberName || undefined }
            : { actorName: memberName ? `Üye: ${memberName}` : `Üye#${memberId}` }),
          details: { memberId, memberName: memberName || undefined, startTs: checkIn.startTs, checkInMethod: 'phone' },
        }).catch(() => {});
      } else {
        await logWalkInQrAccess(db, memberId, 'phone');
      }

      sendEntryPush(memberName, 'phone', checkIn.checkedIn ? checkIn.startTs : null, checkIn.checkedIn ? checkIn.sessionId : null, memberId).catch(() => {});

      const packageStats = await getActivePackageStats(db, memberId, checkIn.checkedIn ? checkIn.sessionId : null);
      return res.json({
        valid: true,
        memberId,
        memberName,
        checkIn: checkIn.checkedIn
          ? { ok: true, sessionId: checkIn.sessionId, startTs: checkIn.startTs }
          : { ok: false, reason: checkIn.reason || 'no_session' },
        packageStats,
      });
    }

    // Personel tablosunu kontrol et
    const staffRow = await db.query(
      `SELECT s.id, s.first_name, s.last_name, u.role
       FROM staff s LEFT JOIN users u ON u.id = s.user_id
       WHERE REGEXP_REPLACE(s.phone, '[^0-9]', '', 'g') = $1`,
      [digits]
    );
    if (!staffRow.rows.length) {
      return res.status(401).json({ valid: false, reason: 'not_found' });
    }

    const sf = staffRow.rows[0];
    const staffName = `${sf.first_name} ${sf.last_name}`.trim();
    await logStaffAccess(db, sf.id, 'phone');
    await activityLog(req, {
      action: 'facility.staff_access',
      entityType: 'staff',
      entityId: sf.id,
      actorName: staffName,
      details: { checkInMethod: 'phone' },
    }).catch(() => {});

    return res.json({ valid: true, memberId: null, memberName: staffName, isStaff: true, checkIn: { ok: true, isStaff: true }, packageStats: null });
  } catch (error) {
    console.error('Verify phone access error:', error);
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

    let lastCheckIn = null;
    try {
      const { start, end } = resolveLocalDateRangeMs({ dateStr: todayStr });
      const sessionCheckRes = await db.query(
        `SELECT EXTRACT(EPOCH FROM checked_in_at) * 1000 AS checked_in_ts
         FROM sessions
         WHERE member_id = $1 AND check_in_method IN ('qr', 'phone', 'card') AND checked_in_at IS NOT NULL
           AND checked_in_at >= to_timestamp($2 / 1000.0) AND checked_in_at <= to_timestamp($3 / 1000.0)
         ORDER BY checked_in_at DESC LIMIT 1`,
        [memberId, start, end]
      );
      if (sessionCheckRes.rows.length > 0) {
        lastCheckIn = { at: Number(sessionCheckRes.rows[0].checked_in_ts), ok: true };
      }

      const walkInRes = await db.query(
        `SELECT EXTRACT(EPOCH FROM accessed_at) * 1000 AS accessed_ts
         FROM facility_access_logs
         WHERE member_id = $1 AND source IN ('qr', 'phone', 'card')
           AND accessed_at >= to_timestamp($2 / 1000.0) AND accessed_at <= to_timestamp($3 / 1000.0)
         ORDER BY accessed_at DESC LIMIT 1`,
        [memberId, start, end]
      );
      if (walkInRes.rows.length > 0) {
        const walkInAt = Number(walkInRes.rows[0].accessed_ts);
        if (!lastCheckIn || walkInAt > lastCheckIn.at) {
          lastCheckIn = { at: walkInAt, ok: false };
        }
      }
    } catch (checkInErr) {
      if (checkInErr.code !== '42703' && checkInErr.code !== '42P01') throw checkInErr;
    }

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
    if (activePackage) {
      const rem  = activePackage.remainingSessions;
      const total = activePackage.lessonCount || 0;
      const sessionThreshold = Math.ceil(total * 0.25);

      if (rem === 0) {
        notifications.push({
          type: 'package_empty',
          message: 'Aktif paketinizde kullanılabilir seans hakkı kalmadı.',
          remainingSessions: 0,
        });
      } else if (rem <= sessionThreshold) {
        notifications.push({
          type: 'package_low',
          message: `Paketiniz bitmek üzere. Kalan seans hakkı: ${rem}`,
          remainingSessions: rem,
        });
      } else {
        // Seans hâlâ yeterliyse süre bazlı kontrol
        const startMs = activePackage.startDate
          ? new Date(activePackage.startDate + 'T00:00:00Z').getTime() : null;
        const endMs = activePackage.endDate
          ? new Date(activePackage.endDate + 'T00:00:00Z').getTime() : null;
        const todayMs = new Date(todayStr + 'T00:00:00Z').getTime();
        if (startMs && endMs) {
          const totalDays = Math.round((endMs - startMs) / 86400000);
          const daysLeft = Math.round((endMs - todayMs) / 86400000);
          const expiryThresholdDays = Math.ceil(totalDays * 0.25);
          if (daysLeft > 0 && daysLeft <= expiryThresholdDays) {
            notifications.push({
              type: 'package_expiry_warning',
              message: `Paketinizin kullanım süresi ${daysLeft} gün içinde sona erecek. Kalan seans hakkınız: ${rem}.`,
              remainingSessions: rem,
            });
          }
        }
      }
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
        'SELECT id, name, lesson_count, package_type FROM packages WHERE deleted_at IS NULL AND member_visible = true ORDER BY name'
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
      lastCheckIn,
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

    // Üyenin adını al ve iptal push'u gönder (staffMap zaten bellekte — ekstra sorgu yok)
    const staffName = session.staff_id && staffMap[session.staff_id]
      ? `${staffMap[session.staff_id].first_name} ${staffMap[session.staff_id].last_name}`.trim()
      : '';
    db.query('SELECT name, first_name, last_name FROM members WHERE id = $1', [memberId])
      .then(({ rows }) => {
        const r = rows[0];
        const memberName = r ? (r.name || `${r.first_name || ''} ${r.last_name || ''}`.trim() || 'Üye') : 'Üye';
        sendCancellationPush(memberName, session.start_ts, staffName, session.staff_id).catch(() => {});
      })
      .catch(() => {});

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
        'SELECT id, deletion_requested_at, name, first_name, last_name FROM members WHERE id = $1 AND (deleted_at IS NULL)',
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

    const memberName = (member.name || `${member.first_name || ''} ${member.last_name || ''}`.trim()) || 'Üye';
    sendDeletionRequestPush(memberName, memberId).catch(() => {});

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

    const pkgRes = await db.query(
      'SELECT id, name FROM packages WHERE id = $1 AND deleted_at IS NULL AND member_visible = true',
      [packageId]
    );
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

// ── Üyeye gelen broadcast bildirimleri ───────────────────────────────────

// GET /member-portal/my-broadcasts — bu üyeye gönderilmiş tüm bildirimler
router.get('/my-broadcasts', requireMember, async (req, res) => {
  try {
    const memberId = await getMemberIdForUser(req.user.userId);
    if (!memberId) return res.status(404).json({ error: 'Üye kaydı bulunamadı' });

    const { rows } = await db.query(
      `SELECT br.id, b.title, b.body, b.created_at, br.seen_at
       FROM broadcast_recipients br
       JOIN broadcasts b ON b.id = br.broadcast_id
       WHERE br.member_id = $1
       ORDER BY b.created_at DESC`,
      [memberId]
    );
    res.json({ items: rows });
  } catch (err) {
    if (err.code === '42P01') return res.json({ items: [] });
    console.error('My broadcasts error:', err);
    res.status(500).json({ error: 'Bildirimler alınamadı' });
  }
});

// POST /member-portal/my-broadcasts/:id/seen — okundu olarak işaretle
router.post('/my-broadcasts/:id/seen', requireMember, async (req, res) => {
  try {
    const memberId = await getMemberIdForUser(req.user.userId);
    if (!memberId) return res.status(404).json({ error: 'Üye kaydı bulunamadı' });

    await db.query(
      `UPDATE broadcast_recipients
       SET seen_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND member_id = $2 AND seen_at IS NULL`,
      [req.params.id, memberId]
    );
    res.json({ ok: true });
  } catch (err) {
    if (err.code === '42P01') return res.json({ ok: true });
    console.error('Mark broadcast seen error:', err);
    res.status(500).json({ error: 'Güncellenemedi' });
  }
});

export default router;
