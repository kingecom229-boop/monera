import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { getSiteSettings, logAudit, query, withTransaction } from '../config/db.js';
import {
  attachAuthCookie,
  clearAuthCookie,
  requireAuth,
  sanitizeUser,
  signUserToken,
} from '../middleware/auth.js';
import {
  generateCardCvv,
  generateCardExpiry,
  generateLuhnCardNumber,
  generateMemberCode,
  generateMoneraRib,
  generateTxReference,
  roundMoney,
} from '../utils/banking.js';

const router = Router();

const registerSchema = z.object({
  fullName: z.string().trim().min(2, 'Veuillez saisir votre nom complet.').max(120),
  email: z.string().trim().email('Adresse email invalide.').max(160),
  phone: z.string().trim().max(40).optional().default(''),
  country: z.string().trim().min(2).max(80).optional().default('France'),
  password: z.string().min(6, 'Le mot de passe doit contenir au moins 6 caractères.').max(128),
});

const loginSchema = z.object({
  email: z.string().trim().email('Adresse email invalide.'),
  password: z.string().min(1, 'Mot de passe requis.').max(128),
});

router.post('/register', async (req, res, next) => {
  try {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0].message });
    }

    const settings = await getSiteSettings();
    if (!settings.allowRegistration) {
      return res.status(403).json({
        error: "L'ouverture de nouveaux comptes en ligne est temporairement suspendue par la banque.",
      });
    }

    const { fullName, phone, country, password } = parsed.data;
    const email = parsed.data.email.toLowerCase();

    const existing = await query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rowCount > 0) {
      return res.status(409).json({ error: 'Un compte MONERA existe déjà avec cette adresse email.' });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const welcomeBonus = roundMoney(Math.max(0, Number(settings.welcomeBonus || 0)));

    const createdUser = await withTransaction(async (tx) => {
      let memberCode = generateMemberCode();
      const checkCode = await tx.query('SELECT id FROM users WHERE member_code = $1', [memberCode]);
      if (checkCode.rowCount > 0) memberCode = generateMemberCode();

      const insertRes = await tx.query(
        `INSERT INTO users (member_code, rib, full_name, email, phone, country, password_hash, role, status, balance, card_number, card_expiry, card_cvv)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'member', 'active', $8, $9, $10, $11)
         RETURNING *`,
        [
          memberCode,
          generateMoneraRib(),
          fullName,
          email,
          phone,
          country,
          passwordHash,
          welcomeBonus,
          generateLuhnCardNumber('492984'),
          generateCardExpiry(),
          generateCardCvv(),
        ]
      );
      const user = insertRes.rows[0];

      if (welcomeBonus > 0) {
        await tx.query(
          `INSERT INTO transactions (reference, type, sender_id, recipient_id, sender_snapshot, recipient_snapshot, amount, status, credited_to_recipient, description)
           VALUES ($1, 'admin_credit', NULL, $2, 'MONERA Trésorerie', $3, $4, 'completed', TRUE, 'Prime de bienvenue ouverture de compte MONERA')`,
          [generateTxReference('WELCOME'), user.id, `${user.full_name} (${user.member_code})`, welcomeBonus]
        );
      }

      await tx.query(
        `INSERT INTO notifications (user_id, title, message, category)
         VALUES ($1, 'Compte MONERA activé avec succès', $2, 'security')`,
        [
          user.id,
          `Bienvenue ${user.full_name}. Votre identifiant bancaire unique ${user.member_code}, votre RIB-MONERA et votre messagerie d'assistance sont opérationnels.`,
        ]
      );

      await tx.query(
        `INSERT INTO support_messages (member_id, sender_role, sender_id, content, read_by_member, read_by_admin)
         VALUES ($1, 'admin', NULL, $2, FALSE, TRUE)`,
        [
          user.id,
          `Bienvenue ${user.full_name} chez MONERA Private Banking. Votre Conseiller dédié est disponible ici pour toute question ou pour vous transmettre vos codes de validation lors de vos virements vers d'autres banques.`,
        ]
      );

      await logAudit({
        client: tx,
        actorId: user.id,
        actorEmail: user.email,
        action: 'MEMBER_REGISTERED',
        targetType: 'user',
        targetId: user.id,
        ipAddress: req.ip,
        metadata: { memberCode: user.member_code, country: user.country },
      });

      return user;
    });

    const token = signUserToken(createdUser);
    attachAuthCookie(res, token, req);

    return res.status(201).json({
      token,
      user: sanitizeUser(createdUser),
    });
  } catch (err) {
    return next(err);
  }
});

