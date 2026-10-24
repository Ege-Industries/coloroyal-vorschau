// Welche Arbeiten im Film (oben) und bei „Sehen Sie selbst“ laufen.
// Reihenfolge: Vorschau-Auswahl im Browser (nur Vorschau-Seite) → assets/data/einstellungen.json (vom Studio gespeichert) → Standard.
import { DATEN } from './daten.js';

const BASE = document.body.dataset.base || '';
const P = new Set(DATEN.arbeiten.paare.map(p => p.id));
const sauber = (liste, ersatz) => { const l = (Array.isArray(liste) ? liste : []).filter(id => P.has(id)); return l.length ? l : ersatz; };
let _cache = null;

export function auswahl() {
  if (_cache) return _cache;
  _cache = (async () => {
    let roh = null;
    try { roh = JSON.parse(localStorage.getItem('colo-auswahl') || 'null'); } catch {}
    if (!roh) {
      try { const r = await fetch(`${BASE}assets/data/einstellungen.json?v=${Date.now() / 60000 | 0}`); if (r.ok) roh = await r.json(); } catch {}
    }
    return {
      film: sauber(roh?.film, DATEN.standard.film),
      vorherNachher: sauber(roh?.vorherNachher, DATEN.standard.vorherNachher),
    };
  })();
  return _cache;
}
