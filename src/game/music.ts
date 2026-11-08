// Generated chapter catalogue. No browser APIs or asset imports: safe in saves and Node checks.
export const MUSIC_TRACKS = [
  {
    "id": "clear-skies",
    "number": 1,
    "title": "Clear Skies",
    "start": 0,
    "duration": 210
  },
  {
    "id": "keep-it-upbeat",
    "number": 2,
    "title": "Keep It Upbeat",
    "start": 210,
    "duration": 253
  },
  {
    "id": "the-wheel",
    "number": 3,
    "title": "The Wheel",
    "start": 463,
    "duration": 221
  },
  {
    "id": "morning-music",
    "number": 4,
    "title": "Morning Music",
    "start": 684,
    "duration": 276
  },
  {
    "id": "dont-quit",
    "number": 5,
    "title": "Don’t Quit",
    "start": 960,
    "duration": 210
  },
  {
    "id": "keep-rolling",
    "number": 6,
    "title": "Keep Rolling",
    "start": 1170,
    "duration": 271
  },
  {
    "id": "laid-back",
    "number": 7,
    "title": "Laid Back",
    "start": 1441,
    "duration": 209
  },
  {
    "id": "pick-me-up",
    "number": 8,
    "title": "Pick Me Up",
    "start": 1650,
    "duration": 206
  },
  {
    "id": "things-are-good",
    "number": 9,
    "title": "Things Are Good",
    "start": 1856,
    "duration": 248
  },
  {
    "id": "celebrate-the-wins",
    "number": 10,
    "title": "Celebrate the Wins",
    "start": 2104,
    "duration": 220
  },
  {
    "id": "youve-got-this",
    "number": 11,
    "title": "You’ve Got This",
    "start": 2324,
    "duration": 257
  },
  {
    "id": "take-a-break",
    "number": 12,
    "title": "Take a Break",
    "start": 2581,
    "duration": 165
  },
  {
    "id": "reflection",
    "number": 13,
    "title": "Reflection",
    "start": 2746,
    "duration": 257
  },
  {
    "id": "awakening",
    "number": 14,
    "title": "Awakening",
    "start": 3003,
    "duration": 295
  },
  {
    "id": "triumphant",
    "number": 15,
    "title": "Triumphant",
    "start": 3298,
    "duration": 246
  },
  {
    "id": "its-alright",
    "number": 16,
    "title": "It’s Alright",
    "start": 3544,
    "duration": 270
  },
  {
    "id": "good-times",
    "number": 17,
    "title": "Good Times",
    "start": 3814,
    "duration": 272
  },
  {
    "id": "yes",
    "number": 18,
    "title": "Yes!",
    "start": 4086,
    "duration": 223
  },
  {
    "id": "sunset-vibes",
    "number": 19,
    "title": "Sunset Vibes",
    "start": 4309,
    "duration": 271
  },
  {
    "id": "helpful-people",
    "number": 20,
    "title": "Helpful People",
    "start": 4580,
    "duration": 230
  },
  {
    "id": "nod-to-kg",
    "number": 21,
    "title": "Nod to KG",
    "start": 4810,
    "duration": 276
  },
  {
    "id": "build-up",
    "number": 22,
    "title": "Build Up",
    "start": 5086,
    "duration": 242
  },
  {
    "id": "lift-off",
    "number": 23,
    "title": "Lift Off",
    "start": 5328,
    "duration": 201
  },
  {
    "id": "strollin",
    "number": 24,
    "title": "Strollin’",
    "start": 5529,
    "duration": 208
  },
  {
    "id": "victory",
    "number": 25,
    "title": "Victory",
    "start": 5737,
    "duration": 224
  },
  {
    "id": "moving-forward",
    "number": 26,
    "title": "Moving Forward",
    "start": 5961,
    "duration": 243
  },
  {
    "id": "figuring-things-out",
    "number": 27,
    "title": "Figuring Things Out",
    "start": 6204,
    "duration": 255
  },
  {
    "id": "time-out",
    "number": 28,
    "title": "Time Out",
    "start": 6459,
    "duration": 277
  },
  {
    "id": "struttin",
    "number": 29,
    "title": "Struttin’",
    "start": 6736,
    "duration": 249
  },
  {
    "id": "goodbye-for-now",
    "number": 30,
    "title": "Goodbye for Now",
    "start": 6985,
    "duration": 238
  }
] as const;

export type MusicTrackId = typeof MUSIC_TRACKS[number]['id'];
export type MusicChoice = MusicTrackId | 'cycle' | 'shuffle';
export function isMusicChoice(value: unknown): value is MusicChoice {
  return value === 'cycle' || value === 'shuffle' || MUSIC_TRACKS.some((track) => track.id === value);
}
