import jwt from 'jsonwebtoken';
import { query } from '../config/db.js';

const COOKIE_NAME = 'monera_session';

export function getJwtSecret() {
  return process.env.JWT_SECRET || 'mnr_prod_vault_9f4b82e17c6d0a358e21b74f90c3a6d8e5f12094b7a3c8d1e6f0';
}

export function signUserToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      role: user.role,
      code: user.member_code,
    },
    getJwtSecret(),
    { expiresIn: process.env.JWT_EXPIRES_IN || '12h' }
  );
}

export function attachAuthCookie(res, token, req) {
  const isHttps = req.secure || req.headers['x-forwarded-proto'] === 'https';
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: Boolean(isHttps),
    sameSite: isHttps ? 'none' : 'lax',
    maxAge: 12 * 60 * 60 * 1000,
    path: '/',
  });
}

export function clearAuthCookie(res, req) {
  const isHttps = req.secure || req.headers['x-forwarded-proto'] === 'https';
  res.clearCookie(COOKIE_NAME, {
    httpOnly: true,
    secure: Boolean(isHttps),
    sameSite: isHttps ? 'none' : 'lax',
    path: '/',
  });
}

export function sanitizeUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    memberCode: row.member_code,
    rib: row.rib,
    fullName: row.full_name,
    email: row.email,
    phone: row.phone,
    country: row.country,
    role: row.role,
    status: row.status,
    balance: Number(row.balance),
    currency: row.currency || 'EUR',
    cardNumber: row.card_number,
    cardExpiry: row.card_expiry,
    cardCvv: row.card_cvv,
    cardFrozen: Boolean(row.card_frozen),
    createdAt: row.created_at,
  };
}

function extractToken(req) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const bearer = authHeader.slice(7).trim();
    if (bearer && bearer !== 'null' && bearer !== 'undefined') {
      return bearer;
    }
  }
  if (req.cookies && req.cookies[COOKIE_NAME]) {
    return req.cookies[COOKIE_NAME];
  }
  return null;
}

export async function requireAuth(req, res, next) {
  try {
    const token = extractToken(req);
    if (!token) {
      return res.status(401).json({ error: 'Authentification requise.' });
    }
    const decoded = jwt.verify(token, getJwtSecret());
    const { rows } = await query('SELECT * FROM users WHERE id = $1', [decoded.sub]);
    if (rows.length === 0) {
      return res.status(401).json({ error: 'Session expirée ou compte introuvable.' });
    }
    req.user = rows[0];
    return next();
  } catch {
    return res.status(401).json({ error: 'Session invalide ou expirée. Veuillez vous reconnecter.' });
  }
}

export function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Accès strictement réservé à la Direction Générale MONERA.' });
  }
  return next();
}
