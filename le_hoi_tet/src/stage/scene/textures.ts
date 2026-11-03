import * as THREE from 'three';

// Every texture is painted on a canvas at startup: no image files to license or download.

export function canvas(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d')!);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

const noise = (g: CanvasRenderingContext2D, w: number, h: number, amount: number) => {
  const img = g.getImageData(0, 0, w, h);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (Math.random() - 0.5) * amount;
    img.data[i] += n;
    img.data[i + 1] += n;
    img.data[i + 2] += n;
  }
  g.putImageData(img, 0, 0);
};

const SERIF = 'Lora, Georgia, serif';

// ---------- ground ----------

// Old red Bát Tràng bricks in a courtyard
export function groundTexture() {
  const t = canvas(512, 512, (g) => {
    g.fillStyle = '#6b3a28';
    g.fillRect(0, 0, 512, 512);
    const bw = 64;
    const bh = 32;
    for (let row = 0; row < 16; row++) {
      for (let col = -1; col < 9; col++) {
        const x = col * bw + (row % 2 ? bw / 2 : 0);
        const y = row * bh;
        const r = 150 + Math.random() * 40;
        g.fillStyle = `rgb(${r},${r * 0.48 + Math.random() * 12},${r * 0.34})`;
        g.fillRect(x + 2, y + 2, bw - 4, bh - 4);
        g.fillStyle = 'rgba(255,220,180,0.06)';
        g.fillRect(x + 2, y + 2, bw - 4, 4);
      }
    }
    noise(g, 512, 512, 16);
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(6, 12);
  return t;
}

// Red runner down the middle of the street with a gold border and apricot-blossom motifs
export function carpetTexture() {
  const t = canvas(256, 1024, (g) => {
    g.fillStyle = '#a3141a';
    g.fillRect(0, 0, 256, 1024);
    g.fillStyle = '#e9b23c';
    g.fillRect(8, 0, 12, 1024);
    g.fillRect(236, 0, 12, 1024);
    g.fillStyle = '#7a0d12';
    g.fillRect(24, 0, 4, 1024);
    g.fillRect(228, 0, 4, 1024);
    for (let y = 64; y < 1024; y += 128) flower(g, 128, y, 26, '#f4c542', '#c46a12');
    noise(g, 256, 1024, 12);
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

// A five-petal flower (mai / đào)
function flower(g: CanvasRenderingContext2D, x: number, y: number, r: number, petal: string, heart: string) {
  g.save();
  g.translate(x, y);
  g.fillStyle = petal;
  for (let k = 0; k < 5; k++) {
    g.rotate((Math.PI * 2) / 5);
    g.beginPath();
    g.ellipse(0, -r * 0.55, r * 0.42, r * 0.55, 0, 0, Math.PI * 2);
    g.fill();
  }
  g.fillStyle = heart;
  g.beginPath();
  g.arc(0, 0, r * 0.22, 0, Math.PI * 2);
  g.fill();
  g.restore();
}

// ---------- red paper and cloth with writing ----------

export function bannerTexture(text: string, sub = '') {
  return canvas(2048, 320, (g) => {
    const grad = g.createLinearGradient(0, 0, 0, 320);
    grad.addColorStop(0, '#d11b1f');
    grad.addColorStop(1, '#9c0f14');
    g.fillStyle = grad;
    g.fillRect(0, 0, 2048, 320);
    g.strokeStyle = '#f3c650';
    g.lineWidth = 10;
    g.strokeRect(14, 14, 2020, 292);
    for (const x of [140, 1908]) flower(g, x, 160, 90, '#f6c84a', '#b5530c');
    g.fillStyle = '#ffd960';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.shadowColor = 'rgba(120,20,0,0.8)';
    g.shadowBlur = 8;
    g.shadowOffsetY = 4;
    g.font = `700 ${sub ? 150 : 170}px ${SERIF}`;
    g.fillText(text, 1024, sub ? 130 : 165, 1600);
    if (sub) {
      g.font = `600 62px ${SERIF}`;
      g.fillText(sub, 1024, 250, 1500);
    }
  });
}

// Vertical couplet (câu đối): words stacked top to bottom
export function coupletTexture(words: string[]) {
  return canvas(160, 900, (g) => {
    g.fillStyle = '#c4161c';
    g.fillRect(0, 0, 160, 900);
    g.strokeStyle = '#efc04c';
    g.lineWidth = 6;
    g.strokeRect(8, 8, 144, 884);
    g.fillStyle = '#1d1208';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.font = `700 78px ${SERIF}`;
    const step = 860 / words.length;
    words.forEach((w, i) => g.fillText(w, 80, 30 + step * (i + 0.5), 140));
  });
}

// A calligraphy scroll from the ông đồ: one big word on red paper, with a little seal
export function scrollTexture(word: string) {
  return canvas(256, 400, (g) => {
    g.fillStyle = '#d0181e';
    g.fillRect(0, 0, 256, 400);
    g.fillStyle = 'rgba(255,220,150,0.18)';
    for (let i = 0; i < 40; i++) g.fillRect(Math.random() * 256, Math.random() * 400, 2 + Math.random() * 6, 1);
    g.strokeStyle = '#f2c14e';
    g.lineWidth = 5;
    g.strokeRect(10, 10, 236, 380);
    g.fillStyle = '#140c06';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.font = `italic 700 ${word.length > 4 ? 92 : 128}px ${SERIF}`;
    g.fillText(word, 128, 185, 220);
    g.fillStyle = '#b3121a';
    g.fillRect(170, 310, 44, 44);
    g.strokeStyle = '#fff1c8';
    g.lineWidth = 3;
    g.strokeRect(176, 316, 32, 32);
  });
}

// Wooden board with gold letters (the gate's name board shows the channel name)
export function plaqueTexture(text: string) {
  return canvas(1024, 220, (g) => {
    const grad = g.createLinearGradient(0, 0, 0, 220);
    grad.addColorStop(0, '#5b1d10');
    grad.addColorStop(1, '#3a1109');
    g.fillStyle = grad;
    g.fillRect(0, 0, 1024, 220);
    g.strokeStyle = '#e7b54a';
    g.lineWidth = 12;
    g.strokeRect(12, 12, 1000, 196);
    g.lineWidth = 3;
    g.strokeRect(30, 30, 964, 160);
    g.fillStyle = '#ffd660';
    g.font = `700 104px ${SERIF}`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.shadowColor = 'rgba(255,200,90,0.7)';
    g.shadowBlur = 14;
    g.fillText(text, 512, 116, 920);
  });
}

// Stall sign: a red board with yellow letters
export function signTexture(text: string) {
  return canvas(512, 128, (g) => {
    g.fillStyle = '#b31217';
    g.fillRect(0, 0, 512, 128);
    g.strokeStyle = '#f0c24a';
    g.lineWidth = 6;
    g.strokeRect(6, 6, 500, 116);
    g.fillStyle = '#ffe07a';
    g.font = `700 64px ${SERIF}`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(text, 256, 68, 470);
  });
}

// ---------- roofs, stalls, goods ----------

// Rows of half-round terracotta tiles
export function tileTexture() {
  const t = canvas(256, 256, (g) => {
    g.fillStyle = '#6e2a17';
    g.fillRect(0, 0, 256, 256);
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const x = col * 32 + (row % 2 ? 16 : 0);
        const y = row * 32;
        const grad = g.createLinearGradient(x, 0, x + 32, 0);
        grad.addColorStop(0, '#7f3119');
        grad.addColorStop(0.5, '#b55a32');
        grad.addColorStop(1, '#7f3119');
        g.fillStyle = grad;
        g.beginPath();
        g.ellipse(x + 16, y + 20, 15, 18, 0, Math.PI, 0);
        g.lineTo(x + 31, y + 32);
        g.lineTo(x + 1, y + 32);
        g.fill();
      }
    }
    noise(g, 256, 256, 14);
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

// Striped awning cloth with a scalloped bottom edge (transparent below the scallops)
export function awningTexture(a: string, b: string) {
  return canvas(256, 256, (g) => {
    for (let i = 0; i < 8; i++) {
      g.fillStyle = i % 2 ? b : a;
      g.fillRect(i * 32, 0, 32, 216);
      g.beginPath();
      g.arc(i * 32 + 16, 216, 16, 0, Math.PI);
      g.fill();
    }
    g.fillStyle = 'rgba(0,0,0,0.12)';
    g.fillRect(0, 0, 256, 10);
  });
}

// Bánh chưng: green dong leaves tied with bamboo strings
export function banhChungTexture() {
  return canvas(128, 128, (g) => {
    g.fillStyle = '#2f6b2a';
    g.fillRect(0, 0, 128, 128);
    g.strokeStyle = 'rgba(160,210,120,0.35)';
    for (let i = 0; i < 14; i++) {
      g.beginPath();
      g.moveTo(Math.random() * 128, 0);
      g.lineTo(Math.random() * 128, 128);
      g.stroke();
    }
    g.strokeStyle = '#e6d39a';
    g.lineWidth = 6;
    for (const p of [42, 86]) {
      g.beginPath();
      g.moveTo(p, 0);
      g.lineTo(p, 128);
      g.moveTo(0, p);
      g.lineTo(128, p);
      g.stroke();
    }
  });
}

export function watermelonTexture() {
  return canvas(128, 64, (g) => {
    g.fillStyle = '#2e6b23';
    g.fillRect(0, 0, 128, 64);
    g.fillStyle = '#1a4513';
    for (let i = 0; i < 10; i++) {
      g.beginPath();
      const x = i * 13;
      g.moveTo(x, 0);
      g.bezierCurveTo(x + 6, 20, x - 4, 44, x + 3, 64);
      g.lineTo(x + 7, 64);
      g.bezierCurveTo(x, 44, x + 10, 20, x + 5, 0);
      g.fill();
    }
  });
}

// Brocade for áo dài: light motifs on a slightly darker ground. White-ish, so each person's
// instance colour tints it into their own áo dài colour with the pattern showing through.
export function brocadeTexture() {
  const t = canvas(256, 256, (g) => {
    g.fillStyle = '#d9d4cf';
    g.fillRect(0, 0, 256, 256);
    g.globalAlpha = 0.9;
    for (let y = 0; y < 4; y++) {
      for (let x = 0; x < 4; x++) {
        const cx = x * 64 + (y % 2 ? 32 : 0) + 16;
        const cy = y * 64 + 32;
        flower(g, cx, cy, 14, '#ffffff', '#fff2c4');
      }
    }
    g.globalAlpha = 0.5;
    g.strokeStyle = '#ffffff';
    g.lineWidth = 2;
    for (let y = 0; y < 256; y += 64) {
      g.beginPath();
      for (let x = 0; x <= 256; x += 8) g.lineTo(x, y + Math.sin(x / 16) * 6 + 2);
      g.stroke();
    }
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(3, 2);
  return t;
}

// ---------- flowers, petals, sky ----------

// One blossom seen from the front, for trees and falling petals. Peach = pink, apricot (mai) = yellow.
export function blossomTexture(kind: 'dao' | 'mai') {
  return canvas(64, 64, (g) => {
    if (kind === 'dao') flower(g, 32, 32, 30, '#ffb3c9', '#d2386a');
    else flower(g, 32, 32, 30, '#ffd23f', '#d07a0a');
    g.fillStyle = 'rgba(255,255,255,0.45)';
    g.beginPath();
    g.arc(28, 26, 6, 0, Math.PI * 2);
    g.fill();
  });
}

export function petalTexture(kind: 'dao' | 'mai' = 'dao') {
  return canvas(64, 96, (g) => {
    const grad = g.createLinearGradient(0, 96, 0, 0);
    if (kind === 'dao') {
      grad.addColorStop(0, '#fff2f6');
      grad.addColorStop(0.55, '#ffb6cb');
      grad.addColorStop(1, '#f07ea0');
    } else {
      grad.addColorStop(0, '#fff6c8');
      grad.addColorStop(0.55, '#ffd94a');
      grad.addColorStop(1, '#f2a91a');
    }
    g.fillStyle = grad;
    g.beginPath();
    g.moveTo(32, 94);
    g.bezierCurveTo(0, 70, 2, 16, 32, 4);
    g.bezierCurveTo(62, 16, 64, 70, 32, 94);
    g.fill();
  });
}

// Sky backdrop: a spring morning, or a deep blue New Year's Eve with stars
export function skyTexture(theme: 'dusk' | 'night') {
  return canvas(512, 1024, (g) => {
    const grad = g.createLinearGradient(0, 0, 0, 1024);
    if (theme === 'night') {
      grad.addColorStop(0, '#040714');
      grad.addColorStop(0.6, '#0d1636');
      grad.addColorStop(1, '#3a1e3a');
    } else {
      grad.addColorStop(0, '#2a78d4');
      grad.addColorStop(0.45, '#5fa9ec');
      grad.addColorStop(0.8, '#b5dcf6');
      grad.addColorStop(1, '#ffe8cf');
    }
    g.fillStyle = grad;
    g.fillRect(0, 0, 512, 1024);
    if (theme === 'night') {
      for (let i = 0; i < 260; i++) {
        g.fillStyle = `rgba(255,255,240,${0.3 + Math.random() * 0.7})`;
        const r = Math.random() < 0.08 ? 1.6 : 0.8;
        g.beginPath();
        g.arc(Math.random() * 512, Math.random() * 700, r, 0, Math.PI * 2);
        g.fill();
      }
    } else {
      for (let i = 0; i < 9; i++) {
        const x = Math.random() * 512;
        const y = 120 + Math.random() * 500;
        for (let k = 0; k < 6; k++) {
          const cg = g.createRadialGradient(x + k * 18, y + Math.sin(k) * 8, 0, x + k * 18, y + Math.sin(k) * 8, 40);
          cg.addColorStop(0, 'rgba(255,255,255,0.7)');
          cg.addColorStop(1, 'rgba(255,255,255,0)');
          g.fillStyle = cg;
          g.fillRect(x - 60, y - 60, 260, 140);
        }
      }
    }
  });
}

// Distant village: hills, bamboo, rooftops, as a silhouette strip
export function villageTexture(theme: 'dusk' | 'night') {
  return canvas(1024, 256, (g) => {
    const far = theme === 'night' ? '#141a33' : '#8fb39a';
    const near = theme === 'night' ? '#0c1022' : '#5f8a5c';
    g.fillStyle = far;
    g.beginPath();
    g.moveTo(0, 256);
    for (let x = 0; x <= 1024; x += 16) g.lineTo(x, 120 + Math.sin(x / 90) * 30 + Math.sin(x / 37) * 10);
    g.lineTo(1024, 256);
    g.fill();
    g.fillStyle = near;
    for (let i = 0; i < 26; i++) {
      // clumps of bamboo
      const x = Math.random() * 1024;
      const h = 60 + Math.random() * 60;
      g.beginPath();
      g.ellipse(x, 256 - h * 0.5, 22 + Math.random() * 18, h * 0.6, 0, 0, Math.PI * 2);
      g.fill();
    }
    // tiled roofs
    g.fillStyle = theme === 'night' ? '#20121a' : '#8a3b22';
    for (let i = 0; i < 9; i++) {
      const x = 40 + i * 115 + Math.random() * 30;
      g.beginPath();
      g.moveTo(x - 50, 220);
      g.quadraticCurveTo(x - 30, 200, x, 186);
      g.quadraticCurveTo(x + 30, 200, x + 50, 220);
      g.fill();
      g.fillRect(x - 38, 220, 76, 36);
      if (theme === 'night') {
        g.fillStyle = 'rgba(255,200,110,0.85)';
        g.fillRect(x - 10, 230, 8, 10);
        g.fillStyle = '#20121a';
      }
    }
  });
}

// Soft round glow for lanterns, sparks and fireworks
export function glowTexture(inner = 'rgba(255,240,200,1)', mid = 'rgba(255,190,90,0.35)') {
  return canvas(128, 128, (g) => {
    const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    grad.addColorStop(0, inner);
    grad.addColorStop(0.35, mid);
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 128, 128);
  });
}

export function shadowTexture() {
  return canvas(64, 64, (g) => {
    const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, 'rgba(0,0,0,0.5)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 64);
  });
}

// Soft golden ring of light for the ground under someone in the spotlight
export function ringTexture() {
  return canvas(128, 128, (g) => {
    const grad = g.createRadialGradient(64, 64, 20, 64, 64, 64);
    grad.addColorStop(0, 'rgba(255,200,90,0)');
    grad.addColorStop(0.55, 'rgba(255,210,110,0.55)');
    grad.addColorStop(0.72, 'rgba(255,236,170,0.9)');
    grad.addColorStop(1, 'rgba(255,190,80,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 128, 128);
  });
}


// A soft cloud of smoke (fireworks leave a puff behind)
export function smokeTexture() {
  return canvas(128, 128, (g) => {
    for (let i = 0; i < 7; i++) {
      const x = 40 + Math.random() * 48;
      const y = 40 + Math.random() * 48;
      const grad = g.createRadialGradient(x, y, 0, x, y, 44);
      grad.addColorStop(0, 'rgba(255,255,255,0.5)');
      grad.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = grad;
      g.fillRect(0, 0, 128, 128);
    }
  });
}

// ---------- lion dance ----------

// Gold scales on red, row by row (lion's head and its cloth)
function scales(g: CanvasRenderingContext2D, w: number, h: number, r: number, fill: string, edge: string) {
  for (let row = 0; row * r * 0.9 < h + r; row++) {
    for (let col = -1; col * r * 2 < w + r * 2; col++) {
      const x = col * r * 2 + (row % 2 ? r : 0);
      const y = row * r * 0.9;
      g.fillStyle = fill;
      g.beginPath();
      g.arc(x, y, r, 0, Math.PI);
      g.fill();
      g.strokeStyle = edge;
      g.lineWidth = 3;
      g.beginPath();
      g.arc(x, y, r * 0.92, 0.15, Math.PI - 0.15);
      g.stroke();
    }
  }
}

// The lion's skull, wrapped round a sphere: the face side (u = 0.75, toward -z) is bright gold and red,
// the back and top are red with gold scales and a green crest stripe
export function lionHeadTexture() {
  return canvas(512, 256, (g) => {
    g.fillStyle = '#c8141a';
    g.fillRect(0, 0, 512, 256);
    scales(g, 512, 256, 14, '#d01a1f', '#f2c14e');
    // the face area: a gold-to-red glow
    const face = g.createRadialGradient(384, 140, 10, 384, 140, 150);
    face.addColorStop(0, '#ffd84a');
    face.addColorStop(0.55, '#f08a1c');
    face.addColorStop(1, 'rgba(200,20,26,0)');
    g.fillStyle = face;
    g.fillRect(200, 0, 312, 256);
    // green and blue swirls on the forehead and cheeks
    g.lineWidth = 9;
    g.strokeStyle = '#1f9a4a';
    for (const [x, y, r, a0, a1] of [[384, 60, 40, Math.PI * 1.1, Math.PI * 1.9], [330, 150, 26, 0, Math.PI * 1.4], [438, 150, 26, Math.PI * 1.6, Math.PI * 3]]) {
      g.beginPath();
      g.arc(x, y, r, a0, a1);
      g.stroke();
    }
    g.strokeStyle = '#2a6fd6';
    g.lineWidth = 5;
    g.beginPath();
    g.arc(384, 60, 52, Math.PI * 1.15, Math.PI * 1.85);
    g.stroke();
    // a green crest down the back of the head (u ~ 0.25)
    g.fillStyle = '#1f9a4a';
    g.fillRect(118, 0, 20, 256);
    g.fillStyle = '#f2c14e';
    g.fillRect(114, 0, 4, 256);
    g.fillRect(138, 0, 4, 256);
  });
}

// The cloth body: scales along its length, a green stripe down the spine (v = 0.5), gold hems
export function lionClothTexture() {
  const t = canvas(256, 256, (g) => {
    g.fillStyle = '#c8141a';
    g.fillRect(0, 0, 256, 256);
    scales(g, 256, 256, 16, '#d01a1f', '#f2c14e');
    g.fillStyle = '#1f9a4a';
    g.fillRect(0, 116, 256, 24);
    g.fillStyle = '#f6d36a';
    g.fillRect(0, 112, 256, 4);
    g.fillRect(0, 140, 256, 4);
    g.fillStyle = '#f2c14e';
    g.fillRect(0, 0, 256, 10);
    g.fillRect(0, 246, 256, 10);
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

// Ông Địa's big smiling mask, centred on the front of a sphere (u = 0.75)
export function ongDiaFaceTexture() {
  return canvas(512, 256, (g) => {
    g.fillStyle = '#f2c9a0';
    g.fillRect(0, 0, 512, 256);
    const cx = 384;
    // rosy cheeks
    for (const x of [cx - 52, cx + 52]) {
      const c = g.createRadialGradient(x, 150, 0, x, 150, 30);
      c.addColorStop(0, 'rgba(240,90,110,0.85)');
      c.addColorStop(1, 'rgba(240,90,110,0)');
      g.fillStyle = c;
      g.fillRect(x - 30, 120, 60, 60);
    }
    // eyes closed in a laugh, eyebrows high
    g.strokeStyle = '#2a1a10';
    g.lineCap = 'round';
    g.lineWidth = 7;
    for (const x of [cx - 34, cx + 34]) {
      g.beginPath();
      g.arc(x, 112, 16, Math.PI * 1.1, Math.PI * 1.9);
      g.stroke();
      g.beginPath();
      g.arc(x, 92, 20, Math.PI * 1.2, Math.PI * 1.8);
      g.stroke();
    }
    // a huge open smile
    g.fillStyle = '#7a1414';
    g.beginPath();
    g.moveTo(cx - 60, 150);
    g.quadraticCurveTo(cx, 235, cx + 60, 150);
    g.quadraticCurveTo(cx, 170, cx - 60, 150);
    g.fill();
    g.fillStyle = '#ffffff';
    g.fillRect(cx - 40, 154, 80, 10);
    g.fillStyle = '#e8505a';
    g.beginPath();
    g.ellipse(cx, 200, 22, 10, 0, 0, Math.PI * 2);
    g.fill();
    // hair line: a little tuft on top
    g.fillStyle = '#1a1a1a';
    g.fillRect(cx - 8, 0, 16, 26);
  });
}

// Quạt mo: a fan made from an areca palm sheath
export function fanTexture() {
  return canvas(128, 128, (g) => {
    g.fillStyle = '#d9b77a';
    g.beginPath();
    g.moveTo(64, 120);
    g.arc(64, 120, 112, Math.PI * 1.18, Math.PI * 1.82);
    g.closePath();
    g.fill();
    g.strokeStyle = 'rgba(120,80,30,0.6)';
    g.lineWidth = 2;
    for (let i = 0; i < 9; i++) {
      const a = Math.PI * (1.2 + i * 0.075);
      g.beginPath();
      g.moveTo(64, 120);
      g.lineTo(64 + Math.cos(a) * 108, 120 + Math.sin(a) * 108);
      g.stroke();
    }
  });
}
