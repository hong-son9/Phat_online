import fs from 'fs';
import path from 'path';
import type { Settings } from '../shared/types';

export const DATA_DIR = path.join(process.cwd(), 'data');
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');
const SESSION_FILE = path.join(DATA_DIR, 'session.json');

export const DEFAULT_SETTINGS: Settings = {
  channelName: 'An Nhiên',
  subtitle: 'Không gian thư giãn · Gõ adidaphat để thắp hương',
  tiktokUsername: '',
  autoReconnect: true,
  keywords: ['adidaphat'],
  likeGoal: 666,
  rainSeconds: 60,
  pointsPerComment: 1,
  pointsPerCoin: 10,
  voice: { name: 'vi-VN-HoaiMyNeural', rate: 0.95, pitch: 0, volume: 1 },
  read: {
    gifts: true,
    joins: true,
    wishes: true,
    follows: true,
    shares: true,
    likeGoal: true,
    idle: true,
    shareReminder: true,
  },
  idleSeconds: 90,
  shareReminderMinutes: 6,
  audio: { music: true, musicTrack: 'builtin:calm', musicVolume: 0.35, sfx: true, sfxVolume: 0.7 },
  graphics: { quality: 'high', captions: true, disclaimer: true, hints: true, theme: 'dusk' },
  bannedWords: [],
  blockedUsers: [],
  setupDone: false,
};

function ensureDir() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Merge saved values over the defaults so settings added in a later version get their default
function merge<T>(base: T, saved: unknown): T {
  if (Array.isArray(base)) return Array.isArray(saved) ? (saved as T) : base;
  if (typeof base !== 'object' || base === null) {
    return saved !== undefined && typeof saved === typeof base ? (saved as T) : base;
  }
  const out = { ...base } as Record<string, unknown>;
  const src = (saved && typeof saved === 'object' ? saved : {}) as Record<string, unknown>;
  for (const k of Object.keys(out)) out[k] = merge(out[k], src[k]);
  return out as T;
}

export function loadSettings(): Settings {
  try {
    return merge(DEFAULT_SETTINGS, JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8')));
  } catch {
    return structuredClone(DEFAULT_SETTINGS);
  }
}

// Partial update from the dashboard, validated against the default shape
export function applySettingsPatch(current: Settings, patch: unknown): Settings {
  const next = merge(current, merge(current, patch));
  next.channelName = next.channelName.replace(/[\x00-\x1f\x7f]/g, '').trim().slice(0, 40) || current.channelName;
  next.subtitle = next.subtitle.replace(/[\x00-\x1f\x7f]/g, '').trim().slice(0, 80);
  next.tiktokUsername = next.tiktokUsername.replace(/^@/, '').trim().slice(0, 40);
  next.keywords = next.keywords.map((k) => String(k).trim()).filter(Boolean).slice(0, 10);
  if (!next.keywords.length) next.keywords = ['adidaphat'];
  next.likeGoal = clamp(Math.round(next.likeGoal), 10, 100000);
  next.rainSeconds = clamp(Math.round(next.rainSeconds), 10, 600);
  next.pointsPerComment = clamp(Math.round(next.pointsPerComment), 0, 100);
  next.pointsPerCoin = clamp(Math.round(next.pointsPerCoin), 0, 1000);
  next.voice.rate = clamp(next.voice.rate, 0.6, 1.4);
  next.voice.pitch = clamp(Math.round(next.voice.pitch), -20, 20);
  next.voice.volume = clamp(next.voice.volume, 0, 1);
  next.idleSeconds = clamp(Math.round(next.idleSeconds), 30, 900);
  next.shareReminderMinutes = clamp(Math.round(next.shareReminderMinutes), 2, 60);
  next.audio.musicVolume = clamp(next.audio.musicVolume, 0, 1);
  next.audio.sfxVolume = clamp(next.audio.sfxVolume, 0, 1);
  if (!['low', 'medium', 'high'].includes(next.graphics.quality)) next.graphics.quality = 'high';
  if (!['dusk', 'night'].includes(next.graphics.theme)) next.graphics.theme = 'dusk';
  next.bannedWords = next.bannedWords.map((w) => String(w).trim()).filter(Boolean).slice(0, 300);
  next.blockedUsers = [...new Set(next.blockedUsers.map((w) => String(w).trim().toLowerCase()).filter(Boolean))].slice(0, 500);
  return next;
}

const clamp = (v: number, lo: number, hi: number) => (Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : lo);

export function saveSettings(s: Settings) {
  try {
    ensureDir();
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(s, null, 2));
  } catch (err) {
    console.error('Không lưu được settings.json:', err);
  }
}

// The session (leaderboard, hall, stats) survives an app restart for a few hours
const SESSION_MAX_AGE = 6 * 60 * 60 * 1000;

export function loadSession<T>(): T | null {
  try {
    const raw = JSON.parse(fs.readFileSync(SESSION_FILE, 'utf8'));
    if (Date.now() - (raw.savedAt || 0) > SESSION_MAX_AGE) return null;
    return raw.data as T;
  } catch {
    return null;
  }
}

export function saveSession(data: unknown) {
  try {
    ensureDir();
    fs.writeFileSync(SESSION_FILE, JSON.stringify({ savedAt: Date.now(), data }));
  } catch (err) {
    console.error('Không lưu được session.json:', err);
  }
}
