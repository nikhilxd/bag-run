import { state } from './state';

let ctx: AudioContext | null = null;

/** Tiny synthesised beep. No asset files. Safe if audio is blocked. */
export function beep(freq: number, dur = 0.08, type: OscillatorType = 'square', vol = 0.04): void {
  if (state.save.muted) return;
  try {
    if (!ctx) {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      ctx = new AC();
    }
    if (ctx.state === 'suspended') void ctx.resume();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.value = vol;
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
    o.connect(g).connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + dur);
  } catch { /* audio unavailable */ }
}
