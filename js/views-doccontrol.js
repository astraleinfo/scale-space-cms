/* Document control: every project document has a title, type, floor / area, description and a version history.
   What the site should work from is always spelled out — "Use v3 · Finalized" — and older or unapproved versions
   are marked so they are not used by mistake. Nothing is overwritten or deleted: a revision adds a version, and
   documents are archived (with their history) instead of deleted. Builds on views-documents.js and views-revisions.js. */
'use strict';

const CAT_ICO = { 'Floor plans': 'grid', Elevations: 'building', 'Architectural drawings': 'compare', 'Structural drawings': 'hardhat', 'Electrical plans': 'flag', 'Plumbing layouts': 'refresh',
  Approvals: 'shield', Contracts: 'file', Reports: 'report', Invoices: 'receipt', 'Other documents': 'folder' };
const CAT_ART = { 'Floor plans': 'plan', Elevations: 'elev', 'Architectural drawings': 'plan', 'Structural drawings': 'struct', 'Electrical plans': 'elec', 'Plumbing layouts': 'plumb' };
const CAT_DESC = { 'Floor plans': 'Room layout with dimensions, door and window positions.', Elevations: 'External elevation showing heights, openings and finishes.', 'Architectural drawings': 'Architectural drawing for construction.',
  'Structural drawings': 'Footing, column and beam details with reinforcement.', 'Electrical plans': 'Light, fan and socket points with circuit routing and DB location.', 'Plumbing layouts': 'Water supply and drainage lines with fixture positions.',
  Approvals: 'Statutory approval issued for this project.', Contracts: 'Signed contract document.', Reports: 'Project report.', Invoices: 'Bill / invoice copy.', 'Other documents': 'Project document.' };
const docTitle = d => d.title || d.name.replace(/\.\w+$/, '');
const catIco = c => CAT_ICO[c] || 'file';

/* ---------- migration of older records and sample data ---------- */
function guessArea(d) {
  const n = d.name;
  if (/GF\s*&\s*FF/i.test(n)) return 'Ground & first floor';
  if (/\bGF\b/.test(n)) return 'Ground floor';
  if (/footing|foundation/i.test(n)) return 'Foundation';
  if (/elevation/i.test(n)) return 'Front elevation';
  if (/reception/i.test(n)) return 'Reception';
  return isDrawingDoc(d) ? 'Whole building' : '';
}
LOAD_HOOKS.push(() => {
  // dropdown settings saved before drawings were split into types
  if (DOC_CATS.includes('Drawings')) DOC_CATS.splice(DOC_CATS.indexOf('Drawings'), 1, ...DRAWING_CATS.filter(c => !DOC_CATS.includes(c)));
  if (!DOC_CATS.includes('Other documents')) DOC_CATS.push('Other documents');
  DB.documents.forEach(d => {
    if (isMedia(d)) return;
    if (d.category === 'Drawings') d.category = /struct/i.test(d.name) ? 'Structural drawings' : /elev/i.test(d.name) ? 'Elevations' : /electr|ceiling/i.test(d.name) ? 'Electrical plans' : /plumb/i.test(d.name) ? 'Plumbing layouts' : /plan|layout/i.test(d.name) ? 'Floor plans' : 'Architectural drawings';
    if (!d.title) { const code = proj(d.project)?.code; d.title = d.name.replace(/\.\w+$/, '').replace(code ? new RegExp('^' + code.replace(/[-/]/g, '\\$&') + '\\s*') : /^$/, ''); }
    if (d.desc == null) d.desc = CAT_DESC[d.category] || '';
    if (d.area == null) d.area = guessArea(d);
    // every document keeps a version history, so nothing is ever replaced in place
    if (!d.versions) d.versions = [{ v: d.version || 1, date: d.date, at: tsOn(d.date, 11, 0), by: d.by, size: d.size, note: 'Initial upload', status: 'Approved', reviewedBy: d.by, reviewedAt: tsOn(d.date, 11, 0), reviewNote: '' }];
  });
  if (!DB.docCtl) {
    // sample: structural drawings and the completed project's drawings are issued as final
    DB.documents.filter(d => !isMedia(d) && !d.archived && (d.category === 'Structural drawings' || (proj(d.project)?.status === 'Completed' && isDrawingDoc(d)))).forEach(d => {
      const v = curVer(d); if (v?.status !== 'Approved') return;
      Object.assign(v, { status: 'Finalized', finalizedBy: proj(d.project).pm, finalizedAt: (v.reviewedAt || tsOn(v.date, 12, 0)) + 2 * 864e5, reviewNote: v.reviewNote || 'Issued for construction.' });
    });
    DB.docCtl = 1;
  }
});

