import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  ArrowDownLeft,
  ArrowUpRight,
  Bell,
  Building2,
  Check,
  CheckCircle2,
  Copy,
  CreditCard,
  Download,
  Eye,
  EyeOff,
  FileText,
  Headphones,
  History,
  Landmark,
  LayoutDashboard,
  LogOut,
  RefreshCw,
  RotateCcw,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  UserCheck,
  X,
} from 'lucide-react';
import { apiRequest } from '../api/client';
import BrandLogo from '../components/BrandLogo';
import MoneraVirtualCard3D from '../components/MoneraVirtualCard3D';
import ExternalTransferConsole from '../components/ExternalTransferConsole';
import MemberSupportChat from '../components/MemberSupportChat';
import { useAuth } from '../context/AuthContext';
import {
  EXTERNAL_BANKS,
  calculateLoanPreview,
  formatDateTime,
  formatMoney,
  getLoanStatusMeta,
  getTxStatusMeta,
} from '../utils/format';

export default function MemberDashboard() {
  const { user, setUser, logout, trigger3DEvent, siteSettings } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const initialTab = searchParams.get('tab') || 'overview';
  const [activeTab, setActiveTab] = useState(initialTab);

  const [data, setData] = useState(null);
  const [loadingData, setLoadingData] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showBalance, setShowBalance] = useState(true);
  const [freezingCard, setFreezingCard] = useState(false);
  const [copiedField, setCopiedField] = useState('');
  const [feedbackBanner, setFeedbackBanner] = useState(null);

  const [transferMode, setTransferMode] = useState('internal');
  const [recipientIdentifier, setRecipientIdentifier] = useState('');
  const [verifiedRecipient, setVerifiedRecipient] = useState(null);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [transferAmount, setTransferAmount] = useState('');
  const [transferDescription, setTransferDescription] = useState('');
  const [transferSubmitting, setTransferSubmitting] = useState(false);

  const [selectedBankOption, setSelectedBankOption] = useState(EXTERNAL_BANKS[0].name);
  const [customBankName, setCustomBankName] = useState('');
  const [extHolderName, setExtHolderName] = useState('');
  const [extIban, setExtIban] = useState('');
  const [extBic, setExtBic] = useState(EXTERNAL_BANKS[0].bic);
  const [extAmount, setExtAmount] = useState('');
  const [extDescription, setExtDescription] = useState('');

  const [txFilter, setTxFilter] = useState('all');
  const [cancelTarget, setCancelTarget] = useState(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelSubmitting, setCancelSubmitting] = useState(false);

  const [loanAmount, setLoanAmount] = useState(Number(searchParams.get('amount')) || 15000);
  const [loanMonths, setLoanMonths] = useState(Number(searchParams.get('months')) || 36);
  const [loanIncome, setLoanIncome] = useState('3500');
  const [loanPurpose, setLoanPurpose] = useState('Projet Personnel & Équipement');
  const [loanDetails, setLoanDetails] = useState('');
  const [loanSubmitting, setLoanSubmitting] = useState(false);

  const [profileName, setProfileName] = useState(user?.fullName || '');
  const [profilePhone, setProfilePhone] = useState(user?.phone || '');
  const [profileCountry, setProfileCountry] = useState(user?.country || 'France');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);

  const fetchDashboard = useCallback(async (silent = false) => {
    if (!silent) setLoadingData(true);
    setRefreshing(true);
    try {
      const res = await apiRequest('/member/dashboard');
      setData(res);
      if (res.account) {
        setUser(res.account);
      }
    } catch (err) {
      if (!silent) setFeedbackBanner({ type: 'error', text: err.message });
    } finally {
      setLoadingData(false);
      setRefreshing(false);
    }
  }, [setUser]);

  useEffect(() => {
    fetchDashboard();
    const poll = setInterval(() => {
      fetchDashboard(true);
    }, 5000);
    return () => clearInterval(poll);
  }, [fetchDashboard]);

  useEffect(() => {
    if (data?.account) {
      setProfileName((prev) => prev || data.account.fullName);
      setProfilePhone((prev) => prev || data.account.phone || '');
      setProfileCountry((prev) => prev || data.account.country || 'France');
    }
  }, [data?.account]);

  useEffect(() => {
    const q = recipientIdentifier.trim();
    if (q.length < 3) {
      setVerifiedRecipient(null);
      return undefined;
    }
    const timer = setTimeout(async () => {
      setLookupLoading(true);
      try {
        const res = await apiRequest(`/member/lookup-recipient?q=${encodeURIComponent(q)}`);
        setVerifiedRecipient(res.recipient);
      } catch {
        setVerifiedRecipient(null);
      } finally {
        setLookupLoading(false);
      }
    }, 260);
    return () => clearTimeout(timer);
  }, [recipientIdentifier]);

  const selectTab = (tab) => {
    setActiveTab(tab);
    setSearchParams({ tab });
    setFeedbackBanner(null);
  };

  const copyValue = (key, text) => {
    navigator.clipboard.writeText(text);
    setCopiedField(key);
    setTimeout(() => setCopiedField(''), 2000);
  };

  const handleToggleCardFreeze = async () => {
    setFreezingCard(true);
    try {
      const res = await apiRequest('/auth/card-freeze', { method: 'PATCH' });
      setData((prev) => ({ ...prev, account: res.user }));
      setUser(res.user);
    } catch (err) {
      setFeedbackBanner({ type: 'error', text: err.message });
    } finally {
      setFreezingCard(false);
    }
  };

  const handleInternalTransferSubmit = async (e) => {
    e.preventDefault();
    setFeedbackBanner(null);
    setTransferSubmitting(true);
    try {
      const res = await apiRequest('/member/transfers', {
        method: 'POST',
        body: {
          recipientIdentifier: recipientIdentifier.trim(),
          amount: Number(transferAmount),
          description: transferDescription.trim() || 'Virement instantané MONERA',
        },
      });

      setRecipientIdentifier('');
      setVerifiedRecipient(null);
      setTransferAmount('');
      setTransferDescription('');
      await fetchDashboard(true);

      const tx = res.transaction;
      trigger3DEvent({
        variant: tx.status === 'completed' ? 'transfer_success' : 'cancel_requested',
        title:
          tx.status === 'completed'
            ? 'Paiement Effectué avec Succès'
            : 'Virement Enregistré • Contrôle Admin en cours',
        subtitle:
          tx.status === 'completed'
            ? 'Les fonds ont été transférés instantanément au membre MONERA.'
            : 'Le montant a été sécurisé et sera libéré dès validation par le Back-Office MONERA.',
        amount: tx.amount,
        reference: tx.reference,
        counterparty: tx.recipientName,
        detail: tx.description,
      });
    } catch (err) {
      setFeedbackBanner({ type: 'error', text: err.message });
    } finally {
      setTransferSubmitting(false);
    }
  };

  const handleExternalTransferSubmit = async (e) => {
    e.preventDefault();
    setFeedbackBanner(null);
    const resolvedBankName =
      selectedBankOption === 'Autre établissement bancaire'
        ? customBankName.trim()
        : selectedBankOption;

    if (!resolvedBankName) {
      setFeedbackBanner({ type: 'error', text: 'Veuillez indiquer le nom de la banque destinataire.' });
      return;
    }

    setTransferSubmitting(true);
    try {
      await apiRequest('/member/external-transfers', {
        method: 'POST',
        body: {
          bankName: resolvedBankName,
          holderName: extHolderName.trim(),
          iban: extIban.trim(),
          bic: extBic.trim(),
          amount: Number(extAmount),
          description: extDescription.trim() || `Virement externe vers ${resolvedBankName}`,
        },
      });

      setExtHolderName('');
      setExtIban('');
      setExtAmount('');
      setExtDescription('');
      await fetchDashboard(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      setFeedbackBanner({ type: 'error', text: err.message });
    } finally {
      setTransferSubmitting(false);
    }
  };

  const handleRequestCancel = async (e) => {
    e.preventDefault();
    if (!cancelTarget) return;
    setCancelSubmitting(true);
    try {
      const res = await apiRequest(`/member/transfers/${cancelTarget.id}/cancel`, {
        method: 'POST',
        body: { reason: cancelReason.trim() },
      });
      const targetSnapshot = cancelTarget;
      setCancelTarget(null);
      setCancelReason('');
      await fetchDashboard(true);

      trigger3DEvent({
        variant: 'cancel_requested',
        title: 'Demande d’Annulation Transmise',
        subtitle:
          'Votre demande est entre les mains de l’Administrateur MONERA. Dès validation, le montant intégral reviendra sur votre solde.',
        amount: res.transaction.amount,
        reference: res.transaction.reference,
        counterparty: targetSnapshot.recipientName,
        detail: `Motif déclaré : ${res.transaction.cancelReason}`,
      });
    } catch (err) {
      setFeedbackBanner({ type: 'error', text: err.message });
    } finally {
      setCancelSubmitting(false);
    }
  };

  const handleLoanSubmit = async (e) => {
    e.preventDefault();
    setFeedbackBanner(null);
    setLoanSubmitting(true);
    try {
      const res = await apiRequest('/member/loans', {
        method: 'POST',
        body: {
          amount: Number(loanAmount),
          durationMonths: Number(loanMonths),
          monthlyIncome: Number(loanIncome || 0),
          purpose: loanPurpose,
          details: loanDetails,
        },
      });
      setLoanDetails('');
      await fetchDashboard(true);

      trigger3DEvent({
        variant: 'loan_submitted',
        title: 'Demande de Prêt Enregistrée',
        subtitle:
          'Votre dossier est soumis à l’approbation de l’Administration MONERA. Les fonds seront crédités sur votre solde dès validation.',
        amount: res.loan.amount,
        reference: res.loan.reference,
        counterparty: `${res.loan.durationMonths} mensualités de ${formatMoney(res.loan.monthlyPayment)}`,
        detail: `Objet : ${res.loan.purpose}`,
      });
    } catch (err) {
      setFeedbackBanner({ type: 'error', text: err.message });
    } finally {
      setLoanSubmitting(false);
    }
  };

  const handleRepayInstallment = async (loan) => {
    try {
      const res = await apiRequest(`/member/loans/${loan.id}/repay`, {
        method: 'POST',
        body: { amount: loan.monthlyPayment },
      });
      await fetchDashboard(true);
      trigger3DEvent({
        variant: 'transfer_success',
        title: 'Échéance de Prêt Réglée',
        subtitle: `Capital restant dû mis à jour : ${formatMoney(res.loan.remainingAmount)}.`,
        amount: loan.monthlyPayment,
        reference: loan.reference,
        counterparty: 'MONERA Crédit',
      });
    } catch (err) {
      setFeedbackBanner({ type: 'error', text: err.message });
    }
  };

  const handleDownloadRib = () => {
    const acc = data?.account || user;
    const text = [
      '================================================================',
      `          ${siteSettings?.bankName || 'MONERA'} — RELEVÉ D'IDENTITÉ BANCAIRE OFFICIEL`,
      '================================================================',
      `Titulaire du compte : ${acc.fullName}`,
      `Identifiant Membre  : ${acc.memberCode}`,
      `RIB-MONERA          : ${acc.rib}`,
      `Devise du compte    : ${acc.currency}`,
      `Pays de résidence   : ${acc.country}`,
      `Domiciliation       : ${siteSettings?.headquarters || 'MONERA Digital Clearing'}`,
      '================================================================',
      'Document certifié pour la réception de virements nationaux et internationaux.',
    ].join('\n');

    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `RIB-${acc.memberCode}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setSavingProfile(true);
    setFeedbackBanner(null);
    try {
      const res = await apiRequest('/auth/profile', {
        method: 'PATCH',
        body: { fullName: profileName, phone: profilePhone, country: profileCountry },
      });
      setUser(res.user);
      await fetchDashboard(true);
      setFeedbackBanner({ type: 'success', text: 'Vos coordonnées personnelles ont été mises à jour.' });
    } catch (err) {
      setFeedbackBanner({ type: 'error', text: err.message });
    } finally {
      setSavingProfile(false);
    }
  };

  const handleUpdatePassword = async (e) => {
    e.preventDefault();
    setSavingProfile(true);
    setFeedbackBanner(null);
    try {
      await apiRequest('/auth/password', {
        method: 'PATCH',
        body: { currentPassword, newPassword },
      });
      setCurrentPassword('');
      setNewPassword('');
      setFeedbackBanner({ type: 'success', text: 'Votre mot de passe a été renforcé avec succès.' });
    } catch (err) {
      setFeedbackBanner({ type: 'error', text: err.message });
    } finally {
      setSavingProfile(false);
    }
  };

  const markNotificationsRead = async () => {
    try {
      await apiRequest('/member/notifications/read', { method: 'PATCH' });
      await fetchDashboard(true);
    } catch {
      return undefined;
    }
  };

  if (loadingData && !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#072146] text-white">
        <div className="text-center space-y-3">
          <div className="h-12 w-12 mx-auto rounded-full border-2 border-[#2DCCCD] border-t-transparent animate-spin" />
          <p className="font-display text-sm tracking-widest uppercase text-cyan-200">
            Synchronisation sécurisée de votre coffre MONERA...
          </p>
        </div>
      </div>
    );
  }

  const account = data?.account || user;
  const transactions = data?.transactions || [];
  const loans = data?.loans || [];
  const notifications = data?.notifications || [];
  const supportMessages = data?.supportMessages || [];
  const unreadSupportCount = Number(data?.unreadSupportCount || 0);
  const directory = data?.directory || [];
  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const activeExternalTransfers = transactions.filter(
    (t) =>
      t.type === 'external_transfer' &&
      (t.status === 'awaiting_code_1' || t.status === 'awaiting_code_2')
  );

  const annualRate = Number(data?.settings?.loanAnnualRate || siteSettings?.loanAnnualRate || 3.85);
  const maxLoanAmount = Number(data?.settings?.maxLoanAmount || siteSettings?.maxLoanAmount || 250000);
  const loanPreview = calculateLoanPreview(loanAmount, annualRate, loanMonths);

  const filteredTransactions = transactions.filter((tx) => {
    if (txFilter === 'outgoing') return tx.direction === 'outgoing';
    if (txFilter === 'incoming') return tx.direction === 'incoming';
    if (txFilter === 'external') return tx.type === 'external_transfer';
    if (txFilter === 'cancel') return tx.status === 'cancel_requested' || tx.status === 'cancelled';
    return true;
  });

  const navItems = [
    { id: 'overview', label: 'Tableau de bord', icon: LayoutDashboard },
    {
      id: 'transfer',
      label: 'Effectuer un virement',
      icon: Send,
      badge: activeExternalTransfers.length,
    },
    {
      id: 'support',
      label: 'Messagerie d’Assistance',
      icon: Headphones,
      badge: unreadSupportCount,
    },
    { id: 'history', label: 'Historique & Annulations', icon: History },
    { id: 'loans', label: 'Demander un prêt', icon: Landmark },
    { id: 'rib', label: 'Mon RIB & Sécurité', icon: FileText },
    { id: 'notifications', label: 'Notifications', icon: Bell, badge: unreadCount },
  ];

  const handleFinalized3D = (completedTx) => {
    trigger3DEvent({
      variant: 'transfer_success',
      title: 'Virement Externe Finalisé à 100%',
      subtitle: `Les deux paliers de sécurité ont été validés. Les fonds ont été transmis à ${completedTx.externalBankName}.`,
      amount: completedTx.amount,
      reference: completedTx.reference,
      counterparty: `${completedTx.externalBankName} • ${completedTx.externalHolderName}`,
      detail: `IBAN destinataire : ${completedTx.externalIban}`,
    });
  };

  return (
    <div className="min-h-screen bg-[#F4F7FB] flex flex-col lg:flex-row">
      <aside className="lg:w-72 bg-[#072146] text-white flex flex-col justify-between shrink-0 border-b lg:border-b-0 lg:border-r border-white/10">
        <div>
          <div className="h-20 px-6 flex items-center justify-between border-b border-white/10">
            <Link to="/">
              <BrandLogo variant="dark" size="md" />
            </Link>
            <button
              type="button"
              onClick={() => fetchDashboard(true)}
              title="Actualiser"
              className="rounded-lg p-2 text-cyan-300 hover:bg-white/10"
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>

          <div className="px-6 py-5 border-b border-white/10 bg-[#04142C]/50">
            <div className="text-[11px] uppercase tracking-widest text-cyan-300 font-semibold">
              Espace Client Vérifié
            </div>
            <div className="mt-1 font-display font-bold text-base truncate">{account.fullName}</div>
            <div className="mt-1 flex items-center gap-2 text-xs font-mono text-slate-300">
              <span>{account.memberCode}</span>
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              <span className="text-emerald-400 text-[11px] font-sans">Actif</span>
            </div>
          </div>

          <nav className="p-3 flex lg:flex-col gap-1 overflow-x-auto">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    selectTab(item.id);
                    if (item.id === 'notifications' && unreadCount > 0) {
                      markNotificationsRead();
                    }
                  }}
                  className={`flex items-center justify-between gap-3 rounded-xl px-4 py-3 text-xs sm:text-sm font-semibold whitespace-nowrap transition ${
                    active
                      ? 'bg-[#0284FE] text-white shadow-md shadow-blue-500/25'
                      : 'text-slate-300 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  <span className="flex items-center gap-3">
                    <Icon className="h-4 w-4 shrink-0" />
                    <span>{item.label}</span>
                  </span>
                  {item.badge > 0 && (
                    <span className="rounded-full bg-[#2DCCCD] px-2 py-0.5 text-[11px] font-extrabold text-[#04142C]">
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        <div className="hidden lg:block p-4 border-t border-white/10">
          <button
            type="button"
            onClick={logout}
            className="w-full flex items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/5 py-2.5 text-xs font-bold text-slate-200 transition hover:bg-rose-500/20 hover:border-rose-400/40 hover:text-white"
          >
            <LogOut className="h-4 w-4" />
            <span>Déconnexion sécurisée</span>
          </button>
        </div>
      </aside>

      <main className="flex-1 min-w-0">
        <header className="bg-white border-b border-slate-200/80 px-4 sm:px-8 h-16 flex items-center justify-between">
          <div>
            <h1 className="font-display text-lg sm:text-xl font-bold text-[#072146]">
              {navItems.find((i) => i.id === activeTab)?.label}
            </h1>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => selectTab('support')}
              className="relative inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-[#072146] hover:border-[#0284FE]"
            >
              <Headphones className="h-3.5 w-3.5 text-[#0284FE]" />
              <span className="hidden sm:inline">Assistance</span>
              {unreadSupportCount > 0 && (
                <span className="rounded-full bg-rose-600 px-1.5 py-0.2 text-[10px] font-extrabold text-white">
                  {unreadSupportCount}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setShowBalance((v) => !v)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-[#F4F7FB] px-3 py-1.5 text-xs font-bold text-[#072146] hover:border-[#0284FE]"
            >
              {showBalance ? (
                <EyeOff className="h-3.5 w-3.5 text-[#0284FE]" />
              ) : (
                <Eye className="h-3.5 w-3.5 text-[#0284FE]" />
              )}
              <span className="hidden sm:inline">
                {showBalance ? 'Masquer soldes' : 'Afficher soldes'}
              </span>
            </button>

            <button
              type="button"
              onClick={() => selectTab('transfer')}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#0284FE] px-3.5 py-2 text-xs font-bold text-white hover:bg-[#072146] transition"
            >
              <Send className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Virement</span>
            </button>

            <button
              type="button"
              onClick={logout}
              className="lg:hidden rounded-lg border border-slate-200 p-2 text-slate-600 hover:text-rose-600"
              title="Déconnexion"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </header>

        <div className="p-4 sm:p-8 max-w-7xl mx-auto space-y-7">
          {feedbackBanner && (
            <div
              className={`flex items-center justify-between rounded-2xl px-5 py-3.5 text-sm font-medium border ${
                feedbackBanner.type === 'error'
                  ? 'bg-rose-50 border-rose-200 text-rose-800'
                  : 'bg-emerald-50 border-emerald-200 text-emerald-800'
              }`}
            >
              <span>{feedbackBanner.text}</span>
              <button type="button" onClick={() => setFeedbackBanner(null)}>
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          {(activeTab === 'overview' || activeTab === 'transfer') &&
            activeExternalTransfers.length > 0 && (
              <div className="space-y-4">
                {activeExternalTransfers.map((extTx) => (
                  <ExternalTransferConsole
                    key={extTx.id}
                    transaction={extTx}
                    supportMessages={supportMessages}
                    onUpdated={() => fetchDashboard(true)}
                    onOpenSupport={() => selectTab('support')}
                    onFinalized3D={handleFinalized3D}
                  />
                ))}
              </div>
            )}

          {activeTab === 'overview' && (
            <div className="grid xl:grid-cols-12 gap-7 items-start">
              <div className="xl:col-span-5 rounded-3xl bg-white p-6 shadow-bbva border border-slate-200/70">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#0284FE]">
                      Carte Virtuelle MONERA
                    </span>
                    <h2 className="font-display text-lg font-bold text-[#072146]">
                      Ma Carte Infinite 3D
                    </h2>
                  </div>
                  <CreditCard className="h-5 w-5 text-[#072146]" />
                </div>

                <MoneraVirtualCard3D
                  account={account}
                  showBalance={showBalance}
                  onToggleBalance={() => setShowBalance((v) => !v)}
                  onToggleFreeze={handleToggleCardFreeze}
                  freezing={freezingCard}
                />
              </div>

              <div className="xl:col-span-7 space-y-6">
                <div className="rounded-3xl bg-gradient-to-br from-[#072146] via-[#092B5A] to-[#04142C] text-white p-6 sm:p-8 shadow-bbva">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <span className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300">
                        Compte Courant Principal ({account.currency})
                      </span>
                      <div className="mt-2 font-mono text-3xl sm:text-4xl font-bold tracking-tight tabular-nums">
                        {showBalance ? formatMoney(account.balance) : '•••• •••,•• €'}
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => selectTab('transfer')}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-[#2DCCCD] px-4 py-2.5 text-xs font-extrabold text-[#04142C] hover:bg-white transition"
                      >
                        <Send className="h-3.5 w-3.5" />
                        Envoyer
                      </button>
                      <button
                        type="button"
                        onClick={() => selectTab('support')}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-white/20 bg-white/10 px-4 py-2.5 text-xs font-bold text-white hover:bg-white/20 transition"
                      >
                        <Headphones className="h-3.5 w-3.5 text-cyan-300" />
                        Assistance
                      </button>
                    </div>
                  </div>

                  <div className="mt-6 pt-5 border-t border-white/15 grid sm:grid-cols-2 gap-3 text-xs">
                    <div className="rounded-xl bg-white/[0.06] p-3.5 flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <span className="text-slate-300 block">Identifiant Client MONERA</span>
                        <span className="font-mono font-bold text-sm text-white">
                          {account.memberCode}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => copyValue('code', account.memberCode)}
                        className="rounded-lg bg-white/10 px-2.5 py-1.5 font-semibold text-cyan-300 hover:bg-white/20 shrink-0"
                      >
                        {copiedField === 'code' ? 'Copié ✓' : 'Copier'}
                      </button>
                    </div>

                    <div className="rounded-xl bg-white/[0.06] p-3.5 flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <span className="text-slate-300 block">RIB-MONERA Officiel</span>
                        <span className="font-mono font-bold text-xs text-cyan-200 truncate block">
                          {account.rib}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => copyValue('rib', account.rib)}
                        className="rounded-lg bg-white/10 px-2.5 py-1.5 font-semibold text-cyan-300 hover:bg-white/20 shrink-0"
                      >
                        {copiedField === 'rib' ? 'Copié ✓' : 'Copier'}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="grid sm:grid-cols-3 gap-4">
                  <div className="rounded-2xl bg-white p-5 border border-slate-200/80">
                    <div className="text-xs font-semibold text-slate-500">Total Reçu</div>
                    <div className="mt-1.5 font-mono text-xl font-extrabold text-emerald-600 tabular-nums">
                      {showBalance ? `+${formatMoney(data?.stats?.totalReceived || 0)}` : '•••• €'}
                    </div>
                  </div>
                  <div className="rounded-2xl bg-white p-5 border border-slate-200/80">
                    <div className="text-xs font-semibold text-slate-500">Total Émis</div>
                    <div className="mt-1.5 font-mono text-xl font-extrabold text-[#072146] tabular-nums">
                      {showBalance ? formatMoney(data?.stats?.totalSent || 0) : '•••• €'}
                    </div>
                  </div>
                  <div className="rounded-2xl bg-white p-5 border border-slate-200/80">
                    <div className="text-xs font-semibold text-slate-500">Crédits Actifs</div>
                    <div className="mt-1.5 font-mono text-xl font-extrabold text-[#0284FE] tabular-nums">
                      {data?.stats?.activeLoansCount || 0} dossier(s)
                    </div>
                  </div>
                </div>

                <div className="rounded-3xl bg-white p-6 border border-slate-200/80">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-display text-base font-bold text-[#072146]">
                      Dernières Opérations
                    </h3>
                    <button
                      type="button"
                      onClick={() => selectTab('history')}
                      className="text-xs font-bold text-[#0284FE] hover:underline"
                    >
                      Voir tout l’historique →
                    </button>
                  </div>

                  {transactions.length === 0 ? (
                    <p className="text-sm text-slate-500 py-6 text-center">
                      Aucune opération enregistrée pour le moment.
                    </p>
                  ) : (
                    <div className="divide-y divide-slate-100">
                      {transactions.slice(0, 5).map((tx) => {
                        const meta = getTxStatusMeta(tx.status);
                        const isOut = tx.direction === 'outgoing';
                        return (
                          <div
                            key={tx.id}
                            className="py-3.5 flex flex-wrap items-center justify-between gap-3"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <div
                                className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${
                                  tx.status === 'cancelled'
                                    ? 'bg-rose-50 text-rose-600'
                                    : isOut
                                      ? 'bg-slate-100 text-[#072146]'
                                      : 'bg-emerald-50 text-emerald-600'
                                }`}
                              >
                                {isOut ? (
                                  <ArrowUpRight className="h-5 w-5" />
                                ) : (
                                  <ArrowDownLeft className="h-5 w-5" />
                                )}
                              </div>
                              <div className="min-w-0">
                                <div className="text-sm font-bold text-[#072146] truncate">
                                  {isOut ? `Vers ${tx.recipientName}` : `De ${tx.senderName}`}
                                </div>
                                <div className="text-xs text-slate-500 truncate">
                                  {tx.description} • {formatDateTime(tx.createdAt)}
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-3 ml-auto">
                              <span
                                className={`rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${meta.badgeClass}`}
                              >
                                {meta.label}
                              </span>
                              <span
                                className={`font-mono text-sm font-extrabold tabular-nums ${
                                  tx.status === 'cancelled'
                                    ? 'line-through text-slate-400'
                                    : isOut
                                      ? 'text-[#072146]'
                                      : 'text-emerald-600'
                                }`}
                              >
                                {isOut ? '-' : '+'}
                                {formatMoney(tx.amount)}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'transfer' && (
            <div className="grid lg:grid-cols-12 gap-7">
              <div className="lg:col-span-7 rounded-3xl bg-white p-6 sm:p-8 shadow-bbva border border-slate-200/80">
                <div className="grid sm:grid-cols-2 rounded-2xl bg-[#F4F7FB] p-1.5 mb-6 gap-1">
                  <button
                    type="button"
                    onClick={() => setTransferMode('internal')}
                    className={`rounded-xl py-3 px-3 text-xs sm:text-sm font-bold transition flex items-center justify-center gap-2 ${
                      transferMode === 'internal'
                        ? 'bg-[#072146] text-white shadow-sm'
                        : 'text-slate-600 hover:text-[#072146]'
                    }`}
                  >
                    <Send className="h-4 w-4 text-[#2DCCCD]" />
                    <span>Entre Membres MONERA</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setTransferMode('external')}
                    className={`rounded-xl py-3 px-3 text-xs sm:text-sm font-bold transition flex items-center justify-center gap-2 ${
                      transferMode === 'external'
                        ? 'bg-[#072146] text-white shadow-sm'
                        : 'text-slate-600 hover:text-[#072146]'
                    }`}
                  >
                    <Building2 className="h-4 w-4 text-[#F0D384]" />
                    <span>Autre Banque Externe</span>
                  </button>
                </div>

                {transferMode === 'internal' ? (
                  <>
                    <span className="text-xs font-bold uppercase tracking-[0.18em] text-[#0284FE]">
                      Transfert Interne Instantané (Sans Code Requis)
                    </span>
                    <h2 className="mt-1 font-display text-2xl font-bold text-[#072146]">
                      Envoyer de l’argent à un membre MONERA
                    </h2>
                    <p className="mt-1 text-sm text-slate-500">
                      Saisissez le <strong>RIB-MONERA</strong>, l’identifiant{' '}
                      <code className="font-mono">MNR-XXXXXX</code> ou l’email du bénéficiaire pour une exécution immédiate.
                    </p>

                    <form onSubmit={handleInternalTransferSubmit} className="mt-6 space-y-5">
                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-[#072146] mb-1.5">
                          Bénéficiaire MONERA (RIB, ID ou Email)
                        </label>
                        <div className="relative">
                          <Search className="h-4 w-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                          <input
                            type="text"
                            required
                            value={recipientIdentifier}
                            onChange={(e) => setRecipientIdentifier(e.target.value)}
                            placeholder="Ex. MNR-482910 ou MNR76 00819... ou email"
                            className="w-full rounded-xl border border-slate-300 pl-10 pr-4 py-3 text-sm font-mono focus:border-[#0284FE] focus:outline-none"
                          />
                        </div>

                        {lookupLoading && (
                          <p className="mt-2 text-xs text-slate-500">
                            Vérification du compte bénéficiaire...
                          </p>
                        )}

                        {verifiedRecipient && (
                          <div className="mt-2.5 flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50/80 px-4 py-2.5 text-xs text-emerald-900">
                            <span className="flex items-center gap-2 font-semibold">
                              <UserCheck className="h-4 w-4 text-emerald-600 shrink-0" />
                              Titulaire vérifié : <strong>{verifiedRecipient.fullName}</strong> (
                              {verifiedRecipient.memberCode} • {verifiedRecipient.country})
                            </span>
                          </div>
                        )}
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <label className="text-xs font-bold uppercase tracking-wider text-[#072146]">
                            Montant à transférer (EUR)
                          </label>
                          <span className="text-xs text-slate-500">
                            Solde :{' '}
                            <strong className="font-mono text-[#072146]">
                              {formatMoney(account.balance)}
                            </strong>
                          </span>
                        </div>
                        <input
                          type="number"
                          step="0.01"
                          min="1"
                          required
                          value={transferAmount}
                          onChange={(e) => setTransferAmount(e.target.value)}
                          placeholder="0.00"
                          className="w-full rounded-xl border border-slate-300 px-4 py-3.5 font-mono text-xl font-bold text-[#072146] focus:border-[#0284FE] focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-[#072146] mb-1.5">
                          Motif du virement
                        </label>
                        <input
                          type="text"
                          value={transferDescription}
                          onChange={(e) => setTransferDescription(e.target.value)}
                          placeholder="Ex. Remboursement, Honoraires, Famille..."
                          className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm focus:border-[#0284FE] focus:outline-none"
                        />
                      </div>

                      <button
                        type="submit"
                        disabled={transferSubmitting}
                        className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-[#0284FE] py-4 text-sm font-bold text-white shadow-lg shadow-blue-500/25 transition hover:bg-[#072146] disabled:opacity-60"
                      >
                        <Send className="h-4 w-4" />
                        <span>
                          {transferSubmitting
                            ? 'Exécution en cours...'
                            : 'Envoyer instantanément au membre'}
                        </span>
                      </button>
                    </form>
                  </>
                ) : (
                  <>
                    <span className="text-xs font-bold uppercase tracking-[0.18em] text-[#0284FE]">
                      Réseau Interbancaire Externe SEPA / International
                    </span>
                    <h2 className="mt-1 font-display text-2xl font-bold text-[#072146]">
                      Envoyer vers un compte d’une autre banque
                    </h2>
                    <p className="mt-1 text-sm text-slate-500">
                      Sécurisé par double authentification : contrôle initial à <strong>15%</strong>,
                      puis validation finale à <strong>70% → 100%</strong> via codes délivrés dans
                      votre Messagerie d’Assistance.
                    </p>

                    <form onSubmit={handleExternalTransferSubmit} className="mt-6 space-y-4">
                      <div className="grid sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-bold uppercase tracking-wider text-[#072146] mb-1.5">
                            Banque destinataire
                          </label>
                          <select
                            value={selectedBankOption}
                            onChange={(e) => {
                              const val = e.target.value;
                              setSelectedBankOption(val);
                              const found = EXTERNAL_BANKS.find((b) => b.name === val);
                              if (found) setExtBic(found.bic);
                            }}
                            className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-3 text-sm font-semibold text-[#072146]"
                          >
                            {EXTERNAL_BANKS.map((b) => (
                              <option key={b.name} value={b.name}>
                                {b.name}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-xs font-bold uppercase tracking-wider text-[#072146] mb-1.5">
                            Code BIC / SWIFT
                          </label>
                          <input
                            type="text"
                            value={extBic}
                            onChange={(e) => setExtBic(e.target.value)}
                            placeholder="Ex. BNPAFRPP"
                            className="w-full rounded-xl border border-slate-300 px-3.5 py-3 font-mono text-sm uppercase"
                          />
                        </div>
                      </div>

                      {selectedBankOption === 'Autre établissement bancaire' && (
                        <div>
                          <label className="block text-xs font-bold uppercase tracking-wider text-[#072146] mb-1.5">
                            Nom exact de la banque externe
                          </label>
                          <input
                            type="text"
                            required
                            value={customBankName}
                            onChange={(e) => setCustomBankName(e.target.value)}
                            placeholder="Saisissez le nom complet de la banque..."
                            className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm"
                          />
                        </div>
                      )}

                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-[#072146] mb-1.5">
                          Nom complet du titulaire du compte externe
                        </label>
                        <input
                          type="text"
                          required
                          value={extHolderName}
                          onChange={(e) => setExtHolderName(e.target.value)}
                          placeholder="Ex. Claire Dubois / Société Atlas SARL"
                          className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-[#072146] mb-1.5">
                          IBAN / Numéro de compte bancaire externe
                        </label>
                        <input
                          type="text"
                          required
                          value={extIban}
                          onChange={(e) => setExtIban(e.target.value)}
                          placeholder="Ex. FR76 3000 4008 0500 0107 3829 144"
                          className="w-full rounded-xl border border-slate-300 px-4 py-3 font-mono text-sm uppercase"
                        />
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <label className="text-xs font-bold uppercase tracking-wider text-[#072146]">
                            Montant à envoyer (EUR)
                          </label>
                          <span className="text-xs text-slate-500">
                            Solde disponible :{' '}
                            <strong className="font-mono text-[#072146]">
                              {formatMoney(account.balance)}
                            </strong>
                          </span>
                        </div>
                        <input
                          type="number"
                          step="0.01"
                          min="1"
                          required
                          value={extAmount}
                          onChange={(e) => setExtAmount(e.target.value)}
                          placeholder="0.00"
                          className="w-full rounded-xl border border-slate-300 px-4 py-3.5 font-mono text-xl font-bold text-[#072146]"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-[#072146] mb-1.5">
                          Libellé / Référence bénéficiaire
                        </label>
                        <input
                          type="text"
                          value={extDescription}
                          onChange={(e) => setExtDescription(e.target.value)}
                          placeholder="Ex. Virement international, Facture fournisseur..."
                          className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm"
                        />
                      </div>

                      <button
                        type="submit"
                        disabled={transferSubmitting}
                        className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-[#072146] py-4 text-sm font-bold text-white shadow-lg transition hover:bg-[#0284FE] disabled:opacity-60"
                      >
                        <Building2 className="h-4 w-4 text-[#2DCCCD]" />
                        <span>
                          {transferSubmitting
                            ? 'Initialisation du routage externe...'
                            : 'Initier le virement vers cette banque externe'}
                        </span>
                      </button>
                    </form>
                  </>
                )}
              </div>

              <div className="lg:col-span-5 space-y-5">
                {transferMode === 'internal' ? (
                  <div className="rounded-3xl bg-white p-6 border border-slate-200/80">
                    <h3 className="font-display text-base font-bold text-[#072146]">
                      Sélection Rapide • Membres Vérifiés MONERA
                    </h3>
                    <p className="mt-1 text-xs text-slate-500">
                      Cliquez sur un membre pour remplir instantanément son identifiant :
                    </p>
                    <div className="mt-4 space-y-2.5 max-h-80 overflow-y-auto pr-1">
                      {directory.map((contact) => (
                        <button
                          key={contact.id}
                          type="button"
                          onClick={() => {
                            setRecipientIdentifier(contact.memberCode);
                            setVerifiedRecipient(contact);
                          }}
                          className="w-full text-left rounded-2xl border border-slate-200 p-3.5 transition hover:border-[#0284FE] hover:bg-[#F4F7FB] flex items-center justify-between gap-3"
                        >
                          <div className="min-w-0">
                            <div className="font-display text-sm font-bold text-[#072146] truncate">
                              {contact.fullName}
                            </div>
                            <div className="font-mono text-[11px] text-slate-500 truncate">
                              {contact.memberCode} • {contact.country}
                            </div>
                          </div>
                          <span className="rounded-lg bg-[#072146]/5 px-2.5 py-1 text-xs font-bold text-[#0284FE] shrink-0">
                            Choisir
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="rounded-3xl bg-[#072146] text-white p-6 space-y-4">
                    <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-bold text-[#2DCCCD]">
                      <ShieldCheck className="h-4 w-4" />
                      Protocole de Sécurité Externe en 2 Codes
                    </div>
                    <ol className="space-y-3 text-xs text-slate-200 leading-relaxed">
                      <li className="rounded-xl bg-white/5 p-3">
                        <strong className="text-[#F0D384] block">1. Palier 15% — Premier Code</strong>
                        Dès le lancement vers une autre banque, le transfert se met en sécurité à{' '}
                        <strong>15%</strong>. L’Administration reçoit automatiquement le 1er code et
                        vous le transmet dans votre <strong>Messagerie d’Assistance</strong>.
                      </li>
                      <li className="rounded-xl bg-white/5 p-3">
                        <strong className="text-cyan-300 block">2. Palier 70% — Second Code</strong>
                        Après validation du 1er code, le transfert progresse jusqu’à{' '}
                        <strong>70%</strong> et génère un second code transmis par l’Assistance.
                      </li>
                      <li className="rounded-xl bg-white/5 p-3">
                        <strong className="text-emerald-300 block">
                          3. Palier 100% — Exécution Finale
                        </strong>
                        La validation du second code finalise le virement à <strong>100%</strong>{' '}
                        avec certificat holographique 3D.
                      </li>
                    </ol>
                    <button
                      type="button"
                      onClick={() => selectTab('support')}
                      className="w-full rounded-xl bg-[#2DCCCD] py-3 text-xs font-extrabold text-[#04142C] hover:bg-white transition"
                    >
                      Accéder à ma Messagerie d’Assistance →
                    </button>
                  </div>
                )}

                <div className="rounded-3xl bg-white p-6 border border-slate-200/80 space-y-2">
                  <div className="text-xs font-bold uppercase tracking-wider text-[#072146]">
                    Garantie d’Annulation Contrôlée
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Tout virement peut faire l’objet d’une demande d’annulation depuis l’onglet{' '}
                    <strong>Historique & Annulations</strong>. Après validation par l’Administrateur,
                    le montant est recrédité sur votre solde.
                  </p>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'support' && (
            <MemberSupportChat
              messages={supportMessages}
              activeExternalTransfers={activeExternalTransfers}
              onRefresh={fetchDashboard}
              onUseCode={() => selectTab('transfer')}
            />
          )}

          {activeTab === 'history' && (
            <div className="rounded-3xl bg-white p-6 sm:p-8 shadow-bbva border border-slate-200/80 space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h2 className="font-display text-xl font-bold text-[#072146]">
                    Relevé Complet des Opérations & Demandes d’Annulation
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Consultez vos transferts internes et externes, reprenez un déblocage 15%/70% ou demandez une annulation.
                  </p>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {[
                    { id: 'all', label: 'Toutes' },
                    { id: 'outgoing', label: 'Émises' },
                    { id: 'incoming', label: 'Reçues' },
                    { id: 'external', label: 'Autres Banques' },
                    { id: 'cancel', label: 'Annulations' },
                  ].map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setTxFilter(f.id)}
                      className={`rounded-xl px-3.5 py-2 text-xs font-bold transition ${
                        txFilter === f.id
                          ? 'bg-[#072146] text-white'
                          : 'bg-[#F4F7FB] text-slate-600 hover:text-[#072146]'
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>

              {filteredTransactions.length === 0 ? (
                <div className="py-12 text-center text-sm text-slate-500">
                  Aucune transaction ne correspond à ce filtre.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                        <th className="py-3 pr-4">Référence & Date</th>
                        <th className="py-3 px-4">Contrepartie & Motif</th>
                        <th className="py-3 px-4">Statut</th>
                        <th className="py-3 px-4 text-right">Montant</th>
                        <th className="py-3 pl-4 text-right">Actions & 3D</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-sm">
                      {filteredTransactions.map((tx) => {
                        const meta = getTxStatusMeta(tx.status);
                        const isOut = tx.direction === 'outgoing';
                        const needsCode =
                          tx.status === 'awaiting_code_1' || tx.status === 'awaiting_code_2';
                        return (
                          <tr key={tx.id} className="hover:bg-slate-50/70">
                            <td className="py-4 pr-4 whitespace-nowrap">
                              <div className="font-mono text-xs font-bold text-[#072146]">
                                {tx.reference}
                              </div>
                              <div className="text-xs text-slate-400">
                                {formatDateTime(tx.createdAt)}
                              </div>
                            </td>
                            <td className="py-4 px-4">
                              <div className="font-bold text-[#072146]">
                                {isOut ? `Vers : ${tx.recipientName}` : `De : ${tx.senderName}`}
                              </div>
                              <div className="text-xs text-slate-500">
                                {tx.description}
                                {tx.externalIban ? ` • IBAN ${tx.externalIban}` : ''}
                              </div>
                              {tx.cancelReason && (
                                <div className="mt-1 text-xs text-amber-700 font-medium">
                                  Motif révocation : {tx.cancelReason}
                                </div>
                              )}
                            </td>
                            <td className="py-4 px-4 whitespace-nowrap">
                              <span
                                className={`inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${meta.badgeClass}`}
                              >
                                {meta.label}
                              </span>
                            </td>
                            <td className="py-4 px-4 text-right whitespace-nowrap font-mono font-extrabold tabular-nums">
                              <span
                                className={
                                  tx.status === 'cancelled'
                                    ? 'line-through text-slate-400'
                                    : isOut
                                      ? 'text-[#072146]'
                                      : 'text-emerald-600'
                                }
                              >
                                {isOut ? '-' : '+'}
                                {formatMoney(tx.amount)}
                              </span>
                            </td>
                            <td className="py-4 pl-4 text-right whitespace-nowrap space-x-2">
                              {needsCode && (
                                <button
                                  type="button"
                                  onClick={() => selectTab('transfer')}
                                  className="inline-flex items-center gap-1 rounded-lg bg-[#0284FE] px-3 py-1.5 text-xs font-bold text-white hover:bg-[#072146]"
                                >
                                  Entrer code ({tx.progressPercent}%)
                                </button>
                              )}

                              <button
                                type="button"
                                onClick={() =>
                                  trigger3DEvent({
                                    variant:
                                      tx.status === 'cancelled'
                                        ? 'transfer_cancelled'
                                        : tx.status === 'cancel_requested' || needsCode
                                          ? 'cancel_requested'
                                          : 'transfer_success',
                                    title:
                                      tx.status === 'cancelled'
                                        ? 'Transfert Annulé • Fonds Restitués'
                                        : needsCode
                                          ? `Virement Externe à ${tx.progressPercent}%`
                                          : tx.status === 'cancel_requested'
                                            ? 'Demande d’Annulation en Attente Admin'
                                            : 'Certificat d’Opération MONERA',
                                    amount: tx.amount,
                                    reference: tx.reference,
                                    counterparty: isOut ? tx.recipientName : tx.senderName,
                                    detail: tx.adminNote || tx.cancelReason || tx.description,
                                  })
                                }
                                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-bold text-[#072146] hover:border-[#0284FE] hover:text-[#0284FE]"
                              >
                                <Sparkles className="h-3.5 w-3.5 text-[#0284FE]" />
                                3D
                              </button>

                              {tx.canRequestCancel && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setCancelTarget(tx);
                                    setCancelReason('');
                                  }}
                                  className="inline-flex items-center gap-1 rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-rose-700"
                                >
                                  <RotateCcw className="h-3.5 w-3.5" />
                                  Annuler
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {activeTab === 'loans' && (
            <div className="space-y-8">
              <div className="grid lg:grid-cols-12 gap-7">
                <form
                  onSubmit={handleLoanSubmit}
                  className="lg:col-span-7 rounded-3xl bg-white p-6 sm:p-8 shadow-bbva border border-slate-200/80 space-y-5"
                >
                  <div>
                    <span className="text-xs font-bold uppercase tracking-[0.18em] text-[#0284FE]">
                      Financement Express
                    </span>
                    <h2 className="mt-1 font-display text-2xl font-bold text-[#072146]">
                      Déposer une demande de prêt MONERA
                    </h2>
                    <p className="text-xs text-slate-500 mt-1">
                      Dès validation de votre demande par l’Administrateur, le montant emprunté est crédité automatiquement sur votre compte.
                    </p>
                  </div>

                  <div>
                    <div className="flex justify-between text-sm font-bold text-[#072146]">
                      <span>Montant demandé</span>
                      <span className="font-mono text-xl text-[#0284FE]">
                        {formatMoney(loanAmount)}
                      </span>
                    </div>
                    <input
                      type="range"
                      min={500}
                      max={maxLoanAmount}
                      step={500}
                      value={loanAmount}
                      onChange={(e) => setLoanAmount(Number(e.target.value))}
                      className="mt-2 w-full accent-[#0284FE]"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between text-sm font-bold text-[#072146]">
                      <span>Durée souhaitée</span>
                      <span className="font-mono">{loanMonths} mois</span>
                    </div>
                    <input
                      type="range"
                      min={6}
                      max={84}
                      step={6}
                      value={loanMonths}
                      onChange={(e) => setLoanMonths(Number(e.target.value))}
                      className="mt-2 w-full accent-[#072146]"
                    />
                  </div>

                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-[#072146] mb-1.5">
                        Nature du projet
                      </label>
                      <select
                        value={loanPurpose}
                        onChange={(e) => setLoanPurpose(e.target.value)}
                        className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-3 text-sm text-[#072146]"
                      >
                        <option value="Projet Personnel & Équipement">Projet Personnel & Équipement</option>
                        <option value="Acquisition Immobilière">Acquisition Immobilière</option>
                        <option value="Trésorerie & Développement Pro">Trésorerie & Développement Pro</option>
                        <option value="Mobilité / Automobile">Mobilité / Automobile</option>
                        <option value="Études Supérieures">Études Supérieures</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-[#072146] mb-1.5">
                        Revenus mensuels nets (EUR)
                      </label>
                      <input
                        type="number"
                        min="0"
                        required
                        value={loanIncome}
                        onChange={(e) => setLoanIncome(e.target.value)}
                        className="w-full rounded-xl border border-slate-300 px-3.5 py-3 font-mono text-sm"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-[#072146] mb-1.5">
                      Précisions complémentaires pour le Comité de Crédit
                    </label>
                    <textarea
                      rows={2}
                      value={loanDetails}
                      onChange={(e) => setLoanDetails(e.target.value)}
                      placeholder="Décrivez brièvement l’objectif du financement..."
                      className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loanSubmitting}
                    className="w-full rounded-xl bg-[#0284FE] py-4 text-sm font-bold text-white shadow-lg shadow-blue-500/25 hover:bg-[#072146] transition disabled:opacity-60"
                  >
                    {loanSubmitting
                      ? 'Transmission sécurisée du dossier...'
                      : `Soumettre ma demande de ${formatMoney(loanAmount)}`}
                  </button>
                </form>

                <div className="lg:col-span-5 rounded-3xl bg-[#072146] text-white p-7 flex flex-col justify-between">
                  <div className="space-y-4">
                    <span className="text-xs font-bold uppercase tracking-widest text-cyan-300">
                      Récapitulatif Financier ({annualRate.toFixed(2)} % TAEG)
                    </span>
                    <div className="rounded-2xl bg-white/10 p-5">
                      <div className="text-xs text-slate-300">Mensualité constante</div>
                      <div className="mt-1 font-mono text-3xl font-extrabold text-[#2DCCCD] tabular-nums">
                        {formatMoney(loanPreview.monthlyPayment)} / mois
                      </div>
                    </div>
                    <div className="space-y-2.5 text-sm pt-2">
                      <div className="flex justify-between">
                        <span className="text-slate-300">Capital emprunté</span>
                        <span className="font-mono font-bold">{formatMoney(loanAmount)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-300">Intérêts totaux sur {loanMonths} mois</span>
                        <span className="font-mono font-bold text-[#F0D384]">
                          {formatMoney(loanPreview.totalInterest)}
                        </span>
                      </div>
                      <div className="flex justify-between border-t border-white/15 pt-2.5">
                        <span className="text-slate-200 font-semibold">Total à rembourser</span>
                        <span className="font-mono font-extrabold">
                          {formatMoney(loanPreview.totalRepayment)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 rounded-2xl bg-white/5 p-4 text-xs text-slate-300 flex items-start gap-2.5">
                    <CheckCircle2 className="h-4 w-4 text-[#2DCCCD] shrink-0 mt-0.5" />
                    <span>
                      Zéro frais de dossier. Versement intégral sur votre RIB-MONERA dès approbation par le Back-Office.
                    </span>
                  </div>
                </div>
              </div>

              <div className="rounded-3xl bg-white p-6 sm:p-8 border border-slate-200/80">
                <h3 className="font-display text-lg font-bold text-[#072146] mb-4">
                  Mes Dossiers de Prêt ({loans.length})
                </h3>
                {loans.length === 0 ? (
                  <p className="text-sm text-slate-500">Aucune demande de prêt enregistrée.</p>
                ) : (
                  <div className="grid md:grid-cols-2 gap-4">
                    {loans.map((loan) => {
                      const meta = getLoanStatusMeta(loan.status);
                      return (
                        <div
                          key={loan.id}
                          className="rounded-2xl border border-slate-200 p-5 flex flex-col justify-between gap-4"
                        >
                          <div>
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-mono text-xs font-bold text-[#0284FE]">
                                {loan.reference}
                              </span>
                              <span
                                className={`rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${meta.badgeClass}`}
                              >
                                {meta.label}
                              </span>
                            </div>
                            <div className="mt-2 font-mono text-2xl font-extrabold text-[#072146]">
                              {formatMoney(loan.amount)}
                            </div>
                            <div className="mt-1 text-xs font-semibold text-slate-700">
                              {loan.purpose} • {loan.durationMonths} mois ({formatMoney(loan.monthlyPayment)}/mois)
                            </div>
                            {loan.adminNote && (
                              <p className="mt-2 rounded-lg bg-[#F4F7FB] p-2.5 text-xs text-slate-600">
                                Note Banque : {loan.adminNote}
                              </p>
                            )}
                          </div>

                          {loan.status === 'approved' && (
                            <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                              <span className="text-xs text-slate-500">
                                Restant dû :{' '}
                                <strong className="font-mono text-[#072146]">
                                  {formatMoney(loan.remainingAmount)}
                                </strong>
                              </span>
                              <button
                                type="button"
                                onClick={() => handleRepayInstallment(loan)}
                                className="rounded-lg bg-[#072146] px-3 py-1.5 text-xs font-bold text-white hover:bg-[#0284FE]"
                              >
                                Régler 1 échéance
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'rib' && (
            <div className="grid lg:grid-cols-12 gap-7">
              <div className="lg:col-span-6 rounded-3xl bg-white p-6 sm:p-8 border border-slate-200/80 space-y-5">
                <h2 className="font-display text-xl font-bold text-[#072146]">
                  Mon Relevé d’Identité Bancaire (RIB-MONERA)
                </h2>
                <div className="rounded-2xl bg-[#072146] text-white p-6 space-y-4">
                  <div>
                    <div className="text-[11px] uppercase tracking-widest text-cyan-300">
                      Titulaire Officiel
                    </div>
                    <div className="font-display text-lg font-bold">{account.fullName}</div>
                  </div>
                  <div>
                    <div className="text-[11px] uppercase tracking-widest text-cyan-300">
                      Identifiant Membre Unique
                    </div>
                    <div className="font-mono text-base font-bold">{account.memberCode}</div>
                  </div>
                  <div>
                    <div className="text-[11px] uppercase tracking-widest text-cyan-300">
                      Coordonnées RIB-MONERA
                    </div>
                    <div className="font-mono text-sm sm:text-base font-bold text-[#F0D384] break-all">
                      {account.rib}
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => copyValue('ribFull', account.rib)}
                    className="inline-flex items-center gap-2 rounded-xl bg-[#0284FE] px-5 py-3 text-xs font-bold text-white hover:bg-[#072146]"
                  >
                    {copiedField === 'ribFull' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    <span>{copiedField === 'ribFull' ? 'RIB copié !' : 'Copier mon RIB-MONERA'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleDownloadRib}
                    className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-5 py-3 text-xs font-bold text-[#072146] hover:border-[#0284FE]"
                  >
                    <Download className="h-4 w-4" />
                    <span>Télécharger l’attestation RIB</span>
                  </button>
                </div>
              </div>

              <div className="lg:col-span-6 space-y-6">
                <form
                  onSubmit={handleSaveProfile}
                  className="rounded-3xl bg-white p-6 sm:p-8 border border-slate-200/80 space-y-4"
                >
                  <h3 className="font-display text-lg font-bold text-[#072146]">
                    Informations Personnelles
                  </h3>
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1">Nom complet</label>
                    <input
                      type="text"
                      required
                      value={profileName}
                      onChange={(e) => setProfileName(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm"
                    />
                  </div>
                  <div className="grid sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1">Téléphone</label>
                      <input
                        type="text"
                        value={profilePhone}
                        onChange={(e) => setProfilePhone(e.target.value)}
                        className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1">Pays</label>
                      <input
                        type="text"
                        required
                        value={profileCountry}
                        onChange={(e) => setProfileCountry(e.target.value)}
                        className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm"
                      />
                    </div>
                  </div>
                  <button
                    type="submit"
                    disabled={savingProfile}
                    className="rounded-xl bg-[#072146] px-5 py-2.5 text-xs font-bold text-white hover:bg-[#0284FE]"
                  >
                    Enregistrer les modifications
                  </button>
                </form>

                <form
                  onSubmit={handleUpdatePassword}
                  className="rounded-3xl bg-white p-6 sm:p-8 border border-slate-200/80 space-y-4"
                >
                  <h3 className="font-display text-lg font-bold text-[#072146]">
                    Renouveler mon mot de passe
                  </h3>
                  <div className="grid sm:grid-cols-2 gap-3">
                    <input
                      type="password"
                      required
                      placeholder="Mot de passe actuel"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm"
                    />
                    <input
                      type="password"
                      required
                      placeholder="Nouveau mot de passe"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={savingProfile}
                    className="rounded-xl bg-[#072146] px-5 py-2.5 text-xs font-bold text-white hover:bg-[#0284FE]"
                  >
                    Mettre à jour la sécurité
                  </button>
                </form>
              </div>
            </div>
          )}

          {activeTab === 'notifications' && (
            <div className="rounded-3xl bg-white p-6 sm:p-8 border border-slate-200/80 space-y-4">
              <h2 className="font-display text-xl font-bold text-[#072146]">
                Centre d’Alertes & Notifications Temps Réel
              </h2>
              {notifications.length === 0 ? (
                <p className="text-sm text-slate-500">Aucune notification pour le moment.</p>
              ) : (
                <div className="space-y-3">
                  {notifications.map((n) => (
                    <div
                      key={n.id}
                      className="rounded-2xl border border-slate-200/90 bg-[#F4F7FB]/60 p-4 flex items-start justify-between gap-4"
                    >
                      <div>
                        <div className="font-display text-sm font-bold text-[#072146]">{n.title}</div>
                        <p className="mt-1 text-xs text-slate-600">{n.message}</p>
                      </div>
                      <span className="text-[11px] text-slate-400 whitespace-nowrap">
                        {formatDateTime(n.createdAt)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      {cancelTarget && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-[#04142C]/75 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 sm:p-8 shadow-2xl border border-slate-200 space-y-5">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-rose-600">
                  Procédure de Révocation Bancaire
                </span>
                <h3 className="mt-1 font-display text-xl font-bold text-[#072146]">
                  Annuler le virement {cancelTarget.reference}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setCancelTarget(null)}
                className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="rounded-2xl bg-[#F4F7FB] p-4 text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-500">Bénéficiaire :</span>
                <strong className="text-[#072146]">{cancelTarget.recipientName}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Montant à restituer :</span>
                <strong className="font-mono text-rose-600">{formatMoney(cancelTarget.amount)}</strong>
              </div>
            </div>

            <form onSubmit={handleRequestCancel} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#072146] mb-1.5">
                  Motif de l’annulation (transmis à l’Administrateur)
                </label>
                <textarea
                  rows={3}
                  required
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="Ex. Erreur de destinataire ou doublon de saisie..."
                  className="w-full rounded-xl border border-slate-300 p-3 text-sm focus:border-rose-500 focus:outline-none"
                />
              </div>

              <div className="flex gap-2.5">
                <button
                  type="button"
                  onClick={() => setCancelTarget(null)}
                  className="flex-1 rounded-xl border border-slate-300 py-3 text-xs font-bold text-slate-700"
                >
                  Fermer
                </button>
                <button
                  type="submit"
                  disabled={cancelSubmitting}
                  className="flex-1 rounded-xl bg-rose-600 py-3 text-xs font-bold text-white hover:bg-rose-700 disabled:opacity-60"
                >
                  {cancelSubmitting ? 'Envoi...' : 'Soumettre à validation Admin'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
