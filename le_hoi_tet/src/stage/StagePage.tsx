import { useEffect, useRef, useState } from 'react';
import { useBus, useLive } from '../lib/live';
import { World } from './scene/world';
import { stageAudio } from './audio';
import { Overlay, useRaf, type TickerItem } from './Overlay';
import { themeAt, type SceneTheme } from '../../shared/theme';

// The page TikTok LIVE Studio shows (?view=stage) and the silent preview in the dashboard (?view=preview).
// Only the stage page the server picks as the "audio" one makes any sound.

const SAFE = new URLSearchParams(location.search).get('safe') === '1';

export default function StagePage({ preview }: { preview: boolean }) {
  const { snap, online, now } = useLive(preview ? 'preview' : 'stage');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const labelsRef = useRef<HTMLDivElement>(null);
  const worldRef = useRef<World | null>(null);
  const [audioRole, setAudioRole] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [hearts, setHearts] = useState<number[]>([]);
  const [blooms, setBlooms] = useState<Array<{ id: number; power: number }>>([]);
  const [box, setBox] = useState({ k: 1, left: 0 });
  const [glError, setGlError] = useState(false);
  useRaf();

  useEffect(() => {
    document.title = preview ? 'Xem trước · Hội Xuân Live' : 'Sân khấu · Hội Xuân Live';
    try {
      const w = new World(canvasRef.current!, labelsRef.current!);
      w.serverNow = now;
      worldRef.current = w;
    } catch (err) {
      console.error(err);
      setGlError(true);
    }
    const fit = () => {
      const k = window.innerHeight / 960;
      setBox({ k, left: (window.innerWidth - 540 * k) / 2 });
    };
    fit();
    window.addEventListener('resize', fit);
    return () => {
      window.removeEventListener('resize', fit);
      worldRef.current?.dispose();
      worldRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // State -> 3D world and audio settings
  const quality = snap?.settings.graphics.quality;
  // the look follows the clock in 'auto' (checked every 15 s); a change mid-live fades through dark
  const graphics = snap?.settings.graphics;
  const [theme, setTheme] = useState<SceneTheme | null>(null);
  const [fading, setFading] = useState(0);
  useEffect(() => {
    if (!graphics) return;
    const check = () => setTheme(themeAt(graphics));
    check();
    const t = setInterval(check, 15000);
    return () => clearInterval(t);
  }, [graphics?.theme, graphics?.dayFrom, graphics?.nightFrom]); // eslint-disable-line react-hooks/exhaustive-deps
  const shownTheme = useRef<SceneTheme | null>(null);
  useEffect(() => {
    // The dashboard preview never takes the top setting, to leave the GPU for the live
    if (quality) worldRef.current?.setQuality(preview && quality === 'high' ? 'medium' : quality);
  }, [quality]);
  useEffect(() => {
    if (!theme || theme === shownTheme.current) return;
    const first = shownTheme.current === null;
    shownTheme.current = theme;
    if (first) {
      worldRef.current?.setTheme(theme);
      return;
    }
    // fade to dark, switch while it is dark, fade back in
    setFading(Date.now());
    const t = setTimeout(() => worldRef.current?.setTheme(theme), 1300);
    return () => clearTimeout(t);
  }, [theme]);
  useEffect(() => {
    if (snap) worldRef.current?.sync(snap);
  }, [snap]);

  const a = snap?.settings.audio;
  const voiceVolume = snap?.settings.voice.volume ?? 1;
  useEffect(() => {
    if (!a || !audioRole) return;
    stageAudio.configure({ music: a.music, track: a.musicTrack, musicVolume: a.musicVolume, sfx: a.sfx, sfxVolume: a.sfxVolume, drumVolume: a.drumVolume, voiceVolume });
  }, [audioRole, a?.music, a?.musicTrack, a?.musicVolume, a?.sfx, a?.sfxVolume, a?.drumVolume, voiceVolume]); // eslint-disable-line react-hooks/exhaustive-deps

  // A ref, not just state: the server sends the first line right after granting the audio role,
  // before React has re-rendered
  const audioRef = useRef(false);
  useBus('role', (r) => {
    if (preview) return;
    audioRef.current = r.audio;
    setAudioRole(r.audio);
    if (r.audio) {
      stageAudio.onBlocked = setBlocked;
      stageAudio.init();
    }
    // fireworks, firecrackers and the lion's drum are heard only on the page that has the sound
    if (worldRef.current)
      worldRef.current.onSound = r.audio
        ? (cue, p) => {
            if (cue === 'launch') stageAudio.launch();
            else if (cue === 'boom') stageAudio.boom(p);
            else if (cue === 'crackle') stageAudio.crackle();
            else if (cue === 'drum') stageAudio.drum(p);
            else stageAudio.chime(p);
          }
        : () => {};
  });

  useBus('voice:play', (v) => audioRef.current && stageAudio.playVoice(v.id, v.url));
  useBus('voice:stop', (v) => stageAudio.stopVoice(v.id));

  useBus('fx', ({ fx, power = 1 }) => {
    worldRef.current?.fx(fx, power);
    if (fx === 'stopAll') {
      setBlooms([]);
      setHearts([]);
      return;
    }
    if (fx === 'stopRain') return;
    if (fx === 'bloom') {
      const id = Date.now() + Math.random();
      setBlooms((b) => [...b.slice(-2), { id, power }]);
      setTimeout(() => setBlooms((b) => b.filter((x) => x.id !== id)), 3300);
    }
    if (!audioRef.current) return;
    if (fx === 'bell') stageAudio.bell(power);
    else if (fx === 'gong') stageAudio.gong(power);
    else if (fx === 'chime' || fx === 'rain') stageAudio.chime(power);
    else if (fx === 'bloom') stageAudio.bloom(power);
    else if (fx === 'lion') stageAudio.drum(1);
  });

  const [ticker, setTicker] = useState<TickerItem[]>([]);
  const pushTicker = (it: Omit<TickerItem, 'at'>) => {
    setTicker((list) => [...list.filter((x) => x.id !== it.id), { ...it, at: Date.now() }].slice(-4));
    setTimeout(() => setTicker((list) => list.filter((x) => x.id !== it.id)), 7000);
  };

  const lastHeart = useRef(0);
  useBus('feed', (f) => {
    if (f.type === 'chat') worldRef.current?.bubble(f.user.id, f.text);
    const u = f.type === 'system' ? null : f.user;
    if (u) {
      const base = { id: f.id, name: u.name, avatar: u.avatar };
      const guest = snap?.settings.guests.find((g) => g.id === u.id);
      if (f.type === 'join' && guest) pushTicker({ ...base, icon: '👑', text: `· ${guest.title || 'Khách quý'} vừa đến` });
      else if (f.type === 'join') pushTicker({ ...base, icon: '🌸', text: 'vừa ghé hội xuân' });
      else if (f.type === 'chat' && f.trigger === 'phao') pushTicker({ ...base, icon: '🎆', text: 'đi bắn pháo hoa' });
      else if (f.type === 'chat' && f.trigger) pushTicker({ ...base, icon: '🖌️', text: 'đi xin chữ ông đồ' });
      else if (f.type === 'gift') pushTicker({ ...base, icon: '🎁', text: `tặng ${f.count > 1 ? `${f.count} × ` : ''}${f.giftName}` });
      else if (f.type === 'follow') pushTicker({ ...base, icon: '💛', text: 'đã theo dõi' });
      else if (f.type === 'share') pushTicker({ ...base, icon: '🔗', text: 'đã chia sẻ live' });
    }
    if (f.type === 'like' && Date.now() - lastHeart.current > 250) {
      lastHeart.current = Date.now();
      const id = Math.floor(Math.random() * 1e9);
      setHearts((h) => [...h.slice(-8), id]);
      setTimeout(() => setHearts((h) => h.filter((x) => x !== id)), 1900);
    }
  });

  const unlock = () => {
    stageAudio.unlock();
    setBlocked(false);
  };

  return (
    <div className="stage-root" onClick={unlock}>
      <canvas ref={canvasRef} />
      <div ref={labelsRef} className="label-layer" />
      {snap && (
        <div className="overlay" style={{ left: box.left, transform: `scale(${box.k})` }}>
          <Overlay snap={snap} now={now()} hearts={hearts} blooms={blooms} ticker={ticker} theme={theme ?? 'dusk'} />
          {SAFE && <SafeZones />}
        </div>
      )}
      {fading > 0 && <div key={fading} className="theme-fade absolute inset-0 bg-[#05060d] pointer-events-none" onAnimationEnd={() => setFading(0)} />}
      {glError && (
        <div className="absolute inset-0 flex items-center justify-center p-8 text-center text-gold-100">
          Máy không chạy được đồ họa 3D (WebGL). Hãy bật tăng tốc phần cứng trong trình duyệt / LIVE Studio.
        </div>
      )}
      {!preview && blocked && audioRole && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50 cursor-pointer">
          <div className="glass rounded-2xl px-6 py-4 text-center">
            <div className="text-3xl mb-1">🔈</div>
            <div className="font-semibold text-gold-100">Bấm vào màn hình để bật âm thanh</div>
            <div className="text-xs text-[#e9d8bd]/70 mt-1">Trình duyệt chặn tự phát âm thanh</div>
          </div>
        </div>
      )}
      {!online && !preview && <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-red-500/80" title="Mất kết nối server" />}
    </div>
  );
}

// Rough areas TikTok's own interface covers on a portrait live (dashboard preview only)
function SafeZones() {
  const zone = 'absolute bg-sky-500/20 border border-dashed border-sky-300/70 flex items-center justify-center text-[11px] text-sky-100 font-semibold';
  return (
    <>
      <div className={zone} style={{ left: 0, top: 0, width: 540, height: 66 }}>Thông tin kênh · người xem</div>
      <div className={zone} style={{ left: 0, top: 620, width: 400, height: 250 }}>Bình luận TikTok</div>
      <div className={zone} style={{ left: 460, top: 520, width: 80, height: 350 }}>Nút</div>
      <div className={zone} style={{ left: 0, top: 880, width: 540, height: 80 }}>Ô bình luận · quà</div>
    </>
  );
}
