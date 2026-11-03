import * as THREE from 'three';
import { brocadeTexture, shadowTexture } from './textures';

// People in Tết áo dài, drawn with instancing: every body part is one InstancedMesh, so a square
// full of people costs about fifteen draw calls. A pose (position, heading, bow, arms...) is turned
// into part matrices each frame.

export type Pose = {
  x: number;
  y: number;
  z: number;
  heading: number; // 0 = facing -z (toward the village gate)
  kneel: number; // 0 standing .. 1 sitting on the heels (the calligrapher)
  bow: number; // 0 upright .. 1 deep bow
  hands: number; // 0 at the sides .. 0.5 joined at the chest (a greeting) .. 1 holding something up over the head
  reach: number; // 0 .. 1 both hands out low in front (lighting a firework fuse, taking a scroll)
  cheer: number; // 0 .. 1 both arms up in a V
  walk: number; // walk cycle phase in radians, or -1 when still
  visible: boolean;
  scale: number; // 1 = normal; guests are drawn a little larger
};

export type Look = {
  robe: THREE.Color; // áo dài
  pants: THREE.Color;
  skin: THREE.Color;
  hair: THREE.Color;
  headwear: THREE.Color; // khăn vấn (women) or khăn đóng (men)
  female: boolean;
  bare: boolean; // no headwear
};

export const newPose = (x = 0, z = 0): Pose => ({ x, y: 0, z, heading: 0, kneel: 0, bow: 0, hands: 0, reach: 0, cheer: 0, walk: -1, visible: true, scale: 1 });

const lathe = (pts: Array<[number, number]>, seg = 20) => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), seg);

// A panel that hangs from the waist and flares out at the hem (the two long flaps of an áo dài)
function flapGeometry() {
  const g = new THREE.BoxGeometry(0.2, 0.36, 0.018, 4, 6, 1);
  const p = g.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i); // -0.18 (hem) .. 0.18 (waist)
    const k = (0.18 - y) / 0.36; // 0 at the waist, 1 at the hem
    p.setX(i, p.getX(i) * (1 + k * 0.55));
    p.setZ(i, p.getZ(i) + k * k * 0.03);
  }
  g.translate(0, -0.18, 0); // pivot at the waist
  g.computeVertexNormals();
  return g;
}

// Sizes for a person ~1.1 units tall standing; hip at 0.46
const HIP = 0.46;
const PANTS_GEO = lathe([[0, 0], [0.1, 0], [0.13, 0.02], [0.135, 0.25], [0.15, 0.46], [0, 0.47]]);
const TORSO = lathe([[0, -0.05], [0.16, -0.05], [0.155, 0.08], [0.14, 0.2], [0.16, 0.28], [0.12, 0.34], [0.055, 0.37], [0.05, 0.41], [0, 0.41]]);
const FLAP = flapGeometry();
const ARM = new THREE.CapsuleGeometry(0.042, 0.2, 4, 10); // a sleeve, axis along y, length ~0.28
const HAND = new THREE.SphereGeometry(0.038, 10, 8);
const HEAD = new THREE.SphereGeometry(0.12, 22, 16);
const EYES = (() => {
  const a = new THREE.SphereGeometry(0.016, 8, 6);
  const b = a.clone();
  a.translate(-0.042, 0, 0);
  b.translate(0.042, 0, 0);
  const merged = new THREE.BufferGeometry();
  const pa = a.attributes.position.array as Float32Array;
  const pb = b.attributes.position.array as Float32Array;
  const pos = new Float32Array(pa.length + pb.length);
  pos.set(pa, 0);
  pos.set(pb, pa.length);
  merged.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const ia = a.index!.array;
  const ib = b.index!.array;
  const idx = new Uint16Array(ia.length + ib.length);
  idx.set(ia, 0);
  for (let i = 0; i < ib.length; i++) idx[ia.length + i] = ib[i] + pa.length / 3;
  merged.setIndex(new THREE.BufferAttribute(idx, 1));
  merged.computeVertexNormals();
  return merged;
})();
const HAIR = new THREE.SphereGeometry(0.128, 20, 10, 0, Math.PI * 2, 0, Math.PI * 0.58);
// long hair down the back (women)
const LONG_HAIR = (() => {
  const g = new THREE.BoxGeometry(0.17, 0.42, 0.04, 2, 6, 1);
  const p = g.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) {
    const k = (0.21 - p.getY(i)) / 0.42;
    p.setX(i, p.getX(i) * (1 - k * 0.4));
  }
  g.translate(0, -0.21, 0);
  g.computeVertexNormals();
  return g;
})();
// khăn vấn: a padded ring round the head
const KHAN_VAN = new THREE.TorusGeometry(0.12, 0.04, 10, 28);
// khăn đóng: a small round hat with pleats
const KHAN_DONG = (() => {
  const g = new THREE.CylinderGeometry(0.135, 0.13, 0.085, 24, 1, false);
  const p = g.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) {
    const a = Math.atan2(p.getZ(i), p.getX(i));
    const r = 1 + Math.sin(a * 12) * 0.035;
    p.setX(i, p.getX(i) * r);
    p.setZ(i, p.getZ(i) * r);
  }
  g.computeVertexNormals();
  return g;
})();
const SHADOW = new THREE.PlaneGeometry(0.8, 0.8);

