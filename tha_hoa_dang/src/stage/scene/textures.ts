import * as THREE from 'three';

// Every texture is painted on a canvas at startup: no image files to license or download.

function canvas(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d')!);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
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

// Dark polished wood planks
export function floorTexture() {
  const t = canvas(512, 512, (g) => {
    g.fillStyle = '#3a1f12';
    g.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 8; i++) {
      const shade = 40 + Math.random() * 18;
      g.fillStyle = `rgb(${shade + 22},${shade - 6},${shade - 22})`;
      g.fillRect(i * 64 + 1, 0, 62, 512);
      for (let k = 0; k < 30; k++) {
        g.strokeStyle = `rgba(20,8,2,${0.08 + Math.random() * 0.1})`;
        g.beginPath();
        const x = i * 64 + Math.random() * 62;
        g.moveTo(x, 0);
        g.bezierCurveTo(x + 4, 170, x - 4, 340, x + 2, 512);
        g.stroke();
      }
      g.fillStyle = 'rgba(0,0,0,0.5)';
      g.fillRect(i * 64, ((i * 197) % 512), 64, 2);
    }
    noise(g, 512, 512, 10);
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(5, 9);
  return t;
}

// Red runner with a gold border and lotus motifs down the aisle
export function carpetTexture() {
  const t = canvas(256, 1024, (g) => {
    g.fillStyle = '#7a1414';
    g.fillRect(0, 0, 256, 1024);
    g.fillStyle = '#c9932e';
    g.fillRect(10, 0, 10, 1024);
    g.fillRect(236, 0, 10, 1024);
    g.fillStyle = '#5a0c0c';
    g.fillRect(24, 0, 4, 1024);
    g.fillRect(228, 0, 4, 1024);
    for (let y = 64; y < 1024; y += 128) {
      g.save();
      g.translate(128, y);
      g.fillStyle = 'rgba(214,160,60,0.55)';
      for (let k = 0; k < 8; k++) {
        g.rotate(Math.PI / 4);
        g.beginPath();
        g.ellipse(0, -22, 9, 22, 0, 0, Math.PI * 2);
        g.fill();
      }
      g.fillStyle = '#e7b85a';
      g.beginPath();
      g.arc(0, 0, 8, 0, Math.PI * 2);
      g.fill();
      g.restore();
    }
    noise(g, 256, 1024, 14);
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

// Lacquered red wall panels with gold trim
export function wallTexture() {
  const t = canvas(512, 512, (g) => {
    g.fillStyle = '#4a0e0b';
    g.fillRect(0, 0, 512, 512);
    g.strokeStyle = '#b8862f';
    g.lineWidth = 6;
    g.strokeRect(24, 24, 464, 464);
    g.lineWidth = 2;
    g.strokeRect(40, 40, 432, 432);
    g.strokeStyle = 'rgba(200,150,60,0.35)';
    for (let r = 30; r < 200; r += 28) {
      g.beginPath();
      g.arc(256, 256, r, 0, Math.PI * 2);
      g.stroke();
    }
    noise(g, 512, 512, 12);
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

// Soft round glow for halos, lanterns, sparks and smoke
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

export function smokeTexture() {
  return canvas(128, 128, (g) => {
    for (let i = 0; i < 6; i++) {
      const x = 44 + Math.random() * 40;
      const y = 44 + Math.random() * 40;
      const grad = g.createRadialGradient(x, y, 0, x, y, 40);
      grad.addColorStop(0, 'rgba(235,225,215,0.35)');
      grad.addColorStop(1, 'rgba(235,225,215,0)');
      g.fillStyle = grad;
      g.fillRect(0, 0, 128, 128);
    }
  });
}

export function shadowTexture() {
  return canvas(64, 64, (g) => {
    const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, 'rgba(0,0,0,0.55)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 64);
  });
}

// Pink lotus petal with a light base
export function petalTexture() {
  return canvas(64, 128, (g) => {
    const grad = g.createLinearGradient(0, 128, 0, 0);
    grad.addColorStop(0, '#fff3f6');
    grad.addColorStop(0.5, '#f7a8c0');
    grad.addColorStop(1, '#e0507e');
    g.fillStyle = grad;
    g.beginPath();
    g.moveTo(32, 126);
    g.bezierCurveTo(-6, 90, 4, 22, 32, 2);
    g.bezierCurveTo(60, 22, 70, 90, 32, 126);
    g.fill();
    g.strokeStyle = 'rgba(200,60,100,0.35)';
    g.beginPath();
    g.moveTo(32, 120);
    g.lineTo(32, 14);
    g.stroke();
  });
}

// Light shaft: bright top fading down and to the sides
export function rayTexture() {
  return canvas(64, 256, (g) => {
    const v = g.createLinearGradient(0, 0, 0, 256);
    v.addColorStop(0, 'rgba(255,220,150,0.55)');
    v.addColorStop(1, 'rgba(255,220,150,0)');
    g.fillStyle = v;
    g.fillRect(0, 0, 64, 256);
    const h = g.createLinearGradient(0, 0, 64, 0);
    h.addColorStop(0, 'rgba(0,0,0,1)');
    h.addColorStop(0.5, 'rgba(0,0,0,0)');
    h.addColorStop(1, 'rgba(0,0,0,1)');
    g.globalCompositeOperation = 'destination-out';
    g.fillStyle = h;
    g.fillRect(0, 0, 64, 256);
  });
}

// Golden radiant halo with rays, drawn behind the statue
export function haloTexture() {
  return canvas(512, 512, (g) => {
    const c = 256;
    const glow = g.createRadialGradient(c, c, 40, c, c, 256);
    glow.addColorStop(0, 'rgba(255,236,170,0.95)');
    glow.addColorStop(0.35, 'rgba(255,190,80,0.45)');
    glow.addColorStop(1, 'rgba(255,150,40,0)');
    g.fillStyle = glow;
    g.fillRect(0, 0, 512, 512);
    g.translate(c, c);
    for (let i = 0; i < 48; i++) {
      g.rotate((Math.PI * 2) / 48);
      g.fillStyle = i % 2 ? 'rgba(255,225,140,0.22)' : 'rgba(255,240,190,0.4)';
      g.beginPath();
      g.moveTo(-3, 70);
      g.lineTo(3, 70);
      g.lineTo(0, 240);
      g.fill();
    }
    g.strokeStyle = 'rgba(255,230,160,0.9)';
    g.lineWidth = 5;
    g.beginPath();
    g.arc(0, 0, 118, 0, Math.PI * 2);
    g.stroke();
    g.lineWidth = 2;
    g.beginPath();
    g.arc(0, 0, 132, 0, Math.PI * 2);
    g.stroke();
  });
}

// Horizontal plaque text (Hán-Việt style board above the altar)
export function plaqueTexture(text: string) {
  return canvas(1024, 192, (g) => {
    const grad = g.createLinearGradient(0, 0, 0, 192);
    grad.addColorStop(0, '#5c1410');
    grad.addColorStop(1, '#3a0a08');
    g.fillStyle = grad;
    g.fillRect(0, 0, 1024, 192);
    g.strokeStyle = '#d9a845';
    g.lineWidth = 10;
    g.strokeRect(10, 10, 1004, 172);
    g.lineWidth = 3;
    g.strokeRect(26, 26, 972, 140);
    g.fillStyle = '#f3cf72';
    g.font = '600 92px Lora, Georgia, serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.shadowColor = 'rgba(255,200,90,0.8)';
    g.shadowBlur = 16;
    g.fillText(text, 512, 100, 940);
  });
}

// Full moon: pale disc with soft grey seas
export function moonTexture() {
  return canvas(256, 256, (g) => {
    const grad = g.createRadialGradient(118, 112, 10, 128, 128, 120);
    grad.addColorStop(0, '#fffdf2');
    grad.addColorStop(0.85, '#f3ead0');
    grad.addColorStop(1, '#e2d6b4');
    g.fillStyle = grad;
    g.beginPath();
    g.arc(128, 128, 120, 0, Math.PI * 2);
    g.fill();
    g.globalCompositeOperation = 'source-atop';
    for (const [x, y, r] of [[92, 96, 30], [150, 80, 18], [160, 150, 34], [100, 170, 22], [70, 140, 12], [130, 120, 14]]) {
      const s = g.createRadialGradient(x, y, 0, x, y, r);
      s.addColorStop(0, 'rgba(170,160,140,0.45)');
      s.addColorStop(1, 'rgba(170,160,140,0)');
      g.fillStyle = s;
      g.fillRect(x - r, y - r, r * 2, r * 2);
    }
  });
}

// A strip of hills (and a small tower on one of them) as a dark silhouette, transparent above
export function hillsTexture(seed: number, tower: boolean) {
  return canvas(1024, 256, (g) => {
    let r = seed;
    const rand = () => ((r = (r * 1664525 + 1013904223) >>> 0) / 4294967296);
    const peaks = Array.from({ length: 7 }, () => ({ x: rand() * 1024, h: 60 + rand() * 120, w: 120 + rand() * 220 }));
    const height = (x: number) => peaks.reduce((m, p) => Math.max(m, p.h * Math.exp(-(((x - p.x) / p.w) ** 2) * 2)), 30);
    g.fillStyle = '#fff';
    g.beginPath();
    g.moveTo(0, 256);
    for (let x = 0; x <= 1024; x += 8) g.lineTo(x, 256 - height(x));
    g.lineTo(1024, 256);
    g.fill();
    if (tower) {
      // a seven-tier tower on the highest hill
      const top = peaks.reduce((a, b) => (b.h > a.h ? b : a));
      const base = 256 - height(top.x);
      for (let i = 0; i < 7; i++) {
        const w = 26 - i * 3;
        g.fillRect(top.x - w / 2, base - (i + 1) * 9, w, 7);
        g.fillRect(top.x - w / 2 - 3, base - (i + 1) * 9 + 6, w + 6, 2);
      }
      g.fillRect(top.x - 1, base - 74, 2, 12);
    }
  });
}

// Thin bright ring for ripples on the water
export function rippleTexture() {
  return canvas(128, 128, (g) => {
    const grad = g.createRadialGradient(64, 64, 30, 64, 64, 64);
    grad.addColorStop(0, 'rgba(255,255,255,0)');
    grad.addColorStop(0.8, 'rgba(220,235,255,0.0)');
    grad.addColorStop(0.9, 'rgba(230,240,255,0.9)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 128, 128);
  });
}

// Soft golden ring of light for the floor under someone in the spotlight
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
