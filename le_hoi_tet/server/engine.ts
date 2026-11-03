import type { FeedItem, FxName, HallSeat, Offer, ActionKind, Settings, Snapshot, Spotlight, Stats, TopEntry, Viewer } from '../shared/types';
import { FRONT_SEATS, GIFT_TIERS, OFFER_MS, OFFER_SLOTS, SEAT_COUNT } from '../shared/types';
import { containsBanned, detectWish, hasKeyword, joinNames, maskBanned, setCustomBanned, spokenName } from '../shared/text';
import * as L from '../shared/lines';
import { broadcast, hasAudioStage, stageCount } from './hub';
import * as voice from './voice';
import { TikTokLink } from './tiktok';
import { applySettingsPatch, loadSession, loadSettings, saveSession, saveSettings } from './store';
import { listMusic, musicCredit } from './music';

// The brain of the app: every TikTok event (or simulated one) comes through here and becomes
// state (people on the bridge, leaderboard, likes, the line at the railing), stage effects and voice lines.

type SeatInfo = HallSeat & { lastActive: number };
type SpotRequest = { viewer: Viewer; giftName: string; count: number; coins: number };
type PendingThanks = { viewer: Viewer; gifts: Map<string, number>; coins: number; timer: NodeJS.Timeout };

const GREET_EVERY_MS = 6000;
const SEAT_DELAY_MS = 8000;
const WISH_PER_USER_MS = 8 * 60 * 1000;
const WISH_GLOBAL_MS = 15 * 1000;
const OFFER_COOLDOWN_MS = 60 * 1000;
const GIFT_THANKS_COOLDOWN_MS = 30 * 1000;
const BIG_GIFT_COINS = GIFT_TIERS.lion;

// TikTok gift names as the Vietnamese voice should say them
const GIFT_NAMES_VI: Record<string, string> = {
  rose: 'hoa hồng', 'heart me': 'trái tim', 'finger heart': 'bắn tim', 'hand hearts': 'trái tim',
  perfume: 'nước hoa', doughnut: 'bánh vòng', 'ice cream cone': 'kem ốc quế', 'love you': 'lời yêu thương',
  'tiktok': 'quà TikTok', lion: 'sư tử', universe: 'vũ trụ', galaxy: 'dải ngân hà', corgi: 'chú cún',
  'sunglasses': 'kính râm', 'heart': 'trái tim', 'gg': 'quà GG', 'friendship necklace': 'vòng cổ tình bạn',
  'mishka bear': 'gấu bông', 'rosa': 'hoa hồng', 'cap': 'mũ', 'hat and mustache': 'mũ và ria mép',
  'paper crane': 'hạc giấy', 'little crown': 'vương miện nhỏ', 'confetti': 'pháo giấy', 'lotus': 'hoa sen',
};
const giftSpoken = (name: string) => GIFT_NAMES_VI[name.trim().toLowerCase()] ?? 'món quà';

let feedSeq = 0;
const fid = () => `f${Date.now().toString(36)}${++feedSeq}`;

const freshStats = (): Stats => ({
  sessionStart: Date.now(), comments: 0, gifts: 0, coins: 0, joins: 0, follows: 0, shares: 0, offers: 0, fireworks: 0, rains: 0, peakViewers: 0,
});

type SavedSession = { stats: Stats; top: TopEntry[]; hall: SeatInfo[]; likeProgress: number };

