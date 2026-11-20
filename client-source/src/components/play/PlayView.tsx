import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { formatAmount } from '@/lib/localization';
import { useLanguage } from '@/context/LanguageContext';
import { usePlayer } from '@/context/PlayerContext';
import { useRound } from '@/context/RoundContext';
import { useAppSettings } from '@/context/AppSettingsContext';
import { play } from '@/lib/audio';
import { findWinningPattern, patternMasks } from '@/lib/bingo';
import { WIN_PATTERN_OPTIONS } from '@/lib/patternCatalog';
import type { BingoCard, WinPattern } from '@/types/game';

const LETTERS = ['B', 'I', 'N', 'G', 'O'] as const;
const letterFor = (n: number) => LETTERS[Math.min(4, Math.floor((n - 1) / 15))];
const CARD_ACCENTS = [
  { border: 'border-blue-500', glow: 'shadow-[0_0_18px_rgba(37,99,235,.55)]', head: 'from-blue-700 via-blue-500 to-blue-700' },
  { border: 'border-lime-500', glow: 'shadow-[0_0_18px_rgba(132,204,22,.5)]', head: 'from-green-700 via-lime-600 to-green-700' },
  { border: 'border-fuchsia-500', glow: 'shadow-[0_0_18px_rgba(217,70,239,.5)]', head: 'from-purple-700 via-fuchsia-600 to-purple-700' },
  { border: 'border-orange-500', glow: 'shadow-[0_0_18px_rgba(249,115,22,.5)]', head: 'from-orange-700 via-orange-500 to-orange-700' },
];
const PATTERN_LABELS: Partial<Record<WinPattern, string>> = {
  any_line: 'አንድ መስመር', horizontal_line: 'አግድም መስመር',
  vertical_line: 'ቁመት መስመር', diagonal: 'ዲያጎናል',
  two_lines: 'ሁለት መስመሮች', four_corners: 'አራቱ ማዕዘኖች',
  full_house: 'ሙሉ ካርድ', x: 'X ቅርጽ', t: 'T ቅርጽ',
  plus: 'ፕላስ (+)', diamond: 'ዳይመንድ', coverall: 'ሙሉ ካርድ',
};
const patternLabel = (pattern: WinPattern) => PATTERN_LABELS[pattern] ?? pattern.replace(/_/g, ' ');
const getPatternCells = (pattern: WinPattern) => {
  const masks = patternMasks(pattern);
  return (masks[0] ?? []).map(([r, c]) => r * 5 + c);
};

type CardProps = {
  card: BingoCard;
  index: number;
  marks: Set<number>;
  called: Set<number>;
  pattern: WinPattern;
  claimable: boolean;
  claiming: boolean;
  onClaim: () => void;
  onToggle: (n: number) => void;
};

