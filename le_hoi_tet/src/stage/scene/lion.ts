import * as THREE from 'three';
import { fanTexture, lionClothTexture, lionHeadTexture, ongDiaFaceTexture } from './textures';

// Múa lân: a Vietnamese lion dance. The head has big blinking eyes, a mirror on the forehead, one horn,
// flapping ears, white fur round the face and a hinged jaw that snaps with the drum. The cloth body is
// one draped piece that follows the path the head took, with fur along the hem and spine and a
// fluffy tail. Two dancers' legs step underneath. Ông Địa, fan in hand, walks backwards in front.
// Facing: local -z is forward, like the people.

const HEAD_BACK = new THREE.Vector3(0, 0.02, 0.32); // where the cloth joins the head, in head space
const BODY_LEN = 1.9;
const SEG = 30; // rings along the cloth
const RAD = 18; // points round each ring
const STEP = 0.05; // trail spacing (metres)

type TrailPt = { p: THREE.Vector3; h: number };

function fur(color: number) {
  return new THREE.MeshStandardMaterial({ color, roughness: 1, emissive: color, emissiveIntensity: 0.08 });
}

export class LionDance {
  group = new THREE.Group();
  private head = new THREE.Group(); // positioned in world space each frame
  private jaw = new THREE.Group();
  private lids: THREE.Mesh[] = [];
  private ears: THREE.Mesh[] = [];
  private cloth: THREE.Mesh;
  private clothPos: Float32Array;
  private hemFur: THREE.InstancedMesh;
  private spineFur: THREE.InstancedMesh;
  private tail = new THREE.Group();
  private legs: Array<{ thigh: THREE.Mesh; shin: THREE.Mesh; paw: THREE.Mesh }> = [];
  private ongDia = new THREE.Group();
  private ongArm = new THREE.Group();
  private ongBody = new THREE.Group();
  private trail: TrailPt[] = [];
  private start = -1e9;
  private dur = 0;
  private lastBeat = 0;
  onStep: () => void = () => {}; // a drum beat

