import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Building2,
  Check,
  CheckCircle2,
  Copy,
  KeyRound,
  Lock,
  MessageSquare,
  ShieldAlert,
  Sparkles,
} from 'lucide-react';
import { apiRequest } from '../api/client';
import { extractSecurityCode, formatMoney } from '../utils/format';

export default function ExternalTransferConsole({
  transaction,
  supportMessages = [],
  onUpdated,
  onOpenSupport,
  onFinalized3D,
}) {
  const [codeInput, setCodeInput] = useState('');
  const [displayPercent, setDisplayPercent] = useState(
    transaction.status === 'awaiting_code_1' ? 0 : transaction.progressPercent
  );
  const [submitting, setSubmitting] = useState(false);
  const [requestingCode, setRequestingCode] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [copiedCode, setCopiedCode] = useState('');

  useEffect(() => {
    const target = Number(transaction.progressPercent || 15);
    let frame;
    const step = () => {
      setDisplayPercent((prev) => {
        if (prev >= target) return target;
        const delta = Math.max(1, Math.ceil((target - prev) / 8));
        const next = Math.min(target, prev + delta);
        if (next < target) {
          frame = requestAnimationFrame(step);
        }
        return next;
      });
    };
    const timer = setTimeout(() => {
      frame = requestAnimationFrame(step);
    }, 90);
    return () => {
      clearTimeout(timer);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [transaction.progressPercent]);

  const isStage1 = transaction.status === 'awaiting_code_1';
  const expectedPrefix = isStage1 ? 'MNR1-' : 'MNR2-';

  const matchingMessages = supportMessages.filter((m) => {
    if (m.senderRole !== 'admin') return false;
    const code = extractSecurityCode(m);
    return code && code.startsWith(expectedPrefix);
  });
  const latestMatchingCode =
    matchingMessages.length > 0
      ? extractSecurityCode(matchingMessages[matchingMessages.length - 1])
      : '';

  const handleValidateCode = async (e) => {
    e.preventDefault();
    setError('');
    setInfo('');
    if (!codeInput.trim()) return;

    setSubmitting(true);
    try {
      const res = await apiRequest(`/member/transfers/${transaction.id}/verify-code`, {
        method: 'POST',
        body: { code: codeInput.trim() },
      });

      setCodeInput('');
      await onUpdated();

      if (res.transaction.status === 'awaiting_code_2') {
        setInfo(
          'Code N°1 validé ! Progression à 70% : un nouveau code de validation finale a été généré pour l’Administration. Consultez votre Messagerie d’Assistance.'
        );
      } else if (res.transaction.status === 'completed') {
        setDisplayPercent(100);
        if (onFinalized3D) {
          onFinalized3D(res.transaction);
        }
      }
    } catch (err) {
      setError(err.message || 'Code de validation incorrect.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAskAdminForCode = async () => {
    setRequestingCode(true);
    setError('');
    try {
      const palier = isStage1 ? '15% (1er code)' : '70% (2nd code final)';
      await apiRequest('/member/messages', {
        method: 'POST',
        body: {
          txReference: transaction.reference,
          content: `Bonjour, je sollicite le code de déblocage pour mon virement externe ${transaction.reference} de ${formatMoney(transaction.amount)} vers ${transaction.externalBankName} actuellement au palier ${palier}. Merci d’avance.`,
        },
      });
      await onUpdated();
      setInfo(
        'Demande envoyée à l’Administration dans votre Messagerie d’Assistance ! Surveillez la réponse ou ouvrez la messagerie.'
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setRequestingCode(false);
    }
  };

  return (
    <div className="rounded-3xl border border-amber-300/40 bg-gradient-to-br from-[#072146] via-[#061B3B] to-[#031024] p-6 sm:p-7 text-white shadow-bbva relative overflow-hidden">
      <div className="pointer-events-none absolute -right-12 -top-12 h-48 w-48 rounded-full bg-cyan-400/15 blur-3xl" />

      <div className="relative z-10 flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-2 rounded-full border border-amber-300/40 bg-amber-400/15 px-3 py-1 text-[11px] font-extrabold uppercase tracking-wider text-amber-200">
            <ShieldAlert className="h-3.5 w-3.5 text-amber-300 animate-pulse" />
            {isStage1
              ? 'Virement Interbancaire Suspendu à 15% • Code N°1 Requis'
              : 'Virement en Compensation à 70% • Second Code Final Requis'}
          </div>
          <h3 className="font-display text-lg sm:text-xl font-bold text-white pt-1 flex items-center gap-2">
            <Building2 className="h-5 w-5 text-[#2DCCCD] shrink-0" />
            <span>
              {transaction.externalBankName} — {transaction.externalHolderName}
            </span>
          </h3>
          <p className="font-mono text-xs text-slate-300">
            Réf. {transaction.reference} • IBAN {transaction.externalIban}
          </p>
        </div>

        <div className="text-right">
          <div className="text-[11px] uppercase tracking-wider text-cyan-300">Montant engagé</div>
          <div className="font-mono text-2xl sm:text-3xl font-extrabold text-white tabular-nums">
            {formatMoney(transaction.amount)}
          </div>
        </div>
      </div>

      <div className="relative z-10 mt-6 space-y-3">
        <div className="flex items-center justify-between text-xs font-bold">
          <span className="text-cyan-200">Progression du routage interbancaire</span>
          <span className="font-mono text-lg font-extrabold text-[#F0D384] tabular-nums">
            {displayPercent}%
          </span>
        </div>

        <div className="relative h-4 w-full overflow-hidden rounded-full bg-white/10 p-0.5 border border-white/15">
          <motion.div
            initial={{ width: '0%' }}
            animate={{ width: `${displayPercent}%` }}
            transition={{ duration: 0.9, ease: 'easeOut' }}
            className="h-full rounded-full bg-gradient-to-r from-[#0284FE] via-[#2DCCCD] to-[#F0D384] shadow-[0_0_20px_rgba(45,204,205,0.7)]"
          />
        </div>

        <div className="grid grid-cols-4 text-[11px] font-mono pt-1">
          <div className="text-emerald-300 flex items-center gap-1">
            <CheckCircle2 className="h-3.5 w-3.5" />
            0% Initié
          </div>
          <div className={displayPercent >= 15 ? 'text-[#F0D384] font-bold' : 'text-slate-400'}>
            15% Code N°1
          </div>
          <div className={displayPercent >= 70 ? 'text-cyan-300 font-bold text-center' : 'text-slate-400 text-center'}>
            70% Code N°2
          </div>
          <div className="text-right text-slate-400">100% Exécuté</div>
        </div>
      </div>

      {latestMatchingCode && (
        <div className="relative z-10 mt-5 rounded-2xl border border-emerald-400/40 bg-emerald-500/15 p-4 flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs">
            <span className="font-bold text-emerald-200 block">
              Code reçu dans votre Messagerie d’Assistance :
            </span>
            <span className="font-mono text-base font-extrabold text-white tracking-wider">
              {latestMatchingCode}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(latestMatchingCode);
                setCodeInput(latestMatchingCode);
                setCopiedCode(latestMatchingCode);
                setTimeout(() => setCopiedCode(''), 2000);
              }}
              className="inline-flex items-center gap-1.5 rounded-xl bg-white text-[#072146] px-3.5 py-2 text-xs font-extrabold hover:bg-cyan-200 transition"
            >
              {copiedCode === latestMatchingCode ? (
                <Check className="h-3.5 w-3.5 text-emerald-600" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
              <span>Copier & Insérer</span>
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="relative z-10 mt-4 rounded-xl border border-rose-400/40 bg-rose-500/20 px-4 py-2.5 text-xs font-semibold text-rose-100">
          {error}
        </div>
      )}

      {info && (
        <div className="relative z-10 mt-4 rounded-xl border border-cyan-400/40 bg-cyan-500/15 px-4 py-2.5 text-xs font-semibold text-cyan-100">
          {info}
        </div>
      )}

      <form onSubmit={handleValidateCode} className="relative z-10 mt-5 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <KeyRound className="h-4 w-4 text-cyan-300 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            required
            value={codeInput}
            onChange={(e) => setCodeInput(e.target.value)}
            placeholder={
              isStage1
                ? 'Collez le 1er code reçu via Messagerie (ex. MNR1-...)'
                : 'Collez le 2nd code reçu via Messagerie (ex. MNR2-...)'
            }
            className="w-full rounded-xl border border-white/20 bg-white/10 pl-10 pr-4 py-3 font-mono text-sm text-white placeholder:text-slate-400 focus:border-[#2DCCCD] focus:outline-none"
          />
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#2DCCCD] px-6 py-3 text-xs sm:text-sm font-extrabold text-[#04142C] hover:bg-white transition shrink-0 disabled:opacity-60"
        >
          <Lock className="h-4 w-4" />
          <span>
            {submitting
              ? 'Vérification...'
              : isStage1
                ? 'Valider Code 1 (→ 70%)'
                : 'Valider Code 2 (→ 100%)'}
          </span>
        </button>
      </form>

      <div className="relative z-10 mt-4 pt-4 border-t border-white/10 flex flex-wrap items-center justify-between gap-3 text-xs">
        <button
          type="button"
          disabled={requestingCode}
          onClick={handleAskAdminForCode}
          className="inline-flex items-center gap-1.5 font-semibold text-amber-200 hover:text-white transition"
        >
          <Sparkles className="h-3.5 w-3.5" />
          <span>
            {requestingCode
              ? 'Transmission...'
              : `Demander le code (${isStage1 ? '15%' : '70%'}) à l’Administration`}
          </span>
        </button>

        <button
          type="button"
          onClick={onOpenSupport}
          className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 font-bold text-cyan-200 hover:bg-white/20 transition"
        >
          <MessageSquare className="h-3.5 w-3.5" />
          <span>Ouvrir la Messagerie d’Assistance →</span>
        </button>
      </div>
    </div>
  );
}
