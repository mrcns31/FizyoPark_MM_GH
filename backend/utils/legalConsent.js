import db from '../config/database.js';

export const CONSENT_VERSION = '2026-06-14';

export const DEFAULT_LEGAL_LINKS = {
  privacyPolicyUrl: 'https://fizyopark.com.tr/privacy-policy',
  explicitConsentUrl: 'https://fizyopark.com.tr/explicit-consent-text',
  termsOfUseUrl: 'https://fizyopark.com.tr/membership-and-terms-of-use',
  cookiePolicyUrl: 'https://fizyopark.com.tr/cookie-policy',
};

const LEGAL_LINK_KEYS = {
  privacyPolicyUrl: 'legal_privacy_policy_url',
  explicitConsentUrl: 'legal_explicit_consent_url',
  termsOfUseUrl: 'legal_terms_of_use_url',
  cookiePolicyUrl: 'legal_cookie_policy_url',
};

export async function getLegalLinks() {
  const keys = Object.values(LEGAL_LINK_KEYS);
  let stored = {};
  try {
    const result = await db.query('SELECT key, value FROM app_settings WHERE key = ANY($1)', [keys]);
    result.rows.forEach((row) => {
      stored[row.key] = row.value;
    });
  } catch (err) {
    if (err.code !== '42P01') throw err;
  }
  const links = {};
  for (const [field, key] of Object.entries(LEGAL_LINK_KEYS)) {
    const value = stored[key];
    links[field] = (value != null && String(value).trim()) ? String(value).trim() : DEFAULT_LEGAL_LINKS[field];
  }
  return links;
}

export async function setLegalLinks(input) {
  const updates = [];
  for (const field of Object.keys(LEGAL_LINK_KEYS)) {
    if (!(field in input)) continue;
    const key = LEGAL_LINK_KEYS[field];
    const raw = input[field];
    const value = (raw != null && String(raw).trim()) ? String(raw).trim() : null;
    updates.push(
      db.query(
        `INSERT INTO app_settings (key, value, updated_at) VALUES ($1, $2, CURRENT_TIMESTAMP)
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = CURRENT_TIMESTAMP`,
        [key, value]
      )
    );
  }
  await Promise.all(updates);
  return getLegalLinks();
}

export async function getConsentStatus(userId) {
  const result = await db.query(
    'SELECT 1 FROM user_consents WHERE user_id = $1 AND consent_version = $2',
    [userId, CONSENT_VERSION]
  );
  return { consentRequired: result.rows.length === 0, consentVersion: CONSENT_VERSION };
}

export async function recordConsent(userId, ipAddress) {
  await db.query(
    'INSERT INTO user_consents (user_id, consent_version, ip_address) VALUES ($1, $2, $3)',
    [userId, CONSENT_VERSION, ipAddress || null]
  );
}
