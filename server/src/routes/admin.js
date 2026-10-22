import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { getSiteSettings, logAudit, query, withTransaction } from '../config/db.js';
import { requireAdmin, requireAuth, sanitizeUser } from '../middleware/auth.js';
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
router.use(requireAuth, requireAdmin);

function serializeAdminTx(row) {
  return {
    id: row.id,
    reference: row.reference,
    type: row.type,
    senderId: row.sender_id,
    recipientId: row.recipient_id,
    senderName: row.sender_name || row.sender_snapshot,
    senderCode: row.sender_code || '',
    senderEmail: row.sender_email || '',
    senderRib: row.sender_rib || '',
    recipientName: row.recipient_name || row.recipient_snapshot,
    recipientCode: row.recipient_code || '',
    recipientEmail: row.recipient_email || '',
    recipientRib: row.recipient_rib || '',
    externalBankName: row.external_bank_name || '',
    externalHolderName: row.external_holder_name || '',
    externalIban: row.external_iban || '',
    externalBic: row.external_bic || '',
    progressPercent: Number(row.progress_percent ?? 100),
    verificationStep: Number(row.verification_step ?? 3),
    codeStep1: row.code_step_1 || '',
    codeStep2: row.code_step_2 || '',
    activeRequiredCode:
      row.status === 'awaiting_code_1'
        ? row.code_step_1
        : row.status === 'awaiting_code_2'
          ? row.code_step_2
          : '',
    amount: Number(row.amount),
    fee: Number(row.fee || 0),
    currency: row.currency || 'EUR',
    status: row.status,
    creditedToRecipient: Boolean(row.credited_to_recipient),
    description: row.description || '',
    cancelReason: row.cancel_reason || '',
    adminNote: row.admin_note || '',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

router.get('/overview', async (_req, res, next) => {
  try {
    const settings = await getSiteSettings();

    const kpiRes = await query(`
      SELECT
        (SELECT COUNT(*)::int FROM users WHERE role = 'member') AS total_members,
        (SELECT COUNT(*)::int FROM users WHERE role = 'member' AND status = 'active') AS active_members,
        COALESCE((SELECT SUM(balance)::numeric FROM users WHERE role = 'member'), 0) AS total_deposits,
        (SELECT COUNT(*)::int FROM transactions) AS total_transactions,
        COALESCE((SELECT SUM(amount)::numeric FROM transactions WHERE status = 'completed'), 0) AS completed_volume,
        (SELECT COUNT(*)::int FROM transactions WHERE status = 'pending_approval') AS pending_transfers,
        (SELECT COUNT(*)::int FROM transactions WHERE status IN ('awaiting_code_1', 'awaiting_code_2')) AS awaiting_code_transfers,
        (SELECT COUNT(*)::int FROM transactions WHERE status = 'cancel_requested') AS cancel_requests,
        (SELECT COUNT(*)::int FROM loans WHERE status = 'pending') AS pending_loans,
        COALESCE((SELECT SUM(amount)::numeric FROM loans WHERE status = 'approved'), 0) AS approved_loans_volume,
        (SELECT COUNT(*)::int FROM support_messages WHERE sender_role = 'member' AND read_by_admin = FALSE) AS unread_support_messages
    `);

    const k = kpiRes.rows[0];
    res.json({
      kpis: {
        totalMembers: Number(k.total_members),
        activeMembers: Number(k.active_members),
        totalDeposits: Number(k.total_deposits),
        totalTransactions: Number(k.total_transactions),
        completedVolume: Number(k.completed_volume),
        pendingTransfers: Number(k.pending_transfers),
        awaitingCodeTransfers: Number(k.awaiting_code_transfers),
        cancelRequests: Number(k.cancel_requests),
        pendingLoans: Number(k.pending_loans),
        approvedLoansVolume: Number(k.approved_loans_volume),
        unreadSupportMessages: Number(k.unread_support_messages),
      },
      settings,
    });
  } catch (err) {
    next(err);
  }
});

router.get('/members', async (_req, res, next) => {
  try {
    const { rows } = await query(`
      SELECT u.*,
             (SELECT COUNT(*)::int FROM transactions t WHERE t.sender_id = u.id OR t.recipient_id = u.id) AS tx_count,
             (SELECT COUNT(*)::int FROM loans l WHERE l.user_id = u.id AND l.status = 'approved') AS active_loans
      FROM users u
      WHERE u.role = 'member'
      ORDER BY u.created_at DESC
    `);

    res.json({
      members: rows.map((u) => ({
        ...sanitizeUser(u),
        txCount: Number(u.tx_count || 0),
        activeLoans: Number(u.active_loans || 0),
      })),
    });
  } catch (err) {
    next(err);
  }
});

router.post('/members', async (req, res, next) => {
  try {
    const schema = z.object({
      fullName: z.string().trim().min(2, 'Nom complet requis.').max(120),
      email: z.string().trim().email('Adresse email invalide.').max(160),
      phone: z.string().trim().max(40).optional().default(''),
      country: z.string().trim().min(2).max(80).optional().default('France'),
      password: z.string().min(6, 'Mot de passe minimum 6 caractères.').max(128),
      initialBalance: z.coerce.number().min(0, 'Solde initial invalide.').default(0),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0].message });
    }

    const email = parsed.data.email.toLowerCase();
    const existing = await query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rowCount > 0) {
      return res.status(409).json({ error: 'Cet email est déjà utilisé par un compte existant.' });
    }

    const initialBalance = roundMoney(parsed.data.initialBalance);
    const hash = await bcrypt.hash(parsed.data.password, 12);

    const created = await withTransaction(async (tx) => {
      const ins = await tx.query(
        `INSERT INTO users (member_code, rib, full_name, email, phone, country, password_hash, role, status, balance, card_number, card_expiry, card_cvv)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'member', 'active', $8, $9, $10, $11)
         RETURNING *`,
        [
          generateMemberCode(),
          generateMoneraRib(),
          parsed.data.fullName,
          email,
          parsed.data.phone,
          parsed.data.country,
          hash,
          initialBalance,
          generateLuhnCardNumber('492984'),
          generateCardExpiry(),
          generateCardCvv(),
        ]
      );
      const user = ins.rows[0];

      if (initialBalance > 0) {
        await tx.query(
          `INSERT INTO transactions (reference, type, sender_id, recipient_id, sender_snapshot, recipient_snapshot, amount, status, credited_to_recipient, description)
           VALUES ($1, 'admin_credit', $2, $3, 'Direction Générale MONERA', $4, $5, 'completed', TRUE, 'Dotation initiale à l’ouverture du compte')`,
          [
            generateTxReference('INIT'),
            req.user.id,
            user.id,
            `${user.full_name} (${user.member_code})`,
            initialBalance,
          ]
        );
      }

      await tx.query(
        `INSERT INTO notifications (user_id, title, message, category)
         VALUES ($1, 'Compte ouvert par votre Conseiller Privé MONERA', $2, 'security')`,
        [
          user.id,
          `Bienvenue ${user.full_name}. Votre compte ${user.member_code} est opérationnel avec un solde initial de ${initialBalance.toFixed(2)} €.`,
        ]
      );

      await tx.query(
        `INSERT INTO support_messages (member_id, sender_role, sender_id, content, read_by_member, read_by_admin)
         VALUES ($1, 'admin', $2, $3, FALSE, TRUE)`,
        [
          user.id,
          req.user.id,
          `Bonjour ${user.full_name}, votre Messagerie d'Assistance MONERA est active. Écrivez-nous ici à tout moment pour vos opérations ou codes de déblocage interbancaires.`,
        ]
      );

      await logAudit({
        client: tx,
        actorId: req.user.id,
        actorEmail: req.user.email,
        action: 'ADMIN_CREATED_MEMBER',
        targetType: 'user',
        targetId: user.id,
        ipAddress: req.ip,
        metadata: { memberCode: user.member_code, email: user.email, initialBalance },
      });

      return sanitizeUser(user);
    });

    return res.status(201).json({ member: created });
  } catch (err) {
    return next(err);
  }
});

