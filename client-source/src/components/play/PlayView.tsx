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
};

function CardView({ card, marks, called, active, t, onToggle, pattern }: CardViewProps) {
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
      <header className="mb-3 flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[9px] font-black uppercase tracking-[0.22em] text-gold-600">GOLD EDITION</p>
          <h3 className="mt-0.5 truncate font-bold text-gold-200">
            {t('card')} <span className="text-gold-400">#{card.serial}</span>
          </h3>
          <span className="select-all font-mono text-[10px] text-gold-600">{card.id}</span>
        </div>
        {active && (
          <span
            className={[
              'shrink-0 rounded-full border px-3 py-1 text-[11px] font-black tabular-nums tracking-wide transition-colors',
              hasWin
                ? 'border-gold-200 bg-gradient-to-r from-gold-200 via-gold-400 to-gold-500 text-darkbg shadow-[0_0_20px_rgba(255,215,0,.35)]'
                : toGo <= 2
                  ? 'border-gold-400/60 bg-gold-400/15 text-gold-200'
                  : 'border-gold-700/40 bg-black/20 text-gold-500',
            ].join(' ')}
          >
            {hasWin ? '✦ BINGO ✦' : `${toGo} ${t('toGo')}`}
          </span>
        )}
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
                type="button"
                disabled={isFree || !active}
                aria-pressed={isMarked}
                aria-label={isFree ? t('free') : `${LETTERS[c]} ${v}`}
                onClick={() => v !== null && isCalled && onToggle(v)}
                className={[
                  'relative grid aspect-square min-w-0 place-items-center overflow-hidden rounded-lg border text-base font-extrabold tabular-nums shadow-sm transition-all duration-200 active:scale-[0.91] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-200 sm:rounded-xl sm:text-lg',
                  isMarked
                    ? 'bg-gradient-to-br from-gold-200 via-gold-400 to-gold-600 border-gold-200/80 text-[#17130a] shadow-[inset_0_1px_0_rgba(255,255,255,.65),0_3px_12px_rgba(212,175,55,.22)] bg-cell-mark'
                    : 'border-white/[0.055] bg-gradient-to-br from-white/[0.065] to-white/[0.015] text-gold-200/90 hover:border-gold-500/40',
                  isCalled && !isMarked
                    ? 'bg-anim border-gold-400/80 text-gold-100 ring-1 ring-gold-400/60 animate-[bgHint_1.6s_ease-in-out_infinite]'
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
  const stopConfetti = useCallback(() => setConfetti(false), []);
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
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) setConfetti(true);
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
    <div className="mx-auto w-full max-w-6xl space-y-6 pb-2">
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
        .bg-cell-mark { animation: bgCellMark 260ms cubic-bezier(.2,.8,.2,1) both; }
        .bg-winner-reveal { animation: bgWinnerReveal 420ms cubic-bezier(.2,.8,.2,1) both; }
        @keyframes bgConfetti { to { transform: translate3d(0,110vh,0) rotate(var(--rot)); opacity: .9 } }
        .bg-confetti { will-change: transform, opacity; backface-visibility: hidden; }
        .bg-ball-pop { animation: bgBallPop 620ms cubic-bezier(.2,.8,.2,1) both, bgBallGlow 2.8s ease-in-out 620ms 2; }
        @media (prefers-reduced-motion: reduce) {
          .bg-anim, .bg-ball-pop, .bg-cell-mark, .bg-winner-reveal, .bg-confetti { animation: none !important; }
        }
      `}</style>

      {/* Call stage */}
      <section className="relative isolate overflow-hidden rounded-[2rem] border border-gold-500/25 bg-[radial-gradient(ellipse_at_top_left,rgba(212,175,55,0.16),transparent_48%),linear-gradient(135deg,rgba(133,90,0,0.16),rgba(20,20,25,0.98)_48%,rgba(10,10,12,1))] p-4 shadow-2xl shadow-black/30 ring-1 ring-gold-700/40 sm:p-6 lg:p-8">
        <div className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-gold-400/10 blur-3xl" aria-hidden="true" />
        <div className="relative grid items-center gap-4">
          <div className="flex min-w-0 flex-col items-center gap-4 py-2 text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-gold-500/25 bg-black/25 px-4 py-1.5 text-[11px] font-bold uppercase tracking-[0.2em] text-gold-300 shadow-inner shadow-black/20">
              <span className="h-1.5 w-1.5 rounded-full bg-gold-400 shadow-[0_0_10px_rgba(255,215,0,.9)]" />
              {t('called')}
            </div>
            <div className="relative grid min-h-[9.5rem] min-w-[9.5rem] place-items-center rounded-full bg-[radial-gradient(circle,rgba(255,215,0,0.12),transparent_68%)] p-2 sm:min-h-[12rem] sm:min-w-[12rem]">
              {current !== null ? (
                <Ball key={current} n={current} />
              ) : (
                <div className="grid h-32 w-32 place-items-center rounded-full border-2 border-dashed border-gold-700/80 bg-black/20 px-4 text-center text-sm font-medium text-gold-400 sm:h-40 sm:w-40">
                  {phase === 'ended' ? t('ended') : t('waitingBall')}
                </div>
              )}
            </div>
            <div className="space-y-1">
              <p className="text-sm font-semibold text-gold-200" aria-live="polite">
                {t('round')} <span className="font-black tabular-nums text-gold-400">#{roundNumber}</span>
              </p>
            </div>
          </div>

          <div className="flex flex-wrap justify-center gap-2">
              <button
                type="button"
                onClick={toggleVoice}
                aria-pressed={voiceEnabled}
                className="rounded-xl border border-gold-700/60 bg-white/[0.03] px-3 py-2 text-xs font-semibold text-gold-300 transition-colors hover:border-gold-400/60 hover:bg-gold-400/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold-300"
              >
                {voiceEnabled ? t('amharicVoiceOn') : t('amharicVoiceOff')}
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
                className="rounded-xl border border-gold-700/60 bg-white/[0.03] px-3 py-2 text-xs font-semibold text-gold-300 transition-colors hover:border-gold-400/60 hover:bg-gold-400/10 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold-300"
              >
                ▶ {t('replayCall')}
              </button>
            </div>

            <button
              type="button"
              onClick={() => setShowBoard((s) => !s)}
              aria-expanded={showBoard}
              className="flex w-full max-w-md items-center justify-between rounded-xl border border-gold-700/40 bg-white/[0.03] px-4 py-3 text-left text-sm font-semibold text-gold-300 transition-colors hover:border-gold-400/50 hover:bg-gold-400/[0.07] focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold-300"
            >
              <span>{t('board')} <span className="ml-1 text-xs font-bold text-gold-500">({calledNumbers.length})</span></span>
              <span className="text-xs font-bold text-gold-500">{showBoard ? '− ' + t('hide') : '＋ ' + t('show')}</span>
            </button>
        </div>
      </section>

      {showBoard && (
        <section className="overflow-hidden rounded-2xl border border-gold-700/40 bg-gradient-to-br from-cardbg via-cardbg to-gold-950/20 p-2 shadow-lg shadow-black/20 ring-1 ring-gold-700/20 sm:p-3">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2 border-b border-gold-700/30 pb-2">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-gold-600">{t('numberTracker')}</p>
              <h3 className="mt-1 text-base font-bold text-gold-200">{t('board')}</h3>
            </div>
            <span className="rounded-full border border-gold-500/25 bg-gold-500/10 px-3 py-1 text-xs font-bold tabular-nums text-gold-300">{calledNumbers.length} / 75</span>
          </div>
          <div className="space-y-1.5 overflow-x-auto">
            {LETTERS.map((l, col) => (
              <div key={l} className="grid min-w-[22rem] grid-cols-[1.5rem_repeat(15,minmax(0,1fr))] items-center gap-1 rounded-lg border border-gold-700/25 bg-black/20 p-1">
                <span className="grid h-6 place-items-center rounded-md bg-gold-500/15 text-xs font-black text-gold-300">{l}</span>
                {Array.from({ length: 15 }, (_, i) => col * 15 + i + 1).map((n) => (
                  <span
                    key={n}
                    className={[
                      'grid h-6 min-w-0 place-items-center rounded text-[9px] font-semibold tabular-nums transition-colors',
                      called.has(n)
                        ? 'bg-gradient-to-br from-gold-300 to-gold-600 text-darkbg shadow-[0_1px_5px_rgba(212,175,55,.2)]'
                        : 'bg-white/[0.025] text-gold-700/80',
                    ].join(' ')}
                  >
                    {n}
                  </span>
                ))}
              </div>
            ))}
          </div>
        </section>
      )}

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
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
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
