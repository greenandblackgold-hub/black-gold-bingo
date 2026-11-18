import { useEffect, useState } from 'react';
import { translations, formatAmount, formatDateTime } from '@/lib/localization';
import { ApiError, api } from '@/lib/api';
import { useLanguage } from '@/context/LanguageContext';

type DepositRequest = {
  reference: string;
  amount: number;
  provider?: string;
  status: 'pending' | 'success' | 'failed' | 'amount_mismatch' | 'rejected';
  currency: 'ETB';
};

type DepositStatus = 'pending' | 'success' | 'failed' | 'amount_mismatch' | 'rejected' | 'test-approved' | 'unknown';

const copy = translations.smsDeposit;

const inputClass = 'w-full rounded-lg bg-white/[0.05] px-3 py-2.5 text-sm text-gold-300 placeholder:text-gold-700 ring-1 ring-gold-700/50 focus:outline-none focus:ring-2 focus:ring-gold-400';

export function SmsDepositPanel() {
  const { lang } = useLanguage();
  const t = copy[lang] ?? copy.en;
  const [provider, setProvider] = useState<'Telebirr' | 'CBE'>('Telebirr');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [request, setRequest] = useState<DepositRequest | null>(null);
  const [status, setStatus] = useState<DepositStatus | null>(null);

  const submit = async () => {
    if (message.trim().length < 20 || message.trim().length > 4000) {
      setError(t.messageInvalid);
      return;
    }
    setBusy(true);
    setError('');
    try {
      const created = await api.post<DepositRequest>('/api/simulation/deposits', {
        provider,
        message: message.trim(),
      });
      setRequest(created);
      setStatus('pending');
    } catch (e) {
      if (e instanceof ApiError && e.code === 'reference_used') setError(t.used);
      else if (e instanceof ApiError && e.code === 'invalid_sms_message') setError(t.messageInvalid);
      else if (e instanceof ApiError && e.code === 'invalid_amount') setError(t.invalid);
      else if (e instanceof ApiError && e.code === 'invalid_reference') setError(t.refInvalid);
      else setError(t.generic);
    } finally {
      setBusy(false);
    }
  };

  const refresh = async () => {
    if (!request) return;
    setBusy(true);
    setError('');
    try {
      const result = await api.get<{ status: DepositStatus }>(`/api/simulation/deposits/${encodeURIComponent(request.reference)}`);
      setStatus(result.status);
      if (result.status === 'success') window.location.reload();
    } catch {
      setError(t.generic);
    } finally {
      setBusy(false);
    }
  };

  const statusText = status === 'success' ? t.success
    : status === 'failed' ? t.failed
    : status === 'amount_mismatch' ? t.mismatch
    : status === 'rejected' ? t.rejected
    : status === 'test-approved' ? t.testApproved
    : status === 'pending' ? t.pending
    : t.unknown;

  return (
    <section className="rounded-xl border border-gold-600/30 bg-gradient-to-b from-white/[0.045] to-transparent p-3 shadow-[0_10px_28px_rgba(0,0,0,0.18)] sm:p-4" aria-labelledby="simulation-wallet-title">
      <h2 id="simulation-wallet-title" className="mb-3 text-base font-bold text-gold-300">{t.title}</h2>
      {!request ? (
        <div className="space-y-3">
          <div>
            <label htmlFor="simulation-deposit-provider" className="mb-1 block text-xs text-gold-500">{t.provider}</label>
            <select id="simulation-deposit-provider" className={inputClass} value={provider} onChange={(event) => setProvider(event.target.value as 'Telebirr' | 'CBE')} disabled={busy}>
              <option value="Telebirr">Telebirr</option><option value="CBE">Commercial Bank of Ethiopia</option>
            </select>
          </div>
          <div className="rounded-lg border border-gold-700/40 bg-black/25 p-3 text-xs">
            <p className="mb-2 font-semibold text-gold-300">{t.sendTo}</p>
            {provider === 'Telebirr' ? (
              <dl className="space-y-1">
                <div className="flex justify-between gap-3"><dt className="text-gold-600">{t.accountName}</dt><dd className="text-right text-gold-200">ኣሊክሳንደር ደጀን</dd></div>
                <div className="flex justify-between gap-3"><dt className="text-gold-600">{t.phoneNumber}</dt><dd className="font-mono text-gold-200">0978202822</dd></div>
              </dl>
            ) : (
              <dl className="space-y-1">
                <div className="flex justify-between gap-3"><dt className="text-gold-600">{t.accountName}</dt><dd className="text-right text-gold-200">ቤተሊሄም ፍጹም</dd></div>
                <div className="flex justify-between gap-3"><dt className="text-gold-600">{t.accountNumber}</dt><dd className="font-mono text-gold-200">1000737138686</dd></div>
              </dl>
            )}
          </div>
          <div>
            <label htmlFor="simulation-deposit-message" className="mb-1 block text-xs text-gold-500">{t.message}</label>
            <textarea id="simulation-deposit-message" className={`${inputClass} min-h-20 resize-y`} autoComplete="off" maxLength={4000} placeholder={t.messagePlaceholder} value={message} onChange={(event) => setMessage(event.target.value)} disabled={busy} />
            <p className="mt-1 text-[11px] leading-snug text-gold-700">{t.messageHelp}</p>
          </div>
          {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
          <button type="button" onClick={submit} disabled={busy} className="w-full rounded-lg bg-gradient-to-r from-gold-300 via-gold-500 to-gold-600 py-2.5 text-sm font-bold text-darkbg shadow-md shadow-gold-900/20 transition duration-200 hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-300 focus-visible:ring-offset-2 focus-visible:ring-offset-darkbg disabled:cursor-not-allowed disabled:opacity-50">
            {busy ? t.sending : t.submit}
          </button>
          <p className="text-[11px] leading-snug text-gold-600">{t.note}</p>
        </div>
      ) : (
        <div className="space-y-3">
          <dl className="space-y-2 rounded-xl bg-white/[0.04] p-4 text-sm">
            <div className="flex justify-between gap-3"><dt className="text-gold-500">{t.reference}</dt><dd className="break-all text-right font-semibold text-gold-300">{request.reference}</dd></div>
            <div className="flex justify-between"><dt className="text-gold-500">{t.amount}</dt><dd className="font-semibold tabular-nums text-gold-300">{formatAmount(lang, request.amount)}</dd></div>
          </dl>
          <p role="status" aria-live="polite" className="rounded-xl bg-white/[0.04] p-4 text-sm text-gold-300">{statusText}</p>
          {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
          {status !== 'success' && (
            <button type="button" onClick={refresh} disabled={busy} className="w-full rounded-xl bg-gradient-to-br from-gold-300 via-gold-500 to-gold-600 py-3.5 font-bold text-darkbg disabled:opacity-50">
              {busy ? t.sending : t.check}
            </button>
          )}
          <p className="text-[11px] leading-snug text-gold-600">{t.note}</p>
        </div>
      )}
    </section>
  );
}

type DepositHistoryRow = {
  reference: string;
  amount: number;
  status: DepositStatus;
  currency: 'ETB';
  at: number;
};

const historyCopy = translations.depositHistory;

export function SimulationDepositHistory() {
  const { lang } = useLanguage();
  const t = historyCopy[lang] ?? historyCopy.en;
  const [rows, setRows] = useState<DepositHistoryRow[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const result = await api.get<DepositHistoryRow[]>('/api/simulation/deposits');
        if (active) setRows(result);
      } catch {
        // Keep the last successfully loaded history visible during temporary network errors.
      } finally {
        if (active) setLoaded(true);
      }
    };
    void load();
    const timer = window.setInterval(() => void load(), 15_000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, []);

  const statusLabel = (status: DepositStatus) => status === 'pending' ? t.pending
    : status === 'success' ? t.success
    : status === 'rejected' ? t.rejected
    : status === 'test-approved' ? t.test
    : status === 'failed' ? t.failed
    : status === 'amount_mismatch' ? t.mismatch
    : t.unknown;

  return (
    <div className="mb-4 rounded-2xl border border-gold-700/35 bg-gradient-to-b from-white/[0.035] to-transparent p-4 sm:p-5">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-bold text-gold-300">{t.title}</h3>
        <span className="text-xs text-gold-700">{t.refresh}</span>
      </div>
      {!loaded && <p className="py-2 text-sm text-gold-600">…</p>}
      {loaded && rows.length === 0 && <p className="py-2 text-sm text-gold-600">{t.empty}</p>}
      {rows.length > 0 && (
        <ul className="divide-y divide-gold-700/30">
          {rows.map((row) => (
            <li key={row.reference} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <p className="break-all font-mono text-sm text-gold-300">{row.reference}</p>
                <p className="mt-1 text-xs text-gold-600">{formatDateTime(lang, row.at)}</p>
                <p className="mt-1 text-xs font-semibold text-gold-400">{statusLabel(row.status)}</p>
              </div>
              <p className="shrink-0 font-bold tabular-nums text-gold-300">{formatAmount(lang, row.amount)} ETB</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
