/* Project notes: instructions, client discussions, design changes and site observations kept on each project.
   Anyone who can see the project reads them; people who work on projects or sites add notes; the author, the
   project manager, the Owner and the Admin can edit, pin or delete them. Each note records its author, when it
   was created and when (and by whom) it was last updated. */
'use strict';

IC.tack = '<path d="M9 3h6l-1 6 3 3v2H7v-2l3-3z"/><path d="M12 14v7"/>';
const PNOTE_ICO = { Instruction: 'flag', 'Client discussion': 'users', 'Design change': 'compare', 'Site observation': 'eye', Other: 'edit' };
const noteIco = k => PNOTE_ICO[k] || 'edit';
const canAddNote = () => can('projects') || can('site');
const canEditNote = n => n.by === SESSION || ['owner', 'sysadmin'].includes(role()) || proj(n.project)?.pm === SESSION;
const projNotes = pid => (DB.notes || []).filter(n => n.project === pid);

LOAD_HOOKS.push(() => {
  if (DB.notes) return;
  const t = (d, h, m = 0) => tsOn(dayOff(d), h, m), N = (id, project, kind, title, body, by, at, upd = null, updBy = null, pinned = false) => ({ id, project, kind, title, body, by, at, updatedAt: upd || at, updatedBy: updBy || by, pinned });
  DB.notes = [
    N('nt1', 'p1', 'Instruction', 'Curing for the first-floor roof slab', 'Keep the slab ponded for at least 14 days. Supervisor to log curing in the daily report every evening.\nNo stacking of bricks on the slab until day 21.', 'u2', t(-12, 9, 30), t(-3, 17, 10), 'u4', true),
    N('nt2', 'p1', 'Client discussion', 'Kitchen and pooja room finishes', 'Met Dr. Sundaram on site. Confirmed: granite counter in Black Galaxy, pooja room in white marble with brass inlay.\nClient will share the tile catalogue choice by Friday.', 'u2', t(-8, 16, 15)),
    N('nt3', 'p1', 'Site observation', 'Seepage near the staircase wall', 'Minor seepage seen at the base of the north staircase wall after Tuesday\'s rain. Waterproofing contractor to inspect before plastering.', 'u6', t(-4, 11, 40)),
    N('nt4', 'p2', 'Design change', 'Flat 304 layout revised', 'Column C17 shifted 450 mm east as per the revised architectural plan v3. Do not cast the first-floor columns from the old drawing.', 'u2', t(-58, 17, 0), t(-57, 12, 0), 'u2', true),
    N('nt5', 'p2', 'Instruction', 'Material stacking at Block A', 'Cement to be stacked only in the covered store; maximum 10 bags high. Steel on raised wooden supports.', 'u5', t(-20, 10, 0)),
    N('nt6', 'p3', 'Client discussion', 'Payment and flooring hold', 'Mr. Balaji asked to hold the ground-floor flooring purchase until the stage payment is released next week.', 'u3', t(-4, 15, 20)),
    N('nt7', 'p5', 'Design change', 'Verandah roof to Mangalore tile', 'Client prefers a sloped Mangalore tile roof for the verandah. Revised elevation uploaded as a draft for review.', 'u2', t(-1, 11, 10)),
    N('nt8', 'p7', 'Client discussion', 'Front elevation on hold', 'Client wants to review two more façade options before approving. All front work stays on hold until approval.', 'u3', t(-26, 18, 0), t(-6, 16, 30), 'u3', true),
  ];
});
SEARCH_HOOKS.push((hit, ids) => (DB.notes || []).filter(n => ids.has(n.project) && (hit(n.title) || hit(n.body))).slice(0, 4).map(n => ({ g: 'Project notes', icon: noteIco(n.kind), t: n.title, s: `${proj(n.project).name} · ${n.kind}`, href: `#/projects/${n.project}?tab=notes&note=${n.id}` })));

