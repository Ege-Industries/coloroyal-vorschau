// Startseite „Unsere Leistungen“: 3D-Trommel aus sechs echten Arbeiten – in Schritten:
// Geste → Vorher. Geste → dieselbe Tafel wird repariert (Nachher). Geste → Trommel dreht zur nächsten Tafel (Vorher).
// Solange die Trommel den Bildschirm füllt, ist sie „eingehängt“: jede Geste (Wischen, Mausrad, Taste) = genau ein Schritt,
// egal wie schnell. Am Anfang bzw. Ende geht die Seite normal weiter.
import * as THREE from 'three';
import { DATEN } from './daten.js';

const BASE = document.body.dataset.base || '';
const sektion = document.getElementById('leistungen');
const canvas = document.getElementById('karussell3d');
const karten = [...document.querySelectorAll('.kk')];
const punkte = [...document.querySelectorAll('.kp')];
const chip = document.getElementById('kChip');
const L = DATEN.leistungen, N = L.length;
const TXT = DATEN.texte;
const RUHIG = matchMedia('(prefers-reduced-motion: reduce)').matches;
const k01 = x => Math.min(1, Math.max(0, x));
const glatt = (a, b, x) => { const t = k01((x - a) / (b - a)); return t * t * (3 - 2 * t); };

// Schritt k (0 … 2N-1): Tafel = floor(k/2), ungerade = Nachher
const stopps = sektion ? [...sektion.querySelectorAll('.k-stopp')] : [];
const LETZT = 2 * N - 1;
const stand = { k: 0, aktiv: -1, gesperrt: false, sofort: false };
window.__trommel = stand;   // nur zum Prüfen
const REP_S = 1.5;   // Dauer der Nachher-Animation
const sanft = t => -(Math.cos(Math.PI * t) - 1) / 2;
const oben = () => sektion.getBoundingClientRect().top + scrollY;
const ende = () => oben() + sektion.offsetHeight - innerHeight;
const stoppY = k => oben() + (stopps[k]?.offsetTop || 0);

function zeigen() {
  const a = Math.floor(stand.k / 2);
  if (a !== stand.aktiv) {
    stand.aktiv = a;
    karten.forEach((c, j) => c.classList.toggle('an', j === a));
    punkte.forEach((c, j) => c.classList.toggle('an', j === a));
  }
}
let letzterSchritt = 0, ruheBis = 0, letztesY = 0;
function sperren(k, sofort = k > 0) {
  stand.k = k; stand.gesperrt = true; stand.sofort = sofort; zeigen();
  document.documentElement.classList.add('trommel-fest');
  scrollTo({ top: stoppY(k), behavior: 'instant' });
  letzterSchritt = performance.now();
}
function entsperren() { stand.gesperrt = false; document.documentElement.classList.remove('trommel-fest'); }
function verlassen(r) {
  entsperren(); ruheBis = performance.now() + 1200;
  scrollTo({ top: r > 0 ? ende() + innerHeight : oben() - innerHeight, behavior: 'smooth' });
}
function schritt(r, quelle = '') {
  const n = stand.k + r;
  if (n < 0) return verlassen(-1);
  if (n > LETZT) return verlassen(1);
  stand.k = n; zeigen();
  scrollTo({ top: stoppY(n), behavior: 'instant' });
  letzterSchritt = performance.now();
}
// Hineinscrollen erkennen (von oben → Schritt 0, von unten → letzter Schritt)
function beimScrollen() {
  const y = scrollY;
  if (!stand.gesperrt && performance.now() > ruheBis) {
    const o = oben(), e = ende();
    if (letztesY < o - 1 && y >= o - 1 && y <= e) sperren(0);
    else if (letztesY > e + 1 && y <= e + 1 && y >= o) sperren(LETZT);
    else if (y > o + 2 && y < e - 2) { let k = 0, bd = Infinity; stopps.forEach((s, j) => { const d = Math.abs(o + s.offsetTop - y); if (d < bd) { bd = d; k = j; } }); sperren(k); }
  }
  letztesY = scrollY;
}
// Gesten → Schritte
let radZuletzt = 0, beruehrY = null;
let radBetragZuletzt = 0;
function amRad(e) {
  if (!stand.gesperrt) return;
  e.preventDefault();
  const jetzt = performance.now(), betrag = Math.abs(e.deltaY);
  // neue Geste: nach einer Pause – oder wenn mitten im abklingenden Nachlauf wieder kräftig angeschoben wird
  const neueGeste = jetzt - radZuletzt > 220 || (betrag > 12 && betrag > radBetragZuletzt * 2.5);
  radZuletzt = jetzt; radBetragZuletzt = betrag;
  if (betrag < 2) return;
  if (neueGeste && jetzt - letzterSchritt > 450) schritt(Math.sign(e.deltaY), 'rad');
}
function amBeruehrStart(e) { beruehrY = stand.gesperrt ? e.touches[0].clientY : null; }
function amBeruehrZug(e) { if (stand.gesperrt && e.cancelable) e.preventDefault(); }
function amBeruehrEnde(e) {
  if (!stand.gesperrt || beruehrY == null) return;
  const dy = beruehrY - (e.changedTouches[0]?.clientY ?? beruehrY);
  beruehrY = null;
  if (Math.abs(dy) > 30 && performance.now() - letzterSchritt > 250) schritt(Math.sign(dy), 'touch' + e.type);
}
function amTaste(e) {
  if (!stand.gesperrt) return;
  const runter = ['ArrowDown', 'PageDown', ' ', 'Spacebar'].includes(e.key), hoch = ['ArrowUp', 'PageUp'].includes(e.key);
  if (!runter && !hoch) return;
  e.preventDefault(); schritt(runter ? 1 : -1, 'taste');
}

