# Otomatik Oda Dengeleme — Tasarım

## Problem

Paket tanımlama / gün dağılımı sırasında her seans, `validateAndPickRoom` ile
**tek tek ve bağımsız** olarak ilk uygun odaya atanıyor (greedy, oda id sırasına
göre). Bu yüzden, aynı saat dilimine sırayla eklenen personellerin üye sayıları
odaların alet kapasiteleriyle uyuşmuyor.

**Örnek:** Aynı saatte personel1 alt odada (3 alet) 3 üye, personel2 orta odada
(1 alet) 1 üye, personel3 üst odada (2 alet) 2 üye alıyor. Personel3'e 3.
üyeyi eklemek istediğimizde, personel3'ün talebi (3) üst odanın kapasitesini
(2) aşıyor — ama o saatte alt odanın 3 aletli kapasitesi personel1 tarafından
zaten dolu kullanılıyor olsa da, personel2 (1 talep) 2 aletli odaya, personel3
(3 talep) 3 aletli odaya geçerse sorun çözülür. Sistem bu yeniden dağıtımı
yapmıyor.

## Çözüm: `placeSessionWithRebalance` + `rebalanceSlotRooms`

`backend/utils/sessionSlot.js` içine eklenecek iki fonksiyon:

```js
export async function rebalanceSlotRooms(db, { startTs, endTs })
export async function placeSessionWithRebalance(db, { staffId, startTs, endTs, memberId, memberPackageId })
```

### `rebalanceSlotRooms` — dağıtım algoritması

1. Verilen `[startTs, endTs)` anındaki (tek bir gün/saat dilimi) tüm silinmemiş
   (`deleted_at IS NULL`) seansları çeker, `staff_id`'ye göre gruplar.
   - Her personelin **talebi** = o anda ona ait seans sayısı.
2. Tüm odaları `devices` (alet sayısı) ile birlikte çeker.
3. **Eşleştirme algoritması:**
   - Personelleri talebe göre **azalan** sırala.
   - Odaları `devices`'a göre **azalan** sırala.
   - `i`. personeli `i`. odaya eşle (sıralı greedy eşleşme).
4. **Fizibilite kontrolü:** herhangi bir `i` için `talep[i] > devices[i]` ise
   → **infeasible**. Hiçbir değişiklik yapılmadan
   `{ ok: false, error: 'Bu saatte toplam oda kapasitesi yetersiz.' }` döner.
5. Feasible ise:
   - Personelin mevcut odası eşleşen oda ile **aynıysa** dokunulmaz.
   - Farklıysa, o personelin o andaki **tüm seanslarının** `room_id`'si yeni
     odaya güncellenir (tek personel/oda kuralı her zaman korunur — aynı oda
     aynı anda yalnızca bir personele atanır).

### `placeSessionWithRebalance` — yeni seans ekleme

Mevcut akışta `validateAndPickRoom`, eklenecek personel için **o anda hiçbir
oda uygun değilse** (`ok:false`) direkt hata döndürüp seansı eklemeden
durduruyor — rebalance'a sıra gelmiyor. Bu, tam olarak kullanıcının
yaşadığı sorunun nedeni (personel3'ün 3. üyesi için üst oda dolu, başka boş
oda da yok → ekleme başarısız oluyor, halbuki personel2 ile yer değişse
sığar).

Bunu çözmek için yeni seans ekleme akışı:

1. **Çalışma saati kontrolleri** (mevcut `validateAndPickRoom` adım 1-2:
   global + personel çalışma saatleri) aynen korunur. Başarısızsa
   `{ ok: false, error: 'Çalışma saati dışında' }`.
2. **Hipotetik fizibilite kontrolü:** o `(startTs, endTs)` anındaki mevcut
   personel taleplerine, eklenecek `staffId` için **+1** eklenerek
   `rebalanceSlotRooms`'daki eşleştirme algoritması **simüle edilir** (DB'ye
   yazılmadan, salt hesaplama).
   - Infeasible ise → `{ ok: false, error: 'Bu saatte toplam oda kapasitesi yetersiz.' }`,
     hiçbir şey yazılmaz.
