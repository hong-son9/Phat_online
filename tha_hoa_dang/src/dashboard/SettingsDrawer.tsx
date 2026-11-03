import { useEffect, useState, type ReactNode } from 'react';
import { Crown, MessageCircle, Music, Palette, RotateCcw, Shield, Volume2, Play } from 'lucide-react';
import type { Settings, Snapshot } from '../../shared/types';
import { api, patchSettings } from '../lib/api';
import { Drawer, Field, Slider, Toggle, useToast } from './ui';
import { GuestsTab } from './GuestsTab';

type TabKey = 'display' | 'voice' | 'interact' | 'guests' | 'audio' | 'filter' | 'session';
const TABS: Array<[TabKey, string, ReactNode]> = [
  ['display', 'Hiển thị', <Palette size={15} />],
  ['voice', 'Giọng đọc', <Volume2 size={15} />],
  ['interact', 'Tương tác', <MessageCircle size={15} />],
  ['guests', 'Khách quý', <Crown size={15} />],
  ['audio', 'Âm thanh', <Music size={15} />],
  ['filter', 'Lọc & chặn', <Shield size={15} />],
  ['session', 'Phiên', <RotateCcw size={15} />],
];

const TRACK_NAMES: Record<string, string> = {
  'builtin:calm': 'Thư thái (chuông gió, nhạc dịu)',
  'builtin:bowls': 'Chuông xoay (tiếng chuông ngân)',
  'builtin:rain': 'Mưa nhẹ (tiếng mưa, chuông gió)',
};

type DeepPartial<T> = { [K in keyof T]?: T[K] extends object ? (T[K] extends unknown[] ? T[K] : DeepPartial<T[K]>) : T[K] };

