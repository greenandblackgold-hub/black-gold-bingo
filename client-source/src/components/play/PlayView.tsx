/**
 * src/components/play/PlayView.tsx
 *
 * Core gameplay screen: current called ball, side-by-side player cards,
 * tap-to-mark cells, "N to go" progress, and a BINGO claim bar with confetti.
 * Reads from usePlayer() and useRound(); shared types live in '@/types/game'.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useLanguage } from '@/context/LanguageContext';
import { usePlayer } from '@/context/PlayerContext';
import { useRound } from '@/context/RoundContext';
import { play } from '@/lib/audio';
import type { BingoCard, Lang, Pos } from '@/types/game';

/* ───────────────────────────── CONTEXT WIRING ───────────────────────────── */

function usePlayData() {
  const { lang } = useLanguage();
  const { cards, markedByCard, toggleMark } = usePlayer();
  const { phase, roundNumber, calledNumbers, claimBingo, winner } = useRound();
  return { lang: lang as Lang, cards, markedByCard, toggleMark, phase, roundNumber, calledNumbers, claimBingo, winner };
}

/* ─────────────────────────── TRANSLATIONS ─────────────────────────── */
/* Move these into your central translation file if you prefer.
   Tigrigna strings should be reviewed by a native speaker. */

const STRINGS = {
  am: {
    called: 'የወጣ ቁጥር',
    waitingBall: 'ጨዋታው ገና አልጀመረም',
    recent: 'ቀደም ሲል የወጡ',
    myCards: 'የእኔ ካርዶች',
    board: 'ሁሉም የወጡ ቁጥሮች',
    round: 'ዙር',
    toGo: 'ይቀራል',
    free: 'ነጻ',
    claim: 'ቢንጎ በል!',
    claiming: 'በመረጋገጥ ላይ…',
    claimSent: 'ጥያቄዎ ተልኳል',
    claimWaiting: 'በመፈተሽ ላይ…',
    winnerBanner: 'ዙሩ ተጠናቋል። አሸናፊ ካርድ',
    won: 'እንኳን ደስ አለዎት! ቢንጎ!',
    invalid: 'ቢንጎው አልተረጋገጠም። እንደገና ይሞክሩ።',
    noCards: 'ለዚህ ዙር ካርድ የለዎትም',
    noCardsHint: 'ለመጫወት ከቦርሳዎ ካርድ ይግዙ።',
    goWallet: 'ወደ ቦርሳ ሂድ',
    waiting: 'ቀጣዩን ዙር በመጠበቅ ላይ',
    ended: 'ዙሩ ተጠናቅቋል',
    card: 'ካርድ',
    show: 'አሳይ',
    hide: 'ደብቅ',
  },
  ti: {
    called: 'ዝወጸ ቁጽሪ',
    waitingBall: 'ጸወታ ገና ኣይጀመረን',
    recent: 'ቀደም ዝወጹ',
    myCards: 'ካርዳተይ',
    board: 'ኩሎም ዝወጹ ቁጽሪታት',
    round: 'ዙር',
    toGo: 'ተሪፉ',
    free: 'ነጻ',
    claim: 'ቢንጎ በል!',
    claiming: 'ይረጋገጽ ኣሎ…',
    claimSent: 'ጥርዓንኩም ተላኢኹ',
    claimWaiting: 'ይምርመር ኣሎ…',
    winnerBanner: 'ዙር ተወዲኡ። ዕዉት ካርድ',
    won: 'እንኳዕ ሕጉስ! ቢንጎ!',
    invalid: 'ቢንጎ ኣይተረጋገጸን። እንደገና ፈትኑ።',
    noCards: 'ን እዚ ዙር ካርድ የብልኩምን',
    noCardsHint: 'ንምጽዋት ካብ ጥረ ገንዘብኩም ካርድ ግዝኡ።',
    goWallet: 'ናብ ቦርሳ ኺድ',
    waiting: 'ዝቕጽል ዙር ይጽበ ኣሎ',
    ended: 'ዙር ተወዲኡ',
    card: 'ካርድ',
    show: 'ኣርኢ',
    hide: 'ሕባእ',
  },
  en: {
    called: 'Called number',
    waitingBall: 'Round has not started',
    recent: 'Previous calls',
    myCards: 'My cards',
    board: 'All called numbers',
    round: 'Round',
    toGo: 'to go',
    free: 'FREE',
    claim: 'Call BINGO!',
    claiming: 'Verifying…',
    claimSent: 'Claim sent',
    claimWaiting: 'Checking…',
    winnerBanner: 'Round finished. Winning card',
    won: 'Congratulations! BINGO!',
    invalid: "That bingo couldn't be verified. Try again.",
    noCards: "You have no cards in this round",
    noCardsHint: 'Buy cards from your wallet to play.',
    goWallet: 'Go to wallet',
    waiting: 'Waiting for the next round',
    ended: 'Round finished',
    card: 'Card',
    show: 'Show',
    hide: 'Hide',
  },
} as const;

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
function analyze(grid: (number | null)[][], marks: Set<number>, called: Set<number>) {
  let toGo = 5;
  let winningLine: Pos[] | null = null;
  for (const line of LINES) {
    const missing = line.filter(([r, c]) => {
      const v = grid[r][c];
      return !(v === null || (marks.has(v) && called.has(v)));
    }).length;
    if (missing < toGo) toGo = missing;
    if (missing === 0 && !winningLine) winningLine = line;
  }
  return { toGo, winningLine };
}

