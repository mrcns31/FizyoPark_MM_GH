/**
 * Seans puanları API — aylık personel performans raporu.
 * Yorumlar ve üye kimliği yalnızca admin/manager'a döner; personel kendi agregatını görür.
 */
import express from 'express';
import { query, validationResult } from 'express-validator';
import db from '../config/database.js';
import { verifyToken } from './auth.js';
import { getRatingsGoLiveTs } from '../utils/appSettings.js';
import { getStaffRowForUser } from '../utils/sessionAttendance.js';
import {
  BAYES_PRIOR_WEIGHT,
  LOW_SHARE_THRESHOLD,
  MIN_RATINGS_FOR_AVERAGE,
  bayesianAverage,
  ratableSessionSql,
} from '../utils/sessionRatings.js';

const router = express.Router();
router.use(verifyToken);

const checkAdminOrManager = (req, res, next) => {
  if (req.user.role !== 'admin' && req.user.role !== 'manager') {
    return res.status(403).json({ error: 'Bu işlem için yetkiniz yok' });
  }
  next();
};

/** Türkiye sabit UTC+3 — raporlardaki ay kırılımı bu ofsetle hesaplanır (reports ekranıyla aynı) */
const TZ_OFFSET_MS = 3 * 60 * 60 * 1000;

function istanbulMonth(ts) {
  return new Date(Number(ts) + TZ_OFFSET_MS).getUTCMonth();
}

function yearBoundsMs(year) {
  return {
    start: Date.UTC(year, 0, 1) - TZ_OFFSET_MS,
    end: Date.UTC(year + 1, 0, 1) - TZ_OFFSET_MS,
  };
}

function emptyBucket() {
  // members: farklı üye sayısı — aynı üye ayda 8-12 seans puanlayabildiği için
  // "kaç değerlendirme" ile "kaç kişi" birbirinden ayrı tutulur
  return { count: 0, sum: 0, lowCount: 0, eligible: 0, members: new Set() };
}

function finalizeBucket(bucket, globalMean) {
  const avg = bucket.count > 0 ? bucket.sum / bucket.count : null;
  return {
    count: bucket.count,
    raters: bucket.members.size,
    eligible: bucket.eligible,
    lowCount: bucket.lowCount,
    // n < 5 iken ortalama gösterilmez — 3 seanslık 5.0, 20 seanslık 4.6'nın üstünde durmasın
    avg: bucket.count >= MIN_RATINGS_FOR_AVERAGE && avg != null ? Number(avg.toFixed(2)) : null,
    rawAvg: avg != null ? Number(avg.toFixed(2)) : null,
    bayesAvg: bucket.count > 0
      ? Number(bayesianAverage(bucket.sum, bucket.count, globalMean).toFixed(2))
      : null,
    responseRate: bucket.eligible > 0
      ? Number((bucket.count / bucket.eligible).toFixed(3))
      : null,
  };
}

/** Puan kayıtları + puanlanabilir seanslar — tablo yoksa boş döner */
async function loadYearData(year) {
  const { start, end } = yearBoundsMs(year);
  const now = Date.now();
  const goLiveTs = await getRatingsGoLiveTs();

  let ratingRows = [];
  try {
    const res = await db.query(
      // Personel ve tarih sessions'tan okunur: seans devredilirse puan da yeni personele geçer.
      // deleted_at filtresi paydayla (ratableSessionSql) aynı kuralı uygular; olmazsa
      // iptal edilen seansın puanı payda kalır ve yanıt oranı %100'ü aşar.
      `SELECT s.staff_id, sr.member_id, s.start_ts AS session_start_ts, sr.rating
       FROM session_ratings sr
       JOIN sessions s ON s.id = sr.session_id
       WHERE s.start_ts >= $1 AND s.start_ts < $2
         AND s.deleted_at IS NULL`,
      [start, end]
    );
    ratingRows = res.rows;
  } catch (err) {
    if (err.code !== '42P01') throw err;
    return { ratingRows: [], eligibleRows: [], goLiveTs };
  }

  // Yanıt oranının paydası: aynı dönemde puanlanabilir durumdaki seanslar
  const eligibleRes = Number.isFinite(goLiveTs)
    ? await db.query(
        `SELECT s.staff_id, s.end_ts
         FROM sessions s
         WHERE s.start_ts >= $1 AND s.start_ts < $2
           AND ${ratableSessionSql(3, 4)}`,
        [start, end, now, goLiveTs]
      )
    : { rows: [] };

  return { ratingRows, eligibleRows: eligibleRes.rows, goLiveTs };
}

