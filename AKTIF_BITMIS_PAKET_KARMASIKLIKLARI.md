# Aktif / Bitmiş Paket ve Takvim Görünümü – Karmaşıklıklar ve Tutarsızlıklar

Bu dokümanda backend, frontend ve takvim görünümü arasındaki olası karmaşıklıklar ve tutarsızlıklar listelenmiştir.

---

## 1. “Üyeliği Bitmiş” listesi – Bugün sonlandırılan paket

**Durum:** Backend paket sonlandırıldığında `end_date = CURRENT_DATE` atıyor. Frontend “üyeliği bitmiş” listesinde sadece `endDate < todayStr` (bitiş tarihi **bugünden önce**) olan paketleri gösteriyor.

**Sonuç:** Bugün “Üyeliği Sonlandır” ile kapatılan bir paket, **bugün** “Üyeliği Bitmiş Üyeler” listesinde görünmez; ertesi gün görünür. Üye o gün ne “Üyeleri Listele”de (aktif yok) ne de “Üyeliği Bitmiş”te listelenir.

**Öneri:** “Üyeliği bitmiş” tanımını “bitiş tarihi geçmiş **veya** status = completed” yapmak veya `endDate <= todayStr` kullanmak.

---

## 2. Tarih / saat dilimi farkı

**Backend:** `CURRENT_DATE` ve `start_date` / `end_date` genelde sunucu saatine göre (veya DB timezone’a göre).

**Frontend:** `todayStr` ve karşılaştırmalar `new Date()` ile yerel tarihe göre yapılıyor.

**Sonuç:** Sunucu ve kullanıcı farklı saat dilimindeyse “bugün”, “dün” ve “bitiş geçti” algısı bir gün kayabilir.

**Öneri:** Tarih karşılaştırmalarını tek bir kaynağa (örn. her zaman UTC veya her zaman “YYYY-MM-DD” string) bağlamak; backend’de tarih dönerken timezone’u netleştirmek.

---

## 3. Grup seansı – Üye listesi aktif pakete göre filtrelenmiyor

**Durum:** `refreshGroupSessionNewMemberSelect()` ve grup seansı üye listesi **tüm** `state.members` ile dolduruluyor; aktif paketi olan / olmayan ayrımı yok.

**Sonuç:** Aktif paketi olmayan veya üyeliği bitmiş bir üye de grup seansına eklenebilir. Backend `resolveMemberPackageId` ile paket bulamazsa seans `member_package_id = null` ile kaydedilir; takvimde görünür, “Paket seansları” listesinde görünmez. Davranış tutarlı ama iş kuralı açısından “sadece aktif üyeler grup seansına eklenebilir” denmek isteniyorsa frontend’de filtre gerekir.

**Öneri:** İş kuralı netleştirilmeli; “sadece aktif paketi olan üyeler” isteniyorsa grup seansı üye listesi `state.memberPackages` + `status === 'active'` ile filtrelenebilir.

---

## 4. Tek seans (Seans Ekle) – Üye listesi

**Durum:** `refreshSessionFormOptions()` içinde seans ekleme formundaki üye listesi de **tüm** üyelerden dolduruluyor; aktif paket filtresi yok.

**Sonuç:** Herhangi bir üyeye takvimden seans eklenebilir; paket varsa backend paketi otomatik atar. Aktif paketi olmayan üyeye de seans eklenebilir (takvimde görünür, paket seansı sayılmaz). Tutarlı; sadece “sadece aktif üyelere seans açılsın” kuralı istenirse frontend filtresi gerekir.

---

## 5. Takvim – Paket durumuna göre filtre yok

**Durum:** Takvim `state.sessions` ile tüm seansları gösteriyor; `member_package_id` veya paketin `status`’una göre filtre yok.

**Sonuç:** Tamamlanmış (completed) bir pakete ait seanslar da takvimde görünmeye devam eder. Tarihsel olarak doğru; “sadece aktif paket seanslarını göster” gibi bir görünüm yok.

