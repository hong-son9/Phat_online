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

// Attribution for CC BY tracks, from music/credits.json ({ "file.mp3": "Title – Author · License" })
let credits: { at: number; map: Record<string, string> } = { at: 0, map: {} };

export function musicCredit(track: string): string {
  if (!track.startsWith('file:')) return '';
  if (Date.now() - credits.at > 10000) {
    let map: Record<string, string> = {};
    try {
      map = JSON.parse(fs.readFileSync(path.join(MUSIC_DIR, 'credits.json'), 'utf8'));
    } catch {
      // no credits file, or it is being edited
    }
    credits = { at: Date.now(), map };
  }
  return String(credits.map[track.slice(5)] ?? '').slice(0, 160);
}
