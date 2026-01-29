# Railway'de Ayarlar Nerede?

## Backend deploy ettikten SONRA ayarları değiştirmek için:

### ADIM 1: Servisinize tıklayın
- Railway dashboard'da projeniz açık
- **Backend servisinizi** (genelde "session-tracker" veya repo adınız) tıklayın
- Tek bir kutu/kart gibi görünür, üzerine tıklayın

### ADIM 2: "Settings" sekmesine gidin
- Açılan sayfada **üstte yatay sekmeler** var:
  - **Deployments** (varsayılan)
  - **Settings** ← BUNU TIKLAYIN
  - **Variables**
  - **Metrics** vb.

### ADIM 3: "Settings" içinde aşağı kaydırın
Sayfayı **aşağı kaydırdığınızda** şu bölümleri görürsünüz:

---

#### **Build**
- **Root Directory** kutusu
  - Buraya sadece şunu yazın: `backend`
  - Projenin hangi klasöründen build alınacağını söyler

- **Build Command** (varsayılan: `npm run build` veya boş)
  - Backend için genelde: `npm install` 
  - veya boş bırakın (Railway zaten `npm install` yapar)
  
- **Watch Paths** – dokunmayın

---

#### **Deploy**
- **Start Command** kutusu
  - Buraya yazın: `npm start`
  - veya `node server.js`
  - Sunucunun nasıl başlayacağını söyler

- **Restart Policy** – varsayılan kalsın

---

### Görünmüyorsa (Yeni proje oluştururken):

**"Deploy from GitHub repo"** seçtikten sonra:

1. Repo'yu seçtiniz
2. Hemen **"Add variables"** veya **"Configure"** gibi bir buton çıkabilir – önce **"Deploy"** deyin
3. İlk deploy başladıktan sonra:
   - Oluşan **servise** (kutucuğa) tıklayın
   - **Settings** sekmesine girin
   - **Root Directory** kısmına `backend` yazın
   - **Start Command** kısmına `npm start` yazın
4. Değişiklikler kaydedilir, Railway yeniden deploy eder

---

## Kısa yol

1. Railway.app → Projeniz
2. Backend **servis kartına** tıklayın (repo adı yazan kutu)
3. Üstten **Settings**
4. Aşağı kaydırın → **Root Directory** ve **Start Command** alanlarını bulun

---

## Özet – Ne yazılacak?

| Ayar | Yazılacak |
|------|------------|
| **Root Directory** | `backend` |
| **Build Command** | Boş bırakın veya `npm install` |
| **Start Command** | `npm start` |

Bu alanları bulamazsanız hangi ekranda olduğunuzu (örn. "New Project", "Repo seçimi", "Servis detayı") yazın, ona göre tarif edebilirim.
