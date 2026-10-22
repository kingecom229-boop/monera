import { Router } from 'express';
import { z } from 'zod';
import { getSiteSettings, logAudit, query, withTransaction } from '../config/db.js';
import { requireAuth, sanitizeUser } from '../middleware/auth.js';
import { computeLoanSchedule, generateTxReference, roundMoney } from '../utils/banking.js';

const router = Router();
router.use(requireAuth);

function serializeTransaction(row, currentUserId) {
  const isOutgoing = row.sender_id === currentUserId;
  return {
    id: row.id,
    reference: row.reference,
    type: row.type,
    senderId: row.sender_id,
    recipientId: row.recipient_id,
    senderSnapshot: row.sender_snapshot,
    recipientSnapshot: row.recipient_snapshot,
    senderName: row.sender_name || row.sender_snapshot,
    senderCode: row.sender_code || '',
    senderRib: row.sender_rib || '',
    recipientName: row.recipient_name || row.recipient_snapshot,
    recipientCode: row.recipient_code || '',
    recipientRib: row.recipient_rib || '',
    amount: Number(row.amount),
    fee: Number(row.fee || 0),
    currency: row.currency || 'EUR',
    status: row.status,
    creditedToRecipient: Boolean(row.credited_to_recipient),
    description: row.description || '',
    cancelReason: row.cancel_reason || '',
    adminNote: row.admin_note || '',
    direction: isOutgoing ? 'outgoing' : 'incoming',
    canRequestCancel:
      row.type === 'transfer' &&
      row.sender_id === currentUserId &&
      (row.status === 'completed' || row.status === 'pending_approval'),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function serializeLoan(row) {
  return {
    id: row.id,
    reference: row.reference,
    userId: row.user_id,
    amount: Number(row.amount),
    annualRate: Number(row.annual_rate),
    durationMonths: Number(row.duration_months),
    monthlyPayment: Number(row.monthly_payment),
    totalRepayment: Number(row.total_repayment),
    remainingAmount: Number(row.remaining_amount),
    monthlyIncome: Number(row.monthly_income || 0),
    purpose: row.purpose,
    details: row.details || '',
    status: row.status,
    adminNote: row.admin_note || '',
    reviewedAt: row.reviewed_at,
    createdAt: row.created_at,
  };
}

router.get('/dashboard', async (req, res, next) => {
  try {
    const userId = req.user.id;
    const settings = await getSiteSettings();

    const userRes = await query('SELECT * FROM users WHERE id = $1', [userId]);
    const freshUser = userRes.rows[0];

    const txRes = await query(
      `SELECT t.*,
              s.full_name AS sender_name, s.member_code AS sender_code, s.rib AS sender_rib,
              r.full_name AS recipient_name, r.member_code AS recipient_code, r.rib AS recipient_rib
       FROM transactions t
       LEFT JOIN users s ON s.id = t.sender_id
       LEFT JOIN users r ON r.id = t.recipient_id
       WHERE t.sender_id = $1 OR t.recipient_id = $1
       ORDER BY t.created_at DESC
       LIMIT 100`,
      [userId]
    );

    const loansRes = await query(
      'SELECT * FROM loans WHERE user_id = $1 ORDER BY created_at DESC',
      [userId]
    );

    const notifRes = await query(
      'SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 30',
      [userId]
    );

    const contactsRes = await query(
      `SELECT id, full_name, member_code, rib, country
       FROM users
       WHERE role = 'member' AND status = 'active' AND id != $1
       ORDER BY created_at DESC
       LIMIT 12`,
      [userId]
    );

    const transactions = txRes.rows.map((r) => serializeTransaction(r, userId));
    let totalSent = 0;
    let totalReceived = 0;
    for (const t of transactions) {
      if (t.status === 'cancelled') continue;
      if (t.senderId === userId) totalSent = roundMoney(totalSent + t.amount);
      if (t.recipientId === userId && t.status === 'completed') {
        totalReceived = roundMoney(totalReceived + t.amount);
      }
    }

    res.json({
      account: sanitizeUser(freshUser),
      transactions,
      loans: loansRes.rows.map(serializeLoan),
      notifications: notifRes.rows.map((n) => ({
        id: n.id,
        title: n.title,
        message: n.message,
        category: n.category,
        isRead: Boolean(n.is_read),
        createdAt: n.created_at,
      })),
      directory: contactsRes.rows.map((c) => ({
        id: c.id,
        fullName: c.full_name,
        memberCode: c.member_code,
        rib: c.rib,
        country: c.country,
      })),
      stats: {
        totalSent,
        totalReceived,
        activeLoansCount: loansRes.rows.filter((l) => l.status === 'approved').length,
        pendingCancelCount: transactions.filter(
          (t) => t.senderId === userId && t.status === 'cancel_requested'
        ).length,
      },
      settings: {
        loanAnnualRate: Number(settings.loanAnnualRate),
        maxLoanAmount: Number(settings.maxLoanAmount),
        maxTransferAmount: Number(settings.maxTransferAmount),
        transferFeePercent: Number(settings.transferFeePercent),
        transferApprovalMode: settings.transferApprovalMode,
      },
    });
  } catch (err) {
    next(err);
  }
});

router.get('/lookup-recipient', async (req, res, next) => {
  try {
    const raw = String(req.query.q || '').trim();
    if (raw.length < 3) {
      return res.json({ recipient: null });
    }
    const compact = raw.replace(/\s+/g, '').toUpperCase();
    const { rows } = await query(
      `SELECT id, full_name, member_code, rib, country, status
       FROM users
       WHERE role = 'member'
         AND id != $1
         AND (
           REPLACE(UPPER(rib), ' ', '') = $2
           OR UPPER(member_code) = $2
           OR LOWER(email) = LOWER($3)
         )
       LIMIT 1`,
      [req.user.id, compact, raw]
    );

    if (rows.length === 0) {
      return res.json({ recipient: null });
    }

    const r = rows[0];
    return res.json({
      recipient: {
        id: r.id,
        fullName: r.full_name,
        memberCode: r.member_code,
        rib: r.rib,
        country: r.country,
        status: r.status,
      },
    });
  } catch (err) {
    return next(err);
  }
});

router.post('/transfers', async (req, res, next) => {
  try {
    const schema = z.object({
      recipientIdentifier: z.string().trim().min(3, 'Veuillez indiquer le RIB-MONERA, ID ou email du bénéficiaire.').max(180),
      amount: z.coerce.number().positive('Le montant doit être strictement positif.'),
      description: z.string().trim().max(240).optional().default('Virement MONERA'),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0].message });
    }

    const settings = await getSiteSettings();
    const amount = roundMoney(parsed.data.amount);
    if (amount <= 0) {
      return res.status(400).json({ error: 'Montant invalide.' });
    }
    if (amount > Number(settings.maxTransferAmount || 100000)) {
      return res.status(400).json({
        error: `Ce montant dépasse le plafond unitaire autorisé (${Number(settings.maxTransferAmount).toLocaleString('fr-FR')} €).`,
      });
    }

    const feePercent = Math.max(0, Number(settings.transferFeePercent || 0));
    const fee = roundMoney((amount * feePercent) / 100);
    const totalDebit = roundMoney(amount + fee);
    const rawIdentifier = parsed.data.recipientIdentifier.trim();
    const compactIdentifier = rawIdentifier.replace(/\s+/g, '').toUpperCase();
    const description = parsed.data.description || 'Virement instantané MONERA';

    const result = await withTransaction(async (tx) => {
      const senderRes = await tx.query('SELECT * FROM users WHERE id = $1', [req.user.id]);
      const sender = senderRes.rows[0];

      if (sender.status !== 'active') {
        const err = new Error('Votre compte est actuellement restreint. Contactez le service client MONERA.');
        err.statusCode = 403;
        throw err;
      }

      if (sender.card_frozen && req.body.source === 'card') {
        const err = new Error('Votre carte virtuelle MONERA est temporairement gelée.');
        err.statusCode = 403;
        throw err;
      }

      if (Number(sender.balance) < totalDebit) {
        const err = new Error(
          `Solde insuffisant pour exécuter ce virement (${Number(sender.balance).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} € disponible).`
        );
        err.statusCode = 400;
        throw err;
      }

      const recRes = await tx.query(
        `SELECT * FROM users
         WHERE role = 'member'
           AND (
             REPLACE(UPPER(rib), ' ', '') = $1
             OR UPPER(member_code) = $1
             OR LOWER(email) = LOWER($2)
           )
         LIMIT 1`,
        [compactIdentifier, rawIdentifier]
      );

      if (recRes.rowCount === 0) {
        const err = new Error('Aucun membre MONERA trouvé pour cet identifiant / RIB / email.');
        err.statusCode = 404;
        throw err;
      }

      const recipient = recRes.rows[0];
      if (recipient.id === sender.id) {
        const err = new Error('Vous ne pouvez pas effectuer un virement vers votre propre compte.');
        err.statusCode = 400;
        throw err;
      }
      if (recipient.status !== 'active') {
        const err = new Error('Le compte du bénéficiaire ne peut pas recevoir de fonds actuellement.');
        err.statusCode = 400;
        throw err;
      }

      const requiresApproval =
        settings.transferApprovalMode === 'manual' ||
        (settings.transferApprovalMode === 'threshold' &&
          amount >= Number(settings.autoApprovalThreshold || 15000));

      const status = requiresApproval ? 'pending_approval' : 'completed';
      const creditedToRecipient = !requiresApproval;

      const updatedSenderRes = await tx.query(
        'UPDATE users SET balance = balance - $1, updated_at = NOW() WHERE id = $2 RETURNING *',
        [totalDebit, sender.id]
      );

      if (creditedToRecipient) {
        await tx.query(
          'UPDATE users SET balance = balance + $1, updated_at = NOW() WHERE id = $2',
          [amount, recipient.id]
        );
      }

      const reference = generateTxReference('TXN');
      const txInsert = await tx.query(
        `INSERT INTO transactions
          (reference, type, sender_id, recipient_id, sender_snapshot, recipient_snapshot, amount, fee, status, credited_to_recipient, description)
         VALUES ($1, 'transfer', $2, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING *`,
        [
          reference,
          sender.id,
          recipient.id,
          `${sender.full_name} (${sender.member_code})`,
          `${recipient.full_name} (${recipient.member_code})`,
          amount,
          fee,
          status,
          creditedToRecipient,
          description,
        ]
      );

      await tx.query(
        `INSERT INTO notifications (user_id, title, message, category)
         VALUES ($1, $2, $3, 'transfer')`,
        [
          sender.id,
          status === 'completed' ? 'Virement émis avec succès' : 'Virement soumis à contrôle sécurité',
          `Virement ${reference} de ${amount.toFixed(2)} € vers ${recipient.full_name} (${recipient.member_code}).`,
        ]
      );

      if (creditedToRecipient) {
        await tx.query(
          `INSERT INTO notifications (user_id, title, message, category)
           VALUES ($1, 'Nouveau virement reçu', $2, 'credit')`,
          [
            recipient.id,
            `Vous avez reçu ${amount.toFixed(2)} € de la part de ${sender.full_name} (${reference}).`,
          ]
        );
      }

      await logAudit({
        client: tx,
        actorId: sender.id,
        actorEmail: sender.email,
        action: 'TRANSFER_CREATED',
        targetType: 'transaction',
        targetId: txInsert.rows[0].id,
        ipAddress: req.ip,
        metadata: { reference, amount, fee, status, recipientId: recipient.id },
      });

      return {
        transaction: serializeTransaction(
          {
            ...txInsert.rows[0],
            sender_name: sender.full_name,
            sender_code: sender.member_code,
            sender_rib: sender.rib,
            recipient_name: recipient.full_name,
            recipient_code: recipient.member_code,
            recipient_rib: recipient.rib,
          },
          sender.id
        ),
        account: sanitizeUser(updatedSenderRes.rows[0]),
      };
    });

    return res.status(201).json(result);
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    return next(err);
  }
});

