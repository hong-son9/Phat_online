import * as THREE from 'three';
import { glowTexture, smokeTexture } from './textures';

// Fireworks: shells climb with a glowing head and a sparkling tail, then burst in one of several
// patterns. Stars change colour as they burn out, some leave trails, some split again, some glitter.
// Each burst lights up the square with a flash of its colour and leaves a drifting puff of smoke.

export type BurstKind = 'peony' | 'chrysanthemum' | 'willow' | 'ring' | 'heart' | 'palm' | 'crossette' | 'strobe';

// [star colour, colour it fades to]
const PAIRS: Array<[number, number]> = [
  [0xff3b3b, 0xffb020],
  [0xffd23f, 0xff6a00],
  [0xff7ad9, 0xffffff],
  [0x5ce1ff, 0x2a5cff],
  [0x7dff8a, 0xfff35c],
  [0xb388ff, 0xff5ab4],
  [0xff9a3c, 0xff2a2a],
  [0xffffff, 0xffd27a],
];
const GOLD = new THREE.Color(0xffc861);
const EMBER = new THREE.Color(0xffa040);
const pickPair = () => PAIRS[Math.floor(Math.random() * PAIRS.length)];

const F_FLICKER = 1;
const F_TRAIL = 2;
const F_GLITTER = 4; // strong white strobing

type Rocket = { p: THREE.Vector3; v: THREE.Vector3; fuse: number; kind: BurstKind; size: number };

export class Fireworks {
  group = new THREE.Group();
  private points: THREE.Points;
  private n: number;
  private pos: Float32Array;
  private vel: Float32Array;
  private col: Float32Array;
  private c0: Float32Array;
  private c1: Float32Array;
  private alpha: Float32Array;
  private psize: Float32Array;
  private life: Float32Array;
  private max: Float32Array;
  private drag: Float32Array;
  private grav: Float32Array;
  private flags: Uint8Array;
  private trailT: Float32Array;
  private splitAt: Float32Array; // crossette: split into four when life drops below this (0 = never)
  private next = 0;
  private material: THREE.ShaderMaterial;
  private rockets: Rocket[] = [];
  private flashes: Array<{ light: THREE.PointLight; v: number }> = [];
  private smoke: Array<{ s: THREE.Sprite; age: number; life: number; grow: number; drift: THREE.Vector3 }> = [];
  private smokeMat: THREE.SpriteMaterial;
  private day = true;
  private glitterAt = 0;
  onBurst: (pos: THREE.Vector3, size: number) => void = () => {};
  onLaunch: () => void = () => {};
  onCrackle: () => void = () => {};