export function SettingsDrawer({ open, onClose, snap, initialTab }: { open: boolean; onClose: () => void; snap: Snapshot; initialTab?: TabKey }) {
  const [tab, setTab] = useState<TabKey>('display');
  useEffect(() => {
    if (open && initialTab) setTab(initialTab);
  }, [open, initialTab]);
  const toast = useToast();
  const s = snap.settings;
  const save = async (patch: DeepPartial<Settings>, msg = 'Đã lưu') => {
    const r = await patchSettings(patch);
    toast(r.ok ? msg : r.error, r.ok ? 'ok' : 'err');
  };

  return (
    <Drawer open={open} onClose={onClose} title="Cài đặt" width={540}>
      <div className="flex flex-wrap gap-1 px-4 pt-3 pb-2 border-b border-ink-700 sticky top-0 bg-ink-900 z-10">
        {TABS.map(([k, label, icon]) => (
          <button key={k} onClick={() => setTab(k)} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] whitespace-nowrap ${tab === k ? 'bg-ink-700 text-gold-100' : 'text-[#9c8a77] hover:text-[#e9dccb]'}`}>
            {icon}
            {label}
          </button>
        ))}
      </div>
      <div className="px-5 py-4">
        {tab === 'display' && <DisplayTab s={s} save={save} />}
        {tab === 'voice' && <VoiceTab s={s} save={save} />}
        {tab === 'interact' && <InteractTab s={s} save={save} />}
        {tab === 'audio' && <AudioTab s={s} save={save} music={snap.music} />}
        {tab === 'filter' && <FilterTab s={s} save={save} />}
        {tab === 'guests' && <GuestsTab guests={s.guests} channel={s.channelName} />}
        {tab === 'session' && <SessionTab />}
      </div>
    </Drawer>
  );
}

type TabProps = { s: Settings; save: (p: DeepPartial<Settings>, msg?: string) => void };

function TextSetting({ label, hint, value, onSave, max = 60, placeholder }: { label: ReactNode; hint?: ReactNode; value: string; onSave: (v: string) => void; max?: number; placeholder?: string }) {
  const [v, setV] = useState(value);
  useEffect(() => setV(value), [value]);
  const dirty = v.trim() !== value;
  return (
    <Field label={label} hint={hint}>
      <div className="flex gap-2">
        <input className="input" value={v} maxLength={max} placeholder={placeholder} onChange={(e) => setV(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && dirty && onSave(v.trim())} />
        <button className="btn btn-gold" disabled={!dirty || !v.trim()} onClick={() => onSave(v.trim())}>
          Lưu
        </button>
      </div>
    </Field>
  );
}

function ListSetting({ label, hint, value, onSave, placeholder }: { label: ReactNode; hint?: ReactNode; value: string[]; onSave: (v: string[]) => void; placeholder?: string }) {
  const [v, setV] = useState(value.join('\n'));
  useEffect(() => setV(value.join('\n')), [value]);
  const parsed = v.split(/[\n,]/).map((x) => x.trim()).filter(Boolean);
  const dirty = parsed.join('|') !== value.join('|');
  return (
    <Field label={label} hint={hint}>
      <textarea className="input h-24 resize-y font-mono text-[13px]" value={v} placeholder={placeholder} onChange={(e) => setV(e.target.value)} />
      <div className="flex justify-end mt-2">
        <button className="btn btn-gold" disabled={!dirty} onClick={() => onSave(parsed)}>
          Lưu
        </button>
      </div>
    </Field>
  );
}

function DisplayTab({ s, save }: TabProps) {
  return (
    <>
      <TextSetting label="Tên kênh" hint="Hiện trên sân khấu, trên bảng cổng bên kia sông và là tên giọng đọc dùng để xưng hô." value={s.channelName} max={40} onSave={(v) => save({ channelName: v }, 'Đã đổi tên kênh')} />
      <TextSetting label="Dòng phụ dưới tên kênh" value={s.subtitle} max={80} onSave={(v) => save({ subtitle: v })} />
      <Field label="Chất lượng đồ họa" hint="Máy yếu hoặc LIVE Studio bị giật thì chọn Vừa hoặc Nhẹ.">
        <Segmented value={s.graphics.quality} options={[['high', 'Đẹp'], ['medium', 'Vừa'], ['low', 'Nhẹ']]} onChange={(v) => save({ graphics: { quality: v as Settings['graphics']['quality'] } })} />
      </Field>
      <Field label="Không khí">
        <Segmented value={s.graphics.theme} options={[['dusk', '🌇 Hoàng hôn trên sông'], ['night', '🌙 Đêm trăng']]} onChange={(v) => save({ graphics: { theme: v as 'dusk' | 'night' } })} />
      </Field>
      <Toggle on={s.graphics.captions} onChange={(v) => save({ graphics: { captions: v } })} label="Phụ đề giọng đọc" hint="Hiện chữ của câu đang đọc trên sân khấu, chữ sáng dần theo giọng." />
      <Toggle on={s.graphics.hints} onChange={(v) => save({ graphics: { hints: v } })} label="Gợi ý cho người xem" hint="Thẻ nhỏ đổi lần lượt: cách thả hoa đăng, thả cá, thả tim, comment điều mong cầu." />
      <div className="mt-3 pt-3 border-t border-ink-700">
        <div className="text-[13px] font-semibold text-gold-200 mb-1">Hiệu ứng tự động</div>
        <p className="text-xs text-[#9c8a77] mb-1">Tắt ở đây thì sự kiện không tự kích hoạt hiệu ứng nữa. Các nút Hiệu ứng nhanh vẫn dùng được.</p>
        <Toggle on={s.effects.rain} onChange={(v) => save({ effects: { rain: v } })} label="Sông đầy hoa đăng khi đủ tim" hint="Tắt thì thanh tim vẫn chạy, đầy thì đếm lại, nhưng không có hiệu ứng." />
        <Toggle on={s.effects.bloom} onChange={(v) => save({ effects: { bloom: v } })} label="Sen vàng nở, trăng sáng rực khi có quà" />
        <Toggle on={s.effects.lanterns} onChange={(v) => save({ effects: { lanterns: v } })} label="Đèn trời khi có quà lớn" />
        <Toggle on={s.effects.spotlight} onChange={(v) => save({ effects: { spotlight: v } })} label="Máy quay áp sát người tặng quà" hint="Tắt thì sân khấu luôn giữ toàn cảnh cây cầu." />
      </div>
      <Toggle on={s.graphics.disclaimer} onChange={(v) => save({ graphics: { disclaimer: v } })} label="Dòng lưu ý chạy chữ" hint="“Không gian thư giãn mang tính giải trí... quà tặng không phải cúng dường”. Nên giữ bật." />
    </>
  );
}

function Segmented({ value, options, onChange }: { value: string; options: Array<[string, string]>; onChange: (v: string) => void }) {
  return (
    <div className="flex gap-1 p-1 rounded-xl bg-ink-950 border border-ink-700">
      {options.map(([k, label]) => (
        <button key={k} onClick={() => onChange(k)} className={`flex-1 px-3 py-1.5 rounded-lg text-[13px] transition ${value === k ? 'bg-gold-400 text-ink-950 font-semibold' : 'text-[#b8a693] hover:text-[#efe3d3]'}`}>
          {label}
        </button>
      ))}
    </div>
  );
}

function VoiceTab({ s, save }: TabProps) {
  const [voices, setVoices] = useState<Array<{ id: string; label: string }>>([]);
  const [playing, setPlaying] = useState(false);
  useEffect(() => {
    fetch('/api/voices').then((r) => r.json()).then(setVoices).catch(() => {});
  }, []);
  const preview = (voice = s.voice.name) => {
    setPlaying(true);
    const a = new Audio(`/api/tts/preview?voice=${encodeURIComponent(voice)}&text=${encodeURIComponent(`A Di Đà Phật, ${s.channelName} xin chào bạn Minh Anh vừa ghé lên cầu. Chúc bạn một ngày bình an.`)}`);
    a.onended = a.onerror = () => setPlaying(false);
    a.play().catch(() => setPlaying(false));
  };
  return (
    <>
      <Field label="Giọng" hint="Nghe thử chỉ phát trên máy này, không lên live.">
        <div className="flex flex-col gap-2">
          {voices.map((v) => (
            <div key={v.id} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border cursor-pointer ${s.voice.name === v.id ? 'border-gold-400 bg-gold-500/10' : 'border-ink-700 hover:border-ink-600'}`} onClick={() => save({ voice: { name: v.id } }, 'Đã đổi giọng')}>
              <span className={`w-4 h-4 rounded-full border-2 ${s.voice.name === v.id ? 'border-gold-400 bg-gold-400 shadow-[inset_0_0_0_2px_#15100c]' : 'border-ink-600'}`} />
              <span className="flex-1 text-sm">{v.label}</span>
              <button className="btn btn-ghost !py-1 !px-2 text-xs" disabled={playing} onClick={(e) => (e.stopPropagation(), preview(v.id))}>
                <Play size={12} /> Nghe thử
              </button>
            </div>
          ))}
        </div>
      </Field>
      <Slider label="Tốc độ đọc" value={s.voice.rate} min={0.7} max={1.3} step={0.05} format={(v) => `${v.toFixed(2)}×`} onChange={(v) => save({ voice: { rate: v } })} />
      <Slider label="Cao độ" value={s.voice.pitch} min={-15} max={15} step={1} format={(v) => (v > 0 ? `+${v}%` : `${v}%`)} onChange={(v) => save({ voice: { pitch: v } })} />
      <Slider label="Âm lượng giọng" value={s.voice.volume} min={0} max={1} step={0.05} format={(v) => `${Math.round(v * 100)}%`} onChange={(v) => save({ voice: { volume: v } })} />
      <div className="mt-4 pt-4 border-t border-ink-700">
        <div className="text-[13px] font-semibold text-gold-200 mb-1">Giọng đọc tự động đọc gì</div>
        <Toggle on={s.read.gifts} onChange={(v) => save({ read: { gifts: v } })} label="Cảm ơn người tặng quà" hint="Gộp combo thành một câu, đọc trước mọi câu khác, kèm một lời chúc." />
        <Toggle on={s.read.joins} onChange={(v) => save({ read: { joins: v } })} label="Chào người mới vào" hint="Gộp 3 tên một câu, mỗi người chào một lần. Phòng quá đông thì ưu tiên người vào gần nhất." />
        <Toggle on={s.read.wishes} onChange={(v) => save({ read: { wishes: v } })} label="Chúc theo điều người xem cầu" hint="Nhận ra thi cử, sức khỏe, tình duyên, gia đình, công việc, tài lộc, đi xa, bình an, đang buồn. Không bao giờ đọc nguyên văn comment." />
        <Toggle on={s.read.follows} onChange={(v) => save({ read: { follows: v } })} label="Cảm ơn người theo dõi" />
        <Toggle on={s.read.shares} onChange={(v) => save({ read: { shares: v } })} label="Cảm ơn người chia sẻ live" />
        <Toggle on={s.read.likeGoal} onChange={(v) => save({ read: { likeGoal: v } })} label="Báo khi đủ tim, sông đầy hoa đăng" />
        <Toggle on={s.read.idle} onChange={(v) => save({ read: { idle: v } })} label="Tự gửi lời chúc khi live im lặng" />
        {s.read.idle && <Slider label="Im lặng bao lâu thì chúc" value={s.idleSeconds} min={30} max={300} step={10} format={(v) => `${v} giây`} onChange={(v) => save({ idleSeconds: v })} />}
        <Toggle on={s.read.shareReminder} onChange={(v) => save({ read: { shareReminder: v } })} label="Định kỳ nhắc chia sẻ live" hint="Kèm lời cảm ơn những người vừa trò chuyện." />
        {s.read.shareReminder && <Slider label="Mỗi" value={s.shareReminderMinutes} min={2} max={30} step={1} format={(v) => `${v} phút`} onChange={(v) => save({ shareReminderMinutes: v })} />}
      </div>
    </>
  );
}

