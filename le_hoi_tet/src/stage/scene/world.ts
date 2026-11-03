import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import type { Guest, Offer, Quality, Snapshot } from '../../../shared/types';
import { OFFER_MS, SEAT_COUNT, TOP_CUSHIONS } from '../../../shared/types';
import { buildFestival, DAIS, FOG_COLORS, PAD, type Festival } from './festival';
import { Scrolls } from './props';
import { LionDance } from './lion';
import { Fireworks } from './fireworks';
import { Crowd, HAIRS, HEADWEAR, NPC_ROBES, PANTS, SKINS, VIEWER_ROBES, handsPosition, headPosition, newPose, type Look, type Pose } from './people';
import { Label, type LabelData } from './labels';
import { glowTexture, petalTexture, ringTexture } from './textures';

// ---------- layout (world units; the street runs along -z from the camera to the village gate) ----------

type P2 = { x: number; z: number };

// Along both sides of the street, three deep. Seat 0 is nearest the gate (highest on screen, so the
// first viewers are never hidden behind TikTok's comment area).
const SEATS: P2[] = Array.from({ length: SEAT_COUNT }, (_, i) => {
  const row = Math.floor(i / 6);
  const k = i % 6;
  const side = k % 2 ? 1 : -1;
  const col = Math.floor(k / 2);
  return { x: side * (1.15 + col * 0.72), z: -6.4 + row * 0.9 };
});
// The TOP board stands on the red dais in front of the gate, facing everyone: rank 1 front and centre
const TOP_X = [0, -1.25, 1.25, -2.5, 2.5, -0.62, 0.62, -1.87, 1.87, -3.1];
const CUSHIONS: P2[] = TOP_X.map((x, i) => ({ x, z: i < 5 ? DAIS.z1 - 0.45 : DAIS.z1 - 1.6 }));
// Where people stand: at the calligrapher's table (facing -x), or by the firework pad (facing +x)
const SPOTS = {
  chu: [{ x: -2.0, z: -8.6 }, { x: -2.0, z: -7.95 }, { x: -2.0, z: -9.25 }, { x: -1.35, z: -8.3 }, { x: -1.35, z: -8.95 }],
  phao: [{ x: 2.05, z: -8.6 }, { x: 2.05, z: -7.95 }, { x: 2.05, z: -9.25 }, { x: 1.4, z: -8.3 }, { x: 1.4, z: -8.95 }],
};
const ENTRANCE: P2 = { x: 0.3, z: 11 };

// Timelines (ms), all derived from the server's start time so every page shows the same moment
const RISE = 400;
// xin chữ
const GREET = 1200; // a bow with joined hands
const RECEIVE = 1800; // both hands out to take the scroll
const SHOW = 3200; // turn round and hold it up high
const THANK = 900;
// pháo hoa
const LIGHT = 1700; // crouch and light the fuse
const STEP_BACK = 600;
const WATCH = 3800; // arms up, cheering, as it bursts
const SETTLE = 600;

const ease = (t: number) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
const clamp01 = (t: number) => Math.min(1, Math.max(0, t));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const angleLerp = (a: number, b: number, t: number) => {
  let d = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
};
const bowCurve = (p: number) => (p < 0.38 ? ease(p / 0.38) : p < 0.58 ? 1 : 1 - ease((p - 0.58) / 0.42));
const FACE_CAMERA = Math.PI;
// people at the side of the street look in toward the middle and a little toward the camera
const lookIn = (x: number) => (x < 0 ? Math.atan2(-1, -0.6) : Math.atan2(1, -0.6));
const homeHeading = (h: P2) => (h.z < -10 ? FACE_CAMERA : lookIn(h.x));
const onDais = (x: number, z: number) => z > DAIS.z0 && z < DAIS.z1 && Math.abs(x) < 3.3;

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
// Out into the street, along it, then across to the target
const aisleX = (x: number) => (x < 0 ? -0.45 : 0.45);
const route = (from: P2, to: P2): P2[] =>
  Math.abs(from.z - to.z) > 0.6 ? [from, { x: aisleX(from.x), z: from.z }, { x: aisleX(to.x), z: to.z }, to] : [from, to];

let rnd = 1;
const seeded = (s: string) => {
  rnd = [...s].reduce((a, c) => (a * 33 + c.charCodeAt(0)) >>> 0, 5381);
  return () => ((rnd = (rnd * 1664525 + 1013904223) >>> 0) / 4294967296);
};

