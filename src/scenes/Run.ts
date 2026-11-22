import Phaser from 'phaser';
import eco from '../data/economy.json';
import { generateMap, roomAt, roomCenter, ROOM, WORLD, type MapData, type Loot } from '../systems/mapgen';
import { hashString, mulberry32 } from '../systems/rng';
import {
  speedMult, maxSpeed, maxHp, greedMult, rawValue, partsIn, insuredKeep, scrap, type Bag, type CubeKind,
} from '../systems/economy';
import { newHeat, stepHeat } from '../systems/heat';
import { directorFor, pickLine, recordRun, type Director } from '../systems/handler';
import {
  dailyKey, dailySeed, dailyContract, contractMet, completeDaily, maybeSealCourier, grudgeActive, setGrudge, unlockDecoy, dailyDone,
} from '../systems/meta';
import { gameNow } from '../systems/save';
import { track } from '../systems/telemetry';
import { state, persist } from '../state';
import { beep } from '../audio';
import { W, H, FONT } from '../ui';

type EType = 'drone' | 'brute' | 'sniper';
interface Enemy {
  go: Phaser.GameObjects.Shape;
  type: EType;
  hp: number;
  speed: number;
  dmg: number;
  color: number;
  size: number;
  stuck: number;
  slideT: number;
  slideA: number;
  shotAt: number;
  teleAt: number;
  aim: number;
  marked: boolean;
}

const COLORS: Record<CubeKind, number> = { common: 0x4caf50, rare: 0x2196f3, prime: 0xffc107 };

export class Run extends Phaser.Scene {
  private daily = false;
  private map!: MapData;
  private director!: Director;
  private rng!: () => number;
  private player!: Phaser.GameObjects.Arc;
  private pbody!: Phaser.Physics.Arcade.Body;
  private walls!: Phaser.Physics.Arcade.StaticGroup;
  private enemyGroup!: Phaser.Physics.Arcade.Group;
  private bullets!: Phaser.Physics.Arcade.Group;
  private eBullets!: Phaser.Physics.Arcade.Group;
  private enemies: Enemy[] = [];
  private lootObjs: { d: Loot; go: Phaser.GameObjects.Rectangle }[] = [];
  private bag: Bag = { common: 0, rare: 0, prime: 0 };
  private heat = newHeat();
  private hp = 3;
  private maxHp = 3;
  private t = 0;
  private dtNow = 0.016;
  private invuln = 0;
  private fireCd = 0;
  private bounty = 0;
  private kills = 0;
  private damageTaken = 0;
  private ending = false;
  private pickStreak = 0;
  private lastPick = -9;
  private cubesThisFrame = 0;
  private grudgeType: string | null = null;
  // beacon
  private beacon: { room: number; x: number; y: number; closeAt: number } | null = null;
  private nextBeacon = { at: 20, room: 0, x: 0, y: 0 };
  private beaconOpened = false;
  private extractFill = 0;
  private lastGreed = 1;
  private trickleAt = 0;
  // controls
  private joyPointer: Phaser.Input.Pointer | null = null;
  private joyOrigin = new Phaser.Math.Vector2();
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private dashT = 0;
  private dashCd = 0;
  private dashDir = new Phaser.Math.Vector2(1, 0);
  private lastDir = new Phaser.Math.Vector2(0, -1);
  private gadgetUsed = false;
  private decoy: { x: number; y: number; until: number } | null = null;
  private smokeUntil = 0;
  // visuals
  private tele!: Phaser.GameObjects.Graphics;
  private joyG!: Phaser.GameObjects.Graphics;
  private mini!: Phaser.GameObjects.Graphics;
  private beaconG!: Phaser.GameObjects.Graphics;
  private bagBar!: Phaser.GameObjects.Graphics;
  private heatBar!: Phaser.GameObjects.Rectangle;
  private heatFlash = 0;
  private hudTime!: Phaser.GameObjects.Text;
  private hudBag!: Phaser.GameObjects.Text;
  private hudGreed!: Phaser.GameObjects.Text;
  private hudHp!: Phaser.GameObjects.Text;
  private hudMsg!: Phaser.GameObjects.Text;
  private arrow!: Phaser.GameObjects.Text;
  private vignette!: Phaser.GameObjects.Rectangle;
  private gadgetBtn?: Phaser.GameObjects.Rectangle;
  private gadgetTxt?: Phaser.GameObjects.Text;

  constructor() { super('Run'); }

  init(data: { daily?: boolean }) {
    this.daily = !!data?.daily;
    this.enemies = []; this.lootObjs = [];
    this.bag = { common: 0, rare: 0, prime: 0 };
    this.heat = newHeat();
    this.t = 0; this.invuln = 0; this.fireCd = 0; this.bounty = 0; this.kills = 0; this.damageTaken = 0;
    this.ending = false; this.pickStreak = 0; this.lastPick = -9; this.beacon = null; this.beaconOpened = false;
    this.extractFill = 0; this.lastGreed = 1; this.trickleAt = 0; this.joyPointer = null; this.dashT = 0; this.dashCd = 0;
    this.gadgetUsed = false; this.decoy = null; this.smokeUntil = 0; this.heatFlash = 0;
  }

