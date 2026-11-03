import type { Settings } from './types';

export type SceneTheme = 'dusk' | 'night';

// Which look the square has right now. "auto" follows the clock of the computer running the live:
// daytime from dayFrom until nightFrom (minutes after midnight), New Year's Eve the rest of the time.
export function themeAt(g: Settings['graphics'], date = new Date()): SceneTheme {
  if (g.theme !== 'auto') return g.theme;
  const m = date.getHours() * 60 + date.getMinutes();
  const day = g.dayFrom < g.nightFrom ? m >= g.dayFrom && m < g.nightFrom : m >= g.dayFrom || m < g.nightFrom;
  return day ? 'dusk' : 'night';
}

// 1080 -> "18:00"
export const hhmm = (minutes: number) => `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