async function loadStaffNameMap() {
  // Silinmiş personel de dahil — geçmiş ayların ortalamaları kaybolmasın
  const res = await db.query('SELECT id, first_name, last_name, deleted_at FROM staff');
  const map = new Map();
  for (const r of res.rows) {
    map.set(r.id, {
      name: `${r.first_name || ''} ${r.last_name || ''}`.trim(),
      isFormer: r.deleted_at != null,
    });
  }
  return map;
}

/**
 * Yıllık ay × personel puan matrisi.
 * Hücre üretimi istemciye bırakılmaz; eşik ve ağırlıklı ortalama tek yerde hesaplanır.
 */
router.get('/staff-summary', checkAdminOrManager, [
  query('year').optional().isInt({ min: 2000, max: 2100 }).toInt(),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const year = Number(req.query.year) || new Date().getFullYear();
    const { ratingRows, eligibleRows } = await loadYearData(year);
    const staffNames = await loadStaffNameMap();

    let globalSum = 0;
    let globalCount = 0;
    for (const r of ratingRows) {
      globalSum += Number(r.rating);
      globalCount++;
    }
    const globalMean = globalCount > 0 ? globalSum / globalCount : 0;

    // staffId → { months: bucket[12], total: bucket }
    const byStaff = new Map();
    function bucketFor(staffId, month) {
      const key = staffId == null ? 'none' : String(staffId);
      if (!byStaff.has(key)) {
        byStaff.set(key, {
          staffId: staffId ?? null,
          months: Array.from({ length: 12 }, emptyBucket),
          total: emptyBucket(),
        });
      }
      const entry = byStaff.get(key);
      return { month: entry.months[month], total: entry.total };
    }

    const monthTotals = Array.from({ length: 12 }, emptyBucket);
    const grand = emptyBucket();

    for (const r of ratingRows) {
      const month = istanbulMonth(r.session_start_ts);
      const rating = Number(r.rating);
      const { month: mb, total: tb } = bucketFor(r.staff_id, month);
      for (const b of [mb, tb, monthTotals[month], grand]) {
        b.count++;
        b.sum += rating;
        b.members.add(r.member_id);
        if (rating <= LOW_SHARE_THRESHOLD) b.lowCount++;
      }
    }

    for (const r of eligibleRows) {
      const month = istanbulMonth(r.end_ts);
      const { month: mb, total: tb } = bucketFor(r.staff_id, month);
      mb.eligible++;
      tb.eligible++;
      monthTotals[month].eligible++;
      grand.eligible++;
    }

    const staff = [...byStaff.values()].map((entry) => {
      const info = entry.staffId != null ? staffNames.get(entry.staffId) : null;
      return {
        staffId: entry.staffId,
        staffName: info?.name || (entry.staffId != null ? `Personel #${entry.staffId}` : 'Atanmamış'),
        isFormer: info?.isFormer ?? true,
        months: entry.months.map((b) => finalizeBucket(b, globalMean)),
        total: finalizeBucket(entry.total, globalMean),
      };
    });
    staff.sort((a, b) => a.staffName.localeCompare(b.staffName, 'tr'));

    res.json({
      year,
      globalMean: globalCount > 0 ? Number(globalMean.toFixed(2)) : null,
      globalCount,
      minSample: MIN_RATINGS_FOR_AVERAGE,
      bayesWeight: BAYES_PRIOR_WEIGHT,
      staff,
      monthTotals: monthTotals.map((b) => finalizeBucket(b, globalMean)),
      grand: finalizeBucket(grand, globalMean),
    });
  } catch (error) {
    console.error('Rating staff-summary error:', error);
    res.status(500).json({ error: 'Puan raporu alınırken hata oluştu' });
  }
});