if (sektion) {
  letztesY = scrollY;
  addEventListener('scroll', beimScrollen, { passive: true });
  addEventListener('wheel', amRad, { passive: false });
  addEventListener('touchstart', amBeruehrStart, { passive: true });
  addEventListener('touchmove', amBeruehrZug, { passive: false });
  addEventListener('touchend', amBeruehrEnde, { passive: true });
  addEventListener('keydown', amTaste);
  // Sprungmarken (Menü, Knöpfe) dürfen durch die Trommel hindurch
  document.addEventListener('click', e => { if (e.target.closest('a[href*="#"], .kopf a, .menue a')) { entsperren(); ruheBis = performance.now() + 1500; } }, true);
  addEventListener('resize', () => { if (stand.gesperrt) scrollTo({ top: stoppY(stand.k), behavior: 'instant' }); });
  beimScrollen();
  punkte.forEach((b, i) => b.addEventListener('click', () => { if (!stand.gesperrt) sperren(2 * i); else { stand.k = 2 * i; zeigen(); scrollTo({ top: stoppY(2 * i), behavior: 'instant' }); } }));
  if (canvas) {
    const io = new IntersectionObserver(es => { if (es[0].isIntersecting) { io.disconnect(); start(); } }, { rootMargin: '600px' });
    io.observe(sektion);
  }
}

const VERT = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`;
const FRAG = `
varying vec2 vUv;
uniform sampler2D tV, tN;
uniform float uP, uT, uAsp, uImgAsp, uDim, uSpiegel, uBereit;
uniform vec2 uFokus;
float h21(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float n2(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
  return mix(mix(h21(i), h21(i + vec2(1, 0)), f.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), f.x), f.y); }
