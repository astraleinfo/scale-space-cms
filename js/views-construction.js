/* Projects, Site Operations, Progress & History */
'use strict';

const STD_STAGES = ['Site preparation', 'Foundation', 'Plinth', 'Superstructure', 'Brickwork', 'Roofing', 'Plastering', 'Finishes', 'Handover'];
const PROJECT_TYPES = ['Independent villa', 'Independent house', 'Residential apartments', 'Commercial complex', 'Commercial showroom', 'Marriage hall', 'Farmhouse', 'Interior fit-out', 'School building', 'Hospital extension', 'Godown / warehouse', 'Renovation'];
const PROJECT_STATUSES = ['On track', 'At risk', 'Delayed', 'On hold', 'Completed'];
const TRADE_LIST = ['Mason', 'Helper', 'Carpenter', 'Bar bender', 'Electrician', 'Plumber', 'Painter', 'Welder', 'Tile layer'];
const WEATHER_OPTS = ['Sunny', 'Cloudy', 'Light rain', 'Heavy rain'];
const weatherIco = w => w === 'Sunny' ? 'sun' : /rain/i.test(w) ? 'rain' : 'cloud';

/* ================= Projects ================= */
function projectCard(p) {
  const team = [p.pm, p.engineer, p.supervisor].map(user).filter(Boolean);
  const crew = DB.workers.filter(w => w.project === p.id && w.status === 'Active').length;
  return `<a class="card pcard" href="#/projects/${p.id}">
    <div class="top"><div class="nm"><div class="code">${esc(p.code)} · ${esc(p.type)}</div><h3>${esc(p.name)}</h3><div class="loc">${ico('pin', 'sm')}${esc(p.location)}, ${esc(p.city)}</div></div>${badge(p.status)}</div>
    <div><div class="row" style="margin-bottom:8px"><span>${esc(p.stages[p.stage])}</span><span class="muted">Stage ${p.stage + 1} of ${p.stages.length}</span></div>${meter(p.progress, projTone(p), p.status === 'Completed' ? null : planPct(p))}</div>
    <div class="row"><span class="muted">Client</span><span>${esc(p.client.name)}</span></div>
    <div class="foot"><span class="avs">${team.map(u => av(u.name, 'sm')).join('')}</span><span>${p.status === 'Completed' ? `Handed over ${fmtDY(p.completed || p.end)}` : `${plural(crew, 'worker')} · due ${fmtDY(p.end)}`}</span></div>
  </a>`;
}
INPUT.projQ = el => { setQ({ q: el.value }); const i = $('[data-input="projQ"]'); if (i) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); } };