  constructor(n = 6000) {
    this.n = n;
    this.pos = new Float32Array(n * 3).fill(-999);
    this.vel = new Float32Array(n * 3);
    this.col = new Float32Array(n * 3);
    this.c0 = new Float32Array(n * 3);
    this.c1 = new Float32Array(n * 3);
    this.alpha = new Float32Array(n);
    this.psize = new Float32Array(n).fill(1);
    this.life = new Float32Array(n);
    this.max = new Float32Array(n);
    this.drag = new Float32Array(n);
    this.grav = new Float32Array(n);
    this.flags = new Uint8Array(n);
    this.trailT = new Float32Array(n);
    this.splitAt = new Float32Array(n);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(this.col, 3));
    g.setAttribute('alpha', new THREE.BufferAttribute(this.alpha, 1));
    g.setAttribute('psize', new THREE.BufferAttribute(this.psize, 1));
    this.material = new THREE.ShaderMaterial({
      uniforms: { map: { value: glowTexture('rgba(255,255,255,1)', 'rgba(255,255,255,0.45)') }, size: { value: 0.3 }, scale: { value: 500 }, core: { value: 0.6 } },
      vertexShader: /* glsl */ `
        attribute vec3 color;
        attribute float alpha;
        attribute float psize;
        uniform float size;
        uniform float scale;
        varying vec3 vColor;
        varying float vAlpha;
        void main() {
          vColor = color;
          vAlpha = alpha;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = size * psize * scale / -mv.z;
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */ `
        uniform sampler2D map;
        uniform float core;
        varying vec3 vColor;
        varying float vAlpha;
        void main() {
          vec4 t = texture2D(map, gl_PointCoord);
          // a white-hot centre, the star colour around it
          vec3 c = mix(vColor, vec3(1.0), smoothstep(0.75, 1.0, t.r) * core);
          // by day the soft edge would only wash the colour out: keep stars solid
          gl_FragColor = vec4(c, (core < 0.3 ? smoothstep(0.05, 0.4, t.a) : t.a) * vAlpha);
        }`,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.points = new THREE.Points(g, this.material);
    this.points.frustumCulled = false;
    this.group.add(this.points);

    // a few lights that flash with each burst and light up the square
    for (let i = 0; i < 4; i++) {
      const light = new THREE.PointLight(0xffffff, 0, 45, 1.3);
      this.group.add(light);
      this.flashes.push({ light, v: 0 });
    }
    this.smokeMat = new THREE.SpriteMaterial({ map: smokeTexture(), transparent: true, depthWrite: false, opacity: 0 });
  }

  // Night: additive glow and strong flashes. Day: solid colours, more visible smoke
  setDay(day: boolean) {
    this.day = day;
    this.material.blending = day ? THREE.NormalBlending : THREE.AdditiveBlending;
    this.material.uniforms.size.value = day ? 0.42 : 0.26;
    this.material.uniforms.core.value = day ? 0.1 : 0.35;
    this.material.needsUpdate = true;
  }

  // pixels per world unit at distance 1 (half the drawing height over tan(fov / 2))
  setScale(px: number) {
    this.material.uniforms.scale.value = px;
  }

  // ---------- particles ----------

  private emit(p: THREE.Vector3, v: THREE.Vector3, c0: THREE.Color, c1: THREE.Color, life: number, drag: number, opts: { grav?: number; size?: number; flags?: number; split?: number } = {}) {
    for (let k = 0; k < this.n; k++) {
      const i = (this.next + k) % this.n;
      if (this.life[i] > 0) continue;
      this.next = (i + 1) % this.n;
      const j = i * 3;
      this.pos[j] = p.x;
      this.pos[j + 1] = p.y;
      this.pos[j + 2] = p.z;
      this.vel[j] = v.x;
      this.vel[j + 1] = v.y;
      this.vel[j + 2] = v.z;
      this.c0.set([c0.r, c0.g, c0.b], j);
      this.c1.set([c1.r, c1.g, c1.b], j);
      this.col.set([c0.r, c0.g, c0.b], j);
      this.life[i] = life;
      this.max[i] = life;
      this.drag[i] = drag;
      this.grav[i] = opts.grav ?? 1;
      this.psize[i] = opts.size ?? 1;
      this.flags[i] = opts.flags ?? 0;
      this.trailT[i] = 0;
      this.splitAt[i] = opts.split ?? 0;
      this.alpha[i] = 1;
      return i;
    }
    return -1;
  }

  private sphere(p: THREE.Vector3, count: number, speed: number, make: (dir: THREE.Vector3, i: number) => void) {
    // evenly spread directions (Fibonacci sphere), so bursts look round instead of clumpy
    const golden = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < count; i++) {
      const y = 1 - (i / (count - 1)) * 2;
      const r = Math.sqrt(1 - y * y);
      const a = golden * i;
      make(new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r).multiplyScalar(speed * (0.92 + Math.random() * 0.16)), i);
    }
    void p;
  }

  // ---------- shells ----------

  // A shell from `from`, bursting above the gate roof at x = targetX (default: a little toward the middle),
  // higher or lower by `lift`. size 1 = normal, up to ~2.5
  launch(from: THREE.Vector3, size = 1, kind?: BurstKind, targetX?: number, lift = 0) {
    const kinds: BurstKind[] = ['peony', 'chrysanthemum', 'chrysanthemum', 'willow', 'ring', 'heart', 'palm', 'crossette', 'strobe'];
    const fuse = 0.9 + Math.random() * 0.25 + size * 0.06;
    const tx = targetX ?? from.x * 0.4 + (Math.random() - 0.5) * 2;
    this.rockets.push({
      p: from.clone(),
      v: new THREE.Vector3((tx - from.x) / fuse, 8.4 + Math.random() * 1.0 + size * 0.45 + lift, -2.0 - Math.random() * 1.2),
      fuse,
      kind: kind ?? kinds[Math.floor(Math.random() * kinds.length)],
      size,
    });
    this.onLaunch();
  }

  // A viewer's salvo: three shells of different kinds (five, bigger, for a gift giver)
  salvo(from: THREE.Vector3, gift: boolean) {
    // [kind, size, where it bursts (x), how much higher]
    const plan: Array<[BurstKind, number, number, number]> = gift
      ? [['chrysanthemum', 2.0, 0, 0.6], ['heart', 1.5, -2.6, -0.4], ['palm', 1.7, 2.6, 0], ['strobe', 1.4, -1.2, 1.2], ['willow', 2.1, 1.3, 1.5]]
      : [[Math.random() < 0.5 ? 'chrysanthemum' : 'peony', 1.4, 0.8, 0.4], ['crossette', 1.0, -1.8, -0.3], [Math.random() < 0.5 ? 'ring' : 'willow', 1.2, 2.4, 0.8]];
    plan.forEach(([kind, size, x, lift], i) => setTimeout(() => this.launch(from, size, kind, x, lift), i * 600));
  }

  // When the likes fill up: a fan of shells from across the square, then a big multi-coloured finish
  finale(z = -16) {
    // a fan opening left to right, a second one higher right to left, then three big shells across the sky
    const xs = [-3.6, -1.8, 0, 1.8, 3.6];
    xs.forEach((x, i) => setTimeout(() => this.launch(new THREE.Vector3(x * 0.4, 1, z), 0.9, 'peony', x, -0.5 + Math.abs(x) * 0.15), i * 220));
    setTimeout(() => xs.forEach((x, i) => setTimeout(() => this.launch(new THREE.Vector3(-x * 0.4, 1, z), 1.0, 'chrysanthemum', -x, 1.5), i * 220)), 1500);
    setTimeout(() => {
      this.launch(new THREE.Vector3(0, 1, z), 2.0, 'willow', 0, 1.2);
      setTimeout(() => this.launch(new THREE.Vector3(-1, 1, z), 1.3, 'strobe', -3, 0), 400);
      setTimeout(() => this.launch(new THREE.Vector3(1, 1, z), 1.3, 'heart', 3, 0.3), 800);
    }, 3200);
  }

  burst(p: THREE.Vector3, kind: BurstKind, size: number) {
    const [a, b] = pickPair();
    const ca = new THREE.Color(a);
    const cb = new THREE.Color(b);
    const [a2, b2] = pickPair();
    const ca2 = new THREE.Color(a2);
    const speed = 5.2 * Math.sqrt(size);
    const count = Math.round(120 * size);
    const v = new THREE.Vector3();
    let flash = ca;

    if (kind === 'peony') {
      // two colours, half and half
      this.sphere(p, count, speed, (d, i) => this.emit(p, d, i % 2 ? ca : ca2, cb, 2.0 + Math.random() * 0.6, 1.1, { flags: Math.random() < 0.25 ? F_FLICKER : 0 }));
    } else if (kind === 'chrysanthemum') {
      // every star leaves a glowing trail
      this.sphere(p, Math.round(count * 0.8), speed, (d) => this.emit(p, d, ca, cb, 2.2 + Math.random() * 0.5, 1.15, { flags: F_TRAIL, size: 1.1 }));
    } else if (kind === 'willow') {
      // gold stars that drift and hang for a long time
      flash = GOLD;
      this.sphere(p, Math.round(count * 0.9), speed * 0.75, (d) => this.emit(p, d.add(new THREE.Vector3(0, 0.8, 0)), GOLD, EMBER, 3.6 + Math.random() * 0.8, 0.75, { grav: 0.45, flags: F_TRAIL | F_FLICKER, size: 0.9 }));
    } else if (kind === 'ring') {
      // two rings, one inside the other, tilted toward the camera
      const tilt = (Math.random() - 0.5) * 0.9;
      for (const [k, c, r] of [[1, ca, 1], [0.6, ca2, 0.6]] as const) {
        const m = Math.round(count * 0.55 * k);
        for (let i = 0; i < m; i++) {
          const ang = (i / m) * Math.PI * 2;
          v.set(Math.cos(ang), Math.sin(ang) * Math.cos(tilt), Math.sin(ang) * Math.sin(tilt)).multiplyScalar(speed * r);
          this.emit(p, v, c, cb, 2.3, 1.25, { flags: F_FLICKER });
        }
      }
    } else if (kind === 'heart') {
      const pink = new THREE.Color(0xff4f86);
      flash = pink;
      for (let i = 0; i < count; i++) {
        const ang = (i / count) * Math.PI * 2;
        const hx = 16 * Math.pow(Math.sin(ang), 3);
        const hy = 13 * Math.cos(ang) - 5 * Math.cos(2 * ang) - 2 * Math.cos(3 * ang) - Math.cos(4 * ang);
        v.set((hx / 16) * speed * 0.9, (hy / 16) * speed * 0.9, (Math.random() - 0.5) * 0.3);
        this.emit(p, v, pink, new THREE.Color(0xffd0e0), 2.4, 1.35, { flags: F_FLICKER, size: 1.1 });
      }
      this.sphere(p, 30, speed * 0.25, (d) => this.emit(p, d, new THREE.Color(0xffffff), pink, 1.2, 1.5, { flags: F_GLITTER, size: 0.7 }));
    } else if (kind === 'palm') {
      // a few big comets curving down like palm fronds
      flash = GOLD;
      const fronds = 9;
      for (let i = 0; i < fronds; i++) {
        const ang = (i / fronds) * Math.PI * 2;
        v.set(Math.cos(ang) * speed * 0.9, speed * (0.55 + Math.random() * 0.3), Math.sin(ang) * speed * 0.5);
        this.emit(p, v, GOLD, ca, 2.8, 0.7, { grav: 0.9, flags: F_TRAIL, size: 2.2 });
      }
      this.sphere(p, 40, speed * 0.4, (d) => this.emit(p, d, ca, cb, 1.6, 1.3, { flags: F_FLICKER }));
    } else if (kind === 'crossette') {
      // stars that split into four after a moment
      this.sphere(p, Math.round(18 * size), speed * 0.8, (d) => this.emit(p, d, ca, ca, 1.7, 0.9, { split: 1.05, size: 1.4, flags: F_TRAIL }));
    } else {
      // strobe: a coloured burst, then a cloud of crackling white glitter
      this.sphere(p, Math.round(count * 0.6), speed, (d) => this.emit(p, d, ca, cb, 1.8, 1.2));
      this.sphere(p, Math.round(count * 0.7), speed * 0.7, (d) => this.emit(p, d, new THREE.Color(0xffffff), new THREE.Color(0xfff2c0), 2.4 + Math.random(), 1.4, { flags: F_GLITTER, grav: 0.6, size: 0.8 }));
      this.glitterAt = performance.now() + 900;
      flash = new THREE.Color(0xffffff);
    }

    // the flash of light and a puff of smoke
    const f = this.flashes.reduce((lo, x) => (x.v < lo.v ? x : lo));
    f.light.position.copy(p);
    f.light.color.copy(flash);
    f.v = (this.day ? 14 : 40) * Math.min(2, size);
    this.addSmoke(p, size);
    this.onBurst(p, size);
  }

  private addSmoke(p: THREE.Vector3, size: number) {
    let puff = this.smoke.find((s) => s.age >= s.life);
    if (!puff) {
      if (this.smoke.length >= 14) return;
      const s = new THREE.Sprite(this.smokeMat.clone());
      this.group.add(s);
      puff = { s, age: 0, life: 1, grow: 1, drift: new THREE.Vector3() };
      this.smoke.push(puff);
    }
    puff.s.position.copy(p);
    puff.age = 0;
    puff.life = 5 + Math.random() * 2;
    puff.grow = 3 + size * 2.5;
    puff.drift.set(0.3 + Math.random() * 0.2, 0.1, 0);
  }

  clear() {
    this.rockets = [];
    this.life.fill(0);
    this.alpha.fill(0);
    this.pos.fill(-999);
    for (const f of this.flashes) f.v = 0;
    for (const s of this.smoke) s.age = s.life;
    (this.points.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
  }

  update(dt: number, t: number) {
    // shells climb with a bright head and a sparkling tail, then burst
    this.rockets = this.rockets.filter((r) => {
      r.fuse -= dt;
      r.v.y -= 5 * dt;
      r.v.x += Math.sin(t * 17 + r.p.z) * dt * 0.6; // a little wobble
      r.p.addScaledVector(r.v, dt);
      this.emit(r.p, new THREE.Vector3(0, 0, 0), new THREE.Color(0xfff2d0), EMBER, 0.06, 0, { size: 1.6, grav: 0 });
      for (let k = 0; k < 2; k++) this.emit(r.p, new THREE.Vector3((Math.random() - 0.5) * 0.6, -0.6 - Math.random(), (Math.random() - 0.5) * 0.6), GOLD, EMBER, 0.4 + Math.random() * 0.3, 1.5, { flags: F_FLICKER, size: 0.7 });
      if (r.fuse <= 0) {
        this.burst(r.p, r.kind, r.size);
        return false;
      }
      return true;
    });

    const tmpP = new THREE.Vector3();
    const tmpV = new THREE.Vector3();
    const c0 = new THREE.Color();
    const c1 = new THREE.Color();
    for (let i = 0; i < this.n; i++) {
      if (this.life[i] <= 0) continue;
      this.life[i] -= dt;
      const j = i * 3;
      if (this.life[i] <= 0) {
        this.pos[j + 1] = -999;
        this.alpha[i] = 0;
        continue;
      }
      const d = Math.exp(-this.drag[i] * dt);
      this.vel[j] *= d;
      this.vel[j + 1] = this.vel[j + 1] * d - 2.4 * this.grav[i] * dt;
      this.vel[j + 2] *= d;
      this.pos[j] += this.vel[j] * dt;
      this.pos[j + 1] += this.vel[j + 1] * dt;
      this.pos[j + 2] += this.vel[j + 2] * dt;
      const k = this.life[i] / this.max[i]; // 1 at birth .. 0 at the end
      // colour shifts toward the fade colour as the star burns down
      const m = 1 - k;
      this.col[j] = this.c0[j] + (this.c1[j] - this.c0[j]) * m;
      this.col[j + 1] = this.c0[j + 1] + (this.c1[j + 1] - this.c0[j + 1]) * m;
      this.col[j + 2] = this.c0[j + 2] + (this.c1[j + 2] - this.c0[j + 2]) * m;
      const fl = this.flags[i];
      let a = Math.min(0.85, k * 1.7);
      if (fl & F_FLICKER && k < 0.5) a *= Math.sin(t * 45 + i) > 0 ? 1 : 0.3;
      if (fl & F_GLITTER) a *= Math.sin(t * 70 + i * 13) > 0.3 ? 1.2 : 0.05;
      this.alpha[i] = a;
      // trails: little embers left behind
      if (fl & F_TRAIL) {
        this.trailT[i] += dt;
        if (this.trailT[i] > 0.035) {
          this.trailT[i] = 0;
          tmpP.set(this.pos[j], this.pos[j + 1], this.pos[j + 2]);
          c0.setRGB(this.col[j], this.col[j + 1], this.col[j + 2]);
          c1.copy(c0).multiplyScalar(0.4);
          this.emit(tmpP, tmpV.set(0, -0.15, 0), c0, c1, 0.45, 2, { size: this.psize[i] * 0.6, grav: 0.2 });
        }
      }
      // crossette: split into four stars at right angles
      if (this.splitAt[i] && this.life[i] < this.splitAt[i]) {
        this.splitAt[i] = 0;
        tmpP.set(this.pos[j], this.pos[j + 1], this.pos[j + 2]);
        const base = new THREE.Vector3(this.vel[j], this.vel[j + 1], this.vel[j + 2]);
        const side = new THREE.Vector3(-base.y, base.x, 0).normalize().multiplyScalar(2.2);
        const up = new THREE.Vector3(0, 0, 1).cross(side).normalize().multiplyScalar(2.2);
        c0.setRGB(this.c0[j], this.c0[j + 1], this.c0[j + 2]);
        const [, b] = pickPair();
        for (const dv of [side, side.clone().negate(), up, up.clone().negate()]) {
          this.emit(tmpP, base.clone().multiplyScalar(0.4).add(dv), c0, new THREE.Color(b), 1.2, 1.1, { flags: F_TRAIL | F_FLICKER, size: 0.9 });
        }
        this.life[i] = 0.001;
      }
    }
    for (const name of ['position', 'color', 'alpha', 'psize']) (this.points.geometry.attributes[name] as THREE.BufferAttribute).needsUpdate = true;

    // the glitter crackles for a moment after a strobe shell
    if (this.glitterAt && performance.now() > this.glitterAt) {
      if (performance.now() < this.glitterAt + 1500) {
        if (Math.random() < 0.5) this.onCrackle();
      } else this.glitterAt = 0;
    }

    // flashes fade fast; smoke drifts and thins out
    for (const f of this.flashes) {
      f.v *= Math.exp(-dt * 7);
      f.light.intensity = f.v;
    }
    for (const s of this.smoke) {
      if (s.age >= s.life) {
        s.s.visible = false;
        continue;
      }
      s.age += dt;
      const k = s.age / s.life;
      s.s.visible = true;
      s.s.position.addScaledVector(s.drift, dt);
      s.s.scale.setScalar(s.grow * (0.5 + k));
      s.s.material.opacity = Math.sin(Math.PI * k) * (this.day ? 0.22 : 0.1);
      s.s.material.color.set(this.day ? 0xe8e4e0 : 0x8890a8);
    }
  }
}
