import express from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { body, validationResult } from 'express-validator';
import db from '../config/database.js';
import { log as activityLog } from '../utils/activityLogger.js';
import { getInstitutionWhatsApp, setInstitutionWhatsApp } from '../utils/appSettings.js';
import { CONSENT_VERSION, getConsentStatus, getLegalLinks, setLegalLinks, recordConsent } from '../utils/legalConsent.js';
import { toPhoneFormat } from '../utils/phone.js';
import { sendExpoPushBulk } from '../utils/pushNotifications.js';

const router = express.Router();

function buildUserProfile(row) {
  let fullName = row.username;
  if (row.display_name && String(row.display_name).trim()) {
    fullName = String(row.display_name).trim();
  } else if (row.role === 'admin') {
    fullName = 'Admin';
  } else if (row.member_first_name || row.member_last_name) {
    fullName = `${row.member_first_name || ''} ${row.member_last_name || ''}`.trim();
  } else if (row.first_name || row.last_name) {
    fullName = `${row.first_name || ''} ${row.last_name || ''}`.trim();
  }
  return {
    id: row.id,
    username: row.username,
    email: row.email,
    role: row.role,
    staffId: row.staff_id ?? null,
    memberId: row.member_id ?? null,
    mustChangePassword: !!row.must_change_password,
    fullName,
    phone: row.user_phone || row.phone || row.member_phone || null,
  };
}

// JWT token oluştur
const generateToken = (userId, role, rememberMe) => {
  return jwt.sign(
    { userId, role },
    process.env.JWT_SECRET,
    { expiresIn: rememberMe ? (process.env.JWT_REMEMBER_EXPIRES_IN || '30d') : (process.env.JWT_EXPIRES_IN || '24h') }
  );
};

// Token doğrula (middleware için)
export const verifyToken = async (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1]; // Bearer token

  if (!token) {
    return res.status(401).json({ error: 'Token bulunamadı' });
  }

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch (error) {
    return res.status(401).json({ error: 'Geçersiz token' });
  }

  // Token imzası geçerli olsa da hesap deaktif edilmiş veya üyelik silinmişse
  // (admin tarafından) erişimi anında kes — token süresini doldurmasını bekleme.
  try {
    const result = await db.query(
      `SELECT u.is_active, m.deleted_at AS member_deleted_at
       FROM users u
       LEFT JOIN members m ON m.user_id = u.id
       WHERE u.id = $1`,
      [decoded.userId]
    );

    if (result.rows.length === 0 || !result.rows[0].is_active) {
      return res.status(401).json({ error: 'Hesabınız devre dışı bırakılmış. Lütfen yönetici ile iletişime geçin.' });
    }
    if (decoded.role === 'member' && result.rows[0].member_deleted_at) {
      return res.status(401).json({ error: 'Üyeliğiniz sonlandırılmış. Lütfen yönetici ile iletişime geçin.' });
    }

    req.user = decoded;
    next();
  } catch (error) {
    console.error('Token doğrulama hatası:', error);
    res.status(500).json({ error: 'Oturum doğrulanırken hata oluştu' });
  }
};

// Giriş yap
router.post('/login', [
  body('email').trim().notEmpty().withMessage('E-posta gerekli'),
  body('password').notEmpty().withMessage('Şifre gerekli')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password, rememberMe } = req.body;
    const loginEmail = String(email).trim();

    const result = await db.query(
      `SELECT u.*, s.id AS staff_id, s.first_name, s.last_name, s.phone,
              m.id AS member_id, m.first_name AS member_first_name, m.last_name AS member_last_name,
              m.phone AS member_phone, u.phone AS user_phone
       FROM users u
       LEFT JOIN staff s ON u.id = s.user_id
       LEFT JOIN members m ON m.user_id = u.id AND (m.deleted_at IS NULL)
       WHERE u.is_active = true AND (u.username = $1 OR LOWER(u.email) = LOWER($1))`,
      [loginEmail]
    );

    if (result.rows.length === 0) {
      await activityLog(req, { action: 'auth.login_failed', details: { email: loginEmail, reason: 'user_not_found' } }).catch(() => {});
      return res.status(401).json({ error: 'E-posta veya şifre hatalı' });
    }

    const user = result.rows[0];

    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      await activityLog(req, { action: 'auth.login_failed', details: { email: loginEmail, reason: 'invalid_password' } }).catch(() => {});
      return res.status(401).json({ error: 'E-posta veya şifre hatalı' });
    }

    if (user.role === 'member' && !user.member_id) {
      await activityLog(req, { action: 'auth.login_failed', details: { email: loginEmail, reason: 'member_record_missing' } }).catch(() => {});
      return res.status(401).json({ error: 'Üyelik kaydı bulunamadı. Yönetici ile iletişime geçin.' });
    }

    // Token oluştur
    const token = generateToken(user.id, user.role, !!rememberMe);

    await activityLog(req, {
      action: 'auth.login',
      entityType: 'user',
      entityId: user.id,
      details: { role: user.role },
      actorId: user.id,
      actorType: 'user',
      actorName: buildUserProfile(user).fullName,
    }).catch(() => {});

    res.json({
      token,
      user: {
        ...buildUserProfile(user),
        ...(await getConsentStatus(user.id)),
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Giriş yapılırken bir hata oluştu' });
  }
});

