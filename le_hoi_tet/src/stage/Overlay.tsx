import { useEffect, useMemo, useRef, useState } from 'react';
import type { Snapshot, Spotlight, VoiceItem } from '../../shared/types';
import { GIFT_TIERS } from '../../shared/types';
import { colorFor } from './scene/labels';

// Everything drawn over the 3D river, laid out on a 540 x 960 canvas (scaled to the window).
// TikTok's own UI covers the top ~70px, the right edge buttons and the bottom ~35% (comments),
// so the important pieces sit in the band between.

export function Avatar({ name, url, size, ring }: { name: string; url: string; size: number; ring?: string }) {
  const [broken, setBroken] = useState(false);
  const letter = ([...name.replace(/[^\p{L}\p{N}]/gu, '')][0] ?? '?').toUpperCase();
  return (
    <div
      className="rounded-full overflow-hidden flex items-center justify-center shrink-0 font-bold text-white"
      style={{ width: size, height: size, background: colorFor(name), fontSize: size * 0.45, boxShadow: ring ? `0 0 0 2px ${ring}` : undefined }}
    >
      {url && !broken ? <img src={url} referrerPolicy="no-referrer" alt="" className="w-full h-full object-cover" onError={() => setBroken(true)} /> : letter}
    </div>
  );
}

function Title({ snap }: { snap: Snapshot }) {
  const s = snap.settings;
  return (
    <div className="absolute left-0 right-0 top-[72px] flex flex-col items-center px-6 text-center">
      <div className="flex items-center gap-3">
        <span className="h-px w-10 bg-gradient-to-r from-transparent to-gold-300/80" />
        <span className="text-[11px] tracking-[0.35em] text-gold-200/90 font-semibold">🌸 CHÚC MỪNG NĂM MỚI 🌸</span>
        <span className="h-px w-10 bg-gradient-to-l from-transparent to-gold-300/80" />
      </div>
      <h1 className="font-serif font-bold text-[34px] leading-tight gold-text text-glow mt-0.5 max-w-[500px] truncate">{s.channelName}</h1>
      {s.subtitle && <p className="text-[12.5px] text-[#fbe9c8] font-medium mt-0.5 drop-shadow-[0_1px_3px_#000]">{s.subtitle}</p>}
    </div>
  );
}

function Hints({ snap }: { snap: Snapshot }) {
  const kw = snap.settings.keywords[0] ?? 'xinchu';
  const fire = snap.settings.fireKeywords[0] ?? 'phaohoa';
  const hints = useMemo(
    () => [
      ['🖌️', <>Gõ <b className="text-gold-200">{kw}</b> để xin chữ ông đồ</>],
      ['🎆', <>Gõ <b className="text-gold-200">{fire}</b> để bắn pháo hoa</>],
      ['❤️', <>Thả đủ <b className="text-gold-200">{snap.likes.goal}</b> tim để pháo hoa rực trời</>],
      ['🧧', <>Comment điều mong ước năm mới để nhận lời chúc</>],
      ['🌸', <>Chúc mừng năm mới, an khang thịnh vượng!</>],
    ] as const,
    [kw, fire, snap.likes.goal]
  );
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((n) => (n + 1) % hints.length), 6000);
    return () => clearInterval(t);
  }, [hints.length]);
  const [icon, text] = hints[i];
  return (
    <div className="absolute left-0 right-0 top-[186px] flex justify-center">
      <div key={i} className="pop-in glass rounded-full pl-2 pr-4 py-1.5 flex items-center gap-2 text-[12.5px] text-[#fff3dc]">
        <span className="w-6 h-6 rounded-full bg-gold-300/20 flex items-center justify-center text-[13px]">{icon}</span>
        <span>{text}</span>
      </div>
    </div>
  );
}

