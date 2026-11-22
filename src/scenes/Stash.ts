import Phaser from 'phaser';
import eco from '../data/economy.json';
import { state, persist } from '../state';
import { W, text, button } from '../ui';
import { upgradeCost, type UpgradeId } from '../systems/economy';
import { pickLine } from '../systems/handler';
import { track } from '../systems/telemetry';
import { beep } from '../audio';

const IDS: UpgradeId[] = ['bag', 'boots', 'plating', 'scanner'];

export class Stash extends Phaser.Scene {
  constructor() { super('Stash'); }

  create() {
    const s = state.save;
    this.cameras.main.setBackgroundColor('#0b0b10');
    text(this, W / 2, 50, 'STASH', 34, '#ffd54f').setFontStyle('bold');
    text(this, W / 2, 92, `Cash ${s.cash}    Parts ${s.parts}`, 18, '#eceff1');

    IDS.forEach((id, i) => {
      const y = 175 + i * 120;
      const u = eco.upgrades[id];
      const lvl = s.upgrades[id];
      this.add.rectangle(W / 2, y, W - 30, 104, 0x1c1c26).setStrokeStyle(2, 0x37474f);
      text(this, 30, y - 36, `${u.name}  L${lvl}/3`, 17, '#ffffff', 0).setFontStyle('bold');
      text(this, 30, y - 12, u.desc, 12, '#90a4ae', 0).setWordWrapWidth(210);
      const c = upgradeCost(id, lvl);
      if (!c) { text(this, W - 90, y + 20, 'MAXED', 16, '#69f0ae'); return; }
      const can = s.cash >= c.cash && s.parts >= c.parts;
      const b = button(this, W - 90, y + 18, 130, 44, `${c.cash}${c.parts ? ' + ' + c.parts + 'p' : ''}`, () => {
        if (s.cash < c.cash || s.parts < c.parts) return;
        s.cash -= c.cash; s.parts -= c.parts; s.upgrades[id]++;
        track(s, 'upgrade_buy', { id, level: s.upgrades[id] });
        persist(); beep(660, 0.12, 'triangle', 0.06); this.scene.restart();
      }, can ? 0x2e7d4f : 0x37474f, 16);
      b.setEnabled(can);
    });

    const line = Object.values(s.upgrades).reduce((a, b) => a + b, 0) === 0 ? pickLine({ tag: 'no_upgrade' }) : '';
    if (line) text(this, W / 2, 665, line, 13, '#78909c');
    button(this, W / 2, 745, 300, 56, 'RUN', () => this.scene.start('Run', { daily: false }), 0x2e7d4f, 24);
    button(this, W / 2, 805, 200, 36, 'MENU', () => this.scene.start('Title'), 0x263238, 14);
  }
}
