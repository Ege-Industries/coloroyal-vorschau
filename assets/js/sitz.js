// Startseite: 3D-Autositz mit echten Schäden (Riss, Brandloch, verblasste Stelle).
// Maus/Finger über das Leder = Smart Repair. Ohne Berührung repariert ein Werkzeug von selbst.
import * as THREE from 'three';
import { buehne, narbung, normalen, wolke, datenTextur, narbungsNormalen, polster, biegen, rundRechteck, lichter, schleife, bodenSchatten, HANDY, RUHIG, hatWebGL, rng, ROYAL } from './leder.js';

const canvas = document.getElementById('sitz3d');
const HUD = document.getElementById('sitzHud');

// Maße der Rückenlehne (Malfläche)
const PW = 1.18, PH = 1.62, PT = 0.05, PWU = 0.09, BIEGE = 0.13;
const KANAELE = 7;
const SPOTS = [
  { k: 'riss', u: 0.41, v: 0.65, ru: 0.2, rv: 0.07 },
  { k: 'brand', u: 0.67, v: 0.38, ru: 0.08, rv: 0.06 },
  { k: 'farbe', u: 0.3, v: 0.2, ru: 0.2, rv: 0.12 },
];

/* ---------- Texturen der Rückenlehne ---------- */
function lehnenTexturen() {
  const TW = HANDY ? 640 : 1024, TH = Math.round(TW * PH / PW);
  const N = 256, gr = narbung(N, 28, 5);
  const wo = wolke(TW, TH, TW / 6, 9);
  const hoehe = new Float32Array(TW * TH);
  const farbe = new Uint8Array(TW * TH * 4);
  const rx0 = 0.075, rx1 = 0.925, ry0 = 0.06, ry1 = 0.94;
  const naht = new Uint8Array(TW * TH);
  // Steppung: waagrechte Kanäle im Innenfeld, glatter Rand, Ziernähte in Blau
  for (let y = 0; y < TH; y++) {
    const v = (y + 0.5) / TH;
    for (let x = 0; x < TW; x++) {
      const u = (x + 0.5) / TW, i = y * TW + x;
      let q;
      const innen = u > rx0 && u < rx1 && v > ry0 && v < ry1;
      if (innen) {
        const f = ((v - ry0) / (ry1 - ry0)) * KANAELE % 1;
        q = Math.pow(Math.sin(Math.PI * f), 0.32);
        const kante = Math.min(u - rx0, rx1 - u, v - ry0, ry1 - v);
        q *= Math.min(1, kante * 60);
      } else {
        const kante = Math.min(Math.abs(u - rx0), Math.abs(u - rx1), Math.abs(v - ry0), Math.abs(v - ry1));
        q = 0.75 * Math.min(1, kante * 40) + 0.05;
      }
      hoehe[i] = q * 0.9 + gr[((y * 2) % N) * N + ((x * 2) % N)] * 0.03;
    }
  }
  // Nähte: entlang jeder Kanalfuge zwei Stichreihen, dazu die Randnaht
  const stich = (x0, y0, x1, y1, lang = 9, luecke = 6) => {
    const L = Math.hypot(x1 - x0, y1 - y0), n = Math.floor(L / (lang + luecke));
    for (let k = 0; k < n; k++) {
      const a = (k * (lang + luecke)) / L, b = (k * (lang + luecke) + lang) / L;
      for (let t = a; t < b; t += 0.5 / L) {
        const px = Math.round(x0 + (x1 - x0) * t), py = Math.round(y0 + (y1 - y0) * t);
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          const xx = px + dx, yy = py + dy; if (xx < 0 || yy < 0 || xx >= TW || yy >= TH) continue;
          naht[yy * TW + xx] = Math.max(naht[yy * TW + xx], dx === 0 && dy === 0 ? 255 : 120);
        }
      }
    }
  };
  const sx0 = rx0 * TW + 10, sx1 = rx1 * TW - 10;
  for (let j = 1; j < KANAELE; j++) {
    const y = (ry0 + (ry1 - ry0) * j / KANAELE) * TH;
    stich(sx0, y - TH * 0.011, sx1, y - TH * 0.011);
    stich(sx0, y + TH * 0.011, sx1, y + TH * 0.011);
  }
  const ox = rx0 * TW - TW * 0.022, oy = ry0 * TH - TW * 0.022, ox1 = rx1 * TW + TW * 0.022, oy1 = ry1 * TH + TW * 0.022;
  stich(ox, oy, ox1, oy); stich(ox1, oy, ox1, oy1); stich(ox1, oy1, ox, oy1); stich(ox, oy1, ox, oy);
  for (let i = 0; i < TW * TH; i++) if (naht[i]) hoehe[i] += naht[i] / 255 * 0.05;

  // Gesunde Farbe
  const basis = [22, 20, 19];
  const blau = [104, 184, 230];
  for (let i = 0; i < TW * TH; i++) {
    const ao = 0.66 + 0.34 * Math.min(1, hoehe[i] / 0.85);
    const k = (0.82 + wo[i] * 0.3) * ao;
    const n = naht[i] / 255;
    for (let c = 0; c < 3; c++) farbe[i * 4 + c] = Math.min(255, basis[c] * k * (1 - n) + blau[c] * n * (0.75 + 0.25 * ao));
    farbe[i * 4 + 3] = 255;
  }

  // Schäden auf Leinwänden zeichnen (oben = v 1)
  const dc = document.createElement('canvas'); dc.width = TW; dc.height = TH;
  const dh = document.createElement('canvas'); dh.width = TW; dh.height = TH;
  const c = dc.getContext('2d'), h = dh.getContext('2d');
  h.fillStyle = 'rgb(128,128,128)'; h.fillRect(0, 0, TW, TH);
  const P = (u, v) => [u * TW, (1 - v) * TH];
  const R = rng(42), s = TW / 1024;
  // 1) Riss: gezackt, mit hellen Kanten
  const riss = []; { let [x, y] = P(0.18, 0.66); riss.push([x, y]); for (let k = 0; k < 22; k++) { x += (15 + R() * 12) * s; y += (R() - 0.3) * 16 * s; riss.push([x, y]); } }
  const linie = (ctx, pts, w, st) => { ctx.strokeStyle = st; ctx.lineWidth = w; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.beginPath(); pts.forEach(([x, y], k) => k ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.stroke(); };
  c.filter = `blur(${12 * s}px)`; linie(c, riss, 52 * s, 'rgba(130,118,106,.55)'); c.filter = 'none';
  linie(c, riss, 15 * s, 'rgba(196,184,168,.95)');
  linie(c, riss, 5.5 * s, 'rgba(8,6,5,1)');
  for (let k = 2; k < riss.length - 2; k += 3) { const [x, y] = riss[k]; const ast = [[x, y], [x + (R() - 0.5) * 30 * s, y + (R() > 0.5 ? 1 : -1) * (10 + R() * 16) * s], [x + (R() - 0.5) * 44 * s, y + (R() > 0.5 ? 1 : -1) * (18 + R() * 16) * s]]; linie(c, ast, 4 * s, 'rgba(160,148,136,.75)'); linie(c, ast, 1.6 * s, 'rgba(10,7,6,.95)'); linie(h, ast, 3 * s, 'rgb(70,70,70)'); }
  h.filter = `blur(${3 * s}px)`; linie(h, riss, 16 * s, 'rgb(170,170,170)'); h.filter = 'none';
  linie(h, riss, 5 * s, 'rgb(20,20,20)');
  // 2) Brandloch
  { const [x, y] = P(0.67, 0.38);
    let g = c.createRadialGradient(x, y, 0, x, y, 104 * s);
    g.addColorStop(0, 'rgba(3,2,1,1)'); g.addColorStop(0.27, 'rgba(5,3,2,1)'); g.addColorStop(0.36, 'rgba(150,84,40,1)'); g.addColorStop(0.5, 'rgba(96,56,30,.85)'); g.addColorStop(0.75, 'rgba(60,38,24,.45)'); g.addColorStop(1, 'rgba(50,34,22,0)');
    c.fillStyle = g; c.beginPath(); c.ellipse(x, y, 104 * s, 90 * s, 0.3, 0, Math.PI * 2); c.fill();
    g = h.createRadialGradient(x, y, 0, x, y, 62 * s);
    g.addColorStop(0, 'rgb(0,0,0)'); g.addColorStop(0.45, 'rgb(10,10,10)'); g.addColorStop(0.62, 'rgb(200,200,200)'); g.addColorStop(1, 'rgb(128,128,128)');
    h.fillStyle = g; h.beginPath(); h.ellipse(x, y, 62 * s, 54 * s, 0.3, 0, Math.PI * 2); h.fill(); }
  // 3) Verblasst + abgegriffen
  { const [x, y] = P(0.3, 0.2);
    const g = c.createRadialGradient(x, y, 0, x, y, 220 * s);
    g.addColorStop(0, 'rgba(150,138,122,.8)'); g.addColorStop(0.55, 'rgba(136,124,110,.55)'); g.addColorStop(1, 'rgba(120,110,98,0)');
    c.fillStyle = g; c.save(); c.translate(x, y); c.scale(1, 0.62); c.translate(-x, -y); c.beginPath(); c.arc(x, y, 220 * s, 0, Math.PI * 2); c.fill(); c.restore();
    for (let k = 0; k < 70; k++) {
      const a = R() * Math.PI * 2, rr = Math.sqrt(R()), px = x + Math.cos(a) * rr * 170 * s, py = y + Math.sin(a) * rr * 90 * s, len = (10 + R() * 34) * s, w = R() * 0.6 - 0.3;
      const pts = [[px, py], [px + Math.cos(w) * len, py + Math.sin(w) * len]];
      linie(c, pts, (1 + R() * 1.6) * s, `rgba(${170 + R() * 30},${160 + R() * 26},${148 + R() * 20},${0.35 + R() * 0.4})`);
      linie(h, pts, 1.6 * s, 'rgb(100,100,100)');
    } }

  // Zusammensetzen: beschädigte Farbe und Höhe (Leinwand oben = Datenzeile unten umdrehen)
  const dco = c.getImageData(0, 0, TW, TH).data, dho = h.getImageData(0, 0, TW, TH).data;
  const farbeB = new Uint8Array(farbe), hoeheB = new Float32Array(hoehe);
  for (let y = 0; y < TH; y++) {
    const cy = TH - 1 - y;
    for (let x = 0; x < TW; x++) {
      const i = y * TW + x, j = (cy * TW + x) * 4, a = dco[j + 3] / 255;
      if (a > 0) for (let k = 0; k < 3; k++) farbeB[i * 4 + k] = farbe[i * 4 + k] * (1 - a) + dco[j + k] * a;
      const d = (dho[j] - 128) / 128;
      if (d) hoeheB[i] = hoehe[i] * (d < -0.5 ? 0.25 : 1) + d * 0.22;
    }
  }
  // Gewicht pro Maskenpixel: wo ist überhaupt ein Schaden?
  const MW = 192, MH = Math.round(MW * TH / TW);
  const kl = document.createElement('canvas'); kl.width = MW; kl.height = MH;
  kl.getContext('2d').drawImage(dc, 0, 0, MW, MH);
  const kd = kl.getContext('2d').getImageData(0, 0, MW, MH).data;
  const gewicht = new Float32Array(MW * MH);
  for (let i = 0; i < MW * MH; i++) gewicht[i] = kd[i * 4 + 3] > 22 ? 1 : 0;

  return {
    TW, TH, MW, MH, gewicht,
    karte: datenTextur(farbe, TW, TH, true), norm: datenTextur(normalen(hoehe, TW, TH, 44), TW, TH),
    karteB: datenTextur(farbeB, TW, TH, true), normB: datenTextur(normalen(hoeheB, TW, TH, 44), TW, TH),
  };
}