export class Engine {
  settings: Settings = loadSettings();
  stats: Stats = freshStats();
  private hall = new Map<number, SeatInfo>();
  private top = new Map<string, TopEntry>();
  private offers: Offer[] = [];
  private offerQueue: Array<Viewer & { gift: boolean; kind: ActionKind; coins: number }> = [];
  private lastOfferAt = new Map<string, number>();
  private spotlight: Spotlight | null = null;
  private spotQueue: SpotRequest[] = [];
  private likeProgress = 0;
  private rainUntil = 0;
  private lastTotalLikes: number | null = null;
  private greetQueue: Viewer[] = [];
  private greeted = new Set<string>();
  private thanked = new Map<string, number>(); // follow_/share_/gift_ + id -> last time
  private pendingThanks = new Map<string, PendingThanks>();
  private recent = new Map<string, number>(); // display name -> last interaction
  private wishLast = new Map<string, number>();
  private wishLastAny = 0;
  private lastReminderAt = Date.now();
  private lastSimAt = 0;
  private lastStatusMsg = '';
  private dirty = true;
  private sessionDirty = false;
  private avoid = { word: { last: -1 }, join: { last: -1 }, gift: { last: -1 }, bless: { last: -1 }, idle: { last: -1 }, ask: { last: -1 } };

  link: TikTokLink;

  constructor() {
    setCustomBanned(this.settings.bannedWords);
    voice.setVoiceConfig(this.settings.voice);
    voice.onVoiceChange(() => this.touch());

    const saved = loadSession<SavedSession>();
    if (saved) {
      this.stats = { ...freshStats(), ...saved.stats };
      saved.top.forEach((t) => this.top.set(t.id, t));
      saved.hall.forEach((s) => s.seat < SEAT_COUNT && this.hall.set(s.seat, s));
      this.likeProgress = saved.likeProgress || 0;
      console.log(`[Phiên] Khôi phục phiên trước: ${this.top.size} người trong bảng, ${this.hall.size} người trên cầu.`);
    }

    this.link = new TikTokLink({
      chat: (u, t) => this.onChat(u, t),
      gift: (u, n, c, coins, img) => this.onGift(u, n, c, coins, img),
      join: (u) => this.onJoin(u),
      follow: (u) => this.onFollow(u),
      share: (u) => this.onShare(u),
      like: (u, c, total) => this.onLike(u, c, total),
      viewers: (n) => {
        this.stats.peakViewers = Math.max(this.stats.peakViewers, n);
        this.touch();
      },
      status: (s) => {
        this.touch();
        // A new room starts its like total from zero again
        if (s.state === 'connected') this.lastTotalLikes = null;
        const msg = s.state === 'connected' ? `Đã kết nối phòng LIVE @${s.username}` : s.error;
        // Retries repeat the same message every few seconds: log it once
        if (msg && msg !== this.lastStatusMsg) this.system(msg, s.state === 'connected' ? 'success' : s.state === 'error' ? 'error' : 'warn');
        this.lastStatusMsg = msg;
      },
    });
    this.link.autoReconnect = this.settings.autoReconnect;

    setInterval(() => this.tickGreetings(), GREET_EVERY_MS);
    setInterval(() => this.tickAmbientVoice(), 5000);
    setInterval(() => this.flush(), 200);
    setInterval(() => this.persist(), 15000);
  }

  // ---------- state out ----------

  touch() {
    this.dirty = true;
    this.sessionDirty = true;
  }

  snapshot(): Snapshot {
    const top = [...this.top.values()].sort((a, b) => b.points - a.points).slice(0, 20);
    return {
      settings: this.settings,
      live: this.link.status,
      stats: this.stats,
      // avatars re-resolved here so a guest picture set mid-live shows on people already in the hall
      hall: [...this.hall.values()].map(({ seat, id, name, avatar, vip }) => ({ seat, id, name, avatar: this.avatarOf(id, avatar), vip })),
      top: top.map((t) => ({ ...t, avatar: this.avatarOf(t.id, t.avatar) })),
      offers: this.offers.map((o) => ({ ...o, avatar: this.avatarOf(o.viewerId, o.avatar) })),
      offerQueue: this.offerQueue.map(({ id, name, avatar, kind }) => ({ id, name, avatar: this.avatarOf(id, avatar), kind })),
      spotlight: this.spotlight && { ...this.spotlight, avatar: this.avatarOf(this.spotlight.viewerId, this.spotlight.avatar) },
      likes: { progress: this.likeProgress, goal: this.settings.likeGoal, rainUntil: this.rainUntil },
      voice: voice.voiceState(),
      stages: { count: stageCount(), audio: hasAudioStage() },
      music: listMusic(),
      musicCredit: this.settings.audio.music ? musicCredit(this.settings.audio.musicTrack) : '',
      serverTime: Date.now(),
    };
  }

