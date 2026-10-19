/* Documents & Media: project documents, and site progress photos & videos */
'use strict';

// drawings are filed by type; they (with approvals and contracts) go through review before use on site
const DRAWING_CATS = ['Floor plans', 'Elevations', 'Architectural drawings', 'Structural drawings', 'Electrical plans', 'Plumbing layouts'];
const DOC_CATS = [...DRAWING_CATS, 'Approvals', 'Contracts', 'Reports', 'Invoices', 'Other documents'];
const isDrawingDoc = d => DRAWING_CATS.includes(d.category);
const needsReview = cat => DRAWING_CATS.includes(cat) || ['Approvals', 'Contracts'].includes(cat);
const MEDIA_CATS = ['Site photos', 'Videos'];
const FTYPES = { pdf: ['PDF', 'pdf'], dwg: ['Drawing', 'dwg'], dxf: ['Drawing', 'dwg'], jpg: ['Image', 'img'], jpeg: ['Image', 'img'], png: ['Image', 'img'], webp: ['Image', 'img'], heic: ['Image', 'img'], mp4: ['Video', 'vid'], mov: ['Video', 'vid'], webm: ['Video', 'vid'], xlsx: ['Spreadsheet', 'xls'], xls: ['Spreadsheet', 'xls'], csv: ['Spreadsheet', 'xls'], docx: ['Document', 'doc'], doc: ['Document', 'doc'] };
const ftype = ext => FTYPES[ext] || ['File', 'doc'];

