import Phaser from 'phaser';
import { state, persist } from '../state';
import { W, H, FONT, text, button } from '../ui';
import { directorFor, pickLine, preRunTag } from '../systems/handler';
import { dailyContract, dailyKey, dailyDone, courierReady, openCourier, grudgeActive } from '../systems/meta';
import { fmtHMS, gameNow, nextUtcMidnight } from '../systems/save';
import { track } from '../systems/telemetry';
import { beep } from '../audio';

let sessionLogged = false;

export class Title extends Phaser.Scene {
  private timers!: Phaser.GameObjects.Text;
  constructor() { super('Title'); }

  create() {
    const s = state.save;
    if (!sessionLogged) { sessionLogged = true; track(s, 'session_start', { runs: s.runsTotal }); persist(); }
    this.cameras.main.setBackgroundColor('#0b0b10');
    text(this, W / 2, 70, 'BAG RUN', 46, '#ffd54f').setFontStyle('bold');
    text(this, W / 2, 112, 'Grab cubes. Get out. Greed has a price.', 14, '#90a4ae');

    const d = directorFor(s.profile);
    const tag = preRunTag(d, s.daily.streak);
    const gr = grudgeActive(s);
    const line = s.runsTotal === 0 ? 'First job. Grab what shines, then find the green ring. Do not stay long.' : gr ? pickLine({ tag: 'grudge', vars: { type: gr } }) : pickLine({ tag, vars: { n: s.daily.streak } });
    this.add.rectangle(W / 2, 190, W - 40, 80, 0x1c1c26).setStrokeStyle(2, 0x455a64);
    text(this, 40, 160, 'HANDLER', 11, '#69f0ae', 0);
    text(this, W / 2, 196, line, 15, '#eceff1');

    text(this, W / 2, 275, `Cash ${s.cash}   Parts ${s.parts}   Best ${s.best}`, 16, '#cfd8dc');

    button(this, W / 2, 345, 300, 70, 'RUN', () => { beep(520, 0.08); this.scene.start('Run', { daily: false }); }, 0x2e7d4f, 32);

    const dc = dailyContract(dailyKey(s));
    const done = dailyDone(s);
    const dbtn = button(this, W / 2, 435, 300, 62, done ? 'DAILY DONE' : 'DAILY CONTRACT', () => this.scene.start('Run', { daily: true }), 0x1565c0, 18);
    dbtn.setEnabled(!done);
    text(this, W / 2, 482, done ? `Streak ${s.daily.streak}. New contract in a bit.` : `${dc.text}  +300 cash`, 12, '#90caf9');
    this.timers = text(this, W / 2, 506, '', 12, '#90a4ae');

    button(this, W / 2, 565, 300, 52, 'STASH & UPGRADES', () => this.scene.start('Stash'), 0x455a64, 18);

    // courier
    if (s.courier.state === 'sealed') {
      const ready = courierReady(s);
      const cb = button(this, W / 2, 628, 300, 52, ready ? 'OPEN COURIER CRATE' : 'COURIER CRATE: SEALED', () => {
        if (openCourier(s)) { track(s, 'courier_open', {}); persist(); this.scene.restart(); }
      }, ready ? 0xf9a825 : 0x37474f, 16);
      cb.setEnabled(ready);
    } else if (s.courier.state === 'opened') {
      text(this, W / 2, 628, 'Courier delivered: Dash + 1 insured slot', 13, '#a5d6a7');
    }

    // gadget cycler
    if (s.gadgets.length) {
      const g = button(this, W / 2, 698, 300, 46, 'GADGET: ' + (s.gadget ?? 'none').toUpperCase() + '  (tap to switch)', () => {
        const i = s.gadgets.indexOf(s.gadget!);
        s.gadget = s.gadgets[(i + 1) % s.gadgets.length];
        persist(); this.scene.restart();
      }, 0x37474f, 14);
      void g;
    }
    const insured = s.insuredSlots ? `Insured slots: ${s.insuredSlots} (kept if you die)` : 'Die and you keep only 10% scrap.';
    text(this, W / 2, 752, insured, 12, '#78909c');
    text(this, W / 2, 782, 'Move: drag anywhere / WASD.  Gadget: button / Space.  Fire is automatic.', 11, '#78909c');

    const mute = this.add.text(16, H - 24, s.muted ? 'sound off' : 'sound on', { fontFamily: FONT, fontSize: '12px', color: '#78909c' }).setInteractive();
    mute.on('pointerup', () => { s.muted = !s.muted; persist(); mute.setText(s.muted ? 'sound off' : 'sound on'); });
    const rv = this.add.text(W - 16, H - 24, 'reviewer tools', { fontFamily: FONT, fontSize: '12px', color: '#78909c' }).setOrigin(1, 0).setInteractive();
    rv.on('pointerup', () => this.scene.start('Reviewer'));
  }

  update() {
    const s = state.save;
    const now = gameNow(s);
    const parts: string[] = [];
    if (dailyDone(s)) parts.push('Next contract in ' + fmtHMS(nextUtcMidnight(now) - now));
    if (s.courier.state === 'sealed' && !courierReady(s)) parts.push('Courier in ' + fmtHMS(s.courier.opensAt - now));
    this.timers.setText(parts.join('   |   '));
  }
}
