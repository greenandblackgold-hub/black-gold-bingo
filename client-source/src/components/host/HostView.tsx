/**
 * src/components/host/HostView.tsx
 *
 * Host dashboard: big animated ball (e.g. B-12), manual draw, auto-call with a
 * 1 to 60 second speed selector, 1-75 tracking grid, and a Room ID badge.
 * Reads from useRound(); shared types live in '@/types/game'.
 *
 * The auto-call timer runs inside RoundContext (App.tsx unmounts tabs, so a
 * timer here would stop when the host switches tabs). This view only controls
 * and displays it via autoCall, callIntervalSec and nextCallAt.
 */
import { useEffect, useState } from 'react';
import { useLanguage } from '@/context/LanguageContext';
import { useRound } from '@/context/RoundContext';
import { SERVER_MODE } from '@/lib/api';
import type { Lang } from '@/types/game';

/* ───────────────────────────── CONTEXT WIRING ───────────────────────────── */

function useHostData() {
  const { lang } = useLanguage();
  const round = useRound();
  return { lang: lang as Lang, ...round };
}

/* ─────────────────────────── TRANSLATIONS ─────────────────────────── */
/* Tigrigna strings should be reviewed by a native speaker. */

const STRINGS = {
  am: {
    roomId: 'የክፍል መለያ',
    copy: 'ቅዳ',
    copied: 'ተቀድቷል',
    current: 'አሁን የወጣ ቁጥር',
    none: 'እስካሁን አልተጠራም',
    start: 'ዙር ጀምር',
    end: 'ዙር ጨርስ',
    draw: 'ቀጣይ ቁጥር ጥራ',
    auto: 'ራስ-ሰር ጥሪ',
    speed: 'የጥሪ ፍጥነት',
    every: 'በየ',
    sec: 'ሰከንድ',
    nextIn: 'ቀጣይ በ',
    tracker: 'የወጡ ቁጥሮች',
    recent: 'የቅርብ ጥሪዎች',
    allDrawn: 'ሁሉም 75 ቁጥሮች ወጥተዋል',
    waiting: 'በመጠበቅ ላይ',
    running: 'ጨዋታ ላይ',
    ended: 'ተጠናቋል',
    claims: 'የቢንጎ ጥያቄዎች',
    noClaims: 'እስካሁን ምንም ጥያቄ የለም',
    gridWins: 'መስመሩ ተሞልቷል',
    notWin: 'መስመር አልተሞላም',
    badGrid: 'ካርዱ ልክ አይደለም',
    originOk: 'ካርዱ በዚህ መሣሪያ መዝገብ ተረጋግጧል',
    originNo: 'የካርዱ ምንጭ አልተረጋገጠም (የማሳያ ሁነታ)',
    accept: 'ተቀበል እና ዙሩን ጨርስ',
    reject: 'ውድቅ አድርግ',
    winnerLabel: 'አሸናፊ ካርድ',
    newRound: 'ዙሩን አዲስ አድርግ',
    startFirst: 'ቁጥር ለመጥራት መጀመሪያ ዙሩን ይጀምሩ',
  },
  ti: {
    roomId: 'መለለዪ ክፍሊ',
    copy: 'ቅዳሕ',
    copied: 'ተቐዲሑ',
    current: 'ሕጂ ዝወጸ ቁጽሪ',
    none: 'ክሳብ ሕጂ ኣይተጸዋዕን',
    start: 'ዙር ጀምር',
    end: 'ዙር ወዲእ',
    draw: 'ዝቕጽል ቁጽሪ ጸውዕ',
    auto: 'ባዕላዊ ጻውዒት',
    speed: 'ቅልጣፈ ጻውዒት',
    every: 'ኣብ ነፍሲ ወከፍ',
    sec: 'ካልኢት',
    nextIn: 'ዝቕጽል ኣብ',
    tracker: 'ዝወጹ ቁጽሪታት',
    recent: 'ናይ ቀረባ ጻውዒታት',
    allDrawn: 'ኩሎም 75 ቁጽሪታት ወጺኦም',
    waiting: 'ይጽበ ኣሎ',
    running: 'ጸወታ',
    ended: 'ተወዲኡ',
    claims: 'ጥርዓናት ቢንጎ',
    noClaims: 'ክሳብ ሕጂ ዝኾነ ጥርዓን የለን',
    gridWins: 'መስመር ተመሊኡ',
    notWin: 'መስመር ኣይተመልአን',
    badGrid: 'ካርድ ልክዕ ኣይኮነን',
    originOk: 'ካርድ ብመዝገብ እዚ መሳርሒ ተረጋጊጹ',
    originNo: 'ምንጪ ካርድ ኣይተረጋገጸን (ናይ ምርኣይ ኩነታት)',
    accept: 'ተቐበል ዙር ወድእ',
    reject: 'ንጸግ',
    winnerLabel: 'ዕዉት ካርድ',
    newRound: 'ዙር ሓድሽ ኣዳልው',
    startFirst: 'ቁጽሪ ንምጽዋዕ ቅድም ዙር ጀምሩ',
  },
  en: {
    roomId: 'Room ID',
    copy: 'Copy',
    copied: 'Copied',
    current: 'Current call',
    none: 'Nothing called yet',
    start: 'Start round',
    end: 'End round',
    draw: 'Draw next number',
    auto: 'Auto-call',
    speed: 'Call speed',
    every: 'Every',
    sec: 's',
    nextIn: 'Next in',
    tracker: 'Called numbers',
    recent: 'Recent calls',
    allDrawn: 'All 75 numbers have been drawn',
    waiting: 'Waiting',
    running: 'Live',
    ended: 'Finished',
    claims: 'Bingo claims',
    noClaims: 'No claims yet',
    gridWins: 'Line complete',
    notWin: 'No complete line',
    badGrid: 'Invalid card',
    originOk: 'Card verified in this device’s registry',
    originNo: 'Card origin unverified (demo mode)',
    accept: 'Accept and end round',
    reject: 'Reject',
    winnerLabel: 'Winning card',
    newRound: 'New round',
    startFirst: 'Start the round to begin calling numbers',
  },
} as const;