/* ---------- what the site should use ---------- */
function siteUse(d) {
  const ap = approvedVer(d), cur = curVer(d);
  if (d.archived) return { tone: 'muted', icon: 'archive', text: 'Archived · not for site use' };
  if (!ap) return { tone: 'bad', icon: 'alert', text: cur?.status === 'Under Review' ? `v${cur.v} under review · not yet for site use` : cur?.status === 'Draft' ? `Draft v${cur.v} · not for site use` : 'Not approved for site use' };
  if (ap !== cur) return { tone: 'warn', icon: 'alert', text: `Use v${ap.v} · v${cur.v} is ${cur.status.toLowerCase()}` };
  return { tone: ap.status === 'Finalized' ? 'final' : 'ok', icon: 'check', text: `Use v${ap.v} · ${ap.status}` };
}
function verRole(d, v) {
  const ap = approvedVer(d), cur = curVer(d);
  if (v === ap && !d.archived) return ['inuse', 'In use on site'];
  if (v === cur && v.status !== 'Rejected') return ['new', 'Latest upload'];
  if (v.status === 'Superseded') return ['old', 'Old version'];
  if (v.status === 'Rejected') return ['rej', 'Rejected'];
  return ['', ''];
}
const WM = { Superseded: 'SUPERSEDED · DO NOT USE', 'Under Review': 'UNDER REVIEW · NOT FOR CONSTRUCTION', Draft: 'DRAFT · NOT FOR CONSTRUCTION', Rejected: 'REJECTED · DO NOT USE' };

/* ---------- cards and table ---------- */
docsGrid = function (list) {
  if (!list.length) return `<div class="card">${emptyPage('No documents here', 'Upload drawings, approvals and contracts to keep every version in one place.')}</div>`;
  return `<div class="dc-grid">${list.map(d => { const u = siteUse(d), cur = curVer(d);
    return `<button type="button" class="dc-card ${u.tone}" data-act="previewDoc" data-id="${d.id}">
      <div class="dc-th">${docThumb(d)}<span class="ext">${esc(d.ext.toUpperCase())}</span><span class="dc-v">v${cur?.v || d.version}</span></div>
      <div class="dc-b"><span class="dc-cat">${ico(catIco(d.category), 'sm')}${esc(d.category)}${d.area ? ` · ${esc(d.area)}` : ''}</span>
        <b class="dc-t" title="${esc(docTitle(d))}">${esc(docTitle(d))}</b>
        <span class="dc-f">${esc(proj(d.project)?.name || '')} · updated ${fmtD(d.date)}</span>
        <span class="dc-use ${u.tone}">${ico(u.icon, 'sm')}${u.text}</span></div></button>`; }).join('')}</div>`;
};
docsTable = function (list) {
  return `<div class="card"><div class="table-wrap"><table class="t stack-sm dc-table"><thead><tr><th>Document</th><th>Type · floor / area</th><th>Version</th><th>Status</th><th>For site use</th><th class="hide-sm">Updated</th></tr></thead><tbody>
    ${list.map(d => { const u = siteUse(d), cur = curVer(d); return `<tr class="click" data-act="previewDoc" data-id="${d.id}"><td class="full"><div class="person"><span class="ftype ${ftype(d.ext)[1]}">${esc(d.ext.toUpperCase().slice(0, 4))}</span><div class="nm"><b>${esc(docTitle(d))}</b><span>${esc(proj(d.project)?.name || '')} · ${esc(d.name)}</span></div></div></td>
      <td>${esc(d.category)}<span class="sub">${esc(d.area || '—')}</span></td><td class="strong">v${cur?.v || d.version}<span class="sub">${plural(vers(d).length, 'version')}</span></td><td>${badge(docStatus(d))}</td>
      <td><span class="dc-use ${u.tone} inline">${ico(u.icon, 'sm')}${u.text}</span></td><td class="nowrap hide-sm">${fmtD(d.date)}<span class="sub">${esc(userName(d.by))}</span></td></tr>`; }).join('') || emptyRow(6, 'No documents match')}
  </tbody></table></div></div>`;
};

