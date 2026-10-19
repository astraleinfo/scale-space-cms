/* Project service history: maintenance, repairs, inspections, defects and corrective actions for ongoing and
   handed-over projects. Each record has the responsible person or contractor, materials, labour and other costs,
   before / after photos, attachments, a follow-up and a status log (Reported → In progress → Completed → Closed). */
'use strict';

const SV_TONE = { Reported: 'warn', 'In progress': 'info', Completed: 'ok', Closed: '' };
const SV_ICO = { Maintenance: 'wrench', Repair: 'wrench', Inspection: 'eye', Defect: 'alert', 'Corrective action': 'refresh' };
const svCost = s => sum(s.materials, m => m.cost) + (+s.labour || 0) + (+s.other || 0);
const svResp = s => user(s.responsible) ? userName(s.responsible) : s.responsible;
const svOpen = s => ['Reported', 'In progress'].includes(s.status);
const fuDue = s => s.followUp && !s.followUp.done;
const myServices = () => (DB.services || []).filter(s => myProjectIds().has(s.project));
SEARCH_HOOKS.push((hit, ids) => canSee('service') ? (DB.services || []).filter(s => ids.has(s.project) && (hit(s.title) || hit(s.ref) || hit(s.location))).slice(0, 4).map(s => ({ g: 'Service history', icon: 'wrench', t: s.title, s: `${s.ref} · ${proj(s.project).name}`, href: `#/service?sv=${s.id}` })) : []);
NAV_COUNT_HOOKS.push(() => ({ service: canSee('service') ? myServices().filter(svOpen).length : 0 }));

