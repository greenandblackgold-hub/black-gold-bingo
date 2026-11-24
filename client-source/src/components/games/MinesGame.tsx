import { useEffect, useMemo, useState } from 'react';
import { useLanguage } from '@/context/LanguageContext';
import { minesLocale } from '@/lib/minesLocalization';
import type { Lang } from '@/types/game';

const STORAGE_KEY = 'black-gold-mines-demo-v1';
const STARTING_CREDITS = 10000;
const MIN_BET = 2;
const MAX_BET = 1000;
const HOUSE_RETURN = 0.99;
const money = (value: number, lang: Lang) => value.toLocaleString(lang === 'am' ? 'am-ET' : lang === 'ti' ? 'ti-ER' : 'en-ET', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const roundMoney = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

type Tab = 'game' | 'bets' | 'history' | 'rules';
type RoundRecord = { id: string; date: number; bet: number; mines: number; safe: number; multiplier: number; payout: number; result: 'won' | 'lost' };
type Round = { id: string; bet: number; mines: number; mineTiles: number[]; opened: number[]; safe: number; status: 'active' | 'won' | 'lost'; multiplier: number; payout: number };

function readSaved() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { credits: STARTING_CREDITS, history: [] as RoundRecord[] };
    const parsed = JSON.parse(raw) as { credits?: number; history?: RoundRecord[] };
    return {
      credits: Number.isFinite(parsed.credits) && Number(parsed.credits) >= 0 ? Number(parsed.credits) : STARTING_CREDITS,
      history: Array.isArray(parsed.history) ? parsed.history.slice(0, 30) : [],
    };
  } catch {
    return { credits: STARTING_CREDITS, history: [] as RoundRecord[] };
  }
}

function pickMineTiles(count: number): number[] {
  const values = Array.from({ length: 25 }, (_, index) => index);
  const random = new Uint32Array(25);
  if (globalThis.crypto?.getRandomValues) globalThis.crypto.getRandomValues(random);
  else for (let i = 0; i < random.length; i += 1) random[i] = Math.floor(Math.random() * 0xffffffff);
  for (let i = values.length - 1; i > 0; i -= 1) {
    const j = random[i] % (i + 1);
    [values[i], values[j]] = [values[j], values[i]];
  }
  return values.slice(0, count).sort((a, b) => a - b);
}

/** Return multiplier after opening safeCount gems, including a 1% demo house edge. */
export function calculateMinesMultiplier(mineCount: number, safeCount: number): number {
  if (!Number.isInteger(mineCount) || mineCount < 1 || mineCount > 24) return 0;
  if (!Number.isInteger(safeCount) || safeCount < 0 || safeCount > 25 - mineCount) return 0;
  if (safeCount === 0) return 1;
  let probability = 1;
  for (let index = 0; index < safeCount; index += 1) {
    probability *= (25 - mineCount - index) / (25 - index);
  }
  return Math.floor((HOUSE_RETURN / probability) * 100 + 1e-10) / 100;
}

function makeRecord(round: Round, result: 'won' | 'lost', payout: number): RoundRecord {
  return { id: round.id, date: Date.now(), bet: round.bet, mines: round.mines, safe: round.safe, multiplier: round.multiplier, payout, result };
}

