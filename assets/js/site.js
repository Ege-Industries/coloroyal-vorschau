// ColoRoyal – gemeinsame Seitenlogik (Menü, Vorher/Nachher, Galerie, Schadens-Check, Anfrage)
import { DATEN } from './daten.js';

const BASE = document.body.dataset.base || '';
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const L = Object.fromEntries(DATEN.leistungen.map(l => [l.slug, l]));
const P = Object.fromEntries(DATEN.arbeiten.paare.map(p => [p.id, p]));
const RUHIG = matchMedia('(prefers-reduced-motion: reduce)').matches;
const WA = text => `https://wa.me/${DATEN.firma.wa}?text=${encodeURIComponent(text)}`;

/* ---------------- Menü ---------------- */
{
  const knopf = $('#menueKnopf'), menue = $('#menue');
  const zu = () => { menue.hidden = true; knopf.setAttribute('aria-expanded', 'false'); document.body.classList.remove('menue-offen'); };
  knopf?.addEventListener('click', () => {
    const auf = menue.hidden;
    menue.hidden = !auf; knopf.setAttribute('aria-expanded', String(auf)); document.body.classList.toggle('menue-offen', auf);
  });
  menue?.addEventListener('click', e => { if (e.target.closest('a')) zu(); });
  addEventListener('keydown', e => { if (e.key === 'Escape' && !menue.hidden) zu(); });
}

/* ---------------- Vorher / Nachher ---------------- */
const regler = new Set();
const sichtbar = new Set();
const io = new IntersectionObserver(es => es.forEach(e => e.isIntersecting ? sichtbar.add(e.target) : sichtbar.delete(e.target)), { threshold: .25 });

function vnStart(el) {
  if (el._vn) return;
  const range = $('.vn-regler', el);
  const st = el._vn = { p: 50, user: -1e9, t0: Math.random() * 5000, druck: false };
  const setze = v => { st.p = Math.max(0, Math.min(100, v)); el.style.setProperty('--p', st.p + '%'); range.value = Math.round(st.p); };
  st.setze = setze;
  const ausX = e => { const r = el.getBoundingClientRect(); setze((e.clientX - r.left) / r.width * 100); };
  el.addEventListener('pointerdown', e => {
    if (e.button !== 0) return;
    st.druck = true; st.user = performance.now();
    if (e.pointerType !== 'touch') { el.setPointerCapture(e.pointerId); ausX(e); }
    else { st.sx = e.clientX; st.sy = e.clientY; st.zieh = false; }
  });
  el.addEventListener('pointermove', e => {
    if (!st.druck) return;
    st.user = performance.now();
    if (e.pointerType === 'touch' && !st.zieh) {
      if (Math.abs(e.clientX - st.sx) > 6 && Math.abs(e.clientX - st.sx) > Math.abs(e.clientY - st.sy)) st.zieh = true; else return;
    }
    ausX(e);
  });
  const los = () => { st.druck = false; };
  el.addEventListener('pointerup', e => { if (e.pointerType === 'touch' && !st.zieh) ausX(e); los(); });
  el.addEventListener('pointercancel', los);
  el.addEventListener('pointerenter', e => { if (e.pointerType === 'mouse') st.user = performance.now(); });
  el.addEventListener('mousemove', () => { st.user = performance.now(); });
  range.addEventListener('input', () => { st.user = performance.now(); setze(+range.value); });
  setze(50);
  regler.add(el); io.observe(el);
}
$$('.vn').forEach(vnStart);

function vnTausch(el, id) {
  const p = P[id]; if (!p) return;
  const [v, n] = [$('.vn-v', el), $('.vn-n img', el)];
  const neu = (img, tag, was) => { img.src = `${BASE}assets/img/arbeiten/${id}-${tag}.jpg`; img.alt = `${was}: ${p.titel}`; img.loading = 'eager'; };
  el.classList.add('wechsel');
  neu(v, 'v', 'Vorher'); neu(n, 'n', 'Nachher');
  el.dataset.id = id; el.style.setProperty('--ar', `${p.w}/${p.h}`);
  $('.vn-regler', el).setAttribute('aria-label', `Vorher/Nachher vergleichen: ${p.titel}`);
  el._vn.t0 = performance.now(); el._vn.user = -1e9; el._vn.setze(50);
}

// Bewegt sich von selbst, solange niemand anfasst
function schleife(t) {
  for (const el of sichtbar) {
    const st = el._vn; if (!st || !el.hasAttribute('data-auto') || st.druck) continue;
    if (t - st.user < 4200 || RUHIG) continue;
    const k = (t - st.t0) / 1000;
    st.setze(50 + 36 * Math.sin(k * 0.9) * (0.75 + 0.25 * Math.sin(k * 0.37)));
  }
  requestAnimationFrame(schleife);
}
requestAnimationFrame(schleife);

