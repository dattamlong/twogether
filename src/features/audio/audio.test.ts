import { beforeEach, describe, expect, it } from "vitest";
import { areaTrack, categoryForPath, nextInCategory, stepTrack, timeOfDay, TRACKS, tracksIn } from "./manifest";
import { parseChord, parseMelody, rhythmHits, validateSong, voice } from "./sequencer";
import { SONGS, songById } from "./songs";
import { DEFAULT_SETTINGS, useAudioSettings } from "./store";
import { desiredTrack, pinTrack, skipTrack } from "./use-audio-director";

describe("soundtrack catalog", () => {
  it("has a valid composition behind every composed track", () => {
    for (const track of TRACKS.filter((t) => t.source.kind === "composed")) {
      const song = songById(track.id);
      expect(song, track.id).not.toBeNull();
      expect(validateSong(song!)).toBe(true);
    }
    expect(SONGS.map((s) => s.id).sort()).toEqual(TRACKS.filter((t) => t.source.kind === "composed").map((t) => t.id).sort());
  });

  it("gives every area its own collection and every home time slot a song", () => {
    for (const category of ["home", "learning", "games", "world", "legends"] as const) expect(tracksIn(category).length).toBeGreaterThanOrEqual(3);
    for (const hour of [6, 13, 19, 2]) expect(areaTrack("home", hour).timeOfDay).toBe(timeOfDay(hour));
  });
});

describe("music theory helpers", () => {
  it("parses chords relative to the key", () => {
    expect(parseChord("Imaj7")).toEqual({ root: 0, intervals: [0, 4, 7, 11] });
    expect(parseChord("vi7")).toEqual({ root: 9, intervals: [0, 3, 7, 10] });
    expect(parseChord("bVII")).toEqual({ root: 10, intervals: [0, 4, 7] });
    expect(parseChord("V7sus4")).toEqual({ root: 7, intervals: [0, 5, 7, 10] });
    expect(() => parseChord("X")).toThrow();
  });

  it("voices chords inside a one-octave window around the center", () => {
    const tones = voice(60, parseChord("IVmaj7"), 64);
    expect(tones.every((n) => n >= 58 && n < 70)).toBe(true);
    expect(tones.map((n) => n % 12).sort()).toEqual([0, 4, 5, 9]);
  });

  it("reads melody degrees, octaves, holds and rests", () => {
    const steps = parseMelody("1 - 3' . 7, #7", 60, "minor");
    expect(steps).toEqual([
      { kind: "note", midi: 60 },
      { kind: "hold" },
      { kind: "note", midi: 75 },
      { kind: "rest" },
      { kind: "note", midi: 58 },
      { kind: "note", midi: 71 },
    ]);
  });

  it("turns rhythm strings into hits with sustained lengths", () => {
    expect(rhythmHits("x--x.o--", 0.5)).toEqual([
      { at: 0, dur: 1.5, velocity: 1 },
      { at: 1.5, dur: 0.5, velocity: 1 },
      { at: 2.5, dur: 1.5, velocity: 0.55 },
    ]);
  });
});

describe("music direction", () => {
  beforeEach(() => {
    localStorage.clear();
    useAudioSettings.setState({ ...DEFAULT_SETTINGS, musicOn: true });
  });

  it("maps routes to their musical area", () => {
    expect(categoryForPath("/home")).toBe("home");
    expect(categoryForPath("/learn/world/english")).toBe("learning");
    expect(categoryForPath("/games/word-battle")).toBe("games");
    expect(categoryForPath("/world/duel/abc")).toBe("games");
    expect(categoryForPath("/world")).toBe("world");
    expect(categoryForPath("/legends")).toBe("legends");
    expect(categoryForPath("/profile")).toBeNull();
  });

  it("follows the area, keeps the current song inside it, and stays put on neutral pages", () => {
    const learning = desiredTrack("/learn", null, 13);
    expect(tracksIn("learning").map((t) => t.id)).toContain(learning);
    const next = nextInCategory(learning!).id;
    expect(desiredTrack("/learn/review", next, 13)).toBe(next);
    expect(desiredTrack("/profile", next, 13)).toBe(next);
    expect(desiredTrack("/home", next, 19)).toBe("home-with-you");
  });

  it("respects a song the player picked and plays nothing when music is off", () => {
    pinTrack("golden-hearts");
    expect(useAudioSettings.getState()).toMatchObject({ autoMusic: false, pinnedTrack: "golden-hearts" });
    expect(desiredTrack("/learn", "little-steps")).toBe("golden-hearts");
    skipTrack(1);
    expect(useAudioSettings.getState().pinnedTrack).toBe(stepTrack("golden-hearts", 1).id);
    useAudioSettings.getState().set({ musicOn: false });
    expect(desiredTrack("/home", null)).toBeNull();
  });

  it("persists volumes and clamps them", () => {
    useAudioSettings.getState().setVolume("music", 1.7);
    useAudioSettings.getState().setVolume("ambient", 0.25);
    const saved = JSON.parse(localStorage.getItem("twogether:audio")!).state;
    expect(saved).toMatchObject({ musicVolume: 1, ambientVolume: 0.25, musicOn: true });
    expect(saved.set).toBeUndefined();
  });
});
