# KVKK Onay Akışı Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a mandatory KVKK/legal-consent gate (`#legalConsentScreen`) shown to every role (admin/staff/member) on login/boot before any other screen (and before the first-login "Şifrenizi Belirleyin" screen), record consent in an audit-trail table, and let admins/managers edit the 4 legal-page URLs from the existing "Bilgileri Güncelle" account screen.

**Architecture:** New `user_consents` audit table + `app_settings`-backed `legalConsent.js` util (mirrors the existing `appSettings.js` / `institution_whatsapp` pattern). `auth.js` exposes consent status via `/login`, `/me`, `PUT /account`, accepts consent via `POST /consent`, and serves link URLs via public `GET /legal-links`. Frontend gets a new full-screen overlay (`#legalConsentScreen`, styled like `#passwordChangeScreen`), shown right after login / on boot before the password-change gate, plus 4 footer links on the login screen and a new "Yasal Sayfa Bağlantıları" admin-only section in `#adminAccountScreen`.

**Tech Stack:** Node/Express + `pg` (raw SQL, no ORM), vanilla JS frontend (`app.js`/`api.js`/`index.html`/`styles.css`). No automated test framework exists in this repo (`backend/package.json` test script is a stub) — verification steps below use `curl` against the running dev server and manual browser checks, matching how existing features (e.g. `institution_whatsapp`) were verified.

**Reference docs:**
- `docs/superpowers/specs/2026-06-14-kvkk-onay-akisi-design.md` — approved design (note: its "Yasal Link Yönetimi" section says the account-update endpoint is `PUT /auth/set-password` at "satır ~373" — **this is incorrect**. The real endpoint is `PUT /api/auth/account`, defined as `router.put('/account', verifyToken, ...)` in `backend/routes/auth.js:250-401`, with `buildUserProfile` called at line 373. This plan uses the correct endpoint.)
- `docs/KVKK-METINLERI.md` — exact Turkish copy for the 4 legal pages and the in-app consent screen.

---

## File Structure

- **Create** `backend/database/migration_user_consents.sql` — new `user_consents` audit table.
- **Create** `backend/utils/legalConsent.js` — `CONSENT_VERSION`, `DEFAULT_LEGAL_LINKS`, `getLegalLinks()`, `setLegalLinks()`, `getConsentStatus()`, `recordConsent()`.
- **Modify** `backend/routes/auth.js` — spread consent status into `/login`, `/me`, `/account` responses; new `POST /consent`; new `GET /legal-links`; `/account` handles `legalLinks` payload (admin/manager only).
- **Modify** `api.js` — add `acceptConsent()`, `getLegalLinks()`, register both on `window.API`.
- **Modify** `styles.css` — add `.login-legal-links`, `.pw-change__link-list`, `.pw-change__checkbox-field`.
- **Modify** `index.html` — login footer legal links, new `#legalConsentScreen` overlay, new "Yasal Sayfa Bağlantıları" section in `#adminAccountScreen`.
- **Modify** `app.js` — `ui.legalLinks` cache, `openLegalConsentScreen`/`closeLegalConsentScreen`/`bindLegalConsentScreen`, boot-flow integration (`bindLoginForm`, `DOMContentLoaded`), login-footer link population, admin account screen legal-link inputs (`openAdminAccountScreen`/`bindAdminAccountScreen`).

---

### Task 1: `user_consents` migration

**Files:**
- Create: `backend/database/migration_user_consents.sql`

- [ ] **Step 1: Write the migration file**

```sql
-- KVKK / Gizlilik Politikası onay kayıtları (audit trail)
-- Çalıştırma: cd backend && npm run migrate:run -- migration_user_consents.sql

CREATE TABLE IF NOT EXISTS user_consents (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  consent_version VARCHAR(20) NOT NULL,
  accepted_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ip_address VARCHAR(64)
);

CREATE INDEX IF NOT EXISTS idx_user_consents_user_version
  ON user_consents (user_id, consent_version);

COMMENT ON TABLE user_consents IS 'KVKK / Gizlilik Politikası onay kayıtları (audit trail, üzerine yazılmaz)';
```

- [ ] **Step 2: Run the migration**

Run: `cd backend && npm run migrate:run -- migration_user_consents.sql`
Expected: success output (table created, no errors). If the table already exists from a prior run, `CREATE TABLE IF NOT EXISTS` makes this a no-op.

- [ ] **Step 3: Verify the table exists**

Run: `cd backend && node -e "import('./config/database.js').then(m => m.default.query(\"SELECT column_name, data_type FROM information_schema.columns WHERE table_name='user_consents'\")).then(r => { console.log(r.rows); process.exit(0); })"`
Expected: prints 5 rows for columns `id`, `user_id`, `consent_version`, `accepted_at`, `ip_address`.

- [ ] **Step 4: Commit**

```bash
git add backend/database/migration_user_consents.sql
git commit -m "feat: add user_consents audit table migration for KVKK onay akışı"
```

---

### Task 2: `backend/utils/legalConsent.js`

**Files:**
- Create: `backend/utils/legalConsent.js`

- [ ] **Step 1: Write the util file**