router.post('/transfers/:id/cancel', async (req, res, next) => {
  try {
    const txId = Number(req.params.id);
    if (!Number.isInteger(txId) || txId <= 0) {
      return res.status(400).json({ error: 'Identifiant de transaction invalide.' });
    }

    const schema = z.object({
      reason: z.string().trim().min(3, 'Veuillez préciser le motif de la demande d’annulation.').max(300),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0].message });
    }

    const updated = await withTransaction(async (tx) => {
      const existingRes = await tx.query(
        'SELECT * FROM transactions WHERE id = $1',
        [txId]
      );
      if (existingRes.rowCount === 0) {
        const err = new Error('Transaction introuvable.');
        err.statusCode = 404;
        throw err;
      }

      const row = existingRes.rows[0];
      if (row.sender_id !== req.user.id || row.type !== 'transfer') {
        const err = new Error("Seul l'expéditeur du virement peut demander son annulation.");
        err.statusCode = 403;
        throw err;
      }

      if (row.status === 'cancel_requested') {
        const err = new Error("Une demande d'annulation est déjà en attente de validation par l'administrateur.");
        err.statusCode = 400;
        throw err;
      }

      if (row.status === 'cancelled') {
        const err = new Error('Ce virement a déjà été annulé et remboursé.');
        err.statusCode = 400;
        throw err;
      }

      const upRes = await tx.query(
        `UPDATE transactions
         SET status = 'cancel_requested', cancel_reason = $1, updated_at = NOW()
         WHERE id = $2
         RETURNING *`,
        [parsed.data.reason, txId]
      );

      await tx.query(
        `INSERT INTO notifications (user_id, title, message, category)
         VALUES ($1, 'Demande de révocation enregistrée', $2, 'cancel')`,
        [
          req.user.id,
          `Votre demande d'annulation pour le virement ${row.reference} (${Number(row.amount).toFixed(2)} €) a été transmise au Back-Office MONERA pour validation.`,
        ]
      );

      await logAudit({
        client: tx,
        actorId: req.user.id,
        actorEmail: req.user.email,
        action: 'TRANSFER_CANCEL_REQUESTED',
        targetType: 'transaction',
        targetId: txId,
        ipAddress: req.ip,
        metadata: { reference: row.reference, reason: parsed.data.reason },
      });

      return serializeTransaction(upRes.rows[0], req.user.id);
    });

    return res.json({ transaction: updated });
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    return next(err);
  }
});

