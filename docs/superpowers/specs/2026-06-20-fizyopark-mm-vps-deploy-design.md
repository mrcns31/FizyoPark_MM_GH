# FizyoPark MM — VPS Deploy (GitHub Actions + GHCR + Traefik)

**Tarih:** 2026-06-20
**Durum:** Onaylandı (tasarım)

## Amaç

`mrcns31/FizyoPark_MM_GH` reposunu (backend + db + frontend) mevcut Hetzner VPS'e
(`167.233.71.99`) GitHub Actions ile, **çalışan production uygulamasından (`fizyopark-ankara`)
tamamen izole**, ikinci bir uygulama olarak deploy etmek.

## Mevcut durum (VPS keşfi)

- VPS'te `traefik:v3.7` çalışıyor; entrypoints `web:80` (→`websecure:443` redirect) ve
  `websecure:443`. Docker provider, `exposedbydefault=false`, network `edge`.
- Traefik config tamamen **komut argümanlarıyla** tanımlı; **certresolver (Let's Encrypt) YOK**
  (mevcut app self-signed kullanıyor).
- Çalışan `fizyopark-ankara` stack: `web` (nginx, Traefik `PathPrefix(/)` priority=1 catch-all),
  `api` (`/api`, port 8080), `db` (postgres:18). İmajlar `ghcr.io/bgraa/fizyopark-*`.
  Yönetim: `/opt/fizyopark/compose.yml` + `/opt/fizyopark/.env`, sahibi `deploy` kullanıcısı.
- Boş portlar: `3000, 8080, 8090, 8443, 9000`. Sadece `22, 80, 443` dışarı açık.
- VPS'e erişim: `ssh hetzner` (HostName `167.233.71.99`, User `root`, `~/.ssh/hetzner`).

## Repo durumu

- Backend: Node/Express (`backend/`, `Dockerfile` var). DB bağlantısı **`DB_HOST/DB_PORT/DB_NAME/
  DB_USER/DB_PASSWORD`** ile ([backend/config/database.js](../../../backend/config/database.js)).
  `server.js` `PORT` env'ini dinler (default 5173).
- Frontend: repo kökünde statik dosyalar (index.html, app.js, api.js, styles.css, icons, fonts…).
  API base: `window.__API_BASE__ || ${protocol}//${hostname}:3000/api`
  ([api.js:3-4](../../../api.js)) — `__API_BASE__` ile override edilebilir.
- DB şeması: `backend/database/schema.sql` + `migration_*.sql` dosyaları.
  `docker/init-migrations.sh` migration'ları sırayla uygular.
- Local repo geçmişinde **hiç** `.github/workflows` veya deploy altyapısı yok.

## Kararlar (kullanıcı onaylı)

| Konu | Karar |
|---|---|
| İlişki | Çalışan app'ten **ayrı/izole** ikinci uygulama |
| GHCR namespace | `ghcr.io/mrcns31/fizyopark-{api,web,db}` |
| İmaj gizliliği | **Private** + sunucuda read-only PAT ile `docker login` |
| İmaj retention | Her pakette **son 2 sürüm** (yeni + bir önceki), rollback için |
| Reverse proxy | **Traefik-native**, `Host(${APP_HOST})` kuralı |
| HTTPS | Faz 1: self-signed (traefik'e dokunmadan). Faz 2 (opsiyonel): Let's Encrypt |
| db | **Ayrı imaj** (postgres + şema gömülü) |
| CI/CD auth (push) | Otomatik `GITHUB_TOKEN` (`packages: write`) |
| CI/CD auth (deploy) | Özel deploy SSH anahtar çifti; private → repo secret |
| Secrets'ı kim ekler | Kullanıcı (repo Settings → Secrets erişimi var); mrcns31 gerekmez |

## Mimari

İkinci uygulama, çalışan stack'e **sıfır dokunarak** eklenir. Traefik'in mevcut catch-all
router'ı `priority=1` ile yalnız host'suz/IP isteklerini yakalar; yeni app **`Host(${APP_HOST})`**
kuralı taşıdığından Traefik o subdomain'i yeni app'e, geri kalan her şeyi eski app'e yönlendirir.
→ Çakışma yok, **traefik yeniden başlatılmaz**, mevcut app'e dokunulmaz.

```
GitHub push (main)
  └─ Actions: 3 imaj build → ghcr.io/mrcns31/fizyopark-{api,web,db}:<sha> + :latest
       └─ scp deploy/compose.yml → /opt/fizyopark-mm/compose.yml
            └─ ssh: .env'de *_TAG=<sha> güncelle → docker compose pull && up -d
                 └─ GHCR retention: her pakette son 2 sürüm

VPS /opt/fizyopark-mm/ (proje: fizyopark-mm, izole)
  ├─ db   (postgres + şema gömülü, internal net, volume: fizyopark-mm-pgdata)
  ├─ api  (backend, internal net, dışarı kapalı)
  └─ web  (nginx: statik + /api proxy, edge net, Traefik Host(${APP_HOST}))

Traefik (edge) ──Host(${APP_HOST})──> web:80
                                        ├─ /      → statik dosyalar
                                        └─ /api   → api:3000 (proxy)
```

## Bileşenler

### 1. db imajı — `ghcr.io/mrcns31/fizyopark-db`
- `Dockerfile.db`: `FROM postgres:16-alpine`. `backend/database/schema.sql` →
  `/docker-entrypoint-initdb.d/01_schema.sql`; `docker/init-migrations.sh` →
  `02_migrations.sh`; `backend/database/migration_*.sql` → `/migrations/`.
- İlk açılışta şema + migration'lar otomatik kurulur (volume boşken). Volume kalıcı.
- Internal network, dışarı kapalı.

### 2. api imajı — `ghcr.io/mrcns31/fizyopark-api`
- Mevcut `backend/Dockerfile`'dan build (`node:20-alpine`, `node server.js`).
- Internal network; **port publish yok** (yalnız web proxy üzerinden erişilir).
- Env (`.env`'den): `DB_HOST=db`, `DB_PORT=5432`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`,
  `JWT_SECRET`, `JWT_EXPIRES_IN`, `JWT_REMEMBER_EXPIRES_IN`, `MEMBER_QR_SECRET`,
  `PORT=3000`, `NODE_ENV=production`, `CORS_ORIGIN=https://${APP_HOST}`,
  `RATE_LIMIT_*`, `DOOR_RASPI_URL` (bkz. açık nokta).

### 3. web imajı — `ghcr.io/mrcns31/fizyopark-web`
- `Dockerfile.web`: `FROM nginx:alpine`, repo kökündeki statik dosyalar kopyalanır,
  özel `nginx.conf` (deploy için yeni varyant).
- nginx görevleri:
  - Statik dosyaları sun; gizli klasörleri (`/backend`, `/docker`, `/scripts`…) engelle.
  - **`location /api` → `proxy_pass http://api:3000;`** (aynı-origin API).
  - **`sub_filter`** ile HTML'e `<script>window.__API_BASE__="/api"</script>` enjekte et
    (repo'daki `index.html`'e dokunmadan; local dev davranışı bozulmaz).
- `edge` network; **port publish yok**; Traefik label'ları (aşağıda).

### Traefik label'ları (web servisi, compose içinde)
```
traefik.enable=true
traefik.docker.network=edge
traefik.http.routers.fizyo-mm-web.rule=Host(`${APP_HOST}`)
traefik.http.routers.fizyo-mm-web.entrypoints=websecure
traefik.http.routers.fizyo-mm-web.tls=true            # Faz 1: self-signed
# Faz 2 (opsiyonel): traefik.http.routers.fizyo-mm-web.tls.certresolver=le
traefik.http.services.fizyo-mm-web.loadbalancer.server.port=80
```
`${APP_HOST}` compose tarafından `.env`'den enjekte edilir. Kullanıcı domaini bağlamaya
hazır olunca `APP_HOST`'u yazıp DNS A-kaydını `167.233.71.99`'a yönlendirir.

### deploy/compose.yml (repoda, CI sunucuya kopyalar)
- `name: fizyopark-mm` (izole proje adı).
- `db` / `api` / `web` servisleri; imaj tag'leri `${DB_TAG}` / `${API_TAG}` / `${WEB_TAG}`.
- Networklar: `edge` (external: true), `internal` (yeni, izole).
- Volume: `fizyopark-mm-pgdata`.
- `env_file: .env`.

## CI/CD — `.github/workflows/deploy.yml`

Tetik: `push` → `main` (+ `workflow_dispatch`). `permissions: packages: write`.

1. **build-push** (matrix: api, web, db)
   - `docker/login-action` → `ghcr.io` (`GITHUB_TOKEN`).
   - `docker/build-push-action` → `:${{ github.sha }}` + `:latest` (ilgili Dockerfile/context).
2. **deploy** (build-push'a bağlı)
   - SSH key kurulumu (`SSH_KEY` secret).
   - `scp deploy/compose.yml` → `/opt/fizyopark-mm/compose.yml`.
   - `ssh`: `.env`'de `API_TAG`/`WEB_TAG`/`DB_TAG=${{ github.sha }}` güncelle →
     `docker compose -f compose.yml --env-file .env pull` → `up -d`.
3. **retention** (deploy'dan sonra)
   - `actions/delete-package-versions` (veya GH API) ile her pakette son 2 sürüm hariç sil.
   - Aktif kullanılan tag asla silinmez.

### Repo secrets (kullanıcı ekler)
- `SSH_HOST` = `167.233.71.99`
- `SSH_USER` = `deploy`
- `SSH_KEY`  = deploy private key (yeni üretilen, kişisel `hetzner` key DEĞİL)

## Bir kerelik VPS hazırlığı

1. `deploy` kullanıcısı için yeni anahtar çifti üret; public → `deploy` `authorized_keys`,
   private → repo secret `SSH_KEY`.
2. `/opt/fizyopark-mm/` dizini (sahibi `deploy`), içinde `.env` (secret'lar, **repoda değil**):
   `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `JWT_SECRET`, `MEMBER_QR_SECRET`, `APP_HOST`,
   `API_TAG`/`WEB_TAG`/`DB_TAG` (ilk değer `latest`), vb.
3. Sunucuda GHCR private pull için bir kerelik `docker login ghcr.io` — kullanıcının
   `read:packages` PAT'i ile (kullanıcı kendi hesabıyla üretir).
4. `edge` network mevcut (external).

## Açık noktalar / uyarılar

- **HTTPS Faz 1 self-signed** → tarayıcı uyarısı verir ama trafik şifreli. DNS bağlanınca
  `https://${APP_HOST}` çalışır. Faz 2'de Let's Encrypt certresolver Traefik'e eklenir
  (traefik'i bir kez yeniden başlatır, ~saniyeler — kullanıcı onayıyla).
- **`DOOR_RASPI_URL`** LAN IP'sine (192.168.x) gider; VPS o yerel ağa erişemez →
  kapı entegrasyonu VPS'ten çalışmaz (kiosk/raspi lokal kalır). Deploy'u etkilemez.
- **Admin seed**: ilk deploy sonrası admin kullanıcı `backend/scripts/seed-admin.js`
  ile bir kez oluşturulmalı (gerekirse compose'a one-off komut).
- DNS bağlanana kadar app dışarıdan host ile erişilemez (güvenli; stack çalışır).

## Test / doğrulama

- CI yeşil: 3 imaj GHCR'da `:<sha>` + `:latest`.
- VPS'te `docker compose ps` → 3 servis up, `db` healthy.
- `curl -k -H "Host: ${APP_HOST}" https://167.233.71.99/` → index.html.
- `curl -k -H "Host: ${APP_HOST}" https://167.233.71.99/api/health` (veya bilinen endpoint) → API.
- Mevcut `fizyopark-ankara` app etkilenmemiş (IP'den hâlâ erişilir).
- Rollback: `.env`'de `*_TAG`'i bir önceki sha'ya alıp `up -d`.
