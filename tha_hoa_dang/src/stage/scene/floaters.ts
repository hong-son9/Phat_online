import * as THREE from 'three';
import { glowTexture, rippleTexture } from './textures';
import { CURRENT, underBridge } from './river';

// Everything that ends up in the river: lotus lanterns (hoa đăng), released fish and the ripples they
// make. All drawn with instancing so a river full of lanterns stays cheap. An item is first "held"
// (the world moves it with the hands of whoever carries it), then "falls" when let go, then floats or swims.

const m = new THREE.Matrix4();
const m2 = new THREE.Matrix4();
const v = new THREE.Vector3();
const q = new THREE.Quaternion();
const e = new THREE.Euler();
const s = new THREE.Vector3();
const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);
const HIDDEN = -99;

type State = 'free' | 'held' | 'fall' | 'water';

// ---------- ripples ----------

export class Ripples {
  mesh: THREE.InstancedMesh;
  private items: Array<{ x: number; z: number; t0: number; dur: number; size: number; power: number }> = [];
  private color = new THREE.Color();
  constructor(private max = 80) {
    const mat = new THREE.MeshBasicMaterial({ map: rippleTexture(), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
    this.mesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), mat, max);
    this.mesh.frustumCulled = false;
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    for (let i = 0; i < max; i++) {
      this.mesh.setMatrixAt(i, ZERO);
      this.mesh.setColorAt(i, this.color.setScalar(0));
    }
  }
  add(x: number, z: number, now: number, size = 1, power = 1, dur = 1800) {
    if (this.items.length >= this.max) this.items.shift();
    this.items.push({ x, z, t0: now, dur, size, power });
  }
  clear() {
    this.items = [];
  }
  update(now: number) {
    this.items = this.items.filter((r) => now - r.t0 < r.dur);
    for (let i = 0; i < this.max; i++) {
      const r = this.items[i];
      if (!r) {
        this.mesh.setMatrixAt(i, ZERO);
        continue;
      }
      const k = (now - r.t0) / r.dur;
      const size = r.size * (0.25 + k * 1.6);
      this.mesh.setMatrixAt(i, m.compose(v.set(r.x, 0.02, r.z), q.setFromEuler(e.set(-Math.PI / 2, 0, 0)), s.set(size, size, 1)));
      this.mesh.setColorAt(i, this.color.setScalar(r.power * (1 - k) * (1 - k) * 0.8));
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }
}

// ---------- lotus lanterns ----------

type Lantern = {
  state: State;
  p: THREE.Vector3;
  vel: THREE.Vector3;
  heading: number;
  spin: number;
  scale: number;
  gold: boolean;
  phase: number;
  born: number; // ms, when it touched the water
  life: number; // ms on the water
  drift: number; // its own sideways wander
};

// Petal layout around the lantern's centre: an outer ring of 8 and an inner ring of 5
const PETALS: THREE.Matrix4[] = [];
for (let i = 0; i < 8; i++) {
  const a = (i / 8) * Math.PI * 2;
  PETALS.push(new THREE.Matrix4().compose(new THREE.Vector3(Math.sin(a) * 0.13, 0.03, Math.cos(a) * 0.13), new THREE.Quaternion().setFromEuler(new THREE.Euler(0.75, a, 0, 'YXZ')), new THREE.Vector3(0.075, 0.15, 0.035)));
}
for (let i = 0; i < 5; i++) {
  const a = (i / 5) * Math.PI * 2 + 0.3;
  PETALS.push(new THREE.Matrix4().compose(new THREE.Vector3(Math.sin(a) * 0.06, 0.05, Math.cos(a) * 0.06), new THREE.Quaternion().setFromEuler(new THREE.Euler(0.3, a, 0, 'YXZ')), new THREE.Vector3(0.055, 0.13, 0.03)));
}

export class Lanterns {
  readonly group = new THREE.Group();
  private petals: THREE.InstancedMesh;
  private bases: THREE.InstancedMesh;
  private refl: THREE.InstancedMesh;
  private flames: THREE.Points;
  private halos: THREE.Points;
  private items: Lantern[];
  onSplash: (x: number, z: number, big: boolean) => void = () => {};

