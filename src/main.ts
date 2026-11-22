import Phaser from 'phaser';
import { Title } from './scenes/Title';
import { Run } from './scenes/Run';
import { End } from './scenes/End';
import { Stash } from './scenes/Stash';
import { Reviewer } from './scenes/Reviewer';
import { W, H } from './ui';

const review = new URLSearchParams(window.location.search).get('review') === '1';

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'app',
  width: W,
  height: H,
  backgroundColor: '#0b0b10',
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  physics: { default: 'arcade', arcade: { debug: false } },
  input: { activePointers: 3 },
  scene: review ? [Reviewer, Title, Run, End, Stash] : [Title, Run, End, Stash, Reviewer],
});

// handy for the in-browser test pass
(window as unknown as { __game: Phaser.Game }).__game = game;
