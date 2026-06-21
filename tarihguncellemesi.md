# FizyoPark MM — Backend Timezone Bug Fix

Bu projede (`FizyoPark_MM_GH`) 3 adet backend dosyasında düzeltme yapılması gerekiyor. Sorun: PostgreSQL'de `EXTRACT(EPOCH FROM timestamp AT TIME ZONE 'Europe/Istanbul')` kullanımı Istanbul saatini UTC gibi işliyor, üretilen epoch tarayıcıda +3 daha eklenerek 3 saat ileri görünüyor.

**Düzeltme 1 — `backend/routes/sessions.js`**

Dosyada şu satırı bul (2 yerde geçiyor, ikisini de değiştir):
```sql
EXTRACT(EPOCH FROM al.created_at AT TIME ZONE 'Europe/Istanbul') * 1000 AS at_ts,
```
Şununla değiştir:
```sql
EXTRACT(EPOCH FROM al.created_at) * 1000 AS at_ts,
```

**Düzeltme 2 — `backend/routes/member-portal.js`**

Dosyada şu satırı bul:
```sql
SELECT EXTRACT(EPOCH FROM checked_in_at AT TIME ZONE 'Europe/Istanbul') * 1000 AS checked_in_ts
```
Şununla değiştir:
```sql
SELECT EXTRACT(EPOCH FROM checked_in_at) * 1000 AS checked_in_ts
```

Değişiklikleri yap, başka hiçbir şeye dokunma. Deploy et.
