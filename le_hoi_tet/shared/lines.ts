import type { WishTopic } from './text';

// Every line the voice can say. {channel} = channel name, {name} = one viewer, {names} = "bạn A, bạn B và bạn C",
// {keyword} / {fire} = the first "xin chữ" / "pháo hoa" keyword.
// Gifts are thanked as gifts; no line ties a gift to luck or fortune (this is entertainment, not a lucky draw).

export const JOIN_LINES = [
  'Chúc mừng năm mới! {channel} xin chào {names} vừa ghé hội xuân.',
  '{channel} chào {names}, mời bạn dạo chợ Tết, xin chữ đầu năm cho vui nhé.',
  'Xuân về rồi, chào mừng {names} đã ghé chơi. Chúc bạn năm mới an khang.',
  'Chào {names}! Chúc bạn một năm mới vui vẻ, vạn sự như ý.',
];

export const GUEST_GREETING = 'Chúc mừng năm mới! {channel} xin trân trọng chào đón {title} {name} đã ghé hội xuân. Chúc bạn một năm an khang thịnh vượng.';

export const GIFT_LINES = [
  '{channel} cảm ơn bạn {name} đã gửi tặng {gift}.',
  'Cảm ơn bạn {name} đã gửi {gift} cho {channel}, chúc bạn năm mới thật vui.',
  'Ôi, bạn {name} vừa gửi {gift}. {channel} cảm ơn bạn nhiều lắm.',
];

export const GIFT_BLESSINGS = [
  'Chúc bạn năm mới sức khỏe dồi dào, cả nhà sum vầy, tiếng cười đầy nhà.',
  'Chúc bạn một năm an khang thịnh vượng, vạn sự như ý.',
  'Chúc bạn năm mới công việc hanh thông, đi đâu cũng gặp người tốt.',
  'Chúc cha mẹ bạn mạnh khỏe sống lâu, con cháu sum vầy bên mâm cơm ngày Tết.',
  'Chúc bạn năm mới học hành tấn tới, mọi dự định đều thành.',
  'Chúc bạn một mùa xuân ấm áp, lòng lúc nào cũng nhẹ nhàng, vui tươi.',
  'Chúc gia đình bạn trên thuận dưới hòa, năm mới đầm ấm, an vui.',
];

export const BIG_GIFT_EXTRA = [
  'Một món quà thật lớn, mời đội lân ra múa chúc mừng bạn!',
  'Cả hội xuân xin cùng chúc mừng bạn {name}, lân đã ra múa rồi đây!',
];

export const FOLLOW_LINES = [
  'Cảm ơn bạn {name} đã theo dõi {channel}. Chúc bạn năm mới vạn sự như ý.',
  '{channel} cảm ơn bạn {name} đã bấm theo dõi, năm mới mình cùng vui nhé.',
];

export const SHARE_LINES = [
  'Cảm ơn bạn {name} đã chia sẻ hội xuân, thêm người là thêm vui.',
  '{channel} cảm ơn bạn {name} đã chia sẻ, chúc bạn năm mới may mắn bình an.',
];

export const LIKE_GOAL_LINES = [
  'Cả nhà đã thả đủ {goal} tim, mời mọi người cùng ngắm pháo hoa và mưa hoa đào!',
  'Cảm ơn cả nhà đã thả tim, pháo hoa rực trời rồi đây, chúc mừng năm mới!',
];

// Ông đồ's words: [the word on the scroll, what it wishes]
export const CALLIGRAPHY: Array<[string, string]> = [
  ['Phúc', 'phúc lộc đầy nhà'],
  ['Lộc', 'tài lộc dồi dào'],
  ['Thọ', 'sống lâu, mạnh khỏe'],
  ['An', 'bình an cả năm'],
  ['Tâm', 'lòng luôn an yên'],
  ['Đức', 'sống hiền, gặp lành'],
  ['Nhẫn', 'kiên nhẫn ắt thành công'],
  ['Phát', 'làm ăn phát đạt'],
  ['Hỷ', 'niềm vui ngập tràn'],
  ['Vượng', 'thịnh vượng hanh thông'],
  ['Hiếu', 'gia đình hiếu thảo sum vầy'],
  ['Trí', 'học hành sáng dạ'],
  ['Hòa', 'gia đình hòa thuận'],
  ['Xuân', 'tươi vui như mùa xuân'],
];

export const CALLIGRAPHY_LINES = [
  'Bạn {name} vừa xin được chữ {word}, chúc bạn năm mới {meaning}.',
  'Ông đồ tặng bạn {name} chữ {word}. Chúc bạn {meaning}.',
  'Chữ {word} cho bạn {name}, mong năm nay bạn {meaning}.',
];