/* ---------- Documents tab ---------- */
docsTab = function (base0) {
  const { cat = '', p = '', q = '', view = 'grid', sort = 'new', st = '', area = '' } = ROUTE.q;
  const base = base0.filter(d => (!p || d.project === p) && (st === 'Archived' ? d.archived : !d.archived));
  let list = base.filter(d => (!cat || (cat === '@drawings' ? isDrawingDoc(d) : d.category === cat)) && (!area || d.area === area)
    && (!st || st === 'Archived' || (st === '@notsite' ? !approvedVer(d) : st === '@pending' ? approvedVer(d) && approvedVer(d) !== curVer(d) : docStatus(d) === st))
    && (!q || `${docTitle(d)} ${d.name} ${d.desc || ''}`.toLowerCase().includes(q.toLowerCase())));
  list = list.sort((a, b) => sort === 'name' ? docTitle(a).localeCompare(docTitle(b)) : sort === 'type' ? a.category.localeCompare(b.category) || docTitle(a).localeCompare(docTitle(b)) : b.date.localeCompare(a.date));
  const shown = ROUTE.q.all ? list : list.slice(0, 24), live = base0.filter(d => !d.archived && (!p || d.project === p));
  const n = f => live.filter(f).length, cnt = c => base.filter(d => d.category === c).length;
  const chip = (v, l, num, icon) => `<button class="chip ${cat === v ? 'on' : ''}" data-act="setQ" data-k="cat" data-v="${v}">${icon ? ico(icon, 'sm') : ''}${l} <span class="n">${num}</span></button>`;
  const areas = [...new Set(base.map(d => d.area).filter(Boolean))].sort();
  const stat = (k, l, v, tone, hint) => `<button class="dc-stat ${tone} ${st === k ? 'on' : ''}" data-act="setQ" data-k="st" data-v="${st === k ? '' : k}"><b>${v}</b><span>${l}</span><small>${hint}</small></button>`;
  return `<div class="dc-stats">
      ${stat('Finalized', 'Finalized', n(d => docStatus(d) === 'Finalized'), 'final', 'issued for construction')}
      ${stat('Approved', 'Approved', n(d => docStatus(d) === 'Approved'), 'ok', 'approved, in use on site')}
      ${stat('@pending', 'Revision pending', n(d => approvedVer(d) && approvedVer(d) !== curVer(d)), 'warn', 'site keeps the older approved one')}
      ${stat('@notsite', 'Not for site use', n(d => !approvedVer(d)), 'bad', 'no approved version yet')}
      ${stat('Archived', 'Archived', base0.filter(d => d.archived && (!p || d.project === p)).length, 'muted', 'kept with full history')}</div>
    <div class="dc-types">
      <div class="chips">${chip('', 'All', base.length)}${chip('@drawings', 'All drawings', base.filter(isDrawingDoc).length, 'grid')}</div>
      <div class="chips"><span class="dc-tl">Drawings</span>${DRAWING_CATS.filter(c => docCats().includes(c)).map(c => chip(c, c, cnt(c), catIco(c))).join('')}</div>
      <div class="chips"><span class="dc-tl">Other</span>${docCats().filter(c => !DRAWING_CATS.includes(c)).map(c => chip(c, c, cnt(c), catIco(c))).join('')}</div></div>
    <div class="toolbar">
      <div class="inline-search">${ico('search', 'sm')}<input class="input" type="search" placeholder="Search documents" value="${esc(q)}" data-input="docQ" aria-label="Search documents"></div>
      ${projSelect(p)}
      <select class="select" data-change="setQ" data-k="area" aria-label="Floor or area"><option value="">All floors &amp; areas</option>${areas.map(a => `<option ${a === area ? 'selected' : ''}>${esc(a)}</option>`).join('')}</select>
      <select class="select" data-change="setQ" data-k="st" aria-label="Status"><option value="">All statuses</option>${DOC_STATUSES.map(x => `<option ${x === st ? 'selected' : ''}>${x}</option>`).join('')}</select>
      <select class="select" data-change="setQ" data-k="sort" aria-label="Sort"><option value="new" ${sort === 'new' ? 'selected' : ''}>Recently updated</option><option value="type" ${sort === 'type' ? 'selected' : ''}>By type</option><option value="name" ${sort === 'name' ? 'selected' : ''}>Title A–Z</option></select>
      <span class="grow"></span>
      <div class="seg" role="group" aria-label="View"><button class="${view === 'grid' ? 'on' : ''}" data-act="setQ" data-k="view" data-v="grid">${ico('grid', 'sm')}Cards</button><button class="${view === 'list' ? 'on' : ''}" data-act="setQ" data-k="view" data-v="list">${ico('rows', 'sm')}List</button></div>
    </div>
    <div class="dc-legend">${[['final', 'Finalized — issued for construction'], ['ok', 'Approved — use on site'], ['warn', 'Newer revision pending — keep using the approved one'], ['bad', 'Not approved — do not use on site']].map(([t, l]) => `<span><i class="${t}"></i>${l}</span>`).join('')}</div>
    <div class="muted" style="font-size:13px">${plural(list.length, 'document')}${cat ? ` · ${esc(cat === '@drawings' ? 'all drawings' : cat)}` : ''}${p ? ` · ${esc(proj(p).name)}` : ''}${area ? ` · ${esc(area)}` : ''}</div>
    ${view === 'list' ? docsTable(shown) : docsGrid(shown)}
    ${list.length > shown.length ? `<div style="text-align:center"><button class="btn" data-act="setQ" data-k="all" data-v="1">Show all ${list.length} documents</button></div>` : ''}`;
};