const m = new THREE.Matrix4();
const root = new THREE.Matrix4();
const hip = new THREE.Matrix4();
const tmp = new THREE.Matrix4();
const v = new THREE.Vector3();
const v2 = new THREE.Vector3();
const q = new THREE.Quaternion();
const e = new THREE.Euler();
const s = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);
const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);

function hipMatrix(p: Pose, out: THREE.Matrix4) {
  const k = p.kneel;
  const bob = p.walk >= 0 ? Math.abs(Math.sin(p.walk)) * 0.03 : 0;
  root.compose(v.set(p.x, p.y + bob, p.z), q.setFromEuler(e.set(0, p.heading, 0)), s.set(p.scale, p.scale, p.scale));
  const lean = p.walk >= 0 ? -0.05 : 0;
  const sway = p.walk >= 0 ? Math.sin(p.walk) * 0.04 : 0;
  tmp.compose(v.set(0, HIP - 0.28 * k, -0.02 * k), q.setFromEuler(e.set(-p.bow * 1.1 + lean + p.cheer * 0.1, 0, sway)), s.set(1, 1, 1));
  return out.multiplyMatrices(root, tmp);
}

// Where each hand is, in hip space
function handTarget(p: Pose, side: -1 | 1, out: THREE.Vector3) {
  const h = p.hands;
  // rest (sides) -> joined at the chest -> up over the head
  if (h <= 0.5) {
    const k = h / 0.5;
    out.set(side * (0.17 - k * 0.15), 0.03 + k * 0.23, -0.03 - k * 0.13);
  } else {
    const k = (h - 0.5) / 0.5;
    out.set(side * (0.02 + k * 0.08), 0.26 + k * 0.4, -0.16 + k * 0.06);
  }
  if (p.walk >= 0 && h < 0.2) out.z += Math.sin(p.walk) * 0.07 * side;
  if (p.cheer > 0) out.lerp(v2.set(side * 0.27, 0.66, -0.03), p.cheer);
  if (p.reach > 0) out.lerp(v2.set(side * 0.07, 0.1, -0.33), p.reach);
  return out;
}

// Where the head is (name plates sit just above it)
export function headPosition(p: Pose, out = new THREE.Vector3()) {
  hipMatrix(p, hip);
  return out.set(0, 0.68, 0).applyMatrix4(hip);
}

// Between the two hands (the scroll or the lighter goes here)
export function handsPosition(p: Pose, out = new THREE.Vector3()) {
  hipMatrix(p, hip);
  const a = handTarget(p, -1, new THREE.Vector3());
  const b = handTarget(p, 1, new THREE.Vector3());
  return out.copy(a).add(b).multiplyScalar(0.5).applyMatrix4(hip);
}

const SHOULDER_Y = 0.32;
const SHOULDER_X = 0.13;

export class Crowd {
  readonly group = new THREE.Group();
  private pants: THREE.InstancedMesh;
  private torso: THREE.InstancedMesh;
  private flapF: THREE.InstancedMesh;
  private flapB: THREE.InstancedMesh;
  private armL: THREE.InstancedMesh;
  private armR: THREE.InstancedMesh;
  private handL: THREE.InstancedMesh;
  private handR: THREE.InstancedMesh;
  private head: THREE.InstancedMesh;
  private eyes: THREE.InstancedMesh;
  private hair: THREE.InstancedMesh;
  private longHair: THREE.InstancedMesh;
  private khanVan: THREE.InstancedMesh;
  private khanDong: THREE.InstancedMesh;
  private shadow: THREE.InstancedMesh;
  private parts: THREE.InstancedMesh[];
  private looks: Look[] = [];
  count = 0;

