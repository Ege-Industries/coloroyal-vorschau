// Startseite oben: Kino-Film aus echten Arbeiten. Vorher (stumpf, unscharf) → Reparatur-Naht fährt durchs Bild → Nachher (satt, mit Glanz).
import { DATEN } from './daten.js';
import { auswahl } from './auswahl.js';

const BASE = document.body.dataset.base || '';
const huelle = document.getElementById('film');
const canvas = document.getElementById('filmCanvas');
const P = Object.fromEntries(DATEN.arbeiten.paare.map(p => [p.id, p]));
const TXT = DATEN.texte;
const RUHIG = matchMedia('(prefers-reduced-motion: reduce)').matches;
const HANDY = () => innerWidth < 760;

// Zeitplan einer Szene (Sekunden)
const Z = { ein: 1.1, vorher: 1.9, rep: 2.9, nachher: 2.6, aus: 0.7 };
const DAUER = Z.ein + Z.vorher + Z.rep + Z.nachher + Z.aus;
const FEST = new URLSearchParams(location.search).get('filmzeit');   // nur für Prüfbilder: Zeit festhalten
const ease = t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const sanft = t => -(Math.cos(Math.PI * t) - 1) / 2;
const k01 = x => Math.min(1, Math.max(0, x));

const ui = {
  nr: document.getElementById('filmNr'), titel: document.getElementById('filmTitel'), schaden: document.getElementById('filmSchaden'),
  status: document.getElementById('filmStatus'), seg: document.getElementById('filmSeg'),
};

const FRAG = `#version 300 es
precision highp float;
in vec2 vS; out vec4 o;
uniform sampler2D uV, uN;
uniform vec2 uRes, uFocus, uSF;
uniform float uImgAsp, uZoom, uReveal, uTime, uFade, uBlur, uShine, uLinks;
float h21(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float n2(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
  return mix(mix(h21(i), h21(i + vec2(1, 0)), f.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), f.x), f.y); }
float fbm(vec2 p){ float v = 0., a = .55; for (int k = 0; k < 3; k++) { v += a * n2(p); p = p * 2.02 + 7.1; a *= .45; } return v; }
vec3 gradeV(vec3 c){ float l = dot(c, vec3(.299, .587, .114)); c = mix(vec3(l), c, .6); c *= vec3(.96, .99, 1.04); return (c - .5) * .9 + .46; }
vec3 gradeN(vec3 c){ float l = dot(c, vec3(.299, .587, .114)); c = mix(vec3(l), c, 1.15); c *= vec3(1.04, 1., .96); return (c - .5) * 1.08 + .5; }
void main(){
  vec2 s = vS;
  float ca = uRes.x / uRes.y;
  vec2 k = ca > uImgAsp ? vec2(1., uImgAsp / ca) : vec2(ca / uImgAsp, 1.);
  vec2 uv = uFocus + (s - uSF) * k / uZoom;
  vec3 cv = gradeV(texture(uV, uv, uBlur).rgb);
  vec3 cn = gradeN(texture(uN, uv, uBlur).rgb);
  vec2 q = vec2((s.x - .5) * ca, s.y - .5);
  vec2 dir = normalize(vec2(1., .45));
  float spann = .5 * (abs(dir.x) * ca + abs(dir.y)) + .2;
  float n = (fbm(q * 2.6 + vec2(0., uTime * .15)) - .5) * .2;
  float d = dot(q, dir) + n - mix(-spann + uLinks, spann, uReveal);
  float m = 1. - smoothstep(-.006, .006, d);
  vec3 c = mix(cv, cn, m);
  float aktiv = smoothstep(0., .04, uReveal) * (1. - smoothstep(.96, 1., uReveal));
  vec3 warm = vec3(.86, .72, .5);
  vec3 licht = warm * exp(-d * d / .004) * .3 + vec3(1., .96, .88) * exp(-d * d / .00003) * .95;
  float funke = step(.994, h21(floor(s * uRes / 2.5) + floor(uTime * 24.))) * exp(-pow((d - .02) / .035, 2.));
  licht += funke * vec3(1., .9, .72) * .9;
  c += (1. - c) * licht * aktiv;
  float l = dot(cn, vec3(.299, .587, .114));
  float band = exp(-pow((dot(q, vec2(.72, .69)) - mix(-1.3, 1.3, uShine)) / .1, 2.));
  c += m * band * (.08 + .42 * smoothstep(.2, .85, l)) * step(.001, uShine) * step(uShine, .999);
  float v = smoothstep(1.35, .3, length(vec2(q.x / max(ca, 1.), q.y) * vec2(1., 1.15)));
  c *= mix(.58, 1., v);
  c += (h21(s * uRes + fract(uTime) * 91.) - .5) * .05;
  o = vec4(max(c, 0.) * uFade, 1.);
}`;
const VERT = `#version 300 es
in vec2 p; out vec2 vS; void main(){ vS = p * .5 + .5; gl_Position = vec4(p, 0., 1.); }`;

