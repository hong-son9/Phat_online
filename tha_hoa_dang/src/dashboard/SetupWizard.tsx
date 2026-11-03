import { useEffect, useState } from 'react';
import { Check, Copy, LoaderCircle, Volume2 } from 'lucide-react';
import type { Snapshot } from '../../shared/types';
import { api, patchSettings } from '../lib/api';
import { STAGE_URL } from './panels';
import { Modal, copyText, useToast } from './ui';

// First-run guide: name the channel, add the stage link to LIVE Studio (detected live),
// hear the voice once, connect TikTok. Each step shows a tick when it is actually done.

export function SetupWizard({ open, onClose, snap }: { open: boolean; onClose: () => void; snap: Snapshot }) {
  const toast = useToast();
  const [step, setStep] = useState(0);
  const [name, setName] = useState(snap.settings.channelName);
  const [user, setUser] = useState(snap.settings.tiktokUsername);
  const [tested, setTested] = useState(false);
  useEffect(() => {
    if (open) setStep(0);
  }, [open]);

  const stageOk = snap.stages.audio;
  const liveOk = snap.live.state === 'connected' || snap.live.state === 'waiting';
  const steps = [
    { title: 'Đặt tên kênh', done: snap.settings.channelName !== 'Bến Hoa Đăng' || step > 0 },
    { title: 'Thêm vào LIVE Studio', done: stageOk },
    { title: 'Nghe thử giọng', done: tested },
    { title: 'Kết nối TikTok', done: liveOk },
  ];

  const finish = async () => {
    await patchSettings({ setupDone: true });
    onClose();
  };

  return (
    <Modal open={open} onClose={finish} width={620}>
      <div className="p-6">
        <div className="flex items-center gap-3 mb-1">
          <span className="text-3xl">🪷</span>
          <div>
            <h2 className="text-lg font-semibold">Chuẩn bị buổi live</h2>
            <p className="text-sm text-[#9c8a77]">4 bước, khoảng 2 phút. Có thể mở lại bất cứ lúc nào ở nút Hướng dẫn.</p>
          </div>
        </div>
        <ol className="flex gap-1.5 my-5">
          {steps.map((s, i) => (
            <li key={s.title} className="flex-1">
              <button onClick={() => setStep(i)} className="w-full text-left">
                <div className={`h-1.5 rounded-full ${s.done ? 'bg-emerald-400' : i === step ? 'bg-gold-400' : 'bg-ink-700'}`} />
                <div className={`mt-1.5 text-[11.5px] flex items-center gap-1 ${i === step ? 'text-gold-100 font-semibold' : 'text-[#9c8a77]'}`}>
                  {s.done && <Check size={12} className="text-emerald-400" />}
                  {s.title}
                </div>
              </button>
            </li>
          ))}
        </ol>

        <div className="min-h-[220px]">
          {step === 0 && (
            <div>
              <h3 className="font-semibold mb-1">Tên kênh của bạn là gì?</h3>
              <p className="text-sm text-[#9c8a77] mb-3">Tên hiện lớn trên sân khấu và giọng đọc dùng tên này để xưng hô: “<b className="text-gold-200">{name || '...'}</b> xin chào bạn Lan vừa ghé lên cầu.”</p>
              <input className="input text-base" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} placeholder="VD: Bến Sông Trăng" autoFocus />
            </div>
          )}
          {step === 1 && (
            <div>
              <h3 className="font-semibold mb-1">Thêm sân khấu vào TikTok LIVE Studio</h3>
              <ol className="text-sm text-[#c9b8a3] space-y-1.5 list-decimal pl-5 mb-3">
                <li>Mở TikTok LIVE Studio, bấm <b>Thêm nguồn</b> → <b>Link</b> (hoặc Trình duyệt).</li>
                <li>Dán link dưới đây, đặt kích thước <b>1080 × 1920</b>.</li>
                <li>Kéo nguồn cho phủ kín khung hình dọc.</li>
              </ol>
              <div className="flex gap-2">
                <input readOnly value={STAGE_URL} className="input font-mono text-sm" onFocus={(e) => e.target.select()} />
                <button className="btn btn-gold" onClick={async () => toast((await copyText(STAGE_URL)) ? 'Đã sao chép' : 'Không sao chép được')}>
                  <Copy size={15} /> Sao chép
                </button>
              </div>
              <div className={`mt-4 flex items-center gap-2 text-sm rounded-xl px-4 py-3 border ${stageOk ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-200' : 'bg-ink-800 border-ink-700 text-[#b8a693]'}`}>
                {stageOk ? <Check size={16} /> : <LoaderCircle size={16} className="animate-spin" />}
                {stageOk ? 'Đã nhận được sân khấu từ LIVE Studio.' : 'Đang chờ LIVE Studio mở link...'}
              </div>
              <p className="text-xs text-[#7d6c5d] mt-2">Chưa có LIVE Studio? Bấm <a className="text-gold-300 underline" href="/?view=stage" target="_blank" rel="noreferrer">mở sân khấu ở tab mới</a> để thử. Chỉ một trang sân khấu phát tiếng, nên mở nhiều tab cũng không bị đọc đôi.</p>
            </div>
          )}
          {step === 2 && (
            <div>
              <h3 className="font-semibold mb-1">Nghe thử giọng đọc trên sân khấu</h3>
              <p className="text-sm text-[#9c8a77] mb-4">Bấm nút, giọng đọc sẽ phát qua sân khấu (đúng thứ người xem sẽ nghe). Trong LIVE Studio, nhớ bật âm thanh của nguồn Link.</p>
              <button
                className="btn btn-gold !py-3 !px-5"
                disabled={!stageOk}
                onClick={async () => {
                  await api('/api/voice/test');
                  setTested(true);
                }}
              >
                <Volume2 size={16} /> Phát câu thử
              </button>
              {!stageOk && <p className="text-xs text-amber-200/80 mt-2">Cần làm bước 2 trước để có nơi phát tiếng.</p>}
              {tested && <p className="text-sm text-emerald-300 mt-3">Nghe thấy “Xin chào, đây là giọng đọc của {snap.settings.channelName}...” là ổn. Đổi giọng, tốc độ trong Cài đặt → Giọng đọc.</p>}
            </div>
          )}
          {step === 3 && (
            <div>
              <h3 className="font-semibold mb-1">Kết nối tài khoản TikTok</h3>
              <p className="text-sm text-[#9c8a77] mb-3">Nhập username (không cần @). Có thể kết nối trước khi bấm Phát trực tiếp; app sẽ tự vào phòng khi live bắt đầu.</p>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#7d6c5d]">@</span>
                  <input className="input pl-7 text-base" value={user} onChange={(e) => setUser(e.target.value.replace(/^@/, '').trim())} placeholder="username" />
                </div>
                <button
                  className="btn btn-gold"
                  disabled={!user}
                  onClick={async () => {
                    const r = await api('/api/live/connect', { username: user });
                    if (!r.ok) toast(r.error, 'err');
                  }}
                >
                  Kết nối
                </button>
              </div>
              {snap.live.state !== 'idle' && (
                <p className={`text-sm mt-3 ${liveOk ? 'text-emerald-300' : 'text-amber-200'}`}>
                  {snap.live.state === 'connected' ? `Đã vào phòng LIVE @${snap.live.username}.` : snap.live.error || 'Đang kết nối...'}
                </p>
              )}
              <p className="text-xs text-[#7d6c5d] mt-4">Muốn xem trước khi lên live thật? Đóng hướng dẫn và bấm <b>Thử nghiệm</b> ở thanh trên cùng.</p>
            </div>
          )}
        </div>

        <div className="flex justify-between items-center mt-6 pt-4 border-t border-ink-700">
          <button className="btn btn-ghost" onClick={finish}>
            Bỏ qua
          </button>
          <div className="flex gap-2">
            {step > 0 && (
              <button className="btn btn-ghost" onClick={() => setStep(step - 1)}>
                Quay lại
              </button>
            )}
            {step < 3 ? (
              <button
                className="btn btn-gold"
                onClick={async () => {
                  if (step === 0 && name.trim() && name.trim() !== snap.settings.channelName) await patchSettings({ channelName: name.trim() });
                  setStep(step + 1);
                }}
              >
                Tiếp tục
              </button>
            ) : (
              <button className="btn btn-gold" onClick={finish}>
                Xong
              </button>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}
