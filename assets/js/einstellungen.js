// Einstellungen der Werkstatt: welche Arbeiten bei „Sehen Sie selbst“ und im Film oben laufen.
// Auf coloroyal.de speichert api.php für alle Besucher. Auf der Vorschau-Seite (ohne PHP) nur in diesem Browser.
import { DATEN } from './daten.js';

const BASE = document.body.dataset.base || '';
const $ = s => document.querySelector(s);
const PAARE = DATEN.arbeiten.paare;
const P = Object.fromEntries(PAARE.map(p => [p.id, p]));
const L = Object.fromEntries(DATEN.leistungen.map(l => [l.slug, l]));
const MAX = { vorherNachher: 12, film: 8 };
const ERKL = {
  vorherNachher: 'Diese Arbeiten zeigt die Startseite im Bereich „Echte Arbeiten“ als Vorher | Nachher, in dieser Reihenfolge. Bis zu 12.',
  film: 'Diese Arbeiten laufen als Film ganz oben auf der Startseite. Am stärksten wirken ganze Sitze mit deutlichem Schaden. Bis zu 8.',
};
let modus = 'vorherNachher', stand = null, gespeichert = '', vorschau = false;

const ui = { hinweis: $('#eHinweis'), login: $('#eLogin'), bereich: $('#eBereich'), liste: $('#eListe'), alle: $('#eAlle'), erkl: $('#eErkl'), leiste: $('#eSpeichern'), stand: $('#eStand') };

async function api(a, daten) {
  const r = await fetch(`${BASE}api.php?a=${a}`, daten
    ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(daten), credentials: 'same-origin' }
    : { credentials: 'same-origin', cache: 'no-store' });
  const j = await r.json().catch(() => null);
  if (!j || j.vorschau) { const e = new Error('vorschau'); e.vorschau = true; throw e; }
  return j;
}

async function laden() {
  let roh = null;
  if (vorschau) { try { roh = JSON.parse(localStorage.getItem('colo-auswahl') || 'null'); } catch {} }
  if (!roh) { try { const r = await fetch(`${BASE}assets/data/einstellungen.json?t=${Date.now()}`, { cache: 'no-store' }); if (r.ok) roh = await r.json(); } catch {} }
  const ok = l => (Array.isArray(l) ? l : []).filter(id => P[id]);
  stand = { vorherNachher: ok(roh?.vorherNachher), film: ok(roh?.film) };
  if (!stand.vorherNachher.length) stand.vorherNachher = [...DATEN.standard.vorherNachher];
  if (!stand.film.length) stand.film = [...DATEN.standard.film];
  gespeichert = JSON.stringify(stand);
}

const bild = (id, t) => `<img src="${BASE}assets/img/arbeiten/${id}-${t}.jpg" alt="" loading="lazy">`;
function zeichnen() {
  const liste = stand[modus];
  ui.erkl.textContent = ERKL[modus];
  document.querySelectorAll('.einst-tabs .chip').forEach(c => c.classList.toggle('an', c.dataset.liste === modus));
  ui.liste.innerHTML = liste.map((id, i) => `
    <li data-id="${id}"><span class="nr">${i + 1}</span><div class="paar">${bild(id, 'v')}${bild(id, 'n')}</div><b>${P[id].titel}</b>
      <div class="werk"><button type="button" data-tun="links" ${i === 0 ? 'disabled' : ''} aria-label="Nach vorne">←</button><button type="button" data-tun="weg" aria-label="Entfernen">✕</button><button type="button" data-tun="rechts" ${i === liste.length - 1 ? 'disabled' : ''} aria-label="Nach hinten">→</button></div></li>`).join('');
  ui.alle.innerHTML = PAARE.map(p => {
    const pos = liste.indexOf(p.id);
    return `<button type="button" data-id="${p.id}" class="${pos >= 0 ? 'an' : ''}" data-nr="${pos + 1}"><div class="paar">${bild(p.id, 'v')}${bild(p.id, 'n')}</div><span>${p.titel}</span><small>${L[p.leistung]?.kurz || 'Möbel'}</small></button>`;
  }).join('');
  const neu = JSON.stringify(stand) !== gespeichert;
  ui.leiste.classList.toggle('geaendert', neu);
  ui.stand.textContent = neu ? 'Nicht gespeicherte Änderungen' : (vorschau ? 'Gespeichert (nur in diesem Browser)' : 'Alles gespeichert');
}

