-- Üye bildirim görüntüleme takibi: ne zaman in-app modal olarak gördü
ALTER TABLE broadcast_recipients ADD COLUMN IF NOT EXISTS seen_at TIMESTAMP NULL;
