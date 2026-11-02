import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import type { Offer, Quality, Snapshot } from '../../../shared/types';
import { OFFER_MS, SEAT_COUNT, TOP_CUSHIONS } from '../../../shared/types';
import { buildTemple, BURNER, type Temple } from './temple';
import { Crowd, HAIRS, NPC_ROBES, SKINS, VIEWER_ROBES, handsPosition, headPosition, newPose, type Look, type Pose } from './people';
import { Label, type LabelData } from './labels';
import { glowTexture, petalTexture, ringTexture } from './textures';

// ---------- layout (world units; the altar is at -z, the camera looks from +z) ----------

type P2 = { x: number; z: number };

// Hall: 12 rows x 8 people, a walkway in the middle. Seat 0 is the front row (closest to the altar,
// highest on screen, so the first viewers are never hidden behind TikTok's comment area).
const SEATS: P2[] = Array.from({ length: SEAT_COUNT }, (_, i) => {
  const row = Math.floor(i / 8);
  const k = i % 8;
  const side = k % 2 ? 1 : -1;
  const col = Math.floor(k / 2);
  return { x: side * (0.95 + col * 0.8), z: -4.6 + row * 1.0 };
});
// Ten cushions for the TOP board, in front of the hall, alternating sides from the middle
const CUSHIONS: P2[] = Array.from({ length: TOP_CUSHIONS }, (_, i) => {
  const side = i % 2 ? 1 : -1;
  const col = Math.floor(i / 2);
  return { x: side * (0.95 + col * 0.9), z: -6.4 };
});
// Where people stand to light incense, in the order spots fill
const SPOTS: P2[] = [0, -1.25, 1.25, -2.5, 2.5].map((x) => ({ x, z: BURNER.z + 1.15 }));
const ENTRANCE: P2 = { x: 0.38, z: 10 };

// Offering timeline (ms), all derived from the server's start time so every page shows the same moment
const RISE = 700;
const INCENSE = 2600;
const KNEEL = 700;
const BOWS = 6300;
const RISE2 = 600;
const SIT = 700;

const ease = (t: number) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
const clamp01 = (t: number) => Math.min(1, Math.max(0, t));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const angleLerp = (a: number, b: number, t: number) => {
  let d = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
};
// One lạy: bend down, hold, come back up
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
const aisleX = (x: number) => (x < 0 ? -0.38 : 0.38);

let rnd = 1;
const seeded = (s: string) => {
  rnd = [...s].reduce((a, c) => (a * 33 + c.charCodeAt(0)) >>> 0, 5381);
  return () => ((rnd = (rnd * 1664525 + 1013904223) >>> 0) / 4294967296);
};

class Actor {
  pose: Pose;
  look!: Look;
  label: Label | null = null;
  viewerId = '';
  home: P2;
  offer: Offer | null = null;
  private offerPlan: { to: Path; back: Path; walk: number } | null = null;
  move: { path: Path; start: number; dur: number } | null = null;
  private nextBow: number;
  private bowStart = -1e9;
  incense = false;
  alive = true;

  constructor(public key: string, home: P2, now: number) {
    this.home = home;
    this.pose = newPose(home.x, home.z);
    this.nextBow = now + 2000 + Math.random() * 12000;
  }

  setLook(seed: string, viewer: boolean) {
    const r = seeded(seed);
    const robes = viewer ? VIEWER_ROBES : NPC_ROBES;
    this.look = {
      robe: new THREE.Color(robes[Math.floor(r() * robes.length)]),
      skin: new THREE.Color(SKINS[Math.floor(r() * SKINS.length)]),
      hair: new THREE.Color(HAIRS[Math.floor(r() * HAIRS.length)]),
      bald: r() < (viewer ? 0.15 : 0.35),
    };
  }

  walkTo(target: P2, now: number, from?: P2) {
    const start = from ?? { x: this.pose.x, z: this.pose.z };
    const pts = Math.abs(start.z - target.z) > 1.2 ? [start, { x: aisleX(start.x), z: start.z }, { x: aisleX(start.x), z: target.z }, target] : [start, target];
    const path = makePath(pts);
    this.move = { path, start: now, dur: Math.min(6000, Math.max(1200, (path.len / 1.5) * 1000)) };
  }