/* ---------- generated artwork for sample files ---------- */
const TONES = [['#BFD6E8', '#E9EEF2', '#9AA3A8'], ['#F3D9B1', '#F7EBD8', '#A99883'], ['#C9D9C3', '#EDF1EA', '#8E9A88'], ['#D7D3E6', '#EFEDF5', '#99949F'], ['#E8C9B9', '#F5E7DF', '#A8907F']];
function artSvg(doc, big = false) {
  const a = doc.art, w = 400, h = 300;
  const wrap = (bg, inner) => `<svg class="art" viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><rect width="${w}" height="${h}" fill="${bg}"/>${inner}</svg>`;
  if (a === 'plan') return wrap('#F4F7FB', `<g fill="none" stroke="#2F5E9E" stroke-width="2.4"><rect x="60" y="40" width="280" height="220"/><path d="M60 140h120M180 40v220M180 170h160M260 40v130M120 140v120"/></g><g fill="none" stroke="#2F5E9E" stroke-width="1" opacity=".6"><path d="M180 100a26 26 0 0 1 26 -26M120 200a20 20 0 0 1 20 20M260 120a22 22 0 0 0 -22 22"/></g><g fill="#2F5E9E" font-family="Inter,sans-serif" font-size="11" opacity=".8"><text x="92" y="92">LIVING</text><text x="200" y="110">KITCHEN</text><text x="276" y="110">DINING</text><text x="72" y="200">BED 1</text><text x="140" y="214">BATH</text><text x="230" y="222">BED 2</text></g><g stroke="#2F5E9E" stroke-width=".8" opacity=".35"><path d="M60 28h280M60 24v8M340 24v8M348 40h0M352 40v220"/></g>`);
  if (a === 'struct') return wrap('#F5F6F8', `<g stroke="#9AA3AD" stroke-dasharray="4 4" stroke-width="1">${[70, 150, 230, 310].map(x => `<path d="M${x} 30v240"/>`).join('')}${[60, 130, 200, 260].map(y => `<path d="M40 ${y}h320"/>`).join('')}</g><g fill="#3E444D">${[70, 150, 230, 310].flatMap(x => [60, 130, 200, 260].map(y => `<rect x="${x - 7}" y="${y - 7}" width="14" height="14"/>`)).join('')}</g><g fill="none" stroke="#D42B2A" stroke-width="1.4" opacity=".75">${[70, 150, 230, 310].flatMap(x => [60, 130, 200, 260].map(y => `<rect x="${x - 18}" y="${y - 18}" width="36" height="36"/>`)).join('')}</g>`);
  if (a === 'elec' || a === 'plumb') {
    const c = a === 'elec' ? '#C47A00' : '#1F7FA8', walls = `<g fill="none" stroke="#9AA3AD" stroke-width="2"><rect x="60" y="40" width="280" height="220"/><path d="M60 140h120M180 40v220M180 170h160M260 40v130"/></g>`;
    const marks = a === 'elec'
      ? `<g fill="none" stroke="${c}" stroke-width="1.6" stroke-dasharray="5 4"><path d="M100 90q40 -30 80 0t70 20M120 200q30 30 60 0M220 110q40 40 90 20M220 220h90"/></g><g fill="${c}">${[[100, 90], [180, 90], [250, 110], [120, 200], [180, 200], [310, 130], [220, 220], [310, 220]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="6"/>`).join('')}</g><g font-family="Inter,sans-serif" font-size="10" fill="${c}"><text x="72" y="62">DB-1</text><text x="200" y="64">L1–L6</text></g><rect x="66" y="48" width="18" height="10" fill="${c}"/>`
      : `<g fill="none" stroke="${c}" stroke-width="2.2"><path d="M90 250V180h90M180 180v-60h120M300 120v100"/><path d="M90 250h250" stroke-dasharray="8 4"/></g><g fill="#fff" stroke="${c}" stroke-width="2">${[[90, 180], [180, 120], [300, 220], [300, 120]].map(([x, y]) => `<rect x="${x - 8}" y="${y - 8}" width="16" height="16" rx="3"/>`).join('')}</g><circle cx="340" cy="250" r="9" fill="${c}"/><g font-family="Inter,sans-serif" font-size="10" fill="${c}"><text x="96" y="176">WC</text><text x="186" y="116">KIT</text><text x="306" y="216">BATH</text><text x="318" y="270">IC</text></g>`;
    return wrap('#F5F7FA', walls + marks + `<rect x="296" y="12" width="92" height="22" rx="4" fill="${c}"/><text x="342" y="27" fill="#fff" font-family="Inter,sans-serif" font-size="11" font-weight="700" text-anchor="middle">${a === 'elec' ? 'ELECTRICAL' : 'PLUMBING'}</text>`);
  }
  if (a === 'elev') return wrap('#F6F5F2', `<path d="M40 250h320" stroke="#3E444D" stroke-width="2"/><g fill="none" stroke="#3E444D" stroke-width="2"><rect x="90" y="110" width="220" height="140"/><path d="M80 110h240M90 180h220"/><path d="M120 60h160v50H120z"/></g><g fill="#BFD6E8" stroke="#3E444D" stroke-width="1.4"><rect x="110" y="128" width="40" height="36"/><rect x="180" y="128" width="40" height="36"/><rect x="250" y="128" width="40" height="36"/><rect x="110" y="198" width="40" height="36"/><rect x="250" y="198" width="40" height="36"/></g><rect x="182" y="196" width="36" height="54" fill="#A0522D"/>`);
  if (a === 'sheet') return wrap('#FFFFFF', `<rect x="0" y="0" width="${w}" height="34" fill="#1F7A43"/><g stroke="#E2E6E3">${Array.from({ length: 12 }, (_, i) => `<path d="M0 ${58 + i * 22}h${w}"/>`).join('')}${[60, 200, 270, 340].map(x => `<path d="M${x} 34v${h}"/>`).join('')}</g><g fill="#C9D3CC">${Array.from({ length: 11 }, (_, i) => `<rect x="70" y="${42 + i * 22}" width="${60 + (i * 37) % 70}" height="7" rx="3"/><rect x="290" y="${42 + i * 22}" width="40" height="7" rx="3"/>`).join('')}</g>`);
  if (a === 'photo') {
    const [sky, ground, bld] = TONES[(doc.tone || 0) % TONES.length];
    return wrap(sky, `<defs><linearGradient id="g${doc.id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${sky}"/><stop offset="1" stop-color="${ground}"/></linearGradient></defs><rect width="${w}" height="${h}" fill="url(#g${doc.id})"/>
      <rect x="0" y="230" width="${w}" height="70" fill="${ground}"/><rect x="0" y="228" width="${w}" height="4" fill="${bld}" opacity=".4"/>
      <g fill="${bld}"><rect x="90" y="110" width="200" height="120" opacity=".85"/><rect x="110" y="70" width="160" height="40" opacity=".7"/></g>
      <g fill="${sky}" opacity=".85">${[110, 160, 210, 250].map(x => `<rect x="${x}" y="130" width="26" height="30"/><rect x="${x}" y="180" width="26" height="30"/>`).join('')}</g>
      <g stroke="#6B5B3E" stroke-width="2.2" opacity=".75">${[80, 130, 180, 230, 280, 300].map(x => `<path d="M${x} 60v170"/>`).join('')}${[90, 130, 170, 210].map(y => `<path d="M76 ${y}h228"/>`).join('')}</g>
      <path d="M330 230V40M330 46h-90M330 46h30" stroke="#D9A21B" stroke-width="5"/><path d="M262 46v40" stroke="#555" stroke-width="1.5"/><rect x="254" y="84" width="16" height="10" fill="#555"/>
      <g fill="#8C7A5B" opacity=".9"><path d="M20 230l30-26 30 26z"/><path d="M300 230l20-16 22 16z"/></g>`);
  }
  // generic document page
  return wrap('#EEF0F2', `<rect x="110" y="24" width="180" height="252" fill="#fff" stroke="#DDE1E5"/><rect x="128" y="44" width="70" height="8" fill="#D42B2A" opacity=".85"/>${Array.from({ length: 13 }, (_, i) => `<rect x="128" y="${70 + i * 15}" width="${144 - (i * 23) % 60}" height="5" rx="2" fill="#D3D8DD"/>`).join('')}`);
}

const isMedia = d => MEDIA_CATS.includes(d.category);
// bills and receipts filed under Invoices are financial records
const docVisible = d => canMoney() || d.category !== 'Invoices';
const docCats = () => DOC_CATS.filter(c => canMoney() || c !== 'Invoices');
const isVideo = d => ftype(d.ext)[1] === 'vid';
const fmtDur = s => `${Math.floor(s / 60)}:${pad(Math.round(s % 60))}`;
const docById = id => DB.documents.find(x => x.id === id);

/* ---------- thumbnails ---------- */
function docThumb(d) {
  const blob = BLOBS.get(d.id), [, cls] = ftype(d.ext);
  if (cls === 'img' && (blob || d.src)) return `<img src="${blob || d.src}" alt="" loading="lazy">`;
  if (cls === 'vid' && d.poster) return `<img src="${d.poster}" alt="" loading="lazy"><span class="play">${ico('play')}</span>`;
  if (cls === 'vid' && blob) return `<video src="${blob}#t=0.5" muted preload="metadata"></video><span class="play">${ico('play')}</span>`;
  if (d.art) return artSvg(d) + (cls === 'vid' ? `<span class="play">${ico('play')}</span>` : '');
  return `<span class="ftype ${cls}" style="width:52px;height:52px;font-size:12px">${esc(d.ext.toUpperCase())}</span>`;
}
function docsGrid(list) {
  if (!list.length) return `<div class="card">${emptyPage('No documents here', 'Upload drawings, approvals and contracts to keep everything in one place.')}</div>`;
  return `<div class="files">${list.map(d => `<button type="button" class="card file" data-act="previewDoc" data-id="${d.id}">
    <div class="thumb">${docThumb(d)}<span class="ext">${esc(d.ext.toUpperCase())}</span></div>
    <div class="fi"><b title="${esc(d.name)}">${esc(d.name)}</b><span>${esc(proj(d.project)?.name || '')} · ${fmtD(d.date)}</span>${d.versions ? `<span class="fi-st">${badge(docStatus(d))}<span class="tag">v${d.version}</span>${approvedVer(d) && approvedVer(d) !== curVer(d) && !d.archived ? `<span class="muted">in use: v${approvedVer(d).v}</span>` : ''}</span>` : ''}</div></button>`).join('')}</div>`;
}
function docsTable(list) {
  return `<div class="card"><div class="table-wrap"><table class="t stack-sm"><thead><tr><th>Name</th><th>Project</th><th>Category</th><th>Status</th><th>Uploaded</th><th class="r">Size</th></tr></thead><tbody>
    ${list.map(d => { const [, cls] = ftype(d.ext); const ap = d.versions && approvedVer(d); return `<tr class="click" data-act="previewDoc" data-id="${d.id}"><td class="full"><div class="person"><span class="ftype ${cls}">${esc(d.ext.toUpperCase().slice(0, 4))}</span><div class="nm"><b>${esc(d.name)}</b><span>Version ${d.version}${ap && ap !== curVer(d) ? ` · approved v${ap.v} in use` : ''} · ${esc(userName(d.by))}</span></div></div></td><td class="hide-sm">${esc(proj(d.project)?.name)}</td><td class="hide-sm">${esc(d.category)}</td><td>${d.versions ? badge(docStatus(d)) : ''}</td><td class="nowrap hide-sm">${fmtDY(d.date)}</td><td class="r hide-sm">${fmtSize(d.size)}</td></tr>`; }).join('') || emptyRow(6, 'No documents match')}
  </tbody></table></div></div>`;
}

/* ---------- site progress gallery ---------- */
function mediaTile(d, showProject = true) {
  const v = isVideo(d);
  return `<button type="button" class="media-tile" data-act="openMedia" data-id="${d.id}" aria-label="${v ? 'Play video' : 'View photo'}: ${esc(d.name)}">
    <span class="mt-img">${docThumb(d)}<span class="mt-kind">${v ? ico('video', 'sm') + 'Video' : ico('image', 'sm') + 'Photo'}</span>${v && d.duration ? `<span class="mt-dur">${fmtDur(d.duration)}</span>` : ''}</span>
    <span class="mt-cap"><b>${esc(d.stage || d.name.replace(/\.\w+$/, ''))}</b><span>${showProject ? esc(proj(d.project)?.name) + ' · ' : ''}${fmtD(d.date)}</span></span></button>`;
}
function mediaGrid(list, showProject = true) {
  return `<div class="media-grid" data-ids="${list.map(d => d.id).join(',')}">${list.map(d => mediaTile(d, showProject)).join('')}</div>`;
}
function mediaGallery(list, { byStage = false, showProject = true } = {}) {
  if (!list.length) return `<div class="card">${emptyPage('No photos or videos yet', 'Site photos and walkthrough videos will appear here.')}</div>`;
  const groups = [];
  const add = (k, d) => { let g = groups.find(x => x.k === k); if (!g) groups.push(g = { k, items: [] }); g.items.push(d); };
  if (byStage) {
    const p = proj(list[0].project);
    list.slice().sort((a, b) => (p.stages.indexOf(b.stage) - p.stages.indexOf(a.stage)) || b.date.localeCompare(a.date)).forEach(d => add(d.stage || 'Other', d));
  } else {
    list.forEach(d => { const n = -daysFrom(d.date); add(n <= 7 ? 'This week' : n <= 30 ? 'This month' : parseD(d.date).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }), d); });
  }
  const all = groups.flatMap(g => g.items).map(d => d.id).join(',');
  return `<div class="stack" data-ids="${all}">${groups.map(g => `<section><div class="media-head"><h3>${esc(g.k)}</h3><span class="muted">${plural(g.items.filter(x => !isVideo(x)).length, 'photo')}${g.items.some(isVideo) ? ` · ${plural(g.items.filter(isVideo).length, 'video')}` : ''}</span></div>
    <div class="media-grid">${g.items.map(d => mediaTile(d, showProject)).join('')}</div></section>`).join('')}</div>`;
}

/* ---------- viewer: photos and in-app video playback ---------- */
let VIEWER = null;
function mediaStage(d) {
  const blob = BLOBS.get(d.id);
  if (isVideo(d)) {
    if (blob) return `<video class="player" src="${blob}" controls autoplay playsinline></video>`;
    if (d.src) return `<video class="player" controls autoplay playsinline preload="auto" ${d.poster ? `poster="${d.poster}"` : ''}><source src="${d.src}.webm" type="video/webm"><source src="${d.src}.mp4" type="video/mp4">Your browser cannot play this video.</video>`;
  } else if (blob || d.src) return `<img src="${blob || d.src}" alt="${esc(d.name)}">`;
  return `<div class="empty-state" style="color:#aab">${ico('image')}<b style="color:#fff">Original not stored</b>Files uploaded in this demo are kept only until the page is reloaded.</div>`;
}
function openMedia(id, ids) {
  ids = ids && ids.includes(id) ? ids : [id];
  VIEWER = { ids, i: ids.indexOf(id) };
  const d = docById(id), p = proj(d.project), n = ids.length, i = VIEWER.i;
  openModal({ title: d.stage ? `${d.stage} · ${p.name}` : d.name, sub: `${isVideo(d) ? 'Progress video' : 'Site photo'} · ${fmtDY(d.date)} · by ${esc(userName(d.by))}`, wide: true, body: `
    <div class="viewer">${mediaStage(d)}
      ${n > 1 ? `<button type="button" class="vnav prev" data-act="mediaStep" data-dir="-1" aria-label="Previous">${ico('chevL')}</button><button type="button" class="vnav next" data-act="mediaStep" data-dir="1" aria-label="Next">${ico('chevR')}</button>` : ''}
    </div>
    <div class="viewer-meta"><span>${esc(d.name)}</span><span class="muted">${isVideo(d) && d.duration ? fmtDur(d.duration) + ' · ' : ''}${fmtSize(d.size)}${n > 1 ? ` · ${i + 1} of ${n}` : ''}</span></div>`,
    foot: `${can('documents') ? `<button type="button" class="btn ghost danger left" data-act="deleteDoc" data-id="${d.id}">${ico('trash', 'sm')}Delete</button>` : ''}<a class="btn" href="#/projects/${p.id}?tab=media">${ico('folder', 'sm')}Project gallery</a><button type="button" class="btn primary" data-act="downloadDoc" data-id="${d.id}">${ico('download', 'sm')}Download</button>` });
}
ACT.openMedia = el => { const holder = el.closest('[data-ids]'); openMedia(el.dataset.id, holder ? holder.dataset.ids.split(',') : null); };
ACT.mediaStep = el => { if (!VIEWER) return; const n = VIEWER.ids.length; openMedia(VIEWER.ids[(VIEWER.i + +el.dataset.dir + n) % n], VIEWER.ids); };
document.addEventListener('keydown', e => {
  if (!VIEWER || !$('#modal').open || e.target.closest('input,textarea,select,video')) return;
  if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); ACT.mediaStep({ dataset: { dir: e.key === 'ArrowRight' ? 1 : -1 } }); }
});
$('#modal').addEventListener('close', () => {
  VIEWER = null;
  $$('#modal video').forEach(v => v.pause());
  if (ROUTE.q.d) { const q = { ...ROUTE.q }; delete q.d; history.replaceState(null, '', `#/${[ROUTE.mod, ...ROUTE.parts].join('/')}${Object.keys(q).length ? '?' + new URLSearchParams(q) : ''}`); ROUTE = parseRoute(); }
});

