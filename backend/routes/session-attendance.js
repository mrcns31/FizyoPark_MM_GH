import express from 'express';
import { body, query, validationResult } from 'express-validator';
import db from '../config/database.js';
import { verifyToken } from './auth.js';
import { log as activityLog } from '../utils/activityLogger.js';
import { localDateStrFromTs } from '../utils/staffWorkingHours.js';
import {
  buildAttendanceLabel,
  confirmSessionAttendance,
  getStaffRowForUser,
  listAttendanceEntryList,
  listPendingAttendanceSessions,
  listStaffNotifications,
  markStaffNotificationRead,
  runShiftEndAttendanceReminder,
} from '../utils/sessionAttendance.js';
import { listWalkInAccessForDate } from '../utils/facilityAccess.js';

const router = express.Router();

router.use(verifyToken);

function denyMember(req, res) {
  if (req.user.role === 'member') {
    res.status(403).json({ error: 'Bu işlem yalnızca personel içindir' });
    return true;
  }
  return false;
}

async function resolveStaffScope(req) {
  if (req.user.role === 'staff') {
    const staff = await getStaffRowForUser(db, req.user.userId);
    if (!staff) return { staffId: null, staffRow: null };
    return { staffId: staff.id, staffRow: staff };
  }
  const staffId = req.query.staffId != null ? parseInt(req.query.staffId, 10) : null;
  if (staffId) {
    const r = await db.query(
      'SELECT id, user_id, first_name, last_name, working_hours FROM staff WHERE id = $1',
      [staffId]
    );
    return { staffId, staffRow: r.rows[0] ?? null };
  }
  return { staffId: null, staffRow: null };
}

/** QR okutmayan, onay bekleyen seanslar */
router.get(
  '/pending',
  [query('date').optional().matches(/^\d{4}-\d{2}-\d{2}$/)],
  async (req, res) => {
    try {
      if (denyMember(req, res)) return;
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { staffId, staffRow } = await resolveStaffScope(req);
      if (req.user.role === 'staff' && !staffId) {
        return res.json({ date: localDateStrFromTs(Date.now()), sessions: [], pendingCount: 0 });
      }

      const dateStr = req.query.date || localDateStrFromTs(Date.now());
      const sessions = await listPendingAttendanceSessions(db, {
        staffId: staffId ?? undefined,
        dateStr,
      });

      if (staffRow) {
        await runShiftEndAttendanceReminder(db, staffRow).catch((err) => {
          console.warn('shift reminder:', err.message);
        });
      }

      const actionable = sessions.filter((s) => s.canApprove);
      res.json({
        date: dateStr,
        sessions,
        pendingCount: actionable.length,
      });
    } catch (error) {
      console.error('Attendance pending error:', error);
      res.status(500).json({ error: 'Onay bekleyen seanslar listelenemedi' });
    }
  }
);

/** Admin giriş listesi — tüm üye seansları ve durum etiketi */
router.get(
  '/entry-list',
  [
    query('date').optional().matches(/^\d{4}-\d{2}-\d{2}$/),
    query('startDate').optional().matches(/^\d{4}-\d{2}-\d{2}$/),
    query('endDate').optional().matches(/^\d{4}-\d{2}-\d{2}$/),
  ],
  async (req, res) => {
    try {
      if (denyMember(req, res)) return;
      if (req.user.role !== 'admin' && req.user.role !== 'manager') {
        return res.status(403).json({ error: 'Yalnızca yönetici erişebilir' });
      }
      const dateStr = req.query.date || localDateStrFromTs(Date.now());
      const startDate = req.query.startDate || dateStr;
      const endDate = req.query.endDate || startDate;
      const staffId = req.query.staffId != null ? parseInt(req.query.staffId, 10) : undefined;
      const sessions = await listAttendanceEntryList(db, { startDateStr: startDate, endDateStr: endDate, staffId });
      res.json({ date: dateStr, startDate, endDate, sessions });
    } catch (error) {
      console.error('Entry list error:', error);
      res.status(500).json({ error: 'Giriş listesi alınamadı' });
    }
  }
);

/** Admin — randevusuz QR kapı girişleri */
router.get(
  '/walk-in-list',
  [
    query('date').optional().matches(/^\d{4}-\d{2}-\d{2}$/),
    query('startDate').optional().matches(/^\d{4}-\d{2}-\d{2}$/),
    query('endDate').optional().matches(/^\d{4}-\d{2}-\d{2}$/),
  ],
  async (req, res) => {
    try {
      if (denyMember(req, res)) return;
      if (req.user.role !== 'admin' && req.user.role !== 'manager') {
        return res.status(403).json({ error: 'Yalnızca yönetici erişebilir' });
      }
      const dateStr = req.query.date || localDateStrFromTs(Date.now());
      const startDate = req.query.startDate || dateStr;
      const endDate = req.query.endDate || startDate;
      const entries = await listWalkInAccessForDate(db, { startDateStr: startDate, endDateStr: endDate });
      res.json({ date: dateStr, startDate, endDate, entries });
    } catch (error) {
      console.error('Walk-in list error:', error);
      res.status(500).json({ error: 'Randevusuz giriş listesi alınamadı' });
    }
  }
);