export const WISH_BLESSINGS: Record<WishTopic, string[]> = {
  exam: [
    'Năm mới chúc bạn {name} học đâu nhớ đó, thi cử đỗ đạt, làm cha mẹ vui lòng.',
    'Chúc bạn {name} năm nay thi đâu đỗ đó, đầu óc sáng suốt, điểm cao như mong muốn.',
    'Gửi bạn {name}: cố lên nhé, chúc bạn một năm học tập thật nhiều tiến bộ.',
  ],
  health: [
    'Năm mới chúc bạn {name} và gia đình thật nhiều sức khỏe, ăn ngon ngủ yên.',
    'Chúc nhà bạn {name} ai cũng mạnh khỏe, người đang mệt sớm bình phục, đón Tết thật vui.',
    'Gửi bạn {name} lời chúc sức khỏe dồi dào, cả năm không ốm không đau.',
  ],
  love: [
    'Năm mới chúc bạn {name} gặp được người thương thật lòng, xuân này có đôi có cặp.',
    'Chúc chuyện tình cảm của bạn {name} năm nay ngọt ngào, hai người hiểu và thương nhau hơn.',
    'Gửi bạn {name}: duyên lành sẽ tới, chúc bạn một mùa xuân thật ấm áp.',
  ],
  family: [
    'Chúc gia đình bạn {name} năm mới sum vầy, trên thuận dưới hòa, tiếng cười đầy nhà.',
    'Chúc nhà bạn {name} đón Tết đầm ấm, cha mẹ khỏe mạnh, con cháu ngoan hiền.',
    'Gửi đến gia đình bạn {name} lời chúc an khang, mâm cơm ngày Tết đủ đầy mọi người.',
  ],
  work: [
    'Năm mới chúc bạn {name} công việc hanh thông, thăng tiến, gặp sếp tốt đồng nghiệp hiền.',
    'Chúc bạn {name} năm nay tìm được việc ưng ý, làm đâu thuận đó.',
    'Gửi bạn {name}: chúc mọi dự định năm mới đều suôn sẻ, công sức được ghi nhận.',
  ],
  wealth: [
    'Năm mới chúc bạn {name} buôn may bán đắt, làm ăn phát đạt.',
    'Chúc bạn {name} một năm tài chính vững vàng, chi tiêu đủ đầy, nợ nần sớm xong.',
    'Gửi bạn {name}: chúc cửa hàng khách đông, năm mới khởi sắc hơn năm cũ.',
  ],
  travel: [
    'Chúc bạn {name} đường về quê ăn Tết bình an, sớm sum họp bên gia đình.',
    'Gửi bạn {name} đang ở xa nhà: chúc bạn năm mới mạnh khỏe, người thân ở quê luôn bình an.',
  ],
  peace: [
    'Năm mới chúc bạn {name} bình an, thuận lợi, đi đâu cũng gặp điều lành.',
    'Chúc bạn {name} một năm êm ả, những lo lắng của năm cũ đều nhẹ đi.',
    'Gửi bạn {name} lời chúc năm mới an khang, mọi việc như ý.',
  ],
  sad: [
    'Bạn {name} ơi, năm cũ có buồn thì để lại năm cũ nhé. Năm mới chúc bạn vui hơn thật nhiều.',
    'Gửi bạn {name} một cái ôm thật ấm. Xuân về rồi, mọi chuyện rồi sẽ ổn thôi.',
    'Bạn {name} không một mình đâu, cả hội xuân đang ở đây cùng bạn. Chúc bạn sớm vui trở lại.',
  ],
};

// Said when the voice has been quiet for a while, followed by a share ask
export const IDLE_BLESSINGS = [
  'Chúc mừng năm mới! Chúc cả nhà một năm an khang thịnh vượng, vạn sự như ý.',
  'Xuân về rồi, chúc mọi người sức khỏe dồi dào, gia đình sum vầy, tiếng cười đầy nhà.',
  'Chúc những người con xa quê sớm về sum họp, ăn một cái Tết thật ấm áp bên gia đình.',
  'Chúc các bạn học sinh, sinh viên năm mới học hành tấn tới. Chúc các bạn đi làm năm mới thăng tiến.',
  'Năm mới chúc cả nhà tiền vào như nước, nhưng quan trọng hơn là khỏe mạnh và vui vẻ.',
  'Chúc ông bà, cha mẹ của tất cả mọi người đang xem luôn mạnh khỏe, sống vui bên con cháu.',
  'Mời cả nhà dạo một vòng chợ Tết, ngắm hoa đào, hoa mai, xin một chữ đầu năm cho may mắn.',
  'Chúc cả nhà một mùa xuân thật ấm, những điều chưa như ý của năm cũ sẽ nhẹ đi trong năm mới.',
  'Năm mới, chúc mọi người biết thương mình, thương người, và luôn giữ được nụ cười tươi.',
  'Chúc cả nhà đầu năm gặp may, cuối năm gặp lộc, quanh năm gặp toàn người tử tế.',
];

export const SHARE_ASKS = [
  'Ai thấy vui thì bấm chia sẻ live cho người thân cùng vào hội xuân nhé.',
  'Gõ {keyword} để xin chữ đầu năm, gõ {fire} để bắn pháo hoa. Nhớ chia sẻ live cho bạn bè nha.',
  'Cả nhà nhớ bấm chia sẻ để bạn bè cùng ghé chợ Tết, ngắm pháo hoa với mình nhé.',
];

export const REMINDER_NAMED = [
  '{channel} cảm ơn {names} đã ghé hội xuân và trò chuyện. Cả nhà nhớ bấm chia sẻ live cho người thân cùng vui nhé.',
  'Cảm ơn {names} đã đồng hành cùng {channel} nãy giờ. Ai thấy vui thì chia sẻ live giúp kênh nha, chúc mừng năm mới!',
];

export function pick<T>(list: T[], avoid?: { last: number }): T {
  let i = Math.floor(Math.random() * list.length);
  if (avoid && list.length > 1 && i === avoid.last) i = (i + 1) % list.length;
  if (avoid) avoid.last = i;
  return list[i];
}

export function fill(line: string, vars: Record<string, string | number>): string {
  return line.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m));
}