3. Feasible ise, transaction içinde:
   - Yeni seans **herhangi bir odaya** (örn. kapasitesi en büyük oda, veya
     mevcut `validateAndPickRoom` ile bulunabilen ilk oda — kesin oda önemsiz)
     `room_id` ile eklenir.
   - Hemen ardından **aynı transaction içinde** `rebalanceSlotRooms` çağrılır;
     bu, yeni eklenen seans dahil tüm slotu doğru odalara yeniden dağıtır.
   - Transaction commit edilir.
4. **Eşzamanlılık:** Tüm adım 2-3, etkilenecek odaları `SELECT ... FOR UPDATE`
   ile kilitleyen bir transaction içinde yapılır (mevcut
   `generateSessionsForMemberPackage` kalıbına benzer) — paralel paket
   tanımlamalarında yarış durumu oluşmaz.

### Kapsam — sadece gelecek

- Rebalance sadece `startTs >= Date.now()` olan anlar için çalışır. `now`'dan
  önceki (geçmiş veya yoklama girilmiş) seanslara dokunulmaz. Yeni seans
  eklemeleri zaten her zaman gelecek bir tarihe yapıldığından bu, doğal bir
  sınırdır.

## Entegrasyon Noktaları

1. **`generateSessionsForMemberPackage`** (backend/routes/member-packages.js):
   Döngüdeki `validateAndPickRoom` + manuel kapasite/oda kilidi bloğu
   (satır 303-355), `placeSessionWithRebalance` çağrısıyla değiştirilir.
   - Infeasible dönerse: mevcut `pushConflict` + `break` akışı korunur —
     "Bu saatte toplam oda kapasitesi yetersiz." conflict'i eklenir, tüm
     işlem geri alınır (satır 368-371'deki mevcut rollback mantığı).

2. **`addNextSessionAfterLastForPackage`** (backend/utils/packageSessions.js):
   `validateAndPickRoom` çağrısı (satır 176) `placeSessionWithRebalance` ile
   değiştirilir. Infeasible ise `{ added: false, reason: 'capacity_exceeded' }`
   döner, döngü bir sonraki güne geçmeye devam eder (mevcut "uygun gün arama"
   davranışı korunur).

3. **`validateAndPickRoom`**: değişmeden kalır, başka çağıranlar (varsa) için
   korunur. `placeSessionWithRebalance` onu kullanmaz, kendi fizibilite
   kontrolünü yapar.

## İnfeasible Durumu

Toplam talep, o andaki toplam oda kapasitesini aşıyorsa:
**tüm işlem reddedilir** — paket oluşturma/düzenleme tamamen geri alınır,
kullanıcıya "Bu saatte toplam oda kapasitesi yetersiz." hatası gösterilir.
Yarım/tutarsız durum oluşmaz.

## Test Senaryoları

- **Temel dengeleme:** personel A (3 talep) + personel B (1 talep), odalar
  3 aletli + 1 aletli, A başlangıçta 1 aletli odada → rebalance sonrası A
  3 aletli odaya, B 1 aletli odaya geçer.
- **Üç personelli senaryo (kullanıcı örneği):** personel1 alt oda (3 alet,
  3 talep), personel2 orta oda (1 alet, 1 talep), personel3 üst oda (2 alet,
  2 talep). personel3'e 3. üye `placeSessionWithRebalance` ile eklenince
  (talep 3): hipotetik fizibilite kontrolü geçer (talepler 3,1,3 ↔ kapasiteler
  3,2,1 sıralı eşleşir), yeni seans eklenir, rebalance sonrası personel2 →
  2 aletli (üst) odaya, personel3 → 3 aletli (alt) odaya geçer, personel1
  yerinde kalır.
- **Infeasible (ekleme öncesi):** `placeSessionWithRebalance` hipotetik
  kontrolde infeasible bulursa → hiçbir şey yazılmaz, hata döner.
- **Infeasible (toplu oluşturma):** `generateSessionsForMemberPackage`
  döngüsünde bir seans infeasible olursa → tüm işlem geri alınır
  (oluşturulan seanslar silinir), "Bu saatte toplam oda kapasitesi
  yetersiz." conflict'i döner.
- **Geçmiş seans dokunulmaz:** `startTs < now` olan seanslar rebalance'a dahil
  edilmez.
- **Değişiklik yoksa no-op:** mevcut atama zaten optimalse hiçbir UPDATE
  çalışmaz.