/* ───────────────────────────── SUB-COMPONENTS ───────────────────────────── */

function Ball({ n, size = 'lg' }: { n: number; size?: 'lg' | 'sm' }) {
  const big = size === 'lg';
  return (
    <div
      className={[
        'bg-anim grid place-items-center rounded-full text-darkbg font-black tabular-nums',
        'bg-[radial-gradient(circle_at_30%_25%,#FFE57F,#D4AF37_55%,#855A00)]',
        'shadow-[0_0_0_2px_rgba(255,215,0,0.35),0_10px_40px_-8px_rgba(212,175,55,0.6)]',
        big ? 'h-32 w-32 sm:h-40 sm:w-40 animate-[bgBallPop_450ms_ease-out]' : 'h-10 w-10 text-sm',
      ].join(' ')}
    >
      <div className="text-center leading-none">
        <div className={big ? 'text-xl font-bold opacity-70' : 'text-[10px] opacity-70'}>{letterFor(n)}</div>
        <div className={big ? 'text-5xl sm:text-6xl' : 'text-base'}>{n}</div>
      </div>
    </div>
  );
}

function Confetti({ onDone }: { onDone: () => void }) {
  const pieces = useMemo(
    () =>
      Array.from({ length: 70 }, (_, i) => ({
        id: i,
        left: Math.random() * 100,
        delay: Math.random() * 0.6,
        dur: 2.2 + Math.random() * 1.6,
        rot: Math.random() * 720 - 360,
        size: 6 + Math.random() * 7,
        color: ['#FFE57F', '#FFD700', '#D4AF37', '#AA7C11', '#ffffff'][i % 5],
      })),
    [],
  );
  useEffect(() => {
    const id = setTimeout(onDone, 4200);
    return () => clearTimeout(id);
  }, [onDone]);
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-50 overflow-hidden">
      {pieces.map((p) => (
        <span
          key={p.id}
          className="bg-anim absolute top-[-5%] block rounded-[2px]"
          style={{
            left: `${p.left}%`,
            width: p.size,
            height: p.size * 0.5,
            background: p.color,
            animation: `bgConfetti ${p.dur}s ${p.delay}s ease-in forwards`,
            ['--rot' as string]: `${p.rot}deg`,
          }}
        />
      ))}
    </div>
  );
}

interface CardViewProps {
  card: BingoCard;
  marks: Set<number>;
  called: Set<number>;
  active: boolean;
  t: (k: StringKey) => string;
  onToggle: (n: number) => void;
}

