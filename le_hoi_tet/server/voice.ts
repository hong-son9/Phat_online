import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts';
import type { VoiceItem, VoiceKind } from '../shared/types';
import { broadcast, hasAudioStage, onAudioStageChange, sendToAudioStage } from './hub';

// ---------- Speech synthesis (Microsoft Edge neural voices, Google Translate as fallback) ----------

export const VOICES = [
  { id: 'vi-VN-HoaiMyNeural', label: 'Hoài My (nữ, nhẹ nhàng)' },
  { id: 'vi-VN-NamMinhNeural', label: 'Nam Minh (nam, trầm ấm)' },
];

type VoiceConfig = { name: string; rate: number; pitch: number };

const escapeXml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const pct = (n: number) => `${n >= 0 ? '+' : ''}${Math.round(n)}%`;

async function edgeTts(text: string, v: VoiceConfig): Promise<Buffer> {
  const tts = new MsEdgeTTS();
  try {
    await tts.setMetadata(v.name, OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3);
    const { audioStream } = tts.toStream(escapeXml(text), { rate: pct((v.rate - 1) * 100), pitch: pct(v.pitch) });
    const chunks: Buffer[] = [];
    const read = (async () => {
      for await (const c of audioStream) chunks.push(c as Buffer);
    })();
    const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('Edge TTS timeout')), 15000));
    await Promise.race([read, timeout]);
    if (!chunks.length) throw new Error('Edge TTS trả về rỗng');
    return Buffer.concat(chunks);
  } finally {
    tts.close();
  }
}

// Google caps a request near 200 characters: split at sentence, comma or space boundaries
function splitText(text: string, max = 190): string[] {
  const out: string[] = [];
  let rest = text.trim();
  while (rest.length > max) {
    const win = rest.slice(0, max + 1);
    let cut = Math.max(win.lastIndexOf('. '), win.lastIndexOf('! '), win.lastIndexOf('? '));
    if (cut < max / 2) cut = Math.max(win.lastIndexOf(', '), win.lastIndexOf('; '));
    if (cut < max / 2) cut = win.lastIndexOf(' ');
    if (cut <= 0) cut = max - 1;
    out.push(rest.slice(0, cut + 1).trim());
    rest = rest.slice(cut + 1).trim();
  }
  if (rest) out.push(rest);
  return out;
}

async function googleTts(text: string): Promise<Buffer> {
  const parts: Buffer[] = [];
  for (const chunk of splitText(text)) {
    const url = `https://translate.google.com/translate_tts?ie=UTF-8&tl=vi&client=tw-ob&q=${encodeURIComponent(chunk)}`;
    const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0', Referer: 'https://translate.google.com/' } });
    if (!r.ok) throw new Error(`Google TTS ${r.status}`);
    parts.push(Buffer.from(await r.arrayBuffer()));
  }
  return Buffer.concat(parts);
}

const cache = new Map<string, Promise<Buffer>>();

// Edge drops streams when asked for many lines at once: at most 2 in flight, the rest wait their turn
let inFlight = 0;
const waiting: Array<() => void> = [];
async function limited<T>(fn: () => Promise<T>): Promise<T> {
  if (inFlight >= 2) await new Promise<void>((r) => waiting.push(r));
  inFlight++;
  try {
    return await fn();
  } finally {
    inFlight--;
    waiting.shift()?.();
  }
}

export function synthesize(text: string, v: VoiceConfig): Promise<Buffer> {
  const key = `${v.name}|${v.rate}|${v.pitch}|${text}`;
  let p = cache.get(key);
  if (!p) {
    // Edge drops roughly one stream in ten at random: try three times before switching voices
    p = limited(() => edgeTts(text, v).catch(() => edgeTts(text, v)).catch(() => edgeTts(text, v))).catch((err) => {
      console.warn('[Giọng đọc] Edge lỗi, chuyển sang Google:', err instanceof Error ? err.message : err);
      return googleTts(text);
    });
    p.catch(() => cache.delete(key));
    cache.set(key, p);
    if (cache.size > 300) cache.delete(cache.keys().next().value!);
  }
  return p;
}

// ---------- Voice queue ----------
// Lines wait here; the one stage page that makes sound plays them one by one and reports back.
// Priority lines (gift thanks, "Đọc ngay") go ahead of everything else.

const MAX_QUEUE = 30;
const STALE_MS = 3 * 60 * 1000; // ordinary lines nobody got to within 3 minutes are dropped

