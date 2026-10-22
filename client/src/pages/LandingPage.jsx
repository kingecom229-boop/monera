import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowRight,
  CheckCircle2,
  CreditCard,
  Globe2,
  Landmark,
  Lock,
  Menu,
  RefreshCcw,
  Send,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  X,
} from 'lucide-react';
import BrandLogo from '../components/BrandLogo';
import MoneraVirtualCard3D from '../components/MoneraVirtualCard3D';
import { useAuth } from '../context/AuthContext';
import { calculateLoanPreview, formatMoney } from '../utils/format';

export default function LandingPage() {
  const { user, siteSettings, publicMetrics, trigger3DEvent } = useAuth();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [heroShowBalance, setHeroShowBalance] = useState(true);
  const [activeSegment, setActiveSegment] = useState('particuliers');

  const [simAmount, setSimAmount] = useState(35000);
  const [simMonths, setSimMonths] = useState(48);

  const annualRate = Number(siteSettings?.loanAnnualRate || 3.85);
  const maxLoan = Number(siteSettings?.maxLoanAmount || 250000);
  const loanPreview = calculateLoanPreview(simAmount, annualRate, simMonths);

  const dashboardTarget = user?.role === 'admin' ? '/admin' : '/dashboard';

  return (
    <div className="min-h-screen flex flex-col bg-white text-slate-900">
      <div className="bg-[#04142C] text-slate-300 border-b border-white/10 text-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-10 flex items-center justify-between">
          <div className="hidden md:flex items-center gap-6">
            {[
              { id: 'particuliers', label: 'Particuliers' },
              { id: 'entreprises', label: 'Entreprises & Corporate' },
              { id: 'private', label: 'Banque Privée' },
            ].map((seg) => (
              <button
                key={seg.id}
                type="button"
                onClick={() => setActiveSegment(seg.id)}
                className={`h-10 border-b-2 font-medium transition ${
                  activeSegment === seg.id
                    ? 'border-[#2DCCCD] text-white font-semibold'
                    : 'border-transparent text-slate-400 hover:text-white'
                }`}
              >
                {seg.label}
              </button>
            ))}
          </div>

          <div className="truncate text-[11px] sm:text-xs text-cyan-200/90 font-medium">
            {siteSettings?.announcementEnabled ? siteSettings.announcementText : siteSettings?.bankName}
          </div>

          <div className="hidden lg:flex items-center gap-4 text-slate-400">
            <span className="inline-flex items-center gap-1.5 text-emerald-400 font-medium">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              Réseau {siteSettings?.bankName || 'MONERA'} Opérationnel ({publicMetrics.uptime})
            </span>
          </div>
        </div>
      </div>

      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200/80 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between gap-4">
          <Link to="/" className="shrink-0">
            <BrandLogo variant="light" size="lg" />
          </Link>

          <nav className="hidden lg:flex items-center gap-8 text-sm font-semibold text-[#072146]">
            <a href="#solutions" className="hover:text-[#0284FE] transition">
              Comptes & Cartes 3D
            </a>
            <a href="#virements" className="hover:text-[#0284FE] transition">
              Transferts RIB-MONERA
            </a>
            <a href="#simulateur" className="hover:text-[#0284FE] transition">
              Crédits & Prêts
            </a>
            <a href="#experience-3d" className="hover:text-[#0284FE] transition">
              Technologie 3D
            </a>
            <a href="#securite" className="hover:text-[#0284FE] transition">
              Sécurité
            </a>
          </nav>

          <div className="hidden sm:flex items-center gap-3">
            {user ? (
              <Link
                to={dashboardTarget}
                className="inline-flex items-center gap-2 rounded-lg bg-[#072146] px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-[#0A2F63]"
              >
                <span>Mon Espace {user.role === 'admin' ? 'Direction' : 'Client'}</span>
                <ArrowRight className="h-4 w-4 text-[#2DCCCD]" />
              </Link>
            ) : (
              <>
                <Link
                  to="/auth?mode=login"
                  className="inline-flex items-center justify-center rounded-lg border-2 border-[#072146] px-4 py-2 text-sm font-bold text-[#072146] transition hover:bg-[#072146] hover:text-white"
                >
                  Accès Client
                </Link>
                <Link
                  to="/auth?mode=register"
                  className="inline-flex items-center gap-2 rounded-lg bg-[#0284FE] px-5 py-2.5 text-sm font-bold text-white shadow-md shadow-blue-500/20 transition hover:bg-[#072146]"
                >
                  <span>Ouvrir un compte</span>
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </>
            )}
          </div>

          <button
            type="button"
            onClick={() => setMobileMenuOpen((v) => !v)}
            aria-label="Menu"
            className="sm:hidden rounded-lg p-2 text-[#072146] hover:bg-slate-100"
          >
            {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>

        {mobileMenuOpen && (
          <div className="sm:hidden border-t border-slate-200 bg-white px-4 py-5 space-y-4">
            <div className="flex flex-col space-y-3 text-sm font-semibold text-[#072146]">
              <a href="#solutions" onClick={() => setMobileMenuOpen(false)}>Comptes & Cartes 3D</a>
              <a href="#virements" onClick={() => setMobileMenuOpen(false)}>Transferts RIB-MONERA</a>
              <a href="#simulateur" onClick={() => setMobileMenuOpen(false)}>Crédits & Prêts</a>
              <a href="#experience-3d" onClick={() => setMobileMenuOpen(false)}>Technologie 3D</a>
            </div>
            <div className="grid grid-cols-2 gap-3 pt-2">
              {user ? (
                <Link
                  to={dashboardTarget}
                  className="col-span-2 text-center rounded-lg bg-[#072146] py-3 text-sm font-bold text-white"
                >
                  Accéder à mon espace
                </Link>
              ) : (
                <>
                  <Link
                    to="/auth?mode=login"
                    className="text-center rounded-lg border-2 border-[#072146] py-2.5 text-sm font-bold text-[#072146]"
                  >
                    Accès Client
                  </Link>
                  <Link
                    to="/auth?mode=register"
                    className="text-center rounded-lg bg-[#0284FE] py-2.5 text-sm font-bold text-white"
                  >
                    Ouvrir un compte
                  </Link>
                </>
              )}
            </div>
          </div>
        )}
      </header>

      <section className="relative overflow-hidden bg-gradient-to-br from-[#04142C] via-[#072146] to-[#0B326B] text-white pt-14 pb-24 lg:pt-20 lg:pb-32">
        <div
          className="pointer-events-none absolute inset-0 opacity-20"
          style={{
            backgroundImage:
              'radial-gradient(circle at 80% 22%, #2DCCCD 0%, transparent 38%), radial-gradient(circle at 18% 80%, #0284FE 0%, transparent 42%)',
          }}
        />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid lg:grid-cols-12 gap-12 items-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55 }}
            className="lg:col-span-7 space-y-6"
          >
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/30 bg-white/5 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-cyan-300">
              <Sparkles className="h-3.5 w-3.5" />
              {activeSegment === 'particuliers' && 'Banque Digitale & Patrimoniale Sans Frontières'}
              {activeSegment === 'entreprises' && 'Trésorerie Haute Fréquence & Paiements B2B'}
              {activeSegment === 'private' && 'Gestion Privée & Architecture Financière Sur Mesure'}
            </div>

            <h1 className="font-display text-4xl sm:text-5xl lg:text-[56px] font-bold leading-[1.07] tracking-tight">
              Prenez une longueur d’avance avec{' '}
              <span className="bg-gradient-to-r from-[#2DCCCD] via-sky-300 to-[#F0D384] bg-clip-text text-transparent">
                {siteSettings?.bankName || 'MONERA'}
              </span>
              .
            </h1>

            <p className="text-base sm:text-lg text-slate-200/90 max-w-2xl leading-relaxed">
              {siteSettings?.tagline} Gérez votre compte international doté d’un identifiant{' '}
              <strong className="text-white">RIB-MONERA</strong> unique, pilotez votre carte virtuelle
              3D à solde masquable et réalisez vos virements ou demandes de prêt en toute sérénité.
            </p>

            <div className="flex flex-wrap items-center gap-4 pt-2">
              <Link
                to={user ? dashboardTarget : '/auth?mode=register'}
                className="inline-flex items-center gap-2.5 rounded-xl bg-[#2DCCCD] px-7 py-4 text-sm sm:text-base font-extrabold text-[#04142C] shadow-lg shadow-cyan-500/30 transition hover:bg-white"
              >
                <span>{user ? 'Ouvrir mon Tableau de Bord' : 'Ouvrir un compte gratuit'}</span>
                <ArrowRight className="h-4 w-4" />
              </Link>

              <a
                href="#simulateur"
                className="inline-flex items-center gap-2 rounded-xl border border-white/25 bg-white/5 px-6 py-4 text-sm sm:text-base font-semibold text-white backdrop-blur-sm transition hover:bg-white/15"
              >
                <span>Simuler un prêt à {annualRate.toFixed(2)} %</span>
              </a>
            </div>

            <div className="grid grid-cols-3 gap-6 pt-6 border-t border-white/15 max-w-xl">
              <div>
                <div className="font-display text-2xl sm:text-3xl font-bold text-white tabular-nums">
                  0 €
                </div>
                <div className="text-xs text-slate-300 mt-0.5">Frais de tenue de compte</div>
              </div>
              <div>
                <div className="font-display text-2xl sm:text-3xl font-bold text-[#2DCCCD] tabular-nums">
                  {annualRate.toFixed(2)} %
                </div>
                <div className="text-xs text-slate-300 mt-0.5">TAEG fixe transparent</div>
              </div>
              <div>
                <div className="font-display text-2xl sm:text-3xl font-bold text-[#F0D384] tabular-nums">
                  24/7
                </div>
                <div className="text-xs text-slate-300 mt-0.5">Contrôle & Révocation 3D</div>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 24 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.65, delay: 0.1 }}
            className="lg:col-span-5"
          >
            <div className="rounded-3xl border border-white/15 bg-white/[0.06] p-5 sm:p-6 backdrop-blur-xl shadow-2xl">
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-semibold uppercase tracking-widest text-cyan-300">
                  Aperçu Interactif • Carte Virtuelle 3D
                </span>
                <span className="text-[11px] text-slate-300">Survolez & cliquez sur « Solde »</span>
              </div>

              <MoneraVirtualCard3D
                account={{
                  fullName: 'ALEXANDRE MOREAU',
                  balance: 42890.50,
                  currency: 'EUR',
                  cardNumber: '4929 8401 6620 9104',
                  cardExpiry: '10/30',
                  cardCvv: '917',
                  memberCode: 'MNR-840192',
                  rib: 'MNR76 0081 9202 6084 0192 5510 47',
                  cardFrozen: false,
                }}
                showBalance={heroShowBalance}
                onToggleBalance={() => setHeroShowBalance((v) => !v)}
                interactiveControls={false}
              />

              <div className="mt-4 flex items-center justify-between rounded-2xl bg-[#04142C]/70 px-4 py-3 text-xs text-slate-300 border border-white/10">
                <span className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-[#2DCCCD] shrink-0" />
                  Solde masquable en un clic & RIB intégré au verso
                </span>
                <button
                  type="button"
                  onClick={() => setHeroShowBalance((v) => !v)}
                  className="font-bold text-[#2DCCCD] hover:underline shrink-0 ml-2"
                >
                  {heroShowBalance ? 'Masquer' : 'Afficher'}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      <section className="relative z-20 -mt-12 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            {
              icon: CreditCard,
              title: 'Carte Virtuelle 3D',
              desc: 'Émission immédiate dès l’inscription avec masquage confidentiel du solde.',
              href: '/auth?mode=register',
            },
            {
              icon: Send,
              title: 'Virements RIB-MONERA',
              desc: 'Transferts instantanés entre membres par ID, email ou RIB complet.',
              href: '#virements',
            },
            {
              icon: RefreshCcw,
              title: 'Garantie d’Annulation',
              desc: 'Demandez la révocation d’un transfert avec restitution contrôlée par la banque.',
              href: '#experience-3d',
            },
            {
              icon: Landmark,
              title: 'Prêts En Ligne',
              desc: 'Simulation transparente et déblocage direct des fonds après approbation.',
              href: '#simulateur',
            },
          ].map((item) => {
            const Icon = item.icon;
            const isRoute = item.href.startsWith('/');
            const content = (
              <div className="group h-full rounded-2xl bg-white p-6 shadow-bbva border border-slate-100 transition hover:-translate-y-1 hover:border-[#0284FE]/40 flex flex-col justify-between">
                <div>
                  <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-[#072146] text-[#2DCCCD] group-hover:bg-[#0284FE] group-hover:text-white transition">
                    <Icon className="h-6 w-6" />
                  </div>
                  <h3 className="mt-4 font-display text-lg font-bold text-[#072146]">
                    {item.title}
                  </h3>
                  <p className="mt-1.5 text-sm text-slate-600 leading-relaxed">{item.desc}</p>
                </div>
                <div className="mt-4 inline-flex items-center gap-1.5 text-xs font-bold text-[#0284FE]">
                  <span>Découvrir</span>
                  <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-1" />
                </div>
              </div>
            );
            return isRoute ? (
              <Link key={item.title} to={item.href}>
                {content}
              </Link>
            ) : (
              <a key={item.title} href={item.href}>
                {content}
              </a>
            );
          })}
        </div>
      </section>

      <section id="solutions" className="py-20 lg:py-28 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl">
          <span className="text-xs font-bold uppercase tracking-[0.2em] text-[#0284FE]">
            Architecture Bancaire Globale
          </span>
          <h2 className="mt-2 font-display text-3xl sm:text-4xl font-bold text-[#072146]">
            Une machine financière conçue pour la rapidité, la clarté et le contrôle absolu.
          </h2>
        </div>

        <div id="virements" className="mt-12 grid lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 rounded-3xl bg-[#F4F7FB] p-8 sm:p-10 border border-slate-200/70 flex flex-col justify-between">
            <div className="space-y-4">
              <span className="inline-block rounded-lg bg-[#072146] px-3 py-1 text-xs font-bold text-[#2DCCCD]">
                EXCLUSIVITÉ MONERA
              </span>
              <h3 className="font-display text-2xl sm:text-3xl font-bold text-[#072146]">
                Identifiant RIB-MONERA & Mécanisme de Révocation Sécurisée
              </h3>
              <p className="text-slate-600 leading-relaxed">
                Chaque titulaire reçoit automatiquement un identifiant client unique (
                <code className="font-mono font-semibold text-[#072146]">MNR-XXXXXX</code>) ainsi
                qu’un relevé d’identité bancaire normalisé. En cas d’erreur sur un virement émis,
                vous pouvez initier une demande d’annulation en un clic : notre Chambre de Contrôle
                Back-Office vérifie l’opération et restitue l’intégralité des fonds sur votre solde.
              </p>
            </div>

            <div className="mt-8 grid sm:grid-cols-3 gap-4">
              {[
                { step: '01', title: 'Émission Instantanée', sub: 'Vérification du bénéficiaire en direct avant envoi' },
                { step: '02', title: 'Révocation à la Demande', sub: 'Signalement immédiat depuis votre historique client' },
                { step: '03', title: 'Validation & Restitution', sub: 'Recrédit intégral sur décision de l’Administration' },
              ].map((s) => (
                <div key={s.step} className="rounded-2xl bg-white p-4 border border-slate-200/80">
                  <div className="font-mono text-xs font-bold text-[#0284FE]">{s.step}</div>
                  <div className="mt-1 font-display font-bold text-sm text-[#072146]">{s.title}</div>
                  <div className="mt-1 text-xs text-slate-500">{s.sub}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-3xl bg-[#072146] text-white p-8 sm:p-10 flex flex-col justify-between relative overflow-hidden">
            <div className="relative z-10 space-y-4">
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 text-[#F0D384]">
                <TrendingUp className="h-6 w-6" />
              </div>
              <h3 className="font-display text-2xl font-bold">
                Pilotage Temps Réel & Transparence Totale
              </h3>
              <p className="text-sm text-slate-300 leading-relaxed">
                Notifications instantanées à chaque mouvement de crédit, débit, virement reçu ou
                décision d’octroi de prêt avec téléchargement immédiat de justificatif certifié.
              </p>
            </div>

            <ul className="relative z-10 mt-8 space-y-3 text-sm">
              {[
                'Solde actualisé au centime près sous transaction ACID',
                'Masquage confidentiel sur carte virtuelle 3D',
                'Relevé RIB-MONERA officiel prêt à partager',
              ].map((line) => (
                <li key={line} className="flex items-center gap-2.5 text-cyan-100">
                  <CheckCircle2 className="h-4 w-4 text-[#2DCCCD] shrink-0" />
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section id="simulateur" className="py-20 bg-[#F4F7FB] border-y border-slate-200/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid lg:grid-cols-12 gap-12 items-center">
          <div className="lg:col-span-5 space-y-5">
            <span className="text-xs font-bold uppercase tracking-[0.2em] text-[#0284FE]">
              Financement & Projets
            </span>
            <h2 className="font-display text-3xl sm:text-4xl font-bold text-[#072146]">
              Simulez votre crédit MONERA en toute transparence.
            </h2>
            <p className="text-slate-600 leading-relaxed">
              Immobilier, véhicule propre, trésorerie d’entreprise ou projet personnel : calculez
              votre mensualité exacte et soumettez votre dossier en ligne. Dès validation par
              l’Administration, le capital est crédité instantanément sur votre compte MONERA.
            </p>
            <div className="rounded-2xl bg-white p-5 border border-slate-200 space-y-2 text-xs text-slate-600">
              <div className="font-bold text-[#072146] uppercase tracking-wider">
                Avantages Crédit MONERA
              </div>
              <p>• Taux annuel fixe actuel : {annualRate.toFixed(2)} % TAEG</p>
              <p>• Aucune pénalité en cas de remboursement anticipé depuis votre espace client</p>
              <p>• Versement instantané des fonds sur votre RIB-MONERA dès approbation</p>
            </div>
          </div>

          <div className="lg:col-span-7 rounded-3xl bg-white p-6 sm:p-10 shadow-bbva border border-slate-200">
            <div className="space-y-7">
              <div>
                <div className="flex items-center justify-between">
                  <label className="text-sm font-bold text-[#072146]">Montant souhaité</label>
                  <span className="font-mono text-2xl font-extrabold text-[#0284FE] tabular-nums">
                    {formatMoney(simAmount)}
                  </span>
                </div>
                <input
                  type="range"
                  min={1000}
                  max={maxLoan}
                  step={500}
                  value={simAmount}
                  onChange={(e) => setSimAmount(Number(e.target.value))}
                  className="mt-3 w-full accent-[#0284FE] h-2 bg-slate-200 rounded-lg cursor-pointer"
                />
                <div className="mt-1 flex justify-between text-xs text-slate-400 font-mono">
                  <span>1 000 €</span>
                  <span>{formatMoney(maxLoan)}</span>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <label className="text-sm font-bold text-[#072146]">Durée de remboursement</label>
                  <span className="font-mono text-xl font-extrabold text-[#072146] tabular-nums">
                    {simMonths} mois ({(simMonths / 12).toFixed(1)} ans)
                  </span>
                </div>
                <input
                  type="range"
                  min={6}
                  max={84}
                  step={6}
                  value={simMonths}
                  onChange={(e) => setSimMonths(Number(e.target.value))}
                  className="mt-3 w-full accent-[#072146] h-2 bg-slate-200 rounded-lg cursor-pointer"
                />
                <div className="mt-1 flex justify-between text-xs text-slate-400 font-mono">
                  <span>6 mois</span>
                  <span>84 mois</span>
                </div>
              </div>

              <div className="grid sm:grid-cols-3 gap-4 rounded-2xl bg-[#072146] p-6 text-white">
                <div>
                  <div className="text-[11px] uppercase tracking-wider text-cyan-300">
                    Mensualité estimée
                  </div>
                  <div className="mt-1 font-mono text-2xl font-bold tabular-nums">
                    {formatMoney(loanPreview.monthlyPayment)}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] uppercase tracking-wider text-slate-300">
                    Coût total crédit
                  </div>
                  <div className="mt-1 font-mono text-xl font-bold text-[#F0D384] tabular-nums">
                    {formatMoney(loanPreview.totalInterest)}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] uppercase tracking-wider text-slate-300">
                    Montant total dû
                  </div>
                  <div className="mt-1 font-mono text-xl font-bold tabular-nums">
                    {formatMoney(loanPreview.totalRepayment)}
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() =>
                  navigate(
                    user
                      ? `/dashboard?tab=loans&amount=${simAmount}&months=${simMonths}`
                      : `/auth?mode=register`
                  )
                }
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-[#0284FE] py-4 text-sm sm:text-base font-bold text-white shadow-lg shadow-blue-500/25 transition hover:bg-[#072146]"
              >
                <span>Demander ce prêt de {formatMoney(simAmount)} en ligne</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </section>

      <section id="experience-3d" className="py-20 bg-[#04142C] text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl">
            <span className="text-xs font-bold uppercase tracking-[0.2em] text-[#2DCCCD]">
              Interface Holographique Temps Réel
            </span>
            <h2 className="mt-2 font-display text-3xl sm:text-4xl font-bold">
              Testez nos confirmations bancaires 3D nouvelle génération.
            </h2>
            <p className="mt-3 text-slate-300">
              Chaque opération clé chez MONERA déclenche un certificat visuel 3D interactif scellant
              l’état exact de votre transaction. Cliquez sur une démonstration ci-dessous :
            </p>
          </div>

          <div className="mt-10 grid md:grid-cols-3 gap-6">
            {[
              {
                label: 'Aperçu 3D • Paiement Effectué',
                desc: 'Visualisez la validation instantanée d’un virement RIB-MONERA avec polyèdre 3D.',
                accent: 'from-cyan-500/20 to-emerald-500/10 border-cyan-400/30',
                payload: {
                  variant: 'transfer_success',
                  title: 'Paiement Effectué avec Succès',
                  amount: 2450.00,
                  reference: 'TXN-DEMO-3D901',
                  counterparty: 'Camille Laurent (MNR-482910)',
                  detail: 'Démonstration interactive du moteur holographique 3D MONERA.',
                },
              },
              {
                label: 'Aperçu 3D • Transfert Annulé & Restitué',
                desc: 'Visualisez le vortex de restitution intégrale des fonds après validation Admin.',
                accent: 'from-rose-500/20 to-cyan-500/10 border-rose-400/30',
                payload: {
                  variant: 'transfer_cancelled',
                  title: 'Transfert Annulé • Fonds Restitués',
                  amount: 3400.00,
                  reference: 'TXN-REV-88412',
                  counterparty: 'Restitution vers Expéditeur',
                  detail: 'Validation Back-Office confirmée : +3 400,00 € recrédités.',
                },
              },
              {
                label: 'Aperçu 3D • Prêt Approuvé',
                desc: 'Visualisez l’ouverture de chambre forte lors du déblocage d’un financement.',
                accent: 'from-amber-400/20 to-sky-500/10 border-amber-300/30',
                payload: {
                  variant: 'loan_approved',
                  title: 'Prêt Approuvé • Capital Crédité',
                  amount: 25000.00,
                  reference: 'LOAN-3D-77210',
                  counterparty: 'Comité des Crédits MONERA',
                  detail: 'Versement immédiat sur votre solde courant disponible.',
                },
              },
            ].map((demo) => (
              <button
                key={demo.label}
                type="button"
                onClick={() => trigger3DEvent(demo.payload)}
                className={`text-left rounded-3xl border bg-gradient-to-br ${demo.accent} p-7 transition hover:-translate-y-1.5 hover:shadow-2xl`}
              >
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-white">
                  <Sparkles className="h-3.5 w-3.5 text-[#2DCCCD]" />
                  Lancer la Scène 3D
                </span>
                <h3 className="mt-4 font-display text-xl font-bold text-white">{demo.label}</h3>
                <p className="mt-2 text-sm text-slate-300 leading-relaxed">{demo.desc}</p>
              </button>
            ))}
          </div>
        </div>
      </section>

      <section id="securite" className="py-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid md:grid-cols-3 gap-8">
          {[
            {
              icon: Lock,
              title: 'Chiffrement & Sessions Durcies',
              desc: 'Hachage cryptographique salé, jetons signés HttpOnly, limitation anti-force brute et verrouillage adaptatif.',
            },
            {
              icon: ShieldCheck,
              title: 'Intégrité PostgreSQL ACID',
              desc: 'Toutes les écritures de solde, transferts, annulations et prêts s’exécutent au sein de transactions atomiques.',
            },
            {
              icon: Globe2,
              title: 'Traçabilité & Audit Temps Réel',
              desc: 'Chaque action client ou administrative est journalisée de façon horodatée pour une conformité irréprochable.',
            },
          ].map((sec) => {
            const Icon = sec.icon;
            return (
              <div key={sec.title} className="rounded-2xl border border-slate-200 p-7 bg-white">
                <div className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-[#F4F7FB] text-[#072146]">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="mt-4 font-display text-lg font-bold text-[#072146]">{sec.title}</h3>
                <p className="mt-2 text-sm text-slate-600 leading-relaxed">{sec.desc}</p>
              </div>
            );
          })}
        </div>
      </section>

      <footer className="mt-auto bg-[#072146] text-slate-300 border-t border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 grid md:grid-cols-4 gap-10">
          <div className="md:col-span-2 space-y-4">
            <BrandLogo variant="dark" size="lg" />
            <p className="text-sm text-slate-300/85 max-w-md leading-relaxed">
              {siteSettings?.tagline}
            </p>
            <div className="text-xs text-slate-400 space-y-1">
              <div>Siège : {siteSettings?.headquarters}</div>
              <div>
                Assistance 24/7 : {siteSettings?.supportEmail} • {siteSettings?.supportPhone}
              </div>
            </div>
          </div>

          <div>
            <h4 className="font-display font-bold text-white text-sm uppercase tracking-wider">
              Services Bancaires
            </h4>
            <ul className="mt-4 space-y-2.5 text-sm">
              <li><a href="#solutions" className="hover:text-[#2DCCCD]">Compte RIB-MONERA</a></li>
              <li><a href="#solutions" className="hover:text-[#2DCCCD]">Carte Virtuelle 3D</a></li>
              <li><a href="#virements" className="hover:text-[#2DCCCD]">Virements Instantanés</a></li>
              <li><a href="#simulateur" className="hover:text-[#2DCCCD]">Crédits & Prêts</a></li>
            </ul>
          </div>

          <div>
            <h4 className="font-display font-bold text-white text-sm uppercase tracking-wider">
              Espace Sécurisé
            </h4>
            <ul className="mt-4 space-y-2.5 text-sm">
              <li><Link to="/auth?mode=login" className="hover:text-[#2DCCCD]">Connexion Espace Client</Link></li>
              <li><Link to="/auth?mode=register" className="hover:text-[#2DCCCD]">Ouvrir un compte en ligne</Link></li>
              <li><a href="#securite" className="hover:text-[#2DCCCD]">Charte de Sécurité</a></li>
            </ul>
          </div>
        </div>

        <div className="border-t border-white/10 py-5 text-center text-xs text-slate-400">
          © {new Date().getFullYear()} {siteSettings?.bankName || 'MONERA'} Financial Group. Tous droits réservés.
        </div>
      </footer>
    </div>
  );
}
