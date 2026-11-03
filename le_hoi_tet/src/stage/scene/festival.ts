import * as THREE from 'three';
import * as T from './textures';
import { Crowd, HAIRS, SKINS, newPose, type Look, type Pose } from './people';

// The village square on Tết, built from primitives and canvas textures: a two-tiered village gate with a
// banner and couplets, a cây nêu, peach and apricot trees, market stalls with their goods and vendors,
// the calligrapher at his low table, a bamboo swing and a còn pole with players, strings of lanterns and
// flags over the street. The street runs along -z from the camera to the gate.

export const GATE_Z = -14.5;
export const ODO = { table: { x: -2.75, z: -8.6 }, seat: { x: -3.35, z: -8.6 } }; // the calligrapher
export const PAD = { x: 2.85, z: -8.6 }; // where fireworks go up from
export const DAIS = { z0: -12.9, z1: -10.6 }; // the red platform in front of the gate (TOP board)

export type Theme = 'dusk' | 'night';

export type Festival = {
  group: THREE.Group;
  extras: Crowd; // calligrapher, swing, còn players, vendors
  update: (t: number, dt: number) => void;
  setTheme: (theme: Theme) => void;
  setPlaque: (text: string) => void;
  flare: (power: number) => void; // a gift: the gate lights up, firecrackers go off
  launchPoint: THREE.Vector3;
  gateCenter: THREE.Vector3;
  crackle: (power: number) => void;
  onCrackle: (pos: THREE.Vector3) => void; // set by the world: a flash at a firecracker
  onConScore: (pos: THREE.Vector3) => void; // the còn ball went through the ring
  flashSky: (color: THREE.Color, strength: number) => void; // a firework lights up the night sky
  setShadows: (on: boolean) => void; // real sun shadows (high quality only)
};

const lathe = (pts: Array<[number, number]>, seg = 20) => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), seg);
const rand = (a: number, b: number) => a + Math.random() * (b - a);

// A curved roof: a box with its ends swept up (mái cong)
function roofGeometry(w: number, d: number, h: number, curl: number) {
  const g = new THREE.BoxGeometry(w, h, d, 16, 1, 2);
  const p = g.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i) / (w / 2); // -1..1
    p.setY(i, p.getY(i) + Math.pow(Math.abs(x), 3) * curl);
  }
  g.computeVertexNormals();
  return g;
}

// A sloped two-sided roof (the ridge along x)
function pitchedRoof(w: number, d: number, rise: number, mat: THREE.Material, curl = 0.25) {
  const grp = new THREE.Group();
  for (const s of [-1, 1]) {
    const slab = new THREE.Mesh(roofGeometry(w, d / 2 + 0.15, 0.08, curl), mat);
    slab.position.set(0, rise / 2, (s * d) / 4);
    slab.rotation.x = s * Math.atan2(rise, d / 2);
    grp.add(slab);
  }
  return grp;
}