// Oturum açmış kullanıcı bilgisi
router.get('/me', verifyToken, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT u.id, u.username, u.email, u.role, u.must_change_password, u.display_name,
              s.id AS staff_id, s.first_name, s.last_name, s.phone,
              m.id AS member_id, m.first_name AS member_first_name, m.last_name AS member_last_name,
              m.phone AS member_phone, u.phone AS user_phone
       FROM users u
       LEFT JOIN staff s ON s.user_id = u.id
       LEFT JOIN members m ON m.user_id = u.id AND (m.deleted_at IS NULL)
       WHERE u.id = $1 AND u.is_active = true`,
      [req.user.userId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Kullanıcı bulunamadı' });
    }
    res.json({
      ...buildUserProfile(result.rows[0]),
      ...(await getConsentStatus(req.user.userId)),
    });
  } catch (error) {
    console.error('Auth me error:', error);
    res.status(500).json({ error: 'Kullanıcı bilgisi alınırken hata oluştu' });
  }
});

// KVKK onayını kaydet
router.post('/consent', verifyToken, async (req, res) => {
  try {
    const ip = req.ip || (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || null;
    await recordConsent(req.user.userId, ip);
    await activityLog(req, {
      action: 'auth.consent_accept',
      entityType: 'user',
      entityId: req.user.userId,
      actorId: req.user.userId,
      actorType: 'user',
      details: { consentVersion: CONSENT_VERSION },
    }).catch(() => {});
    res.json({ consentRequired: false, consentVersion: CONSENT_VERSION });
  } catch (error) {
    console.error('Consent accept error:', error);
    res.status(500).json({ error: 'Onayınız kaydedilemedi' });
  }
});

// Yasal sayfa bağlantıları (herkese açık — onay ekranı ve giriş sayfası için)
router.get('/legal-links', async (req, res) => {
  try {
    const links = await getLegalLinks();
    res.json(links);
  } catch (error) {
    console.error('Legal links get error:', error);
    res.status(500).json({ error: 'Bağlantılar alınırken hata oluştu' });
  }
});

// İlk girişte şifre belirleme (must_change_password=true iken)
router.post('/set-password', verifyToken, [
  body('newPassword').isLength({ min: 4 }).withMessage('Şifre en az 4 karakter olmalı'),
  body('confirmPassword').custom((value, { req }) => {
    if (value !== req.body.newPassword) throw new Error('Şifreler eşleşmiyor');
    return true;
  })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const msg = errors.array()[0]?.msg || 'Geçersiz veri';
      return res.status(400).json({ error: msg });
    }

    const userRes = await db.query('SELECT id, must_change_password FROM users WHERE id = $1', [req.user.userId]);
    if (userRes.rows.length === 0) {
      return res.status(404).json({ error: 'Kullanıcı bulunamadı' });
    }
    if (!userRes.rows[0].must_change_password) {
      return res.status(400).json({ error: 'Şifre zaten belirlenmiş. Bu işlem yalnızca ilk giriş içindir.' });
    }

    const { newPassword } = req.body;
    const passwordHash = await bcrypt.hash(newPassword, 10);
    await db.query(
      'UPDATE users SET password_hash = $1, must_change_password = false, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [passwordHash, req.user.userId]
    );

    await activityLog(req, {
      action: 'auth.set_password',
      entityType: 'user',
      entityId: req.user.userId,
      actorId: req.user.userId,
      actorType: 'user'
    }).catch(() => {});

    res.json({ message: 'Şifreniz kaydedildi', mustChangePassword: false });
  } catch (error) {
    console.error('Set password error:', error);
    res.status(500).json({ error: 'Şifre kaydedilirken hata oluştu' });
  }
});

// Giriş yapmış kullanıcı şifre değiştirme (admin profil vb.)
router.post('/change-password', verifyToken, [
  body('currentPassword').notEmpty().withMessage('Mevcut şifre gerekli'),
  body('newPassword').isLength({ min: 4 }).withMessage('Yeni şifre en az 4 karakter olmalı'),
  body('confirmPassword').custom((value, { req }) => {
    if (value !== req.body.newPassword) throw new Error('Şifreler eşleşmiyor');
    return true;
  })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const msg = errors.array()[0]?.msg || 'Geçersiz veri';
      return res.status(400).json({ error: msg });
    }

    const { currentPassword, newPassword } = req.body;
    const userRes = await db.query(
      'SELECT id, password_hash FROM users WHERE id = $1 AND is_active = true',
      [req.user.userId]
    );
    if (userRes.rows.length === 0) {
      return res.status(404).json({ error: 'Kullanıcı bulunamadı' });
    }

    const user = userRes.rows[0];
    const valid = await bcrypt.compare(currentPassword, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Mevcut şifre hatalı' });
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await db.query(
      'UPDATE users SET password_hash = $1, must_change_password = false, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [passwordHash, user.id]
    );

    await activityLog(req, {
      action: 'auth.change_password',
      entityType: 'user',
      entityId: user.id,
      actorId: user.id,
      actorType: 'user'
    }).catch(() => {});

    res.json({ message: 'Şifreniz güncellendi' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ error: 'Şifre güncellenirken hata oluştu' });
  }
});

// Hesap bilgilerini güncelle (admin panel – profil + isteğe bağlı şifre + kurum WhatsApp)
router.put('/account', verifyToken, [
  body('fullName').optional().trim().isLength({ min: 1, max: 100 }).withMessage('Ad soyad gerekli'),
  body('email').optional().trim().isEmail().withMessage('Geçerli e-posta girin'),
  body('phone').optional({ nullable: true }).isString(),
  body('whatsapp').optional({ nullable: true }).isString(),
  body('legalLinks').optional().isObject(),
  body('currentPassword').optional().isString(),
  body('newPassword').optional().isLength({ min: 4 }).withMessage('Yeni şifre en az 4 karakter olmalı'),
  body('confirmPassword').optional().isString(),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const msg = errors.array()[0]?.msg || 'Geçersiz veri';
      return res.status(400).json({ error: msg });
    }

    const {
      fullName,
      email,
      phone,
      whatsapp,
      legalLinks,
      currentPassword,
      newPassword,
      confirmPassword,
    } = req.body || {};

    const userRes = await db.query(
      'SELECT id, email, username, password_hash, role FROM users WHERE id = $1 AND is_active = true',
      [req.user.userId]
    );
    if (userRes.rows.length === 0) {
      return res.status(404).json({ error: 'Kullanıcı bulunamadı' });
    }
    const user = userRes.rows[0];

    let memberRow = null;
    if (user.role === 'member') {
      const memberRes = await db.query(
        'SELECT id, first_name, last_name, phone, email FROM members WHERE user_id = $1 AND deleted_at IS NULL',
        [user.id]
      );
      memberRow = memberRes.rows[0] || null;
    }

    if (newPassword != null && String(newPassword).trim()) {
      if (newPassword !== confirmPassword) {
        return res.status(400).json({ error: 'Şifreler eşleşmiyor' });
      }
      if (!currentPassword) {
        return res.status(400).json({ error: 'Mevcut şifrenizi girin' });
      }
      const valid = await bcrypt.compare(currentPassword, user.password_hash);
      if (!valid) {
        return res.status(401).json({ error: 'Mevcut şifre hatalı' });
      }
      const passwordHash = await bcrypt.hash(newPassword, 10);
      await db.query(
        'UPDATE users SET password_hash = $1, must_change_password = false, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
        [passwordHash, user.id]
      );
    }

    if (fullName != null) {
      const name = String(fullName).trim();
      if (!name) return res.status(400).json({ error: 'Ad soyad boş olamaz' });
      await db.query(
        'UPDATE users SET display_name = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
        [name, user.id]
      );
      if (memberRow) {
        const parts = name.split(/\s+/);
        const firstName = parts.shift() || '';
        const lastName = parts.join(' ');
        await db.query(
          'UPDATE members SET first_name = $1, last_name = $2, name = $3, updated_at = CURRENT_TIMESTAMP WHERE id = $4',
          [firstName, lastName, name, memberRow.id]
        );
      }
    }

    if (email != null) {
      const emailTrim = String(email).trim().toLowerCase();
      const dup = await db.query(
        'SELECT id FROM users WHERE LOWER(email) = $1 AND id != $2',
        [emailTrim, user.id]
      );
      if (dup.rows.length > 0) {
        return res.status(409).json({ error: 'Bu e-posta başka bir hesapta kayıtlı' });
      }
      await db.query(
        'UPDATE users SET email = $1, username = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
        [emailTrim, user.id]
      );
      if (memberRow) {
        await db.query(
          'UPDATE members SET email = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
          [emailTrim, memberRow.id]
        );
      }
    }

    if (phone !== undefined) {
      let phoneVal = null;
      if (phone != null && String(phone).trim() !== '') {
        phoneVal = toPhoneFormat(phone);
        if (!phoneVal) {
          return res.status(400).json({ error: 'Telefon (xxx)xxx-xx-xx formatında olmalı, 10 hane.' });
        }
      }
      if (memberRow && phoneVal) {
        const dup = await db.query(
          'SELECT id FROM members WHERE trim(phone) = $1 AND id != $2',
          [phoneVal, memberRow.id]
        );
        if (dup.rows.length > 0) {
          return res.status(409).json({ error: 'Bu telefon numarası başka bir üyede kayıtlı.' });
        }
      }
      await db.query(
        'UPDATE users SET phone = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
        [phoneVal, user.id]
      );
      if (memberRow) {
        await db.query(
          'UPDATE members SET phone = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
          [phoneVal, memberRow.id]
        );
      }
    }

    if (whatsapp !== undefined && (user.role === 'admin' || user.role === 'manager')) {
      if (whatsapp == null || String(whatsapp).trim() === '') {
        await db.query(
          `INSERT INTO app_settings (key, value, updated_at) VALUES ('institution_whatsapp', NULL, CURRENT_TIMESTAMP)
           ON CONFLICT (key) DO UPDATE SET value = NULL, updated_at = CURRENT_TIMESTAMP`
        );
      } else {
        try {
          await setInstitutionWhatsApp(whatsapp);
        } catch (err) {
          if (err.code === 'INVALID_WHATSAPP') {
            return res.status(400).json({
              error: 'Geçerli bir WhatsApp numarası girin (ülke kodu ile, 10–15 hane).',
            });
          }
          throw err;
        }
      }
    }

    if (legalLinks !== undefined && legalLinks && typeof legalLinks === 'object' && (user.role === 'admin' || user.role === 'manager')) {
      await setLegalLinks(legalLinks);
    }

    const profileRes = await db.query(
      `SELECT u.id, u.username, u.email, u.role, u.must_change_password, u.display_name,
              s.id AS staff_id, s.first_name, s.last_name, s.phone,
              m.id AS member_id, m.first_name AS member_first_name, m.last_name AS member_last_name,
              m.phone AS member_phone, u.phone AS user_phone
       FROM users u
       LEFT JOIN staff s ON s.user_id = u.id
       LEFT JOIN members m ON m.user_id = u.id AND (m.deleted_at IS NULL)
       WHERE u.id = $1`,
      [user.id]
    );

    const profile = {
      ...buildUserProfile(profileRes.rows[0]),
      ...(await getConsentStatus(user.id)),
    };
    let institutionWhatsapp = '';
    let legalLinksOut;
    if (user.role === 'admin' || user.role === 'manager') {
      institutionWhatsapp = (await getInstitutionWhatsApp()) || '';
      legalLinksOut = await getLegalLinks();
    }

    await activityLog(req, {
      action: 'auth.account_update',
      entityType: 'user',
      entityId: user.id,
      actorId: user.id,
      actorType: 'user',
      details: {
        emailChanged: email != null,
        passwordChanged: !!(newPassword && String(newPassword).trim()),
        whatsappChanged: whatsapp !== undefined,
        legalLinksChanged: legalLinks !== undefined,
      },
    }).catch(() => {});

    res.json({
      message: 'Bilgileriniz güncellendi',
      user: profile,
      institutionWhatsapp,
      ...(legalLinksOut ? { legalLinks: legalLinksOut } : {}),
    });
  } catch (error) {
    console.error('Account update error:', error);
    res.status(500).json({ error: 'Hesap bilgileri güncellenirken hata oluştu' });
  }
});

// Token yenile
router.post('/refresh', verifyToken, (req, res) => {
  const newToken = generateToken(req.user.userId, req.user.role);
  res.json({ token: newToken });
});

// Çıkış yap (client-side token silinir)
router.post('/logout', verifyToken, async (req, res) => {
  // Push token bu kullanıcıya bağlı kalmasın: cihazda kim login olursa push-token
  // endpoint'i tekrar register eder; aksi halde bir önceki kullanıcı bildirim almaya devam eder
  await db.query('DELETE FROM push_tokens WHERE user_id = $1', [req.user.userId]).catch(() => {});
  res.json({ message: 'Başarıyla çıkış yapıldı' });
});

// Mevcut kullanıcının şifresini doğrula (hassas işlemler için admin onayı)
router.post('/verify-password', verifyToken, [
  body('password').notEmpty().withMessage('Şifre gerekli'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Şifre gerekli' });
    }
    const { password } = req.body;
    const { userId } = req.user;
    const userRes = await db.query('SELECT password_hash FROM users WHERE id = $1', [userId]);
    if (userRes.rows.length === 0) {
      return res.status(404).json({ error: 'Kullanıcı bulunamadı' });
    }
    const valid = await bcrypt.compare(password, userRes.rows[0].password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Şifre hatalı' });
    }
    res.json({ ok: true });
  } catch (error) {
    console.error('Verify password error:', error);
    res.status(500).json({ error: 'Şifre doğrulanamadı' });
  }
});

// Şifremi unuttum — herkese açık, e-posta ile talep oluştur
router.post('/forgot-password', [
  body('email').trim().isEmail().withMessage('Geçerli bir e-posta girin'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: errors.array()[0]?.msg || 'Geçersiz e-posta' });
    }

    const email = String(req.body.email).trim().toLowerCase();

    // Kullanıcı var mı kontrol et (ama bilgi sızdırmamak için hep 200 döndür)
    const userRes = await db.query(
      `SELECT u.id, u.display_name,
              m.first_name AS member_first_name, m.last_name AS member_last_name,
              s.first_name AS staff_first_name, s.last_name AS staff_last_name
       FROM users u
       LEFT JOIN members m ON m.user_id = u.id AND m.deleted_at IS NULL
       LEFT JOIN staff s ON s.user_id = u.id
       WHERE LOWER(u.email) = $1 AND u.is_active = true`,
      [email]
    );

    if (userRes.rows.length > 0) {
      const user = userRes.rows[0];

      // Aynı e-posta için zaten bekleyen talep varsa yeni oluşturma
      const existing = await db.query(
        "SELECT id FROM password_reset_requests WHERE email = $1 AND status = 'pending'",
        [email]
      );
      if (existing.rows.length === 0) {
        await db.query(
          'INSERT INTO password_reset_requests (email) VALUES ($1)',
          [email]
        );

        // Kullanıcının adını belirle (bildirim için)
        let fullName = email;
        if (user.display_name && String(user.display_name).trim()) {
          fullName = String(user.display_name).trim();
        } else if (user.member_first_name || user.member_last_name) {
          fullName = `${user.member_first_name || ''} ${user.member_last_name || ''}`.trim();
        } else if (user.staff_first_name || user.staff_last_name) {
          fullName = `${user.staff_first_name || ''} ${user.staff_last_name || ''}`.trim();
        }

        // Tüm admin ve manager'lara push bildirimi gönder
        const adminRes = await db.query(
          "SELECT id FROM users WHERE role IN ('admin', 'manager') AND is_active = true"
        );
        if (adminRes.rows.length > 0) {
          const adminIds = adminRes.rows.map((r) => r.id);
          sendExpoPushBulk(db, adminIds, 'Şifre Talebi', `${fullName} şifre sıfırlama talebi göndermiştir.`).catch(() => {});
        }
      }
    }

    // Kullanıcı var ya da yok — her iki durumda da aynı yanıt (güvenlik)
    res.json({ message: 'Talebiniz alındı. Yönetici en kısa sürede sizinle iletişime geçecektir.' });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ error: 'Talep oluşturulurken hata oluştu' });
  }
});

// Şifre sıfırlama taleplerini listele — sadece admin/manager
router.get('/password-reset-requests', verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin' && req.user.role !== 'manager') {
      return res.status(403).json({ error: 'Yetki yok' });
    }
    const result = await db.query(
      `SELECT r.id, r.email, r.status, r.created_at, r.handled_at,
              u.display_name AS handled_by_name
       FROM password_reset_requests r
       LEFT JOIN users u ON u.id = r.handled_by_user_id
       WHERE r.status = 'pending'
       ORDER BY r.created_at ASC`
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Password reset requests list error:', error);
    res.status(500).json({ error: 'Talepler alınırken hata oluştu' });
  }
});

// Şifre sıfırlama talebini işle — şifreyi sıfırla ve talebi kapat
router.post('/password-reset-requests/:id/reset', verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin' && req.user.role !== 'manager') {
      return res.status(403).json({ error: 'Yetki yok' });
    }

    const { id } = req.params;
    const requestRes = await db.query(
      "SELECT id, email FROM password_reset_requests WHERE id = $1 AND status = 'pending'",
      [id]
    );
    if (requestRes.rows.length === 0) {
      return res.status(404).json({ error: 'Talep bulunamadı veya zaten işlendi' });
    }
    const email = requestRes.rows[0].email;

    const userRes = await db.query(
      `SELECT u.id, u.phone, s.phone AS staff_phone, m.phone AS member_phone
       FROM users u
       LEFT JOIN staff s ON s.user_id = u.id
       LEFT JOIN members m ON m.user_id = u.id AND m.deleted_at IS NULL
       WHERE LOWER(u.email) = LOWER($1) AND u.is_active = true`,
      [email]
    );
    if (userRes.rows.length === 0) {
      return res.status(404).json({ error: 'Bu e-postaya ait aktif kullanıcı bulunamadı' });
    }
    const user = userRes.rows[0];

    // Geçici şifre: telefon son 4 hane, yoksa rastgele 4 rakam
    const phone = user.phone || user.staff_phone || user.member_phone || '';
    const digits = phone.replace(/\D/g, '');
    const tempPassword = digits.length >= 4 ? digits.slice(-4) : String(Math.floor(1000 + Math.random() * 9000));

    const passwordHash = await bcrypt.hash(tempPassword, 10);
    await db.query(
      'UPDATE users SET password_hash = $1, must_change_password = true, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [passwordHash, user.id]
    );

    await db.query(
      `UPDATE password_reset_requests
       SET status = 'handled', handled_at = CURRENT_TIMESTAMP, handled_by_user_id = $1
       WHERE id = $2`,
      [req.user.userId, id]
    );

    await activityLog(req, {
      action: 'auth.reset_password_request_handled',
      entityType: 'user',
      entityId: user.id,
      details: { email },
    }).catch(() => {});

    res.json({
      message: 'Şifre sıfırlandı',
      loginEmail: email,
      temporaryPassword: tempPassword,
    });
  } catch (error) {
    console.error('Password reset request handle error:', error);
    res.status(500).json({ error: 'Şifre sıfırlanırken hata oluştu' });
  }
});

router.post('/push-token', verifyToken, async (req, res) => {
  const { token } = req.body;
  if (!token || typeof token !== 'string') {
    return res.status(400).json({ error: 'Token gerekli' });
  }
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    // Aynı fiziksel token başka kullanıcılarda varsa sil — transaction içinde atomik
    await client.query(
      'DELETE FROM push_tokens WHERE token = $1 AND user_id != $2',
      [token, req.user.userId]
    );
    // UNIQUE(token) constraint'i sayesinde ON CONFLICT DO UPDATE yeterli
    await client.query(
      `INSERT INTO push_tokens (user_id, token)
       VALUES ($1, $2)
       ON CONFLICT (token) DO UPDATE SET user_id = $1, updated_at = CURRENT_TIMESTAMP`,
      [req.user.userId, token]
    );
    await client.query('COMMIT');
    res.json({ ok: true });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Push token kayıt hatası:', error);
    res.status(500).json({ error: 'Token kaydedilemedi' });
  } finally {
    client.release();
  }
});

export default router;
