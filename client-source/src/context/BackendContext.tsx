import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { useLanguage } from '@/context/LanguageContext';
import { createBackend } from '@/lib/backend';
import type { GameBackend } from '@/types/game';

export const BackendContext = createContext<GameBackend | null>(null);

const TEXT = {
  am: { connecting: 'በመገናኘት ላይ…', needSignIn: 'ጨዋታውን ለመጫወት ወደ Claude መለያዎ ይግቡና ይህን ገጽ እንደገና ይክፈቱ።' },
  ti: { connecting: 'ይራኸብ ኣሎ…', needSignIn: 'ነቲ ጸወታ ንምጽዋት ናብ መለያ Claude ኣታዉ እሞ እዚ ገጽ ደጊምካ ክፈት።' },
  en: { connecting: 'Connecting…', needSignIn: 'Sign in to your Claude account and reopen this page to join the game.' },
} as const;

export function BackendProvider({ children }: { children: ReactNode }) {
  const { lang } = useLanguage();
  const [backend, setBackend] = useState<GameBackend | null>(null);

  useEffect(() => {
    let alive = true;
    void createBackend().then((b) => {
      if (alive) setBackend(b);
    });
    return () => {
      alive = false;
    };
  }, []);

  const t = TEXT[lang];
  if (!backend) {
    return (
      <div className="grid min-h-screen place-items-center px-6 text-center text-gold-500" role="status" aria-live="polite">
        {t.connecting}
      </div>
    );
  }
  if (backend.kind === 'unavailable') {
    return (
      <div className="grid min-h-screen place-items-center px-6 text-center">
        <p className="max-w-sm text-lg font-semibold text-gold-300">{t.needSignIn}</p>
      </div>
    );
  }
  return <BackendContext.Provider value={backend}>{children}</BackendContext.Provider>;
}

export function useBackend(): GameBackend {
  const v = useContext(BackendContext);
  if (!v) throw new Error('useBackend must be used inside <BackendProvider>');
  return v;
}
