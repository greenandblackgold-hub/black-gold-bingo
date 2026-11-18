/**
 * src/components/play/PlayView.tsx
 *
 * Core gameplay screen: current called ball, side-by-side player cards,
 * tap-to-mark cells, "N to go" progress, and a BINGO claim bar with confetti.
 * Reads from usePlayer() and useRound(); shared types live in '@/types/game'.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { translations } from '@/lib/localization';
import { useLanguage } from '@/context/LanguageContext';
import { usePlayer } from '@/context/PlayerContext';
import { useRound } from '@/context/RoundContext';
import { play } from '@/lib/audio';
import { findWinningPattern } from '@/lib/bingo';
import type { BingoCard, Lang, Pos, WinPattern } from '@/types/game';
import { PlayerFeatures } from '@/components/play/PlayerFeatures';

/* ───────────────────────────── CONTEXT WIRING ───────────────────────────── */

function usePlayData() {
  const { lang } = useLanguage();
  const { cards, markedByCard, toggleMark } = usePlayer();
  const { phase, winPattern, roundNumber, calledNumbers, claimBingo, winner } = useRound();
  return { lang: lang as Lang, cards, markedByCard, toggleMark, phase, winPattern, roundNumber, calledNumbers, claimBingo, winner };
}

/* ─────────────────────────── TRANSLATIONS ─────────────────────────── */
/* Move these into your central translation file if you prefer.
   Tigrigna strings should be reviewed by a native speaker. */

const STRINGS = translations.play;

type StringKey = keyof (typeof STRINGS)['en'];


/* ───────────────────────────── GAME LOGIC ───────────────────────────── */

const LETTERS = ['B', 'I', 'N', 'G', 'O'] as const;
const letterFor = (n: number) => LETTERS[Math.min(4, Math.floor((n - 1) / 15))];

const LINES: Pos[][] = (() => {
  const out: Pos[][] = [];
  for (let i = 0; i < 5; i++) {
    out.push(Array.from({ length: 5 }, (_, c) => [i, c] as Pos)); // row
    out.push(Array.from({ length: 5 }, (_, r) => [r, i] as Pos)); // column
  }
  out.push(Array.from({ length: 5 }, (_, i) => [i, i] as Pos));
  out.push(Array.from({ length: 5 }, (_, i) => [i, 4 - i] as Pos));
  return out;
})();

/** A cell counts only if it is FREE, or marked AND actually called. */
function analyze(grid: (number | null)[][], marks: Set<number>, called: Set<number>, pattern: import('@/types/game').WinPattern) {
  const eligible = new Set([...called].filter((n) => marks.has(n)));
  const result = findWinningPattern(grid, eligible, pattern);
  return { toGo: result.missing, winningLine: result.missing === 0 ? result.positions : null };
}

type BallProps = { n: number; size?: 'sm' | 'lg' };

/** Self-contained called-number ball used by the play screen. */
function Ball({ n, size = 'lg' }: BallProps) {
  const compact = size === 'sm';
  return (
    <div
      aria-label={`${letterFor(n)} ${n}`}
      className={[
        'grid shrink-0 place-items-center rounded-full border-4 border-gold-300',
        'bg-gradient-to-br from-gold-200 via-gold-400 to-gold-700 text-darkbg',
        'shadow-[inset_-5px_-7px_12px_rgba(0,0,0,0.25),0_8px_24px_rgba(0,0,0,0.3)]',
        compact ? 'h-10 w-10 border-2 text-xs' : 'bg-ball-pop h-32 w-32 text-4xl sm:h-40 sm:w-40',
      ].join(' ')}
    >
      <span className={compact ? 'text-[9px] font-black' : 'text-sm font-black'}>{letterFor(n)}</span>
      <strong className={compact ? 'text-sm leading-none' : 'text-4xl leading-none'}>{n}</strong>
    </div>
  );
}

type CardViewProps = {
  card: BingoCard;
  marks: Set<number>;
  called: Set<number>;
  active: boolean;
  t: (key: StringKey) => string;
  onToggle: (n: number) => void;
  pattern: WinPattern;
  markColor: string;
  onClaim: () => void;
  isWinner: boolean;
};

