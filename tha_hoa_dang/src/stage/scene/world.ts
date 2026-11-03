import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import type { Guest, Offer, Quality, Snapshot } from '../../../shared/types';
import { OFFER_MS, SEAT_COUNT, TOP_CUSHIONS } from '../../../shared/types';
import { buildRiver, deckY, FOG_COLORS, PAVILION, underBridge, type River } from './river';
import { Fishes, Lanterns, Ripples } from './floaters';
import { Crowd, HAIRS, NPC_ROBES, SKINS, VIEWER_ROBES, handsPosition, headPosition, newPose, type Look, type Pose } from './people';
import { Label, type LabelData } from './labels';
import { glowTexture, petalTexture, ringTexture } from './textures';

// ---------- layout (world units; the bridge runs along -z away from the camera, the river flows +x) ----------

type P2 = { x: number; z: number };

// Places along the two railings, people facing the water. Further toward the camera than NEAR_ROWS
// is hidden under TikTok's comments, so: first the three rows just before the pavilion (biggest on
// screen), then the rows beyond it. The first FRONT_SEATS go to the first viewers and guests.
const NEAR_ROWS = 3;
const SEATS: P2[] = Array.from({ length: SEAT_COUNT }, (_, i) => {
  const side = i % 2 ? 1 : -1;
  const row = Math.floor(i / 2);
  if (row < NEAR_ROWS) return { x: side * 0.95, z: PAVILION.z1 + 0.4 + row * 0.75 };
  return { x: side * 0.95, z: PAVILION.z0 - 0.5 - (row - NEAR_ROWS) * 0.75 };
});
// The TOP board stands inside the pavilion, rank 1 nearest the camera
const CUSHIONS: P2[] = Array.from({ length: TOP_CUSHIONS }, (_, i) => ({ x: (i % 2 ? 1 : -1) * 1.45, z: PAVILION.z1 - 0.4 - Math.floor(i / 2) * 0.85 }));
// Where people stand at the pavilion railing to let go, in the order spots fill (between the TOP rows)
const SPOTS: P2[] = [
  { x: -2.3, z: -1.075 },
  { x: 2.3, z: -1.075 },
  { x: -2.3, z: -2.775 },
  { x: 2.3, z: -2.775 },
  { x: 2.3, z: -0.225 },
];
const ENTRANCE: P2 = { x: 0.3, z: 12 };

// Release timeline (ms), all derived from the server's start time so every page shows the same moment
const RISE = 400;
const PRAY = 2600; // hold the lantern / fish up and make a wish
const LEAN = 1500; // reach out over the railing...
const DROP_AT = 900; // ...and let go here
const WATCH = 3000; // watch it go, hands joined
const SETTLE = 600;

const ease = (t: number) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
const clamp01 = (t: number) => Math.min(1, Math.max(0, t));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const angleLerp = (a: number, b: number, t: number) => {
  let d = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
};
// Facing the water on this side of the bridge
const outward = (x: number) => (x < 0 ? Math.PI / 2 : -Math.PI / 2);
const aisleX = (x: number) => (x < 0 ? -0.3 : 0.3);
const bowCurve = (p: number) => (p < 0.38 ? ease(p / 0.38) : p < 0.58 ? 1 : 1 - ease((p - 0.58) / 0.42));

type Path = { pts: P2[]; len: number };
const makePath = (pts: P2[]): Path => {
  let len = 0;
  for (let i = 1; i < pts.length; i++) len += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z);
  return { pts, len };
};
function along(path: Path, f: number): { x: number; z: number; heading: number } {
  let d = clamp01(f) * path.len;
  for (let i = 1; i < path.pts.length; i++) {
    const a = path.pts[i - 1];
    const b = path.pts[i];
    const seg = Math.hypot(b.x - a.x, b.z - a.z);
    if (d <= seg || i === path.pts.length - 1) {
      const t = seg ? clamp01(d / seg) : 1;
      return { x: lerp(a.x, b.x, t), z: lerp(a.z, b.z, t), heading: Math.atan2(-(b.x - a.x), -(b.z - a.z)) };
    }
    d -= seg;
  }
  const last = path.pts[path.pts.length - 1];
  return { x: last.x, z: last.z, heading: 0 };
}
// Along the middle of the bridge, then out to the target
const route = (from: P2, to: P2): P2[] =>
  Math.abs(from.z - to.z) > 0.6 || Math.abs(from.x - to.x) > 1.2
    ? [from, { x: aisleX(from.x), z: from.z }, { x: aisleX(to.x), z: to.z }, to]
    : [from, to];

let rnd = 1;
const seeded = (s: string) => {
  rnd = [...s].reduce((a, c) => (a * 33 + c.charCodeAt(0)) >>> 0, 5381);
  return () => ((rnd = (rnd * 1664525 + 1013904223) >>> 0) / 4294967296);
};
const hash = (s: string) => [...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);

