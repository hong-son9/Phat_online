import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  Ban, Bell, CircleStop, CloudOff, CloudRain, Copy, Crown, ExternalLink, Eye, Flame, Flower2, Gift, Hand, HandHeart, Heart, Lamp, LoaderCircle,
  Fish, MessageCircle, Mic, Pause, Play, Plug, Search, Send, Share2, SkipForward, Sparkles, Trash2, UserPlus, Users, Volume2, Wifi, WifiOff, X,
} from 'lucide-react';
import type { FeedItem, Snapshot, VoiceItem, VoiceKind } from '../../shared/types';
import { WISH_LABELS, type WishTopic } from '../../shared/text';
import { api } from '../lib/api';
import { Avatar } from '../stage/Overlay';
import { SectionTitle, copyText, duration, timeAgo, useToast } from './ui';

export const STAGE_URL = `http://lvh.me:${location.port || 80}/?view=stage`;

// ---------- connection ----------

const STATE_INFO: Record<string, { label: string; color: string }> = {
  idle: { label: 'Chưa kết nối', color: 'bg-stone-500' },
  connecting: { label: 'Đang kết nối...', color: 'bg-amber-400' },
  connected: { label: 'Đang LIVE', color: 'bg-emerald-400' },
  waiting: { label: 'Chờ bắt đầu LIVE', color: 'bg-sky-400' },
  reconnecting: { label: 'Đang nối lại...', color: 'bg-amber-400' },
  ended: { label: 'LIVE đã kết thúc', color: 'bg-stone-400' },
  error: { label: 'Lỗi kết nối', color: 'bg-red-500' },
};
export const liveInfo = (state: string) => STATE_INFO[state] ?? STATE_INFO.idle;

export function ConnectionCard({ snap, now }: { snap: Snapshot; now: number }) {
  const toast = useToast();
  const live = snap.live;
  const [user, setUser] = useState(snap.settings.tiktokUsername);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!user && snap.settings.tiktokUsername) setUser(snap.settings.tiktokUsername);
  }, [snap.settings.tiktokUsername]); // eslint-disable-line react-hooks/exhaustive-deps
  const active = live.state !== 'idle' && live.state !== 'error' && live.state !== 'ended';
  const info = liveInfo(live.state);
  const retry = live.nextRetryAt ? Math.max(0, Math.ceil((live.nextRetryAt - now) / 1000)) : 0;

  const connect = async () => {
    setBusy(true);
    const r = await api('/api/live/connect', { username: user });
    setBusy(false);
    if (!r.ok) toast(r.error, 'err');
  };

  return (
    <section className="card p-4">
      <SectionTitle icon={active ? <Wifi size={15} /> : <WifiOff size={15} />}>Kết nối TikTok LIVE</SectionTitle>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#7d6c5d]">@</span>
          <input
            className="input pl-7"
            placeholder="username TikTok"
            value={user}
            disabled={active}
            onChange={(e) => setUser(e.target.value.replace(/^@/, '').trim())}
            onKeyDown={(e) => e.key === 'Enter' && user && connect()}
          />
        </div>
        {active ? (
          <button className="btn btn-danger" onClick={() => api('/api/live/disconnect')}>
            Ngắt
          </button>
        ) : (
          <button className="btn btn-gold" disabled={!user || busy} onClick={connect}>
            {busy ? <LoaderCircle size={15} className="animate-spin" /> : <Plug size={15} />} Kết nối
          </button>
        )}
      </div>
      <div className="mt-3 flex items-center gap-2 text-sm">
        <span className={`w-2.5 h-2.5 rounded-full ${info.color} ${live.state === 'connected' ? 'pulse-dot' : ''}`} />
        <span className="font-medium">{info.label}</span>
        {live.state === 'connected' && <span className="text-[#9c8a77]">· {duration(now - live.since)}</span>}
        {retry > 0 && <span className="text-[#9c8a77]">· thử lại sau {retry}s</span>}
      </div>
      {live.error && live.state !== 'connected' && <p className="mt-2 text-xs leading-relaxed text-amber-200/90 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">{live.error}</p>}
      {live.state === 'idle' && (
        <p className="mt-2 text-xs text-[#9c8a77] leading-relaxed">Có thể bấm kết nối trước khi lên live. App sẽ chờ và tự vào phòng ngay khi bạn bắt đầu phát.</p>
      )}
    </section>
  );
}

