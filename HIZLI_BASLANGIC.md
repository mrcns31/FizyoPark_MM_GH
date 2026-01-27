# ⚡ Hızlı Başlangıç (En Basit Yol)

Eğer hiç vaktiniz yoksa ve en hızlı şekilde online yapmak istiyorsanız:

## 🎯 5 Dakikada Online (Railway ile)

### 1. GitHub'a Yükle (2 dakika)
```bash
# Proje klasöründe
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/KULLANICI_ADINIZ/proje-adi.git
git push -u origin main
```

### 2. Railway'e Deploy Et (3 dakika)

1. https://railway.app → GitHub ile giriş
2. "New Project" → GitHub repo seç
3. Root Directory: `backend` yaz
4. PostgreSQL ekle (Add Service → PostgreSQL)
5. Environment Variables ekle:
   ```
   DB_HOST=${{Postgres.PGHOST}}
   DB_PORT=${{Postgres.PGPORT}}
   DB_NAME=${{Postgres.PGDATABASE}}
   DB_USER=${{Postgres.PGUSER}}
   DB_PASSWORD=${{Postgres.PGPASSWORD}}
   JWT_SECRET=rastgele_gizli_kelime_123
   ```
6. PostgreSQL → Query → `database/schema.sql` içeriğini çalıştır
7. İlk kullanıcı ekle (SQL ile)
8. Frontend için yeni servis oluştur (root directory boş)
9. Domain al → Hazır!

**Toplam süre: ~5 dakika**

---

## 📱 Mobil Erişim

Railway domain'inizi mobil tarayıcıda açın - çalışır!

---

## 💰 Maliyet

**Railway:**
- İlk ay: Ücretsiz ($5 kredi)
- Sonra: Aylık ~$5-10 (küçük projeler için)

**Alternatif (Ücretsiz):**
- Render.com (ücretsiz tier)
- Vercel (frontend için ücretsiz)

---

## 🆘 Yardım

Takıldığınız yerde:
1. Railway loglarına bakın
2. Hata mesajını Google'da arayın
3. GitHub Issues'da sorun
