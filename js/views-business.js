/* Enquiries & Clients, Users & Access */
'use strict';

const ENQ_STAGES = ['New', 'Contacted', 'Site visit', 'Quotation sent', 'Negotiation', 'Won', 'Lost'];
const nextFU = e => e.followUps.filter(f => !f.done).sort((a, b) => a.date.localeCompare(b.date))[0];
INPUT.enqQ = el => { setQ({ q: el.value }); const i = $('[data-input="enqQ"]'); i.focus(); i.setSelectionRange(i.value.length, i.value.length); };

VIEWS.enquiries = () => {
  const tab = ROUTE.q.tab || 'list';
  const open = DB.enquiries.filter(e => !['Won', 'Lost'].includes(e.status));
  const dueFU = open.flatMap(e => e.followUps.filter(f => !f.done && daysFrom(f.date) <= 0));
  const quotes = DB.enquiries.filter(e => e.quote);
  if (ROUTE.q.e) after(() => showEnquiry(ROUTE.q.e));
  const body = tab === 'followups' ? enqFollowups() : tab === 'quotes' && canMoney() ? enqQuotes() : enqList();
  return `${pageHead('Enquiries & Clients', 'Walk-ins, calls and website leads — from first contact to signed project.', can('enquiries') ? btn('New enquiry', 'newEnquiry', { icon: 'plus', cls: 'primary' }) : '')}
    ${!can('enquiries') ? `<div class="banner">${ico('eye')}<span>You have <b>view-only</b> access to enquiries.</span></div>` : ''}
    ${tabs([['list', 'Enquiries', open.length], ['followups', 'Follow-ups', dueFU.length], ...(canMoney() ? [['quotes', 'Quotations', quotes.length]] : [])], tab)}${body}`;
};
function enqList() {
  const { st = 'open', q = '', src = '' } = ROUTE.q;
  const all = DB.enquiries;
  const inSt = e => st === 'open' ? !['Won', 'Lost'].includes(e.status) : st === 'all' ? true : e.status === st;
  const list = all.filter(e => inSt(e) && (!src || e.source === src) && (!q || `${e.name} ${e.phone} ${e.city} ${e.type}`.toLowerCase().includes(q.toLowerCase()))).sort((a, b) => b.created.localeCompare(a.created));
  const chips = [['open', 'Open', all.filter(e => !['Won', 'Lost'].includes(e.status)).length], ...ENQ_STAGES.map(s => [s, s, all.filter(e => e.status === s).length]), ['all', 'All', all.length]];
  return `<div class="stack"><div class="chips">${chips.map(([v, l, n]) => `<button class="chip ${st === v ? 'on' : ''}" data-act="setQ" data-k="st" data-v="${v}">${l} <span class="n">${n}</span></button>`).join('')}</div>
    <div class="toolbar"><div class="inline-search">${ico('search', 'sm')}<input class="input" type="search" placeholder="Search name, phone, town" value="${esc(q)}" data-input="enqQ" aria-label="Search enquiries"></div>
      <select class="select" data-change="setQ" data-k="src" aria-label="Source"><option value="">All sources</option>${ENQ_SOURCES.map(s => `<option ${s === src ? 'selected' : ''}>${s}</option>`).join('')}</select></div></div>
    <div class="card"><div class="table-wrap"><table class="t stack-sm"><thead><tr><th>Client</th><th>Requirement</th>${canMoney() ? '<th class="r">Budget</th>' : ''}<th>Status</th><th>Next follow-up</th><th>Owner</th></tr></thead><tbody>
    ${list.map(e => { const f = nextFU(e); return `<tr class="click" data-act="showEnquiry" data-id="${e.id}">
      <td class="full"><div class="person">${av(e.name, 'sm')}<div class="nm"><b>${esc(e.name)}</b><span>${esc(e.phone)} · ${esc(e.source)}</span></div></div></td>
      <td class="hide-sm">${esc(e.type)}<span class="sub">${esc(e.plot)} · ${esc(e.city)}</span></td>${canMoney() ? `<td class="r hide-sm">${inrS(e.quote?.amount || e.budget)}</td>` : ''}<td>${badge(e.status)}</td>
      <td>${f ? `<span style="color:var(${daysFrom(f.date) < 0 ? '--bad' : daysFrom(f.date) === 0 ? '--warn' : '--ink-2'})">${relD(f.date)}</span>` : '<span class="muted">—</span>'}</td><td class="hide-sm">${av(userName(e.owner), 'sm')}</td></tr>`; }).join('') || emptyRow(6, 'No enquiries found')}
    </tbody></table></div></div>`;
}
function enqFollowups() {
  const items = DB.enquiries.flatMap(e => e.followUps.map((f, i) => ({ ...f, i, e }))).filter(x => !['Won', 'Lost'].includes(x.e.status) || x.done);
  const groups = [['Overdue', items.filter(x => !x.done && daysFrom(x.date) < 0)], ['Today', items.filter(x => !x.done && daysFrom(x.date) === 0)], ['Upcoming', items.filter(x => !x.done && daysFrom(x.date) > 0)], ['Completed recently', items.filter(x => x.done && daysFrom(x.date) >= -10)]];
  return groups.map(([g, list]) => `<div class="card"><div class="card-head"><h2>${g}</h2><span class="sub">${list.length}</span></div>
    <ul class="list" style="margin-top:8px">${list.sort((a, b) => a.date.localeCompare(b.date)).map(x => `<li>
      ${can('enquiries') ? `<input type="checkbox" class="fu-check" ${x.done ? 'checked' : ''} data-change="fuDone" data-e="${x.e.id}" data-i="${x.i}" aria-label="Mark done" style="width:18px;height:18px;accent-color:var(--brand)">` : ''}
      <div class="main-t" data-act="showEnquiry" data-id="${x.e.id}" style="cursor:pointer"><b style="${x.done ? 'text-decoration:line-through;color:var(--muted)' : ''}">${esc(x.note)}</b><span>${esc(x.e.name)} · ${esc(x.e.phone)} · ${badge(x.e.status)}</span></div>
      <span class="meta">${fmtD(x.date)}</span>${av(userName(x.by), 'sm')}</li>`).join('') || '<li class="muted">Nothing here</li>'}</ul></div>`).join('');
}
CHANGE.fuDone = el => { if (!guard(can('enquiries'), 'update follow-ups')) { el.checked = !el.checked; return; } const e = DB.enquiries.find(x => x.id === el.dataset.e); const f = e.followUps[+el.dataset.i]; f.done = el.checked; if (f.done) logAct(`completed a follow-up with ${e.name}`, null, 'enquiry'); commit(f.done ? 'Follow-up done' : 'Follow-up reopened'); };
function enqQuotes() {
  const list = DB.enquiries.filter(e => e.quote).sort((a, b) => b.quote.date.localeCompare(a.quote.date));
  const open = list.filter(e => ['Sent', 'Revised', 'Draft'].includes(e.quote.status));
  return `<div class="kpis k3"><div class="kpi"><div class="l">Open quotations</div><div class="v">${open.length}</div><div class="s">${inrS(sum(open, e => e.quote.amount))} in value</div></div>
    <div class="kpi"><div class="l">Accepted</div><div class="v">${list.filter(e => e.quote.status === 'Accepted').length}</div><div class="s">${inrS(sum(list.filter(e => e.quote.status === 'Accepted'), e => e.quote.amount))}</div></div>
    <div class="kpi"><div class="l">Declined</div><div class="v">${list.filter(e => e.quote.status === 'Declined').length}</div></div></div>
    <div class="card"><div class="table-wrap"><table class="t stack-sm"><thead><tr><th>Quotation</th><th>Client</th><th>Date</th><th>Valid until</th><th class="r">Amount</th><th>Status</th><th></th></tr></thead><tbody>
    ${list.map(e => `<tr><td class="strong">${esc(e.quote.no)}</td><td class="full">${esc(e.name)}<span class="sub">${esc(e.type)} · ${esc(e.city)}</span></td><td class="hide-sm nowrap">${fmtD(e.quote.date)}</td><td class="hide-sm nowrap">${fmtD(e.quote.valid)}</td><td class="r strong">${inrS(e.quote.amount)}</td><td>${badge(e.quote.status)}</td><td class="r"><button class="btn xs" data-act="viewQuote" data-id="${e.id}">${ico('eye', 'sm')}View</button></td></tr>`).join('') || emptyRow(7, 'No quotations yet')}
    </tbody></table></div></div>`;
}

