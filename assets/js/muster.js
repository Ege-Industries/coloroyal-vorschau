// Leistungsseite: ein einzelnes Ledermuster in der Farbe der Leistung, schwebt und dreht sich langsam.
import * as THREE from 'three';
import { buehne, musterBlatt, niete, lichter, schleife, RUHIG, hatWebGL } from './leder.js';

const canvas = document.getElementById('muster3d');
if (canvas && hatWebGL()) document.fonts.load('600 50px Cinzel').catch(() => {}).finally(start);

function start() {
  const d = canvas.dataset;
  const l = { hex: d.farbe, nr: d.nr, kurz: d.name, hell: ['#d8c9ae'].includes(d.farbe) };
  const { renderer, scene, st } = buehne(canvas, { belichtung: 1.1 });
  const cam = new THREE.PerspectiveCamera(30, 1, 0.1, 30);
  lichter(scene, { blau: 18, haupt: 2.4 });
  const blatt = musterBlatt(l, 0);
  const g = new THREE.Group(); g.add(blatt); const n = niete(); g.add(n); scene.add(g);
  g.position.y = -0.75;
  let w0 = 0;
  schleife(st, t => {
    if (st.w !== w0) { w0 = st.w; cam.aspect = st.w / st.h; const dd = (2.3 / 2) / Math.tan(THREE.MathUtils.degToRad(15)) * 1.05 / Math.min(1, cam.aspect / 0.68); cam.position.set(0, 0.2, dd); cam.lookAt(0, 0.2, 0); cam.updateProjectionMatrix(); }
    g.rotation.y = RUHIG ? -0.3 : Math.sin(t * 0.5) * 0.45 - 0.2;
    g.rotation.z = RUHIG ? 0.12 : 0.1 + Math.sin(t * 0.33) * 0.06;
    renderer.render(scene, cam);
  });
}