class Actor {
  pose: Pose;
  look!: Look;
  label: Label | null = null;
  viewerId = '';
  home: P2;
  offer: Offer | null = null;
  spot: P2 | null = null;
  private offerPlan: { to: Path; back: Path; walk: number } | null = null;
  move: { path: Path; start: number; dur: number } | null = null;
  private nextBow: number;
  private bowStart = -1e9;
  holding = false; // has the lantern / fish in their hands right now
  dropped = false; // has let go of it
  present = true; // background passers-by leave some places empty

  constructor(public key: string, home: P2, now: number) {
    this.home = home;
    this.pose = newPose(home.x, home.z);
    this.pose.heading = outward(home.x);
    this.nextBow = now + 3000 + Math.random() * 15000;
  }

  setLook(seed: string, viewer: boolean) {
    const r = seeded(seed);
    const robes = viewer ? VIEWER_ROBES : NPC_ROBES;
    this.look = {
      robe: new THREE.Color(robes[Math.floor(r() * robes.length)]),
      skin: new THREE.Color(SKINS[Math.floor(r() * SKINS.length)]),
      hair: new THREE.Color(HAIRS[Math.floor(r() * HAIRS.length)]),
      bald: r() < (viewer ? 0.05 : 0.12),
      hat: !viewer && r() < 0.3,
    };
    this.guestSig = '';
    this.pose.scale = 1;
  }

  guest: Guest | null = null;
  private guestSig = '';

  // A guest wears the colour the owner picked and stands a little taller than everyone else
  setGuest(g: Guest | null) {
    const sig = g ? `${g.id}|${g.robe}` : '';
    this.guest = g;
    if (sig === this.guestSig) return;
    this.guestSig = sig;
    this.pose.scale = g ? 1.15 : 1;
    if (g) this.look = { ...this.look, robe: new THREE.Color(g.robe), hat: false };
    else if (this.look) this.setLook(this.viewerId || this.key, !!this.viewerId);
  }

  walkTo(target: P2, now: number, from?: P2) {
    const start = from ?? { x: this.pose.x, z: this.pose.z };
    const path = makePath(route(start, target));
    this.move = { path, start: now, dur: Math.min(7000, Math.max(1200, (path.len / 1.4) * 1000)) };
  }

  setOffer(o: Offer | null) {
    if (o?.id === this.offer?.id) return;
    this.offer = o;
    this.offerPlan = null;
    this.spot = null;
    if (!o) return;
    const spot = SPOTS[o.slot % SPOTS.length];
    const pts = route(this.home, spot);
    const to = makePath(pts);
    const back = makePath([...pts].reverse());
    const walk = Math.min(5500, Math.max(1500, (to.len / 1.6) * 1000));
    this.offerPlan = { to, back, walk };
    this.spot = spot;
  }

  update(now: number, serverNow: number, dt: number) {
    const p = this.pose;
    p.walk = -1;
    p.hands = 0;
    p.reach = 0;
    p.kneel = 0;
    this.holding = false;
    this.dropped = false;

    // Walking to the pavilion railing and letting go
    if (this.offer && this.offerPlan && this.spot) {
      const e = serverNow - this.offer.startedAt;
      const { to, back, walk } = this.offerPlan;
      const out = outward(this.spot.x);
      const t1 = RISE, t2 = t1 + walk, t3 = t2 + PRAY, t4 = t3 + LEAN, t5 = t4 + WATCH, t6 = t5 + walk, t7 = t6 + SETTLE;
      if (e >= 0 && e < Math.min(t7, OFFER_MS + 1500)) {
        p.bow = 0;
        if (e < t1) {
          Object.assign(p, { x: this.home.x, z: this.home.z });
          p.heading = angleLerp(p.heading, along(to, 0.05).heading, dt * 6);
        } else if (e < t2) {
          const a = along(to, ease((e - t1) / walk));
          Object.assign(p, { x: a.x, z: a.z, walk: e * 0.011 });
          p.heading = angleLerp(p.heading, a.heading, dt * 8);
        } else if (e < t3) {
          // holding it up to make a wish
          const k = (e - t2) / PRAY;
          Object.assign(p, { x: this.spot.x, z: this.spot.z });
          p.heading = angleLerp(p.heading, out, dt * 6);
          p.hands = (k < 0.25 ? ease(k / 0.25) : k > 0.8 ? 1 - ease((k - 0.8) / 0.2) : 1) * 0.7;
          p.bow = k > 0.3 && k < 0.75 ? Math.sin(((k - 0.3) / 0.45) * Math.PI) * 0.2 : 0;
          this.holding = true;
        } else if (e < t4) {
          // reach out over the railing and let go
          const k = e - t3;
          p.heading = out;
          Object.assign(p, { x: this.spot.x, z: this.spot.z });
          p.reach = k < DROP_AT ? ease(k / DROP_AT) : 1 - ease((k - DROP_AT) / (LEAN - DROP_AT));
          p.bow = p.reach * 0.35;
          this.holding = k < DROP_AT;
          this.dropped = k >= DROP_AT;
        } else if (e < t5) {
          // watch it go, hands joined
          const k = (e - t4) / WATCH;
          Object.assign(p, { x: this.spot.x, z: this.spot.z });
          p.heading = out;
          p.hands = k > 0.25 && k < 0.9 ? 0.45 : 0;
          p.bow = k > 0.35 && k < 0.85 ? bowCurve((k - 0.35) / 0.5) * 0.3 : 0;
          this.dropped = true;
        } else if (e < t6) {
          const a = along(back, ease((e - t5) / walk));
          Object.assign(p, { x: a.x, z: a.z, walk: e * 0.011 });
          p.heading = angleLerp(p.heading, a.heading, dt * 8);
          this.dropped = true;
        } else {
          Object.assign(p, { x: this.home.x, z: this.home.z });
          p.heading = angleLerp(p.heading, outward(this.home.x), dt * 8);
          this.dropped = true;
        }
        return;
      }
    }

    // Walking somewhere (arriving on the bridge, moving to the pavilion)
    if (this.move) {
      const k = (now - this.move.start) / this.move.dur;
      if (k < 1) {
        const a = along(this.move.path, ease(k));
        Object.assign(p, { x: a.x, z: a.z, bow: 0, walk: now * 0.011 });
        p.heading = angleLerp(p.heading, a.heading, dt * 8);
        return;
      }
      this.move = null;
    }

    // Standing at the railing looking at the water, joining hands now and then
    p.x = this.home.x;
    p.z = this.home.z;
    p.heading = angleLerp(p.heading, outward(this.home.x), dt * 5);
    if (now > this.nextBow) {
      this.bowStart = now;
      this.nextBow = now + 9000 + Math.random() * 16000;
    }
    const b = (now - this.bowStart) / 2600;
    const praying = b >= 0 && b < 1;
    p.hands = praying ? 0.45 : 0;
    p.bow = praying ? bowCurve(b) * 0.25 : 0;
  }
}