function InteractTab({ s, save }: TabProps) {
  return (
    <>
      <ListSetting label="Từ khóa thả hoa đăng" hint="Comment có chứa một trong các từ này thì người đó ra lan can thả một ngọn hoa đăng. Không phân biệt dấu, hoa thường, khoảng trắng (“Hoa Đăng” cũng tính). Mỗi dòng một từ." value={s.keywords} onSave={(v) => save({ keywords: v })} placeholder="hoadang" />
      <ListSetting label="Từ khóa thả cá (phóng sinh)" hint="Comment có chứa một trong các từ này thì người đó thả một chú cá xuống sông. Nếu comment có cả hai loại từ khóa thì thả cá." value={s.fishKeywords} onSave={(v) => save({ fishKeywords: v })} placeholder="phongsinh" />
      <Slider label="Số tim để sông đầy hoa đăng" value={s.likeGoal} min={50} max={5000} step={50} format={(v) => `${v} tim`} onChange={(v) => save({ likeGoal: v })} />
      <Slider label="Sông đầy hoa đăng kéo dài" value={s.rainSeconds} min={15} max={180} step={5} format={(v) => `${v} giây`} onChange={(v) => save({ rainSeconds: v })} />
      <div className="mt-2 pt-3 border-t border-ink-700">
        <div className="text-[13px] font-semibold text-gold-200 mb-1">Tính điểm bảng TOP</div>
        <Slider label="Điểm mỗi bình luận" value={s.pointsPerComment} min={0} max={10} step={1} onChange={(v) => save({ pointsPerComment: v })} />
        <Slider label="Điểm mỗi xu quà" value={s.pointsPerCoin} min={0} max={50} step={1} onChange={(v) => save({ pointsPerCoin: v })} />
      </div>
      <div className="mt-2 pt-3 border-t border-ink-700">
        <Toggle on={s.autoReconnect} onChange={(v) => save({ autoReconnect: v })} label="Tự kết nối lại TikTok" hint="Rớt mạng thì tự nối lại; hết live thì chờ phiên sau và tự vào." />
      </div>
    </>
  );
}