  private flush() {
    if (!this.dirty) return;
    this.dirty = false;
    broadcast('state', this.snapshot());
  }

  private persist() {
    if (!this.sessionDirty) return;
    this.sessionDirty = false;
    saveSession({ stats: this.stats, top: [...this.top.values()], hall: [...this.hall.values()], likeProgress: this.likeProgress } satisfies SavedSession);
  }

  private feed(item: FeedItem) {
    broadcast('feed', item);
  }

  system(text: string, level: 'info' | 'success' | 'warn' | 'error' = 'info') {
    this.feed({ type: 'system', id: fid(), at: Date.now(), text, level });
  }

  fx(name: FxName, power = 1) {
    broadcast('fx', { fx: name, power });
  }

  private say(text: string, kind: Parameters<typeof voice.enqueue>[1], priority = false) {
    voice.enqueue(text, kind, priority);
  }

  private get channel() {
    return this.settings.channelName;
  }

  // ---------- helpers ----------

  private isBlocked(u: Viewer) {
    const list = this.settings.blockedUsers;
    return list.includes(u.id) || list.includes(u.name.toLowerCase());
  }

  // Recently seen viewers, so dashboard actions also work on someone who only just joined
  private known = new Map<string, Viewer>();

  private guestOf(id: string) {
    return this.settings.guests.find((g) => g.id === id);
  }

  // The owner's chosen picture for a guest (served from data/guests), otherwise their TikTok avatar
  private avatarOf(id: string, fallback: string) {
    const g = this.guestOf(id);
    return g?.image ? `/guest-img/${encodeURIComponent(g.image)}` : fallback;
  }

  private clean(u: Viewer): Viewer {
    const v = { id: u.id, name: maskBanned(u.name), avatar: this.avatarOf(u.id, u.avatar) };
    this.known.delete(v.id);
    this.known.set(v.id, v);
    if (this.known.size > 1000) this.known.delete(this.known.keys().next().value!);
    return v;
  }

  private noteRecent(u: Viewer) {
    this.recent.delete(u.name);
    this.recent.set(u.name, Date.now());
    if (this.recent.size > 60) this.recent.delete(this.recent.keys().next().value!);
  }

  private addPoints(u: Viewer, points: number, coins = 0, comments = 0) {
    const t = this.top.get(u.id) ?? { id: u.id, name: u.name, avatar: u.avatar, points: 0, coins: 0, comments: 0 };
    t.points += points;
    t.coins += coins;
    t.comments += comments;
    t.name = u.name;
    if (u.avatar) t.avatar = u.avatar;
    this.top.set(u.id, t);
  }

  // A free seat, or the seat of whoever has been quiet longest (regular viewers before gift givers)
  seat(u: Viewer, vip = false) {
    const existing = [...this.hall.values()].find((s) => s.id === u.id);
    if (existing) {
      existing.lastActive = Date.now();
      existing.name = u.name;
      if (u.avatar) existing.avatar = u.avatar;
      if (vip) existing.vip = true;
      this.touch();
      return;
    }
    let seat = -1;
    const guest = this.guestOf(u.id);
    if (guest?.frontRow) seat = this.frontSeatFor();
    for (let i = 0; i < SEAT_COUNT && seat === -1; i++) {
      if (!this.hall.has(i)) seat = i;
    }
    if (seat === -1) {
      // never someone who is up at the burner right now; regular viewers go before gift givers
      const busy = new Set(this.offers.map((o) => o.viewerId));
      const all = [...this.hall.values()].filter((s) => !busy.has(s.id));
      const pool = all.some((s) => !s.vip) ? all.filter((s) => !s.vip) : all;
      seat = pool.reduce((a, b) => (b.lastActive < a.lastActive ? b : a)).seat;
    }
    this.hall.set(seat, { seat, id: u.id, name: u.name, avatar: u.avatar, vip, lastActive: Date.now() });
    this.touch();
  }

