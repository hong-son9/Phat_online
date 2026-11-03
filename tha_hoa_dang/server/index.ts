import express from 'express';
import net from 'net';
import path from 'path';
import { Engine } from './engine';
import * as hub from './hub';
import * as voice from './voice';
import { simulate, type SimRequest } from './sim';
import { MUSIC_DIR } from './music';
import { DATA_DIR } from './store';
import fs from 'fs';

const PORT = Number(process.env.PORT) || 3001;
const app = express();
app.use(express.json({ limit: '200kb' }));

const engine = new Engine();
hub.onAudioStageChange(() => engine.touch());

const ok = (res: express.Response, extra: object = {}) => res.json({ ok: true, ...extra });
const bad = (res: express.Response, error: string, code = 400) => res.status(code).json({ ok: false, error });

// ---------- live updates ----------

app.get('/api/events', (req, res) => {
  hub.connect(req, res, () => [['state', engine.snapshot()]]);
  engine.touch(); // stage count changed
});

// ---------- TikTok ----------

app.post('/api/live/connect', (req, res) => {
  const username = String(req.body?.username ?? '').replace(/^@/, '').trim();
  if (!/^[\w.]{2,40}$/.test(username)) return bad(res, 'Username không hợp lệ (chỉ gồm chữ, số, dấu chấm, gạch dưới).');
  engine.updateSettings({ tiktokUsername: username });
  engine.link.connect(username);
  ok(res);
});

app.post('/api/live/disconnect', (_req, res) => {
  engine.link.disconnect();
  engine.system('Đã ngắt kết nối TikTok.', 'info');
  ok(res);
});

// ---------- settings & session ----------

app.patch('/api/settings', (req, res) => {
  engine.updateSettings(req.body ?? {});
  ok(res, { settings: engine.settings });
});

app.post('/api/session/reset', (req, res) => {
  const what = (['all', 'hall', 'top', 'likes'] as const).find((w) => w === req.body?.what) ?? 'all';
  engine.resetSession(what);
  ok(res);
});

app.post('/api/viewer', (req, res) => {
  const { id, action } = req.body ?? {};
  if (action === 'unblock') {
    engine.unblock(String(id));
    return ok(res);
  }
  if (!engine.viewerAction(String(id), String(action))) return bad(res, 'Không tìm thấy người xem này.');
  ok(res);
});

// ---------- voice ----------

app.post('/api/voice/say', (req, res) => {
  const text = String(req.body?.text ?? '').trim();
  if (!text) return bad(res, 'Chưa nhập nội dung.');
  const item = voice.enqueue(text, 'manual', req.body?.priority !== false);
  ok(res, { item, audio: hub.hasAudioStage() });
});

app.post('/api/voice/:cmd', (req, res) => {
  const { cmd } = req.params;
  const id = String(req.body?.id ?? '');
  if (cmd === 'skip') voice.skip();
  else if (cmd === 'clear') voice.clearQueue();
  else if (cmd === 'pause') voice.setPaused(true);
  else if (cmd === 'resume') voice.setPaused(false);
  else if (cmd === 'remove') voice.removeItem(id);
  else if (cmd === 'started') voice.reportStarted(id);
  else if (cmd === 'ended') voice.reportEnded(id);
  else if (cmd === 'blessing') engine.readIdleBlessing();
  else if (cmd === 'reminder') engine.readShareReminder();
  else if (cmd === 'test') voice.enqueue(`Xin chào, đây là giọng đọc của ${engine.settings.channelName}. Âm thanh đang hoạt động tốt.`, 'system', true);
  else return bad(res, 'Lệnh không hợp lệ.');
  ok(res);
});

// Audio for a queued line (synthesized ahead of time, so usually instant)
app.get('/api/tts/item/:id', async (req, res) => {
  const p = voice.audioFor(req.params.id);
  if (!p) return res.status(404).end();
  try {
    const buf = await p;
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Cache-Control', 'no-store');
    res.send(buf);
  } catch (err) {
    console.error('[Giọng đọc] Lỗi tổng hợp:', err);
    res.status(502).end();
  }
});

// Voice preview for the dashboard (plays on the dashboard only, never on the live)
app.get('/api/tts/preview', async (req, res) => {
  const text = String(req.query.text ?? '').trim().slice(0, 300);
  if (!text) return res.status(400).end();
  const v = engine.settings.voice;
  try {
    const buf = await voice.synthesize(text, {
      name: String(req.query.voice || v.name),
      rate: Number(req.query.rate) || v.rate,
      pitch: req.query.pitch !== undefined ? Number(req.query.pitch) : v.pitch,
    });
    res.setHeader('Content-Type', 'audio/mpeg');
    res.send(buf);
  } catch {
    res.status(502).end();
  }
});

app.get('/api/voices', (_req, res) => res.json(voice.VOICES));

// ---------- effects & test mode ----------

