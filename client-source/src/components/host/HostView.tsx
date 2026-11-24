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
import { translations, patternNames } from '@/lib/localization';
import { WIN_PATTERN_OPTIONS } from '@/lib/patternCatalog';
import { hostExtraLocale } from '@/lib/hostExtraLocalization';
import { PatternGuide } from '@/components/play/PatternGuide';
import { useLanguage } from '@/context/LanguageContext';
import { useRound } from '@/context/RoundContext';
import { SERVER_MODE } from '@/lib/api';
import type { Lang, WinPattern } from '@/types/game';

/* ───────────────────────────── CONTEXT WIRING ───────────────────────────── */

function useHostData() {
  const { lang } = useLanguage();
  const round = useRound();
  return { lang: lang as Lang, ...round };
}

/* ─────────────────────────── TRANSLATIONS ─────────────────────────── */
/* Tigrigna strings should be reviewed by a native speaker. */

const STRINGS = translations.host;

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
  const { lang } = useLanguage();
  const x = (key: Parameters<typeof hostExtraLocale>[1]) => hostExtraLocale(lang, key);
  const t = (k: StringKey) => (STRINGS[h.lang] ?? STRINGS.en)[k];
  const [announcementDraft, setAnnouncementDraft] = useState('');
  useEffect(() => setAnnouncementDraft(h.announcement?.message ?? ''), [h.announcement?.message]);
  const [prizeModeDraft, setPrizeModeDraft] = useState<'revenue_percent' | 'per_player' | 'fixed'>(h.prizeMode ?? 'revenue_percent');
  const [prizePercentDraft, setPrizePercentDraft] = useState(String(h.prizePercent ?? 80));
  const [prizePerPlayerDraft, setPrizePerPlayerDraft] = useState(String(h.prizePerPlayer ?? 0));
  const [fixedPrizeDraft, setFixedPrizeDraft] = useState(String(h.fixedPrizeEtb ?? 0));
  const [maxPrizeCapDraft, setMaxPrizeCapDraft] = useState(String(h.maxPrizeCap ?? 0));
  const [roundIntervalDraft, setRoundIntervalDraft] = useState(String(h.roundIntervalMinutes ?? 10));
  useEffect(() => {
    setPrizeModeDraft(h.prizeMode ?? 'revenue_percent');
    setPrizePercentDraft(String(h.prizePercent ?? 80));
    setPrizePerPlayerDraft(String(h.prizePerPlayer ?? 0));
    setFixedPrizeDraft(String(h.fixedPrizeEtb ?? 0));
    setMaxPrizeCapDraft(String(h.maxPrizeCap ?? 0));
    setRoundIntervalDraft(String(h.roundIntervalMinutes ?? 10));
  }, [h.prizeMode, h.prizePercent, h.prizePerPlayer, h.fixedPrizeEtb, h.maxPrizeCap, h.roundIntervalMinutes]);

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
    const id = setInterval(() => setNow(Date.now()), 1000);
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

      {/* Host announcement is persisted on the shared round state and streamed to every player. */}
      <section className="rounded-2xl bg-cardbg p-4 ring-1 ring-gold-700/50 sm:p-5">
        <label htmlFor="player-announcement" className="mb-2 block text-sm font-semibold text-gold-300">{x('announcementLabel')}</label>
        <textarea
          id="player-announcement"
          value={announcementDraft}
          maxLength={240}
          rows={2}
          onChange={(e) => setAnnouncementDraft(e.target.value)}
          placeholder={x('announcementPlaceholder')}
          className="w-full resize-y rounded-xl bg-zinc-900 px-4 py-3 text-sm text-gold-100 ring-1 ring-gold-700/60 placeholder:text-gold-700 focus:outline-none focus:ring-gold-400"
        />
        <div className="mt-3 flex items-center justify-between gap-3">
          <span className="text-xs text-gold-600">{announcementDraft.length}/240</span>
          <div className="flex gap-2">
            <button type="button" onClick={() => { setAnnouncementDraft(''); h.setAnnouncement(''); }} className={ghostBtn}>{x('clear')}</button>
            <button type="button" onClick={() => h.setAnnouncement(announcementDraft)} disabled={!announcementDraft.trim()} className={primaryBtn}>{x('send')}</button>
          </div>
        </div>
        {h.announcement?.message && <p className="mt-3 rounded-lg border border-emerald-500/25 bg-emerald-950/35 px-3 py-2 text-xs text-emerald-100">{x('playerDisplay')} {h.announcement.message}</p>}
      </section>

      {/* Winning pattern is selected before a round starts and enforced by the server. */}
      <section className="rounded-2xl bg-cardbg p-4 ring-1 ring-gold-700/50 sm:p-5">
        <label htmlFor="win-pattern" className="mb-2 block text-sm font-semibold text-gold-300">{x('winningPattern')}</label>
        <select id="win-pattern" value={h.winPattern} disabled={h.phase === 'running'}
          onChange={(e) => h.setWinPattern(e.target.value as WinPattern)}
          className="w-full rounded-xl bg-zinc-900 px-4 py-3 text-gold-300 ring-1 ring-gold-700/60 disabled:opacity-50">
          {WIN_PATTERN_OPTIONS.map((pattern) => <option key={pattern} value={pattern}>{patternNames[h.lang][pattern]}</option>)}
        </select>
        <PatternGuide pattern={h.winPattern} lang={h.lang} compact />
        <p className="mt-2 text-xs text-gold-600">{h.phase === 'running' ? 'የአሁኑ ዙር እየተካሄደ ሳለ ቅጡን መቀየር አይቻልም። ዙሩ ሲያበቃ ለቀጣዩ ዙር ይምረጡ።' : 'ቀጣዩን ዙር የሚጀምርበትን ቅጽ እዚህ ይምረጡ።'}</p>
      </section>

      {/* Prize calculation and automatic next-round interval are server controlled. */}
      <section className="rounded-2xl bg-cardbg p-4 ring-1 ring-gold-700/50 sm:p-5">
        <h2 className="mb-3 text-lg font-bold text-gold-300">{x('prizeSchedule')}</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1 text-sm text-gold-300">{x('prizeMode')}
            <select disabled={h.phase !== 'waiting'} value={prizeModeDraft} onChange={(e) => setPrizeModeDraft(e.target.value as 'revenue_percent' | 'per_player' | 'fixed')} className="rounded-xl bg-zinc-900 px-3 py-2 text-gold-100 ring-1 ring-gold-700/60">
              <option value="revenue_percent">{x('revenuePercent')}</option>
              <option value="per_player">{x('perPlayer')}</option>
              <option value="fixed">{x('fixedPrize')}</option>
            </select>
          </label>
          <label className="grid gap-1 text-sm text-gold-300">{x('interval')}
            <select disabled={h.phase !== 'waiting'} value={roundIntervalDraft} onChange={(e) => setRoundIntervalDraft(e.target.value)} className="rounded-xl bg-zinc-900 px-3 py-2 text-gold-100 ring-1 ring-gold-700/60">
              <option value="4">{x('minutes4')}</option><option value="5">{x('minutes5')}</option><option value="10">{x('minutes10')}</option>
            </select>
          </label>
          {prizeModeDraft === 'revenue_percent' ? (
            <label className="grid gap-1 text-sm text-gold-300">{x('grossPercent')}
              <input disabled={h.phase !== 'waiting'} type="number" min="0" max="100" step="0.01" value={prizePercentDraft} onChange={(e) => setPrizePercentDraft(e.target.value)} className="rounded-xl bg-zinc-900 px-3 py-2 text-gold-100 ring-1 ring-gold-700/60" />
            </label>
          ) : prizeModeDraft === 'per_player' ? (
            <label className="grid gap-1 text-sm text-gold-300">{x('perPlayerAmount')}
              <input disabled={h.phase !== 'waiting'} type="number" min="0" step="0.01" value={prizePerPlayerDraft} onChange={(e) => setPrizePerPlayerDraft(e.target.value)} className="rounded-xl bg-zinc-900 px-3 py-2 text-gold-100 ring-1 ring-gold-700/60" />
            </label>
          ) : (
            <label className="grid gap-1 text-sm text-gold-300">{x('fixedAmount')}
              <input disabled={h.phase !== 'waiting'} type="number" min="0" step="0.01" value={fixedPrizeDraft} onChange={(e) => setFixedPrizeDraft(e.target.value)} className="rounded-xl bg-zinc-900 px-3 py-2 text-gold-100 ring-1 ring-gold-700/60" />
            </label>
          )}
          <label className="grid gap-1 text-sm text-gold-300">{x('maxCap')}
            <input disabled={h.phase !== 'waiting'} type="number" min="0" step="0.01" value={maxPrizeCapDraft} onChange={(e) => setMaxPrizeCapDraft(e.target.value)} className="rounded-xl bg-zinc-900 px-3 py-2 text-gold-100 ring-1 ring-gold-700/60" />
          </label>
        </div>
        <p className="mt-3 text-xs text-gold-500">{x('uniquePlayers')}: {h.roundPlayerCount ?? 0} · {x('calculatedPrize')}: {Number(h.roundPrizeEtb ?? 0).toFixed(2)} ብር</p>
        <button type="button" disabled={h.phase !== 'waiting'} onClick={() => h.setPrizeScheduleSettings?.({
          prizeMode: prizeModeDraft, prizePercent: Number(prizePercentDraft), prizePerPlayer: Number(prizePerPlayerDraft), fixedPrize: Number(fixedPrizeDraft),
          maxPrizeCap: Number(maxPrizeCapDraft), roundIntervalMinutes: Number(roundIntervalDraft) as 4 | 5 | 10,
        })} className={primaryBtn}>{x('save')}</button>
        {h.phase !== 'waiting' && <p className="mt-2 text-xs text-gold-600">{x('locked')}</p>}
        {prizeModeDraft === 'fixed' && <p className="mt-2 text-xs text-gold-600">{x('fixedNote')}</p>}
      </section>

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
