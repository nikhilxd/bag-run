import contracts from '../data/contracts.json';
import eco from '../data/economy.json';
import { hashString } from './rng';
import { type SaveData, gameNow, utcDateKey, nextLocalMidnight } from './save';
import { type Bag } from './economy';

export interface RunStats {
  extracted: boolean;
  bag: Bag;
  heatAtEnd: number;
  greedMult: number;
  damageTaken: number;
}

export function dailyKey(s: SaveData): string { return utcDateKey(gameNow(s)); }
export function dailySeed(key: string): number { return hashString(key); }
export function dailyContract(key: string) { return contracts[hashString('c' + key) % contracts.length]; }

export function contractMet(id: string, r: RunStats): boolean {
  if (!r.extracted) return false;
  const n = r.bag.common + r.bag.rare + r.bag.prime;
  switch (id) {
    case 'prime_hot': return r.bag.prime > 0 && r.heatAtEnd >= 60;
    case 'no_damage': return r.damageTaken === 0;
    case 'big_bag': return n >= 8;
    case 'greedy': return r.greedMult >= 1.5;
    case 'rares': return r.bag.rare >= 3;
    default: return false;
  }
}

export function dailyDone(s: SaveData): boolean { return s.daily.lastDone === dailyKey(s); }

/** Returns reward cash if newly completed. */
export function completeDaily(s: SaveData): number {
  const key = dailyKey(s);
  if (s.daily.lastDone === key) return 0;
  const yesterday = utcDateKey(gameNow(s) - 86400000);
  s.daily.streak = s.daily.lastDone === yesterday ? s.daily.streak + 1 : 1;
  s.daily.lastDone = key;
  s.cash += eco.dailyReward;
  if (!s.gadgets.includes('smoke')) s.gadgets.push('smoke');
  return eco.dailyReward;
}

/** After the Nth run of the first session a sealed crate appears. */
export function maybeSealCourier(s: SaveData): boolean {
  if (s.courier.state === 'none' && s.runsTotal >= eco.courierAfterRuns) {
    s.courier = { state: 'sealed', opensAt: nextLocalMidnight(gameNow(s)) };
    return true;
  }
  return false;
}
export function courierReady(s: SaveData): boolean {
  return s.courier.state === 'sealed' && gameNow(s) >= s.courier.opensAt;
}
export function openCourier(s: SaveData): boolean {
  if (!courierReady(s)) return false;
  s.courier.state = 'opened';
  if (!s.gadgets.includes('dash')) s.gadgets.push('dash');
  if (!s.gadget) s.gadget = 'dash';
  s.insuredSlots = Math.max(1, s.insuredSlots);
  return true;
}

export function grudgeActive(s: SaveData): string | null {
  return s.grudge && s.grudge.forDate === dailyKey(s) ? s.grudge.type : null;
}
export function setGrudge(s: SaveData, type: string): void {
  s.grudge = { type, forDate: utcDateKey(gameNow(s) + 86400000) };
}

export function unlockDecoy(s: SaveData): void {
  if (s.extractions >= 5 && !s.gadgets.includes('decoy')) s.gadgets.push('decoy');
}
