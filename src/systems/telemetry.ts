import { type SaveData } from './save';

export function track(s: SaveData, name: string, data?: Record<string, unknown>): void {
  s.telemetry.push({ t: Date.now(), name, data });
  if (s.telemetry.length > 500) s.telemetry.splice(0, s.telemetry.length - 500);
}

export function summarize(s: SaveData): string {
  const ends = s.telemetry.filter((e) => e.name === 'run_end');
  const ex = ends.filter((e) => e.data?.result === 'extracted').length;
  const avg = ends.length ? ends.reduce((a, e) => a + Number(e.data?.durationS ?? 0), 0) / ends.length : 0;
  return [
    `runs: ${ends.length}`,
    `extract rate: ${ends.length ? Math.round((ex / ends.length) * 100) : 0}%`,
    `avg run: ${avg.toFixed(1)} s`,
    `best bag: ${s.best}`,
    `cash ${s.cash}, parts ${s.parts}`,
    `upgrades: bag ${s.upgrades.bag} boots ${s.upgrades.boots} plating ${s.upgrades.plating} scanner ${s.upgrades.scanner}`,
    `courier: ${s.courier.state}, streak: ${s.daily.streak}`,
    `events stored: ${s.telemetry.length}`,
  ].join('\n');
}
