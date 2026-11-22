import { useAppSettings } from '@/context/AppSettingsContext';
import { formatAmount, translations } from '@/lib/localization';
import { useRound } from '@/context/RoundContext';
import { useBackend } from '@/context/BackendContext';
import { useLanguage } from '@/context/LanguageContext';
import type { Lang } from '@/types/game';

const LANGS: { id: Lang; label: string }[] = [
  { id: 'am', label: 'አማ' },
  { id: 'ti', label: 'ትግ' },
  { id: 'en', label: 'EN' },
];

const LABELS = translations.header;

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

function AudioSwitch({ label, checked, onChange }: { label: string; checked: boolean; onChange: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      className="flex w-full items-center justify-between gap-3 rounded-lg px-2 py-2 text-left text-sm text-gold-100 hover:bg-white/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold-300"
    >
      <span>{label}</span>
      <span className={['relative h-5 w-9 shrink-0 rounded-full transition-colors', checked ? 'bg-gold-500' : 'bg-zinc-600'].join(' ')}>
        <span className={['absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform', checked ? 'translate-x-4' : 'translate-x-0.5'].join(' ')} />
      </span>
    </button>
  );
}

export function AppHeader({ onOpenWallet, onOpenAdmin, onLogout, onOpenMenu, onOpenSettings, hideControls = false }: { onOpenWallet: () => void; onOpenAdmin: () => void; onLogout: () => void; onOpenMenu: () => void; onOpenSettings: () => void; hideControls?: boolean }) {
  const { lang, setLang } = useLanguage();
  const {
    soundEnabled, setSoundEnabled, voiceEnabled, setVoiceEnabled, audioVolume, setAudioVolume,
  } = useAppSettings();
  const backend = useBackend();
  const { roundPrizeEtb } = useRound();
  // Only the hosted page's owner is shown the link. Everyone else never sees it.
  const showAdminLink = backend.kind !== 'local' && backend.canHost;
  const l = LABELS[lang];
  const anyAudioOn = soundEnabled || voiceEnabled;

  return (
    <header className="sticky top-0 z-30 border-b border-gold-500/20 bg-darkbg/95 pt-[env(safe-area-inset-top)] shadow-lg shadow-black/10 backdrop-blur-xl">
      {hideControls ? (
        <div className="mx-auto grid w-full max-w-6xl grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 px-2 py-2 sm:gap-3 sm:px-4">
          <div className="flex min-w-0 flex-col items-start justify-center gap-1">
            <p className="max-w-full truncate text-[9px] font-black leading-none tracking-wide text-gold-400 sm:text-xs">Black Gold PLC</p>
            <button type="button" onClick={onLogout} aria-label="ውጣ" title="ውጣ" className="flex min-h-8 items-center gap-1 rounded-full border border-yellow-300/70 px-2 text-white transition hover:bg-yellow-400/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-yellow-300">
              <span className="text-2xl font-black leading-none">‹</span>
              <span className="whitespace-nowrap text-xs font-black sm:text-sm">ውጣ</span>
            </button>
          </div>
          <div className="flex min-w-0 items-center justify-center gap-1 border-x border-yellow-500/70 px-2 text-yellow-300 sm:gap-2 sm:px-3">
            <span className="text-2xl leading-none drop-shadow-[0_0_12px_rgba(255,215,0,1)] sm:text-4xl">🏆</span>
            <strong className="whitespace-nowrap text-sm font-black tracking-tight text-yellow-300 drop-shadow-[0_0_12px_rgba(255,215,0,.9)] sm:text-2xl">
              {roundPrizeEtb !== undefined ? formatAmount(lang, roundPrizeEtb) : '—'} ብር
            </strong>
          </div>
          <div className="flex shrink-0 items-center justify-self-end gap-1 sm:gap-2">
            <button type="button" onClick={onOpenMenu} aria-label="ሜኑ ክፈት" title="ሜኑ" className="grid h-9 w-9 place-items-center rounded-full border border-yellow-400/60 text-2xl leading-none text-white transition hover:bg-yellow-400/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-yellow-300 sm:h-10 sm:w-10">⋮</button>
            <button type="button" onClick={onOpenSettings} aria-label="ሴቲንግ ክፈት" title="ሴቲንግ" className="grid h-9 w-9 place-items-center rounded-full border border-yellow-400/60 text-white transition hover:bg-yellow-400/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-yellow-300 sm:h-10 sm:w-10">
              <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16" /></svg>
            </button>
          </div>
        </div>
      ) : (
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-3 py-3 sm:gap-3 sm:px-4">
          <div className="min-w-0 leading-tight">
            <p className="truncate bg-gradient-to-r from-gold-200 via-gold-400 to-gold-600 bg-clip-text text-base font-black tracking-wide text-transparent sm:text-lg">
              Black Gold PLC
            </p>
            {showAdminLink && (
              <button
                type="button"
                onClick={onOpenAdmin}
                className="text-xs font-semibold text-gold-400 underline underline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold-300"
              >
                {l.admin} →
              </button>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <div role="group" aria-label={l.languageLabel} className="flex overflow-hidden rounded-full ring-1 ring-gold-700/60">
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
            <details className="group relative">
              <summary
                aria-label={l.audio}
                title={l.audio}
                className="grid h-9 w-9 cursor-pointer list-none place-items-center rounded-full text-gold-300 ring-1 ring-gold-700/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold-300 [&::-webkit-details-marker]:hidden"
              >
                <SpeakerIcon on={anyAudioOn} />
              </summary>
              <div className="absolute right-0 top-full z-50 mt-2 w-64 rounded-2xl border border-gold-500/30 bg-zinc-950 p-3 shadow-2xl shadow-black/50">
                <p className="mb-2 px-2 text-xs font-black uppercase tracking-wider text-gold-400">{l.audio}</p>
                <AudioSwitch label={l.effects} checked={soundEnabled} onChange={() => setSoundEnabled(!soundEnabled)} />
                <AudioSwitch label={l.voice} checked={voiceEnabled} onChange={() => setVoiceEnabled(!voiceEnabled)} />
                <p className="px-2 pt-2 text-xs text-zinc-300">{l.volume}</p>
                <input
                  aria-label={l.volume}
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={audioVolume}
                  onChange={(event) => setAudioVolume(Number(event.currentTarget.value))}
                  className="mt-2 w-full accent-yellow-500"
                />
                <p className="px-2 pt-1 text-[10px] leading-relaxed text-zinc-500">{l.voiceHelp}</p>
              </div>
            </details>
          </div>
        </div>
      )}
    </header>
  );
}
