// Types shared by the server, the dashboard and the stage page

export type Viewer = { id: string; name: string; avatar: string };

export type Quality = 'low' | 'medium' | 'high';

export type Settings = {
  channelName: string;
  subtitle: string;
  tiktokUsername: string;
  autoReconnect: boolean;
  keywords: string[]; // a comment containing one of these sends the viewer up to light incense
  likeGoal: number;
  rainSeconds: number;
  pointsPerComment: number;
  pointsPerCoin: number;
  voice: { name: string; rate: number; pitch: number; volume: number };
  read: {
    gifts: boolean;
    joins: boolean;
    wishes: boolean;
    follows: boolean;
    shares: boolean;
    likeGoal: boolean;
    idle: boolean;
    shareReminder: boolean;
  };
  idleSeconds: number;
  shareReminderMinutes: number;
  audio: { music: boolean; musicTrack: string; musicVolume: number; sfx: boolean; sfxVolume: number };
  graphics: { quality: Quality; captions: boolean; disclaimer: boolean; hints: boolean; theme: 'dusk' | 'night' };
  bannedWords: string[];
  blockedUsers: string[];
  setupDone: boolean;
};

export type LiveState = 'idle' | 'connecting' | 'connected' | 'waiting' | 'reconnecting' | 'ended' | 'error';

export type LiveStatus = {
  state: LiveState;
  username: string;
  roomId: string;
  viewers: number;
  totalLikes: number;
  error: string;
  since: number; // when the current state started
  nextRetryAt: number; // 0 = no retry planned
};

export type HallSeat = { seat: number; id: string; name: string; avatar: string; vip: boolean };

export type TopEntry = { id: string; name: string; avatar: string; points: number; coins: number; comments: number };

export type Offer = { id: string; viewerId: string; name: string; avatar: string; slot: number; startedAt: number; gift: boolean };

export type Spotlight = {
  id: string;
  viewerId: string;
  name: string;
  avatar: string;
  giftName: string;
  count: number;
  coins: number;
  startedAt: number;
  durationMs: number;
};

export type VoiceKind = 'gift' | 'join' | 'wish' | 'follow' | 'share' | 'like' | 'idle' | 'reminder' | 'manual' | 'system';

export type VoiceItem = {
  id: string;
  text: string;
  kind: VoiceKind;
  priority: boolean;
  createdAt: number;
  startedAt?: number;
};

export type Stats = {
  sessionStart: number;
  comments: number;
  gifts: number;
  coins: number;
  joins: number;
  follows: number;
  shares: number;
  offers: number;
  rains: number;
  peakViewers: number;
};

export type Snapshot = {
  settings: Settings;
  live: LiveStatus;
  stats: Stats;
  hall: HallSeat[];
  top: TopEntry[];
  offers: Offer[];
  offerQueue: Viewer[];
  spotlight: Spotlight | null;
  likes: { progress: number; goal: number; rainUntil: number };
  voice: { current: VoiceItem | null; queue: VoiceItem[]; paused: boolean };
  stages: { count: number; audio: boolean };
  music: string[];
  musicCredit: string; // shown on stage while a CC BY track plays
  serverTime: number;
};

export type FeedItem =
  | { type: 'chat'; id: string; at: number; user: Viewer; text: string; trigger: boolean; wish: string | null; sim?: boolean }
  | { type: 'gift'; id: string; at: number; user: Viewer; giftName: string; count: number; coins: number; image: string; sim?: boolean }
  | { type: 'join'; id: string; at: number; user: Viewer; sim?: boolean }
  | { type: 'follow'; id: string; at: number; user: Viewer; sim?: boolean }
  | { type: 'share'; id: string; at: number; user: Viewer; sim?: boolean }
  | { type: 'like'; id: string; at: number; user: Viewer; count: number; sim?: boolean }
  | { type: 'system'; id: string; at: number; text: string; level: 'info' | 'success' | 'warn' | 'error' };

export type FxName = 'bell' | 'gong' | 'chime' | 'bloom' | 'rain' | 'lanterns';
export type FxEvent = { fx: FxName; power?: number };

export const SEAT_COUNT = 96;
export const OFFER_SLOTS = 5;
export const OFFER_MS = 24000;
export const TOP_CUSHIONS = 10;