app.post('/api/fx', (req, res) => {
  const fx = String(req.body?.fx ?? '');
  if (fx === 'rain') engine.startRain(1, false);
  else if (fx === 'stopRain') engine.stopEffects('rain');
  else if (fx === 'stopAll') engine.stopEffects('all');
  else if (['bell', 'gong', 'chime', 'bloom', 'lanterns'].includes(fx)) engine.fx(fx as 'bell', Number(req.body?.power) || 1);
  else return bad(res, 'Hiệu ứng không hợp lệ.');
  ok(res);
});

app.post('/api/sim', (req, res) => {
  simulate(engine, (req.body ?? {}) as SimRequest);
  ok(res);
});

// ---------- guest pictures ----------

const GUEST_DIR = path.join(DATA_DIR, 'guests');
const IMAGE_TYPES: Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif' };

app.put('/api/guests/:id/image', express.raw({ type: 'image/*', limit: '4mb' }), (req, res) => {
  const id = String(req.params.id).replace(/^@/, '').trim().toLowerCase();
  if (!/^[\w.]{1,40}$/.test(id)) return bad(res, 'Username không hợp lệ.');
  const ext = IMAGE_TYPES[String(req.headers['content-type'] ?? '').split(';')[0]];
  if (!ext || !Buffer.isBuffer(req.body) || !req.body.length) return bad(res, 'Chỉ nhận ảnh PNG, JPG, WEBP hoặc GIF.');
  fs.mkdirSync(GUEST_DIR, { recursive: true });
  // A new name on every upload, so no browser keeps showing the old picture
  const file = `${id}-${Date.now().toString(36)}.${ext}`;
  fs.writeFileSync(path.join(GUEST_DIR, file), req.body);
  ok(res, { image: file });
});

// Pictures no guest uses any more (replaced or guest removed); recent uploads are kept,
// as their guest may not be saved yet
function cleanGuestImages() {
  const used = new Set(engine.settings.guests.map((g) => g.image));
  try {
    for (const f of fs.readdirSync(GUEST_DIR)) {
      const full = path.join(GUEST_DIR, f);
      if (!used.has(f) && Date.now() - fs.statSync(full).mtimeMs > 10 * 60 * 1000) fs.rmSync(full, { force: true });
    }
  } catch {
    // no guest pictures yet
  }
}
setInterval(cleanGuestImages, 10 * 60 * 1000);

app.use('/guest-img', express.static(GUEST_DIR));

// ---------- static ----------

app.use('/music', express.static(MUSIC_DIR));

app.use((err: { type?: string; status?: number }, _req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (err?.type === 'entity.too.large') return bad(res, 'Ảnh quá lớn, tối đa 4 MB.', 413);
  next(err);
});

function alreadyRunning() {
  console.error(`\n  ✿ Hoa Đăng Live đã đang chạy ở một cửa sổ khác (cổng ${PORT} đang bận).`);
  console.error(`  Mở trang điều khiển: http://localhost:${PORT}\n  Hoặc đóng cửa sổ cũ rồi chạy lại.\n`);
  process.exit(1);
}

const portFree = () =>
  new Promise<boolean>((resolve) => {
    const probe = net.createServer();
    probe.once('error', () => resolve(false));
    probe.once('listening', () => probe.close(() => resolve(true)));
    probe.listen(PORT, '127.0.0.1');
  });

async function start() {
  // Check first: a second copy must not rebuild the pages under the one that is live
  if (!(await portFree())) alreadyRunning();

  // --prod (CHAY-LIVE.bat): build once, then serve the pre-built pages, which load fast
  // and never trigger a dev reload mid-live
  if (process.env.NODE_ENV === 'production' || process.argv.includes('--prod')) {
    console.log('  Đang chuẩn bị giao diện...');
    const { build } = await import('vite');
    await build({ logLevel: 'warn' });
    const dist = path.join(process.cwd(), 'dist');
    app.use(express.static(dist));
    app.use((_req, res) => res.sendFile(path.join(dist, 'index.html')));
  } else {
    const { createServer } = await import('vite');
    const vite = await createServer({
      // LIVE_MODE=1 (CHAY-LIVE.bat): no hot reload, so saving a file never reloads the stage mid-live
      server: { middlewareMode: true, hmr: process.env.LIVE_MODE === '1' ? false : undefined },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  // Loopback only: the API has no login, so nobody else on the Wi-Fi can drive the live voice
  const server = app.listen(PORT, '127.0.0.1');
  server.on('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'EADDRINUSE') alreadyRunning();
    throw err;
  });
  server.on('listening', () => {
    console.log('');
    console.log('  ✿ Hoa Đăng Live đang chạy');
    console.log(`  Trang điều khiển : http://localhost:${PORT}`);
    console.log(`  Link cho LIVE Studio: http://lvh.me:${PORT}/?view=stage   (1080 x 1920)`);
    console.log('  Đóng cửa sổ này là tắt app.');
    console.log('');
  });
}

void start();

process.on('uncaughtException', (err) => console.error('[Lỗi]', err));
process.on('unhandledRejection', (err) => console.error('[Lỗi]', err));
