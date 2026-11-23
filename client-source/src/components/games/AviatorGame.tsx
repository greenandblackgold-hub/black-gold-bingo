import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { useLanguage } from '@/context/LanguageContext';
import { gameUi } from '@/lib/gameUi';

type AviatorBet = { id: string; status: string; stakeEtb: number; multiplier: number | null; payoutEtb: number; createdAt: number; autoCashOutMultiplier?: number };
type AviatorState = { enabled: boolean; balanceEtb: number; walletMode: 'shared' | 'legacy-demo'; game: 'aviator'; roundId: string; status: 'betting' | 'flying' | 'crashed'; bettingEndsAt: number; serverTime: number; serverSeedHash: string; startedAt?: number; growthPerMs?: number; crashMultiplier?: number; serverSeed?: string; myBets: AviatorBet[]; minBetEtb: number; maxBetEtb: number; maxPayoutEtb: number; mode: string; liveBets?: { player: string; stakeEtb: number; status: string; multiplier: number | null; payoutEtb: number }[]; playerCount?: number };
type HistoryRound = { roundId: string; status: string; crashMultiplier?: number; serverSeedHash: string; serverSeed?: string; myBets: AviatorBet[] };
type BetPanel = { amount: string; requestId: string; betId: string; busy: boolean; mode: 'manual' | 'auto'; autoBet: boolean; autoCashOutMultiplier: string };
const money = (n: number) => Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const makeRequestId = () => 'aviator_' + Date.now() + '_' + Math.random().toString(36).slice(2, 10);
const freshPanel = (): BetPanel => ({ amount: '10.00', requestId: '', betId: '', busy: false, mode: 'manual', autoBet: false, autoCashOutMultiplier: '' });

