/// <reference types="vite/client" />

/**
 * The shared files in `../src` name their assets with Metro's `require`, typed there as a number.
 * Here the Vite plugin in `vite.config.ts` turns each into a URL string — see `asset()`.
 */
declare function require(path: string): number;