router.post('/login', async (req, res, next) => {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0].message });
    }

    const email = parsed.data.email.toLowerCase();
    const { password } = parsed.data;

    const { rows } = await query('SELECT * FROM users WHERE email = $1', [email]);
    if (rows.length === 0) {
      await logAudit({
        actorEmail: email,
        action: 'LOGIN_FAILED_UNKNOWN_EMAIL',
        ipAddress: req.ip,
      });
      return res.status(401).json({ error: 'Identifiants incorrects. Vérifiez votre email et votre mot de passe.' });
    }

    const user = rows[0];

    if (user.locked_until && new Date(user.locked_until) > new Date()) {
      return res.status(423).json({
        error: 'Compte temporairement protégé suite à plusieurs tentatives infructueuses. Réessayez dans quelques minutes.',
      });
    }

    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      const attempts = Number(user.failed_login_attempts || 0) + 1;
      const lockUntil = attempts >= 8 ? new Date(Date.now() + 5 * 60 * 1000).toISOString() : null;
      await query(
        'UPDATE users SET failed_login_attempts = $1, locked_until = $2 WHERE id = $3',
        [attempts, lockUntil, user.id]
      );
      await logAudit({
        actorId: user.id,
        actorEmail: user.email,
        action: 'LOGIN_FAILED_BAD_PASSWORD',
        targetType: 'user',
        targetId: user.id,
        ipAddress: req.ip,
        metadata: { attempts },
      });
      return res.status(401).json({ error: 'Identifiants incorrects. Vérifiez votre email et votre mot de passe.' });
    }

    const settings = await getSiteSettings();
    if (settings.maintenanceMode && user.role !== 'admin') {
      return res.status(503).json({
        error: 'Plateforme en cours de maintenance sécurité programmée. Réessayez ultérieurement.',
      });
    }

    await query(
      'UPDATE users SET failed_login_attempts = 0, locked_until = NULL, updated_at = NOW() WHERE id = $1',
      [user.id]
    );

    await logAudit({
      actorId: user.id,
      actorEmail: user.email,
      action: user.role === 'admin' ? 'ADMIN_LOGIN_SUCCESS' : 'MEMBER_LOGIN_SUCCESS',
      targetType: 'user',
      targetId: user.id,
      ipAddress: req.ip,
    });

    const token = signUserToken(user);
    attachAuthCookie(res, token, req);

    return res.json({
      token,
      user: sanitizeUser(user),
    });
  } catch (err) {
    return next(err);
  }
});

router.post('/logout', requireAuth, async (req, res, next) => {
  try {
    clearAuthCookie(res, req);
    await logAudit({
      actorId: req.user.id,
      actorEmail: req.user.email,
      action: 'USER_LOGOUT',
      ipAddress: req.ip,
    });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

router.get('/me', requireAuth, async (req, res, next) => {
  try {
    const settings = await getSiteSettings();
    res.json({
      user: sanitizeUser(req.user),
      settings,
    });
  } catch (err) {
    next(err);
  }
});

router.patch('/profile', requireAuth, async (req, res, next) => {
  try {
    const schema = z.object({
      fullName: z.string().trim().min(2).max(120),
      phone: z.string().trim().max(40).default(''),
      country: z.string().trim().min(2).max(80).default('France'),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0].message });
    }
    const { fullName, phone, country } = parsed.data;
    const { rows } = await query(
      `UPDATE users SET full_name = $1, phone = $2, country = $3, updated_at = NOW()
       WHERE id = $4 RETURNING *`,
      [fullName, phone, country, req.user.id]
    );
    return res.json({ user: sanitizeUser(rows[0]) });
  } catch (err) {
    return next(err);
  }
});

router.patch('/password', requireAuth, async (req, res, next) => {
  try {
    const schema = z.object({
      currentPassword: z.string().min(1),
      newPassword: z.string().min(6, 'Le nouveau mot de passe doit contenir au moins 6 caractères.').max(128),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0].message });
    }
    const matches = await bcrypt.compare(parsed.data.currentPassword, req.user.password_hash);
    if (!matches) {
      return res.status(400).json({ error: 'Le mot de passe actuel est incorrect.' });
    }
    const newHash = await bcrypt.hash(parsed.data.newPassword, 12);
    await query('UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2', [
      newHash,
      req.user.id,
    ]);
    await logAudit({
      actorId: req.user.id,
      actorEmail: req.user.email,
      action: 'PASSWORD_UPDATED',
      targetType: 'user',
      targetId: req.user.id,
      ipAddress: req.ip,
    });
    return res.json({ ok: true });
  } catch (err) {
    return next(err);
  }
});

router.patch('/card-freeze', requireAuth, async (req, res, next) => {
  try {
    const nextState = !req.user.card_frozen;
    const { rows } = await query(
      'UPDATE users SET card_frozen = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
      [nextState, req.user.id]
    );
    await logAudit({
      actorId: req.user.id,
      actorEmail: req.user.email,
      action: nextState ? 'CARD_FROZEN' : 'CARD_UNFROZEN',
      targetType: 'user',
      targetId: req.user.id,
      ipAddress: req.ip,
    });
    return res.json({ user: sanitizeUser(rows[0]) });
  } catch (err) {
    return next(err);
  }
});

export default router;
