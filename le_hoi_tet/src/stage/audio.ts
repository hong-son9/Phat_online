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

  // A burst of filtered noise (the body of explosions, crackles and whooshes)
  private noise(seconds: number, decay: number, filter: BiquadFilterType, freq: number, q: number, gain: number, when = 0, dest?: AudioNode) {
    const ctx = this.ctx!;
    const len = Math.max(1, Math.floor(ctx.sampleRate * seconds));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = filter;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = ctx.createGain();
    g.gain.value = gain;
    src.connect(f).connect(g).connect(dest ?? this.sfxBus);
    src.start(ctx.currentTime + when);
    return f;
  }

  // A firework going up: a rising whistle over a hiss
  launch() {
    if (!this.sfxOn || !this.init()) return;
    const ctx = this.ctx!;
    const t = ctx.currentTime;
    // the whistle: a clear tone sliding up, with a little warble, loud enough to cut through the music
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(900, t);
    o.frequency.exponentialRampToValueAtTime(2600, t + 0.95);
    const wob = ctx.createOscillator();
    const wobGain = ctx.createGain();
    wob.frequency.value = 22;
    wobGain.gain.value = 45;
    wob.connect(wobGain).connect(o.frequency);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.2, t + 0.08);
    g.gain.setValueAtTime(0.2, t + 0.75);
    g.gain.exponentialRampToValueAtTime(0.001, t + 1.05);
    o.connect(g).connect(this.sfxBus);
    o.start(t);
    o.stop(t + 1.1);
    wob.start(t);
    wob.stop(t + 1.1);
    // the hiss of the burning tail
    const f = this.noise(1.0, 1.0, 'bandpass', 1500, 1.0, 0.3);
    f.frequency.setValueAtTime(800, t);
    f.frequency.exponentialRampToValueAtTime(3200, t + 0.9);
  }

  // The burst: a deep thump, then the crackle of the stars
  boom(power = 1) {
    if (!this.sfxOn || !this.init()) return;
    const ctx = this.ctx!;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(110, t);
    o.frequency.exponentialRampToValueAtTime(38, t + 0.6);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.55 * Math.min(1.6, power), t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.9);
    o.connect(g).connect(this.sfxBus);
    o.start(t);
    o.stop(t + 1);
    this.noise(1.2, 3, 'lowpass', 900, 0.7, 0.5 * Math.min(1.6, power));
    for (let i = 0; i < 10 + power * 8; i++) this.noise(0.03, 2, 'highpass', 2500, 0.5, 0.1, 0.25 + Math.random() * 1.2);
  }

  // One firecracker on a string going off
  crackle() {
    if (!this.sfxOn || !this.init()) return;
    this.noise(0.05, 4, 'bandpass', 1800 + Math.random() * 1500, 0.9, 0.5);
  }

  // Lion-dance drum (trống): a low membrane hit, with a cymbal splash now and then
  drum(power = 1) {
    if (!this.sfxOn || !this.init()) return;
    const ctx = this.ctx!;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(150, t);
    o.frequency.exponentialRampToValueAtTime(60, t + 0.25);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.42 * power, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
    o.connect(g).connect(this.sfxBus);
    o.start(t);
    o.stop(t + 0.45);
    this.noise(0.08, 3, 'lowpass', 600, 0.7, 0.24 * power);
    if (Math.random() < 0.35) this.noise(0.8, 2.5, 'highpass', 5000, 0.4, 0.08 * power, 0.02);
  }

  bloom(power = 1) {
    if (!this.sfxOn || !this.init()) return;
    const notes = [0, 2, 4, 7, 5];
    notes.forEach((n, i) => this.tone(PENTA[n] * 2, 'sine', 0.22 * Math.min(1.5, power), 0.004, 2.2 + power * 0.5, i * 0.06));
    if (power > 1.5) this.bell(0.5);
  }

  // ---------- Tết music ----------
  // Original tunes in the bright five-note scale of Vietnamese folk songs, played by a sáo trúc
  // (bamboo flute) and a đàn tranh (zither), with drums, a small gong (thanh la), cymbals (xập xõa)
  // and the clapper (phách). Notes are scheduled on the audio clock a little ahead of time, so the
  // rhythm stays steady even when the page is busy.

  private startTrack(key: string): MusicHandle {
    if (key.startsWith('file:')) return this.fileTrack(`/music/${encodeURIComponent(key.slice(5))}`);
    if (key === 'builtin:hoixuan') return this.tetTrack('hoixuan');
    if (key === 'builtin:tetque') return this.tetTrack('tetque');
    return this.tetTrack('xuan');
  }

  // Calls onStep(i, at) for every step, `at` on the audio clock, a third of a second ahead
  private sequence(stepSec: number, onStep: (i: number, at: number) => void): MusicHandle {
    const ctx = this.ctx!;
    let next = ctx.currentTime + 0.2;
    let i = 0;
    let alive = true;
    const timer = setInterval(() => {
      if (!alive) return;
      // while audio is suspended nothing is scheduled, or it would all play at once on resume
      if (ctx.state !== 'running') {
        next = ctx.currentTime + 0.2;
        return;
      }
      if (next < ctx.currentTime) next = ctx.currentTime + 0.05; // after a hiccup, carry on rather than rush
      while (next < ctx.currentTime + 0.35) {
        onStep(i++, next);
        next += stepSec;
      }
    }, 90);
    return {
      stop: () => {
        alive = false;
        clearInterval(timer);
      },
    };
  }

  // Đàn tranh: a bright plucked string; `slide` bends up into the note (the tranh's signature ornament)
  private pluck(freq: number, gain: number, at: number, dest: AudioNode, slide = false) {
    const ctx = this.ctx!;
    for (const [type, mul, g] of [['triangle', 1, gain], ['sine', 2, gain * 0.3], ['sine', 3, gain * 0.08]] as const) {
      const o = ctx.createOscillator();
      const og = ctx.createGain();
      o.type = type;
      o.frequency.setValueAtTime(freq * mul * (slide ? 0.89 : 1.01), at);
      o.frequency.exponentialRampToValueAtTime(freq * mul, at + (slide ? 0.12 : 0.04));
      og.gain.setValueAtTime(0, at);
      og.gain.linearRampToValueAtTime(g, at + 0.004);
      og.gain.exponentialRampToValueAtTime(0.0008, at + 1.3);
      o.connect(og).connect(dest);
      o.start(at);
      o.stop(at + 1.35);
    }
  }

  // Sáo trúc: a breathy, singing tone with vibrato that comes in after the note starts
  private flute(freq: number, gain: number, at: number, dur: number, dest: AudioNode) {
    const ctx = this.ctx!;
    const end = at + dur;
    const o = ctx.createOscillator();
    const o2 = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sine';
    o2.type = 'triangle';
    o.frequency.setValueAtTime(freq, at);
    o2.frequency.setValueAtTime(freq * 2, at);
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfo.frequency.value = 5.4;
    lfoGain.gain.setValueAtTime(0, at);
    lfoGain.gain.linearRampToValueAtTime(freq * 0.008, at + Math.min(0.35, dur * 0.6));
    lfo.connect(lfoGain);
    lfoGain.connect(o.frequency);
    lfoGain.connect(o2.frequency);
    const g2 = ctx.createGain();
    g2.gain.value = 0.12;
    g.gain.setValueAtTime(0, at);
    g.gain.linearRampToValueAtTime(gain, at + 0.05);
    g.gain.setValueAtTime(gain * 0.9, end - 0.08);
    g.gain.exponentialRampToValueAtTime(0.0008, end + 0.12);
    o.connect(g);
    o2.connect(g2).connect(g);
    g.connect(dest);
    for (const x of [o, o2, lfo]) {
      x.start(at);
      x.stop(end + 0.15);
    }
    // a puff of breath at the start
    this.noiseAt(at, 0.08, 2, 'bandpass', freq * 1.5, 2, gain * 0.25, dest);
  }

  private noiseAt(at: number, seconds: number, decay: number, filter: BiquadFilterType, freq: number, q: number, gain: number, dest: AudioNode) {
    this.noise(seconds, decay, filter, freq, q, gain, Math.max(0, at - this.ctx!.currentTime), dest);
  }

  private beat(at: number, big: boolean, gain: number, dest: AudioNode) {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.frequency.setValueAtTime(big ? 120 : 210, at);
    o.frequency.exponentialRampToValueAtTime(big ? 52 : 120, at + (big ? 0.22 : 0.1));
    g.gain.setValueAtTime(gain, at);
    g.gain.exponentialRampToValueAtTime(0.001, at + (big ? 0.35 : 0.16));
    o.connect(g).connect(dest);
    o.start(at);
    o.stop(at + 0.4);
    this.noiseAt(at, 0.06, 3, 'lowpass', big ? 500 : 1200, 0.7, gain * 0.5, dest);
  }

  // thanh la: a small bright gong
  private gongHit(at: number, gain: number, dest: AudioNode) {
    const ctx = this.ctx!;
    [1, 1.48, 2.13, 2.92].forEach((r, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.value = 620 * r;
      g.gain.setValueAtTime(0, at);
      g.gain.linearRampToValueAtTime(gain / (i + 1), at + 0.003);
      g.gain.exponentialRampToValueAtTime(0.0008, at + 1.2 - i * 0.2);
      o.connect(g).connect(dest);
      o.start(at);
      o.stop(at + 1.25);
    });
  }

  // D major pentatonic, index 0 = D4
  private static SCALE = [293.66, 329.63, 369.99, 440, 493.88, 587.33, 659.25, 739.99, 880, 987.77, 1174.66];

  // Four phrases of [scale step, length in eighths], sixteen eighths (four bars of 2/4) each
  private static PHRASES: Array<Array<[number, number]>> = [
    [[5, 1], [4, 1], [3, 2], [4, 1], [5, 1], [6, 2], [5, 1], [6, 1], [7, 1], [6, 1], [5, 4]],
    [[3, 1], [4, 1], [5, 2], [4, 1], [3, 1], [2, 2], [3, 1], [2, 1], [1, 1], [2, 1], [3, 4]],
    [[6, 2], [7, 2], [8, 2], [7, 1], [6, 1], [5, 1], [6, 1], [5, 1], [4, 1], [3, 4]],
    [[4, 1], [5, 1], [6, 1], [5, 1], [4, 2], [3, 2], [2, 1], [3, 1], [1, 1], [2, 1], [0, 4]],
  ];
  // the chord root (scale step) under each bar of each phrase
  private static ROOTS = [
    [0, 0, 3, 0],
    [3, 4, 1, 3],
    [0, 0, 4, 3],
    [4, 3, 1, 0],
  ];

  private tetTrack(kind: 'xuan' | 'hoixuan' | 'tetque'): MusicHandle {
    const S = StageAudio.SCALE;
    const note = (step: number, octave = 0) => S[Math.max(0, Math.min(S.length - 1, step))] * Math.pow(2, octave);
    // the song: A A' B B' with the melody laid out eighth by eighth
    const order = [0, 1, 2, 3, 0, 1, 2, 3];
    const events: Array<{ at: number; step: number; len: number }> = [];
    let pos = 0;
    for (const p of order) {
      for (const [step, len] of StageAudio.PHRASES[p]) {
        events.push({ at: pos, step, len });
        pos += len;
      }
    }
    const total = pos; // eighths in one time through
    const startAt = new Map(events.map((e) => [e.at, e]));
    const eighth = kind === 'hoixuan' ? 0.21 : kind === 'tetque' ? 0.34 : 0.25;
    const bus = this.musicBus;

    return this.sequence(eighth, (i, at) => {
      const e8 = i % total; // eighth within the song
      const bar = Math.floor(e8 / 4);
      const inBar = e8 % 4;
      const phrase = order[Math.floor(bar / 4) % order.length];
      const root = StageAudio.ROOTS[phrase][bar % 4];
      const second = Math.floor(i / total) % 2 === 1; // every other time through, a little different
      const ev = startAt.get(e8);

      // melody
      if (ev) {
        const dur = ev.len * eighth;
        if (kind === 'tetque') {
          this.flute(note(ev.step), 0.1, at, dur * 0.98, bus);
          if (ev.len >= 2) this.pluck(note(ev.step, -1), 0.07, at, bus, true);
        } else if (kind === 'hoixuan') {
          this.pluck(note(ev.step), 0.12, at, bus, ev.len >= 2);
          if (second) this.flute(note(ev.step, 1), 0.045, at, dur * 0.9, bus);
          else this.flute(note(ev.step), 0.05, at, dur * 0.9, bus);
        } else {
          this.flute(note(ev.step, second ? 1 : 0), 0.085, at, dur * 0.95, bus);
          // the tranh answers long notes with a slide
          if (ev.len >= 2) this.pluck(note(ev.step), 0.06, at + eighth, bus, true);
        }
      }

      // đàn tranh broken chords under it
      const arp = [root, root + 2, root + 4, root + 2];
      if (kind === 'tetque') {
        if (inBar % 2 === 0) this.pluck(note(arp[inBar], -1), 0.055, at, bus);
      } else this.pluck(note(arp[inBar], -1), kind === 'hoixuan' ? 0.05 : 0.045, at, bus);

      // percussion
      if (kind === 'xuan') {
        if (inBar === 0) this.beat(at, true, 0.13, bus);
        if (inBar === 2) this.beat(at, false, 0.07, bus);
        if (inBar % 2 === 1) this.noiseAt(at, 0.03, 3, 'bandpass', 2600, 4, 0.08, bus); // phách
      } else if (kind === 'hoixuan') {
        // lion-dance drum: tùng tùng cắc tùng, a gong at each phrase, cymbals on the off-beats
        if (inBar === 0 || inBar === 1 || inBar === 3) this.beat(at, inBar === 0, inBar === 0 ? 0.18 : 0.11, bus);
        if (inBar === 2) this.noiseAt(at, 0.035, 3, 'bandpass', 3000, 5, 0.16, bus);
        if (e8 % 16 === 0) this.gongHit(at, 0.09, bus);
        if (inBar % 2 === 1) this.noiseAt(at, 0.4, 3, 'highpass', 6500, 0.5, 0.05, bus);
      } else if (e8 % 8 === 0) this.beat(at, true, 0.07, bus);
    });
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