  private activity(u: Viewer) {
    const s = [...this.hall.values()].find((x) => x.id === u.id);
    if (s) s.lastActive = Date.now();
  }

  // ---------- the line at the railing (max 5 letting go at once, the rest wait) ----------

  // A place near the camera for a guest: a free one, or the quietest regular viewer there
  // moves further along the bridge (or leaves if the bridge is full)
  private frontSeatFor(): number {
    const FRONT = FRONT_SEATS;
    for (let i = 0; i < FRONT; i++) if (!this.hall.has(i)) return i;
    const busy = new Set(this.offers.map((o) => o.viewerId));
    const movable = [...this.hall.values()].filter((s) => s.seat < FRONT && !busy.has(s.id) && !this.guestOf(s.id));
    if (!movable.length) return -1;
    const out = movable.reduce((a, b) => (b.lastActive < a.lastActive ? b : a));
    this.hall.delete(out.seat);
    for (let i = FRONT; i < SEAT_COUNT; i++) {
      if (!this.hall.has(i)) {
        this.hall.set(i, { ...out, seat: i });
        break;
      }
    }
    return out.seat;
  }

  requestOffer(u: Viewer, gift: boolean, kind: ActionKind = 'chu', coins = 0) {
    const now = Date.now();
    if (this.offers.some((o) => o.viewerId === u.id)) return;
    // gift givers and guests marked "skip the line" go ahead of everyone else waiting
    const priority = gift || !!this.guestOf(u.id)?.skipQueue;
    const queued = this.offerQueue.findIndex((q) => q.id === u.id);
    if (queued !== -1) {
      if (priority) {
        const [q] = this.offerQueue.splice(queued, 1);
        this.offerQueue.unshift({ ...q, gift: true, coins: Math.max(q.coins, coins) });
        this.touch();
      }
      return;
    }
    if (!gift && now - (this.lastOfferAt.get(u.id) ?? 0) < OFFER_COOLDOWN_MS) return;
    this.lastOfferAt.set(u.id, now);
    const entry = { ...u, gift: priority, kind, coins };
    if (priority) {
      const i = this.offerQueue.findIndex((q) => !q.gift);
      this.offerQueue.splice(i === -1 ? this.offerQueue.length : i, 0, entry);
    } else {
      this.offerQueue.push(entry);
    }
    this.offerQueue = this.offerQueue.slice(0, 30);
    this.pumpOffers();
  }

  private pumpOffers() {
    while (this.offers.length < OFFER_SLOTS && this.offerQueue.length) {
      const q = this.offerQueue.shift()!;
      const used = new Set(this.offers.map((o) => o.slot));
      let slot = 0;
      while (used.has(slot)) slot++;
      // the calligrapher's word is picked here, so every page shows the same scroll
      const [word, meaning] = q.kind === 'chu' ? L.pick(L.CALLIGRAPHY, this.avoid.word) : ['', ''];
      const offer: Offer = { id: fid(), viewerId: q.id, name: q.name, avatar: q.avatar, slot, startedAt: Date.now(), gift: q.gift, kind: q.kind, word, coins: q.coins };
      this.offers.push(offer);
      if (q.kind === 'phao') this.stats.fireworks++;
      else {
        this.stats.offers++;
        // read out the word once they have it in their hands (about the middle of their turn)
        setTimeout(() => {
          if (this.settings.read.wishes && voice.waitingCount() < 3)
            this.say(L.fill(L.pick(L.CALLIGRAPHY_LINES), { name: spokenName(q.name), word, meaning }), 'wish');
        }, 7000);
      }
      this.seat(q, q.gift); // they walk from (and back to) their place on the bridge
      setTimeout(() => {
        this.offers = this.offers.filter((o) => o.id !== offer.id);
        this.pumpOffers();
        this.touch();
      }, OFFER_MS);
    }
    this.touch();
  }