let voiceConfig: VoiceConfig = { name: VOICES[0].id, rate: 1, pitch: 0 };
let queue: VoiceItem[] = [];
let current: VoiceItem | null = null;
let paused = false;
let lastEndedAt = Date.now();
let seq = 0;
let watchdog: NodeJS.Timeout | null = null;
const itemConfig = new Map<string, VoiceConfig>(); // item id -> the voice it was synthesized with
let onChange: () => void = () => {};

export function setVoiceConfig(v: VoiceConfig) {
  voiceConfig = { name: v.name, rate: v.rate, pitch: v.pitch };
}

export function onVoiceChange(fn: () => void) {
  onChange = fn;
}

export function voiceState() {
  return { current, queue: [...queue], paused };
}

export function enqueue(text: string, kind: VoiceKind, priority = false): VoiceItem | null {
  const clean = text.replace(/\s+/g, ' ').trim().slice(0, 600);
  if (!clean) return null;
  const item: VoiceItem = { id: `v${Date.now().toString(36)}${++seq}`, text: clean, kind, priority, createdAt: Date.now() };
  itemConfig.set(item.id, { ...voiceConfig });
  if (priority) {
    // after the other priority lines, ahead of the ordinary ones
    const i = queue.findIndex((q) => !q.priority);
    queue.splice(i === -1 ? queue.length : i, 0, item);
  } else {
    queue.push(item);
  }
  // Overflow: drop the oldest ordinary lines first
  while (queue.length > MAX_QUEUE) {
    const i = queue.findIndex((q) => !q.priority);
    queue.splice(i === -1 ? 0 : i, 1);
  }
  // Warm the cache for the next couple of lines so playback has no gap
  queue.slice(0, 3).forEach((q) => synthesize(q.text, itemConfig.get(q.id)!).catch(() => {}));
  pump();
  onChange();
  return item;
}

// Ordinary lines waiting (not counting priority lines or the one playing)
export function waitingCount() {
  return queue.filter((q) => !q.priority).length;
}

export function quietForMs() {
  if (current || queue.length) return 0;
  return Date.now() - lastEndedAt;
}

export function audioFor(id: string): Promise<Buffer> | null {
  const item = current?.id === id ? current : queue.find((q) => q.id === id);
  const cfg = itemConfig.get(id);
  if (!item || !cfg) return null;
  return synthesize(item.text, cfg);
}

function pump() {
  if (current || paused || !queue.length || !hasAudioStage()) return;
  const now = Date.now();
  queue = queue.filter((q) => q.priority || now - q.createdAt < STALE_MS);
  const next = queue.shift();
  if (!next) return;
  current = next;
  sendToAudioStage('voice:play', { id: next.id, text: next.text, url: `/api/tts/item/${next.id}` });
  armWatchdog(next);
  // prefetch what comes after
  queue.slice(0, 2).forEach((q) => synthesize(q.text, itemConfig.get(q.id)!).catch(() => {}));
  onChange();
}

function armWatchdog(item: VoiceItem) {
  if (watchdog) clearTimeout(watchdog);
  // A line can't take longer than ~0.12 s per character plus synthesis time; if the stage never reports back, move on
  watchdog = setTimeout(() => {
    if (current?.id === item.id) finish(item.id);
  }, 20000 + item.text.length * 120);
}

function finish(id: string) {
  if (current?.id !== id) return;
  itemConfig.delete(id);
  current = null;
  lastEndedAt = Date.now();
  if (watchdog) clearTimeout(watchdog);
  onChange();
  setTimeout(pump, 350);
}

export function reportStarted(id: string) {
  if (current?.id !== id) return;
  current = { ...current, startedAt: Date.now() };
  broadcast('voice:started', { id });
  onChange();
}

export function reportEnded(id: string) {
  finish(id);
}

export function skip() {
  if (!current) return;
  sendToAudioStage('voice:stop', { id: current.id });
  finish(current.id);
}

export function clearQueue() {
  queue.forEach((q) => itemConfig.delete(q.id));
  queue = [];
  onChange();
}

export function removeItem(id: string) {
  queue = queue.filter((q) => q.id !== id);
  itemConfig.delete(id);
  onChange();
}

export function setPaused(p: boolean) {
  paused = p;
  if (!p) pump();
  onChange();
}

// When the sound-making stage page changes (reload, closed), replay the interrupted line on the new one
onAudioStageChange(() => {
  if (current) {
    const interrupted = current;
    current = null;
    if (watchdog) clearTimeout(watchdog);
    queue.unshift({ ...interrupted, startedAt: undefined, priority: true });
  }
  pump();
  onChange();
});