/* ---------- document preview ---------- */
function previewBody(d) {
  const blob = BLOBS.get(d.id), [kind, cls] = ftype(d.ext), p = proj(d.project);
  if (cls === 'img' && (blob || d.src)) return `<img src="${blob || d.src}" alt="${esc(d.name)}">`;
  if (blob) {
    if (d.ext === 'pdf') return `<iframe src="${blob}" title="${esc(d.name)}" style="width:100%;height:62vh;border:0"></iframe>`;
    return `<div class="empty-state">${ico('file')}<b>${esc(kind)} preview not available</b>Download the file to open it.</div>`;
  }
  if (d.uploaded) return `<div class="empty-state">${ico('file')}<b>Original not stored</b>Files uploaded in this demo are kept only until the page is reloaded.</div>`;
  if (['doc', 'sheet'].includes(d.art)) return `<div class="paper"><div class="ph"><img src="assets/logo.png" alt=""><div><h4>Scale Space Builders</h4><div style="color:#777;font-size:11px">No.4, State Bank Colony, Lalbahadur Nagar, Mayiladuthurai</div></div></div>
    <h4>${esc(d.name.replace(/\.\w+$/, ''))}</h4><div style="color:#777;margin-bottom:12px">${esc(p.name)} · ${esc(p.client.name)} · ${fmtDY(d.date)}</div>
    ${d.art === 'sheet' ? `<table>${[['Earthwork & excavation', 0.06], ['Concrete & RCC works', 0.31], ['Masonry', 0.14], ['Plastering', 0.08], ['Flooring & tiling', 0.12], ['Electrical & plumbing', 0.11], ['Painting & finishes', 0.09], ['Doors, windows & misc.', 0.09]].map(([l, f]) => `<tr><td>${l}</td><td style="text-align:right">${inr(p.value * f)}</td></tr>`).join('')}<tr><td><b>Total</b></td><td style="text-align:right"><b>${inr(p.value)}</b></td></tr></table>`
      : `${Array.from({ length: 9 }, (_, i) => `<div class="ln" style="width:${92 - (i * 17) % 40}%"></div>`).join('')}<table><tr><td>Project</td><td>${esc(p.name)}</td></tr><tr><td>Site</td><td>${esc(p.location)}, ${esc(p.city)}</td></tr><tr><td>Built-up area</td><td>${num(p.area)} sq.ft</td></tr></table>${Array.from({ length: 6 }, (_, i) => `<div class="ln" style="width:${88 - (i * 13) % 30}%"></div>`).join('')}`}
    <div style="margin-top:28px;display:flex;justify-content:space-between;color:#777"><span>Prepared by: ${esc(userName(d.by))}</span><span>Page 1 of ${Math.max(1, Math.round(d.size / 220000))}</span></div></div>`;
  return artSvg(d, true);
}
function previewDoc(id) {
  const d = docById(id); if (!d || !docVisible(d)) return;
  if (isMedia(d)) return openMedia(id);
  VIEWER = null;
  const [kind] = ftype(d.ext);
  openModal({ title: d.name, sub: `${esc(proj(d.project)?.name)} · ${esc(d.category)}`, wide: true, body: `
    <div class="preview-stage">${previewBody(d)}</div>
    <dl class="dl c3" style="margin-top:18px"><div><dt>Type</dt><dd>${esc(kind)} · ${d.ext.toUpperCase()}</dd></div><div><dt>Size</dt><dd>${fmtSize(d.size)}</dd></div><div><dt>Version</dt><dd>${d.version}</dd></div>
    <div><dt>Uploaded by</dt><dd>${esc(userName(d.by))}</dd></div><div><dt>Uploaded on</dt><dd>${fmtDY(d.date)}</dd></div><div><dt>Project</dt><dd><a href="#/projects/${d.project}">${esc(proj(d.project)?.name)}</a></dd></div></dl>`,
    foot: `${can('documents') ? `<button type="button" class="btn ghost danger left" data-act="deleteDoc" data-id="${d.id}">${ico('trash', 'sm')}Delete</button>` : ''}<button type="button" class="btn" data-act="closeModal">Close</button><button type="button" class="btn primary" data-act="downloadDoc" data-id="${d.id}">${ico('download', 'sm')}Download</button>` });
}
ACT.previewDoc = el => previewDoc(el.dataset.id);
ACT.downloadDoc = el => {
  const d = docById(el.dataset.id);
  const a = document.createElement('a');
  const blob = BLOBS.get(d.id);
  if (blob || d.src) { a.href = blob || (isVideo(d) ? d.src + '.mp4' : d.src); a.download = d.name; a.target = '_blank'; document.body.appendChild(a); a.click(); a.remove(); toast(`Downloading ${d.name}`); return; }
  let file, name = d.name;
  if (d.art && !['doc', 'sheet'].includes(d.art)) { file = new Blob([artSvg(d).replace('class="art" ', '')], { type: 'image/svg+xml' }); name = d.name.replace(/\.\w+$/, '') + ' (demo preview).svg'; }
  else { const p = proj(d.project); file = new Blob([`Scale Space Builders\n${d.name}\n\nProject: ${p.name} (${p.code})\nClient: ${p.client.name}\nCategory: ${d.category}\nUploaded by ${userName(d.by)} on ${fmtDY(d.date)}\n\nThis is a placeholder file generated by the demo.`], { type: 'text/plain' }); name = d.name.replace(/\.\w+$/, '') + ' (demo).txt'; }
  a.href = URL.createObjectURL(file); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  toast('Sample file downloaded');
};
ACT.deleteDoc = el => { const d = docById(el.dataset.id); if (!guard(can('documents'), 'delete files')) return; confirmBox(`Delete ${isMedia(d) ? (isVideo(d) ? 'video' : 'photo') : 'file'}?`, `<b>${esc(d.name)}</b> will be removed from ${esc(proj(d.project).name)}.`, 'Delete', () => { DB.documents = DB.documents.filter(x => x !== d); BLOBS.delete(d.id); logAct(`deleted ${d.name}`, d.project, 'doc'); commit('Deleted'); }, true); };

