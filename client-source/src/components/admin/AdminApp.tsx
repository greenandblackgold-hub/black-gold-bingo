import { AdminPayouts } from '@/components/admin/AdminPayouts';
import { HostView } from '@/components/host/HostView';
import { useBackend } from '@/context/BackendContext';
import { useLanguage } from '@/context/LanguageContext';
import { SERVER_MODE } from '@/lib/api';
import type { Lang } from '@/types/game';

const LANGS: { id: Lang; label: string }[] = [
  { id: 'am', label: 'አማ' },
  { id: 'ti', label: 'ትግ' },
  { id: 'en', label: 'EN' },
];

const TEXT = {
  am: {
    title: 'መቆጣጠሪያ ማዕከል',
    back: '← ተጫዋች',
    denied: 'ይህ ገጽ ለጨዋታው ባለቤት ብቻ ነው።',
    demo: 'የሙከራ ሁነታ፦ ይህ በአንድ አሳሽ ውስጥ ብቻ የሚሰራ ማሳያ ነው፤ ማንም ሰው #host መክፈት ይችላል። ደህንነቱ የተጠበቀ አይደለም።',
  },
  ti: {
    title: 'ማእከል ቁጥጥሪ',
    back: '← ተጻዋታይ',
    denied: 'እዚ ገጽ ን ወናኒ እቲ ጸወታ ጥራይ እዩ።',
    demo: 'ናይ ፈተነ ኩነታት፦ እዚ ኣብ ሓደ ብሮውዘር ጥራይ ዝሰርሕ ምርኢት እዩ፤ ዝኾነ ሰብ #host ክኸፍት ይኽእል። ውሕስነት የብሉን።',
  },
  en: {
    title: 'Control Center',
    back: '← Player app',
    denied: 'This page is for the game owner only.',
    demo: 'Demo mode: runs in one browser only, and anyone can open #host. Not secure.',
  },
} as const;

export function AdminApp({ onExit }: { onExit: () => void }) {
  const backend = useBackend();
  const { lang, setLang } = useLanguage();
  const t = TEXT[lang];

  const backBtn = (
    <button
      type="button"
      onClick={onExit}
      className="shrink-0 whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-semibold text-gold-300 ring-1 ring-gold-700/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold-300"
    >
      {t.back}
    </button>
  );

  // Players never get any control, only this notice.
  if (!backend.canHost) {
    return (
      <div className="grid min-h-screen place-items-center px-6">
        <div className="max-w-sm space-y-4 text-center">
          <p className="text-lg font-semibold text-gold-300">{t.denied}</p>
          {backBtn}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-10">
      <header className="sticky top-0 z-30 border-b border-gold-700/40 bg-darkbg/90 pt-[env(safe-area-inset-top)] backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <div className="min-w-0 leading-tight">
            <p className="whitespace-nowrap bg-gradient-to-r from-gold-300 via-gold-400 to-gold-600 bg-clip-text text-base font-black text-transparent sm:text-lg">
              {t.title}
            </p>
            <p className="hidden text-xs font-semibold text-gold-500 sm:block">Black Gold PLC · Bingo PRO</p>
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
            {backBtn}
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 pt-5 sm:pt-8">
        {backend.kind === 'local' && (
          <p role="note" className="mb-5 rounded-xl bg-red-900/40 px-4 py-3 text-sm text-red-100 ring-1 ring-red-500/50">
            {t.demo}
          </p>
        )}
        <div className="space-y-5">
          <HostView />
          {SERVER_MODE && <AdminPayouts />}
        </div>
      </main>
    </div>
  );
}
