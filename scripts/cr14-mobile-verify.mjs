/**
 * CR-14 — mobil tarayıcı öncesi otomatik doğrulama (kod + HTTP + API).
 * Çalıştır: node scripts/cr14-mobile-verify.mjs
 * Ortam: http://localhost:5173 + http://localhost:3000
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const FRONT = process.env.CR14_FRONT_URL || 'http://localhost:5173';
const API = (process.env.CR14_API_URL || 'http://localhost:3000/api').replace(/\/$/, '');

const results = [];

function pass(id, msg) {
  results.push({ id, ok: true, msg });
}
function fail(id, msg) {
  results.push({ id, ok: false, msg });
}

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

function hasLayoutInline(html, id) {
  const re = new RegExp(`id="${id}"[\\s\\S]{0,800}?style="[^"]*(?:width|height|max-height|display|flex|overflow)[^"]*"`, 'i');
  return re.test(html);
}

async function apiLogin(email, password) {
  const res = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const body = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, body };
}

async function apiGet(pathname, token) {
  const res = await fetch(`${API}${pathname}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const body = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, body };
}

// --- Statik dosya kontrolleri ---
const indexHtml = read('index.html');
const stylesCss = read('styles.css');
const appJs = read('app.js');

const memberModalIds = [
  'memberPortalSessionsModal',
  'memberSessionCancelModal',
  'memberPackageRequestModal',
  'memberProfileModal',
  'memberQrModal',
];

for (const id of memberModalIds) {
  if (!indexHtml.includes(`id="${id}"`)) {
    fail(`HTML-${id}`, `${id} index.html içinde yok`);
  } else if (hasLayoutInline(indexHtml, id)) {
    fail(`HTML-${id}`, `${id} layout inline style içeriyor`);
  } else {
    pass(`HTML-${id}`, `${id} layout inline yok`);
  }
}

for (const panelId of ['adminMembersListView', 'adminExpiredMembershipsView', 'adminFormerMembersView', 'adminEntryListView']) {
  if (indexHtml.includes(`id="${panelId}"`) && indexHtml.includes('admin-main-panel')) {
    pass(`PANEL-${panelId}`, `${panelId} admin-main-panel olarak tanımlı`);
  } else {
    fail(`PANEL-${panelId}`, `${panelId} veya admin-main-panel eksik`);
  }
}

if (stylesCss.includes('--touch-min: 44px') || stylesCss.includes('--touch-min:44px')) {
  pass('CSS-touch-min', '--touch-min: 44px tanımlı');
} else {
  fail('CSS-touch-min', '--touch-min: 44px bulunamadı');
}

if (/\.staff-attendance-btn[\s\S]{0,200}width:\s*44px/.test(stylesCss) &&
    /\.staff-attendance-btn[\s\S]{0,400}height:\s*44px/.test(stylesCss)) {
  pass('CSS-staff-attendance', 'staff-attendance-btn 44×44px');
} else {
  fail('CSS-staff-attendance', 'staff-attendance-btn 44px kuralı eksik');
}

if (/\.modal__card--member-sheet[\s\S]{0,120}100dvh/.test(stylesCss)) {
  pass('CSS-member-sheet', 'modal__card--member-sheet max-height 100dvh');
} else {
  fail('CSS-member-sheet', 'member sheet modal yükseklik kuralı eksik');
}

if (/#memberSessionCancelModal[\s\S]{0,80}z-index:\s*1100/.test(stylesCss) &&
    /#memberPortalSessionsModal[\s\S]{0,80}z-index:\s*1050/.test(stylesCss)) {
  pass('CSS-modal-zindex', 'İptal modalı (1100) seans listesinin (1050) üstünde');
} else {
  fail('CSS-modal-zindex', 'Üye modal z-index sırası eksik');
}

if (appJs.includes('renderStaffAttendanceControlsHtml') && appJs.includes('staff-attendance-btn')) {
  pass('JS-staff-attendance', 'Personel yoklama butonları render ediliyor');
} else {
  fail('JS-staff-attendance', 'Personel yoklama render eksik');
}

if (appJs.includes('showAdminMainView') && appJs.includes('members-list')) {
  pass('JS-admin-panel', 'Admin ana panel geçişi (showAdminMainView)');
} else {
  fail('JS-admin-panel', 'showAdminMainView eksik');
}

if (indexHtml.includes('viewport') && indexHtml.includes('theme-color')) {
  pass('HTML-pwa-meta', 'viewport + theme-color meta mevcut');
} else {
  fail('HTML-pwa-meta', 'PWA meta eksik');
}

// --- HTTP ---
try {
  const frontRes = await fetch(`${FRONT}/index.html`);
  if (frontRes.ok) pass('HTTP-front', `index.html ${frontRes.status}`);
  else fail('HTTP-front', `index.html ${frontRes.status}`);
} catch (e) {
  fail('HTTP-front', `Frontend erişilemedi: ${e.message}`);
}

try {
  const health = await fetch(`${API.replace(/\/api$/, '')}/health`);
  const h = await health.json();
  if (health.ok && h.status === 'ok') pass('HTTP-health', 'Backend /health OK');
  else fail('HTTP-health', `Backend health ${health.status}`);
} catch (e) {
  fail('HTTP-health', `Backend erişilemedi: ${e.message}`);
}

// --- API rol akışları ---
const adminCandidates = [
  ['admin@local', 'admin123'],
  ['admin', 'admin123'],
];
let adminLogin = { ok: false, status: 0, body: {} };
for (const [email, password] of adminCandidates) {
  adminLogin = await apiLogin(email, password);
  if (adminLogin.ok && adminLogin.body.token) break;
}
if (adminLogin.ok && adminLogin.body.token) {
  pass('API-admin-login', 'Admin girişi başarılı');
  const staffList = await apiGet('/staff', adminLogin.body.token);
  if (staffList.ok && Array.isArray(staffList.body) && staffList.body.length > 0) {
    pass('API-staff-list', `${staffList.body.length} personel kaydı`);
    const withEmail = staffList.body.find((s) => s.user_email);
    if (withEmail) {
      const digits = String(withEmail.phone || '').replace(/\D/g, '');
      const last4 = digits.slice(-4);
      if (last4) {
        const staffUser = await apiLogin(withEmail.user_email, last4);
        if (staffUser.ok && staffUser.body.user?.role === 'staff') {
          pass('API-staff-login', `Personel girişi: ${withEmail.user_email}`);
        } else {
          fail('API-staff-login', `Personel girişi başarısız (${withEmail.user_email})`);
        }
      } else {
        fail('API-staff-login', 'Personel telefon/şifre tespit edilemedi');
      }
    } else {
      fail('API-staff-login', 'Giriş hesabı olan personel bulunamadı');
    }
  } else {
    fail('API-staff-list', 'Personel listesi boş veya hata');
  }
} else {
  fail('API-admin-login', `Admin girişi başarısız (${adminLogin.status})`);
}

const memberLogin = await apiLogin('test.uye.001@seed.local', '0001');
if (memberLogin.ok && memberLogin.body.user?.role === 'member') {
  pass('API-member-login', 'Seed üye girişi (test.uye.001@seed.local)');
  const portal = await apiGet('/member-portal/dashboard', memberLogin.body.token);
  if (portal.ok) pass('API-member-portal', 'Üye portal dashboard API OK');
  else fail('API-member-portal', `Üye portal ${portal.status}`);
} else {
  fail('API-member-login', `Seed üye girişi başarısız (${memberLogin.status}) — test üyesi seed edilmemiş olabilir`);
}

// --- Özet ---
const passed = results.filter((r) => r.ok).length;
const failed = results.filter((r) => !r.ok);
console.log('\n=== CR-14 Otomatik Doğrulama ===');
console.log(`Geçti: ${passed}/${results.length}\n`);
for (const r of results) {
  console.log(`${r.ok ? '✓' : '✗'} [${r.id}] ${r.msg}`);
}
if (failed.length) {
  console.log('\nNot: API hataları seed/ortam eksikliğinden olabilir; statik kontroller önceliklidir.');
  process.exitCode = failed.some((f) => f.id.startsWith('HTML-') || f.id.startsWith('CSS-')) ? 1 : 0;
} else {
  console.log('\nTüm kontroller geçti.');
}
