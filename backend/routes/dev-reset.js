/**
 * Test ortamı: seçili veri gruplarını sıfırlama (yalnızca admin).
 * Production'da varsayılan kapalı; ALLOW_DEV_RESET=1 ile açılabilir.
 */
import express from 'express';
import bcrypt from 'bcrypt';
import { body, validationResult } from 'express-validator';
import db from '../config/database.js';
import { verifyToken } from './auth.js';
import { log as activityLog } from '../utils/activityLogger.js';
import { getSeedTestMembersMeta, seedTestMembers } from '../utils/devSeedMembers.js';

const router = express.Router();
router.use(verifyToken);

const DELETE_ORDER = [
  'sessions',
  'member_packages',
  'members',
  'staff',
  'packages',
  'rooms',
  'activity_logs',
  'working_hours',
];

export const RESET_GROUPS = [
  {
    id: 'sessions',
    label: 'Seanslar',
    description: 'Tüm seans kayıtları (silinmiş dahil) kalıcı olarak silinir.',
    warnings: [],
    autoAdds: [],
  },
  {
    id: 'member_packages',
    label: 'Üye paket atamaları',
    description: 'Üyelere atanmış paketler ve haftalık gün/saat slotları silinir.',
    warnings: [
      'Seans kayıtları kalır; seanslardaki paket bağlantısı kaldırılır.',
    ],
    autoAdds: [],
  },
  {
    id: 'members',
    label: 'Üyeler',
    description: 'Tüm üye kartları ve üye giriş hesapları kalıcı olarak silinir (soft-silinenler dahil).',
    warnings: [
      'Üye paket atamaları da silinir (bağlı kayıtlar).',
      'Seanslar kalır; üye bilgisi seanslardan kaldırılır.',
      'users tablosundaki role=member hesapları da silinir (admin/personel korunur).',
    ],
    autoAdds: ['member_packages'],
  },
  {
    id: 'staff',
    label: 'Personel',
    description: 'Personel kayıtları ve personel/manager giriş hesapları silinir. Admin hesabı korunur.',
    warnings: [
      'DİKKAT: Personel silinince o personele ait tüm seanslar da silinir!',
      'Paket slotlarında personel referansı varsa slotlar da etkilenir.',
    ],
    autoAdds: [],
  },
  {
    id: 'packages',
    label: 'Paket tanımları',
    description: 'Sistemdeki paket şablonları (8 seanslık vb.) silinir.',
    warnings: [
      'Üye paket atamaları olmadan silinemez; seçilirse otomatik onlar da eklenir.',
    ],
    autoAdds: ['member_packages'],
  },
  {
    id: 'rooms',
    label: 'Odalar / alet',
    description: 'Oda tanımları silinir.',
    warnings: ['Seanslar kalır; seanslardaki oda bilgisi boşalır.'],
    autoAdds: [],
  },
  {
    id: 'activity_logs',
    label: 'İşlem logları',
    description: 'Kim-ne-zaman audit kayıtları silinir.',
    warnings: [],
    autoAdds: [],
  },
  {
    id: 'working_hours',
    label: 'Çalışma saatleri',
    description: 'Salon çalışma saatleri sıfırlanır; ardından varsayılan saatler yeniden eklenir.',
    warnings: ['Seans veya üye verisini etkilemez.'],
    autoAdds: [],
  },
];

function devResetAllowed() {
  return process.env.NODE_ENV !== 'production' || process.env.ALLOW_DEV_RESET === '1';
}

const checkAdmin = (req, res, next) => {
  if (!devResetAllowed()) {
    return res.status(403).json({ error: 'Veritabanı sıfırlama yalnızca test ortamında kullanılabilir.' });
  }
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Bu işlem yalnızca admin tarafından yapılabilir.' });
  }
  next();
};

router.use(checkAdmin);

function expandTargets(rawTargets) {
  const set = new Set(rawTargets);
  let changed = true;
  while (changed) {
    changed = false;
    for (const g of RESET_GROUPS) {
      if (set.has(g.id)) {
        for (const add of g.autoAdds || []) {
          if (!set.has(add)) {
            set.add(add);
            changed = true;
          }
        }
      }
    }
  }
  return DELETE_ORDER.filter((id) => set.has(id));
}