// ---------- effects ----------

class PetalRain {
  mesh: THREE.InstancedMesh;
  private items: Array<{ p: THREE.Vector3; v: THREE.Vector3; r: THREE.Euler; s: THREE.Vector3; alive: boolean; gold: boolean }>;
  private m = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private emitAcc = 0;
  rate = 0; // petals per second
  constructor(max: number) {
    const mat = new THREE.MeshBasicMaterial({ map: petalTexture(), transparent: true, side: THREE.DoubleSide, depthWrite: false, alphaTest: 0.05 });
    this.mesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.16, 0.3), mat, max);
    this.mesh.frustumCulled = false;
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.items = Array.from({ length: max }, () => ({ p: new THREE.Vector3(), v: new THREE.Vector3(), r: new THREE.Euler(), s: new THREE.Vector3(1, 1, 1), alive: false, gold: false }));
    for (let i = 0; i < max; i++) this.mesh.setColorAt(i, new THREE.Color(1, 1, 1));
  }
  clear() {
    this.rate = 0;
    this.emitAcc = 0;
    for (const it of this.items) it.alive = false;
  }

  spawn(n: number, gold = false, origin?: THREE.Vector3) {
    for (const it of this.items) {
      if (n <= 0) break;
      if (it.alive) continue;
      n--;
      it.alive = true;
      it.gold = gold;
      if (origin) {
        it.p.copy(origin);
        it.v.set((Math.random() - 0.5) * 4, 2 + Math.random() * 3, (Math.random() - 0.5) * 1.2);
      } else {
        it.p.set((Math.random() - 0.5) * 12, 7 + Math.random() * 3, -16 + Math.random() * 20);
        it.v.set((Math.random() - 0.5) * 0.4, -0.7 - Math.random() * 0.6, 0);
      }
      it.r.set(Math.random() * 6, Math.random() * 6, Math.random() * 6);
      it.s.setScalar(0.7 + Math.random() * 0.8);
      this.mesh.setColorAt(this.items.indexOf(it), gold ? new THREE.Color(1.6, 1.25, 0.5) : new THREE.Color(1, 1, 1));
    }
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }
  update(t: number, dt: number) {
    this.emitAcc += this.rate * dt;
    if (this.emitAcc >= 1) {
      this.spawn(Math.floor(this.emitAcc));
      this.emitAcc %= 1;
    }
    this.items.forEach((it, i) => {
      if (!it.alive) {
        this.m.makeScale(0, 0, 0);
        this.mesh.setMatrixAt(i, this.m);
        return;
      }
      it.v.y = Math.max(it.v.y - dt * 1.2, -1.1);
      it.v.x *= 1 - dt * 0.5;
      it.v.z *= 1 - dt * 0.5;
      it.p.addScaledVector(it.v, dt);
      it.p.x += Math.sin(t * 1.3 + i) * dt * 0.35;
      it.r.x += dt * 1.6;
      it.r.y += dt * 1.1;
      if (it.p.y < 0.02) it.alive = false;
      this.mesh.setMatrixAt(i, this.m.compose(it.p, this.q.setFromEuler(it.r), it.s));
    });
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}