  constructor(private max = 160) {
    // petal shape: a sphere moved up so it hinges at its base
    const petalGeo = new THREE.SphereGeometry(1, 10, 8);
    petalGeo.translate(0, 1, 0);
    this.petals = new THREE.InstancedMesh(petalGeo, new THREE.MeshBasicMaterial({ color: 0xffffff }), max * PETALS.length);
    this.bases = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.2, 0.16, 0.05, 16), new THREE.MeshBasicMaterial({ color: 0xffffff }), max);
    const reflMat = new THREE.MeshBasicMaterial({ map: glowTexture('rgba(255,200,120,0.9)', 'rgba(255,120,60,0.25)'), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.6 });
    this.refl = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), reflMat, max);
    const pts = (size: number, inner: string, mid: string, color: number) => {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(max * 3).fill(HIDDEN), 3));
      const p = new THREE.Points(g, new THREE.PointsMaterial({ size, map: glowTexture(inner, mid), color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
      p.frustumCulled = false;
      return p;
    };
    this.flames = pts(0.16, 'rgba(255,250,225,1)', 'rgba(255,190,80,0.6)', 0xfff0c0);
    this.halos = pts(0.9, 'rgba(255,200,130,0.6)', 'rgba(255,130,60,0.18)', 0xffb070);
    for (const mesh of [this.petals, this.bases, this.refl]) {
      mesh.frustumCulled = false;
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      for (let i = 0; i < mesh.count; i++) mesh.setMatrixAt(i, ZERO);
    }
    this.group.add(this.refl, this.bases, this.petals, this.halos, this.flames);
    this.items = Array.from({ length: max }, () => ({
      state: 'free', p: new THREE.Vector3(), vel: new THREE.Vector3(), heading: 0, spin: 0, scale: 1, gold: false, phase: 0, born: 0, life: 0, drift: 0,
    }));
  }

  private take(scale: number, gold: boolean): number {
    let i = this.items.findIndex((it) => it.state === 'free');
    // river full: the oldest floating lantern makes room
    if (i === -1) i = this.items.reduce((best, it, k) => (it.state === 'water' && (best === -1 || it.born < this.items[best].born) ? k : best), -1);
    if (i === -1) return -1;
    const it = this.items[i];
    Object.assign(it, { state: 'held', scale, gold, phase: Math.random() * 10, spin: (Math.random() - 0.5) * 0.25, drift: (Math.random() - 0.5) * 0.05 });
    it.vel.set(0, 0, 0);
    this.paint(i);
    return i;
  }

  private paint(i: number) {
    const it = this.items[i];
    // kept under 1 so only the candle flame blooms, not the whole flower
    const outer = it.gold ? new THREE.Color(0.95, 0.66, 0.2) : new THREE.Color(0.95, 0.42, 0.56);
    const inner = it.gold ? new THREE.Color(1, 0.85, 0.5) : new THREE.Color(1, 0.75, 0.8);
    PETALS.forEach((_, k) => this.petals.setColorAt(i * PETALS.length + k, k < 8 ? outer : inner));
    this.bases.setColorAt(i, it.gold ? new THREE.Color(0.6, 0.12, 0.06) : new THREE.Color(0.12, 0.3, 0.16));
    if (this.petals.instanceColor) this.petals.instanceColor.needsUpdate = true;
    if (this.bases.instanceColor) this.bases.instanceColor.needsUpdate = true;
  }

  // A lantern in someone's hands; move it with hold()
  carry(gift: boolean) {
    return this.take(gift ? 1.6 : 1, gift);
  }

  hold(i: number, pos: THREE.Vector3, heading: number) {
    const it = this.items[i];
    if (!it || it.state !== 'held') return;
    it.p.copy(pos);
    it.heading = heading;
  }

  // Let go: it drops with a little push away from the bridge
  drop(i: number, push: THREE.Vector3) {
    const it = this.items[i];
    if (!it || it.state !== 'held') return;
    it.state = 'fall';
    it.vel.copy(push);
  }

  // A lantern already on the water (ambient ones, or a page that loaded after the drop)
  float(x: number, z: number, now: number, ageMs = 0, gift = false) {
    const i = this.take(gift ? 1.6 : 1, gift);
    if (i === -1) return;
    const it = this.items[i];
    it.state = 'water';
    it.p.set(x, 0, z);
    it.born = now - ageMs;
    it.life = 150000 + Math.random() * 40000;
    it.heading = Math.random() * 6;
  }

  release(i: number) {
    if (this.items[i]?.state === 'held') this.items[i].state = 'free';
  }

  clear() {
    for (const it of this.items) it.state = 'free';
  }

  update(t: number, now: number, dt: number) {
    const fl = this.flames.geometry.attributes.position as THREE.BufferAttribute;
    const ha = this.halos.geometry.attributes.position as THREE.BufferAttribute;
    this.items.forEach((it, i) => {
      if (it.state === 'free') {
        this.hide(i, fl, ha);
        return;
      }
      let scale = it.scale;
      let tilt = 0;
      if (it.state === 'fall') {
        it.vel.y -= 9.8 * dt;
        it.p.addScaledVector(it.vel, dt);
        it.heading += dt * 2;
        tilt = Math.sin(t * 9) * 0.15;
        if (it.p.y <= 0) {
          it.p.y = 0;
          it.state = 'water';
          it.born = now;
          it.life = 170000 + Math.random() * 30000;
          this.onSplash(it.p.x, it.p.z, it.gold);
        }
      } else if (it.state === 'water') {
        const age = now - it.born;
        // pushed away from the bridge at first, then the current takes it
        const settle = Math.min(1, age / 6000);
        it.vel.x += (CURRENT - it.vel.x) * dt * 0.4 * settle;
        it.vel.z += (it.drift - it.vel.z) * dt * 0.5;
        it.vel.x *= 1 - dt * 0.2 * (1 - settle);
        it.p.addScaledVector(it.vel, dt);
        it.p.y = Math.sin(t * 1.4 + it.phase) * 0.012;
        it.heading += it.spin * dt;
        tilt = Math.sin(t * 1.1 + it.phase) * 0.06;
        // fade out at the end of its life or past the edge of the view
        const left = Math.min(it.life - age, (15 - Math.abs(it.p.x)) * 6000);
        scale *= Math.min(1, Math.max(0, left / 4000));
        if (scale <= 0.01) {
          it.state = 'free';
          this.hide(i, fl, ha);
          return;
        }
      }
      m.compose(it.p, q.setFromEuler(e.set(tilt, it.heading, tilt * 0.6)), s.setScalar(scale));
      this.bases.setMatrixAt(i, m);
      PETALS.forEach((pm, k) => this.petals.setMatrixAt(i * PETALS.length + k, m2.multiplyMatrices(m, pm)));
      const hidden = it.state === 'water' && underBridge(it.p.x, it.p.z);
      const flick = 1 + Math.sin(t * 17 + it.phase * 3) * 0.08;
      fl.setXYZ(i, it.p.x, hidden ? HIDDEN : it.p.y + 0.1 * scale * flick, it.p.z);
      ha.setXYZ(i, it.p.x, hidden ? HIDDEN : it.p.y + 0.12 * scale, it.p.z);
      if (it.state === 'water' && !hidden) {
        this.refl.setMatrixAt(i, m.compose(v.set(it.p.x, 0.01, it.p.z + 0.35 * scale), q.setFromEuler(e.set(-Math.PI / 2, 0, 0)), s.set(0.5 * scale, 1.3 * scale, 1)));
      } else this.refl.setMatrixAt(i, ZERO);
    });
    fl.needsUpdate = true;
    ha.needsUpdate = true;
    this.petals.instanceMatrix.needsUpdate = true;
    this.bases.instanceMatrix.needsUpdate = true;
    this.refl.instanceMatrix.needsUpdate = true;
  }

  private hide(i: number, fl: THREE.BufferAttribute, ha: THREE.BufferAttribute) {
    this.bases.setMatrixAt(i, ZERO);
    this.refl.setMatrixAt(i, ZERO);
    for (let k = 0; k < PETALS.length; k++) this.petals.setMatrixAt(i * PETALS.length + k, ZERO);
    fl.setXYZ(i, 0, HIDDEN, 0);
    ha.setXYZ(i, 0, HIDDEN, 0);
  }
}

