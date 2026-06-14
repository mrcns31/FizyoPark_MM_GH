# Seans Ekle / Düzenle / Grup Seans Akışları — Tutarlılık Tasarımı

## Problem

Frontend'de (`app.js`) üç ayrı akış var: tekli seans ekle/düzenle
(`saveSessionFromModal`), grup seansı ekle/düzenle (`saveGroupSession`) ve
grup seansına üye ekleme (`groupSessionAddMemberBtn` handler). Her üçü de
oda/kapasite kontrolünü kendi başına, birbirinden farklı şekillerde tahmin
etmeye çalışıyor (`autoAssignRoom`, `checkConflicts`, `needsServerRebalance`
/ `needsServerRebalanceSingle` flag'leri, `groupOverCapacity` engeli).

Ancak backend (`backend/utils/sessionSlot.js` — bkz.
[[2026-06-14-oda-dengeleme-design]]) zaten her POST/PUT'ta
`validateRoomForSession` + `rebalanceSlotRooms` ile **gerçek ve kesin**
kapasite kontrolü ve oda dengeleme yapıyor, infeasible ise anlamlı bir 409
hata mesajı döndürüyor. Frontend'in tahmini kapasite hesapları bu nedenle
hem gereksiz hem de tutarsız:

- **Grup seans ekleme** (satır 9219-9226): `groupOverCapacity` true ve hiçbir
  session `needsServerRebalance` taşımıyorsa kullanıcıyı tamamen engelliyor —
  backend'e hiç sorulmuyor, halbuki backend rebalance ile bunu çözebilir.
- **Grup düzenleme — "slot değişmedi" dalı** (satır 9353-9362): manuel oda
  seçilip kapasite aşılırsa sadece `needsServerRebalance=true` set ediliyor,
  member-conflict kontrolü atlanıyor (diğer dallarda yapılıyor).
- AUTO fallback oda seçimi üç akışta üç farklı şekilde yapılıyor
  (`existingSession.roomId` vs `firstSession.roomId` vs `state.rooms[0]`).
- `needsServerRebalance` / `needsServerRebalanceSingle` flag'leri karmaşık,
  birbirinden bağımsız üç yerde set ediliyor ve `syncSessionsFromServer`
  çağrısını koşullu yapıyor.
- "Seçilen personel bu saat aralığında 'X' odada seanslı, aynı anda farklı
  oda olmaz" (`__MULTI__`) uyarısı, personelin **hangi odada** olduğunu
  önemli sayıyor — ama gerçek kural personel/oda eşleşmesiyle ilgili değil,
  sadece merkezdeki toplam alet sayısıyla ilgili (bkz. aşağıdaki "Asıl İş
  Kuralı").

### Asıl İş Kuralı

Merkezdeki tüm randevular tek bir kavram (ayrı bir "grup seansı" yok).
Kısıtlar:

- Merkezde N oda var, her odanın `devices` (alet) kapasitesi var
  (örnek: 3 oda, kapasiteler 3 + 3 + 2 = toplam 8 alet).
- Aynı anda bir odada yalnızca bir personel çalışabilir.
- Bir personel, aynı saatte, **kendisine atanan odanın kapasitesi kadar**
  üye alabilir.
- Hangi personelin hangi odada olduğu **önemsizdir** — backend bunu
  `rebalanceSlotRooms` ile optimize eder/değiştirebilir.
- O saatteki toplam randevu sayısı, merkezdeki toplam alet sayısını (8)
  aşamaz; aşarsa (ve rebalance ile çözülemiyorsa) backend 409 ile
  "Bu saatte toplam oda kapasitesi yetersiz." döner.

Bu kural zaten `backend/utils/sessionSlot.js`'teki `matchStaffToRooms` +
`rebalanceSlotRooms` + `placeSessionWithRebalance` tarafından doğru
şekilde uygulanıyor (bkz. [[2026-06-14-oda-dengeleme-design]]) — backend'de
değişiklik gerekmiyor. Sorun sadece frontend'in bu kuralı kendi başına
(yanlış ve daha kısıtlayıcı şekilde, personel-oda eşleşmesi üzerinden)
tekrar uygulamaya çalışması.

**Doğrulama (kullanıcı örneği, 15.06.2026 10:00):** Arzum 2→3, Cansu 2,
Şerife 3 talep ediyor (toplam 8). Odalar 3+3+2 alet. `matchStaffToRooms`:
talepler azalan (Arzum 3, Şerife 3, Cansu 2) ↔ odalar azalan (3, 3, 2) →
sıralı eşleşme, hepsi `talep ≤ kapasite` → **feasible**, rebalance ile
doğru dağıtılır. Karışık kapasiteli odalarda (örn. 3+2+2+2) da aynı
azalan-azalan eşleştirme algoritması matematiksel olarak doğru çalışır —
"toplam alet" ve "personel başı max" gibi iki ayrı global sayıya
indirgemek yeterli değildir (örn. 3,2,2,2'de bir personele "3,3,3"
dağıtılamaz, çünkü 3 alet kapasiteli oda sadece bir tane); bu nedenle
oda listesi (`rooms` tablosu) ve mevcut eşleştirme algoritması olduğu
gibi korunur, yeni global ayar eklenmez.

## Çözüm: Kapasite Kontrolünü Backend'e Devret

### Yeni ortak prensip

Frontend artık **oda kapasitesi**, **odada başka personel var mı** ve
**personel hangi odada seanslı** kontrollerini yapmaz/engellemez. Bunların
hepsi backend'in `validateRoomForSession` + `rebalanceSlotRooms`
mekanizmasına bırakılır — personel/oda eşleşmesi tamamen backend'in
optimize edebileceği bir detaydır. Frontend sadece backend'in
kontrol etmediği/edemediği tek şeyi kontrol eder:

1. **Üye çift kaydı (member-conflict):** seçilen üye bu saat aralığında
   zaten başka bir seansta mı?

Çalışma saati kontrolleri (genel + personel) değişmeden kalır — bunlar
backend'de de var ama frontend'de anlık geri bildirim için tutulur.

### `checkConflicts` sadeleştirmesi

`checkConflicts(candidate, opts)` yeni davranışı:

- Kapasite kontrolü (`count >= room.devices`) → **kaldırılır**.
- "Odada başka personel var" kontrolü → **kaldırılır**.
- `getStaffBusyRoomId` ile `__MULTI__` / farklı-oda uyarısı → **kaldırılır**
  (personelin hangi odada olduğu önemsiz; bu artık ne bir uyarı ne bir
  engel).
- Member-conflict kontrolü → **korunur** (tek kalan kontrol).

### `autoAssignRoom` sadeleştirmesi

`autoAssignRoom(candidate, opts)` yeni davranışı:

1. `state.rooms[0]?.id` döndür (ilk oda — hangi oda olduğu önemsiz, backend
   zaten gerçek atamayı/rebalance'ı yapacak).
2. `state.rooms` boşsa `null` döndürür (oda hiç tanımlı değilse — bu durumda
   zaten backend de hata döner).

`getStaffBusyRoomId` çağrısı kaldırılır — personelin "meşgul olduğu oda"
artık anlamsız bir kavram, backend rebalance ile personeli farklı bir
odaya da taşıyabilir.

Bu fonksiyon artık `null` döndürmez (rooms boş olmadığı sürece), dolayısıyla
"hiçbir oda uymuyor" fallback dallarına ihtiyaç kalmaz.

### Üç akışın ortak adımları

Her üç akış (tekli ekle/düzenle, grup ekle/düzenle, grup üye ekle) şu sırayı
izler:

1. Form validasyonu (tarih/saat/üye/personel seçili mi).
2. Çalışma saati kontrolleri (genel gün + personel saatleri) — değişmedi.
3. Oda seçimi:
   - Manuel seçildiyse → o `roomId` kullanılır.
   - AUTO ise → `autoAssignRoom` çağrılır (her zaman bir roomId döner).
4. `checkConflicts` (sadece member-conflict). Conflict varsa → engelle,
   hata göster.
5. API'ye gönder (`createSession` / `updateSession`). Backend 409 ile
   kapasite/rebalance hatası dönerse, o mesaj kullanıcıya gösterilir
   (örn. "Bu saatte toplam oda kapasitesi yetersiz.").
6. Başarılı kayıt sonrası → **her zaman** `syncSessionsFromServer({ silent: true })`
   çağrılır (rebalance backend'de başka seansların `room_id`'sini
   değiştirmiş olabilir; state güncel tutulmalı).

### Kaldırılacak kod / flag'ler

- `needsServerRebalance` (saveGroupSession, groupSessionAddMemberBtn) ve
  `needsServerRebalanceSingle` (saveSessionFromModal) flag'leri tamamen
  kaldırılır — adım 6 artık koşulsuz.
- `saveGroupSession` başındaki `groupOverCapacity` engelleme bloğu
  (satır ~9219-9226) kaldırılır.
- `currentGroupSessions` öğelerindeki `needsServerRebalance` alanı
  kaldırılır (artık `sessionToSend`'den ayıklama gerekmez).
- Grup üye ekleme handler'ındaki `overCapacity` hesaplaması ve "overCapacity
  ise sadece member-conflict kontrol et, değilse checkConflicts çağır" dallı
  yapı kaldırılır; direkt `checkConflicts` çağrılır.

## Akış Bazlı Değişiklikler

### 1. Tekli Seans Ekle/Düzenle (`saveSessionFromModal`, ~9475-9684)

- `getStaffBusyRoomId` çağrısı kaldırılır; AUTO modda doğrudan
  `autoAssignRoom`'un yeni (sadeleşmiş) hali kullanılır.
- `needsServerRebalanceSingle` kaldırılır; `checkConflicts` her zaman
  çağrılır (adım 4).
- Kayıt sonrası her zaman `syncSessionsFromServer({ silent: true })`
  (token varsa).

### 2. Grup Seansı Ekle/Düzenle (`saveGroupSession`, ~9212-9473)

- Başlangıçtaki `groupOverCapacity` engelleme bloğu kaldırılır.
- "Slot değişti" dalında (9313-9352): AUTO/manuel oda seçimi yeni
  `autoAssignRoom` ile basitleşir; kapasite bazlı `needsServerRebalance` set
  etme kaldırılır; her session için `checkConflicts` (sadeleşmiş hâliyle)
  çağrılır.
- "Slot değişmedi" dalında (9353-9362): kapasite kontrolü/flag tamamen
  kaldırılır. Member-conflict kontrolü eklenmez — slot değişmediğinde
  `currentGroupSessions` zaten mevcut/kayıtlı seanslar olduğundan member
  çakışması oluşamaz. Bu dal sadece `newStaffId`/`newRoomId`/`newStartTs`/
  `newEndTs` atamalarına indirgenir.
- Kayıt sonrası her zaman `syncSessionsFromServer({ silent: true })`.

### 3. Grup Seansına Üye Ekle (handler, ~11291-11407)

- `autoAssignRoom` çağrısı yeni haliyle her zaman bir roomId döner; `picked
  || state.rooms[0]` fallback'ine gerek kalmaz (zaten az önce eklenen
  fallback bu yeni davranışla gereksiz hale gelir, kaldırılır).
- `overCapacity` hesaplaması ve `needsServerRebalance: overCapacity` alanı
  kaldırılır.
- Direkt `checkConflicts` çağrılır (sadece member-conflict).
- Not: Bu handler `currentGroupSessions`'a ekleme yapıyor, API çağrısı
  `saveGroupSession`'da gerçekleşiyor — bu adımda API çağrısı/sync yok,
  sadece local state.

## Geriye Dönük Uyumluluk / Edge Case'ler

- Backend'e gönderilen `roomId` artık sadece bir "öneri" — backend kabul
  edebilir, rebalance ile değiştirebilir veya 409 ile reddedebilir
  (gerçekten infeasible ise, örn. toplam kapasite aşımı). Bu durumda
  kullanıcıya backend'in mesajı (`e.data.error`) gösterilir — mevcut hata
  gösterme kodu zaten bunu yapıyor, değişiklik gerekmez.
- `state.rooms` boşsa (`autoAssignRoom` → `null`): mevcut "oda yok" hata
  mesajları korunur (örn. tekli seans ekleme — bu durumda backend de zaten
  `placeSessionWithRebalance` içinde `rooms.length === 0` kontrolü ile hata
  döner).

## Test Senaryoları

- **Oda dolu, AUTO seçili, tekli seans ekleme:** Frontend `autoAssignRoom`
  ile `state.rooms[0]` önerir, backend rebalance ile uygun odaya yerleştirir
  veya kapasite gerçekten yetersizse 409 + "Bu saatte toplam oda kapasitesi
  yetersiz." döner.
- **Grup seansına 2. üye eklerken oda dolu (bu PR'ın orijinal bug'ı):**
  Artık `checkConflicts` kapasite kontrolü yapmadığından engellemez;
  `saveGroupSession` sırasında backend her seans için rebalance dener.
- **Aynı üye aynı saate ikinci kez eklenmeye çalışılırsa:** `checkConflicts`
  member-conflict ile engeller (değişmedi).
- **Personel aynı saatte farklı odada seanslı (eski `__MULTI__` durumu):**
  artık ne uyarı ne engel — backend rebalance personeli gerekirse farklı
  bir odaya taşır, sonuç `syncSessionsFromServer` ile state'e yansır.
- **Grup düzenleme — slot değişmedi, oda artık dolu:** Eskiden sessizce
  `needsServerRebalance=true` olurdu; yeni davranışta kayıt backend'e
  gönderilir, backend rebalance dener veya 409 döner.
- **Toplam talep > toplam alet sayısı (örn. 9. randevu, 8 alet varken):**
  `placeSessionWithRebalance` / `rebalanceSlotRooms` infeasible döner,
  backend 409 + "Bu saatte toplam oda kapasitesi yetersiz." döner; frontend
  bu mesajı kullanıcıya gösterir.