const offerTag = (o: Offer | null) => (!o ? undefined : o.kind === 'chu' ? `🖌️ ${o.word || 'xin chữ'}` : '🎆 pháo hoa');

class Actor {
  pose: Pose;
  look!: Look;
  label: Label | null = null;
  viewerId = '';
  home: P2;
  offer: Offer | null = null;
  spot: P2 | null = null;
  private plan: { to: Path; back: Path; walk: number } | null = null;
  move: { path: Path; start: number; dur: number } | null = null;
  private nextIdle: number;
  private idleStart = -1e9;
  private idleKind = 0;
  scroll: 'none' | 'up' | 'chest' = 'none'; // the calligraphy scroll, if they have it
  lighting = false; // crouched at the fuse
  launchAt = 0; // server time their firework goes up (0 = none)
  guest: Guest | null = null;
  private guestSig = '';

  constructor(public key: string, home: P2, now: number) {
    this.home = home;
    this.pose = newPose(home.x, home.z);
    this.pose.heading = homeHeading(home);
    this.nextIdle = now + 2000 + Math.random() * 12000;
  }

  setLook(seed: string, viewer: boolean) {
    const r = seeded(seed);
    const robes = viewer ? VIEWER_ROBES : NPC_ROBES;
    const female = r() < 0.62;
    this.look = {
      robe: new THREE.Color(robes[Math.floor(r() * robes.length)]),
      pants: new THREE.Color(PANTS[Math.floor(r() * PANTS.length)]),
      skin: new THREE.Color(SKINS[Math.floor(r() * SKINS.length)]),
      hair: new THREE.Color(HAIRS[Math.floor(r() * HAIRS.length)]),
      headwear: new THREE.Color(HEADWEAR[Math.floor(r() * HEADWEAR.length)]),
      female,
      bare: r() < (female ? 0.3 : 0.25),
    };
    this.guestSig = '';
    this.pose.scale = 1;
  }

  // A guest wears the colour the owner picked and stands a little taller than everyone else
  setGuest(g: Guest | null) {
    const sig = g ? `${g.id}|${g.robe}` : '';
    this.guest = g;
    if (sig === this.guestSig) return;
    this.guestSig = sig;
    this.pose.scale = g ? 1.15 : 1;
    if (g) this.look = { ...this.look, robe: new THREE.Color(g.robe), bare: false };
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
    this.plan = null;
    this.spot = null;
    this.launchAt = 0;
    if (!o) return;
    const spot = SPOTS[o.kind][o.slot % 5];
    const pts = route(this.home, spot);
    const to = makePath(pts);
    const back = makePath([...pts].reverse());
    const walk = Math.min(5200, Math.max(1500, (to.len / 1.7) * 1000));
    this.plan = { to, back, walk };
    this.spot = spot;
    if (o.kind === 'phao') this.launchAt = o.startedAt + RISE + walk + LIGHT;
  }

  update(now: number, serverNow: number, dt: number) {
    const p = this.pose;
    p.walk = -1;
    p.y = 0;
    p.hands = 0;
    p.reach = 0;
    p.cheer = 0;
    p.kneel = 0;
    p.bow = 0;
    this.lighting = false;
    this.scroll = 'none';

    if (this.offer && this.plan && this.spot && this.act(serverNow, dt)) return;

    // Walking somewhere (arriving, moving up to the dais)
    if (this.move) {
      const k = (now - this.move.start) / this.move.dur;
      if (k < 1) {
        const a = along(this.move.path, ease(k));
        Object.assign(p, { x: a.x, z: a.z, walk: now * 0.011 });
        p.heading = angleLerp(p.heading, a.heading, dt * 8);
        return;
      }
      this.move = null;
    }

    // Standing at their place enjoying the festival: now and then a greeting bow, a wave or a little cheer
    p.x = this.home.x;
    p.z = this.home.z;
    p.heading = angleLerp(p.heading, homeHeading(this.home), dt * 5);
    if (now > this.nextIdle) {
      this.idleStart = now;
      this.idleKind = Math.floor(Math.random() * 3);
      this.nextIdle = now + 7000 + Math.random() * 14000;
    }
    const b = (now - this.idleStart) / 2400;
    if (b >= 0 && b < 1) {
      const c = bowCurve(b);
      if (this.idleKind === 0) {
        p.hands = 0.5 * Math.min(1, b * 4, (1 - b) * 4);
        p.bow = c * 0.3;
      } else if (this.idleKind === 1) p.cheer = c;
      else p.hands = 0.5 * c;
    }
    // the offer is over but the page still holds it: keep the scroll at the chest until it ends
    if (this.offer?.kind === 'chu' && serverNow - this.offer.startedAt < OFFER_MS) {
      p.hands = 0.55;
      this.scroll = 'chest';
    }
  }