export function buildFestival(): Festival {
  const group = new THREE.Group();
  const updaters: Array<(t: number, dt: number) => void> = [];

  // ---------- materials ----------
  const wood = new THREE.MeshStandardMaterial({ color: 0x6b3b1f, roughness: 0.75 });
  const darkWood = new THREE.MeshStandardMaterial({ color: 0x3d2414, roughness: 0.8 });
  const lacquer = new THREE.MeshStandardMaterial({ color: 0xb01a17, roughness: 0.4 });
  const gold = new THREE.MeshStandardMaterial({ color: 0xe0aa3a, metalness: 0.8, roughness: 0.3, emissive: 0x3a2205 });
  const stone = new THREE.MeshStandardMaterial({ color: 0x8b8378, roughness: 0.9 });
  const bamboo = new THREE.MeshStandardMaterial({ color: 0x9c9a4a, roughness: 0.7 });
  const leafGreen = new THREE.MeshStandardMaterial({ color: 0x3f8a3a, roughness: 0.75 });
  const tileTex = T.tileTexture();
  tileTex.repeat.set(6, 2);
  const tiles = new THREE.MeshStandardMaterial({ map: tileTex, roughness: 0.8 });
  const cloth = new THREE.MeshStandardMaterial({ color: 0xc3161c, roughness: 0.9 });
  const lanternMat = new THREE.MeshStandardMaterial({ color: 0xe0201d, emissive: 0xff3a10, emissiveIntensity: 0.5, roughness: 0.55 });
  const lanternGlow = new THREE.SpriteMaterial({ map: T.glowTexture('rgba(255,200,130,0.9)', 'rgba(255,80,30,0.3)'), blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.4 });

  // ---------- sky and the village beyond ----------
  const skyMat = new THREE.MeshBasicMaterial({ map: T.skyTexture('dusk'), fog: false, depthWrite: false, toneMapped: false });
  const sky = new THREE.Mesh(new THREE.PlaneGeometry(140, 80), skyMat);
  sky.position.set(0, 12, -60);
  sky.renderOrder = -10;
  group.add(sky);
  const villageMat = new THREE.MeshBasicMaterial({ map: T.villageTexture('dusk'), transparent: true, fog: false, depthWrite: false, toneMapped: false });
  const village = new THREE.Mesh(new THREE.PlaneGeometry(90, 22), villageMat);
  village.position.set(0, 6, -42);
  village.renderOrder = -9;
  group.add(village);

  // ---------- ground ----------
  // brick square up to the gate, fields beyond it
  const groundTex = T.groundTexture();
  groundTex.repeat.set(6, 7);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(40, 42), new THREE.MeshStandardMaterial({ map: groundTex, roughness: 0.92 }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.z = 4.5;
  group.add(ground);
  const carpetTex = T.carpetTexture();
  carpetTex.repeat.set(1, 6);
  const carpet = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 24), new THREE.MeshStandardMaterial({ map: carpetTex, roughness: 0.95 }));
  carpet.rotation.x = -Math.PI / 2;
  carpet.position.set(0, 0.01, -0.5);
  group.add(carpet);
  // grass beyond the square
  const grass = new THREE.Mesh(new THREE.PlaneGeometry(140, 70), new THREE.MeshStandardMaterial({ color: 0x6f9a4a, roughness: 1 }));
  grass.rotation.x = -Math.PI / 2;
  grass.position.set(0, -0.01, -51);
  group.add(grass);

  // ---------- the village gate ----------
  const gate = new THREE.Group();
  gate.position.z = GATE_Z;
  group.add(gate);
  const pillar = new THREE.BoxGeometry(0.5, 4.6, 0.5);
  const smallPillar = new THREE.BoxGeometry(0.4, 3.2, 0.4);
  for (const x of [-2.2, 2.2]) {
    const p = new THREE.Mesh(pillar, lacquer);
    p.position.set(x, 2.3, 0);
    gate.add(p);
    const cap = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.18, 0.62), gold);
    cap.position.set(x, 0.09, 0);
    gate.add(cap);
  }
  for (const x of [-3.9, 3.9]) {
    const p = new THREE.Mesh(smallPillar, lacquer);
    p.position.set(x, 1.6, 0);
    gate.add(p);
    const roof = pitchedRoof(1.6, 1.1, 0.35, tiles, 0.18);
    roof.position.set(x * 0.92, 3.25, 0);
    gate.add(roof);
  }
  // side walls between the pillars
  for (const s of [-1, 1]) {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(1.3, 2.4, 0.3), new THREE.MeshStandardMaterial({ color: 0xe8dcc0, roughness: 0.9 }));
    wall.position.set(s * 3.05, 1.2, 0);
    gate.add(wall);
    const cpl = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 2.0), new THREE.MeshBasicMaterial({ map: T.coupletTexture(s < 0 ? ['Phúc', 'Lộc', 'Đầy', 'Nhà'] : ['An', 'Khang', 'Thịnh', 'Vượng']) }));
    cpl.position.set(s * 2.2, 2.3, 0.26);
    gate.add(cpl);
  }
  // beam, banner, name board, two-tier roof
  const beam = new THREE.Mesh(new THREE.BoxGeometry(5.0, 0.34, 0.44), lacquer);
  beam.position.set(0, 4.3, 0);
  gate.add(beam);
  const banner = new THREE.Mesh(new THREE.PlaneGeometry(4.0, 0.62), new THREE.MeshBasicMaterial({ map: T.bannerTexture('CHÚC MỪNG NĂM MỚI'), side: THREE.DoubleSide }));
  banner.position.set(0, 3.7, 0.3);
  gate.add(banner);
  const plaqueMat = new THREE.MeshBasicMaterial({ map: T.plaqueTexture('HỘI XUÂN') });
  const plaque = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.52), plaqueMat);
  plaque.position.set(0, 5.0, 0.12);
  gate.add(plaque);
  const roof1 = pitchedRoof(5.8, 1.5, 0.45, tiles, 0.35);
  roof1.position.set(0, 4.5, 0);
  gate.add(roof1);
  const upper = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.7, 0.6), lacquer);
  upper.position.set(0, 5.05, -0.1);
  gate.add(upper);
  const roof2 = pitchedRoof(3.8, 1.2, 0.4, tiles, 0.4);
  roof2.position.set(0, 5.45, -0.1);
  gate.add(roof2);
  // dragon-ish ridge ornaments: gold balls on the roof ends
  for (const x of [-2.9, 2.9, -1.9, 1.9]) {
    const orb = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 10), gold);
    orb.position.set(x, x > 2 || x < -2 ? 5.35 : 6.25, -0.1);
    gate.add(orb);
  }
  const pearl = new THREE.Mesh(new THREE.SphereGeometry(0.16, 16, 12), gold);
  pearl.position.set(0, 6.1, -0.1);
  gate.add(pearl);

  // ---------- lanterns (shared shape) ----------
  const lanternGeo = new THREE.SphereGeometry(0.2, 16, 12);
  const glows: THREE.Sprite[] = [];
  const makeLantern = (scale = 1) => {
    const l = new THREE.Group();
    const body = new THREE.Mesh(lanternGeo, lanternMat);
    body.scale.set(1, 1.15, 1);
    l.add(body);
    for (const y of [-0.24, 0.24]) {
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.05, 10), gold);
      cap.position.y = y;
      l.add(cap);
    }
    const tassel = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.22, 6), new THREE.MeshStandardMaterial({ color: 0xf2c14e }));
    tassel.position.y = -0.38;
    tassel.rotation.x = Math.PI;
    l.add(tassel);
    const glow = new THREE.Sprite(lanternGlow);
    glow.scale.setScalar(1.3);
    l.add(glow);
    glows.push(glow);
    l.scale.setScalar(scale);
    return l;
  };
  const gateLanterns: THREE.Group[] = [];
  for (const x of [-1.5, -0.5, 0.5, 1.5]) {
    const l = makeLantern(1.15);
    l.position.set(x, 3.15, GATE_Z + 0.35);
    group.add(l);
    gateLanterns.push(l);
  }

  // ---------- firecracker strings on the gate pillars ----------
  const crackerGeo = new THREE.CylinderGeometry(0.035, 0.035, 0.12, 8);
  const crackerMat = new THREE.MeshStandardMaterial({ color: 0xd8161b, roughness: 0.5, emissive: 0x2a0000 });
  const crackers: THREE.Vector3[] = [];
  const crackerMesh = new THREE.InstancedMesh(crackerGeo, crackerMat, 2 * 2 * 16);
  let ci = 0;
  const cm = new THREE.Matrix4();
  for (const x of [-2.2, 2.2]) {
    for (let k = 0; k < 16; k++) {
      for (const side of [-1, 1]) {
        const pos = new THREE.Vector3(x + side * 0.07 + (x < 0 ? 0.32 : -0.32), 3.9 - k * 0.15, GATE_Z + 0.32);
        cm.compose(pos, new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, side * 0.9)), new THREE.Vector3(1, 1, 1));
        crackerMesh.setMatrixAt(ci++, cm);
        if (side > 0) crackers.push(pos);
      }
    }
  }
  group.add(crackerMesh);
  let crackleUntil = 0;
  let crackleNext = 0;

  // ---------- the TOP dais in front of the gate ----------
  const dais = new THREE.Mesh(new THREE.BoxGeometry(6.6, 0.16, DAIS.z1 - DAIS.z0), cloth);
  dais.position.set(0, 0.08, (DAIS.z0 + DAIS.z1) / 2);
  group.add(dais);
  const daisTrim = new THREE.Mesh(new THREE.BoxGeometry(6.7, 0.05, 0.06), gold);
  daisTrim.position.set(0, 0.16, DAIS.z1);
  group.add(daisTrim);

  // ---------- cây nêu ----------
  const neu = new THREE.Group();
  neu.position.set(-3.5, 0, GATE_Z + 0.9);
  group.add(neu);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.08, 8, 8), bamboo);
  pole.position.y = 4;
  neu.add(pole);
  for (let i = 0; i < 6; i++) {
    const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.9, 5), leafGreen);
    leaf.position.set(Math.cos(i) * 0.25, 7.9, Math.sin(i) * 0.25);
    leaf.rotation.set(Math.cos(i) * 0.9, 0, Math.sin(i) * 0.9);
    neu.add(leaf);
  }
  const streamer = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 2.2, 1, 10), new THREE.MeshStandardMaterial({ color: 0xd8161b, side: THREE.DoubleSide, emissive: 0x220000 }));
  streamer.position.set(0.12, 6.4, 0);
  neu.add(streamer);
  const neuBells = makeLantern(0.6);
  neuBells.position.set(-0.05, 7.1, 0.05);
  neu.add(neuBells);

  // ---------- trees: peach (đào) and apricot (mai) ----------
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x4a2c1c, roughness: 0.9 });
  const blossomGeo = new THREE.PlaneGeometry(0.16, 0.16);
  const daoMat = new THREE.MeshStandardMaterial({ map: T.blossomTexture('dao'), transparent: true, alphaTest: 0.3, side: THREE.DoubleSide, emissive: 0x3a0f1c, roughness: 0.8 });
  const maiMat = new THREE.MeshStandardMaterial({ map: T.blossomTexture('mai'), transparent: true, alphaTest: 0.3, side: THREE.DoubleSide, emissive: 0x3a2a00, roughness: 0.8 });
  const blossoms = { dao: [] as THREE.Matrix4[], mai: [] as THREE.Matrix4[] };
  const branchTips: Array<{ p: THREE.Vector3; kind: 'dao' | 'mai' }> = [];
  // a gnarled trunk with branches; collects the branch tips where blossoms go
  const tree = (x: number, z: number, h: number, kind: 'dao' | 'mai', spread = 1.6) => {
    const base = new THREE.Vector3(x, 0, z);
    const grow = (from: THREE.Vector3, dir: THREE.Vector3, len: number, r: number, depth: number) => {
      const to = from.clone().addScaledVector(dir, len);
      const seg = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.7, r, len, 6), trunkMat);
      seg.position.copy(from).add(to).multiplyScalar(0.5);
      seg.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
      group.add(seg);
      if (depth === 0) {
        branchTips.push({ p: to, kind });
        return;
      }
      const n = depth > 1 ? 3 : 2;
      for (let i = 0; i < n; i++) {
        const d = dir.clone().add(new THREE.Vector3(rand(-1, 1) * spread * 0.5, rand(0.2, 0.8), rand(-1, 1) * spread * 0.35)).normalize();
        grow(to, d, len * rand(0.6, 0.8), r * 0.65, depth - 1);
      }
      if (depth <= 2) branchTips.push({ p: to, kind });
    };
    grow(base, new THREE.Vector3(rand(-0.15, 0.15), 1, 0).normalize(), h * 0.38, 0.14 * (h / 4), 3);
  };
  tree(-6.3, -14.4, 4.8, 'dao', 1.8);
  tree(6.3, -14.4, 4.4, 'mai', 1.8);
  tree(-6.7, -9.4, 4.0, 'dao');
  tree(6.8, -8.8, 3.8, 'dao');
  tree(-6.4, -0.5, 3.4, 'mai');
  tree(6.5, -0.2, 3.4, 'dao');
  const bq = new THREE.Quaternion();
  for (const tip of branchTips) {
    const n = tip.kind === 'dao' ? 34 : 30;
    for (let i = 0; i < n; i++) {
      const p = tip.p.clone().add(new THREE.Vector3(rand(-0.55, 0.55), rand(-0.4, 0.45), rand(-0.45, 0.45)));
      bq.setFromEuler(new THREE.Euler(rand(0, 6), rand(0, 6), rand(0, 6)));
      blossoms[tip.kind].push(new THREE.Matrix4().compose(p, bq, new THREE.Vector3(1, 1, 1).multiplyScalar(rand(0.8, 1.35))));
    }
  }
  for (const kind of ['dao', 'mai'] as const) {
    const mesh = new THREE.InstancedMesh(blossomGeo, kind === 'dao' ? daoMat : maiMat, blossoms[kind].length);
    blossoms[kind].forEach((mx, i) => mesh.setMatrixAt(i, mx));
    group.add(mesh);
  }

  // potted kumquat (quất) and apricot by the gate and along the stalls
  const potMat = new THREE.MeshStandardMaterial({ color: 0x9a3b1c, roughness: 0.7 });
  const fruitMat = new THREE.MeshStandardMaterial({ color: 0xff8c1a, roughness: 0.4, emissive: 0x401800 });
  const quat = (x: number, z: number, s = 1) => {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    g.scale.setScalar(s);
    const pot = new THREE.Mesh(lathe([[0, 0], [0.22, 0], [0.3, 0.35], [0.32, 0.4], [0, 0.4]], 16), potMat);
    g.add(pot);
    const bush = new THREE.Mesh(new THREE.SphereGeometry(0.45, 14, 12), leafGreen);
    bush.scale.set(1, 1.2, 1);
    bush.position.y = 0.95;
    g.add(bush);
    for (let i = 0; i < 26; i++) {
      const f = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), fruitMat);
      const a = rand(0, Math.PI * 2);
      const b = rand(-1, 1);
      f.position.set(Math.cos(a) * 0.46 * Math.sqrt(1 - b * b), 0.95 + b * 0.52, Math.sin(a) * 0.46 * Math.sqrt(1 - b * b));
      g.add(f);
    }
    group.add(g);
  };
  quat(-1.55, GATE_Z + 0.9);
  quat(1.55, GATE_Z + 0.9);
  quat(-2.9, -3.7, 0.8);
  quat(2.9, -3.7, 0.8);

  // ---------- market stalls with vendors ----------
  const extras = new Crowd(16);
  type Extra = { pose: Pose; look: Look; tick: (t: number) => void };
  const extraList: Extra[] = [];
  const vendorLook = (seed: number): Look => ({
    robe: new THREE.Color(['#4a6fa5', '#7a4a8c', '#a5532a', '#3d7a58', '#8c2a35', '#5a5a7a'][seed % 6]),
    pants: new THREE.Color(seed % 2 ? '#1c1a22' : '#f5f1e8'),
    skin: new THREE.Color(SKINS[seed % SKINS.length]),
    hair: new THREE.Color(HAIRS[seed % HAIRS.length]),
    headwear: new THREE.Color(['#d4161d', '#1c2a5a', '#7a1416'][seed % 3]),
    female: seed % 3 !== 1,
    bare: seed % 4 === 3,
  });

  const goods = {
    banhchung: (g: THREE.Group) => {
      const tex = T.banhChungTexture();
      const m = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.8 });
      for (let i = 0; i < 9; i++) {
        const b = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.12, 0.26), m);
        b.position.set(-0.7 + (i % 3) * 0.3 + (Math.floor(i / 3) % 2) * 0.1, 0.06 + Math.floor(i / 3) * 0.12, (Math.floor(i / 3) % 2) * 0.05 - 0.05 + (i % 2) * 0.02);
        g.add(b);
      }
      for (let i = 0; i < 5; i++) {
        const b = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.11, 0.24), m);
        b.position.set(0.35 + (i % 3) * 0.28, 0.055 + Math.floor(i / 3) * 0.11, 0);
        g.add(b);
      }
    },
    caudoi: (g: THREE.Group) => {
      const words = [['Xuân', 'An', 'Khang'], ['Phúc', 'Mãn', 'Đường'], ['Tấn', 'Tài', 'Lộc'], ['Vạn', 'Sự', 'Như', 'Ý']];
      words.forEach((w, i) => {
        const p = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.95), new THREE.MeshBasicMaterial({ map: T.coupletTexture(w), side: THREE.DoubleSide }));
        p.position.set(-0.75 + i * 0.5, 0.85, 0.25);
        g.add(p);
      });
      for (let i = 0; i < 4; i++) {
        const roll = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.5, 8), cloth);
        roll.rotation.z = Math.PI / 2;
        roll.position.set(-0.5 + i * 0.32, 0.04, 0);
        g.add(roll);
      }
    },
    mut: (g: THREE.Group) => {
      const colors = [0xffd23f, 0xe8487d, 0x7fbf4a, 0xff8c1a, 0xf5f1e8];
      for (let i = 0; i < 4; i++) {
        const box = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.08, 8), lacquer);
        box.position.set(-0.75 + i * 0.5, 0.04, 0);
        g.add(box);
        for (let k = 0; k < 8; k++) {
          const c = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.04, 0.06), new THREE.MeshStandardMaterial({ color: colors[(i + k) % colors.length], roughness: 0.5 }));
          const a = (k / 8) * Math.PI * 2;
          c.position.set(-0.75 + i * 0.5 + Math.cos(a) * 0.11, 0.1, Math.sin(a) * 0.11);
          g.add(c);
        }
      }
    },
    hoa: (g: THREE.Group) => {
      for (let i = 0; i < 4; i++) {
        const pot = new THREE.Mesh(lathe([[0, 0], [0.09, 0], [0.12, 0.16], [0, 0.16]], 12), potMat);
        pot.position.set(-0.75 + i * 0.5, 0, 0);
        g.add(pot);
        const mat = i % 2 ? maiMat : daoMat;
        for (let k = 0; k < 22; k++) {
          const b = new THREE.Mesh(blossomGeo, mat);
          b.position.set(-0.75 + i * 0.5 + rand(-0.17, 0.17), rand(0.25, 0.6), rand(-0.12, 0.12));
          b.rotation.set(rand(0, 6), rand(0, 6), 0);
          b.scale.setScalar(0.75);
          g.add(b);
        }
        const twig = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.015, 0.45, 5), trunkMat);
        twig.position.set(-0.75 + i * 0.5, 0.36, 0);
        g.add(twig);
      }
    },
    denlong: (g: THREE.Group) => {
      for (let i = 0; i < 5; i++) {
        const l = makeLantern(0.55);
        l.position.set(-0.8 + i * 0.4, 0.85, 0.25);
        g.add(l);
      }
      for (let i = 0; i < 3; i++) {
        const l = makeLantern(0.45);
        l.position.set(-0.5 + i * 0.5, 0.15, 0);
        g.add(l);
      }
    },
    duahau: (g: THREE.Group) => {
      const rind = new THREE.MeshStandardMaterial({ map: T.watermelonTexture(), roughness: 0.5 });
      const flesh = new THREE.MeshStandardMaterial({ color: 0xe53935, roughness: 0.6 });
      for (let i = 0; i < 7; i++) {
        const w = new THREE.Mesh(new THREE.SphereGeometry(0.15, 14, 10), rind);
        w.scale.set(1.25, 1, 1);
        w.position.set(-0.7 + (i % 4) * 0.36, 0.15 + Math.floor(i / 4) * 0.22, Math.floor(i / 4) * -0.05);
        g.add(w);
      }
      const half = new THREE.Mesh(new THREE.SphereGeometry(0.15, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2), rind);
      half.position.set(0.75, 0.0, 0.05);
      half.rotation.x = Math.PI;
      g.add(half);
      const cut = new THREE.Mesh(new THREE.CircleGeometry(0.15, 16), flesh);
      cut.rotation.x = -Math.PI / 2;
      cut.position.set(0.75, 0.005, 0.05);
      g.add(cut);
    },
  };
  type GoodsKind = keyof typeof goods;
  const SIGNS: Record<GoodsKind, string> = { banhchung: 'BÁNH CHƯNG', caudoi: 'CÂU ĐỐI', mut: 'MỨT TẾT', hoa: 'HOA TẾT', denlong: 'ĐÈN LỒNG', duahau: 'DƯA HẤU' };
  const awnings = [T.awningTexture('#d8161b', '#f6e7c8'), T.awningTexture('#f2b705', '#d8161b'), T.awningTexture('#2e7d4f', '#f6e7c8')];

  const stall = (x: number, z: number, kind: GoodsKind, seed: number) => {
    const side = Math.sign(x); // the counter faces the street
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    g.rotation.y = side < 0 ? -Math.PI / 2 : Math.PI / 2; // local -z toward the street
    group.add(g);
    const counter = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.75, 0.7), wood);
    counter.position.y = 0.375;
    g.add(counter);
    const front = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 0.55), new THREE.MeshStandardMaterial({ color: 0xc3161c, roughness: 0.9 }));
    front.position.set(0, 0.42, -0.36);
    front.rotation.y = Math.PI;
    g.add(front);
    for (const px of [-1.05, 1.05]) {
      for (const pz of [-0.4, 0.6]) {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 2.3, 6), darkWood);
        post.position.set(px, 1.15, pz);
        g.add(post);
      }
    }
    const awn = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.3), new THREE.MeshStandardMaterial({ map: awnings[seed % 3], transparent: true, alphaTest: 0.4, side: THREE.DoubleSide, roughness: 0.9 }));
    awn.position.set(0, 2.15, 0.05);
    awn.rotation.x = Math.PI / 2 - 0.42;
    g.add(awn);
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 0.32), new THREE.MeshBasicMaterial({ map: T.signTexture(SIGNS[kind]) }));
    sign.position.set(0, 2.5, -0.62);
    sign.rotation.y = Math.PI;
    sign.rotation.x = 0.1;
    g.add(sign);
    const shelf = new THREE.Group();
    shelf.position.set(0, 0.76, -0.05);
    shelf.rotation.y = Math.PI; // goods face the street
    g.add(shelf);
    goods[kind](shelf);
    // the vendor behind the counter
    const look = vendorLook(seed);
    const pose = newPose(0, 0);
    const wp = new THREE.Vector3(0, 0, 0.75).applyMatrix4(new THREE.Matrix4().compose(g.position, g.quaternion, g.scale));
    pose.x = wp.x;
    pose.z = wp.z;
    pose.heading = g.rotation.y;
    const phase = seed * 1.7;
    extraList.push({
      pose,
      look,
      tick: (t) => {
        // now and then beckon to the passers-by, otherwise a little sway
        const k = (t * 0.25 + phase) % 6;
        pose.hands = k < 1 ? Math.sin(k * Math.PI) * 0.55 : 0;
        pose.bow = k < 1 ? Math.sin(k * Math.PI) * 0.15 : Math.sin(t * 0.8 + phase) * 0.03;
      },
    });
  };
  stall(-4.0, -5.4, 'caudoi', 0);
  stall(-4.2, -2.0, 'banhchung', 1);
  stall(-4.4, 1.4, 'mut', 2);
  stall(4.0, -5.4, 'hoa', 3);
  stall(4.2, -2.0, 'denlong', 4);
  stall(4.4, 1.4, 'duahau', 5);

  // ---------- the calligrapher (ông đồ) ----------
  const table = new THREE.Group();
  table.position.set(ODO.table.x, 0, ODO.table.z);
  group.add(table);
  const top = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.06, 1.3), darkWood);
  top.position.y = 0.36;
  table.add(top);
  for (const lx of [-0.3, 0.3]) {
    for (const lz of [-0.58, 0.58]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.34, 0.06), darkWood);
      leg.position.set(lx, 0.17, lz);
      table.add(leg);
    }
  }
  const paper = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.6), new THREE.MeshBasicMaterial({ map: T.scrollTexture('Phúc') }));
  paper.rotation.x = -Math.PI / 2;
  paper.rotation.z = Math.PI / 2;
  paper.position.set(0.05, 0.395, 0);
  table.add(paper);
  const ink = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 0.05, 12), new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.3 }));
  ink.position.set(-0.15, 0.415, 0.45);
  table.add(ink);
  // a rack of finished words behind him
  const rack = new THREE.Group();
  rack.position.set(ODO.seat.x - 0.75, 0, ODO.seat.z);
  group.add(rack);
  const rackBar = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 2.2, 6), bamboo);
  rackBar.rotation.x = Math.PI / 2;
  rackBar.position.y = 2.05;
  rack.add(rackBar);
  for (const pz of [-1.1, 1.1]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 2.1, 6), bamboo);
    post.position.set(0, 1.05, pz);
    rack.add(post);
  }
  ['Phúc', 'Lộc', 'Thọ', 'An'].forEach((w, i) => {
    const s = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.68), new THREE.MeshBasicMaterial({ map: T.scrollTexture(w), side: THREE.DoubleSide }));
    s.position.set(0.02, 1.6, -0.78 + i * 0.52);
    s.rotation.y = Math.PI / 2;
    rack.add(s);
  });
  const odoPose = newPose(ODO.seat.x, ODO.seat.z);
  odoPose.heading = -Math.PI / 2; // facing +x, toward the table and the street
  odoPose.kneel = 1;
  extraList.push({
    pose: odoPose,
    look: { robe: new THREE.Color('#1d2f5e'), pants: new THREE.Color('#f5f1e8'), skin: new THREE.Color('#e3b48c'), hair: new THREE.Color('#d8d4cc'), headwear: new THREE.Color('#141414'), female: false, bare: false },
    tick: (t) => {
      // writing: leaning over the paper, the brush hand moving
      odoPose.bow = 0.32 + Math.sin(t * 1.3) * 0.04;
      odoPose.reach = 0.55 + Math.sin(t * 2.6) * 0.15;
    },
  });

  // ---------- bamboo swing (đánh đu) ----------
  const SWING = { x: -4.9, z: -11.6, top: 4.5, len: 3.6 };
  for (const s of [-1, 1]) {
    for (const lean of [-1, 1]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 4.8, 6), bamboo);
      leg.position.set(SWING.x + lean * 0.7, 2.35, SWING.z + s * 0.75);
      leg.rotation.z = lean * -0.16;
      group.add(leg);
    }
  }
  const crossbar = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.8, 6), bamboo);
  crossbar.rotation.x = Math.PI / 2;
  crossbar.position.set(SWING.x, SWING.top, SWING.z);
  group.add(crossbar);
  const swingArm = new THREE.Group();
  swingArm.position.set(SWING.x, SWING.top, SWING.z);
  group.add(swingArm);
  for (const s of [-0.3, 0.3]) {
    const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, SWING.len, 4), bamboo);
    rope.position.set(0, -SWING.len / 2, s);
    swingArm.add(rope);
  }
  const plank = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.05, 0.7), wood);
  plank.position.set(0, -SWING.len, 0);
  swingArm.add(plank);
  const swingPose = newPose(SWING.x, SWING.z);
  swingPose.heading = -Math.PI / 2;
  swingPose.hands = 0.85;
  extraList.push({
    pose: swingPose,
    look: { robe: new THREE.Color('#e8487d'), pants: new THREE.Color('#f5f1e8'), skin: new THREE.Color('#f3d1b3'), hair: new THREE.Color('#16110d'), headwear: new THREE.Color('#f2b705'), female: true, bare: false },
    tick: (t) => {
      const a = Math.sin(t * 1.25) * 0.75;
      swingArm.rotation.z = a;
      swingPose.x = SWING.x + Math.sin(a) * SWING.len;
      swingPose.y = SWING.top - Math.cos(a) * SWING.len + 0.03;
      swingPose.z = SWING.z;
      swingPose.bow = -a * 0.25;
    },
  });

  // ---------- the còn pole and players ----------
  const CON = { x: 4.9, z: -12.4, h: 6.2 };
  const conPole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.08, CON.h, 8), bamboo);
  conPole.position.set(CON.x, CON.h / 2, CON.z);
  group.add(conPole);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.04, 8, 24), new THREE.MeshStandardMaterial({ color: 0xf2b705, emissive: 0x3a2a00 }));
  ring.position.set(CON.x, CON.h - 0.15, CON.z + 0.02);
  group.add(ring);
  const ringPaper = new THREE.Mesh(new THREE.CircleGeometry(0.38, 24), new THREE.MeshStandardMaterial({ color: 0xd8161b, side: THREE.DoubleSide, transparent: true, opacity: 0.85 }));
  ringPaper.position.copy(ring.position);
  group.add(ringPaper);
  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 10), new THREE.MeshStandardMaterial({ color: 0xe8487d, emissive: 0x220010 }));
  group.add(ball);
  const tails = Array.from({ length: 4 }, (_, i) => {
    const t = new THREE.Mesh(new THREE.SphereGeometry(0.035, 6, 4), new THREE.MeshStandardMaterial({ color: [0xf2b705, 0x2e9e5b, 0x1f6fd1, 0xffffff][i] }));
    group.add(t);
    return t;
  });
  const thrower = newPose(4.1, -10.0);
  thrower.heading = Math.atan2(-(CON.x - thrower.x), -(CON.z - thrower.z));
  extraList.push({ pose: thrower, look: { robe: new THREE.Color('#2e9e5b'), pants: new THREE.Color('#f5f1e8'), skin: new THREE.Color('#efc39f'), hair: new THREE.Color('#1f1712'), headwear: new THREE.Color('#d4161d'), female: false, bare: false }, tick: () => {} });
  const catcher = newPose(5.6, -10.6);
  catcher.heading = Math.atan2(-(CON.x - catcher.x), -(CON.z - catcher.z));
  extraList.push({ pose: catcher, look: { robe: new THREE.Color('#f2b705'), pants: new THREE.Color('#f5f1e8'), skin: new THREE.Color('#f3d1b3'), hair: new THREE.Color('#16110d'), headwear: new THREE.Color('#d4161d'), female: true, bare: false }, tick: () => {} });
  const trail: THREE.Vector3[] = [];
  let conScored = false;
  const onConScore = { fn: (_p: THREE.Vector3) => {} };

  extraList.forEach((x, i) => extras.setLook(i, x.look));
  group.add(extras.group);

  // ---------- strings of lanterns and flags over the street ----------
  const strings: Array<{ a: THREE.Vector3; b: THREE.Vector3 }> = [];
  for (const z of [-12.2, -6.6]) strings.push({ a: new THREE.Vector3(-3.1, 4.3, z), b: new THREE.Vector3(3.1, 4.3, z + 0.6) });
  const sag = (a: THREE.Vector3, b: THREE.Vector3, k: number, depth: number) => a.clone().lerp(b, k).add(new THREE.Vector3(0, -Math.sin(k * Math.PI) * depth, 0));
  const lineMat = new THREE.LineBasicMaterial({ color: 0x3a2a1a });
  const flagGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-0.11, 0, 0), new THREE.Vector3(0.11, 0, 0), new THREE.Vector3(0, -0.28, 0)]);
  flagGeo.setIndex([0, 2, 1]);
  flagGeo.computeVertexNormals();
  const flagColors = [0xd8161b, 0xf2b705, 0x2e9e5b, 0x1f6fd1, 0xe8487d];
  const flagCount = strings.length * 18;
  const flags = new THREE.InstancedMesh(flagGeo, new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, roughness: 0.8 }), flagCount);
  let fi = 0;
  const streetLanterns: THREE.Group[] = [];
  strings.forEach((st, si) => {
    // lantern line
    const pts = Array.from({ length: 21 }, (_, i) => sag(st.a, st.b, i / 20, 0.55));
    group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), lineMat));
    for (let k = 1; k <= 5; k++) {
      const l = makeLantern(0.75);
      l.position.copy(sag(st.a, st.b, k / 6, 0.55)).add(new THREE.Vector3(0, -0.35, 0));
      group.add(l);
      streetLanterns.push(l);
    }
    // a flag line just behind it, zigzag the other way
    const fa = new THREE.Vector3(3.1, 3.9, st.a.z - 1.4);
    const fb = new THREE.Vector3(-3.1, 3.9, st.a.z - 1.0);
    group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(Array.from({ length: 21 }, (_, i) => sag(fa, fb, i / 20, 0.4))), lineMat));
    for (let k = 0; k < 18; k++) {
      const p = sag(fa, fb, (k + 0.5) / 18, 0.4);
      cm.compose(p, new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0.1, 0)), new THREE.Vector3(1, 1, 1));
      flags.setMatrixAt(fi, cm);
      flags.setColorAt(fi, new THREE.Color(flagColors[(k + si) % flagColors.length]));
      fi++;
    }
  });
  group.add(flags);
  // poles holding the strings
  for (const st of strings) {
    for (const end of [st.a, st.b]) {
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, end.y + 0.2, 6), darkWood);
      p.position.set(end.x, (end.y + 0.2) / 2, end.z);
      group.add(p);
    }
  }

  // ---------- lights ----------
  const hemi = new THREE.HemisphereLight(0xcfe6ff, 0x8a5a3a, 1.0);
  group.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff0d8, 2.2);
  sun.position.set(-8, 14, 10);
  group.add(sun);
  const fill = new THREE.DirectionalLight(0xffd6e0, 0.5);
  fill.position.set(6, 6, 12);
  group.add(fill);
  const gateLight = new THREE.PointLight(0xffa860, 0, 14, 1.4);
  gateLight.position.set(0, 3.2, GATE_Z + 2);
  group.add(gateLight);
  const streetLights = [-6, 0, 5].map((z) => {
    const p = new THREE.PointLight(0xff8a50, 0, 9, 1.4);
    p.position.set(0, 3.6, z);
    group.add(p);
    return p;
  });

  let flare = 0;
  let night = false;
  let skyFlash = 0;
  const skyFlashColor = new THREE.Color();
  const crackleFx = { fn: (_p: THREE.Vector3) => {} };

  updaters.push((t, dt) => {
    // lanterns sway; the street ones a little out of step
    streetLanterns.forEach((l, i) => (l.rotation.z = Math.sin(t * 1.1 + i * 0.7) * 0.06));
    gateLanterns.forEach((l, i) => (l.rotation.z = Math.sin(t * 0.9 + i) * 0.05));
    streamer.rotation.y = Math.sin(t * 1.4) * 0.25;
    const p = streamer.geometry.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) p.setZ(i, Math.sin(t * 3 + p.getY(i) * 2.5) * 0.06 * (1.1 - p.getY(i)));
    p.needsUpdate = true;

    flare = Math.max(0, flare - dt * 0.4);
    // the sky brightens with each burst and fades back (much stronger at night)
    skyFlash *= Math.exp(-dt * 3.5);
    skyMat.color.setRGB(1 + skyFlashColor.r * skyFlash, 1 + skyFlashColor.g * skyFlash, 1 + skyFlashColor.b * skyFlash);
    villageMat.color.copy(skyMat.color);
    const glowBase = night ? 0.55 : 0.3;
    lanternGlow.opacity = glowBase + flare * 0.4 + Math.sin(t * 2) * 0.04;
    lanternMat.emissiveIntensity = (night ? 0.85 : 0.45) + flare * 0.25;
    gateLight.intensity = (night ? 10 : 0) + flare * 5;
    streetLights.forEach((l, i) => (l.intensity = night ? 6 + Math.sin(t * 3 + i) * 0.4 : 0));

    // firecrackers popping one after another down the strings
    if (t < crackleUntil && t > crackleNext) {
      crackleNext = t + 0.05 + Math.random() * 0.06;
      crackleFx.fn(crackers[Math.floor(Math.random() * crackers.length)]);
    }

    // the còn: thrown up at the ring every few seconds, sometimes through
    const cycle = 3.2;
    const k = (t % cycle) / 1.6;
    const throwN = Math.floor(t / cycle);
    const hit = throwN % 3 === 0;
    const from = new THREE.Vector3(thrower.x, 1.0, thrower.z);
    const to = hit ? new THREE.Vector3(CON.x, CON.h - 0.15, CON.z - 0.6) : new THREE.Vector3(CON.x + 0.6, CON.h + 0.3, CON.z + 0.3);
    if (k <= 1) {
      const pos = from.clone().lerp(to, k);
      pos.y = THREE.MathUtils.lerp(from.y, to.y, k) + Math.sin(k * Math.PI) * 1.6;
      ball.position.copy(pos);
      thrower.cheer = 0;
      thrower.hands = k < 0.15 ? 1 - k / 0.15 : 0;
      if (k > 0.97 && hit && !conScored) {
        conScored = true;
        onConScore.fn(to.clone());
      }
    } else {
      // falls back down to the catcher
      const k2 = Math.min(1, (k - 1) / 1);
      const land = new THREE.Vector3(catcher.x, 1.0, catcher.z);
      ball.position.copy(to.clone().lerp(land, k2));
      ball.position.y = THREE.MathUtils.lerp(to.y, land.y, k2 * k2);
      catcher.hands = k2 > 0.7 ? 0.85 : 0;
      thrower.cheer = hit && k2 < 0.6 ? 1 : 0;
      conScored = false;
    }
    trail.unshift(ball.position.clone());
    trail.length = Math.min(trail.length, 12);
    tails.forEach((s, i) => s.position.copy(trail[Math.min(trail.length - 1, (i + 1) * 2)] ?? ball.position));

    // the performers
    extraList.forEach((x, i) => {
      x.tick(t);
      extras.write(i, x.pose);
    });
    extras.commit(extraList.length);
  });

  const setPlaqueText = (text: string) => {
    plaqueMat.map?.dispose();
    plaqueMat.map = T.plaqueTexture(text.toUpperCase());
    plaqueMat.needsUpdate = true;
  };

  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -13;
  sun.shadow.camera.right = 13;
  sun.shadow.camera.top = 13;
  sun.shadow.camera.bottom = -13;
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 60;
  sun.shadow.bias = -0.0006;
  sun.shadow.normalBias = 0.02;
  sun.target.position.set(0, 0, -6);
  group.add(sun.target);
  group.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh || mesh === sky || mesh === village) return;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    const seeThrough = mats.some((m) => m.transparent || m.alphaTest > 0);
    mesh.castShadow = !seeThrough;
    mesh.receiveShadow = true;
  });
  extras.group.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) o.castShadow = o.receiveShadow = true;
  });

  return {
    group,
    extras,
    launchPoint: new THREE.Vector3(PAD.x, 0.35, PAD.z),
    gateCenter: new THREE.Vector3(0, 3.6, GATE_Z + 0.6),
    update: (t, dt) => updaters.forEach((u) => u(t, dt)),
    setTheme: (theme) => {
      night = theme === 'night';
      skyMat.map?.dispose();
      skyMat.map = T.skyTexture(theme);
      skyMat.needsUpdate = true;
      villageMat.map?.dispose();
      villageMat.map = T.villageTexture(theme);
      villageMat.needsUpdate = true;
      hemi.color.set(night ? 0x6f7fb8 : 0xcfe6ff);
      hemi.groundColor.set(night ? 0x2a1520 : 0x8a5a3a);
      hemi.intensity = night ? 0.55 : 1.0;
      sun.intensity = night ? 0.25 : 2.2;
      sun.color.set(night ? 0x9fb0ff : 0xfff0d8);
      fill.intensity = night ? 0.15 : 0.5;
    },
    setPlaque: (text) => setPlaqueText(text),
    flare: (power) => {
      flare = Math.min(3, flare + power);
    },
    flashSky: (color, strength) => {
      skyFlashColor.copy(color);
      skyFlash = Math.min(1.6, skyFlash + strength * (night ? 0.45 : 0.06));
    },
    setShadows: (on) => {
      sun.castShadow = on;
    },
    crackle: (power) => {
      crackleUntil = Math.max(crackleUntil, performance.now() / 1000) + 1.2 + power * 1.2;
    },
    set onCrackle(fn: (p: THREE.Vector3) => void) {
      crackleFx.fn = fn;
    },
    get onCrackle() {
      return crackleFx.fn;
    },
    set onConScore(fn: (p: THREE.Vector3) => void) {
      onConScore.fn = fn;
    },
    get onConScore() {
      return onConScore.fn;
    },
  };
}

export const FOG_COLORS = { dusk: 0xf3e4d6, night: 0x10142a };
