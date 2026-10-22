export const EXTERNAL_BANKS = [
  { name: 'BNP Paribas', bic: 'BNPAFRPP' },
  { name: 'Société Générale', bic: 'SOGEFRPP' },
  { name: 'Crédit Agricole', bic: 'AGRIFRPP' },
  { name: 'BoursoBank', bic: 'BOUSFRPP' },
  { name: 'Crédit Mutuel', bic: 'CMCIFR2A' },
  { name: 'La Banque Postale', bic: 'PSSTFRPP' },
  { name: 'LCL', bic: 'CRLYFRPP' },
  { name: 'BBVA España', bic: 'BBVAESMM' },
  { name: 'Banco Santander', bic: 'BSCHESMM' },
  { name: 'Revolut Bank', bic: 'REVOLT21' },
  { name: 'N26 Bank', bic: 'NTSBDEB1' },
  { name: 'Ecobank Transnational', bic: 'ECOCFRPP' },
  { name: 'Orabank', bic: 'ORABTGLL' },
  { name: 'Bank of Africa (BOA)', bic: 'AFRITGLL' },
  { name: 'NSIA Banque', bic: 'NSIATGLL' },
  { name: 'Coris Bank International', bic: 'CORITGLL' },
  { name: 'United Bank for Africa (UBA)', bic: 'UNAFNGLA' },
  { name: 'UBS Switzerland', bic: 'UBSWCHZH' },
  { name: 'Autre établissement bancaire', bic: '' },
];

export function extractSecurityCode(message) {
  if (!message) return '';
  if (message.attachedCode) return message.attachedCode;
  const match = String(message.content || '').match(/\bMNR[12]-\d{6}\b/i);
  return match ? match[0].toUpperCase() : '';
}

export function formatMoney(amount, currency = 'EUR') {
  const num = Number(amount || 0);
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
}

export function formatDateTime(iso) {
  if (!iso) return '—';
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));
}

export function calculateLoanPreview(principal, annualRatePercent, months) {
  const p = Number(principal) || 0;
  const n = Math.max(1, Number(months) || 12);
  const r = (Number(annualRatePercent) || 0) / 100 / 12;
  if (p <= 0) return { monthlyPayment: 0, totalRepayment: 0, totalInterest: 0 };
  const monthly =
    r <= 0 ? p / n : (p * (r * Math.pow(1 + r, n))) / (Math.pow(1 + r, n) - 1);
  const monthlyPayment = Math.round(monthly * 100) / 100;
  const totalRepayment = Math.round(monthlyPayment * n * 100) / 100;
  const totalInterest = Math.max(0, Math.round((totalRepayment - p) * 100) / 100);
  return { monthlyPayment, totalRepayment, totalInterest };
}

export function getTxStatusMeta(status) {
  switch (status) {
    case 'completed':
      return {
        label: 'Effectué (100%)',
        badgeClass: 'bg-emerald-500/12 text-emerald-700 border-emerald-500/25',
      };
    case 'awaiting_code_1':
      return {
        label: 'Bloqué à 15% • Code 1 requis',
        badgeClass: 'bg-amber-500/15 text-amber-800 border-amber-500/35',
      };
    case 'awaiting_code_2':
      return {
        label: 'En cours à 70% • Code 2 requis',
        badgeClass: 'bg-cyan-500/15 text-[#072146] border-cyan-500/40',
      };
    case 'pending_approval':
      return {
        label: 'En attente Admin',
        badgeClass: 'bg-sky-500/12 text-sky-700 border-sky-500/25',
      };
    case 'cancel_requested':
      return {
        label: 'Annulation demandée',
        badgeClass: 'bg-amber-500/15 text-amber-800 border-amber-500/30',
      };
    case 'cancelled':
      return {
        label: 'Annulé & Remboursé',
        badgeClass: 'bg-rose-500/12 text-rose-700 border-rose-500/25',
      };
    default:
      return {
        label: status,
        badgeClass: 'bg-slate-500/10 text-slate-700 border-slate-300',
      };
  }
}

export function getLoanStatusMeta(status) {
  switch (status) {
    case 'approved':
      return {
        label: 'Approuvé & Débloqué',
        badgeClass: 'bg-emerald-500/12 text-emerald-700 border-emerald-500/25',
      };
    case 'pending':
      return {
        label: 'Étude en cours',
        badgeClass: 'bg-amber-500/15 text-amber-800 border-amber-500/30',
      };
    case 'rejected':
      return {
        label: 'Non retenu',
        badgeClass: 'bg-rose-500/12 text-rose-700 border-rose-500/25',
      };
    case 'repaid':
      return {
        label: 'Intégralement soldé',
        badgeClass: 'bg-cyan-500/12 text-cyan-800 border-cyan-500/25',
      };
    default:
      return {
        label: status,
        badgeClass: 'bg-slate-100 text-slate-700 border-slate-300',
      };
  }
}