type StringKey = keyof (typeof STRINGS)['en'];

/* ───────────────────────────── HELPERS ───────────────────────────── */

const LETTERS = ['B', 'I', 'N', 'G', 'O'] as const;
const letterFor = (n: number) => LETTERS[Math.min(4, Math.floor((n - 1) / 15))];
const PRESETS = [3, 5, 10, 30, 60];

const primaryBtn =
  'rounded-xl bg-gradient-to-br from-gold-300 via-gold-500 to-gold-600 px-5 py-3.5 font-bold text-darkbg ' +
  'active:scale-[0.98] disabled:opacity-40 disabled:active:scale-100 ' +
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold-300';

const ghostBtn =
  'rounded-xl bg-white/[0.05] px-5 py-3.5 font-semibold text-gold-300 ring-1 ring-gold-700/50 ' +
  'active:scale-[0.98] disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold-300';

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const el = document.createElement('textarea');
      el.value = text;
      el.style.position = 'fixed';
      el.style.opacity = '0';
      document.body.appendChild(el);
      el.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(el);
      return ok;
    } catch {
      return false;
    }
  }
}

/* ───────────────────────────── SUB-COMPONENTS ───────────────────────────── */

function RoomBadge({ roomId, t }: { roomId: string; t: (k: StringKey) => string }) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const id = setTimeout(() => setCopied(false), 1800);
    return () => clearTimeout(id);
  }, [copied]);

  return (
    <div className="inline-flex items-center gap-3 rounded-full bg-cardbg py-1.5 pl-4 pr-1.5 ring-1 ring-gold-500/60">
      <span className="text-sm text-gold-500">{t('roomId')}</span>
      <span className="font-mono text-base font-bold tracking-wider text-gold-400">{roomId}</span>
      <button
        type="button"
        onClick={async () => setCopied(await copyText(roomId))}
        className="rounded-full bg-gold-500/15 px-3.5 py-1.5 text-sm font-semibold text-gold-300 active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold-300"
      >
        <span aria-live="polite">{copied ? t('copied') : t('copy')}</span>
      </button>
    </div>
  );
}

function BigBall({ n, empty }: { n: number | null; empty: string }) {
  if (n === null) {
    return (
      <div className="grid h-48 w-48 place-items-center rounded-full border-2 border-dashed border-gold-700 px-6 text-center text-sm text-gold-500 sm:h-60 sm:w-60">
        {empty}
      </div>
    );
  }
  return (
    <div
      key={n}
      className={[
        'host-anim grid h-48 w-48 place-items-center rounded-full text-darkbg sm:h-60 sm:w-60',
        'bg-[radial-gradient(circle_at_30%_25%,#FFE57F,#D4AF37_55%,#855A00)]',
        'shadow-[0_0_0_3px_rgba(255,215,0,0.35),0_20px_70px_-10px_rgba(212,175,55,0.7)]',
        'animate-[hostPop_500ms_cubic-bezier(.2,1.4,.4,1)]',
      ].join(' ')}
      role="img"
      aria-label={`${letterFor(n)}-${n}`}
    >
      <span className="flex items-baseline gap-1 font-black tabular-nums leading-none">
        <span className="text-5xl opacity-70 sm:text-6xl">{letterFor(n)}</span>
        <span className="text-6xl opacity-70 sm:text-7xl">-</span>
        <span className="text-7xl sm:text-8xl">{n}</span>
      </span>
    </div>
  );
}

