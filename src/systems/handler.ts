import lines from '../data/handler_lines.json';
import { type Profile } from './save';

export interface Director {
  rule: 'none' | 'cautious' | 'bored' | 'greedy';
  firstWaveHeat: number;
  bruteDelta: number;
  primeMult: number;
  earlySniper: boolean;
}

const avg = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);

/** At most one rule fires per run. Priority: cautious, greedy, bored. */
export function directorFor(p: Profile): Director {
  const base: Director = { rule: 'none', firstWaveHeat: 25, bruteDelta: 0, primeMult: 1, earlySniper: false };
  const last = p.recent.slice(-5);
  if (last.length < 3) return base;
  const rate = last.filter(Boolean).length / last.length;
  const greed = avg(p.greedHistory.slice(-5));
  if (rate < 0.4) return { ...base, rule: 'cautious', firstWaveHeat: 30, bruteDelta: -1 };
  if (greed > 30) return { ...base, rule: 'greedy', earlySniper: true };
  if (rate > 0.8 && greed < 10) return { ...base, rule: 'bored', primeMult: 1.5 };
  return base;
}

export interface LineContext {
  tag: string;
  rng?: () => number;
  vars?: Record<string, string | number>;
}

type LineBank = Record<string, string[]>;

/**
 * The single seam for the Handler. Tier A picks from a written pool.
 * A live LLM (Tier B, designed but not built) would replace this function and fall back to it on timeout.
 */
export function pickLine(ctx: LineContext): string {
  const bank = lines as LineBank;
  const pool = bank[ctx.tag] ?? bank.pre;
  const r = ctx.rng ? ctx.rng() : Math.random();
  let line = pool[Math.floor(r * pool.length)];
  for (const [k, v] of Object.entries(ctx.vars ?? {})) line = line.split(`{${k}}`).join(String(v));
  return line;
}

export function preRunTag(d: Director, streak: number): string {
  if (d.rule === 'cautious') return 'pre_cautious';
  if (d.rule === 'greedy') return 'pre_greedy';
  if (d.rule === 'bored') return 'pre_bored';
  return streak >= 2 ? 'pre_streak' : 'pre';
}

export function recordRun(p: Profile, r: { extracted: boolean; greedStay: number; kills: number; durationS: number; cause?: string }): void {
  p.recent = [...p.recent, r.extracted].slice(-5);
  p.greedHistory = [...p.greedHistory, r.greedStay].slice(-5);
  p.killsPerMin = [...p.killsPerMin, r.durationS > 0 ? (r.kills / r.durationS) * 60 : 0].slice(-5);
  if (!r.extracted && r.cause) p.deathCauses[r.cause] = (p.deathCauses[r.cause] ?? 0) + 1;
}
