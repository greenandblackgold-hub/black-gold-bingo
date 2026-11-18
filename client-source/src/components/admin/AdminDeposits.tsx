import { useCallback, useEffect, useState } from 'react';
import { translations, formatAmount, formatDateTime } from '@/lib/localization';
import { useLanguage } from '@/context/LanguageContext';
import { api, ApiError } from '@/lib/api';

const TEXT = translations.adminDeposits;

interface DepositRow {
  id: string;
  reference: string;
  rawMessage?: string;
  provider?: string;
  userId: string;
  userName: string;
  userPhone: string;
  amount: number;
  status: string;
  at: number;
}

export function AdminDeposits() {
  const { lang } = useLanguage();
  const t = TEXT[lang] ?? TEXT.en;
  const [rows, setRows] = useState<DepositRow[]>([]);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const result = await api.get<DepositRow[]>('/api/admin/deposits?status=pending');
      setRows(result);
      setError('');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t.error);
    }
  }, [t.error]);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), 15000);
    return () => window.clearInterval(timer);
  }, [load]);

  const act = async (row: DepositRow, action: 'approve' | 'reject' | 'test-approve') => {
    if (action === 'approve' && !window.confirm(t.confirm)) return;
    if (action === 'test-approve' && !window.confirm(t.testConfirm)) return;
    setBusyId(row.id);
    setError('');
    try {
      await api.post(`/api/admin/deposits/${encodeURIComponent(row.reference)}/${action}`, {});
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t.error);
    } finally {
      setBusyId(null);
    }
  };

  const button = 'rounded-lg px-3 py-2 text-sm font-semibold ring-1 disabled:opacity-50';
  return (
    <section className="rounded-2xl bg-cardbg p-4 ring-1 ring-gold-700/50 sm:p-5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-lg font-bold text-gold-300">{t.title}</h2>
        <button type="button" onClick={() => void load()} className="text-sm text-gold-400 underline">{t.refresh}</button>
      </div>
      {error && <p role="alert" className="mb-3 text-sm text-red-300">{error}</p>}
      {rows.length === 0 ? (
        <p className="py-3 text-center text-sm text-gold-600">{t.empty}</p>
      ) : (
        <ul className="space-y-3">
          {rows.map((row) => (
            <li key={row.id} className="rounded-xl bg-white/[0.04] p-3">
              <div className="flex items-center justify-between gap-3">
                <span className="text-lg font-black tabular-nums text-gold-400">{formatAmount(lang, row.amount)} ETB</span>
                <span className="rounded-full bg-amber-500/15 px-2.5 py-1 text-xs text-amber-200">{t.pending}</span>
              </div>
              {/^TEST-/i.test(row.reference) && <p className="mt-2 rounded-lg bg-sky-500/10 px-3 py-2 text-xs font-bold text-sky-200">{t.testOnly}</p>}
              <dl className="mt-2 space-y-1 text-sm">
                <div><dt className="inline text-gold-600">{t.player}: </dt><dd className="inline text-gold-300">{row.userName} · {row.userPhone}</dd></div>
                <div><dt className="inline text-gold-600">{t.reference}: </dt><dd className="inline break-all font-mono text-gold-300">{row.reference}</dd></div>
                {row.provider && <div><dt className="inline text-gold-600">Provider: </dt><dd className="inline text-gold-300">{row.provider}</dd></div>}
                {row.rawMessage && <div className="mt-2"><dt className="mb-1 block text-gold-600">Full transaction SMS:</dt><dd className="whitespace-pre-wrap break-words rounded-lg bg-black/30 p-3 text-xs leading-relaxed text-gold-200">{row.rawMessage}</dd></div>}
                <div><dt className="inline text-gold-600">{t.sent}: </dt><dd className="inline text-gold-500">{formatDateTime(lang, row.at)}</dd></div>
              </dl>
              <div className="mt-3 flex flex-wrap gap-2">
                {/^TEST-/i.test(row.reference) ? (
                  <button type="button" disabled={busyId === row.id} onClick={() => void act(row, 'test-approve')} className={`${button} flex-1 bg-sky-500/20 text-sky-100 ring-sky-400/50`}>{t.testApprove}</button>
                ) : (
                  <button type="button" disabled={busyId === row.id} onClick={() => void act(row, 'approve')} className={`${button} flex-1 bg-gold-500 text-darkbg ring-gold-400`}>{t.approve}</button>
                )}
                <button type="button" disabled={busyId === row.id} onClick={() => void act(row, 'reject')} className={`${button} flex-1 text-gold-300 ring-gold-700/60`}>{t.reject}</button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