VIEWS.service = () => {
  if (ROUTE.q.sv) after(() => showService(ROUTE.q.sv));
  return `${pageHead('Service History', 'Maintenance, repairs, inspections, defects and corrective actions — with costs, before & after photos and follow-up work.', can('service') ? btn('Record service activity', 'newService', { icon: 'plus', cls: 'primary' }) : '')}
    ${!can('service') ? `<div class="banner">${ico('eye')}<span>You have <b>view-only</b> access to service history.</span></div>` : ''}${serviceList({})}`;
};
function serviceList({ pid = null }) {
  const { p = pid || '', type = '', st = '', q = '' } = ROUTE.q;
  const base = myServices().filter(s => !p || s.project === p);
  const list = base.filter(s => (!type || s.type === type) && (!st || (st === 'open' ? svOpen(s) : s.status === st)) && (!q || `${s.title} ${s.ref} ${s.location} ${s.description}`.toLowerCase().includes(q.toLowerCase()))).sort((a, b) => b.date.localeCompare(a.date));
  const fus = base.filter(fuDue).sort((a, b) => a.followUp.date.localeCompare(b.followUp.date));
  const yr = TODAY.slice(0, 4);
  const groups = []; list.forEach(s => { const k = monthKey(s.date); let g = groups.find(x => x.k === k); if (!g) groups.push(g = { k, items: [] }); g.items.push(s); });
  return `<div class="kpis">
      <div class="kpi"><div class="l">${ico('alert', 'sm')}Open items</div><div class="v">${base.filter(svOpen).length}</div><div class="s">${base.filter(s => s.status === 'Reported').length} reported · ${base.filter(s => s.status === 'In progress').length} in progress</div></div>
      <div class="kpi"><div class="l">${ico('flag', 'sm')}Follow-ups</div><div class="v">${fus.length}</div><div class="s">${fus.filter(s => daysFrom(s.followUp.date) < 0).length} overdue</div></div>
      <div class="kpi"><div class="l">${ico('check', 'sm')}Completed (30 days)</div><div class="v">${base.filter(s => ['Completed', 'Closed'].includes(s.status) && s.log.some(l => l.status === 'Completed' && Date.now() - l.at < 30 * 864e5)).length}</div><div class="s">${base.filter(s => s.type === 'Inspection').length} inspections recorded</div></div>
      ${canMoney() ? `<div class="kpi"><div class="l">${ico('rupee', 'sm')}Service cost · ${yr}</div><div class="v">${inrS(sum(base.filter(s => s.date.startsWith(yr)), svCost))}</div><div class="s">materials, labour and other</div></div>` : `<div class="kpi"><div class="l">${ico('wrench', 'sm')}Activities · ${yr}</div><div class="v">${base.filter(s => s.date.startsWith(yr)).length}</div><div class="s">maintenance, repairs and inspections</div></div>`}</div>
    ${fus.length ? `<div class="card"><div class="card-head"><h2>Outstanding follow-up work</h2><span class="sub">${fus.length}</span></div><ul class="list click" style="margin-top:8px">${fus.map(s => `<li data-act="showService" data-id="${s.id}"><span class="sig ${daysFrom(s.followUp.date) < 0 ? 'bad' : 'warn'}">${ico('flag', 'sm')}</span><div class="main-t"><b>${esc(s.followUp.note)}</b><span>${esc(s.title)} · ${esc(proj(s.project).name)}</span></div><span class="meta">${daysFrom(s.followUp.date) < 0 ? `<span class="badge bad">${relD(s.followUp.date)}</span>` : relD(s.followUp.date)}</span>${can('service') ? `<button class="btn xs" data-act="fuDoneSv" data-id="${s.id}">Mark done</button>` : ''}</li>`).join('')}</ul></div>` : ''}
    <div class="toolbar">${searchBox('svQ', q, 'Search service records')}${pid ? '' : projSelect(p)}
      <select class="select" data-change="setQ" data-k="type" aria-label="Type"><option value="">All types</option>${SERVICE_TYPES.map(t => `<option ${t === type ? 'selected' : ''}>${t}</option>`).join('')}</select>
      ${statusChips([['', 'All'], ['open', 'Open'], ...SERVICE_STATUSES.map(s => [s, s])], st, 'st', v => base.filter(s => !v || (v === 'open' ? svOpen(s) : s.status === v)).length)}</div>
    ${groups.length ? groups.map(g => `<section><div class="media-head"><h3>${monthLabel(g.k)}</h3><span class="muted">${plural(g.items.length, 'activity', 'activities')}${canMoney() ? ` · ${inr(sum(g.items, svCost))}` : ''}</span></div>
      <div class="card"><ul class="list click sv-list">${g.items.map(s => `<li data-act="showService" data-id="${s.id}"><span class="sig ${s.type === 'Defect' ? 'bad' : s.type === 'Inspection' ? 'info' : ''}">${ico(SV_ICO[s.type] || 'wrench', 'sm')}</span>
        <div class="main-t"><b>${esc(s.title)}</b><span>${fmtD(s.date)} · ${esc(s.type)} · ${esc(proj(s.project).name)} · ${esc(s.location)}</span><span>${esc(svResp(s))}${svCost(s) && canMoney() ? ` · ${inr(svCost(s))}` : ''}${fuDue(s) ? ` · follow-up ${relD(s.followUp.date).toLowerCase()}` : ''}</span></div>
        ${[...s.before, ...s.after].length ? `<span class="sv-thumbs">${[...s.before, ...s.after].slice(0, 2).map(ph => `<span>${phThumb(ph)}</span>`).join('')}</span>` : ''}${badge(s.status, SV_TONE[s.status])}</li>`).join('')}</ul></div></section>`).join('')
      : `<div class="card">${emptyPage('No service activities', 'Record maintenance, repairs, inspections and defects to build the project history.')}</div>`}`;
}
INPUT.svQ = liveSearch('svQ');