/* ---------- preview: file, details, site-use banner and version history ---------- */
previewDoc = function (id, vn) {
  const d = docById(id); if (!d || !docVisible(d)) return;
  if (isMedia(d)) return openMedia(id);
  VIEWER = null;
  const cur = curVer(d), v = vers(d).find(x => x.v === +vn) || cur, ap = approvedVer(d), [kind] = ftype(d.ext), p = proj(d.project);
  const editor = can('documents'), reviewer = isReviewer(d), viewingIssued = v === ap && !d.archived;
  const banner = d.archived ? `<div class="dc-banner muted">${ico('archive')}<div><b>Archived${d.archivedAt ? ` ${fmtDY(iso(new Date(d.archivedAt)))}` : ''}${d.archivedBy ? ` by ${esc(userName(d.archivedBy))}` : ''}</b><span>Not for site use. Every version is kept; restore it to make changes.</span></div></div>`
    : viewingIssued ? `<div class="dc-banner ${ap.status === 'Finalized' ? 'final' : 'ok'}">${ico('check')}<div><b>Use this version on site — v${ap.v} · ${ap.status}</b><span>${ap.status === 'Finalized' ? `Issued for construction${ap.finalizedAt ? ` ${fmtDY(iso(new Date(ap.finalizedAt)))}` : ''}${ap.finalizedBy ? ` by ${esc(userName(ap.finalizedBy))}` : ''}` : `Approved${ap.reviewedAt ? ` ${fmtDY(iso(new Date(ap.reviewedAt)))}` : ''}${ap.reviewedBy ? ` by ${esc(userName(ap.reviewedBy))}` : ''}`}${cur !== ap ? ` · a newer v${cur.v} is ${esc(cur.status.toLowerCase())} and is not for use yet` : ''}</span></div></div>`
    : ap ? `<div class="dc-banner bad">${ico('alert')}<div><b>Do not use v${v.v} on site — it is ${esc(v.status.toLowerCase())}</b><span>The site works from <b>v${ap.v} (${esc(ap.status)})</b>${ap.reviewedAt ? `, approved ${fmtDY(iso(new Date(ap.reviewedAt)))}` : ''}.</span></div><button type="button" class="btn sm" data-act="docVer" data-id="${d.id}" data-v="${ap.v}">${ico('eye', 'sm')}Open v${ap.v}</button></div>`
    : `<div class="dc-banner bad">${ico('alert')}<div><b>Not approved for site use</b><span>No version of this document has been approved yet.</span></div></div>`;
  const row = (k, val) => `<div><dt>${k}</dt><dd>${val || '<span class="muted">—</span>'}</dd></div>`;
  openModal({ title: docTitle(d), sub: `${esc(p?.name)} · ${esc(d.category)}${d.area ? ` · ${esc(d.area)}` : ''}`, wide: true, body: `${banner}
    <div class="dc-view">
      <div class="dc-prev"><div class="preview-stage">${verBody(d, v)}</div>${!viewingIssued && WM[v.status] ? `<div class="dc-wm" aria-hidden="true"><span>${WM[v.status]}</span></div>` : ''}
        <div class="dc-prev-cap">${ico('eye', 'sm')}Viewing <b>v${v.v}</b> ${badge(v.status)}${verRole(d, v)[1] ? `<span class="dc-role ${verRole(d, v)[0]}">${verRole(d, v)[1]}</span>` : ''}</div></div>
      <aside class="dc-info">
        <div class="dc-desc"><h4>Description</h4><p>${esc(d.desc || '—')}</p></div>
        <dl class="dl c1">${row('Type', `${ico(catIco(d.category), 'sm')} ${esc(d.category)}`)}${row('Floor / area', esc(d.area))}${row('Version', `<b>v${v.v}</b> of ${vers(d).length}${v === cur ? ' · latest upload' : ''}`)}
          ${row('Uploaded', `${esc(userName(v.by))}<span class="sub">${v.at ? fmtTs(v.at) : fmtDY(v.date)}</span>`)}${row('Revision date', fmtDY(v.date))}${row('File', `${esc(d.name)}<span class="sub">${esc(kind)} · ${fmtSize(v.size || d.size)}</span>`)}</dl>
        ${v.note ? `<div class="dc-note">${ico('edit', 'sm')}<div><b>Revision note</b><p>${esc(v.note)}</p></div></div>` : ''}
        ${v.reviewNote ? `<div class="dc-note ${v.status === 'Rejected' ? 'bad' : 'ok'}">${ico(v.status === 'Rejected' ? 'x' : 'check', 'sm')}<div><b>Review · ${esc(userName(v.reviewedBy))}</b><p>${esc(v.reviewNote)}</p></div></div>` : ''}
        ${v.status === 'Under Review' && reviewer && !d.archived ? `<div class="review-box"><b>${ico('shield', 'sm')}Review version ${v.v}</b><textarea id="revNote" rows="2" placeholder="Comments for the uploader (required to reject)"></textarea>
          <div class="row-acts"><button type="button" class="btn sm danger" data-act="docReject" data-id="${d.id}" data-v="${v.v}">${ico('x', 'sm')}Reject</button><button type="button" class="btn sm primary" data-act="docApprove" data-id="${d.id}" data-v="${v.v}">${ico('check', 'sm')}Approve v${v.v}</button></div></div>` : ''}
      </aside></div>
    <div class="dc-hist"><div class="split"><h3>Version history <span class="muted" style="font-weight:400;font-size:13px">· ${plural(vers(d).length, 'version')}, all kept</span></h3>${vers(d).length > 1 ? `<button type="button" class="btn xs" data-act="docCompare" data-id="${d.id}">${ico('compare', 'sm')}Compare</button>` : ''}</div>
      <ol class="dc-vl">${vers(d).slice().reverse().map(x => { const [rc, rl] = verRole(d, x); return `<li class="${rc} ${x === v ? 'sel' : ''}">
        <span class="dc-vn">v${x.v}</span><div class="dc-vm"><div class="dc-vh">${badge(x.status)}${rl ? `<span class="dc-role ${rc}">${rl}</span>` : ''}</div><p>${esc(x.note || '—')}</p><small>${fmtDY(x.date)} · ${esc(userName(x.by))}${x.reviewedBy && x.status !== 'Under Review' ? ` · reviewed by ${esc(userName(x.reviewedBy))}` : ''}</small></div>
        <div class="row-acts">${x !== v ? `<button type="button" class="btn xs" data-act="docVer" data-id="${d.id}" data-v="${x.v}">${ico('eye', 'sm')}View</button>` : '<span class="dc-viewing">Viewing</span>'}<button type="button" class="iconbtn" data-act="downloadVer" data-id="${d.id}" data-v="${x.v}" aria-label="Download v${x.v}" title="Download v${x.v}">${ico('download', 'sm')}</button></div></li>`; }).join('')}</ol></div>`,
    foot: `${editor ? (d.archived ? `<button type="button" class="btn left" data-act="docArchive" data-id="${d.id}">${ico('refresh', 'sm')}Restore</button>` : `<button type="button" class="btn ghost danger left" data-act="docArchive" data-id="${d.id}">${ico('archive', 'sm')}Archive</button>`) : ''}
      ${editor && !d.archived ? `<button type="button" class="btn" data-act="docEdit" data-id="${d.id}">${ico('edit', 'sm')}Edit details</button>` : ''}
      ${editor && !d.archived && cur.status === 'Draft' && cur.by === SESSION ? `<button type="button" class="btn" data-act="docSubmit" data-id="${d.id}">${ico('send', 'sm')}Submit for review</button>` : ''}
      ${reviewer && !d.archived && ap && ap.status === 'Approved' && v === ap ? `<button type="button" class="btn" data-act="docFinalize" data-id="${d.id}">${ico('star', 'sm')}Mark as final</button>` : ''}
      ${editor && !d.archived ? `<button type="button" class="btn" data-act="docRevise" data-id="${d.id}">${ico('upload', 'sm')}Upload revision</button>` : ''}
      <button type="button" class="btn primary" data-act="downloadVer" data-id="${d.id}" data-v="${v.v}">${ico('download', 'sm')}Download v${v.v}</button>` });
};

