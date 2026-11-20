import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { formatAmount } from '@/lib/localization';
import { useLanguage } from '@/context/LanguageContext';
import { usePlayer } from '@/context/PlayerContext';
import { useRound } from '@/context/RoundContext';
import { useAppSettings } from '@/context/AppSettingsContext';
import { play } from '@/lib/audio';
import { findWinningPattern, patternMasks } from '@/lib/bingo';
import type { BingoCard, WinPattern } from '@/types/game';

const LETTERS = ['B', 'I', 'N', 'G', 'O'] as const;
const letterFor = (n: number) => LETTERS[Math.min(4, Math.floor((n - 1) / 15))];
const CARD_ACCENTS = [
  { border: 'border-blue-500', glow: 'shadow-[0_0_18px_rgba(37,99,235,.55)]', head: 'from-blue-700 via-blue-500 to-blue-700' },
  { border: 'border-lime-500', glow: 'shadow-[0_0_18px_rgba(132,204,22,.5)]', head: 'from-green-700 via-lime-600 to-green-700' },
  { border: 'border-fuchsia-500', glow: 'shadow-[0_0_18px_rgba(217,70,239,.5)]', head: 'from-purple-700 via-fuchsia-600 to-purple-700' },
  { border: 'border-orange-500', glow: 'shadow-[0_0_18px_rgba(249,115,22,.5)]', head: 'from-orange-700 via-orange-500 to-orange-700' },
];
const WIN_PATTERN_OPTIONS: { value: WinPattern; label: string }[] = [
  { value: 'any_line', label: 'Any Line' },
  { value: 'horizontal_line', label: 'Horizontal Line' },
  { value: 'vertical_line', label: 'Vertical Line' },
  { value: 'diagonal', label: 'Diagonal' },
  { value: 'two_lines', label: 'Two Lines' },
  { value: 'two_horizontal_lines', label: 'Two Horizontal Lines' },
  { value: 'four_corners', label: 'Four Corners' },
  { value: 'rectangle', label: 'Rectangle' },
  { value: 'two_rectangles', label: 'Two Rectangles' },
  { value: 'half_house', label: 'Half House' },
  { value: 'full_house', label: 'Full House' },
  { value: 'x', label: 'X Pattern' },
  { value: 't', label: 'T Pattern' },
  { value: 'l', label: 'L Pattern' },
  { value: 'plus', label: 'Plus' },
  { value: 'diamond', label: 'Diamond' },
  { value: 'picture_frame', label: 'Picture Frame' },
  { value: 'six_pack', label: 'Six Pack' },
  { value: 'postage_stamp', label: 'Postage Stamp' },
  { value: 'three_lines', label: 'Three Lines' },
  { value: 'four_lines', label: 'Four Lines' },
  { value: 'top_bottom', label: 'Top & Bottom' },
  { value: 'left_right', label: 'Left & Right' },
  { value: 'checkerboard', label: 'Checkerboard' },
  { value: 'center_cross', label: 'Center Cross' },
  { value: 'coverall', label: 'Coverall' },
  { value: 'line_through_free', label: 'Line Through FREE' },
  { value: 'line_avoiding_free', label: 'Line Avoiding FREE' },
  { value: 'two_lines_through_free', label: 'Two Lines Through FREE' },
  { value: 'two_lines_avoiding_free', label: 'Two Lines Avoiding FREE' },
  { value: 'two_rectangles_touching', label: 'Touching Rectangles' },
  { value: 'two_rectangles_separate', label: 'Separate Rectangles' },
  { value: 'inner_frame', label: 'Inner Frame' },
  { value: 'inner_square', label: 'Inner Square' },
  { value: 'four_postage_stamps', label: 'Four Postage Stamps' },
  { value: 'z', label: 'Z Pattern' },
  { value: 'u', label: 'U Pattern' },
  { value: 's', label: 'S Pattern' },
  { value: 'arrow_up', label: 'Arrow Up' },
  { value: 'arrow_down', label: 'Arrow Down' },
  { value: 'star', label: 'Star' },
  { value: 'cross_and_corners', label: 'Cross & Corners' },
  { value: 'frame_and_center', label: 'Frame & Center' },
  { value: 'double_cross', label: 'Double Cross' },
  { value: 'nine_pack', label: 'Nine Pack' },
  { value: 'filled_diamond', label: 'Filled Diamond' },
  { value: 'window_pane', label: 'Window Pane' },
  { value: 'staircase', label: 'Staircase' },
  { value: 'hourglass', label: 'Hourglass' },
  { value: 'bow_tie', label: 'Bow Tie' },
  { value: 'ladder', label: 'Ladder' },
  { value: 'railroad_tracks', label: 'Railroad Tracks' },
  { value: 'lucky_seven', label: 'Lucky Seven' },
  { value: 'letter_h', label: 'Letter H' },
  { value: 'letter_e', label: 'Letter E' },
  { value: 'letter_c', label: 'Letter C' },
  { value: 'letter_n', label: 'Letter N' },
  { value: 'letter_w', label: 'Letter W' },
];
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
  const [patternOpen, setPatternOpen] = useState(false);
  const [numberBoardMode, setNumberBoardMode] = useState<'all' | 'called'>('all');
  const endedAtRef = useRef<number | null>(phase === 'ended' ? (winner?.at ?? Date.now()) : null);
  const previousPhaseRef = useRef(phase);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (phase === 'ended' && previousPhaseRef.current !== 'ended') endedAtRef.current = Date.now();
    if (phase === 'running') endedAtRef.current = null;
    previousPhaseRef.current = phase;
  }, [phase]);

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
  const patternCells = useMemo(() => getPatternCells(winPattern), [winPattern]);
  const callTimer = active && nextCallAt
    ? (() => {
        const seconds = Math.max(0, Math.ceil((nextCallAt - now) / 1000));
        return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
      })()
    : endedAtRef.current !== null
      ? (() => {
          const seconds = Math.max(0, Math.floor((now - endedAtRef.current) / 1000));
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
          <div className="relative">
            <button
              type="button"
              aria-expanded={patternOpen}
              aria-controls="winning-pattern-options"
              onClick={() => setPatternOpen(open => !open)}
              className="flex min-h-[3.4rem] w-full items-center justify-center gap-1 rounded-xl border border-yellow-400 bg-black px-1.5 text-center text-xs font-black leading-tight text-yellow-300 sm:text-base"
            >
              አሸናፊ ቅርጽ <span aria-hidden="true">{patternOpen ? '▴' : '▾'}</span>
            </button>
            {patternOpen && (
              <div id="winning-pattern-options" className="absolute left-0 top-full z-40 mt-1 max-h-64 w-56 max-w-[75vw] overflow-y-auto rounded-xl border border-yellow-400 bg-black p-2 text-left shadow-[0_0_18px_rgba(250,204,21,.35)]">
                <div className="grid grid-cols-2 gap-2">
                  {WIN_PATTERN_OPTIONS.map(option => {
                    const cells = getPatternCells(option.value);
                    return (
                      <button
                        key={option.value}
                        type="button"
                        aria-label={option.label}
                        aria-pressed={option.value === winPattern}
                        onClick={() => setPatternOpen(false)}
                        className={`flex flex-col items-center gap-1 rounded-lg border p-2 transition ${option.value === winPattern ? 'border-yellow-300 bg-yellow-400/15 shadow-[0_0_10px_rgba(250,204,21,.25)]' : 'border-zinc-700 bg-zinc-950 hover:border-yellow-500/60'}`}
                      >
                        <span className="grid aspect-square w-14 grid-cols-5 gap-[2px] rounded bg-zinc-800 p-1">
                          {Array.from({ length: 25 }, (_, index) => (
                            <span key={index} className={`rounded-[1px] ${cells.includes(index) ? 'bg-yellow-300 shadow-[0_0_3px_rgba(250,204,21,.7)]' : 'bg-zinc-700'}`} />
                          ))}
                        </span>
                        <span className="text-center text-[10px] font-bold leading-tight text-yellow-100">{option.label}</span>
                        {option.value === winPattern && <span className="text-[9px] font-black text-yellow-300">✓</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
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

        <section aria-label="BINGO number board" className="rounded-2xl border border-yellow-400 bg-black p-2 shadow-[0_0_18px_rgba(250,204,21,.22)] sm:p-3">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-black tracking-wide text-yellow-300 sm:text-base">BINGO ቁጥሮች</h2>
            <div className="flex items-center gap-1 rounded-lg border border-yellow-500/60 bg-zinc-950 p-1">
              <button type="button" aria-pressed={numberBoardMode === 'all'} onClick={() => setNumberBoardMode('all')} className={`rounded-md px-3 py-1.5 text-xs font-black transition sm:text-sm ${numberBoardMode === 'all' ? 'bg-yellow-400 text-black shadow' : 'text-yellow-200 hover:bg-yellow-400/10'}`}>1–75</button>
              <button type="button" aria-pressed={numberBoardMode === 'called'} onClick={() => setNumberBoardMode('called')} className={`rounded-md px-3 py-1.5 text-xs font-black transition sm:text-sm ${numberBoardMode === 'called' ? 'bg-yellow-400 text-black shadow' : 'text-yellow-200 hover:bg-yellow-400/10'}`}>የተጠሩ</button>
            </div>
          </div>
          <div className="space-y-1.5">
            {LETTERS.map((letter, row) => (
              <div key={letter} className="grid grid-cols-[1.5rem_repeat(15,minmax(0,1fr))] items-stretch gap-1 sm:grid-cols-[2.25rem_repeat(15,minmax(0,1fr))] sm:gap-1.5">
                <div className={`grid place-items-center rounded-md text-sm font-black text-black shadow-inner sm:text-lg ${['bg-blue-400','bg-red-400','bg-emerald-400','bg-amber-300','bg-orange-400'][row]}`}>
                  {letter}
                </div>
                {Array.from({ length: 15 }, (_, col) => {
                  const number = row * 15 + col + 1;
                  const isCalled = called.has(number);
                  const visible = numberBoardMode === 'all' || isCalled;
                  return (
                    <div key={number} aria-label={visible ? `${letter} ${number}${isCalled ? ', called' : ''}` : undefined} className={`grid aspect-square min-w-0 place-items-center rounded-[4px] border text-[9px] font-black tabular-nums transition sm:text-sm ${!visible ? 'border-transparent bg-transparent text-transparent' : isCalled ? 'border-yellow-200 bg-blue-600 text-white shadow-[0_0_8px_rgba(59,130,246,.65)]' : 'border-yellow-500/20 bg-zinc-900 text-yellow-100/75'}`}>
                      {visible ? number : ''}
                    </div>
                  );
                })}
              </div>
            ))}
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
