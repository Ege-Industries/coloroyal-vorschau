// Startseite: Leistungen als 3D-Musterfächer aus echten Lederfarben. Scrollen fächert auf und wählt das Muster.
import * as THREE from 'three';
import { DATEN } from './daten.js';
import { buehne, musterBlatt, niete, lichter, schleife, HANDY, RUHIG, hatWebGL } from './leder.js';

const sektion = document.getElementById('leistungen');
const canvas = document.getElementById('faecher3d');
const karten = [...document.querySelectorAll('.fk')];
const punkte = [...document.querySelectorAll('.fp')];
const N = DATEN.leistungen.length;

// Aktives Muster aus der Scroll-Position (funktioniert auch ohne WebGL)
let s = 0, aktiv = -1;
const scrollStand = () => {
  const r = sektion.getBoundingClientRect(), weg = r.height - innerHeight;
  const p = Math.min(1, Math.max(0, -r.top / Math.max(1, weg)));
  s = p * (N - 1);
  const k = Math.round(s);
  if (k !== aktiv) {
    aktiv = k;
    karten.forEach((c, i) => c.classList.toggle('an', i === k));
    punkte.forEach((c, i) => c.classList.toggle('an', i === k));
  }
  return r;
};
if (sektion) {
  addEventListener('scroll', scrollStand, { passive: true });
  addEventListener('resize', scrollStand);
  scrollStand();
  punkte.forEach((b, i) => b.addEventListener('click', () => {
    const top = sektion.getBoundingClientRect().top + scrollY, weg = sektion.offsetHeight - innerHeight;
    scrollTo({ top: top + weg * (i / (N - 1)) + 2, behavior: 'smooth' });
  }));
  if (canvas && hatWebGL()) document.fonts.load('600 50px Cinzel').catch(() => {}).finally(start);
}

function start() {
  const { renderer, scene, st } = buehne(canvas, { belichtung: 1.1 });
  const cam = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
  lichter(scene, { blau: 22, haupt: 2.3 });
  const spot = new THREE.SpotLight('#fff3e6', 40, 12, 0.5, 1, 1.4); spot.position.set(-2, 3, 4); scene.add(spot, spot.target);

  const faecher = new THREE.Group(); scene.add(faecher);
  const blaetter = DATEN.leistungen.map((l, i) => { const m = musterBlatt(l, i); faecher.add(m); return m; });
  const n = niete(); n.position.z = 0.0; faecher.add(n);

  // Bildausschnitt: Fächer links (Desktop) bzw. oben mittig (Handy)
  const MITTE = new THREE.Vector3(0, 1.0, 0);
  const ausrichten = () => {
    const { w, h } = st, asp = w / h, schmal = asp < 0.9;
    cam.aspect = asp;
    const ziel = schmal ? { cx: w * 0.5, cy: h * 0.47, hoch: h * 0.4 } : { cx: w * (asp > 1.4 ? 0.42 : 0.38), cy: h * 0.6, hoch: h * 0.58 };
    const t = Math.tan(THREE.MathUtils.degToRad(cam.fov / 2));
    const d = Math.max((2.3 / 2) / t * (h / ziel.hoch), (2.4 / 2) / (t * asp) * (w / (schmal ? w * 0.96 : w * 0.5)));
    cam.position.set(0.2, 1.0 + d * 0.05, d).add(new THREE.Vector3(0, 0, 0));
    cam.lookAt(MITTE);
    cam.setViewOffset(w, h, -(ziel.cx - w / 2), -(ziel.cy - h / 2), w, h);
    cam.updateProjectionMatrix();
  };

  let w0 = 0, h0 = 0, auf = 0, ss = 0;
  schleife(st, (t, dt) => {
    if (st.w !== w0 || st.h !== h0) { w0 = st.w; h0 = st.h; ausrichten(); }
    const r = sektion.getBoundingClientRect();
    // Auffächern beim Hereinscrollen
    const rein = Math.min(1, Math.max(0, 1 - r.top / innerHeight));
    auf += (rein - auf) * Math.min(1, dt * 4);
    ss += (s - ss) * Math.min(1, dt * 6);
    const spreiz = 0.03 + 0.19 * auf;
    blaetter.forEach((b, i) => {
      const a = (i - (N - 1) / 2) * spreiz;
      const w = Math.max(0, 1 - Math.abs(i - ss));           // Gewicht des aktiven Blatts
      b.rotation.z = -a;
      const ox = Math.sin(a) * 0, raus = 0.32 * w * auf;
      b.position.set(-Math.sin(-a) * raus + ox, Math.cos(a) * raus, i * 0.03 + w * 0.12);
    });
    // Ganzer Fächer dreht so, dass das aktive Blatt aufrecht steht
    const ziel = (ss - (N - 1) / 2) * spreiz;
    faecher.rotation.z += (ziel - faecher.rotation.z) * Math.min(1, dt * 5);
    faecher.rotation.y = (RUHIG ? 0 : Math.sin(t * 0.4) * 0.12) - 0.18;
    faecher.rotation.x = -0.08;
    spot.position.x = Math.sin(t * 0.3) * 2.5;
    renderer.render(scene, cam);
  });
}