// downloading a version that is not the one in use asks first
const _downloadVer = ACT.downloadVer;
ACT.downloadVer = el => {
  const d = docById(el.dataset.id), v = vers(d).find(x => x.v === +el.dataset.v) || curVer(d), ap = approvedVer(d);
  if (v === ap || d.archived || el.dataset.ok) { _downloadVer(el); return; }
  confirmBox(`Download v${v.v}? It is not for site use`, `v${v.v} is <b>${esc(v.status.toLowerCase())}</b>.${ap ? ` The site works from <b>v${ap.v}</b>.` : ' No version has been approved yet.'} Download it only for reference.`, `Download v${v.v} anyway`, () => { _downloadVer({ dataset: { id: d.id, v: v.v, ok: 1 } }); setTimeout(() => previewDoc(d.id, v.v), 40); });
};
ACT.docFinalize = el => {
  const d = docById(el.dataset.id), v = approvedVer(d), p = proj(d.project);
  if (!guard(isReviewer(d), 'finalize documents')) return;
  confirmBox(`Mark v${v.v} as final?`, `<b>${esc(docTitle(d))}</b> v${v.v} becomes the <b>finalized</b> version, issued for construction. ${esc(userName(p.engineer))} and ${esc(userName(p.supervisor))} are told to build from it. A later revision can still be uploaded; it will go through review again.`, 'Mark as final', () => {
    Object.assign(v, { status: 'Finalized', finalizedBy: SESSION, finalizedAt: Date.now() });
    notify([p.engineer, p.supervisor, p.pm], `Final ${isDrawingDoc(d) ? 'drawing' : 'document'} issued: ${docTitle(d)} v${v.v} · ${p.name} — build from this version`, `#/documents?d=${d.id}`, 'doc');
    logAct(`finalized ${docTitle(d)} v${v.v}`, d.project, 'doc'); saveDB(); renderView(); renderShell(); setTimeout(() => previewDoc(d.id), 40); toast(`v${v.v} finalized — site team notified`);
  });
};

