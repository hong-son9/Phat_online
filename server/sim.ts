import type { Viewer } from '../shared/types';
import type { Engine } from './engine';

// Test mode: fake viewers so the owner can rehearse everything before going live.
// Simulated events go through exactly the same rules as real ones.

const FIRST = ['Minh', 'Lan', 'Hoa', 'Tuấn', 'Thảo', 'Hùng', 'Mai', 'Phúc', 'Ngọc', 'Bảo', 'Linh', 'Khang', 'Yến', 'Tâm', 'An', 'Vy', 'Long', 'Trang', 'Đức', 'Hạnh'];
const LAST = ['Nguyễn', 'Trần', 'Lê', 'Phạm', 'Hoàng', 'Vũ', 'Đặng', 'Bùi', 'Đỗ', 'Ngô'];
const STYLES = [
  (f: string, l: string) => `${l} ${f}`,
  (f: string) => `${f} 🌸`,
  (f: string) => `${f.toLowerCase()}_${Math.floor(Math.random() * 99)}`,
  (f: string) => `Bé ${f}`,
  (f: string, l: string) => `${f} ${l} ✨`,
  (f: string) => `${f}Bình An`,
];

const CHATS = [
  'Chào cả nhà ạ', 'Nghe nhạc thấy nhẹ lòng quá', 'adidaphat', 'A Di Đà Phật 🙏', 'Mong mẹ con sớm khỏe lại',
  'Cầu cho con thi đại học đậu ạ', 'Mong công việc thuận lợi', 'Hôm nay mệt mỏi quá', 'Chúc kênh an yên',
  'Xin cho gia đình bình an', 'Đẹp quá', 'Nam mô a di đà phật', 'Mong buôn bán đắt hàng', 'Cầu tình duyên ạ',
  'Ai cũng bình an nhé', 'Ngồi đây thấy thư thái ghê',
];
const GIFTS: Array<[string, number]> = [
  ['Rose', 1], ['Heart Me', 1], ['Finger Heart', 5], ['Perfume', 20], ['Doughnut', 30], ['Paper Crane', 99], ['Corgi', 299], ['Lion', 29999],
];

const pool: Viewer[] = [];
let seq = 0;

function newViewer(): Viewer {
  const f = FIRST[Math.floor(Math.random() * FIRST.length)];
  const l = LAST[Math.floor(Math.random() * LAST.length)];
  const name = STYLES[Math.floor(Math.random() * STYLES.length)](f, l);
  const v = { id: `thu_${++seq}_${Date.now().toString(36)}`, name, avatar: '' };
  pool.push(v);
  if (pool.length > 200) pool.shift();
  return v;
}

const someone = () => (pool.length && Math.random() < 0.7 ? pool[Math.floor(Math.random() * pool.length)] : newViewer());
const rnd = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];

export type SimRequest = {
  type: 'join' | 'chat' | 'trigger' | 'wish' | 'gift' | 'bigGift' | 'like' | 'follow' | 'share' | 'crowd' | 'burst';
  text?: string;
  name?: string;
  id?: string;
  count?: number;
};

export function simulate(engine: Engine, req: SimRequest) {
  engine.markSim();
  // `id` plays a specific TikTok username (e.g. to try out a guest); `name` alone makes a test viewer
  const id = req.id?.replace(/^@/, '').trim().toLowerCase();
  const who = id
    ? { id, name: req.name?.trim() || id, avatar: '' }
    : req.name?.trim()
      ? { id: `thu_${req.name.trim().toLowerCase()}`, name: req.name.trim(), avatar: '' }
      : null;
  const u = () => who ?? someone();
  switch (req.type) {
    case 'join':
      // a chosen username arrives fresh each time, so the entrance and greeting can be watched again
      if (id) engine.prepareRejoin(id);
      engine.onJoin(who ?? newViewer(), true);
      break;
    case 'chat':
      engine.onChat(u(), req.text?.trim() || rnd(CHATS), true);
      break;
    case 'trigger':
      engine.onChat(u(), engine.settings.keywords[0] ?? 'adidaphat', true);
      break;
    case 'wish':
      engine.onChat(u(), rnd(['Cầu cho con thi đỗ ạ', 'Mong ba mẹ khỏe mạnh', 'Xin cho công việc suôn sẻ', 'Cầu tình duyên', 'Hôm nay buồn quá']), true);
      break;
    case 'gift': {
      const [name, coins] = rnd(GIFTS.slice(0, 5));
      engine.onGift(u(), name, req.count ?? 1, coins, '', true);
      break;
    }
    case 'bigGift': {
      const [name, coins] = rnd(GIFTS.slice(5));
      engine.onGift(u(), name, 1, coins, '', true);
      break;
    }
    case 'like':
      engine.onLike(u(), req.count ?? 50, 0, true);
      break;
    case 'follow':
      engine.onFollow(u(), true);
      break;
    case 'share':
      engine.onShare(u(), true);
      break;
    case 'crowd': {
      const n = Math.min(100, req.count ?? 20);
      for (let i = 0; i < n; i++) setTimeout(() => engine.onJoin(newViewer(), true), i * 250);
      break;
    }
    case 'burst': {
      // 30 seconds of a lively room
      for (let i = 0; i < 40; i++) {
        setTimeout(() => {
          engine.markSim();
          const r = Math.random();
          if (r < 0.3) engine.onJoin(newViewer(), true);
          else if (r < 0.65) engine.onChat(someone(), rnd(CHATS), true);
          else if (r < 0.85) engine.onLike(someone(), 10 + Math.floor(Math.random() * 40), 0, true);
          else if (r < 0.97) {
            const [name, coins] = rnd(GIFTS.slice(0, 5));
            engine.onGift(someone(), name, 1 + Math.floor(Math.random() * 3), coins, '', true);
          } else engine.onFollow(someone(), true);
        }, i * 750);
      }
      break;
    }
  }
}
