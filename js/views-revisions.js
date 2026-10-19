/* Document control: every project document keeps its version history. A version is Draft, Under Review, Approved,
   Rejected or Superseded; a document can be Archived without losing its history. The latest approved version is
   what the site works from — revised plans go through review, and the site team is notified when one is approved. */
'use strict';

const DOC_STATUSES = ['Draft', 'Under Review', 'Approved', 'Finalized', 'Rejected', 'Superseded', 'Archived'];
const ISSUED = ['Approved', 'Finalized'];
const vers = d => d.versions || [];
const curVer = d => vers(d)[vers(d).length - 1];
// the version the site works from: the latest Approved or Finalized one
const approvedVer = d => vers(d).slice().reverse().find(v => ISSUED.includes(v.status));
const docStatus = d => d.archived ? 'Archived' : curVer(d)?.status || 'Approved';
const isReviewer = d => can2('Approve documents & plans') && (['owner', 'sysadmin'].includes(role()) || proj(d.project)?.pm === SESSION);
const reviewersOf = d => [...usersWithRole('owner'), proj(d.project)?.pm].filter(Boolean);
const verBlob = (d, v) => BLOBS.get(`${d.id}@v${v.v}`) || (v === curVer(d) ? BLOBS.get(d.id) : null);
const docQueue = () => DB.documents.filter(d => myProjectIds().has(d.project) && !isMedia(d) && !d.archived && docStatus(d) === 'Under Review');
NAV_COUNT_HOOKS.push(() => ({ documents: DB.documents.filter(d => !isMedia(d) && !d.archived && docStatus(d) === 'Under Review' && isReviewer(d)).length || 0 }));

// version-specific artwork: later revisions carry a revision cloud and a revision tag
function verArt(d, v) {
  const base = artSvg(d);
  if (!v || v.v <= 1) return base;
  const k = v.v, cx = 120 + (k * 67) % 180, cy = 90 + (k * 41) % 120;
  const mark = `<g><ellipse cx="${cx}" cy="${cy}" rx="58" ry="40" fill="none" stroke="#D42B2A" stroke-width="2.4" stroke-dasharray="9 5"/><path d="M${cx + 42} ${cy - 30}l14-14" stroke="#D42B2A" stroke-width="2"/><g transform="translate(${cx + 56} ${cy - 54})"><path d="M0 14 12 -4 24 14z" fill="#D42B2A"/><text x="12" y="11" fill="#fff" font-family="Inter,sans-serif" font-size="10" font-weight="700" text-anchor="middle">${k - 1}</text></g></g>
    <g><rect x="296" y="12" width="92" height="24" rx="5" fill="#17191D"/><text x="342" y="28" fill="#fff" font-family="Inter,sans-serif" font-size="11.5" font-weight="700" text-anchor="middle">REV ${k - 1} · v${k}</text></g>`;
  return base.replace(/<\/svg>$/, mark + '</svg>');
}
function verBody(d, v) {
  const blob = verBlob(d, v), [, cls] = ftype(d.ext);
  if (blob && cls === 'img') return `<img src="${blob}" alt="${esc(d.name)}">`;
  if (blob && d.ext === 'pdf') return `<iframe src="${blob}" title="${esc(d.name)}" style="width:100%;height:56vh;border:0"></iframe>`;
  if (blob) return `<div class="empty-state">${ico('file')}<b>Preview not available</b>Download the file to open it.</div>`;
  if (d.art && !['doc', 'sheet'].includes(d.art)) return verArt(d, v);
  if (v.uploaded) return `<div class="empty-state">${ico('file')}<b>Original not stored</b>Files uploaded in this demo are kept only until the page is reloaded.</div>`;
  return previewBody(d);
}