/* ---------- Kopfstütze mit gesticktem Zeichen ---------- */
function kopfTextur() {
  const W = 512, H = 280, c = document.createElement('canvas'); c.width = W; c.height = H;
  const x = c.getContext('2d');
  x.fillStyle = '#1b1918'; x.fillRect(0, 0, W, H);
  const haut = new Path2D('M38 0H62C65.1 7 71.4 12.1 79 13.7C86.5 15.3 94.3 13.2 100 8V34C88.7 39.3 81.5 50.6 81.5 63C81.5 75.4 88.7 86.7 100 92V118C94.3 112.9 86.5 110.7 79 112.3C71.4 113.9 65.1 119 62 126H38C34.9 119 28.6 113.9 21 112.3C13.5 110.7 5.7 112.9 0 118V92C11.3 86.7 18.5 75.4 18.5 63C18.5 50.6 11.3 39.3 0 34V8C5.7 13.2 13.5 15.3 21 13.7C28.6 12.1 34.9 7 38 0Z');
  x.save(); x.translate(W / 2 - 40, H / 2 - 50); x.scale(0.8, 0.8);
  x.save(); x.beginPath(); x.rect(0, -2, 50, 130); x.clip(); x.fillStyle = '#2b2a2a'; x.fill(haut); x.restore();
  x.save(); x.beginPath(); x.rect(50, -2, 52, 130); x.clip(); x.fillStyle = '#5ab5e7'; x.fill(haut); x.restore();
  x.strokeStyle = '#1b1918'; x.lineWidth = 4; x.setLineDash([7, 6]); x.beginPath(); x.moveTo(50, 5); x.lineTo(50, 121); x.stroke();
  x.restore();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}