  // ---------- spotlight (camera close-up on a gift giver, one at a time) ----------

  private requestSpotlight(r: SpotRequest) {
    if (this.spotlight?.viewerId === r.viewer.id) {
      this.spotlight.count += r.count;
      this.spotlight.coins += r.coins;
      this.touch();
      return;
    }
    const waiting = this.spotQueue.find((q) => q.viewer.id === r.viewer.id);
    if (waiting) {
      waiting.count += r.count;
      waiting.coins += r.coins;
    } else {
      this.spotQueue.push(r);
      this.spotQueue = this.spotQueue.slice(-15);
    }
    this.pumpSpotlight();
  }

  private pumpSpotlight() {
    if (this.spotlight || !this.spotQueue.length) return;
    // Bigger gifts first
    this.spotQueue.sort((a, b) => b.coins - a.coins);
    const r = this.spotQueue.shift()!;
    const durationMs = 9000 + Math.min(9000, r.coins * 40);
    const s: Spotlight = {
      id: fid(), viewerId: r.viewer.id, name: r.viewer.name, avatar: r.viewer.avatar,
      giftName: r.giftName, count: r.count, coins: r.coins, startedAt: Date.now(), durationMs,
    };
    this.spotlight = s;
    this.fx('bell', 0.9);
    this.touch();
    setTimeout(() => {
      if (this.spotlight?.id !== s.id) return;
      this.spotlight = null;
      this.touch();
      setTimeout(() => this.pumpSpotlight(), 800);
    }, durationMs);
  }

  // ---------- events ----------

  onJoin(raw: Viewer, sim = false) {
    if (this.isBlocked(raw)) return;
    const u = this.clean(raw);
    this.stats.joins++;
    this.feed({ type: 'join', id: fid(), at: Date.now(), user: u, sim });
    const guest = this.guestOf(u.id);
    if (guest) {
      // A guest walks straight in to a bell, and is greeted on their own, ahead of the batch
      this.seat(u);
      this.fx('bell', 0.7);
      if (this.settings.read.joins && !this.greeted.has(u.id)) {
        this.greeted.add(u.id);
        const vars = { name: spokenName(u.name), channel: this.channel, title: guest.title || 'khách quý' };
        const line = guest.greeting
          ? L.fill(guest.greeting, vars)
          : L.fill(L.GUEST_GREETING, { ...vars, title: vars.title.toLowerCase() });
        this.say(line, 'join', true);
      }
      this.touch();
      return;
    }
    setTimeout(() => this.seat(u), SEAT_DELAY_MS);
    if (this.settings.read.joins && !this.greeted.has(u.id) && !this.greetQueue.some((g) => g.id === u.id)) {
      this.greetQueue = [...this.greetQueue, u].slice(-40);
    }
    this.touch();
  }

  onChat(raw: Viewer, text: string, sim = false) {
    if (this.isBlocked(raw) || !text.trim()) return;
    const u = this.clean(raw);
    const shown = maskBanned(text).slice(0, 200);
    const trigger: ActionKind | null = hasKeyword(text, this.settings.fireKeywords) ? 'phao' : hasKeyword(text, this.settings.keywords) ? 'chu' : null;
    const wish = containsBanned(text) ? null : detectWish(text);
    this.stats.comments++;
    this.noteRecent(u);
    this.addPoints(u, this.settings.pointsPerComment, 0, 1);
    this.activity(u);
    this.feed({ type: 'chat', id: fid(), at: Date.now(), user: u, text: shown, trigger, wish, sim });

    if (trigger) {
      this.seat(u);
      this.requestOffer(u, false, trigger);
      this.fx('gong', 1);
    }
    // Answer a wish with a blessing for that topic. The comment itself is never read aloud.
    if (wish && this.settings.read.wishes) {
      const now = Date.now();
      if (now - this.wishLastAny > WISH_GLOBAL_MS && now - (this.wishLast.get(u.id) ?? 0) > WISH_PER_USER_MS && voice.waitingCount() < 4) {
        this.wishLastAny = now;
        this.wishLast.set(u.id, now);
        this.say(L.fill(L.pick(L.WISH_BLESSINGS[wish]), { name: spokenName(u.name), channel: this.channel }), 'wish');
      }
    }
    this.touch();
  }

