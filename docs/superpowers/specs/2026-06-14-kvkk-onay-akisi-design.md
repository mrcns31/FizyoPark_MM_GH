# KVKK / Gizlilik Politikası Onay Akışı — Tasarım

## Problem

Üyeler, personel ve admin kullanıcıları sisteme giriş yapıp kişisel verileri
(ad soyad, telefon, e-posta, doğum tarihi, cinsiyet, profil fotoğrafı, paket
bilgileri, seans katılımı, giriş kayıtları, QR kod kullanımı, IP adresi, cihaz
bilgileri vb.) işlenirken hiçbir aşamada **Gizlilik Politikası, KVKK Aydınlatma
Metni ve Açık Rıza Metni**'ni onaylamıyor. Bu metinler
`https://fizyopark.com.tr/privacy-policy` adresinde yayında (son güncelleme
09.06.2026), ancak uygulama içinde kullanıcıdan onay alınmıyor ve audit trail
tutulmuyor.

KVKK madde 10 (aydınlatma yükümlülüğü) ve madde 12 (veri güvenliği / işleme
kayıtları) gereği, kullanıcıların bu metinleri okuduğuna ve açık rıza
verdiğine dair kayıt tutulmalı; politika metni değiştiğinde kullanıcılar
yeniden onay vermeli.

## Kapsam kararları (brainstorming sırasında onaylandı)

1. Metin içeriği uygulama içine **gömülmez** — uygulama içinden
   `https://fizyopark.com.tr/privacy-policy` sayfasına link verilir.
2. Onay ekranı **tüm rollere** gösterilir: Üye, Personel, Admin.
3. İlk girişte (yeni kullanıcı, `must_change_password = true`), onay ekranı
   **şifre belirleme ekranından önce** gösterilir.

## Veri modeli

Yeni tablo `user_consents` (migration:
`backend/database/migration_user_consents.sql`):

```sql
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

- Her onay yeni bir satır olarak eklenir — mevcut satırlar güncellenmez
  (audit trail).
- `CONSENT_VERSION` sabiti `backend/utils/legalConsent.js` içinde tanımlanır:

```js
module.exports = {
  CONSENT_VERSION: '2026-06-09', // fizyopark.com.tr/privacy-policy "son güncelleme" tarihiyle eşleşmeli
  PRIVACY_POLICY_URL: 'https://fizyopark.com.tr/privacy-policy',
};
```

  Politika metni güncellendiğinde bu tarih bump edilir → `user_consents`'ta bu
  versiyona ait satırı olmayan **tüm kullanıcılar** (mevcut dahil) bir sonraki
  girişte onay ekranını yeniden görür.

- Mevcut kullanıcılar için backfill **yapılmaz**: tablo boş başlar, bu nedenle
  yürürlüğe girdiğinde sistemde kayıtlı **tüm kullanıcılar** (admin, personel,
  üye — `must_change_password` durumlarından bağımsız) bir sonraki girişte
  onay ekranını görür. Bu, yeni zorunluluk için doğru ve istenen davranıştır.

## Backend değişiklikleri

### `backend/utils/legalConsent.js` (yeni dosya)

`CONSENT_VERSION` ve `PRIVACY_POLICY_URL` sabitlerini export eder (yukarıdaki
içerik).

### `backend/routes/auth.js`

`buildUserProfile(row)` (satır 12) senkron kalır — değiştirilmez. Onun yerine
yeni bir async helper eklenir ve üç çağrı noktasında (`/login` satır 120,
`/me` satır 145, `/set-password` satır 373) `buildUserProfile`'ın döndürdüğü
nesneye `consentRequired`/`consentVersion` alanları eklenir:

```js
async function getConsentStatus(userId) {
  const result = await db.query(
    'SELECT 1 FROM user_consents WHERE user_id = $1 AND consent_version = $2',
    [userId, CONSENT_VERSION]
  );
  return {
    consentRequired: result.rows.length === 0,
    consentVersion: CONSENT_VERSION,
  };
}
```

Kullanım (üç çağrı noktası, mevcut response şekilleri korunur):

- `POST /login` (satır 118-121):
  ```js
  res.json({ token, user: { ...buildUserProfile(user), ...(await getConsentStatus(user.id)) } });
  ```
- `GET /me` (satır 145, `buildUserProfile` doğrudan döner, `user` sarmalayıcısı yok):
  ```js
  res.json({ ...buildUserProfile(result.rows[0]), ...(await getConsentStatus(result.rows[0].id)) });
  ```
- `PUT /set-password` (satır 373, `profile` değişkeni `user` alanı altında dönüyor):
  ```js
  const profile = { ...buildUserProfile(profileRes.rows[0]), ...(await getConsentStatus(profileRes.rows[0].id)) };
  ```

**Yeni endpoint: `POST /auth/consent`** (mevcut `verifyToken` middleware ile
korumalı, tüm roller):

```js
router.post('/consent', verifyToken, async (req, res) => {
  const userId = req.user.userId;
  await db.query(
    'INSERT INTO user_consents (user_id, consent_version, ip_address) VALUES ($1, $2, $3)',
    [userId, CONSENT_VERSION, req.ip]
  );
  activityLog(req, {
    action: 'auth.consent_accept',
    entityType: 'user',
    entityId: userId,
    actorId: userId,
    actorType: req.user.role,
  });
  res.json({ consentRequired: false, consentVersion: CONSENT_VERSION });
});
```

(`req.user.userId` — `verifyToken` middleware'i JWT payload'ını `req.user`'a
koyuyor; payload `{ userId, role }` şeklinde, bkz. `generateToken` satır
37-43.)

## Frontend değişiklikleri

### `api.js`

Yeni fonksiyon `acceptConsent()` → `POST /auth/consent`, güncellenmiş
`user` nesnesini döner.

### `index.html`

Yeni tam ekran overlay `#legalConsentScreen`, `#passwordChangeScreen`
(`.pw-change` sınıfları) ile aynı yapısal kalıpta:

