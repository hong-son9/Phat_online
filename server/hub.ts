import type { Request, Response } from 'express';

// Server-Sent Events hub. Pages connect with ?role=stage|preview|dashboard.
// Only one stage page makes sound (the oldest connected one), so opening the
// stage link twice never doubles the voice.

type Role = 'stage' | 'preview' | 'dashboard';
type Client = { id: string; role: Role; res: Response; audio: boolean };

let clients: Client[] = [];
let seq = 0;
const audioListeners: Array<() => void> = [];

export function onAudioStageChange(fn: () => void) {
  audioListeners.push(fn);
}

function write(c: Client, event: string, data: unknown) {
  try {
    c.res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  } catch {
    // the close handler cleans up
  }
}

export function broadcast(event: string, data: unknown, roles?: Role[]) {
  for (const c of clients) if (!roles || roles.includes(c.role)) write(c, event, data);
}

export function sendToAudioStage(event: string, data: unknown): boolean {
  const c = clients.find((x) => x.audio);
  if (!c) return false;
  write(c, event, data);
  return true;
}

export function hasAudioStage() {
  return clients.some((c) => c.audio);
}

export function stageCount() {
  return clients.filter((c) => c.role === 'stage').length;
}

function electAudio() {
  const current = clients.find((c) => c.audio);
  if (current) return;
  const next = clients.find((c) => c.role === 'stage');
  if (!next) return;
  next.audio = true;
  write(next, 'role', { audio: true });
  audioListeners.forEach((fn) => fn());
}

export function connect(req: Request, res: Response, hello: () => Array<[string, unknown]>) {
  const role = (['stage', 'preview', 'dashboard'] as Role[]).find((r) => r === req.query.role) ?? 'dashboard';
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  const client: Client = { id: `c${++seq}`, role, res, audio: false };
  clients.push(client);
  write(client, 'role', { audio: false, id: client.id });
  for (const [event, data] of hello()) write(client, event, data);
  electAudio();

  const heartbeat = setInterval(() => {
    try {
      res.write(': ping\n\n');
    } catch {
      clearInterval(heartbeat);
    }
  }, 15000);

  req.on('close', () => {
    clearInterval(heartbeat);
    const wasAudio = client.audio;
    clients = clients.filter((c) => c !== client);
    if (wasAudio) {
      electAudio();
      if (!hasAudioStage()) audioListeners.forEach((fn) => fn());
    }
  });
}