function showEnquiry(id) {
  const e = DB.enquiries.find(x => x.id === id); if (!e) return;
  const ok = can('enquiries'), closed = ['Won', 'Lost'].includes(e.status);
  openDrawer(esc(e.name), `${esc(e.type)} · ${esc(e.city)} · enquired ${fmtDY(e.created)}`, `
    <div class="split">${badge(e.status)}${ok && !closed ? `<select class="select" style="width:auto" data-change="enqStatus" data-id="${e.id}" aria-label="Change status">${ENQ_STAGES.filter(s => s !== 'Won').map(s => `<option ${s === e.status ? 'selected' : ''}>${s}</option>`).join('')}</select>` : ''}</div>
    ${e.project ? `<div class="banner">${ico('building')}<span>Converted to project <a href="#/projects/${e.project}"><b>${esc(proj(e.project)?.name)}</b></a></span></div>` : ''}
    ${e.status === 'Lost' && e.lostReason ? `<div class="banner warn">${ico('alert')}<span><b>Lost:</b> ${esc(e.lostReason)}</span></div>` : ''}
    <dl class="dl"><div><dt>Phone</dt><dd><a href="tel:${esc(e.phone.replace(/\s/g, ''))}">${esc(e.phone)}</a></dd></div><div><dt>Email</dt><dd>${e.email ? `<a href="mailto:${esc(e.email)}">${esc(e.email)}</a>` : '—'}</dd></div>
      <div><dt>Source</dt><dd>${esc(e.source)}</dd></div><div><dt>Handled by</dt><dd>${esc(userName(e.owner))}</dd></div>
      <div><dt>Plot / area</dt><dd>${esc(e.plot)}</dd></div>${canMoney() ? `<div><dt>Budget</dt><dd>${inr(e.budget)}</dd></div>` : ''}</dl>
    <div><h3>Requirement</h3><p class="ink2">${esc(e.requirement)}</p></div>
    ${!canMoney() ? (e.quote ? `<div><h3>Quotation</h3><p class="muted">${esc(e.quote.no)} · ${badge(e.quote.status)} — amounts are visible to the Owner and Accounts.</p></div>` : '') : `<div><div class="split" style="margin-bottom:10px"><h3 style="margin:0">Quotation</h3>${ok && !closed ? `<button class="btn xs" data-act="quoteForm" data-id="${e.id}">${e.quote ? 'Revise' : 'Create quotation'}</button>` : ''}</div>
      ${e.quote ? `<div class="card" style="padding:14px 16px;display:flex;align-items:center;gap:12px"><span class="sig">${ico('file', 'sm')}</span><div style="flex:1;min-width:0"><b style="font-weight:500">${esc(e.quote.no)} · ${inr(e.quote.amount)}</b><div class="muted" style="font-size:13px">${fmtDY(e.quote.date)} · valid until ${fmtDY(e.quote.valid)}</div></div>${badge(e.quote.status)}<button class="btn xs" data-act="viewQuote" data-id="${e.id}">View</button></div>` : '<p class="muted">No quotation yet.</p>'}</div>`}
    <div><div class="split" style="margin-bottom:10px"><h3 style="margin:0">Follow-ups</h3></div>
      ${e.followUps.length ? `<ul class="timeline">${e.followUps.slice().sort((a, b) => b.date.localeCompare(a.date)).map(f => `<li class="${f.done ? 'k-progress' : daysFrom(f.date) < 0 ? 'k-delay' : 'k-milestone'}"><div class="when">${fmtDY(f.date)} · ${esc(userName(f.by))}${f.done ? ' · done' : daysFrom(f.date) < 0 ? ' · overdue' : ''}</div><div class="what">${esc(f.note)}</div></li>`).join('')}</ul>` : '<p class="muted">No follow-ups yet.</p>'}
      ${ok && !closed ? `<div class="form" style="margin-top:6px;gap:10px"><div class="row2" style="grid-template-columns:1fr 160px"><input class="input" id="fuNote" placeholder="Next step, e.g. Call to fix site visit"><input class="input" id="fuDate" type="date" value="${shiftD(TODAY, 2)}"></div><div><button class="btn sm" data-act="addFU" data-id="${e.id}">${ico('plus', 'sm')}Schedule follow-up</button></div></div>` : ''}</div>`,
    ok && !closed ? `<button class="btn ghost danger left" data-act="markLost" data-id="${e.id}">Mark lost</button>${can2('Convert enquiry to project') ? `<button class="btn primary" data-act="convertEnq" data-id="${e.id}">${ico('convert', 'sm')}Convert to project</button>` : ''}` : `<button class="btn primary" data-act="closeDrawer">Done</button>`);
}
ACT.showEnquiry = el => showEnquiry(el.dataset.id);
$('#drawer')?.addEventListener('close', () => { if (ROUTE.q.e || ROUTE.q.w) { const q = { ...ROUTE.q }; delete q.e; delete q.w; history.replaceState(null, '', `#/${[ROUTE.mod, ...ROUTE.parts].join('/')}${Object.keys(q).length ? '?' + new URLSearchParams(q) : ''}`); ROUTE = parseRoute(); } });
CHANGE.enqStatus = el => { const e = DB.enquiries.find(x => x.id === el.dataset.id); if (el.value === 'Lost') { el.value = e.status; ACT.markLost(el); return; } e.status = el.value; logAct(`moved enquiry ${e.name} to ${e.status}`, null, 'enquiry'); saveDB(); renderView(); showEnquiry(e.id); toast(`Status changed to ${e.status}`); };
ACT.addFU = el => { const e = DB.enquiries.find(x => x.id === el.dataset.id); const note = $('#fuNote').value.trim(), date = $('#fuDate').value; if (!note) { $('#fuNote').focus(); toast('Add a note for the follow-up', 'lock'); return; } e.followUps.push({ date, note, done: false, by: SESSION }); logAct(`scheduled a follow-up with ${e.name}`, null, 'enquiry'); saveDB(); renderView(); showEnquiry(e.id); toast(`Follow-up scheduled for ${fmtD(date)}`); };
ACT.markLost = el => { const e = DB.enquiries.find(x => x.id === el.dataset.id); closeDrawer(); openModal({ title: 'Mark enquiry as lost', sub: esc(e.name), body: `<div class="form">${fld('Reason', 'reason', { opts: LOST_REASONS })}${fld('Notes', 'note', { type: 'textarea', ph: 'Optional details' })}</div>`, foot: `<button type="button" class="btn" data-act="closeModal">Cancel</button><button type="submit" class="btn danger">Mark lost</button>`, onSubmit: d => { e.status = 'Lost'; e.lostReason = d.reason + (d.note ? ` — ${d.note}` : ''); if (e.quote && e.quote.status !== 'Accepted') e.quote.status = 'Declined'; e.followUps.forEach(f => f.done = true); logAct(`marked enquiry ${e.name} as lost`, null, 'enquiry'); commit('Enquiry marked lost'); } }); };
ACT.quoteForm = el => { if (!guard(canMoney(), 'see quotation amounts')) return;
  const e = DB.enquiries.find(x => x.id === el.dataset.id); closeDrawer();
  const n = 42 + DB.enquiries.filter(x => x.quote).length;
  openModal({ title: e.quote ? 'Revise quotation' : 'Create quotation', sub: `${esc(e.name)} · ${esc(e.type)}`, body: `<div class="form">
    <div class="row2">${fld('Quoted amount (₹)', 'amount', { type: 'number', req: true, value: e.quote?.amount || e.budget, min: 1 })}${fld('Valid until', 'valid', { type: 'date', value: shiftD(TODAY, 30) })}</div>
    ${fld('Scope summary', 'scope', { type: 'textarea', value: e.quote?.scope || e.requirement })}
    <label class="check"><input type="checkbox" name="send" checked> Mark as sent to client and schedule a follow-up in 3 days</label></div>`,
    onSubmit: d => {
      const no = e.quote?.no || `QT-${parseD(TODAY).getFullYear()}-${String(n).padStart(3, '0')}`;
      e.quote = { no, date: TODAY, amount: +d.amount, valid: d.valid, scope: d.scope, status: e.quote ? 'Revised' : d.send ? 'Sent' : 'Draft' };
      if (d.send) { if (['New', 'Contacted', 'Site visit'].includes(e.status)) e.status = 'Quotation sent'; e.followUps.push({ date: shiftD(TODAY, 3), note: `Discuss quotation ${no}`, done: false, by: SESSION }); }
      logAct(`${e.quote.status === 'Revised' ? 'revised' : 'created'} quotation ${no} for ${e.name}`, null, 'enquiry'); commit(`Quotation ${no} saved`); setTimeout(() => showEnquiry(e.id), 50);
    } });
};
ACT.viewQuote = el => { if (!guard(canMoney(), 'see quotation amounts')) return;
  const e = DB.enquiries.find(x => x.id === el.dataset.id), qt = e.quote; closeDrawer();
  const split = [['Foundation & structure', .38], ['Masonry & plastering', .22], ['Flooring & tiling', .12], ['Electrical & plumbing', .13], ['Doors, windows & finishes', .15]];
  openModal({ title: `Quotation ${qt.no}`, sub: `${esc(e.name)} · ${badge(qt.status)}`, wide: true, body: `<div class="preview-stage" style="min-height:0"><div class="paper">
    <div class="ph"><img src="assets/logo.png" alt=""><div><h4>Scale Space Builders</h4><div style="color:#777;font-size:11px">Construction &amp; Design Firm · No.4, State Bank Colony, Lalbahadur Nagar, Mayiladuthurai · +91 78454 36496</div></div></div>
    <div style="display:flex;justify-content:space-between;gap:16px;margin-bottom:14px"><div><div style="color:#777">Quotation for</div><b>${esc(e.name)}</b><div>${esc(e.city)} · ${esc(e.phone)}</div></div><div style="text-align:right"><div style="color:#777">Quotation no.</div><b>${esc(qt.no)}</b><div>${fmtDY(qt.date)}</div></div></div>
    <h4>${esc(e.type)} — ${esc(e.plot)}</h4><p style="color:#555;margin:4px 0 8px">${esc(qt.scope || e.requirement)}</p>
    <table>${split.map(([l, f]) => `<tr><td>${l}</td><td style="text-align:right">${inr(qt.amount * f)}</td></tr>`).join('')}<tr><td><b>Total (incl. materials &amp; labour)</b></td><td style="text-align:right"><b>${inr(qt.amount)}</b></td></tr></table>
    <div style="color:#777">Valid until ${fmtDY(qt.valid)}. Payments linked to construction stages. GST extra as applicable.</div>
    <div style="margin-top:26px;display:flex;justify-content:space-between;color:#777"><span>Prepared by ${esc(userName(e.owner))}</span><span>For Scale Space Builders</span></div></div></div>`,
    foot: `${can('enquiries') && ['Sent', 'Revised'].includes(qt.status) ? `<button type="button" class="btn left" data-act="acceptQuote" data-id="${e.id}">${ico('check', 'sm')}Mark accepted</button>` : ''}<button type="button" class="btn" data-act="print">${ico('print', 'sm')}Print / PDF</button><button type="button" class="btn primary" data-act="closeModal">Close</button>` });
};
ACT.acceptQuote = el => { if (!guard(canMoney(), 'see quotation amounts')) return; const e = DB.enquiries.find(x => x.id === el.dataset.id); e.quote.status = 'Accepted'; e.status = 'Negotiation'; closeModal(); logAct(`quotation ${e.quote.no} accepted by ${e.name}`, null, 'enquiry'); saveDB(); renderView(); showEnquiry(e.id); toast('Quotation accepted — ready to convert to a project'); };
ACT.convertEnq = el => {
  const e = DB.enquiries.find(x => x.id === el.dataset.id);
  if (!guard(can2('Convert enquiry to project'), 'convert enquiries')) return;
  closeDrawer();
  const surname = e.name.replace(/^(Dr\.|Mrs\.|Mr\.|Thiru\.|Sri)\s+/, '').split(' ').filter(w => w.length > 2).pop() || e.name;
  const type = PROJECT_TYPES.includes(e.type) ? e.type : 'Independent house';
  const seed = { name: /trust|hospital|sons|textiles|ltd/i.test(e.name) ? e.name : `${surname} ${/house|villa/i.test(e.type) ? 'Residence' : 'Project'}`, type, client: { name: e.name, phone: e.phone, email: e.email, address: e.city }, location: '', city: e.city, value: e.quote?.amount || e.budget, area: parseInt(String(e.plot).replace(/,/g, '')) || '', start: shiftD(TODAY, 7), end: shiftD(TODAY, 300), pm: e.owner !== 'u1' ? e.owner : 'u2' };
  openModal({ title: 'Convert to project', sub: 'Create a construction project from this enquiry.', wide: true, body: projectForm(seed, e), foot: `<button type="button" class="btn" data-act="closeModal">Cancel</button><button type="submit" class="btn primary">${ico('convert', 'sm')}Create project</button>`,
    onSubmit: d => { if (d.end <= d.start) { toast('Target completion must be after the start date', 'lock'); return false; } if (!canMoney()) d.value = e.quote?.amount || e.budget; const p = createProject(d, e); saveDB(); go(`#/projects/${p.id}`); toast(`${p.name} created from enquiry`); } });
};
ACT.newEnquiry = () => {
  if (!guard(can('enquiries'), 'register enquiries')) return;
  openModal({ title: 'New enquiry', sub: 'Register a walk-in, call or website lead.', wide: true, body: `<div class="form">
    <div class="row3">${fld('Client name', 'name', { req: true })}${fld('Phone', 'phone', { type: 'tel', req: true, ph: '+91' })}${fld('Email', 'email', { type: 'email' })}</div>
    <div class="row3">${fld('Source', 'source', { opts: ENQ_SOURCES })}${fld('Town / city', 'city', { req: true, value: 'Mayiladuthurai' })}${fld('Construction type', 'type', { opts: PROJECT_TYPES, value: 'Independent house' })}</div>
    <div class="row3">${fld('Plot / built-up size', 'plot', { ph: 'e.g. 2,400 sq.ft plot' })}${moneyFld('Approx. budget (₹)', 'budget', { type: 'number', req: true, min: 1, value: canMoney() ? '' : 0 })}${fld('Assign to', 'owner', { opts: userOpts(['owner', 'pm']).map(([v, l]) => [v, l.split(' · ')[0]]), value: role() === 'pm' ? SESSION : 'u2' })}</div>
    ${fld('Requirements', 'requirement', { type: 'textarea', req: true, ph: 'Floors, rooms, special requests, timeline…' })}
    <div class="form-sec">First follow-up</div>
    <div class="row2" style="grid-template-columns:1fr 200px">${fld('Next step', 'fuNote', { value: 'Call to schedule a site visit' })}${fld('Date', 'fuDate', { type: 'date', value: shiftD(TODAY, 1) })}</div></div>`,
    onSubmit: d => { const e = { id: nid('en'), name: d.name, phone: d.phone, email: d.email, source: d.source, city: d.city, type: d.type, plot: d.plot || '—', budget: +d.budget || 0, requirement: d.requirement, status: 'New', owner: d.owner, created: TODAY, followUps: d.fuNote ? [{ date: d.fuDate, note: d.fuNote, done: false, by: d.owner }] : [], quote: null, project: null };
      DB.enquiries.unshift(e); logAct(`registered an enquiry from ${e.name}`, null, 'enquiry'); saveDB(); go('#/enquiries'); toast(`Enquiry from ${e.name} registered`); setTimeout(() => showEnquiry(e.id), 60); } });
};

