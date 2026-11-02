import * as THREE from 'three';
import { shadowTexture } from './textures';

// Stylised people drawn with instancing: every body part is one InstancedMesh, so a hall of
// a hundred-plus people costs six draw calls. A pose (position, heading, kneel, bow, hands)
// is turned into part matrices each frame.

export type Pose = {
  x: number;
  z: number;
  heading: number; // 0 = facing the altar (-z)
  kneel: number; // 0 standing .. 1 kneeling
  bow: number; // 0 upright .. 1 forehead to the floor
  hands: number; // 0 joined at the chest .. 1 raised to the forehead (holding incense)
  walk: number; // walk cycle phase in radians, or -1 when still
  visible: boolean;
  scale: number; // 1 = normal; guests are drawn a little larger
};

export type Look = { robe: THREE.Color; skin: THREE.Color; hair: THREE.Color; bald: boolean };

export const newPose = (x = 0, z = 0): Pose => ({ x, z, heading: 0, kneel: 1, bow: 0, hands: 0, walk: -1, visible: true, scale: 1 });

const lathe = (pts: Array<[number, number]>) => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), 18);

// Body part shapes, sized for a person ~1 unit tall standing
const LOWER = lathe([[0, 0], [0.22, 0], [0.235, 0.05], [0.2, 0.3], [0.17, 0.46], [0, 0.48]]);
const TORSO = lathe([[0, 0], [0.185, 0], [0.19, 0.12], [0.17, 0.26], [0.12, 0.34], [0.05, 0.37], [0, 0.37]]);
const HEAD = new THREE.SphereGeometry(0.125, 18, 14);
const HAIR = new THREE.SphereGeometry(0.133, 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.62);
const HANDS = new THREE.SphereGeometry(1, 10, 8);
const SHADOW = new THREE.PlaneGeometry(0.75, 0.75);

const m = new THREE.Matrix4();
const root = new THREE.Matrix4();
const hip = new THREE.Matrix4();
const tmp = new THREE.Matrix4();
const v = new THREE.Vector3();
const q = new THREE.Quaternion();
const e = new THREE.Euler();
const s = new THREE.Vector3();
const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);

function hipMatrix(p: Pose, out: THREE.Matrix4) {
  const k = p.kneel;
  const bob = p.walk >= 0 ? Math.abs(Math.sin(p.walk)) * 0.035 : 0;
  root.compose(v.set(p.x, bob, p.z), q.setFromEuler(e.set(0, p.heading, 0)), s.set(p.scale, p.scale, p.scale));
  const lean = p.walk >= 0 ? -0.06 : 0;
  const sway = p.walk >= 0 ? Math.sin(p.walk) * 0.05 : 0;
  tmp.compose(v.set(0, 0.44 - 0.24 * k, -0.02 * k), q.setFromEuler(e.set(-p.bow * 1.2 + lean, 0, sway)), s.set(1, 1, 1));
  return out.multiplyMatrices(root, tmp);
}

// Where the head is (name plates sit just above it)
export function headPosition(p: Pose, out = new THREE.Vector3()) {
  hipMatrix(p, hip);
  return out.set(0, 0.66, 0).applyMatrix4(hip);
}

// Where the joined hands are (incense stick goes here)
export function handsPosition(p: Pose, out = new THREE.Vector3()) {
  hipMatrix(p, hip);
  return out.set(0, 0.26 + p.hands * 0.18, -0.15 - p.hands * 0.03).applyMatrix4(hip);
}

export class Crowd {
  readonly group = new THREE.Group();
  private lower: THREE.InstancedMesh;
  private torso: THREE.InstancedMesh;
  private head: THREE.InstancedMesh;
  private hair: THREE.InstancedMesh;
  private hands: THREE.InstancedMesh;
  private shadow: THREE.InstancedMesh;
  private parts: THREE.InstancedMesh[];
  count = 0;

  constructor(readonly max: number) {
    const cloth = new THREE.MeshStandardMaterial({ roughness: 0.85 });
    const skin = new THREE.MeshStandardMaterial({ roughness: 0.6 });
    const hair = new THREE.MeshStandardMaterial({ roughness: 0.7 });
    this.lower = new THREE.InstancedMesh(LOWER, cloth, max);
    this.torso = new THREE.InstancedMesh(TORSO, cloth, max);
    this.head = new THREE.InstancedMesh(HEAD, skin, max);
    this.hair = new THREE.InstancedMesh(HAIR, hair, max);
    this.hands = new THREE.InstancedMesh(HANDS, skin, max);
    this.shadow = new THREE.InstancedMesh(SHADOW, new THREE.MeshBasicMaterial({ map: shadowTexture(), transparent: true, depthWrite: false }), max);
    this.shadow.renderOrder = -1;
    this.parts = [this.shadow, this.lower, this.torso, this.head, this.hair, this.hands];
    for (const p of this.parts) {
      p.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      p.frustumCulled = false;
      p.count = 0;
      this.group.add(p);
    }
  }

  setLook(i: number, look: Look) {
    this.lower.setColorAt(i, look.robe);
    this.torso.setColorAt(i, look.robe);
    this.head.setColorAt(i, look.skin);
    this.hands.setColorAt(i, look.skin);
    this.hair.setColorAt(i, look.hair);
    this.hair.userData[i] = look.bald;
    for (const p of [this.lower, this.torso, this.head, this.hands, this.hair]) if (p.instanceColor) p.instanceColor.needsUpdate = true;
  }

  write(i: number, p: Pose) {
    if (!p.visible) {
      for (const part of this.parts) part.setMatrixAt(i, ZERO);
      return;
    }
    const k = p.kneel;
    hipMatrix(p, hip);
    // lower body: a long robe standing, folded legs when kneeling
    tmp.compose(v.set(0, 0, 0.09 * k), q.identity(), s.set(1 + 0.12 * k, 1 - 0.56 * k, 1 + 0.55 * k));
    this.lower.setMatrixAt(i, m.multiplyMatrices(root, tmp));
    this.torso.setMatrixAt(i, hip);
    tmp.makeTranslation(0, 0.47, 0);
    this.head.setMatrixAt(i, m.multiplyMatrices(hip, tmp));
    if (this.hair.userData[i]) this.hair.setMatrixAt(i, ZERO);
    else {
      tmp.compose(v.set(0, 0.485, 0.012), q.setFromEuler(e.set(0.35, 0, 0)), s.set(1, 1, 1));
      this.hair.setMatrixAt(i, m.multiplyMatrices(hip, tmp));
    }
    tmp.compose(v.set(0, 0.26 + p.hands * 0.18, -0.15 - p.hands * 0.03), q.identity(), s.set(0.055, 0.085, 0.05));
    this.hands.setMatrixAt(i, m.multiplyMatrices(hip, tmp));
    tmp.compose(v.set(p.x, 0.012, p.z), q.setFromEuler(e.set(-Math.PI / 2, 0, 0)), s.set(p.scale, p.scale, 1));
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

// Robe colours: viewers wear warm, varied robes; the background crowd wears muted grey-brown
export const VIEWER_ROBES = ['#c8862e', '#a0522d', '#8a6f4d', '#6b7a5a', '#9c6b3f', '#b5651d', '#7d5a50', '#5f6f7f', '#8f3b2e', '#a68a64'];
export const NPC_ROBES = ['#6d655c', '#5e5750', '#776d62', '#57514b', '#6a6259'];
export const SKINS = ['#f1c9a5', '#e8b98f', '#dcae84', '#f3d1b3', '#d9a47a'];
export const HAIRS = ['#1c1714', '#2a201a', '#3a2c22', '#151515'];
