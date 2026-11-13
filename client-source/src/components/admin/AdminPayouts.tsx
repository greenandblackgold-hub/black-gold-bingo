import { useCallback, useEffect, useState } from 'react';
import { useLanguage } from '@/context/LanguageContext';
import { api, ApiError } from '@/lib/api';

const TEXT = {
  am: { title: 'የገንዘብ ማውጫ ጥያቄዎች', empty: 'ምንም ጥያቄ የለም', approve: 'ላክ', reject: 'ውድቅ', refresh: 'ሁኔታ አድስ', reload: 'አድስ', stats: 'ማጠቃለያ', users: 'ተጫዋቾች', cards: 'የዚህ ዙር ካርዶች', pot: 'ድምር (ብር)', pending: 'በመጠባበቅ ላይ', processing: 'በመላክ ላይ', err: 'አልተሳካም' },
  ti: { title: 'ሕቶታት ምውጻእ ገንዘብ', empty: 'ዝኾነ ሕቶ የለን', approve: 'ስደድ', reject: 'ንጸግ', refresh: 'ኩነታት ኣሐድስ', reload: 'ኣሐድስ', stats: 'ጸብጻብ', users: 'ተጻዋቲ', cards: 'ካርዳት እዚ ዙር', pot: 'ድምር (ብር)', pending: 'ይጽበ ኣሎ', processing: 'ይለኣኽ ኣሎ', err: 'ኣይተዓወተን' },
  en: { title: 'Cash-out requests', empty: 'No requests', approve: 'Pay', reject: 'Reject', refresh: 'Check status', reload: 'Reload', stats: 'Overview', users: 'Players', cards: 'Cards this round', pot: 'Pot (ETB)', pending: 'Pending', processing: 'Sending', err: 'Failed' },
} as const;

interface Row {
  id: string;
  amount: number;
  status: 'pending' | 'processing' | 'paid' | 'rejected' | 'failed';
  accountName: string;
  accountNumber: string;
  bankCode: string;
  note: string;
}
interface Stats {
  users: number;
  cardsThisRound: number;
  pot: number;
}

export function AdminPayouts() {
  const { lang } = useLanguage();
  const t = TEXT[lang];
  const [rows, setRows] = useState<Row[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [p, q, s] = await Promise.all([
        api.get<Row[]>('/api/admin/withdrawals?status=pending'),
        api.get<Row[]>('/api/admin/withdrawals?status=processing'),
        api.get<Stats>('/api/admin/stats'),
      ]);
      setRows([...p, ...q]);
      setStats(s);
    } catch {
      setError(t.err);
    }
  }, [t.err]);
  useEffect(() => {
    void load();
    const id = setInterval(() => void load(), 15000);
    return () => clearInterval(id);
  }, [load]);

  const act = async (id: string, action: 'approve' | 'reject' | 'refresh') => {
    setError(null);
    try {
      await api.post(`/api/admin/withdrawals/${id}/${action}`, {});
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t.err);
    }
    await load();
  };

  const btn = 'rounded-lg px-3.5 py-2 text-sm font-semibold ring-1 active:scale-95';
  return (
    <div className="space-y-5">
      {stats && (
        <section className="grid grid-cols-3 gap-2 rounded-2xl bg-cardbg p-4 text-center ring-1 ring-gold-700/50">
          <div><p className="text-2xl font-black tabular-nums text-gold-400">{stats.users}</p><p className="text-xs text-gold-500">{t.users}</p></div>
          <div><p className="text-2xl font-black tabular-nums text-gold-400">{stats.cardsThisRound}</p><p className="text-xs text-gold-500">{t.cards}</p></div>
          <div><p className="text-2xl font-black tabular-nums text-gold-400">{(stats.pot / 100).toFixed(0)}</p><p className="text-xs text-gold-500">{t.pot}</p></div>
        </section>
      )}
      <section className="rounded-2xl bg-cardbg p-4 ring-1 ring-gold-700/50 sm:p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold text-gold-300">{t.title}</h2>
          <button type="button" onClick={() => void load()} className="text-sm font-medium text-gold-400 underline underline-offset-4">{t.reload}</button>
        </div>
        {error && <p role="alert" className="mb-2 text-sm text-red-300">{error}</p>}
        {rows.length === 0 ? (
          <p className="py-3 text-center text-sm text-gold-700">{t.empty}</p>
        ) : (
          <ul className="space-y-2">
            {rows.map((w) => (
              <li key={w.id} className="rounded-xl bg-white/[0.04] p-3">
                <div className="flex items-baseline justify-between">
                  <span className="text-lg font-black tabular-nums text-gold-400">{w.amount.toFixed(2)} ETB</span>
                  <span className="text-xs text-gold-500">{w.status === 'pending' ? t.pending : t.processing}</span>
                </div>
                <p className="mt-1 text-sm text-gold-300">{w.accountName} · {w.accountNumber} · bank {w.bankCode}</p>
                {w.note && <p className="mt-1 text-xs text-red-300">{w.note}</p>}
                <div className="mt-2 flex gap-2">
                  {w.status === 'pending' ? (
                    <>
                      <button type="button" onClick={() => void act(w.id, 'approve')} className={`${btn} flex-1 bg-gold-500 text-darkbg ring-gold-400`}>{t.approve}</button>
                      <button type="button" onClick={() => void act(w.id, 'reject')} className={`${btn} flex-1 text-gold-300 ring-gold-700/60`}>{t.reject}</button>
                    </>
                  ) : (
                    <button type="button" onClick={() => void act(w.id, 'refresh')} className={`${btn} flex-1 text-gold-300 ring-gold-700/60`}>{t.refresh}</button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
