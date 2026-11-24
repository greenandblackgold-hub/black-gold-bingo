import { useEffect, useRef } from 'react';
import { useAppSettings } from '@/context/AppSettingsContext';
import { useLanguage } from '@/context/LanguageContext';
import { useRound } from '@/context/RoundContext';
import { announceNumber, play } from '@/lib/audio';

/** Plays and speaks Bingo calls only while the player is inside the Bingo room. */
export function AudioCallAnnouncer({ enabled }: { enabled: boolean }) {
  const { loaded, calledNumbers } = useRound();
  const { lang } = useLanguage();
  const { voiceEnabled } = useAppSettings();
  const previousCount = useRef<number | null>(null);

  useEffect(() => {
    if (!loaded) return;

    const count = calledNumbers.length;
    if (previousCount.current !== null && count > previousCount.current && enabled) {
      const latest = calledNumbers[count - 1];
      if (latest !== undefined) {
        play('call');
        if (voiceEnabled) announceNumber(latest, lang);
      }
    }
    previousCount.current = count;
  }, [loaded, calledNumbers, lang, voiceEnabled, enabled]);

  useEffect(() => {
    if (enabled || typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
  }, [enabled]);

  return null;
}
