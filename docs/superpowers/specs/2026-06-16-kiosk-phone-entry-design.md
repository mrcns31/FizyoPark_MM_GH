# Kiosk — Telefon Numarasıyla Giriş

**Tarih:** 2026-06-16  
**Kapsam:** Geçici ek özellik — QR okuyucunun yanı sıra kiosk ekranında sayısal tuş takımıyla telefon numarası girişi.

---

## Genel Bakış

Üyeler, kiosk ekranındaki "Telefon ile Giriş" butonuna dokunarak açılan sayısal tuş takımına telefon numaralarını (sıfırlı veya sıfırsız, 10 veya 11 hane) girebilirler. QR akışıyla birebir aynı sonucu üretir: kapı açılır, seans check-in kaydedilir.

---

## Backend

### `backend/utils/phone.js` — yeni export (mevcut fonksiyonlar değişmez)

```js
export function normalizePhoneFlexible(raw) {
  if (raw == null) return null;
  let digits = String(raw).replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1);
  if (digits.length !== 10) return null;
  return formatPhone(digits); // (xxx)xxx-xx-xx
}
```

Hem "5321234567" hem "05321234567" girişini `(532)123-45-67` formatına çevirir.

### `backend/utils/facilityAccess.js`

`logWalkInQrAccess(db, memberId, source = 'qr')` — opsiyonel `source` parametresi eklenir, geriye dönük uyumludur. Telefon ile girişte `'phone'` geçilir.

### `backend/routes/member-portal.js` — yeni endpoint

`POST /member-portal/verify-phone-access` — auth gerektirmez (kiosk, QR endpoint gibi).

**Akış:**
1. `{ phone }` alır → `normalizePhoneFlexible` ile normalize eder.
2. Format geçersizse → `401 { valid:false, reason:'format' }`
3. `SELECT id, name, user_id FROM members WHERE phone = $1 AND deleted_at IS NULL`
4. Bulunamazsa → `401 { valid:false, reason:'not_found' }`
5. Bulunursa → `/verify-access` ile aynı iş mantığı:
   - `checkInSessionForMember(db, memberId)` — seans check-in
   - `activityLog` (action: `'session.check_in_qr'`, checkInMethod: `'phone'`)
   - check-in yoksa → `logWalkInQrAccess(db, memberId, 'phone')`
6. Yanıt: `{ valid:true, memberId, memberName, checkIn }` — `/verify-access` ile aynı şema.

---

## Frontend

### `api.js` — yeni fonksiyon

```js
async function verifyMemberPhoneAccess(phone) {
  return apiFetch('/member-portal/verify-phone-access', {
    method: 'POST',
    body: JSON.stringify({ phone }),
  });
}
```

`window.API` nesnesi üzerinden export edilir.

### `kiosk.html` — eklenen markup

- `.kiosk-right` içinde, alt kısımda `#kioskPhoneBtn` butonu (idle durumda görünür).
- Tam ekran `#phoneOverlay` div'i (gizli; telefon numarası gösterge, 12 tuşlu pad — 1-9, 0, ⌫, ✓ — ve "Vazgeç" butonu).
- Mevcut hiçbir markup değişmez, sadece yeni elementler eklenir.

### `kiosk.js` — eklenen davranışlar

**Overlay yönetimi:**
- `#kioskPhoneBtn` → overlay açar, `phoneEntry = true` flag seti, digit buffer temizlenir.
- `#phoneCancelBtn` → overlay kapanır, `setIdle()` çağrılır.
- `blur → focusInput` döngüsü `phoneEntry` flag aktifken atlanır (overlay açıkken QR tarama arkaplanda devam eder ama refocus çakışması önlenir).

**Tuş takımı:**
- Max 11 hane girişine izin verilir.
- `#phoneConfirm` butonu 10 veya 11 hane girince aktif olur.
- Onay → `handlePhoneAccess(digits)` çağrılır:
  - Overlay kapanır, `setBusy()` çalışır.
  - `API.verifyMemberPhoneAccess(digits)` → başarılı → `setSuccess`, hata → `setFailure`.
  - `scheduleReset()` → `RESET_DELAY_MS` sonra `setIdle()`.

**INVALID_REASON_MESSAGES'e eklenen mesajlar:**
```js
not_found: 'Bu telefon numarasına kayıtlı üye bulunamadı.',
```

---

## Edge Cases

| Durum | Davranış |
|---|---|
| 11 hane, 0 ile başlar | `normalizePhoneFlexible` baştaki 0'ı atar, 10 hane olarak işler |
| 11 hane, 0 ile başlamaz | `normalizePhoneFlexible` → null → `reason:'format'` |
| 10 veya 11 hane dışı | Backend 401 + `reason:'format'` |
| Silinmiş/bulunamayan üye | Backend 401 + `reason:'not_found'` |
| QR overlay açıkken okunursa | Hidden input blur döngüsü çalışmaz; QR keydown olayı engellenmiş olur (busy flag set edilmez, overlay kapanmaz — QR scan sessizce yok sayılır) |
| Sunucu hatası | `setFailure('Bağlantı hatası, tekrar deneyin')` |

---

## Test Planı

1. 10 haneli numara (sıfırsız): üye bulunuyor, kapı açılıyor, seans check-in oluyor.
2. 11 haneli numara (0 ile başlayan): aynı sonuç.
3. 11 haneli, 0 ile başlamayan: "Geçersiz numara" hatası.
4. Olmayan numara: "Kayıtlı üye bulunamadı" hatası.
5. QR okutma overlaysiz çalışmaya devam ediyor.
6. "Vazgeç" basılınca idle'a dönüyor.
