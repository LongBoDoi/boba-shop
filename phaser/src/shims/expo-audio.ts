/**
 * The shared audio engine only reaches for `expo-audio` where there is no Web Audio, and every
 * browser this game supports has it. What remains is the session setup, which a browser does not
 * have, so it does nothing.
 */
export async function setAudioModeAsync(_options: unknown): Promise<void> {}

export function createAudioPlayer(_source?: unknown, _options?: unknown): never {
  throw new Error('expo-audio is not available in the browser build; Web Audio is used instead.');
}
