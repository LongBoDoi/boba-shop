import Phaser from 'phaser';
import { tex } from '../game/view';
import { CounterLayout } from './layout';
import { COUNTER_ROOMS } from '../art/counterRoomArt';
import { COUNTER_FOREGROUND } from './foreground';

/** Original painting below the queue, with its counter silhouettes repeated above the figures. */
export class Backdrop {
  private room: Phaser.GameObjects.Image;
  private foreground: Phaser.GameObjects.Image;
  private cabinet: Phaser.GameObjects.Image;
  private foregroundKeys = new Set<string>();

  constructor(private scene: Phaser.Scene) {
    this.room = scene.add.image(0, 0, '__DEFAULT').setOrigin(0).setDepth(0).setVisible(false);
    this.foreground = scene.add.image(0, 0, '__DEFAULT').setOrigin(0).setDepth(120).setVisible(false);
    this.cabinet = scene.add.image(0, 0, '__DEFAULT').setOrigin(0).setDepth(120).setVisible(false);
  }

  build(layout: CounterLayout) {
    const { orientation, x, y, width, height } = layout.room;
    const sourceKey = tex(COUNTER_ROOMS[orientation].image);
    this.room.setTexture(sourceKey).setPosition(x, y).setDisplaySize(width, height).setVisible(true);
    const foregroundKey = `counter:foreground:${sourceKey}`;
    const cabinetKey = `counter:cabinet:${sourceKey}`;
    if (!this.scene.textures.exists(foregroundKey)) {
      // Bake the clip once at the source resolution. Both layers then use the identical projection,
      // preserving the painting's pixels and avoiding per-frame masks or new background assets.
      const source = this.scene.textures.get(sourceKey).getSourceImage() as HTMLImageElement;
      const canvas = document.createElement('canvas');
      canvas.width = source.width;
      canvas.height = source.height;
      const context = canvas.getContext('2d')!;
      const silhouette = new Path2D();
      for (const polygon of COUNTER_FOREGROUND[orientation]) {
        silhouette.moveTo(...polygon[0]);
        for (const point of polygon.slice(1)) silhouette.lineTo(...point);
        silhouette.closePath();
      }
      context.clip(silhouette);
      context.drawImage(source, 0, 0);
      this.scene.textures.addCanvas(foregroundKey, canvas);
      // Continue only the straight, undecorated cabinet grain on unusually tall screens.
      // The room, tabletop, props and cookie shelf retain their original aspect ratio.
      const extension = document.createElement('canvas');
      extension.width = source.width;
      extension.height = 96;
      extension.getContext('2d')!.drawImage(source, 0, source.height - 96, source.width, 96,
        0, 0, source.width, 96);
      this.scene.textures.addCanvas(cabinetKey, extension);
    }
    this.foregroundKeys.add(foregroundKey);
    this.foregroundKeys.add(cabinetKey);
    this.foreground.setTexture(foregroundKey).setPosition(x, y).setDisplaySize(width, height).setVisible(true);
    const cabinetBand = 96 * layout.room.scale;
    this.cabinet.setTexture(cabinetKey).setPosition(x, y + height - cabinetBand)
      .setDisplaySize(width, cabinetBand + layout.room.cabinetExtension).setVisible(layout.room.cabinetExtension > 0);

  }

  destroy() {
    this.room.destroy();
    this.foreground.destroy();
    this.cabinet.destroy();
    for (const key of this.foregroundKeys) this.scene.textures.remove(key);
    this.foregroundKeys.clear();
  }
}
