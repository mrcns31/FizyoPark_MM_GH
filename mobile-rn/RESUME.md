# RN Geliştirme — Kaldığımız Yer (RESUME)

> Son güncelleme: 2026-06-17 akşam. Bilgisayar yeniden başlatma öncesi not.
> Bu RN hattı **Capacitor'a paralel keşif**. Capacitor planı (`docs/CAPACITOR-*.md`) ve
> kök `mobile/` (Expo iskeleti) **dokunulmaz** — diğer developer'ın. RN tamamen `mobile-rn/` içinde.

## TAMAMLANANLAR ✅
- `mobile-rn/` Expo SDK 56 / RN 0.85 / React 19 iskelet (en güncel sürümler).
- **Node 22** nvm ile kuruldu ve default (SDK 56 ≥20.19.4 ister). Her komuttan önce `nvm use 22` ŞART.
- Bulletproof-react feature-based yapı: `src/{app,components,config,lib,types,utils,features/*}`.
- **axios + react-query** kuruldu. Güvenlik: `npm audit` tek transitive uyarı (uuid, Expo build-tooling, runtime'a girmez) — bilinçli dokunulmadı. Eklediğim paketler temiz.
- Yazılan kod (tsc temiz):
  - `src/config/index.ts` — API_BASE (env), TOKEN_KEY, timeout
  - `src/theme/colors.ts` — port
  - `src/lib/storage.ts` — SecureStore JWT (async, bellek cache)
  - `src/lib/api-client.ts` — axios + interceptor (Bearer, 401→token sil, hata normalize) = web apiFetch portu
  - `src/lib/react-query.ts` — queryClient
  - `src/types/api.ts` — mapper portları (member/session/memberPackage/package/room + toApi)
  - `src/features/auth/*` — api (login/getMe/logout/consent/şifre), react-query hooks, AuthProvider+useAuth, login-screen
  - `src/features/member-portal/*` — dashboard/cancel/qr/paket-talebi api + hooks + member-home-screen
  - `src/app/provider.tsx` (QueryClient+Auth+SafeArea), `src/app/routes/root.tsx` (rol bazlı), `App.tsx`
- **Backend altyapısı ÇALIŞIYOR**: `docker compose up -d postgres backend`. Migration'lar uygulandı (volume kalıcı). Admin login OK.

## KRİTİK GOTCHA'LAR ⚠️
1. **nvm use 22**: Her terminal/komut öncesi `export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"; nvm use 22`. Sistem node'u v20.12.2 ve SDK 56'yı kıramaz.
2. **Migration auto-run BOZUK + SIRA HATASI**: `docker/init-migrations.sh` "bad interpreter / Permission denied" → fresh volume'de migration'lar OTOMATİK çalışmaz. AYRICA alfabetik sırada `migration_member_packages` `packages` tablosundan ÖNCE çalışıp FK hatası verir → **iki kez çalıştır** (idempotent, IF NOT EXISTS):
   ```
   docker exec fp_postgres bash -c 'for i in 1 2; do for f in $(ls /migrations/migration_*.sql | sort); do psql -v ON_ERROR_STOP=0 -U postgres -d fizyopark_mm_gh -f "$f" >/dev/null 2>&1; done; done'
   ```
   Doğrula: `member_packages`, `package_requests`, `member_package_slots` tabloları olmalı.

### TEST GİRİŞ BİLGİLERİ (seed)
- Admin: `admin@local` / `admin123`  (seed: `docker exec fp_backend node scripts/seed-admin.js`)
- Personel: `personel@local` / `personel123`
- Üye: `uye@local` / `uye123`  (aktif paket + 6 seans)
- Üye/personel seed: `docker exec -i fp_backend node --input-type=module < backend/scripts/seed-rn-testdata.js`
3. **Simülatör bozulabilir** ("Invalid device state / server died"): `xcrun simctl shutdown all && xcrun simctl boot <UDID> && open -a Simulator`. iPhone 17 Pro UDID: `BA1DE8FA-499D-4E47-84A2-2C76779EB6EC`.
4. **CI=1 KULLANMA**: hot-reload'u kapatıyor + simülatör hatasında Metro'yu öldürüyor.
5. **`src/app` klasörü** Expo Router uyarısı verir ama zararsız (entry `index.ts`→`registerRootComponent(App)`, expo-router yüklü değil).

## YENİDEN BAŞLATMA SONRASI SIRAYLA
```bash
# 1. Backend
cd /Users/bgrataseven/Desktop/Development/FizyoPark_MM_GH
docker compose up -d postgres backend
curl -s http://localhost:3000/health           # {"status":"ok"} bekle
# login testi: admin@local / admin123

# 2. RN
export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"; nvm use 22
cd mobile-rn
npx expo start                                   # sonra terminalde 'i' = iOS
```
- `.env`: `EXPO_PUBLIC_API_BASE=http://localhost:3000/api` (iOS sim). Android emülatör → `10.0.2.2`, fiziksel cihaz → makine LAN IP.

## EKLENEN EKRANLAR (bu oturum) ✅
- **Altyapı**: react-query + axios + SecureStore + bulletproof-react. Responsive hook (`src/lib/responsive.ts`, tablet breakpoint 768). UI primitives (`src/components/ui.tsx`). datetime util (Istanbul TZ, TDD).
- **Navigasyon**: `src/app/routes/` rol bazlı bottom-tab (member/staff/admin) + NavigationContainer dark.
- **Üye**: home (aktif paket/kalan/bildirim/giriş), seanslar+iptal, paketler+talep, QR (base64 image, 25sn yenileme), profil+hesap silme.
- **Personel**: planner (gün gez + yoklama geldi/gelmedi), bildirimler, profil.
- **Admin**: TAKVİM/planner (gün, personele göre gruplu, tablette kolon), üyeler (arama), paketler, bildirim, diğer (personel/oda/hesap).
- **Bildirim feature**: `/session-attendance/notifications` liste + okundu.
- Test: 10/10 geçiyor (mapper + datetime). `npx tsc --noEmit` temiz. iOS bundle 7MB derleniyor.

## EKLENEN (2. dalga) ✅
- **Auth gating**: ilk giriş şifre belirleme (mustChangePassword) + KVKK onay (consentRequired) Root'ta sıralı kapı.
- **Şifre değiştirme** formu (üye + personel profilinde).
- **Admin aksiyonları**: Talepler ekranı (paket talebi kaldır + üyelik silme onay/red), Kapıyı Aç. "Diğer" sekmesi artık native-stack (menü→talepler).
- **Admin tam takvim**: saat×personel ızgara (`admin-calendar-grid.tsx`, working-hours'tan saat aralığı) + Izgara/Liste geçişi.
- UserProfile tipi backend'e göre düzeltildi (`id`, `fullName`). datetime: `hourOfTs`/`dayOfWeekOfTs` + test.
- Test 11/11, tsc temiz, bundle 7.1MB JS ✅.

## EKLENEN (3. dalga) ✅ — CRUD
- **Üye CRUD**: stack (liste→form), ekle/düzenle/sil (silme admin şifresi + deleteHistory; iOS Alert.prompt). `members-navigator`.
- **Paket CRUD**: stack, form (ad/ders/haftalık/aşım/tip toggle), sil. `packages-navigator`.
- **Oda CRUD**: "Diğer">Oda yönetimi, satır içi form + sil.
- **Personel CRUD**: "Diğer">Personel yönetimi, satır içi form (camelCase API), sil (admin şifresi).
- Reusable `FormField` (`src/components/form.tsx`).
- NOT: backend `isEmail` `@local` reddeder → personel için gerçek domain'li e-posta gerekir.
- Test 11/11, tsc temiz, bundle 7.2MB. Tüm create endpoint'leri 201.

## EKLENEN (4. dalga) ✅ — Seans CRUD + EXPO ROUTER MİGRASYONU
- **Seans CRUD**: takvimde "+" ekle, dokun→düzenle, uzun bas→sil. Üye/personel/oda SelectField + native DateTimePicker + süre. (Backend "çalışma saati dışında" validasyonu var.)
- **EXPO ROUTER'A GEÇİLDİ** (file-based routing): `app/` route ağacı, `features/` bulletproof korundu (route'lar ince re-export).
  - Yapı: `app/_layout.tsx` (provider + auth gating + rol redirect), `app/(auth|member|staff|admin)/` grupları, admin'de nested stack'ler (`planner/`, `members/`, `packages/`, `more/`).
  - Navigasyon: `useRouter().push({pathname, params:{id}})` + `useLocalSearchParams` + `<Stack.Screen options>`. Edit'e **id** geçiliyor (deep-link dostu).
  - Entry: `package.json main = expo-router/entry`. `app.json` scheme=`fizyoparkrn`, plugin expo-router. index.ts/App.tsx ve src/app/ silindi.
  - GOTCHA: `tabIcon` color tipi **ColorValue** olmalı (string değil). tsconfig `include`'a **`app/**`** eklenmeli yoksa tsc route'ları kontrol etmez (yanlış "temiz" verir).
  - GOTCHA: Bir route grubuna redirect için grubun `index`'i olmalı. Admin'in ilk tab'ı `planner/` klasörü → index yok → "Unmatched Route". Çözüm: auth redirect admin için doğrudan `/(admin)/planner`'a gider (member/staff'ta index.tsx var).
  - **Simülatörde doğrulandı**: expo-router/entry 1462 modül hatasız bundle, login ekranı render, auth redirect çalışıyor.
- Tab/Stack ortak opsiyonlar: `src/components/tabs.tsx`. Select modal: `src/components/select-field.tsx`.

## HENÜZ YAPILMADI (web paritesi kalan) ⏭️
- Paket talebi **fulfill** (paket atama sihirbazı; en ağır akış).
- **Ayarlar düzenleme** (working-hours/whatsapp), **kapanış dönemleri**, **aktivite logları** ekranı.
- Push bildirim (expo-notifications), RFID/NFC (dev-client).

## SIRADAKİ İŞLER (devam noktası) ⏭️
- [ ] **YARIM KALDI**: Jest + jest-expo + @testing-library/react-native kurulumu (peer çakışması diye `npm install` ile deniyordum; React 19 ile `react-test-renderer` yerine RNTL'nin kendi renderer'ı yeterli — `react-test-renderer` EKLEME). `package.json`'a `"test":"jest"`, jest preset `jest-expo`.
- [ ] TDD: mantık testleri — mappers (types/api.ts), api-client interceptor (401 token sil), auth reducer. Test-first ilerle.
- [ ] @react-navigation **rol bazlı navigasyon**: member/staff/admin/manager farklı tab/stack. (Kullanıcı vurguladı: ekranlar role göre değişir.)
- [ ] Test verisi seed (üye + personel + paket + seans) — member/staff login için.
- [ ] Üye ekranları: dashboard, takvim/seans listesi, seans iptali, paket talebi, QR erişim, profil/şifre.
- [ ] Personel ekranları: planner, yoklama/devamsızlık, bildirimler.
- [ ] Admin ekranları: üye/paket/seans/personel/oda/ayar yönetimi, silme talepleri, kapı aç.
- [ ] **Bildirim feature'ı**: `sessions/notifications`, `session-attendance/notifications/list`, `package-requests/unseen-count` (kullanıcı vurguladı).
- [ ] **Responsive/tablet**: `useWindowDimensions` breakpoint, geniş ekranda max-width/iki-kolon (kullanıcı vurguladı).

## ⚠️ ÖNCELİK 1 — TASARIM WEB PARİTESİ (compact sonrası ilk iş)
Kullanıcı mevcut tasarımı beğenmedi ("her şey birleşik", takvim/ekranlar web admin'deki gibi değil). Sebep: web `styles.css` paletini incelemeden yanlış tema kullandım (yeşil primary + yarı saydam kartlar). DÜZELT:
- `src/theme/colors.ts`'i web `styles.css` `:root` ile birebir yap:
  - bg `#0b1020`, **panel `#121a33` (KART solid!)**, panel2 `#0f1730`, border `rgba(255,255,255,.08)`, text `#e8ecff`, muted `rgba(232,236,255,.72)`
  - **PRIMARY = accent `#7c5cff` (MOR)** — yeşil değil! danger `#ff4d6d`, ok `#2bd576`, fp-green `#3db84a` (ikincil), fp-orange `#ff9500`, radius 14/10
- `src/components/ui.tsx` Card: `rgba(255,255,255,0.05)` yerine solid `#121a33` + border. Button primary → mor.
- Takvim: web `app.js` `renderGrid`/`renderAdminPlanner*` + `styles.css` planner stillerini incele, hücre/başlık/renkleri birebir uygula.
- Tüm ekranları gözden geçir; web admin ekran düzenine yaklaştır.
Detay: hafıza [[rn-design-web-parity]].

## KARARLAR (sabit)
Kapsam: tüm roller (önce üye→personel→admin). Stack: Expo managed + dev-client (RFID gerekirse). Build: EAS YOK, local (`expo prebuild`+Xcode/Gradle), ücretsiz. Bundle ID: `com.fizyopark.rn` (Capacitor'dan ayrı). Test: TDD (mantık katmanı). Plan dokümanı: `docs/REACT-NATIVE-ROADMAP.md`.
```
