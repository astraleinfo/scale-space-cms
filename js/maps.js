/* Attendance maps: GPS fixes on an OpenStreetMap map (Leaflet, loaded on first use), with the place name and
   street address of each point. Addresses come from OpenStreetMap's Nominatim reverse geocoder, one request at a
   time and cached in this browser; offline, the registered address of the site is shown instead. */
'use strict';

const LEAFLET_URL = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/';
const OFFICE_ADDR = 'No.4, State Bank Colony, Lalbahadur Nagar, Mayiladuthurai 609001';
const PIN_C = { site: '#D42B2A', ok: '#1D7347', warn: '#C47A00', out: '#2A5EA6' };

/* registered place of a site: name + address */
function placeOf(site) {
  if (site === 'office' || !proj(site)) return { name: 'Head office', addr: OFFICE_ADDR };
  const p = proj(site);
  return { name: p.name, addr: [p.location, p.city, 'Tamil Nadu'].filter(Boolean).join(', ') };
}
const mapsLink = g => `https://www.google.com/maps/search/?api=1&query=${g.lat},${g.lng}`;

/* ---------- reverse geocoding ---------- */
const GEO_KEY = KEY + '-geo';
let GEO_CACHE = {};
try { GEO_CACHE = JSON.parse(localStorage.getItem(GEO_KEY) || '{}'); } catch (e) {}
const geoKey = (lat, lng) => `${(+lat).toFixed(4)},${(+lng).toFixed(4)}`;
const GEO_PENDING = new Map();
let geoQueue = Promise.resolve();
function fmtAddress(j) {
  const a = j.address || {};
  const parts = [a.house_number && a.road ? `${a.house_number}, ${a.road}` : a.road, a.neighbourhood || a.suburb || a.hamlet || a.quarter,
    a.village || a.town || a.city || a.county, a.state, a.postcode].filter(Boolean);
  const addr = [...new Set(parts)].join(', ') || j.display_name || '';
  const name = j.name || a.amenity || a.building || a.shop || a.road || a.suburb || a.village || a.town || '';
  return { name, addr };
}
function revGeo(lat, lng) {
  const k = geoKey(lat, lng);
  if (GEO_CACHE[k]) return Promise.resolve(GEO_CACHE[k]);
  if (GEO_PENDING.has(k)) return GEO_PENDING.get(k);
  // Nominatim's usage policy allows one request per second
  const p = geoQueue = geoQueue.then(() => new Promise(r => setTimeout(r, 1100))).then(() =>
    fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=18&addressdetails=1&lat=${lat}&lon=${lng}`, { headers: { 'Accept-Language': 'en' } })
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(j => { if (j.error) return null; const v = fmtAddress(j); GEO_CACHE[k] = v; try { localStorage.setItem(GEO_KEY, JSON.stringify(GEO_CACHE)); } catch (e) {} return v; })
      .catch(() => null));
  GEO_PENDING.set(k, p); p.finally(() => GEO_PENDING.delete(k));
  return p;
}
/* address of a GPS fix: stored → cached → resolved later (see fillAddrs); the site address stands in meanwhile */
function fixAddr(g, site) {
  const c = g.addr ? g : GEO_CACHE[geoKey(g.lat, g.lng)];
  if (c) return `<span class="geo-addr">${esc(c.addr)}</span>`;
  return `<span class="geo-addr" data-geo="${g.lat},${g.lng}">${g.ok ? 'Near ' : ''}${esc(placeOf(site).addr)}<small class="muted"> · looking up street address…</small></span>`;
}
/* place name of a fix (HTML): the site when on site, otherwise the nearest street / locality and the distance */
function fixName(g, site) {
  if (g.ok) return esc(placeOf(site).name);
  const c = g.addr ? { name: g.place } : GEO_CACHE[geoKey(g.lat, g.lng)], rest = `${fmtDist(g.dist)} from ${esc(placeOf(site).name)}`;
  return c ? `${c.name ? esc(c.name) + ' · ' : ''}${rest}` : `<span data-geon="${g.lat},${g.lng}">${rest}</span>`;
}
function fillAddrs(root) {
  (root ? root.querySelectorAll('[data-geo]') : []).forEach(el => {
    const [lat, lng] = el.dataset.geo.split(',');
    revGeo(lat, lng).then(v => { if (!el.isConnected) return; el.removeAttribute('data-geo'); if (v) el.textContent = v.addr; else el.querySelector('small')?.remove(); });
  });
  (root ? root.querySelectorAll('[data-geon]') : []).forEach(el => {
    const [lat, lng] = el.dataset.geon.split(',');
    revGeo(lat, lng).then(v => { if (!el.isConnected) return; el.removeAttribute('data-geon'); if (v?.name) el.prepend(v.name + ' · '); });
  });
}

/* ---------- map ---------- */
let leafletP = null;
function loadLeaflet() {
  if (window.L) return Promise.resolve(window.L);
  return leafletP ||= new Promise((res, rej) => {
    const css = document.createElement('link'); css.rel = 'stylesheet'; css.href = LEAFLET_URL + 'leaflet.css'; document.head.appendChild(css);
    const s = document.createElement('script'); s.src = LEAFLET_URL + 'leaflet.js';
    s.onload = () => res(window.L); s.onerror = () => { leafletP = null; s.remove(); rej(new Error('map unavailable')); };
    document.head.appendChild(s);
  });
}
const pinIcon = (txt, tone) => L.divIcon({ className: 'gm-ic', html: `<span class="gm-pin" style="--c:${PIN_C[tone] || PIN_C.out}">${txt}</span>`, iconSize: [30, 37], iconAnchor: [15, 37], popupAnchor: [0, -34] });

/* opts: { sites: [siteId], points: [{ lat, lng, label, tone, popup(): html, onOpen(el) }] } */
function mountMap(el, { sites = [], points = [] }) {
  if (!el) return;
  el.innerHTML = `<div class="gm-off">${ico('gps', 'sm')} Loading map…</div>`;
  loadLeaflet().then(L => {
    if (!el.isConnected) return;
    el._map?.remove(); el.innerHTML = '';
    const map = el._map = L.map(el, { scrollWheelZoom: false, zoomControl: true, attributionControl: true });
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>' }).addTo(map);
    const pts = [];
    [...new Set(sites)].forEach(s => {
      const c = geoOf(s), pl = placeOf(s); pts.push(c);
      L.circle(c, { radius: GEO_RADIUS_M, color: PIN_C.site, weight: 1.5, opacity: .7, fillColor: PIN_C.site, fillOpacity: .07, dashArray: '4 4' }).addTo(map);
      L.marker(c, { icon: L.divIcon({ className: 'gm-ic', html: `<span class="gm-pin site" style="--c:${PIN_C.site}">${ico(s === 'office' ? 'home' : 'building', 'sm')}</span>`, iconSize: [30, 37], iconAnchor: [15, 37], popupAnchor: [0, -34] }), zIndexOffset: -100, title: pl.name })
        .bindPopup(`<div class="gm-pop"><b>${esc(pl.name)}</b><span>${esc(pl.addr)}</span><small>${c[0].toFixed(5)}, ${c[1].toFixed(5)} · ${GEO_RADIUS_M} m check-in radius</small></div>`).addTo(map);
    });
    points.forEach(p => {
      pts.push([p.lat, p.lng]);
      const m = L.marker([p.lat, p.lng], { icon: pinIcon(esc(p.label), p.tone), title: p.title || '' }).addTo(map);
      if (p.popup) m.bindPopup(() => `<div class="gm-pop">${p.popup()}</div>`, { minWidth: 220, maxWidth: 280 });
      m.on('popupopen', e => { const c = e.popup.getElement(); fillAddrs(c); p.onOpen?.(c); });
    });
    if (pts.length > 1) map.fitBounds(pts, { padding: [36, 36], maxZoom: 16 }); else map.setView(pts[0] || geoOf('office'), 16);
    setTimeout(() => map.invalidateSize(), 320);
  }).catch(() => {
    if (!el.isConnected) return;
    const p = points[0] || (sites[0] && { lat: geoOf(sites[0])[0], lng: geoOf(sites[0])[1] });
    el.innerHTML = `<div class="gm-off">${ico('gps')}<span>The map needs an internet connection.${p ? `<br><a href="${mapsLink(p)}" target="_blank" rel="noopener">Open ${p.lat}, ${p.lng} in Google Maps</a>` : ''}</span></div>`;
  });
}
const mapLegend = items => `<div class="geo-legend">${items.map(([tone, l]) => `<span><i style="--c:${PIN_C[tone]}"></i>${l}</span>`).join('')}</div>`;