router.patch('/members/:id', async (req, res, next) => {
  try {
    const memberId = Number(req.params.id);
    const schema = z.object({
      fullName: z.string().trim().min(2).max(120).optional(),
      phone: z.string().trim().max(40).optional(),
      country: z.string().trim().min(2).max(80).optional(),
      status: z.enum(['active', 'frozen']).optional(),
      newPassword: z.string().min(6).max(128).optional(),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0].message });
    }

    const existingRes = await query("SELECT * FROM users WHERE id = $1 AND role = 'member'", [memberId]);
    if (existingRes.rowCount === 0) {
      return res.status(404).json({ error: 'Membre introuvable.' });
    }

    const cur = existingRes.rows[0];
    const nextHash = parsed.data.newPassword
      ? await bcrypt.hash(parsed.data.newPassword, 12)
      : cur.password_hash;

    const up = await query(
      `UPDATE users
       SET full_name = $1, phone = $2, country = $3, status = $4, password_hash = $5, updated_at = NOW()
       WHERE id = $6
       RETURNING *`,
      [
        parsed.data.fullName ?? cur.full_name,
        parsed.data.phone ?? cur.phone,
        parsed.data.country ?? cur.country,
        parsed.data.status ?? cur.status,
        nextHash,
        memberId,
      ]
    );

    await logAudit({
      actorId: req.user.id,
      actorEmail: req.user.email,
      action: 'ADMIN_UPDATED_MEMBER',
      targetType: 'user',
      targetId: memberId,
      ipAddress: req.ip,
      metadata: { status: up.rows[0].status },
    });

    return res.json({ member: sanitizeUser(up.rows[0]) });
  } catch (err) {
    return next(err);
  }
});

