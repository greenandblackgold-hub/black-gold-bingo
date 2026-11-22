import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';

type KenoBet = { id: string; status: string; stakeEtb: number; selectedNumbers: number[]; matchedNumbers: number[]; hits: number; payoutEtb: number; createdAt: number; settledAt?: number | null };
type KenoState = { game: 'keno'; roundId: string; status: 'betting' | 'settled'; bettingEndsAt: number; serverTime: number; serverSeedHash: string; drawnNumbers?: number[]; serverSeed?: string; myBets: KenoBet[]; minBetEtb: number; maxBetEtb: number; mode: string };
type HistoryRound = { roundId: string; status: string; drawnNumbers?: number[]; serverSeedHash: string; serverSeed?: string; myBets: KenoBet[] };

const money = (n: number) => Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const requestId = () => 'keno_' + Date.now() + '_' + Math.random().toString(36).slice(2, 10);

export function KenoGame({ onBack }: { onBack: () => void }) {
  const { user, refresh } = useAuth();
  const [state, setState] = useState<KenoState | null>(null);
  const [history, setHistory] = useState<HistoryRound[]>([]);
  const [selected, setSelected] = useState<number[]>([]);
  const [amount, setAmount] = useState('10.00');
  const [clock, setClock] = useState(Date.now());
  const [offset, setOffset] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const loadState = useCallback(async () => {
    try {
      const next = await api.get<KenoState>('/api/games/keno/state');
      setState(next);
      setOffset(next.serverTime - Date.now());
      setError('');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not load Keno right now.');
    }
  }, []);
  const loadHistory = useCallback(async () => {
    try { setHistory(await api.get<HistoryRound[]>('/api/games/keno/history?limit=8')); } catch { /* history is optional */ }
  }, []);

  useEffect(() => {
    void loadState(); void loadHistory();
    const poll = window.setInterval(() => void loadState(), 1200);
    const tick = window.setInterval(() => setClock(Date.now()), 200);
    return () => { window.clearInterval(poll); window.clearInterval(tick); };
  }, [loadState, loadHistory]);

  useEffect(() => {
    if (state?.status === 'settled') void loadHistory();
  }, [state?.status, state?.roundId, loadHistory]);

  const secondsLeft = state?.status === 'betting' ? Math.max(0, Math.ceil((state.bettingEndsAt - (clock + offset)) / 1000)) : 0;
  const toggle = (n: number) => setSelected((old) => old.includes(n) ? old.filter((v) => v !== n) : old.length >= 10 ? old : [...old, n].sort((a, b) => a - b));
  const quickPick = () => {
    const pool = Array.from({ length: 80 }, (_, i) => i + 1);
    for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
    setSelected(pool.slice(0, 10).sort((a, b) => a - b));
  };
  const submit = async () => {
    setBusy(true); setError(''); setNotice('');
    try {
      await api.post('/api/games/keno/bets', { requestId: requestId(), amount: Number(amount), selectedNumbers: selected });
      setNotice('Your Keno entry is confirmed.');
      setSelected([]);
      await Promise.all([loadState(), loadHistory(), refresh()]);
    } catch (e) { setError(e instanceof ApiError ? e.message : 'Your Keno entry could not be placed.'); }
    finally { setBusy(false); }
  };

  const latestBet = state?.myBets?.[0];
  const drawSet = useMemo(() => new Set(state?.drawnNumbers ?? []), [state?.drawnNumbers]);
  const isBetting = state?.status === 'betting' && secondsLeft > 0;

  return (
    <div className="mx-auto w-full max-w-5xl space-y-5 pb-8">
      <div className="flex items-center justify-between gap-3"><button onClick={onBack} className="rounded-xl border border-amber-400/25 px-3 py-2 text-sm font-bold text-amber-200">← Games Center</button><span className="rounded-full border border-amber-400/25 bg-amber-400/5 px-3 py-1.5 text-[10px] font-bold tracking-widest text-amber-300">SIMULATION ONLY</span></div>
      <header className="rounded-3xl border border-amber-400/25 bg-[radial-gradient(ellipse_at_top_right,rgba(202,158,57,.2),transparent_45%),linear-gradient(135deg,#17140c,#080808)] p-5 sm:p-7">
        <p className="text-[10px] font-black uppercase tracking-[.3em] text-amber-400">BLACK GOLD · NUMBER GAME</p><div className="mt-2 flex flex-wrap items-end justify-between gap-3"><div><h1 className="text-3xl font-black text-amber-50 sm:text-4xl">KENO</h1><p className="mt-2 text-sm text-amber-100/60">Pick 1–10 numbers from 1 to 80. Twenty numbers are drawn each round.</p></div><div className="text-right"><p className="text-[10px] uppercase tracking-wider text-amber-500">Available demo balance</p><p className="text-xl font-black text-amber-200">{money(user?.balance ?? 0)} ETB</p></div></div>
      </header>
      {error && <p role="alert" className="rounded-xl border border-red-500/30 bg-red-950/40 p-3 text-sm text-red-200">{error}</p>}
      {notice && <p role="status" className="rounded-xl border border-emerald-500/30 bg-emerald-950/30 p-3 text-sm text-emerald-200">{notice}</p>}
      <section className="rounded-2xl border border-amber-400/20 bg-[#0c0c0a] p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-[10px] uppercase tracking-[.2em] text-amber-500">Current round</p><p className="mt-1 font-mono text-sm text-amber-100">{state?.roundId ?? 'Connecting…'}</p></div><div className="text-right"><p className="text-[10px] uppercase tracking-[.2em] text-amber-500">Betting closes in</p><p className="text-2xl font-black tabular-nums text-amber-300">{isBetting ? secondsLeft + 's' : state?.status === 'settled' ? 'DRAW COMPLETE' : 'WAITING'}</p></div></div>
        <div className="mt-4 grid grid-cols-8 gap-1.5 sm:grid-cols-10 sm:gap-2">
          {Array.from({ length: 80 }, (_, i) => i + 1).map((n) => {
            const chosen = selected.includes(n), drawn = drawSet.has(n);
            return <button key={n} type="button" disabled={!isBetting || !!drawSet.size} onClick={() => toggle(n)} aria-pressed={chosen} className={`aspect-square rounded-lg border text-xs font-black tabular-nums transition sm:text-sm ${drawn ? 'border-emerald-300 bg-emerald-400 text-black' : chosen ? 'border-amber-200 bg-gradient-to-br from-amber-200 to-amber-500 text-black shadow-[0_0_14px_rgba(245,190,60,.28)]' : 'border-amber-500/20 bg-black text-amber-100/70 hover:border-amber-300/60'} disabled:cursor-not-allowed disabled:opacity-75`}>{n}</button>;
          })}
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2"><p className="text-xs text-amber-100/55">{selected.length}/10 numbers selected</p><div className="flex gap-2"><button disabled={!isBetting} onClick={quickPick} className="rounded-lg border border-amber-300/30 px-3 py-2 text-xs font-bold text-amber-200 disabled:opacity-40">Quick Pick</button><button disabled={!isBetting} onClick={() => setSelected([])} className="rounded-lg border border-white/10 px-3 py-2 text-xs font-bold text-amber-100/60 disabled:opacity-40">Clear</button></div></div>
      </section>
      <section className="grid gap-4 md:grid-cols-[1fr_1.2fr]">
        <div className="rounded-2xl border border-amber-400/20 bg-[#0c0c0a] p-4 sm:p-5">
          <h2 className="font-bold text-amber-100">Your entry</h2><label className="mt-4 block text-xs text-amber-100/60">Stake (ETB)</label><input type="number" min={state?.minBetEtb ?? 5} max={state?.maxBetEtb ?? 1000} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} className="mt-2 w-full rounded-xl border border-amber-400/25 bg-black px-3 py-3 text-lg font-bold text-amber-100 outline-none focus:border-amber-300"/>
          <p className="mt-2 text-[11px] text-amber-100/45">Allowed: {money(state?.minBetEtb ?? 5)}–{money(state?.maxBetEtb ?? 1000)} ETB · demo credits only</p>
          <button disabled={!isBetting || !selected.length || busy} onClick={() => void submit()} className="mt-4 w-full rounded-xl bg-gradient-to-r from-amber-200 via-yellow-400 to-amber-600 px-4 py-3 font-black text-black shadow-lg disabled:cursor-not-allowed disabled:opacity-40">{busy ? 'Confirming…' : 'Place Keno Entry'}</button>
        </div>
        <div className="rounded-2xl border border-amber-400/20 bg-[#0c0c0a] p-4 sm:p-5"><h2 className="font-bold text-amber-100">Draw results</h2><p className="mt-1 text-xs text-amber-100/50">20 numbers · server-seeded draw</p>
          {state?.drawnNumbers ? <div className="mt-4 grid grid-cols-5 gap-2 sm:grid-cols-10">{state.drawnNumbers.map((n) => <span key={n} className="grid aspect-square place-items-center rounded-full border border-emerald-300/50 bg-emerald-400 font-black text-black">{n}</span>)}</div> : <p className="mt-5 rounded-xl border border-dashed border-amber-400/20 p-6 text-center text-sm text-amber-100/40">The draw will appear here when betting closes.</p>}
          {latestBet && state?.status === 'settled' && <div className="mt-4 rounded-xl bg-black/60 p-3"><p className="text-xs text-amber-100/50">Your latest entry · {latestBet.hits} matches</p><p className="mt-1 text-xl font-black text-amber-200">Payout {money(latestBet.payoutEtb)} ETB</p><p className="mt-1 text-xs text-amber-100/55">{latestBet.matchedNumbers?.join(', ') || 'No matches'}</p></div>}
        </div>
      </section>
      {state?.serverSeedHash && <details className="rounded-xl border border-amber-400/15 bg-black/40 p-3 text-xs text-amber-100/55"><summary className="cursor-pointer font-bold text-amber-300">Fairness verification · seed committed before betting</summary><p className="mt-2 break-all">SHA-256 commitment: {state.serverSeedHash}</p>{state.serverSeed ? <><p className="mt-1 break-all">Revealed seed: {state.serverSeed}</p><p className="mt-2">The 20-number draw is reproducible from this seed using the published HMAC-SHA256 shuffle.</p></> : <p className="mt-2">The secret seed will be revealed after the draw is settled.</p>}</details>}
      <section className="rounded-2xl border border-amber-400/15 bg-[#0b0b09] p-4"><h2 className="font-bold text-amber-100">Recent rounds</h2><div className="mt-3 space-y-2">{history.length ? history.map((round) => <div key={round.roundId} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-white/[.03] p-3"><div><p className="font-mono text-xs text-amber-200">{round.roundId}</p><p className="mt-1 text-[11px] text-amber-100/45">{round.drawnNumbers?.slice(0, 10).join(' · ') || 'Awaiting draw'}</p></div><span className="text-xs font-bold text-amber-400">{round.myBets.length ? money(round.myBets.reduce((s, b) => s + b.payoutEtb, 0)) + ' ETB returned' : round.status}</span></div>) : <p className="text-sm text-amber-100/40">No completed rounds yet.</p>}</div></section>
    </div>
  );
}
