import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Check,
  Copy,
  Download,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Clock,
  Landmark,
  X,
  ArrowUpRight,
  ArrowDownLeft,
} from 'lucide-react';
import { formatMoney } from '../utils/format';

const SCENE_THEMES = {
  transfer_success: {
    badge: 'PROTOCOLE QUANTUM VALIDÉ',
    defaultTitle: 'Paiement Effectué avec Succès',
    subtitle: 'Transaction scellée sur le grand livre PostgreSQL MONERA.',
    primary: '#2DCCCD',
    secondary: '#10B981',
    glow: 'from-cyan-500/35 via-emerald-500/20 to-blue-600/30',
    ringBorder: 'border-cyan-400/60',
    ringSecondary: 'border-emerald-400/50',
    icon: Check,
    spinSpeed: 0.016,
    reverseFlow: false,
  },
  transfer_approved: {
    badge: 'APPROBATION BACK-OFFICE EXÉCUTÉE',
    defaultTitle: 'Paiement Approuvé & Crédité',
    subtitle: 'Les fonds ont été définitivement libérés vers le bénéficiaire.',
    primary: '#10B981',
    secondary: '#2DCCCD',
    glow: 'from-emerald-500/35 via-cyan-500/20 to-sky-600/30',
    ringBorder: 'border-emerald-400/65',
    ringSecondary: 'border-cyan-300/50',
    icon: ShieldCheck,
    spinSpeed: 0.017,
    reverseFlow: false,
  },
  cancel_requested: {
    badge: 'CHRONOSPHÈRE DE SÉCURITÉ ACTIVE',
    defaultTitle: 'Demande d’Annulation Transmise',
    subtitle: 'Opération placée sous séquestre algorithmique dans l’attente de la validation Admin.',
    primary: '#F59E0B',
    secondary: '#F0D384',
    glow: 'from-amber-500/35 via-yellow-500/20 to-orange-600/25',
    ringBorder: 'border-amber-400/65',
    ringSecondary: 'border-yellow-300/50',
    icon: Clock,
    spinSpeed: 0.011,
    reverseFlow: true,
  },
  transfer_cancelled: {
    badge: 'RÉVOCATION & RESTITUTION INTÉGRALE',
    defaultTitle: 'Transfert Annulé • Fonds Restitués',
    subtitle: 'Validation administrative confirmée : le montant intégral est revenu sur le compte expéditeur.',
    primary: '#F43F5E',
    secondary: '#2DCCCD',
    glow: 'from-rose-500/35 via-cyan-500/25 to-indigo-600/30',
    ringBorder: 'border-rose-400/70',
    ringSecondary: 'border-cyan-400/60',
    icon: RotateCcw,
    spinSpeed: -0.022,
    reverseFlow: true,
  },
  loan_submitted: {
    badge: 'CHAMBRE DE CRÉDIT MONERA',
    defaultTitle: 'Demande de Prêt Enregistrée',
    subtitle: 'Votre dossier financier est en cours d’instruction prioritaire par l’Administration.',
    primary: '#0284FE',
    secondary: '#D4AF37',
    glow: 'from-blue-500/35 via-cyan-500/20 to-amber-400/25',
    ringBorder: 'border-sky-400/65',
    ringSecondary: 'border-amber-300/55',
    icon: Landmark,
    spinSpeed: 0.014,
    reverseFlow: false,
  },
  loan_approved: {
    badge: 'DÉBLOCAGE SOUVERAIN CONFIRMÉ',
    defaultTitle: 'Prêt Approuvé • Capital Crédité',
    subtitle: 'Les fonds du financement ont été versés instantanément sur le compte membre.',
    primary: '#D4AF37',
    secondary: '#2DCCCD',
    glow: 'from-amber-400/35 via-emerald-400/20 to-cyan-500/30',
    ringBorder: 'border-amber-300/75',
    ringSecondary: 'border-cyan-400/60',
    icon: Sparkles,
    spinSpeed: 0.019,
    reverseFlow: false,
  },
  admin_credit: {
    badge: 'TRÉSORERIE CENTRALE MONERA',
    defaultTitle: 'Crédit Exécuté avec Succès',
    subtitle: 'Le solde du membre a été crédité instantanément de manière atomique.',
    primary: '#2DCCCD',
    secondary: '#D4AF37',
    glow: 'from-cyan-500/35 via-teal-400/20 to-amber-400/25',
    ringBorder: 'border-cyan-300/70',
    ringSecondary: 'border-emerald-300/55',
    icon: ArrowDownLeft,
    spinSpeed: 0.018,
    reverseFlow: false,
  },
  admin_debit: {
    badge: 'TRÉSORERIE CENTRALE MONERA',
    defaultTitle: 'Débit Exécuté sur le Compte',
    subtitle: 'L’écriture comptable de débit a été appliquée avec mise à jour immédiate du solde.',
    primary: '#FB7185',
    secondary: '#38BDF8',
    glow: 'from-rose-500/30 via-sky-500/20 to-indigo-600/30',
    ringBorder: 'border-rose-400/65',
    ringSecondary: 'border-sky-400/55',
    icon: ArrowUpRight,
    spinSpeed: -0.016,
    reverseFlow: true,
  },
};

