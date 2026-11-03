import * as THREE from 'three';
import * as T from './textures';

// The river at night, built from primitives: water with moving ripples and a moonlit glitter path,
// a long wooden bridge running away from the camera with a wide pavilion halfway along it, red
// lanterns on the railings, a gate on the far bank carrying the channel name, trees, hills, moon and stars.
// The camera sits above the near end of the bridge looking along it (-z); the water flows toward +x.

export const BRIDGE_HALF = 1.4; // railing x along the narrow part of the bridge
export const PAVILION = { z0: -3.6, z1: 0.6, half: 2.6, y: 1.5 }; // the wide deck where people let go
export const FAR_BANK_Z = -24;
export const CURRENT = 0.16; // water speed toward +x (units per second)

// Height of the bridge deck: a gentle arch peaking at the pavilion
export function deckY(z: number) {
  if (z <= PAVILION.z1 && z >= PAVILION.z0) return PAVILION.y;
  const k = (z + 1.5) / 21;
  return 0.95 + 0.55 * Math.max(0, 1 - k * k);
}

// True where a point on the water is covered by the bridge (lanterns drifting under it are hidden there)
export function underBridge(x: number, z: number) {
  if (z <= PAVILION.z1 + 0.1 && z >= PAVILION.z0 - 0.1) return Math.abs(x) < PAVILION.half + 0.1;
  return Math.abs(x) < BRIDGE_HALF + 0.1 && z > FAR_BANK_Z;
}

export type Theme = 'dusk' | 'night';

export type River = {
  group: THREE.Group;
  update: (t: number, dt: number) => void;
  setPlaque: (text: string) => void;
  setTheme: (theme: Theme) => void;
  flare: (amount: number) => void; // 0..3, gifts make the moon and lanterns flare
  moonPos: THREE.Vector3;
};

type P2 = { x: number; z: number };

const PALETTES = {
  night: {
    skyTop: 0x010208, skyHorizon: 0x0b1228, moonGlow: 0x6f84c8, waterDeep: 0x01030a, waterSky: 0x0d1630,
    fog: 0x070b18, hillFar: 0x0b1124, hillNear: 0x060914, hemi: 0x8090c8, ground: 0x1a1210, hemiI: 1.0, moonI: 0.9, stars: 0.95,
  },
  dusk: {
    skyTop: 0x1a1236, skyHorizon: 0xc8684a, moonGlow: 0xffc890, waterDeep: 0x0d0a18, waterSky: 0x6b3550,
    fog: 0x3a2036, hillFar: 0x3d2341, hillNear: 0x24142c, hemi: 0xffb48c, ground: 0x140a12, hemiI: 0.8, moonI: 0.55, stars: 0.35,
  },
};

const WATER_VERT = /* glsl */ `
varying vec3 vWorld;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vWorld = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;

const WATER_FRAG = /* glsl */ `
uniform float uTime;
uniform float uFlare;
uniform vec3 uDeep;
uniform vec3 uSky;
uniform vec3 uMoonColor;
uniform vec3 uMoonPos;
uniform vec3 uFogColor;
uniform float uFogNear;
uniform float uFogFar;
varying vec3 vWorld;

float h(vec2 p) {
  p.x -= uTime * ${CURRENT.toFixed(2)};
  return sin(p.x * 1.1 + p.y * 0.3 + uTime * 0.6) * 0.5
       + sin(p.y * 1.9 - p.x * 0.5 + uTime * 0.9) * 0.35
       + sin(p.x * 3.7 + p.y * 2.9 + uTime * 1.6) * 0.15
       + sin(-p.x * 5.3 + p.y * 6.1 + uTime * 2.1) * 0.08;
}