  setOffer(o: Offer | null) {
    if (o?.id === this.offer?.id) return;
    this.offer = o;
    this.offerPlan = null;
    if (!o) return;
    const spot = SPOTS[o.slot % SPOTS.length];
    const h = this.home;
    const front = h.z < -5.5; // a cushion near the front
    const via: P2[] = front ? [{ x: h.x, z: spot.z + 1.0 }] : [{ x: aisleX(h.x), z: h.z }, { x: aisleX(h.x), z: spot.z + 1.0 }];
    const to = makePath([h, ...via, spot]);
    const back = makePath([spot, ...via.reverse(), h]);
    const walk = Math.min(5500, Math.max(1800, (to.len / 1.7) * 1000));
    this.offerPlan = { to, back, walk };
  }

  update(now: number, serverNow: number, dt: number) {
    const p = this.pose;
    p.walk = -1;
    p.hands = 0;
    this.incense = false;

    // Incense offering
    if (this.offer && this.offerPlan) {
      const e = serverNow - this.offer.startedAt;
      const { to, back, walk } = this.offerPlan;
      const t1 = RISE, t2 = t1 + walk, t3 = t2 + INCENSE, t4 = t3 + KNEEL, t5 = t4 + BOWS, t6 = t5 + RISE2, t7 = t6 + walk, t8 = t7 + SIT;
      if (e >= 0 && e < Math.min(t8, OFFER_MS + 1500)) {
        p.bow = 0;
        if (e < t1) {
          Object.assign(p, { x: this.home.x, z: this.home.z, kneel: 1 - ease(e / RISE) });
          p.heading = angleLerp(p.heading, 0, dt * 6);
        } else if (e < t2) {
          const a = along(to, ease((e - t1) / walk));
          Object.assign(p, { x: a.x, z: a.z, kneel: 0, walk: e * 0.011 });
          p.heading = angleLerp(p.heading, a.heading, dt * 8);
        } else if (e < t3) {
          const k = (e - t2) / INCENSE;
          p.kneel = 0;
          p.heading = angleLerp(p.heading, 0, dt * 6);
          p.hands = k < 0.2 ? ease(k / 0.2) : k > 0.85 ? 1 - ease((k - 0.85) / 0.15) : 1;
          p.bow = k > 0.3 && k < 0.8 ? Math.sin(((k - 0.3) / 0.5) * Math.PI) * 0.18 : 0;
          this.incense = k < 0.9;
        } else if (e < t4) {
          p.kneel = ease((e - t3) / KNEEL);
          p.heading = 0;
        } else if (e < t5) {
          p.kneel = 1;
          p.bow = bowCurve(((e - t4) % (BOWS / 3)) / (BOWS / 3));
        } else if (e < t6) {
          p.kneel = 1 - ease((e - t5) / RISE2);
        } else if (e < t7) {
          const a = along(back, ease((e - t6) / walk));
          Object.assign(p, { x: a.x, z: a.z, kneel: 0, walk: e * 0.011 });
          p.heading = angleLerp(p.heading, a.heading, dt * 8);
        } else {
          Object.assign(p, { x: this.home.x, z: this.home.z });
          p.heading = angleLerp(p.heading, 0, dt * 8);
          p.kneel = ease((e - t7) / SIT);
        }
        return;
      }
    }

    // Walking somewhere (arriving in the hall, moving to a cushion)
    if (this.move) {
      const k = (now - this.move.start) / this.move.dur;
      if (k < 1) {
        const a = along(this.move.path, ease(k));
        Object.assign(p, { x: a.x, z: a.z, kneel: Math.max(0, p.kneel - dt * 3), bow: 0, walk: now * 0.011 });
        p.heading = angleLerp(p.heading, a.heading, dt * 8);
        return;
      }
      this.move = null;
    }

    // Kneeling at home, bowing now and then
    p.x = this.home.x;
    p.z = this.home.z;
    p.heading = angleLerp(p.heading, 0, dt * 5);
    p.kneel = Math.min(1, p.kneel + dt * 1.6);
    if (now > this.nextBow) {
      this.bowStart = now;
      this.nextBow = now + 7000 + Math.random() * 12000;
    }
    const b = (now - this.bowStart) / 2400;
    p.bow = b >= 0 && b < 1 ? bowCurve(b) * 0.9 : 0;
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
        it.p.set((Math.random() - 0.5) * 9, 8 + Math.random() * 3, -13 + Math.random() * 20);
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
  launch(n: number, now: number) {
    for (let i = 0; i < n; i++) {
      const s = new THREE.Sprite(this.glow);
      s.scale.setScalar(1.7);
      const core = new THREE.Mesh(this.coreGeo, this.coreMat);
      this.group.add(s, core);
      this.items.push({ s, core, t0: now + i * 350, x: (Math.random() - 0.5) * 8, z: -10 + Math.random() * 14, speed: 0.45 + Math.random() * 0.3 });
    }
  }
  update(now: number) {
    this.items = this.items.filter((it) => {
      const a = (now - it.t0) / 1000;
      if (a > 22) {
        this.group.remove(it.s, it.core);
        return false;
      }
      const y = a < 0 ? -5 : 0.6 + a * it.speed;
      const x = it.x + Math.sin(a * 0.6 + it.z) * 0.4;
      it.s.position.set(x, y, it.z);
      it.core.position.set(x, y, it.z);
      return true;
    });
  }
}

class Sparks {
  points: THREE.Points;
  private vel: Float32Array;
  private life: Float32Array;
  constructor(private n = 260) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3).fill(-99), 3));
    this.vel = new Float32Array(n * 3);
    this.life = new Float32Array(n);
    this.points = new THREE.Points(g, new THREE.PointsMaterial({ size: 0.16, map: glowTexture('rgba(255,245,200,1)', 'rgba(255,200,80,0.5)'), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, color: 0xffd27a }));
    this.points.frustumCulled = false;
  }
  burst(origin: THREE.Vector3, count: number, power: number) {
    const pos = this.points.geometry.attributes.position as THREE.BufferAttribute;
    let made = 0;
    for (let i = 0; i < this.n && made < count; i++) {
      if (this.life[i] > 0) continue;
      made++;
      this.life[i] = 1.6 + Math.random() * 1.4;
      pos.setXYZ(i, origin.x, origin.y, origin.z);
      const a = Math.random() * Math.PI * 2;
      const sp = (1 + Math.random() * 2.5) * power;
      this.vel.set([Math.cos(a) * sp, 2 + Math.random() * 3 * power, Math.sin(a) * sp * 0.6 + 0.8], i * 3);
    }
  }
  update(dt: number) {
    const pos = this.points.geometry.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < this.n; i++) {
      if (this.life[i] <= 0) continue;
      this.life[i] -= dt;
      if (this.life[i] <= 0) {
        pos.setXYZ(i, 0, -99, 0);
        continue;
      }
      this.vel[i * 3 + 1] -= dt * 3.2;
      pos.setXYZ(i, pos.getX(i) + this.vel[i * 3] * dt, pos.getY(i) + this.vel[i * 3 + 1] * dt, pos.getZ(i) + this.vel[i * 3 + 2] * dt);
    }
    pos.needsUpdate = true;
  }
}

