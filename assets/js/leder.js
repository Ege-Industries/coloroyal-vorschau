// Gemeinsame 3D-Bausteine: prozedurales Leder (Narbung, Steppung, Naht), Renderer, Licht, Farbmuster.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

export const ROYAL = new THREE.Color('#d9bd8c');   // warmes Kantenlicht (Champagner)
export const HANDY = matchMedia('(max-width: 759px)').matches || matchMedia('(pointer: coarse)').matches;
export const RUHIG = matchMedia('(prefers-reduced-motion: reduce)').matches;

export function rng(seed = 1) {
  let s = seed % 2147483647; if (s <= 0) s += 2147483646;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

export function hatWebGL() {
  try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch { return false; }
}

/* Narbung: kachelbares Worley-Muster (F2−F1) + feines Rauschen → Höhenwerte 0..1 */
export function narbung(N = 256, zellen = 20, seed = 7) {
  const r = rng(seed), G = zellen, pts = new Float32Array(G * G * 2);
  for (let gy = 0; gy < G; gy++) for (let gx = 0; gx < G; gx++) {
    const i = (gy * G + gx) * 2; pts[i] = (gx + 0.15 + r() * 0.7) / G; pts[i + 1] = (gy + 0.15 + r() * 0.7) / G;
  }
  const out = new Float32Array(N * N);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const u = (x + 0.5) / N, v = (y + 0.5) / N, gx = Math.floor(u * G), gy = Math.floor(v * G);
    let f1 = 9, f2 = 9;
    for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
      const ax = gx + ox, ay = gy + oy, cx = (ax + G) % G, cy = (ay + G) % G, i = (cy * G + cx) * 2;
      const dx = u - (pts[i] + Math.floor(ax / G)), dy = v - (pts[i + 1] + Math.floor(ay / G));
      const d = dx * dx + dy * dy;
      if (d < f1) { f2 = f1; f1 = d; } else if (d < f2) f2 = d;
    }
    const e = (Math.sqrt(f2) - Math.sqrt(f1)) * G;          // 0 an der Falte
    out[y * N + x] = Math.min(1, Math.pow(Math.min(1, e * 1.6), 0.55)) * 0.85 + r() * 0.15;
  }
  return out;
}

/* Glattes Wertrauschen (für Fleckigkeit) */
export function wolke(W, H, skala, seed = 3) {
  const r = rng(seed), gw = Math.ceil(W / skala) + 2, gh = Math.ceil(H / skala) + 2, g = new Float32Array(gw * gh).map(() => r());
  const out = new Float32Array(W * H);
  const s = t => t * t * (3 - 2 * t);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const fx = x / skala, fy = y / skala, ix = fx | 0, iy = fy | 0, tx = s(fx - ix), ty = s(fy - iy);
    const a = g[iy * gw + ix], b = g[iy * gw + ix + 1], c = g[(iy + 1) * gw + ix], d = g[(iy + 1) * gw + ix + 1];
    out[y * W + x] = a + (b - a) * tx + (c - a) * ty + (a - b - c + d) * tx * ty;
  }
  return out;
}

/* Höhenfeld → Normalenkarte (RGBA, Tangentenraum) */
export function normalen(h, W, H, staerke = 2, kachel = false) {
  const out = new Uint8Array(W * H * 4);
  const at = (x, y) => {
    if (kachel) { x = (x + W) % W; y = (y + H) % H; } else { x = Math.max(0, Math.min(W - 1, x)); y = Math.max(0, Math.min(H - 1, y)); }
    return h[y * W + x];
  };
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const dx = (at(x + 1, y) - at(x - 1, y)) * staerke, dy = (at(x, y + 1) - at(x, y - 1)) * staerke;
    const l = 1 / Math.hypot(dx, dy, 1), i = (y * W + x) * 4;
    out[i] = (-dx * l * 0.5 + 0.5) * 255; out[i + 1] = (-dy * l * 0.5 + 0.5) * 255; out[i + 2] = (l * 0.5 + 0.5) * 255; out[i + 3] = 255;
  }
  return out;
}

export function datenTextur(daten, W, H, farbe = false, kachel = false) {
  const t = new THREE.DataTexture(daten, W, H, THREE.RGBAFormat);
  t.colorSpace = farbe ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.wrapS = t.wrapT = kachel ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
  t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter;
  t.anisotropy = 8; t.needsUpdate = true;
  return t;
}

