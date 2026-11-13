import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { setAudioEnabled, unlockAudio } from '@/lib/audio';

interface AppSettingsValue {
  /** ETB per card */
  cardPrice: number;
  roomId: string;
  soundEnabled: boolean;
  setSoundEnabled: (on: boolean) => void;
  /** Server mode: the API is the source of truth for price and room. */
  setGameSettings: (s: { cardPrice: number; roomId: string }) => void;
}

const KEY = 'bgb.settings';
const AppSettingsContext = createContext<AppSettingsValue | null>(null);

function loadSound(): boolean {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return (JSON.parse(raw) as { soundEnabled?: boolean }).soundEnabled !== false;
  } catch {
    /* ignore */
  }
  return true;
}

export function AppSettingsProvider({ children }: { children: ReactNode }) {
  const [soundEnabled, setSoundEnabled] = useState<boolean>(loadSound);
  const [game, setGameSettings] = useState({ cardPrice: 10, roomId: 'BINGO-99' });

  useEffect(() => {
    setAudioEnabled(soundEnabled);
    try {
      localStorage.setItem(KEY, JSON.stringify({ soundEnabled }));
    } catch {
      /* ignore */
    }
  }, [soundEnabled]);

  // Browsers block audio until the first user gesture.
  useEffect(() => {
    const unlock = () => unlockAudio();
    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
  }, []);

  const value = useMemo<AppSettingsValue>(
    () => ({ cardPrice: game.cardPrice, roomId: game.roomId, soundEnabled, setSoundEnabled, setGameSettings }),
    [soundEnabled, game],
  );

  return <AppSettingsContext.Provider value={value}>{children}</AppSettingsContext.Provider>;
}

export function useAppSettings(): AppSettingsValue {
  const v = useContext(AppSettingsContext);
  if (!v) throw new Error('useAppSettings must be used inside <AppSettingsProvider>');
  return v;
}
