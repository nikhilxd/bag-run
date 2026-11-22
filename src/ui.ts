import Phaser from 'phaser';

export const W = 390;
export const H = 844;
export const FONT = 'Arial, Helvetica, sans-serif';

export function text(scene: Phaser.Scene, x: number, y: number, s: string, size = 18, color = '#ffffff', origin = 0.5) {
  return scene.add.text(x, y, s, { fontFamily: FONT, fontSize: `${size}px`, color, align: 'center', wordWrap: { width: W - 40 } }).setOrigin(origin);
}

export function button(scene: Phaser.Scene, x: number, y: number, w: number, h: number, label: string, cb: () => void, fill = 0x2e7d4f, size = 22) {
  const r = scene.add.rectangle(x, y, w, h, fill).setStrokeStyle(2, 0xffffff, 0.35);
  const t = scene.add.text(x, y, label, { fontFamily: FONT, fontSize: `${size}px`, color: '#ffffff', align: 'center', wordWrap: { width: w - 12 } }).setOrigin(0.5);
  r.setInteractive({ useHandCursor: true });
  r.on('pointerdown', () => r.setAlpha(0.7));
  r.on('pointerout', () => r.setAlpha(1));
  r.on('pointerup', () => { r.setAlpha(1); cb(); });
  return { r, t, setLabel: (s: string) => t.setText(s), setEnabled: (on: boolean) => { r.setAlpha(on ? 1 : 0.35); if (on) r.setInteractive(); else r.disableInteractive(); } };
}
