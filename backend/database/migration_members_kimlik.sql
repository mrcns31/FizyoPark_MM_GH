-- Üye Kimlik Kartı: members tablosuna yeni alanlar
-- Çalıştırma: psql -U postgres -h 127.0.0.1 -d fizyopark_mm_gh -f backend/database/migration_members_kimlik.sql

-- Yeni sütunları ekle
ALTER TABLE members ADD COLUMN IF NOT EXISTS member_no VARCHAR(50);
ALTER TABLE members ADD COLUMN IF NOT EXISTS first_name VARCHAR(100);
ALTER TABLE members ADD COLUMN IF NOT EXISTS last_name VARCHAR(100);
ALTER TABLE members ADD COLUMN IF NOT EXISTS birth_date DATE;
ALTER TABLE members ADD COLUMN IF NOT EXISTS profession VARCHAR(200);
ALTER TABLE members ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE members ADD COLUMN IF NOT EXISTS contact_name VARCHAR(200);
ALTER TABLE members ADD COLUMN IF NOT EXISTS contact_phone VARCHAR(20);
ALTER TABLE members ADD COLUMN IF NOT EXISTS systemic_diseases TEXT;
ALTER TABLE members ADD COLUMN IF NOT EXISTS clinical_conditions TEXT;
ALTER TABLE members ADD COLUMN IF NOT EXISTS past_operations TEXT;

-- Mevcut veriyi taşı: name -> first_name, last_name; member_no = U+id
UPDATE members SET first_name = trim(split_part(coalesce(name,'') || ' ', ' ', 1)) WHERE first_name IS NULL;
UPDATE members SET last_name = trim(substring(coalesce(name,'') from length(split_part(coalesce(name,'') || ' ', ' ', 1))+2)) WHERE last_name IS NULL;
UPDATE members SET first_name = name WHERE first_name = '' AND name IS NOT NULL;
UPDATE members SET member_no = 'U' || id WHERE member_no IS NULL;

-- Telefon benzersiz (aynı numara iki üyede olamaz). Boş telefonlar çakışmaz.
CREATE UNIQUE INDEX IF NOT EXISTS idx_members_phone_unique ON members ((trim(phone))) WHERE phone IS NOT NULL AND trim(phone) <> '';
