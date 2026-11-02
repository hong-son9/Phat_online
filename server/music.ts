import fs from 'fs';
import path from 'path';

// Background music: three tracks generated in the browser (no files, no copyright questions),
// plus any .mp3/.ogg/.m4a the owner drops into the music/ folder.

export const MUSIC_DIR = path.join(process.cwd(), 'music');
export const BUILTIN_TRACKS = ['builtin:calm', 'builtin:bowls', 'builtin:rain'];

let cached: { at: number; list: string[] } = { at: 0, list: [] };

export function listMusic(): string[] {
  if (Date.now() - cached.at < 10000) return cached.list;
  let files: string[] = [];
  try {
    files = fs
      .readdirSync(MUSIC_DIR)
      .filter((f) => /\.(mp3|ogg|m4a|wav)$/i.test(f))
      .sort()
      .map((f) => `file:${f}`);
  } catch {
    // no music folder yet
  }
  cached = { at: Date.now(), list: [...BUILTIN_TRACKS, ...files] };
  return cached.list;
}
