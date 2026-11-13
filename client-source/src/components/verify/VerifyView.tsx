/**
 * src/components/verify/VerifyView.tsx
 *
 * Anti-cheat verifier: enter a card ID and check its authenticity and numbers
 * against the game server / session record, with the called numbers overlaid.
 * Reads from useRound().verifyCard; shared types live in '@/types/game'.
 * isWinner must come from the server response, never from the browser.
 */
import { useMemo, useState } from 'react';
import { useLanguage } from '@/context/LanguageContext';
import { useRound } from '@/context/RoundContext';
import type { Lang, VerifyResult } from '@/types/game';

/* ───────────────────────────── CONTEXT WIRING ───────────────────────────── */

function useVerifyData() {
  const { lang } = useLanguage();
  const { calledNumbers, verifyCard } = useRound();
  return { lang: lang as Lang, calledNumbers, verifyCard };
}

/* ─────────────────────────── TRANSLATIONS ─────────────────────────── */
/* Tigrigna strings should be reviewed by a native speaker. */

const STRINGS = {
  am: {
    title: 'ካርድ አረጋጋጭ',
    hint: 'የካርድ መለያ ያስገቡና ከጨዋታው ሰርቨር መዝገብ ጋር ያመሳስሉ።',
    label: 'የካርድ መለያ',
    btn: 'አረጋግጥ',
    checking: 'በመፈተሽ ላይ…',
    valid: 'ካርዱ እውነተኛ ነው',
    notFound: 'ይህ ካርድ በዚህ ጨዋታ አልተገኘም',
    tampered: 'የካርዱ ቁጥሮች ከሰርቨሩ መዝገብ ጋር አይመሳሰሉም',
    winner: 'አሸናፊ ካርድ፤ ቢንጎ ተረጋግጧል',
    notWinner: 'ገና አሸናፊ አይደለም',
    matched: 'የወጡ ቁጥሮች በካርዱ ላይ',
    serial: 'ተከታታይ ቁጥር',
    recent: 'የቅርብ ፍተሻዎች',
    error: 'ማረጋገጥ አልተቻለም። እንደገና ይሞክሩ።',
    badFormat: 'የካርድ መለያ ከ3 እስከ 40 ፊደል፣ ቁጥር ወይም ሰረዝ መሆን አለበት',
    free: 'ነጻ',
    clear: 'አጥፋ',
  },
  ti: {
    title: 'መረጋገጺ ካርድ',
    hint: 'መለለዪ ካርድ የእትዉን ምስ መዝገብ ሰርቨር ጸወታ የስማምዑ።',
    label: 'መለለዪ ካርድ',
    btn: 'ኣረጋግጽ',
    checking: 'ይምርመር ኣሎ…',
    valid: 'ካርዲ ሓቀኛ እዩ',
    notFound: 'እዚ ካርድ ኣብዚ ጸወታ ኣይተረኽበን',
    tampered: 'ቁጽሪታት ካርድ ምስ መዝገብ ሰርቨር ኣይሰማምዑን',
    winner: 'ዕዉት ካርድ፤ ቢንጎ ተረጋጊጹ',
    notWinner: 'ገና ዕዉት ኣይኮነን',
    matched: 'ዝወጹ ቁጽሪታት ኣብ ካርድ',
    serial: 'ተኸታታሊ ቁጽሪ',
    recent: 'ናይ ቀረባ ምምርማራት',
    error: 'ምርግጋጽ ኣይተኻኣለን። እንደገና ፈትኑ።',
    badFormat: 'መለለዪ ካርድ ካብ 3 ክሳብ 40 ፊደል፣ ቁጽሪ ወይ ሰረዝ ክኸውን ኣለዎ',
    free: 'ነጻ',
    clear: 'ደምስስ',
  },
  en: {
    title: 'Card verifier',
    hint: "Enter a card ID to check it against the game server's record.",
    label: 'Card ID',
    btn: 'Verify',
    checking: 'Checking…',
    valid: 'Card is authentic',
    notFound: 'This card was not found in this game',
    tampered: "This card's numbers do not match the server record",
    winner: 'Winning card: bingo confirmed',
    notWinner: 'Not a winning card yet',
    matched: 'Called numbers on this card',
    serial: 'Serial',
    recent: 'Recent checks',
    error: "Couldn't verify right now. Try again.",
    badFormat: 'Card ID must be 3 to 40 letters, digits or dashes',
    free: 'FREE',
    clear: 'Clear',
  },
} as const;

