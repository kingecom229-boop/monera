import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { PGlite } from '@electric-sql/pglite';
import bcrypt from 'bcryptjs';
import {
  generateCardCvv,
  generateCardExpiry,
  generateLuhnCardNumber,
  generateMemberCode,
  generateMoneraRib,
  computeLoanSchedule,
} from '../utils/banking.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, '../../data/pgdata');

let pool = null;
let pglite = null;
let isInitialized = false;

export const DEFAULT_SITE_SETTINGS = {
  bankName: 'MONERA',
  tagline: "L'architecture bancaire de nouvelle génération. Précision, sécurité souveraine et liquidité instantanée.",
  announcementEnabled: true,
  announcementText: 'MONERA Private & Digital Banking • Réseau interbancaire RIB-MONERA sécurisé 24h/24 • Protection 3D active',
  supportEmail: 'contact@monera.com',
  supportPhone: '+33 1 86 95 42 00',
  headquarters: '29 Boulevard Haussmann, 75009 Paris • Lomé Financial District',
  transferApprovalMode: 'instant',
  autoApprovalThreshold: 15000,
  maxTransferAmount: 100000,
  transferFeePercent: 0,
  loanAnnualRate: 3.85,
  maxLoanAmount: 250000,
  welcomeBonus: 0,
  allowRegistration: true,
  maintenanceMode: false,
  customLogoUrl: '',
  customFaviconUrl: '',
};

function normalizeResult(res) {
  const rows = res.rows || [];
  return {
    rows,
    rowCount: res.rowCount ?? (rows.length > 0 ? rows.length : (res.affectedRows ?? 0)),
  };
}

export async function execDDL(sql) {
  if (pool) {
    await pool.query(sql);
    return;
  }
  await pglite.exec(sql);
}

export async function query(text, params = []) {
  if (pool) {
    const res = await pool.query(text, params);
    return normalizeResult(res);
  }
  const res = await pglite.query(text, params);
  return normalizeResult(res);
}

export async function withTransaction(callback) {
  if (pool) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const wrappedClient = {
        query: async (text, params = []) => normalizeResult(await client.query(text, params)),
      };
      const result = await callback(wrappedClient);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  return pglite.transaction(async (tx) => {
    const wrappedTx = {
      query: async (text, params = []) => normalizeResult(await tx.query(text, params)),
    };
    return callback(wrappedTx);
  });
}

export async function getSiteSettings() {
  const { rows } = await query('SELECT key, value FROM site_settings');
  const merged = { ...DEFAULT_SITE_SETTINGS };
  for (const row of rows) {
    merged[row.key] = row.value;
  }
  return merged;
}

export async function logAudit({
  client = null,
  actorId = null,
  actorEmail = '',
  action,
  targetType = '',
  targetId = '',
  ipAddress = '',
  metadata = {},
}) {
  const executor = client || { query };
  await executor.query(
    `INSERT INTO audit_logs (actor_id, actor_email, action, target_type, target_id, ip_address, metadata)
     VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)`,
    [
      actorId,
      actorEmail,
      action,
      targetType,
      String(targetId || ''),
      String(ipAddress || '').slice(0, 64),
      JSON.stringify(metadata || {}),
    ]
  );
}