router.delete('/members/:id', async (req, res, next) => {
  try {
    const memberId = Number(req.params.id);
    if (memberId === req.user.id) {
      return res.status(400).json({ error: 'Impossible de supprimer le compte administrateur principal.' });
    }

    const deleted = await withTransaction(async (tx) => {
      const targetRes = await tx.query("SELECT * FROM users WHERE id = $1 AND role = 'member'", [memberId]);
      if (targetRes.rowCount === 0) {
        const err = new Error('Membre introuvable.');
        err.statusCode = 404;
        throw err;
      }

      const member = targetRes.rows[0];
      await tx.query('DELETE FROM users WHERE id = $1', [memberId]);

      await logAudit({
        client: tx,
        actorId: req.user.id,
        actorEmail: req.user.email,
        action: 'ADMIN_DELETED_MEMBER',
        targetType: 'user',
        targetId: memberId,
        ipAddress: req.ip,
        metadata: { email: member.email, memberCode: member.member_code, fullName: member.full_name },
      });

      return member;
    });

    return res.json({ ok: true, deletedMemberCode: deleted.member_code });
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    return next(err);
  }
});

router.post('/members/:id/credit', async (req, res, next) => {
  try {
    const memberId = Number(req.params.id);
    const schema = z.object({
      amount: z.coerce.number().positive('Le montant à créditer doit être supérieur à 0.'),
      description: z.string().trim().min(2).max(240).default('Crédit Back-Office MONERA'),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0].message });
    }

    const amount = roundMoney(parsed.data.amount);

    const out = await withTransaction(async (tx) => {
      const targetRes = await tx.query("SELECT * FROM users WHERE id = $1 AND role = 'member'", [memberId]);
      if (targetRes.rowCount === 0) {
        const err = new Error('Membre introuvable.');
        err.statusCode = 404;
        throw err;
      }
      const member = targetRes.rows[0];

      const upRes = await tx.query(
        'UPDATE users SET balance = balance + $1, updated_at = NOW() WHERE id = $2 RETURNING *',
        [amount, memberId]
      );

      const reference = generateTxReference('CRD');
      const txInsert = await tx.query(
        `INSERT INTO transactions (reference, type, sender_id, recipient_id, sender_snapshot, recipient_snapshot, amount, status, credited_to_recipient, description)
         VALUES ($1, 'admin_credit', $2, $3, 'MONERA Trésorerie Centrale', $4, $5, 'completed', TRUE, $6)
         RETURNING *`,
        [
          reference,
          req.user.id,
          memberId,
          `${member.full_name} (${member.member_code})`,
          amount,
          parsed.data.description,
        ]
      );

      await tx.query(
        `INSERT INTO notifications (user_id, title, message, category)
         VALUES ($1, 'Compte crédité par MONERA', $2, 'credit')`,
        [
          memberId,
          `Votre compte a été crédité de +${amount.toFixed(2)} € (${parsed.data.description}) • Réf. ${reference}.`,
        ]
      );

      await logAudit({
        client: tx,
        actorId: req.user.id,
        actorEmail: req.user.email,
        action: 'ADMIN_CREDITED_MEMBER',
        targetType: 'user',
        targetId: memberId,
        ipAddress: req.ip,
        metadata: { amount, reference, description: parsed.data.description },
      });

      return {
        member: sanitizeUser(upRes.rows[0]),
        transaction: serializeAdminTx(txInsert.rows[0]),
      };
    });

    return res.json(out);
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    return next(err);
  }
});

