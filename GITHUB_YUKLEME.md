# 📤 GitHub'a Yükleme Adımları

## ✅ ADIM 1: Git Kurulumunu Kontrol Et

Terminal/Command Prompt'ta şu komutu çalıştırın:
```bash
git --version
```

Eğer versiyon numarası görünüyorsa Git kurulu demektir. ✅

**Git yoksa:**
- Windows: https://git-scm.com/download/win
- İndirin, kurun ve bilgisayarı yeniden başlatın

---

## ✅ ADIM 2: GitHub'da Repository Oluştur

1. https://github.com adresine gidin
2. Giriş yapın (yoksa hesap oluşturun)
3. Sağ üstteki **"+"** butonuna tıklayın
4. **"New repository"** seçin
5. Repository bilgilerini doldurun:
   - **Repository name:** `session-tracker` (veya istediğiniz isim)
   - **Description:** "Seans Takip Sistemi" (opsiyonel)
   - **Public** seçin (ücretsiz)
   - **"Initialize this repository with a README"** işaretini KALDIRIN (boş başlayacağız)
6. **"Create repository"** butonuna tıklayın

**Önemli:** Repository oluşturduktan sonra GitHub size bir URL verecek. Bu URL'yi not edin:
```
https://github.com/KULLANICI_ADINIZ/session-tracker.git
```

---

## ✅ ADIM 3: Proje Klasöründe Git'i Başlat

**Windows PowerShell veya Command Prompt'ta:**

1. Proje klasörünüze gidin:
```bash
cd d:\26-01-2026-Cursor-Takip\FP_MM
```

2. Git'i başlatın:
```bash
git init
```

3. Tüm dosyaları ekleyin:
```bash
git add .
```

4. İlk kaydı yapın:
```bash
git commit -m "İlk commit - Seans takip sistemi"
```

---

## ✅ ADIM 4: GitHub'a Bağlayın

**KULLANICI_ADINIZ** kısmını GitHub kullanıcı adınızla değiştirin:

```bash
git remote add origin https://github.com/KULLANICI_ADINIZ/session-tracker.git
```

**Örnek:**
Eğer GitHub kullanıcı adınız `ahmet123` ise:
```bash
git remote add origin https://github.com/ahmet123/session-tracker.git
```

---

## ✅ ADIM 5: GitHub'a Yükleyin

```bash
git branch -M main
git push -u origin main
```

**İlk kez yapıyorsanız:**
- GitHub kullanıcı adınızı isteyebilir → Girin
- Şifre isteyebilir → GitHub şifrenizi girin
- Veya Personal Access Token isteyebilir (aşağıya bakın)

---

## 🔑 Personal Access Token (Eğer Şifre Çalışmazsa)

GitHub artık şifre yerine token kullanıyor. Token oluşturmak için:

1. GitHub → Sağ üstte profil fotoğrafı → **Settings**
2. Sol menüden **Developer settings**
3. **Personal access tokens** → **Tokens (classic)**
4. **Generate new token (classic)**
5. **Note:** "Session Tracker" yazın
6. **Expiration:** 90 days (veya istediğiniz süre)
7. **Select scopes:** `repo` işaretleyin
8. **Generate token** butonuna tıklayın
9. **Token'ı kopyalayın** (bir daha gösterilmeyecek!)

**Token ile push yaparken:**
- Kullanıcı adı: GitHub kullanıcı adınız
- Şifre: Token'ı yapıştırın

---

## ✅ ADIM 6: Kontrol Edin

GitHub'da repository'nize gidin:
```
https://github.com/KULLANICI_ADINIZ/session-tracker
```

Tüm dosyalarınızı görmelisiniz! ✅

---

## 🔄 Sonraki Değişiklikleri Yüklemek İçin

Her değişiklikten sonra:

```bash
git add .
git commit -m "Değişiklik açıklaması"
git push
```

---

## ❓ SORUN GİDERME

### Hata: "remote origin already exists"
```bash
git remote remove origin
git remote add origin https://github.com/KULLANICI_ADINIZ/session-tracker.git
```

### Hata: "Authentication failed"
- Personal Access Token kullanın (yukarıda anlatıldı)

### Hata: "Permission denied"
- GitHub'da repository'nin size ait olduğundan emin olun
- Token'ın `repo` yetkisi olduğundan emin olun

---

## 📝 ÖZET KOMUTLAR (Kopyala-Yapıştır)

```bash
# 1. Git'i başlat
git init

# 2. Dosyaları ekle
git add .

# 3. Kaydet
git commit -m "İlk commit - Seans takip sistemi"

# 4. GitHub'a bağla (KULLANICI_ADINIZ'ı değiştirin)
git remote add origin https://github.com/KULLANICI_ADINIZ/session-tracker.git

# 5. Yükle
git branch -M main
git push -u origin main
```

**Hazırsınız!** 🚀
