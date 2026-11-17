import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';

type Pending = { id: string; userId: string; name: string; phone: string; code: string; expiresAt: string; attempts: number; createdAt: string };

export function AdminPhoneVerifications() {
  const [items, setItems] = useState<Pending[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const refresh = useCallback(async () => {
    setBusy(true); setError('');
    try { setItems(await api.get<Pending[]>('/api/admin/phone-verifications')); }
    catch (e) { setError((e as Error).message || 'Could not load pending verifications'); }
    finally { setBusy(false); }
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);
  return <section className="rounded-2xl border border-gold-700/50 bg-cardbg p-4 sm:p-5">
    <div className="mb-4 flex items-center justify-between gap-3">
      <div><h2 className="text-lg font-bold text-gold-300">Phone verification</h2><p className="text-xs text-gold-500">Call the player and read the code aloud. Codes expire after 5 minutes.</p></div>
      <button type="button" onClick={() => void refresh()} disabled={busy} className="rounded-lg border border-gold-700 px-3 py-2 text-sm text-gold-300 disabled:opacity-50">{busy ? 'Loading…' : 'Refresh'}</button>
    </div>
    {error && <p role="alert" className="mb-3 text-sm text-red-300">{error}</p>}
    {items.length === 0 && !busy ? <p className="text-sm text-gold-500">No pending phone verification requests.</p> : <div className="space-y-3">
      {items.map(item => <article key={item.id} className="rounded-xl border border-gold-700/40 bg-black/20 p-3">
        <div className="flex flex-wrap items-center justify-between gap-2"><strong className="text-gold-200">{item.name}</strong><span className="font-mono text-sm text-gold-400">{item.phone}</span></div>
        <p className="mt-3 text-xs text-gold-500">Verification code</p>
        <p className="font-mono text-3xl font-black tracking-[0.35em] text-gold-300">{item.code}</p>
        <p className="mt-2 text-xs text-gold-500">Attempts: {item.attempts}/5 · Expires: {new Date(item.expiresAt).toLocaleTimeString()}</p>
      </article>)}
    </div>}
  </section>;
}