class SkyLanterns {
  group = new THREE.Group();
  private items: Array<{ s: THREE.Sprite; core: THREE.Mesh; t0: number; x: number; z: number; speed: number }> = [];
  private glow = new THREE.SpriteMaterial({ map: glowTexture('rgba(255,210,140,1)', 'rgba(255,120,40,0.35)'), blending: THREE.AdditiveBlending, depthWrite: false });
  private coreGeo = new THREE.CylinderGeometry(0.16, 0.12, 0.32, 10, 1, true);
  private coreMat = new THREE.MeshBasicMaterial({ color: 0xe8641c, side: THREE.DoubleSide, transparent: true, opacity: 0.8 });
  clear() {
    for (const it of this.items) this.group.remove(it.s, it.core);
    this.items = [];
  }

  launch(n: number, now: number) {
    for (let i = 0; i < n; i++) {
      const s = new THREE.Sprite(this.glow);
      s.scale.setScalar(1.7);
      const core = new THREE.Mesh(this.coreGeo, this.coreMat);
      this.group.add(s, core);
      // from the pavilion, drifting up over the river
      this.items.push({ s, core, t0: now + i * 350, x: (Math.random() - 0.5) * 6, z: PAVILION.z0 + Math.random() * 4, speed: 0.45 + Math.random() * 0.3 });
    }
  }
  update(now: number) {
    this.items = this.items.filter((it) => {
      const a = (now - it.t0) / 1000;
      if (a > 26) {
        this.group.remove(it.s, it.core);
        return false;
      }
      const y = a < 0 ? -5 : PAVILION.y + 1.4 + a * it.speed;
      const x = it.x + Math.sin(a * 0.6 + it.z) * 0.4 + a * 0.12;
      const z = it.z - a * 0.5;
      it.s.position.set(x, y, z);
      it.core.position.set(x, y, z);
      return true;
    });
  }
}

class Sparks {
  points: THREE.Points;
  private vel: Float32Array;
  private life: Float32Array;
  constructor(private n = 260, color = 0xffd27a, size = 0.16, private gravity = 3.2) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3).fill(-99), 3));
    this.vel = new Float32Array(n * 3);
    this.life = new Float32Array(n);
    this.points = new THREE.Points(g, new THREE.PointsMaterial({ size, map: glowTexture('rgba(255,250,235,1)', 'rgba(255,230,200,0.5)'), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, color }));
    this.points.frustumCulled = false;
  }
  clear() {
    const pos = this.points.geometry.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < this.n; i++) {
      this.life[i] = 0;
      pos.setXYZ(i, 0, -99, 0);
    }
    pos.needsUpdate = true;
  }

  burst(origin: THREE.Vector3, count: number, power: number, life = 1.6) {
    const pos = this.points.geometry.attributes.position as THREE.BufferAttribute;
    let made = 0;
    for (let i = 0; i < this.n && made < count; i++) {
      if (this.life[i] > 0) continue;
      made++;
      this.life[i] = life + Math.random() * life * 0.8;
      pos.setXYZ(i, origin.x, origin.y, origin.z);
      const a = Math.random() * Math.PI * 2;
      const sp = (1 + Math.random() * 2.5) * power;
      this.vel.set([Math.cos(a) * sp, 2 + Math.random() * 3 * power, Math.sin(a) * sp * 0.6], i * 3);
    }
  }
  // One slow sparkle drifting up from around a point (guests' halos)
  twinkle(origin: THREE.Vector3, scale = 1) {
    const pos = this.points.geometry.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < this.n; i++) {
      if (this.life[i] > 0) continue;
      this.life[i] = 1.1 + Math.random() * 0.6;
      const a = Math.random() * Math.PI * 2;
      pos.setXYZ(i, origin.x + Math.cos(a) * 0.25 * scale, origin.y - Math.random() * 0.5 * scale, origin.z + Math.sin(a) * 0.25 * scale);
      this.vel.set([Math.cos(a) * 0.15, 1.9 + Math.random() * 0.4, Math.sin(a) * 0.15], i * 3);
      return;
    }
  }

  update(dt: number) {
    const pos = this.points.geometry.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < this.n; i++) {
      if (this.life[i] <= 0) continue;
      this.life[i] -= dt;
      const y = pos.getY(i) + this.vel[i * 3 + 1] * dt;
      if (this.life[i] <= 0 || y < -0.05) {
        this.life[i] = 0;
        pos.setXYZ(i, 0, -99, 0);
        continue;
      }
      this.vel[i * 3 + 1] -= dt * this.gravity;
      pos.setXYZ(i, pos.getX(i) + this.vel[i * 3] * dt, y, pos.getZ(i) + this.vel[i * 3 + 2] * dt);
    }
    pos.needsUpdate = true;
  }
}

// ---------- the world ----------

// The pavilion sits just below the middle of the frame, above TikTok's comment area
const WIDE_POS = new THREE.Vector3(0, 6.2, 10.5);
const WIDE_LOOK = new THREE.Vector3(0, 0.5, -6);
const PAVILION_CENTER = new THREE.Vector3(0, PAVILION.y + 1.8, (PAVILION.z0 + PAVILION.z1) / 2);