/** Bir personelin belirli ayındaki puan dağılımı ve yorumları (yalnızca admin/manager) */
router.get('/list', checkAdminOrManager, [
  query('staffId').isInt().toInt(),
  query('year').isInt({ min: 2000, max: 2100 }).toInt(),
  query('month').optional().isInt({ min: 1, max: 12 }).toInt(),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const staffId = Number(req.query.staffId);
    const year = Number(req.query.year);
    const month = req.query.month != null ? Number(req.query.month) : null;

    const start = month
      ? Date.UTC(year, month - 1, 1) - TZ_OFFSET_MS
      : Date.UTC(year, 0, 1) - TZ_OFFSET_MS;
    const end = month
      ? Date.UTC(year, month, 1) - TZ_OFFSET_MS
      : Date.UTC(year + 1, 0, 1) - TZ_OFFSET_MS;

    let rows = [];
    try {
      const result = await db.query(
        `SELECT sr.session_id, sr.rating, sr.comment, s.start_ts AS session_start_ts, sr.created_at,
                m.name AS member_name
         FROM session_ratings sr
         JOIN sessions s ON s.id = sr.session_id
         LEFT JOIN members m ON m.id = sr.member_id
         WHERE s.staff_id = $1
           AND s.start_ts >= $2 AND s.start_ts < $3
           AND s.deleted_at IS NULL
         ORDER BY s.start_ts DESC`,
        [staffId, start, end]
      );
      rows = result.rows;
    } catch (err) {
      if (err.code !== '42P01') throw err;
    }

    const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    for (const r of rows) distribution[Number(r.rating)]++;

    res.json({
      staffId,
      year,
      month,
      distribution,
      items: rows.map((r) => ({
        sessionId: r.session_id,
        rating: Number(r.rating),
        comment: r.comment || '',
        memberName: r.member_name || '',
        sessionStartTs: Number(r.session_start_ts),
        createdAt: r.created_at,
      })),
    });
  } catch (error) {
    console.error('Rating list error:', error);
    res.status(500).json({ error: 'Puan listesi alınırken hata oluştu' });
  }
});

/**
 * Personelin kendi özeti — son 12 ay, yalnızca agregat.
 * Yorum ve üye bilgisi bu yanıta hiç girmez: istemcide gizlemek gizlilik sağlamaz.
 */
router.get('/my-summary', async (req, res) => {
  try {
    const staffRow = await getStaffRowForUser(db, req.user.userId);
    if (!staffRow) {
      return res.status(404).json({ error: 'Personel kaydı bulunamadı' });
    }

    const now = new Date();
    const year = now.getFullYear();
    const { ratingRows, eligibleRows } = await loadYearData(year);

    let globalSum = 0;
    let globalCount = 0;
    for (const r of ratingRows) {
      globalSum += Number(r.rating);
      globalCount++;
    }
    const globalMean = globalCount > 0 ? globalSum / globalCount : 0;

    const months = Array.from({ length: 12 }, emptyBucket);
    const total = emptyBucket();

    for (const r of ratingRows) {
      if (r.staff_id !== staffRow.id) continue;
      const rating = Number(r.rating);
      const b = months[istanbulMonth(r.session_start_ts)];
      b.count++; b.sum += rating; b.members.add(r.member_id);
      if (rating <= LOW_SHARE_THRESHOLD) b.lowCount++;
      total.count++; total.sum += rating; total.members.add(r.member_id);
      if (rating <= LOW_SHARE_THRESHOLD) total.lowCount++;
    }
    for (const r of eligibleRows) {
      if (r.staff_id !== staffRow.id) continue;
      months[istanbulMonth(r.end_ts)].eligible++;
      total.eligible++;
    }

    res.json({
      year,
      staffId: staffRow.id,
      minSample: MIN_RATINGS_FOR_AVERAGE,
      months: months.map((b) => finalizeBucket(b, globalMean)),
      total: finalizeBucket(total, globalMean),
    });
  } catch (error) {
    console.error('Rating my-summary error:', error);
    res.status(500).json({ error: 'Puan özeti alınırken hata oluştu' });
  }
});

export default router;
