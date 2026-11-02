import { useRef, useState } from 'react';
import { Crown, ImagePlus, Pencil, Play, Plus, Trash2, UserPlus, X } from 'lucide-react';
import type { Guest } from '../../shared/types';
import { api, patchSettings } from '../lib/api';
import { Avatar } from '../stage/Overlay';
import { Field, Toggle, useToast } from './ui';

// Settings > Khách quý: viewers the owner picks out by TikTok username. On stage they get their own
// picture, robe colour, a halo, a gold name plate with a title, and their own greeting.

const ROBES: Array<[string, string]> = [
  ['#e0a526', 'Vàng'],
  ['#c0392b', 'Đỏ son'],
  ['#f3ece0', 'Trắng ngà'],
  ['#e86fa0', 'Hồng sen'],
  ['#7b3fbf', 'Tím'],
  ['#1f7a4d', 'Xanh ngọc'],
  ['#2563b0', 'Xanh lam'],
];

const DEFAULT_GREETING = 'A Di Đà Phật, {channel} xin trân trọng chào đón khách quý {name} đã ghé thăm. Chúc bạn một buổi thật an yên.';

const blank = (): Guest => ({ id: '', title: 'Khách quý', robe: ROBES[0][0], image: '', greeting: '', frontRow: true, skipQueue: true });
const imageUrl = (g: Guest) => (g.image ? `/guest-img/${encodeURIComponent(g.image)}` : '');

