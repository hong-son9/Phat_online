// Text helpers: accent-free matching, banned-word filter, names the voice can read, wish detection

// "Cầu Bình An!" -> " cau binh an " (lowercase, no accents, single spaces, padded for whole-word matching)
export const plain = (text: string) =>
  ` ${text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()} `;

// Letters only, no spaces: "A Di Đà Phật 🙏" -> "adidaphat"
export const squash = (text: string) => plain(text).replace(/ /g, '');

export function hasKeyword(text: string, keywords: string[]): boolean {
  const s = squash(text);
  return keywords.some((k) => {
    const key = squash(k);
    return key.length > 0 && s.includes(key);
  });
}

// Vulgar, sexual, drugs, gambling, scam words. Compared token by token on the accented text so
// ordinary words ("lớn", "các") are not caught. Extend from the dashboard (Cài đặt > Lọc từ).
const BANNED_TOKENS = new Set([
  'lồn', 'lìn', 'cặc', 'buồi', 'đéo', 'địt', 'đụ', 'đĩ', 'cứt', 'đm', 'đmm', 'đcm', 'đkm', 'dm', 'dmm',
  'dcm', 'dkm', 'vcl', 'vkl', 'vcc', 'clgt', 'loz', 'dit', 'ditme', 'dume', 'cmm', 'fuck', 'fck', 'fuk',
  'shit', 'bitch', 'dick', 'pussy', 'sex', 'sexy', 'porn', 'nude', 'xxx', 'casino', 'scam',
]);
const BANNED_PHRASES = [
  'địt mẹ', 'đụ má', 'đù má', 'đéo mẹ', 'con đĩ', 'dit me', 'du ma', 'ma túy', 'ma tuý', 'thuốc lắc',
  'cần sa', 'cá độ', 'lô đề', 'cờ bạc', 'chuyển khoản', 'lừa đảo',
];

let extraTokens = new Set<string>();
let extraPhrases: string[] = [];

export function setCustomBanned(words: string[]) {
  const clean = words.map((w) => w.normalize('NFC').toLowerCase().trim()).filter(Boolean);
  extraTokens = new Set(clean.filter((w) => !w.includes(' ')));
  extraPhrases = clean.filter((w) => w.includes(' '));
}

const tokensOf = (text: string) =>
  text.normalize('NFC').toLowerCase().split(/[^\p{L}\p{M}\p{N}]+/u).filter(Boolean);
const isBannedToken = (t: string) => BANNED_TOKENS.has(t) || extraTokens.has(t);

export function containsBanned(text: string): boolean {
  if (!text) return false;
  const tokens = tokensOf(text);
  if (tokens.some(isBannedToken)) return true;
  const joined = ` ${tokens.join(' ')} `;
  return [...BANNED_PHRASES, ...extraPhrases].some((p) => joined.includes(` ${p} `));
}

// For text shown on screen: banned words become ***
export function maskBanned(text: string): string {
  if (!containsBanned(text)) return text;
  let out = text.replace(/[\p{L}\p{M}\p{N}]+/gu, (w) => (isBannedToken(w.normalize('NFC').toLowerCase()) ? '***' : w));
  for (const p of [...BANNED_PHRASES, ...extraPhrases]) {
    out = out.replace(new RegExp(p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/ /g, '\\s+'), 'giu'), '***');
  }
  return out;
}

