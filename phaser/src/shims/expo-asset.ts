/**
 * `webAudio.ts` asks expo-asset for the URL of a sound module. Under Vite the "module" already is
 * that URL (see the `metroAssets` plugin), so this hands it straight back.
 */
export const Asset = {
  fromModule(module: number | string) {
    return { uri: String(module) };
  },
};
