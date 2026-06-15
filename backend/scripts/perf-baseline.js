/**
 * PERF-01 — API ve statik asset baseline ölçümü
 * Çalıştır: node backend/scripts/perf-baseline.js
 * Ön koşul: backend :3000, isteğe bağlı frontend :5173
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const API = process.env.API_BASE || 'http://localhost:3000/api';
const FRONTEND = process.env.FRONTEND_BASE || 'http://localhost:5173';
const ADMIN_EMAIL = process.env.PERF_ADMIN_EMAIL || 'admin@local';
const ADMIN_PASSWORD = process.env.PERF_ADMIN_PASSWORD || 'admin123';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');

async function timedFetch(url, options = {}) {
  const t0 = performance.now();
  const res = await fetch(url, options);
  const text = await res.text();
  const ms = Math.round(performance.now() - t0);
  let bytes = new TextEncoder().encode(text).length;
  return { ok: res.ok, status: res.status, ms, bytes, text };
}

async function login(email, password) {
  const r = await timedFetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!r.ok) throw new Error(`Login failed (${email}): ${r.status} ${r.text.slice(0, 200)}`);
  const data = JSON.parse(r.text);
  return data.token;
}

async function apiGet(token, pathSuffix) {
  return timedFetch(`${API}${pathSuffix}`, {
    headers: { Authorization: 'Bearer ' + token },
  });
}

async function measureAdminBoot(token) {
  const today = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const startD = new Date(today);
  startD.setDate(startD.getDate() - 14);
  const endD = new Date(today);
  endD.setDate(endD.getDate() + 14);
  const sessionStart = `${startD.getFullYear()}-${pad(startD.getMonth() + 1)}-${pad(startD.getDate())}`;
  const sessionEnd = `${endD.getFullYear()}-${pad(endD.getMonth() + 1)}-${pad(endD.getDate())}`;
  const bootstrapPath = `/bootstrap?startDate=${sessionStart}&endDate=${sessionEnd}`;

  const endpoints = [
    ['/auth/me', 'GET /auth/me'],
    [bootstrapPath, 'GET /bootstrap (admin tek istek)'],
  ];

  const t0 = performance.now();
  const results = await Promise.all(
    endpoints.map(async ([pathSuffix, label]) => {
      const r = await apiGet(token, pathSuffix);
      return { label, ...r };
    })
  );
  const parallelMs = Math.round(performance.now() - t0);

  const t1 = performance.now();
  for (const [pathSuffix, label] of endpoints.slice(1)) {
    await apiGet(token, pathSuffix);
  }
  const sequentialMs = Math.round(performance.now() - t1);

  return { results, parallelMs, sequentialMs, requestCount: endpoints.length };
}

async function measureMemberBoot(token) {
  const endpoints = [
    ['/member-portal/dashboard', 'GET /member-portal/dashboard'],
    ['/staff', 'GET /staff'],
    ['/settings/working-hours', 'GET /settings/working-hours'],
    ['/rooms', 'GET /rooms'],
  ];

  const t0 = performance.now();
  const results = await Promise.all(
    endpoints.map(async ([pathSuffix, label]) => {
      const r = await apiGet(token, pathSuffix);
      return { label, ...r };
    })
  );
  const parallelMs = Math.round(performance.now() - t0);
  return { results, parallelMs, requestCount: endpoints.length };
}

function fileSizeKb(relPath) {
  const p = path.join(ROOT, relPath);
  if (!fs.existsSync(p)) return null;
  const stat = fs.statSync(p);
  const lines = fs.readFileSync(p, 'utf8').split('\n').length;
  return { bytes: stat.size, kb: (stat.size / 1024).toFixed(1), lines };
}

async function measureStaticAssets() {
  const localFiles = ['index.html', 'app.js', 'api.js', 'styles.css', 'pwa-register.js', 'sw.js'];
  const local = {};
  for (const f of localFiles) {
    local[f] = fileSizeKb(f);
  }

  const remote = {};
  try {
    for (const f of ['index.html', 'app.js', 'api.js', 'styles.css']) {
      const r = await timedFetch(`${FRONTEND}/${f}`);
      remote[f] = { ms: r.ms, bytes: r.bytes, ok: r.ok };
    }
  } catch (e) {
    remote._error = e.message;
  }
  return { local, remote };
}

function fmtBytes(n) {
  if (n >= 1024) return (n / 1024).toFixed(1) + ' KB';
  return n + ' B';
}

function printTable(title, rows) {
  console.log('\n=== ' + title + ' ===');
  console.log('Endpoint'.padEnd(42) + 'ms'.padStart(6) + '  size'.padStart(10) + '  ok');
  console.log('-'.repeat(62));
  for (const r of rows) {
    console.log(
      r.label.padEnd(42) +
        String(r.ms).padStart(6) +
        fmtBytes(r.bytes).padStart(10) +
        '  ' +
        (r.ok ? '✓' : '✗ ' + r.status)
    );
  }
}

async function findMemberLogin(adminToken) {
  const r = await apiGet(adminToken, '/members');
  if (!r.ok) return null;
  const members = JSON.parse(r.text);
  const withEmail = members.filter((m) => m.email && m.phone && String(m.phone).replace(/\D/g, '').length >= 4);
  if (!withEmail.length) return null;
  const m = withEmail[0];
  const digits = String(m.phone).replace(/\D/g, '');
  const password = digits.slice(-4);
  return { email: m.email, password, name: m.name || m.first_name };
}

async function main() {
  console.log('PERF-01 baseline — ' + new Date().toISOString());
  console.log('API:', API);

  const assets = await measureStaticAssets();
  console.log('\n=== Statik dosyalar (disk) ===');
  for (const [f, info] of Object.entries(assets.local)) {
    if (!info) continue;
    console.log(`  ${f}: ${info.kb} KB (${info.lines} satır)`);
  }
  if (!assets.remote._error) {
    console.log('\n=== Statik dosyalar (frontend sunucu) ===');
    for (const [f, info] of Object.entries(assets.remote)) {
      if (f.startsWith('_')) continue;
      console.log(`  ${f}: ${fmtBytes(info.bytes)} — ${info.ms} ms`);
    }
  } else {
    console.log('\n(Frontend :5173 erişilemedi — yalnızca disk ölçümü)');
  }

  const loginT = await timedFetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
  });
  console.log('\n=== Admin login ===');
  console.log(`  POST /auth/login: ${loginT.ms} ms (${loginT.status})`);

  if (!loginT.ok) {
    console.error('  Giriş başarısız:', loginT.text.slice(0, 120));
    console.error('  PERF_ADMIN_EMAIL / PERF_ADMIN_PASSWORD env ile doğru bilgileri verin.');
  }

  let adminToken = null;
  try {
    adminToken = JSON.parse(loginT.text).token || null;
  } catch (_) {}

  let admin = null;
  if (adminToken) {
    admin = await measureAdminBoot(adminToken);
    printTable('Admin açılış API (paralel ' + admin.requestCount + ' istek, toplam ' + admin.parallelMs + ' ms)', admin.results);
    console.log('  (Sıralı toplam simülasyon: ~' + admin.sequentialMs + ' ms — paralel avantaj)');

    const slowest = [...admin.results].sort((a, b) => b.ms - a.ms)[0];
    const totalBytes = admin.results.reduce((s, r) => s + r.bytes, 0);
    console.log('  En yavaş istek: ' + slowest.label + ' (' + slowest.ms + ' ms, ' + fmtBytes(slowest.bytes) + ')');
    console.log('  API JSON toplam: ' + fmtBytes(totalBytes));
  } else {
    console.log('\n  Admin API ölçümü atlandı (token yok).');
  }

  let memberPayload = null;
  if (adminToken) {
    const memberCreds = await findMemberLogin(adminToken);
  if (memberCreds) {
    console.log('\n=== Üye login (' + memberCreds.email + ') ===');
    const mLogin = await login(memberCreds.email, memberCreds.password);
    const member = await measureMemberBoot(mLogin);
    printTable('Üye açılış API (paralel ' + member.requestCount + ' istek, toplam ' + member.parallelMs + ' ms)', member.results);
    const mSlow = [...member.results].sort((a, b) => b.ms - a.ms)[0];
    const mBytes = member.results.reduce((s, r) => s + r.bytes, 0);
    console.log('  En yavaş istek: ' + mSlow.label + ' (' + mSlow.ms + ' ms)');
    console.log('  API JSON toplam: ' + fmtBytes(mBytes));
    memberPayload = {
      email: memberCreds.email,
      parallelMs: member.parallelMs,
      requestCount: member.requestCount,
      totalBytes: mBytes,
      slowest: { label: mSlow.label, ms: mSlow.ms, bytes: mSlow.bytes },
      endpoints: member.results.map((r) => ({ label: r.label, ms: r.ms, bytes: r.bytes })),
    };
  } else {
    console.log('\n(Üye hesabı bulunamadı — üye ölçümü atlandı)');
  }
  }

  console.log('\n=== Tarayıcı ölçümü (manuel) ===');
  console.log('Chrome DevTools → Network: Disable cache, Hard reload');
  console.log('Performance: Record → giriş → takvim prev/next → Stop');
  console.log('Konsola yapıştır: perfBaseline() — app.js içindeki helper (PERF-01)');

  const outPath = path.join(ROOT, 'docs', 'perf-baseline-latest.json');
  const payload = {
    measuredAt: new Date().toISOString(),
    api: API,
    staticLocal: assets.local,
    staticRemote: assets.remote,
    admin: admin
      ? {
          loginMs: loginT.ms,
          loginOk: loginT.ok,
          parallelMs: admin.parallelMs,
          sequentialMs: admin.sequentialMs,
          requestCount: admin.requestCount,
          totalBytes: admin.results.reduce((s, r) => s + r.bytes, 0),
          slowest: (() => {
            const s = [...admin.results].sort((a, b) => b.ms - a.ms)[0];
            return { label: s.label, ms: s.ms, bytes: s.bytes };
          })(),
          endpoints: admin.results.map((r) => ({ label: r.label, ms: r.ms, bytes: r.bytes, ok: r.ok })),
        }
      : { loginMs: loginT.ms, loginOk: loginT.ok, skipped: true },
    member: memberPayload,
  };
  fs.writeFileSync(outPath, JSON.stringify(payload, null, 2));
  console.log('\nJSON kaydedildi: docs/perf-baseline-latest.json');
}

main().catch((e) => {
  console.error('Hata:', e.message);
  process.exit(1);
});
