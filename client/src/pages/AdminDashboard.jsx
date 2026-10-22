import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Headphones,
  KeyRound,
  Landmark,
  LayoutDashboard,
  LogOut,
  MessageSquare,
  MinusCircle,
  PlusCircle,
  RefreshCw,
  RotateCcw,
  Search,
  Settings,
  ShieldAlert,
  Trash2,
  Upload,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { apiRequest } from '../api/client';
import BrandLogo from '../components/BrandLogo';
import AdminSupportCenter from '../components/AdminSupportCenter';
import { useAuth } from '../context/AuthContext';
import {
  formatDateTime,
  formatMoney,
  getLoanStatusMeta,
  getTxStatusMeta,
} from '../utils/format';

export default function AdminDashboard() {
  const { logout, trigger3DEvent, setSiteSettings, refreshPublicConfig } = useAuth();

  const [activeTab, setActiveTab] = useState('overview');
  const [supportMemberId, setSupportMemberId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [overview, setOverview] = useState(null);
  const [members, setMembers] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [loans, setLoans] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [settingsForm, setSettingsForm] = useState(null);

  const [banner, setBanner] = useState(null);
  const [memberSearch, setMemberSearch] = useState('');
  const [txFilter, setTxFilter] = useState('all');
  const [txSearch, setTxSearch] = useState('');

  const [balanceModal, setBalanceModal] = useState(null);
  const [balanceAmount, setBalanceAmount] = useState('');
  const [balanceReason, setBalanceReason] = useState('');
  const [submittingAction, setSubmittingAction] = useState(false);

  const [addMemberOpen, setAddMemberOpen] = useState(false);
  const [newMember, setNewMember] = useState({
    fullName: '',
    email: '',
    phone: '',
    country: 'France',
    password: '',
    initialBalance: '0',
  });

  const [deleteTarget, setDeleteTarget] = useState(null);

  const loadAllBackOfficeData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setRefreshing(true);
    try {
      const [ov, mem, tx, ln, logs] = await Promise.all([
        apiRequest('/admin/overview'),
        apiRequest('/admin/members'),
        apiRequest('/admin/transactions'),
        apiRequest('/admin/loans'),
        apiRequest('/admin/audit-logs'),
      ]);
      setOverview(ov.kpis);
      setSettingsForm((prev) => prev || ov.settings);
      setMembers(mem.members || []);
      setTransactions(tx.transactions || []);
      setLoans(ln.loans || []);
      setAuditLogs(logs.logs || []);
    } catch (err) {
      if (!silent) setBanner({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadAllBackOfficeData();
    const timer = setInterval(() => {
      loadAllBackOfficeData(true);
    }, 5000);
    return () => clearInterval(timer);
  }, [loadAllBackOfficeData]);

  const handleQuickSendCodeInSupport = async (tx) => {
    if (!tx.senderId || !tx.activeRequiredCode) return;
    try {
      const label =
        tx.status === 'awaiting_code_1'
          ? '1er code de validation interbancaire (palier 15% → 70%)'
          : '2nd code final de compensation (palier 70% → 100%)';

      await apiRequest(`/admin/messages/${tx.senderId}`, {
        method: 'POST',
        body: {
          txReference: tx.reference,
          attachedCode: tx.activeRequiredCode,
          content: `Bonjour ${tx.senderName}, voici votre ${label} pour le virement ${tx.reference} (${formatMoney(tx.amount)} vers ${tx.externalBankName}) : ${tx.activeRequiredCode}.`,
        },
      });
      await loadAllBackOfficeData(true);
      setBanner({
        type: 'success',
        text: `Code ${tx.activeRequiredCode} envoyé dans la Messagerie d’Assistance de ${tx.senderName}.`,
      });
    } catch (err) {
      setBanner({ type: 'error', text: err.message });
    }
  };

  const handleBalanceOperation = async (e) => {
    e.preventDefault();
    if (!balanceModal) return;
    setSubmittingAction(true);
    setBanner(null);
    const { member, mode } = balanceModal;
    try {
      const res = await apiRequest(`/admin/members/${member.id}/${mode}`, {
        method: 'POST',
        body: {
          amount: Number(balanceAmount),
          description:
            balanceReason.trim() ||
            (mode === 'credit'
              ? 'Crédit Trésorerie Centrale MONERA'
              : 'Débit Régularisation Back-Office MONERA'),
        },
      });
      setBalanceModal(null);
      setBalanceAmount('');
      setBalanceReason('');
      await loadAllBackOfficeData(true);

      trigger3DEvent({
        variant: mode === 'credit' ? 'admin_credit' : 'admin_debit',
        title:
          mode === 'credit'
            ? 'Membre Crédité avec Succès'
            : 'Compte Membre Débité avec Succès',
        subtitle: `Nouveau solde de ${res.member.fullName} : ${formatMoney(res.member.balance)}`,
        amount: res.transaction.amount,
        reference: res.transaction.reference,
        counterparty: `${res.member.fullName} (${res.member.memberCode})`,
        detail: res.transaction.description,
      });
    } catch (err) {
      setBanner({ type: 'error', text: err.message });
    } finally {
      setSubmittingAction(false);
    }
  };

  const handleCreateMember = async (e) => {
    e.preventDefault();
    setSubmittingAction(true);
    setBanner(null);
    try {
      const res = await apiRequest('/admin/members', {
        method: 'POST',
        body: {
          fullName: newMember.fullName.trim(),
          email: newMember.email.trim(),
          phone: newMember.phone.trim(),
          country: newMember.country.trim() || 'France',
          password: newMember.password,
          initialBalance: Number(newMember.initialBalance || 0),
        },
      });
      setAddMemberOpen(false);
      setNewMember({
        fullName: '',
        email: '',
        phone: '',
        country: 'France',
        password: '',
        initialBalance: '0',
      });
      await loadAllBackOfficeData(true);

      trigger3DEvent({
        variant: 'transfer_success',
        title: 'Nouveau Membre Créé',
        subtitle: `Compte ${res.member.memberCode} activé avec RIB-MONERA et carte virtuelle 3D.`,
        amount: res.member.balance,
        reference: res.member.memberCode,
        counterparty: `${res.member.fullName} (${res.member.email})`,
        detail: `RIB : ${res.member.rib}`,
      });
    } catch (err) {
      setBanner({ type: 'error', text: err.message });
    } finally {
      setSubmittingAction(false);
    }
  };

  const handleToggleMemberStatus = async (member) => {
    try {
      const nextStatus = member.status === 'active' ? 'frozen' : 'active';
      await apiRequest(`/admin/members/${member.id}`, {
        method: 'PATCH',
        body: { status: nextStatus },
      });
      await loadAllBackOfficeData(true);
      setBanner({
        type: 'success',
        text: `Statut de ${member.fullName} mis à jour : ${nextStatus === 'active' ? 'Actif' : 'Gelé'}.`,
      });
    } catch (err) {
      setBanner({ type: 'error', text: err.message });
    }
  };

  const handleConfirmDeleteMember = async () => {
    if (!deleteTarget) return;
    setSubmittingAction(true);
    try {
      await apiRequest(`/admin/members/${deleteTarget.id}`, { method: 'DELETE' });
      const deletedName = deleteTarget.fullName;
      setDeleteTarget(null);
      await loadAllBackOfficeData(true);
      setBanner({ type: 'success', text: `Le compte de ${deletedName} a été définitivement supprimé.` });
    } catch (err) {
      setBanner({ type: 'error', text: err.message });
    } finally {
      setSubmittingAction(false);
    }
  };

  const handleApproveTransfer = async (tx) => {
    try {
      const res = await apiRequest(`/admin/transactions/${tx.id}/approve`, {
        method: 'POST',
        body: { adminNote: 'Paiement vérifié et validé par le Back-Office MONERA.' },
      });
      await loadAllBackOfficeData(true);
      trigger3DEvent({
        variant: 'transfer_approved',
        title: 'Paiement Approuvé par l’Administration',
        amount: res.transaction.amount,
        reference: res.transaction.reference,
        counterparty: `${tx.senderName} → ${tx.recipientName}`,
        detail: 'Opération confirmée définitivement sur les comptes.',
      });
    } catch (err) {
      setBanner({ type: 'error', text: err.message });
    }
  };

  const handleCancelAndRefundTransfer = async (tx) => {
    try {
      const res = await apiRequest(`/admin/transactions/${tx.id}/cancel`, {
        method: 'POST',
        body: { adminNote: 'Annulation validée par l’Administration — fonds recrédités à l’expéditeur.' },
      });
      await loadAllBackOfficeData(true);
      trigger3DEvent({
        variant: 'transfer_cancelled',
        title: 'Transfert Annulé • Montant Restitué',
        subtitle: `Les ${formatMoney(res.transaction.amount)} ont été intégralement restitués sur le compte de ${tx.senderName}.`,
        amount: res.transaction.amount,
        reference: res.transaction.reference,
        counterparty: `Remboursement vers ${tx.senderName}`,
        detail: tx.cancelReason ? `Motif initial membre : ${tx.cancelReason}` : 'Révocation administrative exécutée.',
      });
    } catch (err) {
      setBanner({ type: 'error', text: err.message });
    }
  };

  const handleReviewLoan = async (loan, decision) => {
    try {
      await apiRequest(`/admin/loans/${loan.id}/review`, {
        method: 'POST',
        body: { decision },
      });
      await loadAllBackOfficeData(true);

      if (decision === 'approved') {
        trigger3DEvent({
          variant: 'loan_approved',
          title: 'Prêt Approuvé • Fonds Débloqués',
          subtitle: `Le compte de ${loan.fullName} (${loan.memberCode}) a été crédité de +${formatMoney(loan.amount)}.`,
          amount: loan.amount,
          reference: loan.reference,
          counterparty: `${loan.fullName} (${loan.email})`,
          detail: `${loan.purpose} • ${loan.durationMonths} mois`,
        });
      } else {
        setBanner({ type: 'success', text: `Dossier de prêt ${loan.reference} refusé.` });
      }
    } catch (err) {
      setBanner({ type: 'error', text: err.message });
    } finally {
      setSubmittingAction(false);
    }
  };

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    setSubmittingAction(true);
    setBanner(null);
    try {
      const res = await apiRequest('/admin/settings', {
        method: 'PUT',
        body: settingsForm,
      });
      setSettingsForm(res.settings);
      setSiteSettings(res.settings);
      await refreshPublicConfig();
      setBanner({
        type: 'success',
        text: 'Configuration globale du site MONERA enregistrée et déployée en temps réel.',
      });
    } catch (err) {
      setBanner({ type: 'error', text: err.message });
    } finally {
      setSubmittingAction(false);
    }
  };

  const handleBrandImageUpload = (field, file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setSettingsForm((prev) => ({
        ...prev,
        [field]: String(reader.result || ''),
      }));
    };
    reader.readAsDataURL(file);
  };

  if (loading && !overview) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#04142C] text-white">
        <div className="text-center space-y-3">
          <div className="h-12 w-12 mx-auto rounded-full border-2 border-[#2DCCCD] border-t-transparent animate-spin" />
          <p className="font-display text-sm tracking-widest uppercase text-cyan-200">
            Initialisation du Back-Office Central MONERA...
          </p>
        </div>
      </div>
    );
  }

  const awaitingCodeCount = Number(overview?.awaitingCodeTransfers || 0);
  const unreadSupportCount = Number(overview?.unreadSupportMessages || 0);
  const urgentTransfersCount =
    Number(overview?.pendingTransfers || 0) +
    Number(overview?.cancelRequests || 0) +
    awaitingCodeCount;
  const pendingLoansCount = Number(overview?.pendingLoans || 0);

  const filteredMembers = members.filter((m) => {
    const q = memberSearch.trim().toLowerCase();
    if (!q) return true;
    return (
      m.fullName.toLowerCase().includes(q) ||
      m.email.toLowerCase().includes(q) ||
      m.memberCode.toLowerCase().includes(q) ||
      m.rib.toLowerCase().includes(q)
    );
  });

  const filteredTx = transactions.filter((t) => {
    if (
      txFilter === 'action' &&
      !['cancel_requested', 'pending_approval', 'awaiting_code_1', 'awaiting_code_2'].includes(
        t.status
      )
    ) {
      return false;
    }
    if (
      txFilter === 'codes' &&
      t.status !== 'awaiting_code_1' &&
      t.status !== 'awaiting_code_2'
    ) {
      return false;
    }
    if (txFilter === 'cancel_requested' && t.status !== 'cancel_requested') return false;
    if (txFilter === 'pending_approval' && t.status !== 'pending_approval') return false;
    if (txFilter === 'completed' && t.status !== 'completed') return false;
    if (txFilter === 'cancelled' && t.status !== 'cancelled') return false;

    const q = txSearch.trim().toLowerCase();
    if (!q) return true;
    return (
      t.reference.toLowerCase().includes(q) ||
      t.senderName.toLowerCase().includes(q) ||
      t.recipientName.toLowerCase().includes(q) ||
      t.description.toLowerCase().includes(q)
    );
  });

  const navItems = [
    { id: 'overview', label: 'Vue Exécutive', icon: LayoutDashboard },
    {
      id: 'support',
      label: 'Messagerie & Codes',
      icon: Headphones,
      badge: unreadSupportCount + awaitingCodeCount,
    },
    {
      id: 'transactions',
      label: 'Transferts & Annulations',
      icon: Activity,
      badge: urgentTransfersCount,
    },
    { id: 'members', label: 'Gestion des Membres', icon: Users, badge: members.length },
    { id: 'loans', label: 'Demandes de Prêts', icon: Landmark, badge: pendingLoansCount },
    { id: 'settings', label: 'Gestion du Site', icon: Settings },
    { id: 'security', label: 'Sécurité & Audit', icon: ShieldAlert },
  ];

  return (
    <div className="min-h-screen bg-[#F4F7FB] flex flex-col lg:flex-row">
      <aside className="lg:w-72 bg-[#04142C] text-white flex flex-col justify-between shrink-0 border-b lg:border-b-0 lg:border-r border-white/10">
        <div>
          <div className="h-20 px-6 flex items-center justify-between border-b border-white/10">
            <Link to="/">
              <BrandLogo variant="dark" size="md" />
            </Link>
            <button
              type="button"
              onClick={() => loadAllBackOfficeData(true)}
              className="rounded-lg p-2 text-cyan-300 hover:bg-white/10"
              title="Rafraîchir"
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>

          <div className="px-6 py-4 bg-[#072146]/80 border-b border-white/10">
            <span className="inline-flex items-center gap-1.5 rounded-md bg-amber-400/15 border border-amber-300/30 px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-widest text-amber-300">
              Back-Office Administration
            </span>
            <div className="mt-1.5 font-display text-sm font-bold text-white">
              Supervision Centrale MONERA
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
                    setActiveTab(item.id);
                    setBanner(null);
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
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-extrabold ${
                        item.id === 'members'
                          ? 'bg-white/15 text-white'
                          : 'bg-[#F0D384] text-[#04142C]'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        <div className="hidden lg:block p-4 space-y-2 border-t border-white/10">
          <Link
            to="/"
            className="w-full block text-center rounded-xl border border-white/10 py-2 text-xs font-semibold text-cyan-300 hover:bg-white/5"
          >
            Voir la vitrine publique →
          </Link>
          <button
            type="button"
            onClick={logout}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-rose-500/15 border border-rose-400/30 py-2.5 text-xs font-bold text-rose-200 hover:bg-rose-600 hover:text-white transition"
          >
            <LogOut className="h-4 w-4" />
            <span>Déconnexion Admin</span>
          </button>
        </div>
      </aside>

      <main className="flex-1 min-w-0">
        <header className="bg-white border-b border-slate-200 px-4 sm:px-8 h-16 flex items-center justify-between">
          <h1 className="font-display text-lg sm:text-xl font-bold text-[#072146]">
            {navItems.find((n) => n.id === activeTab)?.label}
          </h1>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => setActiveTab('support')}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-[#F4F7FB] px-3.5 py-2 text-xs font-bold text-[#072146] hover:border-[#0284FE]"
            >
              <Headphones className="h-3.5 w-3.5 text-[#0284FE]" />
              <span>Messagerie ({unreadSupportCount + awaitingCodeCount})</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab('members');
                setAddMemberOpen(true);
              }}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#072146] px-4 py-2 text-xs font-bold text-white hover:bg-[#0284FE] transition"
            >
              <UserPlus className="h-3.5 w-3.5 text-[#2DCCCD]" />
              <span className="hidden sm:inline">Ajouter un membre</span>
            </button>

            <button
              type="button"
              onClick={logout}
              className="lg:hidden rounded-lg border border-slate-200 p-2 text-slate-600"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </header>

        <div className="p-4 sm:p-8 max-w-7xl mx-auto space-y-7">
          {banner && (
            <div
              className={`flex items-center justify-between rounded-2xl px-5 py-3.5 text-sm font-medium border ${
                banner.type === 'error'
                  ? 'bg-rose-50 border-rose-200 text-rose-800'
                  : 'bg-emerald-50 border-emerald-200 text-emerald-800'
              }`}
            >
              <span>{banner.text}</span>
              <button type="button" onClick={() => setBanner(null)}>
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          {activeTab === 'overview' && (
            <>
              <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-5">
                <div className="rounded-3xl bg-[#072146] text-white p-6 shadow-bbva">
                  <div className="text-xs font-semibold uppercase tracking-wider text-cyan-300">
                    Encours Total Dépôts Membres
                  </div>
                  <div className="mt-2 font-mono text-2xl sm:text-3xl font-extrabold tabular-nums">
                    {formatMoney(overview?.totalDeposits || 0)}
                  </div>
                  <div className="mt-2 text-xs text-slate-300">
                    {overview?.activeMembers || 0} comptes actifs sur {overview?.totalMembers || 0}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setActiveTab('support')}
                  className="text-left rounded-3xl bg-white p-6 border-2 border-cyan-400/70 shadow-sm hover:border-[#0284FE] transition"
                >
                  <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-[#0284FE]">
                    <span>Codes Externes 15%/70% & Chat</span>
                    <KeyRound className="h-4 w-4" />
                  </div>
                  <div className="mt-2 font-mono text-3xl font-extrabold text-[#072146] tabular-nums">
                    {awaitingCodeCount} code(s)
                  </div>
                  <div className="mt-2 text-xs text-[#072146] font-semibold">
                    {unreadSupportCount} message(s) client non lu(s) • Ouvrir →
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('transactions');
                    setTxFilter('action');
                  }}
                  className="text-left rounded-3xl bg-white p-6 border-2 border-amber-300/70 shadow-sm hover:border-[#0284FE] transition"
                >
                  <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-amber-700">
                    <span>Transferts à Traiter</span>
                    <AlertTriangle className="h-4 w-4" />
                  </div>
                  <div className="mt-2 font-mono text-3xl font-extrabold text-[#072146] tabular-nums">
                    {urgentTransfersCount}
                  </div>
                  <div className="mt-2 text-xs text-amber-800 font-semibold">
                    {overview?.cancelRequests || 0} annulation(s) • {awaitingCodeCount} en attente code →
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('loans')}
                  className="text-left rounded-3xl bg-white p-6 border border-slate-200/80 shadow-sm hover:border-[#0284FE] transition"
                >
                  <div className="text-xs font-bold uppercase tracking-wider text-[#0284FE]">
                    Demandes de Prêts en Attente
                  </div>
                  <div className="mt-2 font-mono text-3xl font-extrabold text-[#072146] tabular-nums">
                    {pendingLoansCount}
                  </div>
                  <div className="mt-2 text-xs text-slate-500">
                    Encours accordé : {formatMoney(overview?.approvedLoansVolume || 0)} →
                  </div>
                </button>
              </div>

              <div className="grid lg:grid-cols-12 gap-7">
                <div className="lg:col-span-7 rounded-3xl bg-white p-6 border border-slate-200/80 space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="font-display text-lg font-bold text-[#072146]">
                      Opérations Prioritaires, Codes 15%/70% & Flux Récents
                    </h2>
                    <button
                      type="button"
                      onClick={() => setActiveTab('transactions')}
                      className="text-xs font-bold text-[#0284FE] hover:underline"
                    >
                      Gérer tous les transferts →
                    </button>
                  </div>

                  <div className="divide-y divide-slate-100">
                    {transactions.slice(0, 6).map((tx) => {
                      const meta = getTxStatusMeta(tx.status);
                      return (
                        <div
                          key={tx.id}
                          className="py-3.5 flex flex-wrap items-center justify-between gap-3"
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-mono text-xs font-bold text-[#0284FE]">
                                {tx.reference}
                              </span>
                              <span
                                className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${meta.badgeClass}`}
                              >
                                {meta.label}
                              </span>
                              {tx.activeRequiredCode && (
                                <span className="rounded-md bg-[#072146] px-2 py-0.5 font-mono text-xs font-extrabold text-[#F0D384]">
                                  Code : {tx.activeRequiredCode}
                                </span>
                              )}
                            </div>
                            <div className="mt-1 text-sm font-bold text-[#072146] truncate">
                              {tx.senderName} → {tx.recipientName}
                            </div>
                            {tx.cancelReason && (
                              <div className="text-xs text-rose-600 font-medium">
                                Demande membre : « {tx.cancelReason} »
                              </div>
                            )}
                          </div>

                          <div className="flex items-center gap-2 ml-auto flex-wrap">
                            <span className="font-mono text-sm font-extrabold text-[#072146]">
                              {formatMoney(tx.amount)}
                            </span>

                            {tx.activeRequiredCode && (
                              <button
                                type="button"
                                onClick={() => handleQuickSendCodeInSupport(tx)}
                                className="rounded-lg bg-[#0284FE] px-2.5 py-1.5 text-xs font-bold text-white hover:bg-[#072146]"
                              >
                                Envoyer code au membre
                              </button>
                            )}

                            {(tx.status === 'pending_approval' || tx.status === 'cancel_requested') && (
                              <button
                                type="button"
                                onClick={() => handleApproveTransfer(tx)}
                                className="rounded-lg bg-emerald-600 px-2.5 py-1.5 text-xs font-bold text-white hover:bg-emerald-700"
                              >
                                Approuver
                              </button>
                            )}

                            {(tx.type === 'transfer' || tx.type === 'external_transfer') &&
                              tx.status !== 'cancelled' && (
                                <button
                                  type="button"
                                  onClick={() => handleCancelAndRefundTransfer(tx)}
                                  className="rounded-lg bg-rose-600 px-2.5 py-1.5 text-xs font-bold text-white hover:bg-rose-700"
                                >
                                  Annuler & Rembourser
                                </button>
                              )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="lg:col-span-5 rounded-3xl bg-white p-6 border border-slate-200/80 space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="font-display text-lg font-bold text-[#072146]">
                      Accès Rapide • Créditer / Débiter / Chat
                    </h2>
                    <button
                      type="button"
                      onClick={() => setActiveTab('members')}
                      className="text-xs font-bold text-[#0284FE] hover:underline"
                    >
                      Liste complète →
                    </button>
                  </div>

                  <div className="divide-y divide-slate-100">
                    {members.slice(0, 5).map((m) => (
                      <div key={m.id} className="py-3 flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className="font-bold text-sm text-[#072146] truncate">
                            {m.fullName}
                          </div>
                          <div className="font-mono text-xs text-slate-500">
                            {m.memberCode} • {formatMoney(m.balance)}
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => {
                              setSupportMemberId(m.id);
                              setActiveTab('support');
                            }}
                            title="Messagerie d'assistance"
                            className="rounded-lg bg-slate-100 p-1.5 text-[#072146] hover:bg-[#0284FE] hover:text-white transition"
                          >
                            <MessageSquare className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setBalanceModal({ member: m, mode: 'credit' });
                              setBalanceAmount('');
                              setBalanceReason('');
                            }}
                            className="rounded-lg bg-emerald-50 border border-emerald-200 px-2.5 py-1 text-xs font-bold text-emerald-700 hover:bg-emerald-600 hover:text-white transition"
                          >
                            + Créditer
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setBalanceModal({ member: m, mode: 'debit' });
                              setBalanceAmount('');
                              setBalanceReason('');
                            }}
                            className="rounded-lg bg-rose-50 border border-rose-200 px-2.5 py-1 text-xs font-bold text-rose-700 hover:bg-rose-600 hover:text-white transition"
                          >
                            - Débiter
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}

          {activeTab === 'support' && (
            <AdminSupportCenter
              initialMemberId={supportMemberId}
              onGlobalRefresh={loadAllBackOfficeData}
            />
          )}

          {activeTab === 'transactions' && (
            <div className="rounded-3xl bg-white p-6 sm:p-8 border border-slate-200/80 space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { id: 'all', label: 'Tous les flux' },
                    { id: 'codes', label: `Codes 15% / 70% (${awaitingCodeCount})` },
                    { id: 'cancel_requested', label: 'Demandes d’annulation' },
                    { id: 'pending_approval', label: 'En attente Admin' },
                    { id: 'completed', label: 'Effectués' },
                    { id: 'cancelled', label: 'Annulés & Remboursés' },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setTxFilter(tab.id)}
                      className={`rounded-xl px-3.5 py-2 text-xs font-bold transition ${
                        txFilter === tab.id
                          ? 'bg-[#072146] text-white'
                          : 'bg-[#F4F7FB] text-slate-600 hover:text-[#072146]'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                <div className="relative w-full sm:w-64">
                  <Search className="h-4 w-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={txSearch}
                    onChange={(e) => setTxSearch(e.target.value)}
                    placeholder="Réf., expéditeur, bénéficiaire..."
                    className="w-full rounded-xl border border-slate-300 pl-9 pr-3 py-2 text-xs"
                  />
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                      <th className="py-3 pr-4">Référence</th>
                      <th className="py-3 px-4">Expéditeur → Bénéficiaire</th>
                      <th className="py-3 px-4">Montant</th>
                      <th className="py-3 px-4">Statut & Code Actif</th>
                      <th className="py-3 pl-4 text-right">Décision Back-Office</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm">
                    {filteredTx.map((tx) => {
                      const meta = getTxStatusMeta(tx.status);
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
                              {tx.senderName} <span className="text-[#0284FE]">→</span>{' '}
                              {tx.recipientName}
                            </div>
                            <div className="text-xs text-slate-500">
                              {tx.description}
                              {tx.externalIban ? ` • IBAN ${tx.externalIban}` : ''}
                            </div>
                            {tx.cancelReason && (
                              <div className="mt-1 inline-block rounded-lg bg-amber-50 border border-amber-200 px-2.5 py-1 text-xs font-semibold text-amber-900">
                                Motif d’annulation du membre : {tx.cancelReason}
                              </div>
                            )}
                          </td>
                          <td className="py-4 px-4 whitespace-nowrap font-mono font-extrabold text-[#072146] tabular-nums">
                            {formatMoney(tx.amount)}
                          </td>
                          <td className="py-4 px-4 whitespace-nowrap space-y-1">
                            <div>
                              <span
                                className={`inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${meta.badgeClass}`}
                              >
                                {meta.label}
                              </span>
                            </div>
                            {tx.activeRequiredCode && (
                              <div className="font-mono text-xs font-extrabold text-[#072146] bg-amber-100/80 border border-amber-300 rounded-md px-2 py-0.5 inline-block">
                                {tx.activeRequiredCode}
                              </div>
                            )}
                          </td>
                          <td className="py-4 pl-4 text-right whitespace-nowrap space-x-2">
                            {tx.activeRequiredCode && (
                              <button
                                type="button"
                                onClick={() => handleQuickSendCodeInSupport(tx)}
                                className="inline-flex items-center gap-1 rounded-lg bg-[#0284FE] px-3 py-1.5 text-xs font-bold text-white hover:bg-[#072146]"
                              >
                                <KeyRound className="h-3.5 w-3.5" />
                                Envoyer code par chat
                              </button>
                            )}

                            {(tx.status === 'pending_approval' || tx.status === 'cancel_requested') && (
                              <button
                                type="button"
                                onClick={() => handleApproveTransfer(tx)}
                                className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700"
                              >
                                <CheckCircle2 className="h-3.5 w-3.5" />
                                {tx.status === 'cancel_requested'
                                  ? 'Maintenir paiement'
                                  : 'Approuver'}
                              </button>
                            )}

                            {(tx.type === 'transfer' || tx.type === 'external_transfer') &&
                              tx.status !== 'cancelled' && (
                                <button
                                  type="button"
                                  onClick={() => handleCancelAndRefundTransfer(tx)}
                                  className="inline-flex items-center gap-1 rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-rose-700"
                                >
                                  <RotateCcw className="h-3.5 w-3.5" />
                                  Annuler & Rembourser
                                </button>
                              )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'members' && (
            <div className="rounded-3xl bg-white p-6 sm:p-8 border border-slate-200/80 space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h2 className="font-display text-xl font-bold text-[#072146]">
                    Annuaire & Gestion Intégrale des Membres ({members.length})
                  </h2>
                  <p className="text-xs text-slate-500">
                    Consultez ID, RIB-MONERA, nom, email et solde ; discutez par messagerie, créditez, débitez, ajoutez ou supprimez tout compte.
                  </p>
                </div>

                <div className="flex items-center gap-3 w-full sm:w-auto">
                  <div className="relative flex-1 sm:w-72">
                    <Search className="h-4 w-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={memberSearch}
                      onChange={(e) => setMemberSearch(e.target.value)}
                      placeholder="Rechercher par ID, nom, email, RIB..."
                      className="w-full rounded-xl border border-slate-300 pl-9 pr-3 py-2 text-xs"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => setAddMemberOpen(true)}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-[#0284FE] px-4 py-2.5 text-xs font-bold text-white shrink-0 hover:bg-[#072146]"
                  >
                    <UserPlus className="h-4 w-4" />
                    Nouveau Membre
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                      <th className="py-3 pr-4">ID & RIB-MONERA</th>
                      <th className="py-3 px-4">Nom & Email</th>
                      <th className="py-3 px-4">Statut</th>
                      <th className="py-3 px-4 text-right">Solde Actuel</th>
                      <th className="py-3 pl-4 text-right">Opérations Admin</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm">
                    {filteredMembers.map((m) => (
                      <tr key={m.id} className="hover:bg-slate-50/80">
                        <td className="py-4 pr-4">
                          <div className="font-mono text-xs font-extrabold text-[#0284FE]">
                            #{m.id} • {m.memberCode}
                          </div>
                          <div className="font-mono text-[11px] text-slate-500 mt-0.5">{m.rib}</div>
                        </td>
                        <td className="py-4 px-4">
                          <div className="font-bold text-[#072146]">{m.fullName}</div>
                          <div className="text-xs text-slate-500">
                            {m.email} • {m.country}
                          </div>
                        </td>
                        <td className="py-4 px-4 whitespace-nowrap">
                          <span
                            className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold border ${
                              m.status === 'active'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : 'bg-rose-50 text-rose-700 border-rose-200'
                            }`}
                          >
                            {m.status === 'active' ? 'Actif' : 'Gelé'}
                          </span>
                        </td>
                        <td className="py-4 px-4 text-right whitespace-nowrap font-mono text-base font-extrabold text-[#072146] tabular-nums">
                          {formatMoney(m.balance)}
                        </td>
                        <td className="py-4 pl-4 text-right whitespace-nowrap space-x-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              setSupportMemberId(m.id);
                              setActiveTab('support');
                            }}
                            className="inline-flex items-center gap-1 rounded-lg bg-[#072146] px-2.5 py-1.5 text-xs font-bold text-white hover:bg-[#0284FE]"
                          >
                            <MessageSquare className="h-3.5 w-3.5 text-[#2DCCCD]" />
                            Chat
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setBalanceModal({ member: m, mode: 'credit' });
                              setBalanceAmount('');
                              setBalanceReason('');
                            }}
                            className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1.5 text-xs font-bold text-white hover:bg-emerald-700"
                          >
                            <PlusCircle className="h-3.5 w-3.5" />
                            Créditer
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setBalanceModal({ member: m, mode: 'debit' });
                              setBalanceAmount('');
                              setBalanceReason('');
                            }}
                            className="inline-flex items-center gap-1 rounded-lg bg-amber-600 px-2.5 py-1.5 text-xs font-bold text-white hover:bg-amber-700"
                          >
                            <MinusCircle className="h-3.5 w-3.5" />
                            Débiter
                          </button>

                          <button
                            type="button"
                            onClick={() => handleToggleMemberStatus(m)}
                            className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-bold text-[#072146] hover:bg-slate-100"
                          >
                            {m.status === 'active' ? 'Geler' : 'Activer'}
                          </button>

                          <button
                            type="button"
                            onClick={() => setDeleteTarget(m)}
                            title="Supprimer ce membre"
                            className="inline-flex items-center rounded-lg border border-rose-200 bg-rose-50 p-1.5 text-rose-600 hover:bg-rose-600 hover:text-white transition"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'loans' && (
            <div className="rounded-3xl bg-white p-6 sm:p-8 border border-slate-200/80 space-y-6">
              <div>
                <h2 className="font-display text-xl font-bold text-[#072146]">
                  Comité des Prêts & Octroi de Crédits ({loans.length})
                </h2>
                <p className="text-xs text-slate-500">
                  Approuver un prêt crédite instantanément le montant correspondant sur le solde du membre.
                </p>
              </div>

              <div className="grid md:grid-cols-2 gap-5">
                {loans.map((loan) => {
                  const meta = getLoanStatusMeta(loan.status);
                  return (
                    <div
                      key={loan.id}
                      className="rounded-2xl border border-slate-200 p-6 flex flex-col justify-between gap-4"
                    >
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-xs font-bold text-[#0284FE]">
                            {loan.reference} • {loan.memberCode}
                          </span>
                          <span
                            className={`rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${meta.badgeClass}`}
                          >
                            {meta.label}
                          </span>
                        </div>

                        <div className="flex items-baseline justify-between pt-1">
                          <div>
                            <div className="font-display text-lg font-bold text-[#072146]">
                              {loan.fullName}
                            </div>
                            <div className="text-xs text-slate-500">
                              {loan.email} • Solde actuel :{' '}
                              <strong>{formatMoney(loan.memberBalance)}</strong>
                            </div>
                          </div>
                          <div className="font-mono text-2xl font-extrabold text-[#072146]">
                            {formatMoney(loan.amount)}
                          </div>
                        </div>

                        <div className="rounded-xl bg-[#F4F7FB] p-3 text-xs text-slate-700 space-y-1">
                          <div>
                            <strong>Objet :</strong> {loan.purpose} ({loan.durationMonths} mois à{' '}
                            {loan.annualRate}% • {formatMoney(loan.monthlyPayment)}/mois)
                          </div>
                          <div>
                            <strong>Revenus déclarés :</strong> {formatMoney(loan.monthlyIncome)} / mois
                          </div>
                          {loan.details && (
                            <div>
                              <strong>Détails :</strong> {loan.details}
                            </div>
                          )}
                        </div>
                      </div>

                      {loan.status === 'pending' && (
                        <div className="flex gap-2.5 pt-2">
                          <button
                            type="button"
                            onClick={() => handleReviewLoan(loan, 'approved')}
                            className="flex-1 rounded-xl bg-emerald-600 py-2.5 text-xs font-bold text-white hover:bg-emerald-700"
                          >
                            Approuver & Débloquer {formatMoney(loan.amount)}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleReviewLoan(loan, 'rejected')}
                            className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-xs font-bold text-rose-700 hover:bg-rose-600 hover:text-white"
                          >
                            Refuser
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {activeTab === 'settings' && settingsForm && (
            <form
              onSubmit={handleSaveSettings}
              className="rounded-3xl bg-white p-6 sm:p-8 border border-slate-200/80 space-y-7"
            >
              <div>
                <h2 className="font-display text-xl font-bold text-[#072146]">
                  Gouvernance & Gestion Complète du Site MONERA
                </h2>
                <p className="text-xs text-slate-500">
                  Pilotez l’identité visuelle (Logo & Favicon), les règles de validation des transferts, les plafonds et les taux de crédit.
                </p>
              </div>

              <div className="grid md:grid-cols-2 gap-5">
                <div className="rounded-2xl border border-slate-200 p-4 space-y-3 bg-[#F4F7FB]/50">
                  <div className="text-xs font-bold uppercase tracking-wider text-[#072146]">
                    Logo Principal du Site (LOGO)
                  </div>
                  <div className="h-16 rounded-xl bg-[#072146] px-4 flex items-center justify-between">
                    <img
                      src={settingsForm.customLogoUrl || '/assets/logo.png'}
                      alt="Logo aperçu"
                      className="h-10 w-auto object-contain"
                    />
                    <label className="cursor-pointer inline-flex items-center gap-1.5 rounded-lg bg-white/15 px-3 py-1.5 text-xs font-bold text-white hover:bg-white/25">
                      <Upload className="h-3.5 w-3.5" />
                      Remplacer
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => handleBrandImageUpload('customLogoUrl', e.target.files?.[0])}
                      />
                    </label>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 p-4 space-y-3 bg-[#F4F7FB]/50">
                  <div className="text-xs font-bold uppercase tracking-wider text-[#072146]">
                    Icône Navigateur (FAVICON)
                  </div>
                  <div className="h-16 rounded-xl bg-white border border-slate-200 px-4 flex items-center justify-between">
                    <img
                      src={settingsForm.customFaviconUrl || '/assets/favicon.png'}
                      alt="Favicon aperçu"
                      className="h-10 w-10 rounded-lg object-contain"
                    />
                    <label className="cursor-pointer inline-flex items-center gap-1.5 rounded-lg bg-[#072146] px-3 py-1.5 text-xs font-bold text-white hover:bg-[#0284FE]">
                      <Upload className="h-3.5 w-3.5" />
                      Remplacer
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) =>
                          handleBrandImageUpload('customFaviconUrl', e.target.files?.[0])
                        }
                      />
                    </label>
                  </div>
                </div>
              </div>

              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-[#072146] mb-1">
                    Nom de l’établissement
                  </label>
                  <input
                    type="text"
                    value={settingsForm.bankName}
                    onChange={(e) => setSettingsForm({ ...settingsForm, bankName: e.target.value })}
                    className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#072146] mb-1">Email Support</label>
                  <input
                    type="email"
                    value={settingsForm.supportEmail}
                    onChange={(e) =>
                      setSettingsForm({ ...settingsForm, supportEmail: e.target.value })
                    }
                    className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#072146] mb-1">
                    Téléphone Support
                  </label>
                  <input
                    type="text"
                    value={settingsForm.supportPhone}
                    onChange={(e) =>
                      setSettingsForm({ ...settingsForm, supportPhone: e.target.value })
                    }
                    className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm"
                  />
                </div>

                <div className="sm:col-span-2 lg:col-span-3">
                  <label className="block text-xs font-bold text-[#072146] mb-1">
                    Bandeau d’annonce en haut du site
                  </label>
                  <input
                    type="text"
                    value={settingsForm.announcementText}
                    onChange={(e) =>
                      setSettingsForm({ ...settingsForm, announcementText: e.target.value })
                    }
                    className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#072146] mb-1">
                    Mode de validation des virements internes
                  </label>
                  <select
                    value={settingsForm.transferApprovalMode}
                    onChange={(e) =>
                      setSettingsForm({ ...settingsForm, transferApprovalMode: e.target.value })
                    }
                    className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm"
                  >
                    <option value="instant">Exécution instantanée (standard)</option>
                    <option value="manual">Approbation Admin obligatoire avant crédit</option>
                    <option value="threshold">Contrôle Admin au-delà d’un seuil</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#072146] mb-1">
                    Plafond par virement (€)
                  </label>
                  <input
                    type="number"
                    value={settingsForm.maxTransferAmount}
                    onChange={(e) =>
                      setSettingsForm({
                        ...settingsForm,
                        maxTransferAmount: Number(e.target.value),
                      })
                    }
                    className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 font-mono text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#072146] mb-1">
                    Prime de bienvenue nouveaux inscrits (€)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={settingsForm.welcomeBonus}
                    onChange={(e) =>
                      setSettingsForm({ ...settingsForm, welcomeBonus: Number(e.target.value) })
                    }
                    className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 font-mono text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#072146] mb-1">
                    Taux d’intérêt annuel prêts (% TAEG)
                  </label>
                  <input
                    type="number"
                    step="0.05"
                    value={settingsForm.loanAnnualRate}
                    onChange={(e) =>
                      setSettingsForm({ ...settingsForm, loanAnnualRate: Number(e.target.value) })
                    }
                    className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 font-mono text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#072146] mb-1">
                    Plafond maximal de prêt (€)
                  </label>
                  <input
                    type="number"
                    value={settingsForm.maxLoanAmount}
                    onChange={(e) =>
                      setSettingsForm({ ...settingsForm, maxLoanAmount: Number(e.target.value) })
                    }
                    className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 font-mono text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#072146] mb-1">
                    Frais de transfert (%)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    value={settingsForm.transferFeePercent}
                    onChange={(e) =>
                      setSettingsForm({
                        ...settingsForm,
                        transferFeePercent: Number(e.target.value),
                      })
                    }
                    className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 font-mono text-sm"
                  />
                </div>
              </div>

              <div className="flex flex-wrap gap-6 pt-2">
                <label className="inline-flex items-center gap-2.5 text-sm font-semibold text-[#072146] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settingsForm.allowRegistration}
                    onChange={(e) =>
                      setSettingsForm({ ...settingsForm, allowRegistration: e.target.checked })
                    }
                    className="h-4 w-4 accent-[#0284FE]"
                  />
                  <span>Autoriser l’ouverture de nouveaux comptes publics</span>
                </label>

                <label className="inline-flex items-center gap-2.5 text-sm font-semibold text-rose-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settingsForm.maintenanceMode}
                    onChange={(e) =>
                      setSettingsForm({ ...settingsForm, maintenanceMode: e.target.checked })
                    }
                    className="h-4 w-4 accent-rose-600"
                  />
                  <span>Activer le mode Maintenance Sécurité (accès Admin conservé)</span>
                </label>
              </div>

              <button
                type="submit"
                disabled={submittingAction}
                className="rounded-xl bg-[#0284FE] px-7 py-3.5 text-sm font-bold text-white shadow-lg shadow-blue-500/25 hover:bg-[#072146] transition"
              >
                {submittingAction ? 'Sauvegarde...' : 'Enregistrer toute la configuration du site'}
              </button>
            </form>
          )}

          {activeTab === 'security' && (
            <div className="rounded-3xl bg-white p-6 sm:p-8 border border-slate-200/80 space-y-5">
              <h2 className="font-display text-xl font-bold text-[#072146]">
                Journal d’Audit & Sécurité Immuable ({auditLogs.length})
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-400 uppercase">
                      <th className="py-3 pr-4">Horodatage</th>
                      <th className="py-3 px-4">Acteur</th>
                      <th className="py-3 px-4">Événement Sécurité</th>
                      <th className="py-3 pl-4">Cible & Métadonnées</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {auditLogs.map((log) => (
                      <tr key={log.id}>
                        <td className="py-3 pr-4 font-mono text-slate-500 whitespace-nowrap">
                          {formatDateTime(log.created_at)}
                        </td>
                        <td className="py-3 px-4 font-semibold text-[#072146]">
                          {log.actor_email || 'Système'}
                        </td>
                        <td className="py-3 px-4">
                          <span className="rounded-md bg-[#072146]/8 px-2 py-0.5 font-mono font-bold text-[#072146]">
                            {log.action}
                          </span>
                        </td>
                        <td className="py-3 pl-4 font-mono text-slate-500">
                          {log.target_type} #{log.target_id} • {JSON.stringify(log.metadata || {})}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </main>

      {balanceModal && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-[#04142C]/75 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 sm:p-8 shadow-2xl space-y-5">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-[#0284FE]">
                  Écriture Comptable Directe
                </span>
                <h3 className="mt-1 font-display text-xl font-bold text-[#072146]">
                  {balanceModal.mode === 'credit' ? 'Créditer' : 'Débiter'}{' '}
                  {balanceModal.member.fullName}
                </h3>
                <p className="text-xs text-slate-500 font-mono mt-0.5">
                  {balanceModal.member.memberCode} • Solde actuel :{' '}
                  {formatMoney(balanceModal.member.balance)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setBalanceModal(null)}
                className="rounded-full p-1 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleBalanceOperation} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase text-[#072146] mb-1.5">
                  Montant (EUR)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  value={balanceAmount}
                  onChange={(e) => setBalanceAmount(e.target.value)}
                  placeholder="Ex. 1500.00"
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 font-mono text-lg font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-[#072146] mb-1.5">
                  Motif officiel sur le relevé client
                </label>
                <input
                  type="text"
                  required
                  value={balanceReason}
                  onChange={(e) => setBalanceReason(e.target.value)}
                  placeholder={
                    balanceModal.mode === 'credit'
                      ? 'Virement entrant / Remise de fonds'
                      : 'Prélèvement bancaire / Régularisation'
                  }
                  className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm"
                />
              </div>

              <div className="flex gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setBalanceModal(null)}
                  className="flex-1 rounded-xl border border-slate-300 py-3 text-xs font-bold text-slate-700"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={submittingAction}
                  className={`flex-1 rounded-xl py-3 text-xs font-bold text-white ${
                    balanceModal.mode === 'credit'
                      ? 'bg-emerald-600 hover:bg-emerald-700'
                      : 'bg-rose-600 hover:bg-rose-700'
                  }`}
                >
                  {submittingAction
                    ? 'Exécution...'
                    : balanceModal.mode === 'credit'
                      ? 'Confirmer le crédit'
                      : 'Confirmer le débit'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {addMemberOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-[#04142C]/75 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-3xl bg-white p-6 sm:p-8 shadow-2xl space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-xl font-bold text-[#072146]">
                Créer un Nouveau Membre MONERA
              </h3>
              <button
                type="button"
                onClick={() => setAddMemberOpen(false)}
                className="rounded-full p-1 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreateMember} className="space-y-3.5">
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#072146] mb-1">Nom complet</label>
                  <input
                    type="text"
                    required
                    value={newMember.fullName}
                    onChange={(e) => setNewMember({ ...newMember, fullName: e.target.value })}
                    className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#072146] mb-1">Email</label>
                  <input
                    type="email"
                    required
                    value={newMember.email}
                    onChange={(e) => setNewMember({ ...newMember, email: e.target.value })}
                    className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#072146] mb-1">Téléphone</label>
                  <input
                    type="text"
                    value={newMember.phone}
                    onChange={(e) => setNewMember({ ...newMember, phone: e.target.value })}
                    className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#072146] mb-1">Pays</label>
                  <input
                    type="text"
                    required
                    value={newMember.country}
                    onChange={(e) => setNewMember({ ...newMember, country: e.target.value })}
                    className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#072146] mb-1">
                    Mot de passe initial
                  </label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={newMember.password}
                    onChange={(e) => setNewMember({ ...newMember, password: e.target.value })}
                    className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#072146] mb-1">
                    Dotation initiale (€)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={newMember.initialBalance}
                    onChange={(e) =>
                      setNewMember({ ...newMember, initialBalance: e.target.value })
                    }
                    className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 font-mono text-sm"
                  />
                </div>
              </div>

              <div className="flex gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setAddMemberOpen(false)}
                  className="flex-1 rounded-xl border border-slate-300 py-3 text-xs font-bold text-slate-700"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={submittingAction}
                  className="flex-1 rounded-xl bg-[#0284FE] py-3 text-xs font-bold text-white hover:bg-[#072146]"
                >
                  {submittingAction ? 'Création...' : 'Créer le compte & RIB'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-[#04142C]/75 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 sm:p-8 shadow-2xl space-y-5">
            <h3 className="font-display text-xl font-bold text-[#072146]">
              Supprimer définitivement ce membre ?
            </h3>
            <p className="text-sm text-slate-600">
              Le compte de <strong>{deleteTarget.fullName}</strong> ({deleteTarget.memberCode}) sera
              clôturé et retiré de la base clients tout en préservant l’intégrité comptable de
              l’historique.
            </p>
            <div className="flex gap-2.5">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="flex-1 rounded-xl border border-slate-300 py-3 text-xs font-bold text-slate-700"
              >
                Conserver
              </button>
              <button
                type="button"
                disabled={submittingAction}
                onClick={handleConfirmDeleteMember}
                className="flex-1 rounded-xl bg-rose-600 py-3 text-xs font-bold text-white hover:bg-rose-700"
              >
                Supprimer le compte
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