```js
import db from '../config/database.js';

export const CONSENT_VERSION = '2026-06-14';

export const DEFAULT_LEGAL_LINKS = {
  privacyPolicyUrl: 'https://fizyopark.com.tr/privacy-policy',
  explicitConsentUrl: 'https://fizyopark.com.tr/explicit-consent-text',
  termsOfUseUrl: 'https://fizyopark.com.tr/membership-and-terms-of-use',
  cookiePolicyUrl: 'https://fizyopark.com.tr/cookie-policy',
};

const LEGAL_LINK_KEYS = {
  privacyPolicyUrl: 'legal_privacy_policy_url',
  explicitConsentUrl: 'legal_explicit_consent_url',
  termsOfUseUrl: 'legal_terms_of_use_url',
  cookiePolicyUrl: 'legal_cookie_policy_url',
};

export async function getLegalLinks() {
  const keys = Object.values(LEGAL_LINK_KEYS);
  let stored = {};
  try {
    const result = await db.query('SELECT key, value FROM app_settings WHERE key = ANY($1)', [keys]);
    result.rows.forEach((row) => {
      stored[row.key] = row.value;
    });
  } catch (err) {
    if (err.code !== '42P01') throw err;
  }
  const links = {};
  for (const [field, key] of Object.entries(LEGAL_LINK_KEYS)) {
    const value = stored[key];
    links[field] = (value != null && String(value).trim()) ? String(value).trim() : DEFAULT_LEGAL_LINKS[field];
  }
  return links;
}

export async function setLegalLinks(input) {
  const updates = [];
  for (const field of Object.keys(LEGAL_LINK_KEYS)) {
    if (!(field in input)) continue;
    const key = LEGAL_LINK_KEYS[field];
    const raw = input[field];
    const value = (raw != null && String(raw).trim()) ? String(raw).trim() : null;
    updates.push(
      db.query(
        `INSERT INTO app_settings (key, value, updated_at) VALUES ($1, $2, CURRENT_TIMESTAMP)
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = CURRENT_TIMESTAMP`,
        [key, value]
      )
    );
  }
  await Promise.all(updates);
  return getLegalLinks();
}

export async function getConsentStatus(userId) {
  const result = await db.query(
    'SELECT 1 FROM user_consents WHERE user_id = $1 AND consent_version = $2',
    [userId, CONSENT_VERSION]
  );
  return { consentRequired: result.rows.length === 0, consentVersion: CONSENT_VERSION };
}

export async function recordConsent(userId, ipAddress) {
  await db.query(
    'INSERT INTO user_consents (user_id, consent_version, ip_address) VALUES ($1, $2, $3)',
    [userId, CONSENT_VERSION, ipAddress || null]
  );
}
```

- [ ] **Step 2: Verify it loads and returns defaults**

