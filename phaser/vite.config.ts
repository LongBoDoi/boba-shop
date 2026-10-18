import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import preact from '@preact/preset-vite';
import { defineConfig, Plugin } from 'vite';

const here = (path: string) => fileURLToPath(new URL(path, import.meta.url));

/**
 * The shared code in `../src` names its artwork and sounds the way Metro wants them —
 * `require('../../assets/kitchen/cup.png')`, which Metro turns into an asset id. Vite has no
 * `require`, so each one becomes an imported URL instead. The geometry around those calls is the
 * same file either build reads, which is the point: a sprite measured once is placed the same way
 * by both.
 */
function metroAssets(): Plugin {
  const ASSET = /require\(\s*(['"])([^'"]+\.(?:png|jpe?g|wav|mp3|m4a|ttf))\1\s*\)/g;
  return {
    name: 'metro-assets',
    enforce: 'pre',
    transform(code, id) {
      if (id.includes('node_modules') || !/\.(ts|tsx)$/.test(id) || !ASSET.test(code)) return null;
      ASSET.lastIndex = 0;
      const imports: string[] = [];
      const out = code.replace(ASSET, (_match, _quote, path: string) => {
        const name = `__asset${imports.length}`;
        imports.push(`import ${name} from ${JSON.stringify(path)};`);
        return name;
      });
      return { code: `${imports.join('\n')}\n${out}`, map: null };
    },
  };
}

/**
 * What makes the page installable — the manifest, its icons and the offline worker — is the same
 * set of files the Expo build ships from `../public`, served and emitted from there rather than
 * copied. (`../public` also holds the Expo page template, which is why it is not simply the
 * `publicDir`: Vite would ship that `index.html` over its own.)
 */
function sharedPublic(): Plugin {
  const root = here('../public');
  const files = ['manifest.webmanifest', 'sw.js', ...readdirSync(join(root, 'icons')).map((name) => `icons/${name}`)];
  const TYPES: Record<string, string> = { webmanifest: 'application/manifest+json', js: 'text/javascript', png: 'image/png' };
  return {
    name: 'shared-public',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const path = (req.url ?? '').split('?')[0].replace(/^[/]/, '');
        if (!files.includes(path)) return next();
        res.setHeader('Content-Type', TYPES[path.split('.').pop() ?? ''] ?? 'application/octet-stream');
        res.end(readFileSync(join(root, path)));
      });
    },
    generateBundle() {
      for (const fileName of files) this.emitFile({ type: 'asset', fileName, source: readFileSync(join(root, fileName)) });
    },
  };
}

export default defineConfig({
  publicDir: false,
  plugins: [metroAssets(), sharedPublic(), preact()],
  resolve: {
    alias: {
      // The shared sound engine was written against Expo; these are the slivers of those packages
      // it touches, done the browser's way. See each file.
      'expo-asset': here('./src/shims/expo-asset.ts'),
      'expo-audio': here('./src/shims/expo-audio.ts'),
      'react-native': here('./src/shims/react-native.ts'),
    },
  },
  server: {
    fs: { allow: [here('..')] },
  },
  build: {
    target: 'es2022',
    assetsInlineLimit: 0,
    chunkSizeWarningLimit: 2000,
  },
});