function bereit() {
  ui.login.hidden = true; ui.bereich.hidden = false; ui.leiste.hidden = false;
  zeichnen();
  document.querySelector('.einst-tabs').addEventListener('click', e => { const c = e.target.closest('.chip'); if (c) { modus = c.dataset.liste; zeichnen(); } });
  ui.alle.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    const l = stand[modus], i = l.indexOf(b.dataset.id);
    if (i >= 0) l.splice(i, 1);
    else if (l.length >= MAX[modus]) { ui.stand.textContent = `Höchstens ${MAX[modus]} – erst eine entfernen.`; return; }
    else l.push(b.dataset.id);
    zeichnen();
  });
  ui.liste.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    const l = stand[modus], i = l.indexOf(b.closest('li').dataset.id);
    if (b.dataset.tun === 'weg') l.splice(i, 1);
    if (b.dataset.tun === 'links' && i > 0) [l[i - 1], l[i]] = [l[i], l[i - 1]];
    if (b.dataset.tun === 'rechts' && i < l.length - 1) [l[i + 1], l[i]] = [l[i], l[i + 1]];
    zeichnen();
  });
  $('#eZuruecksetzen').addEventListener('click', () => { stand[modus] = [...DATEN.standard[modus]]; zeichnen(); });
  $('#eSpeichernKnopf').addEventListener('click', speichern);
}

async function speichern() {
  if (!stand.vorherNachher.length || !stand.film.length) { ui.stand.textContent = 'Jede Liste braucht mindestens eine Arbeit.'; return; }
  const knopf = $('#eSpeichernKnopf'); knopf.disabled = true;
  try {
    if (vorschau) localStorage.setItem('colo-auswahl', JSON.stringify(stand));
    else { const j = await api('speichern', stand); if (!j.ok) throw new Error(j.fehler || 'Fehler'); }
    gespeichert = JSON.stringify(stand); zeichnen();
    ui.stand.textContent = vorschau ? 'Gespeichert – auf diesem Gerät sichtbar. Startseite neu laden.' : 'Gespeichert – ab sofort live auf der Website.';
  } catch (e) {
    ui.stand.textContent = e.message === 'nicht-angemeldet' ? 'Bitte neu anmelden.' : 'Speichern hat nicht geklappt: ' + e.message;
  }
  knopf.disabled = false;
}

async function start() {
  let status = null;
  try { status = await api('status'); } catch (e) { vorschau = !!e.vorschau; }
  await laden();
  if (vorschau) {
    ui.hinweis.className = 'einst-hinweis vorschau';
    ui.hinweis.textContent = 'Vorschau-Seite: Hier gibt es keinen Server zum Speichern. Deine Auswahl wird in diesem Browser gemerkt, damit du sie auf der Startseite sofort siehst. Auf coloroyal.de gilt sie nach dem Speichern für alle Besucher.';
    return bereit();
  }
  ui.hinweis.textContent = 'Wähle aus, welche Arbeiten auf der Startseite gezeigt werden. Die Website übernimmt es sofort.';
  if (status?.angemeldet) return bereit();
  ui.login.hidden = false;
  ui.login.addEventListener('submit', async e => {
    e.preventDefault();
    const f = $('#eLoginFehler'); f.textContent = '';
    try { const j = await api('login', { pw: ui.login.pw.value }); if (j.ok) bereit(); else f.textContent = j.fehler || 'Passwort falsch.'; }
    catch { f.textContent = 'Anmelden hat nicht geklappt.'; }
  });
}
start();
