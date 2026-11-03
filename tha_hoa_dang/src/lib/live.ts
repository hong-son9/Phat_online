import { useEffect, useRef, useState } from 'react';
import type { FeedItem, FxEvent, Snapshot } from '../../shared/types';

// One EventSource per page. The server sends the full state (throttled) plus feed, effect and voice events.

type Listener<T> = (data: T) => void;
export type LiveEvents = {
  feed: FeedItem;
  fx: FxEvent;
  'voice:play': { id: string; text: string; url: string };
  'voice:stop': { id: string };
  'voice:started': { id: string };
  role: { audio: boolean };
};

class Bus {
  private map = new Map<string, Set<Listener<unknown>>>();
  on<K extends keyof LiveEvents>(k: K, fn: Listener<LiveEvents[K]>) {
    if (!this.map.has(k)) this.map.set(k, new Set());
    this.map.get(k)!.add(fn as Listener<unknown>);
    return () => void this.map.get(k)!.delete(fn as Listener<unknown>);
  }
  emit(k: string, data: unknown) {
    this.map.get(k)?.forEach((fn) => fn(data));
  }
}

export const bus = new Bus();

export function useLive(role: 'stage' | 'preview' | 'dashboard') {
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [online, setOnline] = useState(false);
  const offsetRef = useRef(0); // server clock minus local clock

  useEffect(() => {
    const es = new EventSource(`/api/events?role=${role}`);
    es.onopen = () => setOnline(true);
    es.onerror = () => setOnline(false);
    es.addEventListener('state', (e) => {
      const s = JSON.parse((e as MessageEvent).data) as Snapshot;
      offsetRef.current = s.serverTime - Date.now();
      setSnap(s);
    });
    for (const k of ['feed', 'fx', 'voice:play', 'voice:stop', 'voice:started', 'role']) {
      es.addEventListener(k, (e) => bus.emit(k, JSON.parse((e as MessageEvent).data)));
    }
    return () => es.close();
  }, [role]);

  return { snap, online, now: () => Date.now() + offsetRef.current };
}

export function useBus<K extends keyof LiveEvents>(k: K, fn: Listener<LiveEvents[K]>) {
  const ref = useRef(fn);
  ref.current = fn;
  useEffect(() => bus.on(k, (d) => ref.current(d)), [k]);
}

// Re-render every `ms` (countdowns, "x giây trước")
export function useTick(ms = 1000) {
  const [, set] = useState(0);
  useEffect(() => {
    const t = setInterval(() => set((n) => n + 1), ms);
    return () => clearInterval(t);
  }, [ms]);
}