- `.pw-change__header` — başlık "Gizlilik ve Kişisel Verileriniz" (geri
  butonu **yok** — bu ekran atlanamaz).
- `.pw-change__scroll` içinde:
  - Hero ikon + başlık: "Verilerinizin Korunması"
  - Açıklama paragrafı: kısaca hangi veriler işleniyor ve neden onay
    gerektiği.
  - Link butonu (yeni sekmede açılır, `target="_blank" rel="noopener"`):
    "Gizlilik Politikası, KVKK Aydınlatma Metni ve Açık Rıza Metni'ni
    Görüntüle" → `PRIVACY_POLICY_URL`.
  - Checkbox + label: "Yukarıdaki metinleri okudum, anladım ve kişisel
    verilerimin belirtilen amaçlarla işlenmesine açık rıza veriyorum."
  - "Kabul Ediyorum ve Devam Et" butonu — `disabled` until checkbox checked.
  - Hata mesajı alanı `#legalConsentError` (network hatası için).

### `app.js`

- `bindLegalConsentScreen()` — checkbox değişiminde submit butonunu
  enable/disable eder; submit'te `acceptConsent()` çağırır, başarılı olursa
  `onAccepted()` callback'ini çağırır; hata olursa `#legalConsentError`'da
  gösterir ve ekranı açık tutar (kullanıcı tekrar deneyebilir).
- `openLegalConsentScreen(onAccepted)` / `closeLegalConsentScreen()` —
  `openPasswordChangeScreen`/`closePasswordChangeScreen` ile aynı görünürlük
  kalıbı (`#mainApp` gizlenir, overlay gösterilir).
- **`bindLoginForm()` submit handler** — başarılı login sonrası:
  ```js
  if (data.user.consentRequired) {
    openLegalConsentScreen(function () {
      if (data.user.mustChangePassword) {
        showChangePasswordOverlay();
      } else {
        location.reload();
      }
    });
  } else if (data.user.mustChangePassword) {
    showChangePasswordOverlay();
  } else {
    location.reload();
  }
  ```
