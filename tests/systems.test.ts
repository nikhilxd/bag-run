import { describe, it, expect } from 'vitest';
import { generateMap, bfs } from '../src/systems/mapgen';
import { speedMult, greedMult, insuredKeep, rawValue, scrap } from '../src/systems/economy';
import { newHeat, stepHeat } from '../src/systems/heat';
import { parseSave, freshSave } from '../src/systems/save';
import { directorFor, pickLine } from '../src/systems/handler';
import { completeDaily, maybeSealCourier, openCourier, courierReady, contractMet } from '../src/systems/meta';
import lines from '../src/data/handler_lines.json';

describe('mapgen', () => {
  it('every room is reachable for 1000 seeds, prime is in the farthest room', () => {
    for (let seed = 1; seed <= 1000; seed++) {
      const m = generateMap(seed);
      const d = bfs(new Set(m.doors), m.spawnRoom);
      expect(d.every((x) => x >= 0)).toBe(true);
      expect(d[m.primeRoom]).toBe(Math.max(...d));
      expect(m.loot.filter((l) => l.kind === 'prime').length).toBe(1);
    }
  });
  it('is deterministic per seed', () => {
    expect(generateMap(42)).toEqual(generateMap(42));
  });
});

describe('economy', () => {
  it('weight never drops speed below 55%', () => {
    expect(speedMult({ common: 99, rare: 99, prime: 9 }, 0)).toBe(0.55);
  });
  it('bag upgrade lowers the penalty', () => {
    const b = { common: 5, rare: 2, prime: 0 };
    expect(speedMult(b, 3)).toBeGreaterThan(speedMult(b, 0));
  });
  it('greed steps by 0.1 every 10 s', () => {
    expect(greedMult(-5)).toBe(1);
    expect(greedMult(9.9)).toBe(1);
    expect(greedMult(10)).toBe(1.1);
    expect(greedMult(35)).toBe(1.3);
  });
  it('insured slot keeps the best cube, scrap is 10%', () => {
    expect(insuredKeep({ common: 3, rare: 1, prime: 0 }, 1)).toEqual({ common: 0, rare: 1, prime: 0 });
    expect(scrap(rawValue({ common: 5, rare: 0, prime: 0 }))).toBe(5);
  });
});

describe('heat', () => {
  it('fires each wave exactly once', () => {
    const h = newHeat();
    const fired: number[] = [];
    for (let i = 0; i < 400; i++) fired.push(...stepHeat(h, 0.5, i % 7 === 0 ? 1 : 0));
    expect(fired).toEqual([1, 2, 3, 4]);
  });
});

describe('save', () => {
  it('survives corrupt JSON and wrong versions', () => {
    expect(parseSave('{not json')).toEqual(freshSave());
    expect(parseSave('{"v":99}')).toEqual(freshSave());
    expect(parseSave(null)).toEqual(freshSave());
  });
  it('round trips', () => {
    const s = freshSave();
    s.cash = 77;
    expect(parseSave(JSON.stringify(s)).cash).toBe(77);
  });
});

describe('handler', () => {
  it('has at least 60 lines', () => {
    const n = Object.values(lines as Record<string, string[]>).reduce((a, l) => a + l.length, 0);
    expect(n).toBeGreaterThanOrEqual(60);
  });
  it('director fires one rule', () => {
    const p = freshSave().profile;
    p.recent = [false, false, true, false, false];
    p.greedHistory = [40, 40, 40, 40, 40];
    expect(directorFor(p).rule).toBe('cautious');
    p.recent = [true, true, true, true, true];
    p.greedHistory = [2, 3, 1, 2, 4];
    expect(directorFor(p).rule).toBe('bored');
  });
  it('fills variables', () => {
    expect(pickLine({ tag: 'grudge', vars: { type: 'Sniper' }, rng: () => 0 })).toContain('Sniper');
  });
});

describe('meta', () => {
  it('courier seals after 3 runs, opens after the clock passes midnight', () => {
    const s = freshSave();
    s.runsTotal = 3;
    expect(maybeSealCourier(s)).toBe(true);
    expect(courierReady(s)).toBe(false);
    s.clockOffsetMs += 86400000;
    expect(courierReady(s)).toBe(true);
    expect(openCourier(s)).toBe(true);
    expect(s.gadgets).toContain('dash');
    expect(s.insuredSlots).toBe(1);
  });
  it('daily pays once and tracks streak', () => {
    const s = freshSave();
    expect(completeDaily(s)).toBe(300);
    expect(completeDaily(s)).toBe(0);
    s.clockOffsetMs += 86400000;
    completeDaily(s);
    expect(s.daily.streak).toBe(2);
  });
  it('contract checks', () => {
    const r = { extracted: true, bag: { common: 0, rare: 0, prime: 1 }, heatAtEnd: 70, greedMult: 1, damageTaken: 0 };
    expect(contractMet('prime_hot', r)).toBe(true);
    expect(contractMet('rares', r)).toBe(false);
  });
});