void main() {
  vec2 p = vWorld.xz;
  float d = length(cameraPosition - vWorld);
  float amp = 0.09 / (1.0 + d * 0.035);
  float e = 0.04;
  float dx = (h(p + vec2(e, 0.0)) - h(p - vec2(e, 0.0))) / (2.0 * e);
  float dz = (h(p + vec2(0.0, e)) - h(p - vec2(0.0, e))) / (2.0 * e);
  vec3 n = normalize(vec3(-dx * amp, 1.0, -dz * amp));
  vec3 view = normalize(cameraPosition - vWorld);
  float fresnel = pow(1.0 - max(dot(n, view), 0.0), 3.0);
  vec3 col = mix(uDeep, uSky, clamp(fresnel * 0.9 + 0.08, 0.0, 1.0));
  vec3 r = reflect(-view, n);
  float m = max(dot(r, normalize(uMoonPos - vWorld)), 0.0);
  col += uMoonColor * (pow(m, 400.0) * 0.9 + pow(m, 40.0) * 0.07) * (1.0 + uFlare * 0.6);
  float f = smoothstep(uFogNear, uFogFar, d);
  gl_FragColor = vec4(mix(col, uFogColor, f), 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

const SKY_VERT = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const SKY_FRAG = /* glsl */ `
uniform vec3 uTop;
uniform vec3 uHorizon;
uniform vec3 uGlow;
uniform vec3 uMoonDir;
uniform float uFlare;
varying vec3 vDir;
void main() {
  float y = max(vDir.y, 0.0);
  vec3 col = mix(uHorizon, uTop, pow(y, 0.45));
  float m = max(dot(vDir, uMoonDir), 0.0);
  col += uGlow * (pow(m, 40.0) * 0.45 + pow(m, 6.0) * 0.12) * (1.0 + uFlare * 0.5);
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

// One beam from a to b (box geometry 1 unit long along z)
const beam = (m: THREE.Matrix4, a: THREE.Vector3, b: THREE.Vector3, thick: number) => {
  const dir = b.clone().sub(a);
  const len = dir.length();
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir.normalize());
  return m.compose(a.clone().add(b).multiplyScalar(0.5), q, new THREE.Vector3(thick, thick, len));
};

export function buildRiver(): River {
  const group = new THREE.Group();
  const updaters: Array<(t: number, dt: number) => void> = [];
  const pal = PALETTES.night;

  // ---------- materials ----------
  const wood = new THREE.MeshStandardMaterial({ map: T.floorTexture(), roughness: 0.75, color: 0x9a8070 });
  const lacquer = new THREE.MeshStandardMaterial({ color: 0x8c1d14, roughness: 0.45, emissive: 0x1a0402 });
  const darkWood = new THREE.MeshStandardMaterial({ color: 0x2a1810, roughness: 0.8 });
  const stone = new THREE.MeshStandardMaterial({ color: 0x4a4a52, roughness: 0.9 });
  const gold = new THREE.MeshStandardMaterial({ color: 0xc8902e, metalness: 0.8, roughness: 0.4, emissive: 0x2a1504 });
  const roofMat = new THREE.MeshStandardMaterial({ color: 0x3a2a26, roughness: 0.8 });
  const foliage = new THREE.MeshStandardMaterial({ color: 0x15281e, roughness: 1 });

  // ---------- sky, moon, stars ----------
  const moonPos = new THREE.Vector3(17, 11.5, -86);
  const skyMat = new THREE.ShaderMaterial({
    vertexShader: SKY_VERT, fragmentShader: SKY_FRAG, side: THREE.BackSide, depthWrite: false,
    uniforms: {
      uTop: { value: new THREE.Color(pal.skyTop) }, uHorizon: { value: new THREE.Color(pal.skyHorizon) },
      uGlow: { value: new THREE.Color(pal.moonGlow) }, uMoonDir: { value: moonPos.clone().normalize() }, uFlare: { value: 0 },
    },
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(160, 32, 16), skyMat);
  sky.renderOrder = -10;
  group.add(sky);

  const moon = new THREE.Sprite(new THREE.SpriteMaterial({ map: T.moonTexture(), fog: false, depthWrite: false }));
  moon.position.copy(moonPos);
  moon.scale.setScalar(7.5);
  const moonHalo = new THREE.Sprite(new THREE.SpriteMaterial({ map: T.glowTexture('rgba(255,250,225,0.55)', 'rgba(170,190,255,0.16)'), blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
  moonHalo.position.copy(moonPos).add(new THREE.Vector3(0, 0, -1));
  moonHalo.scale.setScalar(34);
  group.add(moonHalo, moon);

  const STARS = 420;
  const starPos = new Float32Array(STARS * 3);
  for (let i = 0; i < STARS; i++) {
    const a = Math.random() * Math.PI * 2;
    const y = 0.06 + Math.random() * 0.9;
    const r = Math.sqrt(1 - y * y);
    starPos.set([Math.cos(a) * r * 140, y * 140, Math.sin(a) * r * 140], i * 3);
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
  const starMat = new THREE.PointsMaterial({ size: 2, sizeAttenuation: false, color: 0xdfe6ff, transparent: true, opacity: pal.stars, fog: false, depthWrite: false });
  group.add(new THREE.Points(starGeo, starMat));

  // ---------- hills ----------
  const hillFarMat = new THREE.MeshBasicMaterial({ map: T.hillsTexture(7, true), color: pal.hillFar, transparent: true, fog: false, depthWrite: false });
  const hillNearMat = new THREE.MeshBasicMaterial({ map: T.hillsTexture(21, false), color: pal.hillNear, transparent: true, fog: false, depthWrite: false });
  // low on the horizon, so the moon rises clear of them
  const hillFar = new THREE.Mesh(new THREE.PlaneGeometry(320, 26), hillFarMat);
  hillFar.position.set(-20, 0, -110);
  const hillNear = new THREE.Mesh(new THREE.PlaneGeometry(220, 13), hillNearMat);
  hillNear.position.set(10, 0, -72);
  hillFar.renderOrder = hillNear.renderOrder = -5;
  group.add(hillFar, hillNear);

  // ---------- water ----------
  const waterMat = new THREE.ShaderMaterial({
    vertexShader: WATER_VERT, fragmentShader: WATER_FRAG,
    uniforms: {
      uTime: { value: 0 }, uFlare: { value: 0 },
      uDeep: { value: new THREE.Color(pal.waterDeep) }, uSky: { value: new THREE.Color(pal.waterSky) },
      uMoonColor: { value: new THREE.Color(0xfff2d0) }, uMoonPos: { value: moonPos },
      uFogColor: { value: new THREE.Color(pal.fog) }, uFogNear: { value: 30 }, uFogFar: { value: 120 },
    },
  });
  const water = new THREE.Mesh(new THREE.PlaneGeometry(320, 180), waterMat);
  water.rotation.x = -Math.PI / 2;
  water.position.z = -30;
  group.add(water);

  // ---------- far bank ----------
  const bank = new THREE.Mesh(new THREE.BoxGeometry(320, 1.2, 70), stone);
  bank.position.set(0, -0.2, FAR_BANK_Z - 35);
  group.add(bank);
  const grass = new THREE.Mesh(new THREE.PlaneGeometry(320, 68), new THREE.MeshStandardMaterial({ color: 0x101c16, roughness: 1 }));
  grass.rotation.x = -Math.PI / 2;
  grass.position.set(0, 0.41, FAR_BANK_Z - 36);
  group.add(grass);

  // trees: rounded crowns and a few tall cypress shapes, leaving the gate clear
  const crownGeo = new THREE.IcosahedronGeometry(1, 1);
  const coneGeo = new THREE.ConeGeometry(0.7, 3, 8);
  const crowns = new THREE.InstancedMesh(crownGeo, foliage, 70);
  const cones = new THREE.InstancedMesh(coneGeo, foliage, 30);
  const m4 = new THREE.Matrix4();
  let r = 12345;
  const rand = () => ((r = (r * 1664525 + 1013904223) >>> 0) / 4294967296);
  // a low treeline, so the sky and moon stay clear above it
  for (let i = 0; i < 70; i++) {
    let x = (rand() - 0.5) * 90;
    if (Math.abs(x) < 4.5) x += Math.sign(x || 1) * 5;
    const s = 0.8 + rand() * 1.0;
    m4.compose(new THREE.Vector3(x, 0.4 + s * 0.6, FAR_BANK_Z - 3 - rand() * 22), new THREE.Quaternion(), new THREE.Vector3(s * 1.3, s * (0.8 + rand() * 0.3), s));
    crowns.setMatrixAt(i, m4);
  }
  for (let i = 0; i < 30; i++) {
    let x = (rand() - 0.5) * 80;
    if (Math.abs(x) < 5) x += Math.sign(x || 1) * 6;
    const s = 0.7 + rand() * 0.6;
    m4.compose(new THREE.Vector3(x, 0.4 + 1.5 * s, FAR_BANK_Z - 4 - rand() * 16), new THREE.Quaternion(), new THREE.Vector3(s, s, s));
    cones.setMatrixAt(i, m4);
  }
  group.add(crowns, cones);

  // ---------- bridge deck, beams, piers ----------
  const deckSegs: Array<{ z: number }> = [];
  for (let z = 16; z > FAR_BANK_Z + 0.5; z -= 1) deckSegs.push({ z: z - 0.5 });
  const deck = new THREE.InstancedMesh(new THREE.BoxGeometry(BRIDGE_HALF * 2 + 0.1, 0.16, 1.02), wood, deckSegs.length);
  const fascia = new THREE.InstancedMesh(new THREE.BoxGeometry(0.1, 0.24, 1.03), lacquer, deckSegs.length * 2);
  deckSegs.forEach(({ z }, i) => {
    const y = deckY(z);
    const slope = Math.atan2(deckY(z - 0.5) - deckY(z + 0.5), 1);
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(slope, 0, 0));
    deck.setMatrixAt(i, m4.compose(new THREE.Vector3(0, y - 0.08, z), q, new THREE.Vector3(1, 1, 1)));
    for (const s of [-1, 1]) fascia.setMatrixAt(i * 2 + (s > 0 ? 1 : 0), m4.compose(new THREE.Vector3(s * (BRIDGE_HALF + 0.08), y - 0.14, z), q, new THREE.Vector3(1, 1, 1)));
  });
  group.add(deck, fascia);

  const pav = new THREE.Mesh(new THREE.BoxGeometry(PAVILION.half * 2 + 0.1, 0.2, PAVILION.z1 - PAVILION.z0 + 0.1), wood);
  pav.position.set(0, PAVILION.y - 0.1, (PAVILION.z0 + PAVILION.z1) / 2);
  group.add(pav);
  const pavTrim = new THREE.Mesh(new THREE.BoxGeometry(PAVILION.half * 2 + 0.3, 0.26, PAVILION.z1 - PAVILION.z0 + 0.3), lacquer);
  pavTrim.position.set(0, PAVILION.y - 0.24, (PAVILION.z0 + PAVILION.z1) / 2);
  group.add(pavTrim);

  const pierGeo = new THREE.CylinderGeometry(0.16, 0.2, 1, 10);
  const pierSpots: Array<[number, number]> = [];
  for (let z = 14; z > FAR_BANK_Z + 1; z -= 3) if (z > PAVILION.z1 + 0.5 || z < PAVILION.z0 - 0.5) for (const s of [-1, 1]) pierSpots.push([s * 1.1, z]);
  for (const x of [-2.3, -1.1, 1.1, 2.3]) for (const z of [PAVILION.z0 + 0.3, PAVILION.z1 - 0.3]) pierSpots.push([x, z]);
  const piers = new THREE.InstancedMesh(pierGeo, stone, pierSpots.length);
  pierSpots.forEach(([x, z], i) => {
    const top = deckY(z) - 0.15;
    piers.setMatrixAt(i, m4.compose(new THREE.Vector3(x, (top - 1) / 2, z), new THREE.Quaternion(), new THREE.Vector3(1, top + 1, 1)));
  });
  group.add(piers);

  // ---------- railings ----------
  const posts: THREE.Vector3[] = [];
  const rails: Array<[THREE.Vector3, THREE.Vector3]> = [];
  const railLine = (pts: P2[]) => {
    let prev: THREE.Vector3 | null = null;
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1];
      const b = pts[i];
      const len = Math.hypot(b.x - a.x, b.z - a.z);
      const n = Math.max(1, Math.round(len / 0.9));
      for (let k = i === 1 ? 0 : 1; k <= n; k++) {
        const x = a.x + ((b.x - a.x) * k) / n;
        const z = a.z + ((b.z - a.z) * k) / n;
        const p = new THREE.Vector3(x, deckY(z), z);
        posts.push(p);
        if (prev) rails.push([prev, p]);
        prev = p;
      }
    }
  };
  for (const s of [-1, 1]) {
    const B = BRIDGE_HALF * s;
    const P = PAVILION.half * s;
    railLine([{ x: B, z: 16 }, { x: B, z: PAVILION.z1 + 0.02 }, { x: P, z: PAVILION.z1 + 0.02 }, { x: P, z: PAVILION.z0 - 0.02 }, { x: B, z: PAVILION.z0 - 0.02 }, { x: B, z: FAR_BANK_Z + 0.6 }]);
  }
  const postMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(0.09, 0.8, 0.09), lacquer, posts.length);
  posts.forEach((p, i) => postMesh.setMatrixAt(i, m4.compose(p.clone().setY(p.y + 0.4), new THREE.Quaternion(), new THREE.Vector3(1, 1, 1))));
  const railMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), lacquer, rails.length * 2);
  rails.forEach(([a, b], i) => {
    railMesh.setMatrixAt(i * 2, beam(m4, a.clone().setY(a.y + 0.78), b.clone().setY(b.y + 0.78), 0.07));
    railMesh.setMatrixAt(i * 2 + 1, beam(m4, a.clone().setY(a.y + 0.38), b.clone().setY(b.y + 0.38), 0.04));
  });
  group.add(postMesh, railMesh);

  // ---------- lanterns on poles, with their reflections on the water ----------
  const lanternMat = new THREE.MeshStandardMaterial({ color: 0xd2321e, emissive: 0xff5a20, emissiveIntensity: 1.2, roughness: 0.6 });
  const glowMat = new THREE.SpriteMaterial({ map: T.glowTexture('rgba(255,200,120,0.95)', 'rgba(255,90,30,0.28)'), blending: THREE.AdditiveBlending, depthWrite: false });
  const reflMat = new THREE.MeshBasicMaterial({ map: T.glowTexture('rgba(255,170,90,0.9)', 'rgba(255,90,30,0.25)'), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.55 });
  const lanternSpots: P2[] = [];
  for (const s of [-1, 1]) {
    for (let z = 13; z > FAR_BANK_Z + 1; z -= 4) if (z > PAVILION.z1 + 0.5 || z < PAVILION.z0 - 0.5) lanternSpots.push({ x: s * (BRIDGE_HALF + 0.05), z });
    for (const z of [PAVILION.z0, (PAVILION.z0 + PAVILION.z1) / 2, PAVILION.z1]) lanternSpots.push({ x: s * (PAVILION.half + 0.05), z });
  }
  const bodyGeo = new THREE.SphereGeometry(0.17, 14, 10);
  const lanterns: THREE.Group[] = [];
  const glows: THREE.Sprite[] = [];
  for (const sp of lanternSpots) {
    const base = deckY(sp.z);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, 1.7, 6), darkWood);
    pole.position.set(sp.x, base + 0.85, sp.z);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.04, 0.04), darkWood);
    arm.position.set(sp.x + Math.sign(sp.x) * 0.18, base + 1.68, sp.z);
    group.add(pole, arm);
    const l = new THREE.Group();
    l.position.set(sp.x + Math.sign(sp.x) * 0.34, base + 1.42, sp.z);
    const body = new THREE.Mesh(bodyGeo, lanternMat);
    body.scale.y = 1.25;
    l.add(body);
    for (const y of [-0.22, 0.22]) {
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.05, 10), gold);
      cap.position.y = y;
      l.add(cap);
    }
    const glow = new THREE.Sprite(glowMat);
    glow.scale.setScalar(1.3);
    l.add(glow);
    glows.push(glow);
    group.add(l);
    lanterns.push(l);
    const refl = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 2.6), reflMat);
    refl.rotation.x = -Math.PI / 2;
    refl.position.set(sp.x + Math.sign(sp.x) * 0.75, 0.015, sp.z + 1.2);
    group.add(refl);
  }
  const pavLights = [-1, 1].flatMap((s) =>
    [PAVILION.z0, PAVILION.z1].map((z) => {
      const p = new THREE.PointLight(0xff9050, 3.2, 8, 1.3);
      p.position.set(s * (PAVILION.half + 0.35), PAVILION.y + 1.3, z);
      group.add(p);
      return p;
    })
  );

  // ---------- gate on the far bank with the channel name ----------
  const gate = new THREE.Group();
  gate.position.set(0, 0.4, FAR_BANK_Z - 0.4);
  group.add(gate);
  for (const s of [-1, 1]) {
    const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.26, 4.6, 14), lacquer);
    pillar.position.set(s * 2.4, 2.3, 0);
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.4, 0.7), stone);
    foot.position.set(s * 2.4, 0.2, 0);
    gate.add(pillar, foot);
  }
  const lintel = new THREE.Mesh(new THREE.BoxGeometry(5.6, 0.3, 0.4), lacquer);
  lintel.position.y = 3.65;
  const roof1 = new THREE.Mesh(new THREE.BoxGeometry(6.8, 0.22, 1.4), roofMat);
  roof1.position.y = 4.75;
  const roof2 = new THREE.Mesh(new THREE.BoxGeometry(5.2, 0.2, 1.1), roofMat);
  roof2.position.y = 5.1;
  const ridge = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.16, 0.2), gold);
  ridge.position.y = 5.28;
  gate.add(lintel, roof1, roof2, ridge);
  for (const s of [-1, 1]) {
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.6, 6), roofMat);
    tip.position.set(s * 3.45, 5.0, 0);
    tip.rotation.z = -s * 0.7;
    gate.add(tip);
  }
  const plaqueMat = new THREE.MeshBasicMaterial({ map: T.plaqueTexture('HOA ĐĂNG') });
  const plaque = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 0.8), plaqueMat);
  plaque.position.set(0, 4.2, 0.22);
  gate.add(plaque);
  const gateLight = new THREE.PointLight(0xffa060, 6, 9, 1.4);
  gateLight.position.set(0, 3, 2);
  gate.add(gateLight);

  // little warm lamps along the far bank, each with a streak on the water
  const lampGlow = new THREE.SpriteMaterial({ map: T.glowTexture('rgba(255,220,150,1)', 'rgba(255,150,60,0.3)'), blending: THREE.AdditiveBlending, depthWrite: false });
  for (let x = -26; x <= 26; x += 4.4) {
    if (Math.abs(x) < 3) continue;
    const g = new THREE.Sprite(lampGlow);
    g.position.set(x, 1.0, FAR_BANK_Z - 0.3);
    g.scale.setScalar(0.9);
    const refl = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 4), reflMat);
    refl.rotation.x = -Math.PI / 2;
    refl.position.set(x, 0.015, FAR_BANK_Z + 2.2);
    group.add(g, refl);
  }

  // ---------- lights ----------
  const hemi = new THREE.HemisphereLight(pal.hemi, pal.ground, pal.hemiI);
  const moonLight = new THREE.DirectionalLight(0xc8d4ff, pal.moonI);
  moonLight.position.copy(moonPos).normalize().multiplyScalar(30);
  group.add(hemi, moonLight);

  // ---------- fireflies over the water ----------
  const FLIES = 90;
  const flyGeo = new THREE.BufferGeometry();
  const flyPos = new Float32Array(FLIES * 3);
  const flySeed = Array.from({ length: FLIES }, () => ({ x: (Math.random() - 0.5) * 30, y: 0.4 + Math.random() * 2.2, z: FAR_BANK_Z + Math.random() * 30, p: Math.random() * 10 }));
  flyGeo.setAttribute('position', new THREE.BufferAttribute(flyPos, 3));
  const flies = new THREE.Points(flyGeo, new THREE.PointsMaterial({ size: 0.09, map: T.glowTexture('rgba(230,255,190,1)', 'rgba(170,255,120,0.4)'), color: 0xd8ffb0, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  group.add(flies);

  let flare = 0;
  updaters.push((t, dt) => {
    waterMat.uniforms.uTime.value = t;
    flare = Math.max(0, flare - dt * 0.35);
    waterMat.uniforms.uFlare.value = flare;
    skyMat.uniforms.uFlare.value = flare;
    moonHalo.scale.setScalar(34 * (1 + flare * 0.15) + Math.sin(t * 0.5) * 0.6);
    lanterns.forEach((l, i) => (l.rotation.z = Math.sin(t * 0.9 + i) * 0.05));
    glows.forEach((g, i) => g.scale.setScalar(1.3 * (1 + Math.sin(t * 7 + i * 1.7) * 0.04 + Math.sin(t * 13 + i) * 0.03) * (1 + flare * 0.15)));
    pavLights.forEach((p, i) => (p.intensity = (3.2 + Math.sin(t * 9 + i * 2) * 0.25) * (1 + flare * 0.4)));
    flySeed.forEach((f, i) => {
      flyPos[i * 3] = f.x + Math.sin(t * 0.3 + f.p) * 1.5;
      flyPos[i * 3 + 1] = f.y + Math.sin(t * 0.7 + f.p * 2) * 0.3;
      flyPos[i * 3 + 2] = f.z + Math.cos(t * 0.25 + f.p) * 1.2;
    });
    (flyGeo.attributes.position as THREE.BufferAttribute).needsUpdate = true;
  });

  return {
    group,
    moonPos,
    update: (t, dt) => updaters.forEach((u) => u(t, dt)),
    setPlaque: (text) => {
      plaqueMat.map?.dispose();
      plaqueMat.map = T.plaqueTexture(text.toUpperCase());
      plaqueMat.needsUpdate = true;
    },
    setTheme: (theme) => {
      const p = PALETTES[theme];
      skyMat.uniforms.uTop.value.set(p.skyTop);
      skyMat.uniforms.uHorizon.value.set(p.skyHorizon);
      skyMat.uniforms.uGlow.value.set(p.moonGlow);
      waterMat.uniforms.uDeep.value.set(p.waterDeep);
      waterMat.uniforms.uSky.value.set(p.waterSky);
      waterMat.uniforms.uFogColor.value.set(p.fog);
      hillFarMat.color.set(p.hillFar);
      hillNearMat.color.set(p.hillNear);
      hemi.color.set(p.hemi);
      hemi.groundColor.set(p.ground);
      hemi.intensity = p.hemiI;
      moonLight.intensity = p.moonI;
      starMat.opacity = p.stars;
    },
    flare: (amount) => {
      flare = Math.min(3, flare + amount);
    },
  };
}

export const FOG_COLORS = { night: PALETTES.night.fog, dusk: PALETTES.dusk.fog };