export default function FuturisticStatusModal3D({ event, onClose }) {
  const canvasRef = useRef(null);
  const pointerRef = useRef({ x: 0, y: 0 });
  const [copied, setCopied] = useState(false);

  const theme = SCENE_THEMES[event?.variant] || SCENE_THEMES.transfer_success;
  const IconComponent = theme.icon;

  useEffect(() => {
    if (!event || !canvasRef.current) return undefined;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    let animId;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = 340;
    const height = 240;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    const phi = (1 + Math.sqrt(5)) / 2;
    const rawVertices = [
      [-1, phi, 0], [1, phi, 0], [-1, -phi, 0], [1, -phi, 0],
      [0, -1, phi], [0, 1, phi], [0, -1, -phi], [0, 1, -phi],
      [phi, 0, -1], [phi, 0, 1], [-phi, 0, -1], [-phi, 0, 1],
    ];
    const vertices = rawVertices.map(([x, y, z]) => [x * 36, y * 36, z * 36]);

    const edges = [];
    for (let i = 0; i < vertices.length; i += 1) {
      for (let j = i + 1; j < vertices.length; j += 1) {
        const dx = vertices[i][0] - vertices[j][0];
        const dy = vertices[i][1] - vertices[j][1];
        const dz = vertices[i][2] - vertices[j][2];
        const dist = Math.hypot(dx, dy, dz);
        if (dist < 78) edges.push([i, j]);
      }
    }

    const particles = Array.from({ length: 46 }, (_, idx) => ({
      angle: (idx / 46) * Math.PI * 2,
      radius: 68 + (idx % 5) * 14,
      yOffset: ((idx % 9) - 4) * 11,
      speed: (theme.reverseFlow ? -1 : 1) * (0.012 + (idx % 4) * 0.005),
      size: 1.4 + (idx % 3) * 0.9,
    }));

    let rx = 0.35;
    let ry = 0.2;

    const project = (x, y, z) => {
      const fov = 260;
      const scale = fov / (fov + z + 140);
      return {
        sx: width / 2 + x * scale,
        sy: height / 2 + y * scale,
        scale,
        z,
      };
    };

    const rotatePoint = ([x, y, z], ax, ay) => {
      const cosY = Math.cos(ay);
      const sinY = Math.sin(ay);
      const x1 = x * cosY - z * sinY;
      const z1 = z * cosY + x * sinY;

      const cosX = Math.cos(ax);
      const sinX = Math.sin(ax);
      const y2 = y * cosX - z1 * sinX;
      const z2 = z1 * cosX + y * sinX;
      return [x1, y2, z2];
    };

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      rx += theme.spinSpeed * 0.65 + pointerRef.current.y * 0.002;
      ry += theme.spinSpeed + pointerRef.current.x * 0.002;

      const radial = ctx.createRadialGradient(width / 2, height / 2, 6, width / 2, height / 2, 118);
      radial.addColorStop(0, `${theme.primary}38`);
      radial.addColorStop(0.55, `${theme.secondary}16`);
      radial.addColorStop(1, 'transparent');
      ctx.fillStyle = radial;
      ctx.fillRect(0, 0, width, height);

      particles.forEach((p) => {
        p.angle += p.speed;
        const px = Math.cos(p.angle) * p.radius;
        const pz = Math.sin(p.angle) * p.radius;
        const [rxp, ryp, rzp] = rotatePoint([px, p.yOffset, pz], 0.42 + pointerRef.current.y * 0.25, pointerRef.current.x * 0.25);
        const proj = project(rxp, ryp, rzp);
        ctx.beginPath();
        ctx.arc(proj.sx, proj.sy, Math.max(0.8, p.size * proj.scale), 0, Math.PI * 2);
        ctx.fillStyle = rzp > 0 ? theme.secondary : theme.primary;
        ctx.globalAlpha = Math.min(0.95, Math.max(0.2, proj.scale));
        ctx.fill();
      });

      ctx.globalAlpha = 1;
      const projected = vertices.map((v) => project(...rotatePoint(v, rx, ry)));

      edges.forEach(([i, j]) => {
        const a = projected[i];
        const b = projected[j];
        const depthAlpha = Math.max(0.18, Math.min(0.85, ((a.scale + b.scale) / 2) * 0.95));
        const grad = ctx.createLinearGradient(a.sx, a.sy, b.sx, b.sy);
        grad.addColorStop(0, theme.primary);
        grad.addColorStop(1, theme.secondary);
        ctx.strokeStyle = grad;
        ctx.globalAlpha = depthAlpha;
        ctx.lineWidth = 1.45;
        ctx.beginPath();
        ctx.moveTo(a.sx, a.sy);
        ctx.lineTo(b.sx, b.sy);
        ctx.stroke();
      });

      projected.forEach((pt) => {
        ctx.globalAlpha = Math.min(1, pt.scale + 0.15);
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.arc(pt.sx, pt.sy, 2.2 * pt.scale, 0, Math.PI * 2);
        ctx.fill();
      });

      ctx.globalAlpha = 1;
      animId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animId);
  }, [event, theme]);

  if (!event) return null;

  const handleCopyRef = () => {
    if (!event.reference) return;
    navigator.clipboard.writeText(event.reference);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadVoucher = () => {
    const lines = [
      '======================================================',
      '        MONERA PRIVATE & DIGITAL BANKING',
      '        CERTIFICAT CRYPTOGRAPHIQUE D’OPÉRATION',
      '======================================================',
      `Statut      : ${event.title || theme.defaultTitle}`,
      `Référence   : ${event.reference || 'MNR-CERT-2026'}`,
      event.amount !== undefined ? `Montant     : ${formatMoney(event.amount)}` : null,
      event.counterparty ? `Partie liée : ${event.counterparty}` : null,
      event.detail ? `Détail      : ${event.detail}` : null,
      `Horodatage  : ${new Date().toLocaleString('fr-FR')}`,
      '======================================================',
    ]
      .filter(Boolean)
      .join('\n');

    const blob = new Blob([lines], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `MONERA-${event.reference || 'operation'}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 z-50 flex items-center justify-center bg-[#020B1B]/85 backdrop-blur-xl p-4"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.86, rotateX: 16, y: 28 }}
          animate={{ opacity: 1, scale: 1, rotateX: 0, y: 0 }}
          exit={{ opacity: 0, scale: 0.92, y: 18 }}
          transition={{ type: 'spring', stiffness: 260, damping: 24 }}
          onClick={(e) => e.stopPropagation()}
          onMouseMove={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            pointerRef.current = {
              x: ((e.clientX - rect.left) / rect.width - 0.5) * 2,
              y: ((e.clientY - rect.top) / rect.height - 0.5) * 2,
            };
          }}
          className="relative w-full max-w-lg overflow-hidden rounded-3xl border border-white/15 bg-gradient-to-b from-[#072146] via-[#051836] to-[#030F24] text-white shadow-[0_35px_90px_-15px_rgba(0,0,0,0.85)]"
        >
          <div className={`pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 h-64 w-96 rounded-full bg-gradient-to-r ${theme.glow} blur-3xl`} />

          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="absolute right-4 top-4 z-20 flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-white/5 text-white/75 transition hover:bg-white/15 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>

          <div className="relative px-6 pt-6 pb-7 sm:px-8">
            <div className="flex justify-center">
              <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3.5 py-1 text-[11px] font-semibold tracking-[0.18em] text-cyan-200 uppercase">
                <span className="h-2 w-2 rounded-full bg-cyan-400 animate-ping" />
                {theme.badge}
              </span>
            </div>

            <div className="relative mx-auto my-2 flex h-[230px] w-[320px] items-center justify-center perspective-1200">
              <div className={`pointer-events-none absolute h-44 w-44 rounded-full border ${theme.ringBorder} orbit-ring-a`} />
              <div className={`pointer-events-none absolute h-52 w-52 rounded-full border border-dashed ${theme.ringSecondary} orbit-ring-b`} />
              <div className="pointer-events-none absolute h-36 w-36 rounded-full border border-white/20 orbit-ring-c" />

              <canvas
                ref={canvasRef}
                className="relative z-10 h-[240px] w-[340px] pointer-events-none"
              />

              <motion.div
                initial={{ scale: 0, rotate: -35 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ delay: 0.14, type: 'spring', stiffness: 280, damping: 18 }}
                className="pointer-events-none absolute z-20 flex h-16 w-16 items-center justify-center rounded-2xl border border-white/30 bg-[#072146]/80 backdrop-blur-md shadow-[0_0_35px_rgba(45,204,205,0.5)]"
              >
                <IconComponent className="h-8 w-8 text-white" strokeWidth={2.2} />
              </motion.div>
            </div>

            <div className="text-center space-y-2">
              <h3 className="font-display text-2xl sm:text-[26px] font-bold tracking-tight text-white">
                {event.title || theme.defaultTitle}
              </h3>
              <p className="text-sm text-slate-300 max-w-md mx-auto leading-relaxed">
                {event.subtitle || theme.subtitle}
              </p>
            </div>

            {event.amount !== undefined && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.18 }}
                className="mt-5 rounded-2xl border border-white/12 bg-white/[0.04] p-4 backdrop-blur-md"
              >
                <div className="text-center">
                  <div className="text-[11px] uppercase tracking-[0.16em] text-slate-400">
                    Montant de l’opération
                  </div>
                  <div className="mt-1 font-mono text-3xl sm:text-4xl font-bold tracking-tight text-white tabular-nums">
                    {formatMoney(event.amount)}
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-3 border-t border-white/10 text-xs">
                  {event.reference && (
                    <div className="flex items-center justify-between sm:block rounded-xl bg-white/[0.03] px-3 py-2">
                      <span className="text-slate-400 block">Référence</span>
                      <span className="font-mono font-semibold text-cyan-300">{event.reference}</span>
                    </div>
                  )}
                  {event.counterparty && (
                    <div className="flex items-center justify-between sm:block rounded-xl bg-white/[0.03] px-3 py-2">
                      <span className="text-slate-400 block">Contrepartie</span>
                      <span className="font-medium text-white truncate block">{event.counterparty}</span>
                    </div>
                  )}
                </div>

                {event.detail && (
                  <div className="mt-2.5 rounded-xl bg-white/[0.03] px-3 py-2 text-xs text-slate-300">
                    {event.detail}
                  </div>
                )}
              </motion.div>
            )}

            <div className="mt-6 flex flex-wrap items-center gap-2.5">
              {event.reference && (
                <button
                  type="button"
                  onClick={handleCopyRef}
                  className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-white/15 bg-white/5 px-3.5 py-2.5 text-xs font-semibold text-white transition hover:bg-white/10"
                >
                  {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5 text-cyan-300" />}
                  {copied ? 'Copié' : 'Copier réf.'}
                </button>
              )}

              <button
                type="button"
                onClick={handleDownloadVoucher}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-white/15 bg-white/5 px-3.5 py-2.5 text-xs font-semibold text-white transition hover:bg-white/10"
              >
                <Download className="h-3.5 w-3.5 text-cyan-300" />
                Certificat
              </button>

              <button
                type="button"
                onClick={onClose}
                className="ml-auto flex-1 sm:flex-none inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-[#0284FE] to-[#2DCCCD] px-6 py-2.5 text-sm font-bold text-[#04142C] shadow-lg shadow-cyan-500/25 transition hover:brightness-110"
              >
                Continuer
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
