import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Lang } from '@/types/game';

interface LanguageValue {
  lang: Lang;
  setLang: (lang: Lang) => void;
}

const KEY = 'bgb.lang';
const LanguageContext = createContext<LanguageValue | null>(null);

function loadLang(): Lang {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw === 'am' || raw === 'ti' || raw === 'en') return raw;
  } catch {
    /* ignore */
  }
  return 'am';
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>(loadLang);

  useEffect(() => {
    try {
      localStorage.setItem(KEY, lang);
    } catch {
      /* ignore */
    }
    document.documentElement.lang = lang;
  }, [lang]);

  const value = useMemo<LanguageValue>(() => ({ lang, setLang }), [lang]);
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage(): LanguageValue {
  const v = useContext(LanguageContext);
  if (!v) throw new Error('useLanguage must be used inside <LanguageProvider>');
  return v;
}
