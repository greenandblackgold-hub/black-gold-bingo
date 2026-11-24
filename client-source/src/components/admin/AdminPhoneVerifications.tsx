import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useLanguage } from '@/context/LanguageContext';
import { adminSimpleLocale } from '@/lib/adminSimpleLocalization';

type PendingPhone = { userId: string; name: string; phone: string; code: string; expiresAt: number; attempts: number };

export function AdminPhoneVerifications() {
  const { lang } = useLanguage();
  const t = (key: string) => adminSimpleLocale('phone', lang, key);
  const [rows, setRows] = useState<PendingPhone[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setBusy(true);
    setError('');
    try { setRows(await api.get<PendingPhone[]>('/api/admin/phone-verifications')); }
    catch { setError(t('error')); }
    finally { setBusy(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  return <section className="rounded-2xl bg-cardbg p-4 ring-1 ring-gold-500/40 sm:p-5">
    <div className="mb-4 flex items-center justify-between gap-3">
      <div><h2 className="text-lg font-bold text-gold-300"{t('title')}</h2>
        <p className="text-xs text-gold-500"{t('hint')}</p></div>
      <button type="button" onClick={() => void load()} disabled={busy} className="rounded-lg px-3 py-2 text-sm font-semibold text-gold-300 ring-1 ring-gold-600/50 disabled:opacity-50">{busy ? '…' : t('refresh')}</button>
    </div>
    {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
    {!busy && !error && rows.length === 0 && <p className="text-sm text-gold-500"{t('empty')}</p>}
    <div className="space-y-3">{rows.map((row) => <article key={row.userId} className="rounded-xl bg-black/20 p-3 ring-1 ring-gold-700/30">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><p className="font-semibold text-gold-200">{row.name}</p><p className="text-sm text-gold-500">{row.phone}</p></div>
        <div className="text-right"><p className="font-mono text-2xl font-black tracking-[0.25em] text-gold-300">{row.code}</p><p className="text-xs text-gold-500">{t('attempts')}: {5-row.attempts}</p></div>
      </div>
      <p className="mt-2 text-xs text-gold-600">{t('expires')}: {new Date(row.expiresAt).toLocaleTimeString(lang === 'am' ? 'am-ET' : lang === 'ti' ? 'ti-ER' : 'en-ET')}</p>
    </article>)}</div>
  </section>;
}