// A spot on the open water (not under the bridge) for an ambient lantern
function openWater(xMin: number, xMax: number): P2 {
  for (let i = 0; i < 20; i++) {
    const p = { x: xMin + Math.random() * (xMax - xMin), z: -21 + Math.random() * 28 };
    if (!underBridge(p.x, p.z) && Math.abs(p.x) > 1.8) return p;
  }
  return { x: xMin, z: -10 };
}

type Carried = { kind: 'lantern' | 'fish'; idx: number; dropped: boolean; offer: Offer };

export class World {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(48, 9 / 16, 0.1, 400);
  private composer: EffectComposer | null = null;
  private bloom: UnrealBloomPass | null = null;
  private river: River;
  private crowd = new Crowd(SEAT_COUNT + TOP_CUSHIONS + 12);
  private actors = new Map<string, Actor>();
  private floating = new Lanterns(170);
  private fishes = new Fishes(16);
  private ripples = new Ripples(90);
  private petals = new PetalRain(320);
  private lanterns = new SkyLanterns();
  private sparks = new Sparks();
  private splash = new Sparks(200, 0xd8ecff, 0.07, 9);
  private carried = new Map<string, Carried>();
  private rings: THREE.Mesh[] = [];
  private halos: THREE.Group[] = [];
  private lastTwinkle = 0;
  private nextAmbient = 0;
  private quality: Quality = 'high';
  private raf = 0;
  private last = performance.now();
  private snap: Snapshot | null = null;
  private firstSync = true;
  private camPos = WIDE_POS.clone();
  private camLook = WIDE_LOOK.clone();
  private labelScale = 1;
  private frame = 0;
  private plaque = '';
  serverNow: () => number = () => Date.now();
  // A lantern or fish hit the water (power 0..1): the stage page plays a splash
  onSplash: (power: number) => void = () => {};

  constructor(private canvas: HTMLCanvasElement, private labelLayer: HTMLDivElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', alpha: false });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.scene.background = new THREE.Color(0x03050f);
    this.scene.fog = new THREE.Fog(FOG_COLORS.night, 30, 120);
    this.river = buildRiver();
    this.fishes.ripples = this.ripples;
    this.scene.add(this.river.group, this.crowd.group, this.floating.group, this.fishes.group, this.ripples.mesh, this.petals.mesh, this.lanterns.group, this.sparks.points, this.splash.points);

    const onSplash = (x: number, z: number, big: boolean, fish: boolean) => {
      const now = performance.now();
      this.ripples.add(x, z, now, big ? 1.8 : 1.2, 1, 2200);
      this.ripples.add(x, z, now + 250, big ? 1.2 : 0.8, 0.7, 1800);
      this.splash.burst(new THREE.Vector3(x, 0.05, z), fish ? 22 : 12, fish ? 0.45 : 0.3, 0.5);
      this.onSplash(fish ? (big ? 1 : 0.7) : big ? 0.6 : 0.4);
    };
    this.floating.onSplash = (x, z, big) => onSplash(x, z, big, false);
    this.fishes.onSplash = (x, z, big) => onSplash(x, z, big, true);

    // a river that already has lanterns on it
    const now = performance.now();
    for (let i = 0; i < 22; i++) {
      const p = openWater(-7, 7);
      this.floating.float(p.x, p.z, now, Math.random() * 110000, Math.random() < 0.12);
    }

    const ringMat = new THREE.MeshBasicMaterial({ map: ringTexture(), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
    for (let i = 0; i < 16; i++) {
      const r = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), ringMat.clone());
      r.rotation.x = -Math.PI / 2;
      r.visible = false;
      this.scene.add(r);
      this.rings.push(r);
    }

    // Halos that float over guests' heads: a thin golden ring with a soft glow
    const haloMat = new THREE.MeshBasicMaterial({ color: 0xffd36a, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
    const haloGlow = new THREE.SpriteMaterial({ map: glowTexture('rgba(255,236,170,0.85)', 'rgba(255,190,70,0.28)'), blending: THREE.AdditiveBlending, depthWrite: false });
    const haloGeo = new THREE.TorusGeometry(0.15, 0.017, 8, 36);
    for (let i = 0; i < 10; i++) {
      const g = new THREE.Group();
      const ring = new THREE.Mesh(haloGeo, haloMat);
      ring.rotation.x = Math.PI / 2 - 0.25;
      const glow = new THREE.Sprite(haloGlow);
      glow.scale.setScalar(0.6);
      g.add(ring, glow);
      g.visible = false;
      this.scene.add(g);
      this.halos.push(g);
    }

    this.camera.position.copy(WIDE_POS);
    this.camera.lookAt(WIDE_LOOK);
    this.setQuality('high');
    this.resize();
    window.addEventListener('resize', this.resize);
    this.raf = requestAnimationFrame(this.loop);
  }

  dispose() {
    cancelAnimationFrame(this.raf);
    window.removeEventListener('resize', this.resize);
    this.renderer.dispose();
  }

  setQuality(q: Quality) {
    this.quality = q;
    this.composer?.dispose();
    this.composer = null;
    this.bloom = null;
    if (q !== 'low') {
      this.composer = new EffectComposer(this.renderer);
      this.composer.addPass(new RenderPass(this.scene, this.camera));
      this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), q === 'high' ? 0.75 : 0.6, 0.55, 0.72);
      this.composer.addPass(this.bloom);
      this.composer.addPass(new OutputPass());
    }
    this.resize();
  }