function CardView({ card, marks, called, active, t, onToggle, pattern, markColor, onClaim, isWinner }: CardViewProps) {
  const { toGo, winningLine } = useMemo(() => analyze(card.grid, marks, called, pattern), [card.grid, marks, called, pattern]);
  const winSet = useMemo(() => new Set((winningLine ?? []).map(([r, c]) => `${r}-${c}`)), [winningLine]);
  const hasWin = !!winningLine;

  return (
    <section
      className={[
        'relative overflow-hidden rounded-[1.35rem] border bg-[linear-gradient(145deg,rgba(255,255,255,0.055),rgba(255,255,255,0.012)_38%,rgba(0,0,0,0.18))] p-3 shadow-xl shadow-black/25 transition-all duration-300 sm:p-4',
        hasWin
          ? 'border-gold-300/90 ring-2 ring-gold-400/80 shadow-[0_0_42px_-8px_rgba(255,215,0,0.58)]'
          : 'border-gold-700/45 ring-1 ring-gold-700/25 hover:border-gold-500/60',
      ].join(' ')}
    >
      {hasWin && (
        <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-transparent via-gold-300 to-transparent" aria-hidden="true" />
      )}
      <header className="mb-3 flex items-center justify-center">
        <button
          type="button"
          onClick={onClaim}
          disabled={!hasWin || !active || isWinner}
          aria-label={isWinner ? 'BINGO winner' : hasWin ? 'Claim BINGO' : `BINGO, ${toGo} ${t('toGo')}`}
          className={[
            'rounded-xl border-2 px-5 py-2 text-base font-black tracking-[0.22em] transition-all',
            hasWin || isWinner
              ? 'border-red-300 bg-red-600 text-white shadow-[0_0_22px_rgba(239,68,68,.75)] bg-bingo-flash'
              : 'border-gold-700/50 bg-black/30 text-gold-400',
            !hasWin || !active || isWinner ? 'cursor-default' : 'cursor-pointer hover:scale-[1.03] active:scale-95',
          ].join(' ')}
        >
          BINGO
        </button>
      </header>

      <div className="rounded-2xl border border-gold-700/35 bg-black/25 p-2.5 shadow-inner shadow-black/30 sm:p-3">
        <div className="mb-2 grid grid-cols-5 gap-1.5 text-center">
          {LETTERS.map((l) => (
            <span key={l} className="rounded-lg border border-gold-500/20 bg-gradient-to-b from-gold-400/20 to-gold-500/[0.04] py-1.5 text-xs font-black tracking-widest text-gold-300 shadow-sm sm:py-2 sm:text-sm">
              {l}
            </span>
          ))}
        </div>

        <div className="grid grid-cols-5 gap-1.5 sm:gap-2">
        {card.grid.flatMap((row, r) =>
          row.map((v, c) => {
            const isFree = v === null;
            const isMarked = isFree || marks.has(v);
            const isCalled = !isFree && called.has(v);
            const inWin = winSet.has(`${r}-${c}`);
            return (
              <button
                key={`${r}-${c}`}
                style={isMarked ? { backgroundColor: markColor } : undefined}
                type="button"
                disabled={isFree || !active}
                aria-pressed={isMarked}
                aria-label={isFree ? t('free') : `${LETTERS[c]} ${v}`}
                onClick={() => v !== null && isCalled && onToggle(v)}
                className={[
                  'relative grid aspect-square min-w-0 place-items-center overflow-hidden rounded-lg border text-lg font-black tabular-nums shadow-sm transition-all duration-200 active:scale-[0.91] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-200 sm:rounded-xl sm:text-2xl',
                  isMarked && !isCalled
                    ? 'border-white/70 text-[#17130a] shadow-[inset_0_1px_0_rgba(255,255,255,.65),0_3px_12px_rgba(212,175,55,.22)] bg-cell-mark'
                    : 'border-white/[0.055] bg-gradient-to-br from-white/[0.065] to-white/[0.015] text-gold-200/90 hover:border-gold-500/40',
                  isCalled
                    ? isMarked ? 'border-white/80 text-[#17130a] ring-1 ring-white/80' : 'bg-gradient-to-br from-sky-400 via-blue-500 to-blue-700 border-white text-white ring-1 ring-white/80 shadow-[0_0_12px_rgba(59,130,246,.55)]'
                    : '',
                  inWin ? 'z-[1] outline outline-2 outline-white shadow-[0_0_18px_rgba(255,245,190,.75)]' : '',
                ].join(' ')}
              >
                {isFree ? <span className="text-xs font-black">★</span> : v}
              </button>
            );
          }),
        )}
        </div>
      </div>
    </section>
  );
}

/* ───────────────────────────── MAIN VIEW ───────────────────────────── */