function collectWarnings(targets) {
  const expanded = new Set(expandTargets(targets));
  const warnings = [];
  const autoAdded = expandTargets(targets).filter((id) => !targets.includes(id));

  for (const g of RESET_GROUPS) {
    if (expanded.has(g.id) && g.warnings?.length) {
      warnings.push({ group: g.id, label: g.label, messages: g.warnings });
    }
  }
  if (expanded.has('staff') && expanded.has('sessions') === false && targets.includes('staff')) {
    warnings.push({
      group: 'staff',
      label: 'Personel',
      messages: ['Personel silinirken bağlı seanslar otomatik silinir (sessions seçili değil olsa bile).'],
    });
  }
  return { warnings, autoAdded, expanded: [...expanded] };
}

async function verifyAdminPassword(adminPassword) {
  const adminResult = await db.query(
    "SELECT password_hash FROM users WHERE role = 'admin' AND is_active = true LIMIT 1"
  );
  if (adminResult.rows.length === 0) {
    return { ok: false, error: 'Admin hesabı bulunamadı.' };
  }
  const valid = await bcrypt.compare(adminPassword, adminResult.rows[0].password_hash);
  if (!valid) return { ok: false, error: 'Admin şifresi hatalı.' };
  return { ok: true };
}

async function getCounts(client) {
  const tables = [
    ['sessions', 'sessions'],
    ['member_packages', 'member_packages'],
    ['members', 'members'],
    ['staff', 'staff'],
    ['packages', 'packages'],
    ['rooms', 'rooms'],
    ['activity_logs', 'activity_logs'],
    ['working_hours', 'working_hours'],
  ];
  const counts = {};
  for (const [key, table] of tables) {
    try {
      const r = await client.query(`SELECT COUNT(*)::int AS cnt FROM ${table}`);
      counts[key] = r.rows[0]?.cnt ?? 0;
    } catch (err) {
      console.error(`Dev reset count error (${table}):`, err.message);
      counts[key] = null;
    }
  }
  return counts;
}

async function resetWorkingHoursDefaults(client) {
  const days = [
    [0, false, '08:00', '20:00'],
    [1, true, '08:00', '20:00'],
    [2, true, '08:00', '20:00'],
    [3, true, '08:00', '20:00'],
    [4, true, '08:00', '20:00'],
    [5, true, '08:00', '20:00'],
    [6, true, '08:00', '20:00'],
  ];
  for (const [dow, enabled, start, end] of days) {
    await client.query(
      `INSERT INTO working_hours (day_of_week, enabled, start_time, end_time)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (day_of_week) DO UPDATE SET enabled = EXCLUDED.enabled, start_time = EXCLUDED.start_time, end_time = EXCLUDED.end_time`,
      [dow, enabled, start, end]
    );
  }
}

async function runReset(client, orderedTargets) {
  const done = [];
  for (const id of orderedTargets) {
    switch (id) {
      case 'sessions':
        await client.query('DELETE FROM sessions');
        done.push(id);
        break;
      case 'member_packages':
        await client.query('UPDATE sessions SET member_package_id = NULL WHERE member_package_id IS NOT NULL');
        await client.query('DELETE FROM member_package_slots');
        await client.query('DELETE FROM member_packages');
        done.push(id);
        break;
      case 'members':
        await client.query('DELETE FROM members');
        await client.query("DELETE FROM users WHERE role = 'member'");
        done.push(id);
        break;
      case 'staff':
        await client.query('DELETE FROM staff');
        await client.query("DELETE FROM users WHERE role IN ('staff', 'manager')");
        done.push(id);
        break;
      case 'packages':
        await client.query('DELETE FROM packages');
        done.push(id);
        break;
      case 'rooms':
        await client.query('DELETE FROM rooms');
        done.push(id);
        break;
      case 'activity_logs':
        await client.query('DELETE FROM activity_logs');
        done.push(id);
        break;
      case 'working_hours':
        await client.query('DELETE FROM working_hours');
        await resetWorkingHoursDefaults(client);
        done.push(id);
        break;
      default:
        break;
    }
  }
  return done;
}