/* ---------- uploads ---------- */
function guessCat(f, kind) {
  const c = ftype((f.name.split('.').pop() || '').toLowerCase())[1];
  if (c === 'vid') return 'Videos';
  if (kind === 'media') return 'Site photos';
  return c === 'img' || c === 'dwg' ? 'Architectural drawings' : c === 'xls' ? 'Contracts' : 'Reports';
}
function addUploadedDoc(f, project, category, report = null, stage = null, kind = 'doc') {
  const id = nid('d'), ext = (f.name.split('.').pop() || 'file').toLowerCase();
  const cat = category || guessCat(f, kind);
  const p = proj(project);
  const d = { id, project, name: f.name, category: cat, ext, size: f.size, date: TODAY, by: SESSION, version: 1, uploaded: true, report, stage: MEDIA_CATS.includes(cat) ? (stage || p.stages[p.stage]) : null };
  DB.documents.unshift(d);
  const url = URL.createObjectURL(f);
  BLOBS.set(id, url);
  if (!MEDIA_CATS.includes(cat)) {
    // drawings, approvals and contracts go through review before use; reports and invoices are filed as approved
    const review = needsReview(cat);
    d.versions = [{ v: 1, date: TODAY, at: Date.now(), by: SESSION, size: f.size, note: 'Initial upload', status: review ? 'Under Review' : 'Approved', reviewedBy: review ? null : SESSION, reviewedAt: review ? null : Date.now(), reviewNote: '', uploaded: true }];
    BLOBS.set(`${id}@v1`, url);
    if (review) notify(reviewersOf(d), `New ${DRAWING_CATS.includes(cat) ? 'drawing' : 'document'} for review: ${f.name} · ${p.name}`, '#/documents?tab=review', 'doc');
  }
  if (cat === 'Videos') { const v = document.createElement('video'); v.preload = 'metadata'; v.onloadedmetadata = () => { if (isFinite(v.duration)) { d.duration = v.duration; saveDB(); } }; v.src = url; }
  return id;
}
function bindDrop(zone, input) {
  zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('over'); });
  zone.addEventListener('dragleave', () => zone.classList.remove('over'));
  zone.addEventListener('drop', e => { e.preventDefault(); zone.classList.remove('over'); const dt = new DataTransfer(); [...input.files, ...e.dataTransfer.files].forEach(f => dt.items.add(f)); input.files = dt.files; input.dispatchEvent(new Event('change')); });
}
ACT.upload = el => {
  if (!guard(can('documents'), 'upload files')) return;
  const kind = el.dataset.kind || (ROUTE.q.tab === 'media' ? 'media' : 'doc');
  const media = kind === 'media';
  const pid = el.dataset.p || ROUTE.q.p || myProjects()[0]?.id;
  const stageOpts = pid => proj(pid).stages.map(s => `<option ${s === proj(pid).stages[proj(pid).stage] ? 'selected' : ''}>${esc(s)}</option>`).join('');
  openModal({ title: media ? 'Upload site photos & videos' : 'Upload documents', sub: media ? 'Share progress from site — photos and walkthrough videos.' : 'Drawings, approvals, contracts, reports or invoices.', body: `<div class="form">
    <div class="row2">${fld('Project', 'project', { opts: projOpts(myProjects()), value: pid })}
    ${media ? `<label class="field"><span>Construction stage</span><select class="select" name="stage" id="upStage">${stageOpts(pid)}</select></label>` : fld('Category', 'category', { opts: [['', 'Detect automatically'], ...docCats()], value: docCats().includes(ROUTE.q.cat) ? ROUTE.q.cat : '' })}</div>
    <div class="field"><span>Files <em>*</em></span><div class="dropzone" data-act="pickPhotos">${ico(media ? 'image' : 'upload', 'lg')}<div style="margin-top:6px"><b>Choose ${media ? 'photos or videos' : 'files'}</b> or drag and drop</div><small>${media ? 'JPG, PNG, HEIC, MP4, MOV, WEBM' : 'PDF, DWG, JPG, XLSX, DOCX'} — up to 200 MB each</small><input type="file" id="upFiles" multiple hidden ${media ? 'accept="image/*,video/*"' : ''}></div><ul class="picked" id="upPicked"></ul></div>
    <div class="form-note">${ico('alert', 'sm')}<span>Demo mode: uploaded files stay in this browser tab only and are cleared on reload.</span></div></div>`,
    foot: `<button type="button" class="btn" data-act="closeModal">Cancel</button><button type="submit" class="btn primary">${ico('upload', 'sm')}Upload</button>`,
    onOpen: m => {
      const inp = $('#upFiles');
      inp.addEventListener('change', () => $('#upPicked').innerHTML = [...inp.files].map(f => `<li><span class="ftype ${ftype(f.name.split('.').pop().toLowerCase())[1]}">${esc(f.name.split('.').pop().toUpperCase().slice(0, 4))}</span><span>${esc(f.name)}</span><small class="muted">${fmtSize(f.size)}</small></li>`).join(''));
      bindDrop($('.dropzone', m), inp);
      if (media) $('[name=project]', m).addEventListener('change', e => $('#upStage').innerHTML = stageOpts(e.target.value));
    },
    onSubmit: d => {
      const files = [...$('#upFiles').files]; if (!files.length) { toast('Choose at least one file', 'lock'); return false; }
      if (media && files.some(f => !/^(image|video)\//.test(f.type) && !/\.(jpe?g|png|heic|webp|mp4|mov|webm)$/i.test(f.name))) { toast('Only photos and videos can be added here', 'lock'); return false; }
      files.forEach(f => addUploadedDoc(f, d.project, media ? null : d.category, null, d.stage, kind));
      logAct(`uploaded ${plural(files.length, media ? 'photo/video' : 'file', media ? 'photos/videos' : 'files')}`, d.project, 'doc');
      commit(`${plural(files.length, 'file')} uploaded to ${proj(d.project).name}`);
    } });
};
ACT.pickPhotos = el => $('input[type=file]', el.closest('.field') || el).click();
INPUT.docQ = el => { setQ({ q: el.value }); const i = $('[data-input="docQ"]'); i.focus(); i.setSelectionRange(i.value.length, i.value.length); };

/* ---------- page ---------- */
VIEWS.documents = () => {
  const tab = ['media', 'review'].includes(ROUTE.q.tab) ? ROUTE.q.tab : 'docs';
  const ids = myProjectIds();
  const mine = DB.documents.filter(d => ids.has(d.project) && docVisible(d));
  const docs = mine.filter(d => !isMedia(d)), media = mine.filter(isMedia);
  if (ROUTE.q.d) after(() => previewDoc(ROUTE.q.d));
  const head = pageHead('Documents & Media', 'Project documents and site progress photos & videos, kept separately for every project.',
    can('documents') ? btn(tab === 'media' ? 'Upload photos & videos' : 'Upload documents', 'upload', { icon: 'upload', cls: 'primary', data: `data-kind="${tab === 'media' ? 'media' : 'doc'}"` }) : '');
  const T = tabs([['docs', `${ico('file', 'sm')}Project documents`, docs.filter(d => !d.archived).length], ['review', `${ico('shield', 'sm')}Approvals & revisions`, docQueue().length || null], ['media', `${ico('image', 'sm')}Site progress photos & videos`, media.length]], tab);
  return head + T + (tab === 'media' ? mediaTab(media) : tab === 'review' ? reviewTab() : docsTab(docs));
};
function docsTab(base0) {
  const { cat = '', p = '', type = '', q = '', view = 'grid', sort = 'new', st = '' } = ROUTE.q;
  const base = base0.filter(d => (!p || d.project === p) && (st === 'Archived' ? d.archived : !d.archived));
  let list = base.filter(d => (!cat || d.category === cat) && (!type || ftype(d.ext)[0] === type) && (!st || st === 'Archived' || docStatus(d) === st) && (!q || d.name.toLowerCase().includes(q.toLowerCase())));
  list = list.sort((a, b) => sort === 'name' ? a.name.localeCompare(b.name) : sort === 'size' ? b.size - a.size : b.date.localeCompare(a.date));
  const shown = ROUTE.q.all ? list : list.slice(0, 16);
  const catIco = { '': 'folder', Drawings: 'grid', Approvals: 'shield', Contracts: 'file', Reports: 'report', Invoices: 'receipt' };
  return `<div class="folders">${[['', 'All documents'], ...docCats().map(c => [c, c])].map(([v, l]) => { const inC = base.filter(d => !v || d.category === v); return `<button class="folder ${cat === v ? 'on' : ''}" data-act="setQ" data-k="cat" data-v="${v}">${ico(catIco[v])}<span><b>${l}</b><br><span>${plural(inC.length, 'file')} · ${fmtSize(sum(inC, d => d.size))}</span></span></button>`; }).join('')}</div>
    <div class="toolbar">
      <div class="inline-search">${ico('search', 'sm')}<input class="input" type="search" placeholder="Search documents" value="${esc(q)}" data-input="docQ" aria-label="Search documents"></div>
      ${projSelect(p)}
      <select class="select" data-change="setQ" data-k="type" aria-label="File type"><option value="">All file types</option>${['PDF', 'Drawing', 'Image', 'Spreadsheet', 'Document'].map(t => `<option ${t === type ? 'selected' : ''}>${t}</option>`).join('')}</select>
      <select class="select" data-change="setQ" data-k="st" aria-label="Status"><option value="">All statuses</option>${DOC_STATUSES.map(x => `<option ${x === st ? 'selected' : ''}>${x}</option>`).join('')}</select>
      <select class="select" data-change="setQ" data-k="sort" aria-label="Sort"><option value="new" ${sort === 'new' ? 'selected' : ''}>Newest first</option><option value="name" ${sort === 'name' ? 'selected' : ''}>Name</option><option value="size" ${sort === 'size' ? 'selected' : ''}>Largest</option></select>
      <span class="grow"></span>
      <div class="seg" role="group" aria-label="View"><button class="${view === 'grid' ? 'on' : ''}" data-act="setQ" data-k="view" data-v="grid">${ico('grid', 'sm')}Grid</button><button class="${view === 'list' ? 'on' : ''}" data-act="setQ" data-k="view" data-v="list">${ico('rows', 'sm')}List</button></div>
    </div>
    <div class="muted" style="font-size:13px">${plural(list.length, 'document')}${cat ? ` in ${esc(cat)}` : ''}${p ? ` · ${esc(proj(p).name)}` : ''}${st !== 'Archived' ? ` · ${base0.filter(d => d.archived && (!p || d.project === p)).length} archived <button class="linkbtn" data-act="setQ" data-k="st" data-v="Archived">view</button>` : ''}</div>
    ${view === 'grid' ? docsGrid(shown) : docsTable(shown)}
    ${list.length > shown.length ? `<div style="text-align:center"><button class="btn" data-act="setQ" data-k="all" data-v="1">Show all ${list.length} documents</button></div>` : ''}`;
}
function mediaTab(base0) {
  const { p = '', kind = '', stage = '' } = ROUTE.q;
  const base = base0.filter(d => !p || d.project === p);
  const list = base.filter(d => (!kind || (kind === 'video' ? isVideo(d) : !isVideo(d))) && (!stage || d.stage === stage)).sort((a, b) => b.date.localeCompare(a.date));
  const vids = base.filter(isVideo).length;
  const stages = p ? proj(p).stages.filter(s => base.some(d => d.stage === s)) : [];
  return `<div class="toolbar">${projSelect(p)}
      <div class="chips">${[['', 'All', base.length], ['photo', 'Photos', base.length - vids], ['video', 'Videos', vids]].map(([v, l, n]) => `<button class="chip ${kind === v ? 'on' : ''}" data-act="setQ" data-k="kind" data-v="${v}">${v === 'video' ? ico('video', 'sm') : v === 'photo' ? ico('image', 'sm') : ''}${l} <span class="n">${n}</span></button>`).join('')}</div>
      ${p ? `<select class="select" data-change="setQ" data-k="stage" aria-label="Stage"><option value="">All stages</option>${stages.map(s => `<option ${s === stage ? 'selected' : ''}>${esc(s)}</option>`).join('')}</select>` : ''}
    </div>
    ${mediaGallery(list, { byStage: !!p, showProject: !p })}`;
}
