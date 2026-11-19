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
  const { phase, winPattern, calledNumbers, claimBingo, winner } = useRound();
  return { lang: lang as Lang, cards, markedByCard, toggleMark, phase, winPattern, calledNumbers, claimBingo, winner };
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
  t: (key: StringKey) => string;
  pattern: WinPattern;
  markColor: string;
  canClaim: boolean;
  claiming: boolean;
  onClaim: () => void;
};

function CardView({ card, marks, called, t, pattern, markColor, isWinner, canClaim, claiming, onClaim }: CardViewProps & { isWinner: boolean }) {
  const { winningLine } = useMemo(() => analyze(card.grid, marks, called, pattern), [card.grid, marks, called, pattern]);
  const winSet = useMemo(() => new Set((winningLine ?? []).map(([r, c]) => `${r}-${c}`)), [winningLine]);

  return (
    <section
      className={[
        'relative min-w-0 w-full overflow-hidden rounded-[1.35rem] border bg-[linear-gradient(145deg,rgba(255,255,255,0.055),rgba(255,255,255,0.012)_38%,rgba(0,0,0,0.18))] p-1.5 shadow-xl shadow-black/25 transition-all duration-300 sm:p-4',
        isWinner
          ? 'border-red-400 ring-2 ring-yellow-300 shadow-[0_0_42px_-8px_rgba(255,80,40,0.72)]'
          : 'border-gold-700/45 ring-1 ring-gold-700/25 hover:border-gold-500/60',
      ].join(' ')}
    >
      <header className="mb-2 flex items-center justify-between gap-2 sm:mb-3">
        <span className="rounded-md border border-gold-500/25 bg-black/30 px-2 py-1 text-xs font-black tabular-nums tracking-wider text-gold-300">#{String(card.serial).padStart(5, '0')}</span>
        {card.locked ? (
          <span role="status" className="rounded-lg border border-red-500/50 bg-red-950/60 px-3 py-1 text-xs font-black tracking-[0.16em] text-red-200">LOCKED</span>
        ) : canClaim ? (
          <button type="button" onClick={onClaim} disabled={claiming} aria-label="Claim BINGO" className="bg-bingo-winner-flash cursor-pointer rounded-lg px-4 py-1 text-lg font-black tracking-[0.24em] text-yellow-100 disabled:cursor-wait sm:text-2xl">
            BINGO
          </button>
        ) : (
          <span className={isWinner ? 'bg-bingo-winner-flash rounded-lg px-4 py-1 text-lg font-black tracking-[0.24em] text-yellow-100 sm:text-2xl' : 'rounded-lg px-4 py-1 text-lg font-black tracking-[0.24em] text-gold-300 sm:text-2xl'}>
            BINGO
          </span>
        )}
      </header>

      <div className="min-w-0 rounded-xl border border-gold-700/35 bg-black/25 p-1.5 shadow-inner shadow-black/30 sm:rounded-2xl sm:p-3">
        <div className="mb-1 grid grid-cols-5 gap-0.5 text-center sm:mb-2 sm:gap-1.5">
          {LETTERS.map((l) => (
            <span key={l} className="rounded-lg border border-gold-500/20 bg-gradient-to-b from-gold-400/20 to-gold-500/[0.04] py-1.5 text-xs font-black tracking-widest text-gold-300 shadow-sm sm:py-2 sm:text-sm">
              {l}
            </span>
          ))}
        </div>

        <div className="grid min-w-0 grid-cols-5 gap-0.5 sm:gap-2">
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
                disabled
                aria-pressed={isMarked}
                aria-label={isFree ? t('free') : `${LETTERS[c]} ${v}`}
                className={[
                  'relative grid aspect-square min-w-0 place-items-center overflow-hidden rounded-md border text-[10px] font-extrabold tabular-nums shadow-sm transition-all duration-200 active:scale-[0.91] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-200 sm:rounded-xl sm:text-lg',
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
  const { lang, cards, markedByCard, toggleMark, phase, winPattern, calledNumbers, claimBingo, winner } = usePlayData();
  const t = (k: StringKey) => (STRINGS[lang] ?? STRINGS.en)[k];

  const called = useMemo(() => new Set(calledNumbers), [calledNumbers]);
  const active = phase === 'running';

  const markSets = useMemo(() => {
    const m: Record<string, Set<number>> = {};
    for (const c of cards) m[c.id] = new Set(markedByCard[c.id] ?? []);
    return m;
  }, [cards, markedByCard]);

  // The flashing claim button appears only on the exact call that first completes a card.
  // A later call expires it, even when the card remains complete.
  const claimableCards = useMemo(() => {
    if (!active || calledNumbers.length === 0) return [];
    const beforeLastCall = new Set(calledNumbers.slice(0, -1));
    return cards.filter((card) => !card.locked &&
      findWinningPattern(card.grid, called, winPattern).missing === 0 &&
      findWinningPattern(card.grid, beforeLastCall, winPattern).missing > 0
    );
  }, [active, cards, calledNumbers, called, winPattern]);

  const [claimingCardId, setClaimingCardId] = useState<string | null>(null);
  const [cardColumns, setCardColumns] = useState(2);
  const [selectedCardIds, setSelectedCardIds] = useState<string[]>([]);
  const [cardOrder, setCardOrder] = useState<'oldest'|'newest'>('oldest');
  const [markColor, setMarkColor] = useState('#d4af37');
  const [confetti, setConfetti] = useState(false);
  const stopConfetti = useCallback(() => setConfetti(false), []);
  

  useEffect(() => {
    const load = () => { try { const cols=Number(localStorage.getItem('bgb.cardsPerRow')); setCardColumns([2,3,4].includes(cols)?cols:2);  setCardOrder(localStorage.getItem('bgb.cardOrder')==='newest'?'newest':'oldest'); setMarkColor(localStorage.getItem('bgb.markColor')||'#d4af37'); const ids=JSON.parse(localStorage.getItem('bgb.selectedCards')||'[]'); setSelectedCardIds(Array.isArray(ids)?ids:[]); } catch { /* retain defaults */ } };
    load(); window.addEventListener('bgb-player-settings',load); return ()=>window.removeEventListener('bgb-player-settings',load);
  }, []);

  useEffect(() => {
    if (!active || calledNumbers.length===0) return;
    for (const card of cards) { const marks=new Set(markedByCard[card.id]??[]); for (const n of calledNumbers) if (card.grid.some(row=>row.includes(n)) && !marks.has(n)) { toggleMark(card.id,n); marks.add(n); } }
  }, [active,calledNumbers,cards,markedByCard,toggleMark]);

  // The host decides: celebrate when the accepted winner is one of my cards.
  const celebrated = useRef<number | null>(null);
  const iWon = !!winner && cards.some((c) => c.id === winner.cardId);
  useEffect(() => {
    if (!winner || !iWon || celebrated.current === winner.at) return;
    celebrated.current = winner.at;
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) setConfetti(true);
    play('win');
  }, [winner, iWon]);

  const handleClaim = async (cardId: string) => {
    if (claimingCardId) return;
    setClaimingCardId(cardId);
    try {
      await claimBingo(cardId, calledNumbers.length);
    } finally {
      setClaimingCardId(null);
    }
  };

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 pb-2">
      <PlayerFeatures onGoToWallet={onGoToWallet} />
      <style>{`
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
        @keyframes bgBingoWinnerFlash {
          0%, 100% { color: #fff2a6; background: rgba(220,38,38,.96); text-shadow: 0 0 5px #fff, 0 0 16px #facc15; box-shadow: 0 0 10px #ef4444, 0 0 24px #facc15; }
          50% { color: #fff; background: rgba(234,179,8,.98); text-shadow: 0 0 8px #fff, 0 0 22px #ef4444; box-shadow: 0 0 18px #facc15, 0 0 34px #ef4444; }
        }
        .bg-bingo-winner-flash { animation: bgBingoWinnerFlash 650ms ease-in-out infinite; }
        .bg-cell-mark { animation: bgCellMark 260ms cubic-bezier(.2,.8,.2,1) both; }
        .bg-winner-reveal { animation: bgWinnerReveal 420ms cubic-bezier(.2,.8,.2,1) both; }
        @keyframes bgConfetti { to { transform: translate3d(0,110vh,0) rotate(var(--rot)); opacity: .9 } }
        .bg-confetti { will-change: transform, opacity; backface-visibility: hidden; }
        .bg-ball-pop { animation: bgBallPop 620ms cubic-bezier(.2,.8,.2,1) both, bgBallGlow 2.8s ease-in-out 620ms 2; }
        @media (prefers-reduced-motion: reduce) {
          .bg-anim, .bg-ball-pop, .bg-cell-mark, .bg-winner-reveal, .bg-confetti, .bg-bingo-winner-flash { animation: none !important; }
        }
      `}</style>

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
                {t('prizeCredited')}
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

        {cards.length === 0 ? null : (
          <div className="grid w-full min-w-0 gap-2 sm:gap-4" style={{gridTemplateColumns: `repeat(${cardColumns}, minmax(0, 1fr))`}}>
            {[...cards].sort((a,b)=>cardOrder==='oldest'?Number(a.serial)-Number(b.serial):Number(b.serial)-Number(a.serial)).filter(card=>selectedCardIds.length===0||selectedCardIds.includes(card.id)).map((card) => (
              <CardView
                key={card.id}
                card={card}
                marks={markSets[card.id]}
                called={called}
                t={t}
                pattern={winPattern}
                markColor={markColor}
                isWinner={winner?.cardId === card.id}
                canClaim={claimableCards.some((candidate) => candidate.id === card.id)}
                claiming={claimingCardId === card.id}
                onClaim={() => void handleClaim(card.id)}
              />
            ))}
          </div>
        )}
      </div>


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
