/* Shared helpers for the workflow modules: time & working days, notifications, photos (upload, sample photos,
   selfie camera, viewer), GPS checks, generated sample artwork and print / PDF output. */
'use strict';

/* ================= time & working days ================= */
const REPORT_DEADLINE_H = 20;                     // daily site reports are due by 8:00 PM
const SHIFT = { start: 9 * 60, grace: 15, end: 19 * 60 }; // office & site shift 9:00 AM – 7:00 PM
const tsOn = (day, h, m = 0) => { const d = parseD(day); d.setHours(h, m, 0, 0); return d.getTime(); };
const fmtT = t => t ? new Date(t).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' }) : '—';
const minsOf = t => { const d = new Date(t); return d.getHours() * 60 + d.getMinutes(); };
const fmtMins = m => { m = Math.max(0, Math.round(m)); const h = Math.floor(m / 60), r = m % 60; return h ? `${h}h${r ? ` ${r}m` : ''}` : `${r}m`; };
const isWorkDay = s => parseD(s).getDay() !== 0; // Monday – Saturday
const daysBetween = (from, to) => { const out = []; for (let d = from; d <= to; d = shiftD(d, 1)) out.push(d); return out; };
const workDaysIn = (from, to) => daysBetween(from, to).filter(isWorkDay).length;
const fyOf = s => { const d = parseD(s), y = d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1; return `${String(y).slice(2)}-${String(y + 1).slice(2)}`; };
const nowMins = () => minsOf(Date.now());
const employees = () => DB.users.filter(u => u.role !== 'owner' && u.status === 'Active');
const isEmployee = (u = me()) => !!u && u.role !== 'owner';
const rid = p => p + Math.random().toString(36).slice(2, 8);