// ---------- preview ----------

export function PreviewCard({ snap }: { snap: Snapshot }) {
  const toast = useToast();
  const [safe, setSafe] = useState(false);
  const stage = snap.stages;
  return (
    <section className="card p-4">
      <SectionTitle
        icon={<Eye size={15} />}
        right={
          <label className="flex items-center gap-1.5 text-xs text-[#b8a693] cursor-pointer select-none">
            <input type="checkbox" checked={safe} onChange={(e) => setSafe(e.target.checked)} className="accent-gold-400" />
            Vùng TikTok che
          </label>
        }
      >
        Xem trước
      </SectionTitle>
      <div className="relative mx-auto rounded-xl overflow-hidden border border-ink-700 bg-black" style={{ aspectRatio: '9 / 16', maxHeight: '58vh' }}>
        <iframe key={String(safe)} src={`/?view=preview${safe ? '&safe=1' : ''}`} className="absolute inset-0 w-full h-full" title="Xem trước sân khấu" />
      </div>
      <div className={`mt-3 flex items-center gap-2 text-xs rounded-lg px-3 py-2 border ${stage.audio ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-200' : 'bg-amber-500/10 border-amber-500/25 text-amber-200'}`}>
        {stage.audio ? <Volume2 size={14} /> : <Mic size={14} />}
        {stage.audio
          ? stage.count > 1
            ? `${stage.count} trang sân khấu đang mở, chỉ trang đầu tiên phát tiếng.`
            : 'LIVE Studio đã nhận sân khấu, đang phát âm thanh.'
          : 'Chưa có trang sân khấu nào mở. Thêm link bên dưới vào LIVE Studio.'}
      </div>
      <div className="mt-2 flex gap-2">
        <input readOnly value={STAGE_URL} className="input text-xs font-mono py-2" onFocus={(e) => e.target.select()} />
        <button className="btn btn-ghost" title="Sao chép link" onClick={async () => toast((await copyText(STAGE_URL)) ? 'Đã sao chép link sân khấu' : 'Không sao chép được', 'ok')}>
          <Copy size={15} />
        </button>
        <a className="btn btn-ghost" title="Mở sân khấu trong tab mới (sẽ phát tiếng)" href="/?view=stage" target="_blank" rel="noreferrer">
          <ExternalLink size={15} />
        </a>
      </div>
    </section>
  );
}

// ---------- quick effects ----------