  onGift(raw: Viewer, giftName: string, count: number, coinsEach: number, image = '', sim = false) {
    if (this.isBlocked(raw)) return;
    const u = this.clean(raw);
    const coins = count * coinsEach;
    this.stats.gifts += count;
    this.stats.coins += coins;
    this.noteRecent(u);
    this.addPoints(u, coins * this.settings.pointsPerCoin, coins);
    this.feed({ type: 'gift', id: fid(), at: Date.now(), user: u, giftName, count, coins, image, sim });
    this.seat(u, true);
    this.requestOffer(u, true, 'phao', coins); // a gift giver sets off a salvo, bigger for bigger gifts
    const fx = this.settings.effects;
    if (fx.spotlight) this.requestSpotlight({ viewer: u, giftName, count, coins });
    if (fx.bloom) this.fx('bloom', Math.min(3, 0.6 + Math.log10(1 + coins)));
    if (fx.lion && coins >= BIG_GIFT_COINS) this.fx('lion', Math.min(3, coins / 100));
    if (this.settings.read.gifts) this.queueGiftThanks(u, giftName, count, coins);
    this.touch();
  }

  // Combos arrive as many events: wait a moment, then thank once for everything ("5 hoa hồng")
  private queueGiftThanks(u: Viewer, giftName: string, count: number, coins: number) {
    const p = this.pendingThanks.get(u.id);
    if (p) {
      p.gifts.set(giftName, (p.gifts.get(giftName) ?? 0) + count);
      p.coins += coins;
      return;
    }
    const entry: PendingThanks = {
      viewer: u, gifts: new Map([[giftName, count]]), coins,
      timer: setTimeout(() => {
        this.pendingThanks.delete(u.id);
        const now = Date.now();
        const key = `gift_${u.id}`;
        if (entry.coins < BIG_GIFT_COINS && now - (this.thanked.get(key) ?? 0) < GIFT_THANKS_COOLDOWN_MS) return;
        this.thanked.set(key, now);
        const gifts = [...entry.gifts].map(([n, c]) => (c > 1 ? `${c} ${giftSpoken(n)}` : giftSpoken(n)));
        const vars = { channel: this.channel, name: spokenName(u.name), gift: joinNames([...new Set(gifts)]) };
        let line = L.fill(L.pick(L.GIFT_LINES, this.avoid.gift), vars);
        if (entry.coins >= BIG_GIFT_COINS) line += ' ' + L.fill(L.pick(L.BIG_GIFT_EXTRA), vars);
        this.say(`${line} ${L.pick(L.GIFT_BLESSINGS, this.avoid.bless)}`, 'gift', true);
      }, 2500),
    };
    this.pendingThanks.set(u.id, entry);
  }

  onFollow(raw: Viewer, sim = false) {
    if (this.isBlocked(raw)) return;
    const u = this.clean(raw);
    this.stats.follows++;
    this.feed({ type: 'follow', id: fid(), at: Date.now(), user: u, sim });
    const key = `follow_${u.id}`;
    if (this.settings.read.follows && !this.thanked.has(key)) {
      this.thanked.set(key, Date.now());
      this.say(L.fill(L.pick(L.FOLLOW_LINES), { name: spokenName(u.name), channel: this.channel }), 'follow');
    }
    this.touch();
  }

  onShare(raw: Viewer, sim = false) {
    if (this.isBlocked(raw)) return;
    const u = this.clean(raw);
    this.stats.shares++;
    this.noteRecent(u);
    this.feed({ type: 'share', id: fid(), at: Date.now(), user: u, sim });
    const key = `share_${u.id}`;
    if (this.settings.read.shares && Date.now() - (this.thanked.get(key) ?? 0) > 10 * 60 * 1000 && voice.waitingCount() < 4) {
      this.thanked.set(key, Date.now());
      this.say(L.fill(L.pick(L.SHARE_LINES), { name: spokenName(u.name), channel: this.channel }), 'share');
    }
    this.touch();
  }