  // The xin chữ / pháo hoa timeline; false once it's over
  private act(serverNow: number, dt: number) {
    const p = this.pose;
    const o = this.offer!;
    const spot = this.spot!;
    const { to, back, walk } = this.plan!;
    const e = serverNow - o.startedAt;
    if (e < 0) return false;
    const face = o.kind === 'chu' ? Math.PI / 2 : -Math.PI / 2; // toward the table / the pad
    const stand = (h: number) => {
      Object.assign(p, { x: spot.x, z: spot.z });
      p.heading = angleLerp(p.heading, h, dt * 6);
    };
    const t1 = RISE;
    const t2 = t1 + walk;
    if (e < t1) {
      Object.assign(p, { x: this.home.x, z: this.home.z });
      p.heading = angleLerp(p.heading, along(to, 0.05).heading, dt * 6);
      return true;
    }
    if (e < t2) {
      const a = along(to, ease((e - t1) / walk));
      Object.assign(p, { x: a.x, z: a.z, walk: e * 0.011 });
      p.heading = angleLerp(p.heading, a.heading, dt * 8);
      return true;
    }
    if (o.kind === 'chu') {
      const t3 = t2 + GREET, t4 = t3 + RECEIVE, t5 = t4 + SHOW, t6 = t5 + THANK, t7 = t6 + walk, t8 = t7 + SETTLE;
      if (e >= Math.min(t8, OFFER_MS + 1500)) return false;
      if (e < t3) {
        stand(face);
        const k = (e - t2) / GREET;
        p.hands = 0.5;
        p.bow = bowCurve(k) * 0.45;
      } else if (e < t4) {
        stand(face);
        const k = (e - t3) / RECEIVE;
        p.reach = k < 0.5 ? ease(k / 0.5) : 1 - ease((k - 0.5) / 0.5) * 0.5;
        p.hands = k > 0.5 ? 0.55 : 0;
        p.bow = 0.15;
        if (k > 0.5) this.scroll = 'chest';
      } else if (e < t5) {
        // turn to everyone and hold it up high
        stand(FACE_CAMERA + (spot.x < 0 ? -0.5 : 0.5));
        const k = (e - t4) / SHOW;
        p.hands = 0.55 + 0.45 * ease(Math.min(1, k * 3));
        p.bow = -Math.abs(Math.sin(k * Math.PI * 3)) * 0.06;
        this.scroll = 'up';
      } else if (e < t6) {
        stand(face);
        p.hands = 0.55;
        p.bow = bowCurve((e - t5) / THANK) * 0.35;
        this.scroll = 'chest';
      } else if (e < t7) {
        const a = along(back, ease((e - t6) / walk));
        Object.assign(p, { x: a.x, z: a.z, walk: e * 0.011 });
        p.heading = angleLerp(p.heading, a.heading, dt * 8);
        p.hands = 0.55;
        this.scroll = 'chest';
      } else {
        Object.assign(p, { x: this.home.x, z: this.home.z });
        p.heading = angleLerp(p.heading, homeHeading(this.home), dt * 8);
        p.hands = 0.55;
        this.scroll = 'chest';
      }
      return true;
    }
    // pháo hoa
    const t3 = t2 + LIGHT, t4 = t3 + STEP_BACK, t5 = t4 + WATCH, t6 = t5 + walk, t7 = t6 + SETTLE;
    if (e >= Math.min(t7, OFFER_MS + 1500)) return false;
    if (e < t3) {
      stand(face);
      const k = (e - t2) / LIGHT;
      p.bow = ease(Math.min(1, k * 3)) * 0.55;
      p.kneel = ease(Math.min(1, k * 3)) * 0.35;
      p.reach = ease(Math.min(1, k * 2));
      this.lighting = k > 0.3;
    } else if (e < t4) {
      // a quick step back from the fuse
      const k = ease((e - t3) / STEP_BACK);
      Object.assign(p, { x: spot.x - Math.sign(spot.x) * 0.5 * k, z: spot.z });
      p.heading = angleLerp(p.heading, face, dt * 6);
    } else if (e < t5) {
      // watch it burst, arms up, a little jump
      const k = (e - t4) / WATCH;
      Object.assign(p, { x: spot.x - Math.sign(spot.x) * 0.5, z: spot.z });
      p.heading = angleLerp(p.heading, 0, dt * 4);
      p.cheer = k > 0.2 ? ease(Math.min(1, (k - 0.2) * 4)) : 0;
      p.y = k > 0.25 ? Math.abs(Math.sin(k * Math.PI * 5)) * 0.08 : 0;
    } else if (e < t6) {
      const a = along(back, ease((e - t5) / walk));
      Object.assign(p, { x: a.x, z: a.z, walk: e * 0.011 });
      p.heading = angleLerp(p.heading, a.heading, dt * 8);
    } else {
      Object.assign(p, { x: this.home.x, z: this.home.z });
      p.heading = angleLerp(p.heading, homeHeading(this.home), dt * 8);
    }
    return true;
  }
}