export function QuickActions({ snap, now }: { snap: Snapshot; now: number }) {
  const toast = useToast();
  const fx = (name: string, label: string) => api('/api/fx', { fx: name }).then((r) => toast(r.ok ? label : r.error, r.ok ? 'info' : 'err'));
  const raining = snap.likes.rainUntil > now;
  const items: Array<[ReactNode, string, () => void, string?]> = [
    [<Bell size={16} />, 'Chuông', () => fx('bell', 'Đã đánh chuông'), 'B'],
    [<Hand size={16} />, 'Mõ', () => fx('gong', 'Đã gõ mõ'), 'M'],
    [<Flower2 size={16} />, 'Sen nở', () => fx('bloom', 'Hoa sen nở')],
    raining
      ? [<CloudOff size={16} />, 'Dừng', () => fx('stopRain', 'Đã dừng'), 'R']
      : [<CloudRain size={16} />, 'Hoa đăng', () => fx('rain', 'Sông đầy hoa đăng'), 'R'],
    [<Lamp size={16} />, 'Đèn trời', () => fx('lanterns', 'Thả đèn trời')],
    [<Sparkles size={16} />, 'Lời chúc', () => api('/api/voice/blessing').then(() => toast('Đã thêm lời chúc chung', 'info'))],
    [<Share2 size={16} />, 'Nhắc share', () => api('/api/voice/reminder').then(() => toast('Đã thêm lời nhắc chia sẻ', 'info'))],
    [<Volume2 size={16} />, 'Thử loa', () => api('/api/voice/test').then(() => toast('Đang đọc câu thử trên sân khấu', 'info'))],
  ];
  return (
    <section className="card p-4">
      <SectionTitle icon={<Sparkles size={15} />}>Hiệu ứng nhanh</SectionTitle>
      <div className="grid grid-cols-4 gap-2">
        {items.map(([icon, label, run, key]) => (
          <button key={label} onClick={run} className="relative flex flex-col items-center gap-1 py-2.5 rounded-xl bg-ink-800 border border-ink-700 hover:border-gold-500/60 hover:bg-ink-700 transition text-[11.5px] text-[#e9dccb]">
            <span className="text-gold-300">{icon}</span>
            {label}
            {key && <span className="kbd absolute top-1 right-1 !text-[9px] !px-1">{key}</span>}
          </button>
        ))}
      </div>
      <button className="btn btn-danger w-full mt-2" onClick={() => fx('stopAll', 'Đã tắt hết hiệu ứng đang chạy')} title="Dừng mưa hoa, đèn trời, tia sáng và đưa máy quay về toàn cảnh (X)">
        <CircleStop size={15} /> Tắt hết hiệu ứng đang chạy <span className="kbd !text-[9px] !px-1">X</span>
      </button>
    </section>
  );
}

// ---------- stats ----------

export function StatsRow({ snap, now }: { snap: Snapshot; now: number }) {
  const s = snap.stats;
  const items: Array<[ReactNode, string, ReactNode, string?]> = [
    [<Users size={15} />, 'Đang xem', snap.live.viewers.toLocaleString('vi-VN'), `cao nhất ${s.peakViewers}`],
    [<MessageCircle size={15} />, 'Bình luận', s.comments.toLocaleString('vi-VN'), `${s.joins} lượt vào`],
    [<Gift size={15} />, 'Quà', s.gifts.toLocaleString('vi-VN'), `${s.coins.toLocaleString('vi-VN')} xu`],
    [<Heart size={15} />, 'Tim', `${snap.likes.progress}/${snap.likes.goal}`, `${s.rains} lần sông đầy hoa`],
    [<Flame size={15} />, 'Hoa đăng · Cá', `${s.offers} · ${s.fish}`, `${snap.offerQueue.length} người chờ`],
    [<Sparkles size={15} />, 'Phiên', duration(now - s.sessionStart), `${s.follows} theo dõi`],
  ];
  return (
    <div className="grid grid-cols-3 2xl:grid-cols-6 gap-2">
      {items.map(([icon, label, value, sub]) => (
        <div key={label} className="card px-3 py-2.5">
          <div className="flex items-center gap-1.5 text-[11.5px] text-[#9c8a77]">
            <span className="text-gold-400">{icon}</span>
            {label}
          </div>
          <div className="text-lg font-semibold tabular-nums mt-0.5">{value}</div>
          {sub && <div className="text-[11px] text-[#7d6c5d] truncate">{sub}</div>}
        </div>
      ))}
    </div>
  );
}

// ---------- read now ----------

const TEMPLATES = [
  'Cảm ơn cả nhà đã ghé chơi, chúc mọi người một buổi tối thật bình an.',
  'Mời cả nhà gõ hoadang để thả một ngọn hoa đăng, hoặc gõ phongsinh để thả cá về sông nhé.',
  'Cả nhà thả tim giúp kênh để cùng ngắm cả dòng sông hoa đăng nha.',
  'Ai thấy lòng nhẹ nhõm thì chia sẻ live cho người thân cùng nghe nhé.',
  'Mời cả nhà hít một hơi thật sâu, thở ra thật chậm, thả lỏng đôi vai.',
];

