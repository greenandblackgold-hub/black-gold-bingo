import type { ReactNode } from 'react';
import { useLanguage } from '@/context/LanguageContext';

export type TabId = 'play' | 'wallet' | 'verify';

const LABELS: Record<'am' | 'ti' | 'en', Record<TabId, string>> = {
  am: { play: 'ጨዋታ', wallet: 'ቦርሳ', verify: 'አረጋግጥ' },
  ti: { play: 'ጸወታ', wallet: 'ቦርሳ', verify: 'ኣረጋግጽ' },
  en: { play: 'Play', wallet: 'Wallet', verify: 'Verify' },
};

function Icon({ children }: { children: ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {children}
    </svg>
  );
}

const ICONS: Record<TabId, ReactNode> = {
  play: (
    <Icon>
      <circle cx="12" cy="12" r="9" />
      <path d="m10 8.5 5 3.5-5 3.5z" />
    </Icon>
  ),
  wallet: (
    <Icon>
      <path d="M3 7a2 2 0 0 1 2-2h13v4" />
      <path d="M3 7v11a2 2 0 0 0 2 2h14a1 1 0 0 0 1-1v-9a1 1 0 0 0-1-1H5a2 2 0 0 1-2-2z" />
      <circle cx="16" cy="14.5" r="1" />
    </Icon>
  ),
  verify: (
    <Icon>
      <path d="M12 3 5 6v5c0 4.5 3 8 7 10 4-2 7-5.5 7-10V6z" />
      <path d="m9 12 2 2 4-4" />
    </Icon>
  ),
};

const ORDER: TabId[] = ['play', 'wallet', 'verify'];

export function BottomNav({ active, onChange }: { active: TabId; onChange: (tab: TabId) => void }) {
  const { lang } = useLanguage();
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-gold-700/40 bg-darkbg/95 pb-[env(safe-area-inset-bottom)] backdrop-blur"
    >
      <ul className="mx-auto grid max-w-xl grid-cols-3">
        {ORDER.map((id) => {
          const on = id === active;
          return (
            <li key={id}>
              <button
                type="button"
                aria-current={on ? 'page' : undefined}
                onClick={() => onChange(id)}
                className={[
                  'flex w-full flex-col items-center gap-1 py-2.5 text-xs font-semibold transition-colors',
                  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold-300',
                  on ? 'text-gold-400' : 'text-gold-700 hover:text-gold-500',
                ].join(' ')}
              >
                {ICONS[id]}
                {LABELS[lang][id]}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