router.post('/members/:id/debit', async (req, res, next) => {
  try {
    const memberId = Number(req.params.id);
    const schema = z.object({
      amount: z.coerce.number().positive('Le montant à débiter doit être supérieur à 0.'),
      description: z.string().trim().min(2).max(240).default('Débit Back-Office MONERA'),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0].message });
    }

    const amount = roundMoney(parsed.data.amount);

    const out = await withTransaction(async (tx) => {
      const targetRes = await tx.query("SELECT * FROM users WHERE id = $1 AND role = 'member'", [memberId]);
      if (targetRes.rowCount === 0) {
        const err = new Error('Membre introuvable.');
        err.statusCode = 404;
        throw err;
      }
      const member = targetRes.rows[0];
      if (Number(member.balance) < amount) {
        const err = new Error(
          `Solde du membre insuffisant (${Number(member.balance).toFixed(2)} € disponible pour un débit de ${amount.toFixed(2)} €).`
        );
        err.statusCode = 400;
        throw err;
      }

      const upRes = await tx.query(
        'UPDATE users SET balance = balance - $1, updated_at = NOW() WHERE id = $2 RETURNING *',
        [amount, memberId]
      );

      const reference = generateTxReference('DBT');
      const txInsert = await tx.query(
        `INSERT INTO transactions (reference, type, sender_id, recipient_id, sender_snapshot, recipient_snapshot, amount, status, credited_to_recipient, description)
         VALUES ($1, 'admin_debit', $2, $3, $4, 'MONERA Trésorerie Centrale', $5, 'completed', TRUE, $6)
         RETURNING *`,
        [
          reference,
          memberId,
          req.user.id,
          `${member.full_name} (${member.member_code})`,
          amount,
          parsed.data.description,
        ]
      );

      await tx.query(
        `INSERT INTO notifications (user_id, title, message, category)
         VALUES ($1, 'Opération de débit sur votre compte', $2, 'debit')`,
        [
          memberId,
          `Un débit de -${amount.toFixed(2)} € a été exécuté sur votre compte (${parsed.data.description}) • Réf. ${reference}.`,
        ]
      );

      await logAudit({
        client: tx,
        actorId: req.user.id,
        actorEmail: req.user.email,
        action: 'ADMIN_DEBITED_MEMBER',
        targetType: 'user',
        targetId: memberId,
        ipAddress: req.ip,
        metadata: { amount, reference, description: parsed.data.description },
      });

      return {
        member: sanitizeUser(upRes.rows[0]),
        transaction: serializeAdminTx(txInsert.rows[0]),
      };
    });

    return res.json(out);
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    return next(err);
  }
});

router.get('/transactions', async (_req, res, next) => {
  try {
    const { rows } = await query(`
      SELECT t.*,
             s.full_name AS sender_name, s.member_code AS sender_code, s.email AS sender_email, s.rib AS sender_rib,
             r.full_name AS recipient_name, r.member_code AS recipient_code, r.email AS recipient_email, r.rib AS recipient_rib
      FROM transactions t
      LEFT JOIN users s ON s.id = t.sender_id
      LEFT JOIN users r ON r.id = t.recipient_id
      ORDER BY
        CASE
          WHEN t.status IN ('awaiting_code_1', 'awaiting_code_2') THEN 0
          WHEN t.status = 'cancel_requested' THEN 1
          WHEN t.status = 'pending_approval' THEN 2
          ELSE 3
        END,
        t.created_at DESC
      LIMIT 300
    `);

    res.json({ transactions: rows.map(serializeAdminTx) });
  } catch (err) {
    next(err);
  }
});

router.post('/transactions/:id/approve', async (req, res, next) => {
  try {
    const txId = Number(req.params.id);
    const adminNote = String(req.body?.adminNote || 'Paiement vérifié et approuvé par le Back-Office MONERA.').slice(0, 300);

    const updated = await withTransaction(async (tx) => {
      const resRow = await tx.query('SELECT * FROM transactions WHERE id = $1', [txId]);
      if (resRow.rowCount === 0) {
        const err = new Error('Transaction introuvable.');
        err.statusCode = 404;
        throw err;
      }

      const row = resRow.rows[0];
      if (row.status === 'cancelled') {
        const err = new Error('Impossible d’approuver un virement déjà annulé.');
        err.statusCode = 400;
        throw err;
      }

      if (!row.credited_to_recipient && row.recipient_id) {
        await tx.query(
          'UPDATE users SET balance = balance + $1, updated_at = NOW() WHERE id = $2',
          [Number(row.amount), row.recipient_id]
        );
      }

      const upRes = await tx.query(
        `UPDATE transactions
         SET status = 'completed',
             progress_percent = 100,
             verification_step = 3,
             credited_to_recipient = TRUE,
             admin_note = $1,
             updated_at = NOW()
         WHERE id = $2
         RETURNING *`,
        [adminNote, txId]
      );

      if (row.sender_id) {
        await tx.query(
          `INSERT INTO notifications (user_id, title, message, category)
           VALUES ($1, 'Virement validé par la banque', $2, 'transfer')`,
          [
            row.sender_id,
            `Le virement ${row.reference} de ${Number(row.amount).toFixed(2)} € est définitivement validé à 100%.`,
          ]
        );
      }

      if (!row.credited_to_recipient && row.recipient_id) {
        await tx.query(
          `INSERT INTO notifications (user_id, title, message, category)
           VALUES ($1, 'Fonds crédités sur votre compte', $2, 'credit')`,
          [
            row.recipient_id,
            `Le virement ${row.reference} de +${Number(row.amount).toFixed(2)} € a été approuvé et crédité sur votre solde.`,
          ]
        );
      }

      await logAudit({
        client: tx,
        actorId: req.user.id,
        actorEmail: req.user.email,
        action: 'ADMIN_APPROVED_TRANSFER',
        targetType: 'transaction',
        targetId: txId,
        ipAddress: req.ip,
        metadata: { reference: row.reference, amount: Number(row.amount), previousStatus: row.status },
      });

      return serializeAdminTx(upRes.rows[0]);
    });

    return res.json({ transaction: updated });
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    return next(err);
  }
});

