import Phaser from 'phaser';

/**
 * The canvas is drawn at the device's pixel density and shown at CSS size (`zoom: 1 / DPR` in
 * `game.ts`), so artwork is as sharp as the phone can show it. Everything the scenes lay out is in
 * **CSS pixels** — the same units the HTML around it uses — and each camera is zoomed by `DPR`
 * to turn that into canvas pixels. Capped at 3: a DPR-4 canvas is a lot of fill for no visible gain.
 */
export const DPR = Math.min(3, Math.max(1, window.devicePixelRatio || 1));

export const FONT = '"Baloo 2", system-ui, sans-serif';

/** Point a camera at a rectangle of the canvas, given in CSS pixels; the world inside it is too. */
export function placeCamera(camera: Phaser.Cameras.Scene2D.Camera, x: number, y: number, width: number, height: number) {
  camera.setViewport(Math.round(x * DPR), Math.round(y * DPR), Math.max(1, Math.round(width * DPR)),
    Math.max(1, Math.round(height * DPR)));
  camera.setOrigin(0, 0);
  camera.setZoom(DPR);
}

export interface TextOptions {
  size: number;
  /** 500 body, 600 semi, 700 bold, 800 display — Baloo 2's four weights. */
  weight?: 500 | 600 | 700 | 800;
  color?: string;
  align?: 'left' | 'center' | 'right';
  /** Wrap at this width, in CSS pixels. */
  wrap?: number;
  lineSpacing?: number;
  stroke?: string;
  strokeThickness?: number;
}

/** Text drawn at the canvas's own density, so it is as crisp as the HTML beside it. */
export function addText(scene: Phaser.Scene, x: number, y: number, value: string, options: TextOptions) {
  const style: Phaser.Types.GameObjects.Text.TextStyle = {
    fontFamily: FONT,
    fontSize: `${options.size}px`,
    fontStyle: String(options.weight ?? 700),
    color: options.color ?? '#4A2C2A',
    align: options.align ?? 'left',
    resolution: DPR,
  };
  // Phaser reads a key that is present but undefined as a value, and measures the text as NaN.
  if (options.stroke) {
    style.stroke = options.stroke;
    style.strokeThickness = options.strokeThickness ?? 1;
  }
  if (options.wrap) style.wordWrap = { width: options.wrap, useAdvancedWrap: true };
  const text = scene.add.text(x, y, value, style);
  if (options.lineSpacing !== undefined) text.setLineSpacing(options.lineSpacing);
  return text;
}

/**
 * Turn an SVG document into a texture, rasterised at the device's density so the vector art stays
 * sharp. `width`/`height` are its CSS size; the texture is `DPR` times that, so display it with
 * `setDisplaySize(width, height)`. Resolves once the browser has decoded it.
 */
export function svgTexture(scene: Phaser.Scene, key: string, svg: string, width: number, height: number): Promise<string> {
  if (scene.textures.exists(key)) return Promise.resolve(key);
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      if (scene.textures.exists(key)) { resolve(key); return; }
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.ceil(width * DPR));
      canvas.height = Math.max(1, Math.ceil(height * DPR));
      const context = canvas.getContext('2d');
      if (!context) { reject(new Error('no 2d context')); return; }
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      scene.textures.addCanvas(key, canvas);
      resolve(key);
    };
    image.onerror = () => reject(new Error(`could not rasterise SVG texture "${key}"`));
    image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  });
}

/**
 * Draw something once with Canvas 2D and keep it as a texture. `draw` works in CSS pixels; the
 * canvas is `DPR` times larger, so display the result with `setDisplaySize(width, height)`.
 *
 * **Use this, not a `Graphics`, for anything that stays on screen.** Phaser re-tessellates a
 * `Graphics` object's shapes and re-uploads them on every frame it is drawn, changed or not; a few
 * rounded plaques and soft shadows left as `Graphics` were most of the kitchen's frame time on a
 * slowed CPU. A texture costs nothing to draw again.
 */
export function bakeCanvas(scene: Phaser.Scene, key: string, width: number, height: number,
  draw: (context: CanvasRenderingContext2D) => void): string {
  if (scene.textures.exists(key)) return key;
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.ceil(width * DPR));
  canvas.height = Math.max(1, Math.ceil(height * DPR));
  const context = canvas.getContext('2d')!;
  context.scale(canvas.width / width, canvas.height / height);
  draw(context);
  scene.textures.addCanvas(key, canvas);
  return key;
}

/** A Baloo 2 font string for Canvas 2D. */
export function canvasFont(size: number, weight: 500 | 600 | 700 | 800 = 700) {
  return `${weight} ${size}px ${FONT}`;
}

/** A texture key for a shared asset: under Vite the `require`d "module" is its URL. */
export function tex(asset: number | string): string {
  return String(asset);
}