let szenen = [];

async function start() {
  const wahl = await auswahl();
  szenen = wahl.film.map(id => ({ id, p: P[id], t: TXT[id] || { titel: P[id].titel, schaden: '' }, f: (TXT[id] && TXT[id].fokus) || [0.5, 0.5] }));
  baueSegmente();
  const gl = canvas.getContext('webgl2', { antialias: false, alpha: false, powerPreference: 'high-performance' });
  if (!gl) return ersatz();
  huelle.classList.add('gl');
  const sh = (typ, src) => { const s = gl.createShader(typ); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
  const prog = gl.createProgram();
  gl.attachShader(prog, sh(gl.VERTEX_SHADER, VERT)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FRAG)); gl.linkProgram(prog);
  gl.useProgram(prog);
  const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const lp = gl.getAttribLocation(prog, 'p'); gl.enableVertexAttribArray(lp); gl.vertexAttribPointer(lp, 2, gl.FLOAT, false, 0, 0);
  const U = {}; for (const n of ['uV', 'uN', 'uRes', 'uFocus', 'uSF', 'uImgAsp', 'uZoom', 'uReveal', 'uTime', 'uFade', 'uBlur', 'uShine', 'uLinks']) U[n] = gl.getUniformLocation(prog, n);
  gl.uniform1i(U.uV, 0); gl.uniform1i(U.uN, 1);

  const textur = img => {
    const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.generateMipmap(gl.TEXTURE_2D);
    return t;
  };
  const bild = src => new Promise((ok, nein) => { const i = new Image(); i.decoding = 'async'; i.onload = () => ok(i); i.onerror = nein; i.src = src; });
  const geladen = new Map(), fertig = new Map();
  const lade = i => {
    const sz = szenen[i % szenen.length];
    if (!geladen.has(sz.id)) geladen.set(sz.id, Promise.all([bild(`${BASE}assets/img/arbeiten-hd/${sz.id}-v.jpg`), bild(`${BASE}assets/img/arbeiten-hd/${sz.id}-n.jpg`)])
      .then(([v, n]) => { const o = { v: textur(v), n: textur(n), asp: v.naturalWidth / v.naturalHeight }; fertig.set(sz.id, o); return o; }));
    return geladen.get(sz.id);
  };

  let dpr = 1, sicht = true;
  const groesse = () => {
    dpr = Math.min(devicePixelRatio || 1, HANDY() ? 1.5 : 1.75);
    canvas.width = Math.round(canvas.clientWidth * dpr); canvas.height = Math.round(canvas.clientHeight * dpr);
    gl.viewport(0, 0, canvas.width, canvas.height);
  };
  groesse(); new ResizeObserver(groesse).observe(canvas);
  new IntersectionObserver(es => { sicht = es[0].isIntersecting; }).observe(canvas);

  let i = 0, aktuell = await lade(0), szStart = performance.now() / 1000, pause = 0;
  lade(1);
  zeigeText(0);
  huelle.classList.add('laeuft');
  let letzt = performance.now() / 1000;
  let warte = -1;
  const sprung = n => { lade(n); lade(n + 1); warte = n; };
  ui.seg.addEventListener('click', e => { const b = e.target.closest('button'); if (b) sprung(+b.dataset.i); });

  const bild0 = () => {
    const jetzt = performance.now() / 1000;
    if (!sicht || document.hidden) { szStart += jetzt - letzt; letzt = jetzt; requestAnimationFrame(bild0); return; }
    letzt = jetzt;
    let t = FEST !== null ? +FEST : jetzt - szStart;
    if (FEST === null && (t >= DAUER || warte >= 0)) {
      const n = warte >= 0 ? warte : i + 1, id = szenen[n % szenen.length].id;
      lade(n);
      if (fertig.has(id)) { aktuell = fertig.get(id); i = n; warte = -1; szStart = jetzt; t = 0; lade(i + 1); zeigeText(i % szenen.length); }
      else t = DAUER;
    }
    const sz = szenen[i % szenen.length];
    const fade = t < Z.ein ? ease(k01(t / Z.ein)) : t > DAUER - Z.aus ? 1 - ease(k01((t - DAUER + Z.aus) / Z.aus)) : 1;
    const blur = 3.4 * (1 - ease(k01(t / (Z.ein * 1.25))));
    const rep = RUHIG ? 0.5 : sanft(k01((t - Z.ein - Z.vorher) / Z.rep));
    const glanz = k01((t - Z.ein - Z.vorher - Z.rep - 0.15) / 1.7);
    const zoom = RUHIG ? 1.02 : HANDY() ? 1.04 + 0.08 * (t / DAUER) : 1.0 + 0.06 * (t / DAUER);
    // Bildschirm-Mittelpunkt des Motivs (Handy: unterhalb der Überschrift)
    const sf = HANDY() ? [0.5, 0.42] : [0.5, 0.5];
    const ca = canvas.width / canvas.height, asp = aktuell.asp;
    const kx = (ca > asp ? 1 : ca / asp) / zoom, ky = (ca > asp ? asp / ca : 1) / zoom;
    const fx = Math.min(1 - (1 - sf[0]) * kx, Math.max(sf[0] * kx, sz.f[0]));
    const fy = Math.min(1 - (1 - sf[1]) * ky, Math.max(sf[1] * ky, 1 - sz.f[1]));
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, aktuell.v);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, aktuell.n);
    gl.uniform2f(U.uRes, canvas.width, canvas.height); gl.uniform2f(U.uFocus, fx, fy); gl.uniform2f(U.uSF, sf[0], sf[1]);
    gl.uniform1f(U.uImgAsp, asp); gl.uniform1f(U.uZoom, zoom); gl.uniform1f(U.uReveal, rep); gl.uniform1f(U.uTime, jetzt % 1000);
    gl.uniform1f(U.uFade, fade); gl.uniform1f(U.uBlur, blur); gl.uniform1f(U.uShine, glanz); gl.uniform1f(U.uLinks, HANDY() ? 0 : 0.28);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    const st = rep > 0.5 ? 'nachher' : 'vorher';
    if (ui.status.dataset.s !== st) { ui.status.dataset.s = st; ui.schaden.textContent = st === 'nachher' ? 'Wie neu – repariert statt ersetzt' : sz.t.schaden; }
    ui.status.style.setProperty('--rep', rep);
    const seg = ui.seg.children[i % szenen.length];
    if (seg) seg.style.setProperty('--f', k01(t / DAUER));
    requestAnimationFrame(bild0);
  };
  requestAnimationFrame(bild0);
}