router.post('/transactions/:id/cancel', async (req, res, next) => {
  try {
    const txId = Number(req.params.id);
    const adminNote = String(
      req.body?.adminNote || 'Transfert annulé par l’Administration MONERA — fonds restitués à l’expéditeur.'
    ).slice(0, 300);

    const updated = await withTransaction(async (tx) => {
      const resRow = await tx.query('SELECT * FROM transactions WHERE id = $1', [txId]);
      if (resRow.rowCount === 0) {
        const err = new Error('Transaction introuvable.');
        err.statusCode = 404;
        throw err;
      }

      const row = resRow.rows[0];
      if (row.type !== 'transfer' && row.type !== 'external_transfer') {
        const err = new Error('Seuls les transferts peuvent être révoqués via cette action.');
        err.statusCode = 400;
        throw err;
      }
      if (row.status === 'cancelled') {
        const err = new Error('Ce transfert a déjà été annulé et remboursé.');
        err.statusCode = 400;
        throw err;
      }

      const refundTotal = roundMoney(Number(row.amount) + Number(row.fee || 0));

      if (row.type === 'transfer' && row.credited_to_recipient && row.recipient_id) {
        await tx.query(
          'UPDATE users SET balance = balance - $1, updated_at = NOW() WHERE id = $2',
          [Number(row.amount), row.recipient_id]
        );
      }

      if (row.sender_id) {
        await tx.query(
          'UPDATE users SET balance = balance + $1, updated_at = NOW() WHERE id = $2',
          [refundTotal, row.sender_id]
        );
      }

      const upRes = await tx.query(
        `UPDATE transactions
         SET status = 'cancelled', credited_to_recipient = FALSE, admin_note = $1, updated_at = NOW()
         WHERE id = $2
         RETURNING *`,
        [adminNote, txId]
      );

      if (row.sender_id) {
        await tx.query(
          `INSERT INTO notifications (user_id, title, message, category)
           VALUES ($1, 'Transfert annulé — Montant restitué', $2, 'cancel')`,
          [
            row.sender_id,
            `Le transfert ${row.reference} a été annulé par l'Administration MONERA. +${refundTotal.toFixed(2)} € ont été recrédités sur votre solde.`,
          ]
        );
      }

      if (row.type === 'transfer' && row.credited_to_recipient && row.recipient_id) {
        await tx.query(
          `INSERT INTO notifications (user_id, title, message, category)
           VALUES ($1, 'Révocation bancaire d’un virement reçu', $2, 'cancel')`,
          [
            row.recipient_id,
            `Le virement ${row.reference} de ${Number(row.amount).toFixed(2)} € a été annulé par le contrôle bancaire MONERA.`,
          ]
        );
      }

      await logAudit({
        client: tx,
        actorId: req.user.id,
        actorEmail: req.user.email,
        action: 'ADMIN_CANCELLED_AND_REFUNDED_TRANSFER',
        targetType: 'transaction',
        targetId: txId,
        ipAddress: req.ip,
        metadata: { reference: row.reference, refundedAmount: refundTotal, previousStatus: row.status },
      });

      return serializeAdminTx(upRes.rows[0]);
    });

    return res.json({ transaction: updated });
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    return next(err);
  }
});

