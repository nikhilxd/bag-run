import Phaser from 'phaser';
import { state, persist, replaceSave } from '../state';
import { W, text, button } from '../ui';
import { freshSave, wipeSave } from '../systems/save';
import { summarize } from '../systems/telemetry';

export class Reviewer extends Phaser.Scene {
  private out!: Phaser.GameObjects.Text;
  constructor() { super('Reviewer'); }

  create() {
    const s = state.save;
    this.cameras.main.setBackgroundColor('#0b0b10');
    text(this, W / 2, 40, 'REVIEWER TOOLS', 26, '#ffd54f').setFontStyle('bold');
    text(this, W / 2, 76, 'Shortcuts to see the day-2 hooks without waiting.', 12, '#90a4ae');
    button(this, W / 2, 130, 320, 48, 'Skip to tomorrow (+1 day)', () => { s.clockOffsetMs += 86400000; persist(); this.say(`Clock moved +1 day (offset ${s.clockOffsetMs / 86400000} d). Courier opens at its midnight, daily contract rerolls.`); }, 0x1565c0, 16);
    button(this, W / 2, 190, 320, 48, 'Give 1000 Cash', () => { s.cash += 1000; persist(); this.say('Cash: ' + s.cash); }, 0x2e7d4f, 16);
    button(this, W / 2, 250, 320, 48, 'Show telemetry summary', () => this.say(summarize(s)), 0x455a64, 16);
    button(this, W / 2, 310, 320, 48, 'Copy my stats', () => {
      const txt = summarize(s);
      try { void navigator.clipboard.writeText(txt).then(() => this.say('Copied.\n' + txt), () => this.say(txt)); } catch { this.say(txt); }
    }, 0x455a64, 16);
    button(this, W / 2, 370, 320, 48, 'Reset save', () => { wipeSave(); replaceSave(freshSave()); this.say('Save wiped.'); }, 0xb71c1c, 16);
    this.out = text(this, W / 2, 560, '', 13, '#eceff1').setLineSpacing(4);
    button(this, W / 2, 790, 200, 44, 'Back to game', () => this.scene.start('Title'), 0x2e7d4f, 18);
  }

  private say(s: string) { this.out.setText(s); }
}