function AudioTab({ s, save, music }: TabProps & { music: string[] }) {
  return (
    <>
      <Toggle on={s.audio.music} onChange={(v) => save({ audio: { music: v } })} label="Nhạc nền" hint="Tự nhỏ lại khi giọng đọc nói." />
      {s.audio.music && (
        <>
          <Field label="Bản nhạc" hint={<>3 bản đầu được tạo tự động, không lo bản quyền. Muốn dùng nhạc riêng: bỏ file .mp3 vào thư mục <code className="text-gold-200">music</code> trong thư mục app.</>}>
            <div className="flex flex-col gap-1.5">
              {music.map((m) => (
                <button key={m} onClick={() => save({ audio: { musicTrack: m } })} className={`text-left px-3 py-2 rounded-xl border text-sm ${s.audio.musicTrack === m ? 'border-gold-400 bg-gold-500/10' : 'border-ink-700 hover:border-ink-600'}`}>
                  {TRACK_NAMES[m] ?? `🎵 ${m.replace(/^file:/, '')}`}
                </button>
              ))}
            </div>
          </Field>
          <Slider label="Âm lượng nhạc" value={s.audio.musicVolume} min={0} max={1} step={0.05} format={(v) => `${Math.round(v * 100)}%`} onChange={(v) => save({ audio: { musicVolume: v } })} />
        </>
      )}
      <Toggle on={s.audio.sfx} onChange={(v) => save({ audio: { sfx: v } })} label="Hiệu ứng âm thanh" hint="Chuông khi có quà lớn, mõ khi có người gõ từ khóa, tiếng nước khi hoa đăng hay cá chạm mặt sông, chuông gió khi sen nở." />
      {s.audio.sfx && <Slider label="Âm lượng hiệu ứng" value={s.audio.sfxVolume} min={0} max={1} step={0.05} format={(v) => `${Math.round(v * 100)}%`} onChange={(v) => save({ audio: { sfxVolume: v } })} />}
    </>
  );
}

