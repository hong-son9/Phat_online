import { TikTokLiveConnection, WebcastEvent, ControlEvent } from 'tiktok-live-connector';
import type { LiveStatus, Viewer } from '../shared/types';

// TikTok LIVE link with automatic reconnect:
// - press Connect before going live: it waits and joins as soon as the live starts
// - a dropped connection is retried with backoff
// - when the live ends, it waits for the next one (if auto reconnect is on)

export type LiveHandlers = {
  chat: (u: Viewer, text: string) => void;
  gift: (u: Viewer, giftName: string, count: number, coinsEach: number, image: string) => void;
  join: (u: Viewer) => void;
  follow: (u: Viewer) => void;
  share: (u: Viewer) => void;
  like: (u: Viewer, count: number, total: number) => void;
  viewers: (n: number) => void;
  status: (s: LiveStatus) => void;
};

/* eslint-disable @typescript-eslint/no-explicit-any */
const viewerOf = (data: any): Viewer => {
  const u = data?.user ?? {};
  const id = String(u.uniqueId || u.displayId || data?.uniqueId || u.userId || u.id || 'khach').toLowerCase();
  const name = String(u.nickname || data?.nickname || u.uniqueId || u.displayId || 'Bạn').slice(0, 40);
  const avatar = u.avatarThumb?.urlList?.[0] || u.profilePicture?.urls?.[0] || u.profilePictureUrl || '';
  return { id, name, avatar };
};