  private resize = () => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const dpr = this.quality === 'high' ? Math.min(window.devicePixelRatio, 1.5) : this.quality === 'medium' ? 1 : 0.75;
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(w, h, false);
    this.composer?.setPixelRatio(dpr);
    this.composer?.setSize(w, h);
    this.bloom?.resolution.set((w * dpr) / 2, (h * dpr) / 2);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.labelScale = h / 960;
    this.labelLayer.style.setProperty('--k', String(this.labelScale));
  };

  setTheme(theme: 'dusk' | 'night') {
    this.river.setTheme(theme);
    (this.scene.fog as THREE.Fog).color.set(FOG_COLORS[theme]);
  }

  setPlaque(text: string) {
    if (text === this.plaque) return;
    this.plaque = text;
    // wait for the web font so the plaque uses Lora
    document.fonts?.ready.then(() => this.river.setPlaque(text));
  }

  // ---------- state from the server ----------

  sync(snap: Snapshot) {
    this.snap = snap;
    const now = performance.now();
    const seen = new Set<string>();
    const offers = new Map(snap.offers.map((o) => [o.viewerId, o]));
    const topIds = new Set(snap.top.slice(0, TOP_CUSHIONS).map((t) => t.id));
    const seatOf = new Map(snap.hall.map((h) => [h.id, h]));
    const spotId = snap.spotlight?.viewerId;
    const guests = new Map(snap.settings.guests.map((g) => [g.id, g]));

    const ensure = (key: string, home: P2) => {
      let a = this.actors.get(key);
      if (!a) {
        a = new Actor(key, home, now);
        this.actors.set(key, a);
      }
      seen.add(key);
      return a;
    };
    const setLabel = (a: Actor, data: LabelData | null) => {
      if (!data) {
        a.label?.el.remove();
        a.label = null;
        return;
      }
      if (!a.label) {
        a.label = new Label(data);
        this.labelLayer.appendChild(a.label.el);
      } else a.label.update(data);
    };

    // TOP board in the pavilion (walk over from their place on the bridge when they first make the board)
    snap.top.slice(0, TOP_CUSHIONS).forEach((t, i) => {
      const home = CUSHIONS[i];
      const isNew = !this.actors.has(`top:${t.id}`);
      const a = ensure(`top:${t.id}`, home);
      if (isNew) {
        a.setLook(t.id, true);
        a.viewerId = t.id;
        const fromSeat = seatOf.get(t.id);
        if (!this.firstSync) a.walkTo(home, now, fromSeat ? SEATS[fromSeat.seat] : ENTRANCE);
      } else if (a.home.x !== home.x || a.home.z !== home.z) {
        if (!a.offer) a.walkTo(home, now);
      }
      a.home = home;
      a.setGuest(guests.get(t.id) ?? null);
      a.setOffer(offers.get(t.id) ?? null);
      const kind = spotId === t.id ? 'spot' : a.offer ? 'offer' : 'top';
      setLabel(a, { name: t.name, avatar: t.avatar, vip: t.coins > 0, kind, rank: i + 1, guest: a.guest ? a.guest.title || 'Khách quý' : undefined });
    });

    // Along the railings: viewers in their places, some quiet passers-by in the others
    const bySeat = new Map(snap.hall.map((h) => [h.seat, h]));
    for (let i = 0; i < SEAT_COUNT; i++) {
      const h = bySeat.get(i);
      const a = ensure(`seat:${i}`, SEATS[i]);
      const who = h && !topIds.has(h.id) ? h : null;
      if ((who?.id ?? '') !== a.viewerId || !a.look) {
        const arriving = !!who && !this.firstSync && a.viewerId !== who.id;
        a.viewerId = who?.id ?? '';
        a.setLook(who ? who.id : `npc${i}`, !!who);
        a.setOffer(null);
        if (arriving) a.walkTo(SEATS[i], now, ENTRANCE);
        else a.move = null;
      }
      a.present = !!who || hash(`npc${i}`) % 3 !== 0;
      a.setGuest(who ? (guests.get(who.id) ?? null) : null);
      if (who) {
        a.setOffer(offers.get(who.id) ?? null);
        const kind = spotId === who.id ? 'spot' : a.offer ? 'offer' : 'hall';
        setLabel(a, { name: who.name, avatar: who.avatar, vip: who.vip, kind, guest: a.guest ? a.guest.title || 'Khách quý' : undefined });
      } else setLabel(a, null);
    }

    for (const [key, a] of this.actors) {
      if (!seen.has(key)) {
        a.label?.el.remove();
        this.actors.delete(key);
      }
    }

    // Lanterns / fish still in someone's hands whose release is over (or was cancelled) go away
    const live = new Set(snap.offers.map((o) => o.id));
    for (const [id, c] of this.carried) {
      if (live.has(id)) continue;
      if (!c.dropped && c.idx !== -1) (c.kind === 'fish' ? this.fishes : this.floating).release(c.idx);
      this.carried.delete(id);
    }
    this.firstSync = false;
    this.setPlaque(snap.settings.channelName);
  }

  // A chat bubble over the viewer, if they are on the bridge
  bubble(viewerId: string, text: string) {
    for (const a of this.actors.values()) {
      if (a.viewerId === viewerId && a.label) {
        a.label.say(text);
        return true;
      }
    }
    return false;
  }

  fx(name: string, power = 1) {
    const now = performance.now();
    if (name === 'stopRain') {
      this.petals.clear();
      return;
    }
    if (name === 'stopAll') {
      this.petals.clear();
      this.lanterns.clear();
      this.sparks.clear();
      return;
    }
    if (name === 'bloom') {
      this.river.flare(power);
      this.sparks.burst(PAVILION_CENTER, Math.round(40 + power * 50), 0.8 + power * 0.4);
      this.petals.spawn(Math.round(10 + power * 18), true, PAVILION_CENTER);
    } else if (name === 'lanterns') {
      this.lanterns.launch(Math.round(6 + power * 4), now);
    } else if (name === 'rain') {
      this.petals.spawn(40);
      for (let i = 0; i < 10; i++) {
        const p = openWater(-7, 7);
        this.floating.float(p.x, p.z, now, 0, Math.random() < 0.2);
      }
    } else if (name === 'gong') {
      this.sparks.burst(PAVILION_CENTER, 12, 0.35);
    } else if (name === 'bell') {
      this.river.flare(0.6);
    }
  }

  // ---------- lanterns and fish carried to the railing ----------

  private updateCarried(a: Actor, serverNow: number, now: number) {
    const o = a.offer;
    if (!o || !a.spot) return;
    let c = this.carried.get(o.id);
    if (!c && (a.holding || a.dropped)) {
      if (a.holding) {
        const idx = o.kind === 'fish' ? this.fishes.carry(o.gift, hash(o.viewerId)) : this.floating.carry(o.gift);
        c = { kind: o.kind, idx, dropped: false, offer: o };
      } else {
        // this page opened after the drop: put the lantern straight on the water
        const out = Math.sign(a.spot.x);
        if (o.kind === 'lantern') this.floating.float(a.spot.x + out * 1.4, a.spot.z, now, Math.max(0, serverNow - o.startedAt - 8000), o.gift);
        c = { kind: o.kind, idx: -1, dropped: true, offer: o };
      }
      this.carried.set(o.id, c);
    }
    if (!c || c.idx === -1) return;
    const items = c.kind === 'fish' ? this.fishes : this.floating;
    if (a.holding) {
      const hands = handsPosition(a.pose, new THREE.Vector3());
      hands.y += c.kind === 'fish' ? 0.04 : 0.0;
      items.hold(c.idx, hands, a.pose.heading);
    }
    if (a.dropped && !c.dropped) {
      c.dropped = true;
      const out = Math.sign(a.spot.x) || 1;
      items.drop(c.idx, new THREE.Vector3(out * (1.1 + Math.random() * 0.4), 0.9, (Math.random() - 0.5) * 0.5));
    }
  }

  // ---------- frame loop ----------

  private loop = () => {
    this.raf = requestAnimationFrame(this.loop);
    const nowP = performance.now();
    const dt = Math.min(0.1, (nowP - this.last) / 1000);
    this.last = nowP;
    const t = nowP / 1000;
    const serverNow = this.serverNow();
    this.frame++;

    // People
    let i = 0;
    for (const a of this.actors.values()) {
      if (i >= this.crowd.max) break;
      a.update(nowP, serverNow, dt);
      a.pose.y = deckY(a.pose.z);
      a.pose.visible = a.present;
      this.updateCarried(a, serverNow, nowP);
      this.crowd.setLook(i, a.look);
      this.crowd.write(i, a.pose);
      i++;
    }
    this.crowd.commit(i);

    // Golden rings of light on the deck under whoever is letting go, in the spotlight, or a guest
    const spot = this.snap?.spotlight;
    let ring = 0;
    for (const a of this.actors.values()) {
      if (ring >= this.rings.length) break;
      const isSpot = !!spot && a.viewerId === spot.viewerId;
      if (!isSpot && !a.offer && !a.guest) continue;
      const r = this.rings[ring++];
      r.visible = true;
      r.position.set(a.pose.x, a.pose.y + 0.02, a.pose.z);
      const pulse = 1 + Math.sin(t * 3 + ring) * 0.08;
      r.scale.setScalar((isSpot ? 1.7 : a.guest ? 1.35 : 1.15) * pulse);
      (r.material as THREE.MeshBasicMaterial).opacity = isSpot ? 0.95 : a.guest ? 0.8 : 0.6;
    }
    for (; ring < this.rings.length; ring++) this.rings[ring].visible = false;

    // Guests: a halo bobbing over the head and a few sparkles drifting up around them
    let halo = 0;
    const twinkle = nowP - this.lastTwinkle > 350;
    if (twinkle) this.lastTwinkle = nowP;
    for (const a of this.actors.values()) {
      if (!a.guest || halo >= this.halos.length) continue;
      const h = this.halos[halo++];
      headPosition(a.pose, h.position);
      h.position.y += 0.02 * a.pose.scale + Math.sin(t * 2.2 + halo) * 0.025;
      h.scale.setScalar(a.pose.scale);
      h.children[0].rotation.z = t * 0.8;
      h.visible = true;
      if (twinkle) this.sparks.twinkle(h.position, a.pose.scale);
    }
    for (; halo < this.halos.length; halo++) this.halos[halo].visible = false;

    // The river is never empty: a lantern drifts in from upstream now and then, many while it "rains"
    const raining = !!this.snap && this.snap.likes.rainUntil > serverNow;
    if (nowP > this.nextAmbient) {
      this.nextAmbient = nowP + (raining ? 450 : 5000 + Math.random() * 4000);
      // just outside the left edge of the frame, the current brings it in
      const p = raining ? openWater(-7, 7) : { x: -7.5, z: -20 + Math.random() * 24 };
      this.floating.float(p.x, p.z, nowP, 0, raining && Math.random() < 0.2);
    }
    // Flower rain runs on the server clock, so it stops on time even when nothing else changes
    this.petals.rate = raining ? 12 : 0;

    // Camera: wide shot with a slow drift, or a close-up that follows the gift giver
    let targetPos = WIDE_POS.clone().add(new THREE.Vector3(Math.sin(t * 0.06) * 0.6, Math.sin(t * 0.09) * 0.2, 0));
    let targetLook = WIDE_LOOK.clone().add(new THREE.Vector3(Math.sin(t * 0.06) * 0.3, 0, 0));
    if (spot && serverNow - spot.startedAt < spot.durationMs - 600) {
      const actor = [...this.actors.values()].find((a) => a.viewerId === spot.viewerId);
      if (actor) {
        const head = headPosition(actor.pose, new THREE.Vector3());
        // from the middle of the bridge, so the railing and lantern poles stay behind them with the water
        const out = Math.sign(actor.pose.x) || 1;
        targetLook = head.clone().add(new THREE.Vector3(out * 0.6, -0.45, -0.9));
        targetPos = new THREE.Vector3(-out * (0.5 + Math.sin(t * 0.3) * 0.2), head.y + 1.7, head.z + 3.6);
      } else {
        targetLook = PAVILION_CENTER.clone();
        targetPos = PAVILION_CENTER.clone().add(new THREE.Vector3(0, 2.4, 7));
      }
    }
    const k = 1 - Math.exp(-dt * (spot ? 1.6 : 1.0));
    this.camPos.lerp(targetPos, k);
    this.camLook.lerp(targetLook, k);
    this.camera.position.copy(this.camPos);
    this.camera.lookAt(this.camLook);

    // Effects
    this.river.update(t, dt);
    this.floating.update(t, nowP, dt);
    this.fishes.update(t, nowP, dt);
    this.ripples.update(nowP);
    this.petals.update(t, dt);
    this.lanterns.update(nowP);
    this.sparks.update(dt);
    this.splash.update(dt);

    if (this.composer) this.composer.render();
    else this.renderer.render(this.scene, this.camera);

    if (this.frame % 2 === 0 || spot) this.placeLabels(!!spot && serverNow - spot.startedAt < spot.durationMs - 600);
  };

  private placeLabels(closeUp: boolean) {
    const w = window.innerWidth / this.labelScale;
    const h = window.innerHeight / this.labelScale;
    const v = new THREE.Vector3();
    for (const a of this.actors.values()) {
      if (!a.label) continue;
      headPosition(a.pose, v);
      if (a.guest) v.y += 0.22 * a.pose.scale;
      const dist = v.distanceTo(this.camera.position);
      v.project(this.camera);
      // During a close-up only the gift giver and people at the railing keep their name plates
      const quiet = closeUp && (a.label.data.kind === 'hall' || a.label.data.kind === 'top');
      const visible = !quiet && v.z < 1 && Math.abs(v.x) < 1.1 && v.y > -1.1 && v.y < 1.1;
      const x = (v.x * 0.5 + 0.5) * w;
      const y = (-v.y * 0.5 + 0.5) * h;
      const kind = a.label.data.kind;
      const base = a.guest ? 13 : kind === 'hall' ? 11 : kind === 'top' ? 10 : 12;
      const scale = Math.min(kind === 'spot' ? 1.8 : 1.35, Math.max(0.55, base / dist));
      const z = kind === 'spot' ? 1000 : kind === 'offer' ? 900 : a.guest ? 850 : a.label.talking ? 800 : Math.round(500 - dist * 10);
      a.label.place(x, y, scale, visible, z);
    }
  }
}
