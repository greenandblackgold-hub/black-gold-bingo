import type { ReactNode } from 'react';
import { translations } from '@/lib/localization';
import { useLanguage } from '@/context/LanguageContext';

export type TabId = 'games' | 'play' | 'wallet' | 'menu';

const LABELS = translations.navigation;

function Icon({ children }: { children: ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {children}
    </svg>
  );
}

const ICONS: Record<TabId, ReactNode> = {
  games: <Icon><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></Icon>,
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
  menu: (
    <Icon><path d="M4 6h16M4 12h16M4 18h16" /></Icon>
  ),
};

const ORDER: TabId[] = ['games', 'wallet', 'menu'];

export function BottomNav({ active, onChange }: { active: TabId; onChange: (tab: TabId) => void }) {
  const { lang } = useLanguage();
  return (
    <nav
      aria-label={LABELS[lang].main}
      className="fixed inset-x-0 bottom-0 z-40 border-t border-gold-500/20 bg-darkbg/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_30px_rgba(0,0,0,0.25)] backdrop-blur-xl"
    >
      <ul className="mx-auto grid max-w-2xl grid-cols-3 px-2">
        {ORDER.map((id) => {
          const on = id === active;
          return (
            <li key={id}>
              <button
                type="button"
                aria-current={on ? 'page' : undefined}
                onClick={() => onChange(id)}
                className={[
                  'flex w-full flex-col items-center gap-1 rounded-xl py-3 text-xs font-semibold transition-colors',
                  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold-300',
                  on ? 'text-gold-400' : 'text-gold-700 hover:text-gold-500',
                ].join(' ')}
              >
                {ICONS[id]}
                {id === 'menu' ? LABELS[lang].menu : id === 'games' ? LABELS[lang].games : LABELS[lang].wallet}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
