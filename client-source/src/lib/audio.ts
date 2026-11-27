/**
 * Browser-generated sound effects and localized Bingo call announcements.
 * No external audio assets or network requests are required.
 */

import type { Lang } from '@/types/game';

export type Sfx = 'call' | 'mark' | 'unmark' | 'win' | 'error' | 'coin' | 'notification';

type WebkitWindow = Window & { webkitAudioContext?: typeof AudioContext };

interface NoteOptions {
  type?: OscillatorType;
  gain?: number;
  glideTo?: number;
}

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let enabled = true;
let voiceEnabled = true;
let outputVolume = 0.6;
let backgroundMusicTimer: number | null = null;
let backgroundMusicGain: GainNode | null = null;
let backgroundMusicStep = 0;
let speechRateMultiplier = 1;

function getContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    const AudioCtor = window.AudioContext ?? (window as WebkitWindow).webkitAudioContext;
    if (!AudioCtor) return null;
    try {
      ctx = new AudioCtor();
      master = ctx.createGain();
      master.gain.value = outputVolume;
      master.connect(ctx.destination);
    } catch {
      ctx = null;
      master = null;
      return null;
    }
  }
  return ctx;
}

/** Create or resume the AudioContext. Safe to call many times. */
export function unlockAudio(): void {
  const c = getContext();
  if (c && c.state === 'suspended') void c.resume().catch(() => undefined);
}

export function setAudioEnabled(on: boolean): void {
  enabled = on;
}