- **`DOMContentLoaded` boot akışı** — `me = await meP` sonrası, mevcut
  `mustChangePassword` kontrolünden **önce**:
  ```js
  if (me.consentRequired) {
    setAppBooting(false);
    queueAfterSplash(function () {
      openLegalConsentScreen(function () { location.reload(); });
    });
    return;
  }
  if (me.mustChangePassword) {
    // mevcut davranış
  }
  ```
  (Mevcut oturumu olan kullanıcılar — yani sayfayı yeniden açan herkes — bu
  kontrolden geçer; bu sayede mevcut kullanıcılar da bir sonraki sayfa
  yüklemesinde onay ekranını görür.)

### Uygulama içi link ekleme

- `index.html` login ekranı footer'ına (`.login-footer` altına), gizlilik
  politikasına link eklenir: "Gizlilik Politikası ve KVKK Aydınlatma Metni"
  → `PRIVACY_POLICY_URL`, `target="_blank"`.
- Üye profil modalı ve personel/admin hesap modalında (varsa) benzer bir link
  eklenir — implementasyon planında ilgili modal dosyaları/satırları
  belirlenecek.

## Hata yönetimi

- `POST /auth/consent` network hatası → `#legalConsentError` içinde
  "Onay kaydedilemedi, lütfen tekrar deneyin." gösterilir, ekran kapanmaz,
  kullanıcı tekrar deneyebilir.
- Kullanıcı onay ekranını kapatmadan sekmeyi/uygulamayı kapatırsa, bir sonraki
  girişte `consentRequired: true` olarak tekrar gösterilir (kalıcı durum
  yoktur, DB'de satır olmadığı sürece her zaman gerekli kabul edilir).

## Test senaryoları

1. Yeni üye hesabı (`must_change_password=true`, `user_consents` kaydı yok) →
   giriş → önce onay ekranı, kabul → şifre belirleme ekranı → şifre belirle →
   uygulama açılır.
2. Mevcut admin/personel/üye (`must_change_password=false`, `user_consents`
   kaydı yok) → giriş → onay ekranı (şifre ekranı **yok**) → kabul →
   uygulama doğrudan açılır.
3. Onay verdikten sonra çıkış yapıp tekrar giriş → onay ekranı **tekrar
   gösterilmez** (güncel `CONSENT_VERSION` için kayıt mevcut).
4. `CONSENT_VERSION` bump edilir → önceden onay vermiş kullanıcı bir sonraki
   girişte/sayfa yüklemesinde onay ekranını tekrar görür.
5. Onay ekranında checkbox işaretlenmeden "Kabul Ediyorum" butonu disabled
   kalır.
6. `POST /auth/consent` 500 döndürürse ekranda hata mesajı gösterilir, ekran
   kapanmaz.

## Ek: KVKK Tavsiyeleri (kod dışı, bu plan kapsamında değil)

Sistem incelemesi sırasında belirlenen, ileride ayrı görev olarak ele
alınması önerilen maddeler:

- **Zaten karşılanıyor:**
  - "Unutulma hakkı" → mevcut hesap silme talebi akışı (MP-28/29).
  - Aktivite logları → KVKK madde 12 (işleme kayıtları) için audit trail.
  - Veri sorumlusu iletişim bilgisi → privacy-policy sayfasında mevcut.
- **İleride değerlendirilecek:**
  - Veri minimizasyonu: toplanan alanlar ile gizlilik politikasındaki liste
    senkron tutulmalı; yeni alan eklenirse politika da güncellenmeli.
  - Saklama süresi politikası: silinen/eski üyelerin verilerinin ne kadar
    süre tutulacağı netleştirilmeli.
  - 18 yaş altı üyeler için veli/vasi onayı süreci (organizasyonel).
  - Hosting sağlayıcısı ile veri işleme sözleşmesi (DPA) — CR-20/NA-01 hosting
    kararına bağlı.
  - Veri ihlali bildirim prosedürü (72 saat, organizasyonel).
  - Production HTTPS zorunluluğu — zaten CR-20-25 planında, KVKK madde 12 için
    de gerekli.