function FilterTab({ s, save }: TabProps) {
  return (
    <>
      <ListSetting label="Từ cấm thêm" hint="Đã có sẵn danh sách từ tục, cờ bạc, lừa đảo. Thêm từ riêng ở đây: comment chứa từ này sẽ bị che ***, tên chứa từ này sẽ không được đọc. Mỗi dòng một từ hoặc cụm từ." value={s.bannedWords} onSave={(v) => save({ bannedWords: v })} placeholder="tu can chan" />
      <Field label={`Người bị chặn (${s.blockedUsers.length})`} hint="Chặn từ bảng Hoạt động (rê chuột vào một dòng). Người bị chặn không hiện trên sân khấu và không được đọc tên.">
        {s.blockedUsers.length === 0 ? (
          <p className="text-xs text-[#6d5d4f]">Chưa chặn ai.</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {s.blockedUsers.map((b) => (
              <span key={b} className="flex items-center gap-1 text-xs pl-2.5 pr-1 py-1 rounded-full bg-ink-800 border border-ink-700">
                {b}
                <button className="px-1 text-[#9c8a77] hover:text-gold-200" title="Bỏ chặn" onClick={() => api('/api/viewer', { id: b, action: 'unblock' })}>
                  ×
                </button>
              </span>
            ))}
          </div>
        )}
      </Field>
    </>
  );
}

function SessionTab() {
  const toast = useToast();
  const reset = async (what: string, label: string) => {
    if (!confirm(`${label}? Không hoàn tác được.`)) return;
    const r = await api('/api/session/reset', { what });
    toast(r.ok ? 'Đã làm mới' : r.error, r.ok ? 'ok' : 'err');
  };
  return (
    <>
      <p className="text-sm text-[#b8a693] leading-relaxed mb-4">
        Người trên cầu, bảng TOP và thanh tim được lưu trên máy, nên tải lại trang hay tắt mở app trong vòng 6 giờ vẫn giữ nguyên. Bắt đầu buổi live mới thì làm mới tại đây.
      </p>
      <div className="flex flex-col gap-2">
        <button className="btn btn-danger justify-start" onClick={() => reset('all', 'Bắt đầu phiên mới (xóa tất cả)')}>
          <RotateCcw size={15} /> Bắt đầu phiên mới (xóa hết)
        </button>
        <button className="btn btn-ghost justify-start" onClick={() => reset('top', 'Xóa bảng TOP')}>Chỉ xóa bảng TOP</button>
        <button className="btn btn-ghost justify-start" onClick={() => reset('hall', 'Mời mọi người xuống cầu')}>Chỉ làm trống cây cầu</button>
        <button className="btn btn-ghost justify-start" onClick={() => reset('likes', 'Đặt lại thanh tim')}>Chỉ đặt lại thanh tim</button>
      </div>
    </>
  );
}
