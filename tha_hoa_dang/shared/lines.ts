import type { WishTopic } from './text';

// Every line the voice can say. {channel} = channel name, {name} = one viewer, {names} = "bạn A, bạn B và bạn C".
// Gifts are thanked as gifts; no line ties a gift to luck, merit or an offering (this is a relaxation space).

export const JOIN_LINES = [
  '{channel} xin chào {names} vừa ghé lên cầu.',
  '{channel} chào {names}, mời bạn đứng bên lan can ngắm sông trăng một chút cho lòng nhẹ nhàng.',
  'Xin chào {names}, chúc bạn có những phút giây an yên bên dòng sông này.',
  'A Di Đà Phật, chào mừng {names} đã ghé bến hoa đăng.',
];

export const GUEST_GREETING = '{channel} xin trân trọng chào đón {title} {name} đã ghé bến sông. Chúc bạn một buổi tối thật an yên.';

export const GIFT_LINES = [
  '{channel} cảm ơn bạn {name} đã gửi tặng {gift}.',
  'Cảm ơn bạn {name} đã gửi {gift} cho {channel}, mến chúc bạn.',
  'A Di Đà Phật, cảm ơn tấm lòng của bạn {name}, {channel} đã nhận được {gift}.',
];

export const GIFT_BLESSINGS = [
  'Chúc bạn và gia đình luôn mạnh khỏe, trong nhà êm ấm, ngoài đường bình an.',
  'Chúc bạn ngủ ngon, ăn ngon, sáng thức dậy thấy lòng thật nhẹ.',
  'Chúc cha mẹ bạn mạnh khỏe sống lâu, cả nhà sum vầy vui vẻ.',
  'Chúc bạn việc gì đang lo cũng sớm có lối ra, người mình thương luôn ở cạnh.',
  'Chúc bạn có một ngày dịu dàng, gặp toàn người tử tế.',
  'Chúc gia đình bạn trên thuận dưới hòa, tiếng cười lúc nào cũng đầy nhà.',
  'Chúc bạn đi đâu cũng thuận, về nhà có người chờ cơm, lòng lúc nào cũng an.',
];

export const BIG_GIFT_EXTRA = [
  'Một món quà thật lớn, {channel} xin cảm ơn bạn rất nhiều.',
  'Mọi người trên cầu xin cùng gửi lời cảm ơn đến bạn {name}.',
];

export const FOLLOW_LINES = [
  'Cảm ơn bạn {name} đã theo dõi {channel}. Mong bạn ghé chơi thường xuyên nhé.',
  '{channel} cảm ơn bạn {name} đã bấm theo dõi, chúc bạn luôn an vui.',
];

export const SHARE_LINES = [
  'Cảm ơn bạn {name} đã chia sẻ phiên live, thêm một người cùng nghe là thêm một phần ấm áp.',
  '{channel} cảm ơn bạn {name} đã chia sẻ, chúc bạn một ngày bình yên.',
];

export const LIKE_GOAL_LINES = [
  'Cả nhà đã thả đủ {goal} tim, mời mọi người cùng ngắm cả dòng sông hoa đăng.',
  'Cảm ơn cả nhà đã thả tim, hoa đăng đang trôi kín mặt sông rồi đây.',
];

