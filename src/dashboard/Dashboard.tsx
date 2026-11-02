import { useEffect, useState } from 'react';
import { CircleHelp, FlaskConical, Keyboard, LoaderCircle, Settings as SettingsIcon, Users } from 'lucide-react';
import type { FeedItem } from '../../shared/types';
import { SEAT_COUNT } from '../../shared/types';
import { api } from '../lib/api';
import { useBus, useLive, useTick } from '../lib/live';
import { ConnectionCard, FeedCard, PreviewCard, QuickActions, SayCard, StatsRow, TopCard, VoiceCard, liveInfo } from './panels';
import { SettingsDrawer } from './SettingsDrawer';
import { SetupWizard } from './SetupWizard';
import { SimDrawer } from './SimDrawer';
import { Modal, ToastProvider, duration, useToast } from './ui';

export default function Dashboard() {
  return (
    <ToastProvider>
      <DashboardInner />
    </ToastProvider>
  );
}

function DashboardInner() {
  const { snap, online, now } = useLive('dashboard');
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [simOpen, setSimOpen] = useState(false);
  const [setupOpen, setSetupOpen] = useState(false);
  const [keysOpen, setKeysOpen] = useState(false);
  const toast = useToast();
  useTick(1000);

  useEffect(() => {
    document.title = 'Điều khiển · An Nhiên Live';
  }, []);
  // First run: open the guide
  useEffect(() => {
    if (snap && !snap.settings.setupDone) setSetupOpen(true);
  }, [!!snap]); // eslint-disable-line react-hooks/exhaustive-deps

  // Likes arrive many times a second and are shown in the stats instead; keeping them would push comments out
  useBus('feed', (f) => f.type !== 'like' && setFeed((list) => [f, ...list].slice(0, 400)));

  // Keyboard shortcuts (ignored while typing)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest('input, textarea, select, [contenteditable]') || e.ctrlKey || e.metaKey || e.altKey) return;
      const k = e.key.toLowerCase();
      const run: Record<string, () => void> = {
        b: () => api('/api/fx', { fx: 'bell' }),
        m: () => api('/api/fx', { fx: 'gong' }),
        r: () => {
          const raining = !!snap && snap.likes.rainUntil > now();
          api('/api/fx', { fx: raining ? 'stopRain' : 'rain' }).then(() => toast(raining ? 'Đã dừng mưa hoa' : 'Mưa hoa sen', 'info'));
        },
        x: () => api('/api/fx', { fx: 'stopAll' }).then(() => toast('Đã tắt hết hiệu ứng đang chạy', 'info')),
        s: () => api('/api/voice/skip'),
        p: () => api(snap?.voice.paused ? '/api/voice/resume' : '/api/voice/pause').then(() => toast(snap?.voice.paused ? 'Tiếp tục đọc' : 'Đã tạm dừng giọng đọc', 'info')),
        t: () => setSimOpen((o) => !o),
        ',': () => setSettingsOpen(true),
        '?': () => setKeysOpen(true),
      };
      if (run[k]) {
        e.preventDefault();
        run[k]();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [snap?.voice.paused, snap?.likes.rainUntil]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!snap) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-3 text-[#9c8a77]">
        <LoaderCircle className="animate-spin text-gold-400" />
        {online ? 'Đang tải...' : 'Đang kết nối tới app... (cửa sổ CHAY-LIVE còn mở không?)'}
      </div>
    );
  }

  const t = now();
  const info = liveInfo(snap.live.state);
  return (
    <div className="min-h-full flex flex-col">
      <header className="sticky top-0 z-30 bg-ink-950/90 backdrop-blur border-b border-ink-700">
        <div className="max-w-[1680px] mx-auto px-4 h-14 flex items-center gap-3">
          <span className="text-2xl">🪷</span>
          <div className="leading-tight mr-2">
            <div className="font-serif font-bold text-[17px] gold-text">{snap.settings.channelName}</div>
            <div className="text-[11px] text-[#7d6c5d]">An Nhiên Live · bảng điều khiển</div>
          </div>
          <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full bg-ink-850 border border-ink-700 text-[12.5px]">
            <span className={`w-2 h-2 rounded-full ${info.color} ${snap.live.state === 'connected' ? 'pulse-dot' : ''}`} />
            {info.label}
            {snap.live.username && <span className="text-[#9c8a77]">@{snap.live.username}</span>}
            {snap.live.state === 'connected' && (
              <>
                <span className="text-[#5d4d40]">|</span>
                <Users size={13} className="text-gold-400" />
                <span className="tabular-nums">{snap.live.viewers}</span>
                <span className="text-[#5d4d40]">|</span>
                <span className="tabular-nums text-[#9c8a77]">{duration(t - snap.live.since)}</span>
              </>
            )}
          </div>
          <div className={`hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-full border text-[12.5px] ${snap.stages.audio ? 'bg-ink-850 border-ink-700' : 'bg-amber-500/10 border-amber-500/30 text-amber-200'}`}>
            <span className={`w-2 h-2 rounded-full ${snap.stages.audio ? 'bg-emerald-400' : 'bg-amber-400'}`} />
            {snap.stages.audio ? 'Sân khấu đang phát' : 'Chưa mở sân khấu'}
          </div>
          {!online && <span className="text-xs text-red-300">Mất kết nối app...</span>}
          <div className="ml-auto flex items-center gap-2">
            <button className={`btn ${simOpen ? 'btn-gold' : 'btn-ghost'}`} onClick={() => setSimOpen(true)} title="Thử nghiệm (T)">
              <FlaskConical size={15} /> <span className="hidden sm:inline">Thử nghiệm</span>
            </button>
            <button className="btn btn-ghost" onClick={() => setSetupOpen(true)} title="Hướng dẫn chuẩn bị live">
              <CircleHelp size={15} /> <span className="hidden sm:inline">Hướng dẫn</span>
            </button>
            <button className="btn btn-ghost !px-2.5" onClick={() => setKeysOpen(true)} title="Phím tắt (?)">
              <Keyboard size={15} />
            </button>
            <button className="btn btn-ghost" onClick={() => setSettingsOpen(true)} title="Cài đặt (,)">
              <SettingsIcon size={15} /> <span className="hidden sm:inline">Cài đặt</span>
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-[1680px] w-full mx-auto p-4 grid gap-4 grid-cols-1 lg:grid-cols-[minmax(300px,360px)_1fr] xl:grid-cols-[minmax(300px,360px)_1fr_minmax(320px,380px)]">
        <div className="flex flex-col gap-4">
          <ConnectionCard snap={snap} now={t} />
          <PreviewCard snap={snap} />
        </div>

        <div className="flex flex-col gap-4 min-w-0 xl:h-[calc(100vh-88px)] xl:sticky xl:top-[72px]">
          <StatsRow snap={snap} now={t} />
          <SayCard channel={snap.settings.channelName} />
          <FeedCard feed={feed} now={t} />
        </div>

        <div className="flex flex-col gap-4 lg:col-span-2 xl:col-span-1">
          <VoiceCard snap={snap} now={t} />
          <QuickActions snap={snap} now={t} />
          <TopCard snap={snap} />
          <section className="card p-4 text-sm flex items-center justify-between">
            <span className="text-[#b8a693]">
              Hội trường: <b className="text-[#f3eadf]">{snap.hall.length}</b> / {SEAT_COUNT} chỗ
            </span>
            <span className="text-[#7d6c5d] text-xs">chỗ trống có người ngồi sẵn</span>
          </section>
        </div>
      </main>

      <SettingsDrawer open={settingsOpen} onClose={() => setSettingsOpen(false)} snap={snap} />
      <SimDrawer open={simOpen} onClose={() => setSimOpen(false)} guests={snap.settings.guests} />
      <SetupWizard open={setupOpen} onClose={() => setSetupOpen(false)} snap={snap} />
      <Modal open={keysOpen} onClose={() => setKeysOpen(false)} width={420}>
        <div className="p-6">
          <h2 className="font-semibold mb-4 flex items-center gap-2">
            <Keyboard size={16} /> Phím tắt
          </h2>
          {[
            ['B', 'Đánh chuông'],
            ['M', 'Gõ mõ'],
            ['R', 'Bắt đầu / dừng mưa hoa sen'],
            ['X', 'Tắt hết hiệu ứng đang chạy'],
            ['S', 'Bỏ qua câu đang đọc'],
            ['P', 'Tạm dừng / tiếp tục giọng đọc'],
            ['T', 'Mở bảng Thử nghiệm'],
            [',', 'Mở Cài đặt'],
            ['Ctrl + Enter', 'Đọc ngay câu đang gõ'],
          ].map(([k, d]) => (
            <div key={k} className="flex justify-between py-1.5 text-sm border-b border-ink-800 last:border-0">
              <span className="text-[#c9b8a3]">{d}</span>
              <span className="kbd !text-xs">{k}</span>
            </div>
          ))}
        </div>
      </Modal>
    </div>
  );
}
