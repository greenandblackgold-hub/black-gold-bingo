import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';

type Ticket = { id: string; numbers: number[]; matchedNumbers: number[]; status: 'active' | 'locked' | 'winner'; lockedAt: number | null };
type State = {
  settings: { enabled: boolean; target: number; ticketPriceEtb: number; drawIntervalSeconds: number; maxTicketsPerPlayer: number };
  game: null | { id: string; status: 'waiting' | 'running' | 'ended'; target: number; drawnNumbers: number[]; lastNumber: number | null; winner: { userId: string; ticketId: string; at: number } | null; ticketCount: number };
  tickets: Ticket[];
  balanceEtb: number | null;
  balanceType: 'SIMULATION_ONLY';
};
const money = (value: number) => value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function TurboBingoGame({ onBack }: { onBack: () => void }) {
  const [state, setState] = useState<State | null>(null);
  const [count, setCount] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const refresh = useCallback(async () => {
    try { setState(await api.get<State>('/api/games/turbo-bingo/state')); setError(''); }
    catch (e) { setError(e instanceof Error ? e.message : 'Unable to load Turbo Bingo.'); }
  }, []);
  useEffect(() => {
    void refresh();
    const poll = window.setInterval(() => void refresh(), 5000);
    const stream = new EventSource('/api/stream');
    stream.addEventListener('turbo-bingo', () => void refresh());
    return () => { window.clearInterval(poll); stream.close(); };
  }, [refresh]);
  const drawn = useMemo(() => new Set(state?.game?.drawnNumbers ?? []), [state?.game?.drawnNumbers]);
  const buy = async () => {
    setBusy(true); setError(''); setNotice('');
    try {
      await api.post('/api/games/turbo-bingo/tickets', { count });
      setNotice('ካርቴላዎችህ ተመዝግበዋል። Tickets registered successfully.');
      await refresh();
    } catch (e) { setError(e instanceof Error ? e.message : 'Ticket purchase failed.'); }
    finally { setBusy(false); }
  };
  const claim = async (ticketId: string) => {
    setBusy(true); setError(''); setNotice('');
    try {
      await api.post('/api/games/turbo-bingo/claim', { ticketId });
      setNotice('BINGO! ድልህ በServer ተረጋግጧል።');
      await refresh();
    } catch (e) { setError(e instanceof Error ? e.message : 'Bingo claim failed.'); await refresh(); }
    finally { setBusy(false); }
  };
  const canBuy = state?.settings.enabled && state.game?.status === 'waiting';
  return (
    <main className="mx-auto w-full max-w-6xl space-y-5 pb-10 text-amber-50">
      <header className="flex items-center justify-between gap-3">
        <button type="button" onClick={onBack} className="rounded-xl border border-amber-300/30 px-4 py-2 text-sm font-bold text-amber-200">← Games Center</button>
        <span className="rounded-full border border-amber-300/25 bg-amber-300/10 px-3 py-1.5 text-[10px] font-black tracking-wider text-amber-300">LIVE · DEMO CREDITS</span>
      </header>
      <section className="rounded-3xl border border-amber-400/30 bg-[radial-gradient(ellipse_at_top_right,rgba(202,158,57,.24),transparent_45%),linear-gradient(120deg,#17140c,#090909_58%,#151006)] p-5 sm:p-7">
        <p className="text-[10px] font-black uppercase tracking-[.3em] text-amber-400">BLACK GOLD GAME CENTER</p>
        <h1 className="mt-2 text-3xl font-black sm:text-4xl">TURBO BINGO</h1>
        <p className="mt-1 text-sm text-amber-100/65">ትርቦ ቢንጎ · One game · One exact target · First valid winner</p>
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="GAME STATUS" value={state?.game?.status?.toUpperCase() ?? 'LOADING'} />
          <Stat label="WINNING TARGET" value={String(state?.game?.target ?? state?.settings.target ?? '—')} />
          <Stat label="NUMBERS CALLED" value={String(state?.game?.drawnNumbers.length ?? 0)} />
          <Stat label="LATEST NUMBER" value={String(state?.game?.lastNumber ?? '—')} />
        </div>
      </section>
      {error && <p role="alert" className="rounded-xl border border-red-500/30 bg-red-950/40 p-3 text-sm text-red-200">{error}</p>}
      {notice && <p role="status" className="rounded-xl border border-emerald-500/30 bg-emerald-950/30 p-3 text-sm text-emerald-200">{notice}</p>}
      <section className="grid gap-4 lg:grid-cols-[1fr_300px]">
        <div className="rounded-2xl border border-amber-400/20 bg-black/50 p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="font-black text-amber-100">LIVE NUMBER BOARD · 1–80</h2>
            <span className="text-xs text-amber-400">{state?.game?.drawnNumbers.length ?? 0}/80</span>
          </div>
          <div className="grid grid-cols-8 gap-1.5 sm:grid-cols-10">
            {Array.from({ length: 80 }, (_, index) => index + 1).map((number) => (
              <div key={number} className={`grid aspect-square place-items-center rounded-lg border text-xs font-black tabular-nums sm:text-sm ${state?.game?.lastNumber === number ? 'border-amber-200 bg-amber-300 text-black shadow-[0_0_18px_rgba(245,190,70,.5)]' : drawn.has(number) ? 'border-emerald-500/50 bg-emerald-500/15 text-emerald-200' : 'border-white/10 bg-white/[.035] text-white/40'}`}>{number}</div>
            ))}
          </div>
        </div>
        <aside className="space-y-3">
          <div className="rounded-2xl border border-amber-400/20 bg-black/50 p-4">
            <p className="text-xs font-bold uppercase tracking-wider text-amber-400">SIMULATION WALLET</p>
            <p className="mt-2 text-2xl font-black">{state?.balanceEtb == null ? '—' : money(state.balanceEtb)} <span className="text-sm text-amber-300">ETB</span></p>
            <p className="mt-1 text-[10px] text-amber-100/45">Non-withdrawable demo credits only</p>
          </div>
          <div className="rounded-2xl border border-amber-400/20 bg-black/50 p-4">
            <p className="text-xs font-bold uppercase tracking-wider text-amber-400">TICKET PURCHASE</p>
            <p className="mt-2 text-sm text-amber-100/70">Price: {state ? money(state.settings.ticketPriceEtb) : '—'} ETB each</p>
            <label className="mt-3 block text-xs text-amber-100/60">Number of tickets</label>
            <input type="number" min={1} max={state?.settings.maxTicketsPerPlayer ?? 10} value={count} onChange={(event) => setCount(Math.max(1, Math.min(10, Number(event.target.value) || 1)))} className="mt-1 w-full rounded-xl border border-amber-300/20 bg-black px-3 py-3 text-lg font-bold text-amber-100" />
            <button type="button" disabled={!canBuy || busy} onClick={() => void buy()} className="mt-3 w-full rounded-xl bg-gradient-to-r from-amber-300 to-yellow-600 px-4 py-3 font-black text-black disabled:cursor-not-allowed disabled:opacity-40">{busy ? 'Please wait…' : 'BUY & REGISTER TICKETS'}</button>
            {!canBuy && <p className="mt-2 text-[11px] text-amber-100/45">Ticket sales open when the Admin opens a new game.</p>}
          </div>
        </aside>
      </section>
      <section className="space-y-3">
        <div className="flex items-center justify-between"><h2 className="text-lg font-black">MY REGISTERED TICKETS</h2><span className="text-xs text-amber-400">{state?.tickets.length ?? 0} tickets</span></div>
        {!state?.tickets.length && <p className="rounded-xl border border-white/10 bg-black/40 p-5 text-center text-sm text-amber-100/50">No tickets registered for this game yet.</p>}
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {state?.tickets.map((ticket, index) => {
            const eligible = ticket.status === 'active' && state.game?.status === 'running' &&
              ticket.matchedNumbers.length === state.game.target &&
              state.game.lastNumber !== null && ticket.numbers.includes(state.game.lastNumber);
            return (
              <article key={ticket.id} className="rounded-2xl border border-amber-300/20 bg-[#0c0b08] p-3">
                <div className="mb-2 flex items-center justify-between"><span className="text-xs font-black text-amber-300">TICKET {index + 1}</span><span className={`rounded-full px-2 py-1 text-[9px] font-black uppercase ${ticket.status === 'locked' ? 'bg-red-500/15 text-red-300' : ticket.status === 'winner' ? 'bg-emerald-500/15 text-emerald-300' : 'bg-amber-300/10 text-amber-200'}`}>{ticket.status}</span></div>
                <div className="grid grid-cols-5 gap-1">
                  {ticket.numbers.map((number) => <div key={number} className={`grid aspect-square place-items-center rounded-md text-xs font-black tabular-nums ${ticket.matchedNumbers.includes(number) ? 'bg-emerald-500/25 text-emerald-200 ring-1 ring-emerald-400/50' : 'bg-white/[.06] text-amber-100/75'}`}>{number}</div>)}
                </div>
                <p className="mt-2 text-[10px] text-amber-100/50">{ticket.matchedNumbers.length}/{state.game?.target ?? state.settings.target} matched</p>
                <button type="button" disabled={!eligible || busy} onClick={() => void claim(ticket.id)} className="mt-2 w-full rounded-lg bg-amber-300 px-3 py-2.5 text-xs font-black text-black disabled:cursor-not-allowed disabled:opacity-30">BINGO</button>
              </article>
            );
          })}
        </div>
      </section>
      {state?.game?.status === 'ended' && <section className="rounded-2xl border border-emerald-400/30 bg-emerald-950/20 p-4 text-center"><h2 className="text-xl font-black text-emerald-200">{state.game.winner ? 'BINGO WINNER CONFIRMED' : 'GAME ENDED'}</h2><p className="mt-1 text-sm text-emerald-100/70">{state.game.winner ? 'The first valid exact-target claim ended this game.' : 'This game ended without a valid claim.'}</p></section>}
      <p className="text-center text-[10px] text-amber-100/35">Turbo Bingo is currently simulation-only. Demo credits have no cash value and cannot be withdrawn.</p>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border border-amber-200/15 bg-black/35 p-3"><p className="text-[9px] font-bold tracking-wider text-amber-400/70">{label}</p><p className="mt-1 text-xl font-black tabular-nums">{value}</p></div>;
}