/* ---------- preview with history, review and revision actions ---------- */
const _previewDoc = previewDoc;
previewDoc = function (id, vn) {
  const d = docById(id); if (!d || !docVisible(d)) return;
  if (isMedia(d) || !vers(d).length) return _previewDoc(id);
  VIEWER = null;
  const cur = curVer(d), v = vers(d).find(x => x.v === +vn) || cur, ap = approvedVer(d), st = docStatus(d), [kind] = ftype(d.ext);
  const editor = can('documents'), reviewer = isReviewer(d);
  const callout = d.archived ? `<div class="banner">${ico('archive')}<span>Archived ${d.archivedAt ? fmtTs(d.archivedAt) : ''}${d.archivedBy ? ` by ${esc(userName(d.archivedBy))}` : ''}. History is kept; restore it to make changes.</span></div>`
    : ap && ap !== cur ? `<div class="banner warn">${ico('alert')}<span>Version ${cur.v} is <b>${esc(cur.status.toLowerCase())}</b>. The site keeps working from the <b>latest approved version, v${ap.v}</b> (${fmtDY(ap.date)}).</span>${v !== ap ? `<button type="button" class="btn sm" data-act="docVer" data-id="${d.id}" data-v="${ap.v}">View v${ap.v}</button>` : ''}</div>`
    : !ap ? `<div class="banner warn">${ico('alert')}<span>No approved version yet — this document is not issued for use on site.</span></div>`
    : `<div class="banner ok">${ico('check')}<span><b>Latest approved${isDrawingDoc(d) ? ' plan' : ''}: v${ap.v}</b> · approved ${ap.reviewedAt ? fmtTs(ap.reviewedAt) : fmtDY(ap.date)}${ap.reviewedBy ? ` by ${esc(userName(ap.reviewedBy))}` : ''}</span></div>`;
  openModal({ title: d.name, sub: `${esc(proj(d.project)?.name)} · ${esc(d.category)} · ${badge(st)}`, wide: true, body: `${callout}
    <div class="ver-view"><div class="ver-tag">Viewing v${v.v} ${badge(v.status)}${v === ap ? '<span class="tag">Latest approved</span>' : ''}</div><div class="preview-stage">${verBody(d, v)}</div></div>
    <dl class="dl c3" style="margin-top:18px"><div><dt>Type</dt><dd>${esc(kind)} · ${d.ext.toUpperCase()}</dd></div><div><dt>Version</dt><dd>v${v.v} of ${vers(d).length}</dd></div><div><dt>Size</dt><dd>${fmtSize(v.size || d.size)}</dd></div>
      <div><dt>Uploaded by</dt><dd>${esc(userName(v.by))}</dd></div><div><dt>Uploaded</dt><dd>${v.at ? fmtTs(v.at) : fmtDY(v.date)}</dd></div><div><dt>Revision date</dt><dd>${fmtDY(v.date)}</dd></div></dl>
    ${v.note ? `<div class="form-note" style="margin-top:14px">${ico('edit', 'sm')}<span><b>Change description:</b> ${esc(v.note)}</span></div>` : ''}
    ${v.reviewNote ? `<div class="form-note" style="margin-top:10px">${ico(v.status === 'Rejected' ? 'x' : 'check', 'sm')}<span><b>Review by ${esc(userName(v.reviewedBy))}:</b> ${esc(v.reviewNote)}</span></div>` : ''}
    ${v.status === 'Under Review' && reviewer && !d.archived ? `<div class="review-box"><b>${ico('shield', 'sm')}Review version ${v.v}</b><textarea id="revNote" rows="2" placeholder="Comments for the uploader (required to reject)"></textarea>
      <div class="row-acts"><button type="button" class="btn sm danger" data-act="docReject" data-id="${d.id}" data-v="${v.v}">${ico('x', 'sm')}Reject</button><button type="button" class="btn sm primary" data-act="docApprove" data-id="${d.id}" data-v="${v.v}">${ico('check', 'sm')}Approve v${v.v}</button></div></div>` : ''}
    <div style="margin-top:22px"><div class="split" style="margin-bottom:8px"><h3>Version history</h3>${vers(d).length > 1 ? `<button type="button" class="btn xs" data-act="docCompare" data-id="${d.id}">${ico('compare', 'sm')}Compare revisions</button>` : ''}</div>
      <div class="table-wrap"><table class="t stack-sm vtable"><thead><tr><th>Version</th><th>Change</th><th>Uploaded</th><th>Status</th><th class="r"></th></tr></thead><tbody>
      ${vers(d).slice().reverse().map(x => `<tr class="${x === v ? 'sel' : ''}"><td class="strong">v${x.v}${x === ap ? '<span class="sub" style="color:var(--ok)">Latest approved</span>' : ''}</td><td class="full" style="white-space:normal">${esc(x.note || '—')}</td><td class="nowrap hide-sm">${fmtDY(x.date)}<span class="sub">${esc(userName(x.by))}${x.at ? ' · ' + fmtT(x.at) : ''}</span></td><td>${badge(x.status)}</td>
        <td class="r"><div class="row-acts">${x !== v ? `<button type="button" class="btn xs" data-act="docVer" data-id="${d.id}" data-v="${x.v}">${ico('eye', 'sm')}View</button>` : ''}<button type="button" class="iconbtn" data-act="downloadVer" data-id="${d.id}" data-v="${x.v}" aria-label="Download v${x.v}" title="Download v${x.v}">${ico('download', 'sm')}</button></div></td></tr>`).join('')}
      </tbody></table></div></div>`,
    foot: `${editor ? (d.archived ? `<button type="button" class="btn left" data-act="docArchive" data-id="${d.id}">${ico('refresh', 'sm')}Restore</button>` : `<button type="button" class="btn ghost danger left" data-act="docArchive" data-id="${d.id}">${ico('archive', 'sm')}Archive</button>`) : ''}
      ${editor && !d.archived && cur.status === 'Draft' && cur.by === SESSION ? `<button type="button" class="btn" data-act="docSubmit" data-id="${d.id}">${ico('send', 'sm')}Submit for review</button>` : ''}
      ${editor && !d.archived ? `<button type="button" class="btn" data-act="docRevise" data-id="${d.id}">${ico('upload', 'sm')}Upload revision</button>` : ''}
      <button type="button" class="btn primary" data-act="downloadVer" data-id="${d.id}" data-v="${v.v}">${ico('download', 'sm')}Download v${v.v}</button>` });
};
ACT.docVer = el => previewDoc(el.dataset.id, el.dataset.v);

