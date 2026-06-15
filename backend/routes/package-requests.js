import express from 'express';
import { body, query, validationResult } from 'express-validator';
import db from '../config/database.js';
import { verifyToken } from './auth.js';
import { log as activityLog } from '../utils/activityLogger.js';

const router = express.Router();
router.use(verifyToken);

function requireAdmin(req, res, next) {
  if (req.user.role !== 'admin' && req.user.role !== 'manager') {
    return res.status(403).json({ error: 'Bu işlem için yetkiniz yok' });
  }
  next();
}

function requestToDto(row) {
  return {
    id: row.id,
    memberId: row.member_id,
    packageId: row.package_id,
    status: row.status,
    requestedAt: row.requested_at ? new Date(row.requested_at).toISOString() : null,
    adminSeenAt: row.admin_seen_at ? new Date(row.admin_seen_at).toISOString() : null,
    handledAt: row.handled_at ? new Date(row.handled_at).toISOString() : null,
    handledBy: row.handled_by ?? null,
    memberPackageId: row.member_package_id ?? null,
    memberName: row.member_name || '',
    memberNo: row.member_no || '',
    packageName: row.package_name || '',
    lessonCount: row.lesson_count ?? null,
    packageType: row.package_type || null,
  };
}

const LIST_SQL = `
  SELECT pr.*,
         COALESCE(TRIM(m.first_name || ' ' || m.last_name), m.name, '') AS member_name,
         m.member_no,
         p.name AS package_name,
         p.lesson_count,
         p.package_type
  FROM package_requests pr
  JOIN members m ON m.id = pr.member_id AND (m.deleted_at IS NULL)
  JOIN packages p ON p.id = pr.package_id
`;

async function listRequests(whereClause, params) {
  const result = await db.query(
    `${LIST_SQL} WHERE ${whereClause} ORDER BY pr.requested_at DESC`,
    params
  );
  return result.rows.map(requestToDto);
}

// Admin: bekleyen / tüm talepler
router.get('/', requireAdmin, [
  query('status').optional().isIn(['pending', 'fulfilled', 'dismissed', 'all']),
], async (req, res) => {
  try {
    const status = req.query.status || 'pending';
    const rows = status === 'all'
      ? await listRequests('1=1', [])
      : await listRequests('pr.status = $1', [status]);
    res.json(rows);
  } catch (error) {
    if (error.code === '42P01') {
      return res.status(503).json({
        error: 'Paket talepleri henüz etkin değil. migration_package_requests.sql çalıştırın.',
      });
    }
    console.error('Package requests list error:', error);
    res.status(500).json({ error: 'Paket talepleri listelenirken hata oluştu' });
  }
});

// Admin: okunmamış talep sayısı (banner rozeti)
router.get('/unseen-count', requireAdmin, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT COUNT(*)::int AS cnt FROM package_requests WHERE status = 'pending' AND admin_seen_at IS NULL`
    );
    res.json({ count: result.rows[0]?.cnt ?? 0 });
  } catch (error) {
    if (error.code === '42P01') return res.json({ count: 0 });
    console.error('Package requests unseen count error:', error);
    res.status(500).json({ error: 'Sayım alınamadı' });
  }
});

// Admin: talepleri görüldü işaretle
router.post('/mark-seen', requireAdmin, [
  body('ids').optional().isArray(),
  body('ids.*').optional().isInt(),
], async (req, res) => {
  try {
    const { ids } = req.body || {};
    if (Array.isArray(ids) && ids.length > 0) {
      await db.query(
        `UPDATE package_requests SET admin_seen_at = CURRENT_TIMESTAMP
         WHERE id = ANY($1::int[]) AND status = 'pending' AND admin_seen_at IS NULL`,
        [ids]
      );
    } else {
      await db.query(
        `UPDATE package_requests SET admin_seen_at = CURRENT_TIMESTAMP
         WHERE status = 'pending' AND admin_seen_at IS NULL`
      );
    }
    res.json({ ok: true });
  } catch (error) {
    if (error.code === '42P01') return res.json({ ok: true });
    console.error('Package requests mark seen error:', error);
    res.status(500).json({ error: 'İşaretleme başarısız' });
  }
});

// Admin: talebi reddet / kapat (paket tanımlamadan)
router.post('/:id/dismiss', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await db.query('SELECT * FROM package_requests WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Talep bulunamadı' });
    }
    if (existing.rows[0].status !== 'pending') {
      return res.status(400).json({ error: 'Bu talep zaten işlenmiş' });
    }
    await db.query(
      `UPDATE package_requests
       SET status = 'dismissed', handled_at = CURRENT_TIMESTAMP, handled_by = $2, admin_seen_at = COALESCE(admin_seen_at, CURRENT_TIMESTAMP)
       WHERE id = $1`,
      [id, req.user.userId]
    );
    const rows = await listRequests('pr.id = $1', [id]);
    await activityLog(req, {
      action: 'package_request.dismiss',
      entityType: 'package_request',
      entityId: Number(id),
      details: {
        member_id: existing.rows[0].member_id,
        package_id: existing.rows[0].package_id,
      },
    }).catch(() => {});
    res.json(rows[0] || null);
  } catch (error) {
    console.error('Package request dismiss error:', error);
    res.status(500).json({ error: 'Talep kapatılırken hata oluştu' });
  }
});

// Admin: paket tanımlandıktan sonra talebi tamamla
router.post('/:id/fulfill', requireAdmin, [
  body('member_package_id').isInt(),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    const { id } = req.params;
    const { member_package_id: memberPackageId } = req.body;
    const existing = await db.query('SELECT * FROM package_requests WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Talep bulunamadı' });
    }
    if (existing.rows[0].status !== 'pending') {
      return res.status(400).json({ error: 'Bu talep zaten işlenmiş' });
    }
    await db.query(
      `UPDATE package_requests
       SET status = 'fulfilled', handled_at = CURRENT_TIMESTAMP, handled_by = $2,
           member_package_id = $3, admin_seen_at = COALESCE(admin_seen_at, CURRENT_TIMESTAMP)
       WHERE id = $1`,
      [id, req.user.userId, memberPackageId]
    );
    const rows = await listRequests('pr.id = $1', [id]);
    res.json(rows[0] || null);
  } catch (error) {
    console.error('Package request fulfill error:', error);
    res.status(500).json({ error: 'Talep tamamlanırken hata oluştu' });
  }
});

export default router;

export async function fulfillPendingPackageRequestsForMember(db, memberId, memberPackageId, handledByUserId) {
  await db.query(
    `UPDATE package_requests
     SET status = 'fulfilled', handled_at = CURRENT_TIMESTAMP, handled_by = $3,
         member_package_id = $2, admin_seen_at = COALESCE(admin_seen_at, CURRENT_TIMESTAMP)
     WHERE member_id = $1 AND status = 'pending'`,
    [memberId, memberPackageId, handledByUserId]
  ).catch(() => {});
}
