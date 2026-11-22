export const THRESHOLDS = [25, 50, 75, 100];

export interface HeatState { value: number; fired: number[] }
export function newHeat(): HeatState { return { value: 0, fired: [] }; }

/** Advance heat. Returns the wave numbers (1-based) that fire this step, each exactly once. */
export function stepHeat(s: HeatState, dt: number, cubesPicked: number, thresholds = THRESHOLDS): number[] {
  s.value = Math.min(100, s.value + dt * 1 + cubesPicked * 3);
  const waves: number[] = [];
  thresholds.forEach((t, i) => {
    if (s.value >= t && !s.fired.includes(i)) { s.fired.push(i); waves.push(i + 1); }
  });
  return waves;
}
