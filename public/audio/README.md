# TWOGETHER audio assets

Every song and ambient sound that ships today is an original composition generated live in the
browser by the Web Audio engine in `src/features/audio/` (`songs.ts`, `ambient.ts`, `src/lib/sfx.ts`).
No audio files are required, and no third-party recordings are bundled.

## Adding recorded tracks

Recorded music can be added alongside the composed soundtrack:

1. Put compressed web audio (`.mp3`, `.m4a` or `.ogg`, ideally 96–160 kbps) in a category folder:
   `public/audio/music/{home,learning,games,world,legends}/`.
2. Register each file in `FILE_TRACKS` in `src/features/audio/manifest.ts`:

   ```ts
   {
     id: "our-little-world-recorded",
     name: "Our Little World (Piano)",
     category: "home",
     mood: "Recorded piano",
     source: { kind: "file", src: "/audio/music/home/our-little-world.mp3", durationSec: 182 },
     loop: false,
     license: "CC BY 4.0 — Artist Name, https://example.com/track",
   }
   ```

3. Only add music you own or that is licensed for this use, and keep any attribution the license
   requires in the `license` field.

Files are streamed on demand, never preloaded. A file that fails to load is skipped automatically and
the player moves on to the next song in the same category.