Run: `cd backend && node -e "import('./utils/legalConsent.js').then(async m => { console.log(await m.getLegalLinks()); console.log(await m.getConsentStatus(1)); process.exit(0); })"`
Expected: prints the 4 `DEFAULT_LEGAL_LINKS` URLs (no `app_settings` rows yet) and `{ consentRequired: true, consentVersion: '2026-06-14' }` for user id 1 (assuming user 1 hasn't consented yet).

- [ ] **Step 3: Commit**

```bash
git add backend/utils/legalConsent.js
git commit -m "feat: add legalConsent util for KVKK consent status and admin-editable legal links"
```

---

### Task 3: `auth.js` — consent status in `/login` and `/me`

**Files:**
- Modify: `backend/routes/auth.js:1-9` (imports), `:118-121` (`/login` response), `:145` (`/me` response)

- [ ] **Step 1: Add the import**

In `backend/routes/auth.js`, change line 7 from:

```js
import { getInstitutionWhatsApp, setInstitutionWhatsApp } from '../utils/appSettings.js';
```

to:

```js
import { getInstitutionWhatsApp, setInstitutionWhatsApp } from '../utils/appSettings.js';
import { CONSENT_VERSION, getConsentStatus, getLegalLinks, setLegalLinks, recordConsent } from '../utils/legalConsent.js';
```

- [ ] **Step 2: Spread consent status into `/login` response**

Change (around line 118-121):

```js
    res.json({
      token,
      user: buildUserProfile(user)
    });
```

to:

```js
    res.json({
      token,
      user: {
        ...buildUserProfile(user),
        ...(await getConsentStatus(user.id)),
      },
    });
```

- [ ] **Step 3: Spread consent status into `/me` response**

Change (line 145):

```js
    res.json(buildUserProfile(result.rows[0]));
```

to:

```js
    res.json({
      ...buildUserProfile(result.rows[0]),
      ...(await getConsentStatus(req.user.userId)),
    });
```

- [ ] **Step 4: Verify via curl**

Start the backend: `cd backend && npm run dev`

In another terminal:
```bash
curl -s -X POST http://localhost:3000/api/auth/login -H "Content-Type: application/json" -d '{"email":"admin@local","password":"admin123"}'
```
Expected: JSON response where `user` includes `"consentRequired":true,"consentVersion":"2026-06-14"` (true because `user_consents` is empty so far).

```bash
TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/login -H "Content-Type: application/json" -d '{"email":"admin@local","password":"admin123"}' | node -pe "JSON.parse(require('fs').readFileSync(0,'utf8')).token")
curl -s http://localhost:3000/api/auth/me -H "Authorization: Bearer $TOKEN"
```
Expected: `consentRequired:true, consentVersion:"2026-06-14"` also present on `/me`.

- [ ] **Step 5: Commit**

```bash
git add backend/routes/auth.js
git commit -m "feat: expose KVKK consent status on /auth/login and /auth/me"
```

---

### Task 4: `auth.js` — `POST /consent` and `GET /legal-links`

**Files:**
- Modify: `backend/routes/auth.js` (insert new routes after the `/me` route, i.e. after line 150)

- [ ] **Step 1: Add the two new routes**

In `backend/routes/auth.js`, immediately after the closing of the `/me` route (after line 150, before the `// İlk girişte şifre belirleme` comment on line 152), insert:

```js
// KVKK onayını kaydet
router.post('/consent', verifyToken, async (req, res) => {
  try {
    const ip = req.ip || (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || null;
    await recordConsent(req.user.userId, ip);
    await activityLog(req, {
      action: 'auth.consent_accept',
      entityType: 'user',
      entityId: req.user.userId,
      actorId: req.user.userId,
      actorType: 'user',
      details: { consentVersion: CONSENT_VERSION },
    }).catch(() => {});
    res.json({ consentRequired: false, consentVersion: CONSENT_VERSION });
  } catch (error) {
    console.error('Consent accept error:', error);
    res.status(500).json({ error: 'Onayınız kaydedilemedi' });
  }
});

// Yasal sayfa bağlantıları (herkese açık — onay ekranı ve giriş sayfası için)
router.get('/legal-links', async (req, res) => {
  try {
    const links = await getLegalLinks();
    res.json(links);
  } catch (error) {
    console.error('Legal links get error:', error);
    res.status(500).json({ error: 'Bağlantılar alınırken hata oluştu' });
  }
});
```

- [ ] **Step 2: Verify `GET /legal-links` (public, no token)**

Run: `curl -s http://localhost:3000/api/auth/legal-links`
Expected:
```json
{"privacyPolicyUrl":"https://fizyopark.com.tr/privacy-policy","explicitConsentUrl":"https://fizyopark.com.tr/explicit-consent-text","termsOfUseUrl":"https://fizyopark.com.tr/membership-and-terms-of-use","cookiePolicyUrl":"https://fizyopark.com.tr/cookie-policy"}
```

- [ ] **Step 3: Verify `POST /consent` and that it flips `consentRequired`**

```bash
TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/login -H "Content-Type: application/json" -d '{"email":"admin@local","password":"admin123"}' | node -pe "JSON.parse(require('fs').readFileSync(0,'utf8')).token")
curl -s -X POST http://localhost:3000/api/auth/consent -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{}'
curl -s http://localhost:3000/api/auth/me -H "Authorization: Bearer $TOKEN"
```
Expected: `POST /consent` returns `{"consentRequired":false,"consentVersion":"2026-06-14"}`; the subsequent `/me` call now also shows `"consentRequired":false`.

- [ ] **Step 4: Commit**

```bash
git add backend/routes/auth.js
git commit -m "feat: add POST /auth/consent and public GET /auth/legal-links endpoints"
```

---

### Task 5: `auth.js` — `/account` legal-links editing + consent status

**Files:**
- Modify: `backend/routes/auth.js:250-401` (`PUT /account`)

- [ ] **Step 1: Add `legalLinks` validator**

Change the validator array (around line 250-258) from:

```js
router.put('/account', verifyToken, [
  body('fullName').optional().trim().isLength({ min: 1, max: 100 }).withMessage('Ad soyad gerekli'),
  body('email').optional().trim().isEmail().withMessage('Geçerli e-posta girin'),
  body('phone').optional({ nullable: true }).isString(),
  body('whatsapp').optional({ nullable: true }).isString(),
  body('currentPassword').optional().isString(),
  body('newPassword').optional().isLength({ min: 4 }).withMessage('Yeni şifre en az 4 karakter olmalı'),
  body('confirmPassword').optional().isString(),
], async (req, res) => {
```

to:

```js
router.put('/account', verifyToken, [
  body('fullName').optional().trim().isLength({ min: 1, max: 100 }).withMessage('Ad soyad gerekli'),
  body('email').optional().trim().isEmail().withMessage('Geçerli e-posta girin'),
  body('phone').optional({ nullable: true }).isString(),
  body('whatsapp').optional({ nullable: true }).isString(),
  body('legalLinks').optional().isObject(),
  body('currentPassword').optional().isString(),
  body('newPassword').optional().isLength({ min: 4 }).withMessage('Yeni şifre en az 4 karakter olmalı'),
  body('confirmPassword').optional().isString(),
], async (req, res) => {
```

- [ ] **Step 2: Destructure `legalLinks` from the body**

Change (around line 266-274):

```js
    const {
      fullName,
      email,
      phone,
      whatsapp,
      currentPassword,
      newPassword,
      confirmPassword,
    } = req.body || {};
```

to:

```js
    const {
      fullName,
      email,
      phone,
      whatsapp,
      legalLinks,
      currentPassword,
      newPassword,
      confirmPassword,
    } = req.body || {};
```

- [ ] **Step 3: Handle `legalLinks` (admin/manager only), right after the `whatsapp` block**

After the closing `}` of the `whatsapp` block (ends around line 359, right before `const profileRes = await db.query(`), insert:

```js
    if (legalLinks !== undefined && legalLinks && typeof legalLinks === 'object' && (user.role === 'admin' || user.role === 'manager')) {
      await setLegalLinks(legalLinks);
    }

```

- [ ] **Step 4: Spread consent status into the returned profile**

Change (line 373):

```js
    const profile = buildUserProfile(profileRes.rows[0]);
```

to:

```js
    const profile = {
      ...buildUserProfile(profileRes.rows[0]),
      ...(await getConsentStatus(user.id)),
    };
```

- [ ] **Step 5: Return current legal links for admin/manager**

Change (around line 374-377):

```js
    let institutionWhatsapp = '';
    if (user.role === 'admin' || user.role === 'manager') {
      institutionWhatsapp = (await getInstitutionWhatsApp()) || '';
    }
```

to:

```js
    let institutionWhatsapp = '';
    let legalLinksOut;
    if (user.role === 'admin' || user.role === 'manager') {
      institutionWhatsapp = (await getInstitutionWhatsApp()) || '';
      legalLinksOut = await getLegalLinks();
    }
```

- [ ] **Step 6: Log `legalLinksChanged` and include `legalLinks` in the response**

Change (around line 379-396):

```js
    await activityLog(req, {
      action: 'auth.account_update',
      entityType: 'user',
      entityId: user.id,
      actorId: user.id,
      actorType: 'user',
      details: {
        emailChanged: email != null,
        passwordChanged: !!(newPassword && String(newPassword).trim()),
        whatsappChanged: whatsapp !== undefined,
      },
    }).catch(() => {});

    res.json({
      message: 'Bilgileriniz güncellendi',
      user: profile,
      institutionWhatsapp,
    });
```

to:

```js
    await activityLog(req, {
      action: 'auth.account_update',
      entityType: 'user',
      entityId: user.id,
      actorId: user.id,
      actorType: 'user',
      details: {
        emailChanged: email != null,
        passwordChanged: !!(newPassword && String(newPassword).trim()),
        whatsappChanged: whatsapp !== undefined,
        legalLinksChanged: legalLinks !== undefined,
      },
    }).catch(() => {});

    res.json({
      message: 'Bilgileriniz güncellendi',
      user: profile,
      institutionWhatsapp,
      ...(legalLinksOut ? { legalLinks: legalLinksOut } : {}),
    });
```

- [ ] **Step 7: Verify via curl — admin can override and reset a link**

```bash
TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/login -H "Content-Type: application/json" -d '{"email":"admin@local","password":"admin123"}' | node -pe "JSON.parse(require('fs').readFileSync(0,'utf8')).token")

# Override the cookie policy URL
curl -s -X PUT http://localhost:3000/api/auth/account -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"fullName":"Admin","email":"admin@local","legalLinks":{"cookiePolicyUrl":"https://fizyopark.com.tr/cookie-policy-v2"}}'
curl -s http://localhost:3000/api/auth/legal-links
```
Expected: account-update response includes `legalLinks.cookiePolicyUrl` = `"https://fizyopark.com.tr/cookie-policy-v2"`; `GET /legal-links` reflects the override for `cookiePolicyUrl` while the other 3 URLs stay at their defaults.

```bash
# Reset back to default by sending empty string
curl -s -X PUT http://localhost:3000/api/auth/account -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"fullName":"Admin","email":"admin@local","legalLinks":{"cookiePolicyUrl":""}}'
curl -s http://localhost:3000/api/auth/legal-links
```
Expected: `cookiePolicyUrl` back to `"https://fizyopark.com.tr/cookie-policy"` (the `DEFAULT_LEGAL_LINKS` fallback).

- [ ] **Step 8: Verify non-admin cannot change legal links**

Log in as a `staff` or `member` user (use any existing staff/member credentials in the dev DB), then:
```bash
curl -s -X PUT http://localhost:3000/api/auth/account -H "Authorization: Bearer $STAFF_TOKEN" -H "Content-Type: application/json" \
  -d '{"fullName":"Test","email":"<existing-staff-email>","legalLinks":{"cookiePolicyUrl":"https://evil.example/"}}'
curl -s http://localhost:3000/api/auth/legal-links
```
Expected: request succeeds (other fields update normally) but `legal-links` is unchanged — no `legalLinks` key in the response, and `GET /legal-links` still shows the default `cookiePolicyUrl`.

- [ ] **Step 9: Commit**

```bash
git add backend/routes/auth.js
git commit -m "feat: allow admin/manager to edit legal page URLs via PUT /auth/account"
```

---

### Task 6: `api.js` — `acceptConsent()` and `getLegalLinks()`

**Files:**
- Modify: `api.js:191-209` (near `setPassword`/`updateAccountProfile`), `:818-888` (`window.API`)

- [ ] **Step 1: Add the two functions**

In `api.js`, immediately after `updateAccountProfile` (after line 209, the closing `}` of that function), insert:

```js

  async function acceptConsent() {
    return apiFetch('/auth/consent', {
      method: 'POST',
      body: JSON.stringify({}),
    });
  }

  async function getLegalLinks() {
    return apiFetch('/auth/legal-links');
  }
```

- [ ] **Step 2: Register on `window.API`**

In the `window.API = { ... }` object, change:

```js
    setPassword,
    changePassword,
    updateAccountProfile,
```

to:

```js
    setPassword,
    changePassword,
    updateAccountProfile,
    acceptConsent,
    getLegalLinks,
```

- [ ] **Step 3: Verify in the browser console**

Open the app in a browser, log in, open devtools console, run:
```js
await window.API.getLegalLinks()
```
Expected: returns the 4-URL object (same as the curl check in Task 4).

- [ ] **Step 4: Commit**

```bash
git add api.js
git commit -m "feat: add acceptConsent() and getLegalLinks() API client functions"
```

---

### Task 7: `styles.css` — consent screen and login footer styles

**Files:**
- Modify: `styles.css` (insert after the `.pw-change` block, after line 5236)

- [ ] **Step 1: Add new CSS rules**

In `styles.css`, immediately after the closing `}` of the `@media (min-width: 640px){ .pw-change__scroll{...} }` block (after line 5236), insert:

```css

.login-legal-links{
  display:flex;
  flex-wrap:wrap;
  justify-content:center;
  gap:6px 14px;
  margin-top:12px;
}
.login-legal-links a{
  font-size:12px;
  color:#8ec5ff;
  text-decoration:underline;
}
.pw-change__link-list{
  list-style:none;
  margin:0 0 16px;
  padding:0;
  display:flex;
  flex-direction:column;
  gap:8px;
}
.pw-change__link-list a{
  font-size:14px;
  font-weight:700;
  color:#6b9fff;
  text-decoration:underline;
}
.pw-change__checkbox-field{
  display:flex;
  align-items:flex-start;
  gap:10px;
  cursor:pointer;
}
.pw-change__checkbox-field input[type="checkbox"]{
  flex:0 0 auto;
  margin-top:3px;
  width:18px;
  height:18px;
}
.pw-change__checkbox-field span{
  font-size:13px;
  line-height:1.5;
  color:var(--text);
}
```

- [ ] **Step 2: Commit**

```bash
git add styles.css
git commit -m "feat: add styles for KVKK consent screen and login footer legal links"
```

---

### Task 8: `index.html` — login footer legal links

**Files:**
- Modify: `index.html:112-113`

- [ ] **Step 1: Add the 4-link footer block**

Change (lines 112-113):

```html
        <p class="login-footer">Admin: <code>admin@local</code> / <code>admin123</code><br/>Personel / Üye: kayıtlı e-posta + şifre (telefon son 4 hane)</p>
      </div>
```

to:

```html
        <p class="login-footer">Admin: <code>admin@local</code> / <code>admin123</code><br/>Personel / Üye: kayıtlı e-posta + şifre (telefon son 4 hane)</p>
        <div class="login-legal-links" id="loginLegalLinks">
          <a id="loginFooterLinkPrivacy" href="https://fizyopark.com.tr/privacy-policy" target="_blank" rel="noopener">Gizlilik Politikası</a>
          <a id="loginFooterLinkExplicitConsent" href="https://fizyopark.com.tr/explicit-consent-text" target="_blank" rel="noopener">Açık Rıza Metni</a>
          <a id="loginFooterLinkTerms" href="https://fizyopark.com.tr/membership-and-terms-of-use" target="_blank" rel="noopener">Üyelik ve Kullanım Koşulları</a>
          <a id="loginFooterLinkCookie" href="https://fizyopark.com.tr/cookie-policy" target="_blank" rel="noopener">Çerez Politikası</a>
        </div>
      </div>
```

(The hardcoded `href` values are the defaults; Task 13 makes `app.js` overwrite them from `GET /auth/legal-links` once the page loads, so admin overrides take effect without an HTML edit.)

- [ ] **Step 2: Commit**

```bash
git add index.html
git commit -m "feat: add legal page links to login screen footer"
```

---

### Task 9: `index.html` — `#legalConsentScreen` overlay

**Files:**
- Modify: `index.html` (insert after `#passwordChangeScreen`, after line 191, before `#adminAccountScreen` on line 193)

- [ ] **Step 1: Insert the new overlay markup**

In `index.html`, immediately after the closing `</div>` of `#passwordChangeScreen` (after line 191) and before the `<!-- Admin – Hesap bilgileri güncelleme -->` comment (line 193), insert:

```html

    <!-- KVKK / Gizlilik onay ekranı (tüm roller, giriş/boot sonrası gösterilir) -->
    <div id="legalConsentScreen" class="pw-change hidden" aria-hidden="true" role="dialog" aria-modal="true" aria-labelledby="legalConsentHeaderTitle">
      <header class="pw-change__header">
        <span class="pw-change__header-spacer" aria-hidden="true"></span>
        <h1 id="legalConsentHeaderTitle" class="pw-change__header-title">Gizlilik ve Kişisel Verilerin Korunması</h1>
        <span class="pw-change__header-spacer" aria-hidden="true"></span>
      </header>
      <div class="pw-change__scroll">
        <div class="pw-change__hero">
          <div class="pw-change__hero-icon" aria-hidden="true">
            <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75">
              <path d="M12 2 4 5v6c0 5 3.5 9 8 11 4.5-2 8-6 8-11V5l-8-3z"/>
              <path d="M9 12l2 2 4-4"/>
            </svg>
          </div>
          <p class="pw-change__hero-title">Verilerinizin Korunması</p>
        </div>
        <div class="pw-change__info" role="note">
          <span class="pw-change__info-icon" aria-hidden="true">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>
          </span>
          <p class="pw-change__info-text">FizyoPark olarak kişisel verilerinizi (ad soyad, iletişim bilgileri, üyelik/seans kayıtları, QR kod ile tesis giriş kayıtları, cihaz ve IP bilgileri) yalnızca hizmetlerimizin yürütülmesi, seans planlaması, tesis güvenliği ve yasal yükümlülüklerimiz kapsamında işliyoruz. Devam etmeden önce lütfen aşağıdaki metinleri inceleyin.</p>
        </div>
        <form id="legalConsentForm" class="pw-change__form-card" novalidate>
          <ul class="pw-change__link-list">
            <li><a id="legalConsentLinkPrivacy" href="https://fizyopark.com.tr/privacy-policy" target="_blank" rel="noopener">Gizlilik Politikası</a></li>
            <li><a id="legalConsentLinkExplicitConsent" href="https://fizyopark.com.tr/explicit-consent-text" target="_blank" rel="noopener">Açık Rıza Metni</a></li>
            <li><a id="legalConsentLinkTerms" href="https://fizyopark.com.tr/membership-and-terms-of-use" target="_blank" rel="noopener">Üyelik ve Kullanım Koşulları</a></li>
            <li><a id="legalConsentLinkCookie" href="https://fizyopark.com.tr/cookie-policy" target="_blank" rel="noopener">Çerez Politikası</a></li>
          </ul>
          <label class="pw-change__checkbox-field" for="legalConsentCheckbox">
            <input type="checkbox" id="legalConsentCheckbox" required />
            <span>Yukarıdaki Gizlilik Politikası, Açık Rıza Metni, Üyelik ve Kullanım Koşulları ve Çerez Politikası'nı okudum, anladım ve kişisel verilerimin belirtilen amaçlarla işlenmesine açık rıza veriyorum.</span>
          </label>
          <p id="legalConsentError" class="pw-change__error error hidden"></p>
          <button id="legalConsentSubmitBtn" class="pw-change__submit" type="submit">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>
            <span>Kabul Ediyorum ve Devam Et</span>
          </button>
        </form>
      </div>
    </div>
```

- [ ] **Step 2: Commit**

```bash
git add index.html
git commit -m "feat: add #legalConsentScreen overlay markup"
```

---

### Task 10: `index.html` — admin "Yasal Sayfa Bağlantıları" section

**Files:**
- Modify: `index.html:216-221` (`#adminAccountScreen`)

- [ ] **Step 1: Insert the new section between the WhatsApp field and the password section**

Change (lines 216-221):

```html
          <div id="adminAccountWhatsappWrap" class="pw-change__field hidden">
            <label class="pw-change__label" for="adminAccountWhatsapp">Kurum WhatsApp Numarası</label>
            <input id="adminAccountWhatsapp" class="pw-change__input admin-account-form__plain" type="tel" inputmode="tel" autocomplete="off" placeholder="905551234567" />
            <p class="hint admin-account-form__hint">Üye seans iptali sonrası yeni randevu talebinde açılır.</p>
          </div>
          <h2 class="admin-account-form__section-title">Şifre (isteğe bağlı)</h2>
```

to:

```html
          <div id="adminAccountWhatsappWrap" class="pw-change__field hidden">
            <label class="pw-change__label" for="adminAccountWhatsapp">Kurum WhatsApp Numarası</label>
            <input id="adminAccountWhatsapp" class="pw-change__input admin-account-form__plain" type="tel" inputmode="tel" autocomplete="off" placeholder="905551234567" />
            <p class="hint admin-account-form__hint">Üye seans iptali sonrası yeni randevu talebinde açılır.</p>
          </div>
          <div id="adminAccountLegalLinksWrap" class="hidden">
            <h2 class="admin-account-form__section-title">Yasal Sayfa Bağlantıları</h2>
            <div class="pw-change__field">
              <label class="pw-change__label" for="adminAccountPrivacyPolicyUrl">Gizlilik Politikası URL</label>
              <input id="adminAccountPrivacyPolicyUrl" class="pw-change__input admin-account-form__plain" type="url" autocomplete="off" placeholder="https://fizyopark.com.tr/privacy-policy" />
            </div>
            <div class="pw-change__field">
              <label class="pw-change__label" for="adminAccountExplicitConsentUrl">Açık Rıza Metni URL</label>
              <input id="adminAccountExplicitConsentUrl" class="pw-change__input admin-account-form__plain" type="url" autocomplete="off" placeholder="https://fizyopark.com.tr/explicit-consent-text" />
            </div>
            <div class="pw-change__field">
              <label class="pw-change__label" for="adminAccountTermsUrl">Üyelik ve Kullanım Koşulları URL</label>
              <input id="adminAccountTermsUrl" class="pw-change__input admin-account-form__plain" type="url" autocomplete="off" placeholder="https://fizyopark.com.tr/membership-and-terms-of-use" />
            </div>
            <div class="pw-change__field">
              <label class="pw-change__label" for="adminAccountCookiePolicyUrl">Çerez Politikası URL</label>
              <input id="adminAccountCookiePolicyUrl" class="pw-change__input admin-account-form__plain" type="url" autocomplete="off" placeholder="https://fizyopark.com.tr/cookie-policy" />
              <p class="hint admin-account-form__hint">Boş bırakılırsa varsayılan adres kullanılır.</p>
            </div>
          </div>
          <h2 class="admin-account-form__section-title">Şifre (isteğe bağlı)</h2>
```

- [ ] **Step 2: Commit**

```bash
git add index.html
git commit -m "feat: add legal page URL inputs to admin account screen"
```

---

### Task 11: `app.js` — open/close/bind `#legalConsentScreen`

**Files:**
- Modify: `app.js:748-776` (`ui` object), insert new functions near `bindPasswordChangeScreen` (after line 6619)

- [ ] **Step 1: Add `legalLinks` cache to `ui`**

Change (line 761-762):

```js
  currentUser: null, // { role, username, ... } – giriş yapan kullanıcı
  memberPortal: null, // üye girişi: dashboard verisi
```

to:

```js
  currentUser: null, // { role, username, ... } – giriş yapan kullanıcı
  legalLinks: null, // KVKK / yasal sayfa URL'leri (GET /auth/legal-links sonucu)
  memberPortal: null, // üye girişi: dashboard verisi
```

- [ ] **Step 2: Add the open/close/bind functions**

In `app.js`, immediately after the closing `}` of `bindPasswordChangeScreen()` (after line 6619), insert:

```js

function openLegalConsentScreen(onAccepted) {
  var screen = document.getElementById("legalConsentScreen");
  if (!screen) {
    if (typeof onAccepted === "function") onAccepted();
    return;
  }

  bindLegalConsentScreen(onAccepted);
  applyLegalLinksToDom();

  var form = document.getElementById("legalConsentForm");
  var checkbox = document.getElementById("legalConsentCheckbox");
  var errEl = document.getElementById("legalConsentError");
  if (form) form.reset();
  if (checkbox) checkbox.checked = false;
  if (errEl) {
    errEl.classList.add("hidden");
    errEl.textContent = "";
  }

  screen.classList.remove("hidden");
  screen.setAttribute("aria-hidden", "false");

  var main = document.getElementById("mainApp");
  if (main) main.style.visibility = "hidden";
}

function closeLegalConsentScreen() {
  var screen = document.getElementById("legalConsentScreen");
  if (screen) {
    screen.classList.add("hidden");
    screen.setAttribute("aria-hidden", "true");
  }
  var main = document.getElementById("mainApp");
  if (main) main.style.visibility = "";
}

function bindLegalConsentScreen(onAccepted) {
  var form = document.getElementById("legalConsentForm");
  var errEl = document.getElementById("legalConsentError");
  var checkbox = document.getElementById("legalConsentCheckbox");
  var submitBtn = document.getElementById("legalConsentSubmitBtn");
  if (!form || !window.API) return;

  form.onsubmit = async function (ev) {
    ev.preventDefault();
    if (errEl) {
      errEl.classList.add("hidden");
      errEl.textContent = "";
    }
    if (!checkbox || !checkbox.checked) {
      if (errEl) {
        errEl.textContent = "Devam etmek için onay kutusunu işaretleyin.";
        errEl.classList.remove("hidden");
      }
      return;
    }
    if (submitBtn) submitBtn.disabled = true;
    try {
      await window.API.acceptConsent();
      closeLegalConsentScreen();
      if (typeof onAccepted === "function") onAccepted();
    } catch (e) {
      if (errEl) {
        errEl.textContent = "Onayınız kaydedilemedi. Lütfen internet bağlantınızı kontrol edip tekrar deneyin.";
        errEl.classList.remove("hidden");
      }
    } finally {
      if (submitBtn) submitBtn.disabled = false;
    }
  };
}

function applyLegalLinksToDom() {
  var links = ui.legalLinks || {};
  var map = {
    legalConsentLinkPrivacy: links.privacyPolicyUrl,
    legalConsentLinkExplicitConsent: links.explicitConsentUrl,
    legalConsentLinkTerms: links.termsOfUseUrl,
    legalConsentLinkCookie: links.cookiePolicyUrl,
    loginFooterLinkPrivacy: links.privacyPolicyUrl,
    loginFooterLinkExplicitConsent: links.explicitConsentUrl,
    loginFooterLinkTerms: links.termsOfUseUrl,
    loginFooterLinkCookie: links.cookiePolicyUrl,
  };
  Object.keys(map).forEach(function (id) {
    var url = map[id];
    if (!url) return;
    var el = document.getElementById(id);
    if (el) el.setAttribute("href", url);
  });
}

async function loadLegalLinks() {
  if (!window.API || !window.API.getLegalLinks) return;
  try {
    var links = await window.API.getLegalLinks();
    if (links) {
      ui.legalLinks = links;
      applyLegalLinksToDom();
    }
  } catch (e) {
    /* ağ hatası: varsayılan href'ler (HTML'deki) kullanılır */
  }
}
```

- [ ] **Step 3: Verify functions are defined**

Run: `node -e "const fs=require('fs'); const src=fs.readFileSync('app.js','utf8'); ['openLegalConsentScreen','closeLegalConsentScreen','bindLegalConsentScreen','applyLegalLinksToDom','loadLegalLinks'].forEach(n => console.log(n, src.includes('function '+n)))"`
Expected: prints `true` for all 5 names.

- [ ] **Step 4: Commit**

```bash
git add app.js
git commit -m "feat: add legal consent screen open/close/bind helpers and legal link cache"
```

---

### Task 12: `app.js` — boot-flow integration (consent gate before password-change gate)

**Files:**
- Modify: `app.js:11397-11428` (`bindLoginForm`), `:11549-11613` (`DOMContentLoaded`)

- [ ] **Step 1: Gate the post-login flow on `consentRequired` in `bindLoginForm`**

Change (around line 11407-11420):

```js
    try {
      const data = await window.API.login(email, p);
      if (data.user && data.user.role) {
        try {
          sessionStorage.setItem(LAST_ROLE_KEY, data.user.role);
        } catch (_) {}
        ui.currentUser = { role: data.user.role };
      }
      hideLoginOverlay();
      if (data.user && data.user.mustChangePassword) {
        showChangePasswordOverlay();
      } else {
        location.reload();
      }
    } catch (e) {
```

to:

```js
    try {
      const data = await window.API.login(email, p);
      if (data.user && data.user.role) {
        try {
          sessionStorage.setItem(LAST_ROLE_KEY, data.user.role);
        } catch (_) {}
        ui.currentUser = { role: data.user.role };
      }
      hideLoginOverlay();
      const proceedAfterConsent = function () {
        if (data.user && data.user.mustChangePassword) {
          showChangePasswordOverlay();
        } else {
          location.reload();
        }
      };
      if (data.user && data.user.consentRequired) {
        await loadLegalLinks();
        openLegalConsentScreen(proceedAfterConsent);
      } else {
        proceedAfterConsent();
      }
    } catch (e) {
```

- [ ] **Step 2: Gate the boot flow (page reload with existing token) on `consentRequired`**

Change (around line 11564-11572):

```js
    var me = await meP;
    ui.currentUser = me || null;
    updateSidebarForRole();

    if (me && me.mustChangePassword) {
      setAppBooting(false);
      queueAfterSplash(showChangePasswordOverlay);
      return;
    }
```

to:

```js
    var me = await meP;
    ui.currentUser = me || null;
    updateSidebarForRole();

    if (me && me.consentRequired) {
      setAppBooting(false);
      await loadLegalLinks();
      queueAfterSplash(function () {
        openLegalConsentScreen(function () {
          if (me.mustChangePassword) {
            showChangePasswordOverlay();
          } else {
            location.reload();
          }
        });
      });
      return;
    }

    if (me && me.mustChangePassword) {
      setAppBooting(false);
      queueAfterSplash(showChangePasswordOverlay);
      return;
    }
```

- [ ] **Step 3: Manual verification — new user / existing user / version bump (spec scenarios 1-3)**

1. **New user (first login):** create or use a user with `must_change_password = true` and no `user_consents` row. Log in. Expected: `#legalConsentScreen` appears first (full-screen, checkbox required). After checking the box and submitting, the "Şifrenizi Belirleyin" (initial password) screen appears. After setting the password, the app loads normally.
2. **Existing user, already consented at current version:** log in as a user who already has a `user_consents` row with `consent_version = '2026-06-14'`. Expected: no consent screen, app loads directly (or password-change screen if `mustChangePassword` is true).
3. **Version bump re-prompt:** temporarily change `CONSENT_VERSION` in `backend/utils/legalConsent.js` to `'2099-01-01'`, restart the backend, and reload the app as a user who consented at `'2026-06-14'`. Expected: consent screen reappears (because `getConsentStatus` finds no row for the new version). Revert `CONSENT_VERSION` back to `'2026-06-14'` afterward.

- [ ] **Step 4: Manual verification — checkbox gating and error handling (spec scenarios 4-5)**

4. On the consent screen, click "Kabul Ediyorum ve Devam Et" without checking the box. Expected: inline error "Devam etmek için onay kutusunu işaretleyin." appears, screen stays open.
5. Check the box, then (in devtools) go offline or stop the backend, and submit. Expected: error "Onayınız kaydedilemedi. Lütfen internet bağlantınızı kontrol edip tekrar deneyin." appears, screen stays open, submit button re-enables.

- [ ] **Step 5: Commit**

```bash
git add app.js
git commit -m "feat: gate login and boot flow behind KVKK consent screen"
```

---

### Task 13: `app.js` — populate login footer legal links on boot

**Files:**
- Modify: `app.js:11549-11556` (start of `DOMContentLoaded`)

- [ ] **Step 1: Load legal links before showing the login overlay (no-token path)**

Change (around line 11549-11556):

```js
document.addEventListener("DOMContentLoaded", async function () {
  cacheEls();
  try { localStorage.removeItem("seans_planner_v1"); } catch (_) {}

  if (!window.API || !window.API.getToken()) {
    queueAfterSplash(showLoginOverlay);
    return;
  }
```

to:

```js
document.addEventListener("DOMContentLoaded", async function () {
  cacheEls();
  try { localStorage.removeItem("seans_planner_v1"); } catch (_) {}

  if (!window.API || !window.API.getToken()) {
    loadLegalLinks();
    queueAfterSplash(showLoginOverlay);
    return;
  }
```

`loadLegalLinks()` is called without `await` here — it's a non-blocking enhancement that overwrites the footer `href`s once the request resolves; the hardcoded defaults from Task 8 work until then.

- [ ] **Step 2: Manual verification**

1. Log out (or open in a private window with no token).
2. On the login screen, the footer below the existing hint text shows 4 links: "Gizlilik Politikası", "Açık Rıza Metni", "Üyelik ve Kullanım Koşulları", "Çerez Politikası".
3. Each opens the corresponding `fizyopark.com.tr` page in a new tab.
4. In the admin account screen (Task 14), change the "Çerez Politikası URL" to a different URL, save, reload the login page, and confirm the footer's "Çerez Politikası" link now points to the new URL.

- [ ] **Step 3: Commit**

```bash
git add app.js
git commit -m "feat: populate login footer legal links from GET /auth/legal-links"
```

---

### Task 14: `app.js` — admin account screen legal-link inputs

**Files:**
- Modify: `app.js:6246-6391` (`openAdminAccountScreen`, `bindAdminAccountScreen`)

- [ ] **Step 1: Load and display current links in `openAdminAccountScreen`**

Change (around line 6270-6279):

```js
  var showWa = canManageInstitutionWhatsapp();
  if (whatsappWrap) whatsappWrap.classList.toggle("hidden", !showWa);
  if (showWa && whatsappEl && window.API && window.API.getInstitutionWhatsapp) {
    try {
      var data = await window.API.getInstitutionWhatsapp();
      whatsappEl.value = (data && data.whatsapp) || "";
    } catch (e) {
      whatsappEl.value = "";
    }
  }

  screen.classList.remove("hidden");
```

to:

```js
  var showWa = canManageInstitutionWhatsapp();
  if (whatsappWrap) whatsappWrap.classList.toggle("hidden", !showWa);
  if (showWa && whatsappEl && window.API && window.API.getInstitutionWhatsapp) {
    try {
      var data = await window.API.getInstitutionWhatsapp();
      whatsappEl.value = (data && data.whatsapp) || "";
    } catch (e) {
      whatsappEl.value = "";
    }
  }

  var legalLinksWrap = document.getElementById("adminAccountLegalLinksWrap");
  var showLegalLinks = canManageInstitutionWhatsapp();
  if (legalLinksWrap) legalLinksWrap.classList.toggle("hidden", !showLegalLinks);
  if (showLegalLinks && window.API && window.API.getLegalLinks) {
    try {
      var legalLinks = await window.API.getLegalLinks();
      var legalFieldMap = {
        adminAccountPrivacyPolicyUrl: "privacyPolicyUrl",
        adminAccountExplicitConsentUrl: "explicitConsentUrl",
        adminAccountTermsUrl: "termsOfUseUrl",
        adminAccountCookiePolicyUrl: "cookiePolicyUrl",
      };
      Object.keys(legalFieldMap).forEach(function (inputId) {
        var input = document.getElementById(inputId);
        if (input) input.value = (legalLinks && legalLinks[legalFieldMap[inputId]]) || "";
      });
    } catch (e) {
      /* yüklenemezse alanlar boş kalır, kaydetmede mevcut değerler korunur */
    }
  }

  screen.classList.remove("hidden");
```

- [ ] **Step 2: Send `legalLinks` payload on submit in `bindAdminAccountScreen`**

Change (around line 6358-6365):

```js
    var payload = {
      fullName: fullName.trim(),
      email: email.trim(),
      phone: phone.trim(),
    };
    if (canManageInstitutionWhatsapp() && whatsappEl) {
      payload.whatsapp = whatsappEl.value.trim();
    }
```

to:

```js
    var payload = {
      fullName: fullName.trim(),
      email: email.trim(),
      phone: phone.trim(),
    };
    if (canManageInstitutionWhatsapp() && whatsappEl) {
      payload.whatsapp = whatsappEl.value.trim();
    }
    if (canManageInstitutionWhatsapp()) {
      payload.legalLinks = {
        privacyPolicyUrl: (document.getElementById("adminAccountPrivacyPolicyUrl") || {}).value || "",
        explicitConsentUrl: (document.getElementById("adminAccountExplicitConsentUrl") || {}).value || "",
        termsOfUseUrl: (document.getElementById("adminAccountTermsUrl") || {}).value || "",
        cookiePolicyUrl: (document.getElementById("adminAccountCookiePolicyUrl") || {}).value || "",
      };
    }
```

- [ ] **Step 3: Refresh the cached `ui.legalLinks` after a successful save**

Change (around line 6373-6381):

```js
    if (submitBtn) submitBtn.disabled = true;
    try {
      var result = await window.API.updateAccountProfile(payload);
      if (result && result.user) {
        ui.currentUser = result.user;
        syncCurrentUserProfile();
      }
      closeAdminAccountScreen();
      fillAdminProfileModal();
      await showAppAlert((result && result.message) || "Bilgileriniz güncellendi.");
```

to:

```js
    if (submitBtn) submitBtn.disabled = true;
    try {
      var result = await window.API.updateAccountProfile(payload);
      if (result && result.user) {
        ui.currentUser = result.user;
        syncCurrentUserProfile();
      }
      if (result && result.legalLinks) {
        ui.legalLinks = result.legalLinks;
        applyLegalLinksToDom();
      }
      closeAdminAccountScreen();
      fillAdminProfileModal();
      await showAppAlert((result && result.message) || "Bilgileriniz güncellendi.");
```

- [ ] **Step 4: Manual verification — admin sees and edits links; non-admin does not (spec scenarios 6-7)**

6. Log in as admin or manager, open "Bilgileri Güncelle" (admin account screen). Expected: a new "Yasal Sayfa Bağlantıları" section with 4 URL inputs, pre-filled with the current values from `GET /auth/legal-links` (defaults if never overridden). Change one URL, save. Expected: success alert, and re-opening the screen shows the new value persisted.
7. Log in as a `staff` (non-manager) or `member` user, open the equivalent account screen. Expected: the "Yasal Sayfa Bağlantıları" section is not visible (hidden), and submitting the form does not send a `legalLinks` payload (verify via Network tab — no `legalLinks` key in the `PUT /account` request body).

- [ ] **Step 5: Commit**

```bash
git add app.js
git commit -m "feat: edit legal page URLs from the admin account screen"
```

---

## Self-Review Notes

- **Spec coverage:** `user_consents` table (Task 1), `legalConsent.js` with all required exports (Task 2), consent status on `/login`/`/me`/`/account` (Tasks 3, 5), `POST /consent` + `GET /legal-links` (Task 4), admin-editable legal links end-to-end (Tasks 5, 10, 14), consent gate before password-change gate for all roles (Task 12), login footer links (Tasks 8, 13), all 8 spec test scenarios covered (Tasks 12 steps 3-4, 14 step 4).
- **Endpoint correction applied:** all account-update edits target `PUT /account` (`/api/auth/account`) at `backend/routes/auth.js:250-401`, not `/set-password` — the inaccuracy in the design doc's "Yasal Link Yönetimi" section is corrected here.
- **Type/signature consistency:** `legalLinks` object always uses the 4 camelCase keys (`privacyPolicyUrl`, `explicitConsentUrl`, `termsOfUseUrl`, `cookiePolicyUrl`) end-to-end — `legalConsent.js` (Task 2), `auth.js` request/response (Task 5), `app.js` `applyLegalLinksToDom` map and admin form payload (Tasks 11, 14) all match.
- **No placeholders:** every step has complete code; manual verification steps use real curl commands and concrete UI actions instead of "add tests for the above".

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-06-14-kvkk-onay-akisi.md`. Two execution options:

1. **Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration
2. **Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

Which approach?