// ---------- the world ----------

const WIDE_POS = new THREE.Vector3(0, 6.6, 11.6);
const WIDE_LOOK = new THREE.Vector3(0, 2.3, -7.5);

export class World {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(48, 9 / 16, 0.1, 80);
  private composer: EffectComposer | null = null;
  private bloom: UnrealBloomPass | null = null;
  private temple: Temple;
  private crowd = new Crowd(SEAT_COUNT + TOP_CUSHIONS + 12);
  private actors = new Map<string, Actor>();
  private petals = new PetalRain(320);
  private lanterns = new SkyLanterns();
  private sparks = new Sparks();
  private sticks: THREE.Group[] = [];
  private rings: THREE.Mesh[] = [];
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

  constructor(private canvas: HTMLCanvasElement, private labelLayer: HTMLDivElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', alpha: false });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.95;
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.background = new THREE.Color(0x120604);
    this.scene.fog = new THREE.Fog(0x1a0905, 22, 46);
    this.temple = buildTemple(env);
    this.scene.add(this.temple.group, this.crowd.group, this.petals.mesh, this.lanterns.group, this.sparks.points);

    // Incense sticks held by people at the burner (one per spot)
    const stickMat = new THREE.MeshBasicMaterial({ color: 0x7a3418 });
    const tipMat = new THREE.SpriteMaterial({ map: glowTexture('rgba(255,140,80,1)', 'rgba(255,60,20,0.5)'), blending: THREE.AdditiveBlending, depthWrite: false });
    for (let i = 0; i < 6; i++) {
      const g = new THREE.Group();
      const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.42, 4), stickMat);
      stick.position.y = 0.2;
      const tip = new THREE.Sprite(tipMat);
      tip.position.y = 0.42;
      tip.scale.setScalar(0.12);
      g.add(stick, tip);
      g.visible = false;
      this.scene.add(g);
      this.sticks.push(g);
    }

    const ringMat = new THREE.MeshBasicMaterial({ map: ringTexture(), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
    for (let i = 0; i < 6; i++) {
      const r = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), ringMat.clone());
      r.rotation.x = -Math.PI / 2;
      r.visible = false;
      this.scene.add(r);
      this.rings.push(r);
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
      this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), q === 'high' ? 0.42 : 0.35, 0.5, 0.86);
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
    this.temple.setTheme(theme);
    this.scene.background = new THREE.Color(theme === 'night' ? 0x07060c : 0x120604);
    (this.scene.fog as THREE.Fog).color.set(theme === 'night' ? 0x0a0812 : 0x1a0905);
  }

  setPlaque(text: string) {
    if (text === this.plaque) return;
    this.plaque = text;
    // wait for the web font so the plaque uses Lora
    document.fonts?.ready.then(() => this.temple.setPlaque(text));
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

    // TOP board on the cushions (walk over from their seat when they first make the board)
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
      a.setOffer(offers.get(t.id) ?? null);
      const kind = spotId === t.id ? 'spot' : a.offer ? 'offer' : 'top';
      setLabel(a, { name: t.name, avatar: t.avatar, vip: t.coins > 0, kind, rank: i + 1 });
    });

    // The hall: viewers in their seats, everyone else is a quiet background figure
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
      if (who) {
        a.setOffer(offers.get(who.id) ?? null);
        const kind = spotId === who.id ? 'spot' : a.offer ? 'offer' : 'hall';
        setLabel(a, { name: who.name, avatar: who.avatar, vip: who.vip, kind });
      } else setLabel(a, null);
    }

    for (const [key, a] of this.actors) {
      if (!seen.has(key)) {
        a.label?.el.remove();
        this.actors.delete(key);
      }
    }
    this.firstSync = false;
    this.setPlaque(snap.settings.channelName);
  }

  // A chat bubble over the viewer, if they are in the hall
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
    if (name === 'bloom') {
      this.temple.glowAltar(power);
      this.sparks.burst(new THREE.Vector3(0, 4.5, -14.5), Math.round(40 + power * 50), 0.8 + power * 0.4);
      this.petals.spawn(Math.round(10 + power * 18), true, new THREE.Vector3(0, 3.2, -12));
    } else if (name === 'lanterns') {
      this.lanterns.launch(Math.round(6 + power * 4), now);
    } else if (name === 'rain') {
      this.petals.spawn(40);
    } else if (name === 'gong') {
      this.sparks.burst(this.temple.burnerTip, 14, 0.4);
    } else if (name === 'bell') {
      this.temple.glowAltar(0.6);
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
    let stick = 0;
    const tmp = new THREE.Vector3();
    for (const a of this.actors.values()) {
      if (i >= this.crowd.max) break;
      a.update(nowP, serverNow, dt);
      this.crowd.setLook(i, a.look);
      this.crowd.write(i, a.pose);
      if (a.incense && stick < this.sticks.length) {
        const s = this.sticks[stick++];
        s.visible = true;
        s.position.copy(handsPosition(a.pose, tmp));
        s.rotation.set(-0.15 - a.pose.bow * 1.2, a.pose.heading, 0);
      }
      i++;
    }
    for (; stick < this.sticks.length; stick++) this.sticks[stick].visible = false;
    this.crowd.commit(i);

    // Golden rings of light on the floor under whoever is offering incense or in the spotlight
    const spot = this.snap?.spotlight;
    let ring = 0;
    for (const a of this.actors.values()) {
      if (ring >= this.rings.length) break;
      const isSpot = !!spot && a.viewerId === spot.viewerId;
      if (!isSpot && !a.offer) continue;
      const r = this.rings[ring++];
      r.visible = true;
      r.position.set(a.pose.x, 0.02, a.pose.z);
      const pulse = 1 + Math.sin(t * 3 + ring) * 0.08;
      r.scale.setScalar((isSpot ? 1.7 : 1.15) * pulse);
      (r.material as THREE.MeshBasicMaterial).opacity = isSpot ? 0.95 : 0.6;
    }
    for (; ring < this.rings.length; ring++) this.rings[ring].visible = false;

    // Flower rain runs on the server clock, so it stops on time even when nothing else changes
    this.petals.rate = this.snap && this.snap.likes.rainUntil > serverNow ? 14 : 0;

    // Camera: wide shot with a slow drift, or a close-up that follows the gift giver
    let targetPos = WIDE_POS.clone().add(new THREE.Vector3(Math.sin(t * 0.06) * 0.5, Math.sin(t * 0.09) * 0.2, 0));
    let targetLook = WIDE_LOOK.clone().add(new THREE.Vector3(Math.sin(t * 0.06) * 0.25, 0, 0));
    if (spot && serverNow - spot.startedAt < spot.durationMs - 600) {
      const actor = [...this.actors.values()].find((a) => a.viewerId === spot.viewerId);
      if (actor) {
        const head = headPosition(actor.pose, new THREE.Vector3());
        targetLook = head.clone().add(new THREE.Vector3(0, 1.0, -4.5));
        targetPos = head.clone().add(new THREE.Vector3(1.0 + Math.sin(t * 0.3) * 0.4, 2.6, 7.6));
      } else {
        targetLook = new THREE.Vector3(0, 3.6, -14);
        targetPos = new THREE.Vector3(0, 4.2, -5.5);
      }
    }
    const k = 1 - Math.exp(-dt * (spot ? 1.6 : 1.0));
    this.camPos.lerp(targetPos, k);
    this.camLook.lerp(targetLook, k);
    this.camera.position.copy(this.camPos);
    this.camera.lookAt(this.camLook);

    // Effects
    this.temple.update(t, dt);
    this.petals.update(t, dt);
    this.lanterns.update(nowP);
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
      const dist = v.distanceTo(this.camera.position);
      v.project(this.camera);
      // During a close-up only the gift giver and people at the burner keep their name plates
      const quiet = closeUp && (a.label.data.kind === 'hall' || a.label.data.kind === 'top');
      const visible = !quiet && v.z < 1 && Math.abs(v.x) < 1.1 && v.y > -1.1 && v.y < 1.1;
      const x = (v.x * 0.5 + 0.5) * w;
      const y = (-v.y * 0.5 + 0.5) * h;
      const kind = a.label.data.kind;
      const base = kind === 'hall' ? 11 : kind === 'top' ? 10 : 12;
      const scale = Math.min(kind === 'spot' ? 1.8 : 1.35, Math.max(0.55, base / dist));
      const z = kind === 'spot' ? 1000 : kind === 'offer' ? 900 : a.label.talking ? 800 : Math.round(500 - dist * 10);
      a.label.place(x, y, scale, visible, z);
    }
  }
}