/* ---------- upload and edit details ---------- */
const areaOpts = (pid, cur) => { const xs = ['Whole building', ...projLevels(proj(pid)).map(l => l.name), 'Site & external works', 'Not applicable']; if (cur && !xs.includes(cur)) xs.unshift(cur); return xs; };
function docForm(d, pid, isNew) {
  const cat = d.category || (DRAWING_CATS.includes(ROUTE.q.cat) ? ROUTE.q.cat : 'Floor plans');
  return `<div class="form dc-form">
    ${isNew ? `<div class="row2">${fld('Project', 'project', { opts: projOpts(myProjects()), value: pid, req: true })}${fld('Document type', 'category', { opts: docCats(), value: cat, req: true })}</div>` : fld('Document type', 'category', { opts: docCats(), value: cat, req: true })}
    ${fld('Title', 'title', { value: d.title || '', req: true, ph: 'e.g. Ground floor plan – Block A', hint: 'A clear name the site team will recognise' })}
    <div class="row${isNew ? 3 : 2}"><label class="field"><span>Floor / area</span><select class="select" name="area" id="dcArea">${areaOpts(pid, d.area).map(a => `<option ${a === (d.area || (DRAWING_CATS.includes(cat) ? 'Whole building' : 'Not applicable')) ? 'selected' : ''}>${esc(a)}</option>`).join('')}</select></label>
      ${isNew ? `<div class="field"><span>Version</span><div class="dc-auto"><b>v1</b><small>Set automatically · each revision adds the next number</small></div></div>${fld('Upload date', 'date', { type: 'date', value: TODAY, req: true })}` : ''}</div>
    ${fld('Description', 'desc', { type: 'textarea', rows: 3, req: true, value: d.desc || '', ph: 'What this document shows and what it is used for' })}
    ${isNew ? `<div class="field"><span>File</span><div class="dropzone" data-act="pickPhotos">${ico('upload', 'lg')}<div style="margin-top:6px"><b>Choose the file</b> or drag and drop</div><small>PDF, DWG, JPG, XLSX, DOCX · optional in this demo — without a file a sample is generated</small><input type="file" id="dcFile" hidden></div><ul class="picked" id="dcPicked"></ul></div>
      <div id="dcNext"></div>` : ''}</div>`;
}
const nextBox = cat => needsReview(cat) ? fld('After upload', 'next', { opts: [['review', 'Submit for review — approvers are notified'], ['draft', 'Save as draft']] }) : `<div class="form-note">${ico('check', 'sm')}<span>${esc(cat)} are filed as approved straight away.</span></div>`;
const _upload = ACT.upload;
ACT.upload = el => {
  const kind = el.dataset.kind || (ROUTE.q.tab === 'media' ? 'media' : 'doc');
  if (kind === 'media') return _upload(el);
  if (!guard(can('documents'), 'upload documents')) return;
  const pid = el.dataset.p || ROUTE.q.p || myProjects()[0]?.id;
  openModal({ title: 'Upload a document', sub: 'Give it a clear title, type and description so everyone picks the right file.', wide: true, body: docForm({ category: el.dataset.cat }, pid, true),
    foot: `<button type="button" class="btn" data-act="closeModal">Cancel</button><button type="submit" class="btn primary">${ico('upload', 'sm')}Upload</button>`,
    onOpen: m => {
      const inp = $('#dcFile', m), cat = $('[name=category]', m), pj = $('[name=project]', m), title = $('[name=title]', m);
      const next = () => $('#dcNext', m).innerHTML = nextBox(cat.value); next(); cat.addEventListener('change', next);
      pj.addEventListener('change', () => $('#dcArea', m).innerHTML = areaOpts(pj.value).map(a => `<option ${a === (DRAWING_CATS.includes(cat.value) ? 'Whole building' : 'Not applicable') ? 'selected' : ''}>${esc(a)}</option>`).join(''));
      inp.addEventListener('change', () => { const f = inp.files[0]; if (!f) return; $('#dcPicked').innerHTML = `<li><span class="ftype ${ftype(f.name.split('.').pop().toLowerCase())[1]}">${esc(f.name.split('.').pop().toUpperCase().slice(0, 4))}</span><span>${esc(f.name)}</span><small class="muted">${fmtSize(f.size)}</small></li>`; if (!title.value.trim()) title.value = f.name.replace(/\.\w+$/, '').replace(/[_]+/g, ' '); });
      bindDrop($('.dropzone', m), inp);
    },
    onSubmit: (x, form) => {
      const p = proj(x.project), f = $('#dcFile').files[0], vn = 1;
      if (x.date > TODAY) { fieldErr(form, 'date', 'The upload date cannot be in the future'); return false; }
      const dup = DB.documents.find(d => d.project === p.id && !d.archived && !isMedia(d) && docTitle(d).trim().toLowerCase() === x.title.trim().toLowerCase());
      if (dup) { fieldErr(form, 'title', `“${docTitle(dup)}” already exists in this project. Open it and use Upload revision, so its history stays together.`); return false; }
      const review = needsReview(x.category), status = review ? (x.next === 'draft' ? 'Draft' : 'Under Review') : 'Approved';
      const ext = f ? (f.name.split('.').pop() || 'file').toLowerCase() : 'pdf', id = nid('d'), size = f ? f.size : 600 * 1024 + Math.round(Math.random() * 900 * 1024);
      const d = { id, project: p.id, name: f ? f.name : `${x.title}.pdf`, title: x.title.trim(), desc: x.desc, area: x.area === 'Not applicable' ? '' : x.area, category: x.category, ext, size, date: x.date, by: SESSION, version: vn,
        uploaded: !!f, art: f ? null : CAT_ART[x.category] || 'doc',
        versions: [{ v: vn, date: x.date, at: Date.now(), by: SESSION, size, note: 'Initial upload', status, reviewedBy: review ? null : SESSION, reviewedAt: review ? null : Date.now(), reviewNote: '', uploaded: !!f }] };
      if (f) { const url = URL.createObjectURL(f); BLOBS.set(id, url); BLOBS.set(`${id}@v${vn}`, url); }
      DB.documents.unshift(d);
      if (status === 'Under Review') notify(reviewersOf(d), `New ${isDrawingDoc(d) ? 'drawing' : 'document'} for review: ${d.title} v${vn} · ${p.name}`, '#/documents?tab=review', 'doc');
      logAct(`uploaded ${d.title} v${vn}${status === 'Draft' ? ' as a draft' : status === 'Under Review' ? ' for review' : ''}`, p.id, 'doc');
      saveDB(); renderView(); renderShell(); setTimeout(() => previewDoc(id), 40);
      toast(status === 'Under Review' ? 'Uploaded and sent for review' : status === 'Draft' ? 'Saved as a draft' : 'Uploaded');
    } });
};
ACT.docEdit = el => {
  const d = docById(el.dataset.id); if (!guard(can('documents'), 'edit documents')) return;
  openModal({ title: 'Edit document details', sub: `${esc(proj(d.project).name)} · versions and files are not changed`, body: docForm(d, d.project, false),
    onSubmit: (x, form) => {
      const dup = DB.documents.find(o => o !== d && o.project === d.project && !o.archived && !isMedia(o) && docTitle(o).trim().toLowerCase() === x.title.trim().toLowerCase());
      if (dup) { fieldErr(form, 'title', 'Another document in this project already has this title'); return false; }
      Object.assign(d, { title: x.title.trim(), category: x.category, area: x.area === 'Not applicable' ? '' : x.area, desc: x.desc });
      logAct(`updated the details of ${d.title}`, d.project, 'doc'); saveDB(); renderView(); setTimeout(() => previewDoc(d.id), 40); toast('Details updated');
    } });
};