function BingoCardView({ card, index, marks, called, pattern, claimable, claiming, onClaim, onToggle }: CardProps) {
  const accent = CARD_ACCENTS[index % CARD_ACCENTS.length];
  const winning = useMemo(() => {
    const result = findWinningPattern(card.grid, new Set([...called].filter(n => marks.has(n))), pattern);
    return result.missing === 0 ? result.positions : null;
  }, [card.grid, called, marks, pattern]);
  const winningCells = useMemo(() => new Set((winning ?? []).map(([r, c]) => r + '-' + c)), [winning]);

  return (
    <section className={`relative min-w-0 overflow-hidden rounded-[1.2rem] border-2 ${accent.border} bg-black p-1 shadow-xl ${accent.glow}`}>
      <div className={`flex items-center justify-center bg-gradient-to-r ${accent.head} px-2 py-1 text-base font-black text-white sm:text-xl`}>
        Card #{index + 1}
      </div>
      {card.locked && <span className="absolute right-1 top-1 z-10 rounded bg-red-700 px-2 py-0.5 text-[9px] font-black text-white">LOCKED</span>}
      <div className="grid grid-cols-5 gap-px overflow-hidden rounded-b-lg bg-zinc-400">
        {LETTERS.map((letter, col) => (
          <div key={letter} className={`py-1 text-center text-base font-black text-white sm:text-2xl ${['bg-blue-700','bg-sky-600','bg-orange-500','bg-fuchsia-700','bg-green-700'][col]}`}>{letter}</div>
        ))}
        {card.grid.flatMap((row, r) => row.map((value, c) => {
          const free = value === null;
          const marked = free || (value !== null && marks.has(value));
          const wasCalled = value !== null && called.has(value);
          const inWinningLine = winningCells.has(r + '-' + c);
          return (
            <button
              key={r + '-' + c}
              type="button"
              disabled={free || !wasCalled || !!card.locked}
              onClick={() => { if (value !== null && wasCalled) onToggle(value); }}
              aria-pressed={marked}
              aria-label={free ? 'FREE' : `${LETTERS[c]} ${value}`}
              className={[
                'relative grid aspect-square min-w-0 place-items-center rounded-[3px] text-[clamp(10px,2.1vw,22px)] font-black leading-none text-black transition',
                free ? 'bg-blue-600 text-white shadow-[0_0_12px_rgba(0,140,255,.9)]' :
                  marked ? 'bg-lime-300 shadow-[inset_0_0_9px_rgba(255,255,255,.75)]' :
                  'bg-gradient-to-b from-white to-zinc-200',
                inWinningLine ? 'outline outline-2 outline-yellow-300' : '',
                wasCalled && !marked ? 'bg-blue-500 text-white' : '',
              ].join(' ')}
            >
              {free ? 'FREE' : value}
            </button>
          );
        }))}
      </div>
      {claimable && !card.locked && (
        <button type="button" onClick={onClaim} disabled={claiming} className="mt-1 w-full rounded-lg bg-gradient-to-r from-yellow-200 to-amber-500 py-1 text-xs font-black text-black">
          {claiming ? 'በመላክ ላይ…' : 'BINGO!'}
        </button>
      )}
    </section>
  );
}

function CalledBall({ number, latest = false }: { number: number; latest?: boolean }) {
  const letter = letterFor(number);
  const color = letter === 'N' ? 'from-green-400 to-green-700' :
    letter === 'G' ? 'from-purple-500 to-purple-800' :
    letter === 'B' ? 'from-red-500 to-red-800' :
    letter === 'I' ? 'from-blue-400 to-blue-700' : 'from-orange-400 to-orange-700';
  return (
    <div className={`grid h-8 w-8 shrink-0 place-items-center rounded-full border border-white/80 bg-gradient-to-br ${color} text-white shadow-[0_0_12px_rgba(255,255,255,.18)] sm:h-12 sm:w-12 sm:border-2 ${latest ? 'ring-2 ring-yellow-200' : ''}`}>
      <span className="text-[7px] font-black leading-none sm:text-[9px]">{letter}</span>
      <strong className="text-sm leading-none sm:text-xl">{number}</strong>
    </div>
  );
}

function formatCountdown(target: number | null, now: number) {
  if (!target) return '--:--';
  const seconds = Math.max(0, Math.ceil((target - now) / 1000));
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}

