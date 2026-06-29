# FizyoPark MM — Sunucu Erişim Rehberi (meric)

Bu rehber sunucuya nasıl bağlanacağını, neler yapabileceğini ve ikinci cihazından (macOS) nasıl bağlanacağını anlatır.

**Sunucu:** `167.233.71.99` · **Kullanıcı:** `meric` · **Giriş:** SSH anahtarı (parola yok)

> Erişimin **yalnızca `fizyopark-mm` projesi** ile sınırlı. Veritabanı sorgusu, yedek alma/yükleme, log okuma, container yönetimi yapabilirsin. Sunucunun geri kalanına (diğer projeler, sistem ayarları, traefik) erişimin yok.

---

## 1. Bağlanma

### Kısa yol (config kurulduysa)
```bash
ssh fizyopark
```

### Uzun yol
```bash
ssh meric@167.233.71.99
```

Bağlanınca komut satırı `meric@ubuntu-bgr-dev:~$` gibi görünür. Çıkmak için `exit`.

---

## 2. Neler Yapabilirsin

Tüm komutlar `sudo` ile başlar ve **şifre sormaz**.

| Komut | Ne yapar |
|---|---|
| `sudo fp-db` | Veritabanına `psql` ile girer (interaktif sorgu). Çıkış: `\q` |
| `sudo fp-db -c "SORGU"` | Tek satır SQL çalıştırır |
| `sudo fp-backup` | Veritabanı yedeği alır (ekrana/dosyaya) |
| `sudo fp-restore` | Dışarıdan `.sql` yedeği yükler (önce otomatik güvenlik yedeği alır) |
| `sudo fp-shell <api\|web\|db>` | İlgili container'a shell açar |
| `sudo fp-logs <api\|web\|db>` | Container loglarını gösterir (`-f` canlı, `--tail N` son N satır) |
| `sudo fp-restart [servis]` | fizyopark-mm servislerini yeniden başlatır |

### Örnekler

**Sunucudayken (interaktif):**
```bash
sudo fp-db                                   # psql aç, sorgu yaz
sudo fp-db -c "SELECT count(*) FROM members;"
sudo fp-logs api -f                          # API loglarını canlı izle (Ctrl+C ile çık)
sudo fp-shell db                             # DB container shell
sudo fp-restart                              # tüm fizyopark-mm servislerini restart
sudo fp-restart api                          # sadece api'yi restart
```

**Kendi bilgisayarından (bağlanmadan tek komut):**
```bash
# Hızlı sorgu
ssh fizyopark 'sudo fp-db -c "SELECT count(*) FROM members;"'

# Yedek al ve bilgisayarına indir
ssh fizyopark 'sudo fp-backup' > ~/Desktop/yedek.sql

# Bilgisayarındaki yedeği sunucuya geri yükle
cat ~/Desktop/yedek.sql | ssh fizyopark 'sudo fp-restore'
```

> ⚠️ `fp-restore` mevcut veritabanının **üzerine yazar** (eski veri silinir). Ama çalışmadan önce otomatik güvenlik yedeği alır (`/home/meric/backups/` altına), gerekirse oradan geri dönülebilir.

---

## 3. macOS Bilgisayarına Aktarma (ikinci cihaz)

Aynı SSH anahtarını Mac'inde de kullanacaksın. Yapman gerekenler:

### Adım 1 — Private anahtarı Windows'tan Mac'e taşı
Windows'taki şu **iki** dosyayı güvenli bir şekilde (USB, AirDrop değil çünkü farklı OS — şifreli bir kanal: kendine mail, parolalı zip, USB) Mac'ine kopyala:
- `C:\Users\<isim>\.ssh\id_ed25519`  ← **private (gizli)**
- `C:\Users\<isim>\.ssh\id_ed25519.pub`  ← public

> Private anahtarı (`id_ed25519`) yalnızca kendi cihazların arasında taşı, kimseyle paylaşma.

### Adım 2 — Mac'te doğru yere koy
Mac'te **Terminal** aç ve şunları sırayla çalıştır:

```bash
mkdir -p ~/.ssh
chmod 700 ~/.ssh
```

İki dosyayı `~/.ssh/` klasörüne koy (Finder ile sürükle ya da `cp`). Sonra izinleri düzelt:

```bash
chmod 600 ~/.ssh/id_ed25519
chmod 644 ~/.ssh/id_ed25519.pub
```

> Bu `chmod 600` adımı **şart** — yoksa SSH "izinler çok açık" diyip anahtarı reddeder.

### Adım 3 — `ssh fizyopark` kısayolunu kur
```bash
cat >> ~/.ssh/config <<'EOF'
Host fizyopark
    HostName 167.233.71.99
    User meric
EOF
chmod 600 ~/.ssh/config
```

### Adım 4 — Bağlan
```bash
ssh fizyopark
```

Artık Mac'ten de aynı şekilde bağlanır, aynı `sudo fp-*` komutlarını kullanırsın.

---

## 4. Sorun Giderme

| Hata | Çözüm |
|---|---|
| `Could not resolve hostname fizyopark` | `~/.ssh/config` dosyası yok/yanlış yerde. Adım 3'ü tekrar yap. |
| `Permission denied (publickey)` | Anahtar yanlış yerde veya izinleri bozuk. `chmod 600 ~/.ssh/id_ed25519` çalıştır. |
| `Bad permissions` / `UNPROTECTED PRIVATE KEY` | `chmod 600 ~/.ssh/id_ed25519` |
| `sudo: command not found: fp-...` | Yanlış yazım — komutlar: `fp-db`, `fp-backup`, `fp-restore`, `fp-shell`, `fp-logs`, `fp-restart` |
