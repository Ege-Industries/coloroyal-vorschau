// Fuß: das neue Logo als Leder-Patch in 3D (links Nappa-Schwarz, rechts Royal-Blau, Mittelnaht).
import * as THREE from 'three';
import { LOGO } from './logo-form.js';
import { buehne, narbungsNormalen, lichter, schleife, RUHIG, hatWebGL } from './leder.js';

const canvas = document.getElementById('patch3d');
if (canvas && hatWebGL()) start();

function form(kontur) {
  const s = new THREE.Shape();
  kontur.forEach(([x, y], i) => { const X = (x - 50) / 100, Y = (63 - y) / 100; i ? s.lineTo(X, Y) : s.moveTo(X, Y); });
  s.closePath();
  return s;
}

function start() {
  canvas.closest('.fuss-patch')?.classList.add('webgl');
  const { renderer, scene, st } = buehne(canvas, { belichtung: 0.95, dpr: 1.75 });
  const cam = new THREE.PerspectiveCamera(30, 1, 0.1, 20);
  lichter(scene, { blau: 14, haupt: 2.4 });
  const spot = new THREE.SpotLight('#fff3e6', 26, 8, 0.6, 1, 1.4); spot.position.set(1.5, 1.5, 2.5); scene.add(spot, spot.target);
  const g = new THREE.Group(); scene.add(g);
  const narb = () => { const t = narbungsNormalen().clone(); t.repeat.set(9, 9); t.needsUpdate = true; return t; };
  const basis = { roughness: 0.44, clearcoat: 0.3, clearcoatRoughness: 0.38, normalScale: new THREE.Vector2(0.3, 0.3) };
  const opts = { depth: 0.05, bevelEnabled: true, bevelThickness: 0.025, bevelSize: 0.012, bevelSegments: 5, curveSegments: 12 };
  const teile = [
    [LOGO.links, new THREE.MeshPhysicalMaterial({ ...basis, color: '#1a1918', normalMap: narb() })],
    [LOGO.rechts, new THREE.MeshPhysicalMaterial({ ...basis, color: '#3592cc', normalMap: narb() })],
  ];
  for (const [konturen, mat] of teile) {
    for (const k of konturen) {
      const geo = new THREE.ExtrudeGeometry(form(k), opts);
      geo.translate(0, 0, -0.025);
      // UV über die Form, damit die Narbung gleichmäßig liegt
      const uv = geo.attributes.uv, p = geo.attributes.position;
      for (let i = 0; i < uv.count; i++) uv.setXY(i, p.getX(i) + 0.5, p.getY(i) + 0.63);
      g.add(new THREE.Mesh(geo, mat));
    }
  }
  const maus = { x: 0, y: 0 };
  addEventListener('pointermove', e => { maus.x = e.clientX / innerWidth - 0.5; maus.y = e.clientY / innerHeight - 0.5; }, { passive: true });
  let w0 = 0, h0 = 0;
  schleife(st, (t, dt) => {
    if (st.w !== w0 || st.h !== h0) {
      w0 = st.w; h0 = st.h; cam.aspect = st.w / st.h;
      const d = (1.45 / 2) / Math.tan(THREE.MathUtils.degToRad(15)) / Math.min(1, cam.aspect / 0.85);
      cam.position.set(0, 0, d); cam.lookAt(0, 0, 0); cam.updateProjectionMatrix();
    }
    const zy = (RUHIG ? 0 : Math.sin(t * 0.55) * 0.5) + maus.x * 0.5, zx = (RUHIG ? 0 : Math.sin(t * 0.4) * 0.12) + maus.y * 0.3;
    g.rotation.y += (zy - g.rotation.y) * Math.min(1, dt * 3);
    g.rotation.x += (zx - g.rotation.x) * Math.min(1, dt * 3);
    spot.position.x = Math.sin(t * 0.7) * 2;
    renderer.render(scene, cam);
  });
}