/* ================= Users & Access ================= */
/* Module access and key actions per role can be changed by the Owner and the Admin. Financial modules and actions
   (payments, invoices, bills, salaries, expenses, analytics, viewing financial details) can only be changed by the
   Owner, nobody can change their own role's access, and the Owner always keeps full access. Roles with any financial
   access can only be assigned by the Owner. Changes are kept in browser storage apart from the demo data. */
const FIN_MODULES = ['finance', 'invoices', 'analytics'];
const FIN_ACTIONS = ['Record client payments', 'Pay salaries & advances', 'Add site expenses', 'Issue invoices & pay bills', 'View financial details'];
const PERMS_KEY = KEY + '-perms';
let PERM_CFG = (() => { try { return JSON.parse(store.get(PERMS_KEY) || '{}') || {}; } catch { return {}; } })();
let PERM_DEFAULTS = null;
const savePerms = () => store.set(PERMS_KEY, JSON.stringify(PERM_CFG));
// defaults are captured once every module has registered its permissions, then saved changes are applied on top
LOAD_HOOKS.push(() => {
  if (!PERM_DEFAULTS) PERM_DEFAULTS = JSON.parse(JSON.stringify(PERMS));
  Object.entries(PERM_CFG.modules || {}).forEach(([r, m]) => { if (PERMS[r]) Object.assign(PERMS[r], m); });
  Object.entries(PERM_CFG.actions || {}).forEach(([a, m]) => { ACTION_OVR[a] = { ...m }; });
  // Performance (scores, appraisals, salaries) is for the Owner only, whatever older saved settings say
  OWNER_ONLY.forEach(m => Object.keys(PERMS).forEach(r => { if (r !== 'owner') PERMS[r][m] = 'none'; }));
});
// the finance team: roles that can open a financial module, or take payments, pay salaries or issue invoices
const FIN_TEAM_ACTIONS = ['Record client payments', 'Pay salaries & advances', 'Issue invoices & pay bills'];
const hasFinAccess = r => r === 'owner' || FIN_MODULES.some(m => (PERMS[r]?.[m] || 'none') !== 'none') || FIN_TEAM_ACTIONS.some(a => actionAllowed(a, r));
const canAssignRole = r => role() === 'owner' || (can('users') && !hasFinAccess(r));
const canManageUser = u => role() === 'owner' || (can('users') && u.role !== 'owner' && !hasFinAccess(u.role));
// which permission cells the signed-in person may change
const OWNER_ONLY = ['performance'];
const cellEditable = (r, fin, m) => !OWNER_ONLY.includes(m) && can('users') && can2('Manage users & roles') && r !== 'owner' && r !== role() && (!fin || role() === 'owner');

