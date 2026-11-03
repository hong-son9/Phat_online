import * as THREE from 'three';
import { scrollTexture } from './textures';

// The calligrapher's scrolls in people's hands. (Fireworks are in fireworks.ts, the lion dance in lion.ts.)

// ---------- the calligrapher's scrolls ----------

const scrollTextures = new Map<string, THREE.Texture>();

export class Scrolls {
  group = new THREE.Group();
  private items = new Map<string, THREE.Group>();
  private rodMat = new THREE.MeshStandardMaterial({ color: 0x5a3418, roughness: 0.6 });
  private rodGeo = new THREE.CylinderGeometry(0.022, 0.022, 0.42, 8);
  private paperGeo = new THREE.PlaneGeometry(0.36, 0.56);

  private make(word: string) {
    let tex = scrollTextures.get(word);
    if (!tex) {
      tex = scrollTexture(word);
      scrollTextures.set(word, tex);
    }
    const g = new THREE.Group();
    const paper = new THREE.Mesh(this.paperGeo, new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide }));
    g.add(paper);
    for (const y of [0.29, -0.29]) {
      const rod = new THREE.Mesh(this.rodGeo, this.rodMat);
      rod.rotation.z = Math.PI / 2;
      rod.position.y = y;
      g.add(rod);
    }
    this.group.add(g);
    return g;
  }

  // Show the scroll for this offer at `pos`, facing the camera-ish direction `heading`
  show(id: string, word: string, pos: THREE.Vector3, heading: number, scale = 1) {
    let g = this.items.get(id);
    if (!g) {
      g = this.make(word);
      this.items.set(id, g);
    }
    g.visible = true;
    g.position.copy(pos);
    g.rotation.set(0, heading + Math.PI, 0);
    g.scale.setScalar(scale);
    g.userData.seen = true;
  }

  // Hide any scroll not shown this frame; drop the ones whose offer has ended
  endFrame(live: Set<string>) {
    for (const [id, g] of this.items) {
      if (!g.userData.seen) g.visible = false;
      g.userData.seen = false;
      if (!live.has(id)) {
        this.group.remove(g);
        ((g.children[0] as THREE.Mesh).material as THREE.Material).dispose();
        this.items.delete(id);
      }
    }
  }
}