router.post('/loans', async (req, res, next) => {
  try {
    const schema = z.object({
      amount: z.coerce.number().min(500, 'Montant minimum de prêt : 500 €.'),
      durationMonths: z.coerce.number().int().min(6, 'Durée minimale : 6 mois.').max(120, 'Durée maximale : 120 mois.'),
      monthlyIncome: z.coerce.number().min(0).default(0),
      purpose: z.string().trim().min(3, 'Veuillez indiquer la nature du projet.').max(120),
      details: z.string().trim().max(500).optional().default(''),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0].message });
    }

    if (req.user.status !== 'active') {
      return res.status(403).json({ error: 'Compte restreint : impossible de déposer une demande de prêt.' });
    }

    const settings = await getSiteSettings();
    const amount = roundMoney(parsed.data.amount);
    const maxLoan = Number(settings.maxLoanAmount || 250000);
    if (amount > maxLoan) {
      return res.status(400).json({
        error: `Le montant demandé dépasse le plafond autorisé (${maxLoan.toLocaleString('fr-FR')} €).`,
      });
    }

    const annualRate = Number(settings.loanAnnualRate || 3.85);
    const { monthlyPayment, totalRepayment } = computeLoanSchedule(
      amount,
      annualRate,
      parsed.data.durationMonths
    );

    const createdLoan = await withTransaction(async (tx) => {
      const reference = generateTxReference('LOAN');
      const ins = await tx.query(
        `INSERT INTO loans
          (reference, user_id, amount, annual_rate, duration_months, monthly_payment, total_repayment, remaining_amount, monthly_income, purpose, details, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $7, $8, $9, $10, 'pending')
         RETURNING *`,
        [
          reference,
          req.user.id,
          amount,
          annualRate,
          parsed.data.durationMonths,
          monthlyPayment,
          totalRepayment,
          roundMoney(parsed.data.monthlyIncome),
          parsed.data.purpose,
          parsed.data.details,
        ]
      );

      await tx.query(
        `INSERT INTO notifications (user_id, title, message, category)
         VALUES ($1, 'Demande de financement enregistrée', $2, 'loan')`,
        [
          req.user.id,
          `Dossier ${reference} de ${amount.toFixed(2)} € sur ${parsed.data.durationMonths} mois transmis au Comité de Crédit MONERA.`,
        ]
      );

      await logAudit({
        client: tx,
        actorId: req.user.id,
        actorEmail: req.user.email,
        action: 'LOAN_REQUEST_SUBMITTED',
        targetType: 'loan',
        targetId: ins.rows[0].id,
        ipAddress: req.ip,
        metadata: { reference, amount, durationMonths: parsed.data.durationMonths, purpose: parsed.data.purpose },
      });

      return serializeLoan(ins.rows[0]);
    });

    return res.status(201).json({ loan: createdLoan });
  } catch (err) {
    return next(err);
  }
});