let _narbN = null;
/* Kachelbare Narbungs-Normalenkarte (einmal pro Seite) */
export function narbungsNormalen() {
  if (_narbN) return _narbN;
  const N = 256, h = narbung(N, 20, 11);
  _narbN = datenTextur(normalen(h, N, N, 1.5, true), N, N, false, true);
  return _narbN;
}

/* Renderer + Umgebung + Größe + Sichtbarkeit */
export function buehne(canvas, { belichtung = 1.0, dpr = HANDY ? 1.6 : 1.9, antialias = true } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, dpr));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = belichtung;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene();
  const pm = new THREE.PMREMGenerator(renderer);
  scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.55;
  pm.dispose();
  const st = { sicht: true, w: 1, h: 1 };
  const groesse = () => {
    const r = canvas.getBoundingClientRect();
    st.w = Math.max(1, r.width); st.h = Math.max(1, r.height);
    renderer.setSize(st.w, st.h, false);
  };
  groesse();
  new ResizeObserver(groesse).observe(canvas);
  new IntersectionObserver(es => { st.sicht = es[0].isIntersecting; }, { rootMargin: '100px' }).observe(canvas);
  return { renderer, scene, st, groesse };
}

/* Abgerundetes Rechteck als Form (Mitte = 0,0) */
export function rundRechteck(w, h, r, rUnten = r) {
  const s = new THREE.Shape(), x = -w / 2, y = -h / 2;
  s.moveTo(x + rUnten, y);
  s.lineTo(x + w - rUnten, y); s.quadraticCurveTo(x + w, y, x + w, y + rUnten);
  s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + rUnten); s.quadraticCurveTo(x, y, x + rUnten, y);
  return s;
}

/* UVs für Extrusionen: Vorderseite und Wülste gleich projiziert (0..1 über die Form) */
export function uvProjektion(minX, minY, w, h) {
  const f = (x, y) => new THREE.Vector2((x - minX) / w, (y - minY) / h);
  return {
    generateTopUV: (g, v, a, b, c) => [f(v[a * 3], v[a * 3 + 1]), f(v[b * 3], v[b * 3 + 1]), f(v[c * 3], v[c * 3 + 1])],
    generateSideWallUV: (g, v, a, b, c, d) => [f(v[a * 3], v[a * 3 + 1]), f(v[b * 3], v[b * 3 + 1]), f(v[c * 3], v[c * 3 + 1]), f(v[d * 3], v[d * 3 + 1])],
  };
}

/* Polster: weich gewölbte Extrusion, optional gebogen (biege = Tiefe der Wölbung an den Seiten) */
export function biegen(g, halbeBreite, biege) {
  if (!biege) return g;
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const x = p.getX(i) / halbeBreite; p.setZ(i, p.getZ(i) - biege * x * x); }
  p.needsUpdate = true;
  return g;
}
export function polster(w, h, r, tiefe, wulst, segmente = 10, rUnten = r, biege = 0) {
  let g = new THREE.ExtrudeGeometry(rundRechteck(w, h, r, rUnten), {
    depth: tiefe, bevelEnabled: true, bevelThickness: wulst, bevelSize: wulst * 0.8, bevelSegments: segmente, curveSegments: 24,
    UVGenerator: uvProjektion(-w / 2, -h / 2, w, h),
  });
  g.translate(0, 0, -tiefe / 2);
  biegen(g, w / 2, biege);
  g.deleteAttribute('normal');
  g = mergeVertices(g, 1e-4);
  g.computeVertexNormals();
  return g;
}