function werkzeugRing() {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(64, 64, 10, 64, 64, 64);
  g.addColorStop(0, 'rgba(90,181,231,0)'); g.addColorStop(0.55, 'rgba(90,181,231,.15)'); g.addColorStop(0.72, 'rgba(160,215,245,.95)'); g.addColorStop(0.8, 'rgba(90,181,231,.4)'); g.addColorStop(1, 'rgba(90,181,231,0)');
  x.fillStyle = g; x.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false }));
  s.scale.setScalar(0.22); s.visible = false; s.renderOrder = 5;
  return s;
}

async function start() {
  const { renderer, scene, st } = buehne(canvas, { belichtung: 1.08 });
  const cam = new THREE.PerspectiveCamera(28, 1, 0.1, 60);
  const L = lichter(scene, { blau: 26, haupt: 2.0 });
  const spot = new THREE.SpotLight('#fff1e0', 60, 14, 0.42, 1, 1.4);
  scene.add(spot, spot.target);

  const tex = lehnenTexturen();
  const sitz = new THREE.Group(); scene.add(sitz);

  // Maske (weiß = Schaden sichtbar) und Leuchtspur der Reparatur
  const mask = document.createElement('canvas'); mask.width = tex.MW; mask.height = tex.MH;
  const mx = mask.getContext('2d'); mx.fillStyle = '#fff'; mx.fillRect(0, 0, tex.MW, tex.MH);
  const glow = document.createElement('canvas'); glow.width = tex.MW; glow.height = tex.MH;
  const gx = glow.getContext('2d'); gx.fillStyle = '#000'; gx.fillRect(0, 0, tex.MW, tex.MH);
  const maskT = new THREE.CanvasTexture(mask), glowT = new THREE.CanvasTexture(glow);

  const lederBasis = { roughness: 0.46, clearcoat: 0.32, clearcoatRoughness: 0.38 };
  const lehneMat = new THREE.MeshPhysicalMaterial({ ...lederBasis, map: tex.karte, normalMap: tex.norm, normalScale: new THREE.Vector2(0.8, 0.8) });
  lehneMat.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, { uDmg: { value: tex.karteB }, uDmgN: { value: tex.normB }, uMask: { value: maskT }, uGlow: { value: glowT } });
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform sampler2D uDmg, uDmgN, uMask, uGlow;')
      .replace('#include <map_fragment>', `
        vec4 cA = texture2D( map, vMapUv ); vec4 cB = texture2D( uDmg, vMapUv );
        float gM = texture2D( uMask, vMapUv ).r; float gG = texture2D( uGlow, vMapUv ).r;
        float gD = clamp( length( cB.rgb - cA.rgb ) * 6.0, 0.0, 1.0 ) * gM;
        diffuseColor *= mix( cA, cB, gM );`)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = mix( roughnessFactor, 0.95, gD );')
      .replace('#include <normal_fragment_maps>', THREE.ShaderChunk.normal_fragment_maps.replace(
        'vec3 mapN = texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0;',
        'vec3 mapN = mix( texture2D( normalMap, vNormalMapUv ).xyz, texture2D( uDmgN, vNormalMapUv ).xyz, gM ) * 2.0 - 1.0;'))
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += vec3( 0.32, 0.68, 0.92 ) * gG * ( 0.22 + 1.6 * gD );');
  };
  const narb = (rx, ry) => { const t = narbungsNormalen().clone(); t.repeat.set(rx, ry); t.needsUpdate = true; return t; };
  const glatt = (rx, ry, farbe = '#171615') => new THREE.MeshPhysicalMaterial({ ...lederBasis, color: farbe, normalMap: narb(rx * 3, ry * 3), normalScale: new THREE.Vector2(0.28, 0.28) });

  // Rückenlehne (Malfläche)
  const lehne = new THREE.Mesh(polster(PW, PH, 0.14, PT, PWU, 12, 0.14, BIEGE), lehneMat);
  sitz.add(lehne);
  // Keder in Royal-Blau
  {
    const pts = rundRechteck(PW * 1.012, PH * 1.008, 0.145).getPoints(80).map(p => new THREE.Vector3(p.x, p.y, PT / 2 + PWU * 0.62));
    const g = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, true), 320, 0.016, 10, true);
    biegen(g, PW / 2, BIEGE);
    g.computeVertexNormals();
    sitz.add(new THREE.Mesh(g, new THREE.MeshPhysicalMaterial({ color: '#3f9fd6', roughness: 0.4, clearcoat: 0.35, clearcoatRoughness: 0.35 })));
  }
  // Rückenschale (verbindet Mittelbahn und Wangen zu einem Sitz)
  const schale = new THREE.Mesh(polster(1.96, 1.84, 0.3, 0.16, 0.08, 8, 0.22, 0.22), glatt(5, 5, '#121110'));
  schale.position.set(0, -0.04, -0.2); sitz.add(schale);
  // Seitenwangen
  for (const s of [-1, 1]) {
    const w = new THREE.Mesh(polster(0.36, 1.68, 0.17, 0.14, 0.12, 12, 0.14), glatt(1.2, 6));
    w.position.set(s * 0.8, -0.07, -0.05); w.rotation.y = -s * 0.56; w.rotation.z = s * 0.02;
    sitz.add(w);
  }
  // Kopfstütze mit Stickerei + Chromstangen
  const kopf = new THREE.Mesh(polster(0.9, 0.48, 0.2, 0.12, 0.1, 10), new THREE.MeshPhysicalMaterial({ ...lederBasis, map: kopfTextur(), normalMap: narb(9, 4.8), normalScale: new THREE.Vector2(0.28, 0.28) }));
  kopf.position.set(0, 1.24, -0.06); kopf.rotation.x = -0.06; sitz.add(kopf);
  const chrom = new THREE.MeshPhysicalMaterial({ color: '#e3e7ea', metalness: 1, roughness: 0.14 });
  for (const s of [-1, 1]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.3, 20), chrom); p.position.set(s * 0.22, 0.92, -0.08); sitz.add(p); }
  // Sitzfläche (gleiches Steppmuster, ohne Schäden) + Wangen
  const flaeche = new THREE.Mesh(polster(1.24, 1.02, 0.14, 0.08, 0.1, 10), new THREE.MeshPhysicalMaterial({ ...lederBasis, map: tex.karte, normalMap: tex.norm, normalScale: new THREE.Vector2(0.45, 0.45) }));
  const sschale = new THREE.Mesh(polster(1.92, 1.16, 0.26, 0.14, 0.07, 8), glatt(5, 3, '#121110'));
  sschale.rotation.x = -Math.PI / 2 + 0.12; sschale.position.set(0, -1.13, 0.48); sitz.add(sschale);
  flaeche.rotation.x = -Math.PI / 2 + 0.12; flaeche.position.set(0, -1.02, 0.5); sitz.add(flaeche);
  for (const s of [-1, 1]) {
    const w = new THREE.Mesh(polster(0.3, 1.04, 0.13, 0.12, 0.1, 10), glatt(1, 3.6));
    w.rotation.set(-Math.PI / 2 + 0.12, 0, 0); w.rotateY(-s * 0.35); w.position.set(s * 0.78, -0.96, 0.5); sitz.add(w);
  }
  const schatten = bodenSchatten(3.2, 2.2, 0.6); schatten.position.set(0, -1.32, 0.3); sitz.add(schatten);
  const ring = werkzeugRing(); scene.add(ring);

  /* ---------- Rahmen: wo steht der Sitz auf dem Bildschirm ---------- */
  const MITTE = new THREE.Vector3(0, 0.12, 0);
  const ausrichten = () => {
    const { w, h } = st; const asp = w / h;
    cam.aspect = asp;
    const schmal = asp < 0.9;
    const ziel = schmal ? { cx: w * 0.5, cy: h * (h < 720 ? 0.63 : 0.6), hoch: h * (h < 720 ? 0.42 : 0.47), breit: w * 0.98 } : { cx: w * (asp > 1.5 ? 0.7 : 0.68), cy: h * 0.5, hoch: h * 0.8, breit: w * 0.5 };
    const t = Math.tan(THREE.MathUtils.degToRad(cam.fov / 2));
    const dH = (2.85 / 2) / t * (h / ziel.hoch), dW = (2.1 / 2) / (t * asp) * (w / ziel.breit);
    const d = Math.max(dH, dW);
    cam.position.set(0, 0.62 + d * 0.06, d).add(MITTE);
    cam.lookAt(MITTE);
    cam.setViewOffset(w, h, -(ziel.cx - w / 2), -(ziel.cy - h / 2), w, h);
    cam.updateProjectionMatrix();
  };

  /* ---------- Reparatur ---------- */
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  const zeiger = { u: 0, v: 0, aktiv: false, zuletzt: -1e9, druck: false };
  const auto = { u: 0.5, v: 0.5, i: 0, an: false };
  let fertigSeit = 0, neuAufbau = 0;
  const pinsel = (u, v, staerke = 0.5) => {
    const x = u * tex.MW, y = (1 - v) * tex.MH, r = tex.MW * 0.09;
    let g = mx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(0,0,0,${staerke})`); g.addColorStop(1, 'rgba(0,0,0,0)');
    mx.fillStyle = g; mx.fillRect(x - r, y - r, r * 2, r * 2);
    g = gx.createRadialGradient(x, y, 0, x, y, r * 1.1);
    g.addColorStop(0, 'rgba(255,255,255,.55)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    gx.fillStyle = g; gx.fillRect(x - r * 1.1, y - r * 1.1, r * 2.2, r * 2.2);
    maskT.needsUpdate = true;
  };
  const treffer = (cx, cy) => {
    const r = canvas.getBoundingClientRect();
    ndc.set(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, cam);
    const t = ray.intersectObject(lehne, false)[0];
    return t && t.uv ? t : null;
  };
  canvas.addEventListener('pointermove', e => {
    const t = treffer(e.clientX, e.clientY);
    if (e.pointerType === 'touch' && !zeiger.druck) return;
    zeiger.aktiv = !!t; zeiger.zuletzt = performance.now();
    if (t) { zeiger.u = t.uv.x; zeiger.v = t.uv.y; ring.position.copy(t.point).addScaledVector(t.face.normal.clone().transformDirection(lehne.matrixWorld), 0.02); }
    canvas.style.cursor = t ? 'none' : '';
  });
  canvas.addEventListener('pointerdown', e => { zeiger.druck = true; });
  addEventListener('pointerup', () => { zeiger.druck = false; });
  canvas.addEventListener('pointerleave', () => { zeiger.aktiv = false; canvas.style.cursor = ''; });

  // Rest-Schaden messen (gesamt + pro Stelle)
  const proz = document.getElementById('sitzProz'), balken = document.getElementById('sitzBar');
  const marken = Object.fromEntries([...document.querySelectorAll('.schaden')].map(m => [m.dataset.k, m]));
  const gesamtGewicht = tex.gewicht.reduce((a, b) => a + b, 0);
  const rest = SPOTS.map(() => 1);
  let zustand = 0, letzteMessung = 0;
  const messen = () => {
    const d = mx.getImageData(0, 0, tex.MW, tex.MH).data;
    let summe = 0;
    const s = SPOTS.map(() => [0, 0]);
    for (let y = 0; y < tex.MH; y++) for (let x = 0; x < tex.MW; x++) {
      const i = y * tex.MW + x, w = tex.gewicht[i]; if (!w) continue;
      const m = d[i * 4] / 255; summe += m;
      const u = (x + 0.5) / tex.MW, v = 1 - (y + 0.5) / tex.MH;
      SPOTS.forEach((p, k) => { if (Math.abs(u - p.u) < p.ru * 1.4 && Math.abs(v - p.v) < p.rv * 1.6) { s[k][0] += m; s[k][1]++; } });
    }
    s.forEach(([a, n], k) => { rest[k] = n ? a / n : 0; });
    // Anzeige: Startzustand 41 %, repariert 100 %
    zustand = Math.round(41 + 59 * (1 - summe / gesamtGewicht));
    if (rest.every(r => r < 0.08)) zustand = 100;
    proz.textContent = zustand + ' %';
    balken.style.width = zustand + '%';
    HUD.classList.toggle('fertig', zustand >= 100);
    SPOTS.forEach((p, k) => marken[p.k]?.classList.toggle('ok', rest[k] < 0.1));
  };

  const wp = new THREE.Vector3();
  const lokal = (u, v) => {
    const x = -PW / 2 + u * PW, y = -PH / 2 + v * PH, z = PT / 2 + PWU - BIEGE * Math.pow(x / (PW / 2), 2);
    return lehne.localToWorld(wp.set(x, y, z));
  };
  // Beschriftungen als Hinweislinien neben dem Sitz (verdecken den Schaden nicht)
  const linienSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  linienSvg.setAttribute('class', 'schaden-linien');
  document.getElementById('schaeden')?.prepend(linienSvg);
  const linien = SPOTS.map(() => { const l = document.createElementNS('http://www.w3.org/2000/svg', 'polyline'); linienSvg.append(l); return l; });
  const punkte = SPOTS.map(() => { const c = document.createElementNS('http://www.w3.org/2000/svg', 'circle'); c.setAttribute('r', '6'); linienSvg.append(c); return c; });
  const rand = new THREE.Vector3();
  const markenSetzen = () => {
    const { w, h } = st;
    linienSvg.setAttribute('viewBox', `0 0 ${w} ${h}`);
    const kanteL = lehne.localToWorld(rand.set(-1.08, 0, 0.1)).project(cam).x, kanteR = lehne.localToWorld(rand.set(1.08, 0, 0.1)).project(cam).x;
    const xl = (kanteL * 0.5 + 0.5) * w, xr = (kanteR * 0.5 + 0.5) * w;
    SPOTS.forEach((p, k) => {
      const m = marken[p.k]; if (!m) return;
      const q = lokal(p.u, p.v).project(cam);
      const x = (q.x * 0.5 + 0.5) * w, y = (-q.y * 0.5 + 0.5) * h;
      const links = p.u < 0.5, bw = m.offsetWidth;
      const platz = links ? xl - 24 - bw > 8 : xr + 24 + bw < w - 8;
      let lx, ly = y;
      if (platz) lx = links ? xl - 24 - bw : xr + 24;
      else { lx = Math.min(w - bw - 8, Math.max(8, x - bw / 2)); ly = y - 34; }
      m.classList.toggle('links', false);
      m.style.transform = `translate(${Math.round(lx)}px, ${Math.round(ly - m.offsetHeight / 2)}px)`;
      const ax = platz ? (links ? lx + bw : lx) : x, ay = platz ? ly : ly + m.offsetHeight / 2;
      linien[k].setAttribute('points', `${ax},${ay} ${platz ? (links ? ax + 10 : ax - 10) : ax},${ay} ${x},${y}`);
      linien[k].classList.toggle('ok', m.classList.contains('ok'));
      punkte[k].setAttribute('cx', x); punkte[k].setAttribute('cy', y); punkte[k].classList.toggle('ok', m.classList.contains('ok'));
      m.classList.add('sicht');
    });
  };

  // Scroll: Sitz dreht sich beim Weiterscrollen leicht weg
  let scrollAnteil = 0;
  addEventListener('scroll', () => { scrollAnteil = Math.min(1, scrollY / (innerHeight || 1)); }, { passive: true });
  const maus = { x: 0, y: 0 };
  addEventListener('pointermove', e => { maus.x = e.clientX / innerWidth - 0.5; maus.y = e.clientY / innerHeight - 0.5; }, { passive: true });

  let w0 = 0, h0 = 0, start0 = performance.now() / 1000;
  canvas.style.opacity = 0; canvas.style.transition = 'opacity 1s ease';
  requestAnimationFrame(() => { canvas.style.opacity = 1; });

  schleife(st, (t, dt) => {
    if (st.w !== w0 || st.h !== h0) { w0 = st.w; h0 = st.h; ausrichten(); }
    const zeit = t - start0;
    // Sitz: ruhige Eigenbewegung + Maus + Scroll
    const ziel = -0.34 + (RUHIG ? 0 : Math.sin(zeit * 0.25) * 0.07) + maus.x * 0.16 + scrollAnteil * 0.5;
    sitz.rotation.y += (ziel - sitz.rotation.y) * Math.min(1, dt * 3);
    sitz.rotation.x += ((maus.y * 0.05 - 0.02) - sitz.rotation.x) * Math.min(1, dt * 3);
    sitz.position.y = (RUHIG ? 0 : Math.sin(zeit * 0.6) * 0.02) + scrollAnteil * 0.4;
    // Wanderndes Studiolicht
    spot.position.set(Math.sin(zeit * 0.22) * 3.4, 3.2, 3.6); spot.target.position.set(0, 0, 0);

    // Reparatur: Maus/Finger oder Werkzeug
    const jetzt = performance.now();
    const handAktiv = zeiger.aktiv && jetzt - zeiger.zuletzt < 1200;
    auto.an = !handAktiv && zeit > 3.2 && zustand < 100 && (HANDY || jetzt - zeiger.zuletzt > 2600);
    if (handAktiv) { pinsel(zeiger.u, zeiger.v, 0.42); ring.visible = true; }
    else if (auto.an) {
      let k = auto.i; for (let n = 0; n < SPOTS.length && rest[k] < 0.06; n++) k = (k + 1) % SPOTS.length; auto.i = k;
      const p = SPOTS[k];
      const tu = p.u + p.ru * 0.85 * Math.sin(zeit * 2.6), tv = p.v + p.rv * 0.8 * Math.sin(zeit * 1.9 + 1);
      auto.u += (tu - auto.u) * Math.min(1, dt * 3.2); auto.v += (tv - auto.v) * Math.min(1, dt * 3.2);
      pinsel(auto.u, auto.v, 0.07);
      ring.position.copy(lokal(auto.u, auto.v)); ring.visible = true;
    } else ring.visible = false;

    // Leuchtspur verblasst
    gx.fillStyle = `rgba(0,0,0,${Math.min(1, dt * 2.2)})`; gx.fillRect(0, 0, tex.MW, tex.MH);
    glowT.needsUpdate = true;

    if (jetzt - letzteMessung > 220) { letzteMessung = jetzt; messen(); }
    // Nach „Wie neu“ kommt der Schaden langsam zurück (Schleife für die nächsten Besucher)
    if (zustand >= 100) { fertigSeit ||= jetzt; if (jetzt - fertigSeit > 7000 && !zeiger.aktiv) neuAufbau = 1; } else fertigSeit = 0;
    if (neuAufbau) {
      mx.fillStyle = `rgba(255,255,255,${Math.min(1, dt * 0.9)})`; mx.fillRect(0, 0, tex.MW, tex.MH); maskT.needsUpdate = true;
      if (mx.getImageData(tex.MW >> 1, tex.MH >> 1, 1, 1).data[0] > 250) { mx.fillStyle = '#fff'; mx.fillRect(0, 0, tex.MW, tex.MH); neuAufbau = 0; fertigSeit = 0; zustand = 0; }
    }
    renderer.render(scene, cam);
    markenSetzen();
  });
  document.querySelector('.held')?.classList.add('webgl');
}

if (canvas && hatWebGL()) start().catch(e => console.error('sitz', e));
