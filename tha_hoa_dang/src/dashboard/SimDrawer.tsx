import { useState, type ReactNode } from 'react';
import { Fish, Flame, Gift, Heart, MessageCircle, Share2, Sparkles, UserPlus, Users, Crown, HandHeart, Zap } from 'lucide-react';
import type { Guest } from '../../shared/types';
import { api, patchSettings } from '../lib/api';
import { Drawer, Field, useToast } from './ui';

// Test mode: fake viewers go through exactly the same rules as real TikTok events,
// so the owner can check the stage, voice and LIVE Studio setup before going live.

export function SimDrawer({ open, onClose, guests }: { open: boolean; onClose: () => void; guests: Guest[] }) {
  const toast = useToast();
  const [name, setName] = useState('');
  const [text, setText] = useState('');
  const sim = async (type: string, extra: object = {}, label?: string) => {
    const r = await api('/api/sim', { type, name: name || undefined, ...extra });
    if (!r.ok) toast(r.error, 'err');
    else if (label) toast(label, 'info');
  };
  const B = ({ icon, label, sub, onClick }: { icon: ReactNode; label: string; sub: string; onClick: () => void }) => (
    <button onClick={onClick} className="flex items-start gap-3 text-left p-3 rounded-xl bg-ink-800 border border-ink-700 hover:border-gold-500/50 hover:bg-ink-700 transition">
      <span className="mt-0.5 text-gold-300">{icon}</span>
      <span>
        <span className="block text-sm font-medium">{label}</span>
        <span className="block text-xs text-[#9c8a77] mt-0.5">{sub}</span>
      </span>
    </button>
  );
  return (
    <Drawer open={open} onClose={onClose} title="🧪 Thử nghiệm" width={460}>
      <div className="p-5">
        <p className="text-sm text-[#b8a693] leading-relaxed mb-4">
          Tạo người xem giả để xem trước mọi hiệu ứng và giọng đọc. Sự kiện thử được đánh dấu <span className="text-[10px] px-1 rounded bg-sky-500/15 text-sky-300">thử</span> trong bảng Hoạt động.
          <span className="block mt-1 text-amber-200/80">Nếu đang live thật, mọi thứ ở đây sẽ hiện và được đọc trên live.</span>
        </p>
        <GuestSim guests={guests} name={name} />
        <Field label="Tên người xem (để trống = tên ngẫu nhiên)">
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="VD: Minh Anh 🌸" maxLength={40} />
        </Field>
        <div className="grid grid-cols-2 gap-2 mt-2">
          <B icon={<UserPlus size={17} />} label="Vào xem" sub="Được chào, xếp chỗ sau 8 giây" onClick={() => sim('join')} />
          <B icon={<Flame size={17} />} label="Gõ hoadang" sub="Ra lan can thả hoa đăng" onClick={() => sim('trigger')} />
          <B icon={<Fish size={17} />} label="Gõ phongsinh" sub="Thả cá, cá nhảy rồi bơi đi" onClick={() => sim('fish')} />
          <B icon={<HandHeart size={17} />} label="Comment cầu mong" sub="Giọng đọc chúc đúng điều cầu" onClick={() => sim('wish')} />
          <B icon={<Gift size={17} />} label="Quà nhỏ" sub="Quay cận, hoa đăng vàng, cảm ơn" onClick={() => sim('gift')} />
          <B icon={<Crown size={17} />} label="Quà lớn" sub="Đèn trời, chuông, lời chúc dài" onClick={() => sim('bigGift')} />
          <B icon={<Gift size={17} />} label="Combo x10" sub="Gộp thành một lời cảm ơn" onClick={() => sim('gift', { count: 10 })} />
          <B icon={<Heart size={17} />} label="+100 tim" sub="Đầy thanh là sông đầy hoa đăng" onClick={() => sim('like', { count: 100 })} />
          <B icon={<Sparkles size={17} />} label="Theo dõi" sub="Cảm ơn người theo dõi" onClick={() => sim('follow')} />
          <B icon={<Share2 size={17} />} label="Chia sẻ" sub="Cảm ơn người chia sẻ" onClick={() => sim('share')} />
          <B icon={<Users size={17} />} label="20 người vào" sub="Lấp kín cây cầu" onClick={() => sim('crowd', { count: 20 }, 'Đang cho 20 người vào...')} />
        </div>
        <button onClick={() => sim('burst', {}, 'Mô phỏng 30 giây phòng live sôi động')} className="w-full mt-2 btn btn-gold !py-3">
          <Zap size={16} /> Mô phỏng 30 giây live sôi động
        </button>
        <div className="mt-5 pt-4 border-t border-ink-700">
          <Field label="Gửi comment tùy ý">
            <div className="flex gap-2">
              <input className="input" value={text} onChange={(e) => setText(e.target.value)} placeholder="VD: mong mẹ con mau khỏe" onKeyDown={(e) => e.key === 'Enter' && text.trim() && (sim('chat', { text }), setText(''))} />
              <button className="btn btn-ghost" disabled={!text.trim()} onClick={() => (sim('chat', { text }), setText(''))}>
                <MessageCircle size={15} />
              </button>
            </div>
          </Field>
        </div>
      </div>
    </Drawer>
  );
}

