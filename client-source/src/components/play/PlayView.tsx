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
import { findWinningPattern } from '@/lib/bingo';
import type { BingoCard, Lang, Pos, WinPattern } from '@/types/game';

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
const PATTERN_NAMES: Record<WinPattern, string> = {
  any_line: 'አንድ መስመር', horizontal_line: 'ሆሪዞንታል መስመር', vertical_line: 'ቨርቲካል መስመር',
  diagonal: 'ዲያጎናል', two_lines: 'ሁለት መስመሮች', two_horizontal_lines: 'ሁለት ሆሪዞንታል መስመሮች',
  four_corners: 'አራቱ ማዕዘኖች', rectangle: '2×2 ሬክታንግል', two_rectangles: 'ሁለት ሬክታንግሎች',
  half_house: 'ግማሽ ቤት', full_house: 'ፉል ሃውስ', x: 'X ቅርጽ', t: 'T ቅርጽ', l: 'L ቅርጽ',
  plus: 'ፕላስ (+)', diamond: 'ዳይመንድ', picture_frame: 'ውጫዊ ፍሬም', six_pack: 'Six-pack', postage_stamp: 'ፖስታጅ ስታምፕ',
};


/* ───────────────────────────── GAME LOGIC ───────────────────────────── */

const LETTERS = ['B', 'I', 'N', 'G', 'O'] as const;
const letterFor = (n: number) => LETTERS[Math.min(4, Math.floor((n - 1) / 15))];

const AMHARIC_ONES = ['','አንድ','ሁለት','ሶስት','አራት','አምስት','ስድስት','ሰባት','ስምንት','ዘጠኝ','አስር','አስራ አንድ','አስራ ሁለት','አስራ ሶስት','አስራ አራት','አስራ አምስት','አስራ ስድስት','አስራ ሰባት','አስራ ስምንት','አስራ ዘጠኝ'];
const AMHARIC_TENS: Record<number, string> = { 20: 'ሃያ', 30: 'ሰላሳ', 40: 'አርባ', 50: 'ሃምሳ', 60: 'ስልሳ', 70: 'ሰባ' };
const AMHARIC_LETTERS: Record<string, string> = { B: 'ቢ', I: 'አይ', N: 'ኤን', G: 'ጂ', O: 'ኦ' };
function amharicNumber(n: number): string {
  if (n <= 19) return AMHARIC_ONES[n] ?? String(n);
  const ten = Math.floor(n / 10) * 10;
  const unit = n % 10;
  return unit === 0 ? (AMHARIC_TENS[ten] ?? String(n)) : `${AMHARIC_TENS[ten] ?? ten} ${AMHARIC_ONES[unit]}`;
}
function speakAmharicCall(n: number) {
  if (!('speechSynthesis' in window) || !('SpeechSynthesisUtterance' in window)) return;
  window.speechSynthesis.cancel();
  const letter = AMHARIC_LETTERS[letterFor(n)] ?? letterFor(n);
  const utterance = new SpeechSynthesisUtterance(`${letter}... ${amharicNumber(n)}`);
  utterance.lang = 'am-ET';
  utterance.rate = 0.76;
  utterance.pitch = 1;
  utterance.volume = 1;
  const voices = window.speechSynthesis.getVoices();
  const amharicVoice = voices.find((voice) => voice.lang.toLowerCase().startsWith('am'));
  if (amharicVoice) utterance.voice = amharicVoice;
  window.speechSynthesis.speak(utterance);
}

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
        compact ? 'h-10 w-10 border-2 text-xs' : 'h-32 w-32 text-4xl sm:h-40 sm:w-40',
      ].join(' ')}
    >
      <span className={compact ? 'text-[9px] font-black' : 'text-sm font-black'}>{letterFor(n)}</span>
      <strong className={compact ? 'text-sm leading-none' : 'text-4xl leading-none'}>{n}</strong>
    </div>
  );
}

function CardView({ card, marks, called, active, t, onToggle, pattern }: CardViewProps) {
  const { toGo, winningLine } = useMemo(() => analyze(card.grid, marks, called, pattern), [card.grid, marks, called, pattern]);
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
  const { lang, cards, markedByCard, toggleMark, phase, winPattern, roundNumber, calledNumbers, claimBingo, winner } = usePlayData();
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
    () => (active ? cards.filter((c) => analyze(c.grid, markSets[c.id], called, winPattern).winningLine) : []),
    [active, cards, markSets, called, winPattern],
  );

  const [showBoard, setShowBoard] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(() => {
    try { return localStorage.getItem('bgb.amharicVoice') !== 'off'; } catch { return true; }
  });
  const previousCall = useRef<number | null>(null);
  useEffect(() => {
    if (current === null) { previousCall.current = null; return; }
    if (previousCall.current !== null && current !== previousCall.current && voiceEnabled) {
      speakAmharicCall(current);
    }
    previousCall.current = current;
  }, [current, voiceEnabled]);
  const toggleVoice = () => {
    setVoiceEnabled((enabled) => {
      const next = !enabled;
      try { localStorage.setItem('bgb.amharicVoice', next ? 'on' : 'off'); } catch { /* ignore */ }
      if (!next && 'speechSynthesis' in window) window.speechSynthesis.cancel();
      return next;
    });
  };
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
          <p className="text-xs font-semibold text-gold-500">የዚህ ዙር አሸናፊነት: {PATTERN_NAMES[winPattern]}</p>
        </div>

        <div className="w-full max-w-xs">
          <button
            type="button"
            onClick={toggleVoice}
            aria-pressed={voiceEnabled}
            className="mb-3 rounded-lg border border-gold-700/60 px-3 py-2 text-xs font-semibold text-gold-300 hover:bg-white/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold-300"
          >
            {voiceEnabled ? '🔊 የአማርኛ ድምፅ በርቷል · ለማጥፋት ይጫኑ' : '🔇 የአማርኛ ድምፅ አብራ'}
          </button>
          <button
            type="button"
            disabled={current === null}
            onClick={() => {
              if (current !== null) {
                setVoiceEnabled(true);
                try { localStorage.setItem('bgb.amharicVoice', 'on'); } catch { /* ignore */ }
                speakAmharicCall(current);
              }
            }}
            className="mb-3 ml-2 rounded-lg border border-gold-700/60 px-3 py-2 text-xs font-semibold text-gold-300 hover:bg-white/5 disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold-300"
          >
            ▶ የመጨረሻውን ጥሪ አዳምጥ
          </button>
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
                pattern={winPattern}
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