  constructor(readonly max: number) {
    const brocade = brocadeTexture();
    const silk = new THREE.MeshStandardMaterial({ map: brocade, roughness: 0.45, metalness: 0.08 });
    const silkSide = new THREE.MeshStandardMaterial({ map: brocade, roughness: 0.45, metalness: 0.08, side: THREE.DoubleSide });
    const plain = new THREE.MeshStandardMaterial({ roughness: 0.7 });
    const skin = new THREE.MeshStandardMaterial({ roughness: 0.55 });
    const hair = new THREE.MeshStandardMaterial({ roughness: 0.45 });
    const mk = (g: THREE.BufferGeometry, mat: THREE.Material) => new THREE.InstancedMesh(g, mat, max);
    this.pants = mk(PANTS_GEO, plain);
    this.torso = mk(TORSO, silk);
    this.flapF = mk(FLAP, silkSide);
    this.flapB = mk(FLAP, silkSide);
    this.armL = mk(ARM, silk);
    this.armR = mk(ARM, silk);
    this.handL = mk(HAND, skin);
    this.handR = mk(HAND, skin);
    this.head = mk(HEAD, skin);
    this.eyes = mk(EYES, new THREE.MeshBasicMaterial({ color: 0x1a120c }));
    this.hair = mk(HAIR, hair);
    this.longHair = mk(LONG_HAIR, hair);
    this.khanVan = mk(KHAN_VAN, new THREE.MeshStandardMaterial({ map: brocade, roughness: 0.5 }));
    this.khanDong = mk(KHAN_DONG, new THREE.MeshStandardMaterial({ map: brocade, roughness: 0.6 }));
    this.shadow = mk(SHADOW, new THREE.MeshBasicMaterial({ map: shadowTexture(), transparent: true, depthWrite: false }));
    this.shadow.renderOrder = -1;
    this.parts = [this.shadow, this.pants, this.torso, this.flapF, this.flapB, this.armL, this.armR, this.handL, this.handR, this.head, this.eyes, this.hair, this.longHair, this.khanVan, this.khanDong];
    for (const p of this.parts) {
      p.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      p.frustumCulled = false;
      p.castShadow = p !== this.shadow; // real shadows when the stage turns them on (the blob stays for contact)
      p.count = 0;
      this.group.add(p);
    }
  }

  setLook(i: number, look: Look) {
    this.looks[i] = look;
    for (const p of [this.torso, this.flapF, this.flapB, this.armL, this.armR]) p.setColorAt(i, look.robe);
    this.pants.setColorAt(i, look.pants);
    for (const p of [this.head, this.handL, this.handR]) p.setColorAt(i, look.skin);
    this.hair.setColorAt(i, look.hair);
    this.longHair.setColorAt(i, look.hair);
    this.khanVan.setColorAt(i, look.headwear);
    this.khanDong.setColorAt(i, look.headwear);
    for (const p of this.parts) if (p.instanceColor) p.instanceColor.needsUpdate = true;
  }

  private arm(mesh: THREE.InstancedMesh, hand: THREE.InstancedMesh, i: number, p: Pose, side: -1 | 1) {
    const shoulder = new THREE.Vector3(side * SHOULDER_X, SHOULDER_Y, 0);
    const target = handTarget(p, side, new THREE.Vector3());
    const dir = target.clone().sub(shoulder);
    const len = Math.max(0.05, dir.length());
    q.setFromUnitVectors(UP, dir.normalize());
    tmp.compose(shoulder.clone().add(target).multiplyScalar(0.5), q, s.set(1, len / 0.28, 1));
    mesh.setMatrixAt(i, m.multiplyMatrices(hip, tmp));
    tmp.makeTranslation(target.x, target.y, target.z);
    hand.setMatrixAt(i, m.multiplyMatrices(hip, tmp));
  }