export function SayCard({ channel }: { channel: string }) {
  const toast = useToast();
  const [text, setText] = useState('');
  const [history, setHistory] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('say-history') || '[]');
    } catch {
      return [];
    }
  });
  const send = async (priority: boolean, t = text) => {
    const line = t.trim();
    if (!line) return;
    const r = await api<{ ok: boolean; error?: string; audio?: boolean }>('/api/voice/say', { text: line, priority });
    if (!r.ok) return toast(r.error, 'err');
    toast(r.audio ? (priority ? 'Sẽ đọc ngay sau câu hiện tại' : 'Đã thêm vào hàng chờ') : 'Đã thêm, nhưng chưa có sân khấu nào để phát tiếng', r.audio ? 'ok' : 'info');
    const next = [line, ...history.filter((h) => h !== line)].slice(0, 8);
    setHistory(next);
    try {
      localStorage.setItem('say-history', JSON.stringify(next));
    } catch {
      // private mode
    }
    if (t === text) setText('');
  };
  const chips = [...history.slice(0, 3), ...TEMPLATES.filter((t) => !history.includes(t))].slice(0, 6);
  return (
    <section className="card p-4">
      <SectionTitle icon={<Mic size={15} />}>Đọc lên sân khấu</SectionTitle>
      <textarea
        className="input resize-none h-20 leading-relaxed"
        placeholder={`Gõ câu muốn giọng ${channel} đọc lên live...`}
        value={text}
        maxLength={600}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            send(true);
          }
        }}
      />
      <div className="flex items-center gap-2 mt-2">
        <button className="btn btn-gold" disabled={!text.trim()} onClick={() => send(true)}>
          <Send size={14} /> Đọc ngay
        </button>
        <button className="btn btn-ghost" disabled={!text.trim()} onClick={() => send(false)}>
          Thêm vào hàng chờ
        </button>
        <span className="ml-auto text-[11px] text-[#7d6c5d] hidden sm:block">
          <span className="kbd">Ctrl</span> + <span className="kbd">Enter</span>
        </span>
      </div>
      <div className="flex flex-wrap gap-1.5 mt-3">
        {chips.map((c) => (
          <button key={c} onClick={() => setText(c)} className="text-left text-xs px-2.5 py-1 rounded-full bg-ink-800 border border-ink-700 hover:border-gold-500/50 text-[#c9b8a3] max-w-full truncate" title={c}>
            {c.length > 46 ? `${c.slice(0, 44)}…` : c}
          </button>
        ))}
      </div>
    </section>
  );
}

// ---------- activity feed ----------

type Tab = 'all' | 'chat' | 'gift' | 'join' | 'system';
const TABS: Array<[Tab, string]> = [
  ['all', 'Tất cả'],
  ['chat', 'Bình luận'],
  ['gift', 'Quà'],
  ['join', 'Vào xem'],
  ['system', 'Hệ thống'],
];