// What viewers can do, on the left where a leaderboard would be: each gift and keyword and what it
// sets off on stage. One row at a time lights up.
function GuideBoard({ snap }: { snap: Snapshot }) {
  const s = snap.settings;
  const rows: Array<[string, string, string]> = [
    ['🌹', 'Tặng hoa hồng', 'Bắn pháo hoa'],
    ['🎁', `Quà từ ${GIFT_TIERS.big} xu`, 'Pháo hoa lớn'],
    ...(s.effects.lion ? [['🦁', `Quà từ ${GIFT_TIERS.lion} xu`, 'Múa lân + pháo hoa'] as [string, string, string]] : []),
    ['🖌️', `Gõ ${s.keywords[0] ?? 'xinchu'}`, 'Xin chữ ông đồ'],
    ['🎆', `Gõ ${s.fireKeywords[0] ?? 'phaohoa'}`, 'Bắn pháo hoa'],
    ...(s.effects.rain ? [['❤️', `${snap.likes.goal} tim`, 'Pháo hoa rực trời'] as [string, string, string]] : []),
  ];
  const [lit, setLit] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setLit((n) => (n + 1) % rows.length), 2400);
    return () => clearInterval(t);
  }, [rows.length]);
  return (
    <div className="absolute left-[10px] top-[224px] w-[196px] glass rounded-2xl px-2 pt-2 pb-2">
      <div className="font-serif font-bold text-[13px] gold-text tracking-wide text-center mb-1">🧧 CÁCH CHƠI 🧧</div>
      <div className="flex flex-col gap-0.5">
        {rows.map(([icon, what, does], i) => (
          <div
            key={what}
            className="flex items-center gap-1.5 rounded-lg px-1.5 py-[3px] transition-all duration-500"
            style={i === lit % rows.length ? { background: 'linear-gradient(90deg, rgba(242,183,5,0.38), rgba(242,183,5,0.08))', boxShadow: '0 0 12px rgba(255,200,80,0.35)' } : undefined}
          >
            <span className="text-[14px] w-5 text-center shrink-0">{icon}</span>
            <span className="flex-1 min-w-0">
              <span className="block text-[10.5px] font-bold text-[#fff3dc] truncate leading-tight">{what}</span>
              <span className="block text-[9.5px] text-gold-200 truncate leading-tight">→ {does}</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function LikeGoal({ snap, now, hearts }: { snap: Snapshot; now: number; hearts: number[] }) {
  const { progress, goal, rainUntil } = snap.likes;
  const raining = rainUntil > now;
  const pct = raining ? (rainUntil - now) / (snap.settings.rainSeconds * 1000) : progress / goal;
  const R = 34;
  const C = 2 * Math.PI * R;
  const left = Math.max(0, Math.ceil((rainUntil - now) / 1000));
  return (
    <div className="absolute right-[10px] top-[224px] w-[118px] glass rounded-2xl pt-2.5 pb-2 flex flex-col items-center">
      <div className="relative w-[84px] h-[84px]">
        <svg viewBox="0 0 84 84" className="absolute inset-0 -rotate-90">
          <circle cx="42" cy="42" r={R} fill="none" stroke="rgba(255,230,190,0.12)" strokeWidth="6" />
          <circle
            cx="42" cy="42" r={R} fill="none" strokeWidth="6" strokeLinecap="round"
            stroke={raining ? 'url(#rainGrad)' : 'url(#likeGrad)'}
            strokeDasharray={C} strokeDashoffset={C * (1 - Math.min(1, pct))}
            style={{ transition: 'stroke-dashoffset 0.6s ease' }}
          />
          <defs>
            <linearGradient id="likeGrad" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#ff8fb1" /><stop offset="1" stopColor="#f2c55c" /></linearGradient>
            <linearGradient id="rainGrad" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#ffd1e0" /><stop offset="1" stopColor="#ff7aa6" /></linearGradient>
          </defs>
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={`text-[24px] leading-none ${raining ? 'spin-slow' : ''}`}>🎆</span>
          <span className="text-[11px] font-bold text-white tabular-nums mt-0.5">{raining ? `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}` : progress}</span>
        </div>
        {hearts.map((id) => (
          <span key={id} className="float-heart text-[14px]" style={{ left: 30 + ((id * 37) % 24), top: 20 }}>
            {id % 3 ? '❤️' : '🌸'}
          </span>
        ))}
      </div>
      <span className="text-[10.5px] font-semibold text-[#ffe3ec] mt-1">{raining ? 'Pháo hoa rực trời' : `${goal} tim · pháo hoa`}</span>
    </div>
  );
}

function OfferLine({ snap }: { snap: Snapshot }) {
  if (!snap.offers.length && !snap.offerQueue.length) return null;
  const waiting = snap.offerQueue;
  return (
    <div className="absolute right-[10px] top-[360px] w-[118px] glass rounded-2xl px-2 py-2">
      <div className="text-[10px] font-semibold text-gold-200 mb-1 flex items-center gap-1">🧧 Đang xin chữ, bắn pháo</div>
      <div className="flex flex-wrap gap-1">
        {snap.offers.map((o) => (
          <span key={o.id} className="relative">
            <Avatar name={o.name} url={o.avatar} size={20} ring={o.gift ? '#f5c84c' : 'rgba(255,240,210,0.6)'} />
            <span className="absolute -bottom-1 -right-1 text-[9px]">{o.kind === 'phao' ? '🎆' : '🖌️'}</span>
          </span>
        ))}
      </div>
      {waiting.length > 0 && (
        <>
          <div className="text-[9.5px] text-[#e9d8bd]/70 mt-1.5 mb-0.5">Chờ lượt · {waiting.length}</div>
          <div className="flex -space-x-1.5">
            {waiting.slice(0, 6).map((w) => (
              <Avatar key={w.id} name={w.name} url={w.avatar} size={16} ring="rgba(20,10,4,0.9)" />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function SpotlightCard({ spot, now }: { spot: Spotlight; now: number }) {
  const ending = now - spot.startedAt > spot.durationMs - 700;
  return (
    <div className={`absolute left-0 right-0 top-[226px] flex justify-center ${ending ? 'fade-out' : 'pop-in'}`} key={spot.id}>
      <div className="relative glass rounded-[22px] pl-2.5 pr-5 py-2.5 flex items-center gap-3 border-gold-300/70 shadow-[0_0_40px_rgba(255,190,80,0.35)] overflow-hidden">
        <div className="absolute inset-0 shimmer" />
        <div className="relative">
          <div className="absolute -inset-1.5 rounded-full spin-slow" style={{ background: 'conic-gradient(#ffe7a3, #e2a63a, #fff3c9, #c8851c, #ffe7a3)' }} />
          <div className="relative"><Avatar name={spot.name} url={spot.avatar} size={50} /></div>
        </div>
        <div className="relative min-w-0 max-w-[260px]">
          <div className="text-[10.5px] tracking-[0.2em] text-gold-200 font-semibold">XIN CẢM ƠN</div>
          <div className="font-serif font-bold text-[19px] leading-tight gold-text truncate">{spot.name}</div>
          <div className="text-[12px] text-[#fff1d6] truncate">
            đã gửi {spot.count > 1 ? `${spot.count} × ` : ''}{spot.giftName} 🎁
          </div>
        </div>
      </div>
    </div>
  );
}

// Subtitles for whatever the voice is saying, highlighted as it goes
function Captions({ item, now, rate }: { item: VoiceItem | null; now: number; rate: number }) {
  const [shown, setShown] = useState<VoiceItem | null>(null);
  const [leaving, setLeaving] = useState(false);
  useEffect(() => {
    if (item?.startedAt) {
      setShown(item);
      setLeaving(false);
      return;
    }
    if (!item && shown) {
      setLeaving(true);
      const t = setTimeout(() => setShown(null), 450);
      return () => clearTimeout(t);
    }
  }, [item?.id, item?.startedAt]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!shown) return null;
  const words = shown.text.split(' ');
  const msPerChar = 68 / rate;
  const elapsed = shown.startedAt ? now - shown.startedAt : 0;
  let acc = 0;
  return (
    <div className={`absolute left-0 right-0 top-[532px] flex justify-center px-5 ${leaving ? 'fade-out' : 'pop-in'}`} key={shown.id}>
      <div className="glass rounded-2xl px-4 py-2.5 max-w-[470px] flex gap-2.5 items-start">
        <span className="mt-0.5 flex gap-[2px] items-end h-3.5 shrink-0">
          {[0, 1, 2].map((i) => (
            <span key={i} className="w-[3px] rounded-full bg-gold-300" style={{ height: leaving ? 3 : 4 + ((Math.floor(now / 140) + i * 2) % 4) * 3, transition: 'height .12s' }} />
          ))}
        </span>
        <p className="text-[14px] leading-[1.45] font-medium line-clamp-3">
          {words.map((w, i) => {
            acc += w.length + 1;
            const spoken = acc * msPerChar < elapsed + 120;
            return (
              <span key={i} style={{ color: spoken ? '#fff7e3' : 'rgba(255,240,215,0.5)', transition: 'color .2s' }}>
                {w}{' '}
              </span>
            );
          })}
        </p>
      </div>
    </div>
  );
}

// A golden apricot blossom (hoa mai) opening in the middle of the screen when a gift arrives
function LotusBloom({ blooms }: { blooms: Array<{ id: number; power: number }> }) {
  return (
    <>
      {blooms.map((b) => (
        <div key={b.id} className="absolute left-0 right-0 top-[330px] flex justify-center">
          <svg viewBox="-100 -100 200 200" width={150 + b.power * 50} height={150 + b.power * 50} className="lotus-bloom drop-shadow-[0_0_24px_rgba(255,200,60,0.9)]">
            <defs>
              <radialGradient id={`mg${b.id}`} cx="0" cy="0" r="90" gradientUnits="userSpaceOnUse">
                <stop offset="0" stopColor="#fff3b0" />
                <stop offset="0.55" stopColor="#ffd23f" />
                <stop offset="1" stopColor="#e89a0c" />
              </radialGradient>
            </defs>
            {[0, 72, 144, 216, 288].map((a) => (
              <path key={a} transform={`rotate(${a})`} d="M0 -6 C -42 -20 -40 -80 0 -84 C 40 -80 42 -20 0 -6 Z" fill={`url(#mg${b.id})`} stroke="#fff6cf" strokeWidth="2" />
            ))}
            {Array.from({ length: 14 }, (_, i) => {
              const a = (i / 14) * Math.PI * 2;
              return (
                <g key={i}>
                  <line x1="0" y1="0" x2={Math.cos(a) * 28} y2={Math.sin(a) * 28} stroke="#c2660a" strokeWidth="2" />
                  <circle cx={Math.cos(a) * 30} cy={Math.sin(a) * 30} r="3.6" fill="#b5470b" />
                </g>
              );
            })}
            <circle r="12" fill="#e06a0a" />
          </svg>
        </div>
      ))}
    </>
  );
}

function Disclaimer() {
  const text = 'Không gian vui Tết mang tính giải trí · Quà tặng chỉ để nhận lời chúc, không phải bốc thăm may mắn · Pháo hoa, pháo dây đều là hình 3D, không đốt pháo thật · ';
  return (
    <div className="absolute left-[10px] right-[10px] top-[156px] h-[14px] overflow-hidden opacity-70">
      <div className="marquee whitespace-nowrap text-[9.5px] text-[#f1dfc2] w-max">
        {text}
        {text}
      </div>
    </div>
  );
}

export type TickerItem = { id: string; icon: string; name: string; avatar: string; text: string; at: number };

// Small pills for what just happened (joins, words, fireworks, gifts, follows), newest at the bottom
function Ticker({ items, now }: { items: TickerItem[]; now: number }) {
  return (
    <div className="absolute left-[10px] top-[404px] w-[230px] flex flex-col gap-1.5">
      {items.map((it) => {
        const age = now - it.at;
        return (
          <div key={it.id} className={`${age > 6500 ? 'fade-out' : 'pop-in'} self-start glass rounded-full pl-1 pr-3 py-1 flex items-center gap-1.5 max-w-full`}>
            <Avatar name={it.name} url={it.avatar} size={20} />
            <span className="text-[11px] text-[#fff3dc] truncate">
              <b className="font-semibold text-gold-100">{it.name}</b> {it.text}
            </span>
            <span className="text-[12px] shrink-0">{it.icon}</span>
          </div>
        );
      })}
    </div>
  );
}

export function Overlay({ snap, now, hearts, blooms, ticker, theme }: { snap: Snapshot; now: number; hearts: number[]; blooms: Array<{ id: number; power: number }>; ticker: TickerItem[]; theme: 'dusk' | 'night' }) {
  const g = snap.settings.graphics;
  const spot = snap.spotlight && now - snap.spotlight.startedAt < snap.spotlight.durationMs ? snap.spotlight : null;
  return (
    <>
      {/* keeps the title readable; lighter by day so the spring sky stays blue */}
      <div className={`absolute inset-x-0 top-0 h-[300px] bg-gradient-to-b ${theme === 'night' ? 'from-black/55 via-black/20' : 'from-black/30 via-black/5'} to-transparent`} />
      <Title snap={snap} />
      {g.disclaimer && <Disclaimer />}
      {snap.musicCredit && (
        <div className="absolute left-0 right-0 top-[171px] text-center text-[8.5px] text-[#f1dfc2]/65 truncate px-8">♪ {snap.musicCredit}</div>
      )}
      {g.hints && !spot && <Hints snap={snap} />}
      {/* side panels step aside while the camera is on a gift giver */}
      <div className="absolute inset-0" style={{ opacity: spot ? 0 : 1, transform: spot ? 'scale(0.97)' : 'none', transition: 'all .6s ease' }}>
        <GuideBoard snap={snap} />
        <LikeGoal snap={snap} now={now} hearts={hearts} />
        <OfferLine snap={snap} />
        <Ticker items={ticker} now={now} />
      </div>
      <LotusBloom blooms={blooms} />
      {spot && <SpotlightCard spot={spot} now={now} />}
      {g.captions && <Captions item={snap.voice.current} now={now} rate={snap.settings.voice.rate} />}
    </>
  );
}

export function useRaf() {
  const [t, setT] = useState(0);
  const raf = useRef(0);
  useEffect(() => {
    let last = 0;
    const loop = (ms: number) => {
      raf.current = requestAnimationFrame(loop);
      if (ms - last > 100) {
        last = ms;
        setT(ms);
      }
    };
    raf.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf.current);
  }, []);
  return t;
}