  constructor() {
    const red = new THREE.MeshStandardMaterial({ color: 0xd4161c, roughness: 0.5 });
    const gold = new THREE.MeshStandardMaterial({ color: 0xf2b705, roughness: 0.35, metalness: 0.35, emissive: 0x3a2400 });
    const green = new THREE.MeshStandardMaterial({ color: 0x1f9a4a, roughness: 0.5 });
    const white = fur(0xffffff);
    const pink = fur(0xff8fb3);
    const black = new THREE.MeshStandardMaterial({ color: 0x0d0d0d, roughness: 0.3 });

    // ---------- head ----------
    const skull = new THREE.Mesh(new THREE.SphereGeometry(0.42, 40, 28), new THREE.MeshStandardMaterial({ map: lionHeadTexture(), roughness: 0.45 }));
    skull.scale.set(1.08, 0.92, 1.0);
    this.head.add(skull);
    // mirror on the forehead
    const mirrorRim = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.018, 8, 24), gold);
    mirrorRim.position.set(0, 0.22, -0.36);
    mirrorRim.rotation.x = 0.45;
    this.head.add(mirrorRim);
    const mirror = new THREE.Mesh(new THREE.CircleGeometry(0.07, 24), new THREE.MeshStandardMaterial({ color: 0xdff4ff, metalness: 1, roughness: 0.05, emissive: 0x6f8fa8, emissiveIntensity: 0.6 }));
    mirror.position.copy(mirrorRim.position);
    mirror.rotation.x = Math.PI + 0.45;
    this.head.add(mirror);
    // one horn, swept back
    const horn = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0.33, -0.22), new THREE.Vector3(0, 0.48, -0.2), new THREE.Vector3(0, 0.58, -0.06)]), 12, 0.035, 8), gold);
    this.head.add(horn);
    const hornTip = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 8), red);
    hornTip.position.set(0, 0.58, -0.06);
    this.head.add(hornTip);
    // eyes: white balls, black pupils with a highlight, gold lids that blink, white brows
    for (const s of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.125, 20, 16), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.2 }));
      eye.position.set(s * 0.17, 0.12, -0.33);
      this.head.add(eye);
      const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.065, 14, 12), black);
      pupil.position.set(s * 0.175, 0.11, -0.43);
      this.head.add(pupil);
      const glint = new THREE.Mesh(new THREE.SphereGeometry(0.015, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffffff }));
      glint.position.set(s * 0.155, 0.14, -0.49);
      this.head.add(glint);
      const lid = new THREE.Mesh(new THREE.SphereGeometry(0.132, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), gold);
      lid.position.copy(eye.position);
      this.head.add(lid);
      this.lids.push(lid);
      for (let k = 0; k < 6; k++) {
        const brow = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 6), white);
        brow.scale.set(1, 0.8, 1.4);
        brow.position.set(s * (0.07 + k * 0.035), 0.27 + Math.sin(k / 5 * Math.PI) * 0.03, -0.36 + k * 0.01);
        this.head.add(brow);
      }
      // ears: flat, pink inside, they flap
      const ear = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), red);
      ear.scale.set(0.11, 0.15, 0.035);
      ear.position.set(s * 0.38, 0.27, -0.02);
      ear.rotation.z = -s * 0.5;
      const inner = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 10), pink);
      inner.scale.set(0.7, 0.75, 0.6);
      inner.position.z = -0.6;
      ear.add(inner);
      this.head.add(ear);
      this.ears.push(ear);
    }
    // snout: wide gold nose with nostrils, teeth along the upper lip
    const snout = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), gold);
    snout.scale.set(0.27, 0.12, 0.14);
    snout.position.set(0, -0.1, -0.38);
    this.head.add(snout);
    for (const s of [-1, 1]) {
      const nostril = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 6), black);
      nostril.position.set(s * 0.08, -0.08, -0.51);
      this.head.add(nostril);
    }
    const toothGeo = new THREE.ConeGeometry(0.022, 0.06, 6);
    const toothMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 });
    for (let k = -4; k <= 4; k++) {
      const tooth = new THREE.Mesh(toothGeo, toothMat);
      tooth.rotation.x = Math.PI;
      tooth.position.set(k * 0.045, -0.22, -0.44 + Math.abs(k) * 0.012);
      this.head.add(tooth);
    }
    // inside of the mouth (seen when it opens)
    const throat = new THREE.Mesh(new THREE.SphereGeometry(0.18, 16, 12), new THREE.MeshStandardMaterial({ color: 0x5a0608, roughness: 0.8 }));
    throat.scale.set(1.2, 0.6, 1);
    throat.position.set(0, -0.24, -0.25);
    this.head.add(throat);
    // the jaw, hinged at the back
    this.jaw.position.set(0, -0.2, -0.05);
    this.head.add(this.jaw);
    const jawBone = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 12), red);
    jawBone.scale.set(0.27, 0.07, 0.34);
    jawBone.position.set(0, -0.04, -0.22);
    this.jaw.add(jawBone);
    const tongue = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 8), new THREE.MeshStandardMaterial({ color: 0xff4a6a, roughness: 0.6 }));
    tongue.scale.set(0.13, 0.03, 0.2);
    tongue.position.set(0, 0.01, -0.28);
    this.jaw.add(tongue);
    for (let k = -3; k <= 3; k++) {
      const tooth = new THREE.Mesh(toothGeo, toothMat);
      tooth.position.set(k * 0.05, 0.03, -0.48 + Math.abs(k) * 0.015);
      this.jaw.add(tooth);
    }
    // a long white beard under the chin
    for (let k = 0; k < 9; k++) {
      const strand = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.32, 6), white);
      strand.rotation.x = Math.PI + (k % 2 ? 0.15 : -0.1);
      strand.position.set((k - 4) * 0.035, -0.2, -0.44 + Math.abs(k - 4) * 0.02);
      this.jaw.add(strand);
    }
    // white fur all round the face, with coloured tufts on top
    const tuftGeo = new THREE.SphereGeometry(0.06, 10, 8);
    for (let k = 0; k < 34; k++) {
      const a = (k / 34) * Math.PI * 2;
      const tuft = new THREE.Mesh(tuftGeo, k % 5 === 0 ? pink : white);
      tuft.position.set(Math.cos(a) * 0.45, Math.sin(a) * 0.38 + 0.02, -0.2 + Math.abs(Math.sin(a)) * 0.04);
      tuft.scale.set(1.1, 1.1, 1.6);
      this.head.add(tuft);
    }
    for (let k = 0; k < 5; k++) {
      const crest = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), k % 2 ? fur(0x2bd46a) : fur(0xffd23f));
      crest.position.set((k - 2) * 0.09, 0.4 - Math.abs(k - 2) * 0.04, 0.05);
      this.head.add(crest);
    }
    this.group.add(this.head);

    // ---------- cloth body ----------
    const geo = new THREE.BufferGeometry();
    this.clothPos = new Float32Array(SEG * RAD * 3);
    const uv = new Float32Array(SEG * RAD * 2);
    const idx: number[] = [];
    for (let i = 0; i < SEG; i++) {
      for (let j = 0; j < RAD; j++) {
        uv.set([(i / (SEG - 1)) * 3, j / (RAD - 1)], (i * RAD + j) * 2);
        if (i < SEG - 1 && j < RAD - 1) {
          const a = i * RAD + j;
          const b = a + RAD;
          idx.push(a, b, a + 1, b, b + 1, a + 1);
        }
      }
    }
    geo.setAttribute('position', new THREE.BufferAttribute(this.clothPos, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    geo.setIndex(idx);
    this.cloth = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: lionClothTexture(), roughness: 0.6, side: THREE.DoubleSide }));
    this.cloth.frustumCulled = false;
    this.group.add(this.cloth);
    this.hemFur = new THREE.InstancedMesh(tuftGeo, white, SEG * 2);
    this.spineFur = new THREE.InstancedMesh(tuftGeo, fur(0xffd23f), SEG);
    for (const m of [this.hemFur, this.spineFur]) {
      m.frustumCulled = false;
      m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      this.group.add(m);
    }
    // the tail: a fluffy pompom with a red tip
    for (let k = 0; k < 7; k++) {
      const t = new THREE.Mesh(new THREE.SphereGeometry(0.085, 10, 8), k < 5 ? white : pink);
      t.position.set(Math.cos(k) * 0.08, 0.05 + (k % 3) * 0.05, k * 0.035);
      this.tail.add(t);
    }
    this.group.add(this.tail);

    // ---------- the dancers' legs: fur trousers and lion-paw shoes ----------
    const trousers = fur(0xf2c14e);
    const thighGeo = new THREE.CapsuleGeometry(0.075, 0.26, 4, 10);
    const shinGeo = new THREE.CapsuleGeometry(0.065, 0.26, 4, 10);
    const pawGeo = new THREE.SphereGeometry(1, 12, 8);
    for (let i = 0; i < 4; i++) {
      const thigh = new THREE.Mesh(thighGeo, trousers);
      const shin = new THREE.Mesh(shinGeo, trousers);
      const paw = new THREE.Mesh(pawGeo, red);
      paw.scale.set(0.08, 0.06, 0.13);
      const cuff = new THREE.Mesh(new THREE.TorusGeometry(0.85, 0.35, 6, 14), white);
      cuff.rotation.x = Math.PI / 2;
      cuff.position.y = 0.5;
      paw.add(cuff);
      this.group.add(thigh, shin, paw);
      this.legs.push({ thigh, shin, paw });
    }

    // ---------- Ông Địa ----------
    const shirt = new THREE.MeshStandardMaterial({ color: 0xe8b23a, roughness: 0.8 });
    const skin = new THREE.MeshStandardMaterial({ color: 0xf2c9a0, roughness: 0.6 });
    const pants = new THREE.MeshStandardMaterial({ color: 0x6a3a1a, roughness: 0.8 });
    this.ongDia.add(this.ongBody);
    const belly = new THREE.Mesh(new THREE.SphereGeometry(0.3, 20, 16), skin);
    belly.scale.set(1, 1.05, 0.95);
    belly.position.set(0, 0.62, -0.03);
    this.ongBody.add(belly);
    for (const s of [-1, 1]) {
      // an open shirt over the belly
      const flap = new THREE.Mesh(new THREE.SphereGeometry(0.31, 16, 12, s < 0 ? Math.PI * 0.55 : Math.PI * 1.45, Math.PI * 1.0), shirt);
      flap.position.set(0, 0.64, 0.01);
      this.ongBody.add(flap);
      const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.08, 0.22, 4, 8), pants);
      leg.position.set(s * 0.12, 0.2, 0);
      this.ongBody.add(leg);
    }
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 24, 18), new THREE.MeshStandardMaterial({ map: ongDiaFaceTexture(), roughness: 0.55 }));
    head.position.set(0, 1.08, 0);
    this.ongBody.add(head);
    // a still arm on the belly, and the arm that waves the fan
    const restArm = new THREE.Mesh(new THREE.CapsuleGeometry(0.055, 0.25, 4, 8), shirt);
    restArm.position.set(-0.28, 0.72, -0.08);
    restArm.rotation.set(0.6, 0, -0.5);
    this.ongBody.add(restArm);
    this.ongArm.position.set(0.27, 0.86, 0);
    this.ongBody.add(this.ongArm);
    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.055, 0.25, 4, 8), shirt);
    arm.position.set(0.05, 0.16, 0);
    arm.rotation.z = -0.3;
    this.ongArm.add(arm);
    const fan = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.42), new THREE.MeshStandardMaterial({ map: fanTexture(), transparent: true, alphaTest: 0.3, side: THREE.DoubleSide, roughness: 0.8 }));
    fan.position.set(0.1, 0.48, 0);
    this.ongArm.add(fan);
    this.group.add(this.ongDia);

    this.group.visible = false;
  }

  play(now: number, power = 1) {
    // a new gift while dancing keeps it going a little longer
    if (now < this.start + this.dur) this.dur += 4000 * power;
    else {
      this.start = now;
      this.dur = 17000 + power * 3000;
      this.trail = [];
    }
  }

  get active() {
    const k = (performance.now() - this.start) / Math.max(1, this.dur);
    return k >= 0 && k < 1;
  }

  // where the camera should look while the lion dances
  focus(out: THREE.Vector3) {
    return out.copy(this.head.position);
  }

  stop() {
    this.dur = 0;
    this.group.visible = false;
  }

  // The route: bound up the street, two loops in front of the dais, a bow to everyone, back out
  private at(k: number, t: number): { p: THREE.Vector3; face?: number } {
    if (k < 0.25) {
      const f = k / 0.25;
      return { p: new THREE.Vector3(Math.sin(f * 8) * 0.35, 0, 9 - f * 16) };
    }
    if (k < 0.62) {
      const f = (k - 0.25) / 0.37;
      const a = f * Math.PI * 4;
      return { p: new THREE.Vector3(Math.sin(a) * 1.5, 0, -7 + Math.cos(a) * 0.9 + 0.9) };
    }
    if (k < 0.78) return { p: new THREE.Vector3(0, 0, -6.2), face: Math.PI }; // the bow, facing everyone
    const f = (k - 0.78) / 0.22;
    return { p: new THREE.Vector3(Math.sin(f * 7 + t * 0.1) * 0.3, 0, -6.2 + f * 16) };
  }

  update(now: number, t: number) {
    const k = (now - this.start) / Math.max(1, this.dur);
    if (k < 0 || k >= 1) {
      this.group.visible = false;
      return;
    }
    this.group.visible = true;
    const { p, face } = this.at(k, t);

    // trail of where the head has been, a point every few centimetres (whatever the frame rate)
    const prev = this.trail[0];
    if (!prev) this.trail.unshift({ p: p.clone(), h: 0 });
    else {
      const moved = prev.p.distanceTo(p);
      if (moved > STEP) {
        const h = Math.atan2(-(p.x - prev.p.x), -(p.z - prev.p.z));
        const steps = Math.min(60, Math.floor(moved / STEP));
        const from = prev.p.clone();
        for (let s = 1; s <= steps; s++) this.trail.unshift({ p: from.clone().lerp(p, s / steps), h });
        if (this.trail.length > 200) this.trail.length = 200;
      }
    }
    const heading = face ?? this.trail[0]?.h ?? 0;
    const along = (dist: number): TrailPt => {
      const i = Math.min(this.trail.length - 1, Math.round(dist / STEP));
      const pt = this.trail[i] ?? { p, h: heading };
      // the bow: the body stays straight behind the head
      if (face !== undefined) return { p: p.clone().add(new THREE.Vector3(Math.sin(face) * dist, 0, Math.cos(face) * dist)), h: face };
      return pt;
    };

    // ---------- moves ----------
    const beat = Math.sin(t * 6.5);
    const bounce = Math.abs(beat);
    if (beat > 0.97 && t - this.lastBeat > 0.3) {
      this.lastBeat = t;
      this.onStep();
    }
    const bowing = face !== undefined;
    const bowK = bowing ? ((k - 0.62) / 0.16) * 3 : 0; // three bows
    const bowDip = bowing ? Math.max(0, Math.sin((bowK % 1) * Math.PI)) : 0;
    const rear = bowing ? 0 : Math.max(0, Math.sin(t * 0.9) - 0.4) * 1.6; // now and then the front dancer rears up
    const shake = Math.sin(t * 13) * Math.max(0, Math.sin(t * 0.7 + 1)) * 0.35; // a quick head shake
    const look = Math.sin(t * 1.7) * 0.45;

    this.head.position.set(p.x, 1.2 + bounce * 0.12 + rear * 0.55 - bowDip * 0.55, p.z);
    this.head.rotation.set(-rear * 0.35 + bowDip * 0.7 + Math.sin(t * 3.2) * 0.08, heading + look + shake, Math.sin(t * 2.4) * 0.12, 'YXZ');
    this.jaw.rotation.x = 0.05 + Math.max(0, Math.sin(t * 6.5 + 0.6)) * (bowing ? 0.65 : 0.45);
    const blink = (t % 3.1) < 0.14;
    this.lids.forEach((lid) => (lid.rotation.x = blink ? 0.2 : -1.35));
    this.ears.forEach((ear, i) => (ear.rotation.x = Math.sin(t * 9 + i) * 0.35));

    // ---------- cloth: from the back of the head along the trail, draped over the rear dancer ----------
    this.head.updateMatrixWorld();
    const neck = HEAD_BACK.clone().applyMatrix4(this.head.matrixWorld);
    const hm = new THREE.Matrix4();
    const tmp = new THREE.Vector3();
    for (let i = 0; i < SEG; i++) {
      const f = i / (SEG - 1);
      const pt = along(0.25 + f * BODY_LEN);
      // height of the spine: from the neck, over the rear dancer's back, down to the tail
      const spineY = THREE.MathUtils.lerp(neck.y, 1.0 + Math.abs(Math.sin(t * 6.5 - f * 3)) * 0.06, Math.min(1, f * 2.5)) - Math.max(0, f - 0.75) * 0.9;
      const center = i === 0 ? neck : new THREE.Vector3(pt.p.x, spineY, pt.p.z);
      const width = 0.42 + Math.sin(f * Math.PI) * 0.08 - Math.max(0, f - 0.8) * 1.0;
      const hem = 0.38 + f * 0.05; // how far the sides hang down
      hm.makeRotationY(i === 0 ? heading : pt.h);
      for (let j = 0; j < RAD; j++) {
        // across: from the left hem, up over the spine, down to the right hem
        const a = Math.PI * (1.15 - (j / (RAD - 1)) * 1.3);
        const x = Math.cos(a) * width;
        let y = Math.sin(a) * 0.32;
        if (j === 0 || j === RAD - 1) y -= hem; // the hems hang straight down
        else if (j === 1 || j === RAD - 2) y -= hem * 0.5;
        const sway = Math.sin(t * 4 - f * 5) * 0.03 * f;
        tmp.set(x + sway, y, 0).applyMatrix4(hm).add(center);
        this.clothPos.set([tmp.x, tmp.y, tmp.z], (i * RAD + j) * 3);
      }
    }
    const g = this.cloth.geometry;
    (g.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    g.computeVertexNormals();
    g.computeBoundingSphere();
    // fur along both hems and the spine
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    for (let i = 0; i < SEG; i++) {
      for (const [n, j] of [[0, 0], [1, RAD - 1]] as const) {
        tmp.fromArray(this.clothPos, (i * RAD + j) * 3);
        this.hemFur.setMatrixAt(i * 2 + n, m.compose(tmp, q, new THREE.Vector3(1, 1.4, 1)));
      }
      tmp.fromArray(this.clothPos, (i * RAD + Math.floor(RAD / 2)) * 3);
      tmp.y += 0.03;
      this.spineFur.setMatrixAt(i, m.compose(tmp, q, new THREE.Vector3(0.8, 0.8, 0.8)));
    }
    this.hemFur.instanceMatrix.needsUpdate = true;
    this.spineFur.instanceMatrix.needsUpdate = true;
    tmp.fromArray(this.clothPos, ((SEG - 1) * RAD + Math.floor(RAD / 2)) * 3);
    this.tail.position.copy(tmp);
    this.tail.rotation.set(0.4 + Math.sin(t * 8) * 0.3, along(0.25 + BODY_LEN).h + Math.sin(t * 5) * 0.4, 0);

    // ---------- legs: front dancer under the head, rear dancer under the hump ----------
    const hipY = 0.82 - bowDip * 0.25;
    this.legs.forEach((leg, i) => {
      const pt = along(i < 2 ? 0.15 : 1.15);
      const side = i % 2 ? 1 : -1;
      const phase = t * 6.5 + (i % 2) * Math.PI + (i < 2 ? 0 : Math.PI / 2);
      const lift = Math.max(0, Math.sin(phase)) * (rear > 0.3 && i < 2 ? 0.05 : 0.17);
      const swing = Math.cos(phase) * 0.12;
      const fwd = new THREE.Vector3(-Math.sin(pt.h), 0, -Math.cos(pt.h));
      const right = new THREE.Vector3(Math.cos(pt.h), 0, -Math.sin(pt.h));
      const hip = pt.p.clone().addScaledVector(right, side * 0.14).setY(i < 2 ? hipY + rear * 0.1 : 0.78);
      const foot = pt.p.clone().addScaledVector(right, side * 0.16).addScaledVector(fwd, swing).setY(0.07 + lift);
      // knees bend forward
      const knee = hip.clone().lerp(foot, 0.5).addScaledVector(fwd, 0.14 + lift * 0.4);
      const place = (mesh: THREE.Mesh, a: THREE.Vector3, b: THREE.Vector3) => {
        mesh.position.copy(a).add(b).multiplyScalar(0.5);
        mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
      };
      place(leg.thigh, hip, knee);
      place(leg.shin, knee, foot);
      leg.paw.position.copy(foot).addScaledVector(fwd, 0.05);
      leg.paw.rotation.set(0, pt.h, 0);
    });

    // ---------- Ông Địa: a step ahead, walking backwards, laughing, fanning the lion ----------
    const fwd = new THREE.Vector3(-Math.sin(heading), 0, -Math.cos(heading));
    const right = new THREE.Vector3(Math.cos(heading), 0, -Math.sin(heading));
    // during the bow he steps aside, turns to everyone and bows along, so the lion's face stays in view
    const ahead = bowing
      ? new THREE.Vector3(p.x, 0, p.z).addScaledVector(right, 1.0).addScaledVector(fwd, 0.5)
      : new THREE.Vector3(p.x, 0, p.z).addScaledVector(fwd, 1.35).addScaledVector(right, Math.sin(t * 1.3) * 0.5);
    this.ongDia.position.lerp(ahead, this.ongDia.position.lengthSq() ? 0.12 : 1);
    this.ongDia.rotation.y = bowing ? heading + Math.sin(t * 2) * 0.15 : heading + Math.PI + Math.sin(t * 2) * 0.3;
    this.ongBody.position.y = Math.abs(Math.sin(t * 6.5)) * 0.07;
    this.ongBody.rotation.z = Math.sin(t * 3.25) * 0.12;
    this.ongBody.rotation.x = bowing ? -bowDip * 0.5 : 0;
    this.ongArm.rotation.z = -0.4 + Math.sin(t * 7) * 0.6;
  }
}
