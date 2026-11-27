import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';

type Overview = {
  settings: { enabled: boolean; target: number; ticketPriceEtb: number; drawIntervalSeconds: number; maxTicketsPerPlayer: number };
  game: null | { id: string; status: string; target: number; drawnNumbers: number[]; ticketCount: number; winner?: { userId: string; ticketId: string } };
  tickets: Array<{ id: string; userId: string; status: string }>;
};
export function AdminTurboBingo() {
  const [data, setData] = useState<Overview | null>(null);
  const [enabled, setEnabled] = useState(true);
  const [target, setTarget] = useState('10');
  const [price, setPrice] = useState('1.00');
  const [interval, setInterval] = useState('2');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const load = useCallback(async () => {
    const next = await api.get<Overview>('/api/admin/turbo-bingo/overview');
    setData(next); setEnabled(next.settings.enabled); setTarget(String(next.settings.target));
    setPrice(String(next.settings.ticketPriceEtb)); setInterval(String(next.settings.drawIntervalSeconds));
  }, []);
  useEffect(() => {
    let active = true;
    void load().catch((e) => { if (active) setError(e instanceof Error ? e.message : 'Unable to load settings.'); });
    const poll = window.setInterval(() => {
      void api.get<Overview>('/api/admin/turbo-bingo/overview').then((next) => { if (active) setData(next); }).catch(() => undefined);
    }, 1000);
    return () => { active = false; window.clearInterval(poll); };
  }, [load]);
  const action = async (path: string, body: unknown = {}) => {
    setBusy(true); setError(''); setNotice('');
    try { await api.post(path, body); await load(); setNotice('Saved successfully.'); }
    catch (e) { setError(e instanceof Error ? e.message : 'Action failed.'); }
    finally { setBusy(false); }
  };
  const save = () => void action('/api/admin/turbo-bingo/settings', {
    enabled, target: Number(target), ticketPriceEtb: Number(price), drawIntervalSeconds: Number(interval),
  });
  const game = data?.game;
  return (
    <section className="space-y-4 rounded-2xl border border-amber-400/30 bg-[#090907] p-4 sm:p-5">
      <header><p className="text-[10px] font-black uppercase tracking-[.25em] text-amber-500">NEW GAME MODULE · 06</p><h2 className="mt-1 text-xl font-black text-amber-100">TURBO BINGO · ትርቦ ቢንጎ</h2><p className="mt-1 text-xs text-amber-100/50">Exact Target · 1–80 · One winner target · Simulation credits only</p></header>
      {error && <p role="alert" className="rounded-lg bg-red-950/40 p-3 text-sm text-red-200">{error}</p>}
      {notice && <p role="status" className="rounded-lg bg-emerald-950/30 p-3 text-sm text-emerald-200">{notice}</p>}
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex items-center justify-between rounded-xl border border-amber-200/15 bg-black/40 p-3 text-sm font-bold text-amber-100">Enable Turbo Bingo<input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} className="h-5 w-5 accent-amber-400" /></label>
        <label className="rounded-xl border border-amber-200/15 bg-black/40 p-3"><span className="block text-xs text-amber-300">Winning Target (1–25)</span><input type="number" min="1" max="25" value={target} onChange={(e) => setTarget(e.target.value)} className="mt-1 w-full bg-transparent text-lg font-black text-amber-100 outline-none" /></label>
        <label className="rounded-xl border border-amber-200/15 bg-black/40 p-3"><span className="block text-xs text-amber-300">Ticket Price (ETB)</span><input type="number" min="0.1" max="1000" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} className="mt-1 w-full bg-transparent text-lg font-black text-amber-100 outline-none" /></label>
        <label className="rounded-xl border border-amber-200/15 bg-black/40 p-3"><span className="block text-xs text-amber-300">Draw Interval (seconds)</span><input type="number" min="1" max="30" value={interval} onChange={(e) => setInterval(e.target.value)} className="mt-1 w-full bg-transparent text-lg font-black text-amber-100 outline-none" /></label>
      </div>
      <button type="button" disabled={busy} onClick={save} className="w-full rounded-xl bg-amber-300 px-4 py-3 font-black text-black disabled:opacity-50">SAVE TURBO BINGO SETTINGS</button>
      <div className="rounded-xl border border-amber-200/15 bg-black/40 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-black text-amber-100">CURRENT GAME</h3><span className="rounded-full bg-amber-300/10 px-3 py-1 text-[10px] font-black uppercase text-amber-300">{game?.status ?? 'NOT OPEN'}</span></div>
        <div className="mt-3 grid grid-cols-3 gap-2 text-center">
          <Metric label="Target" value={String(game?.target ?? target)} /><Metric label="Tickets" value={String(game?.ticketCount ?? 0)} /><Metric label="Called" value={String(game?.drawnNumbers.length ?? 0)} />
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" disabled={busy || !enabled || (game != null && game.status !== 'ended')} onClick={() => void action('/api/admin/turbo-bingo/open')} className="flex-1 rounded-lg border border-amber-300/40 px-3 py-3 text-xs font-black text-amber-200 disabled:opacity-30">OPEN TICKET SALES</button>
          <button type="button" disabled={busy || !enabled || game?.status !== 'waiting' || !game.ticketCount} onClick={() => void action('/api/admin/turbo-bingo/start')} className="flex-1 rounded-lg bg-emerald-400 px-3 py-3 text-xs font-black text-black disabled:opacity-30">START DRAW</button>
          <button type="button" disabled={busy || game?.status !== 'running'} onClick={() => void action('/api/admin/turbo-bingo/stop')} className="flex-1 rounded-lg border border-red-400/40 px-3 py-3 text-xs font-black text-red-200 disabled:opacity-30">STOP GAME</button>
        </div>
        {game?.drawnNumbers?.length ? <p className="mt-3 text-xs leading-6 text-amber-100/60">Drawn: {game.drawnNumbers.join(' · ')}</p> : null}
      </div>
      <p className="text-[10px] leading-5 text-amber-100/40">The server draws unique numbers and validates the exact target. A card is locked if the next number is called before its valid BINGO claim. All ticket purchases use the separate non-withdrawable demo wallet; no existing Bingo wallet or payment flow is modified.</p>
    </section>
  );
}
function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg bg-white/[.04] p-2"><p className="text-[9px] uppercase text-amber-400/60">{label}</p><p className="mt-1 text-lg font-black text-amber-100">{value}</p></div>;
}