router.get('/messages/threads', async (_req, res, next) => {
  try {
    const membersRes = await query(`
      SELECT u.id, u.member_code, u.full_name, u.email, u.country, u.balance,
             (SELECT COUNT(*)::int FROM support_messages sm
              WHERE sm.member_id = u.id AND sm.sender_role = 'member' AND sm.read_by_admin = FALSE) AS unread_count,
             (SELECT sm.content FROM support_messages sm
              WHERE sm.member_id = u.id ORDER BY sm.created_at DESC LIMIT 1) AS last_message,
             (SELECT sm.created_at FROM support_messages sm
              WHERE sm.member_id = u.id ORDER BY sm.created_at DESC LIMIT 1) AS last_message_at
      FROM users u
      WHERE u.role = 'member'
      ORDER BY
        (SELECT COUNT(*) FROM transactions tx WHERE tx.sender_id = u.id AND tx.status IN ('awaiting_code_1', 'awaiting_code_2')) DESC,
        (SELECT COUNT(*) FROM support_messages sm WHERE sm.member_id = u.id AND sm.sender_role = 'member' AND sm.read_by_admin = FALSE) DESC,
        COALESCE((SELECT MAX(sm.created_at) FROM support_messages sm WHERE sm.member_id = u.id), u.created_at) DESC
    `);

    const activeCodesRes = await query(`
      SELECT id, reference, sender_id, external_bank_name, external_holder_name, external_iban,
             amount, progress_percent, verification_step, status, code_step_1, code_step_2, created_at
      FROM transactions
      WHERE type = 'external_transfer' AND status IN ('awaiting_code_1', 'awaiting_code_2')
      ORDER BY created_at DESC
    `);

    const byMember = new Map();
    for (const tx of activeCodesRes.rows) {
      if (!byMember.has(tx.sender_id)) byMember.set(tx.sender_id, []);
      byMember.get(tx.sender_id).push({
        id: tx.id,
        reference: tx.reference,
        bankName: tx.external_bank_name,
        holderName: tx.external_holder_name,
        iban: tx.external_iban,
        amount: Number(tx.amount),
        progressPercent: Number(tx.progress_percent),
        verificationStep: Number(tx.verification_step),
        status: tx.status,
        activeCode: tx.status === 'awaiting_code_1' ? tx.code_step_1 : tx.code_step_2,
        codeStep1: tx.code_step_1,
        codeStep2: tx.code_step_2,
        createdAt: tx.created_at,
      });
    }

    res.json({
      threads: membersRes.rows.map((m) => ({
        memberId: m.id,
        memberCode: m.member_code,
        fullName: m.full_name,
        email: m.email,
        country: m.country,
        balance: Number(m.balance),
        unreadCount: Number(m.unread_count || 0),
        lastMessage: m.last_message || '',
        lastMessageAt: m.last_message_at,
        pendingCodeTransfers: byMember.get(m.id) || [],
      })),
    });
  } catch (err) {
    next(err);
  }
});

router.get('/messages/:memberId', async (req, res, next) => {
  try {
    const memberId = Number(req.params.memberId);
    await query(
      `UPDATE support_messages SET read_by_admin = TRUE
       WHERE member_id = $1 AND sender_role = 'member' AND read_by_admin = FALSE`,
      [memberId]
    );
    const { rows } = await query(
      'SELECT * FROM support_messages WHERE member_id = $1 ORDER BY created_at ASC LIMIT 250',
      [memberId]
    );

    const pendingRes = await query(
      `SELECT id, reference, external_bank_name, external_holder_name, external_iban,
              amount, progress_percent, verification_step, status, code_step_1, code_step_2, created_at
       FROM transactions
       WHERE sender_id = $1 AND type = 'external_transfer' AND status IN ('awaiting_code_1', 'awaiting_code_2')
       ORDER BY created_at DESC`,
      [memberId]
    );

    res.json({
      messages: rows.map((r) => ({
        id: r.id,
        memberId: r.member_id,
        senderRole: r.sender_role,
        content: r.content,
        attachedCode: r.attached_code || '',
        txReference: r.tx_reference || '',
        readByMember: Boolean(r.read_by_member),
        readByAdmin: Boolean(r.read_by_admin),
        createdAt: r.created_at,
      })),
      pendingCodeTransfers: pendingRes.rows.map((tx) => ({
        id: tx.id,
        reference: tx.reference,
        bankName: tx.external_bank_name,
        holderName: tx.external_holder_name,
        iban: tx.external_iban,
        amount: Number(tx.amount),
        progressPercent: Number(tx.progress_percent),
        verificationStep: Number(tx.verification_step),
        status: tx.status,
        activeCode: tx.status === 'awaiting_code_1' ? tx.code_step_1 : tx.code_step_2,
        codeStep1: tx.code_step_1,
        codeStep2: tx.code_step_2,
        createdAt: tx.created_at,
      })),
    });
  } catch (err) {
    next(err);
  }
});

