// Name plates and chat bubbles that follow people on screen. Plain DOM (viewer text only ever goes
// through textContent), positioned with transforms every frame by the world.

export type LabelKind = 'hall' | 'top' | 'offer' | 'spot';
export type LabelData = { name: string; avatar: string; vip: boolean; kind: LabelKind; rank?: number };

const PALETTE = ['#b45309', '#9d174d', '#0f766e', '#6d28d9', '#1d4ed8', '#a16207', '#be123c', '#047857'];
export const colorFor = (s: string) => PALETTE[[...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7) % PALETTE.length];
const initial = (name: string) => ([...name.replace(/[^\p{L}\p{N}]/gu, '')][0] ?? '?').toUpperCase();

export function avatarEl(name: string, url: string, size: number) {
  const wrap = document.createElement('div');
  wrap.className = 'lbl-av';
  wrap.style.width = wrap.style.height = `${size}px`;
  const fallback = () => {
    wrap.textContent = initial(name);
    wrap.style.background = colorFor(name);
    wrap.style.fontSize = `${Math.round(size * 0.5)}px`;
  };
  if (url) {
    const img = document.createElement('img');
    img.src = url;
    img.referrerPolicy = 'no-referrer';
    img.alt = '';
    img.onerror = () => {
      img.remove();
      fallback();
    };
    wrap.appendChild(img);
  } else fallback();
  return wrap;
}

export class Label {
  el = document.createElement('div');
  private bubble: HTMLDivElement | null = null;
  private bubbleTimer = 0;
  private sig = '';

  constructor(public data: LabelData) {
    this.render();
  }

  update(data: LabelData) {
    this.data = data;
    this.render();
  }

  private render() {
    const d = this.data;
    const sig = `${d.kind}|${d.name}|${d.avatar}|${d.vip}|${d.rank}`;
    if (sig === this.sig) return;
    this.sig = sig;
    const keepBubble = this.bubble;
    this.el.replaceChildren();
    this.el.className = `lbl lbl-${d.kind}${d.vip ? ' lbl-vip' : ''}`;
    if (d.kind === 'hall') {
      this.el.appendChild(avatarEl(d.name, d.avatar, 22));
    } else if (d.kind === 'top') {
      const av = avatarEl(d.name, d.avatar, 26);
      this.el.appendChild(av);
      const badge = document.createElement('span');
      badge.className = 'lbl-rank';
      badge.textContent = String(d.rank ?? '');
      this.el.appendChild(badge);
      const name = document.createElement('span');
      name.className = 'lbl-name';
      name.textContent = d.name;
      this.el.appendChild(name);
    } else {
      const plate = document.createElement('div');
      plate.className = 'lbl-plate';
      plate.appendChild(avatarEl(d.name, d.avatar, d.kind === 'spot' ? 26 : 20));
      const name = document.createElement('span');
      name.textContent = d.name;
      plate.appendChild(name);
      this.el.appendChild(plate);
    }
    if (keepBubble) this.el.appendChild(keepBubble);
  }

  say(text: string) {
    this.bubble?.remove();
    const b = document.createElement('div');
    b.className = 'lbl-bubble';
    b.textContent = text.length > 60 ? `${text.slice(0, 58)}…` : text;
    this.el.appendChild(b);
    this.bubble = b;
    clearTimeout(this.bubbleTimer);
    this.bubbleTimer = window.setTimeout(() => {
      b.classList.add('out');
      setTimeout(() => {
        b.remove();
        if (this.bubble === b) this.bubble = null;
      }, 400);
    }, 5200);
  }

  get talking() {
    return !!this.bubble;
  }

  place(x: number, y: number, scale: number, visible: boolean, z: number) {
    this.el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) scale(${scale.toFixed(3)})`;
    this.el.style.opacity = visible ? '1' : '0';
    this.el.style.zIndex = String(z);
  }
}
