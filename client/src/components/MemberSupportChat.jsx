import { useEffect, useRef, useState } from 'react';
import {
  Check,
  Copy,
  Headphones,
  KeyRound,
  Send,
  ShieldCheck,
} from 'lucide-react';
import { apiRequest } from '../api/client';
import { extractSecurityCode, formatDateTime } from '../utils/format';

export default function MemberSupportChat({
  messages = [],
  activeExternalTransfers = [],
  onRefresh,
  onUseCode,
}) {
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [copiedId, setCopiedId] = useState(null);
  const bottomRef = useRef(null);

  useEffect(() => {
    apiRequest('/member/messages').catch(() => undefined);
    const interval = setInterval(() => {
      onRefresh(true);
    }, 4000);
    return () => clearInterval(interval);
  }, [onRefresh]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    setSending(true);
    try {
      await apiRequest('/member/messages', {
        method: 'POST',
        body: {
          content: text.trim(),
          txReference: activeExternalTransfers[0]?.reference || '',
        },
      });
      setText('');
      await onRefresh(true);
    } finally {
      setSending(false);
    }
  };

  const sendQuickRequest = async (promptText) => {
    setSending(true);
    try {
      await apiRequest('/member/messages', {
        method: 'POST',
        body: {
          content: promptText,
          txReference: activeExternalTransfers[0]?.reference || '',
        },
      });
      await onRefresh(true);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="rounded-3xl bg-white shadow-bbva border border-slate-200/80 overflow-hidden flex flex-col h-[640px]">
      <div className="bg-gradient-to-r from-[#072146] via-[#092C5E] to-[#04142C] text-white px-6 py-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-2xl bg-[#2DCCCD]/20 border border-[#2DCCCD]/40 flex items-center justify-center text-[#2DCCCD]">
            <Headphones className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-display text-base sm:text-lg font-bold">
              Messagerie d’Assistance Privée MONERA
            </h2>
            <p className="text-xs text-cyan-200 flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              Ligne directe chiffrée avec l’Administration • Délivrance des codes de virement
            </p>
          </div>
        </div>

        <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-slate-200">
          <ShieldCheck className="h-4 w-4 text-[#2DCCCD]" />
          Synchronisation temps réel
        </span>
      </div>

      {activeExternalTransfers.length > 0 && (
        <div className="bg-amber-50 border-b border-amber-200 px-6 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs text-amber-950">
          <span>
            Virement externe actif <strong>{activeExternalTransfers[0].reference}</strong> bloqué à{' '}
            <strong>{activeExternalTransfers[0].progressPercent}%</strong> :
          </span>
          <button
            type="button"
            disabled={sending}
            onClick={() =>
              sendQuickRequest(
                `Bonjour, pouvez-vous me transmettre le code de validation pour mon virement ${activeExternalTransfers[0].reference} actuellement bloqué à ${activeExternalTransfers[0].progressPercent}% ?`
              )
            }
            className="rounded-lg bg-[#072146] px-3 py-1 font-bold text-white hover:bg-[#0284FE] transition"
          >
            Demander mon code maintenant
          </button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-[#F4F7FB]/60">
        {messages.map((msg) => {
          const isMember = msg.senderRole === 'member';
          const detectedCode = extractSecurityCode(msg);

          return (
            <div
              key={msg.id}
              className={`flex flex-col ${isMember ? 'items-end' : 'items-start'}`}
            >
              <div
                className={`max-w-[85%] sm:max-w-[72%] rounded-2xl px-4 py-3 shadow-sm ${
                  isMember
                    ? 'bg-[#0284FE] text-white rounded-br-sm'
                    : 'bg-white text-slate-800 border border-slate-200/90 rounded-bl-sm'
                }`}
              >
                <div className="text-[10px] font-bold uppercase tracking-wider opacity-75 mb-1">
                  {isMember ? 'Vous' : 'Conseiller & Administration MONERA'}
                </div>

                <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>

                {detectedCode && !isMember && (
                  <div className="mt-3 rounded-xl bg-[#072146] text-white p-3 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <KeyRound className="h-4 w-4 text-[#2DCCCD] shrink-0" />
                      <span className="font-mono text-sm font-extrabold tracking-widest text-[#F0D384]">
                        {detectedCode}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(detectedCode);
                          setCopiedId(msg.id);
                          setTimeout(() => setCopiedId(null), 2000);
                        }}
                        className="inline-flex items-center gap-1 rounded-lg bg-white/15 px-2.5 py-1 text-xs font-bold text-white hover:bg-white/25"
                      >
                        {copiedId === msg.id ? (
                          <Check className="h-3.5 w-3.5 text-emerald-400" />
                        ) : (
                          <Copy className="h-3.5 w-3.5" />
                        )}
                        <span>{copiedId === msg.id ? 'Copié !' : 'Copier le code'}</span>
                      </button>

                      {onUseCode && (
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(detectedCode);
                            onUseCode(detectedCode);
                          }}
                          className="rounded-lg bg-[#2DCCCD] px-2.5 py-1 text-xs font-extrabold text-[#04142C] hover:bg-white"
                        >
                          Aller valider →
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <span className="mt-1 text-[11px] text-slate-400">
                {formatDateTime(msg.createdAt)}
              </span>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={handleSend} className="bg-white border-t border-slate-200 p-4 flex gap-2.5">
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Écrivez à l’Administration MONERA ou demandez votre code de déblocage..."
          className="flex-1 rounded-xl border border-slate-300 px-4 py-3 text-sm focus:border-[#0284FE] focus:outline-none"
        />
        <button
          type="submit"
          disabled={sending || !text.trim()}
          className="inline-flex items-center gap-2 rounded-xl bg-[#072146] px-5 py-3 text-xs sm:text-sm font-bold text-white hover:bg-[#0284FE] transition disabled:opacity-50"
        >
          <Send className="h-4 w-4" />
          <span>Envoyer</span>
        </button>
      </form>
    </div>
  );
}
