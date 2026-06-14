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

## Çözüm: Kapasite Kontrolünü Backend'e Devret

### Yeni ortak prensip

Frontend artık **oda kapasitesi** ve **odada başka personel var mı**
kontrollerini yapmaz/engellemez. Bunlar backend'in `validateRoomForSession`
+ `rebalanceSlotRooms` mekanizmasına bırakılır. Frontend sadece backend'in
kontrol etmediği/edemediği iki şeyi kontrol eder:

1. **Üye çift kaydı (member-conflict):** seçilen üye bu saat aralığında
   zaten başka bir seansta mı?
2. **Personel farklı odada seanslı uyarısı:** personel aynı saat aralığında
   zaten başka (farklı) bir odada seanslıysa, kullanıcıya bilgi verilir
   (`__MULTI__` durumu hariç — bu hâlâ engelleyici bir uyarı, çünkü tek
   personel/oda kuralının istemci tarafından tutarsız bir önceki duruma
   işaret eder).

Çalışma saati kontrolleri (genel + personel) değişmeden kalır — bunlar
backend'de de var ama frontend'de anlık geri bildirim için tutulur.

### `checkConflicts` sadeleştirmesi

`checkConflicts(candidate, opts)` yeni davranışı:

- Kapasite kontrolü (`count >= room.devices`) → **kaldırılır**.
- "Odada başka personel var" kontrolü → **kaldırılır**.
- Member-conflict kontrolü → **korunur**.
- `getStaffBusyRoomId` ile `__MULTI__` / farklı-oda uyarısı → **korunur**.

### `autoAssignRoom` sadeleştirmesi

`autoAssignRoom(candidate, opts)` yeni davranışı:

1. `getStaffBusyRoomId` ile personelin bu saatte zaten kullandığı bir oda
   varsa (`__MULTI__` değilse) onu döndür.
2. Yoksa `state.rooms[0]?.id` döndür (ilk oda — kapasite kontrolü yapılmaz,
   backend zaten gerçek atamayı/rebalance'ı yapacak).
3. `state.rooms` boşsa `null` döndürür (oda hiç tanımlı değilse — bu durumda
   zaten backend de hata döner).

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
4. `checkConflicts` (sadece member-conflict + personel-farklı-oda uyarısı).
   Herhangi bir conflict varsa → engelle, hata göster.
5. API'ye gönder (`createSession` / `updateSession`). Backend 409 ile
   kapasite/rebalance hatası dönerse, o mesaj kullanıcıya gösterilir.
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

- `getStaffBusyRoomId` + `autoAssignRoom` çağrıları `autoAssignRoom`'un yeni
  haliyle birleştirilir (busy-room mantığı zaten `autoAssignRoom` içine
  taşındı, ayrı çağrıya gerek yok).
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
  || state.rooms[0]` fallback'ine gerek kalmaz.
- `overCapacity` hesaplaması ve `needsServerRebalance: overCapacity` alanı
  kaldırılır.
- Direkt `checkConflicts` çağrılır (member-conflict + personel-farklı-oda).
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
- **Personel aynı saatte farklı odada seanslıysa (`__MULTI__`):** uyarı
  gösterilir (değişmedi).
- **Grup düzenleme — slot değişmedi, oda artık dolu:** Eskiden sessizce
  `needsServerRebalance=true` olurdu; yeni davranışta kayıt backend'e
  gönderilir, backend rebalance dener veya 409 döner.