function CardView({ card, marks, called, active, t, onToggle }: CardViewProps) {
  const { toGo, winningLine } = useMemo(() => analyze(card.grid, marks, called), [card.grid, marks, called]);
  const winSet = useMemo(() => new Set((winningLine ?? []).map(([r, c]) => `${r}-${c}`)), [winningLine]);
  const hasWin = !!winningLine;

  return (
    <section
      className={[
        'rounded-2xl bg-cardbg p-3 sm:p-4 transition-shadow',
        hasWin
          ? 'ring-2 ring-gold-400 shadow-[0_0_40px_-6px_rgba(255,215,0,0.55)]'
          : 'ring-1 ring-gold-700/50',
      ].join(' ')}
    >
      <header className="mb-3 flex items-baseline justify-between">
        <h3 className="font-semibold text-gold-300">
          {t('card')} #{card.serial}
          <span className="ml-2 select-all font-mono text-xs font-normal text-gold-500">{card.id}</span>
        </h3>
        {active && (
          <span
            className={[
              'rounded-full px-2.5 py-0.5 text-xs font-semibold tabular-nums',
              toGo <= 2 ? 'bg-gold-400 text-darkbg' : 'bg-white/5 text-gold-500',
            ].join(' ')}
          >
            {hasWin ? 'BINGO' : `${toGo} ${t('toGo')}`}
          </span>
        )}
      </header>

      <div className="grid grid-cols-5 gap-1 pb-1 text-center text-sm font-black text-gold-500">
        {LETTERS.map((l) => (
          <span key={l}>{l}</span>
        ))}
      </div>

      <div className="grid grid-cols-5 gap-1">
        {card.grid.flatMap((row, r) =>
          row.map((v, c) => {
            const isFree = v === null;
            const isMarked = isFree || marks.has(v);
            const isCalled = !isFree && called.has(v);
            const inWin = winSet.has(`${r}-${c}`);
            return (
              <button
                key={`${r}-${c}`}
                type="button"
                disabled={isFree || !active}
                aria-pressed={isMarked}
                aria-label={isFree ? t('free') : `${LETTERS[c]} ${v}`}
                onClick={() => v !== null && isCalled && onToggle(v)}
                className={[
                  'relative aspect-square rounded-lg text-base font-bold tabular-nums sm:text-lg',
                  'transition-transform active:scale-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold-300',
                  isMarked
                    ? 'bg-gradient-to-br from-gold-300 via-gold-500 to-gold-600 text-darkbg'
                    : 'bg-white/[0.04] text-gold-300/80',
                  isCalled && !isMarked
                    ? 'bg-anim ring-1 ring-gold-400 animate-[bgHint_1.6s_ease-in-out_infinite]'
                    : '',
                  inWin ? 'outline outline-2 outline-white/90' : '',
                ].join(' ')}
              >
                {isFree ? <span className="text-xs font-black">★</span> : v}
              </button>
            );
          }),
        )}
      </div>
    </section>
  );
}

/* ───────────────────────────── MAIN VIEW ───────────────────────────── */

