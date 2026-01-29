# Railway'de PostgreSQL Ekleme - Adım Adım

## 📍 Nerede ve Nasıl?

### ADIM 1: Railway Dashboard'a Gidin
1. https://railway.app adresine gidin
2. Giriş yapın
3. **Projenizi** açın (backend'i deploy ettiğiniz proje)

### ADIM 2: "+ New" Butonunu Bulun
- Proje sayfasında **üst kısımda** veya **sağ üstte** bir **"+ New"** butonu görürsünüz
- Veya **"Add Service"** yazılı bir buton olabilir
- Veya **"New"** yazılı bir buton

**Görünüm:**
```
[+ New] veya [Add Service] veya [New]
```

### ADIM 3: PostgreSQL Seçin
**"+ New"** butonuna tıkladığınızda bir menü açılır:

**Seçenekler:**
- **GitHub Repo** (bunu seçmeyin)
- **Database** ← BUNU SEÇİN
- **Empty Service** (bunu seçmeyin)
- **Template** (bunu seçmeyin)

**"Database"** seçeneğine tıklayın.

### ADIM 4: PostgreSQL'i Seçin
**"Database"** seçtikten sonra yeni bir menü açılır:

**Seçenekler:**
- **PostgreSQL** ← BUNU SEÇİN
- **MySQL** (bunu seçmeyin)
- **MongoDB** (bunu seçmeyin)
- **Redis** (bunu seçmeyin)

**"PostgreSQL"** veya **"Add PostgreSQL"** butonuna tıklayın.

### ADIM 5: Bekleyin
- Railway otomatik olarak PostgreSQL'i oluşturur
- Birkaç saniye içinde ekranda yeni bir **kutu/kart** görünür
- Üzerinde **"Postgres"** veya **"PostgreSQL"** yazar
- Durum: **"Provisioning"** veya **"Deploying"** olabilir
- Birkaç dakika bekleyin, **"Active"** veya **"Running"** olana kadar

---

## ✅ PostgreSQL Eklendi mi Kontrol Edin

Ekranda şu şekilde görünmelidir:

```
┌─────────────────┐
│  Backend        │  ← Backend servisiniz
│  (session-tracker)│
└─────────────────┘

┌─────────────────┐
│  Postgres       │  ← YENİ EKLENEN PostgreSQL
│  (Provisioning) │
└─────────────────┘
```

---

## 🔍 Bulamıyorsanız - Alternatif Yollar

### Yol 1: Sol Menüden
- Railway dashboard'da **sol tarafta** bir menü var mı?
- **"Databases"** veya **"Add Database"** gibi bir seçenek var mı?

### Yol 2: Proje Ayarlarından
1. Projenize tıklayın
2. **Settings** sekmesine gidin
3. **"Add Database"** veya **"Databases"** bölümüne bakın

### Yol 3: Farklı Arayüz
Bazı Railway versiyonlarında:
- **"+ New Service"** butonu
- **"Create Service"** butonu
- **"Add Resource"** butonu

Hepsi aynı işi yapar - PostgreSQL eklemek için.

---

## 📸 Ekran Görüntüsü Tarifi

Railway'de şu şekilde görünür:

**Ana Sayfa:**
```
┌─────────────────────────────────────┐
│  [Railway Logo]  Proje Adı         │
│                                     │
│  [+ New]  [Settings]  [Variables]  │
│                                     │
│  ┌──────────────┐                  │
│  │ Backend      │                  │
│  │ Deploying... │                  │
│  └──────────────┘                  │
└─────────────────────────────────────┘
```

**"+ New" tıkladıktan sonra:**
```
┌─────────────────────────────────────┐
│  [+ New ▼]                         │
│  ┌─────────────────────────────┐   │
│  │ GitHub Repo                 │   │
│  │ Database                    │ ← TIKLAYIN
│  │ Empty Service               │   │
│  │ Template                    │   │
│  └─────────────────────────────┘   │
└─────────────────────────────────────┘
```

**"Database" tıkladıktan sonra:**
```
┌─────────────────────────────────────┐
│  [Database ▼]                      │
│  ┌─────────────────────────────┐   │
│  │ PostgreSQL                  │ ← TIKLAYIN
│  │ MySQL                       │   │
│  │ MongoDB                     │   │
│  │ Redis                       │   │
│  └─────────────────────────────┘   │
└─────────────────────────────────────┘
```

---

## ⚠️ ÖNEMLİ NOTLAR

1. **PostgreSQL ücretsiz değil** - Railway'de ücretsiz kredi kullanır
2. **Oluşturma süresi** - 1-3 dakika sürebilir
3. **Otomatik ayarlar** - Railway her şeyi otomatik yapar, sizin bir şey yapmanıza gerek yok
4. **Bağlantı bilgileri** - PostgreSQL oluşturulduktan sonra otomatik olarak environment variables'a eklenir

---

## ✅ PostgreSQL Eklendikten Sonra Ne Yapılacak?

1. **PostgreSQL kartına tıklayın**
2. **"Variables"** sekmesine gidin
3. Şu bilgileri göreceksiniz:
   - `PGHOST`
   - `PGPORT`
   - `PGDATABASE`
   - `PGUSER`
   - `PGPASSWORD`

Bu bilgileri backend'inizde kullanacaksınız (sonraki adımda).

---

## 🆘 Hala Bulamıyorsanız

Hangi ekranda olduğunuzu yazın:
- "Proje listesi" mi?
- "Tek bir proje açık" mı?
- "Backend servis detayı" mı?
- Başka bir ekran mı?

Ekran görüntüsü paylaşabilirseniz daha net yardımcı olabilirim!