export function FeedCard({ feed, now }: { feed: FeedItem[]; now: number }) {
  const [tab, setTab] = useState<Tab>('all');
  const [q, setQ] = useState('');
  const [hover, setHover] = useState(false);
  const [frozen, setFrozen] = useState<FeedItem[] | null>(null);
  const toast = useToast();
  // Hovering the list freezes it so a row doesn't slide away while clicking its buttons
  useEffect(() => setFrozen(hover ? feed : null), [hover]); // eslint-disable-line react-hooks/exhaustive-deps
  const source = frozen ?? feed;
  const pending = frozen ? feed.length - frozen.length : 0;
  const items = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return source.filter((f) => {
      if (f.type === 'like') return false;
      if (tab === 'join' && f.type !== 'join' && f.type !== 'follow' && f.type !== 'share') return false;
      if (tab !== 'all' && tab !== 'join' && f.type !== tab) return false;
      if (needle) {
        const hay = f.type === 'system' ? f.text : `${f.user.name} ${f.type === 'chat' ? f.text : ''}`;
        if (!hay.toLowerCase().includes(needle)) return false;
      }
      return true;
    });
  }, [source, tab, q]);

  const act = async (id: string, action: string, label: string) => {
    const r = await api('/api/viewer', { id, action });
    toast(r.ok ? label : r.error, r.ok ? 'ok' : 'err');
  };

  return (
    <section className="card p-4 flex flex-col min-h-0 flex-1">
      <SectionTitle icon={<MessageCircle size={15} />} right={pending > 0 ? <span className="text-[11px] text-gold-300">+{pending} mới (tạm dừng cuộn)</span> : null}>
        Hoạt động
      </SectionTitle>
      <div className="flex items-center gap-2 mb-3">
        <div className="flex gap-1 p-1 rounded-xl bg-ink-950 border border-ink-700 overflow-x-auto">
          {TABS.map(([k, label]) => (
            <button key={k} onClick={() => setTab(k)} className={`px-2.5 py-1 rounded-lg text-xs font-medium whitespace-nowrap transition ${tab === k ? 'bg-ink-700 text-gold-100' : 'text-[#9c8a77] hover:text-[#e9dccb]'}`}>
              {label}
            </button>
          ))}
        </div>
        <div className="relative flex-1 min-w-[100px]">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#7d6c5d]" />
          <input className="input !py-1.5 pl-8 text-xs" placeholder="Tìm tên, nội dung" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </div>
      <div className="flex-1 min-h-[240px] overflow-y-auto scroll-thin -mx-2 px-2" onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
        {items.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center text-sm text-[#7d6c5d] py-10">
            <MessageCircle size={28} className="mb-2 opacity-50" />
            Chưa có hoạt động nào.
            <span className="text-xs mt-1">Kết nối TikTok, hoặc bật Thử nghiệm để xem trước.</span>
          </div>
        ) : (
          <ul className="flex flex-col gap-0.5">
            {items.map((f) => (
              <FeedRow key={f.id} f={f} now={now} act={act} />
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function FeedRow({ f, now, act }: { f: FeedItem; now: number; act: (id: string, action: string, label: string) => void }) {
  if (f.type === 'system') {
    const color = { info: 'text-sky-300', success: 'text-emerald-300', warn: 'text-amber-300', error: 'text-red-300' }[f.level];
    return (
      <li className="feed-in flex items-start gap-2 px-2 py-1.5 rounded-lg text-xs">
        <span className={`${color} mt-px`}>●</span>
        <span className="flex-1 text-[#c9b8a3]">{f.text}</span>
        <span className="text-[10.5px] text-[#6d5d4f] whitespace-nowrap">{timeAgo(f.at, now)}</span>
      </li>
    );
  }
  const u = f.user;
  let body: ReactNode = null;
  let badge: ReactNode = null;
  if (f.type === 'chat') {
    body = <span className="text-[#efe3d3] break-words">{f.text}</span>;
    if (f.trigger) badge = <span className="text-[10px] px-1.5 py-px rounded bg-orange-500/15 text-orange-300 border border-orange-500/25">{f.trigger === 'fish' ? '🐟 thả cá' : '🪷 hoa đăng'}</span>;
    else if (f.wish) badge = <span className="text-[10px] px-1.5 py-px rounded bg-violet-500/15 text-violet-300 border border-violet-500/25">🙏 {WISH_LABELS[f.wish as WishTopic]}</span>;
  } else if (f.type === 'gift') {
    body = (
      <span className="text-gold-200 font-medium flex items-center gap-1.5">
        {f.image && <img src={f.image} alt="" className="w-5 h-5" referrerPolicy="no-referrer" />}
        tặng {f.count > 1 ? `${f.count} × ` : ''}
        {f.giftName} <span className="text-[11px] text-gold-400/80 font-normal">({f.coins} xu)</span>
      </span>
    );
  } else if (f.type === 'join') body = <span className="text-[#9c8a77]">vừa vào xem</span>;
  else if (f.type === 'follow') body = <span className="text-sky-300">đã theo dõi kênh</span>;
  else if (f.type === 'share') body = <span className="text-emerald-300">đã chia sẻ live</span>;
  const rowTone = f.type === 'gift' ? 'bg-gold-500/[0.07] border-gold-500/20' : 'border-transparent';
  return (
    <li className={`feed-in group relative flex items-start gap-2.5 px-2 py-1.5 rounded-lg border hover:bg-ink-800 ${rowTone}`}>
      <Avatar name={u.name} url={u.avatar} size={f.type === 'join' ? 22 : 28} />
      <div className="flex-1 min-w-0 text-[13px] leading-snug">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="font-semibold text-[#f6ead8] truncate max-w-[180px]">{u.name}</span>
          {f.sim && <span className="text-[9.5px] px-1 rounded bg-sky-500/15 text-sky-300">thử</span>}
          {badge}
          <span className="text-[10.5px] text-[#6d5d4f] ml-auto whitespace-nowrap group-hover:opacity-0">{timeAgo(f.at, now)}</span>
        </div>
        {f.type === 'join' ? null : <div className="mt-0.5">{body}</div>}
        {f.type === 'join' && <span className="text-xs">{body}</span>}
      </div>
      <div className="absolute right-1.5 top-1 hidden group-hover:flex gap-1 bg-ink-800 rounded-lg p-0.5 shadow-lg border border-ink-600">
        <IconBtn title="Mời thả hoa đăng" onClick={() => act(u.id, 'offer', `Đã mời ${u.name} thả hoa đăng`)}><Flame size={13} /></IconBtn>
        <IconBtn title="Mời thả cá" onClick={() => act(u.id, 'fish', `Đã mời ${u.name} thả cá`)}><Fish size={13} /></IconBtn>
        <IconBtn title="Đọc lời chúc cho người này" onClick={() => act(u.id, 'bless', `Sẽ đọc lời chúc cho ${u.name}`)}><HandHeart size={13} /></IconBtn>
        <IconBtn title="Xếp chỗ trên cầu" onClick={() => act(u.id, 'seat', `Đã xếp chỗ cho ${u.name}`)}><UserPlus size={13} /></IconBtn>
        <IconBtn title="Đặt làm khách quý (chỉnh ảnh, màu áo trong Cài đặt → Khách quý)" onClick={() => act(u.id, 'guest', `${u.name} là khách quý. Chỉnh ảnh, màu áo trong Cài đặt → Khách quý`)}><Crown size={13} /></IconBtn>
        <IconBtn title="Chặn người này (ẩn khỏi live)" danger onClick={() => confirm(`Chặn ${u.name}? Người này sẽ không hiện trên sân khấu và không được đọc tên.`) && act(u.id, 'block', `Đã chặn ${u.name}`)}><Ban size={13} /></IconBtn>
      </div>
    </li>
  );
}

function IconBtn({ children, title, onClick, danger }: { children: ReactNode; title: string; onClick: () => void; danger?: boolean }) {
  return (
    <button title={title} onClick={onClick} className={`p-1.5 rounded-md ${danger ? 'text-red-300 hover:bg-red-500/20' : 'text-[#d9c6ad] hover:bg-ink-600 hover:text-gold-200'}`}>
      {children}
    </button>
  );
}

// ---------- voice queue ----------

const KIND: Record<VoiceKind, [string, string]> = {
  gift: ['Quà', 'bg-gold-500/15 text-gold-200'],
  join: ['Chào', 'bg-sky-500/15 text-sky-200'],
  wish: ['Lời chúc', 'bg-violet-500/15 text-violet-200'],
  follow: ['Theo dõi', 'bg-teal-500/15 text-teal-200'],
  share: ['Chia sẻ', 'bg-emerald-500/15 text-emerald-200'],
  like: ['Tim', 'bg-pink-500/15 text-pink-200'],
  idle: ['Tự động', 'bg-stone-500/20 text-stone-200'],
  reminder: ['Nhắc share', 'bg-stone-500/20 text-stone-200'],
  manual: ['Bạn gõ', 'bg-orange-500/15 text-orange-200'],
  system: ['Hệ thống', 'bg-stone-500/20 text-stone-200'],
};

export function VoiceCard({ snap, now }: { snap: Snapshot; now: number }) {
  const { current, queue, paused } = snap.voice;
  const rate = snap.settings.voice.rate;
  return (
    <section className="card p-4">
      <SectionTitle
        icon={<Volume2 size={15} />}
        right={
          <div className="flex gap-1">
            <button className="btn btn-ghost !px-2 !py-1.5" title={paused ? 'Tiếp tục đọc (P)' : 'Tạm dừng giọng đọc (P)'} onClick={() => api(paused ? '/api/voice/resume' : '/api/voice/pause')}>
              {paused ? <Play size={14} /> : <Pause size={14} />}
            </button>
            <button className="btn btn-ghost !px-2 !py-1.5" title="Bỏ qua câu đang đọc (S)" disabled={!current} onClick={() => api('/api/voice/skip')}>
              <SkipForward size={14} />
            </button>
            <button className="btn btn-ghost !px-2 !py-1.5" title="Xóa hàng chờ" disabled={!queue.length} onClick={() => api('/api/voice/clear')}>
              <Trash2 size={14} />
            </button>
          </div>
        }
      >
        Giọng đọc
      </SectionTitle>
      {paused && <div className="mb-2 text-xs rounded-lg px-3 py-2 bg-amber-500/10 border border-amber-500/25 text-amber-200">Đang tạm dừng. Các câu mới vẫn được xếp hàng.</div>}
      <NowSpeaking item={current} now={now} rate={rate} audio={snap.stages.audio} />
      <div className="mt-3 text-[11px] uppercase tracking-wider text-[#7d6c5d] mb-1.5 flex justify-between">
        <span>Sắp đọc</span>
        <span>{queue.length} câu</span>
      </div>
      <ul className="flex flex-col gap-1 max-h-[260px] overflow-y-auto scroll-thin -mx-1 px-1">
        {queue.length === 0 && <li className="text-xs text-[#6d5d4f] py-2">Hàng chờ trống.</li>}
        {queue.map((q) => (
          <QueueRow key={q.id} q={q} />
        ))}
      </ul>
    </section>
  );
}

function NowSpeaking({ item, now, rate, audio }: { item: VoiceItem | null; now: number; rate: number; audio: boolean }) {
  if (!item)
    return (
      <div className="rounded-xl border border-dashed border-ink-600 px-3 py-3 text-xs text-[#7d6c5d]">
        {audio ? 'Đang im lặng.' : 'Chưa có sân khấu để phát tiếng. Câu đọc sẽ chờ đến khi LIVE Studio mở link.'}
      </div>
    );
  const est = (item.text.length * 68) / rate + 400;
  const pct = item.startedAt ? Math.min(1, (now - item.startedAt) / est) : 0;
  return (
    <div className="rounded-xl bg-gold-500/[0.08] border border-gold-500/25 px-3 py-2.5">
      <div className="flex items-center gap-2 mb-1">
        <span className="flex gap-[2px] items-end h-3">
          {[0, 1, 2, 3].map((i) => (
            <span key={i} className="w-[3px] rounded-full bg-gold-300" style={{ height: item.startedAt ? 3 + ((Math.floor(now / 150) + i * 3) % 4) * 2.5 : 3 }} />
          ))}
        </span>
        <span className="text-[11px] font-semibold text-gold-200">{item.startedAt ? 'Đang đọc' : 'Đang chuẩn bị...'}</span>
        <span className={`text-[10px] px-1.5 rounded ${KIND[item.kind][1]}`}>{KIND[item.kind][0]}</span>
      </div>
      <p className="text-[13px] leading-relaxed text-[#f6ead8]">{item.text}</p>
      <div className="mt-2 h-1 rounded-full bg-ink-700 overflow-hidden">
        <div className="h-full bg-gold-400 transition-all duration-300" style={{ width: `${pct * 100}%` }} />
      </div>
    </div>
  );
}

function QueueRow({ q }: { q: VoiceItem }) {
  return (
    <li className="group flex items-start gap-2 px-2 py-1.5 rounded-lg hover:bg-ink-800 text-xs">
      <span className={`shrink-0 text-[10px] px-1.5 py-px rounded mt-px ${KIND[q.kind][1]}`}>{KIND[q.kind][0]}</span>
      <span className="flex-1 text-[#c9b8a3] line-clamp-2">{q.text}</span>
      {q.priority && <span className="text-[10px] text-gold-300 mt-px" title="Ưu tiên">★</span>}
      <button className="opacity-0 group-hover:opacity-100 text-[#9c8a77] hover:text-red-300" title="Bỏ câu này" onClick={() => api('/api/voice/remove', { id: q.id })}>
        <X size={14} />
      </button>
    </li>
  );
}

// ---------- leaderboard ----------

export function TopCard({ snap }: { snap: Snapshot }) {
  const toast = useToast();
  const act = async (id: string, action: string, label: string) => {
    const r = await api('/api/viewer', { id, action });
    toast(r.ok ? label : r.error, r.ok ? 'ok' : 'err');
  };
  const top = snap.top.slice(0, 10);
  return (
    <section className="card p-4">
      <SectionTitle icon={<Crown size={15} />} right={<span className="text-[11px] text-[#7d6c5d]">{snap.settings.pointsPerComment} đ/bình luận · {snap.settings.pointsPerCoin} đ/xu</span>}>
        Top thành tâm
      </SectionTitle>
      {top.length === 0 ? (
        <p className="text-xs text-[#6d5d4f]">Chưa có ai. Mỗi bình luận và mỗi xu quà đều được cộng điểm.</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {top.map((t, i) => (
            <li key={t.id} className="group flex items-center gap-2 px-1.5 py-1 rounded-lg hover:bg-ink-800">
              <span className={`w-5 text-center text-xs font-bold ${i === 0 ? 'text-gold-300' : i < 3 ? 'text-[#d9c6ad]' : 'text-[#7d6c5d]'}`}>{i + 1}</span>
              <Avatar name={t.name} url={t.avatar} size={26} />
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-medium truncate">{t.name}</div>
                <div className="text-[10.5px] text-[#7d6c5d]">
                  {t.comments} bình luận{t.coins ? ` · ${t.coins} xu` : ''}
                </div>
              </div>
              <span className="text-sm font-semibold text-gold-200 tabular-nums group-hover:hidden">{t.points.toLocaleString('vi-VN')}</span>
              <div className="hidden group-hover:flex gap-0.5">
                <IconBtn title="Đọc lời cảm ơn" onClick={() => act(t.id, 'thank', `Sẽ cảm ơn ${t.name}`)}><HandHeart size={13} /></IconBtn>
                <IconBtn title="Mời thả hoa đăng" onClick={() => act(t.id, 'offer', `Đã mời ${t.name} thả hoa đăng`)}><Flame size={13} /></IconBtn>
                <IconBtn title="Mời thả cá" onClick={() => act(t.id, 'fish', `Đã mời ${t.name} thả cá`)}><Fish size={13} /></IconBtn>
                <IconBtn title="Đặt làm khách quý" onClick={() => act(t.id, 'guest', `${t.name} là khách quý`)}><Crown size={13} /></IconBtn>
                <IconBtn title="Xóa khỏi bảng" danger onClick={() => act(t.id, 'remove', `Đã xóa ${t.name}`)}><X size={13} /></IconBtn>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