export function MinesGame() {
  const [saved, setSaved] = useState(readSaved);
  const [round, setRound] = useState<Round | null>(null);
  const [tab, setTab] = useState<Tab>('game');
  const [mineCount, setMineCount] = useState(3);
  const [customMines, setCustomMines] = useState('3');
  const [bet, setBet] = useState('50');
  const [notice, setNotice] = useState('');
  const [helpOpen, setHelpOpen] = useState(false);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(saved)); } catch { /* Demo remains usable for this session if storage is unavailable. */ }
  }, [saved]);

  const active = round?.status === 'active';
  const currentMultiplier = round?.multiplier ?? 1;
  const nextMultiplier = round && active && round.safe < 25 - round.mines
    ? calculateMinesMultiplier(round.mines, round.safe + 1)
    : round ? round.multiplier : calculateMinesMultiplier(mineCount, 1);
  const currentWin = round && active && round.safe > 0 ? round.payout : 0;
  const maximumBet = Math.min(MAX_BET, saved.credits);
  const numericBet = Number(bet);
  const validBet = Number.isFinite(numericBet) && numericBet >= MIN_BET && numericBet <= maximumBet;

  const visibleTiles = useMemo(() => {
    if (!round) return new Set<number>();
    if (round.status !== 'active') return new Set<number>([...round.opened, ...round.mineTiles]);
    return new Set(round.opened);
  }, [round]);

  const startGame = () => {
    if (active || !validBet || saved.credits < numericBet) return;
    const stake = roundMoney(numericBet);
    setSaved((current) => ({ ...current, credits: roundMoney(current.credits - stake) }));
    setRound({
      id: `MIN-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
      bet: stake, mines: mineCount, mineTiles: pickMineTiles(mineCount), opened: [], safe: 0,
      status: 'active', multiplier: 1, payout: 0,
    });
    setNotice(t('roundStarted'));
    setTab('game');
  };

  const pickTile = (index: number) => {
    if (!round || round.status !== 'active' || round.opened.includes(index)) return;
    if (round.mineTiles.includes(index)) {
      const ended: Round = { ...round, opened: [...round.opened, index], status: 'lost', multiplier: 0, payout: 0 };
      setRound(ended);
      setSaved((current) => ({ ...current, history: [makeRecord(ended, 'lost', 0), ...current.history].slice(0, 30) }));
      setNotice(t('mineHit'));
      return;
    }
    const safe = round.safe + 1;
    const multiplier = calculateMinesMultiplier(round.mines, safe);
    const payout = roundMoney(round.bet * multiplier);
    const updated: Round = { ...round, opened: [...round.opened, index], safe, multiplier, payout };
    if (safe === 25 - round.mines) {
      const completed: Round = { ...updated, status: 'won' };
      setRound(completed);
      setSaved((current) => ({ ...current, credits: roundMoney(current.credits + payout), history: [makeRecord(completed, 'won', payout), ...current.history].slice(0, 30) }));
      setNotice(t('allSafe'));
    } else {
      setRound(updated);
      setNotice(t('gemFound'));
    }
  };

  const cashOut = () => {
    if (!round || round.status !== 'active' || round.safe < 1) return;
    const payout = roundMoney(round.bet * round.multiplier);
    const completed: Round = { ...round, status: 'won', payout };
    setRound(completed);
    setSaved((current) => ({ ...current, credits: roundMoney(current.credits + payout), history: [makeRecord(completed, 'won', payout), ...current.history].slice(0, 30) }));
    setNotice(t('cashOutSuccess', { amount: formatMoney(payout) }));
  };

  const adjustBet = (factor: number) => {
    const current = Number(bet) || MIN_BET;
    setBet(String(Math.min(maximumBet, Math.max(MIN_BET, roundMoney(current * factor)))));
  };

  const chooseMineCount = (value: number) => {
    const next = Math.min(24, Math.max(1, Math.trunc(value)));
    setMineCount(next);
    setCustomMines(String(next));
  };

  const tabs: { id: Tab; label: string }[] = [
    { id: 'game', label: t('game') }, { id: 'bets', label: t('bets') },
    { id: 'history', label: t('history') }, { id: 'rules', label: t('rules') },
  ];

  return (
    <main className="mx-auto min-h-screen w-full max-w-xl space-y-3 bg-[#070707] px-3 pb-8 pt-3 text-[#f3dfad] sm:px-4">
      <header className="rounded-2xl border border-amber-400/25 bg-[radial-gradient(ellipse_at_top_right,rgba(202,158,57,.2),transparent_50%),linear-gradient(120deg,#17140c,#090909_65%,#151006)] px-4 py-3">
        <div className="flex items-center justify-between gap-2">
          <div><p className="text-[10px] font-black uppercase tracking-[.3em] text-amber-500">BLACK GOLD · DEMO</p><h1 className="text-2xl font-black tracking-wider text-amber-100">MINES</h1></div>
          <button type="button" onClick={() => setHelpOpen(true)} aria-label="Mines help" className="grid h-9 w-9 place-items-center rounded-full border border-amber-300/35 bg-black/50 text-lg font-bold text-amber-200">?</button>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <div className="rounded-xl border border-amber-300/15 bg-black/45 p-2"><p className="text-[9px] font-bold uppercase tracking-wider text-amber-500"{t('mineCount')}</p><p className="text-lg font-black text-amber-100">{round?.mines ?? mineCount} 💣</p></div>
          <div className="rounded-xl border border-amber-300/15 bg-black/45 p-2"><p className="text-[9px] font-bold uppercase tracking-wider text-amber-500"{t('nextMultiplier')}</p><p className="text-lg font-black tabular-nums text-amber-200">{nextMultiplier.toFixed(2)}×</p></div>
        </div>
      </header>

      <section className="rounded-2xl border border-amber-300/20 bg-[#100e0a] p-3">
        <div className="flex items-center justify-between gap-2"><div><p className="text-[10px] font-bold uppercase tracking-wider text-amber-500"{t('currentPrize')}</p><p className="text-2xl font-black tabular-nums text-amber-100">{formatMoney(currentWin)} <span className="text-xs text-amber-400">{t('demoCredit')}</span></p></div><div className="text-right"><p className="text-[10px] text-amber-500"{t('gemsFound')}</p><p className="text-xl font-black text-amber-200">{round?.safe ?? 0} 💎</p></div></div>
        {round && <p className="mt-1 text-[10px] text-amber-100/40">Bet {formatMoney(round.bet)} · {currentMultiplier.toFixed(2)}×</p>}
      </section>

      {tab === 'game' && <>
        <section className="rounded-2xl border border-amber-300/20 bg-[#0b0b09] p-2 sm:p-3">
          <div className="mb-2 flex items-center justify-between px-1"><h2 className="text-xs font-black tracking-wider text-amber-200">5 × 5 · 25 TILES</h2><span className="text-[10px] text-amber-100/45">{active ? t('pickTile') : round?.status === 'lost' ? t('lost') : round?.status === 'won' ? t('complete') : t('ready')}</span></div>
          <div className="grid grid-cols-5 gap-2">
            {Array.from({ length: 25 }, (_, index) => {
              const opened = visibleTiles.has(index);
              const mine = !!round?.mineTiles.includes(index);
              const hitMine = mine && round?.opened.includes(index);
              const revealedGem = opened && !mine;
              return <button key={index} type="button" disabled={!active || opened} onClick={() => pickTile(index)} aria-label={opened ? (mine ? t('mineTile') : t('gemTile')) : t('closedTile', { number: index + 1 })} className={`grid aspect-square min-w-0 place-items-center rounded-xl border text-2xl shadow-[inset_0_1px_0_rgba(255,255,255,.08)] transition ${hitMine ? 'border-red-400/70 bg-red-950/70' : mine && round?.status !== 'active' ? 'border-red-500/35 bg-red-950/30' : revealedGem ? 'border-amber-200/70 bg-gradient-to-br from-amber-300/30 to-amber-800/25' : 'border-amber-400/25 bg-gradient-to-br from-[#272114] to-[#100e0a] hover:border-amber-200/70 hover:brightness-125'} disabled:cursor-default disabled:opacity-100`}>
                {opened ? (mine ? '💣' : '💎') : mine && round?.status !== 'active' ? '💣' : <span className="text-amber-300/80">?</span>}
              </button>;
            })}
          </div>
        </section>

        <section className="space-y-3 rounded-2xl border border-amber-300/20 bg-[#100e0a] p-3">
          <div><div className="mb-2 flex items-center justify-between"><label className="text-xs font-bold text-amber-200"{t('chooseMines')}</label><span className="text-xs font-black text-amber-300">{mineCount} / 24</span></div>
            <div className="grid grid-cols-4 gap-2">
              {[1, 3, 5, 10].map((value) => <button key={value} type="button" disabled={!!active} onClick={() => chooseMineCount(value)} className={`rounded-lg border px-2 py-2 text-sm font-black disabled:opacity-50 ${mineCount === value ? 'border-amber-200 bg-amber-300 text-black' : 'border-amber-400/25 bg-black/50 text-amber-200'}`}>{value}</button>)}
            </div>
            <label className="mt-3 flex items-center justify-between gap-3 text-xs text-amber-100/70"><span>{t('custom')}</span><input type="number" min="1" max="24" step="1" value={customMines} disabled={!!active} onChange={(event) => setCustomMines(event.target.value)} onBlur={() => chooseMineCount(Number(customMines) || mineCount)} className="w-20 rounded-lg border border-amber-400/25 bg-black px-2 py-1.5 text-right font-bold text-amber-100 disabled:opacity-50" /></label>
          </div>
          <div><label className="mb-2 block text-xs font-bold text-amber-200"{t('betAmount')} ({t('demoCredit')})</label>
            <div className="grid grid-cols-[44px_minmax(0,1fr)_44px_58px_62px] gap-1.5">
              <button type="button" disabled={!!active} onClick={() => adjustBet(0.5)} className="rounded-lg border border-amber-400/25 bg-black/60 text-xl font-black text-amber-200 disabled:opacity-40">−</button>
              <input type="number" min={MIN_BET} max={maximumBet} step="0.01" value={bet} disabled={!!active} onChange={(event) => setBet(event.target.value)} className="min-w-0 rounded-lg border border-amber-400/25 bg-black px-2 text-center text-lg font-black tabular-nums text-amber-100 disabled:opacity-50" aria-label={t('betAmountAria')} />
              <button type="button" disabled={!!active} onClick={() => adjustBet(2)} className="rounded-lg border border-amber-400/25 bg-black/60 text-xl font-black text-amber-200 disabled:opacity-40">+</button>
              <button type="button" disabled={!!active} onClick={() => adjustBet(2)} className="rounded-lg border border-amber-400/25 bg-black/60 text-xs font-black text-amber-200 disabled:opacity-40">X2</button>
              <button type="button" disabled={!!active} onClick={() => setBet(String(maximumBet))} className="rounded-lg border border-amber-400/25 bg-black/60 text-xs font-black text-amber-200 disabled:opacity-40">MAX</button>
            </div>
            <p className="mt-1 text-[10px] text-amber-100/40">{t('minimum')} {formatMoney(MIN_BET)} · {t('maximum')} {formatMoney(maximumBet)} · {t('demoOnly')}</p>
          </div>
          {active && round && <button type="button" disabled={round.safe < 1} onClick={cashOut} className="w-full rounded-xl bg-gradient-to-r from-emerald-300 to-emerald-500 py-3 text-lg font-black text-black disabled:cursor-not-allowed disabled:opacity-40">{t('cashOut')} · {formatMoney(currentWin)} {t('demoCredit')}</button>}
          {!active && <button type="button" disabled={!validBet || maximumBet < MIN_BET} onClick={startGame} className="w-full rounded-xl border border-amber-200/40 bg-gradient-to-r from-amber-200 via-yellow-400 to-amber-600 py-3 text-lg font-black text-black shadow-[0_8px_24px_rgba(170,124,28,.2)] disabled:cursor-not-allowed disabled:opacity-40">{round ? t('startNew') : t('start')}</button>}
          {!validBet && <p role="alert" className="text-center text-xs text-red-300">{t('invalidBet', { min: formatMoney(MIN_BET), max: formatMoney(maximumBet) })}</p>}
        </section>
      </>}

      {tab === 'bets' && <section className="rounded-2xl border border-amber-300/20 bg-[#100e0a] p-4"><h2 className="font-black text-amber-100">{t('bets')}</h2>{round ? <div className="mt-3 rounded-xl border border-amber-300/15 bg-black/40 p-3"><p className="font-mono text-xs text-amber-300">{round.id}</p><p className="mt-2 text-sm text-amber-100">{t('betLabel')} {formatMoney(round.bet)} · {t('mines')} {round.mines} · {t('gems')} {round.safe}</p><p className="mt-1 text-sm font-bold text-amber-200">{round.status === 'active' ? t('active') : round.status === 'won' ? t('cashedOut') : t('lostStatus')} · {formatMoney(round.payout)}</p></div> : <p className="mt-3 text-sm text-amber-100/50">{t('noBet')}</p>}</section>}

      {tab === 'history' && <section className="rounded-2xl border border-amber-300/20 bg-[#100e0a] p-4"><h2 className="font-black text-amber-100">{t('history')}</h2><div className="mt-3 space-y-2">{saved.history.length ? saved.history.map((item) => <div key={item.id} className="flex items-center justify-between gap-3 rounded-xl border border-amber-300/10 bg-black/40 p-3"><div className="min-w-0"><p className="truncate font-mono text-[11px] text-amber-300">{item.id}</p><p className="mt-1 text-[10px] text-amber-100/45">{new Date(item.date).toLocaleString(lang === 'am' ? 'am-ET' : lang === 'ti' ? 'ti-ER' : 'en-ET')} · {item.mines} {t('mines')} · {item.safe} {t('gems')}</p></div><div className="shrink-0 text-right"><p className={`text-xs font-black ${item.result === 'won' ? 'text-emerald-300' : 'text-red-300'}`}>{item.result === 'won' ? t('won') : t('lostStatus')}</p><p className="text-sm font-bold text-amber-100">{formatMoney(item.payout)}</p></div></div>) : <p className="text-sm text-amber-100/50">{t('noHistory')}</p>}</div></section>}

      {tab === 'rules' && <section className="space-y-3 rounded-2xl border border-amber-300/20 bg-[#100e0a] p-4"><h2 className="font-black text-amber-100">{t('rulesTitle')}</h2><ol className="list-decimal space-y-2 pl-5 text-sm leading-6 text-amber-100/75"><li>{t('rule1')}</li><li>{t('rule2')}</li><li>{t('rule3')}</li><li>{t('rule4')}</li><li>{t('rule5')}</li></ol><p className="rounded-xl border border-amber-300/15 bg-black/40 p-3 text-xs leading-5 text-amber-100/50">{t('disclaimer')}</p></section>}

      {notice && tab === 'game' && <p role="status" className="rounded-xl border border-amber-300/20 bg-black/50 p-3 text-center text-xs text-amber-200">{notice}</p>}
      <nav aria-label={t('tabsAria')} className="grid grid-cols-4 gap-1 rounded-xl border border-amber-300/20 bg-black/70 p-1">
        {tabs.map((item) => <button key={item.id} type="button" onClick={() => setTab(item.id)} aria-current={tab === item.id ? 'page' : undefined} className={`rounded-lg px-1 py-3 text-[11px] font-black ${tab === item.id ? 'bg-amber-300 text-black' : 'text-amber-200/65 hover:bg-amber-300/10'}`}>{item.label}</button>)}
      </nav>

      {helpOpen && <div className="fixed inset-0 z-[100] grid place-items-center bg-black/80 p-4" role="dialog" aria-modal="true" aria-labelledby="mines-help-title"><section className="w-full max-w-sm rounded-2xl border border-amber-300/30 bg-[#100e0a] p-5"><div className="flex items-center justify-between"><h2 id="mines-help-title" className="font-black text-amber-100">Mines · {t('help')}</h2><button type="button" onClick={() => setHelpOpen(false)} aria-label={t('closeHelp')} className="rounded-lg border border-amber-300/20 px-3 py-1 text-amber-200">✕</button></div><p className="mt-3 text-sm leading-6 text-amber-100/70">{t('helpText')}</p><button type="button" onClick={() => setHelpOpen(false)} className="mt-4 w-full rounded-xl bg-amber-300 py-2 font-black text-black">{t('understood')}</button></section></div>}
    </main>
  );
}