/* Auswahl-Leisten (Startseite + Galerie) */
function leiste(leisteEl, buehneVn, info) {
  if (!leisteEl || !buehneVn) return;
  const wahl = id => {
    $$('.vt', leisteEl).forEach(b => b.classList.toggle('an', b.dataset.id === id));
    vnTausch(buehneVn, id);
    info?.(P[id]);
  };
  leisteEl.addEventListener('click', e => {
    const b = e.target.closest('.vt'); if (!b) return;
    wahl(b.dataset.id);
    b.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  });
  const erst = $('.vt', leisteEl); erst?.classList.add('an');
  return wahl;
}

leiste($('#vhLeiste'), $('#vorher-nachher .vn-gross'), p => {
  $('#vhTitel').textContent = p.titel;
  $('#vhLeistung').textContent = L[p.leistung]?.name || 'Möbel';
});

const gLeiste = $('#gLeiste');
if (gLeiste) {
  const wahl = leiste(gLeiste, $('.galerie .vn-gross'), p => {
    $('#gTitel').textContent = p.titel;
    const a = $('#gLeistung');
    if (L[p.leistung]) { a.href = `leistungen/${p.leistung}.html`; a.firstChild.textContent = L[p.leistung].name + ' '; a.hidden = false; }
    else { a.hidden = true; }
  });
  $('.g-filter').addEventListener('click', e => {
    const c = e.target.closest('.chip'); if (!c) return;
    $$('.g-filter .chip').forEach(x => x.classList.toggle('an', x === c));
    const f = c.dataset.filter;
    const sicht = $$('.vt', gLeiste).filter(b => { const ok = f === 'alle' || b.dataset.l === f; b.hidden = !ok; return ok; });
    if (sicht[0]) { wahl(sicht[0].dataset.id); gLeiste.scrollTo({ left: 0, behavior: 'smooth' }); }
  });
}

/* ---------------- Chips ---------------- */
function chipGruppe(box, beiAenderung) {
  const mehr = box.hasAttribute('data-mehr');
  box.addEventListener('click', e => {
    const c = e.target.closest('.chip'); if (!c) return;
    if (mehr) c.classList.toggle('an');
    else $$('.chip', box).forEach(x => x.classList.toggle('an', x === c ? !x.classList.contains('an') : false));
    beiAenderung();
  });
}
const gewaehlt = box => $$('.chip.an', box).map(c => c.dataset.wert);

/* ---------------- Schadens-Check (Startseite) ---------------- */
{
  const check = $('#check');
  if (check) {
    const [bo, bs] = [$('[data-feld="objekt"]', check), $('[data-feld="schaden"]', check)];
    const neu = () => {
      const o = gewaehlt(bo)[0], s = gewaehlt(bs);
      const worum = [o, s.join(', ')].filter(Boolean).join(' – ');
      const text = worum
        ? `Hallo ColoRoyal, es geht um: ${worum}. Fotos schicke ich mit. Was lässt sich da machen?`
        : 'Hallo ColoRoyal, ich hätte gerne eine Einschätzung zu einem Lederschaden. Fotos schicke ich mit.';
      $('#checkText').textContent = text;
      $('#checkWa').href = WA(text);
      const q = new URLSearchParams(); if (o) q.set('objekt', o); if (s.length) q.set('schaden', s.join('|'));
      $('#checkForm').href = 'kontakt.html' + (q.toString() ? '?' + q : '');
    };
    chipGruppe(bo, neu); chipGruppe(bs, neu);
  }
}

