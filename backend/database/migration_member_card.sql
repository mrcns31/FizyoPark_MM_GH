-- RFID kart numarası üyelere ekleniyor
-- Çalıştırma: psql -U postgres -h 127.0.0.1 -d <veritabanı_adı> -f backend/database/migration_member_card.sql

ALTER TABLE members ADD COLUMN IF NOT EXISTS card_no VARCHAR(50);

CREATE UNIQUE INDEX IF NOT EXISTS idx_members_card_no
  ON members(card_no)
  WHERE card_no IS NOT NULL;

COMMENT ON COLUMN members.card_no IS 'RFID kart numarası — kiosk kapı girişi için kullanılır';
