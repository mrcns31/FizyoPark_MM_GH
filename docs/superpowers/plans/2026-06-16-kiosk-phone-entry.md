# Kiosk Telefon Girişi Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Kiosk ekranına, QR okuyucunun yanı sıra sayısal tuş takımıyla telefon numarası girişini ekle (sıfırlı/sıfırsız, aynı kapı+check-in akışı).

**Architecture:** Yeni `normalizePhoneFlexible` yardımcı fonksiyonu telefon normalleştirmeyi yönetir. Yeni `POST /member-portal/verify-phone-access` endpoint'i `/verify-access` ile aynı iş mantığını (checkIn, activityLog, facilityAccessLog) telefon üzerinden çalıştırır. Kiosk'ta tam ekran overlay + sayısal tuş takımı butona dokunulunca açılır.

**Tech Stack:** Node.js + Express (ESM), PostgreSQL (pg), vanilla JS (kiosk frontend)

---

## Dosya Haritası

| Dosya | Değişim |
|---|---|
| `backend/utils/phone.js` | `normalizePhoneFlexible` export eklenir |
| `backend/utils/facilityAccess.js` | `logWalkInQrAccess` opsiyonel `source` parametresi alır |
| `backend/routes/member-portal.js` | `POST /verify-phone-access` endpoint eklenir, `normalizePhoneFlexible` import |
| `api.js` | `verifyMemberPhoneAccess` fonksiyonu + window.API'ye ekleme |
| `kiosk.html` | Overlay markup + CSS + "Telefon ile Giriş" butonu |
| `kiosk.js` | `INVALID_REASON_MESSAGES` güncellemesi + overlay + `handlePhoneAccess` mantığı |

---

## Task 1: normalizePhoneFlexible — phone.js

**Files:**
- Modify: `backend/utils/phone.js` (sonuna eklenir)

- [ ] **Adım 1: Fonksiyonu ekle**

`backend/utils/phone.js` dosyasının sonuna ekle:

```js
/**
 * Kiosk girişi için esnek normalizasyon.
 * 10 hane (sıfırsız) veya 11 hane (0 ile başlayan) kabul eder.
 * Geçersizse null döner.
 */
export function normalizePhoneFlexible(raw) {
  if (raw == null) return null;
  let digits = String(raw).replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1);
  if (digits.length !== 10) return null;
  return formatPhone(digits);
}
```

- [ ] **Adım 2: Manuel doğrulama**

Proje kökünde (`d:\26-01-2026-Cursor-Takip\FP_MM\backend`) çalıştır:

```bash
node --input-type=module <<'EOF'
import { normalizePhoneFlexible } from './utils/phone.js';
console.log(normalizePhoneFlexible('5321234567'));   // (532)123-45-67
console.log(normalizePhoneFlexible('05321234567'));  // (532)123-45-67
console.log(normalizePhoneFlexible('053212345'));    // null (9 hane)
console.log(normalizePhoneFlexible('15321234567')); // null (11 hane, 0 ile başlamaz)
EOF
```

Beklenen çıktı:
```
(532)123-45-67
(532)123-45-67
null
null
```

- [ ] **Adım 3: Commit**

```bash
git add backend/utils/phone.js
git commit -m "feat: normalizePhoneFlexible — 0'lı/0'sız telefon girişini normalize eder"
```

---

## Task 2: logWalkInQrAccess — opsiyonel source parametresi

**Files:**
- Modify: `backend/utils/facilityAccess.js:4`

- [ ] **Adım 1: İmzayı güncelle ve INSERT'e yansıt**

`backend/utils/facilityAccess.js` içindeki fonksiyonu şu şekilde değiştir:

```js
/** Randevusuz kapı girişi kaydı */
export async function logWalkInQrAccess(db, memberId, source = 'qr') {
  if (!memberId) return false;
  try {
    await db.query(
      `INSERT INTO facility_access_logs (member_id, accessed_at, source)
       VALUES ($1, CURRENT_TIMESTAMP, $2)`,
      [memberId, source]
    );
    return true;
  } catch (err) {
    if (err.code === '42P01') {
      console.warn('[facilityAccess] facility_access_logs tablosu yok; migration_facility_access_logs.sql çalıştırın');
    } else {
      console.error('[facilityAccess] walk-in log hatası:', err.message);
    }
    return false;
  }
}
```

Mevcut tüm `logWalkInQrAccess(db, memberId)` çağrıları default `'qr'` alır — değiştirilmesi gerekmez.

