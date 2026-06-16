-- facility_access_logs: üye girişlerinin yanı sıra personel girişlerini de destekle
-- member_id nullable hale geliyor, staff_id ekleniyor
ALTER TABLE facility_access_logs ALTER COLUMN member_id DROP NOT NULL;

ALTER TABLE facility_access_logs ADD COLUMN IF NOT EXISTS staff_id INTEGER REFERENCES staff(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_facility_access_logs_staff_id
  ON facility_access_logs(staff_id);
