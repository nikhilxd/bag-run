import { mulberry32 } from './rng';

export const ROOM = 600;
export const GRID = 3;
export const WORLD = ROOM * GRID;
export const WALL = 20;
export const DOOR_W = 140;

export interface Rect { x: number; y: number; w: number; h: number }
export interface Loot { x: number; y: number; kind: 'common' | 'rare' | 'prime'; room: number }
export interface MapData {
  seed: number;
  /** open doors as "a-b" with a<b */
  doors: string[];
  spawnRoom: number;
  spawn: { x: number; y: number };
  walls: Rect[];
  covers: Rect[];
  loot: Loot[];
  primeRoom: number;
}

const key = (a: number, b: number) => (a < b ? `${a}-${b}` : `${b}-${a}`);

export function allEdges(): [number, number][] {
  const e: [number, number][] = [];
  for (let r = 0; r < GRID; r++)
    for (let c = 0; c < GRID; c++) {
      const i = r * GRID + c;
      if (c < GRID - 1) e.push([i, i + 1]);
      if (r < GRID - 1) e.push([i, i + GRID]);
    }
  return e;
}

export function bfs(doors: Set<string>, from: number): number[] {
  const dist: number[] = new Array(GRID * GRID).fill(-1);
  dist[from] = 0;
  const q = [from];
  while (q.length) {
    const cur = q.shift()!;
    for (const [a, b] of allEdges()) {
      if (!doors.has(key(a, b))) continue;
      const n = a === cur ? b : b === cur ? a : -1;
      if (n >= 0 && dist[n] < 0) { dist[n] = dist[cur] + 1; q.push(n); }
    }
  }
  return dist;
}

export function roomCenter(room: number) {
  return { x: (room % GRID) * ROOM + ROOM / 2, y: Math.floor(room / GRID) * ROOM + ROOM / 2 };
}
export function roomAt(x: number, y: number): number {
  const c = Math.min(GRID - 1, Math.max(0, Math.floor(x / ROOM)));
  const r = Math.min(GRID - 1, Math.max(0, Math.floor(y / ROOM)));
  return r * GRID + c;
}

export function generateMap(seed: number): MapData {
  const rng = mulberry32(seed);
  const ri = (n: number) => Math.floor(rng() * n);
  const edges = allEdges();
  let doors = new Set<string>();
  for (let attempt = 0; attempt < 500; attempt++) {
    doors = new Set(edges.map(([a, b]) => key(a, b)));
    const remove = 3 + ri(3);
    const pool = [...edges];
    for (let i = 0; i < remove; i++) {
      const [a, b] = pool.splice(ri(pool.length), 1)[0];
      doors.delete(key(a, b));
    }
    if (bfs(doors, 0).every((d) => d >= 0)) break;
    doors = new Set(edges.map(([a, b]) => key(a, b)));
  }

  const corners = [0, 2, 6, 8];
  const spawnRoom = corners[ri(4)];
  const sc = roomCenter(spawnRoom);
  const spawn = { x: sc.x, y: sc.y };

  const walls: Rect[] = [];
  const half = WALL / 2;
  walls.push({ x: 0, y: 0, w: WORLD, h: half }, { x: 0, y: WORLD - half, w: WORLD, h: half });
  walls.push({ x: 0, y: 0, w: half, h: WORLD }, { x: WORLD - half, y: 0, w: half, h: WORLD });
  const doorPoints: { x: number; y: number }[] = [];
  for (const [a, b] of edges) {
    const open = doors.has(key(a, b));
    const sideBySide = b === a + 1;
    if (sideBySide) {
      const x = ((a % GRID) + 1) * ROOM;
      const cy = Math.floor(a / GRID) * ROOM + ROOM / 2;
      if (open) {
        walls.push({ x: x - half, y: cy - ROOM / 2, w: WALL, h: ROOM / 2 - DOOR_W / 2 });
        walls.push({ x: x - half, y: cy + DOOR_W / 2, w: WALL, h: ROOM / 2 - DOOR_W / 2 });
        doorPoints.push({ x, y: cy });
      } else walls.push({ x: x - half, y: cy - ROOM / 2, w: WALL, h: ROOM });
    } else {
      const y = (Math.floor(a / GRID) + 1) * ROOM;
      const cx = (a % GRID) * ROOM + ROOM / 2;
      if (open) {
        walls.push({ x: cx - ROOM / 2, y: y - half, w: ROOM / 2 - DOOR_W / 2, h: WALL });
        walls.push({ x: cx + DOOR_W / 2, y: y - half, w: ROOM / 2 - DOOR_W / 2, h: WALL });
        doorPoints.push({ x: cx, y });
      } else walls.push({ x: cx - ROOM / 2, y: y - half, w: ROOM, h: WALL });
    }
  }

  const nearDoorOrSpawn = (x: number, y: number, pad: number) =>
    doorPoints.some((d) => Math.hypot(d.x - x, d.y - y) < pad + DOOR_W / 2) ||
    Math.hypot(spawn.x - x, spawn.y - y) < pad + 40;

  const covers: Rect[] = [];
  for (let room = 0; room < GRID * GRID; room++) {
    const ox = (room % GRID) * ROOM, oy = Math.floor(room / GRID) * ROOM;
    const n = 2 + ri(4);
    for (let i = 0, tries = 0; i < n && tries < 40; tries++) {
      const w = 40 + ri(60), h = 40 + ri(60);
      const x = ox + 60 + ri(ROOM - 120 - w), y = oy + 60 + ri(ROOM - 120 - h);
      if (nearDoorOrSpawn(x + w / 2, y + h / 2, 80 + Math.max(w, h) / 2)) continue;
      covers.push({ x, y, w, h });
      i++;
    }
  }

  const dist = bfs(doors, spawnRoom);
  let primeRoom = spawnRoom;
  dist.forEach((d, r) => { if (d > dist[primeRoom]) primeRoom = r; });

  const loot: Loot[] = [];
  const place = (kind: Loot['kind'], room: number) => {
    const ox = (room % GRID) * ROOM, oy = Math.floor(room / GRID) * ROOM;
    for (let t = 0; t < 60; t++) {
      const x = ox + 70 + rng() * (ROOM - 140), y = oy + 70 + rng() * (ROOM - 140);
      const blocked = covers.some((c) => x > c.x - 20 && x < c.x + c.w + 20 && y > c.y - 20 && y < c.y + c.h + 20);
      if (!blocked && !nearDoorOrSpawn(x, y, 20)) { loot.push({ x, y, kind, room }); return; }
    }
  };
  const commons = 10 + ri(5), rares = 3 + ri(2);
  for (let i = 0; i < commons; i++) place('common', ri(GRID * GRID));
  for (let i = 0; i < rares; i++) place('rare', ri(GRID * GRID));
  place('prime', primeRoom);

  return { seed, doors: [...doors], spawnRoom, spawn, walls, covers, loot, primeRoom };
}
