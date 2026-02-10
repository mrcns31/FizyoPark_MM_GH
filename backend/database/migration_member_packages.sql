-- Üye–paket ataması: hangi üye hangi paketi, hangi tarih aralığında kullanıyor
CREATE TABLE IF NOT EXISTS member_packages (
    id SERIAL PRIMARY KEY,
    member_id INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    package_id INTEGER NOT NULL REFERENCES packages(id) ON DELETE RESTRICT,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    skip_day_distribution BOOLEAN DEFAULT false,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT valid_date_range CHECK (end_date >= start_date)
);

-- Paket gün dağılımı: haftalık hangi gün, saat ve personel
CREATE TABLE IF NOT EXISTS member_package_slots (
    id SERIAL PRIMARY KEY,
    member_package_id INTEGER NOT NULL REFERENCES member_packages(id) ON DELETE CASCADE,
    day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
    start_time VARCHAR(5) NOT NULL,
    staff_id INTEGER NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(member_package_id, day_of_week)
);

-- Seansları paket atamasına bağlamak (hangi seans hangi paketten kullanıldı)
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS member_package_id INTEGER REFERENCES member_packages(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_member_packages_member_id ON member_packages(member_id);
CREATE INDEX IF NOT EXISTS idx_member_packages_package_id ON member_packages(package_id);
CREATE INDEX IF NOT EXISTS idx_member_packages_status ON member_packages(status);
CREATE INDEX IF NOT EXISTS idx_member_package_slots_member_package_id ON member_package_slots(member_package_id);
CREATE INDEX IF NOT EXISTS idx_sessions_member_package_id ON sessions(member_package_id);

CREATE TRIGGER update_member_packages_updated_at
    BEFORE UPDATE ON member_packages
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