  create() {
    const s = state.save;
    s.runCounter++;
    const key = dailyKey(s);
    const seed = this.daily ? dailySeed(key) : hashString('run' + s.runCounter + ':' + (s.runsTotal * 7919));
    this.rng = mulberry32(seed ^ 0x9e3779b9);
    this.director = this.daily ? directorFor({ ...s.profile, recent: [] }) : directorFor(s.profile);
    this.map = generateMap(seed);
    this.maxHp = maxHp(s.upgrades);
    this.hp = this.maxHp;
    this.grudgeType = grudgeActive(s);
    track(s, 'run_start', { seed, daily: this.daily, gadget: s.gadget, upgrades: { ...s.upgrades }, rule: this.director.rule });

    this.physics.world.setBounds(0, 0, WORLD, WORLD);
    this.cameras.main.setBounds(0, 0, WORLD, WORLD);
    this.cameras.main.setBackgroundColor('#15151c');

    // floor tiles
    for (let r = 0; r < 9; r++) {
      const c = roomCenter(r);
      this.add.rectangle(c.x, c.y, ROOM, ROOM, (Math.floor(r / 3) + (r % 3)) % 2 ? 0x1b1b24 : 0x1f1f2a).setDepth(0);
    }

    this.walls = this.physics.add.staticGroup();
    const addBlock = (x: number, y: number, w: number, h: number, color: number) => {
      const b = this.add.rectangle(x + w / 2, y + h / 2, w, h, color).setDepth(2);
      this.physics.add.existing(b, true);
      this.walls.add(b);
    };
    this.map.walls.forEach((w) => addBlock(w.x, w.y, w.w, w.h, 0x6b6b78));
    this.map.covers.forEach((c) => addBlock(c.x, c.y, c.w, c.h, 0x3e3e4a));

    this.map.loot.forEach((d) => {
      const size = d.kind === 'prime' ? 20 : d.kind === 'rare' ? 16 : 13;
      const go = this.add.rectangle(d.x, d.y, size, size, COLORS[d.kind]).setDepth(3);
      if (d.kind === 'prime') this.tweens.add({ targets: go, angle: 45, scale: 1.25, yoyo: true, repeat: -1, duration: 500 });
      this.lootObjs.push({ d, go });
    });

    this.player = this.add.circle(this.map.spawn.x, this.map.spawn.y, 12, 0xffffff).setDepth(10);
    this.physics.add.existing(this.player);
    this.pbody = this.player.body as Phaser.Physics.Arcade.Body;
    this.pbody.setCircle(12);
    this.pbody.setCollideWorldBounds(true);
    this.physics.add.collider(this.player, this.walls);
    this.cameras.main.startFollow(this.player, true, 0.12, 0.12);

    this.enemyGroup = this.physics.add.group();
    this.bullets = this.physics.add.group();
    this.eBullets = this.physics.add.group();
    this.physics.add.collider(this.enemyGroup, this.walls);
    this.physics.add.collider(this.bullets, this.walls, (b) => b.destroy());
    this.physics.add.collider(this.eBullets, this.walls, (b) => b.destroy());

    this.tele = this.add.graphics().setDepth(5);
    this.beaconG = this.add.graphics().setDepth(1);
    this.bagBar = this.add.graphics().setDepth(11);

    this.setupInput();
    this.setupHud();
    this.scheduleBeacon(20);
    this.flashMsg(this.daily ? 'DAILY MAP' : 'GO. GRAB CUBES.', 1.4);
  }

