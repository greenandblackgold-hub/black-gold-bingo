/**
 * src/lib/audio.ts
 *
 * Web Audio API sound effects, synthesized in the browser (no audio files).
 * Browsers only allow audio after a user gesture, so call unlockAudio() on the
 * first tap or key press (AppSettingsProvider does this for you).
 */

export type Sfx = 'call' | 'mark' | 'unmark' | 'win' | 'error' | 'coin';

type WebkitWindow = Window & { webkitAudioContext?: typeof AudioContext };

interface NoteOptions {
  type?: OscillatorType;
  gain?: number;
  glideTo?: number;
}

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let enabled = true;

function getContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    const AudioCtor = window.AudioContext ?? (window as WebkitWindow).webkitAudioContext;
    if (!AudioCtor) return null;
    ctx = new AudioCtor();
    master = ctx.createGain();
    master.gain.value = 0.6;
    master.connect(ctx.destination);
  }
  return ctx;
}

/** Create or resume the AudioContext. Safe to call many times. */
export function unlockAudio(): void {
  const c = getContext();
  if (c && c.state === 'suspended') void c.resume();
}

export function setAudioEnabled(on: boolean): void {
  enabled = on;
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
  if (!enabled) return;
  const c = getContext();
  const out = master;
  if (!c || !out) return;
  if (c.state === 'suspended') void c.resume();
  const t = c.currentTime + 0.01;

  switch (sfx) {
    case 'call': {
      // A bright bell with a soft low thump: "a new number is out".
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
      // Rising arpeggio, then a held chord and a sparkle.
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
  }
}
