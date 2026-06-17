/**
 * FizyoPark eski SQL Server → yeni PostgreSQL migration
 *
 * ÖNEMLİ: KG_UyeTerapistDagilim ve KG_UyePaket tablolarındaki
 * KullaniciId / TerapistId alanları KG_KullaniciDiger.Id'ye referans verir,
 * ORT_Kullanici.Id'ye değil. Bu script bunu doğru şekilde ele alır.
 */

const sql = require('mssql');
const { Client } = require('pg');
const bcrypt = require('bcryptjs');

const MSSQL_CONFIG = {
  server: 'localhost',
  port: 1433,
  database: 'FizyoParkDatabase',
  user: 'SA',
  password: 'Fizyopark2026!',
  options: { encrypt: false, trustServerCertificate: true },
  connectionTimeout: 30000,
  requestTimeout: 120000,
};

const PG_CONFIG = {
  host: 'localhost',
  port: 5432,
  database: 'fizyopark_mm_gh',
  user: 'postgres',
  password: '',
};

const DEFAULT_PASSWORD = 'Fizyopark2026!';
const SESSION_DURATION_MS = 60 * 60 * 1000; // 1 saat

function clean(val) {
  if (val === null || val === undefined) return null;
  const s = String(val).trim();
  return s === '' || s === 'NULL' ? null : s;
}

function toDate(val) {
  if (!val) return null;
  try {
    const d = new Date(val);
    return isNaN(d.getTime()) ? null : d.toISOString().split('T')[0];
  } catch { return null; }
}

function toEpochMs(val) {
  if (!val) return null;
  try {
    const d = new Date(val);
    return isNaN(d.getTime()) ? null : d.getTime();
  } catch { return null; }
}

// Eski gün: 1=Pzt,...,7=Paz → yeni: 0=Paz, 1=Pzt,...,6=Cmt
function convertDay(d) {
  const n = parseInt(d);
  if (isNaN(n)) return null;
  return n === 7 ? 0 : n;
}

// Duplicate üye merge tablosu
// EskiId (KG_KullaniciDiger.Id, silindi=1) → YeniId (KG_KullaniciDiger.Id, aktif)
// İki kayıt yeni DB'de tek üye olarak oluşturulur; eski ID'nin paket/seansları yeni üyeye bağlanır.
const MERGE_MAP = new Map([
  [37, 1089],   // Gökmen Erdem
]);