function baueSegmente() {
  ui.seg.innerHTML = szenen.map((s, i) => `<button type="button" data-i="${i}" aria-label="${s.t.titel}"><i></i></button>`).join('');
}
function zeigeText(i) {
  const s = szenen[i];
  if (ui.nr) ui.nr.textContent = `${String(i + 1).padStart(2, '0')} / ${String(szenen.length).padStart(2, '0')}`;
  ui.titel.textContent = s.t.titel;
  ui.schaden.textContent = s.t.schaden;
  [...ui.seg.children].forEach((b, k) => { b.classList.toggle('fertig', k < i); b.classList.toggle('an', k === i); b.style.setProperty('--f', k < i ? 1 : 0); });
}

// Ohne WebGL2: dieselbe Geschichte mit zwei Bildern und einer Wischblende
function ersatz() {
  huelle.classList.add('css');
  const v = document.createElement('img'), n = document.createElement('img');
  v.className = 'film-v'; n.className = 'film-n'; v.alt = ''; n.alt = '';
  huelle.append(v, n);
  let i = 0;
  const zeig = () => {
    const s = szenen[i % szenen.length];
    v.src = `${BASE}assets/img/arbeiten-hd/${s.id}-v.jpg`; n.src = `${BASE}assets/img/arbeiten-hd/${s.id}-n.jpg`;
    v.style.objectPosition = n.style.objectPosition = `${s.f[0] * 100}% ${s.f[1] * 100}%`;
    huelle.classList.remove('rep'); ui.status.dataset.s = 'vorher'; zeigeText(i % szenen.length);
    setTimeout(() => { huelle.classList.add('rep'); ui.status.dataset.s = 'nachher'; ui.schaden.textContent = 'Wie neu – repariert statt ersetzt'; }, (Z.ein + Z.vorher) * 1000);
    setTimeout(() => { i++; zeig(); }, DAUER * 1000);
  };
  zeig();
}

if (huelle && canvas) start().catch(e => { console.error('film', e); ersatz(); });
