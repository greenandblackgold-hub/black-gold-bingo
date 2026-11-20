/**
 * src/components/play/PlayView.tsx
 *
 * Core gameplay screen: current called ball, side-by-side player cards,
 * tap-to-mark cells, "N to go" progress, and a BINGO claim bar with confetti.
 * Reads from usePlayer() and useRound(); shared types live in '@/types/game'.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { formatAmount, translations } from '@/lib/localization';
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
  const { phase, winPattern, calledNumbers, claimBingo, winner, loaded, roundNumber, nextCallAt, roundPrizeEtb } = useRound();
  return { lang: lang as Lang, cards, markedByCard, toggleMark, phase, winPattern, calledNumbers, claimBingo, winner, loaded, roundNumber, nextCallAt, roundPrizeEtb };
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
  onToggleMark: (number: number) => void;
};

function CardView({ card, marks, called, t, pattern, markColor, isWinner, canClaim, claiming, onClaim, onToggleMark }: CardViewProps & { isWinner: boolean }) {
  const { toGo, winningLine } = useMemo(() => analyze(card.grid, marks, called, pattern), [card.grid, marks, called, pattern]);
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
        <div className="flex min-w-0 items-center gap-2"><span className="rounded-md border border-gold-500/25 bg-black/30 px-2 py-1 text-xs font-black tabular-nums tracking-wider text-gold-300">CARD #{String(card.serial).padStart(5, '0')}</span>{!card.locked && toGo > 0 && toGo <= 2 && <span className="rounded-full border border-amber-300/60 bg-amber-400/15 px-2 py-1 text-[10px] font-black text-amber-200">{toGo} TO GO</span>}</div>
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
                disabled={v === null || !called.has(v)}
                onClick={() => { if (v !== null && called.has(v)) onToggleMark(v); }}
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
                {isFree ? <span className="text-[9px] font-black tracking-wide sm:text-xs">FREE ★</span> : v}
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
  const { lang, cards, markedByCard, toggleMark, phase, winPattern, calledNumbers, claimBingo, winner, loaded, roundNumber, nextCallAt, roundPrizeEtb } = usePlayData();
  const { balance } = usePlayer();
  const t = (k: StringKey) => (STRINGS[lang] ?? STRINGS.en)[k];

  const [clockNow, setClockNow] = useState(() => Date.now());
  useEffect(() => {
    if (phase !== 'running' || !nextCallAt) return;
    const timer = window.setInterval(() => setClockNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [phase, nextCallAt]);
  const nextCallSeconds = nextCallAt && phase === 'running'
    ? Math.max(0, Math.ceil((nextCallAt - clockNow) / 1000))
    : null;
  const timerText = nextCallSeconds === null
    ? null
    : `${String(Math.floor(nextCallSeconds / 60)).padStart(2, '0')}:${String(nextCallSeconds % 60).padStart(2, '0')}`;
  const roundStatus = {
    am: { waiting: 'በመጠባበቅ ላይ', waitingHint: 'ሆስቱ ዙሩን ሲጀምር ጨዋታው ይጀምራል', live: 'ቀጥታ ጨዋታ', ended: 'ዙር ተጠናቋል', endedHint: 'ቀጣዩ ዙር እስኪዘጋጅ ይጠብቁ', next: 'ቀጣዩ ቁጥር እስኪጠራ የቀረው ጊዜ', manual: 'ቀጣዩ ቁጥር በሆስቱ ሲጠራ ይታያል', round: 'ዙር', called: 'የተጠሩ ቁጥሮች' },
    ti: { waiting: 'ይጽበ ኣሎ', waitingHint: 'ሆስት ዙር ክጅምር እንከሎ ጸወታ ክጅምር እዩ', live: 'ቀጥታ ጸወታ', ended: 'ዙር ተዛዚሙ', endedHint: 'ቀጻሊ ዙር ክሳብ ዝዳሎ ተጸበዩ', next: 'ክሳብ ዝቕጽል ቁጽሪ ዝጽዋዕ ዝተረፈ ግዜ', manual: 'ቀጻሊ ቁጽሪ ምስ ብሆስት ዝጽዋዕ ክርአ እዩ', round: 'ዙር', called: 'ዝተጸውዑ ቁጽርታት' },
    en: { waiting: 'Waiting for the round', waitingHint: 'The game will begin when the host starts the round', live: 'Live game', ended: 'Round completed', endedHint: 'Waiting for the next round to be prepared', next: 'Time until the next number', manual: 'The next number appears when the host calls it', round: 'Round', called: 'Numbers called' },
  }[lang] ?? {
    waiting: 'Waiting for the round', waitingHint: 'The game will begin when the host starts the round', live: 'Live game', ended: 'Round completed', endedHint: 'Waiting for the next round to be prepared', next: 'Time until the next number', manual: 'The next number appears when the host calls it', round: 'Round', called: 'Numbers called',
  };

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
  const [selectedCardIds, setSelectedCardIds] = useState<string[]>([]);
  const [cardOrder, setCardOrder] = useState<'oldest'|'newest'>('oldest');
  const [markColor, setMarkColor] = useState('#d4af37');
  const [autoMark, setAutoMark] = useState(true);
  const [confetti, setConfetti] = useState(false);
  const stopConfetti = useCallback(() => setConfetti(false), []);
  

  useEffect(() => {
    const load = () => { try { setCardOrder(localStorage.getItem('bgb.cardOrder')==='newest'?'newest':'oldest'); setMarkColor(localStorage.getItem('bgb.markColor')||'#d4af37'); setAutoMark(localStorage.getItem('bgb.autoMark')!=='off'); const ids=JSON.parse(localStorage.getItem('bgb.selectedCards')||'[]'); setSelectedCardIds(Array.isArray(ids)?ids:[]); } catch { /* retain defaults */ } };
    load(); window.addEventListener('bgb-player-settings',load); return ()=>window.removeEventListener('bgb-player-settings',load);
  }, []);

  useEffect(() => {
    if (!active || !autoMark || calledNumbers.length===0) return;
    for (const card of cards) { const marks=new Set(markedByCard[card.id]??[]); for (const n of calledNumbers) if (card.grid.some(row=>row.includes(n)) && !marks.has(n)) { toggleMark(card.id,n); marks.add(n); } }
  }, [active,autoMark,calledNumbers,cards,markedByCard,toggleMark]);

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
    <div className="mx-auto w-full max-w-6xl space-y-4 pb-28">
      <section className="relative overflow-hidden rounded-2xl border border-gold-400/40 bg-[radial-gradient(ellipse_at_top,rgba(255,215,0,.17),transparent_58%),linear-gradient(135deg,#17130a,#080808_65%)] p-3 shadow-[0_12px_38px_rgba(0,0,0,.45)] sm:p-4">
        <div className="flex items-center justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-[.28em] text-gold-400">BLACK & GOLD BINGO</p><p className="mt-1 text-sm font-bold text-gold-100">ዙር #{roundNumber} · {phase === 'running' ? 'ቀጥታ ጨዋታ' : phase === 'waiting' ? 'በመጠባበቅ ላይ' : 'ዙር ተጠናቋል'}</p></div><div className="text-right"><p className="text-[10px] font-bold text-gold-500">የዙሩ ሽልማት</p><p className="text-lg font-black tabular-nums text-yellow-300">{roundPrizeEtb !== undefined ? formatAmount(lang, roundPrizeEtb) + ' ብር' : '—'}</p></div></div>
        <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-2"><div className="rounded-xl border border-gold-500/30 bg-black/45 p-2 text-center"><p className="text-[9px] font-bold text-gold-500">የዙሩ ሁኔታ</p><p className="mt-1 text-xs font-bold text-gold-100">{phase === 'waiting' ? 'ሆስቱን ይጠብቁ' : phase === 'running' ? 'በመጫወት ላይ' : 'ተጠናቋል'}</p></div><div className="min-w-[6.5rem] rounded-2xl border border-yellow-300/70 bg-gradient-to-br from-yellow-200 via-yellow-500 to-amber-700 px-4 py-2 text-center text-black shadow-[0_0_24px_rgba(250,204,21,.24)]"><p className="text-[9px] font-black">የቅርብ ጥሪ</p>{calledNumbers.length ? <><p className="text-sm font-black">{letterFor(calledNumbers[calledNumbers.length-1])}</p><p className="text-3xl font-black leading-none">{calledNumbers[calledNumbers.length-1]}</p></> : <p className="py-1 text-lg font-black">—</p>}</div><div className="rounded-xl border border-gold-500/30 bg-black/45 p-2 text-center"><p className="text-[9px] font-bold text-gold-500">ቀጣይ ጥሪ</p><p className="mt-1 font-mono text-lg font-black tabular-nums text-yellow-200">{timerText ?? (phase === 'waiting' ? 'ይጠብቁ' : '—')}</p></div></div>
        <div className="mt-3 flex items-center gap-2 rounded-lg border border-emerald-500/25 bg-emerald-950/35 px-3 py-2 text-xs font-semibold text-emerald-100"><span aria-hidden="true">📢</span><span>{phase === 'waiting' ? 'ዙሩ እስኪጀምር ይጠብቁ፤ ካርዶችዎን ያዘጋጁ።' : phase === 'running' ? 'አዲስ ቁጥር ሲጠራ በካርድዎ ላይ ይከታተሉ።' : 'ይህ ዙር ተጠናቋል፤ የውጤቱን ማሳወቂያ ይመልከቱ።'}</span></div>
      </section>
      {calledNumbers.length > 0 && <section className="rounded-2xl border border-gold-700/35 bg-black/45 p-3"><div className="mb-2 flex items-center justify-between"><h2 className="text-sm font-black text-gold-200">የቅርብ ጊዜ የተጠሩ ቁጥሮች</h2><span className="text-[10px] text-gold-500">{calledNumbers.length}/75</span></div><div className="flex flex-wrap gap-2">{calledNumbers.slice(-5).reverse().map((n,index)=><div key={n} className={`grid h-11 w-11 place-items-center rounded-full border font-black shadow-lg ${index===0?'border-yellow-200 bg-gradient-to-br from-yellow-200 to-amber-600 text-black ring-2 ring-yellow-100/50':'border-gold-500/40 bg-zinc-900 text-gold-200'}`}><span className="text-[8px]">{letterFor(n)}</span><span className="text-sm leading-none">{n}</span></div>)}</div></section>}
      <PlayerFeatures onGoToWallet={onGoToWallet} />
      <style>{`
        @keyframes latestCalledFlash {
          0%, 100% { background-color: #f97316; color: #fff; box-shadow: 0 0 8px rgba(249,115,22,.95), 0 0 18px rgba(249,115,22,.65); }
          50% { background-color: #dc2626; color: #fff; box-shadow: 0 0 10px rgba(220,38,38,1), 0 0 22px rgba(220,38,38,.75); }
        }
        .latest-called-flash { animation: latestCalledFlash 700ms ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) { .latest-called-flash { animation: none !important; background-color: #dc2626 !important; color: #fff !important; } }
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

      {/* Shared round status and auto-call countdown */}
      {loaded && (
        <section
          aria-label={roundStatus.round + ' ' + roundNumber}
          className="relative isolate overflow-hidden rounded-2xl border border-gold-500/35 bg-[radial-gradient(ellipse_at_top_left,rgba(212,175,55,.16),transparent_58%),linear-gradient(135deg,rgba(24,20,12,.98),rgba(8,8,10,.98))] p-3 shadow-[0_12px_34px_-20px_rgba(212,175,55,.55)] ring-1 ring-gold-500/10 sm:p-4"
        >
          <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-gold-300/80 to-transparent" aria-hidden="true" />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-gold-500">{roundStatus.round} #{roundNumber}</p>
              <p className="mt-1 text-sm font-semibold text-gold-100 sm:text-base">
                {phase === 'waiting' ? roundStatus.waiting : phase === 'running' ? roundStatus.live : roundStatus.ended}
              </p>
            </div>
            <span className={[
              'inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-bold',
              phase === 'waiting' ? 'border-amber-400/30 bg-amber-400/10 text-amber-200' :
                phase === 'running' ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300' :
                  'border-white/15 bg-white/[0.06] text-gold-300',
            ].join(' ')}>
              <span className={phase === 'running' ? 'h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,.8)]' : 'h-2 w-2 rounded-full bg-current opacity-80'} />
              {phase === 'waiting' ? roundStatus.waiting : phase === 'running' ? roundStatus.live : roundStatus.ended}
            </span>
          </div>
          <div className="mt-3 flex flex-wrap items-end justify-between gap-3 border-t border-gold-500/15 pt-3">
            <div>
              {timerText !== null ? (
                <>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-gold-500">{roundStatus.next}</p>
                  <p className="mt-0.5 font-mono text-3xl font-black tabular-nums leading-none tracking-wider text-gold-200 drop-shadow-[0_0_14px_rgba(212,175,55,.28)] sm:text-4xl" aria-live="off">{timerText}</p>
                </>
              ) : (
                <p className="text-sm font-medium text-gold-300/90">
                  {phase === 'waiting' ? roundStatus.waitingHint : phase === 'running' ? roundStatus.manual : roundStatus.endedHint}
                </p>
              )}
            </div>
            <p className="text-xs tabular-nums text-gold-500/90">{roundStatus.called}: {calledNumbers.length}/75</p>
          </div>
        </section>
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
          <div className="grid w-full min-w-0 gap-2 sm:gap-4" style={{gridTemplateColumns: `repeat(${cards.length === 1 ? 1 : 2}, minmax(0, 1fr))`}}>
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
                onToggleMark={(number) => toggleMark(card.id, number)}
              />
            ))}
          </div>
        )}
      </div>


      <div className="fixed inset-x-0 bottom-[calc(4.6rem+env(safe-area-inset-bottom))] z-30 px-3 sm:px-4"><div className="mx-auto flex max-w-4xl items-center gap-2 rounded-2xl border border-gold-400/50 bg-[#080808]/95 p-2 shadow-[0_12px_36px_rgba(0,0,0,.7)] backdrop-blur-xl">
        <button type="button" role="switch" aria-checked={autoMark} onClick={() => { const next=!autoMark; setAutoMark(next); try { localStorage.setItem('bgb.autoMark', next?'on':'off'); } catch { /* ignore */ } }} className="flex min-w-0 flex-1 items-center gap-2 rounded-xl px-2 py-2 text-left"><span className={`relative h-5 w-9 shrink-0 rounded-full ${autoMark?'bg-emerald-500':'bg-zinc-600'}`}><span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${autoMark?'translate-x-4':'translate-x-0.5'}`}/></span><span className="text-[10px] font-black leading-tight text-gold-100 sm:text-xs">AUTO-MARK<br/><span className="font-medium text-gold-500">{autoMark?'ON':'OFF'}</span></span></button>
        <div className="hidden min-w-0 border-l border-gold-700/40 pl-3 sm:block"><p className="text-[9px] text-gold-500">ቀሪ ሂሳብ</p><p className="text-sm font-black tabular-nums text-yellow-300">{formatAmount(lang,balance)} ብር</p></div>
        <button type="button" disabled={claimableCards.length===0 || !!claimingCardId} onClick={() => void handleClaim(claimableCards[0]?.id)} className="min-w-[42%] rounded-xl border border-yellow-200/80 bg-gradient-to-r from-yellow-200 via-yellow-400 to-amber-600 px-4 py-3 text-base font-black tracking-wider text-black shadow-[0_0_22px_rgba(250,204,21,.25)] disabled:cursor-not-allowed disabled:opacity-40 sm:min-w-[34%] sm:text-lg">{claimingCardId?'በመላክ ላይ…':claimableCards.length?'👑 BINGO!':'BINGO'}</button>
      </div></div>
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