function showService(id) {
  const s = (DB.services || []).find(x => x.id === id); if (!s) return;
  const p = proj(s.project), ok = can('service'), next = { Reported: 'In progress', 'In progress': 'Completed', Completed: 'Closed' }[s.status];
  openDrawer(esc(s.title), `${esc(s.ref)} · ${esc(s.type)} · ${esc(p.name)}`, `
    <div class="split">${badge(s.status, SV_TONE[s.status])}<span class="muted" style="font-size:13px">Reported ${fmtDY(s.date)} by ${esc(userName(s.reportedBy))}</span></div>
    <dl class="dl"><div><dt>Project</dt><dd><a href="#/projects/${p.id}">${esc(p.name)}</a>${p.status === 'Completed' ? ' <span class="tag">Handed over</span>' : ''}</dd></div><div><dt>Location</dt><dd>${esc(s.location)}</dd></div>
      <div><dt>Type</dt><dd>${esc(s.type)}</dd></div><div><dt>Responsible</dt><dd>${esc(svResp(s))}${user(s.responsible) ? '' : ' <span class="muted">(contractor)</span>'}</dd></div></dl>
    <div><h3>Description</h3><p class="ink2">${esc(s.description)}</p></div>
    <div class="ba"><div><h3>Before</h3>${photoStrip(s.before, { empty: 'No before photos' })}</div><div><h3>After</h3>${photoStrip(s.after, { empty: s.status === 'Reported' || s.status === 'In progress' ? 'Added when the work is completed' : 'No after photos' })}</div></div>
    ${!canMoney() ? (s.materials.length ? `<div><h3>Materials used</h3>${s.materials.map(m => `<div class="kv-row"><span>${esc(m.item)}</span><b>${esc(m.qty)}</b></div>`).join('')}</div>` : '') : `<div><h3>Costs</h3>${s.materials.map(m => `<div class="kv-row"><span>${esc(m.item)} <span class="muted">· ${esc(m.qty)}</span></span><b>${inr(m.cost)}</b></div>`).join('')}
      <div class="kv-row"><span>Labour</span><b>${inr(s.labour)}</b></div><div class="kv-row"><span>Other expenses</span><b>${inr(s.other)}</b></div><div class="kv-row"><span><b style="font-weight:600">Total</b></span><b>${inr(svCost(s))}</b></div>
      ${s.expensed ? `<p class="muted" style="font-size:12.5px;margin-top:6px">${ico('check', 'sm')} Recorded in project expenses</p>` : ''}</div>`}
    ${s.attachments.length ? `<div><h3>Attachments</h3>${s.attachments.map(a => `<div class="kv-row"><span>${ico('file', 'sm')} ${esc(a.name)}</span><span class="muted">${fmtSize(a.size)}</span></div>`).join('')}</div>` : ''}
    <div><h3>Follow-up</h3>${s.followUp ? `<div class="kv-row"><span>${esc(s.followUp.note)}</span><b>${s.followUp.done ? badge('Done', 'ok') : `${fmtD(s.followUp.date)}${daysFrom(s.followUp.date) < 0 ? ' <span class="badge bad">overdue</span>' : ''}`}</b></div>${!s.followUp.done && ok ? `<button class="btn xs" style="margin-top:8px" data-act="fuDoneSv" data-id="${s.id}">Mark follow-up done</button>` : ''}` : `<p class="muted">No follow-up scheduled.</p>`}</div>
    <div><h3>Activity</h3><ul class="timeline">${s.log.slice().reverse().map(l => `<li class="k-${l.status === 'Reported' ? 'delay' : l.status === 'Closed' || l.status === 'Completed' ? 'payment' : 'progress'}"><div class="when">${fmtTs(l.at)} · ${esc(userName(l.by))} · ${badge(l.status, SV_TONE[l.status])}</div><div class="what">${esc(l.note)}</div></li>`).join('')}</ul></div>`,
    ok ? `<button class="btn left" data-act="svFollow" data-id="${s.id}">${ico('flag', 'sm')}${s.followUp && !s.followUp.done ? 'Change follow-up' : 'Add follow-up'}</button>${next ? `<button class="btn primary" data-act="svStatus" data-id="${s.id}" data-to="${next}">${next === 'Closed' ? 'Close' : `Mark ${next.toLowerCase()}`}</button>` : `<button class="btn primary" data-act="closeDrawer">Done</button>`}` : `<button class="btn primary" data-act="closeDrawer">Done</button>`);
}
ACT.showService = el => showService(el.dataset.id);
$('#drawer').addEventListener('close', () => { if (ROUTE.q.sv) { const q = { ...ROUTE.q }; delete q.sv; history.replaceState(null, '', `#/${[ROUTE.mod, ...ROUTE.parts].join('/')}${Object.keys(q).length ? '?' + new URLSearchParams(q) : ''}`); ROUTE = parseRoute(); } });