  // ------------------------------------------------------------ setup
  private setupInput() {
    const kb = this.input.keyboard!;
    this.keys = kb.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT,SPACE') as Record<string, Phaser.Input.Keyboard.Key>;
    this.input.addPointer(2);
    this.joyG = this.add.graphics().setScrollFactor(0).setDepth(90);
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (this.gadgetBtn && Phaser.Geom.Rectangle.Contains(this.gadgetBtn.getBounds(), p.x, p.y)) { this.useGadget(); return; }
      if (!this.joyPointer) { this.joyPointer = p; this.joyOrigin.set(p.x, p.y); }
    });
    this.input.on('pointerup', (p: Phaser.Input.Pointer) => { if (this.joyPointer && p.id === this.joyPointer.id) this.joyPointer = null; });
    this.keys.SPACE.on('down', () => this.useGadget());
  }

  private setupHud() {
    const fix = <T extends Phaser.GameObjects.GameObject & { setScrollFactor(x: number): unknown; setDepth(d: number): unknown }>(o: T) => { o.setScrollFactor(0); o.setDepth(100); return o; };
    fix(this.add.rectangle(W / 2, 20, 350, 14, 0x333344));
    this.heatBar = fix(this.add.rectangle(20, 20, 1, 14, 0xff7043).setOrigin(0, 0.5));
    fix(this.add.text(W / 2, 20, 'HEAT', { fontFamily: FONT, fontSize: '11px', color: '#fff' }).setOrigin(0.5)).setDepth(101);
    this.hudTime = fix(this.add.text(16, 36, '', { fontFamily: FONT, fontSize: '16px', color: '#cfd8dc' }));
    this.hudHp = fix(this.add.text(16, 58, '', { fontFamily: FONT, fontSize: '18px', color: '#ff8a80' }));
    this.hudBag = fix(this.add.text(16, H - 70, '', { fontFamily: FONT, fontSize: '18px', color: '#fff', lineSpacing: 4 }));
    this.hudGreed = fix(this.add.text(W / 2, 110, '', { fontFamily: FONT, fontSize: '34px', color: '#ffd54f', fontStyle: 'bold' }).setOrigin(0.5));
    this.hudMsg = fix(this.add.text(W / 2, H / 2 - 120, '', { fontFamily: FONT, fontSize: '28px', color: '#fff', fontStyle: 'bold', align: 'center' }).setOrigin(0.5)).setDepth(120) as Phaser.GameObjects.Text;
    this.arrow = fix(this.add.text(0, 0, '', { fontFamily: FONT, fontSize: '16px', color: '#69f0ae', fontStyle: 'bold', align: 'center' }).setOrigin(0.5));
    this.mini = this.add.graphics().setScrollFactor(0).setDepth(100);
    this.vignette = fix(this.add.rectangle(W / 2, H / 2, W, H, 0xff0000, 0).setDepth(95)) as Phaser.GameObjects.Rectangle;
    if (state.save.gadget) {
      this.gadgetBtn = fix(this.add.rectangle(W - 55, H - 70, 80, 80, 0x37474f).setStrokeStyle(3, 0xffffff, 0.5)) as Phaser.GameObjects.Rectangle;
      this.gadgetTxt = fix(this.add.text(W - 55, H - 70, '', { fontFamily: FONT, fontSize: '15px', color: '#fff', align: 'center' }).setOrigin(0.5));
    }
    const mute = fix(this.add.text(W - 14, 38, state.save.muted ? 'SOUND OFF' : 'SOUND ON', { fontFamily: FONT, fontSize: '11px', color: '#90a4ae' }).setOrigin(1, 0));
    mute.setInteractive().on('pointerdown', (_p: unknown, _x: unknown, _y: unknown, e: Phaser.Types.Input.EventData) => {
      e.stopPropagation();
      state.save.muted = !state.save.muted; mute.setText(state.save.muted ? 'SOUND OFF' : 'SOUND ON'); persist();
    });
  }

  private flashMsg(s: string, secs = 1.0, color = '#ffffff') {
    this.hudMsg.setText(s).setColor(color).setAlpha(1).setScale(1.3);
    this.tweens.killTweensOf(this.hudMsg);
    this.tweens.add({ targets: this.hudMsg, scale: 1, duration: 150 });
    this.tweens.add({ targets: this.hudMsg, alpha: 0, delay: secs * 1000, duration: 300 });
  }

  // ------------------------------------------------------------ helpers
  private freePoint(room: number, radius: number): { x: number; y: number } {
    const c = roomCenter(room);
    for (let i = 0; i < 40; i++) {
      const x = c.x + (this.rng() - 0.5) * 360, y = c.y + (this.rng() - 0.5) * 360;
      if (!this.map.covers.some((r) => x > r.x - radius && x < r.x + r.w + radius && y > r.y - radius && y < r.y + r.h + radius)) return { x, y };
    }
    return c;
  }

  private scheduleBeacon(at: number) {
    const cur = roomAt(this.player.x, this.player.y);
    const options = [0, 1, 2, 3, 4, 5, 6, 7, 8].filter((r) => r !== cur && r !== this.nextBeacon.room);
    const room = options[Math.floor(this.rng() * options.length)];
    const p = this.freePoint(room, 60);
    this.nextBeacon = { at, room, x: p.x, y: p.y };
  }

  private spawnPoint(): { x: number; y: number } {
    let best = { x: 0, y: 0 }, bestD = -1;
    for (let i = 0; i < 14; i++) {
      const room = Math.floor(this.rng() * 9), c = roomCenter(room);
      const edge = Math.floor(this.rng() * 4), along = (this.rng() - 0.5) * 420, inset = 110 + this.rng() * 30;
      const x = c.x + (edge === 0 ? -ROOM / 2 + inset : edge === 1 ? ROOM / 2 - inset : along);
      const y = c.y + (edge === 2 ? -ROOM / 2 + inset : edge === 3 ? ROOM / 2 - inset : along);
      if (this.map.covers.some((r) => x > r.x - 24 && x < r.x + r.w + 24 && y > r.y - 24 && y < r.y + r.h + 24)) continue;
      const d = Math.hypot(x - this.player.x, y - this.player.y);
      if (d >= 300 && d > bestD * (0.7 + this.rng() * 0.3)) { best = { x, y }; bestD = d; }
    }
    if (bestD < 0) { const a = this.rng() * 6.28; return { x: Phaser.Math.Clamp(this.player.x + Math.cos(a) * 400, 60, WORLD - 60), y: Phaser.Math.Clamp(this.player.y + Math.sin(a) * 400, 60, WORLD - 60) }; }
    return best;
  }

  private spawnEnemy(type: EType) {
    const p = this.spawnPoint();
    const marked = this.grudgeType === type;
    let go: Phaser.GameObjects.Shape, hp: number, speed: number, dmg: number, size: number, color: number;
    if (type === 'drone') { color = 0xef5350; go = this.add.triangle(p.x, p.y, 0, 20, 10, 0, 20, 20, color); hp = 1; speed = 150; dmg = 1; size = 20; }
    else if (type === 'brute') { color = 0xd32f2f; go = this.add.rectangle(p.x, p.y, 30, 30, color); hp = 4; speed = 90; dmg = 2; size = 30; }
    else { color = 0xff1744; go = this.add.rectangle(p.x, p.y, 22, 22, color).setAngle(45); hp = 2; speed = 0; dmg = 1; size = 22; }
    go.setDepth(8);
    if (marked) { go.setStrokeStyle(4, 0xffd600); }
    this.enemyGroup.add(go);
    const e: Enemy = { go, type, hp, speed, dmg, color, size, stuck: 0, slideT: 0, slideA: 0, shotAt: this.t + 1.5 + this.rng() * 1.5, teleAt: -1, aim: 0, marked };
    this.enemies.push(e);
  }

  private spawnWave(n: number) {
    const d = this.director;
    const brutes = (base: number) => Math.max(0, base + d.bruteDelta);
    const list: EType[] = [];
    const add = (t: EType, c: number) => { for (let i = 0; i < c; i++) list.push(t); };
    if (n === 1) { add('drone', 3); if (d.earlySniper) add('sniper', 1); }
    if (n === 2) { add('drone', 2); add('brute', brutes(1)); add('sniper', 1); }
    if (n === 3) { add('drone', 4); add('brute', brutes(1)); add('sniper', 1); }
    if (n === 4) { add('drone', 6); add('brute', brutes(2)); add('sniper', 1); }
    list.forEach((t) => this.spawnEnemy(t));
    this.flashMsg(n === 4 ? 'THEY ALL KNOW' : 'HUNTERS', 1.0, '#ff8a80');
    beep(140, 0.25, 'sawtooth', 0.06);
    this.cameras.main.shake(180, 0.004);
  }

  private nearestEnemy(range: number): Enemy | null {
    let best: Enemy | null = null, bd = range;
    for (const e of this.enemies) {
      const d = Math.hypot(e.go.x - this.player.x, e.go.y - this.player.y);
      if (d < bd) { bd = d; best = e; }
    }
    return best;
  }

  private useGadget() {
    const g = state.save.gadget;
    if (!g || this.ending) return;
    if (g === 'dash') {
      if (this.dashCd > 0) return;
      this.dashT = 0.18; this.dashCd = 3; this.invuln = Math.max(this.invuln, 0.25);
      this.dashDir.copy(this.lastDir);
      beep(520, 0.1, 'triangle', 0.05);
    } else if (g === 'decoy') {
      if (this.gadgetUsed) return;
      this.gadgetUsed = true; this.decoy = { x: this.player.x, y: this.player.y, until: this.t + 4 };
      beep(300, 0.1, 'triangle', 0.05);
    } else if (g === 'smoke') {
      if (this.gadgetUsed) return;
      this.gadgetUsed = true; this.smokeUntil = this.t + 5;
      beep(200, 0.15, 'sine', 0.06);
    }
  }

  private damage(n: number, cause: EType) {
    if (this.invuln > 0 || this.ending) return;
    this.hp -= n; this.damageTaken += n; this.invuln = 1;
    this.extractFill = 0;
    this.cameras.main.shake(140, 0.006);
    this.cameras.main.flash(120, 255, 60, 60);
    beep(110, 0.18, 'sawtooth', 0.07);
    if (this.hp <= 0) this.finish(false, cause);
  }

  // ------------------------------------------------------------ update
  update(_time: number, delta: number) {
    if (this.ending) return;
    const dt = Math.min(delta / 1000, 0.05);
    this.t += dt; this.dtNow = dt;
    this.invuln = Math.max(0, this.invuln - dt);
    this.dashCd = Math.max(0, this.dashCd - dt);
    this.player.setAlpha(this.invuln > 0 && Math.floor(this.t * 20) % 2 ? 0.35 : 1);

    this.movePlayer(dt);
    this.autoFire(dt);
    this.pickups();
    const waves = stepHeat(this.heat, dt, this.cubesThisFrame, [this.director.firstWaveHeat, 50, 75, 100]);
    this.cubesThisFrame = 0;
    waves.forEach((w) => { this.heatFlash = 0.6; this.spawnWave(w); });
    if (this.heat.value >= 100 && this.t > this.trickleAt) { this.trickleAt = this.t + 6; this.spawnEnemy('drone'); this.spawnEnemy('drone'); }
    this.updateBeacon(dt);
    this.updateEnemies(dt);
    this.updateBullets();
    this.updateHud(dt);
  }

  private movePlayer(dt: number) {
    const k = this.keys;
    let vx = (k.D.isDown || k.RIGHT.isDown ? 1 : 0) - (k.A.isDown || k.LEFT.isDown ? 1 : 0);
    let vy = (k.S.isDown || k.DOWN.isDown ? 1 : 0) - (k.W.isDown || k.UP.isDown ? 1 : 0);
    this.joyG.clear();
    const jp = this.joyPointer;
    if (jp && jp.isDown) {
      const dx = jp.x - this.joyOrigin.x, dy = jp.y - this.joyOrigin.y;
      const len = Math.hypot(dx, dy);
      const max = 60;
      if (len > 8) { vx = dx / Math.max(len, 1); vy = dy / Math.max(len, 1); }
      const kl = Math.min(len, max);
      this.joyG.lineStyle(3, 0xffffff, 0.3).strokeCircle(this.joyOrigin.x, this.joyOrigin.y, max);
      this.joyG.fillStyle(0xffffff, 0.35).fillCircle(this.joyOrigin.x + (len ? (dx / len) * kl : 0), this.joyOrigin.y + (len ? (dy / len) * kl : 0), 24);
    }
    const mag = Math.hypot(vx, vy);
    if (mag > 1) { vx /= mag; vy /= mag; }
    if (mag > 0.1) this.lastDir.set(vx, vy).normalize();
    let sp = maxSpeed(state.save.upgrades) * speedMult(this.bag, state.save.upgrades.bag);
    if (this.dashT > 0) {
      this.dashT -= dt;
      this.pbody.setVelocity(this.dashDir.x * 620, this.dashDir.y * 620);
    } else this.pbody.setVelocity(vx * sp, vy * sp);
  }

  private autoFire(dt: number) {
    this.fireCd -= dt;
    if (this.fireCd > 0) return;
    const e = this.nearestEnemy(220);
    if (!e) return;
    this.fireCd = 1 / 3;
    const a = Math.atan2(e.go.y - this.player.y, e.go.x - this.player.x);
    const b = this.add.circle(this.player.x, this.player.y, 4, 0xfff59d).setDepth(9);
    this.bullets.add(b);
    (b.body as Phaser.Physics.Arcade.Body).setVelocity(Math.cos(a) * 480, Math.sin(a) * 480);
    b.setData('die', this.t + 0.55);
    beep(880, 0.03, 'square', 0.015);
  }

  private pickups() {
    for (let i = this.lootObjs.length - 1; i >= 0; i--) {
      const { d, go } = this.lootObjs[i];
      if (Math.hypot(go.x - this.player.x, go.y - this.player.y) < 24) {
        this.bag[d.kind]++;
        this.cubesThisFrame++;
        this.lootObjs.splice(i, 1);
        this.tweens.killTweensOf(go);
        this.tweens.add({ targets: go, scale: 2.2, alpha: 0, duration: 160, onComplete: () => go.destroy() });
        this.pickStreak = this.t - this.lastPick < 1.5 ? this.pickStreak + 1 : 0;
        this.lastPick = this.t;
        beep(440 * Math.pow(1.0595, Math.min(this.pickStreak, 12) * 2), 0.08, 'square', 0.05);
        if (d.kind === 'prime') this.flashMsg('PRIME. NOW LEAVE.', 1.2, '#ffd54f');
      }
    }
  }

  private updateBeacon(dt: number) {
    void dt;
    if (!this.beacon && this.t >= this.nextBeacon.at) {
      const n = this.nextBeacon;
      this.beacon = { room: n.room, x: n.x, y: n.y, closeAt: this.t + 25 };
      this.beaconOpened = true;
      this.extractFill = 0;
      this.flashMsg('EXTRACTION OPEN', 1.4, '#69f0ae');
      beep(660, 0.25, 'sine', 0.06);
    } else if (this.beacon && this.t >= this.beacon.closeAt) {
      this.beacon = null;
      this.scheduleBeacon(this.t + 5);
      this.flashMsg('BEACON CLOSED', 1.0, '#ff8a80');
    }
    this.beaconG.clear();
    const b = this.beacon;
    if (b) {
      const pulse = 1 + Math.sin(this.t * 6) * 0.04;
      this.beaconG.lineStyle(5, 0x69f0ae, 0.9).strokeCircle(b.x, b.y, 55 * pulse);
      this.beaconG.fillStyle(0x69f0ae, 0.12).fillCircle(b.x, b.y, 55);
      if (this.extractFill > 0) this.beaconG.fillStyle(0x69f0ae, 0.55).fillCircle(b.x, b.y, 55 * this.extractFill);
      const inside = Math.hypot(this.player.x - b.x, this.player.y - b.y) < 55;
      if (inside) {
        this.extractFill += (1 / 3) * this.dtNow;
        if (Math.floor(this.t * 10) % 3 === 0) beep(300 + this.extractFill * 500, 0.04, 'sine', 0.03);
        if (this.extractFill >= 1) this.finish(true);
      } else this.extractFill = Math.max(0, this.extractFill - 2 * this.dtNow);
    } else if (state.save.upgrades.scanner >= 3 && this.nextBeacon.at - this.t <= 5) {
      this.beaconG.lineStyle(3, 0x69f0ae, 0.35).strokeCircle(this.nextBeacon.x, this.nextBeacon.y, 55);
    }
  }

  private updateEnemies(dt: number) {
    const smoke = this.t < this.smokeUntil;
    if (this.decoy && this.t > this.decoy.until) this.decoy = null;
    this.tele.clear();
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      const body = e.go.body as Phaser.Physics.Arcade.Body;
      const tgt = this.decoy && Math.hypot(this.decoy.x - e.go.x, this.decoy.y - e.go.y) < 600 ? this.decoy : this.player;
      const dx = tgt.x - e.go.x, dy = tgt.y - e.go.y;
      const dist = Math.hypot(dx, dy) || 1;
      const nearSmoke = smoke && Math.hypot(this.player.x - e.go.x, this.player.y - e.go.y) < 220;
      if (e.type !== 'sniper') {
        let ang = Math.atan2(dy, dx);
        if (e.slideT > 0) { e.slideT -= dt; ang += e.slideA; }
        const sp = e.speed * (nearSmoke ? 0.4 : 1);
        body.setVelocity(Math.cos(ang) * sp, Math.sin(ang) * sp);
        const moved = Math.hypot(body.velocity.x, body.velocity.y);
        if (body.blocked.none === false || body.touching.none === false) e.stuck += dt; else e.stuck = Math.max(0, e.stuck - dt);
        if (e.stuck > 0.25 && e.slideT <= 0) { e.slideT = 0.7; e.slideA = (this.rng() < 0.5 ? -1 : 1) * 1.4; e.stuck = 0; }
        void moved;
        e.go.setAngle(e.type === 'drone' ? Phaser.Math.RadToDeg(ang) + 90 : 0);
      } else {
        body.setVelocity(0, 0);
        if (e.teleAt < 0 && this.t >= e.shotAt && !nearSmoke && dist < 520) { e.teleAt = this.t + 0.8; e.aim = Math.atan2(dy, dx); }
        if (e.teleAt >= 0) {
          const left = e.teleAt - this.t;
          this.tele.lineStyle(2, 0xff1744, 0.4 + 0.5 * (1 - left / 0.8));
          this.tele.lineBetween(e.go.x, e.go.y, e.go.x + Math.cos(e.aim) * 520, e.go.y + Math.sin(e.aim) * 520);
          if (left <= 0) {
            const b = this.add.circle(e.go.x, e.go.y, 6, 0xff5252).setDepth(9);
            this.eBullets.add(b);
            (b.body as Phaser.Physics.Arcade.Body).setVelocity(Math.cos(e.aim) * 260, Math.sin(e.aim) * 260);
            b.setData('die', this.t + 2.4);
            e.teleAt = -1; e.shotAt = this.t + 2;
            beep(240, 0.08, 'sawtooth', 0.04);
          }
        }
      }
      if (dist < 14 + e.size / 2 && tgt === this.player) this.damage(e.dmg, e.type);
    }
    // enemy bullets vs player
    (this.eBullets.getChildren() as Phaser.GameObjects.Arc[]).forEach((b) => {
      if (Math.hypot(b.x - this.player.x, b.y - this.player.y) < 17) { b.destroy(); this.damage(1, 'sniper'); }
    });
    // player bullets vs enemies
    (this.bullets.getChildren() as Phaser.GameObjects.Arc[]).forEach((b) => {
      for (const e of this.enemies) {
        if (Math.hypot(b.x - e.go.x, b.y - e.go.y) < 6 + e.size / 2) { b.destroy(); this.hitEnemy(e); break; }
      }
    });
  }

  private hitEnemy(e: Enemy) {
    e.hp -= 1;
    e.go.setFillStyle(0xffffff);
    this.time.delayedCall(70, () => { if (e.go.active) e.go.setFillStyle(e.color); });
    if (e.hp > 0) { beep(300, 0.04, 'square', 0.03); return; }
    const i = this.enemies.indexOf(e);
    if (i >= 0) this.enemies.splice(i, 1);
    this.kills++;
    this.bounty += eco.kills[e.type] * (e.marked ? 2 : 1);
    beep(660, 0.06, 'square', 0.04);
    for (let k = 0; k < 5; k++) {
      const p = this.add.rectangle(e.go.x, e.go.y, 5, 5, e.color).setDepth(9);
      const a = this.rng() * 6.28;
      this.tweens.add({ targets: p, x: p.x + Math.cos(a) * 30, y: p.y + Math.sin(a) * 30, alpha: 0, duration: 260, onComplete: () => p.destroy() });
    }
    if (e.marked) this.flashMsg('BOUNTY x2', 0.8, '#ffd600');
    e.go.destroy();
  }

  private updateBullets() {
    for (const grp of [this.bullets, this.eBullets])
      (grp.getChildren() as Phaser.GameObjects.Arc[]).forEach((b) => { if (this.t > (b.getData('die') as number)) b.destroy(); });
  }

  private greedNow(): number {
    return this.beaconOpened ? greedMult(this.t - 20) : 1;
  }

  private updateHud(dt: number) {
    const s = state.save;
    this.heatFlash = Math.max(0, this.heatFlash - dt);
    this.heatBar.width = Math.max(1, (this.heat.value / 100) * 350);
    this.heatBar.setFillStyle(this.heatFlash > 0 && Math.floor(this.t * 14) % 2 ? 0xffffff : this.heat.value > 75 ? 0xff1744 : 0xff7043);
    this.hudTime.setText(`${this.t.toFixed(0)} s`);
    this.hudHp.setText('HP ' + '♥'.repeat(Math.max(0, this.hp)) + '♡'.repeat(Math.max(0, this.maxHp - this.hp)));
    const sm = speedMult(this.bag, s.upgrades.bag);
    const val = rawValue(this.bag, this.director.primeMult);
    this.hudBag.setText(`BAG ${Math.round(val * this.greedNow())}   speed ${Math.round(sm * 100)}%\n${this.bag.common} green  ${this.bag.rare} blue  ${this.bag.prime} gold`);
    const g = this.greedNow();
    if (this.beaconOpened) {
      this.hudGreed.setText(`GREED x${g.toFixed(1)}`);
      if (g !== this.lastGreed) { this.lastGreed = g; this.tweens.add({ targets: this.hudGreed, scale: { from: 1.5, to: 1 }, duration: 220 }); beep(740, 0.1, 'triangle', 0.05); }
    }
    this.vignette.setFillStyle(0xff0000, this.hp <= 1 ? 0.12 + 0.08 * Math.sin(this.t * 8) : 0);
    // bag bar under the player
    this.bagBar.clear();
    const frac = Math.min(1, (1 - sm) / (1 - eco.weightFloor));
    this.bagBar.fillStyle(0x000000, 0.5).fillRect(this.player.x - 16, this.player.y + 18, 32, 5);
    this.bagBar.fillStyle(frac > 0.7 ? 0xff7043 : 0xffd54f, 1).fillRect(this.player.x - 16, this.player.y + 18, 32 * frac, 5);
    if (this.extractFill > 0 && this.beacon) this.bagBar.fillStyle(0x69f0ae, 1).fillRect(this.player.x - 16, this.player.y + 26, 32 * this.extractFill, 4);
    // gadget button
    if (this.gadgetTxt) {
      const gd = s.gadget!;
      const ready = gd === 'dash' ? this.dashCd <= 0 : !this.gadgetUsed;
      this.gadgetTxt.setText(gd.toUpperCase() + (gd === 'dash' && this.dashCd > 0 ? `\n${this.dashCd.toFixed(1)}` : ready ? '\nREADY' : '\nUSED'));
      this.gadgetBtn!.setFillStyle(ready ? 0x2e7d4f : 0x37474f);
    }
    this.drawMinimap();
    // beacon arrow
    const b = this.beacon;
    if (b) {
      const cam = this.cameras.main;
      const sx = b.x - cam.worldView.x, sy = b.y - cam.worldView.y;
      const off = sx < 20 || sx > W - 20 || sy < 80 || sy > H - 20;
      if (off) {
        const a = Math.atan2(b.y - this.player.y, b.x - this.player.x);
        const ax = Phaser.Math.Clamp(W / 2 + Math.cos(a) * 170, 30, W - 30), ay = Phaser.Math.Clamp(H / 2 + Math.sin(a) * 340, 120, H - 110);
        this.arrow.setPosition(ax, ay).setText(`➤ ${Math.round(Math.hypot(b.x - this.player.x, b.y - this.player.y) / 10)}m\nEXIT ${Math.max(0, b.closeAt - this.t).toFixed(0)}s`).setAlpha(1);
      } else this.arrow.setAlpha(0);
    } else this.arrow.setAlpha(0);
  }

  private drawMinimap() {
    const g = this.mini; g.clear();
    const x0 = W - 78, y0 = 62, c = 20;
    for (let r = 0; r < 9; r++) {
      g.fillStyle(0x263238, 0.8).fillRect(x0 + (r % 3) * c, y0 + Math.floor(r / 3) * c, c - 2, c - 2);
    }
    const dot = (wx: number, wy: number, col: number, rad = 2.5) => {
      g.fillStyle(col, 1).fillCircle(x0 + (wx / WORLD) * c * 3, y0 + (wy / WORLD) * c * 3, rad);
    };
    const up = state.save.upgrades.scanner;
    if (up >= 1) this.lootObjs.forEach((l) => { if (l.d.kind === 'rare') dot(l.d.x, l.d.y, 0x2196f3, 1.8); });
    if (up >= 2) this.lootObjs.forEach((l) => { if (l.d.kind === 'prime') dot(l.d.x, l.d.y, 0xffc107, 2.5); });
    if (this.beacon) dot(this.beacon.x, this.beacon.y, 0x69f0ae, 3.5);
    else if (up >= 3 && this.nextBeacon.at - this.t <= 5) dot(this.nextBeacon.x, this.nextBeacon.y, 0x69f0ae, 2);
    this.enemies.forEach((e) => dot(e.go.x, e.go.y, 0xff5252, 1.4));
    dot(this.player.x, this.player.y, 0xffffff, 3);
  }

  // ------------------------------------------------------------ end of run
  private finish(extracted: boolean, cause?: EType) {
    if (this.ending) return;
    this.ending = true;
    const s = state.save;
    this.pbody.setVelocity(0, 0);
    this.enemies.forEach((e) => (e.go.body as Phaser.Physics.Arcade.Body).setVelocity(0, 0));
    const mult = this.greedNow();
    const greedStay = Math.max(0, this.t - 20);
    const fullBag = { ...this.bag };
    const notes: string[] = [];
    let bagValue = 0, partsGained = 0, scrapGained = 0;
    if (extracted) {
      bagValue = Math.round(rawValue(fullBag, this.director.primeMult) * mult);
      partsGained = partsIn(fullBag);
      s.cash += bagValue; s.parts += partsGained; s.extractions++;
      s.best = Math.max(s.best, bagValue);
      this.cameras.main.shake(300, 0.012);
      this.cameras.main.flash(250, 105, 240, 174);
      this.tweens.add({ targets: this.cameras.main, zoom: 1.2, duration: 400 });
      beep(880, 0.25, 'sine', 0.07); beep(1320, 0.3, 'sine', 0.06);
    } else {
      const kept = insuredKeep(fullBag, s.insuredSlots);
      const keptValue = rawValue(kept);
      scrapGained = scrap(rawValue(fullBag, this.director.primeMult));
      bagValue = keptValue;
      partsGained = partsIn(kept);
      s.cash += keptValue + scrapGained; s.parts += partsGained;
      if (cause) setGrudge(s, cause);
      this.cameras.main.shake(400, 0.015);
      this.cameras.main.fade(500, 120, 0, 0);
    }
    s.cash += this.bounty;
    s.runsTotal++;
    recordRun(s.profile, { extracted, greedStay, kills: this.kills, durationS: this.t, cause });
    track(s, 'run_end', { result: extracted ? 'extracted' : 'lost', durationS: Math.round(this.t * 10) / 10, heatMax: Math.round(this.heat.value), bagValue, greedMult: mult, cause: cause ?? null, damageTaken: this.damageTaken, kills: this.kills });

    const stats = { extracted, bag: fullBag, heatAtEnd: this.heat.value, greedMult: mult, damageTaken: this.damageTaken };
    if (this.daily && !dailyDone(s) && contractMet(dailyContract(dailyKey(s)).id, stats)) {
      const reward = completeDaily(s);
      track(s, 'contract_complete', { id: dailyContract(dailyKey(s)).id, streak: s.daily.streak });
      notes.push(`DAILY CONTRACT DONE: +${reward} cash. Streak ${s.daily.streak}. Smoke gadget unlocked.`);
    }
    const hadDecoy = s.gadgets.includes('decoy');
    unlockDecoy(s);
    if (!hadDecoy && s.gadgets.includes('decoy')) notes.push('DECOY gadget unlocked (5 extractions).');
    if (maybeSealCourier(s)) notes.push('A sealed crate landed in your Stash. The Courier arrives at midnight.');
    if (!s.gadget && s.gadgets.length) s.gadget = s.gadgets[0];
    persist();

    const handlerTag = extracted ? (mult >= 1.3 ? 'extract_greedy' : this.hp <= 1 ? 'extract_hurt' : val(fullBag) < 60 ? 'extract_low' : 'extract')
      : cause ? 'death_' + cause : 'death_any';
    const line = pickLine({ tag: handlerTag, vars: { type: cause ?? '' } });
    const delay = extracted ? 700 : 650;
    this.time.delayedCall(delay, () => this.scene.start('End', {
      extracted, bagValue, mult, scrap: scrapGained, bounty: this.bounty, parts: partsGained, line, notes, daily: this.daily,
      cause: cause ?? null, time: Math.round(this.t), cubes: fullBag, best: s.best,
    }));
    void gameNow;
  }
}

function val(b: Bag): number { return rawValue(b); }