ACT.downloadVer = el => {
  const d = docById(el.dataset.id), v = vers(d).find(x => x.v === +el.dataset.v) || curVer(d), blob = verBlob(d, v);
  const a = document.createElement('a'), stem = d.name.replace(/\.\w+$/, '');
  if (blob) { a.href = blob; a.download = `${stem} v${v.v}.${d.ext}`; a.click(); toast(`Downloading v${v.v}`); return; }
  let file, name;
  if (d.art && !['doc', 'sheet'].includes(d.art)) { file = new Blob([verArt(d, v).replace('class="art" ', '')], { type: 'image/svg+xml' }); name = `${stem} v${v.v} (demo preview).svg`; }
  else { const p = proj(d.project); file = new Blob([`Scale Space Builders\n${d.name} — version ${v.v} (${v.status})\n\nProject: ${p.name} (${p.code})\nRevision date: ${fmtDY(v.date)}\nUploaded by: ${userName(v.by)}\nChange: ${v.note || '—'}\n\nThis is a placeholder file generated by the demo.`], { type: 'text/plain' }); name = `${stem} v${v.v} (demo).txt`; }
  a.href = URL.createObjectURL(file); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  toast(`Sample file for v${v.v} downloaded`);
};

function reviewDoc(d, vn, ok) {
  const v = vers(d).find(x => x.v === +vn), note = ($('#revNote')?.value || '').trim();
  if (!guard(isReviewer(d), 'approve documents')) return;
  if (!ok && !note) { $('#revNote')?.focus(); toast('Add a comment explaining why it is rejected', 'lock'); return; }
  const p = proj(d.project);
  const apply = () => {
    if (ok) vers(d).forEach(x => { if (ISSUED.includes(x.status) && x !== v) x.status = 'Superseded'; });
    Object.assign(v, { status: ok ? 'Approved' : 'Rejected', reviewedBy: SESSION, reviewedAt: Date.now(), reviewNote: note || (ok ? 'Approved for construction.' : '') });
    if (ok) notify([v.by, p.engineer, p.supervisor, p.pm], `Updated ${isDrawingDoc(d) ? 'plan' : 'document'} approved: ${d.name} v${v.v} · ${p.name} — use this version on site`, `#/documents?d=${d.id}`, 'doc');
    else notify([v.by], `${d.name} v${v.v} was rejected: ${note}`, `#/documents?d=${d.id}`, 'doc');
    logAct(`${ok ? 'approved' : 'rejected'} ${d.name} v${v.v}`, d.project, 'doc');
    saveDB(); renderView(); renderShell(); setTimeout(() => previewDoc(d.id, v.v), 40);
    toast(ok ? `v${v.v} approved — now the latest approved version. Site team notified.` : `v${v.v} rejected — ${userName(v.by)} notified`);
  };
  if (ok) { const prev = approvedVer(d); confirmBox(`Approve version ${v.v}?`, `<b>${esc(d.name)}</b> v${v.v} becomes the latest approved version${prev ? ` and v${prev.v} is marked <b>Superseded</b>` : ''}. ${esc(userName(p.engineer))} and ${esc(userName(p.supervisor))} will be notified to use it on site.`, 'Approve', apply); }
  else apply();
}
ACT.docApprove = el => reviewDoc(docById(el.dataset.id), el.dataset.v, true);
ACT.docReject = el => reviewDoc(docById(el.dataset.id), el.dataset.v, false);
ACT.docSubmit = el => { const d = docById(el.dataset.id), v = curVer(d); v.status = 'Under Review'; v.at = Date.now(); notify(reviewersOf(d), `Document submitted for review: ${d.name} v${v.v} · ${proj(d.project).name}`, '#/documents?tab=review', 'doc'); logAct(`submitted ${d.name} v${v.v} for review`, d.project, 'doc'); saveDB(); renderView(); previewDoc(d.id); toast('Submitted for review — approvers notified'); };
ACT.docArchive = el => {
  const d = docById(el.dataset.id);
  if (!guard(can('documents'), 'archive documents')) return;
  if (d.archived) { d.archived = false; logAct(`restored ${d.name} from the archive`, d.project, 'doc'); saveDB(); renderView(); previewDoc(d.id); toast('Restored from the archive'); return; }
  confirmBox('Archive this document?', `<b>${esc(d.name)}</b> will move to the archive with all ${plural(vers(d).length, 'version')}. Nothing is deleted — you can restore it at any time.`, 'Archive', () => {
    Object.assign(d, { archived: true, archivedAt: Date.now(), archivedBy: SESSION }); logAct(`archived ${d.name}`, d.project, 'doc'); commit('Document archived — history kept');
  });
};
ACT.docRevise = el => {
  const d = docById(el.dataset.id), cur = curVer(d);
  openModal({ title: 'Upload a revision', sub: `${esc(d.name)} · currently v${cur.v} (${esc(cur.status)})`, body: `<div class="form">
    <div class="field"><span>Revised file</span><div class="dropzone" data-act="pickPhotos">${ico('upload', 'lg')}<div style="margin-top:6px"><b>Choose the revised file</b> or drag and drop</div><small>Optional in this demo — without a file, a sample revision is generated</small><input type="file" id="revFile" hidden></div><ul class="picked" id="revPicked"></ul></div>
    ${fld('What changed?', 'note', { type: 'textarea', req: true, ph: 'e.g. Staircase landing widened to 1.2 m; window W3 shifted 300 mm' })}
    <div class="row2">${fld('Revision date', 'date', { type: 'date', value: TODAY })}${fld('After upload', 'next', { opts: [['review', 'Submit for review'], ['draft', 'Save as draft']] })}</div>
    ${demoNote(`Reviewers (${reviewersOf(d).map(userName).join(', ')}) are notified when a revision is submitted. v${approvedVer(d)?.v || '—'} stays the approved version until the new one is approved.`)}</div>`,
    foot: `<button type="button" class="btn" data-act="closeModal">Cancel</button><button type="submit" class="btn primary">${ico('upload', 'sm')}Upload v${cur.v + 1}</button>`,
    onOpen: m => { const inp = $('#revFile'); inp.addEventListener('change', () => $('#revPicked').innerHTML = [...inp.files].map(f => `<li><span class="ftype ${ftype(f.name.split('.').pop().toLowerCase())[1]}">${esc(f.name.split('.').pop().toUpperCase().slice(0, 4))}</span><span>${esc(f.name)}</span><small class="muted">${fmtSize(f.size)}</small></li>`).join('')); bindDrop($('.dropzone', m), inp); },
    onSubmit: x => {
      const f = $('#revFile').files[0], n = cur.v + 1;
      const v = { v: n, date: x.date || TODAY, at: Date.now(), by: SESSION, size: f ? f.size : Math.round((cur.size || d.size) * 1.03), note: x.note, status: x.next === 'draft' ? 'Draft' : 'Under Review', reviewedBy: null, reviewedAt: null, reviewNote: '', uploaded: !!f };
      if (f) { const url = URL.createObjectURL(f); BLOBS.set(`${d.id}@v${n}`, url); BLOBS.set(d.id, url); d.uploaded = true; }
      d.versions.push(v); Object.assign(d, { version: n, date: v.date, by: SESSION, size: v.size });
      if (v.status === 'Under Review') notify(reviewersOf(d), `Revised ${isDrawingDoc(d) ? 'plan' : 'document'} uploaded for review: ${d.name} v${n} · ${proj(d.project).name}`, '#/documents?tab=review', 'doc');
      logAct(`uploaded ${d.name} v${n}${v.status === 'Draft' ? ' as a draft' : ' for review'}`, d.project, 'doc');
      saveDB(); renderView(); renderShell(); setTimeout(() => previewDoc(d.id, n), 40);
      toast(v.status === 'Draft' ? `v${n} saved as a draft` : `v${n} submitted for review — approvers notified`);
    } });
};

