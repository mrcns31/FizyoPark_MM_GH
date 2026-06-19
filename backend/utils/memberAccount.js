import bcrypt from 'bcrypt';
import { phoneLast4, phoneDigits } from './phone.js';

function resolveEmail(email, phone) {
  const trimmed = (email || '').trim();
  if (trimmed) return trimmed;
  const digits = phoneDigits(phone);
  return digits ? `${digits}@fizyopark.com` : null;
}

/**
 * Üye için giriş hesabı oluşturur veya günceller.
 * Kullanıcı adı = e-posta, geçici şifre = telefon son 4 hane.
 * @returns {Promise<number|null>} user_id
 */
export async function ensureMemberUserAccount(client, member) {
  const phone = member.phone;
  const email = resolveEmail(member.email, phone)?.toLowerCase() ?? '';
  if (!email || !phone) return member.user_id ?? null;

  const initialPassword = phoneLast4(phone);
  if (!initialPassword) return member.user_id ?? null;

  const passwordHash = await bcrypt.hash(initialPassword, 10);
  const username = email;

  if (member.user_id) {
    const userRes = await client.query(
      'SELECT id, email, username FROM users WHERE id = $1',
      [member.user_id]
    );
    if (userRes.rows.length > 0) {
      const existingEmail = (userRes.rows[0].email || '').toLowerCase();
      if (existingEmail !== email) {
        const dup = await client.query(
          `SELECT id FROM users WHERE (LOWER(email) = LOWER($1) OR username = $1) AND id != $2`,
          [email, member.user_id]
        );
        if (dup.rows.length > 0) {
          throw Object.assign(new Error('Bu e-posta adresi başka bir hesapta kayıtlı.'), { code: 'EMAIL_TAKEN' });
        }
      }
      await client.query(
        `UPDATE users SET username = $1, email = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3`,
        [username, email, member.user_id]
      );
      return member.user_id;
    }
  }

  const dup = await client.query(
    'SELECT id FROM users WHERE username = $1 OR LOWER(email) = LOWER($1)',
    [username]
  );
  if (dup.rows.length > 0) {
    throw Object.assign(new Error('Bu e-posta adresi zaten kayıtlı.'), { code: 'EMAIL_TAKEN' });
  }

  const userRes = await client.query(
    `INSERT INTO users (username, email, password_hash, role, must_change_password)
     VALUES ($1, $2, $3, 'member', true)
     RETURNING id`,
    [username, email, passwordHash]
  );
  const userId = userRes.rows[0].id;
  await client.query('UPDATE members SET user_id = $1 WHERE id = $2', [userId, member.id]);
  return userId;
}

/** Şifreyi telefon son 4 haneye sıfırla; hesap yoksa önce oluşturur (admin işlemi). */
export async function resetMemberPassword(client, memberId) {
  const res = await client.query(
    `SELECT m.id, m.email, m.phone, m.user_id FROM members m WHERE m.id = $1`,
    [memberId]
  );
  if (res.rows.length === 0) return null;
  const member = res.rows[0];
  const resolvedEmail = resolveEmail(member.email, member.phone);
  if (!resolvedEmail || !member.phone) return null;

  let userId = member.user_id;
  if (!userId) {
    userId = await ensureMemberUserAccount(client, member);
    if (!userId) return null;
  }

  const initialPassword = phoneLast4(member.phone);
  if (!initialPassword) return null;

  const passwordHash = await bcrypt.hash(initialPassword, 10);
  await client.query(
    `UPDATE users SET password_hash = $1, must_change_password = true, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
    [passwordHash, userId]
  );
  return {
    loginUsername: (await client.query('SELECT email FROM users WHERE id = $1', [userId])).rows[0]?.email,
    temporaryPassword: initialPassword,
  };
}
