import { useAppSettings } from '@/context/AppSettingsContext';
import { useBackend } from '@/context/BackendContext';
import { useLanguage } from '@/context/LanguageContext';
import { usePlayer } from '@/context/PlayerContext';
import type { Lang } from '@/types/game';

const LANGS: { id: Lang; label: string }[] = [
  { id: 'am', label: 'አማ' },
  { id: 'ti', label: 'ትግ' },
  { id: 'en', label: 'EN' },
];

const LABELS = {
  am: { soundOn: 'ድምጽ አጥፋ', soundOff: 'ድምጽ አብራ', wallet: 'ቦርሳ ክፈት', admin: 'መቆጣጠሪያ ማዕከል' },
  ti: { soundOn: 'ድምጺ ኣጥፍእ', soundOff: 'ድምጺ ኣብርህ', wallet: 'ቦርሳ ክፈት', admin: 'ማእከል ቁጥጥሪ' },
  en: { soundOn: 'Mute sounds', soundOff: 'Unmute sounds', wallet: 'Open wallet', admin: 'Control Center' },
} as const;

function SpeakerIcon({ on }: { on: boolean }) {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M11 5 6 9H3v6h3l5 4V5z" />
      {on ? (
        <>
          <path d="M15.5 8.5a5 5 0 0 1 0 7" />
          <path d="M18.5 5.5a9 9 0 0 1 0 13" />
        </>
      ) : (
        <>
          <path d="m16 9 5 6" />
          <path d="m21 9-5 6" />
        </>
      )}
    </svg>
  );
}

export function AppHeader({ onOpenWallet, onOpenAdmin }: { onOpenWallet: () => void; onOpenAdmin: () => void }) {
  const { lang, setLang } = useLanguage();
  const { balance } = usePlayer();
  const { soundEnabled, setSoundEnabled } = useAppSettings();
  const backend = useBackend();
  // Only the hosted page's owner is shown the link. Everyone else never sees it.
  const showAdminLink = backend.kind !== 'local' && backend.canHost;
  const l = LABELS[lang];

  return (
    <header className="sticky top-0 z-30 border-b border-gold-700/40 bg-darkbg/90 pt-[env(safe-area-inset-top)] backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
        <div className="min-w-0 leading-tight">
          <p className="truncate bg-gradient-to-r from-gold-300 via-gold-400 to-gold-600 bg-clip-text text-lg font-black text-transparent">
            Black Gold PLC
          </p>
          {showAdminLink ? (
            <button
              type="button"
              onClick={onOpenAdmin}
              className="text-xs font-semibold text-gold-400 underline underline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold-300"
            >
              {l.admin} →
            </button>
          ) : (
            <p className="text-xs font-semibold text-gold-500">Bingo PRO</p>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          <div role="group" aria-label="Language" className="flex overflow-hidden rounded-full ring-1 ring-gold-700/60">
            {LANGS.map((o) => (
              <button
                key={o.id}
                type="button"
                aria-pressed={lang === o.id}
                onClick={() => setLang(o.id)}
                className={[
                  'px-2.5 py-1.5 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold-300',
                  lang === o.id ? 'bg-gold-500 text-darkbg' : 'text-gold-300',
                ].join(' ')}
              >
                {o.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setSoundEnabled(!soundEnabled)}
            aria-label={soundEnabled ? l.soundOn : l.soundOff}
            aria-pressed={soundEnabled}
            className="grid h-9 w-9 place-items-center rounded-full text-gold-300 ring-1 ring-gold-700/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold-300"
          >
            <SpeakerIcon on={soundEnabled} />
          </button>

          <button
            type="button"
            onClick={onOpenWallet}
            aria-label={l.wallet}
            className="whitespace-nowrap rounded-full bg-gold-500/15 px-3 py-1.5 text-sm font-bold tabular-nums text-gold-300 ring-1 ring-gold-500/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold-300"
          >
            {balance.toFixed(2)} <span className="text-gold-500">ETB</span>
          </button>
        </div>
      </div>
    </header>
  );
}
