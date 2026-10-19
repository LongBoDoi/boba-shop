/// <reference types="vite/client" />

/**
 * Which build this is: the commit it was built from in CI, a timestamp locally. `vite.config.ts`
 * defines it and writes the same value into `dist/update.json`, which is how an installed app
 * knows whether the site is serving something it has not got. See `src/updates/`.
 */
declare const __WEB_BUILD__: string;
