import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  Lock,
  Mail,
  MapPin,
  Phone,
  ShieldCheck,
  User,
} from 'lucide-react';
import BrandLogo from '../components/BrandLogo';
import { useAuth } from '../context/AuthContext';

export default function AuthPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialMode = searchParams.get('mode') === 'register' ? 'register' : 'login';
  const [mode, setMode] = useState(initialMode);

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [country, setCountry] = useState('France');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const { user, login, register, siteSettings, trigger3DEvent } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      navigate(user.role === 'admin' ? '/admin' : '/dashboard', { replace: true });
    }
  }, [user, navigate]);

  useEffect(() => {
    setMode(searchParams.get('mode') === 'register' ? 'register' : 'login');
    setError('');
  }, [searchParams]);

  const switchMode = (nextMode) => {
    setSearchParams({ mode: nextMode });
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (mode === 'register' && password !== confirmPassword) {
      setError('Les deux mots de passe ne correspondent pas.');
      return;
    }

    setSubmitting(true);
    try {
      if (mode === 'login') {
        const logged = await login(email.trim(), password);
        navigate(logged.role === 'admin' ? '/admin' : '/dashboard', { replace: true });
      } else {
        const created = await register({
          fullName: fullName.trim(),
          email: email.trim(),
          phone: phone.trim(),
          country: country.trim() || 'France',
          password,
        });
        trigger3DEvent({
          variant: 'transfer_success',
          title: 'Bienvenue chez MONERA',
          subtitle: 'Votre compte courant RIB-MONERA et votre carte virtuelle 3D sont désormais actifs.',
          amount: created.balance,
          reference: created.memberCode,
          counterparty: created.rib,
        });
        navigate('/dashboard', { replace: true });
      }
    } catch (err) {
      setError(err.message || 'Impossible de finaliser l’authentification.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-12 bg-[#F4F7FB]">
      <div className="hidden lg:flex lg:col-span-5 bg-gradient-to-br from-[#04142C] via-[#072146] to-[#0B326B] text-white p-12 flex-col justify-between relative overflow-hidden">
        <div
          className="pointer-events-none absolute inset-0 opacity-25"
          style={{
            backgroundImage:
              'radial-gradient(circle at 20% 20%, #2DCCCD 0%, transparent 45%), radial-gradient(circle at 85% 85%, #0284FE 0%, transparent 45%)',
          }}
        />

        <div className="relative z-10">
          <Link to="/" className="inline-flex items-center gap-2 text-xs font-semibold text-cyan-300 hover:text-white mb-8">
            <ArrowLeft className="h-4 w-4" />
            Retour à l’accueil {siteSettings?.bankName || 'MONERA'}
          </Link>
          <div>
            <BrandLogo variant="dark" size="xl" />
          </div>
          <h1 className="mt-8 font-display text-3xl xl:text-4xl font-bold leading-tight">
            L’espace bancaire conçu pour protéger et démultiplier votre capital.
          </h1>
          <p className="mt-4 text-sm text-slate-300 leading-relaxed">
            Accédez à vos comptes, votre carte virtuelle 3D à solde confidentiel, vos virements
            instantanés RIB-MONERA et vos demandes de financement en toute sécurité.
          </p>
        </div>

        <div className="relative z-10 space-y-4 border-t border-white/15 pt-8 text-sm">
          {[
            'Attribution immédiate d’un ID Membre et d’un RIB-MONERA unique',
            'Carte virtuelle Infinite 3D avec affichage/masquage du solde',
            'Protection anti-fraude et validation Back-Office des révocations',
          ].map((item) => (
            <div key={item} className="flex items-start gap-3 text-slate-200">
              <CheckCircle2 className="h-5 w-5 text-[#2DCCCD] shrink-0 mt-0.5" />
              <span>{item}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="lg:col-span-7 flex flex-col justify-center px-4 py-10 sm:px-8 lg:px-16">
        <div className="mx-auto w-full max-w-md">
          <div className="lg:hidden flex items-center justify-between mb-8">
            <Link to="/">
              <BrandLogo variant="light" size="md" />
            </Link>
            <Link to="/" className="text-xs font-bold text-[#072146] hover:text-[#0284FE]">
              ← Accueil
            </Link>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-3xl bg-white p-7 sm:p-9 shadow-bbva border border-slate-200/80"
          >
            <div className="grid grid-cols-2 rounded-xl bg-[#F4F7FB] p-1 mb-7">
              <button
                type="button"
                onClick={() => switchMode('login')}
                className={`rounded-lg py-2.5 text-xs sm:text-sm font-bold transition ${
                  mode === 'login'
                    ? 'bg-[#072146] text-white shadow-sm'
                    : 'text-slate-600 hover:text-[#072146]'
                }`}
              >
                Se connecter
              </button>
              <button
                type="button"
                onClick={() => switchMode('register')}
                className={`rounded-lg py-2.5 text-xs sm:text-sm font-bold transition ${
                  mode === 'register'
                    ? 'bg-[#072146] text-white shadow-sm'
                    : 'text-slate-600 hover:text-[#072146]'
                }`}
              >
                Créer un compte
              </button>
            </div>

            <div className="mb-6">
              <h2 className="font-display text-2xl font-bold text-[#072146]">
                {mode === 'login' ? 'Accès à votre Espace Sécurisé' : 'Ouverture de Compte MONERA'}
              </h2>
              <p className="mt-1 text-xs sm:text-sm text-slate-500">
                {mode === 'login'
                  ? 'Saisissez vos identifiants personnels pour accéder à vos opérations.'
                  : 'Obtenez immédiatement votre RIB-MONERA et votre carte virtuelle 3D.'}
              </p>
            </div>

            {error && (
              <div className="mb-5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs sm:text-sm font-medium text-rose-700">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {mode === 'register' && (
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#072146] mb-1.5">
                    Nom et Prénom complets
                  </label>
                  <div className="relative">
                    <User className="h-4 w-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Ex. Jean-Marc Kouassi"
                      className="w-full rounded-xl border border-slate-300 bg-white pl-10 pr-4 py-3 text-sm text-slate-900 focus:border-[#0284FE] focus:outline-none focus:ring-2 focus:ring-[#0284FE]/20"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#072146] mb-1.5">
                  Adresse Email
                </label>
                <div className="relative">
                  <Mail className="h-4 w-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="votre.nom@exemple.com"
                    className="w-full rounded-xl border border-slate-300 bg-white pl-10 pr-4 py-3 text-sm text-slate-900 focus:border-[#0284FE] focus:outline-none focus:ring-2 focus:ring-[#0284FE]/20"
                  />
                </div>
              </div>

              {mode === 'register' && (
                <div className="grid sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-[#072146] mb-1.5">
                      Téléphone
                    </label>
                    <div className="relative">
                      <Phone className="h-4 w-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="+33 6 00 00 00 00"
                        className="w-full rounded-xl border border-slate-300 bg-white pl-10 pr-3 py-3 text-sm text-slate-900 focus:border-[#0284FE] focus:outline-none focus:ring-2 focus:ring-[#0284FE]/20"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-[#072146] mb-1.5">
                      Pays de résidence
                    </label>
                    <div className="relative">
                      <MapPin className="h-4 w-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        required
                        value={country}
                        onChange={(e) => setCountry(e.target.value)}
                        placeholder="France"
                        className="w-full rounded-xl border border-slate-300 bg-white pl-10 pr-3 py-3 text-sm text-slate-900 focus:border-[#0284FE] focus:outline-none focus:ring-2 focus:ring-[#0284FE]/20"
                      />
                    </div>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#072146] mb-1.5">
                  Mot de passe personnel
                </label>
                <div className="relative">
                  <Lock className="h-4 w-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type={showPass ? 'text' : 'password'}
                    required
                    autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••"
                    className="w-full rounded-xl border border-slate-300 bg-white pl-10 pr-11 py-3 text-sm text-slate-900 focus:border-[#0284FE] focus:outline-none focus:ring-2 focus:ring-[#0284FE]/20"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass((v) => !v)}
                    aria-label="Afficher le mot de passe"
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-[#072146]"
                  >
                    {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {mode === 'register' && (
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#072146] mb-1.5">
                    Confirmer le mot de passe
                  </label>
                  <div className="relative">
                    <Lock className="h-4 w-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type={showPass ? 'text' : 'password'}
                      required
                      autoComplete="new-password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="••••••••••"
                      className="w-full rounded-xl border border-slate-300 bg-white pl-10 pr-4 py-3 text-sm text-slate-900 focus:border-[#0284FE] focus:outline-none focus:ring-2 focus:ring-[#0284FE]/20"
                    />
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-[#0284FE] py-3.5 text-sm font-bold text-white shadow-lg shadow-blue-500/25 transition hover:bg-[#072146] disabled:opacity-60"
              >
                <span>
                  {submitting
                    ? 'Vérification cryptographique...'
                    : mode === 'login'
                      ? 'Accéder à mon compte'
                      : 'Activer mon compte MONERA'}
                </span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </form>

            <div className="mt-6 flex items-center justify-center gap-2 text-xs text-slate-500">
              <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0" />
              <span>Connexion chiffrée de bout en bout • Protection anti-intrusion active</span>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