async function main() {
  console.log('=== FizyoPark Migration Başlıyor ===\n');

  const msPool = await sql.connect(MSSQL_CONFIG);
  console.log('✓ SQL Server bağlantısı kuruldu');

  const pg = new Client(PG_CONFIG);
  await pg.connect();
  console.log('✓ PostgreSQL bağlantısı kuruldu\n');

  const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 12);

  // Tüm map'ler KG_KullaniciDiger.Id üzerinden kurulur
  const staffMap   = new Map(); // KG_KullaniciDiger.Id → yeni staff.id
  const memberMap  = new Map(); // KG_KullaniciDiger.Id → yeni members.id
  const packageMap = new Map(); // KG_Paketler.Id → yeni packages.id
  const mpMap      = new Map(); // KG_UyePaket.Id → yeni member_packages.id

  try {
    // ─── 1. PAKETLER ──────────────────────────────────────────────────────────
    console.log('── Paketler...');
    const pkgRows = await msPool.request().query(`
      SELECT Id, Adi, PaketTipi, DersAdet, AyAsimSuresi, HaftadaMaksDersAdet
      FROM KG_Paketler ORDER BY Id
    `);
    for (const r of pkgRows.recordset) {
      const res = await pg.query(`
        INSERT INTO packages (name, lesson_count, month_overrun, weekly_lesson_count, package_type)
        VALUES ($1,$2,$3,$4,$5) RETURNING id
      `, [clean(r.Adi), r.DersAdet||1, r.AyAsimSuresi||1, r.HaftadaMaksDersAdet||null,
          r.PaketTipi === 1 ? 'fixed' : 'flexible']);
      packageMap.set(r.Id, res.rows[0].id);
    }
    console.log(`  ✓ ${packageMap.size} paket\n`);

    // ─── 2. STAFF (Tipi=2) — KG_KullaniciDiger.Id map key ───────────────────
    console.log('── Fizyoterapistler (Tipi=2)...');
    const staffRows = await msPool.request().query(`
      SELECT k.KullaniciAdi, k.Ad, k.Soyad, k.EPosta, k.Silindi,
             d.Id as DigerId, d.Telefonu
      FROM ORT_Kullanici k
      JOIN KG_KullaniciDiger d ON d.OrtKullaniciId = k.Id
      WHERE k.Tipi = 2
      ORDER BY k.Id
    `);
    for (const r of staffRows.recordset) {
      const firstName = clean(r.Ad) || 'İsimsiz';
      const lastName  = clean(r.Soyad) || '';
      const email     = clean(r.EPosta) || `${r.KullaniciAdi}@fizyopark.local`;
      const uRes = await pg.query(`
        INSERT INTO users (username, email, password_hash, role, is_active, display_name, phone)
        VALUES ($1,$2,$3,'staff',$4,$5,$6)
        ON CONFLICT (username) DO UPDATE SET display_name=EXCLUDED.display_name
        RETURNING id
      `, [r.KullaniciAdi, email, passwordHash, !r.Silindi,
          `${firstName} ${lastName}`.trim(), clean(r.Telefonu)]);
      const sRes = await pg.query(`
        INSERT INTO staff (user_id, first_name, last_name, phone) VALUES ($1,$2,$3,$4) RETURNING id
      `, [uRes.rows[0].id, firstName, lastName, clean(r.Telefonu)]);
      staffMap.set(r.DigerId, sRes.rows[0].id);
    }
    console.log(`  ✓ ${staffMap.size} fizyoterapist\n`);

    // ─── 3. YÖNETİCİLER (Tipi=3) ─────────────────────────────────────────────
    console.log('── Yöneticiler (Tipi=3)...');
    const adminRows = await msPool.request().query(`
      SELECT k.KullaniciAdi, k.Ad, k.Soyad, k.EPosta, k.Silindi,
             d.Id as DigerId, d.Telefonu
      FROM ORT_Kullanici k
      JOIN KG_KullaniciDiger d ON d.OrtKullaniciId = k.Id
      WHERE k.Tipi = 3
      ORDER BY k.Id
    `);
    let adminInserted = 0;
    for (const r of adminRows.recordset) {
      const firstName = clean(r.Ad) || 'İsimsiz';
      const lastName  = clean(r.Soyad) || '';
      const email     = clean(r.EPosta) || `${r.KullaniciAdi}@fizyopark.local`;
      await pg.query(`
        INSERT INTO users (username, email, password_hash, role, is_active, display_name, phone)
        VALUES ($1,$2,$3,'manager',$4,$5,$6)
        ON CONFLICT (username) DO UPDATE SET role='manager', display_name=EXCLUDED.display_name
      `, [r.KullaniciAdi, email, passwordHash, !r.Silindi,
          `${firstName} ${lastName}`.trim(), clean(r.Telefonu)]);
      adminInserted++;
    }
    console.log(`  ✓ ${adminInserted} yönetici\n`);

    // ─── 4. ÜYELER (Tipi=1) — KG_KullaniciDiger.Id map key ──────────────────
    console.log('── Üyeler (Tipi=1)...');
    const memberRows = await msPool.request().query(`
      SELECT k.Ad, k.Soyad, k.EPosta, k.Silindi,
             d.Id as DigerId, d.Telefonu, d.Adres, d.Meslegi, d.DogumTarihi,
             d.UyeYakiniTel, d.UyeYakiniAdSoyad,
             d.SistematikHastaliklar, d.KlinikRahatsizliklar, d.GecirdigiOperasyonlar,
             c.KartNo
      FROM ORT_Kullanici k
      JOIN KG_KullaniciDiger d ON d.OrtKullaniciId = k.Id
      LEFT JOIN KG_KullaniciKart c ON c.KullaniciId = k.Id
      WHERE k.Tipi = 1
      ORDER BY k.Id
    `);

    // Aynı telefon → NULL (aile üyeleri)
    const phoneSeen = new Set();
    const memberData = memberRows.recordset.map(r => {
      let phone = clean(r.Telefonu);
      if (phone) {
        if (phoneSeen.has(phone)) phone = null;
        else phoneSeen.add(phone);
      }
      return { ...r, phone };
    });

    // Merge edilecek eski ID'leri atla — canonical (yeni) import edilince map'e eklenir
    const mergeEskiIds = new Set(MERGE_MAP.keys());

    let memberErrors = 0;
    for (const r of memberData) {
      // Bu kayıt bir duplicate'in eski (silindi) kaydıysa atla
      if (mergeEskiIds.has(r.DigerId)) continue;

      const firstName = clean(r.Ad) || 'İsimsiz';
      const lastName  = clean(r.Soyad) || '';
      try {
        const mRes = await pg.query(`
          INSERT INTO members (
            name, first_name, last_name, email, phone,
            birth_date, profession, address,
            contact_name, contact_phone,
            systemic_diseases, clinical_conditions, past_operations,
            card_no, deleted_at
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
          RETURNING id
        `, [
          `${firstName} ${lastName}`.trim(), firstName, lastName,
          clean(r.EPosta), r.phone,
          toDate(r.DogumTarihi), clean(r.Meslegi), clean(r.Adres),
          clean(r.UyeYakiniAdSoyad), clean(r.UyeYakiniTel),
          clean(r.SistematikHastaliklar), clean(r.KlinikRahatsizliklar), clean(r.GecirdigiOperasyonlar),
          clean(r.KartNo), r.Silindi ? new Date().toISOString() : null,
        ]);
        const newId = mRes.rows[0].id;
        await pg.query(`UPDATE members SET member_no=$1 WHERE id=$2`, [`U${newId}`, newId]);
        memberMap.set(r.DigerId, newId);

        // Eğer bu canonical ID bir merge'in yeni tarafıysa, eski ID'yi de aynı üyeye bağla
        for (const [eskiId, yeniId] of MERGE_MAP.entries()) {
          if (yeniId === r.DigerId) {
            memberMap.set(eskiId, newId);
            console.log(`  ↳ Merge: KullaniciId=${eskiId} → üye id=${newId} (${firstName} ${lastName})`);
          }
        }
      } catch (e) {
        console.warn(`  ! Üye atlandı [${r.Ad} ${r.Soyad}]: ${e.message}`);
        memberErrors++;
      }
    }
    console.log(`  ✓ ${memberMap.size} üye entry (${[...new Set(memberMap.values())].length} benzersiz üye), ${memberErrors} hata\n`);

    // ─── 5. EK TERAPISTLER — Seanslarda terapist olarak geçen Tipi≠2 kişiler ─
    console.log('── Ek terapistler (seanslarda Tipi≠2 terapistler)...');
    const extraRows = await msPool.request().query(`
      SELECT DISTINCT k.KullaniciAdi, k.Ad, k.Soyad, k.EPosta, k.Silindi, k.Tipi,
             d.Id as DigerId, d.Telefonu
      FROM KG_UyeTerapistDagilim s
      JOIN KG_KullaniciDiger d ON d.Id = s.TerapistId
      JOIN ORT_Kullanici k ON k.Id = d.OrtKullaniciId
      WHERE s.SilindiMi = 0 AND k.Tipi <> 2
      ORDER BY k.Ad
    `);
    let extraInserted = 0;
    for (const r of extraRows.recordset) {
      if (staffMap.has(r.DigerId)) continue;
      const firstName = clean(r.Ad) || 'İsimsiz';
      const lastName  = clean(r.Soyad) || '';
      const email     = clean(r.EPosta) || `${r.KullaniciAdi}@fizyopark.local`;
      const uRes = await pg.query(`
        INSERT INTO users (username, email, password_hash, role, is_active, display_name, phone)
        VALUES ($1,$2,$3,'staff',$4,$5,$6)
        ON CONFLICT (username) DO UPDATE SET display_name=EXCLUDED.display_name
        RETURNING id
      `, [r.KullaniciAdi, email, passwordHash, !r.Silindi,
          `${firstName} ${lastName}`.trim(), clean(r.Telefonu)]);
      const userId = uRes.rows[0].id;
      const existS = await pg.query(`SELECT id FROM staff WHERE user_id=$1`, [userId]);
      let staffId;
      if (existS.rows.length > 0) {
        staffId = existS.rows[0].id;
      } else {
        const sRes = await pg.query(`
          INSERT INTO staff (user_id, first_name, last_name, phone) VALUES ($1,$2,$3,$4) RETURNING id
        `, [userId, firstName, lastName, clean(r.Telefonu)]);
        staffId = sRes.rows[0].id;
      }
      staffMap.set(r.DigerId, staffId);
      extraInserted++;
    }
    console.log(`  ✓ ${extraInserted} ek terapist\n`);

    // ─── 6. ÜYE PAKETLERİ ────────────────────────────────────────────────────
    console.log('── Üye paketleri...');
    const upRows = await msPool.request().query(`
      SELECT Id, KullaniciId, PaketId, BaslamaTarihi, BitisTarihi,
             SecilenGunler, SecilenTerapistler, SecilenSaatler
      FROM KG_UyePaket ORDER BY Id
    `);
    const now = new Date();
    let mpInserted = 0, mpSkipped = 0;
    for (const r of upRows.recordset) {
      const memberId  = memberMap.get(r.KullaniciId);
      const packageId = packageMap.get(r.PaketId);
      const startDate = toDate(r.BaslamaTarihi);
      const endDate   = toDate(r.BitisTarihi);
      if (!memberId || !packageId || !startDate || !endDate) { mpSkipped++; continue; }

      const status = new Date(r.BitisTarihi) < now ? 'completed' : 'active';
      const mpRes = await pg.query(`
        INSERT INTO member_packages (member_id, package_id, start_date, end_date, status)
        VALUES ($1,$2,$3,$4,$5) RETURNING id
      `, [memberId, packageId, startDate, endDate, status]);
      const newMpId = mpRes.rows[0].id;
      mpMap.set(r.Id, newMpId);
      mpInserted++;

      // Gün dağılımı
      if (r.SecilenGunler && r.SecilenTerapistler && r.SecilenSaatler) {
        const days  = r.SecilenGunler.split(',');
        const thers = r.SecilenTerapistler.split(',');
        const hours = r.SecilenSaatler.split(',');
        for (let i = 0; i < days.length; i++) {
          const dow     = convertDay(days[i]);
          const staffId = staffMap.get(parseInt(thers[i]));
          const time    = hours[i] ? hours[i].trim() : null;
          if (dow === null || !staffId || !time) continue;
          try {
            await pg.query(`
              INSERT INTO member_package_slots (member_package_id, day_of_week, start_time, staff_id)
              VALUES ($1,$2,$3,$4) ON CONFLICT (member_package_id, day_of_week) DO NOTHING
            `, [newMpId, dow, time, staffId]);
          } catch {}
        }
      }
    }
    console.log(`  ✓ ${mpInserted} üye paketi, ${mpSkipped} atlandı\n`);

    // ─── 7. SEANSLAR ─────────────────────────────────────────────────────────
    console.log('── Seanslar...');
    const totalRes = await msPool.request().query(
      `SELECT COUNT(*) as cnt FROM KG_UyeTerapistDagilim WHERE SilindiMi=0`
    );
    const total = totalRes.recordset[0].cnt;
    console.log(`  Toplam ${total} seans işlenecek...`);

    const BATCH = 2000;
    let offset = 0, seansInserted = 0, seansSkipped = 0;

    while (offset < total) {
      const batch = await msPool.request().query(`
        SELECT Id, Tarih, KullaniciId, TerapistId, UyePaketId
        FROM KG_UyeTerapistDagilim
        WHERE SilindiMi=0
        ORDER BY Id
        OFFSET ${offset} ROWS FETCH NEXT ${BATCH} ROWS ONLY
      `);

      const values = [], params = [];
      let pi = 1;
      for (const r of batch.recordset) {
        const memberId = memberMap.get(r.KullaniciId);
        const staffId  = staffMap.get(r.TerapistId);
        const startMs  = toEpochMs(r.Tarih);
        if (!memberId || !staffId || !startMs) { seansSkipped++; continue; }
        values.push(`($${pi++},$${pi++},$${pi++},$${pi++},$${pi++})`);
        params.push(staffId, memberId, startMs, startMs + SESSION_DURATION_MS, mpMap.get(r.UyePaketId) || null);
      }
      if (values.length > 0) {
        try {
          const res = await pg.query(
            `INSERT INTO sessions (staff_id, member_id, start_ts, end_ts, member_package_id) VALUES ${values.join(',')}`,
            params
          );
          seansInserted += res.rowCount;
        } catch (e) {
          console.warn(`  ! Batch hatası (offset=${offset}): ${e.message}`);
          seansSkipped += batch.recordset.length;
        }
      }
      offset += BATCH;
      process.stdout.write(`\r  İşlendi: ${Math.min(offset, total)}/${total}`);
    }
    console.log(`\n  ✓ ${seansInserted} seans, ${seansSkipped} atlandı\n`);

    // ─── ÖZET ─────────────────────────────────────────────────────────────────
    console.log('=== Migration Tamamlandı ===');
    console.log(`  Paketler        : ${packageMap.size}`);
    console.log(`  Terapistler     : ${staffMap.size}`);
    console.log(`  Üyeler          : ${memberMap.size}`);
    console.log(`  Üye Paketleri   : ${mpInserted} (${mpSkipped} atlandı)`);
    console.log(`  Seanslar        : ${seansInserted} (${seansSkipped} atlandı)`);
    console.log(`\n  Default şifre: ${DEFAULT_PASSWORD}\n`);

  } finally {
    await pg.end();
    await sql.close();
  }
}

main().catch(e => {
  console.error('\n[HATA]', e.message);
  process.exit(1);
});