/* ================= notifications ================= */
function notify(to, text, href = '', kind = 'info') {
  const list = [...new Set(to.filter(Boolean))].filter(u => u !== SESSION);
  if (!list.length) return;
  (DB.notifications ||= []).unshift({ id: nid('n'), at: Date.now(), to: list, text, href, kind, by: SESSION, read: [] });
  DB.notifications = DB.notifications.slice(0, 80);
}
const usersWithRole = (...roles) => DB.users.filter(u => roles.includes(u.role) && u.status === 'Active').map(u => u.id);
const noteOk = n => { const m = (n.href || '').match(/^#\/([\w-]+)/); return !m || !MODULES.some(x => x.id === m[1]) || canSee(m[1]); };
const myNotes = () => (DB.notifications || []).filter(n => n.to.includes(SESSION) && noteOk(n));
const unread = () => myNotes().filter(n => !n.read.includes(SESSION));
const NOTE_ICO = { leave: 'leave', attendance: 'userCheck', doc: 'file', report: 'report', material: 'box', service: 'wrench', invoice: 'invoice', appraisal: 'star', delay: 'alert', info: 'bell' };
function renderBell() {
  const b = $('#bellBtn'); if (!b) return;
  const n = unread().length;
  b.innerHTML = ico('bell') + (n ? `<span class="bell-n">${n > 9 ? '9+' : n}</span>` : '');
  b.setAttribute('aria-label', n ? `Notifications, ${n} unread` : 'Notifications');
}
ACT.bellMenu = el => {
  const list = myNotes().slice(0, 12), un = unread().length;
  openMenu(el, `<div class="note-list"><div class="mh note-mh"><span>Notifications</span>${un ? `<button class="linkbtn" data-act="readAllNotes">Mark all read</button>` : ''}</div>
    ${list.length ? list.map(n => `<button data-act="openNote" data-id="${n.id}" class="note ${n.read.includes(SESSION) ? '' : 'unread'}"><span class="sig ${n.kind === 'delay' || n.kind === 'report' ? 'warn' : 'info'}">${ico(NOTE_ICO[n.kind] || 'bell', 'sm')}</span><span class="nt"><span>${esc(n.text)}</span><small>${ago(n.at)}${n.by ? ` · ${esc(userName(n.by))}` : ''}</small></span></button>`).join('')
      : `<div class="empty-state" style="padding:28px 12px">${ico('bell')}<b>You're all caught up</b>New approvals, plan revisions and requests will appear here.</div>`}
    <div class="note-foot muted">Demo notifications — shown in the app only, no email or SMS is sent.</div></div>`);
};
ACT.openNote = el => { const n = (DB.notifications || []).find(x => x.id === el.dataset.id); if (!n) return; if (!n.read.includes(SESSION)) n.read.push(SESSION); saveDB(); renderBell(); if (n.href) go(n.href); };
ACT.readAllNotes = () => { myNotes().forEach(n => { if (!n.read.includes(SESSION)) n.read.push(SESSION); }); saveDB(); renderBell(); toast('All notifications marked as read'); };

/* ================= generated sample artwork ================= */
const svgWrap = (bg, inner) => `<svg class="art" viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><rect width="400" height="300" fill="${bg}"/>${inner}</svg>`;
function sampleArt(kind, seed = '') {
  const label = t => `<g><rect x="12" y="262" width="${t.length * 7.4 + 20}" height="24" rx="6" fill="rgba(0,0,0,.55)"/><text x="22" y="279" fill="#fff" font-family="Inter,sans-serif" font-size="12.5" font-weight="600">${esc(t)}</text></g>`;
  const ground = c => `<rect y="220" width="400" height="80" fill="${c}"/>`;
  switch (kind) {
    case 'selfie': {
      const c = avColor(seed), ini = esc(initials(seed || 'SS'));
      return svgWrap('#DCE3EA', `<rect width="400" height="300" fill="url(#sg${ini})"/><defs><linearGradient id="sg${ini}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#E6ECF2"/><stop offset="1" stop-color="#C9D3DD"/></linearGradient></defs>
        <rect x="0" y="190" width="400" height="110" fill="#B9C4CF"/><circle cx="200" cy="128" r="56" fill="#C99A78"/><path d="M144 116c0-40 26-60 56-60s56 20 56 60c-14-18-34-26-56-26s-42 8-56 26z" fill="#2B2420"/>
        <path d="M96 300c6-62 50-96 104-96s98 34 104 96z" fill="${c}"/><path d="M172 206l28 34 28-34" fill="none" stroke="#fff" stroke-width="5" opacity=".7"/>
        <rect x="236" y="250" width="54" height="22" rx="4" fill="#D9A21B"/><text x="263" y="266" text-anchor="middle" font-family="Inter,sans-serif" font-size="11" font-weight="700" fill="#2B2420">${ini}</text>${label('Sample selfie')}`);
    }
    case 'cement': return svgWrap('#E9E5DC', `${ground('#CFC6B6')}${[0, 1, 2].map(r => [0, 1, 2, 3].slice(0, 4 - r).map(i => `<rect x="${70 + i * 66 + r * 33}" y="${178 - r * 44}" width="62" height="42" rx="8" fill="#8D96A0" stroke="#6E7781"/><rect x="${82 + i * 66 + r * 33}" y="${190 - r * 44}" width="38" height="12" rx="2" fill="#D42B2A"/>`).join('')).join('')}${label('Cement bags · stacked on pallet')}`);
    case 'steel': return svgWrap('#E6E8EA', `${ground('#C3C8CC')}${Array.from({ length: 14 }, (_, i) => `<line x1="40" y1="${150 + i * 5}" x2="360" y2="${140 + i * 5}" stroke="${i % 2 ? '#4B5259' : '#5E666E'}" stroke-width="4" stroke-linecap="round"/>`).join('')}<rect x="180" y="132" width="16" height="90" fill="#D9A21B"/><rect x="300" y="136" width="14" height="82" fill="#D42B2A"/>${label('TMT bundles · tagged')}`);
    case 'bricks': return svgWrap('#EDE3D8', `${ground('#D3C2AE')}<g>${Array.from({ length: 6 }, (_, r) => Array.from({ length: 7 }, (_, i) => `<rect x="${60 + i * 42 + (r % 2) * 21}" y="${200 - r * 22}" width="40" height="20" fill="${['#B5543A', '#A84A33', '#BF6145'][(i + r) % 3]}" stroke="#E7D5C3"/>`).join('')).join('')}</g>${label('Wire-cut bricks · stacked')}`);
    case 'sand': return svgWrap('#E8EEF2', `${ground('#D8CDB8')}<path d="M40 230 Q140 70 240 120 T370 230 Z" fill="#C9A86A"/><path d="M40 230 Q140 70 240 120 T370 230" fill="none" stroke="#A88A50" stroke-width="2"/>${Array.from({ length: 40 }, (_, i) => `<circle cx="${70 + (i * 53) % 280}" cy="${170 + (i * 37) % 55}" r="2" fill="#8F7440"/>`).join('')}${label('Aggregate heap at site')}`);
    case 'tiles': return svgWrap('#EEF0F2', `${ground('#D6DADF')}${[0, 1, 2].map(r => [0, 1, 2].map(i => `<rect x="${90 + i * 76}" y="${160 - r * 40}" width="72" height="38" fill="#E8E2D6" stroke="#B8AE9C"/><rect x="${98 + i * 76}" y="${170 - r * 40}" width="30" height="8" fill="#2F5E9E"/>`).join('')).join('')}${label('Tile boxes · checked for breakage')}`);
    case 'paint': return svgWrap('#F1EEE9', `${ground('#D9D2C7')}${[0, 1, 2, 3].map(i => `<g transform="translate(${70 + i * 70} ${150 - (i % 2) * 6})"><rect width="56" height="70" rx="6" fill="#F7F7F5" stroke="#9AA1A8"/><rect y="20" width="56" height="26" fill="${['#D42B2A', '#2F5E9E', '#2E7D5B', '#D9A21B'][i]}"/><path d="M8 0q20-16 40 0" fill="none" stroke="#6E7781" stroke-width="3"/></g>`).join('')}${label('Paint buckets · sealed')}`);
    case 'wood': return svgWrap('#ECE7DF', `${ground('#CDBFA9')}${Array.from({ length: 8 }, (_, i) => `<rect x="${60 - i * 2}" y="${200 - i * 8}" width="280" height="9" fill="${i % 2 ? '#B98D5A' : '#C79B66'}" stroke="#8C6A40"/>`).join('')}${label('Shuttering plywood sheets')}`);
    case 'pipe': return svgWrap('#EEF0F2', `${ground('#D3D8DD')}${Array.from({ length: 10 }, (_, i) => `<line x1="50" y1="${160 + i * 6}" x2="350" y2="${150 + i * 6}" stroke="${i % 3 ? '#F2F2F0' : '#E1E4E8'}" stroke-width="7" stroke-linecap="round"/>`).join('')}<rect x="190" y="140" width="10" height="80" fill="#D42B2A"/>${label('PVC conduits · bundled')}`);
    case 'truck': return svgWrap('#CFE0EE', `${ground('#C9BFAE')}<rect x="60" y="120" width="200" height="90" rx="4" fill="#D9A21B"/><rect x="260" y="140" width="80" height="70" rx="6" fill="#2F5E9E"/><rect x="276" y="150" width="44" height="26" rx="3" fill="#CFE0EE"/><circle cx="110" cy="215" r="18" fill="#2B2B2B"/><circle cx="300" cy="215" r="18" fill="#2B2B2B"/><circle cx="110" cy="215" r="7" fill="#999"/><circle cx="300" cy="215" r="7" fill="#999"/><path d="M70 120l20-26h160l10 26" fill="#8D96A0"/><rect x="24" y="170" width="28" height="44" rx="3" fill="#8D96A0"/>${label('Lorry at site gate · unloading')}`);
    case 'bill': return svgWrap('#E9EAEC', `<rect x="110" y="20" width="180" height="262" fill="#fff" stroke="#D5D8DC"/><rect x="126" y="38" width="90" height="10" fill="#2B5797"/><rect x="126" y="56" width="60" height="6" fill="#C7CCD2"/>${Array.from({ length: 8 }, (_, i) => `<rect x="126" y="${86 + i * 16}" width="${90 - (i * 17) % 40}" height="6" fill="#D3D8DD"/><rect x="246" y="${86 + i * 16}" width="28" height="6" fill="#D3D8DD"/>`).join('')}<rect x="126" y="226" width="148" height="1.5" fill="#999"/><rect x="200" y="236" width="74" height="10" fill="#17191D"/><circle cx="160" cy="248" r="20" fill="none" stroke="#D42B2A" stroke-width="2.5" opacity=".7"/>${label('Supplier bill · photo')}`);
    case 'crack': return svgWrap('#E8E3DA', `<rect x="40" y="30" width="320" height="230" fill="#EFE9DF" stroke="#D5CDBE"/><path d="M190 40l12 34-16 26 20 30-12 28 18 36-10 40" fill="none" stroke="#5A4A3A" stroke-width="3"/><path d="M202 74l22 10M186 100l-20 8M206 130l20 4" stroke="#5A4A3A" stroke-width="1.6"/><circle cx="196" cy="140" r="56" fill="none" stroke="#D42B2A" stroke-width="3" stroke-dasharray="7 6"/>${label('Before · defect marked')}`);
    case 'leak': return svgWrap('#E5E1D9', `<rect x="40" y="30" width="320" height="230" fill="#ECE6DB"/><path d="M120 30c10 50-30 70 0 110s70 10 90 40 40 50 70 30 20-90 40-110 0-70 0-70z" fill="#B9AE98" opacity=".75"/><path d="M150 30c8 40-12 60 6 90s50 20 70 40" fill="none" stroke="#8C7F68" stroke-width="2" opacity=".6"/><circle cx="210" cy="120" r="70" fill="none" stroke="#D42B2A" stroke-width="3" stroke-dasharray="7 6"/>${label('Before · seepage patch')}`);
    case 'column': return svgWrap('#E4E6E8', `${ground('#C9CDD1')}<rect x="150" y="20" width="100" height="210" fill="#A9AEB4" stroke="#8C9298"/>${Array.from({ length: 26 }, (_, i) => `<circle cx="${165 + (i * 29) % 70}" cy="${120 + (i * 17) % 60}" r="${2 + (i % 3)}" fill="#5F656B"/>`).join('')}<circle cx="200" cy="150" r="52" fill="none" stroke="#D42B2A" stroke-width="3" stroke-dasharray="7 6"/>${label('Before · honeycombing')}`);
    case 'fixed': return svgWrap('#E9EEF0', `<rect x="40" y="30" width="320" height="230" fill="#F6F4EF" stroke="#DDD8CE"/><rect x="40" y="226" width="320" height="34" fill="#E3DCCF"/><path d="M300 60l20 20 40-46" fill="none" stroke="#2E7D5B" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>${label('After · repaired & finished')}`);
    case 'site': return svgWrap('#E6EBEF', `${ground('#D2C8B5')}<rect x="90" y="90" width="220" height="130" fill="#A9AEB4"/><rect x="110" y="50" width="180" height="40" fill="#BFC4C9"/>${[110, 160, 210, 250].map(x => `<rect x="${x}" y="110" width="28" height="32" fill="#E6EBEF"/><rect x="${x}" y="160" width="28" height="32" fill="#E6EBEF"/>`).join('')}${label('Site photo')}`);
    default: return svgWrap('#EEF0F2', `<rect x="110" y="24" width="180" height="252" fill="#fff" stroke="#DDE1E5"/>${Array.from({ length: 12 }, (_, i) => `<rect x="128" y="${50 + i * 16}" width="${140 - (i * 23) % 60}" height="6" rx="2" fill="#D3D8DD"/>`).join('')}`);
  }
}
const MAT_ART = { Cement: 'cement', Steel: 'steel', 'Bricks & blocks': 'bricks', Aggregates: 'sand', Tiles: 'tiles', Paint: 'paint', Wood: 'wood', Electrical: 'pipe', Plumbing: 'pipe' };

/* ================= photos ================= */
// photo = { id, kind: 'src' | 'art' | 'data' | 'blob', src?, art?, seed?, name, at, by, sample?, caption? }
const PH_REG = new Map();
const phUrl = ph => ph.kind === 'blob' ? BLOBS.get(ph.id) : ph.kind === 'src' || ph.kind === 'data' ? ph.src : null;
function phThumb(ph) {
  const u = phUrl(ph);
  if (u) return `<img src="${u}" alt="" loading="lazy">`;
  if (ph.kind === 'art') return sampleArt(ph.art, ph.seed);
  return `<span class="ph-lost">${ico('image')}<small>Not stored</small></span>`;
}
function photoStrip(list, { empty = 'No photos', cls = '' } = {}) {
  if (!list || !list.length) return `<p class="muted" style="font-size:13px">${esc(empty)}</p>`;
  list.forEach(ph => PH_REG.set(ph.id, ph));
  return `<div class="ph-strip ${cls}" data-phs="${list.map(p => p.id).join(',')}">${list.map(ph => `<button type="button" class="ph-t" data-act="openPhoto" data-id="${ph.id}" aria-label="View ${esc(ph.caption || ph.name || 'photo')}">${phThumb(ph)}${ph.sample ? '<span class="ph-tag">Sample</span>' : ''}</button>`).join('')}</div>`;
}
let PHV = null;
function openPhoto(id, ids) {
  const ph = PH_REG.get(id); if (!ph) return;
  ids = ids && ids.includes(id) ? ids : [id]; PHV = { ids, i: ids.indexOf(id) };
  const u = phUrl(ph), n = ids.length;
  openModal({ title: ph.caption || ph.name || 'Photo', sub: `Uploaded ${fmtTs(ph.at)}${ph.by ? ` by ${esc(userName(ph.by))}` : ''}${ph.sample ? ' · sample image' : ''}`, wide: true,
    body: `<div class="viewer">${u ? `<img src="${u}" alt="">` : ph.kind === 'art' ? `<div class="viewer-art">${sampleArt(ph.art, ph.seed)}</div>` : `<div class="empty-state" style="color:#aab">${ico('image')}<b style="color:#fff">Original not stored</b>Files uploaded in this demo are kept only until the page is reloaded.</div>`}
      ${n > 1 ? `<button type="button" class="vnav prev" data-act="photoStep" data-dir="-1" aria-label="Previous">${ico('chevL')}</button><button type="button" class="vnav next" data-act="photoStep" data-dir="1" aria-label="Next">${ico('chevR')}</button>` : ''}</div>
      <div class="viewer-meta"><span>${esc(ph.name || '')}</span><span class="muted">${n > 1 ? `${PHV.i + 1} of ${n}` : ''}</span></div>`,
    foot: `<button type="button" class="btn primary" data-act="closeModal">Close</button>` });
}
ACT.openPhoto = el => { const h = el.closest('[data-phs]'); openPhoto(el.dataset.id, h ? h.dataset.phs.split(',') : null); };
ACT.photoStep = el => { if (!PHV) return; const n = PHV.ids.length; openPhoto(PHV.ids[(PHV.i + +el.dataset.dir + n) % n], PHV.ids); };

/* photo picker inside forms: files, drag & drop, or a sample image for the demo */
const PICKS = {};
const SAMPLES = {
  site: () => { const ps = DB.projects.map(p => p.id); const out = []; ps.forEach(p => [1, 2, 3, 4].forEach(i => { if ((p === 'p1' || p === 'p2') || i <= 2) out.push({ kind: 'src', src: `assets/media/${p}-photo-${i}.jpg`, name: `site-photo-${p}-${i}.jpg` }); })); return out; },
  material: () => ['cement', 'steel', 'bricks', 'sand', 'tiles', 'truck', 'bill'].map(a => ({ kind: 'art', art: a, name: `${a}.jpg` })),
  defect: () => ['crack', 'leak', 'column'].map(a => ({ kind: 'art', art: a, name: `${a}.jpg` })),
  after: () => [{ kind: 'art', art: 'fixed', name: 'after-repair.jpg' }],
  bill: () => [{ kind: 'art', art: 'bill', name: 'bill-photo.jpg' }],
};
let sampleTurn = 0;
function photoInput(key, { label = 'Photos', req = false, sample = 'site', hint = 'JPG, PNG or HEIC', camera = false, prefer = null } = {}) {
  PICKS[key] = [];
  return `<div class="field" data-pick="${key}"><span>${esc(label)}${req ? ' <em>*</em>' : ''}</span>
    <div class="dropzone sm" data-act="pickFiles" data-key="${key}">${ico('camera')}<div><b>Take or choose photos</b> or drag and drop</div><small>${esc(hint)}</small>
      <input type="file" accept="image/*" multiple hidden ${camera ? 'capture="environment"' : ''} data-pick-input="${key}"></div>
    <div class="pick-acts"><button type="button" class="btn xs" data-act="pickSample" data-key="${key}" data-kind="${sample}"${prefer ? ` data-prefer="${esc(prefer)}"` : ''}>${ico('image', 'sm')}Add a sample photo</button><span class="muted">Demo: uploads stay in this browser tab only</span></div>
    <div class="ph-grid sm" data-pick-grid="${key}"></div></div>`;
}
function renderPicks(key) {
  const g = $(`[data-pick-grid="${key}"]`); if (!g) return;
  g.innerHTML = (PICKS[key] || []).map((ph, i) => `<div class="ph">${phThumb(ph)}<button type="button" data-act="unpick" data-key="${key}" data-i="${i}" aria-label="Remove photo">${ico('x', 'sm')}</button></div>`).join('');
}
function addPickFiles(key, files) {
  [...files].filter(f => /^image\//.test(f.type) || /\.(jpe?g|png|heic|webp)$/i.test(f.name)).forEach(f => {
    const ph = { id: rid('ph'), kind: 'blob', name: f.name, at: Date.now(), by: SESSION };
    BLOBS.set(ph.id, URL.createObjectURL(f)); (PICKS[key] ||= []).push(ph);
  });
  renderPicks(key);
}
ACT.pickFiles = el => $(`[data-pick-input="${el.dataset.key}"]`)?.click();
ACT.pickSample = el => {
  const pool = SAMPLES[el.dataset.kind]?.() || SAMPLES.site();
  const pref = el.dataset.prefer ? pool.filter(s => (s.src || s.art || '').includes(el.dataset.prefer)) : [];
  const src = (pref.length ? pref : pool)[sampleTurn++ % (pref.length || pool.length)];
  (PICKS[el.dataset.key] ||= []).push({ ...src, id: rid('ph'), at: Date.now(), by: SESSION, sample: true });
  renderPicks(el.dataset.key);
};
ACT.unpick = el => { PICKS[el.dataset.key].splice(+el.dataset.i, 1); renderPicks(el.dataset.key); };
const takePicks = key => { const l = PICKS[key] || []; delete PICKS[key]; return l; };
document.addEventListener('change', e => { const k = e.target.dataset?.pickInput; if (k) { addPickFiles(k, e.target.files); e.target.value = ''; } });
document.addEventListener('dragover', e => { const z = e.target.closest?.('[data-pick] .dropzone'); if (z) { e.preventDefault(); z.classList.add('over'); } });
document.addEventListener('dragleave', e => { const z = e.target.closest?.('[data-pick] .dropzone'); if (z) z.classList.remove('over'); });
document.addEventListener('drop', e => { const z = e.target.closest?.('[data-pick] .dropzone'); if (!z) return; e.preventDefault(); z.classList.remove('over'); addPickFiles(z.dataset.key, e.dataTransfer.files); });

/* ================= selfie camera ================= */
let CAM = null;
function stopCam() { CAM?.stream?.getTracks().forEach(t => t.stop()); CAM = null; }
async function startCam(box) {
  stopCam();
  const v = $('video', box);
  if (!navigator.mediaDevices?.getUserMedia) { box.classList.add('no-cam'); return; }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 640 } }, audio: false });
    if (!document.body.contains(box)) { stream.getTracks().forEach(t => t.stop()); return; }
    CAM = { stream }; v.srcObject = stream; await v.play().catch(() => { }); box.classList.add('live');
  } catch { box.classList.add('no-cam'); }
}
// small JPEG so a selfie fits comfortably in browser storage
function frameToData(src, w, h) {
  const c = document.createElement('canvas'), W = 240, H = 300; c.width = W; c.height = H;
  const x = c.getContext('2d'), s = Math.max(W / w, H / h);
  x.translate(W, 0); x.scale(-1, 1);
  x.drawImage(src, (W - w * s) / 2, (H - h * s) / 2, w * s, h * s);
  return c.toDataURL('image/jpeg', .72);
}
function cameraBox(key) {
  return `<div class="cam" data-cam="${key}"><video playsinline muted></video><img class="cam-shot" alt="" hidden>
    <div class="cam-off">${ico('camera', 'lg')}<b>Camera not available</b><span>Allow camera access, upload a selfie, or use a sample selfie for this demo.</span></div>
    <div class="cam-acts"><button type="button" class="btn sm primary" data-act="camSnap" data-key="${key}">${ico('camera', 'sm')}Capture</button>
      <button type="button" class="btn sm" data-act="camRetake" data-key="${key}" hidden>${ico('refresh', 'sm')}Retake</button>
      <button type="button" class="btn sm" data-act="camFile" data-key="${key}">${ico('upload', 'sm')}Upload</button>
      <button type="button" class="btn sm" data-act="camSample" data-key="${key}">Use sample</button>
      <input type="file" accept="image/*" capture="user" hidden data-cam-file="${key}"></div></div>`;
}
const SNAP = {};
function setSnap(key, ph) {
  SNAP[key] = ph;
  const box = $(`[data-cam="${key}"]`); if (!box) return;
  const img = $('.cam-shot', box);
  if (ph.kind === 'art') { img.hidden = true; $('.cam-art', box)?.remove(); box.insertAdjacentHTML('afterbegin', `<div class="cam-art">${sampleArt('selfie', ph.seed)}</div>`); }
  else { $('.cam-art', box)?.remove(); img.src = ph.src; img.hidden = false; }
  box.classList.add('shot'); $('[data-act="camRetake"]', box).hidden = false; $('[data-act="camSnap"]', box).hidden = true;
}
ACT.camSnap = el => {
  const box = el.closest('.cam'), v = $('video', box);
  if (!CAM || !v.videoWidth) { toast('Camera not ready — upload a selfie or use the sample', 'lock'); return; }
  setSnap(el.dataset.key, { id: rid('ph'), kind: 'data', src: frameToData(v, v.videoWidth, v.videoHeight), name: 'selfie.jpg', at: Date.now(), by: SESSION });
};
ACT.camRetake = el => { const box = el.closest('.cam'); delete SNAP[el.dataset.key]; box.classList.remove('shot'); $('.cam-shot', box).hidden = true; $('.cam-art', box)?.remove(); el.hidden = true; $('[data-act="camSnap"]', box).hidden = false; };
ACT.camFile = el => $(`[data-cam-file="${el.dataset.key}"]`).click();
ACT.camSample = el => setSnap(el.dataset.key, { id: rid('ph'), kind: 'art', art: 'selfie', seed: me().name, name: 'sample-selfie.jpg', at: Date.now(), by: SESSION, sample: true });
document.addEventListener('change', e => {
  const k = e.target.dataset?.camFile; if (!k || !e.target.files[0]) return;
  const img = new Image(); img.onload = () => { setSnap(k, { id: rid('ph'), kind: 'data', src: frameToData(img, img.naturalWidth, img.naturalHeight), name: e.target.files[0].name, at: Date.now(), by: SESSION }); URL.revokeObjectURL(img.src); };
  img.src = URL.createObjectURL(e.target.files[0]);
});
$('#modal').addEventListener('close', stopCam);

/* ================= GPS verification ================= */
const OFFICE_GEO = { lat: 11.1010, lng: 79.6530, name: 'Head office, Mayiladuthurai' };
const SITE_GEO = { p1: [11.1042, 79.6561], p2: [11.1080, 79.6420], p3: [11.2385, 79.7365], p4: [10.7735, 79.6380], p5: [11.0268, 79.8550], p6: [10.9260, 79.8375], p7: [11.1028, 79.6530], p8: [11.1185, 79.7590] };
const GEO_RADIUS_M = 300;
const geoOf = site => site === 'office' || !SITE_GEO[site] ? [OFFICE_GEO.lat, OFFICE_GEO.lng] : SITE_GEO[site];
function distM([a1, o1], [a2, o2]) { const R = 6371e3, r = Math.PI / 180, dA = (a2 - a1) * r, dO = (o2 - o1) * r; const h = Math.sin(dA / 2) ** 2 + Math.cos(a1 * r) * Math.cos(a2 * r) * Math.sin(dO / 2) ** 2; return Math.round(2 * R * Math.asin(Math.sqrt(h))); }
const fmtDist = m => m >= 1000 ? `${num(Math.round(m / 100) / 10)} km` : `${m} m`;
const siteName = s => s === 'office' ? 'Head office' : proj(s)?.name || '—';
function locateFor(site, cb) {
  if (!navigator.geolocation) { cb({ error: 'Location is not available in this browser' }); return; }
  navigator.geolocation.getCurrentPosition(
    pos => { const here = [pos.coords.latitude, pos.coords.longitude], d = distM(here, geoOf(site)); cb({ lat: +here[0].toFixed(5), lng: +here[1].toFixed(5), acc: Math.round(pos.coords.accuracy), dist: d, ok: d <= GEO_RADIUS_M, at: Date.now() }); },
    err => cb({ error: err.code === 1 ? 'Location permission was denied' : 'Could not get your location' }), { enableHighAccuracy: true, timeout: 9000, maximumAge: 60000 });
}
function simulatedFix(site) { const [a, o] = geoOf(site), d = 20 + Math.round(Math.random() * 90); return { lat: +(a + d / 111e3).toFixed(5), lng: o, acc: 12, dist: d, ok: true, simulated: true, at: Date.now() }; }
const gpsBadge = g => !g ? '<span class="muted">Not captured</span>' : g.ok ? `<span class="badge ok">${g.simulated ? 'Simulated · ' : ''}On site · ${fmtDist(g.dist)}</span>` : `<span class="badge warn">Outside radius · ${fmtDist(g.dist)}</span>`;

/* ================= print / PDF ================= */
const PAPER_CSS = `body{margin:0;font:12px/1.55 Inter,Arial,sans-serif;color:#222;background:#fff}.paper{width:auto;max-width:760px;margin:24px auto;padding:36px 40px}
.ph{display:flex;align-items:center;gap:10px;border-bottom:2px solid #D42B2A;padding-bottom:12px;margin-bottom:16px}.ph img{width:38px}h4{font:600 15px Arial,sans-serif;margin:0 0 4px}
table{width:100%;border-collapse:collapse;margin:12px 0}td,th{border-bottom:1px solid #E6E6E6;padding:6px 4px;text-align:left}th{font-size:10.5px;text-transform:uppercase;letter-spacing:.04em;color:#666}.r{text-align:right}
.stamp{display:inline-block;border:2px solid currentColor;border-radius:6px;padding:2px 10px;font-weight:700;letter-spacing:.06em;text-transform:uppercase}.muted{color:#777}.tot td{font-weight:700;border-top:1.5px solid #999}
.grid2{display:flex;justify-content:space-between;gap:16px}.demo{margin-top:24px;padding:8px 10px;background:#FBF0D6;color:#7a5200;font-size:11px;border-radius:4px}@page{margin:14mm}`;
function paperHtml(title, inner) {
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title><base href="${esc(location.href.replace(/[#?].*$/, '').replace(/[^/]*$/, ''))}"><style>${PAPER_CSS}</style></head><body><div class="paper">${inner}</div></body></html>`;
}
function printPaper(title, inner) {
  const f = document.createElement('iframe');
  f.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0';
  document.body.appendChild(f);
  f.contentDocument.open(); f.contentDocument.write(paperHtml(title, inner)); f.contentDocument.close();
  const go = () => { try { f.contentWindow.focus(); f.contentWindow.print(); } catch { toast('Printing is blocked in this browser', 'lock'); } setTimeout(() => f.remove(), 1500); };
  const img = f.contentDocument.images[0];
  if (img && !img.complete) { img.onload = img.onerror = go; setTimeout(go, 1200); } else setTimeout(go, 60);
  toast('Choose “Save as PDF” in the print dialog to download a PDF');
}
function downloadPaper(name, title, inner) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([paperHtml(title, inner)], { type: 'text/html' }));
  a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  toast(`Downloaded ${name}`);
}
const paperHead = sub => `<div class="ph"><img src="assets/logo.png" alt=""><div><h4>Scale Space Builders</h4><div style="color:#777;font-size:11px">Construction &amp; Design Firm · No.4, State Bank Colony, Lalbahadur Nagar, Mayiladuthurai 609001 · GSTIN 33ABCFS1234K1Z5 (demo)${sub ? ' · ' + sub : ''}</div></div></div>`;

/* ================= small shared UI ================= */
const statusChips = (list, cur, key = 'st', counts = null) => `<div class="chips">${list.map(([v, l]) => `<button class="chip ${cur === v ? 'on' : ''}" data-act="setQ" data-k="${key}" data-v="${v}">${l}${counts ? ` <span class="n">${counts(v)}</span>` : ''}</button>`).join('')}</div>`;
const stars = n => `<span class="stars" aria-label="${n} out of 5">${[1, 2, 3, 4, 5].map(i => `<i class="${i <= Math.round(n) ? 'on' : ''}">${ico('star', 'sm')}</i>`).join('')}</span>`;
const searchBox = (key, q, ph) => `<div class="inline-search">${ico('search', 'sm')}<input class="input" type="search" placeholder="${esc(ph)}" value="${esc(q)}" data-input="${key}" aria-label="${esc(ph)}"></div>`;
// keep focus in a search box after the filtered page re-renders
const liveSearch = key => el => { setQ({ q: el.value }); const i = $(`[data-input="${key}"]`); if (i) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); } };
const crumbs = list => `<nav class="crumbs" aria-label="Breadcrumb">${list.map(([t, h], i) => i === list.length - 1 ? `<span aria-current="page">${esc(t)}</span>` : `<a href="${h}">${esc(t)}</a>${ico('chevR', 'sm')}`).join('')}</nav>`;
const demoNote = t => `<div class="form-note">${ico('alert', 'sm')}<span>${t}</span></div>`;
