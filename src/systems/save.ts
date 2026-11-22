import { NO_UPGRADES, type Upgrades } from './economy';

export type GadgetId = 'dash' | 'decoy' | 'smoke';
export interface Profile {
  greedHistory: number[]; // seconds stayed after the first beacon, last 5 runs
  killsPerMin: number[];
  deathCauses: Record<string, number>;
  recent: boolean[]; // last 5 extract results
}
export interface TelemetryEvent { t: number; name: string; data?: Record<string, unknown> }
export interface SaveData {
  v: 1;
  cash: number;
  parts: number;
  upgrades: Upgrades;
  gadgets: GadgetId[];
  gadget: GadgetId | null;
  insuredSlots: number;
  runsTotal: number;
  extractions: number;
  courier: { state: 'none' | 'sealed' | 'opened'; opensAt: number };
  daily: { lastDone: string; streak: number };
  grudge: { type: string; forDate: string } | null;
  profile: Profile;
  best: number;
  clockOffsetMs: number;
  muted: boolean;
  runCounter: number;
  telemetry: TelemetryEvent[];
}

export const SAVE_KEY = 'bagrun.save.v1';

export function freshSave(): SaveData {
  return {
    v: 1, cash: 0, parts: 0, upgrades: { ...NO_UPGRADES }, gadgets: [], gadget: null, insuredSlots: 0,
    runsTotal: 0, extractions: 0, courier: { state: 'none', opensAt: 0 }, daily: { lastDone: '', streak: 0 },
    grudge: null, profile: { greedHistory: [], killsPerMin: [], deathCauses: {}, recent: [] },
    best: 0, clockOffsetMs: 0, muted: false, runCounter: 0, telemetry: [],
  };
}

/** Never throws. Corrupt or wrong-version JSON gives a fresh save. */
export function parseSave(raw: string | null): SaveData {
  if (!raw) return freshSave();
  try {
    const o = JSON.parse(raw);
    if (!o || typeof o !== 'object' || o.v !== 1) return freshSave();
    const f = freshSave();
    return {
      ...f, ...o,
      upgrades: { ...NO_UPGRADES, ...(o.upgrades ?? {}) },
      profile: { ...f.profile, ...(o.profile ?? {}) },
      courier: { ...f.courier, ...(o.courier ?? {}) },
      daily: { ...f.daily, ...(o.daily ?? {}) },
    };
  } catch {
    return freshSave();
  }
}

export function loadSave(): SaveData {
  try { return parseSave(localStorage.getItem(SAVE_KEY)); } catch { return freshSave(); }
}
export function writeSave(s: SaveData): void {
  try {
    s.telemetry = s.telemetry.slice(-500);
    localStorage.setItem(SAVE_KEY, JSON.stringify(s));
  } catch { /* storage blocked: the game keeps running in memory */ }
}
export function wipeSave(): void {
  try { localStorage.removeItem(SAVE_KEY); } catch { /* ignore */ }
}

/** In-game clock. Reviewer tools shift it by whole days. */
export function gameNow(s: SaveData): number { return Date.now() + s.clockOffsetMs; }
export function utcDateKey(ms: number): string { return new Date(ms).toISOString().slice(0, 10); }
export function nextLocalMidnight(ms: number): number {
  const d = new Date(ms);
  d.setHours(24, 0, 0, 0);
  return d.getTime();
}
export function nextUtcMidnight(ms: number): number {
  const d = new Date(ms);
  d.setUTCHours(24, 0, 0, 0);
  return d.getTime();
}
export function fmtHMS(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}
