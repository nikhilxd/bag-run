import Phaser from 'phaser';
import { state } from '../state';
import { W, text, button } from '../ui';
import type { Bag } from '../systems/economy';

interface EndData {
  extracted: boolean; bagValue: number; mult: number; scrap: number; bounty: number; parts: number;
  line: string; notes: string[]; daily: boolean; cause: string | null; time: number; cubes: Bag; best: number;
}

export class End extends Phaser.Scene {
  constructor() { super('End'); }

  create(d: EndData) {
    const ok = d.extracted;
    this.cameras.main.setBackgroundColor(ok ? '#0d1f17' : '#240d0d');
    text(this, W / 2, 80, ok ? 'EXTRACTED' : 'LOST', 44, ok ? '#69f0ae' : '#ff8a80').setFontStyle('bold');
    text(this, W / 2, 130, `${d.time}s  |  ${d.cubes.common} green  ${d.cubes.rare} blue  ${d.cubes.prime} gold`, 14, '#b0bec5');

    const rows: string[] = [];
    if (ok) {
      rows.push(`Bag banked: ${d.bagValue}` + (d.mult !== 1 ? `  (greed x${d.mult.toFixed(1)})` : ''));
    } else {
      rows.push(d.bagValue > 0 ? `Insured cubes kept: ${d.bagValue}` : 'Bag lost.');
      rows.push(`Scrap salvage: ${d.scrap}`);
    }
    if (d.bounty) rows.push(`Kill bounty: ${d.bounty}`);
    if (d.parts) rows.push(`Parts: +${d.parts}`);
    rows.push(`Cash now: ${state.save.cash}   Best bag: ${state.save.best}`);
    text(this, W / 2, 235, rows.join('\n'), 18, '#eceff1').setLineSpacing(8);

    this.add.rectangle(W / 2, 400, W - 40, 78, 0x1c1c26).setStrokeStyle(2, 0x455a64);
    text(this, 40, 372, 'HANDLER', 11, '#69f0ae', 0);
    text(this, W / 2, 406, d.line, 15, '#eceff1');

    if (d.notes.length) text(this, W / 2, 520, d.notes.join('\n\n'), 13, '#ffd54f').setLineSpacing(4);

    button(this, W / 2, 660, 300, 66, 'RUN AGAIN', () => this.scene.start('Run', { daily: false }), 0x2e7d4f, 28);
    button(this, W / 2, 735, 300, 50, 'STASH & UPGRADES', () => this.scene.start('Stash'), 0x455a64, 18);
    button(this, W / 2, 795, 300, 40, 'MENU', () => this.scene.start('Title'), 0x263238, 15);
  }
}
