import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Check,
  Copy,
  Eye,
  EyeOff,
  Lock,
  RefreshCw,
  ShieldCheck,
  Snowflake,
  Wifi,
} from 'lucide-react';
import BrandLogo from './BrandLogo';
import { formatMoney } from '../utils/format';

export default function MoneraVirtualCard3D({
  account,
  showBalance,
  onToggleBalance,
  onToggleFreeze,
  freezing = false,
  interactiveControls = true,
}) {
  const [flipped, setFlipped] = useState(false);
  const [showCardSecrets, setShowCardSecrets] = useState(false);
  const [tilt, setTilt] = useState({ rotateX: 0, rotateY: 0, glareX: 50, glareY: 50 });
  const [copiedRib, setCopiedRib] = useState(false);

  const holderName = account?.fullName || 'CLIENT PRIVÉ MONERA';
  const balance = account?.balance ?? 24850.00;
  const currency = account?.currency || 'EUR';
  const rawCard = account?.cardNumber || '4929 8410 7392 8841';
  const maskedCard = `${rawCard.slice(0, 4)} •••• •••• ${rawCard.slice(-4)}`;
  const expiry = account?.cardExpiry || '10/30';
  const cvv = account?.cardCvv || '842';
  const memberCode = account?.memberCode || 'MNR-482910';
  const rib = account?.rib || 'MNR76 0081 9202 6048 2910 7734 89';
  const isFrozen = Boolean(account?.cardFrozen);

  const handleMouseMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width;
    const py = (e.clientY - rect.top) / rect.height;
    setTilt({
      rotateX: (0.5 - py) * 18,
      rotateY: (px - 0.5) * 20,
      glareX: px * 100,
      glareY: py * 100,
    });
  };

  const handleMouseLeave = () => {
    setTilt({ rotateX: 0, rotateY: 0, glareX: 50, glareY: 50 });
  };

  const copyRib = (e) => {
    e.stopPropagation();
    navigator.clipboard.writeText(rib);
    setCopiedRib(true);
    setTimeout(() => setCopiedRib(false), 2000);
  };

  return (
    <div className="w-full max-w-[440px] mx-auto select-none">
      <div
        className="perspective-1200 w-full cursor-pointer"
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        <motion.div
          animate={{
            rotateX: tilt.rotateX,
            rotateY: (flipped ? 180 : 0) + tilt.rotateY,
          }}
          transition={{ type: 'spring', stiffness: 260, damping: 24 }}
          className="relative h-[262px] sm:h-[276px] w-full preserve-3d"
        >
          <div className="backface-hidden shimmer-sweep absolute inset-0 overflow-hidden rounded-[26px] border border-white/20 bg-gradient-to-br from-[#0B2D61] via-[#072146] to-[#030E21] p-6 text-white shadow-card3d flex flex-col justify-between">
            <div
              className="pointer-events-none absolute inset-0 opacity-45 transition-opacity duration-300"
              style={{
                background: `radial-gradient(circle at ${tilt.glareX}% ${tilt.glareY}%, rgba(45,204,205,0.34), rgba(212,175,55,0.08) 40%, transparent 70%)`,
              }}
            />

            <div className="pointer-events-none absolute -right-12 -bottom-16 h-56 w-56 rounded-full border border-cyan-400/20" />
            <div className="pointer-events-none absolute -right-4 -bottom-8 h-40 w-40 rounded-full border border-amber-300/15" />

            {isFrozen && (
              <div className="absolute inset-0 z-20 flex items-center justify-center bg-[#04142C]/75 backdrop-blur-[3px]">
                <div className="flex items-center gap-2 rounded-full border border-cyan-300/40 bg-cyan-500/20 px-4 py-2 text-xs font-bold uppercase tracking-widest text-cyan-200">
                  <Snowflake className="h-4 w-4 animate-spin" />
                  Carte Virtuelle Gelée
                </div>
              </div>
            )}

            <div className="relative z-30 flex items-start justify-between">
              <div className="flex items-center gap-2.5">
                <BrandLogo variant="dark" size="sm" />
                <span className="rounded-md border border-amber-300/35 bg-amber-300/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-amber-200">
                  Infinite 3D
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleBalance();
                  }}
                  title={showBalance ? 'Masquer le solde' : 'Afficher le solde'}
                  className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] font-semibold text-white backdrop-blur-md transition hover:bg-white/20"
                >
                  {showBalance ? (
                    <>
                      <EyeOff className="h-3.5 w-3.5 text-cyan-300" />
                      <span>Masquer</span>
                    </>
                  ) : (
                    <>
                      <Eye className="h-3.5 w-3.5 text-cyan-300" />
                      <span>Solde</span>
                    </>
                  )}
                </button>
                <Wifi className="h-5 w-5 rotate-90 text-cyan-300/85" />
              </div>
            </div>

            <div className="relative z-30 my-1 flex items-center justify-between gap-3">
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-cyan-200/80">
                  Solde disponible Carte MONERA
                </div>
                <div className="mt-0.5 font-mono text-2xl sm:text-[28px] font-bold tracking-tight tabular-nums text-white">
                  {showBalance ? (
                    <span>{formatMoney(balance, currency)}</span>
                  ) : (
                    <span className="tracking-[0.22em] text-white/90">•••• •••,•• €</span>
                  )}
                </div>
              </div>

              <div className="h-9 w-12 rounded-lg bg-gradient-to-br from-[#F6E29F] via-[#D4AF37] to-[#9E7B1C] p-[1px] shadow-inner shrink-0">
                <div className="h-full w-full rounded-[7px] border border-amber-950/30 grid grid-cols-3 grid-rows-3 opacity-75">
                  <div className="border-r border-b border-amber-950/35" />
                  <div className="border-r border-b border-amber-950/35" />
                  <div className="border-b border-amber-950/35" />
                  <div className="border-r border-b border-amber-950/35" />
                  <div className="border-r border-b border-amber-950/35 bg-amber-900/20" />
                  <div className="border-b border-amber-950/35" />
                  <div className="border-r border-amber-950/35" />
                  <div className="border-r border-amber-950/35" />
                  <div />
                </div>
              </div>
            </div>

            <div className="relative z-30 space-y-2.5">
              <div className="font-mono text-sm sm:text-[15px] tracking-[0.2em] text-slate-100 tabular-nums">
                {showCardSecrets ? rawCard : maskedCard}
              </div>

              <div className="flex items-end justify-between text-xs">
                <div className="min-w-0 pr-3">
                  <div className="text-[9px] uppercase tracking-[0.18em] text-slate-400">
                    Titulaire • {memberCode}
                  </div>
                  <div className="truncate font-display text-xs sm:text-sm font-semibold uppercase tracking-wider text-white">
                    {holderName}
                  </div>
                </div>

                <div className="flex items-center gap-4 shrink-0">
                  <div>
                    <div className="text-[9px] uppercase tracking-[0.16em] text-slate-400">Exp</div>
                    <div className="font-mono font-semibold text-white">{expiry}</div>
                  </div>
                  <div>
                    <div className="text-[9px] uppercase tracking-[0.16em] text-slate-400">CVV</div>
                    <div className="font-mono font-semibold text-cyan-300">
                      {showCardSecrets ? cvv : '•••'}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="backface-hidden rotate-y-180 absolute inset-0 overflow-hidden rounded-[26px] border border-cyan-300/25 bg-gradient-to-br from-[#04142C] via-[#072146] to-[#0A2F63] text-white shadow-card3d flex flex-col justify-between py-5">
            <div className="h-10 w-full bg-gradient-to-r from-slate-950 via-slate-800 to-slate-950 border-y border-white/10" />

            <div className="px-6 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex-1 h-9 rounded-lg bg-white/90 px-3 flex items-center justify-between text-[#072146]">
                  <span className="font-mono text-[11px] tracking-widest text-slate-500">
                    SIGNATURE CRYPTO
                  </span>
                  <span className="font-mono text-sm font-extrabold">{cvv}</span>
                </div>
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-cyan-300">
                  <ShieldCheck className="h-4 w-4" />
                  3DS v2.4
                </span>
              </div>

              <div className="rounded-xl border border-white/15 bg-white/[0.05] p-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase tracking-[0.16em] text-cyan-300 font-semibold">
                    RIB Officiel MONERA ({memberCode})
                  </span>
                  <button
                    type="button"
                    onClick={copyRib}
                    className="inline-flex items-center gap-1 rounded-md bg-white/10 px-2 py-0.5 text-[11px] font-medium text-white hover:bg-white/20"
                  >
                    {copiedRib ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3 text-cyan-300" />}
                    {copiedRib ? 'Copié' : 'Copier'}
                  </button>
                </div>
                <div className="mt-1.5 font-mono text-[11px] sm:text-xs text-white tracking-wider break-all">
                  {rib}
                </div>
              </div>
            </div>

            <div className="px-6 flex items-center justify-between text-[11px] text-slate-300">
              <span>MONERA Interbank Clearing Network</span>
              <span className="font-mono text-cyan-300">{currency}</span>
            </div>
          </div>
        </motion.div>
      </div>

      {interactiveControls && (
        <div className="mt-3.5 grid grid-cols-3 gap-2">
          <button
            type="button"
            onClick={onToggleBalance}
            className="flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-[#072146] shadow-sm transition hover:border-[#0284FE] hover:text-[#0284FE]"
          >
            {showBalance ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            <span>{showBalance ? 'Masquer solde' : 'Afficher solde'}</span>
          </button>

          <button
            type="button"
            onClick={() => setShowCardSecrets((prev) => !prev)}
            className="flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-[#072146] shadow-sm transition hover:border-[#0284FE] hover:text-[#0284FE]"
          >
            <Lock className="h-3.5 w-3.5" />
            <span>{showCardSecrets ? 'Cacher N°' : 'Numéro & CVV'}</span>
          </button>

          <button
            type="button"
            onClick={() => setFlipped((prev) => !prev)}
            className="flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-[#072146] shadow-sm transition hover:border-[#0284FE] hover:text-[#0284FE]"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>{flipped ? 'Voir Recto' : 'Verso / RIB'}</span>
          </button>

          {onToggleFreeze && (
            <button
              type="button"
              disabled={freezing}
              onClick={onToggleFreeze}
              className={`col-span-3 flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold transition ${
                isFrozen
                  ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                  : 'bg-[#072146]/5 text-[#072146] hover:bg-[#072146]/10'
              }`}
            >
              <Snowflake className="h-3.5 w-3.5" />
              <span>
                {isFrozen
                  ? 'Réactiver immédiatement ma carte virtuelle MONERA'
                  : 'Verrouiller temporairement ma carte virtuelle'}
              </span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