/* ---------- compare two revisions ---------- */
function openCompare(id, a, b) {
  const d = docById(id), vs = vers(d);
  const A = vs.find(x => x.v === +a) || vs[vs.length - 2], B = vs.find(x => x.v === +b) || vs[vs.length - 1];
  const sel = (k, cur) => `<select class="select sm" data-cmp="${k}" aria-label="Version">${vs.map(x => `<option value="${x.v}" ${x === cur ? 'selected' : ''}>v${x.v} · ${x.status}</option>`).join('')}</select>`;
  const lo = Math.min(A.v, B.v), hi = Math.max(A.v, B.v), between = vs.filter(x => x.v > lo && x.v <= hi);
  const row = (l, f) => `<tr><td class="muted">${l}</td><td>${f(A)}</td><td>${f(B)}</td></tr>`;
  openModal({ title: `Compare revisions`, sub: esc(d.name), wide: true, body: `
    <div class="cmp"><div><div class="cmp-h">${sel('a', A)}${badge(A.status)}</div><div class="preview-stage">${verBody(d, A)}</div></div>
      <div><div class="cmp-h">${sel('b', B)}${badge(B.status)}</div><div class="preview-stage">${verBody(d, B)}</div></div></div>
    <div class="table-wrap" style="margin-top:16px"><table class="t"><thead><tr><th></th><th>v${A.v}</th><th>v${B.v}</th></tr></thead><tbody>
      ${row('Revision date', x => fmtDY(x.date))}${row('Uploaded by', x => esc(userName(x.by)))}${row('Status', x => badge(x.status))}${row('Size', x => fmtSize(x.size || d.size))}${row('Change', x => esc(x.note || '—'))}</tbody></table></div>
    <div style="margin-top:16px"><h3 style="margin-bottom:8px">Changes from v${lo} to v${hi}</h3>${between.length ? `<ul class="timeline">${between.map(x => `<li class="k-${x.status === 'Rejected' ? 'delay' : 'progress'}"><div class="when">v${x.v} · ${fmtDY(x.date)} · ${esc(userName(x.by))} · ${x.status}</div><div class="what">${esc(x.note)}</div></li>`).join('')}</ul>` : '<p class="muted">Pick two different versions.</p>'}
      <p class="muted" style="font-size:12.5px">Revision clouds on the drawings mark the changed areas. Visual comparison of real uploaded files is not available in this demo.</p></div>`,
    foot: `<button type="button" class="btn left" data-act="docVer" data-id="${d.id}" data-v="${B.v}">${ico('arrowL', 'sm')}Back to document</button><button type="button" class="btn primary" data-act="closeModal">Close</button>`,
    onOpen: m => $$('[data-cmp]', m).forEach(s => s.addEventListener('change', () => openCompare(id, $('[data-cmp="a"]', m).value, $('[data-cmp="b"]', m).value))) });
}
ACT.docCompare = el => openCompare(el.dataset.id);