  onLike(raw: Viewer, count: number, total: number, sim = false) {
    // Count by the room's running total when TikTok sends one: busy rooms drop some like events,
    // but each event carries the total, so nothing is missed
    let delta = count;
    if (total > 0 && !sim) {
      if (this.lastTotalLikes === null) this.lastTotalLikes = total - count;
      delta = total - this.lastTotalLikes;
      if (delta <= 0) return;
      this.lastTotalLikes = total;
    }
    if (!this.isBlocked(raw)) this.feed({ type: 'like', id: fid(), at: Date.now(), user: this.clean(raw), count, sim });
    this.addLikes(delta);
  }

  addLikes(n: number) {
    const goal = this.settings.likeGoal;
    const total = this.likeProgress + n;
    const rains = Math.floor(total / goal);
    this.likeProgress = total % goal;
    // with the automatic rain switched off the bar still fills and starts over, just without the rain
    if (rains > 0 && this.settings.effects.rain) this.startRain(rains);
    this.touch();
  }

  // Dashboard: stop the flower rain, or everything (rain, lion dance, fireworks, the gift close-up and its queue)
  stopEffects(what: 'rain' | 'all') {
    this.rainUntil = 0;
    if (what === 'all') {
      this.spotlight = null;
      this.spotQueue = [];
    }
    this.fx(what === 'all' ? 'stopAll' : 'stopRain');
    this.touch();
  }

  startRain(times = 1, announce = true) {
    const now = Date.now();
    const wasRaining = this.rainUntil > now;
    this.rainUntil = Math.max(this.rainUntil, now) + times * this.settings.rainSeconds * 1000;
    this.stats.rains += times;
    this.fx('rain', 1);
    this.fx('chime', 1);
    if (announce && !wasRaining && this.settings.read.likeGoal) {
      this.say(L.fill(L.pick(L.LIKE_GOAL_LINES), { goal: this.settings.likeGoal }), 'like', true);
    }
    this.touch();
  }

  // ---------- timed voice ----------

  private tickGreetings() {
    if (!this.greetQueue.length || voice.waitingCount() >= 2 || !this.settings.read.joins) return;
    const batch = this.greetQueue.splice(0, 3);
    batch.forEach((g) => this.greeted.add(g.id));
    const names = joinNames(batch.map((g) => `bạn ${spokenName(g.name)}`));
    this.say(L.fill(L.pick(L.JOIN_LINES, this.avoid.join), { channel: this.channel, names }), 'join');
    this.touch();
  }

  private isActiveSession() {
    return this.link.status.state === 'connected' || Date.now() - this.lastSimAt < 10 * 60 * 1000;
  }

  private tickAmbientVoice() {
    if (!this.isActiveSession() || !hasAudioStage()) return;
    const s = this.settings;
    if (s.read.idle && voice.quietForMs() > s.idleSeconds * 1000) {
      this.readIdleBlessing();
      return;
    }
    if (s.read.shareReminder && Date.now() - this.lastReminderAt > s.shareReminderMinutes * 60 * 1000 && voice.waitingCount() < 3) {
      this.readShareReminder();
    }
  }

  readIdleBlessing() {
    this.say(L.fill(L.pick(L.IDLE_BLESSINGS, this.avoid.idle), { channel: this.channel }), 'idle');
    this.say(L.fill(L.pick(L.SHARE_ASKS, this.avoid.ask), this.keywordVars()), 'idle');
    this.lastReminderAt = Date.now();
  }

