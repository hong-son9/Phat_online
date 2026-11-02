import * as THREE from 'three';
import * as T from './textures';

// The hall, built from primitives: floor, aisle runner, columns, lanterns, a three-step altar,
// a stylised golden seated figure on a lotus throne with a radiant halo, candles and an incense burner.
// Faces +z (toward the camera and the rows of people).

export const BURNER = new THREE.Vector3(0, 0, -9.7);
export const ALTAR_Z = -15;

export type Temple = {
  group: THREE.Group;
  update: (t: number, dt: number) => void;
  setPlaque: (text: string) => void;
  setTheme: (theme: 'dusk' | 'night') => void;
  burnerTip: THREE.Vector3; // where smoke rises from
  glowAltar: (amount: number) => void; // 0..3, gifts make the halo flare
};

const lathe = (pts: Array<[number, number]>, seg = 28) => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), seg);

export function buildTemple(envMap: THREE.Texture | null): Temple {
  const group = new THREE.Group();
  const updaters: Array<(t: number, dt: number) => void> = [];

  // ---------- materials ----------
  const gold = new THREE.MeshStandardMaterial({ color: 0xc8902e, metalness: 1, roughness: 0.34, envMap, envMapIntensity: 0.9, emissive: 0x2a1504 });
  const darkGold = new THREE.MeshStandardMaterial({ color: 0x9c7230, metalness: 0.9, roughness: 0.45, envMap });
  const lacquer = new THREE.MeshStandardMaterial({ color: 0x7d1710, roughness: 0.42, metalness: 0.1, envMap, envMapIntensity: 0.5 });
  const darkWood = new THREE.MeshStandardMaterial({ color: 0x2b140b, roughness: 0.7 });
  const stone = new THREE.MeshStandardMaterial({ color: 0x5b4a3e, roughness: 0.85 });
  const bronze = new THREE.MeshStandardMaterial({ color: 0x6e4a26, metalness: 0.85, roughness: 0.38, envMap });
  const cloth = new THREE.MeshStandardMaterial({ color: 0xa3261a, roughness: 0.9 });
  const pink = new THREE.MeshStandardMaterial({ color: 0xf0a3b8, roughness: 0.55, emissive: 0x3a0f18 });

  // ---------- floor, runner, walls ----------
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(18, 34), new THREE.MeshStandardMaterial({ map: T.floorTexture(), roughness: 0.6, metalness: 0, envMap, envMapIntensity: 0.12 }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.z = -3;
  group.add(floor);

  const carpetTex = T.carpetTexture();
  carpetTex.repeat.set(1, 4);
  const carpet = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 20), new THREE.MeshStandardMaterial({ map: carpetTex, roughness: 0.95 }));
  carpet.rotation.x = -Math.PI / 2;
  carpet.position.set(0, 0.01, 0.3);
  group.add(carpet);

  const wallTex = T.wallTexture();
  wallTex.repeat.set(4, 2);
  const wallMat = new THREE.MeshStandardMaterial({ map: wallTex, roughness: 0.7 });
  const back = new THREE.Mesh(new THREE.PlaneGeometry(18, 12), wallMat);
  back.position.set(0, 6, -18.5);
  group.add(back);
  for (const s of [-1, 1]) {
    const side = new THREE.Mesh(new THREE.PlaneGeometry(34, 12), wallMat);
    side.position.set(s * 7.6, 6, -3);
    side.rotation.y = -s * Math.PI / 2;
    group.add(side);
  }
  const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(18, 34), darkWood);
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.set(0, 10, -3);
  group.add(ceiling);
  for (let z = -16; z <= 10; z += 3.2) {
    const beam = new THREE.Mesh(new THREE.BoxGeometry(15.2, 0.35, 0.4), lacquer);
    beam.position.set(0, 9.6, z);
    group.add(beam);
  }

  // ---------- columns ----------
  const colGeo = new THREE.CylinderGeometry(0.3, 0.34, 10, 20);
  const ringGeo = new THREE.TorusGeometry(0.36, 0.06, 8, 24);
  const baseGeo = new THREE.CylinderGeometry(0.5, 0.56, 0.4, 12);
  for (const x of [-4.9, 4.9]) {
    for (const z of [-14, -9, -4, 1, 6]) {
      const col = new THREE.Mesh(colGeo, lacquer);
      col.position.set(x, 5, z);
      group.add(col);
      const base = new THREE.Mesh(baseGeo, stone);
      base.position.set(x, 0.2, z);
      group.add(base);
      for (const y of [0.55, 8.6, 9.0]) {
        const ring = new THREE.Mesh(ringGeo, gold);
        ring.rotation.x = Math.PI / 2;
        ring.position.set(x, y, z);
        group.add(ring);
      }
    }
  }

  // ---------- altar steps ----------
  [[0, 12.4, 10.6], [0.28, 10.8, 11.4], [0.56, 9.2, 12.2]].forEach(([y, w, zFront]) => {
    const depth = 18.4 - zFront;
    const step = new THREE.Mesh(new THREE.BoxGeometry(w, 0.28, depth), stone);
    step.position.set(0, y + 0.14, -(zFront + depth / 2));
    group.add(step);
    const trim = new THREE.Mesh(new THREE.BoxGeometry(w, 0.05, 0.05), darkGold);
    trim.position.set(0, y + 0.28, -zFront);
    group.add(trim);
  });
  const TOP = 0.84;

  // ---------- lotus throne ----------
  const throne = new THREE.Group();
  throne.position.set(0, TOP, ALTAR_Z);
  group.add(throne);
  const drum = new THREE.Mesh(new THREE.CylinderGeometry(1.35, 1.55, 0.7, 32), lacquer);
  drum.position.y = 0.35;
  throne.add(drum);
  const drumRing = new THREE.Mesh(new THREE.TorusGeometry(1.4, 0.05, 8, 40), gold);
  drumRing.rotation.x = Math.PI / 2;
  drumRing.position.y = 0.7;
  throne.add(drumRing);
  const petalGeo = new THREE.SphereGeometry(1, 16, 12);
  [[18, 1.55, 0.95, 0.42], [14, 1.25, 1.12, 0.36]].forEach(([n, r, y, s], layer) => {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + layer * 0.2;
      const p = new THREE.Mesh(petalGeo, layer ? gold : pink);
      p.scale.set(s * 0.62, s, s * 0.3);
      p.position.set(Math.sin(a) * r, y, Math.cos(a) * r);
      p.rotation.set(0, a, 0);
      p.rotateX(0.55);
      throne.add(p);
    }
  });

  // ---------- seated figure ----------
  const figure = new THREE.Group();
  figure.position.set(0, TOP + 1.05, ALTAR_Z);
  group.add(figure);
  const legs = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 20), gold);
  legs.scale.set(1.25, 0.42, 0.85);
  legs.position.y = 0.3;
  figure.add(legs);
  const torso = new THREE.Mesh(lathe([[0, 0], [0.82, 0.05], [0.66, 0.6], [0.72, 1.2], [0.6, 1.55], [0.24, 1.75], [0, 1.78]]), gold);
  torso.position.y = 0.45;
  figure.add(torso);
  // folded robe over one shoulder
  const sash = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.08, 10, 32, Math.PI * 1.1), darkGold);
  sash.position.set(0.05, 1.45, 0.05);
  sash.rotation.set(0.15, 0.2, 2.2);
  figure.add(sash);
  for (const s of [-1, 1]) {
    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.17, 0.75, 6, 12), gold);
    arm.position.set(s * 0.68, 1.35, 0.12);
    arm.rotation.set(-0.35, 0, s * 0.18);
    figure.add(arm);
    const fore = new THREE.Mesh(new THREE.CapsuleGeometry(0.15, 0.55, 6, 12), gold);
    fore.position.set(s * 0.42, 0.78, 0.55);
    fore.rotation.set(Math.PI / 2 - 0.3, 0, s * -1.0);
    figure.add(fore);
  }
  const hands = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), gold);
  hands.scale.set(0.34, 0.12, 0.24);
  hands.position.set(0, 0.68, 0.72);
  figure.add(hands);
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.22, 0.3, 16), gold);
  neck.position.y = 2.3;
  figure.add(neck);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.44, 32, 24), gold);
  head.scale.set(0.92, 1.05, 0.95);
  head.position.y = 2.75;
  figure.add(head);
  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.455, 32, 16, 0, Math.PI * 2, 0, Math.PI * 0.42), darkGold);
  hair.position.y = 2.78;
  hair.rotation.x = -0.12;
  figure.add(hair);
  const crown = new THREE.Mesh(new THREE.SphereGeometry(0.2, 20, 14), darkGold);
  crown.position.y = 3.25;
  figure.add(crown);
  for (const s of [-1, 1]) {
    const ear = new THREE.Mesh(new THREE.SphereGeometry(0.08, 10, 10), gold);
    ear.scale.set(0.7, 2.6, 0.9);
    ear.position.set(s * 0.42, 2.62, 0);
    figure.add(ear);
  }

  // ---------- halo ----------
  const haloMat = new THREE.MeshBasicMaterial({ map: T.haloTexture(), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
  const halo = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 3.2), haloMat);
  halo.position.set(0, TOP + 3.85, ALTAR_Z - 0.6);
  group.add(halo);
  const auraMat = new THREE.MeshBasicMaterial({ map: T.glowTexture('rgba(255,215,140,0.6)', 'rgba(255,160,60,0.18)'), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
  const aura = new THREE.Mesh(new THREE.PlaneGeometry(9, 10), auraMat);
  aura.position.set(0, TOP + 2.8, ALTAR_Z - 0.9);
  group.add(aura);

  // ---------- plaque ----------
  const plaqueMat = new THREE.MeshBasicMaterial({ map: T.plaqueTexture('AN NHIÊN') });
  const plaque = new THREE.Mesh(new THREE.PlaneGeometry(5.6, 1.05), plaqueMat);
  plaque.position.set(0, 8.3, -18.4);
  group.add(plaque);

  // ---------- altar table, candles, flowers ----------
  const table = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.9, 1.0), cloth);
  table.position.set(0, TOP + 0.45, -12.9);
  group.add(table);
  const tableTop = new THREE.Mesh(new THREE.BoxGeometry(3.8, 0.08, 1.15), darkGold);
  tableTop.position.set(0, TOP + 0.93, -12.9);
  group.add(tableTop);
  const flameTex = T.glowTexture('rgba(255,250,220,1)', 'rgba(255,170,60,0.5)');
  const flames: THREE.Sprite[] = [];
  const candleLights: THREE.PointLight[] = [];
  for (const x of [-1.45, 1.45]) {
    const candle = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 0.55, 12), new THREE.MeshStandardMaterial({ color: 0xf2e6cc, roughness: 0.6, emissive: 0x2a1a08 }));
    candle.position.set(x, TOP + 1.25, -12.9);
    group.add(candle);
    const flame = new THREE.Sprite(new THREE.SpriteMaterial({ map: flameTex, blending: THREE.AdditiveBlending, depthWrite: false }));
    flame.position.set(x, TOP + 1.62, -12.9);
    flame.scale.set(0.3, 0.45, 1);
    group.add(flame);
    flames.push(flame);
    const light = new THREE.PointLight(0xffb060, 3, 7, 1.6);
    light.position.set(x, TOP + 1.8, -12.6);
    group.add(light);
    candleLights.push(light);
  }
  for (const x of [-0.75, 0.75]) {
    const vase = new THREE.Mesh(lathe([[0, 0], [0.14, 0.02], [0.2, 0.2], [0.1, 0.42], [0.14, 0.5]], 16), bronze);
    vase.position.set(x, TOP + 0.97, -12.9);
    group.add(vase);
    for (let i = 0; i < 3; i++) {
      const bud = new THREE.Mesh(petalGeo, pink);
      bud.scale.set(0.1, 0.14, 0.1);
      bud.position.set(x + (i - 1) * 0.12, TOP + 1.62 + (i % 2) * 0.12, -12.9);
      group.add(bud);
    }
  }
  const plate = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.2, 0.06, 20), darkGold);
  plate.position.set(0, TOP + 1.0, -12.85);
  group.add(plate);
  const fruitMat = new THREE.MeshStandardMaterial({ color: 0xf0a020, roughness: 0.5 });
  for (let i = 0; i < 5; i++) {
    const f = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 10), fruitMat);
    f.position.set(Math.cos(i * 1.3) * 0.15, TOP + 1.1 + (i === 4 ? 0.1 : 0), -12.85 + Math.sin(i * 1.3) * 0.12);
    group.add(f);
  }

  // ---------- incense burner ----------
  const burner = new THREE.Group();
  burner.position.copy(BURNER);
  group.add(burner);
  const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.65, 0.5, 6), lacquer);
  stand.position.y = 0.25;
  burner.add(stand);
  const bowl = new THREE.Mesh(lathe([[0, 0], [0.3, 0.02], [0.5, 0.2], [0.55, 0.42], [0.48, 0.5], [0.5, 0.55]], 24), bronze);
  bowl.position.y = 0.5;
  burner.add(bowl);
  for (const s of [-1, 1]) {
    const handle = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.03, 8, 16), bronze);
    handle.position.set(s * 0.58, 0.95, 0);
    handle.rotation.y = Math.PI / 2;
    burner.add(handle);
  }
  const stickMat = new THREE.MeshStandardMaterial({ color: 0x8a3a1a, roughness: 0.8 });
  const tipTex = T.glowTexture('rgba(255,120,60,1)', 'rgba(255,60,20,0.4)');
  const tips: THREE.Sprite[] = [];
  for (let i = 0; i < 7; i++) {
    const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.7, 5), stickMat);
    const x = (i - 3) * 0.08;
    stick.position.set(x, 1.3, (i % 2) * 0.06 - 0.03);
    stick.rotation.z = (i - 3) * 0.05;
    burner.add(stick);
    const tip = new THREE.Sprite(new THREE.SpriteMaterial({ map: tipTex, blending: THREE.AdditiveBlending, depthWrite: false }));
    tip.position.set(x + (i - 3) * 0.018, 1.66, (i % 2) * 0.06 - 0.03);
    tip.scale.setScalar(0.09);
    burner.add(tip);
    tips.push(tip);
  }
  const burnerTip = new THREE.Vector3(BURNER.x, 1.7, BURNER.z);

  // ---------- lanterns ----------
  const lanternMat = new THREE.MeshStandardMaterial({ color: 0xd2321e, emissive: 0xff5a20, emissiveIntensity: 0.9, roughness: 0.6 });
  const lanternGlowMat = new THREE.SpriteMaterial({ map: T.glowTexture('rgba(255,200,120,0.9)', 'rgba(255,90,30,0.25)'), blending: THREE.AdditiveBlending, depthWrite: false });
  const lanterns: THREE.Group[] = [];
  for (const x of [-3, 3]) {
    for (const z of [-11, -6.5, -2, 2.5]) {
      const l = new THREE.Group();
      l.position.set(x, 6.6, z);
      const body = new THREE.Mesh(new THREE.SphereGeometry(0.34, 16, 12), lanternMat);
      body.scale.y = 1.2;
      l.add(body);
      for (const y of [-0.42, 0.42]) {
        const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.08, 12), darkGold);
        cap.position.y = y;
        l.add(cap);
      }
      const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 3, 4), darkWood);
      cord.position.y = 1.9;
      l.add(cord);
      const tassel = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.35, 8), lanternMat);
      tassel.position.y = -0.65;
      tassel.rotation.x = Math.PI;
      l.add(tassel);
      const glow = new THREE.Sprite(lanternGlowMat);
      glow.scale.setScalar(1.9);
      l.add(glow);
      group.add(l);
      lanterns.push(l);
    }
  }
  const lanternLights = [-1, 1].map((s) => {
    const p = new THREE.PointLight(0xff8a4a, 4, 14, 1.5);
    p.position.set(s * 3, 6, -4);
    group.add(p);
    return p;
  });

  // ---------- light shafts ----------
  const rayMat = new THREE.MeshBasicMaterial({ map: T.rayTexture(), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, opacity: 0.32 });
  const rays: THREE.Mesh[] = [];
  [[-3.5, -11, 0.42], [-1.2, -13, 0.36], [2.2, -12, 0.4]].forEach(([x, z, tilt], i) => {
    const r = new THREE.Mesh(new THREE.PlaneGeometry(1.6 + i * 0.4, 12), rayMat);
    r.position.set(x, 5, z);
    r.rotation.set(0, 0.2, -tilt);
    group.add(r);
    rays.push(r);
  });

  // ---------- lights ----------
  const hemi = new THREE.HemisphereLight(0xffdcae, 0x2a1408, 0.85);
  group.add(hemi);
  const key = new THREE.DirectionalLight(0xffd8a8, 1.1);
  key.position.set(3, 10, 8);
  group.add(key);
  const statueSpot = new THREE.SpotLight(0xffc878, 22, 30, 0.4, 0.6, 1.2);
  statueSpot.position.set(0, 8.5, -6);
  statueSpot.target.position.set(0, 3, ALTAR_Z);
  group.add(statueSpot, statueSpot.target);

  // ---------- incense smoke ----------
  const smokeMat = new THREE.SpriteMaterial({ map: T.smokeTexture(), transparent: true, depthWrite: false, opacity: 0.5 });
  const smoke = Array.from({ length: 26 }, (_, i) => {
    const s = new THREE.Sprite(smokeMat.clone());
    s.userData.age = (i / 26) * 7;
    group.add(s);
    return s;
  });

  // ---------- dust in the light ----------
  const dustGeo = new THREE.BufferGeometry();
  const DUST = 220;
  const dustPos = new Float32Array(DUST * 3);
  for (let i = 0; i < DUST; i++) {
    dustPos[i * 3] = (Math.random() - 0.5) * 10;
    dustPos[i * 3 + 1] = Math.random() * 8;
    dustPos[i * 3 + 2] = -16 + Math.random() * 18;
  }
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
  const dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({ size: 0.06, map: T.glowTexture(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, color: 0xffe0a0, opacity: 0.7 }));
  group.add(dust);

  let flare = 0;
  updaters.push((t, dt) => {
    flames.forEach((f, i) => {
      const k = 1 + Math.sin(t * 13 + i * 2) * 0.08 + Math.sin(t * 29 + i) * 0.05;
      f.scale.set(0.3 * k, 0.45 * k, 1);
      candleLights[i].intensity = 3 * k;
    });
    tips.forEach((tip, i) => (tip.material.opacity = 0.75 + Math.sin(t * 3 + i * 1.7) * 0.25));
    lanterns.forEach((l, i) => (l.rotation.z = Math.sin(t * 0.6 + i) * 0.03));
    flare = Math.max(0, flare - dt * 0.35);
    haloMat.opacity = 0.55 + Math.sin(t * 0.8) * 0.1 + flare * 0.35;
    halo.rotation.z = t * 0.03;
    halo.scale.setScalar(1 + flare * 0.12);
    auraMat.opacity = 0.4 + flare * 0.3;
    statueSpot.intensity = 22 + flare * 25;
    rays.forEach((r, i) => ((r.material as THREE.MeshBasicMaterial).opacity = 0.26 + Math.sin(t * 0.35 + i * 2) * 0.08));
    smoke.forEach((s) => {
      s.userData.age += dt;
      const life = 7;
      if (s.userData.age > life) {
        s.userData.age = 0;
        s.userData.dx = (Math.random() - 0.5) * 0.3;
      }
      const a = s.userData.age / life;
      s.position.set(burnerTip.x + Math.sin(a * 6 + t * 0.5) * 0.25 * a + (s.userData.dx ?? 0) * a, burnerTip.y + a * 4.2, burnerTip.z - a * 0.6);
      s.scale.setScalar(0.2 + a * 1.2);
      s.material.opacity = Math.sin(Math.PI * a) * 0.16;
      s.material.rotation = a * 2;
    });
    const pos = dustGeo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < DUST; i++) {
      let y = pos.getY(i) + dt * 0.05;
      if (y > 8) y = 0;
      pos.setY(i, y);
      pos.setX(i, pos.getX(i) + Math.sin(t * 0.3 + i) * dt * 0.03);
    }
    pos.needsUpdate = true;
  });

  return {
    group,
    burnerTip,
    update: (t, dt) => updaters.forEach((u) => u(t, dt)),
    setPlaque: (text) => {
      plaqueMat.map?.dispose();
      plaqueMat.map = T.plaqueTexture(text.toUpperCase());
      plaqueMat.needsUpdate = true;
    },
    setTheme: (theme) => {
      const night = theme === 'night';
      hemi.color.set(night ? 0x8090c8 : 0xffdcae);
      hemi.groundColor.set(night ? 0x0c0812 : 0x2a1408);
      hemi.intensity = night ? 0.45 : 0.85;
      key.intensity = night ? 0.35 : 1.1;
      key.color.set(night ? 0x9fb0ff : 0xffd8a8);
      lanternLights.forEach((l) => (l.intensity = night ? 9 : 4));
      lanternMat.emissiveIntensity = night ? 1.6 : 0.9;
      rayMat.color.set(night ? 0x9ab0ff : 0xffffff);
    },
    glowAltar: (amount) => {
      flare = Math.min(3, flare + amount);
    },
  };
}
