import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { X } from 'lucide-react';

// Small building blocks for the dashboard

export function Toggle({ on, onChange, label, hint }: { on: boolean; onChange: (v: boolean) => void; label: ReactNode; hint?: ReactNode }) {
  return (
    <label className="flex items-start gap-3 py-2 cursor-pointer select-none group">
      <button
        type="button"
        role="switch"
        aria-checked={on}
        onClick={() => onChange(!on)}
        className={`mt-0.5 relative w-9 h-5 rounded-full shrink-0 transition-colors ${on ? 'bg-gold-400' : 'bg-ink-700 group-hover:bg-ink-600'}`}
      >
        <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${on ? 'left-[18px]' : 'left-0.5'}`} />
      </button>
      <span className="min-w-0">
        <span className="block text-sm text-[#efe3d3]">{label}</span>
        {hint && <span className="block text-xs text-[#9c8a77] mt-0.5 leading-relaxed">{hint}</span>}
      </span>
    </label>
  );
}

export function Slider({ label, value, min, max, step, onChange, format }: { label: ReactNode; value: number; min: number; max: number; step: number; onChange: (v: number) => void; format?: (v: number) => string }) {
  // Local value while dragging; the server is only told when the drag ends
  const [v, setV] = useState(value);
  useEffect(() => setV(value), [value]);
  return (
    <div className="py-2">
      <div className="flex justify-between text-sm mb-1.5">
        <span className="text-[#efe3d3]">{label}</span>
        <span className="text-gold-200 tabular-nums font-medium">{format ? format(v) : v}</span>
      </div>
      <input
        type="range" min={min} max={max} step={step} value={v} className="w-full"
        onChange={(e) => setV(Number(e.target.value))}
        onPointerUp={() => onChange(v)}
        onKeyUp={() => onChange(v)}
      />
    </div>
  );
}

export function Field({ label, hint, children }: { label: ReactNode; hint?: ReactNode; children: ReactNode }) {
  return (
    <div className="py-2">
      <div className="text-sm text-[#efe3d3] mb-1.5">{label}</div>
      {children}
      {hint && <div className="text-xs text-[#9c8a77] mt-1.5 leading-relaxed">{hint}</div>}
    </div>
  );
}

export function SectionTitle({ icon, children, right }: { icon?: ReactNode; children: ReactNode; right?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2 mb-3">
      <h3 className="flex items-center gap-2 text-[13px] font-semibold tracking-wide text-gold-200 uppercase">
        {icon}
        {children}
      </h3>
      {right}
    </div>
  );
}

export function Drawer({ open, onClose, title, children, width = 480 }: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; width?: number }) {
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [open, onClose]);
  return (
    <div className={`fixed inset-0 z-40 ${open ? '' : 'pointer-events-none'}`}>
      <div className={`absolute inset-0 bg-black/50 transition-opacity ${open ? 'opacity-100' : 'opacity-0'}`} onClick={onClose} />
      <aside
        className={`absolute right-0 top-0 bottom-0 bg-ink-900 border-l border-ink-700 shadow-2xl flex flex-col transition-transform duration-300 max-w-full ${open ? 'translate-x-0' : 'translate-x-full'}`}
        style={{ width }}
      >
        <div className="flex items-center justify-between px-5 h-14 border-b border-ink-700 shrink-0">
          <h2 className="font-semibold text-[15px]">{title}</h2>
          <button className="p-2 rounded-lg hover:bg-ink-800 text-[#b8a693]" onClick={onClose} aria-label="Đóng">
            <X size={18} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto scroll-thin">{children}</div>
      </aside>
    </div>
  );
}

export function Modal({ open, onClose, children, width = 560 }: { open: boolean; onClose?: () => void; children: ReactNode; width?: number }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative card shadow-2xl pop-in w-full max-h-[92vh] overflow-y-auto scroll-thin" style={{ maxWidth: width }}>
        {children}
      </div>
    </div>
  );
}

// ---------- toasts ----------

type Toast = { id: number; text: ReactNode; tone: 'ok' | 'err' | 'info' };
const ToastCtx = createContext<(text: ReactNode, tone?: Toast['tone']) => void>(() => {});
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [list, setList] = useState<Toast[]>([]);
  const push = useCallback((text: ReactNode, tone: Toast['tone'] = 'ok') => {
    const id = Date.now() + Math.random();
    setList((l) => [...l.slice(-3), { id, text, tone }]);
    setTimeout(() => setList((l) => l.filter((t) => t.id !== id)), 3200);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-[60] flex flex-col gap-2 items-center pointer-events-none">
        {list.map((t) => (
          <div
            key={t.id}
            className={`pop-in px-4 py-2.5 rounded-xl text-sm font-medium shadow-xl border ${
              t.tone === 'err' ? 'bg-red-950 border-red-800 text-red-100' : t.tone === 'info' ? 'bg-ink-800 border-ink-600 text-[#efe3d3]' : 'bg-emerald-950 border-emerald-800 text-emerald-100'
            }`}
          >
            {t.text}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export function timeAgo(at: number, now: number) {
  const s = Math.max(0, Math.round((now - at) / 1000));
  if (s < 5) return 'vừa xong';
  if (s < 60) return `${s} giây`;
  if (s < 3600) return `${Math.floor(s / 60)} phút`;
  return `${Math.floor(s / 3600)} giờ`;
}

export function duration(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}` : `${m}:${String(sec).padStart(2, '0')}`;
}

export async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  }
}