router.post('/loans/:id/repay', async (req, res, next) => {
  try {
    const loanId = Number(req.params.id);
    const schema = z.object({
      amount: z.coerce.number().positive(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Montant de remboursement invalide.' });
    }

    const data = await withTransaction(async (tx) => {
      const loanRes = await tx.query('SELECT * FROM loans WHERE id = $1 AND user_id = $2', [
        loanId,
        req.user.id,
      ]);
      if (loanRes.rowCount === 0) {
        const err = new Error('Contrat de prêt introuvable.');
        err.statusCode = 404;
        throw err;
      }
      const loan = loanRes.rows[0];
      if (loan.status !== 'approved') {
        const err = new Error('Seul un prêt actif approuvé peut faire l’objet d’un remboursement.');
        err.statusCode = 400;
        throw err;
      }

      const payAmount = roundMoney(Math.min(Number(loan.remaining_amount), parsed.data.amount));
      const userRes = await tx.query('SELECT * FROM users WHERE id = $1', [req.user.id]);
      if (Number(userRes.rows[0].balance) < payAmount) {
        const err = new Error('Solde insuffisant pour effectuer cette échéance.');
        err.statusCode = 400;
        throw err;
      }

      const newRemaining = roundMoney(Number(loan.remaining_amount) - payAmount);
      const nextStatus = newRemaining <= 0.01 ? 'repaid' : 'approved';

      const upUser = await tx.query(
        'UPDATE users SET balance = balance - $1, updated_at = NOW() WHERE id = $2 RETURNING *',
        [payAmount, req.user.id]
      );
      const upLoan = await tx.query(
        'UPDATE loans SET remaining_amount = $1, status = $2 WHERE id = $3 RETURNING *',
        [Math.max(0, newRemaining), nextStatus, loan.id]
      );

      await tx.query(
        `INSERT INTO transactions (reference, type, sender_id, recipient_id, sender_snapshot, recipient_snapshot, amount, status, credited_to_recipient, description)
         VALUES ($1, 'loan_repayment', $2, NULL, $3, 'MONERA Crédit', $4, 'completed', TRUE, $5)`,
        [
          generateTxReference('REPAY'),
          req.user.id,
          `${req.user.full_name} (${req.user.member_code})`,
          payAmount,
          `Remboursement prêt ${loan.reference}`,
        ]
      );

      return {
        loan: serializeLoan(upLoan.rows[0]),
        account: sanitizeUser(upUser.rows[0]),
      };
    });

    return res.json(data);
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    return next(err);
  }
});

router.patch('/notifications/read', async (req, res, next) => {
  try {
    await query('UPDATE notifications SET is_read = TRUE WHERE user_id = $1', [req.user.id]);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;
