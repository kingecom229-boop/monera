import crypto from 'node:crypto';

export function randomDigits(length) {
  let out = '';
  while (out.length < length) {
    out += crypto.randomInt(0, 10).toString();
  }
  return out;
}

export function generateMemberCode() {
  return `MNR-${randomDigits(6)}`;
}

export function generateMoneraRib() {
  const bankCode = '00819';
  const branchCode = '20260';
  const accountNumber = randomDigits(11);
  const numericCheck = BigInt(`${bankCode}${branchCode}${accountNumber}00`);
  const key = String(97n - (numericCheck % 97n)).padStart(2, '0');
  return `MNR76 ${bankCode} ${branchCode} ${accountNumber} ${key}`;
}

export function generateLuhnCardNumber(prefix = '492984') {
  const body = prefix + randomDigits(9);
  let sum = 0;
  let shouldDouble = true;
  for (let i = body.length - 1; i >= 0; i -= 1) {
    let digit = Number(body[i]);
    if (shouldDouble) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    shouldDouble = !shouldDouble;
  }
  const checkDigit = (10 - (sum % 10)) % 10;
  const full = `${body}${checkDigit}`;
  return full.match(/.{1,4}/g).join(' ');
}

export function generateCardExpiry() {
  const now = new Date();
  const month = String(((now.getUTCMonth() + 1) % 12) || 12).padStart(2, '0');
  const year = String((now.getUTCFullYear() + 4) % 100).padStart(2, '0');
  return `${month}/${year}`;
}

export function generateCardCvv() {
  return String(crypto.randomInt(100, 999));
}

export function generateTxReference(prefix = 'TXN') {
  const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const hex = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `${prefix}-${datePart}-${hex}`;
}

export function roundMoney(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return 0;
  return Math.round((num + Number.EPSILON) * 100) / 100;
}

export function computeLoanSchedule(principal, annualRatePercent, months) {
  const p = roundMoney(principal);
  const n = Math.max(1, Math.floor(Number(months)));
  const r = Number(annualRatePercent) / 100 / 12;
  let monthly;
  if (r <= 0) {
    monthly = p / n;
  } else {
    const factor = Math.pow(1 + r, n);
    monthly = (p * (r * factor)) / (factor - 1);
  }
  const monthlyPayment = roundMoney(monthly);
  const totalRepayment = roundMoney(monthlyPayment * n);
  return {
    monthlyPayment,
    totalRepayment,
  };
}
