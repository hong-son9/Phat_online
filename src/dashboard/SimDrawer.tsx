import { useState, type ReactNode } from 'react';
import { Flame, Gift, Heart, MessageCircle, Share2, Sparkles, UserPlus, Users, Crown, HandHeart, Zap } from 'lucide-react';
import { api } from '../lib/api';
import { Drawer, Field, useToast } from './ui';

// Test mode: fake viewers go through exactly the same rules as real TikTok events,
// so the owner can check the stage, voice and LIVE Studio setup before going live.

export function SimDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
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
        <Field label="Tên người xem (để trống = tên ngẫu nhiên)">
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="VD: Minh Anh 🌸" maxLength={40} />
        </Field>
        <div className="grid grid-cols-2 gap-2 mt-2">
          <B icon={<UserPlus size={17} />} label="Vào xem" sub="Được chào, xếp chỗ sau 8 giây" onClick={() => sim('join')} />
          <B icon={<Flame size={17} />} label="Gõ adidaphat" sub="Lên thắp hương, lạy 3 lạy" onClick={() => sim('trigger')} />
          <B icon={<HandHeart size={17} />} label="Comment cầu mong" sub="Giọng đọc chúc đúng điều cầu" onClick={() => sim('wish')} />
          <B icon={<Gift size={17} />} label="Quà nhỏ" sub="Quay cận, sen nở, cảm ơn" onClick={() => sim('gift')} />
          <B icon={<Crown size={17} />} label="Quà lớn" sub="Đèn trời, chuông, lời chúc dài" onClick={() => sim('bigGift')} />
          <B icon={<Gift size={17} />} label="Combo x10" sub="Gộp thành một lời cảm ơn" onClick={() => sim('gift', { count: 10 })} />
          <B icon={<Heart size={17} />} label="+100 tim" sub="Đầy thanh là mưa hoa sen" onClick={() => sim('like', { count: 100 })} />
          <B icon={<Sparkles size={17} />} label="Theo dõi" sub="Cảm ơn người theo dõi" onClick={() => sim('follow')} />
          <B icon={<Share2 size={17} />} label="Chia sẻ" sub="Cảm ơn người chia sẻ" onClick={() => sim('share')} />
          <B icon={<Users size={17} />} label="20 người vào" sub="Lấp hội trường" onClick={() => sim('crowd', { count: 20 }, 'Đang cho 20 người vào...')} />
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
