import { Platform, ViewStyle } from 'react-native';

/**
 * Asks the browser to keep this view on a compositor layer of its own. Nothing anywhere else.
 *
 * A browser keeps the page as a few big rasterised layers, and anything that moves *inside* one
 * repaints every pixel it passes over — including whatever is drawn underneath it. That is cheap
 * for a plain view and ruinous for the cup: its glass is five masks, its ice twelve gradient-filled
 * cubes, its pile fifty-one clipped sprites, and every frame a scoop was carried over it, or the cup
 * itself was carried, re-rastered all of it. A finished drink tripled the page's raster work and
 * made every action after it stutter on a phone. On a layer of its own a thing that moves is
 * translated by the compositor, a picture already drawn, and what is under it is left alone.
 *
 * It is for things that move every frame and things that are expensive to draw — not a blanket
 * style: each layer is a texture in GPU memory, so a hundred of them would be its own problem.
 * Native ignores it; `react-native-svg` there has its own bitmap per `Svg` (see `CupLayer`).
 */
export const ownLayer: ViewStyle = Platform.OS === 'web' ? ({ willChange: 'transform' } as ViewStyle) : {};