/** Personel bildirimleri */
router.get('/notifications/list', async (req, res) => {
  try {
    if (denyMember(req, res)) return;
    const unreadOnly = req.query.unread === '1' || req.query.unread === 'true';
    const items = await listStaffNotifications(db, req.user.userId, { unreadOnly });
    res.json({ notifications: items });
  } catch (error) {
    if (error.code === '42P01') {
      return res.json({ notifications: [] });
    }
    console.error('Staff notifications error:', error);
    res.status(500).json({ error: 'Bildirimler alınamadı' });
  }
});

router.post('/notifications/:id/read', async (req, res) => {
  try {
    if (denyMember(req, res)) return;
    const id = parseInt(req.params.id, 10);
    const ok = await markStaffNotificationRead(db, req.user.userId, id);
    if (!ok) return res.status(404).json({ error: 'Bildirim bulunamadı' });
    res.json({ message: 'Okundu' });
  } catch (error) {
    console.error('Mark notification read error:', error);
    res.status(500).json({ error: 'Bildirim güncellenemedi' });
  }
});

/** Mesai bitimi kontrolü (istemci periyodik çağırır) */
router.post('/shift-reminder', async (req, res) => {
  try {
    if (denyMember(req, res)) return;
    const staff = await getStaffRowForUser(db, req.user.userId);
    if (!staff) {
      return res.json({ notified: false, reason: 'not_staff' });
    }
    const result = await runShiftEndAttendanceReminder(db, staff);
    res.json(result);
  } catch (error) {
    console.error('Shift reminder error:', error);
    res.status(500).json({ error: 'Mesai kontrolü yapılamadı' });
  }
});

/** Geldi / gelmedi onayı — yalnızca QR okutmayan seanslar */
router.post(
  '/:id',
  [body('action').isIn(['present', 'no_show'])],
  async (req, res) => {
    try {
      if (denyMember(req, res)) return;
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      if (req.user.role !== 'staff' && req.user.role !== 'admin' && req.user.role !== 'manager') {
        return res.status(403).json({ error: 'Bu işlem için yetkiniz yok' });
      }

      const sessionId = parseInt(req.params.id, 10);
      const { action } = req.body;
      const isAdmin = req.user.role === 'admin' || req.user.role === 'manager';

      const existing = await db.query('SELECT * FROM sessions WHERE id = $1', [sessionId]);
      if (existing.rows.length === 0) {
        return res.status(404).json({ error: 'Seans bulunamadı' });
      }
      const session = existing.rows[0];

      if (!isAdmin) {
        const staff = await getStaffRowForUser(db, req.user.userId);
        if (!staff || session.staff_id !== staff.id) {
          return res.status(403).json({ error: 'Yalnızca kendi seanslarınız için onay verebilirsiniz' });
        }
      }

      const result = await confirmSessionAttendance(db, sessionId, req.user.userId, action, {
        role: req.user.role,
        allowOverride: isAdmin,
      });
      if (!result.ok) {
        return res.status(result.status).json({ error: result.error });
      }

      const wasAlreadyConfirmed = session.attendance_confirmed_at != null;
      let memberName = null;
      try {
        const memberRow = await db.query('SELECT name FROM members WHERE id = $1', [session.member_id]);
        memberName = memberRow.rows[0]?.name || null;
      } catch (_) {}

      const actionLabel = action === 'present' ? 'geldi' : 'gelmedi';
      await activityLog(req, {
        action: 'session.attendance_confirm',
        entityType: 'session',
        entityId: sessionId,
        details: {
          action,
          outcome: actionLabel,
          role: req.user.role,
          confirmedByAdmin: isAdmin,
          override: wasAlreadyConfirmed && isAdmin,
          memberId: session.member_id,
          memberName: memberName || undefined,
          staffId: session.staff_id,
          startTs: session.start_ts,
          checkInMethod: result.session?.check_in_method || null,
        },
      }).catch(() => {});

      res.json({
        message: action === 'present'
          ? (isAdmin ? 'Yönetici onayı ile giriş kaydedildi' : 'Giriş personel onayı ile kaydedildi')
          : 'Gelmedi — seans yapılmış sayıldı',
        sessionId,
        action: actionLabel,
        attendanceLabel: result.attendanceLabel || null,
      });
    } catch (error) {
      console.error('Attendance confirm error:', error);
      res.status(500).json({ error: 'Onay kaydedilemedi' });
    }
  }
);

export default router;