const userProjects = u => DB.projects.filter(p => p.status !== 'Completed' && (['owner', 'sysadmin', 'accounts', 'admin'].includes(u.role) ? true : u.role === 'pm' ? p.pm === u.id : [p.engineer, p.supervisor].includes(u.id)));
const ROLE_ICO = { owner: 'star', sysadmin: 'shield', pm: 'building', engineer: 'hardhat', supervisor: 'userCheck', accounts: 'rupee', admin: 'folder' };
const PERM_NEXT = { edit: 'view', view: 'none', none: 'edit' };
const PERM_LBL = { edit: 'Full', view: 'View', none: 'No access' };
function usersTab(ok) {
  const { uf = '', ur = '', uq = '' } = ROUTE.q;
  const pend = u => ok && canManageUser(u) && kycMissing(u);
  const match = (u, f) => !f || (f === 'pending' ? pend(u) : u.status === f);
  const list = DB.users.filter(u => match(u, uf) && (!ur || u.role === ur) && (!uq || `${u.name} ${u.email} ${u.title} ${u.phone || ''}`.toLowerCase().includes(uq.toLowerCase())));
  const chips = [['', 'All'], ['Active', 'Active'], ['Invited', 'Invited'], ['Inactive', 'Inactive'], ...(ok ? [['pending', 'Details pending']] : [])];
  return `<div class="card ux-card"><div class="ux-tools">
      <div class="chips">${chips.map(([k, l]) => `<button class="chip ${uf === k ? 'on' : ''}" data-act="setQ" data-k="uf" data-v="${k}">${l} <span class="n">${DB.users.filter(u => match(u, k)).length}</span></button>`).join('')}</div>
      <span class="grow"></span>
      <select class="select sm" data-change="setQ" data-k="ur" aria-label="Role"><option value="">All roles</option>${Object.entries(ROLES).map(([k, r]) => `<option value="${k}" ${k === ur ? 'selected' : ''}>${esc(r.label)}</option>`).join('')}</select>
      <div class="inline-search">${ico('search', 'sm')}<input class="input" type="search" placeholder="Search users" value="${esc(uq)}" data-input="userQ" aria-label="Search users"></div></div>
    <ul class="ux-list">${list.map(u => { const ps = userProjects(u), all = ['owner', 'sysadmin', 'accounts', 'admin'].includes(u.role);
      return `<li class="ux-row st-${u.status.toLowerCase()}" data-act="viewUser" data-id="${u.id}" role="button" tabindex="0">
        <div class="ux-who"><span class="ux-av">${av(u.name)}<i class="ux-dot" title="${esc(u.status)}"></i></span><div><b>${esc(u.name)}${u.id === SESSION ? '<em class="ux-tag">You</em>' : ''}${pend(u) ? '<em class="ux-tag warn" title="Aadhaar or address missing">Details pending</em>' : ''}</b><span>${esc(u.email)}${u.phone && u.phone !== '—' ? ` · ${esc(u.phone)}` : ''}</span></div></div>
        <div class="ux-role"><span class="ux-rp r-${u.role}">${ico(ROLE_ICO[u.role] || 'user', 'sm')}${esc(ROLES[u.role].label)}</span>${u.title && u.title !== ROLES[u.role].label ? `<small>${esc(u.title)}</small>` : ''}</div>
        <div class="ux-proj">${all ? '<span class="muted">All projects</span>' : ps.length ? `<span>${esc(ps[0].name)}</span>${ps.length > 1 ? `<em>+${ps.length - 1}</em>` : ''}` : '<span class="muted">No projects</span>'}</div>
        <div class="ux-st"><span class="ux-status s-${u.status.toLowerCase()}">${esc(u.status)}</span><small>${u.status === 'Invited' ? 'not joined yet' : ago(u.last)}</small></div>
        <div class="ux-act">${ok && canManageUser(u) || u.status === 'Active' && u.id !== SESSION ? `<button class="iconbtn" data-act="userRowMenu" data-id="${u.id}" aria-label="Actions for ${esc(u.name)}">${ico('more')}</button>` : ok ? `<span class="iconbtn" title="Only the Owner can manage users with financial access">${ico('lock', 'sm')}</span>` : ''}</div></li>`; }).join('') || `<li class="ux-empty">No users match.</li>`}</ul>
    <div class="ux-note">${ico('shield', 'sm')}<span>Engineers and supervisors only see the projects they're assigned to (set on each project's <b>Edit</b> form). Use <b>Preview access</b> in a user's menu to see the app as they do.${role() !== 'owner' && ok ? ' Users with financial access can only be changed by the Owner.' : ''}</span></div></div>`;
}
function rolesTab(ok) {
  const roles = Object.keys(ROLES);
  const cell = (r, m) => { const v = PERMS[r][m] || 'none', fin = FIN_MODULES.includes(m), lbl = `${ROLES[r].label} · ${MODULES.find(x => x.id === m).label}`;
    if (cellEditable(r, fin, m)) return `<button type="button" class="pp p-${v}" data-act="permCycle" data-r="${r}" data-m="${m}" title="${esc(`${lbl}: ${PERM_LBL[v]} — click to change`)}" aria-label="${esc(`${lbl}: ${PERM_LBL[v]}. Change`)}">${PERM_LBL[v]}</button>`;
    return `<span class="pp p-${v} ro" title="${esc(`${lbl}: ${PERM_LBL[v]}`)}">${PERM_LBL[v]}${(fin && ok && r !== 'owner' && role() !== 'owner') || (OWNER_ONLY.includes(m) && r !== 'owner') ? ico('lock', 'sm') : ''}</span>`; };
  const acell = (r, a) => { const v = actionAllowed(a, r), fin = FIN_ACTIONS.includes(a);
    if (cellEditable(r, fin)) return `<label class="sw" title="${esc(`${ROLES[r].label}: ${a}`)}"><input type="checkbox" data-change="actSet" data-r="${r}" data-a="${esc(a)}" ${v ? 'checked' : ''} aria-label="${esc(`${ROLES[r].label}: ${a}`)}"><i></i></label>`;
    return `<span class="sw ro ${v ? 'on' : ''}" title="${esc(`${ROLES[r].label}: ${a} — ${v ? 'allowed' : 'not allowed'}`)}"><i></i></span>`; };
  const fin = '<em class="fin-tag">Financial</em>';
  const head = roles.map(r => `<th class="c"><span class="rh">${ico(ROLE_ICO[r] || 'user', 'sm')}${esc(ROLES[r].label)}</span></th>`).join('');
  return `<div class="rx-roles">${roles.map(r => { const us = DB.users.filter(u => u.role === r);
      return `<div class="rx-role r-${r}"><div class="rx-rh"><span class="rx-ic">${ico(ROLE_ICO[r] || 'user', 'sm')}</span><b>${esc(ROLES[r].label)}</b>${hasFinAccess(r) ? '<em class="fin-tag" title="Has financial access">₹</em>' : ''}</div>
        <p>${esc(ROLES[r].desc)}${['engineer', 'supervisor'].includes(r) ? ' · assigned projects only' : ''}</p>
        <div class="rx-us"><span class="avs">${us.slice(0, 4).map(u => av(u.name, 'sm')).join('')}</span><small>${plural(us.length, 'user')}</small></div></div>`; }).join('')}</div>
    <div class="card rx-card"><div class="card-head"><h2>Module access</h2><span class="sub">${ok ? 'Click a pill to change it: Full → View → No access' : 'What each role can open'}</span>
      ${ok && role() === 'owner' && (PERM_CFG.modules || PERM_CFG.actions) ? `<button class="btn sm" data-act="permReset" style="margin-left:auto">${ico('refresh', 'sm')}Restore defaults</button>` : ''}</div>
      <div class="rx-leg"><span><i class="p-edit"></i>Full — can view and change</span><span><i class="p-view"></i>View only</span><span><i class="p-none"></i>No access</span>${ok ? `<span class="muted">${role() === 'owner' ? 'The Owner always keeps full access.' : 'Financial items can only be changed by the Owner.'} Saved in this browser.</span>` : ''}</div>
      <div class="table-wrap"><table class="t rx-t"><thead><tr><th>Module</th>${head}</tr></thead><tbody>
        ${MODULES.map(m => `<tr><td><span class="rx-m">${ico(m.icon, 'sm')}${m.label}${FIN_MODULES.includes(m.id) ? fin : ''}${OWNER_ONLY.includes(m.id) ? '<em class="fin-tag">Owner only</em>' : ''}</span></td>${roles.map(r => `<td class="c">${cell(r, m.id)}</td>`).join('')}</tr>`).join('')}
      </tbody></table></div></div>
    <div class="card rx-card"><div class="card-head"><h2>Key actions</h2><span class="sub">Switch on what each role is allowed to do</span></div>
      <div class="table-wrap"><table class="t rx-t"><thead><tr><th>Action</th>${head}</tr></thead><tbody>
        ${ACTIONS.map(([l]) => `<tr><td><span class="rx-m">${esc(l)}${FIN_ACTIONS.includes(l) ? fin : ''}</span></td>${roles.map(r => `<td class="c">${acell(r, l)}</td>`).join('')}</tr>`).join('')}
      </tbody></table></div></div>`;
}
VIEWS.users = () => {
  const tab = ROUTE.q.tab || 'users', ok = can('users');
  const act = DB.users.filter(u => u.status === 'Active').length, inv = DB.users.filter(u => u.status === 'Invited').length;
  return `<div class="ux">${pageHead('Users & Access', `${plural(DB.users.length, 'team member')} · ${act} active${inv ? ` · ${inv} invited` : ''}`, ok ? btn('Invite user', 'inviteUser', { icon: 'plus', cls: 'primary' }) : '')}${tabs([['users', 'Users', DB.users.length], ['roles', 'Roles & permissions']], tab)}${tab === 'roles' ? rolesTab(ok) : usersTab(ok)}</div>`;
};
INPUT.userQ = el => { setQ({ uq: el.value }); const i = $('[data-input="userQ"]'); i.focus(); i.setSelectionRange(i.value.length, i.value.length); };
ACT.permCycle = el => CHANGE.permSet({ dataset: el.dataset, value: PERM_NEXT[PERMS[el.dataset.r][el.dataset.m] || 'none'] });
document.addEventListener('keydown', e => { const r = e.target.closest?.('.ux-row'); if (r && e.target === r && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); viewUser(r.dataset.id); } });
CHANGE.permSet = el => {
  const { r, m } = el.dataset, fin = FIN_MODULES.includes(m);
  if (!cellEditable(r, fin, m)) { toast(OWNER_ONLY.includes(m) ? 'This page is for the Owner only' : 'Only the Owner can change financial access', 'lock'); renderView(); return; }
  PERMS[r][m] = el.value; ((PERM_CFG.modules ||= {})[r] ||= {})[m] = el.value; savePerms();
  logAct(`set ${ROLES[r].label} access to ${MODULES.find(x => x.id === m).label}: ${el.value === 'edit' ? 'full' : el.value === 'view' ? 'view only' : 'no access'}`, null, 'user');
  commit(`${ROLES[r].label} · ${MODULES.find(x => x.id === m).label}: ${el.value === 'edit' ? 'full access' : el.value === 'view' ? 'view only' : 'no access'}`);
};
CHANGE.actSet = el => {
  const { r, a } = el.dataset, fin = FIN_ACTIONS.includes(a);
  if (!cellEditable(r, fin)) { toast('Only the Owner can change financial access', 'lock'); renderView(); return; }
  (ACTION_OVR[a] ||= {})[r] = el.checked; ((PERM_CFG.actions ||= {})[a] ||= {})[r] = el.checked; savePerms();
  logAct(`${el.checked ? 'allowed' : 'removed'} “${a}” for ${ROLES[r].label}`, null, 'user');
  commit(`${ROLES[r].label}: ${a} ${el.checked ? 'allowed' : 'not allowed'}`);
};
ACT.permReset = () => {
  if (!guard(role() === 'owner', 'restore the default permissions')) return;
  confirmBox('Restore default permissions?', 'Every role goes back to the access it had when the app was set up. Users keep their roles.', 'Restore defaults', () => {
    Object.entries(PERM_DEFAULTS).forEach(([r, m]) => { PERMS[r] = { ...m }; });
    Object.keys(ACTION_OVR).forEach(k => delete ACTION_OVR[k]); PERM_CFG = {}; savePerms();
    logAct('restored the default permissions', null, 'user'); commit('Default permissions restored');
  });
};
ACT.userRowMenu = el => { const u = user(el.dataset.id), m = canManageUser(u) && can('users'); openMenu(el, `<div class="mh">${esc(u.name)}</div><button data-act="viewUser" data-id="${u.id}">${ico('user')}View profile</button>${m ? `<button data-act="editUser" data-id="${u.id}">${ico('edit')}Edit profile</button>` : ''}${u.status === 'Active' && u.id !== SESSION && (canMoney() || !hasFinAccess(u.role)) ? `<button data-act="switchUser" data-id="${u.id}">${ico('eye')}Preview access</button>` : ''}${m && u.status === 'Invited' ? `<button data-act="resendInvite" data-id="${u.id}">${ico('mail')}Resend invite</button>` : ''}${m && u.id !== SESSION ? `<hr><button data-act="toggleUser" data-id="${u.id}">${ico(u.status === 'Inactive' ? 'refresh' : 'lock')}${u.status === 'Inactive' ? 'Reactivate' : 'Deactivate'}</button>` : ''}${!m ? `<div class="mh" style="text-transform:none;letter-spacing:0;font-weight:500">${ico('lock', 'sm')} Only the Owner can change this user</div>` : ''}`); };
ACT.resendInvite = el => toast(`Invite re-sent to ${user(el.dataset.id).email}`);
ACT.toggleUser = el => { const u = user(el.dataset.id); if (!guard(can('users') && canManageUser(u), 'manage this user')) return; u.status = u.status === 'Inactive' ? 'Active' : 'Inactive'; logAct(`${u.status === 'Active' ? 'reactivated' : 'deactivated'} ${u.name}`, null, 'user'); commit(`${u.name} ${u.status === 'Active' ? 'reactivated' : 'deactivated'}`); };