  write(i: number, p: Pose) {
    if (!p.visible) {
      for (const part of this.parts) part.setMatrixAt(i, ZERO);
      return;
    }
    const look = this.looks[i];
    const k = p.kneel;
    hipMatrix(p, hip);
    // trousers, folded under when sitting
    tmp.compose(v.set(0, 0, 0.08 * k), q.identity(), s.set(1 + 0.4 * k, 1 - 0.6 * k, 1 + 0.6 * k));
    this.pants.setMatrixAt(i, m.multiplyMatrices(root, tmp));
    this.torso.setMatrixAt(i, hip);
    // the two long flaps: they swing as people walk and lift a little in a bow
    const swing = p.walk >= 0 ? Math.sin(p.walk * 2) * 0.12 : 0;
    const fold = k * 1.2;
    tmp.compose(v.set(0, 0.02, -0.11), q.setFromEuler(e.set(0.08 + swing + fold, 0, 0)), s.set(1, 1 - k * 0.3, 1));
    this.flapF.setMatrixAt(i, m.multiplyMatrices(hip, tmp));
    tmp.compose(v.set(0, 0.02, 0.1), q.setFromEuler(e.set(-0.08 + swing - fold * 0.6, 0, 0)), s.set(1, 1 - k * 0.3, 1));
    this.flapB.setMatrixAt(i, m.multiplyMatrices(hip, tmp));
    this.arm(this.armL, this.handL, i, p, -1);
    this.arm(this.armR, this.handR, i, p, 1);
    tmp.makeTranslation(0, 0.53, 0);
    this.head.setMatrixAt(i, m.multiplyMatrices(hip, tmp));
    tmp.makeTranslation(0, 0.545, -0.108);
    this.eyes.setMatrixAt(i, m.multiplyMatrices(hip, tmp));
    tmp.compose(v.set(0, 0.545, 0.014), q.setFromEuler(e.set(0.4, 0, 0)), s.set(1, 1, 1));
    this.hair.setMatrixAt(i, m.multiplyMatrices(hip, tmp));
    if (look?.female) {
      tmp.compose(v.set(0, 0.55, 0.1), q.setFromEuler(e.set(0.12 - p.bow * 0.4, 0, 0)), s.set(1, 1, 1));
      this.longHair.setMatrixAt(i, m.multiplyMatrices(hip, tmp));
    } else this.longHair.setMatrixAt(i, ZERO);
    if (!look || look.bare) {
      this.khanVan.setMatrixAt(i, ZERO);
      this.khanDong.setMatrixAt(i, ZERO);
    } else if (look.female) {
      tmp.compose(v.set(0, 0.6, 0.01), q.setFromEuler(e.set(Math.PI / 2 + 0.25, 0, 0)), s.set(1, 1, 0.9));
      this.khanVan.setMatrixAt(i, m.multiplyMatrices(hip, tmp));
      this.khanDong.setMatrixAt(i, ZERO);
    } else {
      tmp.compose(v.set(0, 0.62, 0.01), q.setFromEuler(e.set(0.15, 0, 0)), s.set(1, 1, 1));
      this.khanDong.setMatrixAt(i, m.multiplyMatrices(hip, tmp));
      this.khanVan.setMatrixAt(i, ZERO);
    }
    tmp.compose(v.set(p.x, p.y + 0.012, p.z), q.setFromEuler(e.set(-Math.PI / 2, 0, 0)), s.set(p.scale, p.scale, 1));
    this.shadow.setMatrixAt(i, tmp);
  }

  commit(count: number) {
    this.count = count;
    for (const p of this.parts) {
      p.count = count;
      p.instanceMatrix.needsUpdate = true;
    }
  }
}

// Áo dài colours for viewers: the bright reds, yellows and pinks of Tết; the background crowd a little softer
export const VIEWER_ROBES = ['#d4161d', '#f2b705', '#e8487d', '#ffffff', '#1f6fd1', '#c3207a', '#f06a1c', '#2e9e5b', '#9b30c8', '#ffcf3a', '#e63946', '#f4a6c0'];
export const NPC_ROBES = ['#c9454b', '#d8a94a', '#d97d9b', '#e6e1d6', '#5b84b8', '#b8698f', '#d98a4e', '#6aa37a'];
export const PANTS = ['#f5f1e8', '#f5f1e8', '#f5f1e8', '#1c1a22', '#7a1416'];
export const HEADWEAR = ['#d4161d', '#f2b705', '#1c2a5a', '#7a1416', '#1a1a1a', '#e8487d'];
export const SKINS = ['#f3d1b3', '#efc39f', '#e8b98f', '#f6dcc4', '#ddb08a'];
export const HAIRS = ['#16110d', '#1f1712', '#2a1f18', '#0f0f0f'];