/* Farbmuster-Textur: Leder + Naht + Beschriftung (für Fächer und Detailseiten) */
export function musterTextur(hex, nr, name, hell, W = 256, H = 860) {
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const x = c.getContext('2d');
  const basis = new THREE.Color(hex);
  const wo = wolke(W, H, 70, nr * 13 + 1);
  const img = x.createImageData(W, H);
  for (let i = 0; i < W * H; i++) {
    const k = 0.86 + wo[i] * 0.22;
    img.data[i * 4] = Math.min(255, basis.r * 255 * k); img.data[i * 4 + 1] = Math.min(255, basis.g * 255 * k); img.data[i * 4 + 2] = Math.min(255, basis.b * 255 * k); img.data[i * 4 + 3] = 255;
  }
  x.putImageData(img, 0, 0);
  // Randschatten
  const g = x.createLinearGradient(0, 0, W, 0);
  g.addColorStop(0, 'rgba(0,0,0,.28)'); g.addColorStop(.12, 'rgba(0,0,0,0)'); g.addColorStop(.88, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,.28)');
  x.fillStyle = g; x.fillRect(0, 0, W, H);
  // Naht
  x.save();
  x.strokeStyle = hell ? 'rgba(120,90,50,.85)' : 'rgba(216,195,154,.9)';
  x.lineWidth = 4; x.setLineDash([14, 9]); x.lineCap = 'round';
  x.beginPath(); x.roundRect(16, 16, W - 32, H - 32, [18, 18, 70, 70]); x.stroke();
  x.restore();
  // Beschriftung (senkrecht, wie bei einem Musterfächer)
  const tinte = hell ? 'rgba(21,18,15,.88)' : 'rgba(245,238,226,.94)';
  x.save();
  x.translate(W / 2 + 14, H - 190); x.rotate(-Math.PI / 2);
  x.fillStyle = tinte; x.font = 'italic 500 60px "Cormorant Garamond", Georgia, serif'; x.textBaseline = 'middle';
  x.shadowColor = hell ? 'rgba(255,255,255,.5)' : 'rgba(0,0,0,.6)'; x.shadowOffsetY = 2; x.shadowBlur = 2;
  x.fillText(name, 0, 0);
  x.restore();
  x.fillStyle = tinte; x.font = '600 28px "Instrument Sans", Arial, sans-serif'; x.textAlign = 'center';
  x.fillText('No. ' + nr, W / 2, 82);
  x.fillStyle = hell ? 'rgba(120,90,50,1)' : '#d8c39a'; x.font = '600 16px "Instrument Sans", Arial, sans-serif';
  x.fillText('COLOROYAL', W / 2, 116);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}

/* Ein Farbmuster (Fächerblatt) mit Loch für die Niete; Drehpunkt = Niete */
export function musterBlatt(l, i) {
  const W = 0.56, H = 1.9, s = rundRechteck(W, H, 0.06, 0.26);
  const loch = new THREE.Path(); loch.absarc(0, -H / 2 + 0.2, 0.05, 0, Math.PI * 2, true); s.holes.push(loch);
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.01, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.012, bevelSegments: 3, curveSegments: 18, UVGenerator: uvProjektion(-W / 2, -H / 2, W, H) });
  g.translate(0, H / 2 - 0.2, 0);
  const n = narbungsNormalen().clone(); n.repeat.set(3.2, 10.8); n.needsUpdate = true;
  const m = new THREE.MeshPhysicalMaterial({
    map: musterTextur(l.hex, l.nr, l.kurz, l.hell), normalMap: n, normalScale: new THREE.Vector2(0.35, 0.35),
    roughness: 0.48, clearcoat: 0.25, clearcoatRoughness: 0.4,
  });
  const mesh = new THREE.Mesh(g, m);
  mesh.userData.i = i;
  return mesh;
}

export function niete() {
  const g = new THREE.CylinderGeometry(0.075, 0.075, 0.16, 32);
  g.rotateX(Math.PI / 2);
  const m = new THREE.MeshPhysicalMaterial({ color: '#d7dde2', metalness: 1, roughness: 0.18, clearcoat: 0.4 });
  const k = new THREE.Mesh(g, m);
  const kappe = new THREE.Mesh(new THREE.SphereGeometry(0.075, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), m);
  kappe.rotation.x = Math.PI / 2; kappe.position.z = 0.08; kappe.scale.z = 0.5;
  k.add(kappe);
  return k;
}

export function lichter(scene, { blau = 18, haupt = 2.2 } = {}) {
  const key = new THREE.DirectionalLight('#fff3e6', haupt); key.position.set(3, 4, 5); scene.add(key);
  const fill = new THREE.DirectionalLight('#dfe8ff', 0.5); fill.position.set(-4, 1, 3); scene.add(fill);
  const rand = new THREE.PointLight(ROYAL, blau, 12, 1.6); rand.position.set(-2.4, 1.6, -2.2); scene.add(rand);
  return { key, fill, rand };
}

/* Schleife, die nur läuft, wenn der Canvas sichtbar ist */
export function schleife(st, fn) {
  let last = performance.now();
  const tick = t => {
    const dt = Math.min(0.05, Math.max(0, (t - last) / 1000)); last = t;
    if (st.sicht && !document.hidden) fn(t / 1000, dt);
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

/* Weicher Bodenschatten */
export function bodenSchatten(w = 3, h = 1.2, staerke = 0.55) {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const x = c.getContext('2d'), g = x.createRadialGradient(64, 64, 4, 64, 64, 64);
  g.addColorStop(0, `rgba(0,0,0,${staerke})`); g.addColorStop(1, 'rgba(0,0,0,0)');
  x.fillStyle = g; x.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false }));
  m.rotation.x = -Math.PI / 2;
  return m;
}
