import Phaser from 'phaser';
import { tex } from '../game/view';
import { CounterLayout } from './layout';
import { COUNTER_ROOMS } from '../art/counterRoomArt';

/** All furniture and counter supplies share one painting and its lighting. */
export class Backdrop {
  private room: Phaser.GameObjects.Image;

  constructor(scene: Phaser.Scene) {
    this.room = scene.add.image(0, 0, '__DEFAULT').setOrigin(0).setDepth(0).setVisible(false);
  }

  build(layout: CounterLayout) {
    const { orientation, x, y, width, height } = layout.room;
    this.room.setTexture(tex(COUNTER_ROOMS[orientation].image)).setPosition(x, y).setDisplaySize(width, height).setVisible(true);
  }

  destroy() { this.room.destroy(); }
}