export function PlayView({ onGoToWallet }: { onGoToWallet: () => void }) {
  const { lang } = useLanguage();
  const { cards, markedByCard, toggleMark, balance } = usePlayer();
  const {
    phase, winPattern, calledNumbers, claimBingo, winner,
    nextCallAt, roundPrizeEtb,
  } = useRound();
  const { soundEnabled, setSoundEnabled } = useAppSettings();
  const [now, setNow] = useState(() => Date.now());
  const [autoMark, setAutoMark] = useState(true);
  const [claimingCardId, setClaimingCardId] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    try { setAutoMark(localStorage.getItem('bgb.autoMark') !== 'off'); } catch { /* use default */ }
  }, []);

  const called = useMemo(() => new Set(calledNumbers), [calledNumbers]);
  const markSets = useMemo(() => {
    const result: Record<string, Set<number>> = {};
    cards.forEach(card => { result[card.id] = new Set(markedByCard[card.id] ?? []); });
    return result;
  }, [cards, markedByCard]);

  const active = phase === 'running';
  const claimableCards = useMemo(() => {
    if (!active || calledNumbers.length === 0) return [];
    const previous = new Set(calledNumbers.slice(0, -1));
    return cards.filter(card =>
      !card.locked &&
      findWinningPattern(card.grid, called, winPattern).missing === 0 &&
      findWinningPattern(card.grid, previous, winPattern).missing > 0
    );
  }, [active, cards, calledNumbers, called, winPattern]);

  useEffect(() => {
    if (!active || !autoMark || calledNumbers.length === 0) return;
    for (const card of cards) {
      const existing = new Set(markedByCard[card.id] ?? []);
      for (const number of calledNumbers) {
        if (card.grid.some(row => row.includes(number)) && !existing.has(number)) {
          toggleMark(card.id, number);
          existing.add(number);
        }
      }
    }
  }, [active, autoMark, calledNumbers, cards, markedByCard, toggleMark]);

  const celebrated = useRef<number | null>(null);
  const iWon = !!winner && cards.some(card => card.id === winner.cardId);
  useEffect(() => {
    if (!winner || !iWon || celebrated.current === winner.at) return;
    celebrated.current = winner.at;
    play('win');
  }, [winner, iWon]);

  const handleClaim = useCallback(async (cardId: string) => {
    if (claimingCardId) return;
    setClaimingCardId(cardId);
    try { await claimBingo(cardId, calledNumbers.length); }
    finally { setClaimingCardId(null); }
  }, [claimingCardId, claimBingo, calledNumbers.length]);

  const lastCalls = calledNumbers.slice(-5).reverse();
  const lastNumber = calledNumbers[calledNumbers.length - 1];
  const patternCells = useMemo(() => getPatternCells(winPattern), [winPattern]);
  const callTimer = nextCallAt
    ? (() => {
        const seconds = Math.max(0, Math.ceil((nextCallAt - now) / 1000));
        return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
      })()
    : '0:00';

  return (
    <main className="relative mx-auto min-h-full w-full max-w-[1100px] overflow-hidden rounded-[2rem] border-2 border-zinc-500/80 bg-[#030303] px-2 pb-32 pt-2 text-white shadow-[0_0_35px_rgba(212,175,55,.22),inset_0_0_35px_rgba(212,175,55,.08)] sm:px-4 sm:pt-4">
      <div className="pointer-events-none absolute inset-0 -z-0 bg-[radial-gradient(ellipse_at_50%_12%,rgba(255,196,0,.17),transparent_36%),radial-gradient(ellipse_at_50%_100%,rgba(255,196,0,.13),transparent_38%)]" />
      <div className="relative z-10 space-y-2 sm:space-y-3">
        <header className="rounded-2xl border border-yellow-400/90 bg-black px-3 py-2 shadow-[0_0_24px_rgba(250,204,21,.4)]">
          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full border-2 border-yellow-300 text-3xl font-black text-white">‹</span>
              <span className="whitespace-nowrap text-sm font-black text-white sm:text-base">ውጣ</span>
            </div>
            <div className="flex min-w-0 flex-1 items-center justify-center gap-2 border-x border-yellow-500/70 px-2 text-yellow-300">
              <span className="text-4xl leading-none drop-shadow-[0_0_12px_rgba(255,215,0,1)] sm:text-5xl">🏆</span>
              <strong className="whitespace-nowrap text-lg font-black tracking-tight text-yellow-300 drop-shadow-[0_0_12px_rgba(255,215,0,.9)] sm:text-3xl">
                {roundPrizeEtb !== undefined ? formatAmount(lang, roundPrizeEtb) : '—'} ብር
              </strong>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button type="button" onClick={() => setSoundEnabled(!soundEnabled)} aria-label={soundEnabled ? 'Mute sound' : 'Enable sound'} aria-pressed={soundEnabled} className="grid h-10 w-10 place-items-center rounded-full border border-yellow-400/50 text-2xl text-white">{soundEnabled ? '◖))' : '◖̸'}</button>
              <span className="grid h-10 w-7 place-items-center text-3xl text-white">⋮</span>
            </div>
          </div>
        </header>

        <section className="grid grid-cols-[0.9fr_0.65fr_1.8fr] items-start gap-2 rounded-2xl border border-yellow-400 bg-black p-2 shadow-[0_0_18px_rgba(250,204,21,.28)]">
          <div className="flex min-h-[3.4rem] items-center justify-center rounded-xl border border-yellow-400 bg-black px-1.5 text-center text-xs font-black leading-tight text-yellow-300 sm:text-base">
            አሸናፊ ቅርጽ
          </div>
          <div className="flex items-center justify-center pt-1">
            <div className="grid w-full max-w-[6.5rem] grid-cols-5 gap-[2px] rounded-md border border-yellow-300/70 bg-white p-1 shadow-[0_0_12px_rgba(250,204,21,.35)]">
              {Array.from({ length: 25 }, (_, i) => <span key={i} className={`aspect-square rounded-[2px] ${patternCells.includes(i) ? 'bg-green-500 shadow-[0_0_5px_rgba(34,197,94,.9)]' : 'bg-zinc-200'}`} />)}
            </div>
          </div>
          <div className="min-w-0">
            <div className="flex min-h-[3.4rem] items-center justify-around gap-0.5 rounded-xl border border-yellow-400 bg-black px-1 py-1">
              {lastCalls.length ? lastCalls.map((number, index) => <CalledBall key={number} number={number} latest={index === 0} />) : <span className="text-xs text-yellow-100/60">—</span>}
            </div>
            <div className="ml-auto mt-1 w-fit rounded-lg border border-red-500 bg-red-950 px-4 py-0.5 text-lg font-black leading-none text-red-500 shadow-[0_0_12px_rgba(239,68,68,.5)]">
              {callTimer}
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-yellow-400 bg-black p-2 shadow-[0_0_15px_rgba(250,204,21,.2)]">
          <h2 className="mb-1 text-xs font-black text-yellow-100 sm:text-sm">1–75 ቁጥሮች</h2>
          <div className="grid grid-cols-[repeat(15,minmax(0,1fr))] gap-[2px]">
            {Array.from({ length: 60 }, (_, i) => i + 16).map(number => {
              const isCalled = called.has(number);
              const latest = number === lastNumber;
              return <span key={number} className={`grid aspect-square min-w-0 place-items-center rounded-[3px] text-[8px] font-bold tabular-nums sm:text-xs ${latest ? 'bg-orange-500 text-white ring-1 ring-yellow-200' : isCalled ? 'bg-blue-600 text-white' : 'bg-zinc-900 text-zinc-300'}`}>{number}</span>;
            })}
          </div>
        </section>

        <section className="grid grid-cols-5 gap-2">
          <div className="col-span-2 rounded-2xl border border-yellow-400 bg-black p-2 shadow-[0_0_15px_rgba(250,204,21,.2)]">
            <h2 className="mb-2 text-xs font-black text-yellow-100 sm:text-sm">የተጠሩ ቁጥሮች</h2>
            <div className="flex flex-wrap gap-1.5">{lastCalls.length ? lastCalls.map((number, index) => <CalledBall key={number} number={number} latest={index === 0} />) : <span className="text-xs text-yellow-100/60">—</span>}</div>
          </div>
          <div className="col-span-3 rounded-2xl border border-yellow-400 bg-black p-2 shadow-[0_0_15px_rgba(250,204,21,.2)]">
            <h2 className="mb-1 text-xs font-black text-yellow-100 sm:text-sm">1–75 ቁጥሮች</h2>
            <div className="grid grid-cols-[repeat(15,minmax(0,1fr))] gap-[2px]">
              {Array.from({ length: 75 }, (_, i) => i + 1).map(number => {
                const isCalled = called.has(number);
                const latest = number === lastNumber;
                return <span key={number} className={`grid aspect-square min-w-0 place-items-center rounded-[3px] text-[8px] font-bold tabular-nums sm:text-xs ${latest ? 'bg-orange-500 text-white ring-1 ring-yellow-200' : isCalled ? 'bg-blue-600 text-white' : 'bg-zinc-900 text-zinc-300'}`}>{number}</span>;
              })}
            </div>
          </div>
        </section>

        {cards.length > 0 && (
          <section className="grid grid-cols-2 gap-2 sm:gap-4">
            {cards.map((card, index) => (
              <BingoCardView
                key={card.id}
                card={card}
                index={index}
                marks={markSets[card.id] ?? new Set<number>()}
                called={called}
                pattern={winPattern}
                claimable={claimableCards.some(candidate => candidate.id === card.id)}
                claiming={claimingCardId === card.id}
                onClaim={() => void handleClaim(card.id)}
                onToggle={number => toggleMark(card.id, number)}
              />
            ))}
          </section>
        )}

        <footer className="fixed inset-x-0 bottom-[calc(4.6rem+env(safe-area-inset-bottom))] z-30 px-2 sm:px-4">
          <div className="mx-auto flex max-w-[1100px] items-center gap-2 rounded-2xl border border-yellow-400 bg-black/95 p-2 shadow-[0_0_25px_rgba(250,204,21,.35)] backdrop-blur-xl">
            <button type="button" role="switch" aria-checked={autoMark} onClick={() => {
              const next = !autoMark;
              setAutoMark(next);
              try { localStorage.setItem('bgb.autoMark', next ? 'on' : 'off'); } catch { /* ignore */ }
            }} className="flex min-w-0 flex-1 items-center gap-1.5 text-left">
              <span className="text-[10px] font-black text-white sm:text-xs">Auto-Mark</span>
              <span className={`relative h-6 w-10 shrink-0 rounded-full ${autoMark ? 'bg-green-500' : 'bg-zinc-600'}`}><span className={`absolute top-1 h-4 w-4 rounded-full bg-white transition-transform ${autoMark ? 'translate-x-5' : 'translate-x-1'}`} /></span>
            </button>
            <button type="button" onClick={onGoToWallet} className="min-w-0 shrink-0 border-l border-yellow-500/50 px-2 text-left">
              <span className="flex items-center gap-1 text-lg leading-none text-yellow-400">▣ <span className="text-[9px] font-bold text-white sm:text-xs">ቀሪ ሂሳብ</span></span>
              <strong className="text-xs font-black tabular-nums text-yellow-300 sm:text-base">{formatAmount(lang, balance)} ብር</strong>
            </button>
            <button type="button" disabled={claimableCards.length === 0 || !!claimingCardId} onClick={() => void handleClaim(claimableCards[0]?.id)} className="min-w-[34%] rounded-full border-2 border-yellow-200 bg-gradient-to-b from-yellow-200 via-yellow-400 to-amber-600 px-3 py-3 text-base font-black text-black shadow-[0_0_20px_rgba(250,204,21,.5)] disabled:opacity-45 sm:min-w-[30%] sm:text-xl">
              {claimingCardId ? '…' : '♛ BINGO!'}
            </button>
          </div>
        </footer>
      </div>
      {winner && iWon && <div role="status" className="sr-only">BINGO! አሸንፈዋል።</div>}
    </main>
  );
}

export default PlayView;