function friendlyError(err: unknown): { text: string; offline: boolean } {
  const name = (err as { constructor?: { name?: string } })?.constructor?.name ?? '';
  const msg = err instanceof Error ? err.message : String(err);
  if (/UserOffline/i.test(name) || /offline|not live|isn't online|LIVE has ended/i.test(msg))
    return { text: 'Tài khoản chưa phát LIVE. App sẽ tự vào khi bạn bắt đầu live.', offline: true };
  if (/InvalidUniqueId|user.*not.*found|unique.?id/i.test(name + msg))
    return { text: 'Không tìm thấy tài khoản TikTok này. Kiểm tra lại username (không cần @).', offline: false };
  if (/RateLimit|429/i.test(name + msg))
    return { text: 'Máy chủ kết nối đang quá tải, app sẽ thử lại sau ít giây.', offline: false };
  if (/timeout|ETIMEDOUT|ENOTFOUND|ECONNRESET|fetch failed/i.test(msg))
    return { text: 'Mạng chập chờn, không kết nối được TikTok. Đang thử lại...', offline: false };
  return { text: msg.slice(0, 200), offline: false };
}

const BACKOFF = [3, 6, 12, 20, 30];
const WAIT_RETRY_S = 20;

export class TikTokLink {
  status: LiveStatus = { state: 'idle', username: '', roomId: '', viewers: 0, totalLikes: 0, error: '', since: Date.now(), nextRetryAt: 0 };
  autoReconnect = true;
  private conn: InstanceType<typeof TikTokLiveConnection> | null = null;
  private retryTimer: NodeJS.Timeout | null = null;
  private attempt = 0;
  private generation = 0; // bumps on every connect/disconnect so callbacks from an old connection are ignored
  private streakCounts = new Map<string, number>();

  constructor(private h: LiveHandlers) {}

  private set(patch: Partial<LiveStatus>) {
    const stateChanged = patch.state && patch.state !== this.status.state;
    this.status = { ...this.status, ...patch, ...(stateChanged ? { since: Date.now() } : {}) };
    this.h.status(this.status);
  }

  connect(username: string) {
    const clean = username.replace(/^@/, '').trim();
    if (!clean) return;
    this.teardown();
    this.attempt = 0;
    this.status = { ...this.status, username: clean, roomId: '', viewers: 0, totalLikes: 0 };
    void this.open();
  }

  disconnect() {
    this.teardown();
    this.set({ state: 'idle', roomId: '', error: '', nextRetryAt: 0 });
  }

  private teardown() {
    this.generation++;
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.retryTimer = null;
    if (this.conn) {
      const c = this.conn;
      this.conn = null;
      c.removeAllListeners?.();
      c.disconnect().catch(() => {});
    }
  }

  private scheduleRetry(state: 'reconnecting' | 'waiting', seconds: number, error = '') {
    if (!this.autoReconnect && state === 'reconnecting' && this.attempt > 2) {
      this.set({ state: 'error', error: error || 'Mất kết nối với TikTok.', nextRetryAt: 0 });
      return;
    }
    const gen = this.generation;
    this.set({ state, error, nextRetryAt: Date.now() + seconds * 1000 });
    this.retryTimer = setTimeout(() => {
      if (gen === this.generation) void this.open();
    }, seconds * 1000);
  }

  private async open() {
    const gen = ++this.generation;
    const username = this.status.username;
    if (this.status.state !== 'waiting' && this.status.state !== 'reconnecting') this.set({ state: 'connecting', error: '', nextRetryAt: 0 });
    this.streakCounts.clear();

    const conn = new TikTokLiveConnection(username, {
      processInitialData: false,
      enableExtendedGiftInfo: false,
    });
    this.conn = conn;
    const live = () => gen === this.generation;

    conn.on(ControlEvent.DISCONNECTED, () => {
      if (!live()) return;
      this.conn = null;
      this.attempt++;
      this.scheduleRetry('reconnecting', BACKOFF[Math.min(this.attempt - 1, BACKOFF.length - 1)], 'Mất kết nối, đang nối lại...');
    });
    conn.on(WebcastEvent.STREAM_END, () => {
      if (!live()) return;
      this.generation++;
      this.conn = null;
      conn.disconnect().catch(() => {});
      if (this.autoReconnect) this.scheduleRetry('waiting', 30, 'Phiên LIVE đã kết thúc. Đang chờ phiên tiếp theo...');
      else this.set({ state: 'ended', error: 'Phiên LIVE đã kết thúc.', nextRetryAt: 0 });
    });
    conn.on(ControlEvent.ERROR, (err: unknown) => {
      if (!live()) return;
      console.warn('[TikTok] Lỗi:', err instanceof Error ? err.message : err);
    });

    conn.on(WebcastEvent.CHAT, (d: any) => void (live() && this.h.chat(viewerOf(d), String(d?.content ?? d?.comment ?? ''))));
    conn.on(WebcastEvent.MEMBER, (d: any) => void (live() && this.h.join(viewerOf(d))));
    conn.on(WebcastEvent.FOLLOW, (d: any) => void (live() && this.h.follow(viewerOf(d))));
    conn.on(WebcastEvent.SHARE, (d: any) => void (live() && this.h.share(viewerOf(d))));
    conn.on(WebcastEvent.ROOM_USER, (d: any) => {
      if (!live() || typeof d?.viewerCount !== 'number') return;
      this.status.viewers = d.viewerCount;
      this.h.viewers(d.viewerCount);
    });
    conn.on(WebcastEvent.LIKE, (d: any) => {
      if (!live()) return;
      const total = Number(d?.totalLikeCount ?? d?.totalLikes) || 0;
      if (total > this.status.totalLikes) this.status.totalLikes = total;
      this.h.like(viewerOf(d), Number(d?.likeCount) || 1, total);
    });
    // TikTok resends streak gifts with a growing repeatCount; only pass on the new units
    conn.on(WebcastEvent.GIFT, (d: any) => {
      if (!live()) return;
      const u = viewerOf(d);
      const giftId = String(d?.giftId ?? d?.gift?.id ?? 0);
      const key = `${u.id}_${giftId}`;
      const total = Number(d?.repeatCount) || 1;
      const delta = total - (this.streakCounts.get(key) || 0);
      const streakable = (d?.gift?.type ?? d?.giftDetails?.giftType ?? d?.giftType) === 1;
      if (streakable && !d?.repeatEnd) this.streakCounts.set(key, total);
      else this.streakCounts.delete(key);
      if (delta <= 0) return;
      const name = d?.gift?.name || d?.giftDetails?.giftName || d?.giftName || 'Quà';
      const coins = Number(d?.gift?.diamondCount ?? d?.giftDetails?.diamondCount ?? d?.diamondCount) || 1;
      const image = d?.gift?.image?.urlList?.[0] || d?.giftDetails?.giftImage?.giftPictureUrl || d?.giftPictureUrl || '';
      this.h.gift(u, String(name), delta, coins, image);
    });

    try {
      const state = await conn.connect();
      if (!live()) return;
      this.attempt = 0;
      this.set({ state: 'connected', roomId: String(state?.roomId ?? ''), error: '', nextRetryAt: 0 });
      console.log(`[TikTok] Đã kết nối @${username} (phòng ${state?.roomId})`);
    } catch (err) {
      if (!live()) return;
      this.conn = null;
      conn.removeAllListeners?.();
      conn.disconnect().catch(() => {}); // don't leave a half-open socket behind on every retry
      const { text, offline } = friendlyError(err);
      console.warn(`[TikTok] Không kết nối được @${username}:`, err instanceof Error ? err.message : err);
      if (offline) {
        this.scheduleRetry('waiting', WAIT_RETRY_S, text);
      } else if (/Không tìm thấy/.test(text)) {
        this.set({ state: 'error', error: text, nextRetryAt: 0 });
      } else {
        this.attempt++;
        this.scheduleRetry('reconnecting', BACKOFF[Math.min(this.attempt - 1, BACKOFF.length - 1)], text);
      }
    }
  }
}
