import crypto from 'crypto';

/** QR geçerlilik penceresi (saniye) — 30–60 sn arası, kapı okuyucu için TOTP benzeri */
export const MEMBER_QR_WINDOW_SEC = 45;

function getSecret() {
  return process.env.MEMBER_QR_SECRET || process.env.JWT_SECRET || 'fp-mm-member-qr-dev-secret';
}

/** Üyeye özel, zaman pencereli erişim jetonu (HMAC). */
export function createMemberAccessToken(memberId) {
  const window = Math.floor(Date.now() / 1000 / MEMBER_QR_WINDOW_SEC);
  const payload = `${memberId}:${window}`;
  const sig = crypto.createHmac('sha256', getSecret()).update(payload).digest('hex').slice(0, 20);
  const token = `${memberId}.${window}.${sig}`;
  const nowSec = Math.floor(Date.now() / 1000);
  const expiresAt = (window + 1) * MEMBER_QR_WINDOW_SEC;
  return {
    token,
    memberId,
    window,
    expiresIn: Math.max(1, expiresAt - nowSec),
    windowSec: MEMBER_QR_WINDOW_SEC,
    qrPayload: JSON.stringify({ v: 1, mid: memberId, t: token, w: window }),
  };
}

/** Kapı okuyucu / mikrodenetleyici doğrulaması (ileride). */
export function verifyMemberAccessToken(token, expectedMemberId) {
  if (!token || typeof token !== 'string') return { valid: false, reason: 'empty' };
  const parts = token.split('.');
  if (parts.length !== 3) return { valid: false, reason: 'format' };
  const [midStr, windowStr, sig] = parts;
  const memberId = parseInt(midStr, 10);
  const window = parseInt(windowStr, 10);
  if (!memberId || Number.isNaN(window)) return { valid: false, reason: 'parse' };
  if (expectedMemberId != null && memberId !== Number(expectedMemberId)) {
    return { valid: false, reason: 'member_mismatch' };
  }
  const nowWindow = Math.floor(Date.now() / 1000 / MEMBER_QR_WINDOW_SEC);
  if (window < nowWindow - 1 || window > nowWindow + 1) {
    return { valid: false, reason: 'expired' };
  }
  const payload = `${memberId}:${window}`;
  const expected = crypto.createHmac('sha256', getSecret()).update(payload).digest('hex').slice(0, 20);
  if (sig !== expected) return { valid: false, reason: 'invalid_sig' };
  return { valid: true, memberId, window };
}
