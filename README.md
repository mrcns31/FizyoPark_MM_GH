# Seans Planlayıcı (Web)

Haftalık seans programı oluşturmak için basit bir web uygulaması.

## Özellikler

- Haftalık görünüm (Pzt–Paz)
- Seans ekleme / silme
- **Çakışma engeli**
  - Aynı personelin aynı saatte iki seansı olamaz
  - Aynı odada, aynı anda **alet sayısından fazla** seans olamaz
  - Oda seçimi **AUTO** ise uygun odayı otomatik atar
- Ayarlar
  - Personel listesi (vardiya bilgisi dahil)
  - Üye listesi
  - Oda ve alet sayıları (varsayılan: Oda1=3, Oda2=3, Oda3=2)
- Veriler tarayıcıda saklanır (LocalStorage)
- JSON ile dışa aktar / içe aktar

## Çalıştırma

Bu proje statiktir. Bir web sunucusu ile açmanız yeterli.

### Seçenek 1 (Node.js ile - önerilen)

```bash
node server.js
```

Sonra tarayıcıdan `http://localhost:5173` açın.

### Seçenek 2 (Dosyayı direkt açma)

`index.html` dosyasını çift tıklayıp açabilirsiniz. (Bazı tarayıcılarda içe aktar özelliği kısıtlı olabilir; sunucu ile açmak daha sorunsuzdur.)

## Varsayımlar (kolay değiştirilebilir)

- Seans süresi varsayılan 60 dk (30/60/90/120 dk seçilebilir)
- Saat aralığı varsayılan 08:00–20:00
- Vardiya bilgisi sadece bilgilendirme amaçlıdır; isterseniz personel seçimini vardiyaya göre kısıtlayacak şekilde genişletilebilir.