export function GuestsTab({ guests, channel }: { guests: Guest[]; channel: string }) {
  const toast = useToast();
  const [editing, setEditing] = useState<{ guest: Guest; isNew: boolean } | null>(null);

  const save = async (list: Guest[], msg: string) => {
    const r = await patchSettings({ guests: list });
    toast(r.ok ? msg : r.error, r.ok ? 'ok' : 'err');
    return r.ok;
  };
  const tryJoin = async (g: Guest) => {
    await api('/api/sim', { type: 'join', id: g.id });
    toast(`Đã cho @${g.id} vào thử. Xem ở khung Xem trước.`, 'info');
  };

  if (editing) {
    return (
      <GuestEditor
        initial={editing.guest}
        isNew={editing.isNew}
        channel={channel}
        taken={guests.map((g) => g.id)}
        onCancel={() => setEditing(null)}
        onSave={async (g) => {
          const list = editing.isNew ? [...guests, g] : guests.map((x) => (x.id === g.id ? g : x));
          if (await save(list, editing.isNew ? `Đã thêm khách quý @${g.id}` : 'Đã lưu')) setEditing(null);
        }}
      />
    );
  }

  return (
    <>
      <p className="text-sm text-[#b8a693] leading-relaxed mb-4">
        Chọn người xem theo <b className="text-[#efe3d3]">username TikTok</b> (phần sau dấu @, không phải tên hiển thị). Mỗi lần họ vào live, nhân vật của họ mặc áo màu riêng, to hơn, có hào quang vàng, bảng tên vàng có vương miện, và được chào bằng lời riêng.
      </p>
      <button className="btn btn-gold w-full !py-2.5 mb-4" onClick={() => setEditing({ guest: blank(), isNew: true })}>
        <Plus size={15} /> Thêm khách quý
      </button>
      {guests.length === 0 ? (
        <div className="text-center text-sm text-[#7d6c5d] py-8 border border-dashed border-ink-700 rounded-xl">
          <Crown size={26} className="mx-auto mb-2 opacity-50" />
          Chưa có khách quý nào.
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {guests.map((g) => (
            <li key={g.id} className="flex items-center gap-3 p-3 rounded-xl bg-ink-800 border border-ink-700">
              <div className="rounded-full p-[2px]" style={{ background: g.robe }}>
                <Avatar name={g.id} url={imageUrl(g)} size={40} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="font-semibold truncate">@{g.id}</span>
                  {g.title && <span className="text-[10px] px-1.5 py-px rounded-full bg-gold-500/15 text-gold-200 border border-gold-500/30 whitespace-nowrap">👑 {g.title}</span>}
                </div>
                <div className="text-[11.5px] text-[#9c8a77] mt-0.5 truncate">
                  {[g.image ? 'ảnh riêng' : 'ảnh TikTok', g.greeting ? 'lời chào riêng' : 'lời chào mặc định', g.frontRow && 'hàng đầu', g.skipQueue && 'không xếp hàng'].filter(Boolean).join(' · ')}
                </div>
              </div>
              <button className="btn btn-ghost !px-2 !py-1.5" title="Cho người này vào live thử" onClick={() => tryJoin(g)}>
                <UserPlus size={14} />
              </button>
              <button className="btn btn-ghost !px-2 !py-1.5" title="Sửa" onClick={() => setEditing({ guest: g, isNew: false })}>
                <Pencil size={14} />
              </button>
              <button
                className="btn btn-danger !px-2 !py-1.5"
                title="Xóa"
                onClick={() => confirm(`Xóa khách quý @${g.id}?`) && save(guests.filter((x) => x.id !== g.id), `Đã xóa @${g.id}`)}
              >
                <Trash2 size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function GuestEditor({ initial, isNew, channel, taken, onSave, onCancel }: {
  initial: Guest;
  isNew: boolean;
  channel: string;
  taken: string[];
  onSave: (g: Guest) => void;
  onCancel: () => void;
}) {
  const toast = useToast();
  const [g, setG] = useState<Guest>(initial);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const set = (patch: Partial<Guest>) => setG((x) => ({ ...x, ...patch }));
  const id = g.id.replace(/^@/, '').trim().toLowerCase();
  const idError = !id ? '' : !/^[\w.]{1,40}$/.test(id) ? 'Username chỉ gồm chữ không dấu, số, dấu chấm, gạch dưới.' : isNew && taken.includes(id) ? 'Người này đã có trong danh sách.' : '';

  const upload = async (file: File) => {
    if (!id || idError) return toast('Nhập username trước khi chọn ảnh.', 'err');
    if (file.size > 4 * 1024 * 1024) return toast('Ảnh quá lớn, tối đa 4 MB.', 'err');
    setUploading(true);
    try {
      const r = await fetch(`/api/guests/${encodeURIComponent(id)}/image`, { method: 'PUT', headers: { 'Content-Type': file.type }, body: file });
      const j = await r.json();
      if (j.ok) set({ image: j.image });
      else toast(j.error, 'err');
    } catch {
      toast('Không tải ảnh lên được.', 'err');
    }
    setUploading(false);
  };

  const greetingText = (g.greeting || DEFAULT_GREETING).replace(/\{name\}/g, id || 'bạn').replace(/\{channel\}/g, channel).replace(/\{title\}/g, g.title || 'khách quý');
  const listen = () => new Audio(`/api/tts/preview?text=${encodeURIComponent(greetingText)}`).play().catch(() => {});

  return (
    <>
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-semibold">{isNew ? 'Thêm khách quý' : `Sửa @${initial.id}`}</h3>
        <button className="p-1.5 rounded-lg hover:bg-ink-800 text-[#9c8a77]" onClick={onCancel} aria-label="Hủy">
          <X size={16} />
        </button>
      </div>

      {/* How the name plate will look on stage */}
      <div className="rounded-xl bg-[radial-gradient(circle_at_50%_70%,#3a1a08,#120604)] border border-ink-700 h-28 flex flex-col items-center justify-center gap-1.5 mb-3">
        <div className="lbl-title !static">{g.title || 'Khách quý'}</div>
        <div className="lbl-plate lbl-guest-plate relative" style={{ display: 'flex' }}>
          <span className="lbl-crown">👑</span>
          <div className="lbl-av overflow-hidden" style={{ width: 24, height: 24 }}>
            <Avatar name={id || '?'} url={imageUrl(g)} size={24} />
          </div>
          <span>{id || 'username'}</span>
        </div>
        <div className="w-8 h-10 rounded-t-full mt-0.5 shadow-[0_0_14px_rgba(255,210,100,0.6)]" style={{ background: g.robe }} title="Màu áo" />
      </div>

      <Field label="Username TikTok" hint={idError || 'Phần sau dấu @ trong link trang cá nhân, ví dụ tiktok.com/@bao.nguyen thì nhập bao.nguyen'}>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#7d6c5d]">@</span>
          <input className="input pl-7" value={g.id} disabled={!isNew} maxLength={41} placeholder="username" onChange={(e) => set({ id: e.target.value })} />
        </div>
      </Field>
      <Field label="Danh hiệu" hint="Hiện trên dải ruy băng phía trên tên, ví dụ: Khách quý, Đạo hữu, Admin, Thành viên vàng">
        <input className="input" value={g.title} maxLength={20} onChange={(e) => set({ title: e.target.value })} />
      </Field>
      <Field label="Màu áo">
        <div className="flex flex-wrap items-center gap-2">
          {ROBES.map(([c, name]) => (
            <button key={c} title={name} onClick={() => set({ robe: c })} className={`w-8 h-8 rounded-full border-2 transition ${g.robe === c ? 'border-gold-200 scale-110' : 'border-ink-600 hover:border-ink-500'}`} style={{ background: c }} />
          ))}
          <label className="w-8 h-8 rounded-full border-2 border-dashed border-ink-600 overflow-hidden cursor-pointer relative" title="Màu khác">
            <input type="color" value={g.robe} onChange={(e) => set({ robe: e.target.value })} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
            <span className="absolute inset-0 flex items-center justify-center text-xs text-[#9c8a77]">+</span>
          </label>
        </div>
      </Field>
      <Field label="Ảnh đại diện" hint="PNG, JPG, WEBP hoặc GIF, tối đa 4 MB. Ảnh vuông nhìn đẹp nhất. Để trống thì dùng ảnh TikTok của họ.">
        <div className="flex items-center gap-3">
          <Avatar name={id || '?'} url={imageUrl(g)} size={52} />
          <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="hidden" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
          <button className="btn btn-ghost" disabled={uploading || !id || !!idError} onClick={() => fileRef.current?.click()}>
            <ImagePlus size={15} /> {uploading ? 'Đang tải...' : g.image ? 'Đổi ảnh' : 'Chọn ảnh'}
          </button>
          {g.image && (
            <button className="btn btn-ghost" onClick={() => set({ image: '' })}>
              Dùng ảnh TikTok
            </button>
          )}
        </div>
      </Field>
      <Field label="Lời chào khi vào live" hint={<>Để trống thì dùng lời chào mặc định. <code className="text-gold-200">{'{name}'}</code> là tên của họ, <code className="text-gold-200">{'{channel}'}</code> là tên kênh. Chỉ đọc một lần mỗi phiên.</>}>
        <textarea className="input h-20 resize-y leading-relaxed" value={g.greeting} maxLength={300} placeholder={DEFAULT_GREETING} onChange={(e) => set({ greeting: e.target.value })} />
        <button className="btn btn-ghost mt-2 text-xs !py-1.5" onClick={listen}>
          <Play size={12} /> Nghe thử (chỉ trên máy này)
        </button>
      </Field>
      <Toggle on={g.frontRow} onChange={(v) => set({ frontRow: v })} label="Ngồi hàng đầu" hint="Luôn được xếp vào hai hàng đầu, người thường đang ngồi đó sẽ lùi xuống." />
      <Toggle on={g.skipQueue} onChange={(v) => set({ skipQueue: v })} label="Lên thắp hương không cần xếp hàng" hint="Gõ từ khóa là được ưu tiên lên trước, như người tặng quà." />

      <div className="flex justify-end gap-2 mt-4 pt-4 border-t border-ink-700">
        <button className="btn btn-ghost" onClick={onCancel}>
          Hủy
        </button>
        <button className="btn btn-gold" disabled={!id || !!idError || uploading} onClick={() => onSave({ ...g, id })}>
          {isNew ? 'Thêm' : 'Lưu'}
        </button>
      </div>
    </>
  );
}
