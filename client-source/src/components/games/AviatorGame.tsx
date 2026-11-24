import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { useLanguage } from '@/context/LanguageContext';
import { gameUi } from '@/lib/gameUi';

type AviatorBet = { id: string; requestId?: string | null; status: string; stakeEtb: number; multiplier: number | null; payoutEtb: number; createdAt: number; autoCashOutMultiplier?: number };
type AviatorState = { enabled: boolean; balanceEtb: number; walletMode: 'shared' | 'legacy-demo'; game: 'aviator'; roundId: string; status: 'betting' | 'flying' | 'crashed'; bettingEndsAt: number; serverTime: number; serverSeedHash: string; startedAt?: number; growthPerMs?: number; crashMultiplier?: number; serverSeed?: string; myBets: AviatorBet[]; minBetEtb: number; maxBetEtb: number; maxPayoutEtb: number; mode: string; liveBets?: { player: string; stakeEtb: number; status: string; multiplier: number | null; payoutEtb: number }[]; playerCount?: number };
type HistoryRound = { roundId: string; status: string; crashMultiplier?: number; serverSeedHash: string; serverSeed?: string; myBets: AviatorBet[] };
type BetPanel = { amount: string; requestId: string; betId: string; busy: boolean; autoCashOutMultiplier: string };
const money = (n: number) => Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const makeRequestId = () => 'aviator_' + Date.now() + '_' + Math.random().toString(36).slice(2, 10);
const freshPanel = (): BetPanel => ({ amount: '10.00', requestId: '', betId: '', busy: false, autoCashOutMultiplier: '' });