export function PlayView({ onGoToWallet }: { onGoToWallet: () => void }) {
  const { lang, cards, markedByCard, toggleMark, phase, winPattern, roundNumber, calledNumbers, claimBingo, winner } = usePlayData();
  const t = (k: StringKey) => (STRINGS[lang] ?? STRINGS.en)[k];

  const called = useMemo(() => new Set(calledNumbers), [calledNumbers]);
  const current = calledNumbers.length ? calledNumbers[calledNumbers.length - 1] : null;
  const active = phase === 'running';

  const markSets = useMemo(() => {
    const m: Record<string, Set<number>> = {};
    for (const c of cards) m[c.id] = new Set(markedByCard[c.id] ?? []);
    return m;
  }, [cards, markedByCard]);

  const winners = useMemo(
    () => (active ? cards.filter((c) => analyze(c.grid, markSets[c.id], called, winPattern).winningLine) : []),
    [active, cards, markSets, called, winPattern],
  );

  const [claiming, setClaiming] = useState(false);
  const [cardColumns, setCardColumns] = useState(2);
  const [autoMarkEnabled, setAutoMarkEnabled] = useState(false);
  const [selectedCardIds, setSelectedCardIds] = useState<string[]>([]);
  const [cardOrder, setCardOrder] = useState<'oldest'|'newest'>('oldest');
  const [markColor, setMarkColor] = useState('#d4af37');
  const [confetti, setConfetti] = useState(false);
  const stopConfetti = useCallback(() => setConfetti(false), []);
  const [sentRound, setSentRound] = useState<number | null>(null);
  const claimed = sentRound === roundNumber;
  const [message, setMessage] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const messageTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => clearTimeout(messageTimer.current), []);

  useEffect(() => {
    const load = () => { try { const cols=Number(localStorage.getItem('bgb.cardsPerRow')); setCardColumns([2,3,4].includes(cols)?cols:2); setAutoMarkEnabled(localStorage.getItem('bgb.autoMark')==='on'); setCardOrder(localStorage.getItem('bgb.cardOrder')==='newest'?'newest':'oldest'); setMarkColor(localStorage.getItem('bgb.markColor')||'#d4af37'); const ids=JSON.parse(localStorage.getItem('bgb.selectedCards')||'[]'); setSelectedCardIds(Array.isArray(ids)?ids:[]); } catch { /* retain defaults */ } };
    load(); window.addEventListener('bgb-player-settings',load); return ()=>window.removeEventListener('bgb-player-settings',load);
  }, []);

  useEffect(() => {
    if (!autoMarkEnabled || !active || calledNumbers.length===0) return;
    for (const card of cards) { const marks=new Set(markedByCard[card.id]??[]); for (const n of calledNumbers) if (card.grid.some(row=>row.includes(n)) && !marks.has(n)) { toggleMark(card.id,n); marks.add(n); } }
  }, [autoMarkEnabled,active,calledNumbers,cards,markedByCard,toggleMark]);

  const flash = (kind: 'ok' | 'err', text: string) => {
    setMessage({ kind, text });
    clearTimeout(messageTimer.current);
    messageTimer.current = setTimeout(() => setMessage(null), 5000);
  };

  // The host decides: celebrate when the accepted winner is one of my cards.
  const celebrated = useRef<number | null>(null);
  const iWon = !!winner && cards.some((c) => c.id === winner.cardId);
  useEffect(() => {
    if (!winner || !iWon || celebrated.current === winner.at) return;
    celebrated.current = winner.at;
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) setConfetti(true);
    flash('ok', t('won'));
    play('win');
  }, [winner, iWon]);

  const handleClaim = async (cardId?: string) => {
    const target = cardId ? cards.find((card) => card.id === cardId && winners.some((item) => item.id === cardId)) : winners[0];
    if (!target || claiming) return;
    setClaiming(true);
    try {
      const res = await claimBingo(target.id);
      if (res.ok) {
        setSentRound(roundNumber);
        flash('ok', t('claimSent'));
      } else {
        flash('err', t('invalid'));
      }
    } catch {
      flash('err', t('invalid'));
    } finally {
      setClaiming(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 pb-2">
      <PlayerFeatures onGoToWallet={onGoToWallet} />
      <style>{`
        @keyframes bingoFlash { 0%,100% { opacity:1; filter:brightness(1); box-shadow:0 0 12px rgba(239,68,68,.55) } 50% { opacity:.42; filter:brightness(1.7); box-shadow:0 0 30px rgba(239,68,68,1) } }
        .bg-bingo-flash { animation: bingoFlash .85s ease-in-out infinite; }
        @keyframes calledNumberFlash { 0%,100% { transform:scale(1); filter:brightness(1); box-shadow:0 0 8px currentColor } 50% { transform:scale(1.13); filter:brightness(1.7); box-shadow:0 0 20px currentColor } }
        .bg-called-latest { animation: calledNumberFlash .8s ease-in-out infinite; }
        @keyframes bgBallPop {
          0% { transform: scale(.68) rotate(-9deg); opacity: 0; filter: brightness(1.35); }
          68% { transform: scale(1.07) rotate(2deg); opacity: 1; }
          100% { transform: scale(1) rotate(0); opacity: 1; filter: brightness(1); }
        }
        @keyframes bgBallGlow {
          0%, 100% { box-shadow: inset -5px -7px 12px rgba(0,0,0,.25), 0 8px 24px rgba(0,0,0,.3), 0 0 0 rgba(255,215,0,0); }
          50% { box-shadow: inset -5px -7px 12px rgba(0,0,0,.25), 0 8px 24px rgba(0,0,0,.3), 0 0 34px rgba(255,215,0,.28); }
        }
        @keyframes bgHint { 0%,100% { box-shadow: 0 0 0 0 rgba(255,215,0,.0) } 50% { box-shadow: 0 0 14px 1px rgba(255,215,0,.45) } }
        @keyframes bgCellMark {
          0% { transform: scale(.9); filter: brightness(1.35); }
          65% { transform: scale(1.035); }
          100% { transform: scale(1); filter: brightness(1); }
        }
        @keyframes bgWinnerReveal {
          0% { opacity: 0; transform: translateY(10px) scale(.985); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
        .bg-cell-mark { animation: bgCellMark 260ms cubic-bezier(.2,.8,.2,1) both; }
        .bg-winner-reveal { animation: bgWinnerReveal 420ms cubic-bezier(.2,.8,.2,1) both; }
        @keyframes bgConfetti { to { transform: translate3d(0,110vh,0) rotate(var(--rot)); opacity: .9 } }
        .bg-confetti { will-change: transform, opacity; backface-visibility: hidden; }
        .bg-ball-pop { animation: bgBallPop 620ms cubic-bezier(.2,.8,.2,1) both, bgBallGlow 2.8s ease-in-out 620ms 2; }
        @media (prefers-reduced-motion: reduce) {
          .bg-anim, .bg-ball-pop, .bg-cell-mark, .bg-winner-reveal, .bg-confetti, .bg-bingo-flash, .bg-called-latest { animation: none !important; }
        }
      `}</style>

      <section className="rounded-2xl border border-gold-700/40 bg-zinc-950/80 p-3 shadow-xl sm:p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-base font-black tracking-wide text-gold-200 sm:text-lg">የተጠሩ ቁጥሮች</h2>
          <span className="rounded-full border border-gold-500/30 bg-black/40 px-3 py-1 text-xs font-bold tabular-nums text-gold-300">{calledNumbers.length}/75</span>
        </div>
        <div className="grid grid-cols-5 gap-1.5 sm:gap-2">
          {LETTERS.map((letter, column) => {
            const palette = [
              'bg-orange-500 text-white border-orange-200',
              'bg-sky-600 text-white border-sky-200',
              'bg-emerald-600 text-white border-emerald-200',
              'bg-violet-600 text-white border-violet-200',
              'bg-rose-600 text-white border-rose-200',
            ][column];
            return <div key={letter} className="min-w-0 rounded-xl border border-white/10 bg-black/30 p-1.5 sm:p-2">
              <h3 className="mb-1.5 text-center text-base font-black text-gold-200 sm:text-lg">{letter}</h3>
              <div className="grid grid-cols-3 gap-1 sm:grid-cols-2 md:grid-cols-3">
                {Array.from({length:15},(_,index)=>column*15+index+1).map((number)=>{
                  const isCalled=called.has(number);
                  const isLatest=number===current;
                  return <span key={number} aria-label={`${letter}-${number}${isCalled?' called':''}`} className={[
                    'grid min-h-7 place-items-center rounded-md border border-transparent py-1 text-xs font-black tabular-nums sm:min-h-8 sm:text-sm',
                    isCalled ? palette : 'bg-white/[0.035] text-gold-700',
                    isLatest ? 'bg-called-latest ring-2 ring-white' : '',
                  ].join(' ')}>{number}</span>;
                })}
              </div>
            </div>;
          })}
        </div>
      </section>

      {winner && (
        <div className="space-y-2">
          <div className="bg-winner-reveal relative isolate overflow-hidden rounded-[1.5rem] border border-gold-300/50 bg-[radial-gradient(ellipse_at_top,rgba(255,215,0,.18),transparent_62%),linear-gradient(135deg,rgba(212,175,55,.12),rgba(15,15,18,.96)_58%)] p-4 text-center shadow-[0_12px_44px_-18px_rgba(255,215,0,.45)] ring-1 ring-gold-500/20 sm:p-5">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold-200 to-transparent" aria-hidden="true" />
            <p className="text-[10px] font-black uppercase tracking-[0.28em] text-gold-500">
              {iWon ? '✦ VICTORY ✦' : 'ROUND RESULT'}
            </p>
            <p role="status" className="mt-2 text-lg font-black text-gold-100 sm:text-2xl">
              {iWon ? t('won') : `${t('winnerBanner')} #${winner.serial}`}
            </p>
            {iWon && (
              <p className="mx-auto mt-2 max-w-xl rounded-xl border border-gold-500/20 bg-black/20 px-3 py-2 text-xs leading-relaxed text-gold-300 sm:text-sm">
                {t('pendingPrize')}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Cards */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold text-gold-300">
            {t('myCards')} {cards.length > 0 && <span className="text-gold-500">({cards.length})</span>}
          </h2>
          {phase === 'waiting' && <span className="text-sm text-gold-500">{t('waiting')}</span>}
        </div>

        {cards.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gold-700/60 p-8 text-center">
            <p className="font-semibold text-gold-300">{t('noCards')}</p>
            <p className="mt-1 text-sm text-gold-500">{t('noCardsHint')}</p>
            <button
              type="button"
              onClick={onGoToWallet}
              className="mt-4 rounded-xl bg-gradient-to-br from-gold-300 via-gold-500 to-gold-600 px-5 py-2.5 font-bold text-darkbg active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold-300"
            >
              {t('goWallet')}
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto pb-3">
            <div className="grid min-w-max gap-4" style={{gridTemplateColumns: `repeat(${cardColumns}, minmax(230px, 1fr))`}}>
              {[...cards].sort((a,b)=>cardOrder==='oldest'?Number(a.serial)-Number(b.serial):Number(b.serial)-Number(a.serial)).filter(card=>selectedCardIds.length===0||selectedCardIds.includes(card.id)).map((card) => (
                <CardView
                  key={card.id}
                  card={card}
                  marks={markSets[card.id]}
                  called={called}
                  active={active}
                  t={t}
                  onToggle={(n) => toggleMark(card.id, n)}
                  pattern={winPattern}
                  markColor={markColor}
                  onClaim={() => void handleClaim(card.id)}
                  isWinner={winner?.cardId === card.id}
                />
              ))}
            </div>
          </div>
        )}
      </div>


      {/* Claim bar (sits above BottomNav) */}
      {(winners.length > 0 || message) && (
        <div className="fixed inset-x-0 bottom-24 z-40 px-4">
          <div className="mx-auto max-w-md space-y-2">
            {message && (
              <p
                role="status"
                className={[
                  'rounded-xl px-4 py-2 text-center text-sm font-semibold',
                  message.kind === 'ok' ? 'bg-gold-400 text-darkbg' : 'bg-red-900/80 text-red-100',
                ].join(' ')}
              >
                {message.text}
              </p>
            )}
            {winners.length > 0 && (
              <button
                type="button"
                onClick={handleClaim}
                disabled={claiming || claimed}
                className="w-full rounded-2xl bg-gradient-to-br from-gold-300 via-gold-400 to-gold-600 py-4 text-xl font-black text-darkbg shadow-[0_10px_40px_-6px_rgba(255,215,0,0.7)] active:scale-95 disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
              >
                {claiming ? t('claiming') : claimed ? t('claimWaiting') : t('claim')}
              </button>
            )}
          </div>
        </div>
      )}

      {confetti && <Confetti onDone={stopConfetti} />}
    </div>
  );
}

function Confetti({ onDone }: { onDone: () => void }) {
  const particleCount = window.matchMedia('(max-width: 640px)').matches ? 14 : 28;
  useEffect(() => {
    const timer = window.setTimeout(onDone, 2700);
    return () => window.clearTimeout(timer);
  }, [onDone]);

  return (
    <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden" aria-hidden="true">
      {Array.from({ length: particleCount }, (_, i) => (
        <span
          key={i}
          className="bg-confetti absolute top-0 h-3 w-2 rounded-sm bg-gold-400 animate-[bgConfetti_2s_ease-out_forwards]"
          style={{
            left: `${(i * 37) % 100}%`,
            animationDelay: `${(i % 8) * 0.08}s`,
            ['--rot' as string]: `${i % 2 ? 360 : -360}deg`,
          } as React.CSSProperties}
        />
      ))}
    </div>
  );
}

export default PlayView;
