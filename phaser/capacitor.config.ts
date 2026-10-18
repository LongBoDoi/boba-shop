import type { CapacitorConfig } from '@capacitor/cli';

/**
 * The phone apps of the Phaser rebuild: the same web build (`dist/`), in a native shell.
 *
 * A **separate app id** from the Expo apps (`com.manhlong.bobashop`), on purpose: this is a preview,
 * so it installs beside the current app instead of over it. The two keep separate saves; a shop is
 * moved across with the backup code in the settings card.
 */
const config: CapacitorConfig = {
  appId: 'com.manhlong.bobashop.phaser',
  appName: 'Trà Sữa (mới)',
  webDir: 'dist',
  backgroundColor: '#FFE3EC',
  plugins: {
    // The page already lays itself out inside `env(safe-area-inset-*)` with `viewport-fit=cover`.
    SystemBars: { insetsHandling: 'native', initialViewportFitValueHint: 'cover' },
  },
};

export default config;
