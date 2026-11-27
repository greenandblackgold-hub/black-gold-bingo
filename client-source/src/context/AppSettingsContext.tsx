import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  setAudioEnabled,
  setAudioVolume as applyAudioVolume,
  setBackgroundMusicEnabled as applyBackgroundMusicEnabled,
  setSpeechRateMultiplier,
  setVoiceEnabled as applyVoiceEnabled,
  unlockAudio,
} from '@/lib/audio';

export type PlayerGameSpeed = 'slow' | 'normal' | 'fast';

interface AppSettingsValue {
  /** ETB per card */
  cardPrice: number;
  roomId: string;
  soundEnabled: boolean;
  setSoundEnabled: (on: boolean) => void;
  voiceEnabled: boolean;
  setVoiceEnabled: (on: boolean) => void;
  backgroundMusicEnabled: boolean;
  setBackgroundMusicEnabled: (on: boolean) => void;
  gameSpeed: PlayerGameSpeed;
  setGameSpeed: (speed: PlayerGameSpeed) => void;
  audioVolume: number;
  setAudioVolume: (volume: number) => void;
  /** Server mode: the API is the source of truth for price and room. */
  setGameSettings: (s: { cardPrice: number; roomId: string }) => void;
}

const KEY = 'bgb.settings';
const AppSettingsContext = createContext<AppSettingsValue | null>(null);

interface StoredAudioSettings {
  soundEnabled?: boolean;
  voiceEnabled?: boolean;
  backgroundMusicEnabled?: boolean;
  gameSpeed?: PlayerGameSpeed;
  audioVolume?: number;
}

function loadAudioSettings(): Required<StoredAudioSettings> {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as StoredAudioSettings;
      return {
        soundEnabled: parsed.soundEnabled !== false,
        voiceEnabled: parsed.voiceEnabled !== false,
        backgroundMusicEnabled: parsed.backgroundMusicEnabled === true,
        gameSpeed: parsed.gameSpeed === 'slow' || parsed.gameSpeed === 'fast' ? parsed.gameSpeed : 'normal',
        audioVolume: typeof parsed.audioVolume === 'number'
          ? Math.min(1, Math.max(0, parsed.audioVolume))
          : 0.6,
      };
    }
  } catch {
    /* ignore unavailable or malformed local storage */
  }
  return { soundEnabled: true, voiceEnabled: true, backgroundMusicEnabled: false, gameSpeed: 'normal', audioVolume: 0.6 };
}

export function AppSettingsProvider({ children }: { children: ReactNode }) {
  const [initialAudio] = useState(loadAudioSettings);
  const [soundEnabled, setSoundEnabled] = useState(initialAudio.soundEnabled);
  const [voiceEnabled, setVoiceEnabled] = useState(initialAudio.voiceEnabled);
  const [backgroundMusicEnabled, setBackgroundMusicEnabled] = useState(initialAudio.backgroundMusicEnabled);
  const [gameSpeed, setGameSpeed] = useState<PlayerGameSpeed>(initialAudio.gameSpeed);
  const [audioVolume, setAudioVolume] = useState(initialAudio.audioVolume);
  const [game, setGameSettings] = useState({ cardPrice: 10, roomId: 'BINGO-99' });

  useEffect(() => {
    setAudioEnabled(soundEnabled);
    applyVoiceEnabled(voiceEnabled);
    applyBackgroundMusicEnabled(backgroundMusicEnabled);
    setSpeechRateMultiplier(gameSpeed === 'slow' ? 0.8 : gameSpeed === 'fast' ? 1.2 : 1);
    applyAudioVolume(audioVolume);
    try {
      localStorage.setItem(KEY, JSON.stringify({ soundEnabled, voiceEnabled, backgroundMusicEnabled, gameSpeed, audioVolume }));
    } catch {
      /* ignore */
    }
  }, [soundEnabled, voiceEnabled, backgroundMusicEnabled, gameSpeed, audioVolume]);

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
    () => ({
      cardPrice: game.cardPrice,
      roomId: game.roomId,
      soundEnabled,
      setSoundEnabled,
      voiceEnabled,
      setVoiceEnabled,
      backgroundMusicEnabled,
      setBackgroundMusicEnabled,
      gameSpeed,
      setGameSpeed,
      audioVolume,
      setAudioVolume,
      setGameSettings,
    }),
    [soundEnabled, voiceEnabled, backgroundMusicEnabled, gameSpeed, audioVolume, game],
  );

  return <AppSettingsContext.Provider value={value}>{children}</AppSettingsContext.Provider>;
}

export function useAppSettings(): AppSettingsValue {
  const v = useContext(AppSettingsContext);
  if (!v) throw new Error('useAppSettings must be used inside <AppSettingsProvider>');
  return v;
}