const respOpts = p => [...[p.engineer, p.supervisor, p.pm].filter(Boolean).map(u => [u, `${userName(u)} · ${ROLES[user(u).role].label}`]), ['contractor', 'A contractor…']];
const matRows = (list = []) => `<div class="mat-rows">${[0, 1, 2].map(i => `<div class="row3"><input class="input" name="mi${i}" placeholder="Material / item" value="${esc(list[i]?.item || '')}" aria-label="Material ${i + 1}"><input class="input" name="mq${i}" placeholder="Qty, e.g. 4 bags" value="${esc(list[i]?.qty || '')}" aria-label="Quantity ${i + 1}"><input class="input" type="number" min="0" name="mc${i}" placeholder="Cost ₹" value="${list[i]?.cost ?? ''}" aria-label="Cost ${i + 1}"></div>`).join('')}</div>`;
const readMats = d => [0, 1, 2].map(i => ({ item: d['mi' + i], qty: d['mq' + i], cost: +d['mc' + i] || 0 })).filter(m => m.item);
ACT.newService = el => {
  if (!guard(can('service'), 'record service activities')) return;
  const ps = myProjects(), pid = el?.dataset?.p || ROUTE.q.p || ps[0].id;
  openModal({ title: 'Record service activity', sub: 'Maintenance, repair, inspection, defect or corrective action.', wide: true, body: `<div class="form">
    <div class="row3">${fld('Project', 'project', { opts: projOpts(ps), value: pid })}${fld('Type', 'type', { opts: SERVICE_TYPES, value: 'Defect' })}${fld('Date', 'date', { type: 'date', value: TODAY })}</div>
    <div class="row2">${fld('Title', 'title', { req: true, ph: 'e.g. Seepage below terrace OHT' })}${fld('Location', 'location', { req: true, ph: 'e.g. First floor · Bedroom 2' })}</div>
    ${fld('Description', 'description', { type: 'textarea', req: true, ph: 'What was found or what needs to be done' })}
    <div class="row3">${fld('Responsible', 'resp', { opts: respOpts(proj(pid)) })}${fld('Contractor name', 'contractor', { ph: 'If a contractor is responsible' })}${fld('Status', 'status', { opts: ['Reported', 'In progress'] })}</div>
    <div class="row2">${photoInput('svBefore', { label: 'Before photos', sample: 'defect', camera: true })}<div class="field"><span>Attachments</span><input class="input" type="file" id="svFiles" multiple style="padding-top:7px"><small>Reports, quotations, warranty cards — names are kept for this demo</small></div></div>
    <div class="row2">${fld('Follow-up date', 'fuDate', { type: 'date' })}${fld('Follow-up work', 'fuNote', { ph: 'Optional, e.g. Re-check after the next rain' })}</div></div>`,
    onOpen: m => $('[name=project]', m).addEventListener('change', e => { $('[name=resp]', m).innerHTML = respOpts(proj(e.target.value)).map(([v, l]) => `<option value="${v}">${esc(l)}</option>`).join(''); }),
    onSubmit: d => {
      if (d.resp === 'contractor' && !d.contractor) { toast('Enter the contractor name', 'lock'); return false; }
      if (!!d.fuDate !== !!d.fuNote) { toast('Enter both the follow-up date and the work', 'lock'); return false; }
      const n = (DB.services || []).length + 1, files = [...$('#svFiles').files];
      const s = { id: nid('sv'), ref: `SRV-${String(100 + n).padStart(4, '0')}`, project: d.project, date: d.date, type: d.type, title: d.title, description: d.description, location: d.location, responsible: d.resp === 'contractor' ? d.contractor : d.resp,
        materials: [], labour: 0, other: 0, status: d.status, before: takePicks('svBefore'), after: [], attachments: files.map(f => ({ name: f.name, size: f.size })), followUp: d.fuDate ? { date: d.fuDate, note: d.fuNote, done: false } : null,
        log: [{ at: Date.now(), by: SESSION, status: 'Reported', note: d.description }], reportedBy: SESSION, expensed: false };
      if (d.status === 'In progress') s.log.push({ at: Date.now(), by: SESSION, status: 'In progress', note: 'Work started.' });
      (DB.services ||= []).unshift(s);
      const p = proj(d.project);
      notify([p.pm, p.engineer, user(s.responsible) ? s.responsible : null], `${d.type} recorded on ${p.name}: ${d.title}`, `#/service?sv=${s.id}`, 'service');
      logAct(`recorded a ${d.type.toLowerCase()}: ${d.title}`, d.project, 'site'); commit(`${s.ref} recorded`);
    } });
};
ACT.svStatus = el => {
  const s = DB.services.find(x => x.id === el.dataset.id), to = el.dataset.to; closeDrawer();
  const done = to === 'Completed';
  openModal({ title: `${to === 'Closed' ? 'Close' : `Mark ${to.toLowerCase()}`} · ${esc(s.ref)}`, sub: esc(s.title), wide: done, body: `<div class="form">
    ${fld(done ? 'Work done' : to === 'Closed' ? 'Closing remarks' : 'Update', 'note', { type: 'textarea', req: true, ph: done ? 'What was repaired or replaced, and how it was checked' : to === 'Closed' ? 'e.g. Client inspected and signed off' : 'e.g. Contractor started work' })}
    ${done && canMoney() ? `<div class="form-sec">Costs</div>${matRows(s.materials)}<div class="row2">${fld('Labour cost (₹)', 'labour', { type: 'number', value: s.labour || '', min: 0 })}${fld('Other expenses (₹)', 'other', { type: 'number', value: s.other || '', min: 0 })}</div>
      ${photoInput('svAfter', { label: 'After photos', sample: 'after', camera: true })}
      ${s.expensed ? '' : `<label class="check"><input type="checkbox" name="expense" checked> Add the total cost to ${esc(proj(s.project).name)}'s site expenses</label>`}` : done ? photoInput('svAfter', { label: 'After photos', sample: 'after', camera: true }) + '<p class="muted" style="font-size:12.5px">Costs are recorded by the Owner or Accounts.</p>' : ''}</div>`,
    onSubmit: d => {
      if (done) { if (canMoney()) { s.materials = readMats(d); s.labour = +d.labour || 0; s.other = +d.other || 0; } s.after.push(...takePicks('svAfter')); }
      s.status = to; s.log.push({ at: Date.now(), by: SESSION, status: to, note: d.note });
      if (done && canMoney() && d.expense && svCost(s) > 0 && !s.expensed) { DB.expenses.unshift({ id: nid('e'), project: s.project, date: TODAY, category: 'Site misc.', item: `Service ${s.ref}: ${s.title}`, vendor: user(s.responsible) ? 'Own team' : s.responsible, amount: svCost(s), mode: 'Bank transfer', by: SESSION, service: s.id }); s.expensed = true; }
      const p = proj(s.project);
      notify([p.pm, s.reportedBy], `${s.ref} ${to.toLowerCase()}: ${s.title} · ${p.name}`, `#/service?sv=${s.id}`, 'service');
      logAct(`marked ${s.ref} ${to.toLowerCase()} (${s.title})`, s.project, 'site'); commit(`${s.ref} ${to.toLowerCase()}`); setTimeout(() => showService(s.id), 60);
    } });
};
ACT.svFollow = el => {
  const s = DB.services.find(x => x.id === el.dataset.id); closeDrawer();
  openModal({ title: 'Follow-up work', sub: `${esc(s.ref)} · ${esc(s.title)}`, body: `<div class="form"><div class="row2">${fld('Date', 'date', { type: 'date', req: true, value: s.followUp?.date || shiftD(TODAY, 7) })}<div></div></div>${fld('Work to do', 'note', { req: true, value: s.followUp && !s.followUp.done ? s.followUp.note : '' })}</div>`,
    onSubmit: d => { s.followUp = { date: d.date, note: d.note, done: false }; s.log.push({ at: Date.now(), by: SESSION, status: s.status, note: `Follow-up scheduled for ${fmtD(d.date)}: ${d.note}` }); commit('Follow-up scheduled'); setTimeout(() => showService(s.id), 60); } });
};
ACT.fuDoneSv = el => { const s = DB.services.find(x => x.id === el.dataset.id); s.followUp.done = true; s.log.push({ at: Date.now(), by: SESSION, status: s.status, note: `Follow-up done: ${s.followUp.note}` }); logAct(`completed a follow-up on ${s.ref}`, s.project, 'site'); closeDrawer(); commit('Follow-up marked done'); };
