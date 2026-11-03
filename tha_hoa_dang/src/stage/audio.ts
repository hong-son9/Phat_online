// Stage audio: voice playback (reported back to the server), bells, chimes and water sounds, and
// background music. Effects and the three built-in tracks are synthesized, so no audio files are needed.

type MusicHandle = { stop: () => void };

const PENTA = [293.66, 329.63, 369.99, 440, 493.88, 587.33, 659.25, 739.99, 880];

class StageAudio {
  ctx: AudioContext | null = null;
  private master!: GainNode;
  private sfxBus!: GainNode;
  private musicBus!: GainNode;
  private reverb!: ConvolverNode;
  private music: MusicHandle | null = null;
  private musicKey = '';
  private musicVolume = 0.35;
  private sfxVolume = 0.7;
  private sfxOn = true;
  private ducked = false;
  private voiceEl: HTMLAudioElement | null = null;
  private voiceId = '';
  voiceVolume = 1;
  onBlocked: (blocked: boolean) => void = () => {};

  init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
      return this.ctx;
    }
    const ctx = new AudioContext();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.connect(ctx.destination);
    this.reverb = ctx.createConvolver();
    this.reverb.buffer = this.impulse(3.2, 2.4);
    const wet = ctx.createGain();
    wet.gain.value = 0.55;
    this.reverb.connect(wet).connect(this.master);
    this.sfxBus = ctx.createGain();
    this.sfxBus.gain.value = this.sfxVolume;
    this.sfxBus.connect(this.master);
    this.sfxBus.connect(this.reverb);
    this.musicBus = ctx.createGain();
    this.musicBus.gain.value = 0;
    this.musicBus.connect(this.master);
    this.musicBus.connect(this.reverb);
    ctx.onstatechange = () => this.onBlocked(ctx.state !== 'running');
    if (ctx.state !== 'running') {
      ctx.resume().catch(() => {});
      setTimeout(() => this.onBlocked(ctx.state !== 'running'), 600);
    }
    return ctx;
  }

  private impulse(seconds: number, decay: number) {
    const ctx = this.ctx!;
    const len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
    return buf;
  }

  // ---------- settings ----------

  configure(o: { music: boolean; track: string; musicVolume: number; sfx: boolean; sfxVolume: number; voiceVolume: number }) {
    this.sfxOn = o.sfx;
    this.sfxVolume = o.sfxVolume;
    this.musicVolume = o.musicVolume;
    this.voiceVolume = o.voiceVolume;
    if (this.voiceEl) this.voiceEl.volume = this.voiceVolume;
    if (!this.ctx) return;
    this.sfxBus.gain.setTargetAtTime(this.sfxVolume, this.ctx.currentTime, 0.1);
    const key = o.music ? o.track : '';
    if (key !== this.musicKey) {
      this.music?.stop();
      this.music = null;
      this.musicKey = key;
      if (key) this.music = this.startTrack(key);
    }
    this.applyMusicGain();
  }

  private applyMusicGain() {
    if (!this.ctx) return;
    const target = this.musicKey ? this.musicVolume * (this.ducked ? 0.3 : 1) : 0;
    this.musicBus.gain.setTargetAtTime(target, this.ctx.currentTime, this.ducked ? 0.15 : 0.8);
  }

  // ---------- voice ----------

  playVoice(id: string, url: string) {
    this.stopVoice();
    const el = new Audio(url);
    el.volume = this.voiceVolume;
    this.voiceEl = el;
    this.voiceId = id;
    const report = (what: 'started' | 'ended') =>
      fetch(`/api/voice/${what}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) }).catch(() => {});
    let done = false;
    const end = () => {
      if (done) return;
      done = true;
      if (this.voiceEl === el) {
        this.voiceEl = null;
        this.ducked = false;
        this.applyMusicGain();
      }
      report('ended');
    };
    el.onplaying = () => {
      this.ducked = true;
      this.applyMusicGain();
      report('started');
    };
    el.onended = end;
    el.onerror = end;
    el.play().catch((err: DOMException) => {
      if (err?.name !== 'NotAllowedError') return end();
      // Autoplay blocked: keep the line and play it as soon as someone clicks the page
      this.onBlocked(true);
      this.blockedVoice = el;
    });
  }

  private blockedVoice: HTMLAudioElement | null = null;

  // Called from a click on the stage page
  unlock() {
    this.init();
    const el = this.blockedVoice;
    this.blockedVoice = null;
    if (el && el === this.voiceEl) el.play().catch(() => el.onerror?.(new Event('error')));
  }

  stopVoice(id?: string) {
    if (!this.voiceEl || (id && id !== this.voiceId)) return;
    this.voiceEl.onended = null;
    this.voiceEl.onerror = null;
    this.voiceEl.pause();
    this.voiceEl = null;
    this.ducked = false;
    this.applyMusicGain();
  }

  // ---------- effects ----------

  private tone(freq: number, type: OscillatorType, gain: number, attack: number, decay: number, when = 0, dest?: AudioNode) {
    const ctx = this.ctx!;
    const t = ctx.currentTime + when;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.value = freq;
    o.detune.value = (Math.random() - 0.5) * 6;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
    o.connect(g).connect(dest ?? this.sfxBus);
    o.start(t);
    o.stop(t + attack + decay + 0.05);
  }

  bell(power = 1) {
    if (!this.sfxOn || !this.init()) return;
    // Large bronze bell: inharmonic partials, long tail
    const base = 130.8;
    [1, 2.0, 2.76, 3.9, 5.4, 6.8].forEach((r, i) => this.tone(base * r, 'sine', (0.5 * power) / (i + 1), 0.01, 7 - i, 0));
  }

  gong(power = 1) {
    if (!this.sfxOn || !this.init()) return;
    // Wooden fish (mõ): short hollow knock
    const ctx = this.ctx!;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    const f = ctx.createBiquadFilter();
    const g = ctx.createGain();
    o.type = 'triangle';
    o.frequency.setValueAtTime(520, t);
    o.frequency.exponentialRampToValueAtTime(360, t + 0.08);
    f.type = 'bandpass';
    f.frequency.value = 450;
    f.Q.value = 5;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(1.1 * power, t + 0.003);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
    o.connect(f).connect(g).connect(this.sfxBus);
    o.start(t);
    o.stop(t + 0.25);
  }

  chime(power = 1) {
    if (!this.sfxOn || !this.init()) return;
    [0, 2, 4, 5, 7].forEach((n, i) => this.tone(PENTA[n] * 2, 'sine', 0.18 * power, 0.005, 2.6, i * 0.09));
  }

  // Something dropping into the river: a short "plop" and a wash of water noise
  splash(power = 1) {
    if (!this.sfxOn || !this.init()) return;
    const ctx = this.ctx!;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    const og = ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(900, t);
    o.frequency.exponentialRampToValueAtTime(220, t + 0.12);
    og.gain.setValueAtTime(0, t);
    og.gain.linearRampToValueAtTime(0.35 * power, t + 0.005);
    og.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
    o.connect(og).connect(this.sfxBus);
    o.start(t);
    o.stop(t + 0.2);
    const len = Math.floor(ctx.sampleRate * 0.6);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 1400;
    f.Q.value = 0.8;
    const ng = ctx.createGain();
    ng.gain.value = 0.28 * power;
    src.connect(f).connect(ng).connect(this.sfxBus);
    src.start(t + 0.01);
  }

  bloom(power = 1) {
    if (!this.sfxOn || !this.init()) return;
    const notes = [0, 2, 4, 7, 5];
    notes.forEach((n, i) => this.tone(PENTA[n] * 2, 'sine', 0.22 * Math.min(1.5, power), 0.004, 2.2 + power * 0.5, i * 0.06));
    if (power > 1.5) this.bell(0.5);
  }

  // ---------- music ----------

  private startTrack(key: string): MusicHandle {
    if (key.startsWith('file:')) return this.fileTrack(`/music/${encodeURIComponent(key.slice(5))}`);
    if (key === 'builtin:bowls') return this.bowlsTrack();
    if (key === 'builtin:rain') return this.rainTrack();
    return this.calmTrack();
  }

  private loop(fn: () => number): MusicHandle {
    let alive = true;
    let timer: ReturnType<typeof setTimeout>;
    const step = () => {
      if (!alive) return;
      // While audio is suspended no notes are scheduled, or they'd all sound at once on resume
      if (this.ctx?.state !== 'running') {
        timer = setTimeout(step, 1000);
        return;
      }
      timer = setTimeout(step, fn());
    };
    timer = setTimeout(step, 400);
    return { stop: () => ((alive = false), clearTimeout(timer)) };
  }

  // Soft pentatonic notes over a quiet, slowly breathing chord
  private calmTrack(): MusicHandle {
    const ctx = this.ctx!;
    const pad = ctx.createGain();
    pad.gain.value = 0.05;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 700;
    pad.connect(lp).connect(this.musicBus);
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfo.frequency.value = 0.07;
    lfoGain.gain.value = 0.025;
    lfo.connect(lfoGain).connect(pad.gain);
    lfo.start();
    const oscs = [146.83, 220, 293.66, 369.99].map((f, i) => {
      const o = ctx.createOscillator();
      o.type = i % 2 ? 'triangle' : 'sine';
      o.frequency.value = f;
      o.detune.value = (i - 1.5) * 4;
      o.connect(pad);
      o.start();
      return o;
    });
    let last = 3;
    const melody = this.loop(() => {
      // a gentle random walk over the scale
      last = Math.max(0, Math.min(PENTA.length - 1, last + Math.round((Math.random() - 0.5) * 4)));
      this.tone(PENTA[last], 'sine', 0.16, 0.04, 3.5, 0, this.musicBus);
      if (Math.random() < 0.3) this.tone(PENTA[last] / 2, 'triangle', 0.06, 0.08, 4, 0.02, this.musicBus);
      return 1300 + Math.random() * 2600;
    });
    return {
      stop: () => {
        melody.stop();
        oscs.forEach((o) => o.stop());
        lfo.stop();
        setTimeout(() => pad.disconnect(), 100);
      },
    };
  }

  // Singing bowls struck every few seconds
  private bowlsTrack(): MusicHandle {
    const bowls = [196, 261.63, 329.63, 392];
    return this.loop(() => {
      const f = bowls[Math.floor(Math.random() * bowls.length)];
      [1, 2.71, 5.12].forEach((r, i) => this.tone(f * r, 'sine', 0.2 / (i + 1.5), 0.02, 9 - i * 2, 0, this.musicBus));
      return 5000 + Math.random() * 6000;
    });
  }

  // Soft rain with a chime now and then
  private rainTrack(): MusicHandle {
    const ctx = this.ctx!;
    const len = ctx.sampleRate * 4;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let b = 0;
    for (let i = 0; i < len; i++) {
      b = 0.97 * b + 0.03 * (Math.random() * 2 - 1);
      d[i] = b * 3 + (Math.random() < 0.0008 ? (Math.random() - 0.5) * 0.6 : 0);
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 1800;
    const g = ctx.createGain();
    g.gain.value = 0.35;
    src.connect(f).connect(g).connect(this.musicBus);
    src.start();
    const chimes = this.loop(() => {
      this.tone(PENTA[Math.floor(Math.random() * PENTA.length)] * 2, 'sine', 0.06, 0.01, 3, 0, this.musicBus);
      return 4000 + Math.random() * 7000;
    });
    return { stop: () => (chimes.stop(), src.stop()) };
  }

  private fileTrack(url: string): MusicHandle {
    const el = new Audio(url);
    el.loop = true;
    el.crossOrigin = 'anonymous';
    const src = this.ctx!.createMediaElementSource(el);
    src.connect(this.musicBus);
    el.play().catch(() => this.onBlocked(true));
    return { stop: () => (el.pause(), src.disconnect()) };
  }
}

export const stageAudio = new StageAudio();