// ---------- fish ----------

type Fish = {
  state: State;
  p: THREE.Vector3;
  vel: THREE.Vector3;
  heading: number;
  pitch: number;
  scale: number;
  born: number;
  dir: number; // swimming direction (radians around y)
  lastRipple: number;
};

// Koi colours: body, fins
const KOI: Array<[number, number]> = [[0xf06a1e, 0xffd2a8], [0xf2efe6, 0xe8541c], [0xe0a526, 0xfff0c0], [0xd8361f, 0xf6e6d6], [0xb8b8c4, 0xe8e8f0]];

export class Fishes {
  readonly group = new THREE.Group();
  private body: THREE.InstancedMesh;
  private tail: THREE.InstancedMesh;
  private items: Fish[];
  onSplash: (x: number, z: number, big: boolean) => void = () => {};
  ripples: Ripples | null = null;

  constructor(private max = 16) {
    const mat = new THREE.MeshStandardMaterial({ roughness: 0.35, metalness: 0.1, emissive: 0x4a2410 });
    this.body = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 14, 10), mat, max);
    const tailGeo = new THREE.ConeGeometry(1, 1, 3);
    tailGeo.rotateX(Math.PI / 2); // point toward the body, wide end at the back
    this.tail = new THREE.InstancedMesh(tailGeo, mat, max);
    for (const mesh of [this.body, this.tail]) {
      mesh.frustumCulled = false;
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      for (let i = 0; i < max; i++) mesh.setMatrixAt(i, ZERO);
    }
    this.group.add(this.body, this.tail);
    this.items = Array.from({ length: max }, () => ({ state: 'free', p: new THREE.Vector3(), vel: new THREE.Vector3(), heading: 0, pitch: 0, scale: 1, born: 0, dir: 0, lastRipple: 0 }));
  }

  carry(gift: boolean, seed: number) {
    let i = this.items.findIndex((f) => f.state === 'free');
    if (i === -1) i = this.items.reduce((b, f, k) => (f.state === 'water' && (b === -1 || f.born < this.items[b].born) ? k : b), -1);
    if (i === -1) return -1;
    const f = this.items[i];
    Object.assign(f, { state: 'held', scale: gift ? 1.35 : 1, pitch: 0 });
    const [body, fin] = gift ? KOI[2] : KOI[seed % KOI.length];
    this.body.setColorAt(i, new THREE.Color(body));
    this.tail.setColorAt(i, new THREE.Color(fin));
    if (this.body.instanceColor) this.body.instanceColor.needsUpdate = true;
    if (this.tail.instanceColor) this.tail.instanceColor.needsUpdate = true;
    return i;
  }

  hold(i: number, pos: THREE.Vector3, heading: number) {
    const f = this.items[i];
    if (!f || f.state !== 'held') return;
    f.p.copy(pos);
    // held across the hands, wriggling
    f.heading = heading + Math.PI / 2;
  }

  drop(i: number, push: THREE.Vector3) {
    const f = this.items[i];
    if (!f || f.state !== 'held') return;
    f.state = 'fall';
    f.vel.copy(push);
    f.dir = Math.atan2(push.x, push.z);
  }

  release(i: number) {
    if (this.items[i]?.state === 'held') this.items[i].state = 'free';
  }

  clear() {
    for (const f of this.items) f.state = 'free';
  }

  update(t: number, now: number, dt: number) {
    this.items.forEach((f, i) => {
      if (f.state === 'free') {
        this.body.setMatrixAt(i, ZERO);
        this.tail.setMatrixAt(i, ZERO);
        return;
      }
      let wag = Math.sin(t * 14 + i) * 0.35;
      if (f.state === 'held') {
        f.pitch = Math.sin(t * 6 + i) * 0.15;
      } else if (f.state === 'fall') {
        f.vel.y -= 9.8 * dt;
        f.p.addScaledVector(f.vel, dt);
        f.pitch = Math.min(1.3, f.pitch + dt * 3); // nose down
        f.heading = f.dir;
        wag = Math.sin(t * 25) * 0.6;
        if (f.p.y <= 0) {
          f.state = 'water';
          f.born = now;
          f.p.y = -0.04;
          this.onSplash(f.p.x, f.p.z, f.scale > 1);
        }
      } else {
        // swim away from the bridge at the surface, leap once, then dive and disappear
        const a = (now - f.born) / 1000;
        f.dir += Math.sin(a * 1.7 + i) * dt * 0.6;
        f.heading = f.dir;
        const speed = 1.1 * f.scale;
        f.p.x += Math.sin(f.dir) * speed * dt;
        f.p.z += Math.cos(f.dir) * speed * dt;
        const JUMP0 = 1.6;
        const JUMP1 = 2.5;
        if (a < JUMP0) {
          f.p.y = -0.03;
          f.pitch = 0;
        } else if (a < JUMP1) {
          const k = (a - JUMP0) / (JUMP1 - JUMP0);
          f.p.y = Math.sin(k * Math.PI) * 0.75 * f.scale - 0.03;
          f.pitch = -Math.cos(k * Math.PI) * 0.9;
          if (k > 0.9 && now - f.lastRipple > 400) {
            f.lastRipple = now;
            this.onSplash(f.p.x, f.p.z, false);
          }
        } else if (a < 4.6) {
          f.p.y = -0.03;
          f.pitch = 0;
        } else {
          f.p.y = -0.03 - (a - 4.6) * 0.25;
          f.pitch = 0.4;
          if (f.p.y < -0.5) {
            f.state = 'free';
            return;
          }
        }
        if (f.p.y < 0.05 && now - f.lastRipple > 380) {
          f.lastRipple = now;
          this.ripples?.add(f.p.x, f.p.z, now, 0.5 * f.scale, 0.6, 1400);
        }
        wag = Math.sin(t * 16 + i) * 0.4;
      }
      // drawn larger than life so it reads from the wide shot
      const sc = f.scale * 1.4;
      m.compose(f.p, q.setFromEuler(e.set(f.pitch, f.heading, 0, 'YXZ')), s.set(0.075 * sc, 0.09 * sc, 0.21 * sc));
      this.body.setMatrixAt(i, m);
      m2.compose(v.set(0, 0, -0.27 * sc), q.setFromEuler(e.set(0, wag, 0)), s.set(0.09 * sc, 0.02 * sc, 0.14 * sc));
      m.compose(f.p, q.setFromEuler(e.set(f.pitch, f.heading, 0, 'YXZ')), s.set(1, 1, 1));
      this.tail.setMatrixAt(i, m.multiply(m2));
    });
    this.body.instanceMatrix.needsUpdate = true;
    this.tail.instanceMatrix.needsUpdate = true;
  }
}