/* ───────────────────────────── MAIN VIEW ───────────────────────────── */

export function HostView() {
  const h = useHostData();
  const t = (k: StringKey) => (STRINGS[h.lang] ?? STRINGS.en)[k];

  const called = h.calledNumbers;
  const calledSet = new Set(called);
  const current = called.length ? called[called.length - 1] : null;
  const recent = called.slice(-8, -1).reverse();
  const live = h.phase === 'running';
  const exhausted = called.length >= 75;

  // Countdown display only; the timer itself lives in RoundContext.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!h.autoCall || !live) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [h.autoCall, live]);
  const remaining =
    h.autoCall && live && h.nextCallAt ? Math.max(0, Math.ceil((h.nextCallAt - now) / 1000)) : null;

  const phaseLabel = t(h.phase);
  const smallPrimary = primaryBtn.replace('px-5 py-3.5', 'px-4 py-2.5');
  const smallGhost = ghostBtn.replace('px-5 py-3.5', 'px-4 py-2.5');

  return (
    <div className="space-y-5">
      <style>{`
        @keyframes hostPop { 0% { transform: scale(.3) rotate(-18deg); opacity: 0 } 100% { transform: scale(1) rotate(0); opacity: 1 } }
        @media (prefers-reduced-motion: reduce) { .host-anim { animation: none !important } }
      `}</style>

      {/* Top bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <RoomBadge roomId={h.roomId} t={t} />
        <span
          className={[
            'rounded-full px-3.5 py-1.5 text-sm font-semibold',
            live ? 'bg-gold-400 text-darkbg' : 'bg-white/5 text-gold-500',
          ].join(' ')}
        >
          {phaseLabel} · {called.length}/75
        </span>
      </div>

      {/* Stage */}
      <section className="rounded-3xl bg-cardbg px-4 py-8 ring-1 ring-gold-700/50 sm:py-10">
        <div className="flex flex-col items-center gap-6">
          <BigBall n={current} empty={t('none')} />

          <div className="flex min-h-10 flex-wrap items-center justify-center gap-2" aria-label={t('recent')}>
            {recent.map((n) => (
              <span
                key={n}
                className="rounded-full bg-white/[0.05] px-3 py-1 text-sm font-bold tabular-nums text-gold-300 ring-1 ring-gold-700/40"
              >
                {letterFor(n)}-{n}
              </span>
            ))}
          </div>

          <div className="grid w-full max-w-md gap-3">
            {h.phase === 'waiting' ? (
              <button type="button" onClick={h.startRound} className={primaryBtn}>
                {t('start')}
              </button>
            ) : h.phase === 'ended' ? (
              <button type="button" onClick={h.resetRound} className={primaryBtn}>
                {t('newRound')}
              </button>
            ) : (
              <>
                <button type="button" onClick={() => h.drawNext()} disabled={exhausted} className={primaryBtn}>
                  {exhausted ? t('allDrawn') : t('draw')}
                </button>
                <button type="button" onClick={h.endRound} className={ghostBtn}>
                  {t('end')}
                </button>
              </>
            )}
            {h.phase === 'waiting' && <p className="text-center text-xs text-gold-700">{t('startFirst')}</p>}
          </div>
        </div>
      </section>

      {SERVER_MODE && h.winner && (
        <p className="rounded-xl bg-gold-400 px-4 py-3 text-center font-bold text-darkbg">
          {t('winnerLabel')} #{h.winner.serial} · {h.winner.cardId}
        </p>
      )}

      {/* Claims (hosted demo: the host reviews them; in server mode the server decides instantly) */}
      {!SERVER_MODE && (
      <section className="rounded-2xl bg-cardbg p-4 ring-1 ring-gold-700/50 sm:p-5">
        <h2 className="mb-3 text-lg font-bold text-gold-300">
          {t('claims')}
          {h.claims.length > 0 && <span className="text-gold-500"> ({h.claims.length})</span>}
        </h2>
        {h.winner && (
          <p className="mb-3 rounded-xl bg-gold-400 px-4 py-2 text-center font-bold text-darkbg">
            {t('winnerLabel')} #{h.winner.serial} · {h.winner.cardId}
          </p>
        )}
        {h.claims.length === 0 ? (
          <p className="py-3 text-center text-sm text-gold-700">{t('noClaims')}</p>
        ) : (
          <ul className="space-y-2">
            {h.claims.map((c) => (
              <li key={c.id} className="rounded-xl bg-white/[0.04] p-3">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-mono text-sm text-gold-300">
                    #{c.serial} · {c.cardId}
                  </span>
                  <span className={c.wins ? 'text-sm font-bold text-gold-400' : 'text-sm font-semibold text-red-300'}>
                    {c.wins ? t('gridWins') : c.gridValid ? t('notWin') : t('badGrid')}
                  </span>
                </div>
                <p className="mt-1 text-xs text-gold-500">{c.originVerified ? t('originOk') : t('originNo')}</p>
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    disabled={!c.wins || h.phase !== 'running'}
                    onClick={() => void h.acceptClaim(c.id)}
                    className={smallPrimary + ' flex-1'}
                  >
                    {t('accept')}
                  </button>
                  <button type="button" onClick={() => void h.rejectClaim(c.id)} className={smallGhost + ' flex-1'}>
                    {t('reject')}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
      )}

      {/* Auto-call */}
      <section className="rounded-2xl bg-cardbg p-4 ring-1 ring-gold-700/50 sm:p-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-gold-300">{t('auto')}</h2>
            <p className="text-sm tabular-nums text-gold-500" aria-live="off">
              {t('every')} {h.callIntervalSec}
              {t('sec')}
              {remaining !== null && ` · ${t('nextIn')} ${remaining}${t('sec')}`}
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={h.autoCall}
            aria-label={t('auto')}
            disabled={!live || exhausted}
            onClick={() => h.setAutoCall(!h.autoCall)}
            className={[
              'relative h-8 w-14 shrink-0 rounded-full transition-colors disabled:opacity-40',
              'focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold-300',
              h.autoCall ? 'bg-gold-500' : 'bg-white/10 ring-1 ring-gold-700/50',
            ].join(' ')}
          >
            <span
              className={[
                'absolute top-1 h-6 w-6 rounded-full bg-darkbg ring-1 ring-gold-400 transition-all',
                h.autoCall ? 'left-7' : 'left-1',
              ].join(' ')}
            />
          </button>
        </div>

        <div className="mt-5">
          <label htmlFor="speed" className="mb-2 block text-sm text-gold-500">
            {t('speed')}
          </label>
          <input
            id="speed"
            type="range"
            min={1}
            max={60}
            step={1}
            value={h.callIntervalSec}
            onChange={(e) => h.setCallIntervalSec(Number(e.target.value))}
            className="w-full accent-gold-400"
          />
          <div className="mt-1 flex justify-between text-xs tabular-nums text-gold-700">
            <span>1{t('sec')}</span>
            <span>60{t('sec')}</span>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {PRESETS.map((s) => (
              <button
                key={s}
                type="button"
                aria-pressed={h.callIntervalSec === s}
                onClick={() => h.setCallIntervalSec(s)}
                className={[
                  'rounded-full px-3.5 py-1.5 text-sm font-semibold tabular-nums ring-1 active:scale-95',
                  h.callIntervalSec === s
                    ? 'bg-gold-500/20 text-gold-300 ring-gold-400'
                    : 'bg-white/[0.04] text-gold-500 ring-gold-700/40',
                ].join(' ')}
              >
                {s}
                {t('sec')}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Tracking grid */}
      <section className="rounded-2xl bg-cardbg p-3 ring-1 ring-gold-700/50 sm:p-5">
        <h2 className="mb-3 text-lg font-bold text-gold-300">
          {t('tracker')} <span className="text-gold-500">({called.length}/75)</span>
        </h2>
        <div className="grid grid-cols-5 gap-1.5 sm:gap-3">
          {LETTERS.map((l, col) => (
            <div key={l} className="space-y-1.5">
              <div className="text-center text-lg font-black text-gold-500">{l}</div>
              <div className="grid grid-cols-1 gap-1 sm:grid-cols-3">
                {Array.from({ length: 15 }, (_, i) => col * 15 + i + 1).map((n) => {
                  const on = calledSet.has(n);
                  const latest = n === current;
                  return (
                    <span
                      key={n}
                      aria-label={`${l}-${n}${on ? ' ✓' : ''}`}
                      className={[
                        'grid place-items-center rounded-md py-1 text-xs font-bold tabular-nums transition-colors sm:text-sm',
                        latest
                          ? 'bg-gold-300 text-darkbg ring-2 ring-white'
                          : on
                            ? 'bg-gradient-to-br from-gold-400 to-gold-600 text-darkbg'
                            : 'bg-white/[0.03] text-gold-700',
                      ].join(' ')}
                    >
                      {n}
                    </span>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

export default HostView;