export async function initDatabase() {
  if (isInitialized) return;

  if (process.env.DATABASE_URL) {
    pool = new pg.Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false,
      max: 15,
    });
    await pool.query('SELECT 1');
    console.log('[MONERA DB] Connected to external PostgreSQL via DATABASE_URL');
  } else {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    pglite = new PGlite(DATA_DIR);
    await pglite.waitReady;
    console.log('[MONERA DB] Initialized embedded PostgreSQL 16 engine at', DATA_DIR);
  }

  await execDDL(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      member_code VARCHAR(28) UNIQUE NOT NULL,
      rib VARCHAR(42) UNIQUE NOT NULL,
      full_name VARCHAR(120) NOT NULL,
      email VARCHAR(160) UNIQUE NOT NULL,
      phone VARCHAR(40) NOT NULL DEFAULT '',
      country VARCHAR(80) NOT NULL DEFAULT 'France',
      password_hash TEXT NOT NULL,
      role VARCHAR(20) NOT NULL DEFAULT 'member' CHECK (role IN ('member', 'admin')),
      status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'frozen')),
      balance NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
      currency VARCHAR(8) NOT NULL DEFAULT 'EUR',
      card_number VARCHAR(24) UNIQUE NOT NULL,
      card_expiry VARCHAR(8) NOT NULL,
      card_cvv VARCHAR(4) NOT NULL,
      card_frozen BOOLEAN NOT NULL DEFAULT FALSE,
      failed_login_attempts INTEGER NOT NULL DEFAULT 0,
      locked_until TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id SERIAL PRIMARY KEY,
      reference VARCHAR(36) UNIQUE NOT NULL,
      type VARCHAR(30) NOT NULL CHECK (type IN ('transfer', 'admin_credit', 'admin_debit', 'loan_disbursement', 'loan_repayment')),
      sender_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      recipient_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      sender_snapshot VARCHAR(180) NOT NULL DEFAULT '',
      recipient_snapshot VARCHAR(180) NOT NULL DEFAULT '',
      amount NUMERIC(15, 2) NOT NULL CHECK (amount > 0),
      fee NUMERIC(15, 2) NOT NULL DEFAULT 0.00 CHECK (fee >= 0),
      currency VARCHAR(8) NOT NULL DEFAULT 'EUR',
      status VARCHAR(30) NOT NULL CHECK (status IN ('pending_approval', 'completed', 'cancel_requested', 'cancelled')),
      credited_to_recipient BOOLEAN NOT NULL DEFAULT FALSE,
      description TEXT NOT NULL DEFAULT '',
      cancel_reason TEXT NOT NULL DEFAULT '',
      admin_note TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS loans (
      id SERIAL PRIMARY KEY,
      reference VARCHAR(36) UNIQUE NOT NULL,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      amount NUMERIC(15, 2) NOT NULL CHECK (amount > 0),
      annual_rate NUMERIC(5, 2) NOT NULL,
      duration_months INTEGER NOT NULL CHECK (duration_months >= 3 AND duration_months <= 240),
      monthly_payment NUMERIC(15, 2) NOT NULL,
      total_repayment NUMERIC(15, 2) NOT NULL,
      remaining_amount NUMERIC(15, 2) NOT NULL,
      monthly_income NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
      purpose VARCHAR(120) NOT NULL,
      details TEXT NOT NULL DEFAULT '',
      status VARCHAR(24) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'repaid')),
      admin_note TEXT NOT NULL DEFAULT '',
      reviewed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      reviewed_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title VARCHAR(160) NOT NULL,
      message TEXT NOT NULL,
      category VARCHAR(30) NOT NULL DEFAULT 'info',
      is_read BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS site_settings (
      key VARCHAR(80) PRIMARY KEY,
      value JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id SERIAL PRIMARY KEY,
      actor_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      actor_email VARCHAR(160) NOT NULL DEFAULT '',
      action VARCHAR(80) NOT NULL,
      target_type VARCHAR(50) NOT NULL DEFAULT '',
      target_id VARCHAR(60) NOT NULL DEFAULT '',
      ip_address VARCHAR(64) NOT NULL DEFAULT '',
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_tx_sender ON transactions(sender_id);
    CREATE INDEX IF NOT EXISTS idx_tx_recipient ON transactions(recipient_id);
    CREATE INDEX IF NOT EXISTS idx_tx_status ON transactions(status);
    CREATE INDEX IF NOT EXISTS idx_loans_user ON loans(user_id);
    CREATE INDEX IF NOT EXISTS idx_notif_user ON notifications(user_id);
  `);

  for (const [key, val] of Object.entries(DEFAULT_SITE_SETTINGS)) {
    await query(
      `INSERT INTO site_settings (key, value) VALUES ($1, $2::jsonb) ON CONFLICT (key) DO NOTHING`,
      [key, JSON.stringify(val)]
    );
  }

  const adminEmail = (process.env.ADMIN_EMAIL || 'admin@monera.com').trim().toLowerCase();
  const adminPassword = process.env.ADMIN_INITIAL_PASSWORD || 'pypython10';
  const existingAdmin = await query('SELECT id FROM users WHERE email = $1', [adminEmail]);

  if (existingAdmin.rowCount === 0) {
    const adminHash = await bcrypt.hash(adminPassword, 12);
    await query(
      `INSERT INTO users (member_code, rib, full_name, email, phone, country, password_hash, role, status, balance, card_number, card_expiry, card_cvv)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'admin', 'active', 1000000.00, $8, $9, $10)`,
      [
        'MNR-000001',
        generateMoneraRib(),
        'Direction Générale MONERA',
        adminEmail,
        '+33 1 86 95 42 00',
        'France',
        adminHash,
        generateLuhnCardNumber('492900'),
        generateCardExpiry(),
        generateCardCvv(),
      ]
    );
  }

  const memberCountRes = await query("SELECT COUNT(*)::int AS cnt FROM users WHERE role = 'member'");
  if (memberCountRes.rows[0].cnt === 0) {
    await seedInitialBankingEcosystem();
  }

  isInitialized = true;
}

async function seedInitialBankingEcosystem() {
  const samplePass = await bcrypt.hash('MoneraClient#2026', 12);
  const seedMembers = [
    {
      code: 'MNR-482910',
      name: 'Camille Laurent',
      email: 'camille.laurent@monera-client.fr',
      phone: '+33 6 42 81 19 04',
      country: 'France',
      balance: 18450.75,
    },
    {
      code: 'MNR-739104',
      name: 'Koffi Mensah',
      email: 'koffi.mensah@monera-client.tg',
      phone: '+228 90 44 18 72',
      country: 'Togo',
      balance: 9620.00,
    },
    {
      code: 'MNR-519382',
      name: 'Sofia Rodriguez',
      email: 'sofia.rodriguez@monera-client.es',
      phone: '+34 612 94 08 31',
      country: 'Espagne',
      balance: 32190.50,
    },
    {
      code: 'MNR-664219',
      name: 'Marc-Antoine Delacroix',
      email: 'ma.delacroix@monera-client.ch',
      phone: '+41 79 502 64 11',
      country: 'Suisse',
      balance: 54800.00,
    },
  ];

  const inserted = [];
  for (const m of seedMembers) {
    const res = await query(
      `INSERT INTO users (member_code, rib, full_name, email, phone, country, password_hash, role, status, balance, card_number, card_expiry, card_cvv)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'member', 'active', $8, $9, $10, $11)
       RETURNING id, full_name, member_code, rib`,
      [
        m.code,
        generateMoneraRib(),
        m.name,
        m.email,
        m.phone,
        m.country,
        samplePass,
        m.balance,
        generateLuhnCardNumber('492984'),
        generateCardExpiry(),
        generateCardCvv(),
      ]
    );
    inserted.push(res.rows[0]);
  }

  const [m1, m2, m3, m4] = inserted;

  await query(
    `INSERT INTO transactions (reference, type, sender_id, recipient_id, sender_snapshot, recipient_snapshot, amount, status, credited_to_recipient, description)
     VALUES
     ('TXN-20261020-A81F02', 'transfer', $1, $2, $5, $6, 1250.00, 'completed', TRUE, 'Règlement honoraires conseil international'),
     ('TXN-20261021-C39D14', 'transfer', $3, $1, $7, $5, 3400.00, 'cancel_requested', TRUE, 'Acompte contrat immobilier Madrid'),
     ('TXN-20261022-E72B90', 'transfer', $4, $3, $8, $7, 7800.00, 'pending_approval', FALSE, 'Transfert trésorerie inter-filiales')`,
    [
      m1.id,
      m2.id,
      m3.id,
      m4.id,
      `${m1.full_name} (${m1.member_code})`,
      `${m2.full_name} (${m2.member_code})`,
      `${m3.full_name} (${m3.member_code})`,
      `${m4.full_name} (${m4.member_code})`,
    ]
  );

  await query(
    `UPDATE transactions SET cancel_reason = 'Erreur sur le montant du second appel de fonds — demande de restitution.' WHERE reference = 'TXN-20261021-C39D14'`
  );

  const schedule1 = computeLoanSchedule(25000, 3.85, 36);
  const schedule2 = computeLoanSchedule(12000, 3.85, 24);

  await query(
    `INSERT INTO loans (reference, user_id, amount, annual_rate, duration_months, monthly_payment, total_repayment, remaining_amount, monthly_income, purpose, details, status)
     VALUES
     ('LOAN-2026-8812A', $1, 25000.00, 3.85, 36, $2, $3, $3, 4800.00, 'Investissement Professionnel', 'Expansion cabinet conseil digital & équipements IT', 'pending'),
     ('LOAN-2026-5049B', $4, 12000.00, 3.85, 24, $5, $6, $6, 3200.00, 'Mobilité Électrique', 'Acquisition véhicule hybride rechargeable', 'approved')`,
    [
      m2.id,
      schedule1.monthlyPayment,
      schedule1.totalRepayment,
      m1.id,
      schedule2.monthlyPayment,
      schedule2.totalRepayment,
    ]
  );

  for (const m of inserted) {
    await query(
      `INSERT INTO notifications (user_id, title, message, category)
       VALUES ($1, 'Bienvenue chez MONERA Private Banking', 'Votre compte courant international et votre carte virtuelle 3D MONERA sont actifs.', 'security')`,
      [m.id]
    );
  }
}
