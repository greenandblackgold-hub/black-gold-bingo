import { useEffect, useRef } from 'react';
import { useAppSettings } from '@/context/AppSettingsContext';
import { useLanguage } from '@/context/LanguageContext';
import { useRound } from '@/context/RoundContext';
import { announceNumber } from '@/lib/audio';

/** Speaks only newly received calls; it never changes shared game state. */
export function AudioCallAnnouncer() {
  const { loaded, calledNumbers } = useRound();
  const { lang } = useLanguage();
  const { voiceEnabled } = useAppSettings();
  const previousCount = useRef<number | null>(null);

  useEffect(() => {
    if (!loaded) return;

    const count = calledNumbers.length;
    if (previousCount.current !== null && count > previousCount.current && voiceEnabled) {
      const latest = calledNumbers[count - 1];
      if (latest !== undefined) announceNumber(latest, lang);
    }
    previousCount.current = count;
  }, [loaded, calledNumbers, lang, voiceEnabled]);

  return null;
}