function projectNotesTab(p) {
  const { nk = '', nq = '' } = ROUTE.q;
  const all = projNotes(p.id);
  const list = all.filter(n => (!nk || n.kind === nk) && (!nq || `${n.title} ${n.body}`.toLowerCase().includes(nq.toLowerCase()))).sort((a, b) => (b.pinned - a.pinned) || b.updatedAt - a.updatedAt);
  after(() => $$('.pn-body[data-clamp]').forEach(b => { if (b.scrollHeight > b.clientHeight + 2) b.nextElementSibling.hidden = false; }));
  if (ROUTE.q.note) after(() => document.getElementById(`note-${ROUTE.q.note}`)?.scrollIntoView({ block: 'center' }));
  return `<div class="pn-bar">
      <div class="pn-top"><div class="inline-search">${ico('search', 'sm')}<input class="input" type="search" placeholder="Search notes" value="${esc(nq)}" data-input="noteQ" aria-label="Search notes"></div>
        <span class="pn-count">${plural(all.length, 'note')}${all.filter(n => n.pinned).length ? ` · ${all.filter(n => n.pinned).length} pinned` : ''}</span>${canAddNote() ? btn('New note', 'newNote', { icon: 'plus', cls: 'primary', data: `data-p="${p.id}"` }) : ''}</div>
      <div class="chips pn-chips">${[['', 'All', all.length], ...NOTE_KINDS.map(k => [k, k, all.filter(n => n.kind === k).length])].map(([v, l, c]) => `<button class="chip ${nk === v ? 'on' : ''}" data-act="setQ" data-k="nk" data-v="${esc(v)}">${v ? ico(noteIco(v), 'sm') : ''}${esc(l)} <span class="n">${c}</span></button>`).join('')}</div></div>
    ${list.length ? `<div class="pn-list">${list.map(noteCard).join('')}</div>`
      : `<div class="card">${emptyPage(all.length ? 'No notes match' : 'No notes yet', all.length ? 'Try another type or search.' : 'Record instructions, client discussions, design changes and site observations here.')}</div>`}`;
}
function noteCard(n) {
  const edited = n.updatedAt - n.at > 1000, ok = canEditNote(n), k = (n.kind || 'Other').toLowerCase().replace(/\s+/g, '-');
  return `<article class="pn-card k-${k} ${n.pinned ? 'pinned' : ''} ${ROUTE.q.note === n.id ? 'hl' : ''}" id="note-${n.id}">
    <header><span class="pn-kind">${ico(noteIco(n.kind), 'sm')}${esc(n.kind)}</span>${n.pinned ? `<span class="pn-pin" title="Pinned to the top">${ico('tack', 'sm')}Pinned</span>` : ''}
      ${ok ? `<div class="pn-acts"><button class="iconbtn ${n.pinned ? 'on' : ''}" data-act="pinNote" data-id="${n.id}" aria-label="${n.pinned ? 'Unpin' : 'Pin to top'}" title="${n.pinned ? 'Unpin' : 'Pin to top'}">${ico('tack', 'sm')}</button><button class="iconbtn" data-act="editNote" data-id="${n.id}" aria-label="Edit note" title="Edit">${ico('edit', 'sm')}</button><button class="iconbtn danger" data-act="delNote" data-id="${n.id}" aria-label="Delete note" title="Delete">${ico('trash', 'sm')}</button></div>` : ''}</header>
    <h3>${esc(n.title)}</h3>
    <div class="pn-body" data-clamp>${esc(n.body).replace(/\n/g, '<br>')}</div>
    <button type="button" class="linkbtn pn-more" data-act="noteMore" hidden>Read more</button>
    <footer>${av(userName(n.by), 'sm')}<div><b>${esc(userName(n.by))}</b><span>${fmtTs(n.at)}${edited ? ` · <em title="${esc(`Updated ${fmtTs(n.updatedAt)} by ${userName(n.updatedBy)}`)}">edited ${ago(n.updatedAt).toLowerCase()}${n.updatedBy !== n.by ? ` by ${esc(userName(n.updatedBy).split(' ')[0])}` : ''}</em>` : ''}</span></div></footer></article>`;
}
ACT.noteMore = el => { const b = el.previousElementSibling, open = b.classList.toggle('open'); el.textContent = open ? 'Show less' : 'Read more'; };
INPUT.noteQ = el => { setQ({ nq: el.value }); const i = $('[data-input="noteQ"]'); i.focus(); i.setSelectionRange(i.value.length, i.value.length); };
function noteModal(n, pid) {
  openModal({ title: n ? 'Edit note' : 'New project note', sub: esc(proj(n?.project || pid).name), body: `<div class="form">
    ${fld('Title', 'title', { req: true, value: n?.title || '', ph: 'e.g. Client approved the kitchen layout' })}
    <div class="field"><span>Type</span><div class="pn-types" role="radiogroup" aria-label="Note type">${NOTE_KINDS.map((k, i) => `<label class="pn-type k-${k.toLowerCase().replace(/\s+/g, '-')}"><input type="radio" name="kind" value="${esc(k)}" ${(n?.kind || NOTE_KINDS[0]) === k ? 'checked' : ''}><span>${ico(noteIco(k), 'sm')}${esc(k)}</span></label>`).join('')}</div></div>
    ${fld('Description', 'body', { type: 'textarea', rows: 6, req: true, value: n?.body || '', ph: 'What was said, decided or seen — and what needs to happen next' })}
    <label class="check"><input type="checkbox" name="pinned" ${n?.pinned ? 'checked' : ''}> Pin to the top of the notes</label></div>`,
    foot: `<button type="button" class="btn" data-act="closeModal">Cancel</button><button type="submit" class="btn primary">${ico('check', 'sm')}${n ? 'Save changes' : 'Add note'}</button>`,
    onSubmit: (d, form) => {
      d.kind = $('[name=kind]:checked', form)?.value || NOTE_KINDS[0];
      if (n) { Object.assign(n, { title: d.title, kind: d.kind, body: d.body, pinned: !!d.pinned, updatedAt: Date.now(), updatedBy: SESSION }); logAct(`updated the note “${d.title}”`, n.project, 'info'); commit('Note updated'); return; }
      const rec = { id: nid('nt'), project: pid, title: d.title, kind: d.kind, body: d.body, pinned: !!d.pinned, by: SESSION, at: Date.now(), updatedAt: Date.now(), updatedBy: SESSION };
      (DB.notes ||= []).unshift(rec);
      const p = proj(pid); if (d.kind === 'Instruction' || d.kind === 'Design change') notify([p.pm, p.engineer, p.supervisor].filter(u => u !== SESSION), `${d.kind} added on ${p.name}: ${d.title}`, `#/projects/${pid}?tab=notes&note=${rec.id}`, 'info');
      logAct(`added a note “${d.title}”`, pid, 'info'); commit('Note added');
    } });
}
ACT.newNote = el => { if (!guard(canAddNote(), 'add notes')) return; noteModal(null, el.dataset.p); };
ACT.editNote = el => { const n = DB.notes.find(x => x.id === el.dataset.id); if (!guard(canEditNote(n), 'edit this note')) return; noteModal(n); };
ACT.pinNote = el => { const n = DB.notes.find(x => x.id === el.dataset.id); if (!guard(canEditNote(n), 'pin this note')) return; n.pinned = !n.pinned; commit(n.pinned ? 'Pinned to the top' : 'Unpinned'); };
ACT.delNote = el => { const n = DB.notes.find(x => x.id === el.dataset.id); if (!guard(canEditNote(n), 'delete this note')) return;
  confirmBox('Delete this note?', `<b>${esc(n.title)}</b> will be removed from ${esc(proj(n.project).name)}.`, 'Delete', () => { DB.notes = DB.notes.filter(x => x !== n); logAct(`deleted the note “${n.title}”`, n.project, 'info'); commit('Note deleted'); }, true); };