**Öneri:** Gerekirse “Sadece aktif paket seansları” gibi bir filtre eklenebilir; şu anki tasarım bilinçli (geçmiş seanslar görünsün).

---

## 6. Paket seansları API’si – Status kontrolü yok

**Durum:** `GET /member-packages/:id/sessions` sadece `s.member_package_id = $1` ile seansları döndürüyor; paketin `status`’u (active/completed) kontrol edilmiyor.

**Sonuç:** Tamamlanmış bir paketin seansları da listelenebilir. Geçmiş paket seanslarını görmek için istenen davranış olabilir; tutarlı.

---

## 7. Frontend state – memberPackages tek kaynak

**Durum:** `state.memberPackages` hem aktif hem tamamlanmış paketleri içeriyor (loadFullState ile `/member-packages` cevabı). “Üyeleri Listele” ve “Üyeliği Bitmiş” tamamen frontend’de `status` ve `endDate` ile filtreleniyor.

**Sonuç:** Backend’de “aktif paketler” veya “bitmiş paketler” için ayrı endpoint yok; tüm paketler çekilip frontend’de ayrışıyor. Veri tutarlı; sadece paket sayısı çok artarsa isteğe bağlı olarak backend’de status/end_date filtreli endpoint’ler eklenebilir.

---

## 8. API memberPackageFromApi – status varsayılanı

**Durum:** `api.js` içinde `status: row.status || 'active'` kullanılıyor. Veritabanında `status` NULL ise frontend’e “active” gidiyor.

**Sonuç:** Eğer DB’de bir paket yanlışlıkla status’suz kaydedilirse, frontend onu “aktif” sayar. Backend’de yeni paket oluşturulurken status’un her zaman set edildiği (örn. `'active'`) kontrol edilmeli.

---

## 9. “Üyeliği bitmiş” – İki kriterin birlikte kullanımı

**Durum:** Liste için:
- `endDate < todayStr` (bitiş tarihi geçmiş)
- ve `!hasActivePackage(memberId)` (üyenin hiç aktif paketi yok)

**Sonuç:** Bitiş tarihi geçmiş ama hâlâ `status = 'active'` kalan bir paket (örn. manuel güncelleme hatası) varsa, o üye “Üyeliği Bitmiş”te listelenmez çünkü “aktif paket var” sayılır. Backend’de “bitiş tarihi geçmişse otomatik completed yap” gibi bir kural yoksa bu uç durum kalabilir.

**Öneri:** İsteğe bağlı: Backend’de bitiş tarihi geçmiş paketleri periyodik veya okuma sırasında `completed` yapan bir mantık; veya frontend’de “bitiş geçmiş” paketleri ayrıca “aktif sayma” gibi net kurallar.

---

## 10. Özet tablo

| Konu | Backend | Frontend | Takvim | Tutarlı? |
|------|---------|----------|--------|----------|
| Aktif paket tanımı | status='active' + tarih aralığı | status === 'active' | - | Evet |
| Bitmiş paket tanımı | status='completed' veya end_date geçmiş | endDate < today + aktif yok | - | Kısmen (bugün sonlandırılan) |
| Üyeleri Listele | - | Sadece aktif paketi olan üyeler | - | Evet |
| Üyeliği Bitmiş | - | Bitiş geçmiş + aktif paket yok | - | Evet (bugün sonlandırılan hariç) |
| Takvim seansları | Tüm seanslar | state.sessions | Hepsi gösterilir | Evet |
| Paket seansları listesi | member_package_id = id | GET :id/sessions | - | Evet |
| Grup seans üye listesi | - | Tüm üyeler | - | Kurala bağlı |

---

Bu dokümandaki maddelere göre istenen davranışa göre backend veya frontend’de küçük düzeltmeler (örn. bugün sonlandırılanın bitmişte çıkması, tarih/timezone, opsiyonel aktif-üye filtreleri) yapılabilir.
