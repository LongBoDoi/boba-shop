import { useEffect, useRef, useState } from 'preact/hooks';

import painting from '../assets/title/cat-storefront.png';
import backdropImage from '../assets/title/storefront-base-v3.png';
import catsImage from '../assets/title/storefront-cats-v3.png';
import foregroundImage from '../assets/title/storefront-foreground-v3.png';
import armSheetImage from '../assets/title/fortune-arm-wrist-v6.png';
import foliageLayer from '../assets/title/foliage-layer.png';
import courtyardImage from '../assets/title/storefront-courtyard-v1.png';
import upperImage from '../assets/title/storefront-house-roof-v3.png';
import gardenImage from '../assets/title/storefront-side-garden-v2.png';
import rightLeavesImage from '../assets/title/storefront-right-leaves-v1.png';
import cornerTreesImage from '../assets/title/storefront-corner-trees-v1.png';
import easelClearImage from '../assets/title/storefront-easel-clear-v1.png';
import neighborhoodImage from '../assets/title/storefront-neighborhood-v1.png';
import landscapeNeighborhoodImage from '../assets/title/storefront-neighborhood-landscape-v1.png';
import { createStorefrontMotion } from './storefrontMotion';
import { paintStorefrontStill } from './storefrontScene';
import { storefrontBox, storefrontLayout } from './storefrontLayout';

interface Props { width: number; height: number; paused: boolean; greeting: number }