export function setVoiceEnabled(on: boolean): void {
  voiceEnabled = on;
  if (!on && typeof window !== 'undefined' && 'speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
}

export function setSpeechRateMultiplier(multiplier: number): void {
  speechRateMultiplier = Math.min(1.3, Math.max(0.7, Number.isFinite(multiplier) ? multiplier : 1));
}

export function setBackgroundMusicEnabled(on: boolean): void {
  if (!on && !backgroundMusicGain) return;
  const c = getContext();
  if (!c || !master || typeof window === 'undefined') return;
  if (!backgroundMusicGain) {
    backgroundMusicGain = c.createGain();
    backgroundMusicGain.gain.value = 0.0001;
    backgroundMusicGain.connect(master);
  }
  if (!on) {
    if (backgroundMusicTimer !== null) window.clearInterval(backgroundMusicTimer);
    backgroundMusicTimer = null;
    backgroundMusicGain.gain.setTargetAtTime(0.0001, c.currentTime, 0.18);
    return;
  }
  if (c.state === 'suspended') void c.resume().catch(() => undefined);
  backgroundMusicGain.gain.setTargetAtTime(0.16, c.currentTime, 0.3);
  if (backgroundMusicTimer !== null) return;
  const chords = [
    [261.63, 329.63, 392.00],
    [220.00, 261.63, 329.63],
    [174.61, 220.00, 261.63],
    [196.00, 246.94, 293.66],
  ];
  const playChord = () => {
    if (!backgroundMusicGain || !ctx || ctx.state === 'closed') return;
    const start = ctx.currentTime + 0.03;
    const chord = chords[backgroundMusicStep % chords.length];
    chord.forEach((frequency, index) => note(ctx!, backgroundMusicGain!, frequency, start + index * 0.035, 2.35, {
      type: 'sine',
      gain: 0.12,
    }));
    backgroundMusicStep += 1;
  };
  playChord();
  backgroundMusicTimer = window.setInterval(playChord, 2600);
}

export function setAudioVolume(volume: number): void {
  outputVolume = Math.min(1, Math.max(0, Number.isFinite(volume) ? volume : 0.6));
  if (master && ctx) {
    master.gain.setTargetAtTime(outputVolume, ctx.currentTime, 0.025);
  }
}

function note(
  c: AudioContext,
  out: AudioNode,
  freq: number,
  start: number,
  dur: number,
  { type = 'sine', gain = 0.3, glideTo }: NoteOptions = {},
): void {
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  if (glideTo) osc.frequency.exponentialRampToValueAtTime(glideTo, start + dur);
  g.gain.setValueAtTime(0.0001, start);
  g.gain.exponentialRampToValueAtTime(gain, start + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  osc.connect(g);
  g.connect(out);
  osc.start(start);
  osc.stop(start + dur + 0.05);
}

export function play(sfx: Sfx): void {
  if (!enabled || outputVolume <= 0) return;
  const c = getContext();
  const out = master;
  if (!c || !out) return;
  if (c.state === 'suspended') void c.resume().catch(() => undefined);
  const t = c.currentTime + 0.01;

  switch (sfx) {
    case 'call': {
      note(c, out, 880, t, 0.9, { gain: 0.35 });
      note(c, out, 1320, t, 0.7, { gain: 0.18 });
      note(c, out, 2430, t, 0.35, { gain: 0.06 });
      note(c, out, 220, t, 0.16, { type: 'triangle', gain: 0.22 });
      break;
    }
    case 'mark':
      note(c, out, 740, t, 0.09, { gain: 0.25, glideTo: 520 });
      break;
    case 'unmark':
      note(c, out, 420, t, 0.09, { gain: 0.2, glideTo: 300 });
      break;
    case 'win': {
      [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i) =>
        note(c, out, f, t + i * 0.11, 0.35, { type: 'triangle', gain: 0.3 }),
      );
      [523.25, 659.25, 783.99, 1046.5].forEach((f) =>
        note(c, out, f, t + 0.6, 1.3, { type: 'triangle', gain: 0.18 }),
      );
      note(c, out, 2093, t + 0.7, 0.6, { gain: 0.1 });
      break;
    }
    case 'error':
      note(c, out, 180, t, 0.14, { type: 'square', gain: 0.12 });
      note(c, out, 150, t + 0.18, 0.2, { type: 'square', gain: 0.12 });
      break;
    case 'coin':
      note(c, out, 988, t, 0.09, { type: 'square', gain: 0.12 });
      note(c, out, 1319, t + 0.09, 0.3, { type: 'square', gain: 0.12 });
      break;
    case 'notification': {
      // A loud, unmistakable two-tone emergency-style siren: alternating rising
      // and falling sweeps with a strong sawtooth fundamental and triangle body.
      // Keep it below clipping while making it clearly louder than the old chime.
      [0, 0.48, 0.96, 1.44].forEach((offset, index) => {
        const rising = index % 2 === 0;
        const startFreq = rising ? 640 : 1180;
        const endFreq = rising ? 1180 : 640;
        note(c, out, startFreq, t + offset, 0.46, {
          type: 'sawtooth',
          gain: 0.48,
          glideTo: endFreq,
        });
        note(c, out, startFreq * 2, t + offset, 0.43, {
          type: 'triangle',
          gain: 0.16,
          glideTo: endFreq * 2,
        });
      });
      break;
    }
  }
}

const BINGO_LETTERS: Record<Lang, readonly string[]> = {
  am: ['ቢ', 'አይ', 'ኤን', 'ጂ', 'ኦ'],
  ti: ['ቢ', 'ኣይ', 'ኤን', 'ጂ', 'ኦ'],
  en: ['B', 'I', 'N', 'G', 'O'],
};

const SPEECH_LOCALES: Record<Lang, string> = {
  am: 'am-ET',
  ti: 'ti-ER',
  en: 'en-US',
};

/** Announce one called Bingo number using the selected browser/device voice. */
export function announceNumber(number: number, lang: Lang): void {
  if (!voiceEnabled || typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  if (!Number.isInteger(number) || number < 1 || number > 75) return;

  const column = Math.min(4, Math.floor((number - 1) / 15));
  const letter = BINGO_LETTERS[lang][column];
  const phrase = lang === 'am'
    ? `${letter} ቁጥር ${number}`
    : lang === 'ti'
      ? `${letter} ቁጽሪ ${number}`
      : `${letter}, number ${number}`;

  const synth = window.speechSynthesis;
  synth.cancel();
  const utterance = new SpeechSynthesisUtterance(phrase);
  utterance.lang = SPEECH_LOCALES[lang];
  utterance.rate = (lang === 'en' ? 0.92 : 0.86) * speechRateMultiplier;
  utterance.pitch = 1;
  utterance.volume = outputVolume;
  synth.speak(utterance);
}
