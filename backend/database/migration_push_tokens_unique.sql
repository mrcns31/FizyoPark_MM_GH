-- Bir push token'ı yalnızca TEK kullanıcıya ait olabilir.
-- Eski UNIQUE(user_id, token) aynı token'ı birden fazla user_id'ye izin veriyordu.
-- Bu migration: önce kirli veriyi temizler, sonra token'a tek-kullanıcı constraint'i ekler.

-- 1. Aynı token'a sahip birden fazla satır varsa en son güncellenenler HARIÇ sil
DELETE FROM push_tokens
WHERE id NOT IN (
  SELECT DISTINCT ON (token) id
  FROM push_tokens
  ORDER BY token, updated_at DESC
);

-- 2. Eski (user_id, token) unique constraint'i kaldır
ALTER TABLE push_tokens DROP CONSTRAINT IF EXISTS push_tokens_user_id_token_key;

-- 3. Token'a tek başına UNIQUE constraint ekle (bir token = bir cihaz = bir kullanıcı)
ALTER TABLE push_tokens ADD CONSTRAINT push_tokens_token_key UNIQUE (token);
