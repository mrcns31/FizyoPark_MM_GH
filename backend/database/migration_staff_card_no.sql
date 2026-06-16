-- Personel tablosuna RFID kart numarası ekleniyor
ALTER TABLE staff ADD COLUMN IF NOT EXISTS card_no VARCHAR(50);

CREATE UNIQUE INDEX IF NOT EXISTS idx_staff_card_no
  ON staff(card_no)
  WHERE card_no IS NOT NULL;

COMMENT ON COLUMN staff.card_no IS 'RFID kart numarası — kiosk kapı girişi için kullanılır';