const DIGITS = ['không', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín'];

// A display name the voice can read: fancy letters become plain, emoji and symbols are dropped,
// digits are spelled out, camelCase and snake_case are split. Unreadable or banned names become "bạn".
export function spokenName(name: string): string {
  let clean = (name || '')
    .normalize('NFKC')
    .replace(/[\uFE00-\uFE0F\u200D\u20E3]/g, '')
    .replace(/[^\p{L}\p{M}\p{N}\s._-]/gu, ' ')
    .normalize('NFC')
    .replace(/(\p{Ll})(\p{Lu})/gu, '$1 $2')
    .replace(/(\p{L})(\d)/gu, '$1 $2')
    .replace(/(\d)(\p{L})/gu, '$1 $2')
    .replace(/[._-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!clean || containsBanned(clean)) return 'bạn';
  clean = clean
    .split(' ')
    .map((w) => (/^\d+$/.test(w) ? (w.length > 4 ? '' : w.split('').map((d) => DIGITS[+d]).join(' ')) : w))
    .filter(Boolean)
    .join(' ');
  // Very long names (bios pasted as names) are cut to the first few words
  const words = clean.split(' ');
  if (words.length > 8) clean = words.slice(0, 8).join(' ');
  return clean || 'bạn';
}

// "a, b và c"
export function joinNames(names: string[]): string {
  if (names.length <= 1) return names[0] || '';
  return `${names.slice(0, -1).join(', ')} và ${names[names.length - 1]}`;
}

export type WishTopic = 'exam' | 'health' | 'love' | 'family' | 'work' | 'wealth' | 'travel' | 'peace' | 'sad';

export const WISH_LABELS: Record<WishTopic, string> = {
  exam: 'Thi cử, học hành',
  health: 'Sức khỏe',
  love: 'Tình duyên',
  family: 'Gia đình',
  work: 'Công việc',
  wealth: 'Tài lộc',
  travel: 'Đi xa',
  peace: 'Bình an',
  sad: 'Đang buồn',
};

// Words that show the comment is asking for something
const WISH_WORDS = [' mong ', ' cau ', ' xin ', ' nguyen ', ' phu ho ', ' uoc ', ' muon ', ' gia ho ', ' chuc ', ' cau cho ', ' hy vong ', ' hi vong '];
// Feelings that deserve a gentle word even without a request
const SAD_WORDS = [' buon qua ', ' met moi ', ' that tinh ', ' chan qua ', ' co don ', ' stress ', ' ap luc ', ' khoc ', ' mat ngu ', ' tuyet vong '];

// Checked in order; the first topic with a match wins
const TOPICS: Array<[WishTopic, string[]]> = [
  ['exam', [' thi ', ' diem ', ' dai hoc ', ' tot nghiep ', ' kiem tra ', ' hoc gioi ', ' hoc tot ', ' ielts ', ' toeic ', ' bang lai ', ' bao ve ', ' luan van ', ' thi do ']],
  ['health', [' suc khoe ', ' khoe ', ' khoi benh ', ' benh ', ' het om ', ' dang om ', ' bi om ', ' phau thuat ', ' ca mo ', ' nam vien ', ' het dau ', ' binh phuc ', ' sinh no ', ' me tron con vuong ']],
  ['love', [' nguoi yeu ', ' tinh duyen ', ' ny ', ' crush ', ' lay chong ', ' lay vo ', ' cuoi ', ' quay lai ', ' nguoi thuong ', ' duyen ', ' tinh yeu ']],
  ['family', [' gia dinh ', ' gia dao ', ' con cai ', ' bo me ', ' cha me ', ' ba me ', ' em be ', ' sinh con ', ' mang thai ', ' co con ', ' vo chong ', ' ong ba ']],
  ['work', [' viec ', ' cong viec ', ' phong van ', ' thang chuc ', ' tang luong ', ' di lam ', ' xin viec ', ' du an ', ' sep ']],
  ['wealth', [' tien ', ' tai loc ', ' lam an ', ' buon ban ', ' kinh doanh ', ' giau ', ' tra no ', ' het no ', ' tai chinh ', ' ban hang ', ' don hang ', ' khach hang ', ' mua nha ']],
  ['travel', [' di xa ', ' xuat khau lao dong ', ' di nuoc ngoai ', ' du hoc ', ' len duong ', ' thuong lo binh an ', ' ve que ']],
  ['peace', [' binh an ', ' an lanh ', ' tai qua ', ' qua nan ', ' het xui ', ' giai han ', ' thuan loi ', ' may man ', ' suon se ', ' bot lo ']],
];

export function detectWish(comment: string): WishTopic | null {
  const t = plain(comment);
  const asking = WISH_WORDS.some((w) => t.includes(w));
  if (asking) {
    for (const [topic, words] of TOPICS) if (words.some((w) => t.includes(w))) return topic;
  }
  if (SAD_WORDS.some((w) => t.includes(w))) return 'sad';
  return null;
}