export const WISH_BLESSINGS: Record<WishTopic, string[]> = {
  exam: [
    'Bạn {name} đang lo chuyện thi cử phải không. Chúc bạn ôn đâu trúng đó, vào phòng thi thật bình tĩnh, kết quả như ý.',
    'Chúc bạn {name} học hành tấn tới, đầu óc minh mẫn, thi cử đỗ đạt để cả nhà vui lòng.',
    'Gửi bạn {name}: cố lên nhé, chúc bạn làm bài suôn sẻ và đạt điểm thật cao.',
  ],
  health: [
    'Chúc bạn {name} và người thân sớm khỏe mạnh, ăn ngon ngủ yên, mọi đau mệt sớm qua đi.',
    'Gửi đến bạn {name} lời chúc sức khỏe. Mong người đang mệt sớm bình phục, cả nhà an tâm.',
    'Chúc nhà bạn {name} ai cũng mạnh khỏe, bữa cơm nào cũng đủ mặt mọi người.',
  ],
  love: [
    'Chúc bạn {name} gặp được người thương mình thật lòng, tình cảm êm đềm và bền lâu.',
    'Gửi bạn {name}: duyên đến thì giữ, duyên chưa đến thì cứ thương mình trước nhé. Chúc bạn sớm gặp người hợp ý.',
    'Chúc chuyện tình cảm của bạn {name} luôn ngọt ngào, hai người hiểu và thương nhau nhiều hơn.',
  ],
  family: [
    'Chúc gia đình bạn {name} trên thuận dưới hòa, cha mẹ mạnh khỏe, con cháu ngoan hiền.',
    'Chúc nhà bạn {name} luôn ấm áp, mọi người thương yêu và nhường nhịn nhau.',
    'Gửi đến gia đình bạn {name} lời chúc bình an, trong nhà lúc nào cũng có tiếng cười.',
  ],
  work: [
    'Chúc bạn {name} công việc hanh thông, gặp đồng nghiệp tốt, sớm được như mong muốn.',
    'Chúc bạn {name} tìm được việc ưng ý, làm đâu thuận đó, công sức bỏ ra đều được ghi nhận.',
    'Gửi bạn {name}: chúc dự định sắp tới thật suôn sẻ, mỗi ngày đi làm đều nhẹ nhàng.',
  ],
  wealth: [
    'Chúc bạn {name} làm ăn thuận lợi, buôn bán đắt hàng, chi tiêu đủ đầy.',
    'Chúc bạn {name} tài chính ổn định, nợ nần sớm xong, tiền bạc vào đều tay.',
    'Gửi bạn {name}: chúc khách đến đông vui, công việc kinh doanh ngày một khởi sắc.',
  ],
  travel: [
    'Chúc bạn {name} thượng lộ bình an, đi đến nơi về đến chốn, sớm ngày sum họp.',
    'Gửi bạn {name} đang ở xa nhà: chúc bạn khỏe mạnh, công việc ổn định, người thân ở quê luôn bình an.',
  ],
  peace: [
    'Chúc bạn {name} mọi việc bình an, thuận lợi, đi đâu cũng gặp điều lành.',
    'Chúc bạn {name} tai qua nạn khỏi, những lo lắng sớm nhẹ đi.',
    'Gửi đến bạn {name} lời chúc an lành, mong mỗi ngày của bạn đều yên ổn.',
  ],
  sad: [
    'Bạn {name} ơi, mệt quá thì cứ ngồi đây nghỉ một chút nhé. Hít một hơi thật sâu, mọi chuyện rồi sẽ ổn thôi.',
    'Gửi bạn {name} một cái ôm thật nhẹ. Buồn rồi sẽ qua, mong bạn sớm thấy lòng bình yên trở lại.',
    'Bạn {name} không một mình đâu, mọi người trên cầu đang ở đây cùng bạn. Thả một ngọn hoa đăng cho nỗi buồn trôi đi nhé.',
  ],
};

// Said when the voice has been quiet for a while, followed by a share ask
export const IDLE_BLESSINGS = [
  'A Di Đà Phật. Chúc cả nhà một ngày bình an, công việc thuận lợi, lòng luôn nhẹ nhàng.',
  'Mời cả nhà thả lỏng vai, hít vào thật sâu, thở ra thật chậm, nhìn những ngọn hoa đăng trôi xa. Chúc mọi người có một phút giây thật yên.',
  'Mỗi ngọn hoa đăng trôi đi là một điều muộn phiền được buông xuống. Chúc cả nhà lòng nhẹ như mặt sông đêm nay.',
  'Mong những chú cá được thả về sông hôm nay bơi thật xa, và mong lòng mỗi người cũng rộng rãi như dòng nước.',
  'Chúc ai đang mệt mỏi được nghỉ ngơi, ai đang lo lắng tìm được lối ra, ai đang vui thì vui thêm nữa.',
  'Chúc cả nhà sức khỏe dồi dào, gia đình êm ấm, đi đâu cũng gặp người tử tế.',
  'Mong những điều chưa như ý sẽ dần trôi qua, và ngày mai đến với thật nhiều niềm vui nhỏ.',
  'Chúc các bạn đang học hành, thi cử luôn minh mẫn. Chúc các bạn đang đi làm luôn vững vàng.',
  'Chúc những người con xa nhà luôn bình an, sớm có ngày sum họp bên bữa cơm gia đình.',
  'Hôm nay dù bận rộn đến đâu, mong cả nhà vẫn dành cho mình một khoảng lặng nhỏ. Chúc mọi người an yên.',
  'A Di Đà Phật. Chúc cha mẹ của tất cả mọi người đang xem luôn mạnh khỏe, sống vui bên con cháu.',
  'Chúc cả nhà biết thương mình, thương người, và luôn giữ được nụ cười hiền.',
];

export const SHARE_ASKS = [
  'Ai thấy lòng nhẹ nhõm thì bấm chia sẻ live cho người thân cùng nghe nhé.',
  'Cả nhà nhớ bấm chia sẻ để bạn bè cùng ghé vào nghỉ ngơi một chút nha.',
  'Gõ {keyword} để thả một ngọn hoa đăng, và đừng quên chia sẻ live cho người mình thương nhé.',
  'Ai muốn thả cá về sông thì gõ {fish} nhé. Nhớ chia sẻ live cho bạn bè cùng ghé bến sông.',
];

export const REMINDER_NAMED = [
  '{channel} cảm ơn {names} đã ghé chơi và trò chuyện. Cả nhà nhớ bấm chia sẻ live cho người thân cùng nghe nhé.',
  'Cảm ơn {names} đã đồng hành cùng {channel} nãy giờ. Ai thấy vui thì chia sẻ live giúp kênh nha.',
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