export function PlayView({ onGoToWallet }: { onGoToWallet: () => void }) {
  const { lang, cards, markedByCard, toggleMark, phase, roundNumber, calledNumbers, claimBingo, winner } = usePlayData();
  const t = (k: StringKey) => (STRINGS[lang] ?? STRINGS.en)[k];

  const called = useMemo(() => new Set(calledNumbers), [calledNumbers]);
  const current = calledNumbers.length ? calledNumbers[calledNumbers.length - 1] : null;
  const recent = calledNumbers.slice(-6, -1).reverse();
  const active = phase === 'running';

  const markSets = useMemo(() => {
    const m: Record<string, Set<number>> = {};
    for (const c of cards) m[c.id] = new Set(markedByCard[c.id] ?? []);
    return m;
  }, [cards, markedByCard]);

  const winners = useMemo(
    () => (active ? cards.filter((c) => analyze(c.grid, markSets[c.id], called).winningLine) : []),
    [active, cards, markSets, called],
  );

  const [showBoard, setShowBoard] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [confetti, setConfetti] = useState(false);
  const [sentRound, setSentRound] = useState<number | null>(null);
  const claimed = sentRound === roundNumber;
  const [message, setMessage] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const messageTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => clearTimeout(messageTimer.current), []);

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
    setConfetti(true);
    flash('ok', t('won'));
    play('win');
  }, [winner, iWon]);

  const handleClaim = async () => {
    if (!winners.length || claiming) return;
    setClaiming(true);
    try {
      const res = await claimBingo(winners[0].id);
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
    <div className="space-y-6">
      <style>{`
        @keyframes bgBallPop { 0% { transform: scale(.4) rotate(-12deg); opacity: 0 } 70% { transform: scale(1.08) } 100% { transform: scale(1); opacity: 1 } }
        @keyframes bgHint { 0%,100% { box-shadow: 0 0 0 0 rgba(255,215,0,.0) } 50% { box-shadow: 0 0 14px 1px rgba(255,215,0,.45) } }
        @keyframes bgConfetti { to { transform: translateY(110vh) rotate(var(--rot)); opacity: .9 } }
        @media (prefers-reduced-motion: reduce) { .bg-anim { animation: none !important } }
      `}</style>

      {/* Call stage */}
      <section className="flex flex-col items-center gap-5 rounded-3xl bg-cardbg px-4 py-6 ring-1 ring-gold-700/50 sm:flex-row sm:justify-center sm:gap-10">
        <div className="flex flex-col items-center gap-2">
          {current !== null ? (
            <Ball key={current} n={current} />
          ) : (
            <div className="grid h-32 w-32 place-items-center rounded-full border-2 border-dashed border-gold-700 px-4 text-center text-sm text-gold-500 sm:h-40 sm:w-40">
              {phase === 'ended' ? t('ended') : t('waitingBall')}
            </div>
          )}
          <p className="text-sm text-gold-300" aria-live="polite">
            {t('called')} · {t('round')} {roundNumber}
          </p>
        </div>

        <div className="w-full max-w-xs">
          <p className="mb-2 text-sm text-gold-500">{t('recent')}</p>
          <div className="flex min-h-10 flex-wrap gap-2">
            {recent.map((n) => (
              <Ball key={n} n={n} size="sm" />
            ))}
          </div>
          <button
            type="button"
            onClick={() => setShowBoard((s) => !s)}
            className="mt-4 text-sm font-medium text-gold-400 underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold-300"
          >
            {t('board')} ({calledNumbers.length}) · {showBoard ? t('hide') : t('show')}
          </button>
        </div>
      </section>

      {showBoard && (
        <section className="rounded-2xl bg-cardbg p-3 ring-1 ring-gold-700/50">
          <div className="grid grid-cols-5 gap-x-2 gap-y-1">
            {LETTERS.map((l, col) => (
              <div key={l} className="space-y-1">
                <div className="text-center text-sm font-black text-gold-500">{l}</div>
                <div className="grid grid-cols-3 gap-1">
                  {Array.from({ length: 15 }, (_, i) => col * 15 + i + 1).map((n) => (
                    <span
                      key={n}
                      className={[
                        'rounded py-0.5 text-center text-[11px] tabular-nums',
                        called.has(n) ? 'bg-gold-500 font-bold text-darkbg' : 'text-gold-700',
                      ].join(' ')}
                    >
                      {n}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {winner && (
        <p
          role="status"
          className={[
            'rounded-xl px-4 py-3 text-center font-bold',
            iWon ? 'bg-gold-400 text-darkbg' : 'bg-white/5 text-gold-300 ring-1 ring-gold-700/50',
          ].join(' ')}
        >
          {iWon ? t('won') : `${t('winnerBanner')} #${winner.serial}`}
        </p>
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
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {cards.map((card) => (
              <CardView
                key={card.id}
                card={card}
                marks={markSets[card.id]}
                called={called}
                active={active}
                t={t}
                onToggle={(n) => toggleMark(card.id, n)}
              />
            ))}
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

      {confetti && <Confetti onDone={() => setConfetti(false)} />}
    </div>
  );
}

export default PlayView;
