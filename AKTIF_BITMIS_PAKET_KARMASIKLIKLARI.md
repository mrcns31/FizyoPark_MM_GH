# Aktif / Bitmiş Paket ve Takvim Görünümü – Karmaşıklıklar ve Tutarsızlıklar

Bu dokümanda backend, frontend ve takvim görünümü arasındaki olası karmaşıklıklar ve tutarsızlıklar listelenmiştir.

---

## 1. “Üyeliği Bitmiş” listesi – Bugün sonlandırılan paket — ✅ Çözüldü (2026-06-14)

**Eski durum:** Backend paket sonlandırıldığında `end_date = CURRENT_DATE` atıyordu. Frontend “üyeliği bitmiş” listesinde sadece `endDate < todayStr` (bitiş tarihi **bugünden önce**) olan paketleri gösteriyordu; bugün sonlandırılan paket o gün hiçbir listede görünmüyordu.

**Çözüm:** `isMemberPackageExpired(mp, todayStr)` (`app.js:397-405`, MP-04) eklendi:
- `status === 'completed' || 'cancelled'` ise **anında** bitmiş sayılır (sonlandırma backend’de `status='completed'` set ediyor — `member-packages.js:916`),
- veya `end <= todayStr` (eskiden `<`).

`openExpiredMembershipsModal` ve `openListMembersModal` artık ikisi de bu tek fonksiyonu (`isMemberPackageExpired` / `isMemberPackageActive`) kullanıyor → bugün sonlandırılan paket **aynı gün** “Üyeliği Bitmiş Üyeler”de görünüyor, “Üyeleri Listele”de görünmüyor.

---

## 2. Tarih / saat dilimi farkı — ✅ Kontrol edildi, risk yok

**İnceleme:**
- Paket sonlandırma (`/member-packages/:id/end`) frontend’den **istemci-yerel** `end_date` (YYYY-MM-DD) ile gönderiliyor (`app.js:8930-8934`, `app.js:8887`); backend bu değeri kullanıyor. Sunucu `CURRENT_DATE`/`new Date()` fallback’ı yalnızca `end_date` gönderilmezse devreye girer — mevcut tüm çağrı noktaları her zaman gönderiyor, fallback pratikte kullanılmıyor.
- DB’den dönen `end_date` (DATE tipi, saat bileşeni yok) `toDateOnlyString()` (`memberPackageDto.js:158`) ile **UTC getter’larla** stringe çevriliyor → sunucu/DB timezone’u ne olursa olsun kayma olmuyor.
- `isMemberPackageExpired`/`isMemberPackageActive` karşılaştırmaları hep frontend’in `localTodayDateStr()` (istemci yerel tarihi) ile yapılıyor — tutarlı tek kaynak.

**Sonuç:** “Üyeliği bitmiş” bağlamında sunucu/istemci tarih kayması riski yok; ek değişiklik gerekmiyor.

**Not (kapsam dışı, düşük öncelik):** `backend/utils/sessionAttendance.js:377` mesai hatırlatma bildirimi tekrarını önlemek için `CURRENT_DATE` (DB sunucu saat dilimi) kullanıyor — “Üyeliği bitmiş” ile ilgisiz, ayrı/küçük bir konu; DB sunucusu UTC ise gece 00:00–03:00 (TR) aralığında teorik olarak bir günlük kayma olabilir. İstenirse ayrı madde olarak ele alınabilir.

---

## 3. Grup seansı – Üye listesi aktif pakete göre filtrelenmiyor — ✅ Çözüldü (karar: mevcut davranış korunuyor)

**Durum:** `refreshGroupSessionNewMemberSelect()` ve grup seansı üye listesi **tüm** `state.members` ile dolduruluyor; aktif paketi olan / olmayan ayrımı yok.

**Karar:** Davranış tutarlı kabul edildi — aktif paketi olmayan/üyeliği bitmiş bir üye de grup seansına eklenebilir (backend `member_package_id = null` ile kaydeder, takvimde görünür, “Paket seansları”nda görünmez). Ek filtre **istenmiyor**.

---

## 4. Tek seans (Seans Ekle) – Üye listesi — ✅ Çözüldü (karar: mevcut davranış korunuyor)

**Durum:** `refreshSessionFormOptions()` içinde seans ekleme formundaki üye listesi de **tüm** üyelerden dolduruluyor; aktif paket filtresi yok.

**Karar:** Davranış tutarlı kabul edildi — herhangi bir üyeye takvimden seans eklenebilir (paket varsa backend otomatik atar). Ek filtre **istenmiyor**.

---

## 5. Takvim – Paket durumuna göre filtre yok — ✅ Çözüldü (karar: mevcut davranış korunuyor — bilinçli tasarım)

**Durum:** Takvim `state.sessions` ile tüm seansları gösteriyor; `member_package_id` veya paketin `status`’una göre filtre yok.