router.get('/meta', async (req, res) => {
  try {
    const client = await db.pool.connect();
    let counts = {};
    try {
      counts = await getCounts(client);
    } finally {
      client.release();
    }
    res.json({ groups: RESET_GROUPS, counts, deleteOrder: DELETE_ORDER });
  } catch (error) {
    console.error('Dev reset meta error:', error);
    res.status(500).json({ error: 'Sıfırlama bilgisi alınamadı' });
  }
});

router.post('/preview', [body('targets').isArray({ min: 1 })], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    const { targets } = req.body;
    const validIds = new Set(RESET_GROUPS.map((g) => g.id));
    const invalid = targets.filter((t) => !validIds.has(t));
    if (invalid.length) {
      return res.status(400).json({ error: 'Geçersiz hedef: ' + invalid.join(', ') });
    }
    const preview = collectWarnings(targets);
    res.json(preview);
  } catch (error) {
    console.error('Dev reset preview error:', error);
    res.status(500).json({ error: 'Önizleme oluşturulamadı' });
  }
});

router.post('/', [
  body('targets').isArray({ min: 1 }),
  body('adminPassword').notEmpty().withMessage('Admin şifresi gerekli'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { targets, adminPassword } = req.body;
    const validIds = new Set(RESET_GROUPS.map((g) => g.id));
    const invalid = targets.filter((t) => !validIds.has(t));
    if (invalid.length) {
      return res.status(400).json({ error: 'Geçersiz hedef: ' + invalid.join(', ') });
    }

    const pw = await verifyAdminPassword(adminPassword);
    if (!pw.ok) {
      return res.status(401).json({ error: pw.error });
    }

    const ordered = expandTargets(targets);
    const preview = collectWarnings(targets);

    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');
      const resetDone = await runReset(client, ordered);
      await client.query('COMMIT');

      await activityLog(req, {
        action: 'dev_reset',
        entityType: 'database',
        details: { targets, expanded: ordered, resetDone },
      }).catch(() => {});

      res.json({
        message: 'Seçilen veriler sıfırlandı.',
        resetDone,
        autoAdded: preview.autoAdded,
      });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Dev reset error:', error);
    if (error.code === '23503') {
      return res.status(400).json({
        error: 'Bağlı kayıtlar nedeniyle silinemedi. Daha geniş kapsamlı seçim yapın (ör. paketler için üye paketlerini de seçin).',
      });
    }
    res.status(500).json({ error: 'Veritabanı sıfırlanırken hata oluştu: ' + (error.message || '') });
  }
});

router.get('/seed-test-members/meta', async (req, res) => {
  try {
    const meta = await getSeedTestMembersMeta(db);
    res.json(meta);
  } catch (error) {
    console.error('Dev seed meta error:', error);
    res.status(500).json({ error: 'Test üye bilgisi alınamadı' });
  }
});

router.post('/seed-test-members', [
  body('count').optional().isInt({ min: 1, max: 200 }),
  body('adminPassword').notEmpty().withMessage('Admin şifresi gerekli'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { adminPassword } = req.body;
    const count = req.body.count != null ? Number(req.body.count) : 110;

    const pw = await verifyAdminPassword(adminPassword);
    if (!pw.ok) {
      return res.status(401).json({ error: pw.error });
    }

    const result = await seedTestMembers(db, { count });

    await activityLog(req, {
      action: 'dev_seed_test_members',
      entityType: 'database',
      details: {
        requested: result.requested,
        created: result.created,
        skipped: result.skipped,
        sessionsCreated: result.sessionsCreated,
      },
    }).catch(() => {});

    res.json({
      message: `${result.created} test üyesi oluşturuldu (${result.skipped} zaten vardı). ${result.sessionsCreated} seans eklendi.`,
      ...result,
    });
  } catch (error) {
    console.error('Dev seed test members error:', error);
    if (error.code === 'PREREQUISITES') {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: 'Test üyeleri oluşturulurken hata: ' + (error.message || '') });
  }
});

export default router;