export function AviatorGame(_props: { onBack: () => void; onSwitchGame: (game: 'bingo' | 'keno' | 'aviator' | 'mines') => void }) {
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

  const updatePanel = (index: number, patch: Partial<BetPanel>) => {
    setPanels((old) => old.map((panel, i) => i === index ? { ...panel, ...patch } : panel) as [BetPanel, BetPanel]);
  };
  const placeBet = async (index: number) => {
    const panel = panels[index];
    if (panel.busy || !isBetting || (state?.myBets.length ?? 0) >= 2) return false;
    const id = panel.requestId || makeRequestId();
    const autoCashOutText = panel.autoCashOutMultiplier.trim();
    const autoCashOutMultiplier = Number(autoCashOutText);
    if (autoCashOutText && (!Number.isFinite(autoCashOutMultiplier) || autoCashOutMultiplier < 1.01 || autoCashOutMultiplier > 1000 || Math.abs(autoCashOutMultiplier * 100 - Math.round(autoCashOutMultiplier * 100)) > 1e-7)) {
      setError(t.autoCashOutError);
      return false;
    }
    updatePanel(index, { busy: true, requestId: id });
    setError(''); setNotice('');
    try {
      const result = await api.post<{ bet: AviatorBet }>('/api/games/aviator/bets', { requestId: id, amount: Number(panel.amount), ...(autoCashOutText ? { autoCashOutMultiplier } : {}) });
      updatePanel(index, { requestId: '', betId: result.bet.id });
      setNotice(t.betConfirmed);
      await loadState();
      return true;
    } catch { setError(t.betError); return false; }
    finally { updatePanel(index, { busy: false }); }
  };

  const cashOut = async (bet: AviatorBet, index: number) => {
    updatePanel(index, { busy: true });
    setError(''); setNotice('');
    try {
      const result = await api.post<{ multiplier: number; bet: AviatorBet }>('/api/games/aviator/cashout', { betId: bet.id });
      setNotice(t.cashOutRecorded.replace('{multiplier}', result.multiplier.toFixed(2)));
      await loadState();
    } catch { setError(t.betError); }
    finally { updatePanel(index, { busy: false }); }
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

  // A continuous, low-pass-filtered turbine sound runs only while the aircraft is flying.
  useEffect(() => {
    if (!soundOn || state?.status !== 'flying') return;
    const AudioContextClass = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const turbine = ctx.createOscillator();
    const lowRumble = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const engineGain = ctx.createGain();
    turbine.type = 'sawtooth';
    turbine.frequency.setValueAtTime(92, ctx.currentTime);
    turbine.frequency.linearRampToValueAtTime(138, ctx.currentTime + 2);
    lowRumble.type = 'triangle';
    lowRumble.frequency.setValueAtTime(48, ctx.currentTime);
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(320, ctx.currentTime);
    engineGain.gain.setValueAtTime(0.0001, ctx.currentTime);
    engineGain.gain.linearRampToValueAtTime(0.075, ctx.currentTime + 0.35);
    turbine.connect(filter);
    lowRumble.connect(filter);
    filter.connect(engineGain);
    engineGain.connect(ctx.destination);
    turbine.start();
    lowRumble.start();
    if (ctx.state === 'suspended') void ctx.resume();
    return () => {
      const stopAt = ctx.currentTime + 0.12;
      engineGain.gain.cancelScheduledValues(ctx.currentTime);
      engineGain.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.035);
      turbine.stop(stopAt);
      lowRumble.stop(stopAt);
      window.setTimeout(() => { void ctx.close(); }, 180);
    };
  }, [soundOn, state?.status]);

  const statusLabel = (status: string) => status === 'cashed_out' ? t.cashedOut : status === 'lost' ? t.lost : status === 'active' ? t.active : t.settling;
  const displayedBets = tab === 'mine'
    ? (state?.myBets ?? []).map((bet) => ({ player: t.you, stakeEtb: bet.stakeEtb, status: bet.status, multiplier: bet.multiplier, payoutEtb: bet.payoutEtb }))
    : tab === 'top'
      ? (state?.liveBets ?? []).filter((bet) => bet.status === 'cashed_out').sort((a, b) => b.payoutEtb - a.payoutEtb).slice(0, 10)
      : state?.liveBets ?? [];

  return (
    <div className="aviator-premium mx-auto w-full max-w-6xl space-y-4 pb-8">
      <header className="aviator-header">
        <div><p className="aviator-eyebrow">{t.brand}</p><h1>AVIATOR <span>✦</span></h1><p>{t.intro}</p></div>
        <div className="aviator-history-strip"><span>{t.recentFlights}</span>{history.slice(0, 7).map((round) => <b key={round.roundId} className={(round.crashMultiplier ?? 0) >= 2 ? 'good' : 'low'}>{round.crashMultiplier ? round.crashMultiplier.toFixed(2) + '×' : '—'}</b>)}</div>
      </header>
      <div className="flex justify-end"><button className="aviator-sound" onClick={() => setSoundOn((v) => !v)} aria-pressed={soundOn}>{soundOn ? '♫ ' + t.soundOn : '♫ ' + t.soundOff}</button></div>

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
          const matchedBet = state?.myBets.find((item) => item.id === panel.betId || Boolean(panel.requestId && item.requestId === panel.requestId));
          const claimedByOtherPanels = new Set(panels.flatMap((other, otherIndex) => otherIndex === index ? [] : [other.betId, other.requestId]).filter(Boolean));
          const unassignedBefore = panels.slice(0, index).filter((other) => !other.betId && !other.requestId).length;
          const unclaimedBets = (state?.myBets ?? []).filter((item) => !claimedByOtherPanels.has(item.id) && !(item.requestId && claimedByOtherPanels.has(item.requestId)));
          const bet = matchedBet ?? (!panel.betId && !panel.requestId ? unclaimedBets[unassignedBefore] : undefined);
          const active = bet?.status === 'active';
          const placed = Boolean(bet);
          return <div key={index} className="aviator-bet-card">
            <div className="aviator-bet-heading"><div><span>{t.betNumber.replace('{number}', String(index + 1))}</span><h2>{index === 0 ? t.mainBet : t.secondBet}</h2></div></div>
            <label htmlFor={'aviator-stake-' + index}>{t.stake}</label>
            <div className="aviator-amount-row"><button onClick={() => updatePanel(index, { amount: String(Math.max(state?.minBetEtb ?? 2, Number(panel.amount || 0) - 1).toFixed(2)) })} disabled={placed}>−</button><input id={'aviator-stake-' + index} type="number" min={state?.minBetEtb ?? 2} max={state?.maxBetEtb ?? 1000} step="0.01" value={panel.amount} disabled={placed} onChange={(e) => updatePanel(index, { amount: e.target.value })}/><button onClick={() => updatePanel(index, { amount: String(Math.min(state?.maxBetEtb ?? 1000, Number(panel.amount || 0) + 1).toFixed(2)) })} disabled={placed}>+</button></div>
            <div className="aviator-quick"><button disabled={placed} onClick={() => updatePanel(index, { amount: String((Number(panel.amount) * 2).toFixed(2)) })}>×2</button>{[10, 50, 100, 500].map((n) => <button key={n} disabled={placed || n < (state?.minBetEtb ?? 2) || n > (state?.maxBetEtb ?? 1000)} onClick={() => updatePanel(index, { amount: String(n.toFixed(2)) })}>{n}</button>)}</div>
            <div className="aviator-auto-settings"><label htmlFor={'aviator-auto-cashout-' + index}>{t.autoCashOutAt} · {t.optional}</label><input id={'aviator-auto-cashout-' + index} type="number" min="1.01" max="1000" step="0.01" placeholder="2.00" value={panel.autoCashOutMultiplier || (bet?.autoCashOutMultiplier ? String(bet.autoCashOutMultiplier) : '')} disabled={placed} onChange={(e) => updatePanel(index, { autoCashOutMultiplier: e.target.value })}/><p>{t.autoCashOutHelp}</p></div>
            <p className="aviator-limits">{t.allowed}: {money(state?.minBetEtb ?? 2)}–{money(state?.maxBetEtb ?? 1000)} ETB · {t.demoCredits}</p>
            {active && state?.status === 'flying'
              ? <button className="aviator-cashout" disabled={panel.busy || Boolean(bet?.autoCashOutMultiplier)} onClick={() => void cashOut(bet!, index)}>{bet?.autoCashOutMultiplier ? t.autoCashOut + ' · ' + bet.autoCashOutMultiplier.toFixed(2) + '×' : t.cashOut + ' · ' + multiplier.toFixed(2) + '×'}</button>
              : <button className="aviator-place" disabled={!isBetting || panel.busy || placed || (state?.myBets.length ?? 0) >= 2} onClick={() => void placeBet(index)}>{panel.busy ? t.confirming : placed ? (active ? t.active : bet?.status === 'cashed_out' ? t.cashedOut : bet?.status === 'lost' ? t.lost : t.settling) : t.placeBet}</button>}
            {bet && <div className="aviator-bet-result"><span>{statusLabel(bet.status)} · {money(bet.stakeEtb)} ETB</span><b>{bet.multiplier ? bet.multiplier.toFixed(2) + '× · ' : ''}{money(bet.payoutEtb)} ETB</b></div>}
          </div>;
        })}
      </section>

      <section className="aviator-live-card">
        <div className="aviator-live-head"><div><h2>{t.liveBets}</h2><p>{state?.playerCount ?? 0} {t.players} · {t.roundLabel} {state?.roundId?.slice(-8) ?? '—'}</p></div><div className="aviator-tabs">
          <button className={tab === 'all' ? 'selected' : ''} onClick={() => setTab('all')}>{t.allBets}</button>
          <button className={tab === 'mine' ? 'selected' : ''} onClick={() => setTab('mine')}>{t.myBets}</button>
          <button className={tab === 'top' ? 'selected' : ''} onClick={() => setTab('top')}>{t.topWins}</button>
        </div></div>
        <div className="aviator-table-wrap"><table className="aviator-table"><thead><tr><th>{t.player}</th><th>{t.bet}</th><th>{t.status}</th><th>{t.multiplier}</th><th>{t.payout}</th></tr></thead><tbody>
          {displayedBets.length ? displayedBets.map((bet, i) => <tr key={i}><td>{bet.player}</td><td>{money(bet.stakeEtb)} ETB</td><td>{statusLabel(bet.status)}</td><td>{bet.multiplier ? bet.multiplier.toFixed(2) + '×' : '—'}</td><td>{money(bet.payoutEtb)} ETB</td></tr>) : <tr><td colSpan={5} className="aviator-empty">{t.noBets}</td></tr>}
        </tbody></table></div>
      </section>

      <section className="aviator-round-info"><div><span>{t.roundId}</span><b>{state?.roundId ?? '—'}</b></div><div><span>{t.seedCommitment}</span><b>{state?.serverSeedHash ?? '—'}</b></div></section>
      {state?.serverSeed && <section className="aviator-round-info"><div><span>{t.revealedSeed}</span><b>{state.serverSeed}</b></div><p>{t.verifyFormula}</p></section>}
      <section className="aviator-recent"><h2>{t.recentRounds}</h2><div>{history.map((round) => <article key={round.roundId}><span>{round.roundId.slice(-8)}</span><b>{round.crashMultiplier ? round.crashMultiplier.toFixed(2) + '×' : t.crashed}</b></article>)}</div></section>
    </div>
  );
}