router.post('/messages/:memberId', async (req, res, next) => {
  try {
    const memberId = Number(req.params.memberId);
    const schema = z.object({
      content: z.string().trim().min(1, 'Message requis.').max(2000),
      attachedCode: z.string().trim().max(32).optional().default(''),
      txReference: z.string().trim().max(36).optional().default(''),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0].message });
    }

    const created = await withTransaction(async (tx) => {
      const ins = await tx.query(
        `INSERT INTO support_messages (member_id, sender_role, sender_id, content, attached_code, tx_reference, read_by_member, read_by_admin)
         VALUES ($1, 'admin', $2, $3, $4, $5, FALSE, TRUE)
         RETURNING *`,
        [
          memberId,
          req.user.id,
          parsed.data.content,
          parsed.data.attachedCode,
          parsed.data.txReference,
        ]
      );

      await tx.query(
        `INSERT INTO notifications (user_id, title, message, category)
         VALUES ($1, $2, $3, 'security')`,
        [
          memberId,
          parsed.data.attachedCode
            ? 'Nouveau code de validation reçu dans votre Messagerie'
            : 'Nouveau message de votre Assistance MONERA',
          parsed.data.content.slice(0, 180),
        ]
      );

      await logAudit({
        client: tx,
        actorId: req.user.id,
        actorEmail: req.user.email,
        action: parsed.data.attachedCode ? 'ADMIN_DISPATCHED_TRANSFER_CODE' : 'ADMIN_SENT_SUPPORT_MESSAGE',
        targetType: 'user',
        targetId: memberId,
        ipAddress: req.ip,
        metadata: {
          txReference: parsed.data.txReference,
          hasCode: Boolean(parsed.data.attachedCode),
        },
      });

      return ins.rows[0];
    });

    return res.status(201).json({
      message: {
        id: created.id,
        memberId: created.member_id,
        senderRole: created.sender_role,
        content: created.content,
        attachedCode: created.attached_code || '',
        txReference: created.tx_reference || '',
        readByMember: Boolean(created.read_by_member),
        readByAdmin: Boolean(created.read_by_admin),
        createdAt: created.created_at,
      },
    });
  } catch (err) {
    return next(err);
  }
});

router.get('/loans', async (_req, res, next) => {
  try {
    const { rows } = await query(`
      SELECT l.*, u.full_name, u.email, u.member_code, u.rib, u.balance AS member_balance
      FROM loans l
      JOIN users u ON u.id = l.user_id
      ORDER BY CASE WHEN l.status = 'pending' THEN 0 ELSE 1 END, l.created_at DESC
    `);

    res.json({
      loans: rows.map((r) => ({
        id: r.id,
        reference: r.reference,
        userId: r.user_id,
        fullName: r.full_name,
        email: r.email,
        memberCode: r.member_code,
        rib: r.rib,
        memberBalance: Number(r.member_balance),
        amount: Number(r.amount),
        annualRate: Number(r.annual_rate),
        durationMonths: Number(r.duration_months),
        monthlyPayment: Number(r.monthly_payment),
        totalRepayment: Number(r.total_repayment),
        remainingAmount: Number(r.remaining_amount),
        monthlyIncome: Number(r.monthly_income || 0),
        purpose: r.purpose,
        details: r.details || '',
        status: r.status,
        adminNote: r.admin_note || '',
        reviewedAt: r.reviewed_at,
        createdAt: r.created_at,
      })),
    });
  } catch (err) {
    next(err);
  }
});