float fbm(vec2 p){ float v = 0., a = .5; for (int k = 0; k < 4; k++) { v += a * n2(p); p = p * 2.03 + 3.7; a *= .5; } return v; }
vec3 gradeV(vec3 c){ float l = dot(c, vec3(.299, .587, .114)); c = mix(vec3(l), c, .62); c *= vec3(.96, .99, 1.04); return (c - .5) * .9 + .46; }
vec3 gradeN(vec3 c){ float l = dot(c, vec3(.299, .587, .114)); c = mix(vec3(l), c, 1.14); c *= vec3(1.04, 1., .96); return (c - .5) * 1.07 + .5; }
float rr(vec2 p, vec2 b, float r){ vec2 q = abs(p) - b + r; return length(max(q, 0.)) + min(max(q.x, q.y), 0.) - r; }
void main(){
  vec2 uv = vUv;
  vec2 k = uAsp > uImgAsp ? vec2(1., uImgAsp / uAsp) : vec2(uAsp / uImgAsp, 1.);
  vec2 iuv = uFokus + (uv - .5) * k;
  float bias = uSpiegel * 3.;
  vec3 cv = gradeV(texture2D(tV, iuv, bias).rgb), cn = gradeN(texture2D(tN, iuv, bias).rgb);
  vec2 q = vec2((uv.x - .5) * uAsp, uv.y - .5);
  vec2 dir = normalize(vec2(1., .55));
  float spann = .5 * (dir.x * uAsp + dir.y) + .16;
  float n = (fbm(q * 4.2 + vec2(0., uT * .2)) - .5) * .2;
  float d = dot(q, dir) + n - mix(-spann, spann, uP);
  float m = 1. - smoothstep(-.008, .008, d);
  vec3 c = mix(cv, cn, m);
  float aktiv = step(.001, uP) * step(uP, .999);
  c += (1. - c) * aktiv * (vec3(.86, .72, .5) * exp(-d * d / .01) * .4 + vec3(1., .96, .88) * exp(-d * d / .0005));
  float funke = step(.994, h21(floor(uv * vec2(260., 400.)) + floor(uT * 20.))) * exp(-pow((d - .03) / .045, 2.)) * aktiv;
  c += funke * vec3(1., .9, .72) * 1.2;
  vec2 b = vec2(.5 * uAsp, .5);
  float sd = rr(q, b, .045);
  float alpha = 1. - smoothstep(-.003, .001, sd);
  float nahtD = abs(sd + .024);
  float koord = abs(q.x) > b.x - .07 ? q.y : q.x;
  float strich = step(.42, fract(koord * 30.));
  c = mix(c, vec3(.94, .9, .84), (1. - smoothstep(.0012, .003, nahtD)) * .22);
  c *= .8 + .2 * smoothstep(0., -.14, sd);
  c *= 1. - uDim * .66;
  c *= uBereit;
  if (uSpiegel > .5) alpha *= .3 * (1. - smoothstep(0., .5, uv.y));
  else if (alpha < .5) discard;
  gl_FragColor = vec4(c, alpha);
}`;

async function start() {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, innerWidth < 760 ? 1.6 : 1.8));
  renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
  const scene = new THREE.Scene();
  const cam = new THREE.PerspectiveCamera(30, 1, 0.1, 60);
  const R = 3.3, SCHRITT = 0.66, PW = 1.3, PH = 2.08, BODEN = -PH / 2 - 0.05;

  const geo = new THREE.PlaneGeometry(PW, PH, 48, 1);
  { const p = geo.attributes.position; for (let i = 0; i < p.count; i++) { const a = p.getX(i) / R; p.setX(i, R * Math.sin(a)); p.setZ(i, R * Math.cos(a) - R); } }
  const lader = new THREE.TextureLoader();
  const textur = url => new Promise(ok => lader.load(url, t => { t.colorSpace = THREE.NoColorSpace; t.anisotropy = 8; t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; ok(t); }, undefined, () => ok(null)));

  const trommel = new THREE.Group(); trommel.position.z = -R; scene.add(trommel);
  const tafeln = L.map((l, i) => {
    const id = l.karussell, f = (TXT[id] && TXT[id].fokus) || [0.5, 0.5];
    const uni = { tV: { value: null }, tN: { value: null }, uP: { value: 0 }, uT: { value: 0 }, uAsp: { value: PW / PH }, uImgAsp: { value: 0.5 }, uDim: { value: 0 }, uSpiegel: { value: 0 }, uBereit: { value: 0 }, uFokus: { value: new THREE.Vector2(f[0], 1 - f[1]) } };
    const mat = new THREE.ShaderMaterial({ uniforms: uni, vertexShader: VERT, fragmentShader: FRAG, side: THREE.DoubleSide });
    const spiegelUni = { ...uni, uSpiegel: { value: 1 } };   // teilt alle anderen Uniform-Objekte mit der Tafel
    const sMat = new THREE.ShaderMaterial({ uniforms: spiegelUni, vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthWrite: false, side: THREE.DoubleSide });
    const a = i * SCHRITT;
    const halter = new THREE.Group(); halter.rotation.y = a; trommel.add(halter);
    const m = new THREE.Mesh(geo, mat); m.position.z = R; halter.add(m);
    const s = new THREE.Mesh(geo, sMat); s.position.set(0, 2 * BODEN, R); s.scale.y = -1; halter.add(s);
    Promise.all([textur(`${BASE}assets/img/arbeiten-hd/${id}-v.jpg`), textur(`${BASE}assets/img/arbeiten-hd/${id}-n.jpg`)]).then(([v, n]) => {
      if (!v || !n) return;
      uni.tV.value = v; uni.tN.value = n; uni.uImgAsp.value = v.image.width / v.image.height;
      // Fokus so begrenzen, dass die Tafel immer ganz im Foto liegt
      const k = uni.uAsp.value > uni.uImgAsp.value ? [1, uni.uImgAsp.value / uni.uAsp.value] : [uni.uAsp.value / uni.uImgAsp.value, 1];
      uni.uFokus.value.set(Math.min(1 - k[0] / 2, Math.max(k[0] / 2, f[0])), Math.min(1 - k[1] / 2, Math.max(k[1] / 2, 1 - f[1])));
      uni.bereitZiel = 1;
    });
    return { uni, spiegelUni, a };
  });
  // Lichtpfütze auf dem Boden unter der vorderen Tafel
  const pf = document.createElement('canvas'); pf.width = pf.height = 128;
  { const x = pf.getContext('2d'), g = x.createRadialGradient(64, 64, 2, 64, 64, 64); g.addColorStop(0, 'rgba(205,177,132,.42)'); g.addColorStop(.5, 'rgba(205,177,132,.1)'); g.addColorStop(1, 'rgba(205,177,132,0)'); x.fillStyle = g; x.fillRect(0, 0, 128, 128); }
  const pfuetze = new THREE.Mesh(new THREE.PlaneGeometry(PW * 2.6, 1.6), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(pf), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  pfuetze.rotation.x = -Math.PI / 2; pfuetze.position.set(0, BODEN, 0.1); scene.add(pfuetze);

  let w0 = 0, h0 = 0;
  const ausrichten = () => {
    const r = canvas.getBoundingClientRect(), w = r.width, h = r.height;
    renderer.setSize(w, h, false);
    const asp = w / h, schmal = asp < 0.9;
    cam.aspect = asp;
    const ziel = schmal ? { cx: w * 0.5, cy: h * 0.45, hoch: h * (h < 720 ? 0.36 : 0.44), breit: w * 0.66 } : { cx: w * (asp > 1.5 ? 0.64 : 0.62), cy: h * 0.47, hoch: h * 0.6, breit: w * 0.3 };
    const t = Math.tan(THREE.MathUtils.degToRad(cam.fov / 2));
    const d = Math.max((PH / 2) / t * (h / ziel.hoch), (PW / 2) / (t * asp) * (w / ziel.breit));
    cam.position.set(0, 0.32 + d * 0.035, d); cam.lookAt(0, -0.06, 0);
    cam.setViewOffset(w, h, -(ziel.cx - w / 2), -(ziel.cy - h / 2), w, h);
    cam.updateProjectionMatrix();
    w0 = w; h0 = h;
  };
  ausrichten();
  new ResizeObserver(ausrichten).observe(canvas);
  let sicht = true;
  new IntersectionObserver(es => { sicht = es[0].isIntersecting; }).observe(canvas);
  const maus = { x: 0, y: 0 };
  addEventListener('pointermove', e => { maus.x = e.clientX / innerWidth - 0.5; maus.y = e.clientY / innerHeight - 0.5; }, { passive: true });

  const ecke = new THREE.Vector3();
  let rot = Math.floor(stand.k / 2), last = performance.now();
  const tick = now => {
    requestAnimationFrame(tick);
    const dt = Math.min(0.05, Math.max(0, (now - last) / 1000)); last = now;
    if (!sicht || document.hidden) return;
    const t = now / 1000;
    const zielTafel = Math.floor(stand.k / 2);
    // Einstieg von unten / nach Neuladen: ohne Durchdrehen direkt im richtigen Zustand
    if (stand.sofort) { rot = zielTafel; tafeln.forEach((tf, i) => { tf.p = i < zielTafel ? 1 : i > zielTafel ? 0 : stand.k % 2; }); stand.sofort = false; }
    rot += (zielTafel - rot) * Math.min(1, dt * 4.2);
    if (Math.abs(zielTafel - rot) < 0.001) rot = zielTafel;
    trommel.rotation.y = -rot * SCHRITT + (RUHIG ? 0 : maus.x * 0.08);
    trommel.rotation.x = RUHIG ? 0 : maus.y * 0.03;
    tafeln.forEach((tf, i) => {
      const abst = Math.abs(i - rot);
      // Ziel: Tafeln vor der aktuellen sind fertig, die aktuelle nur im ungeraden Schritt, die danach noch nicht
      const pz = i < zielTafel ? 1 : i > zielTafel ? 0 : stand.k % 2;
      tf.p = tf.p || 0;
      if (RUHIG) tf.p = pz;
      else if (pz > tf.p) tf.p = (i === zielTafel && abst > 0.08) ? tf.p : i < zielTafel && abst > 0.6 ? 1 : Math.min(1, tf.p + dt / REP_S);
      else tf.p = Math.max(pz, tf.p - dt / 0.6);
      const p = sanft(tf.p);
      tf.uni.uP.value = p; tf.uni.uT.value = t % 1000;
      tf.uni.uDim.value = glatt(0.15, 1.1, abst);
      tf.uni.uBereit.value += ((tf.uni.bereitZiel || 0) - tf.uni.uBereit.value) * Math.min(1, dt * 3);
    });
    renderer.render(scene, cam);
    // Vorher/Nachher-Etikett an der linken oberen Ecke der vorderen Tafel
    if (chip) {
      const k = Math.round(rot), p = sanft(tafeln[k].p || 0);
      ecke.set(-PW / 2, PH / 2, 0).project(cam);
      chip.style.transform = `translate(${Math.round((ecke.x * 0.5 + 0.5) * w0) + 12}px, ${Math.round((-ecke.y * 0.5 + 0.5) * h0) + 12}px)`;
      chip.dataset.s = p > 0.5 ? 'nachher' : 'vorher';
      chip.style.opacity = Math.abs(rot - k) < 0.12 ? 1 : 0;
    }
  };
  requestAnimationFrame(tick);
  sektion.classList.add('gl');
}
