import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';

type PendingReset = { userId: string; name: string; phone: string; code: string; expiresAt: number; attempts: number };

export function AdminPinResets() {
  const [rows, setRows] = useState<PendingReset[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setBusy(true);
    setError('');
    try { setRows(await api.get<PendingReset[]>('/api/admin/pin-resets')); }
    catch { setError('የPIN ማገገሚያ ጥያቄዎችን ማግኘት አልተቻለም።'); }
    finally { setBusy(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  return <section className="rounded-2xl bg-cardbg p-4 ring-1 ring-gold-500/40 sm:p-5">
    <div className="mb-4 flex items-center justify-between gap-3">
      <div><h2 className="text-lg font-bold text-gold-300">የPIN ማገገሚያ ጥያቄዎች</h2>
        <p className="text-xs text-gold-500">ተጫዋቹን በስልክ ያረጋግጡና ኮዱን ያንብቡለት።</p></div>
      <button type="button" onClick={() => void load()} disabled={busy} className="rounded-lg px-3 py-2 text-sm font-semibold text-gold-300 ring-1 ring-gold-600/50 disabled:opacity-50">{busy ? '…' : 'አድስ'}</button>
    </div>
    {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
    {!busy && !error && rows.length === 0 && <p className="text-sm text-gold-500">የሚጠባበቅ የPIN ማገገሚያ ጥያቄ የለም።</p>}
    <div className="space-y-3">{rows.map((row) => <article key={row.userId} className="rounded-xl bg-black/20 p-3 ring-1 ring-gold-700/30">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><p className="font-semibold text-gold-200">{row.name}</p><p className="text-sm text-gold-500">{row.phone}</p></div>
        <div className="text-right"><p className="font-mono text-2xl font-black tracking-[0.25em] text-gold-300">{row.code}</p><p className="text-xs text-gold-500">የቀሩ ሙከራዎች፦ {5-row.attempts}</p></div>
      </div>
      <p className="mt-2 text-xs text-gold-600">የሚያበቃበት፦ {new Date(row.expiresAt).toLocaleTimeString()}</p>
    </article>)}</div>
  </section>;
}