  readShareReminder() {
    this.lastReminderAt = Date.now();
    const since = Date.now() - this.settings.shareReminderMinutes * 60 * 1000;
    const names = [...this.recent].filter(([, t]) => t > since).map(([n]) => n).reverse().slice(0, 3);
    if (names.length) {
      const list = joinNames(names.map((n) => `bạn ${spokenName(n)}`));
      this.say(L.fill(L.pick(L.REMINDER_NAMED), { channel: this.channel, names: list }), 'reminder');
    } else {
      this.say(L.fill(L.pick(L.SHARE_ASKS, this.avoid.ask), this.keywordVars()), 'reminder');
    }
  }

  private keywordVars() {
    return { keyword: this.settings.keywords[0], fire: this.settings.fireKeywords[0] };
  }

  // ---------- dashboard ----------

  updateSettings(patch: unknown) {
    const prev = this.settings;
    this.settings = applySettingsPatch(this.settings, patch);
    setCustomBanned(this.settings.bannedWords);
    voice.setVoiceConfig(this.settings.voice);
    this.link.autoReconnect = this.settings.autoReconnect;
    if (prev.likeGoal !== this.settings.likeGoal) this.likeProgress = Math.min(this.likeProgress, this.settings.likeGoal - 1);
    saveSettings(this.settings);
    this.dirty = true;
  }

  viewerAction(id: string, action: string) {
    const fromTop = this.top.get(id);
    const fromHall = [...this.hall.values()].find((s) => s.id === id);
    const u: Viewer | null = fromTop ?? fromHall ?? this.known.get(id) ?? null;
    if (!u) return false;
    const viewer = { id: u.id, name: u.name, avatar: u.avatar };
    if (action === 'offer') this.requestOffer(viewer, true, 'chu');
    else if (action === 'phao') this.requestOffer(viewer, true, 'phao');
    else if (action === 'seat') this.seat(viewer);
    else if (action === 'bless') this.say(L.fill(L.pick(L.WISH_BLESSINGS.peace), { name: spokenName(u.name) }), 'manual', true);
    else if (action === 'thank') this.say(`${this.channel} cảm ơn bạn ${spokenName(u.name)} đã đồng hành cùng kênh. ${L.pick(L.GIFT_BLESSINGS)}`, 'manual', true);
    else if (action === 'block') {
      this.updateSettings({ blockedUsers: [...this.settings.blockedUsers, id] });
      this.removeViewer(id);
    } else if (action === 'remove') this.removeViewer(id);
    else if (action === 'guest') {
      if (!this.guestOf(id)) {
        this.updateSettings({ guests: [...this.settings.guests, { id, title: 'Khách quý', robe: '#e0a526', image: '', greeting: '', frontRow: true, skipQueue: true }] });
      }
      // move them to the front now, not just next time they join
      for (const [seat, s] of this.hall) if (s.id === id && seat >= FRONT_SEATS) this.hall.delete(seat);
      this.seat(viewer);
    }
    else return false;
    this.touch();
    return true;
  }

  unblock(id: string) {
    this.updateSettings({ blockedUsers: this.settings.blockedUsers.filter((b) => b !== id) });
  }

  private removeViewer(id: string) {
    for (const [seat, s] of this.hall) if (s.id === id) this.hall.delete(seat);
    this.top.delete(id);
    this.offerQueue = this.offerQueue.filter((q) => q.id !== id);
    this.touch();
  }

  resetSession(what: 'all' | 'hall' | 'top' | 'likes') {
    if (what === 'all' || what === 'hall') this.hall.clear();
    if (what === 'all' || what === 'top') this.top.clear();
    if (what === 'all' || what === 'likes') {
      this.likeProgress = 0;
      this.rainUntil = 0;
    }
    if (what === 'all') {
      this.stats = freshStats();
      this.greeted.clear();
      this.thanked.clear();
      this.recent.clear();
      this.offerQueue = [];
      this.spotQueue = [];
    }
    this.touch();
    this.persist();
  }

  // Test mode: let someone "arrive" again, walking in from the door and greeted again
  prepareRejoin(id: string) {
    this.greeted.delete(id);
    for (const [seat, s] of this.hall) if (s.id === id) this.hall.delete(seat);
    this.touch();
  }

  markSim() {
    this.lastSimAt = Date.now();
  }
}