// ---------- guests ----------

const DEMO: Guest = { id: 'khach.quy.mau', title: 'Khách quý', robe: '#e0a526', image: '', greeting: '', frontRow: true, skipQueue: true };

// Play one of the owner's guests: arrive (walks in again and is greeted again each time), talk, float a lantern, give a gift
function GuestSim({ guests, name }: { guests: Guest[]; name: string }) {
  const toast = useToast();
  const [sel, setSel] = useState('');
  const g = guests.find((x) => x.id === sel) ?? guests[0];
  const shownName = name.trim() || (g?.id === DEMO.id ? 'Bảo An' : g?.id ?? '');
  const run = async (type: string, label: string, extra: object = {}) => {
    if (!g) return;
    const r = await api('/api/sim', { type, id: g.id, name: shownName, ...extra });
    toast(r.ok ? label : r.error, r.ok ? 'info' : 'err');
  };
  const makeDemo = async () => {
    const r = await patchSettings({ guests: [...guests, DEMO] });
    if (!r.ok) return toast(r.error, 'err');
    // give the stage a moment to receive the new guest list, so the arrival already shows as a guest's
    await new Promise((res) => setTimeout(res, 600));
    await api('/api/sim', { type: 'join', id: DEMO.id, name: name.trim() || 'Bảo An' });
    toast('Đã tạo khách quý mẫu và cho vào live. Xem ở khung Xem trước.', 'info');
  };
  const hasDemo = guests.some((x) => x.id === DEMO.id);
  const btn = 'flex flex-col items-center gap-1 py-2.5 rounded-xl bg-ink-800 border border-gold-500/25 hover:border-gold-400 hover:bg-ink-700 transition text-[12px]';

  return (
    <section className="mb-4 p-3.5 rounded-xl border border-gold-500/30 bg-gold-500/[0.06]">
      <div className="flex items-center gap-2 mb-2">
        <Crown size={16} className="text-gold-300" />
        <span className="font-semibold text-sm text-gold-100">Thử khách quý</span>
      </div>
      {!g ? (
        <>
          <p className="text-xs text-[#b8a693] leading-relaxed mb-3">Chưa có khách quý nào. Tạo một khách quý mẫu (áo vàng, hào quang, bảng tên vương miện) để xem trên sân khấu.</p>
          <button className="btn btn-gold w-full" onClick={makeDemo}>
            <Crown size={15} /> Tạo khách quý mẫu và cho vào live
          </button>
        </>
      ) : (
        <>
          {guests.length > 1 && (
            <select className="input !py-2 mb-2 text-sm" value={g.id} onChange={(e) => setSel(e.target.value)}>
              {guests.map((x) => (
                <option key={x.id} value={x.id}>@{x.id}{x.title ? ` · ${x.title}` : ''}</option>
              ))}
            </select>
          )}
          {guests.length === 1 && <div className="text-xs text-[#b8a693] mb-2">Đang thử: <b className="text-[#efe3d3]">@{g.id}</b>{g.title && ` · ${g.title}`}</div>}
          <div className="grid grid-cols-4 gap-2">
            <button className={btn} onClick={() => run('join', 'Khách quý đang đi lên cầu')}>
              <UserPlus size={16} className="text-gold-300" /> Vào live
            </button>
            <button className={btn} onClick={() => run('chat', 'Khách quý vừa comment', { text: 'Chào cả nhà, chúc mọi người bình an 🙏' })}>
              <MessageCircle size={16} className="text-gold-300" /> Comment
            </button>
            <button className={btn} onClick={() => run('trigger', 'Khách quý ra thả hoa đăng (ưu tiên)')}>
              <Flame size={16} className="text-gold-300" /> Hoa đăng
            </button>
            <button className={btn} onClick={() => run('gift', 'Khách quý tặng quà')}>
              <Gift size={16} className="text-gold-300" /> Tặng quà
            </button>
          </div>
          <p className="text-[11px] text-[#9c8a77] mt-2 leading-relaxed">Mỗi lần bấm <b>Vào live</b>, nhân vật đi lại từ cửa và lời chào riêng được đọc lại. Đổi ảnh, màu áo ở Cài đặt → Khách quý.</p>
          {hasDemo && (
            <button className="text-[11px] text-[#9c8a77] underline hover:text-red-300 mt-1" onClick={() => patchSettings({ guests: guests.filter((x) => x.id !== DEMO.id) }).then(() => toast('Đã xóa khách quý mẫu', 'info'))}>
              Xóa khách quý mẫu
            </button>
          )}
        </>
      )}
    </section>
  );
}