**Karar:** Tamamlanmış (completed) bir pakete ait seansların takvimde görünmeye devam etmesi **bilinçli** — geçmiş seanslar görünsün isteniyor. Ek filtre **istenmiyor**.

---

## 6. Paket seansları API’si – Status kontrolü yok — ✅ Çözüldü (karar: mevcut davranış korunuyor)

**Durum:** `GET /member-packages/:id/sessions` sadece `s.member_package_id = $1` ile seansları döndürüyor; paketin `status`’u (active/completed) kontrol edilmiyor.

**Karar:** Tamamlanmış bir paketin seanslarının da listelenmesi **bilinçli** — geçmiş paket seanslarını görmek istenen davranış (madde 3-5 ile aynı çizgide). Ek kontrol **istenmiyor**.

---

## 7. Frontend state – memberPackages tek kaynak — ✅ Çözüldü (karar: şimdilik değişiklik yok)

**Durum:** `state.memberPackages` hem aktif hem tamamlanmış paketleri içeriyor (loadFullState ile `/member-packages` cevabı). “Üyeleri Listele” ve “Üyeliği Bitmiş” tamamen frontend’de `isMemberPackageActive`/`isMemberPackageExpired` ile filtreleniyor.

**Karar:** Mevcut ölçekte (`docs/PERFORMANCE-TASKS.md` — ~1 personel, ~2 üye, ~40-50 seans) veri tutarlı ve performans sorunu yok. Backend’de ayrı status/end_date filtreli endpoint **şimdilik gerekmiyor**; veri hacmi büyürse `PERF-1x` kapsamında tekrar değerlendirilebilir.

---

## 8. API memberPackageFromApi – status varsayılanı — ✅ Çözüldü

**Durum:** `api.js:163` içinde `status: row.status || 'active'` kullanılıyor.

**Doğrulama:** `member_packages.status` kolonu `VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active','completed','cancelled'))` (`migration_member_packages.sql:9`) ve `INSERT INTO member_packages (... status) VALUES (..., 'active')` (`member-packages.js:526-528`) ile **her zaman açıkça** `'active'` set ediliyor. `status` DB’de asla NULL gelmiyor; `api.js`’teki `|| 'active'` yalnızca savunmacı bir fallback, fonksiyonel bir risk yok.

---

## 9. “Üyeliği bitmiş” – İki kriterin birlikte kullanımı — ✅ Çözüldü (2026-06-14, madde 1 ile aynı düzeltme)

**Eski durum:** Liste `endDate < todayStr` **ve** `!hasActivePackage(memberId)` ile belirleniyordu. Bitiş tarihi geçmiş ama hâlâ `status='active'` kalan bir paket varsa (örn. manuel güncelleme hatası), üye “aktif paketi var” sayılıp “Üyeliği Bitmiş”te görünmüyordu.

**Çözüm:** `isMemberPackageExpired(mp, todayStr)` (MP-04) `status` değerinden bağımsız olarak `end <= todayStr` durumunda da `true` döner; `isMemberPackageActive` ise bu durumda `false` döner (`app.js:407-411`). Dolayısıyla:
- `openExpiredMembershipsModal` (`app.js:10502-10505`): bu paket artık “Üyeliği Bitmiş”te listelenir,
- `hasActivePackage`/`openListMembersModal`: aynı paket “aktif” sayılmaz.

Uç durum madde 1 ile aynı kök düzeltmeyle kapanmış; ayrı bir aksiyon gerekmiyor.

---

## 10. Özet tablo

| Konu | Backend | Frontend | Takvim | Tutarlı? |
|------|---------|----------|--------|----------|
| Aktif paket tanımı | status='active' + tarih aralığı | status === 'active' | - | Evet |
| Bitmiş paket tanımı | status='completed' veya end_date<=bugün | `isMemberPackageExpired` (MP-04) | - | Evet |
| Üyeleri Listele | - | Sadece aktif paketi olan üyeler (`isMemberPackageActive`) | - | Evet |
| Üyeliği Bitmiş | - | `isMemberPackageExpired` (bugün sonlandırılan + status≠active ama bitiş geçmiş dahil) | - | Evet |
| Takvim seansları | Tüm seanslar | state.sessions | Hepsi gösterilir | Evet (bilinçli) |
| Paket seansları listesi | member_package_id = id | GET :id/sessions | - | Evet (bilinçli) |
| Grup/Tekil seans üye listesi | - | Tüm üyeler | - | Evet (bilinçli) |
| status varsayılanı | DEFAULT 'active' + her INSERT'te açık `'active'` | `row.status \|\| 'active'` (savunmacı) | - | Evet |

---

**Durum (2026-06-15):** Tüm maddeler (1-9) ✅ çözüldü veya karara bağlandı. Bu dokümandaki açık aksiyon kalmadı; gelecekte veri hacmi büyürse madde 7 (`PERF-1x` kapsamında backend filtreli endpoint) tekrar değerlendirilebilir.