/** Animated and static renderers share the same layout through rotation and context loss. */
export function Storefront({ width, height, paused, greeting }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const still = useRef<HTMLCanvasElement>(null);
  const [stillReady, setStillReady] = useState(false);
  const [moving, setMoving] = useState(false);
  const controls = useRef({ paused, greeting });
  const wake = useRef<() => void>(() => {});
  const refresh = useRef<() => void>(() => {});
  const dimensions = useRef({width,height});
  dimensions.current = {width,height};
  controls.current = { paused, greeting };
  useEffect(() => {
    const element = canvas.current!;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    let reduceMotion = reduced.matches;
    let disposed = false, contextLost = false,artReady = false, frame = 0, elapsed = 0, previous = 0, lastPaint = 0;
    let motion: ReturnType<typeof createStorefrontMotion> = null;
    const image = new Image(), backdrop = new Image(), cats = new Image(), foreground = new Image(), armSheet = new Image(), foliage = new Image(),courtyard = new Image(),upper = new Image(),garden = new Image(),rightLeaves = new Image(),cornerTrees = new Image(),easelClear = new Image(),neighborhood = new Image(),landscapeNeighborhood = new Image();
    const loadedSources = () => ({
      backdrop: backdrop.naturalWidth ? backdrop : undefined,
      cats: cats.naturalWidth ? cats : undefined,
      foreground: foreground.naturalWidth ? foreground : undefined,
      armSheet: armSheet.naturalWidth ? armSheet : undefined,
      foliage: foliage.naturalWidth ? foliage : undefined,
      courtyard: courtyard.naturalWidth ? courtyard : undefined,
      upper: upper.naturalWidth ? upper : undefined,
      garden: garden.naturalWidth ? garden : undefined,
      rightLeaves: rightLeaves.naturalWidth ? rightLeaves : undefined,
      cornerTrees: cornerTrees.naturalWidth ? cornerTrees : undefined,
      easelClear: easelClear.naturalWidth ? easelClear : undefined,
      neighborhood: neighborhood.naturalWidth ? neighborhood : undefined,
      landscapeNeighborhood: landscapeNeighborhood.naturalWidth ? landscapeNeighborhood : undefined,
    });
    const resize = () => {
      if (!artReady) return;
      const {width,height} = dimensions.current;
      setStillReady(paintStorefrontStill(still.current!,image,loadedSources(),width,height));
      motion?.resize(width,height);motion?.draw(elapsed,0);
    };
    refresh.current = resize;
    const stop = () => { cancelAnimationFrame(frame); frame = 0; previous = 0; };
    const tick = (now: number) => {
      frame = 0;
      if (disposed || contextLost || document.hidden || reduceMotion || controls.current.paused || !motion) return;
      if (previous) elapsed += Math.min(0.1, (now - previous) / 1000);
      if (now - lastPaint >= 1000 / 60) {
        const age = (Date.now() - controls.current.greeting) / 1000;
        motion.draw(elapsed, controls.current.greeting ? Math.max(0, 1 - age / 3) : 0);
        lastPaint = now - (now - lastPaint) % (1000 / 60);
      }
      previous = now;
      frame = requestAnimationFrame(tick);
    };
    const start = () => {
      stop();
      setMoving(!!motion && !contextLost && !reduceMotion);
      if (!document.hidden && !contextLost && !reduceMotion && !controls.current.paused && motion) frame = requestAnimationFrame(tick);
    };
    const preferenceChanged = (event: MediaQueryListEvent) => { reduceMotion = event.matches; start(); };
    wake.current = start;
    const lost = (event: Event) => { event.preventDefault(); contextLost = true; stop(); setMoving(false); };
    const restored = () => {
      contextLost = false;
      motion?.dispose();
      motion = createStorefrontMotion(element, image, loadedSources());
      resize(); start();
    };
    const ready = () => {
      if (disposed) return;
      if (!image.complete || !image.naturalWidth || ![backdrop, cats, foreground, armSheet, foliage,courtyard,upper,garden,rightLeaves,cornerTrees,easelClear,neighborhood,landscapeNeighborhood].every(i => i.complete)) return;
      if (artReady) return;
      artReady = true;
      motion = createStorefrontMotion(element, image, loadedSources());
      resize(); start();
    };
    for (const asset of [image,backdrop,cats,foreground,armSheet,foliage,courtyard,upper,garden,rightLeaves,cornerTrees,easelClear,neighborhood,landscapeNeighborhood]) {asset.onload = ready; asset.onerror = ready;}
    image.src = String(painting);
    backdrop.src = String(backdropImage); cats.src = String(catsImage);
    foreground.src = String(foregroundImage); armSheet.src = String(armSheetImage);
    foliage.src = String(foliageLayer);
    courtyard.src = String(courtyardImage);
    upper.src = String(upperImage);
    garden.src = String(gardenImage);
    rightLeaves.src = String(rightLeavesImage);
    cornerTrees.src = String(cornerTreesImage);
    easelClear.src = String(easelClearImage);
    neighborhood.src = String(neighborhoodImage);
    landscapeNeighborhood.src = String(landscapeNeighborhoodImage);
    reduced.addEventListener('change', preferenceChanged);
    document.addEventListener('visibilitychange', start);
    element.addEventListener('webglcontextlost', lost);
    element.addEventListener('webglcontextrestored', restored);
    return () => {
      disposed = true; stop(); for (const asset of [image,backdrop,cats,foreground,armSheet,foliage,courtyard,upper,garden,rightLeaves,cornerTrees,easelClear,neighborhood,landscapeNeighborhood]) {asset.onload = null; asset.onerror = null;}
      reduced.removeEventListener('change', preferenceChanged);
      document.removeEventListener('visibilitychange', start);
      element.removeEventListener('webglcontextlost', lost);
      element.removeEventListener('webglcontextrestored', restored);
      motion?.dispose();
      wake.current = () => {};
      refresh.current = () => {};
    };
  }, []);
  useEffect(() => {refresh.current();},[width,height]);
  useEffect(() => { wake.current(); }, [paused]);
  const layout = storefrontLayout(width,height),leftLamp = storefrontBox(layout,'lamp-left',{x: 0,y: 0,w: 1672,h: 941});
  const cabinet = storefrontBox(layout,'case',{x: 0,y: 0,w: 1672,h: 941});
  const entry = storefrontBox(layout,'door',{x: 0,y: 0,w: 1672,h: 941});
  const rightLamp = storefrontBox(layout,'lamp-right',{x: 0,y: 0,w: 1672,h: 941});
  const snoozeRight = storefrontBox(layout,'sleep-right',{x: 1470,y: 485,w: 1,h: 1});
  const snoozeLeft = storefrontBox(layout,'sleep-left',{x: 186,y: 762,w: 1,h: 1});
  return (
    <div class={`storefront-painting ${moving ? 'is-moving' : ''} ${stillReady ? 'has-still' : ''}`}
      style={{ backgroundImage: `url(${String(courtyardImage)})` }} aria-hidden="true">
      <img src={String(layout.portrait ? neighborhoodImage : landscapeNeighborhoodImage)} alt="" draggable={false} />
      <canvas ref={still} class="storefront-still" />
      <canvas ref={canvas} class="storefront-motion" />
      <div class="storefront-ambience" style={leftLamp}>
        <div class="storefront-lamp lamp-left" />
      </div>
      <div class="storefront-ambience" style={rightLamp}><div class="storefront-lamp lamp-right" /></div>
      <div class="storefront-ambience" style={cabinet}><div class="storefront-glass"><i /></div></div>
      <div class="storefront-ambience" style={entry}><div class="storefront-door-light" /></div>
      <div class="storefront-snooze snooze-one" style={{left: snoozeRight.left,top: snoozeRight.top}}>z</div>
      <div class="storefront-snooze snooze-two" style={{left: snoozeRight.left,top: snoozeRight.top}}>z</div>
      <div class="storefront-snooze snooze-three" style={{left: snoozeLeft.left,top: snoozeLeft.top}}>z</div>
      <div class="storefront-dust">
        {Array.from({ length: 15 }, (_, i) => (
          <i key={i} style={{ left: `${25 + (i * 17) % 54}%`, top: `${34 + (i * 13) % 48}%`,
            '--delay': `${-i * .73}s`, '--duration': `${3.3 + (i % 5) * .55}s` }} />
        ))}
      </div>
      {[0, 1, 2, 3, 4].map((i) => (
        <svg key={i} class={`storefront-leaf leaf-${i}`} viewBox="0 0 26 38">
          <path d="M4 34C-5 14 7 1 24 1c5 19-1 33-20 33Z" fill={i === 1 ? '#B8BD56' : '#CFCC70'} />
          <path d="M4 34 20 7" fill="none" stroke="#969E43" stroke-width="1.5" />
        </svg>
      ))}
    </div>
  );
}