// ---------- falling petals (peach pink, apricot gold) ----------

class PetalRain {
  mesh: THREE.InstancedMesh;
  private items: Array<{ p: THREE.Vector3; v: THREE.Vector3; r: THREE.Euler; s: THREE.Vector3; alive: boolean }>;
  private m = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private emitAcc = 0;
  rate = 0; // petals per second
  constructor(max: number, kind: 'dao' | 'mai') {
    const mat = new THREE.MeshBasicMaterial({ map: petalTexture(kind), transparent: true, side: THREE.DoubleSide, depthWrite: false, alphaTest: 0.05 });
    this.mesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.12, 0.18), mat, max);
    this.mesh.frustumCulled = false;
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.items = Array.from({ length: max }, () => ({ p: new THREE.Vector3(), v: new THREE.Vector3(), r: new THREE.Euler(), s: new THREE.Vector3(1, 1, 1), alive: false }));
  }
  clear() {
    this.rate = 0;
    this.emitAcc = 0;
    for (const it of this.items) it.alive = false;
  }
  spawn(n: number, origin?: THREE.Vector3) {
    for (const it of this.items) {
      if (n <= 0) break;
      if (it.alive) continue;
      n--;
      it.alive = true;
      if (origin) {
        it.p.copy(origin);
        it.v.set((Math.random() - 0.5) * 4, 1.5 + Math.random() * 3, (Math.random() - 0.2) * 2.2);
      } else {
        it.p.set((Math.random() - 0.5) * 11, 6 + Math.random() * 3, -15 + Math.random() * 22);
        it.v.set((Math.random() - 0.5) * 0.4, -0.6 - Math.random() * 0.5, 0);
      }
      it.r.set(Math.random() * 6, Math.random() * 6, Math.random() * 6);
      it.s.setScalar(0.8 + Math.random() * 0.7);
    }
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
      it.v.y = Math.max(it.v.y - dt * 1.2, -0.9);
      it.v.x *= 1 - dt * 0.5;
      it.v.z *= 1 - dt * 0.5;
      it.p.addScaledVector(it.v, dt);
      it.p.x += Math.sin(t * 1.3 + i) * dt * 0.4;
      it.r.x += dt * 1.8;
      it.r.y += dt * 1.2;
      if (it.p.y < 0.02) it.alive = false;
      this.mesh.setMatrixAt(i, this.m.compose(it.p, this.q.setFromEuler(it.r), it.s));
    });
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}

// ---------- sparks (fuses, firecrackers, guests' twinkles) ----------