type StringKey = keyof (typeof STRINGS)['en'];

/* ───────────────────────────── HELPERS ───────────────────────────── */

const LETTERS = ['B', 'I', 'N', 'G', 'O'] as const;
const ID_RE = /^[A-Za-z0-9_-]{3,40}$/;

interface HistoryItem {
  id: string;
  status: VerifyResult['status'];
  winner: boolean;
}

/* ───────────────────────────── RESULT CARD ───────────────────────────── */

function ResultPanel({
  result,
  called,
  t,
}: {
  result: VerifyResult;
  called: Set<number>;
  t: (k: StringKey) => string;
}) {
  const ok = result.status === 'valid';
  const winSet = useMemo(
    () => new Set((result.winningLine ?? []).map(([r, c]) => `${r}-${c}`)),
    [result.winningLine],
  );
  const grid = result.card?.grid;
  const matched = useMemo(
    () => (grid ? grid.flat().filter((v) => v !== null && called.has(v as number)).length : 0),
    [grid, called],
  );

  const headline =
    result.status === 'valid' ? t('valid') : result.status === 'not_found' ? t('notFound') : t('tampered');

  return (
    <section
      role="status"
      aria-live="polite"
      className={[
        'rounded-2xl bg-cardbg p-4 sm:p-5',
        ok ? 'ring-2 ring-gold-400' : 'ring-2 ring-red-500/70',
      ].join(' ')}
    >
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className={[
            'grid h-9 w-9 shrink-0 place-items-center rounded-full text-lg font-black',
            ok ? 'bg-gold-400 text-darkbg' : 'bg-red-500/80 text-white',
          ].join(' ')}
        >
          {ok ? '✓' : '!'}
        </span>
        <div>
          <p className={['text-lg font-bold', ok ? 'text-gold-300' : 'text-red-300'].join(' ')}>{headline}</p>
          {ok && (
            <p
              className={[
                'mt-0.5 text-sm font-semibold',
                result.isWinner ? 'text-gold-400' : 'text-gold-500',
              ].join(' ')}
            >
              {result.isWinner ? t('winner') : t('notWinner')}
            </p>
          )}
        </div>
      </div>

      {ok && result.card && grid && (
        <div className="mt-4">
          <div className="mb-3 flex items-baseline justify-between text-sm">
            <span className="text-gold-500">
              {t('serial')}: <span className="font-bold tabular-nums text-gold-300">#{result.card.serial}</span>
            </span>
            <span className="text-gold-500">
              {t('matched')}: <span className="font-bold tabular-nums text-gold-300">{matched}</span>
            </span>
          </div>

          <div className="mx-auto max-w-xs">
            <div className="grid grid-cols-5 gap-1 pb-1 text-center text-sm font-black text-gold-500">
              {LETTERS.map((l) => (
                <span key={l}>{l}</span>
              ))}
            </div>
            <div className="grid grid-cols-5 gap-1">
              {grid.flatMap((row, r) =>
                row.map((v, c) => {
                  const free = v === null;
                  const isCalled = free || called.has(v);
                  const inWin = winSet.has(`${r}-${c}`);
                  return (
                    <span
                      key={`${r}-${c}`}
                      className={[
                        'grid aspect-square place-items-center rounded-lg text-base font-bold tabular-nums',
                        isCalled
                          ? 'bg-gradient-to-br from-gold-300 via-gold-500 to-gold-600 text-darkbg'
                          : 'bg-white/[0.04] text-gold-300/70',
                        inWin ? 'outline outline-2 outline-white/90' : '',
                      ].join(' ')}
                    >
                      {free ? <span className="text-xs">★</span> : v}
                    </span>
                  );
                }),
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

/* ───────────────────────────── MAIN VIEW ───────────────────────────── */

export function VerifyView() {
  const { lang, calledNumbers, verifyCard } = useVerifyData();
  const t = (k: StringKey) => (STRINGS[lang] ?? STRINGS.en)[k];

  const called = useMemo(() => new Set(calledNumbers), [calledNumbers]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<VerifyResult | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);

  const run = async (raw: string) => {
    const id = raw.trim().toUpperCase();
    if (!ID_RE.test(id)) {
      setError(t('badFormat'));
      setResult(null);
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const res = await verifyCard(id);
      setResult(res);
      setHistory((h) =>
        [{ id, status: res.status, winner: !!res.isWinner }, ...h.filter((x) => x.id !== id)].slice(0, 5),
      );
    } catch {
      setResult(null);
      setError(t('error'));
    } finally {
      setBusy(false);
    }
  };

  const clear = () => {
    setInput('');
    setResult(null);
    setError(null);
  };

  return (
    <div className="mx-auto max-w-xl space-y-5">
      <header>
        <h1 className="text-2xl font-black text-gold-400">{t('title')}</h1>
        <p className="mt-1 text-sm text-gold-500">{t('hint')}</p>
      </header>

      <div className="rounded-2xl bg-cardbg p-4 ring-1 ring-gold-700/50 sm:p-5">
        <label htmlFor="card-id" className="mb-2 block text-sm text-gold-500">
          {t('label')}
        </label>
        <div className="flex gap-2">
          <input
            id="card-id"
            value={input}
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            maxLength={40}
            aria-invalid={!!error}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !busy && run(input)}
            className="min-w-0 flex-1 rounded-xl bg-white/[0.05] px-4 py-3 font-mono uppercase tracking-wider text-gold-300 ring-1 ring-gold-700/50 placeholder:text-gold-700 focus:outline-none focus:ring-2 focus:ring-gold-400"
          />
          <button
            type="button"
            disabled={busy || input.trim() === ''}
            onClick={() => run(input)}
            className="shrink-0 rounded-xl bg-gradient-to-br from-gold-300 via-gold-500 to-gold-600 px-5 font-bold text-darkbg active:scale-95 disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold-300"
          >
            {busy ? t('checking') : t('btn')}
          </button>
        </div>
        {error && (
          <p role="alert" className="mt-2 text-sm text-red-300">
            {error}
          </p>
        )}
        {(input || result) && (
          <button type="button" onClick={clear} className="mt-3 text-sm font-medium text-gold-500 hover:text-gold-300">
            {t('clear')}
          </button>
        )}
      </div>

      {result && <ResultPanel result={result} called={called} t={t} />}

      {history.length > 0 && (
        <section className="rounded-2xl bg-cardbg p-4 ring-1 ring-gold-700/50">
          <h2 className="mb-2 text-sm font-semibold text-gold-500">{t('recent')}</h2>
          <ul className="divide-y divide-gold-700/30">
            {history.map((h) => (
              <li key={h.id}>
                <button
                  type="button"
                  onClick={() => {
                    setInput(h.id);
                    run(h.id);
                  }}
                  className="flex w-full items-center justify-between py-2.5 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold-300"
                >
                  <span className="font-mono text-sm tracking-wider text-gold-300">{h.id}</span>
                  <span
                    className={[
                      'text-xs font-semibold',
                      h.status === 'valid' ? 'text-gold-400' : 'text-red-300',
                    ].join(' ')}
                  >
                    {h.status === 'valid' ? (h.winner ? '★ ✓' : '✓') : '✕'}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

export default VerifyView;