VIEWS.projects = () => {
  if (ROUTE.parts[0]) return projectDetail(ROUTE.parts[0]);
  const { status = '', q = '', type = '', view = 'cards' } = ROUTE.q;
  const all = myProjects();
  const counts = s => all.filter(p => p.status === s).length;
  const list = all.filter(p => (!status || p.status === status) && (!type || p.type === type) && (!q || `${p.name} ${p.code} ${p.client.name} ${p.city}`.toLowerCase().includes(q.toLowerCase())));
  const types = [...new Set(all.map(p => p.type))];
  const chips = [['', 'All', all.length], ...PROJECT_STATUSES.map(s => [s, s, counts(s)])].filter(c => c[2] || !c[0]);
  const content = !list.length ? `<div class="card">${emptyPage('No projects match', 'Try a different status or search.')}</div>` : view === 'cards'
    ? `<div class="pcards">${list.map(projectCard).join('')}</div>`
    : `<div class="card"><div class="table-wrap"><table class="t stack-sm"><thead><tr><th>Project</th><th>Client</th><th>Stage</th><th style="min-width:160px">Progress</th><th>Status</th>${canMoney() ? '<th class="r">Value</th>' : ''}<th>Due</th></tr></thead><tbody>
      ${list.map(p => `<tr class="click" data-act="go" data-href="#/projects/${p.id}"><td class="strong full">${esc(p.name)}<span class="sub">${p.code} · ${esc(p.city)}</span></td><td class="hide-sm">${esc(p.client.name)}</td><td class="hide-sm">${esc(p.stages[p.stage])}</td><td>${meter(p.progress, projTone(p))}</td><td>${badge(p.status)}</td>${canMoney() ? `<td class="r hide-sm">${inrS(p.value)}</td>` : ''}<td class="hide-sm nowrap">${fmtDY(p.end)}</td></tr>`).join('')}
      </tbody></table></div></div>`;
  return `${pageHead('Projects', `${plural(all.length, 'project')} · ${all.filter(p => !['Completed'].includes(p.status)).length} ongoing`, can('projects') ? btn('New project', 'newProject', { icon: 'plus', cls: 'primary' }) : '')}
    <div class="stack">
      <div class="chips">${chips.map(([v, l, n]) => `<button class="chip ${status === v ? 'on' : ''}" data-act="setQ" data-k="status" data-v="${v}">${l} <span class="n">${n}</span></button>`).join('')}</div>
      <div class="toolbar">
        <div class="inline-search">${ico('search', 'sm')}<input class="input" type="search" placeholder="Search by name, client, city" value="${esc(q)}" data-input="projQ" aria-label="Search projects"></div>
        <select class="select" data-change="setQ" data-k="type" aria-label="Project type"><option value="">All types</option>${types.map(t => `<option ${t === type ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select>
        <span class="grow"></span>
        <div class="seg" role="group" aria-label="View"><button class="${view === 'cards' ? 'on' : ''}" data-act="setQ" data-k="view" data-v="cards">${ico('grid', 'sm')}Cards</button><button class="${view === 'table' ? 'on' : ''}" data-act="setQ" data-k="view" data-v="table">${ico('rows', 'sm')}Table</button></div>
      </div>
    </div>
    ${content}`;
};

function projectDetail(id) {
  const p = proj(id);
  if (!p || !myProjectIds().has(id)) return `<a class="crumb" href="#/projects">${ico('arrowL', 'sm')}Projects</a>${emptyPage('Project not found', 'It may not be assigned to you.')}`;
  const tab = ROUTE.q.tab || 'overview';
  const todayRep = reportFor(TODAY, p.id);
  const left = daysFrom(p.end);
  const pdocs = DB.documents.filter(d => d.project === id && docVisible(d));
  const tabsL = [['overview', 'Overview'], ['floors', p.type === 'Interior fit-out' ? 'Zones' : 'Floors', projLevels(p).length || null], ['progress', 'Progress & history'], ['site', 'Site activity'], ['documents', 'Documents', pdocs.filter(d => !isMedia(d)).length], ['media', 'Site photos & videos', pdocs.filter(isMedia).length], ['notes', 'Notes', projNotes(id).length || null]];
  if (canSee('materials')) tabsL.push(['materials', 'Materials', (DB.purchases || []).filter(pu => pu.project === id).length || null]);
  if (canSee('service')) tabsL.push(['service', 'Service history', (DB.services || []).filter(s => s.project === id && svOpen(s)).length || null]);
  if (canSee('finance')) tabsL.push(['finance', 'Finance']);
  let body = '';
  if (tab === 'overview') {
    const crew = {}; const seen = new Set(); DB.reports.filter(r => r.project === id && r.status === 'Submitted' && daysFrom(r.date) >= -6).forEach(r => r.crew.forEach(c => { if (!seen.has(c.wid || c.name)) { seen.add(c.wid || c.name); crew[c.trade] = (crew[c.trade] || 0) + 1; } }));
    const team = [['Project manager', p.pm], ['Site engineer', p.engineer], ['Supervisor', p.supervisor]];
    const crewN = sum(Object.values(crew)), crewMax = Math.max(1, ...Object.values(crew));
    const tel = x => esc(String(x || '').replace(/\s/g, ''));
    body = `${p.status === 'On hold' && p.holdReason ? `<div class="banner warn">${ico('alert')}<span><b>On hold:</b> ${esc(p.holdReason)}</span></div>` : ''}
      <div class="po-grid">
        <div class="po-main">
          <section class="card po-card"><div class="card-head"><h2>Project details</h2></div>
            <div class="po-facts">
              <div><span>${ico('building', 'sm')}Type</span><b>${esc(p.type)}</b></div>
              <div><span>${ico('grid', 'sm')}Built-up area</span><b>${num(p.area)} sq.ft</b><small>${esc(p.floors)}</small></div>
              <div><span>${ico('pin', 'sm')}Site</span><b>${esc(p.location)}</b><small>${esc(p.city)}</small></div>
              <div><span>${ico('cal', 'sm')}Started</span><b>${fmtDY(p.start)}</b></div>
              <div><span>${ico('flag', 'sm')}Target completion</span><b>${fmtDY(p.end)}</b>${p.status !== 'Completed' && completionImpact(p).cal ? `<small class="warn">revised ${fmtDY(completionImpact(p).revised)}</small>` : ''}</div>
              ${canMoney() && (canSee('finance') || role() === 'owner') ? `<div><span>${ico('rupee', 'sm')}Contract value</span><b>${inr(p.value)}</b></div>` : ''}
            </div></section>
          <section class="card po-card"><div class="card-head"><h2>Site crew</h2><span class="sub">${plural(crewN, 'worker')} in the last 7 days</span>
              <div class="po-acts"><a class="btn sm" href="#/site?tab=workers&p=${p.id}">${ico('users', 'sm')}Register</a>${can('site') && p.status !== 'Completed' ? btn('Add worker', 'newWorker', { icon: 'plus', cls: 'sm', data: `data-p="${p.id}"` }) : ''}</div></div>
            <div class="card-body">${crewN ? `<div class="po-crew">${Object.entries(crew).sort((a, b) => b[1] - a[1]).map(([t, v]) => `<div><span>${esc(t)}</span><i><em style="width:${v / crewMax * 100}%"></em></i><b>${v}</b></div>`).join('')}</div>` : '<p class="muted">No workers reported in the last 7 days.</p>'}</div></section>
        </div>
        <aside class="po-side">
          <section class="card po-card po-client"><span class="po-k">Client</span>
            <div class="po-who">${av(p.client.name, 'lg')}<div><b>${esc(p.client.name)}</b><span>${esc(p.client.address)}</span></div></div>
            <div class="po-cta"><a class="btn sm" href="tel:${tel(p.client.phone)}">${ico('phone', 'sm')}Call</a><a class="btn sm" href="mailto:${esc(p.client.email)}">${ico('mail', 'sm')}Email</a></div>
            <div class="po-contact"><span>${esc(p.client.phone)}</span><span>${esc(p.client.email)}</span></div></section>
          <section class="card po-card"><span class="po-k">Team</span>
            <ul class="po-team">${team.map(([l, uid]) => { const u = user(uid); return `<li>${av(u.name)}<div><b>${esc(u.name)}</b><span>${l}</span></div><a class="iconbtn" href="tel:${tel(u.phone)}" aria-label="Call ${esc(u.name)}" title="Call ${esc(u.name)}">${ico('phone', 'sm')}</a></li>`; }).join('')}</ul></section>
        </aside>
      </div>`;
  } else if (tab === 'floors') { body = floorsTab(p); if (ROUTE.q.fl) after(() => ACT.scrollFloor({ dataset: { id: ROUTE.q.fl } })); }
  else if (tab === 'progress') body = progressDetail(p);
  else if (tab === 'site') {
    const days = []; for (let i = -13; i <= 0; i++) days.push(dayOff(i));
    const reps = DB.reports.filter(r => r.project === id).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 8);
    body = `<div class="split"><span class="muted">Daily reports from site — work done, crew and wages</span>${can('site') && p.status !== 'Completed' ? `<a class="btn primary sm" href="#/site/report/new?p=${id}">${ico('plus', 'sm')}New daily report</a>` : ''}</div>
      <div class="card"><div class="card-head"><h2>Workers on site</h2><span class="sub">Last 14 days, from daily reports</span></div>
      ${barChart(days.map(d => { const r = reportFor(d, id); return { label: String(parseD(d).getDate()), value: r ? r.crew.length : 0, tip: `<b>${fmtD(d)}</b> · ${r ? `${r.crew.length} workers${canMoney() ? ` · ${inr(crewWages(r))} wages` : ''}` : 'no report'}` }; }), { h: 260, w: 1200, fmt: v => Math.round(v), hiLast: true }).replace('class="chart wide"', 'class="chart wide" style="padding:12px 24px 20px"')}</div>
      ${reportList(reps)}`;
  } else if (tab === 'documents') body = projectDocsTab(p, pdocs.filter(d => !isMedia(d)));
  else if (tab === 'media') { const list = pdocs.filter(isMedia); body = `<div class="split"><span class="muted">${plural(list.filter(d => !isVideo(d)).length, 'photo')} · ${plural(list.filter(isVideo).length, 'video')} · grouped by construction stage</span>${can('documents') ? btn('Upload photos & videos', 'upload', { icon: 'upload', cls: 'sm', data: `data-p="${id}" data-kind="media"` }) : ''}</div>${mediaGallery(list, { byStage: true, showProject: false })}`; }
  else if (tab === 'notes') body = projectNotesTab(p);
  else if (tab === 'finance') body = canSee('finance') && canMoney() ? projectFinanceTab(p) : `<div class="card">${emptyPage('Financial details are restricted', 'Only the Owner and the finance team can see project finances.')}</div>`;
  else if (tab === 'materials') { if (ROUTE.q.pu) after(() => showPurchase(ROUTE.q.pu)); body = projectMaterialsTab(p); }
  else if (tab === 'service') { if (ROUTE.q.sv) after(() => showService(ROUTE.q.sv)); body = `<div class="split"><span class="muted">Maintenance, repairs, inspections and defects${p.status === 'Completed' ? ' after handover' : ''}</span>${can('service') ? btn('Record service activity', 'newService', { icon: 'plus', cls: 'sm', data: `data-p="${id}"` }) : ''}</div>${serviceList({ pid: id })}`; }

  const pl = planPct(p), dv = p.progress - pl, done = p.status === 'Completed', R = 46, C = 2 * Math.PI * R;
  const workers = todayRep ? todayRep.crew.length : null;
  return `<div class="pv"><a class="crumb" href="#/projects">${ico('arrowL', 'sm')}All projects</a>
    <section class="pv-hero">
      <div class="pv-top"><div class="pv-id"><span class="pv-code">${esc(p.code)} · ${esc(p.type)}</span><h1>${esc(p.name)}</h1>
          <div class="pv-meta"><span>${ico('pin', 'sm')}${esc(p.location)}, ${esc(p.city)}</span><span>${ico('user', 'sm')}${esc(p.client.name)}</span><span>${ico('cal', 'sm')}${fmtD(p.start)} – ${fmtDY(p.end)}</span></div></div>
        <div class="pv-acts">${badge(p.status)}${can('projects') ? btn('Edit', 'editProject', { icon: 'edit', cls: 'pv-ghost', data: `data-id="${p.id}"` }) : ''}${can('progress') ? btn('Post update', 'newUpdate', { icon: 'plus', cls: 'primary', data: `data-p="${p.id}"` }) : ''}</div></div>
      <div class="pv-stats">
        <div class="pv-ring"><svg viewBox="0 0 108 108" aria-hidden="true"><circle class="trk" r="${R}" cx="54" cy="54"/><circle class="pl" r="${R}" cx="54" cy="54" stroke-dasharray="${pl / 100 * C} ${C}"/><circle class="ac ${done ? 'ok' : dv >= -5 ? 'ok' : dv >= -15 ? 'warn' : 'bad'}" r="${R}" cx="54" cy="54" stroke-dasharray="${p.progress / 100 * C} ${C}"/></svg>
          <div><b>${p.progress}<small>%</small></b><span>${done ? 'complete' : `${dv >= 0 ? '+' : ''}${dv} pts vs plan`}</span></div></div>
        <div class="pv-stage"><div class="pv-sh"><span>Stage ${p.stage + 1} of ${p.stages.length}</span><b>${esc(p.stages[p.stage])}</b>${can('projects') && !done ? `<button class="pv-link" data-act="updateStage" data-id="${p.id}">Update stage</button>` : ''}</div>
          <div class="pv-seg">${p.stages.map((st, i) => `<i class="${i < p.stage || done ? 'd' : i === p.stage ? 'c' : ''}" title="${esc(st)}"></i>`).join('')}</div>
          <div class="pv-sl"><span>${esc(p.stages[0])}</span><span>${esc(p.stages[p.stages.length - 1])}</span></div></div>
        <div class="pv-mini"><span>${ico('users', 'sm')}Workers today</span><b>${workers ?? '—'}</b><small>${todayRep ? `<a href="#/site/report/${todayRep.id}">view report</a>` : done || p.status === 'On hold' ? 'no site work' : can('site') ? `<a href="#/site/report/new?p=${p.id}">report pending</a>` : 'report pending'}</small></div>
        <div class="pv-mini"><span>${ico('clock', 'sm')}${done ? 'Handed over' : 'Time left'}</span><b>${done ? fmtD(p.completed || p.end) : left >= 0 ? `${left}<small> days</small>` : `${-left}<small> days late</small>`}</b><small>target ${fmtD(p.end)}</small></div>
      </div></section>
    <div class="pv-tabs">${tabs(tabsL, tab)}</div>
    ${body}</div>`;
}

function projectForm(p = {}, enq = null) {
  const c = p.client || {};
  return `<div class="form">
    ${enq ? `<div class="form-note">${ico('convert')}<span>Converting enquiry from <b>${esc(enq.name)}</b>. Details have been filled in from the enquiry${enq.quote ? ` and quotation ${esc(enq.quote.no)}` : ''}.</span></div>` : ''}
    <div class="row2">${fld('Project name', 'name', { req: true, value: p.name, ph: 'e.g. Prakash Residence' })}${fld('Project type', 'type', { opts: PROJECT_TYPES, value: p.type || 'Independent house' })}</div>
    <div class="form-sec">Client</div>
    <div class="row2">${fld('Client name', 'cname', { req: true, value: c.name })}${fld('Phone', 'cphone', { req: true, type: 'tel', value: c.phone })}</div>
    <div class="row2">${fld('Email', 'cemail', { type: 'email', value: c.email })}${fld('Address', 'caddr', { value: c.address })}</div>
    <div class="form-sec">Site & schedule</div>
    <div class="row2">${fld('Site location', 'location', { req: true, value: p.location, ph: 'Street / area' })}${fld('Town / city', 'city', { req: true, value: p.city || 'Mayiladuthurai' })}</div>
    <div class="row3">${fld('Start date', 'start', { type: 'date', req: true, value: p.start || TODAY })}${fld('Target completion', 'end', { type: 'date', req: true, value: p.end || shiftD(TODAY, 300) })}${canMoney() ? fld('Contract value (₹)', 'value', { type: 'number', req: true, value: p.value || '', min: 1 }) : `<div class="field"><span>Contract value</span><div class="form-note" style="padding:9px 12px">${ico('lock', 'sm')}<span>Set by the Owner or Accounts</span></div></div>`}</div>
    <div class="row2">${fld('Built-up area (sq.ft)', 'area', { type: 'number', value: p.area || '' })}${fld('Floors / units', 'floors', { value: p.floors || 'G+1' })}</div>
    <div class="form-sec">Team</div>
    <div class="row3">${fld('Project manager', 'pm', { opts: userOpts(['pm', 'owner']).map(([v, l]) => [v, l.split(' · ')[0]]), value: p.pm })}${fld('Site engineer', 'engineer', { opts: userOpts(['engineer']).map(([v, l]) => [v, l.split(' · ')[0]]), value: p.engineer })}${fld('Supervisor', 'supervisor', { opts: userOpts(['supervisor']).map(([v, l]) => [v, l.split(' · ')[0]]), value: p.supervisor })}</div>
  </div>`;
}
function createProject(d, enq) {
  const id = nid('p'), n = DB.projects.length + 1;
  const yr = String(parseD(TODAY).getFullYear()).slice(2);
  const p = { id, code: `SSB-${yr}${pad(n + 1)}`, name: d.name, type: d.type, area: +d.area || 0, floors: d.floors,
    client: { name: d.cname, phone: d.cphone, email: d.cemail, address: d.caddr }, location: d.location, city: d.city, start: d.start, end: d.end, value: +d.value || 0,
    stages: d.type === 'Interior fit-out' ? ['Design approval', 'Civil changes', 'False ceiling', 'Electrical', 'Carpentry', 'Flooring', 'Painting', 'Handover'] : STD_STAGES.slice(),
    stage: 0, progress: 0, status: 'On track', pm: d.pm, engineer: d.engineer, supervisor: d.supervisor };
  p.levels = floorPlan(p);
  DB.projects.unshift(p);
  const span = (parseD(p.end) - parseD(p.start)) / 864e5;
  p.stages.forEach((st, i) => DB.milestones.push({ id: nid('m'), project: id, name: st, due: shiftD(p.start, Math.round(span * (i + 1) / p.stages.length)), done: null, status: i === 0 ? 'In progress' : 'Not started', pct: 0 }));
  [['Advance on agreement', 10], ['Foundation complete', 15], ['Plinth complete', 10], ['Roof slab', 25], ['Brickwork & plastering', 20], ['Finishes', 15], ['Handover', 5]].forEach(([label, pct], i) => DB.billing.push({ id: nid('b'), project: id, label, pct, amount: Math.round(p.value * pct / 100), billed: i === 0, due: i === 0 ? TODAY : shiftD(p.start, Math.round(span * (i / 7))) }));
  DB.updates.unshift({ id: nid('up'), project: id, at: Date.now(), by: SESSION, text: enq ? `Project created from enquiry ${enq.name}.` : 'Project created.', pct: 0 });
  if (enq) { enq.status = 'Won'; enq.project = id; if (enq.quote) enq.quote.status = 'Accepted'; }
  logAct(`created project ${p.name}`, id, 'project');
  return p;
}
ACT.newProject = () => { if (!guard(can('projects'), 'create projects')) return; openModal({ title: 'New project', sub: 'Set up a construction project with its client, site and team.', wide: true, body: projectForm(), onSubmit: d => { if (d.end <= d.start) { toast('Target completion must be after the start date', 'lock'); return false; } const p = createProject(d); saveDB(); go(`#/projects/${p.id}`); toast(`${p.name} created`); } }); };
ACT.editProject = el => {
  const p = proj(el.dataset.id); if (!guard(can('projects'), 'edit projects')) return;
  openModal({ title: 'Edit project', sub: `${p.code} · ${esc(p.name)}`, wide: true, body: projectForm(p), onSubmit: d => {
    Object.assign(p, { name: d.name, type: d.type, area: +d.area || 0, floors: d.floors, location: d.location, city: d.city, start: d.start, end: d.end, value: canMoney() ? +d.value : p.value, pm: d.pm, engineer: d.engineer, supervisor: d.supervisor, client: { name: d.cname, phone: d.cphone, email: d.cemail, address: d.caddr } });
    logAct(`edited project details for ${p.name}`, p.id); commit('Project updated');
  } });
};
ACT.updateStage = el => {
  const p = proj(el.dataset.id); if (!guard(can('projects'), 'update stages')) return;
  openModal({ title: 'Update construction stage', sub: esc(p.name), body: `<div class="form">
    ${fld('Current stage', 'stage', { opts: p.stages.map((s, i) => [i, `${i + 1}. ${s}`]), value: p.stage })}
    <div class="row2">${fld('Overall progress (%)', 'progress', { type: 'number', value: p.progress, min: 0, req: true })}${fld('Status', 'status', { opts: PROJECT_STATUSES, value: p.status })}</div>
    ${fld('Note', 'note', { type: 'textarea', ph: 'What changed on site?' })}</div>`, onSubmit: d => {
    const st = +d.stage, pct = Math.max(0, Math.min(100, +d.progress));
    DB.milestones.filter(m => m.project === p.id).forEach((m, i) => {
      if (i < st && m.status !== 'Completed') { m.status = 'Completed'; m.pct = 100; m.done = TODAY; }
      else if (i === st && d.status !== 'Completed') { m.status = 'In progress'; m.done = null; m.pct = Math.max(m.pct, 10); }
      else if (i === st && d.status === 'Completed') { m.status = 'Completed'; m.pct = 100; m.done = TODAY; }
      else if (i > st) { m.status = 'Not started'; m.pct = 0; m.done = null; }
    });
    const moved = st !== p.stage;
    Object.assign(p, { stage: st, progress: pct, status: d.status });
    if (d.status === 'Completed') p.completed = TODAY;
    DB.updates.unshift({ id: nid('up'), project: p.id, at: Date.now(), by: SESSION, text: (moved ? `Stage moved to ${p.stages[st]}. ` : '') + (d.note || `Progress updated to ${pct}%.`), pct });
    logAct(`updated ${p.name} to ${p.stages[st]} (${pct}%)`, p.id, 'progress'); commit('Stage updated');
  } });
};

/* ================= Progress & history ================= */
VIEWS.progress = () => {
  const ps = myProjects();
  const pid = ROUTE.q.p;
  const openStops = DB.delays.filter(d => myProjectIds().has(d.project) && d.status === 'Open').length;
  const PT = tabs([['schedule', `${ico('flag', 'sm')}Schedule & history`], ['stoppages', `${ico('alert', 'sm')}Work stoppages & delays`, openStops || null]], ROUTE.q.tab === 'stoppages' ? 'stoppages' : 'schedule');
  if (ROUTE.q.tab === 'stoppages') return `${pageHead('Progress & History', 'Non-working days, delay reasons and their impact on planned completion.', can('progress') || can('site') ? btn('Record stoppage', 'newDelay', { icon: 'plus', cls: 'primary' }) : '')}${PT}${stoppagesTab()}`;
  const p = pid && ps.find(x => x.id === pid);
  if (p) return `${pageHead('Progress & History', 'Milestones, delays and the day-by-day record of each project.', can('progress') ? btn('Post update', 'newUpdate', { icon: 'plus', cls: 'primary', data: `data-p="${p.id}"` }) : '')}
    ${PT}<div class="toolbar">${projSelect(p.id, { all: true })}<span class="grow"></span><a class="btn ghost sm" href="#/projects/${p.id}">Open project ${ico('arrowR', 'sm')}</a></div>${progressDetail(p)}`;
  const rows = ps.map(p => { const next = DB.milestones.find(m => m.project === p.id && m.status !== 'Completed'); const open = DB.delays.filter(d => d.project === p.id && d.status === 'Open'); return { p, next, open, varc: p.progress - planPct(p) }; });
  const behind = rows.filter(r => r.p.status !== 'Completed' && r.varc < -5).length;
  const openDelays = DB.delays.filter(d => myProjectIds().has(d.project) && d.status === 'Open');
  return `${pageHead('Progress & History', 'Milestones, delays and the day-by-day record of each project.', can('progress') ? btn('Post update', 'newUpdate', { icon: 'plus', cls: 'primary' }) : '')}
    ${PT}<div class="kpis k3"><div class="kpi"><div class="l">Average completion</div><div class="v">${Math.round(sum(rows.filter(r => r.p.status !== 'Completed'), r => r.p.progress) / Math.max(1, rows.filter(r => r.p.status !== 'Completed').length))}%</div><div class="s">ongoing projects</div></div>
      <div class="kpi"><div class="l">Behind schedule</div><div class="v">${behind}</div><div class="s">more than 5 pts behind plan</div></div>
      <div class="kpi"><div class="l">Open delays</div><div class="v">${openDelays.length}</div><div class="s">${num(sum(openDelays, stopDays))} days lost so far · <a href="#/progress?tab=stoppages">details</a></div></div></div>
    <div class="card"><div class="card-head"><h2>Schedule overview</h2><span class="legend"><span><i style="width:2px;height:12px;background:var(--ink)"></i>Planned for today</span></span></div>
    <div class="table-wrap" style="margin-top:12px"><table class="t stack-sm"><thead><tr><th>Project</th><th style="min-width:200px">Actual vs planned</th><th class="r">Variance</th><th>Next milestone</th><th>Delays</th></tr></thead><tbody>
    ${rows.map(({ p, next, open, varc }) => `<tr class="click" data-act="setQ" data-k="p" data-v="${p.id}"><td class="strong full">${esc(p.name)}<span class="sub">${esc(p.stages[p.stage])} · ${badge(p.status)}</span></td><td>${meter(p.progress, projTone(p), p.status === 'Completed' ? null : planPct(p))}</td>
      <td class="r ${varc < -5 ? '' : ''}">${p.status === 'Completed' ? '—' : `<span style="color:var(${varc < -5 ? '--bad' : varc < 0 ? '--warn' : '--ok'})">${varc > 0 ? '+' : ''}${varc} pts</span>`}</td>
      <td class="hide-sm">${next ? `${esc(next.name)}<span class="sub">due ${fmtD(next.due)}${daysFrom(next.due) < 0 ? ' · overdue' : ''}</span>` : '<span class="muted">All complete</span>'}</td>
      <td class="hide-sm">${open.length ? badge(`${open.length} open`, 'bad') : '<span class="muted">None</span>'}</td></tr>`).join('')}
    </tbody></table></div></div>
    <div class="card"><div class="card-head"><h2>Recent updates</h2><span class="sub">All projects</span></div><div class="card-body">${historyTimeline(null, 8)}</div></div>`;
};

function progressDetail(p) {
  const ms = DB.milestones.filter(m => m.project === p.id);
  const dl = DB.delays.filter(d => d.project === p.id).sort((a, b) => b.date.localeCompare(a.date));
  const recentWork = DB.reports.filter(r => r.project === p.id && r.status === 'Submitted').sort((a, b) => b.date.localeCompare(a.date)).slice(0, 3).flatMap(r => r.work.map(w => ({ ...w, r })));
  const ok = can('progress');
  return `${projLevels(p).length ? `<div class="card floors-card"><div class="card-head"><h2>${p.type === 'Interior fit-out' ? 'Zone' : 'Floor'}-wise progress</h2><span class="sub">${plural(activeActs(p).length, 'activity', 'activities')} in progress</span><a class="btn ghost sm" href="#/projects/${p.id}?tab=floors">Open ${p.type === 'Interior fit-out' ? 'zones' : 'floors'} ${ico('arrowR', 'sm')}</a></div>${floorStack(p)}</div>` : ''}
  <div class="grid g-main">
    <div class="card"><div class="card-head"><h2>Milestones</h2><span class="sub">${ms.filter(m => m.status === 'Completed').length} of ${ms.length} complete</span></div>
      <div class="table-wrap" style="margin-top:12px"><table class="t stack-sm"><thead><tr><th>Milestone</th><th>Due</th><th style="min-width:130px">Progress</th><th>Status</th>${ok ? '<th></th>' : ''}</tr></thead><tbody>
      ${ms.map(m => { const late = m.status !== 'Completed' && daysFrom(m.due) < 0; const lateDone = m.done && m.done > m.due; return `<tr><td class="strong full">${esc(m.name)}${m.done ? `<span class="sub">Completed ${fmtDY(m.done)}${lateDone ? ` · ${daysFrom(m.done) - daysFrom(m.due)} days late` : ''}</span>` : ''}</td>
        <td class="nowrap ${late ? '' : ''}">${fmtD(m.due)}${late ? `<span class="sub" style="color:var(--bad)">${-daysFrom(m.due)} days overdue</span>` : ''}</td><td>${meter(m.pct, m.status === 'Completed' ? 'ok' : late ? 'bad' : '')}</td><td>${badge(late && m.status !== 'Completed' ? 'Overdue' : m.status)}</td>
        ${ok ? `<td class="r">${m.status !== 'Completed' ? `<button class="btn xs" data-act="editMilestone" data-id="${m.id}">Update</button>` : ''}</td>` : ''}</tr>`; }).join('')}
      </tbody></table></div></div>
    <div class="stack" style="margin-top:0">
      <div class="card"><div class="card-head"><h2>Stoppages & delays</h2><a class="btn ghost sm" href="#/progress?tab=stoppages&p=${p.id}">All</a>${ok ? btn('Record', 'newDelay', { cls: 'sm', data: `data-p="${p.id}"` }) : ''}</div>
        ${(() => { const im = completionImpact(p); return im.lost ? `<div class="form-note" style="margin:12px 24px 0">${ico('clock', 'sm')}<span><b>${fmtDays(im.lost)}</b> lost · revised completion <b>${fmtDY(im.revised)}</b> (planned ${fmtDY(p.end)})</span></div>` : ''; })()}
        <ul class="list click" style="margin-top:8px">${dl.map(d => `<li style="align-items:flex-start" data-act="showStop" data-id="${d.id}"><span class="sig ${d.status === 'Open' ? 'bad' : ''}">${ico('clock', 'sm')}</span><div class="main-t"><b>${esc(d.reason)} · ${fmtDays(stopDays(d))}</b><span style="white-space:normal">${esc(d.note)}</span><span>${fmtDY(d.date)} · ${esc(stopWhere(d))}</span></div>${badge(d.status === 'Open' ? 'Ongoing' : 'Resolved', d.status === 'Open' ? 'bad' : 'ok')}</li>`).join('') || '<li class="muted">No stoppages recorded</li>'}</ul></div>
      <div class="card"><div class="card-head"><h2>Recent work completed</h2><a class="btn ghost sm" href="#/site?p=${p.id}">Daily reports</a></div>
        <ul class="list click" style="margin-top:8px">${recentWork.slice(0, 6).map(w => `<li data-act="go" data-href="#/site/report/${w.r.id}"><span class="sig ok">${ico('task', 'sm')}</span><div class="main-t"><b>${esc(w.title)}</b><span>${fmtD(w.r.date)} · ${plural(workersFor(w.r, w.id).length, 'worker')}</span></div><span class="num strong">${qtyText(w)}</span></li>`).join('') || '<li class="muted">No daily reports yet</li>'}</ul></div>
    </div></div>
    ${(() => { const m = DB.documents.filter(d => d.project === p.id && isMedia(d)).sort((a, b) => b.date.localeCompare(a.date)); return `<div class="card"><div class="card-head"><h2>Latest site photos & videos</h2><span class="sub">${plural(m.length, 'item')}</span><a class="btn ghost sm" href="#/projects/${p.id}?tab=media">View all</a></div><div class="card-body">${m.length ? mediaGrid(m.slice(0, 4), false) : '<p class="muted">No photos or videos yet.</p>'}</div></div>`; })()}
    <div class="card"><div class="card-head"><h2>Project history</h2><span class="sub">Progress updates, delays, milestones and payments</span></div><div class="card-body">${historyTimeline(p.id, 40)}</div></div>`;
}
function historyTimeline(pid, limit) {
  const ids = myProjectIds();
  const inP = x => pid ? x.project === pid : ids.has(x.project);
  const ev = [];
  DB.updates.filter(inP).forEach(u => ev.push({ t: u.at, k: 'progress', h: `<b>${esc(userName(u.by))}</b> posted an update${pid ? '' : ` on <b>${esc(proj(u.project).name)}</b>`}${u.pct != null ? ` · ${u.pct}%` : ''}`, s: u.text }));
  DB.delays.filter(inP).forEach(d => ev.push({ t: parseD(d.date).getTime() + 36e6, k: 'delay', h: `Work stoppage${pid ? '' : ` on <b>${esc(proj(d.project).name)}</b>`}: <b>${esc(d.reason)}</b> (${fmtDays(stopDays(d))}, ${esc(stopWhere(d))})`, s: d.note }));
  (DB.floorLog || []).filter(inP).forEach(l => { const p = proj(l.project), f = projLevels(p).find(x => x.id === l.floor); if (!f || !l.changes.length) return; ev.push({ t: l.at, k: 'progress', h: `<b>${esc(userName(l.by))}</b> updated <b>${esc(f.name)}</b>${pid ? '' : ` on <b>${esc(p.name)}</b>`}: ${l.changes.map(c => `${esc(f.activities.find(a => a.id === c.act)?.name || '')} ${c.to}%`).join(', ')}`, s: l.note || '' }); });
  DB.milestones.filter(m => inP(m) && m.done).forEach(m => ev.push({ t: parseD(m.done).getTime() + 54e6, k: 'milestone', h: `Milestone completed: <b>${esc(m.name)}</b>${pid ? '' : ` · ${esc(proj(m.project).name)}`}`, s: '' }));
  if (canSee('finance') && canMoney()) DB.payments.filter(inP).forEach(x => ev.push({ t: parseD(x.date).getTime() + 43e6, k: 'payment', h: `Client payment received: <b>${inr(x.amount)}</b>${pid ? '' : ` · ${esc(proj(x.project).name)}`}`, s: x.against }));
  ev.sort((a, b) => b.t - a.t);
  const list = ev.filter(e => e.t <= Date.now() + 864e5).slice(0, limit);
  return list.length ? `<ul class="timeline">${list.map(e => `<li class="k-${e.k}"><div class="when">${fmtDY(iso(new Date(e.t)))}</div><div class="what">${e.h}</div>${e.s ? `<div class="muted" style="font-size:13.5px">${esc(e.s)}</div>` : ''}</li>`).join('')}</ul>` : '<p class="muted">No history yet.</p>';
}
ACT.newUpdate = el => {
  if (!guard(can('progress'), 'post progress updates')) return;
  const ps = myProjects().filter(p => p.status !== 'Completed');
  const pid = el.dataset.p || ROUTE.q.p || ps[0]?.id;
  openModal({ title: 'Post progress update', sub: 'Share what moved forward on site.', body: `<div class="form">
    <div class="row2">${fld('Project', 'project', { opts: projOpts(ps), value: pid })}${fld('Overall progress (%)', 'pct', { type: 'number', value: proj(pid)?.progress, req: true, min: 0 })}</div>
    ${fld('Update', 'text', { type: 'textarea', req: true, ph: 'e.g. First floor roof slab cast – 42 m³' })}</div>`,
    onOpen: m => $('[name=project]', m).addEventListener('change', e => $('[name=pct]', m).value = proj(e.target.value).progress),
    onSubmit: d => { const p = proj(d.project); const pct = Math.max(0, Math.min(100, +d.pct)); p.progress = pct; DB.updates.unshift({ id: nid('up'), project: p.id, at: Date.now(), by: SESSION, text: d.text, pct }); logAct(`posted a progress update on ${p.name} (${pct}%)`, p.id, 'progress'); commit('Progress update posted'); } });
};
ACT.editMilestone = el => {
  const m = DB.milestones.find(x => x.id === el.dataset.id);
  openModal({ title: 'Update milestone', sub: `${esc(proj(m.project).name)} · ${esc(m.name)}`, body: `<div class="form"><div class="row2">${fld('Completion (%)', 'pct', { type: 'number', value: m.pct, min: 0, req: true })}${fld('Due date', 'due', { type: 'date', value: m.due })}</div>
    <label class="check"><input type="checkbox" name="complete"> Mark this milestone as completed today</label></div>`,
    onSubmit: d => { m.pct = Math.max(0, Math.min(100, +d.pct)); m.due = d.due; if (d.complete || m.pct === 100) { m.pct = 100; m.status = 'Completed'; m.done = TODAY; } else m.status = m.pct > 0 ? 'In progress' : 'Not started'; logAct(`updated milestone ${m.name}`, m.project, 'progress'); commit(m.status === 'Completed' ? 'Milestone completed' : 'Milestone updated'); } });
};
ACT.newDelay = el => {
  if (!guard(can('progress'), 'log delays')) return;
  openModal({ title: 'Log a delay', sub: esc(proj(el.dataset.p).name), body: `<div class="form"><div class="row3">${fld('Reason', 'reason', { opts: ['Weather', 'Material shortage', 'Labour shortage', 'Design change', 'Approval pending', 'Client decision pending', 'Equipment breakdown', 'Other'] })}${fld('Date', 'date', { type: 'date', value: TODAY })}${fld('Days lost', 'days', { type: 'number', value: 1, min: 1, req: true })}</div>${fld('Details', 'note', { type: 'textarea', req: true, ph: 'What caused the delay and what is the impact?' })}</div>`,
    onSubmit: d => { DB.delays.unshift({ id: nid('dl'), project: el.dataset.p, date: d.date, reason: d.reason, days: +d.days, note: d.note, status: 'Open' }); logAct(`logged a delay (${d.reason})`, el.dataset.p, 'delay'); commit('Delay logged'); } });
};
ACT.resolveDelay = el => { const d = DB.delays.find(x => x.id === el.dataset.id); d.status = 'Resolved'; logAct(`resolved a delay (${d.reason})`, d.project, 'delay'); commit('Delay marked resolved'); };
