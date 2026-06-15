# PWA ve Lighthouse (Faz 9 — MF-53 … MF-56)

## Kurulum

| Dosya | Açıklama |
|-------|----------|
| `manifest.json` | Uygulama adı, tema, ikonlar, `standalone` görünüm |
| `icons/icon.svg` | Vektör ikon (any) |
| `icons/icon-maskable.svg` | Maskable SVG |
| `icons/icon-192.png` | Apple touch / küçük PNG |
| `icons/icon-512.png` | PWA yükleme ikonu |
| `sw.js` | Statik shell önbelleği |
| `pwa-register.js` | Service worker kaydı |

`index.html` ve `activity-logs.html` içinde:

- `theme-color` (#0b1020)
- `apple-mobile-web-app-capable`
- `manifest` linki
- `apple-touch-icon`

## Service worker

- Önbellek: HTML, CSS, JS, manifest, ikonlar
- API istekleri (`/api/*` ve farklı origin) önbelleğe alınmaz
- Statik dosyalar: önce cache, ağ güncellemesi arka planda

Geliştirme: `node server.js` (port 5173). `sw.js` yalnızca HTTP(S) üzerinde çalışır (`file://` değil).

## Lighthouse mobil ölçümü (MF-56)

**Tarih:** 2026-06-09  
**URL:** `http://localhost:5173/index.html`  
**Emülasyon:** Mobile (Android Moto G Power)

| Kategori | Skor | Hedef |
|----------|------|-------|
| Performance | **90** | ≥ 90 |
| Accessibility | **100** | ≥ 90 |

**Metrikler:** FCP 1.3 s · LCP 3.5 s

### Komut (yeniden ölçüm)

```bash
node server.js
npx lighthouse http://localhost:5173/index.html \
  --form-factor=mobile \
  --screenEmulation.mobile=true \
  --output=json \
  --output-path=./docs/lighthouse-mobile-full.json
```

Ham rapor: `docs/lighthouse-mobile-full.json`

### Performans notları

- Excel/PDF kütüphaneleri (cdnjs) artık **lazy-load**; ilk açılışta yüklenmez (`app.js` → `ensureXlsxLib` / `ensurePdfLibs`).
- `api.js`, `app.js`, `pwa-register.js` `defer` ile yüklenir.
