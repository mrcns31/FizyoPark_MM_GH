# Deployment ve Uzaktan Erişim Rehberi

## 🌐 Uzaktan Bağlantı Yöntemleri

### 1. Bulut Platformları (Önerilen)

#### A) Railway (En Kolay)
1. **Hesap Oluştur**: https://railway.app
2. **Yeni Proje Oluştur**
3. **GitHub Repo Bağla** veya **Manuel Upload**
4. **PostgreSQL Ekle**: Add Service → PostgreSQL
5. **Environment Variables Ayarla**:
   ```
   DB_HOST=${{Postgres.PGHOST}}
   DB_PORT=${{Postgres.PGPORT}}
   DB_NAME=${{Postgres.PGDATABASE}}
   DB_USER=${{Postgres.PGUSER}}
   DB_PASSWORD=${{Postgres.PGPASSWORD}}
   JWT_SECRET=your_secret_key
   ```
6. **Deploy Et**: Otomatik deploy olur
7. **Domain Al**: Railway otomatik domain verir veya kendi domain'inizi bağlayın

**Avantajlar:**
- ✅ Ücretsiz tier (aylık $5 kredi)
- ✅ Otomatik SSL
- ✅ Kolay kurulum
- ✅ PostgreSQL entegrasyonu

#### B) Render
1. **Hesap Oluştur**: https://render.com
2. **New Web Service**
3. **GitHub Repo Bağla**
4. **Build Command**: `cd backend && npm install`
5. **Start Command**: `cd backend && npm start`
6. **PostgreSQL Ekle**: New → PostgreSQL
7. **Environment Variables Ayarla**
8. **Deploy Et**

**Avantajlar:**
- ✅ Ücretsiz tier
- ✅ Otomatik SSL
- ✅ PostgreSQL desteği

#### C) DigitalOcean App Platform
1. **Hesap Oluştur**: https://digitalocean.com
2. **Create App → GitHub**
3. **PostgreSQL Database Ekle**
4. **Environment Variables Ayarla**
5. **Deploy Et**

**Avantajlar:**
- ✅ Güvenilir
- ✅ Ölçeklenebilir
- ⚠️ Ücretli (aylık ~$12)

### 2. Kendi Sunucunuz (VPS)

#### Gereksinimler:
- Ubuntu 20.04+ sunucu
- Root erişimi
- Domain adresi (opsiyonel)

#### Kurulum Adımları:

**1. Sunucuya Bağlan:**
```bash
ssh root@your_server_ip
```

**2. Node.js Kur:**
```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs
```

**3. PostgreSQL Kur:**
```bash
sudo apt update
sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

**4. Veritabanı Oluştur:**
```bash
sudo -u postgres psql
CREATE DATABASE session_tracker;
CREATE USER your_user WITH PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE session_tracker TO your_user;
\q
```

**5. Nginx Kur ve Yapılandır:**
```bash
sudo apt install nginx
```

**6. PM2 Kur (Process Manager):**
```bash
sudo npm install -g pm2
```

**7. Projeyi Yükle:**
```bash
cd /var/www
git clone your_repo_url session-tracker
cd session-tracker/backend
npm install
```

**8. Environment Variables:**
```bash
nano .env
# .env dosyasını düzenle
```

**9. PM2 ile Başlat:**
```bash
pm2 start server.js --name session-tracker
pm2 save
pm2 startup
```

**10. Nginx Yapılandırması:**
```bash
sudo nano /etc/nginx/sites-available/session-tracker
```

Nginx config:
```nginx
server {
    listen 80;
    server_name your_domain.com;

    # Backend API
    location /api {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # Frontend
    location / {
        root /var/www/session-tracker;
        try_files $uri $uri/ /index.html;
    }
}
```

**11. SSL Sertifikası (Let's Encrypt):**
```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d your_domain.com
```

**12. Nginx'i Başlat:**
```bash
sudo ln -s /etc/nginx/sites-available/session-tracker /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

---

## 🔒 Güvenlik Ayarları

### 1. Firewall (UFW)
```bash
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp  # HTTPS
sudo ufw enable
```

### 2. Fail2Ban (Brute Force Koruması)
```bash
sudo apt install fail2ban
sudo systemctl enable fail2ban
sudo systemctl start fail2ban
```

### 3. Otomatik Güncellemeler
```bash
sudo apt install unattended-upgrades
sudo dpkg-reconfigure -plow unattended-upgrades
```

---

## 📱 Uzaktan Erişim

### 1. Web Tarayıcısı
- Domain adresinizi tarayıcıda açın
- HTTPS ile güvenli bağlantı

### 2. Mobil Uyumluluk
- Responsive tasarım sayesinde mobilde de çalışır
- PWA (Progressive Web App) eklenebilir

### 3. VPN (İsteğe Bağlı)
- Sunucuya VPN ile bağlanıp sadece iç ağdan erişim
- Daha yüksek güvenlik

---

## 🔄 Yedekleme Stratejisi

### 1. Veritabanı Yedekleme
```bash
# Günlük yedek script
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
pg_dump -U your_user session_tracker > /backup/db_$DATE.sql

# Eski yedekleri sil (30 günden eski)
find /backup -name "db_*.sql" -mtime +30 -delete
```

### 2. Otomatik Yedekleme (Cron)
```bash
crontab -e
# Her gün saat 02:00'de yedek al
0 2 * * * /path/to/backup_script.sh
```

---

## 📊 Monitoring ve Loglama

### 1. PM2 Monitoring
```bash
pm2 monit
pm2 logs
```

### 2. Nginx Logları
```bash
tail -f /var/log/nginx/access.log
tail -f /var/log/nginx/error.log
```

### 3. Sistem Monitoring
- **Uptime Robot**: Ücretsiz uptime monitoring
- **Sentry**: Hata takibi (opsiyonel)

---

## 🚀 Hızlı Başlangıç Checklist

- [ ] Backend projesi hazır
- [ ] Veritabanı şeması oluşturuldu
- [ ] Environment variables ayarlandı
- [ ] API endpoint'leri test edildi
- [ ] Frontend backend'e bağlandı
- [ ] SSL sertifikası kuruldu
- [ ] Firewall yapılandırıldı
- [ ] Yedekleme stratejisi hazır
- [ ] Monitoring kuruldu
- [ ] Production test edildi

---

## 💡 İpuçları

1. **Staging Ortamı**: Production'dan önce test ortamı kurun
2. **CI/CD**: GitHub Actions ile otomatik deploy
3. **Load Balancing**: Yüksek trafik için birden fazla sunucu
4. **CDN**: Statik dosyalar için Cloudflare gibi CDN kullanın
5. **Database Replication**: Yüksek erişilebilirlik için

---

## 🆘 Sorun Giderme

### Backend çalışmıyor:
```bash
pm2 logs session-tracker
pm2 restart session-tracker
```

### Veritabanı bağlantı hatası:
```bash
sudo systemctl status postgresql
sudo -u postgres psql -c "SELECT version();"
```

### SSL sorunları:
```bash
sudo certbot renew --dry-run
sudo systemctl reload nginx
```