class Sparks {
  points: THREE.Points;
  private vel: Float32Array;
  private life: Float32Array;
  constructor(private n = 400, color = 0xffd27a, size = 0.14, private gravity = 3.2) {
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
  burst(origin: THREE.Vector3, count: number, power: number, life = 1.2) {
    const pos = this.points.geometry.attributes.position as THREE.BufferAttribute;
    let made = 0;
    for (let i = 0; i < this.n && made < count; i++) {
      if (this.life[i] > 0) continue;
      made++;
      this.life[i] = life * (0.5 + Math.random() * 0.8);
      pos.setXYZ(i, origin.x, origin.y, origin.z);
      const a = Math.random() * Math.PI * 2;
      const sp = (1 + Math.random() * 2.5) * power;
      this.vel.set([Math.cos(a) * sp, (1 + Math.random() * 3) * power, Math.sin(a) * sp * 0.6], i * 3);
    }
  }
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

// The gate area sits in the upper half of the frame, above TikTok's comment area
const WIDE_POS = new THREE.Vector3(0, 5.0, 11.5);
const WIDE_LOOK = new THREE.Vector3(0, 3.0, -8.5);

export type SoundCue = 'launch' | 'boom' | 'crackle' | 'drum' | 'chime';

export class World {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(48, 9 / 16, 0.1, 400);
  private composer: EffectComposer | null = null;
  private bloom: UnrealBloomPass | null = null;
  private festival: Festival;
  private crowd = new Crowd(SEAT_COUNT + TOP_CUSHIONS + 12);
  private actors = new Map<string, Actor>();
  private petals = new PetalRain(320, 'dao');
  private goldPetals = new PetalRain(160, 'mai');
  private fireworks = new Fireworks();
  private scrolls = new Scrolls();
  private lion = new LionDance();
  private sparks = new Sparks();
  private launched = new Set<string>();
  private rings: THREE.Mesh[] = [];
  private halos: THREE.Group[] = [];
  private lastTwinkle = 0;
  private nextAmbient = 0;
  private nextVolley = 0;
  private night = false;
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
  // The stage page plays these (only the page that has the sound)
  onSound: (cue: SoundCue, power: number) => void = () => {};

  constructor(private canvas: HTMLCanvasElement, private labelLayer: HTMLDivElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', alpha: false });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.scene.background = new THREE.Color(0xbcdcf2);
    this.scene.fog = new THREE.Fog(FOG_COLORS.dusk, 30, 90);
    this.festival = buildFestival();
    this.scene.add(this.festival.group, this.crowd.group, this.petals.mesh, this.goldPetals.mesh, this.fireworks.group, this.scrolls.group, this.lion.group, this.sparks.points);

    this.fireworks.onLaunch = () => this.onSound('launch', 1);
    this.fireworks.onBurst = (_p, size) => this.onSound('boom', size);
    this.fireworks.onCrackle = () => this.onSound('crackle', 0.6);
    this.festival.onCrackle = (p) => {
      this.sparks.burst(p, 6, 0.35, 0.35);
      this.onSound('crackle', 1);
    };
    this.festival.onConScore = (p) => {
      this.sparks.burst(p, 30, 0.7, 1);
      this.onSound('chime', 0.4);
    };
    this.lion.onStep = () => this.onSound('drum', 1);

    const ringMat = new THREE.MeshBasicMaterial({ map: ringTexture(), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
    for (let i = 0; i < 16; i++) {
      const r = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), ringMat.clone());
      r.rotation.x = -Math.PI / 2;
      r.visible = false;
      this.scene.add(r);
      this.rings.push(r);
    }
    // Halos over guests' heads: a thin golden ring with a soft glow
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
      this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), this.night ? 0.8 : 0.35, 0.5, this.night ? 0.7 : 0.88);
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
    this.fireworks.setScale((h * dpr) / 2 / Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2)));
    this.labelScale = h / 960;
    this.labelLayer.style.setProperty('--k', String(this.labelScale));
  };

  setTheme(theme: 'dusk' | 'night') {
    this.night = theme === 'night';
    this.festival.setTheme(theme);
    this.fireworks.setDay(!this.night);
    (this.scene.fog as THREE.Fog).color.set(FOG_COLORS[theme]);
    this.scene.background = new THREE.Color(this.night ? 0x0a0f24 : 0xbcdcf2);
    this.renderer.toneMappingExposure = this.night ? 1.1 : 1.0;
    // bloom suits lanterns and fireworks at night; by day it would wash the colours out
    if (this.bloom) {
      this.bloom.strength = this.night ? 0.8 : 0.35;
      this.bloom.threshold = this.night ? 0.7 : 0.88;
    }
  }

  setPlaque(text: string) {
    if (text === this.plaque) return;
    this.plaque = text;
    // wait for the web font so the board uses Lora
    document.fonts?.ready.then(() => this.festival.setPlaque(text));
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

    // TOP board on the dais (walk up from their place in the street when they first make the board)
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
      setLabel(a, { name: t.name, avatar: t.avatar, vip: t.coins > 0, kind, rank: i + 1, guest: a.guest ? a.guest.title || 'Khách quý' : undefined, tag: offerTag(a.offer) });
    });

    // Both sides of the street: viewers in their places, villagers enjoying the festival in the others
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
      a.setGuest(who ? (guests.get(who.id) ?? null) : null);
      if (who) {
        a.setOffer(offers.get(who.id) ?? null);
        const kind = spotId === who.id ? 'spot' : a.offer ? 'offer' : 'hall';
        setLabel(a, { name: who.name, avatar: who.avatar, vip: who.vip, kind, guest: a.guest ? a.guest.title || 'Khách quý' : undefined, tag: offerTag(a.offer) });
      } else setLabel(a, null);
    }

    for (const [key, a] of this.actors) {
      if (!seen.has(key)) {
        a.label?.el.remove();
        this.actors.delete(key);
      }
    }
    // forget fireworks of offers that are over
    const live = new Set(snap.offers.map((o) => o.id));
    for (const id of this.launched) if (!live.has(id)) this.launched.delete(id);
    this.firstSync = false;
    this.setPlaque(snap.settings.channelName);
  }

  // A chat bubble over the viewer, if they are in the square
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
      this.petals.rate = 0;
      return;
    }
    if (name === 'stopAll') {
      this.petals.clear();
      this.goldPetals.clear();
      this.fireworks.clear();
      this.lion.stop();
      this.sparks.clear();
      return;
    }
    const gate = this.festival.gateCenter;
    if (name === 'bloom') {
      // a gift: the gate lights up, firecrackers pop, golden apricot petals burst out, two fireworks
      this.festival.flare(power);
      this.festival.crackle(power);
      this.sparks.burst(gate, Math.round(30 + power * 40), 0.8 + power * 0.4);
      this.goldPetals.spawn(Math.round(20 + power * 25), gate.clone().add(new THREE.Vector3(0, 0.5, 1)));
      for (let i = 0; i < 2; i++) setTimeout(() => this.fireworks.launch(new THREE.Vector3((Math.random() - 0.5) * 6, 1, -18), 1 + power * 0.4, i ? 'strobe' : 'chrysanthemum', i ? 2.4 : -2.4), i * 400);
    } else if (name === 'lion') {
      this.lion.play(now, power);
    } else if (name === 'rain') {
      this.petals.spawn(50);
      this.fireworks.finale();
    } else if (name === 'gong') {
      this.festival.crackle(0.1);
    } else if (name === 'bell') {
      this.festival.flare(0.6);
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
    const tmp = new THREE.Vector3();

    // People
    let i = 0;
    for (const a of this.actors.values()) {
      if (i >= this.crowd.max) break;
      a.update(nowP, serverNow, dt);
      a.pose.y = Math.max(a.pose.y, onDais(a.pose.x, a.pose.z) ? 0.16 : 0);
      this.crowd.setLook(i, a.look);
      this.crowd.write(i, a.pose);
      const o = a.offer;
      // the scroll in their hands
      if (o && o.kind === 'chu' && a.scroll !== 'none') {
        handsPosition(a.pose, tmp);
        // held up: the bottom rod in their hands, the word above their head
        if (a.scroll === 'up') tmp.y += 0.36 * a.pose.scale;
        else tmp.add(new THREE.Vector3(-Math.sin(a.pose.heading) * 0.05, -0.05, -Math.cos(a.pose.heading) * 0.05));
        this.scrolls.show(o.id, o.word || 'Phúc', tmp, a.pose.heading, (a.scroll === 'up' ? 1.35 : 1) * (o.gift ? 1.15 : 1) * a.pose.scale);
      }
      // sparks at the fuse, then the firework (each page launches it once)
      if (a.lighting && Math.random() < 0.6) this.sparks.burst(handsPosition(a.pose, tmp), 2, 0.25, 0.4);
      if (o && o.kind === 'phao' && a.launchAt && serverNow >= a.launchAt && serverNow < a.launchAt + 2000 && !this.launched.has(o.id)) {
        this.launched.add(o.id);
        // a salvo of different shells (five, bigger, for a gift giver)
        this.fireworks.salvo(new THREE.Vector3(PAD.x, 0.4, PAD.z), o.gift);
      }
      i++;
    }
    this.crowd.commit(i);
    this.scrolls.endFrame(new Set(this.snap?.offers.map((o) => o.id) ?? []));

    // Golden rings of light under whoever is up at the table or the pad, in the spotlight, or a guest
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
      h.position.y += 0.03 * a.pose.scale + Math.sin(t * 2.2 + halo) * 0.025;
      h.scale.setScalar(a.pose.scale);
      h.children[0].rotation.z = t * 0.8;
      h.visible = true;
      if (twinkle) this.sparks.twinkle(h.position, a.pose.scale);
    }
    for (; halo < this.halos.length; halo++) this.halos[halo].visible = false;

    // Petals drift down all the time; a storm of them (and volleys of fireworks) when the likes fill up
    const raining = !!this.snap && this.snap.likes.rainUntil > serverNow;
    this.petals.rate = raining ? 14 : 1.6;
    this.goldPetals.rate = raining ? 6 : 0.5;
    if (raining && nowP > this.nextVolley) {
      this.nextVolley = nowP + 700 + Math.random() * 500;
      // spread across the whole sky, at different heights
      this.fireworks.launch(new THREE.Vector3((Math.random() - 0.5) * 6, 1, -16 - Math.random() * 6), 0.9 + Math.random() * 0.5, undefined, (Math.random() - 0.5) * 7, Math.random() * 2 - 0.5);
    }
    // the odd firework far off over the village (more often on New Year's Eve)
    if (nowP > this.nextAmbient) {
      this.nextAmbient = nowP + (this.night ? 6000 + Math.random() * 7000 : 18000 + Math.random() * 14000);
      if (this.snap) this.fireworks.launch(new THREE.Vector3((Math.random() - 0.5) * 16, 1, -26 - Math.random() * 8), 0.9);
    }

    // Camera: wide shot with a slow drift, or a close-up that follows the gift giver
    let targetPos = WIDE_POS.clone().add(new THREE.Vector3(Math.sin(t * 0.06) * 0.6, Math.sin(t * 0.09) * 0.2, 0));
    let targetLook = WIDE_LOOK.clone().add(new THREE.Vector3(Math.sin(t * 0.06) * 0.3, 0, 0));
    // while the lion dances (and nobody is in the spotlight) the camera follows it at a medium distance
    if (this.lion.active && !(spot && serverNow - spot.startedAt < spot.durationMs - 600)) {
      const h = this.lion.focus(new THREE.Vector3());
      targetLook = WIDE_LOOK.clone().lerp(h.clone().add(new THREE.Vector3(0, 0.3, -1.5)), 0.8);
      targetPos = h.clone().add(new THREE.Vector3(Math.sin(t * 0.25) * 1.2, 2.2, 6.2));
    }
    if (spot && serverNow - spot.startedAt < spot.durationMs - 600) {
      const actor = [...this.actors.values()].find((a) => a.viewerId === spot.viewerId);
      if (actor) {
        const head = headPosition(actor.pose, new THREE.Vector3());
        // from the street side, so the gate, the trees and the sky stay behind them
        targetLook = head.clone().add(new THREE.Vector3(-actor.pose.x * 0.25, 0.5, -2.5));
        targetPos = new THREE.Vector3(head.x * 0.4 + Math.sin(t * 0.3) * 0.4, head.y + 1.7, head.z + 5.6);
      } else {
        targetLook = this.festival.gateCenter.clone();
        targetPos = this.festival.gateCenter.clone().add(new THREE.Vector3(0, 0.8, 8));
      }
    }
    const k = 1 - Math.exp(-dt * (spot || this.lion.active ? 1.4 : 1.0));
    this.camPos.lerp(targetPos, k);
    this.camLook.lerp(targetLook, k);
    this.camera.position.copy(this.camPos);
    this.camera.lookAt(this.camLook);

    // Effects
    this.festival.update(t, dt);
    this.fireworks.update(dt, t);
    this.lion.update(nowP, t);
    this.petals.update(t, dt);
    this.goldPetals.update(t, dt);
    this.sparks.update(dt);

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
      v.y += 0.06 * a.pose.scale + (a.guest ? 0.22 * a.pose.scale : 0);
      // while a scroll is held up high, the name plate sits above it
      if (a.scroll === 'up') v.y += 0.8 * a.pose.scale;
      const dist = v.distanceTo(this.camera.position);
      v.project(this.camera);
      // During a close-up only the gift giver and people at the table or pad keep their name plates
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

