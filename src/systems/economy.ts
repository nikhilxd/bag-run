import eco from '../data/economy.json';

export type CubeKind = 'common' | 'rare' | 'prime';
export type Bag = Record<CubeKind, number>;
export interface Upgrades { bag: number; boots: number; plating: number; scanner: number }
export const NO_UPGRADES: Upgrades = { bag: 0, boots: 0, plating: 0, scanner: 0 };
export type UpgradeId = keyof Upgrades;

export function speedMult(bag: Bag, bagLevel: number): number {
  const penalty =
    bag.common * eco.cubes.common.weight + bag.rare * eco.cubes.rare.weight + bag.prime * eco.cubes.prime.weight;
  return Math.max(eco.weightFloor, 1 - penalty * (1 - 0.15 * bagLevel));
}
export function maxSpeed(up: Upgrades): number { return eco.baseSpeed * (1 + 0.06 * up.boots); }
export function maxHp(up: Upgrades): number { return eco.baseHp + up.plating; }

/** seconds since the first beacon opened -> multiplier, +0.1 every 10 s */
export function greedMult(secondsAfterFirstBeacon: number): number {
  if (secondsAfterFirstBeacon <= 0) return 1;
  return Math.round((1 + 0.1 * Math.floor(secondsAfterFirstBeacon / 10)) * 10) / 10;
}

export function rawValue(bag: Bag, primeMult = 1): number {
  return Math.round(
    bag.common * eco.cubes.common.value + bag.rare * eco.cubes.rare.value + bag.prime * eco.cubes.prime.value * primeMult,
  );
}
export function partsIn(bag: Bag): number {
  return bag.rare * eco.cubes.rare.parts + bag.prime * eco.cubes.prime.parts;
}

/** Insured slots keep the most valuable cubes when you die. */
export function insuredKeep(bag: Bag, slots: number): Bag {
  const kept: Bag = { common: 0, rare: 0, prime: 0 };
  const left = { ...bag };
  for (let i = 0; i < slots; i++) {
    const k: CubeKind | null = left.prime > 0 ? 'prime' : left.rare > 0 ? 'rare' : left.common > 0 ? 'common' : null;
    if (!k) break;
    left[k]--;
    kept[k]++;
  }
  return kept;
}

export function scrap(value: number): number { return Math.floor(value * eco.scrapRate); }

export function upgradeCost(id: UpgradeId, currentLevel: number): { cash: number; parts: number } | null {
  const c = eco.upgrades[id].costs[currentLevel];
  return c ? { cash: c[0], parts: c[1] } : null;
}