export function AviatorGame({ onBack, onSwitchGame }: { onBack: () => void; onSwitchGame: (game: 'bingo' | 'keno' | 'aviator') => void }) {
  const { lang } = useLanguage();
  const t = gameUi.aviator[lang];
  const [state, setState] = useState<AviatorState | null>(null);
  const [history, setHistory] = useState<HistoryRound[]>([]);
  const [panels, setPanels] = useState<[BetPanel, BetPanel]>([freshPanel(), freshPanel()]);
  const [clock, setClock] = useState(Date.now());
  const [offset, setOffset] = useState(0);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [tab, setTab] = useState<'all' | 'mine' | 'top'>('all');
  const [soundOn, setSoundOn] = useState(false);
  const lastAutoRound = useRef<[string, string]>(['', '']);

  const loadState = useCallback(async () => {
    try {
      const next = await api.get<AviatorState>('/api/games/aviator/state');
      setState(next); setOffset(next.serverTime - Date.now()); setError('');
    } catch { setError(t.loadError); }
  }, [t.loadError]);
  const loadHistory = useCallback(async () => {
    try { setHistory(await api.get<HistoryRound[]>('/api/games/aviator/history?limit=8')); } catch { /* optional */ }
  }, []);

  useEffect(() => {
    void loadState(); void loadHistory();
    const poll = window.setInterval(() => void loadState(), 1000);
    const tick = window.setInterval(() => setClock(Date.now()), 50);
    return () => { window.clearInterval(poll); window.clearInterval(tick); };
  }, [loadState, loadHistory]);

  useEffect(() => {
    if (state?.status === 'crashed') void loadHistory();
  }, [state?.status, state?.roundId, loadHistory]);

  const secondsLeft = state?.status === 'betting' ? Math.max(0, Math.ceil((state.bettingEndsAt - (clock + offset)) / 1000)) : 0;
  const multiplier = useMemo(() => {
    if (state?.status === 'crashed') return state.crashMultiplier ?? 1;
    if (state?.status !== 'flying' || !state.startedAt || !state.growthPerMs) return 1;
    return Math.floor(Math.exp(Math.max(0, clock + offset - state.startedAt) * state.growthPerMs) * 100) / 100;
  }, [state, clock, offset]);
  const isBetting = state?.enabled === true && state.status === 'betting' && secondsLeft > 0;
  const crashed = state?.status === 'crashed';
  const activeBets = state?.myBets.filter((bet) => bet.status === 'active') ?? [];

  const updatePanel = (index: number, patch: Partial<BetPanel>) => {
    setPanels((old) => old.map((panel, i) => i === index ? { ...panel, ...patch } : panel) as [BetPanel, BetPanel]);
  };
  const placeBet = async (index: number, automatic = false) => {
    const panel = panels[index];
    if (panel.busy || !isBetting || (automatic && !panel.autoBet)) return false;
    const id = panel.requestId || makeRequestId();
    updatePanel(index, { busy: true, requestId: id });
    setError(''); setNotice('');
    try {
      const autoCashOutMultiplier = Number(panel.autoCashOutMultiplier);
      const result = await api.post<{ bet: AviatorBet }>('/api/games/aviator/bets', { requestId: id, amount: Number(panel.amount), ...(Number.isFinite(autoCashOutMultiplier) && autoCashOutMultiplier >= 1.01 ? { autoCashOutMultiplier } : {}) });
      updatePanel(index, { requestId: '', betId: result.bet.id });
      setNotice(t.betConfirmed);
      await loadState();
      return true;
    } catch { setError(t.betError); return false; }
    finally { updatePanel(index, { busy: false }); }
  };
  useEffect(() => {
    if (!isBetting || !state?.roundId) return;
    panels.forEach((panel, index) => {
      if (!panel.autoBet || panel.busy || lastAutoRound.current[index] === state.roundId) return;
      if ((state.myBets?.length ?? 0) >= 2) return;
      lastAutoRound.current[index] = state.roundId;
      void placeBet(index, true);
    });
  }, [isBetting, state?.roundId, state?.myBets?.length, panels, placeBet]);

  const cashOut = async (bet: AviatorBet) => {
    setError(''); setNotice('');
    try {
      const result = await api.post<{ multiplier: number; bet: AviatorBet }>('/api/games/aviator/cashout', { betId: bet.id });
      setNotice(t.cashOutRecorded.replace('{multiplier}', result.multiplier.toFixed(2)));
      await loadState();
    } catch { setError(t.betError); }
  };
  const playSound = (kind: 'takeoff' | 'crash') => {
    if (!soundOn) return;
    try {
      const AudioContextClass = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextClass) return;
      const ctx = new AudioContextClass();
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      oscillator.type = 'sawtooth';
      oscillator.frequency.setValueAtTime(kind === 'takeoff' ? 240 : 180, ctx.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(kind === 'takeoff' ? 720 : 55, ctx.currentTime + 0.35);
      gain.gain.setValueAtTime(0.0001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.08, ctx.currentTime + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.38);
      oscillator.connect(gain); gain.connect(ctx.destination);
      oscillator.start(); oscillator.stop(ctx.currentTime + 0.4);
      oscillator.onended = () => { void ctx.close(); };
    } catch { /* audio is optional and browser-controlled */ }
  };
  const [previousStatus, setPreviousStatus] = useState<string | undefined>();
  useEffect(() => {
    if (state?.status && previousStatus && state.status !== previousStatus) {
      if (state.status === 'flying') playSound('takeoff');
      if (state.status === 'crashed') playSound('crash');
    }
    if (state?.status) setPreviousStatus(state.status);
  }, [state?.status]);

  const displayedBets = tab === 'mine'
    ? (state?.myBets ?? []).map((bet) => ({ player: 'You', stakeEtb: bet.stakeEtb, status: bet.status, multiplier: bet.multiplier, payoutEtb: bet.payoutEtb }))
    : tab === 'top'
      ? (state?.liveBets ?? []).filter((bet) => bet.status === 'cashed_out').sort((a, b) => b.payoutEtb - a.payoutEtb).slice(0, 10)
      : state?.liveBets ?? [];

  return (
    <div className="aviator-premium mx-auto w-full max-w-6xl space-y-4 pb-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <button onClick={onBack} className="aviator-nav">{t.games}</button>
          <button onClick={() => onSwitchGame('bingo')} className="aviator-nav">{t.bingo}</button>
          <button onClick={() => onSwitchGame('keno')} className="aviator-nav">{t.keno}</button>
          <button onClick={() => onSwitchGame('aviator')} aria-current="page" className="aviator-nav active">{t.aviator}</button>
        </div>
        <div className="flex items-center gap-3"><span className="aviator-chip">{t.simulation}</span><button className="aviator-sound" onClick={() => setSoundOn((v) => !v)} aria-pressed={soundOn}>{soundOn ? '♫ SOUND ON' : '♫ SOUND OFF'}</button></div>
      </div>

      <header className="aviator-header">
        <div><p className="aviator-eyebrow">{t.brand}</p><h1>AVIATOR <span>✦</span></h1><p>{t.intro}</p></div>
        <div className="aviator-history-strip"><span>RECENT FLIGHTS</span>{history.slice(0, 7).map((round) => <b key={round.roundId} className={(round.crashMultiplier ?? 0) >= 2 ? 'good' : 'low'}>{round.crashMultiplier ? round.crashMultiplier.toFixed(2) + '×' : '—'}</b>)}</div>
      </header>

      {error && <p role="alert" className="aviator-alert">{error}</p>}
      {notice && <p role="status" className="aviator-notice">{notice}</p>}

      <section className={'aviator-flight ' + (crashed ? 'crashed' : state?.status === 'flying' ? 'flying' : 'waiting')}>
        <div className="aviator-sky-grid" />
        <div className="aviator-stars" />
        <div className="aviator-flight-status">{state?.status === 'betting' ? t.betsOpen : state?.status === 'flying' ? t.flying : crashed ? t.crashed : t.connecting}</div>
        <div className="aviator-multiplier">{state?.status === 'flying' ? multiplier.toFixed(2) + '×' : crashed ? (state?.crashMultiplier ?? 1).toFixed(2) + '×' : state?.status === 'betting' ? '1.00×' : '—'}</div>
        <div className="aviator-flight-path" />
        <div className="aviator-plane" aria-hidden>✈</div>
        <div className="aviator-flight-foot">{state?.status === 'betting' ? t.startsIn + ' ' + secondsLeft + 's' : state?.status === 'flying' ? t.cashOutBefore : crashed ? t.roundComplete : t.connecting}</div>
      </section>

      <section className="grid gap-3 lg:grid-cols-2">
        {[0, 1].map((index) => {
          const panel = panels[index];
          const bet = state?.myBets.find((item) => item.id === panel.betId) ?? (!panel.betId ? state?.myBets[index] : undefined);
          const active = bet?.status === 'active';
          const placed = Boolean(bet);
          return <div key={index} className="aviator-bet-card">
            <div className="aviator-bet-heading"><div><span>BET {index + 1}</span><h2>{index === 0 ? 'MAIN BET' : 'SECOND BET'}</h2></div><div className="aviator-tabs"><button type="button" className={panel.mode === 'manual' ? 'selected' : ''} onClick={() => updatePanel(index, { mode: 'manual' })}>BET</button><button type="button" className={panel.mode === 'auto' ? 'selected' : ''} onClick={() => updatePanel(index, { mode: 'auto' })}>AUTO</button></div></div>
            <label htmlFor={'aviator-stake-' + index}>{t.stake}</label>
            <div className="aviator-amount-row"><button onClick={() => updatePanel(index, { amount: String(Math.max(state?.minBetEtb ?? 2, Number(panel.amount || 0) - 1).toFixed(2)) })} disabled={placed}>−</button><input id={'aviator-stake-' + index} type="number" min={state?.minBetEtb ?? 2} max={state?.maxBetEtb ?? 1000} step="0.01" value={panel.amount} disabled={placed} onChange={(e) => updatePanel(index, { amount: e.target.value })}/><button onClick={() => updatePanel(index, { amount: String(Math.min(state?.maxBetEtb ?? 1000, Number(panel.amount || 0) + 1).toFixed(2)) })} disabled={placed}>+</button></div>
            <div className="aviator-quick"><button disabled={placed} onClick={() => updatePanel(index, { amount: String((Number(panel.amount) * 2).toFixed(2)) })}>×2</button>{[10, 50, 100, 500].map((n) => <button key={n} disabled={placed} onClick={() => updatePanel(index, { amount: String(n.toFixed(2)) })}>{n}</button>)}</div>
            {panel.mode === 'auto' && <div className="aviator-auto-settings"><label htmlFor={'aviator-auto-cashout-' + index}>AUTO CASH OUT AT (×) · optional</label><input id={'aviator-auto-cashout-' + index} type="number" min="1.01" max="1000" step="0.01" placeholder="e.g. 2.00" value={panel.autoCashOutMultiplier} disabled={placed} onChange={(e) => updatePanel(index, { autoCashOutMultiplier: e.target.value })}/><button type="button" className={panel.autoBet ? 'selected' : ''} disabled={placed} onClick={() => updatePanel(index, { autoBet: !panel.autoBet })}>{panel.autoBet ? 'AUTO BET ON · STOP' : 'START AUTO BET'}</button><p>Repeats this stake each new round while this game stays open. Auto Cash Out is executed by the server.</p></div>}
            <p className="aviator-limits">{t.allowed}: {money(state?.minBetEtb ?? 2)}–{money(state?.maxBetEtb ?? 1000)} ETB · {t.demoCredits}</p>
            {active && state?.status === 'flying'
              ? <button className="aviator-cashout" disabled={panel.busy || Boolean(bet?.autoCashOutMultiplier)} onClick={() => void cashOut(bet!)}>{bet?.autoCashOutMultiplier ? 'AUTO CASH OUT · ' + bet.autoCashOutMultiplier.toFixed(2) + '×' : t.cashOut + ' · ' + multiplier.toFixed(2) + '×'}</button>
              : <button className="aviator-place" disabled={!isBetting || panel.busy || placed || (panel.mode === 'auto' && panel.autoBet) || (state?.myBets.length ?? 0) >= 2} onClick={() => void placeBet(index)}>{panel.busy ? t.confirming : placed ? (active ? t.active : bet?.status === 'cashed_out' ? t.cashedOut : bet?.status === 'lost' ? t.lost : t.settling) : t.placeBet}</button>}
            {bet && <div className="aviator-bet-result"><span>{bet.status.toUpperCase()} · {money(bet.stakeEtb)} ETB</span><b>{bet.multiplier ? bet.multiplier.toFixed(2) + '× · ' : ''}{money(bet.payoutEtb)} ETB</b></div>}
          </div>;
        })}
      </section>

      <section className="aviator-live-card">
        <div className="aviator-live-head"><div><h2>LIVE BETS</h2><p>{state?.playerCount ?? 0} PLAYERS · ROUND {state?.roundId?.slice(-8) ?? '—'}</p></div><div className="aviator-tabs">
          <button className={tab === 'all' ? 'selected' : ''} onClick={() => setTab('all')}>ALL BETS</button>
          <button className={tab === 'mine' ? 'selected' : ''} onClick={() => setTab('mine')}>MY BETS</button>
          <button className={tab === 'top' ? 'selected' : ''} onClick={() => setTab('top')}>TOP WINS</button>
        </div></div>
        <div className="aviator-table-wrap"><table className="aviator-table"><thead><tr><th>PLAYER</th><th>BET</th><th>STATUS</th><th>MULTIPLIER</th><th>PAYOUT</th></tr></thead><tbody>
          {displayedBets.length ? displayedBets.map((bet, i) => <tr key={i}><td>{bet.player}</td><td>{money(bet.stakeEtb)} ETB</td><td>{bet.status.replace('_', ' ').toUpperCase()}</td><td>{bet.multiplier ? bet.multiplier.toFixed(2) + '×' : '—'}</td><td>{money(bet.payoutEtb)} ETB</td></tr>) : <tr><td colSpan={5} className="aviator-empty">No bets to display yet</td></tr>}
        </tbody></table></div>
      </section>

      <section className="aviator-round-info"><div><span>{t.roundId}</span><b>{state?.roundId ?? '—'}</b></div><div><span>{t.seedCommitment}</span><b>{state?.serverSeedHash ?? '—'}</b></div></section>
      {state?.serverSeed && <section className="aviator-round-info"><div><span>{t.revealedSeed}</span><b>{state.serverSeed}</b></div><p>{t.verifyFormula}</p></section>}
      <section className="aviator-recent"><h2>{t.recentRounds}</h2><div>{history.map((round) => <article key={round.roundId}><span>{round.roundId.slice(-8)}</span><b>{round.crashMultiplier ? round.crashMultiplier.toFixed(2) + '×' : t.crashed}</b></article>)}</div></section>
    </div>
  );
}