/* ---------------- Anfrage-Formular ---------------- */
{
  const f = $('#anfrage');
  if (f) {
    const schritte = $$('.af-schritt', f);
    let n = 0;
    const fotos = [];
    const [bo, bs] = [$('[data-feld="objekt"]', f), $('[data-feld="schaden"]', f)];
    const fehler = $('#afFehler');
    const sync = () => { f.objekt.value = gewaehlt(bo).join(', '); f.schaden.value = gewaehlt(bs).join(', '); };
    chipGruppe(bo, sync); chipGruppe(bs, sync);

    // Vorbelegung aus der Adresse (Schadens-Check, Leistungsseiten)
    const q = new URLSearchParams(location.search);
    const vor = (box, werte) => werte.forEach(w => $$('.chip', box).find(c => c.dataset.wert === w)?.classList.add('an'));
    if (q.get('objekt')) vor(bo, [q.get('objekt')]);
    if (q.get('schaden')) vor(bs, q.get('schaden').split('|'));
    if (q.get('leistung') && L[q.get('leistung')]) { f.leistung.value = L[q.get('leistung')].name; f.nachricht.value = `Anfrage zu: ${L[q.get('leistung')].name}\n`; }
    sync();

    const zeige = i => {
      n = i;
      schritte.forEach((s, k) => s.classList.toggle('an', k === n));
      $('#afBalken').style.width = ((n + 1) / schritte.length * 100) + '%';
      $('#afStand').textContent = `Schritt ${n + 1} von ${schritte.length}`;
      $('#afZurueck').hidden = n === 0;
      $('#afWeiter').querySelector('span').textContent = n === schritte.length - 1 ? 'Anfrage senden' : 'Weiter';
      fehler.textContent = '';
    };
    const pruefe = () => {
      const pflicht = $$('[required]', schritte[n]);
      $$('.fehlt', f).forEach(x => x.classList.remove('fehlt'));
      for (const el of pflicht) {
        const leer = el.type === 'checkbox' ? !el.checked : !el.value.trim();
        const falsch = el.type === 'email' && el.value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(el.value);
        if (leer || falsch) {
          if (el.type !== 'checkbox') el.classList.add('fehlt');
          fehler.textContent = el.type === 'checkbox' ? 'Bitte bestätigen Sie den Hinweis zum Datenschutz.' : falsch ? 'Bitte prüfen Sie die E-Mail-Adresse.' : 'Bitte füllen Sie die markierten Felder aus.';
          el.focus(); return false;
        }
      }
      fehler.textContent = '';
      return true;
    };

    // Fotos: max. 5, im Browser verkleinert (schnellerer Upload)
    const liste = $('#fotoListe'), input = $('#fotoInput');
    const klein = async datei => {
      try {
        const bmp = await createImageBitmap(datei);
        const k = Math.min(1, 1800 / Math.max(bmp.width, bmp.height));
        const c = document.createElement('canvas'); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
        c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
        const blob = await new Promise(r => c.toBlob(r, 'image/jpeg', .85));
        return blob ? new File([blob], datei.name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' }) : datei;
      } catch { return datei; }
    };
    input.addEventListener('change', async () => {
      const neu = [...input.files].filter(x => x.type.startsWith('image/'));
      if (neu.length + fotos.length > 5) fotos.length = 0;
      for (const d of neu.slice(0, 5 - fotos.length)) fotos.push(await klein(d));
      liste.innerHTML = '';
      fotos.forEach(d => { const i = new Image(); i.src = URL.createObjectURL(d); i.alt = ''; liste.append(i); });
      $('#fotoFeld').classList.toggle('voll', fotos.length >= 5);
      input.value = '';
      fehler.textContent = neu.length > 5 ? 'Es werden höchstens 5 Fotos übernommen.' : '';
    });

    const senden = async () => {
      if (f.website.value) return; // Honigtopf
      const knopf = $('#afWeiter'); knopf.disabled = true; knopf.querySelector('span').textContent = 'Wird gesendet …';
      const fd = new FormData();
      for (const el of f.elements) if (el.name && el.type !== 'file' && !(el.type === 'checkbox' && !el.checked)) fd.append(el.name, el.value);
      fotos.forEach(d => fd.append('fotos[]', d, d.name));
      let ok = false, vorschau = false;
      try {
        const r = await fetch(`${BASE}api.php?a=anfrage`, { method: 'POST', body: fd });
        const j = await r.json().catch(() => null);
        if (j?.ok) ok = true; else if (!j || r.status === 404 || r.status === 405 || r.status === 501) vorschau = true; else fehler.textContent = j.fehler || 'Senden hat nicht geklappt.';
      } catch { vorschau = true; }
      knopf.disabled = false; knopf.querySelector('span').textContent = 'Anfrage senden';
      if (ok || vorschau) {
        f.classList.add('gesendet'); $('#afFertig').hidden = false;
        if (vorschau) $('#afFertigText').innerHTML = 'Vorschau-Modus: Auf dieser Testseite wird nichts gesendet. Auf coloroyal.de geht die Anfrage direkt an <b>info@coloroyal.de</b>.';
        $('#afFertig').scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    };

    $('#afWeiter').addEventListener('click', () => { if (!pruefe()) return; n < schritte.length - 1 ? zeige(n + 1) : senden(); });
    $('#afZurueck').addEventListener('click', () => zeige(Math.max(0, n - 1)));
    f.addEventListener('submit', e => { e.preventDefault(); $('#afWeiter').click(); });
    zeige(0);
  }
}

/* ---------------- 3D-Ersatz, wenn kein WebGL ---------------- */
window.__colo = { BASE, DATEN };