- [ ] **Adım 2: Commit**

```bash
git add backend/utils/facilityAccess.js
git commit -m "feat: logWalkInQrAccess opsiyonel source parametresi alıyor"
```

---

## Task 3: /verify-phone-access endpoint

**Files:**
- Modify: `backend/routes/member-portal.js` (satır 14: import + satır 81'den sonra: yeni endpoint)

- [ ] **Adım 1: Import'a normalizePhoneFlexible ekle**

`backend/routes/member-portal.js` dosyasının 14. satırındaki import satırını değiştir:

Mevcut:
```js
import { createMemberAccessToken, verifyMemberAccessToken } from '../utils/memberAccessQr.js';
```

Yeni:
```js
import { createMemberAccessToken, verifyMemberAccessToken } from '../utils/memberAccessQr.js';
import { normalizePhoneFlexible } from '../utils/phone.js';
```

- [ ] **Adım 2: Endpoint'i ekle**

`router.use(verifyToken);` satırından (83. satır) **hemen önce**, `logWalkInQrAccess` çağrısının bittiği 81. satırdan sonra yeni endpoint bloğunu ekle:

```js
// Telefon numarasıyla kapı erişimi (auth gerektirmez — kiosk kullanacak)
router.post('/verify-phone-access', async (req, res) => {
  try {
    const { phone } = req.body || {};
    const normalized = normalizePhoneFlexible(phone);
    if (!normalized) {
      return res.status(401).json({ valid: false, reason: 'format' });
    }

    const memberRow = await db.query(
      'SELECT id, name, user_id FROM members WHERE phone = $1 AND deleted_at IS NULL',
      [normalized]
    );
    if (!memberRow.rows.length) {
      return res.status(401).json({ valid: false, reason: 'not_found' });
    }

    const { id: memberId, name: memberName, user_id: memberUserId } = memberRow.rows[0];

    let checkIn = { checkedIn: false, reason: 'no_session' };
    try {
      checkIn = await checkInSessionForMember(db, memberId);
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
        details: {
          memberId,
          memberName: memberName || undefined,
          startTs: checkIn.startTs,
          checkInMethod: 'phone',
        },
      }).catch(() => {});
    } else {
      await logWalkInQrAccess(db, memberId, 'phone');
    }

    res.json({
      valid: true,
      memberId,
      memberName,
      checkIn: checkIn.checkedIn
        ? { ok: true, sessionId: checkIn.sessionId, startTs: checkIn.startTs }
        : { ok: false, reason: checkIn.reason || 'no_session' },
    });
  } catch (error) {
    console.error('Verify phone access error:', error);
    res.status(500).json({ error: 'Doğrulama hatası' });
  }
});
```

- [ ] **Adım 3: Backend'i başlat ve curl ile test et**

Backend çalışıyorsa yeniden başlat. Veritabanında mevcut bir üye numarası ile test et (varolan üyenin phone değerini DB'den al):

```bash
# Mevcut durumu test: geçersiz format
curl -s -X POST http://localhost:3000/api/member-portal/verify-phone-access \
  -H "Content-Type: application/json" \
  -d '{"phone":"123"}' | node -e "process.stdin.resume();var d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>console.log(JSON.parse(d)))"
```

Beklenen: `{ valid: false, reason: 'format' }`

```bash
# Bulunamayan numara
curl -s -X POST http://localhost:3000/api/member-portal/verify-phone-access \
  -H "Content-Type: application/json" \
  -d '{"phone":"5009999999"}' | node -e "process.stdin.resume();var d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>console.log(JSON.parse(d)))"
```

Beklenen: `{ valid: false, reason: 'not_found' }`

- [ ] **Adım 4: Commit**

```bash
git add backend/routes/member-portal.js
git commit -m "feat: POST /verify-phone-access — telefon numarasıyla kiosk girişi"
```

---

## Task 4: api.js — verifyMemberPhoneAccess

**Files:**
- Modify: `api.js` (satır ~390 ve satır ~882)

- [ ] **Adım 1: Fonksiyonu ekle**

`api.js` içinde `verifyMemberAccess` fonksiyonunun (satır ~390) hemen sonrasına ekle:

```js
  async function verifyMemberPhoneAccess(phone) {
    return apiFetch('/member-portal/verify-phone-access', {
      method: 'POST',
      body: JSON.stringify({ phone }),
    });
  }
```

- [ ] **Adım 2: window.API export'una ekle**

`verifyMemberAccess,` satırının (satır ~882) hemen arkasına ekle:

```js
    verifyMemberPhoneAccess,
```

- [ ] **Adım 3: Commit**

```bash
git add api.js
git commit -m "feat: api.js verifyMemberPhoneAccess fonksiyonu"
```

---

## Task 5: kiosk.html — overlay markup, CSS ve buton

**Files:**
- Modify: `kiosk.html`

- [ ] **Adım 1: CSS ekle**

`kiosk.html` içindeki `</style>` etiketinden önce (satır ~139) şu CSS bloğunu ekle:

```css
      /* Telefon girişi butonu */
      .kiosk__phone-btn{
        margin-top:8px;
        padding:10px 22px;
        background:transparent;
        border:1px solid var(--border);
        border-radius:10px;
        color:var(--muted);
        font-size:14px;
        cursor:pointer;
        font-family:var(--font);
        transition: border-color .2s, color .2s;
        -webkit-user-select:none;
        user-select:none;
      }
      .kiosk__phone-btn:hover, .kiosk__phone-btn:active{
        border-color:var(--accent);
        color:var(--text);
      }
      /* Telefon overlay */
      .kiosk__phone-overlay{
        position:fixed;
        inset:0;
        background:var(--bg);
        display:flex;
        flex-direction:column;
        align-items:center;
        justify-content:center;
        gap:24px;
        z-index:100;
      }
      .kiosk__phone-overlay[hidden]{ display:none; }
      .kiosk__phone-title{
        font-size:22px;
        font-weight:700;
        color:var(--muted);
        margin:0;
      }
      .kiosk__phone-display{
        font-size:42px;
        font-weight:800;
        letter-spacing:4px;
        min-width:320px;
        text-align:center;
        background:var(--panel);
        border:1px solid var(--border);
        border-radius:14px;
        padding:18px 28px;
        min-height:80px;
        display:flex;
        align-items:center;
        justify-content:center;
        font-variant-numeric:tabular-nums;
      }
      .kiosk__phone-pad{
        display:grid;
        grid-template-columns:repeat(3, 90px);
        grid-template-rows:repeat(4, 80px);
        gap:10px;
      }
      .kiosk__phone-pad button{
        background:var(--panel);
        border:1px solid var(--border);
        border-radius:12px;
        color:var(--text);
        font-size:28px;
        font-weight:700;
        font-family:var(--font);
        cursor:pointer;
        transition: background .15s, border-color .15s;
        -webkit-user-select:none;
        user-select:none;
      }
      .kiosk__phone-pad button:active{
        background:rgba(124,92,255,.25);
        border-color:var(--accent);
      }
      .kiosk__phone-pad button:disabled{
        opacity:.3;
        pointer-events:none;
      }
      .kiosk__phone-pad .btn-confirm{
        background:rgba(43,213,118,.15);
        border-color:var(--ok);
        color:var(--ok);
      }
      .kiosk__phone-pad .btn-confirm:active{
        background:rgba(43,213,118,.35);
      }
      .kiosk__phone-cancel{
        background:transparent;
        border:1px solid var(--border);
        border-radius:10px;
        color:var(--muted);
        font-size:16px;
        font-family:var(--font);
        padding:10px 32px;
        cursor:pointer;
        -webkit-user-select:none;
        user-select:none;
      }
      .kiosk__phone-cancel:active{ border-color:var(--danger); color:var(--danger); }
```

- [ ] **Adım 2: Buton ve overlay markup ekle**

`kiosk.html` içinde `<p class="kiosk__subtitle" id="kioskSubtitle">` satırının hemen ardından, kapanış `</main>` etiketinden önce butonu ekle:

```html
        <button class="kiosk__phone-btn" id="kioskPhoneBtn">📱 Telefon ile Giriş</button>
```

Kapanış `</div>` etiketlerinin sonrasına (`.kiosk-right`'ın kapandığı yerin arkasına, `<script>` etiketinden önce) overlay div'ini ekle:

```html
    <div class="kiosk__phone-overlay" id="phoneOverlay" hidden>
      <p class="kiosk__phone-title">Telefon Numaranız</p>
      <div class="kiosk__phone-display" id="phoneDisplay">_ _ _ _ _ _ _ _ _ _</div>
      <div class="kiosk__phone-pad" id="phonePad">
        <button data-digit="1">1</button>
        <button data-digit="2">2</button>
        <button data-digit="3">3</button>
        <button data-digit="4">4</button>
        <button data-digit="5">5</button>
        <button data-digit="6">6</button>
        <button data-digit="7">7</button>
        <button data-digit="8">8</button>
        <button data-digit="9">9</button>
        <button id="phoneBackspace">⌫</button>
        <button data-digit="0">0</button>
        <button class="btn-confirm" id="phoneConfirm" disabled>✓</button>
      </div>
      <button class="kiosk__phone-cancel" id="phoneCancelBtn">Vazgeç</button>
    </div>
```

- [ ] **Adım 3: Tarayıcıda görsel kontrol**

`kiosk.html`'yi tarayıcıda aç. Sağ panelin altında küçük "📱 Telefon ile Giriş" butonu görünmeli. Overlay şu an JS ile açılacak (sonraki task), test için tarayıcı console'dan `document.getElementById('phoneOverlay').removeAttribute('hidden')` yazarak overlay görünümünü kontrol et.

- [ ] **Adım 4: Commit**

```bash
git add kiosk.html
git commit -m "feat: kiosk.html telefon girişi overlay ve CSS"
```

---

## Task 6: kiosk.js — telefon girişi mantığı

**Files:**
- Modify: `kiosk.js`

- [ ] **Adım 1: INVALID_REASON_MESSAGES'a not_found ekle**

`kiosk.js` içindeki `INVALID_REASON_MESSAGES` objesine (satır 14-21) `not_found` mesajını ekle:

```js
  var INVALID_REASON_MESSAGES = {
    expired: 'QR kodunun süresi doldu. Üye portalından kodu yenileyip tekrar deneyin.',
    empty: 'QR kodu okunamadı. Lütfen tekrar deneyin.',
    format: 'QR kodu okunamadı. Lütfen tekrar deneyin.',
    parse: 'QR kodu okunamadı. Lütfen tekrar deneyin.',
    invalid_sig: 'QR kodu geçersiz. Üye portalından yeni bir kod oluşturun.',
    member_mismatch: 'QR kodu geçersiz. Üye portalından yeni bir kod oluşturun.',
    not_found: 'Bu telefon numarasına kayıtlı üye bulunamadı.',
  };
```

- [ ] **Adım 2: Değişken ve element referansları ekle**

`kiosk.js` içinde `var inputEl = ...` satırının (satır 9) hemen ardına ekle:

```js
  var phoneOverlay = document.getElementById('phoneOverlay');
  var phoneDisplay = document.getElementById('phoneDisplay');
  var phonePad = document.getElementById('phonePad');
  var phoneConfirm = document.getElementById('phoneConfirm');
  var phoneBackspace = document.getElementById('phoneBackspace');
  var phoneCancelBtn = document.getElementById('phoneCancelBtn');
  var kioskPhoneBtn = document.getElementById('kioskPhoneBtn');

  var phoneEntry = false;
  var phoneDigitsBuf = [];
  var MAX_PHONE_DIGITS = 11;
```

- [ ] **Adım 3: Yardımcı fonksiyonları ekle**

`setIdle` fonksiyonunun (satır ~23) hemen öncesine ekle:

```js
  function updatePhoneDisplay() {
    var digits = phoneDigitsBuf.join('');
    var padded = digits || '';
    // Görsel olarak boşluk dolgu: 10 kutu
    var display = '';
    var len = Math.min(digits.length, MAX_PHONE_DIGITS);
    for (var i = 0; i < 10; i++) {
      display += i < len ? digits[i] : '_';
      if (i === 2 || i === 5 || i === 7) display += ' ';
    }
    phoneDisplay.textContent = display;
    var count = phoneDigitsBuf.length;
    phoneConfirm.disabled = !(count >= 10 && count <= MAX_PHONE_DIGITS);
  }

  function openPhoneOverlay() {
    phoneDigitsBuf = [];
    updatePhoneDisplay();
    phoneEntry = true;
    phoneOverlay.removeAttribute('hidden');
  }

  function closePhoneOverlay() {
    phoneEntry = false;
    phoneOverlay.setAttribute('hidden', '');
    phoneDigitsBuf = [];
  }

  async function handlePhoneAccess(rawDigits) {
    closePhoneOverlay();
    setBusy();
    try {
      var result = await window.API.verifyMemberPhoneAccess(rawDigits);
      if (result && result.valid) {
        triggerDoor();
        setSuccess(result.memberName, result.checkIn);
      } else {
        setFailure(INVALID_REASON_MESSAGES[result && result.reason] || 'Lütfen tekrar deneyin');
      }
    } catch (err) {
      var reason = err && err.data && err.data.reason;
      setFailure(INVALID_REASON_MESSAGES[reason] || 'Bağlantı hatası, tekrar deneyin');
    }
  }
```

- [ ] **Adım 4: Event listener'ları ekle**

`inputEl.addEventListener('keydown', ...)` bloğunun (satır ~132) hemen öncesine şu event listener bloğunu ekle:

```js
  // Tuş takımı — rakamlar
  phonePad.addEventListener('click', function (ev) {
    var btn = ev.target.closest('button[data-digit]');
    if (btn && phoneDigitsBuf.length < MAX_PHONE_DIGITS) {
      phoneDigitsBuf.push(btn.dataset.digit);
      updatePhoneDisplay();
    }
  });

  phoneBackspace.addEventListener('click', function () {
    if (phoneDigitsBuf.length > 0) {
      phoneDigitsBuf.pop();
      updatePhoneDisplay();
    }
  });

  phoneConfirm.addEventListener('click', function () {
    if (phoneConfirm.disabled) return;
    handlePhoneAccess(phoneDigitsBuf.join(''));
  });

  phoneCancelBtn.addEventListener('click', function () {
    closePhoneOverlay();
    setIdle();
  });

  kioskPhoneBtn.addEventListener('click', function (ev) {
    ev.stopPropagation();
    if (!busy) openPhoneOverlay();
  });
```

- [ ] **Adım 5: blur → focusInput döngüsünü koru**

`inputEl.addEventListener('blur', ...)` bloğunu (satır ~144) şu şekilde değiştir:

```js
  inputEl.addEventListener('blur', function () {
    if (phoneEntry) return;
    setTimeout(focusInput, 50);
  });
```

- [ ] **Adım 6: document click handler'ı koru**

`document.addEventListener('click', focusInput)` satırını şu şekilde değiştir:

```js
  document.addEventListener('click', function () {
    if (!phoneEntry) focusInput();
  });
```

- [ ] **Adım 7: setIdle'da butonu göster/gizle**

`setIdle` fonksiyonu içinde `focusInput()` satırının öncesine ekle:

```js
    if (kioskPhoneBtn) kioskPhoneBtn.style.display = '';
```

`setBusy` fonksiyonu içinde `busy = true;` satırının ardına ekle:

```js
    if (kioskPhoneBtn) kioskPhoneBtn.style.display = 'none';
```

- [ ] **Adım 8: Commit**

```bash
git add kiosk.js
git commit -m "feat: kiosk.js telefon numarası girişi overlay mantığı"
```

---

## Task 7: Manuel Uçtan Uca Test

- [ ] **Adım 1: Backend başlat**

```bash
cd backend && npm run dev
```

- [ ] **Adım 2: kiosk.html'yi tarayıcıda aç**

`http://localhost:3000/kiosk.html` veya doğrudan dosyayı aç (API fetch için sunucu üzerinden açılmalı).

- [ ] **Adım 3: Test senaryoları**

| # | Senaryo | Beklenen Sonuç |
|---|---|---|
| 1 | "📱 Telefon ile Giriş" butonuna dokun | Overlay açılır, `_ _ _ _ _ _ _ _ _ _` gösterilir |
| 2 | 5-3-2-1-2-3-4-5-6-7 rakamlarına bas | Kutu dolar, ✓ butonu aktif olur |
| 3 | ✓ butonuna bas (mevcut üye numarası) | "MERHABA [İSİM]" başarı ekranı, kapı tetiklenmiş |
| 4 | Overlay açıkken QR okutma | QR session yok sayılır (blur tetiklenmez), overlay açık kalır |
| 5 | "Vazgeç" butonuna bas | Overlay kapanır, idle ekranına döner |
| 6 | Olmayan numara gir, ✓ bas | "Bu telefon numarasına kayıtlı üye bulunamadı." hatası |
| 7 | 3 rakamla ✓ butonuna bas | ✓ butonu disabled, giriş yapılmaz |
| 8 | 05321234567 (0 ile) gir, ✓ bas | 0 normalize edilir, giriş başarılı |

- [ ] **Adım 4: Son commit (gerekirse)**

Eğer test sırasında küçük düzeltme yapıldıysa:

```bash
git add kiosk.html kiosk.js api.js backend/routes/member-portal.js
git commit -m "fix: kiosk telefon girişi düzeltmeleri"
```