router.post('/loans/:id/review', async (req, res, next) => {
  try {
    const loanId = Number(req.params.id);
    const schema = z.object({
      decision: z.enum(['approved', 'rejected']),
      adminNote: z.string().trim().max(300).optional().default(''),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0].message });
    }

    const updatedLoan = await withTransaction(async (tx) => {
      const loanRes = await tx.query(
        'SELECT l.*, u.full_name, u.member_code FROM loans l JOIN users u ON u.id = l.user_id WHERE l.id = $1',
        [loanId]
      );
      if (loanRes.rowCount === 0) {
        const err = new Error('Demande de prêt introuvable.');
        err.statusCode = 404;
        throw err;
      }

      const loan = loanRes.rows[0];
      if (loan.status !== 'pending') {
        const err = new Error('Ce dossier de prêt a déjà été traité.');
        err.statusCode = 400;
        throw err;
      }

      const { decision, adminNote } = parsed.data;
      const defaultNote =
        decision === 'approved'
          ? 'Dossier accepté par le Comité de Crédit MONERA — fonds débloqués immédiatement.'
          : 'Dossier non retenu selon les critères prudentiels en vigueur.';

      const upRes = await tx.query(
        `UPDATE loans
         SET status = $1, admin_note = $2, reviewed_by = $3, reviewed_at = NOW()
         WHERE id = $4
         RETURNING *`,
        [decision, adminNote || defaultNote, req.user.id, loanId]
      );

      if (decision === 'approved') {
        await tx.query(
          'UPDATE users SET balance = balance + $1, updated_at = NOW() WHERE id = $2',
          [Number(loan.amount), loan.user_id]
        );

        await tx.query(
          `INSERT INTO transactions (reference, type, sender_id, recipient_id, sender_snapshot, recipient_snapshot, amount, status, credited_to_recipient, description)
           VALUES ($1, 'loan_disbursement', $2, $3, 'MONERA Comité des Crédits', $4, $5, 'completed', TRUE, $6)`,
          [
            generateTxReference('LOANDISB'),
            req.user.id,
            loan.user_id,
            `${loan.full_name} (${loan.member_code})`,
            Number(loan.amount),
            `Déblocage prêt approuvé ${loan.reference} (${loan.purpose})`,
          ]
        );
      }

      await tx.query(
        `INSERT INTO notifications (user_id, title, message, category)
         VALUES ($1, $2, $3, 'loan')`,
        [
          loan.user_id,
          decision === 'approved' ? 'Votre prêt MONERA est approuvé' : 'Décision relative à votre demande de prêt',
          decision === 'approved'
            ? `Félicitations ! Votre prêt ${loan.reference} de +${Number(loan.amount).toFixed(2)} € a été approuvé et crédité sur votre compte MONERA.`
            : `Votre demande de prêt ${loan.reference} n'a pas pu être approuvée (${adminNote || defaultNote}).`,
        ]
      );

      await logAudit({
        client: tx,
        actorId: req.user.id,
        actorEmail: req.user.email,
        action: decision === 'approved' ? 'ADMIN_APPROVED_LOAN' : 'ADMIN_REJECTED_LOAN',
        targetType: 'loan',
        targetId: loanId,
        ipAddress: req.ip,
        metadata: { reference: loan.reference, amount: Number(loan.amount), userId: loan.user_id },
      });

      return upRes.rows[0];
    });

    return res.json({ loan: updatedLoan });
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    return next(err);
  }
});

router.put('/settings', async (req, res, next) => {
  try {
    const schema = z.object({
      bankName: z.string().trim().min(2).max(60),
      tagline: z.string().trim().max(240),
      announcementEnabled: z.boolean(),
      announcementText: z.string().trim().max(260),
      supportEmail: z.string().trim().email().max(160),
      supportPhone: z.string().trim().max(50),
      headquarters: z.string().trim().max(180),
      transferApprovalMode: z.enum(['instant', 'manual', 'threshold']),
      autoApprovalThreshold: z.coerce.number().min(0).max(10000000),
      maxTransferAmount: z.coerce.number().min(100).max(10000000),
      transferFeePercent: z.coerce.number().min(0).max(15),
      loanAnnualRate: z.coerce.number().min(0).max(30),
      maxLoanAmount: z.coerce.number().min(1000).max(10000000),
      welcomeBonus: z.coerce.number().min(0).max(100000),
      allowRegistration: z.boolean(),
      maintenanceMode: z.boolean(),
      customLogoUrl: z.string().trim().max(500000).optional().default(''),
      customFaviconUrl: z.string().trim().max(500000).optional().default(''),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0].message });
    }

    await withTransaction(async (tx) => {
      for (const [key, value] of Object.entries(parsed.data)) {
        await tx.query(
          `INSERT INTO site_settings (key, value, updated_at)
           VALUES ($1, $2::jsonb, NOW())
           ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
          [key, JSON.stringify(value)]
        );
      }

      await logAudit({
        client: tx,
        actorId: req.user.id,
        actorEmail: req.user.email,
        action: 'ADMIN_UPDATED_SITE_SETTINGS',
        targetType: 'settings',
        targetId: 'global',
        ipAddress: req.ip,
      });
    });

    const settings = await getSiteSettings();
    return res.json({ settings });
  } catch (err) {
    return next(err);
  }
});

router.get('/audit-logs', async (_req, res, next) => {
  try {
    const { rows } = await query(`
      SELECT id, actor_id, actor_email, action, target_type, target_id, ip_address, metadata, created_at
      FROM audit_logs
      ORDER BY created_at DESC
      LIMIT 150
    `);
    res.json({ logs: rows });
  } catch (err) {
    next(err);
  }
});

export default router;
