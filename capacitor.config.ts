import type { CapacitorConfig } from '@capacitor/cli';

/**
 * The phone apps: the same web build (`dist/`), in a native shell.
 *
 * **The app id is not the one the old React Native app used** (`com.manhlong.bobashop`), and it
 * cannot be: Android only installs a build over another with the same id *and* the same signing
 * key, and that key belongs to the build service that made the old app. So this installs beside
 * it, and a player moves their shop across with the backup code in the settings card. Everyone
 * who installed the Phaser preview keeps their shop, because for them the id has not changed.
 */
const config: CapacitorConfig = {
  appId: 'com.manhlong.bobashop.phaser',
  appName: 'Tiệm Trà Sữa',
  webDir: 'dist',
  backgroundColor: '#FFE3EC',
  plugins: {
    // The page already lays itself out inside `env(safe-area-inset-*)` with `viewport-fit=cover`.
    SystemBars: { insetsHandling: 'native', initialViewportFitValueHint: 'cover' },
  },
};

export default config;
