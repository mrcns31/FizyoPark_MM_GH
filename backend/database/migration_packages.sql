-- Üyelerin satın alabileceği paket tanımları
CREATE TABLE IF NOT EXISTS packages (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    lesson_count INTEGER NOT NULL DEFAULT 1 CHECK (lesson_count >= 1),
    month_overrun INTEGER NOT NULL DEFAULT 1 CHECK (month_overrun >= 0),
    weekly_lesson_count INTEGER,
    package_type VARCHAR(20) DEFAULT 'fixed' CHECK (package_type IN ('fixed', 'flexible')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_packages_name ON packages(name);

DROP TRIGGER IF EXISTS update_packages_updated_at ON packages;
CREATE TRIGGER update_packages_updated_at
    BEFORE UPDATE ON packages
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
