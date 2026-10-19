import { readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import preact from '@preact/preset-vite';
import { defineConfig, Plugin } from 'vite';

import { NATIVE_VERSION } from './src/updates/native.ts';

/**
 * Which build this is. CI passes the commit; a local build gets a timestamp, so a phone pointed at
 * a dev machine still sees each build as a different one.
 */
const WEB_BUILD = process.env.BUILD_ID?.trim() || `local-${Date.now().toString(36)}`;

const DIST = fileURLToPath(new URL('./dist', import.meta.url));

/**
 * `update.json` beside the game: what this build is, what shell it expects, and every file in it
 * with its size.
 *
 * It is what an installed app reads to find out whether the site is serving something it has not
 * got, and then which files it actually has to fetch — everything under `assets/` carries a hash
 * of its contents in its name, so same name and same size is the same file. See `src/updates/`.
 */
function updateManifest(): Plugin {
  return {
    name: 'update-manifest',
    apply: 'build',
    closeBundle() {
      const files: Record<string, number> = {};
      const walk = (directory: string) => {
        for (const entry of readdirSync(directory, { withFileTypes: true })) {
          const full = join(directory, entry.name);
          if (entry.isDirectory()) walk(full);
          else {
            const path = relative(DIST, full).split('\\').join('/');
            if (path !== 'update.json') files[path] = statSync(full).size;
          }
        }
      };
      walk(DIST);
      writeFileSync(join(DIST, 'update.json'),
        `${JSON.stringify({ webBuild: WEB_BUILD, nativeVersion: NATIVE_VERSION, files })}\n`);
    },
  };
}

export default defineConfig({
  plugins: [preact(), updateManifest()],
  define: {
    __WEB_BUILD__: JSON.stringify(WEB_BUILD),
  },
  build: {
    target: 'es2022',
    assetsInlineLimit: 0,
    chunkSizeWarningLimit: 2000,
  },
});