/* ---------- project page › Documents: grouped by category, newest first ---------- */
function projectDocsTab(p, docs) {
  const arch = ROUTE.q.arch === '1', pool = docs.filter(d => arch || !d.archived);
  const cats = docCats().filter(c => docs.some(d => d.category === c) || DRAWING_CATS.includes(c));
  const open = cats.includes(ROUTE.q.dcat) ? ROUTE.q.dcat : cats.find(c => pool.some(d => d.category === c)) || cats[0];
  const list = pool.filter(d => d.category === open).sort((a, b) => b.date.localeCompare(a.date) || (curVer(b)?.at || 0) - (curVer(a)?.at || 0));
  const nArch = docs.filter(d => d.archived).length;
  const navItem = c => { const xs = pool.filter(d => d.category === c), fin = xs.filter(d => docStatus(d) === 'Finalized').length, bad = xs.filter(d => !d.archived && !approvedVer(d)).length;
    return `<button class="pd-cat ${c === open ? 'on' : ''}" data-act="setQ" data-k="dcat" data-v="${esc(c)}" ${c === open ? 'aria-current="true"' : ''}>${ico(catIco(c), 'sm')}<span>${esc(c)}</span>${fin ? `<i class="pd-dot final" title="${fin} finalized"></i>` : ''}${bad ? `<i class="pd-dot bad" title="${bad} not approved for site use"></i>` : ''}<b>${xs.length}</b></button>`; };
  const row = d => {
    const cur = curVer(d), ap = approvedVer(d), u = siteUse(d), fin = vers(d).slice().reverse().find(v => v.status === 'Finalized'), older = vers(d).filter(v => v !== cur).reverse();
    return `<li class="pd-row ${u.tone}">
      <button type="button" class="pd-main" data-act="previewDoc" data-id="${d.id}" aria-label="Preview ${esc(docTitle(d))}">
        <span class="pd-th">${docThumb(d)}</span>
        <div class="pd-txt"><b>${esc(docTitle(d))}</b>
          <div class="pd-meta"><span class="pd-ver">v${cur.v}</span>${badge(docStatus(d))}${d.area ? `<span>${ico('pin', 'sm')}${esc(d.area)}</span>` : ''}<span>${ico('cal', 'sm')}${fmtDY(cur.date)}</span><span class="pd-by">${av(userName(cur.by), 'sm')}${esc(userName(cur.by))}</span></div>
          <span class="dc-use ${u.tone} inline">${ico(u.icon, 'sm')}${fin && ap === fin ? `Latest final: v${fin.v}${cur !== fin ? ` · v${cur.v} ${esc(cur.status.toLowerCase())}` : ''}` : u.text}</span></div></button>
      <div class="pd-acts"><button class="btn sm" data-act="previewDoc" data-id="${d.id}">${ico('eye', 'sm')}Preview</button>
        <button class="btn sm ${ap ? 'primary' : ''}" data-act="downloadVer" data-id="${d.id}" data-v="${(ap || cur).v}" title="${ap ? `Download the version in use (v${ap.v})` : `Download v${cur.v} (not approved)`}">${ico('download', 'sm')}Download v${(ap || cur).v}</button></div>
      ${older.length ? `<details class="pd-old"><summary>${ico('history', 'sm')}${plural(older.length, 'earlier version')}</summary><ol>${older.map(v => `<li class="${v === ap ? 'inuse' : ''}"><span class="pd-ver">v${v.v}</span>${badge(v.status)}${v === ap ? '<span class="dc-role inuse">In use on site</span>' : ''}<span class="pd-note">${esc(v.note || '—')}</span><span class="muted">${fmtDY(v.date)} · ${esc(userName(v.by))}</span>
        <span class="row-acts"><button class="btn xs" data-act="docVer" data-id="${d.id}" data-v="${v.v}">${ico('eye', 'sm')}View</button><button class="iconbtn" data-act="downloadVer" data-id="${d.id}" data-v="${v.v}" aria-label="Download v${v.v}">${ico('download', 'sm')}</button></span></li>`).join('')}</ol></details>` : ''}</li>`;
  };
  return `<div class="pd">
    <nav class="pd-nav" aria-label="Document categories">
      <div class="pd-gl">Drawings</div>${cats.filter(c => DRAWING_CATS.includes(c)).map(navItem).join('')}
      <div class="pd-gl">Other documents</div>${cats.filter(c => !DRAWING_CATS.includes(c)).map(navItem).join('')}
      ${nArch ? `<label class="check pd-arch"><input type="checkbox" data-change="archToggle" ${arch ? 'checked' : ''}> Show archived (${nArch})</label>` : ''}
    </nav>
    <section class="card pd-panel">
      <div class="pd-head"><span class="pd-hic">${ico(catIco(open), 'sm')}</span><div><h2>${esc(open)}</h2><p>${plural(list.length, 'document')} · newest upload first${list.some(d => docStatus(d) === 'Finalized') ? ` · ${list.filter(d => docStatus(d) === 'Finalized').length} finalized` : ''}</p></div>
        <span class="grow"></span>${can('documents') ? btn('Upload', 'upload', { icon: 'upload', cls: 'sm primary', data: `data-p="${p.id}" data-kind="doc" data-cat="${esc(open)}"` }) : ''}</div>
      ${list.length ? `<ul class="pd-list">${list.map(row).join('')}</ul>` : `<div class="pd-empty">${ico(catIco(open))}<b>No ${esc(open.toLowerCase())} yet</b><span>${can('documents') ? 'Upload the first one with the button above.' : 'Nothing has been uploaded in this category.'}</span></div>`}
    </section></div>`;
}
CHANGE.archToggle = el => setQ({ arch: el.checked ? '1' : '' });