/* ---------- Documents › Approvals & revisions tab ---------- */
function reviewTab() {
  const ids = myProjectIds();
  const docs = DB.documents.filter(d => ids.has(d.project) && !isMedia(d) && vers(d).length);
  const queue = docs.filter(d => !d.archived && docStatus(d) === 'Under Review');
  const drafts = docs.filter(d => !d.archived && docStatus(d) === 'Draft');
  const revs = docs.flatMap(d => vers(d).filter(v => v.v > 1 && daysFrom(v.date) >= -60).map(v => ({ d, v }))).sort((a, b) => b.v.date.localeCompare(a.v.date) || b.v.v - a.v.v);
  const decided = docs.flatMap(d => vers(d).filter(v => v.reviewedAt && Date.now() - v.reviewedAt < 30 * 864e5).map(v => ({ d, v })));
  const item = d => { const v = curVer(d), ap = approvedVer(d); return `<li data-act="previewDoc" data-id="${d.id}"><span class="ftype ${ftype(d.ext)[1]}">${esc(d.ext.toUpperCase().slice(0, 4))}</span><div class="main-t"><b>${esc(d.name)} · v${v.v}</b><span>${esc(proj(d.project).name)} · ${esc(userName(v.by))} · ${v.at ? fmtTs(v.at) : fmtDY(v.date)}</span><span style="white-space:normal">${esc(v.note)}</span></div><span class="meta">${ap ? `in use: v${ap.v}` : 'not yet issued'}</span>${isReviewer(d) && v.status === 'Under Review' ? `<button class="btn xs primary">Review</button>` : badge(v.status)}</li>`; };
  return `<div class="kpis">
      <div class="kpi"><div class="l">${ico('shield', 'sm')}Awaiting approval</div><div class="v">${queue.length}</div><div class="s">${queue.filter(isReviewer).length} assigned to you</div></div>
      <div class="kpi"><div class="l">${ico('edit', 'sm')}Drafts</div><div class="v">${drafts.length}</div><div class="s">not yet submitted</div></div>
      <div class="kpi"><div class="l">${ico('check', 'sm')}Approved (30 days)</div><div class="v">${decided.filter(x => x.v.status === 'Approved' || x.v.status === 'Superseded').length}</div><div class="s">${decided.filter(x => x.v.status === 'Rejected').length} rejected</div></div>
      <div class="kpi"><div class="l">${ico('history', 'sm')}Revisions (60 days)</div><div class="v">${revs.length}</div><div class="s">across ${plural(new Set(revs.map(x => x.d.project)).size, 'project')}</div></div></div>
    <div class="grid g2">
      <div class="card"><div class="card-head"><h2>Awaiting approval</h2><span class="sub">${queue.length}</span></div><ul class="list click" style="margin-top:8px">${queue.map(item).join('') || '<li class="muted">Nothing waiting for review.</li>'}</ul></div>
      <div class="card"><div class="card-head"><h2>Drafts</h2><span class="sub">${drafts.length}</span></div><ul class="list click" style="margin-top:8px">${drafts.map(item).join('') || '<li class="muted">No drafts.</li>'}</ul></div>
    </div>
    <div class="card"><div class="card-head"><h2>Recently revised plans & documents</h2><span class="sub">Last 60 days</span></div>
      <div class="table-wrap" style="margin-top:12px"><table class="t stack-sm"><thead><tr><th>Document</th><th>Version</th><th>Change</th><th>Revised</th><th>Status</th><th>In use on site</th></tr></thead><tbody>
      ${revs.map(({ d, v }) => `<tr class="click" data-act="docVer" data-id="${d.id}" data-v="${v.v}"><td class="strong full">${esc(d.name)}<span class="sub">${esc(proj(d.project).name)}</span></td><td>v${v.v}</td><td class="hide-sm" style="white-space:normal;max-width:320px">${esc(v.note)}</td><td class="nowrap hide-sm">${fmtD(v.date)}<span class="sub">${esc(userName(v.by))}</span></td><td>${badge(v.status)}</td><td class="hide-sm">${approvedVer(d) ? `v${approvedVer(d).v}` : '—'}</td></tr>`).join('') || emptyRow(6, 'No recent revisions')}
      </tbody></table></div></div>`;
}
