/* Site Operations: daily construction reports and the worker register.
   A report records the work completed (with quantities), the workers who actually worked that day,
   which tasks each of them did, their wage for the day, and site photos. There is no attendance. */
'use strict';

const WORK_CATS = ['Masonry', 'Concrete', 'Reinforcement', 'Shuttering', 'Plastering', 'Electrical', 'Plumbing', 'Flooring', 'Painting', 'Carpentry', 'Fabrication', 'Excavation', 'Curing', 'General'];
const UNITS = ['sq.ft', 'cu.m', 'r.ft', 'nos', 'bricks', 'MT', 'kg', 'bags', 'points', 'trips', '%'];
const DEFAULT_WAGE = { Mason: 950, Helper: 650, Carpenter: 1000, 'Bar bender': 900, Electrician: 1000, Plumber: 950, Painter: 850, Welder: 950, 'Tile layer': 1000 };
function siteProjects() { return myProjects().filter(p => p.status !== 'Completed'); }
const reportSites = () => siteProjects().filter(p => p.status !== 'On hold');
const canEditReport = r => can('site') && (['owner', 'pm'].includes(role()) || r.by === SESSION);
const repMedia = r => DB.documents.filter(d => d.report === r.id);
const qtyText = w => `${num(w.qty)} ${w.unit}`;
const workersFor = (r, wkId) => r.crew.filter(c => c.tasks.includes(wkId));

VIEWS.site = () => {
  const [a, b, c] = ROUTE.parts;
  if (a === 'report' && b === 'new') return reportEditor(null);
  if (a === 'report' && b && c === 'edit') return reportEditor(b);
  if (a === 'report' && b) return reportView(b);
  const tab = ['workers', 'insights', 'compliance'].includes(ROUTE.q.tab) ? ROUTE.q.tab : 'reports';
  const ids = myProjectIds();
  const missing = complianceSlots(7).slots.filter(x => x.st === 'Missing').length;
  const T = tabs([['reports', `${ico('report', 'sm')}Daily reports`, DB.reports.filter(r => ids.has(r.project)).length], ['compliance', `${ico('clock', 'sm')}Submission status`, missing || null], ['insights', `${ico('chart', 'sm')}Insights`], ['workers', `${ico('users', 'sm')}Worker register`, DB.workers.filter(w => w.status === 'Active').length]], tab);
  const act = tab === 'workers' ? (can('site') ? btn('Add worker', 'newWorker', { icon: 'plus', cls: 'primary' }) : '') : (can('site') ? `<a class="btn primary" href="#/site/report/new">${ico('plus')}New daily report</a>` : '');
  return `${pageHead('Site Operations', 'Daily construction reports — work completed, quantities, the workers who did it, wages and site photos. Due by 8:00 PM every working day.', act)}
    ${!can('site') ? `<div class="banner">${ico('eye')}<span>You have <b>view-only</b> access to site operations.</span></div>` : ''}
    ${T}${tab === 'workers' ? siteWorkers() : tab === 'insights' ? siteInsights() : tab === 'compliance' ? siteCompliance() : siteReports()}`;
};

/* ================= report list ================= */
function todayStrip() {
  const sites = reportSites();
  if (!sites.length) return '';
  return `<div class="card"><div class="card-head"><h2>Today · ${fmtD(TODAY)}</h2><span class="sub">${sites.filter(p => reportFor(TODAY, p.id)).length} of ${sites.length} sites reported</span></div>
    <div class="site-today">${sites.map(p => { const r = reportFor(TODAY, p.id); const draft = DB.reports.find(x => x.project === p.id && x.date === TODAY && x.status === 'Draft');
      return r ? `<a class="st-card ok" href="#/site/report/${r.id}"><span class="st-ic">${ico('check', 'sm')}</span><span><b>${esc(p.name)}</b><span>${plural(r.crew.length, 'worker')}${canMoney() ? ` · ${inrS(crewWages(r))} wages` : ''} · ${plural(r.work.length, 'task')}</span></span></a>`
        : `<a class="st-card pending" href="#/site/report/${draft ? draft.id + '/edit' : `new?p=${p.id}`}"><span class="st-ic">${ico('clock', 'sm')}</span><span><b>${esc(p.name)}</b><span>${draft ? 'Draft saved — finish report' : Date.now() > reportDeadline(TODAY) ? 'Missing — 8:00 PM deadline passed' : 'Pending — due by 8:00 PM'}</span></span>${can('site') ? `<span class="st-go">${draft ? 'Continue' : 'Submit'} ${ico('arrowR', 'sm')}</span>` : ''}</a>`; }).join('')}</div></div>`;
}
function reportCard(r) {
  const p = proj(r.project), media = repMedia(r);
  return `<a class="rep-card" href="#/site/report/${r.id}">
    <div class="rc-main">
      <div class="rc-top"><b>${esc(p.name)}</b>${r.status === 'Draft' ? badge('Draft', 'warn') : `<span class="tag">${esc(r.stage || p.stages[p.stage])}</span>`}${r.status === 'Submitted' && r.at > reportDeadline(r.date) ? badge('Late', 'warn') : ''}${viaOffice(r) ? '<span class="tag">Uploaded by office</span>' : ''}<span class="rc-by">${ico(weatherIco(r.weather), 'sm')}${esc(userName(r.by))} · ${new Date(r.at).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}</span></div>
      <p class="rc-sum">${esc(r.summary || 'No description yet')}</p>
      <div class="rc-work">${r.work.slice(0, 4).map(w => `<span>${esc(w.title)} <b>${qtyText(w)}</b></span>`).join('')}${r.work.length > 4 ? `<span class="muted">+${r.work.length - 4} more</span>` : ''}</div>
    </div>
    <div class="rc-stats"><div><b>${r.crew.length}</b><span>workers</span></div>${canMoney() ? `<div><b>${inrS(crewWages(r))}</b><span>wages</span></div>` : `<div><b>${r.work.length}</b><span>work items</span></div>`}<div><b>${media.length}</b><span>photos</span></div></div>
    ${media.length ? `<div class="rc-thumbs">${media.slice(0, 3).map(d => `<span>${docThumb(d)}</span>`).join('')}</div>` : ''}
  </a>`;
}
function reportList(reps) {
  if (!reps.length) return `<div class="card">${emptyPage('No daily reports yet', 'Reports submitted from site will appear here.')}</div>`;
  const groups = [];
  reps.forEach(r => { let g = groups.find(x => x.d === r.date); if (!g) groups.push(g = { d: r.date, items: [] }); g.items.push(r); });
  return groups.map(g => `<section class="rep-day"><div class="media-head"><h3>${daysFrom(g.d) >= -1 ? relD(g.d) : fmtLong(g.d)}</h3><span class="muted">${plural(g.items.length, 'report')} · ${plural(sum(g.items, r => r.crew.length), 'worker')}${canMoney() ? ` · ${inrS(sum(g.items, crewWages))}` : ''}</span></div>
    <div class="rep-list">${g.items.map(reportCard).join('')}</div></section>`).join('');
}
function siteReports() {
  const { p = '', range = '7' } = ROUTE.q;
  const ids = myProjectIds();
  const from = range === 'all' ? '0000' : dayOff(-(+range - 1));
  const reps = DB.reports.filter(r => ids.has(r.project) && (!p || r.project === p) && r.date >= from).sort((a, b) => b.date.localeCompare(a.date) || b.at - a.at);
  return `${todayStrip()}
    <div class="toolbar">${projSelect(p, { list: siteProjects() })}
      <div class="seg" role="group" aria-label="Period">${[['7', 'Last 7 days'], ['30', 'Last 30 days'], ['all', 'All']].map(([v, l]) => `<button class="${range === v ? 'on' : ''}" data-act="setQ" data-k="range" data-v="${v}">${l}</button>`).join('')}</div>
      <span class="grow"></span><span class="muted" style="font-size:13px">${plural(reps.length, 'report')} · ${plural(sum(reps, r => r.crew.length), 'man-day')}${canMoney() ? ` · ${inrS(sum(reps, crewWages))} wages` : ''}</span></div>
    ${reportList(reps)}`;
}

/* ================= insights ================= */
ACT.vizMode = el => { const card = el.closest('.card'); card.classList.toggle('as-table', el.dataset.v === 'table'); $$('[data-act="vizMode"]', card).forEach(b => b.classList.toggle('on', b === el)); };

// colour follows the site: fixed slot by the project's position among all reporting projects
function siteColor(pid) { const order = DB.projects.filter(p => DB.reports.some(r => r.project === p.id)).map(p => p.id); return `--s${(order.indexOf(pid) % 6) + 1}`; }
function siteInsights() {
  const n = ROUTE.q.range === '30' ? 30 : 14;
  const p = ROUTE.q.p || '';
  const sites = reportSites().filter(x => !p || x.id === p);
  const days = []; for (let i = -(n - 1); i <= 0; i++) days.push(dayOff(i));
  const from = days[0];
  const reps = DB.reports.filter(r => r.status === 'Submitted' && r.date >= from && sites.some(x => x.id === r.project));
  const md = sum(reps, r => r.crew.length), wages = sum(reps, crewWages);
  const due = sites.length * n, filed = reps.length;
  const series = sites.map(x => ({ name: x.name, color: siteColor(x.id), values: days.map(d => reportFor(d, x.id)?.crew.length || 0) }));
  const wageSeries = days.map(d => { const v = sum(reps.filter(r => r.date === d), crewWages); return { label: fmtD(d), value: v, tip: `<b>${fmtD(d)}</b> · ${inr(v)} wages · ${sum(reps.filter(r => r.date === d), r => r.crew.length)} workers` }; });
  const trades = {}, cats = {}, bySite = {};
  reps.forEach(r => { r.crew.forEach(c => trades[c.trade] = (trades[c.trade] || 0) + 1); r.work.forEach(w => cats[w.category] = (cats[w.category] || 0) + 1); bySite[r.project] = (bySite[r.project] || 0) + crewWages(r); });
  const busiest = days.reduce((a, d, i) => sum(series, sr => sr.values[i]) > a.v ? { d, v: sum(series, sr => sr.values[i]) } : a, { d: null, v: 0 });
  return `<div class="toolbar">${projSelect(p, { list: reportSites() })}
      <div class="seg" role="group" aria-label="Period">${[['14', 'Last 14 days'], ['30', 'Last 30 days']].map(([v, l]) => `<button class="${String(n) === v ? 'on' : ''}" data-act="setQ" data-k="range" data-v="${v}">${l}</button>`).join('')}</div></div>
    <div class="kpis insight-kpis">
      <div class="kpi"><div class="l">${ico('users', 'sm')}Avg workers per day</div><div class="v">${Math.round(md / n)}</div><div class="s">peak ${busiest.v}${busiest.d ? ` on ${fmtD(busiest.d)}` : ''}</div></div>
      <div class="kpi"><div class="l">${ico('cal', 'sm')}Man-days</div><div class="v">${num(md)}</div><div class="s">across ${plural(sites.length, 'site')}</div></div>
      ${canMoney() ? `<div class="kpi"><div class="l">${ico('rupee', 'sm')}Wage bill</div><div class="v">${inrS(wages)}</div><div class="s">avg ${inr(wages / Math.max(1, md))} per man-day</div></div>` : `<div class="kpi"><div class="l">${ico('task', 'sm')}Work items</div><div class="v">${num(sum(reps, r => r.work.length))}</div><div class="s">recorded on daily reports</div></div>`}
      <div class="kpi"><div class="l">${ico('report', 'sm')}Report compliance</div><div class="v">${Math.round(filed / Math.max(1, due) * 100)}%</div><div class="s">${filed} of ${due} site-days reported</div></div>
    </div>
    <div class="card"><div class="card-head"><h2>Workers on site by project</h2><span class="sub">Daily headcount from submitted reports</span>
      <div class="seg" role="group" aria-label="View"><button class="on" data-act="vizMode" data-v="chart">${ico('chart', 'sm')}Chart</button><button data-act="vizMode" data-v="table">${ico('rows', 'sm')}Table</button></div></div>
      <div class="card-body">${stackedChart(days.map(d => n > 14 ? String(parseD(d).getDate()) : fmtD(d)), series, { h: 300, w: 1200, fmt: v => Math.round(v), unit: ' workers' })}</div></div>
    ${canMoney() ? `<div class="card"><div class="card-head"><h2>Daily wage bill</h2><span class="sub">Sum of wages recorded on each day's reports</span></div><div class="card-body">${areaChart(wageSeries, { h: 260, w: 1200 })}</div></div>` : ''}
    <div class="grid ${canMoney() ? 'g3' : 'g2'}">
      <div class="card"><div class="card-head"><h2>Man-days by category</h2></div><div class="card-body">${hBars(Object.entries(trades).sort((a, b) => b[1] - a[1]).map(([label, value]) => ({ label, value })), v => num(v))}</div></div>
      <div class="card"><div class="card-head"><h2>Work items by category</h2></div><div class="card-body">${hBars(Object.entries(cats).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([label, value]) => ({ label, value })), v => num(v))}</div></div>
      ${canMoney() ? `<div class="card"><div class="card-head"><h2>Wage bill by site</h2></div><div class="card-body">${hBars(Object.entries(bySite).sort((a, b) => b[1] - a[1]).map(([pid, value]) => ({ label: proj(pid).name, value })))}</div></div>` : ''}
    </div>`;
}

/* ================= report view ================= */
function reportView(id) {
  const r = DB.reports.find(x => x.id === id);
  if (!r || !myProjectIds().has(r.project)) return `<a class="crumb" href="#/site">${ico('arrowL', 'sm')}Daily reports</a>${emptyPage('Report not found', 'It may have been removed.')}`;
  const p = proj(r.project), media = repMedia(r);
  return `<div><a class="crumb" href="#/site?p=${r.project}">${ico('arrowL', 'sm')}Daily reports</a>
    <div class="proj-hero"><div class="t"><div class="muted" style="font-size:13px">${esc(p.code)} · Daily construction report${r.status === 'Draft' ? ' · <b style="color:var(--warn)">Draft</b>' : ''}</div><h1 style="margin-top:4px">${esc(p.name)}</h1>
      <div class="meta"><span>${ico('cal', 'sm')}${fmtLong(r.date)}</span><span>${ico('flag', 'sm')}${esc(r.stage || '—')}</span><span>${ico(weatherIco(r.weather), 'sm')}${esc(r.weather)}</span><span>${ico('user', 'sm')}${esc(userName(r.by))} · ${fmtTs(r.at)}</span></div></div>
      <div class="acts" style="display:flex;gap:10px;flex-wrap:wrap">${canEditReport(r) ? `<a class="btn" href="#/site/report/${r.id}/edit">${ico('edit')}Edit</a>` : ''}<button class="btn" data-act="print">${ico('print')}Print</button>${can('site') && r.date < TODAY && !reportFor(TODAY, r.project) && p.status !== 'Completed' ? `<a class="btn primary" href="#/site/report/new?p=${r.project}&from=${r.id}" title="Start today's report with the same work items and crew">${ico('refresh')}Use for today</a>` : ''}</div></div></div>
    <div class="kpis">
      <div class="kpi"><div class="l">${ico('users', 'sm')}Workers on site</div><div class="v">${r.crew.length}</div><div class="s">${[...new Set(r.crew.map(c => c.trade))].join(', ')}</div></div>
      ${canMoney() ? `<div class="kpi"><div class="l">${ico('rupee', 'sm')}Wages for the day</div><div class="v">${inr(crewWages(r))}</div><div class="s">avg ${inr(crewWages(r) / Math.max(1, r.crew.length))} per worker</div></div>` : `<div class="kpi"><div class="l">${ico('flag', 'sm')}Stage</div><div class="v" style="font-size:20px;padding-top:5px">${esc(r.stage || '—')}</div><div class="s">${esc(r.weather)}</div></div>`}
      <div class="kpi"><div class="l">${ico('task', 'sm')}Work items</div><div class="v">${r.work.length}</div><div class="s">${[...new Set(r.work.map(w => w.category))].slice(0, 3).join(', ')}</div></div>
      <div class="kpi"><div class="l">${ico('image', 'sm')}Photos & videos</div><div class="v">${media.length}</div><div class="s">attached to this report</div></div>
    </div>
    ${submissionCard(r)}
    <div class="card"><div class="card-head"><h2>Progress</h2>${r.progress != null ? `<span class="sub">Overall project progress ${r.progress}%</span>` : ''}</div><div class="card-body stack">
      <p style="font-size:15px;line-height:1.65">${esc(r.summary)}</p>
      <dl class="dl"><div><dt>Materials used</dt><dd>${esc(r.materials || '—')}</dd></div><div><dt>Issues & remarks</dt><dd>${esc(r.issues || 'None reported')}</dd></div></dl></div></div>
    <div class="card"><div class="card-head"><h2>Work completed</h2><span class="sub">${plural(r.work.length, 'item')}</span></div>
      <div class="table-wrap" style="margin-top:12px"><table class="t stack-sm"><thead><tr><th>Work item</th><th>Category</th><th class="r">Quantity</th><th>Done by</th>${canEditReport(r) ? '<th class="r">Actions</th>' : ''}</tr></thead><tbody>
      ${r.work.map((w, i) => { const ws = workersFor(r, w.id); const hit = w.act && findAct(proj(r.project), w.act); return `<tr><td class="strong full">${esc(w.title)}${w.notes ? `<span class="sub">${esc(w.notes)}</span>` : ''}${hit ? `<span class="sub">${ico('building', 'sm')} ${esc(hit.a.name)} · ${esc(hit.f.name)}${w.actPct != null ? ` → ${w.actPct}%` : ''}</span>` : ''}</td><td><span class="tag">${esc(w.category)}</span></td><td class="r strong">${qtyText(w)}</td>
        <td class="full"><div class="crew-inline"><span class="avs">${ws.slice(0, 5).map(c => av(c.name, 'sm')).join('')}</span><span class="muted">${ws.length ? `${esc(ws.slice(0, 2).map(c => c.name).join(', '))}${ws.length > 2 ? ` +${ws.length - 2}` : ''}` : '—'}</span></div></td>
        ${canEditReport(r) ? `<td class="r"><div class="row-acts"><button type="button" class="btn xs" data-act="repEditWork" data-r="${r.id}" data-i="${i}" aria-label="Edit ${esc(w.title)}">${ico('edit', 'sm')}Edit</button><button type="button" class="btn xs del" data-act="repDelWork" data-r="${r.id}" data-i="${i}" aria-label="Delete ${esc(w.title)}">${ico('trash', 'sm')}Delete</button></div></td>` : ''}</tr>`; }).join('')}
      </tbody></table></div></div>
    <div class="card"><div class="card-head"><h2>Workers on site</h2><span class="sub">${plural(r.crew.length, 'worker')}${canMoney() ? ` · ${inr(crewWages(r))}` : ''}</span></div>
      <div class="table-wrap" style="margin-top:12px"><table class="t stack-sm"><thead><tr><th>Worker</th><th>Category</th><th>Tasks</th>${canMoney() ? '<th class="r">Daily wage</th>' : ''}${canEditReport(r) ? '<th class="r">Actions</th>' : ''}</tr></thead><tbody>
      ${r.crew.map((c, i) => { const w = worker(c.wid); return `<tr ${w ? `class="click" data-act="showWorker" data-id="${w.id}"` : ''}><td class="full"><div class="person">${av(c.name, 'sm')}<div class="nm"><b>${esc(c.name)}</b><span>${w ? esc(w.code) : 'New worker'}${c.note ? ` · ${esc(c.note)}` : ''}</span></div></div></td><td>${esc(c.trade)}</td>
        <td class="full"><div class="task-tags">${c.tasks.map(t => r.work.find(x => x.id === t)).filter(Boolean).map(t => `<span class="tag">${esc(t.title)}</span>`).join('')}</div></td>${canMoney() ? `<td class="r strong">${inr(c.wage)}</td>` : ''}
        ${canEditReport(r) ? `<td class="r"><div class="row-acts"><button type="button" class="btn xs" data-act="repEditCrew" data-r="${r.id}" data-i="${i}" aria-label="Edit ${esc(c.name)}">${ico('edit', 'sm')}Edit</button><button type="button" class="btn xs del" data-act="repDelCrew" data-r="${r.id}" data-i="${i}" aria-label="Delete ${esc(c.name)}">${ico('trash', 'sm')}Delete</button></div></td>` : ''}</tr>`; }).join('')}
      </tbody>${canMoney() ? `<tfoot><tr><td colspan="3">Total wages</td><td class="r">${inr(crewWages(r))}</td>${canEditReport(r) ? '<td></td>' : ''}</tr></tfoot>` : ''}</table></div></div>
    ${(() => { const byCat = {}; r.crew.forEach(c => byCat[c.trade] = (byCat[c.trade] || 0) + c.wage);
      const recent = DB.reports.filter(x => x.project === r.project && x.status === 'Submitted' && x.date <= r.date).sort((a, b) => a.date.localeCompare(b.date)).slice(-14);
      return `<div class="grid ${canMoney() ? 'g3' : 'g2'}">
      ${canMoney() ? `<div class="card"><div class="card-head"><h2>Wages by category</h2></div><div class="card-body">${hBars(Object.entries(byCat).sort((a, b) => b[1] - a[1]).map(([label, value]) => ({ label, value, extra: plural(r.crew.filter(c => c.trade === label).length, 'worker') })), inr)}</div></div>` : ''}
      <div class="card"><div class="card-head"><h2>Workers per work item</h2></div><div class="card-body">${hBars(r.work.map(w => ({ label: w.title, value: workersFor(r, w.id).length, extra: qtyText(w) })).sort((a, b) => b.value - a.value), v => num(v))}</div></div>
      <div class="card"><div class="card-head"><h2>Crew size trend</h2><span class="sub">Last ${recent.length} reports</span></div><div class="card-body">${barChart(recent.map(x => ({ label: String(parseD(x.date).getDate()), value: x.crew.length, tip: `<b>${fmtD(x.date)}</b> · ${x.crew.length} workers${canMoney() ? ` · ${inr(crewWages(x))}` : ''}` })), { h: 190, fmt: v => Math.round(v), hiLast: true })}</div></div>
    </div>`; })()}
    <div class="card"><div class="card-head"><h2>Site photos & videos</h2><span class="sub">${plural(media.length, 'item')}</span></div><div class="card-body">${media.length ? mediaGrid(media, false) : '<p class="muted">No photos attached to this report.</p>'}</div></div>`;
}

/* ================= report editor ================= */
let RD = null; // draft being edited
let RD_KEY = null;
const blankWork = () => ({ id: 'wk' + Math.random().toString(36).slice(2, 7), title: '', category: 'Masonry', qty: '', unit: 'sq.ft', notes: '' });
const crewEntry = w => ({ key: 'c' + Math.random().toString(36).slice(2, 7), wid: w.id, name: w.name, trade: w.trade, wage: w.wage, tasks: [] });
function lastReportFor(pid, before = '9999') { return DB.reports.filter(r => r.project === pid && r.status === 'Submitted' && r.date < before).sort((a, b) => b.date.localeCompare(a.date))[0] || null; }
function initDraft(id) {
  if (id) {
    const r = DB.reports.find(x => x.id === id);
    return { id: r.id, project: r.project, date: r.date, weather: r.weather, stage: r.stage, summary: r.summary, progress: r.progress ?? proj(r.project).progress, materials: r.materials || '', issues: r.issues || '',
      work: r.work.map(w => ({ ...w })), crew: r.crew.map(c => ({ ...c, key: 'c' + Math.random().toString(36).slice(2, 7), tasks: [...c.tasks] })), photos: [], keep: repMedia(r).map(d => d.id), errors: [],
      samples: [], onBehalf: r.uploadedBy && r.uploadedBy !== r.by ? r.by : '', lateReason: r.lateReason || '' };
  }
  const sites = reportSites();
  const pid = sites.some(p => p.id === ROUTE.q.p) ? ROUTE.q.p : sites[0]?.id;
  const p = proj(pid);
  const d = { id: null, project: pid, date: ROUTE.q.date && ROUTE.q.date <= TODAY ? ROUTE.q.date : TODAY, weather: 'Sunny', stage: p?.stages[p.stage], summary: '', progress: p?.progress, materials: '', issues: '', work: [blankWork()], crew: [], photos: [], keep: [], errors: [],
    samples: [], onBehalf: role() === 'admin' && p ? p.supervisor : '', lateReason: '', req: null };
  const rq = ROUTE.q.req && (DB.reportRequests || []).find(q => q.id === ROUTE.q.req && q.status === 'Open');
  if (rq && sites.some(x => x.id === rq.project)) Object.assign(d, { project: rq.project, date: rq.date, onBehalf: rq.by, lateReason: `${rq.reason} — ${rq.note}`, summary: rq.note, samples: (rq.photos || []).map(x => ({ ...x })), req: rq.id });
  const src = ROUTE.q.from && DB.reports.find(r => r.id === ROUTE.q.from);
  if (src) { d.project = src.project; d.stage = src.stage; d.work = src.work.map(w => ({ ...w, qty: '' })); d.crew = src.crew.map(c => ({ ...c, key: 'c' + Math.random().toString(36).slice(2, 7), tasks: [...c.tasks] })); }
  return d;
}
function reportEditor(id) {
  const key = `${id || 'new'}|${ROUTE.q.p || ''}|${ROUTE.q.date || ''}|${ROUTE.q.from || ''}|${ROUTE.q.req || ''}`;
  if (id && !DB.reports.some(r => r.id === id)) return emptyPage('Report not found', '');
  if (id && !canEditReport(DB.reports.find(r => r.id === id))) return noAccess(MODULES.find(m => m.id === 'site'));
  if (!id && !can('site')) return `<div class="card pad" style="max-width:560px;margin:60px auto;text-align:center"><div class="sig" style="margin:0 auto 14px;width:48px;height:48px;border-radius:12px">${ico('lock', 'lg')}</div><h2>Only site staff can submit daily reports</h2><p class="muted" style="margin:8px 0 20px">You can view all reports, but submitting is limited to the owner, project managers, site engineers and supervisors.</p><a class="btn" href="#/site">${ico('arrowL')}Back to daily reports</a></div>`;
  if (!RD || RD_KEY !== key) { RD = initDraft(id); RD_KEY = key; }
  const p = proj(RD.project);
  if (!p) return `<div class="card">${emptyPage('No active sites', 'There are no active projects assigned to you.')}</div>`;
  const existing = !RD.id && DB.reports.find(r => r.project === RD.project && r.date === RD.date);
  const last = lastReportFor(RD.project, RD.date);
  const err = k => RD.errors.includes(k) ? ' err' : '';
  return `<div><a class="crumb" href="#/site">${ico('arrowL', 'sm')}Daily reports</a>
    ${pageHead(RD.id ? 'Edit daily report' : 'New daily report', `Record the day's progress, the work completed and the workers who did it. Due by 8:00 PM with at least one site photo.`)}</div>
    ${RD.req ? `<div class="banner">${ico('send')}<span>Uploading on behalf of <b>${esc(userName(RD.onBehalf))}</b> from their request. Their photos and notes are filled in below.</span></div>` : ''}
    ${existing ? `<div class="banner warn">${ico('alert')}<span>A ${existing.status === 'Draft' ? 'draft' : 'report'} for <b>${esc(p.name)}</b> on ${fmtD(RD.date)} already exists.</span><a class="btn sm" href="#/site/report/${existing.id}/edit">Open it</a></div>` : ''}
    <div class="editor">
      <div class="ed-main">
        <section class="card ed-sec"><div class="card-head"><span class="sec-n">1</span><h2>Site & date</h2></div><div class="card-body"><div class="form"><div class="row2">
          <label class="field"><span>Project / site <em>*</em></span><select class="select" data-rd="project" data-rerender="1">${reportSites().map(x => `<option value="${x.id}" ${x.id === RD.project ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select></label>
          <label class="field"><span>Date <em>*</em></span><input class="input" type="date" max="${TODAY}" value="${RD.date}" data-rd="date" data-rerender="1"></label></div>
          <div class="row2"><label class="field"><span>Construction stage</span><select class="select" data-rd="stage">${p.stages.map(s => `<option ${s === RD.stage ? 'selected' : ''}>${esc(s)}</option>`).join('')}</select></label>
          <label class="field"><span>Weather</span><select class="select" data-rd="weather">${WEATHER_OPTS.map(w => `<option ${w === RD.weather ? 'selected' : ''}>${w}</option>`).join('')}</select></label></div>
          ${editorLateBlock()}</div></div></section>

        <section class="card ed-sec"><div class="card-head"><span class="sec-n">2</span><h2>Progress</h2></div><div class="card-body"><div class="form">
          <label class="field${err('summary')}"><span>Progress description <em>*</em></span><textarea rows="3" data-rd="summary" placeholder="What moved forward on site today?">${esc(RD.summary)}</textarea></label>
          ${projLevels(p).length ? `<div class="form-note">${ico('building', 'sm')}<span>Overall progress (now <b>${p.progress}%</b>) is calculated from ${p.type === 'Interior fit-out' ? 'zone' : 'floor'} activities. Link work items below to a ${p.type === 'Interior fit-out' ? 'zone' : 'floor'} activity to update it.</span></div>` : `<div class="row2"><label class="field"><span>Overall project progress (%)</span><input class="input" type="number" min="0" max="100" value="${RD.progress ?? ''}" data-rd="progress"><small>Currently ${p.progress}% · planned ${planPct(p)}%</small></label><div></div></div>`}</div></div></section>

        <section class="card ed-sec"><div class="card-head"><span class="sec-n">3</span><h2>Work completed</h2><span class="sub">${plural(RD.work.length, 'item')}</span></div><div class="card-body">
          <div class="work-items">${RD.work.map((w, i) => workItemEditor(w, i)).join('')}</div>
          <button type="button" class="btn sm add-row" data-act="rdAddWork">${ico('plus', 'sm')}Add work item</button></div></section>

        <section class="card ed-sec${err('crew')}"><div class="card-head"><span class="sec-n">4</span><h2>Workers on site</h2><span class="sub" data-rd-crew-sum>${crewSumText()}</span>
          <div class="ed-acts">${last ? `<button type="button" class="btn sm" data-act="rdCopyCrew" title="${esc(fmtD(last.date))}: ${last.crew.length} workers">${ico('refresh', 'sm')}Copy crew from ${daysFrom(last.date) === -1 ? 'yesterday' : fmtD(last.date)}</button>` : ''}<button type="button" class="btn sm" data-act="rdPickWorkers">${ico('plus', 'sm')}Add workers</button></div></div>
          <div class="card-body"><p class="muted" style="font-size:13px;margin-bottom:12px">Only add people who worked today. Pick the tasks each person did — the workforce can change every day.</p>
          ${RD.crew.length ? `<div class="table-wrap"><table class="t crew-table"><thead><tr><th>Worker</th><th>Category</th><th>Tasks done</th>${canMoney() ? '<th class="r">Daily wage (₹)</th>' : ''}<th class="r">Actions</th></tr></thead><tbody>
            ${RD.crew.map((c, i) => `<tr class="${RD.errors.includes('c' + i) ? 'row-err' : ''}"><td><div class="person">${av(c.name, 'sm')}<div class="nm"><b>${esc(c.name)}</b><span>${worker(c.wid)?.code || 'New'}${c.note ? ` · ${esc(c.note)}` : ''}</span></div></div></td>
              <td><select class="select sm" data-rc="${i}:trade">${TRADE_LIST.map(t => `<option ${t === c.trade ? 'selected' : ''}>${t}</option>`).join('')}</select></td>
              <td><div class="tchips">${RD.work.map(w => `<button type="button" class="tchip ${c.tasks.includes(w.id) ? 'on' : ''}" data-act="rdToggle" data-c="${i}" data-w="${w.id}" aria-pressed="${c.tasks.includes(w.id)}" title="${esc(w.title || 'Untitled task')}">${c.tasks.includes(w.id) ? ico('check', 'sm') : ''}<span data-wtitle="${w.id}">${esc(w.title || 'Untitled task')}</span></button>`).join('')}</div></td>
              ${canMoney() ? `<td class="r"><input class="input sm wage" type="number" min="1" inputmode="numeric" value="${c.wage}" data-rc="${i}:wage" aria-label="Daily wage for ${esc(c.name)}"></td>` : ''}
              <td class="r"><div class="row-acts"><button type="button" class="iconbtn" data-act="rdEditCrew" data-i="${i}" aria-label="Edit ${esc(c.name)}" title="Edit">${ico('edit', 'sm')}</button><button type="button" class="iconbtn del" data-act="rdRemoveCrew" data-i="${i}" aria-label="Delete ${esc(c.name)}" title="Delete">${ico('trash', 'sm')}</button></div></td></tr>`).join('')}
            </tbody></table></div>` : `<div class="empty-state" style="padding:28px">${ico('users')}<b>No workers added yet</b>Add the people who worked on site today.</div>`}
          </div></section>

        <section class="card ed-sec"><div class="card-head"><span class="sec-n">5</span><h2>Materials & issues</h2></div><div class="card-body"><div class="form row2">
          <label class="field"><span>Materials used</span><textarea rows="2" data-rd="materials" placeholder="e.g. Cement 30 bags, bricks 1,500">${esc(RD.materials)}</textarea></label>
          <label class="field"><span>Issues & remarks</span><textarea rows="2" data-rd="issues" placeholder="Delays, safety, shortages…">${esc(RD.issues)}</textarea></label></div></div></section>

        <section class="card ed-sec${err('photos')}"><div class="card-head"><span class="sec-n">6</span><h2>Site photos & videos <em class="req">*</em></h2><span class="sub">${RD.keep.length + RD.photos.length + RD.samples.length}</span><div class="ed-acts"><button type="button" class="btn sm" data-act="rdSample">${ico('image', 'sm')}Add a sample photo</button></div></div><div class="card-body">
          <div class="dropzone" data-act="rdPickPhotos" id="rdDrop">${ico('camera', 'lg')}<div style="margin-top:6px"><b>Take or add photos and videos</b> or drag and drop</div><small>At least one photo is required · JPG, PNG, HEIC, MP4, MOV</small><input type="file" id="rdFiles" accept="image/*,video/*" multiple hidden></div>
          ${RD.keep.length || RD.photos.length || RD.samples.length ? `<div class="ph-grid">${RD.keep.map(did => { const d = DB.documents.find(x => x.id === did); return d ? `<div class="ph">${docThumb(d)}<button type="button" data-act="rdRemoveKeep" data-id="${did}" aria-label="Remove">${ico('x', 'sm')}</button></div>` : ''; }).join('')}
            ${RD.photos.map((f, i) => `<div class="ph">${/^video/.test(f.file.type) ? `<video src="${f.url}#t=0.5" muted></video><span class="play">${ico('play')}</span>` : `<img src="${f.url}" alt="">`}<button type="button" data-act="rdRemovePhoto" data-i="${i}" aria-label="Remove">${ico('x', 'sm')}</button></div>`).join('')}
            ${RD.samples.map((ph, i) => `<div class="ph">${phThumb(ph)}<span class="ph-tag">Sample</span><button type="button" data-act="rdRemoveSample" data-i="${i}" aria-label="Remove">${ico('x', 'sm')}</button></div>`).join('')}</div>` : ''}
        </div></section>
      </div>
      <aside class="ed-side"><div class="card ed-summary" data-rd-summary>${summaryPanel()}</div></aside>
    </div>`;
}
function workItemEditor(w, i) {
  const ws = RD.crew.filter(c => c.tasks.includes(w.id));
  const bad = RD.errors.includes('w' + i);
  return `<div class="work-item${bad ? ' row-err' : ''}"><div class="wi-n">${i + 1}</div><div class="wi-body">
    <div class="wi-grid">
      <input class="input" placeholder="Work item, e.g. First floor plastering" value="${esc(w.title)}" data-rw="${i}:title" aria-label="Work item title">
      <select class="select" data-rw="${i}:category" aria-label="Category">${WORK_CATS.map(c => `<option ${c === w.category ? 'selected' : ''}>${c}</option>`).join('')}</select>
      <div class="qty"><input class="input" type="number" min="0" step="any" placeholder="Qty" value="${w.qty}" data-rw="${i}:qty" aria-label="Quantity"><select class="select" data-rw="${i}:unit" aria-label="Unit">${UNITS.map(u => `<option ${u === w.unit ? 'selected' : ''}>${u}</option>`).join('')}</select></div>
    </div>
    <input class="input wi-notes" placeholder="Details (optional) — location, grid, specification" value="${esc(w.notes || '')}" data-rw="${i}:notes" aria-label="Details">
    ${(() => { const p = proj(RD.project), lv = projLevels(p); if (!lv.length) return ''; const f = lv.find(x => x.id === w.floor), a = f && f.activities.find(x => x.id === w.act);
      return `<div class="wi-link">${ico('building', 'sm')}<select class="select sm" data-rw="${i}:floor" aria-label="Floor"><option value="">Not linked to a ${p.type === 'Interior fit-out' ? 'zone' : 'floor'}</option>${lv.map(x => `<option value="${x.id}" ${x.id === w.floor ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select>
        ${f ? `<select class="select sm" data-rw="${i}:act" aria-label="Activity"><option value="">Choose activity</option>${f.activities.map(x => `<option value="${x.id}" ${x.id === w.act ? 'selected' : ''}>${esc(x.name)} · ${x.pct}%</option>`).join('')}</select>` : ''}
        ${a ? `<label class="wi-pp">Progress after today <input class="input sm" type="number" min="0" max="100" value="${w.actPct ?? a.pct}" data-rw="${i}:actPct" aria-label="Activity progress after today">%</label><span class="muted">currently ${a.pct}%</span>` : ''}</div>`; })()}
    <div class="wi-crew">${ico('users', 'sm')}${ws.length ? `<span class="avs">${ws.slice(0, 6).map(c => av(c.name, 'sm')).join('')}</span><span>${esc(ws.map(c => c.name).slice(0, 3).join(', '))}${ws.length > 3 ? ` +${ws.length - 3}` : ''}</span>` : `<span class="muted">No workers assigned — pick tasks for workers below</span>`}</div>
  </div><div class="row-acts wi-acts"><button type="button" class="iconbtn" data-act="rdEditWork" data-i="${i}" aria-label="Edit work item" title="Edit">${ico('edit', 'sm')}</button>${RD.work.length > 1 ? `<button type="button" class="iconbtn del" data-act="rdRemoveWork" data-i="${i}" aria-label="Delete work item" title="Delete">${ico('trash', 'sm')}</button>` : ''}</div></div>`;
}
const crewSumText = () => `${plural(RD.crew.length, 'worker')}${canMoney() ? ` · ${inr(sum(RD.crew, c => +c.wage || 0))}` : ''}`;
function checks() {
  return [
    ['Progress description', !!RD.summary.trim()],
    ['At least one work item with quantity', RD.work.length > 0 && RD.work.every(w => w.title.trim() && +w.qty > 0)],
    ['Workers added', RD.crew.length > 0],
    ['Every worker has tasks and a wage', RD.crew.length > 0 && RD.crew.every(c => c.tasks.length && +c.wage > 0)],
    ['Every work item has workers', RD.work.every(w => RD.crew.some(c => c.tasks.includes(w.id)))],
    ['At least one site photo', RD.keep.length + RD.photos.length + RD.samples.length > 0],
    ...(RD.isLate ? [['Reason for late submission', !!(RD.lateReason || '').trim()]] : []),
  ];
}
function summaryPanel() {
  const p = proj(RD.project), ch = checks(), ok = ch.every(c => c[1]);
  const trades = {}; RD.crew.forEach(c => trades[c.trade] = (trades[c.trade] || 0) + 1);
  return `<div class="card-head"><h2>Report summary</h2></div><div class="card-body">
    <div class="sum-site"><b>${esc(p.name)}</b><span>${fmtLong(RD.date)}</span>${RD.isLate ? `<span style="color:var(--warn)">${ico('clock', 'sm')} Late — due 8:00 PM</span>` : RD.date === TODAY ? `<span>${ico('clock', 'sm')} Due by 8:00 PM today</span>` : ''}${RD.onBehalf ? `<span>On behalf of ${esc(userName(RD.onBehalf))}</span>` : ''}</div>
    <div class="sum-stats"><div><span>Workers</span><b>${RD.crew.length}</b></div>${canMoney() ? `<div><span>Total wages</span><b>${inr(sum(RD.crew, c => +c.wage || 0))}</b></div>` : ''}<div><span>Work items</span><b>${RD.work.length}</b></div><div><span>Photos</span><b>${RD.keep.length + RD.photos.length}</b></div></div>
    ${Object.keys(trades).length ? `<div class="sum-trades">${Object.entries(trades).map(([t, n]) => `<span class="tag">${n} ${esc(t)}</span>`).join('')}</div>` : ''}
    <ul class="checklist">${ch.map(([l, v]) => `<li class="${v ? 'ok' : ''}">${ico(v ? 'check' : 'clock', 'sm')}${l}</li>`).join('')}</ul>
    <div class="sum-acts"><button type="button" class="btn primary" data-act="rdSubmit" ${can('site') ? '' : 'disabled'}>${ico('check')}${RD.id && DB.reports.find(r => r.id === RD.id)?.status === 'Submitted' ? 'Save changes' : 'Submit report'}</button>
      <button type="button" class="btn" data-act="rdDraft">Save as draft</button>${RD.id ? `<button type="button" class="btn ghost danger" data-act="rdDelete">${ico('trash', 'sm')}Delete report</button>` : ''}</div>
    ${!ok ? '<p class="muted" style="font-size:12.5px;margin-top:10px">Complete the checklist to submit. Drafts can be saved anytime.</p>' : ''}</div>`;
}
function computeErrors() {
  const e = [];
  if (!RD.summary.trim()) e.push('summary');
  RD.work.forEach((w, i) => { if (!w.title.trim() || !(+w.qty > 0) || !RD.crew.some(c => c.tasks.includes(w.id))) e.push('w' + i); });
  RD.crew.forEach((c, i) => { if (!c.tasks.length || !(+c.wage > 0)) e.push('c' + i); });
  if (!RD.crew.length) e.push('crew');
  if (!(RD.keep.length + RD.photos.length + RD.samples.length)) e.push('photos');
  if (RD.isLate && !(RD.lateReason || '').trim()) e.push('late');
  return e;
}
// after a failed submit, highlights clear live as each problem is fixed
function applyErrorClasses() {
  if (!RD.tried) return;
  RD.errors = computeErrors();
  $('[data-rd="summary"]')?.closest('.field')?.classList.toggle('err', RD.errors.includes('summary'));
  $$('.work-item').forEach((el, i) => el.classList.toggle('row-err', RD.errors.includes('w' + i)));
  $$('.crew-table tbody tr').forEach((el, i) => el.classList.toggle('row-err', RD.errors.includes('c' + i)));
  $('[data-rd="lateReason"]')?.closest('.field')?.classList.toggle('err', RD.errors.includes('late'));
}
function refreshSummary() {
  applyErrorClasses();
  const s = $('[data-rd-summary]'); if (s) s.innerHTML = summaryPanel();
  const c = $('[data-rd-crew-sum]'); if (c) c.textContent = crewSumText();
}

// live field binding — typing never re-renders the page, so focus is kept
document.addEventListener('input', e => {
  if (!RD) return;
  const el = e.target;
  if (el.dataset.rd && !el.dataset.rerender) RD[el.dataset.rd] = el.value;
  else if (el.dataset.rw) { const [i, f] = el.dataset.rw.split(':'); RD.work[+i][f] = el.value; if (f === 'title') $$(`[data-wtitle="${RD.work[+i].id}"]`).forEach(t => t.textContent = el.value || 'Untitled task'); }
  else if (el.dataset.rc) { const [i, f] = el.dataset.rc.split(':'); RD.crew[+i][f] = el.value; }
  else return;
  refreshSummary();
});
document.addEventListener('change', e => {
  if (!RD) return;
  const el = e.target;
  if (el.dataset.rd && el.dataset.rerender) {
    RD[el.dataset.rd] = el.value;
    if (el.dataset.rd === 'project') { const p = proj(el.value); RD.stage = p.stages[p.stage]; RD.progress = p.progress; if (RD.onBehalf) RD.onBehalf = p.supervisor; }
    renderView();
  } else if (el.dataset.rd) { RD[el.dataset.rd] = el.value; refreshSummary(); }
  else if (el.dataset.rw && /:(floor|act)$/.test(el.dataset.rw)) {
    const [i, f] = el.dataset.rw.split(':'), w = RD.work[+i];
    if (f === 'floor') { w.floor = el.value; w.act = ''; w.actPct = null; }
    else { w.act = el.value; const hit = w.act && findAct(proj(RD.project), w.act);
      if (hit) { w.actPct = hit.a.pct; if (!w.title.trim()) w.title = `${hit.a.name} – ${hit.f.name}`; if (WORK_CATS.includes(hit.a.category)) w.category = hit.a.category; } }
    renderView();
  }
  else if (el.dataset.rw || el.dataset.rc) { const [i, f] = (el.dataset.rw || el.dataset.rc).split(':'); (el.dataset.rw ? RD.work : RD.crew)[+i][f] = el.value; if (f === 'trade' && !RD.crew[+i].wageEdited) { /* keep wage as entered */ } refreshSummary(); }
  else if (el.id === 'rdFiles') { [...el.files].forEach(f => RD.photos.push({ file: f, url: URL.createObjectURL(f) })); renderView(); }
});
const rdStructural = fn => el => { if (!RD) return; fn(el); if (RD.tried) RD.errors = computeErrors(); renderView(); };
ACT.rdAddWork = rdStructural(() => RD.work.push(blankWork()));
// edit a work item: details plus which workers did it (updates each worker's task list)
function openWorkEdit(w, crew, date, onSave) {
  openModal({ title: w.title ? `Edit ${w.title}` : 'Edit work item', sub: `Work completed on ${fmtDY(date)}`, body: `<div class="form">
    ${fld('Work item', 'title', { req: true, value: w.title, ph: 'e.g. First floor plastering' })}
    <div class="row3">${fld('Category', 'category', { opts: WORK_CATS, value: w.category })}${fld('Quantity', 'qty', { type: 'number', req: true, value: w.qty, min: 0, step: 'any' })}${fld('Unit', 'unit', { opts: UNITS, value: w.unit })}</div>
    ${fld('Details (optional)', 'notes', { value: w.notes || '', ph: 'Location, grid, specification' })}
    <div class="field"><span>Done by <em>*</em></span><div class="task-picks">${crew.map((c, i) => `<label class="pick"><input type="checkbox" name="crew" data-multi="1" value="${i}" ${c.tasks.includes(w.id) ? 'checked' : ''}>${av(c.name, 'sm')}<span class="nm"><b>${esc(c.name)}</b><span>${esc(c.trade)} · ${inr(c.wage)}</span></span></label>`).join('') || '<p class="muted">Add workers to the report first.</p>'}</div></div></div>`,
    onSubmit: d => {
      if (!(+d.qty > 0)) { toast('Enter the quantity completed', 'lock'); return false; }
      const picked = (d.crew || []).map(Number);
      if (crew.length && !picked.length) { toast('Pick at least one worker who did this work', 'lock'); return false; }
      const lost = crew.filter((c, i) => !picked.includes(i) && c.tasks.length === 1 && c.tasks[0] === w.id);
      if (lost.length) { toast(`${lost.map(c => c.name).join(', ')} would have no task left — give them another task first`, 'lock'); return false; }
      Object.assign(w, { title: d.title, category: d.category, qty: +d.qty, unit: d.unit, notes: d.notes });
      crew.forEach((c, i) => { const has = c.tasks.includes(w.id); if (picked.includes(i) && !has) c.tasks.push(w.id); if (!picked.includes(i) && has) c.tasks = c.tasks.filter(t => t !== w.id); });
      onSave(w);
    } });
}
const workDeleteText = (w, crew, date) => {
  const lone = crew.filter(c => c.tasks.length === 1 && c.tasks[0] === w.id);
  const ws = crew.filter(c => c.tasks.includes(w.id));
  return `<b>${esc(w.title || 'Untitled task')}</b> (${qtyText(w)}) will be removed from the ${fmtD(date)} report${ws.length ? ` and from the task lists of ${plural(ws.length, 'worker')}` : ''}.${lone.length ? ` <b>${esc(lone.map(c => c.name).join(', '))}</b> will have no task left.` : ''}`;
};
ACT.rdEditWork = el => { const i = +el.dataset.i; openWorkEdit(RD.work[i], RD.crew, RD.date, w => { if (RD.tried) RD.errors = computeErrors(); renderView(); toast(`${w.title} updated`); }); };
ACT.rdRemoveWork = el => {
  const i = +el.dataset.i, w = RD.work[i];
  confirmBox('Delete this work item?', workDeleteText(w, RD.crew, RD.date) + (RD.crew.some(c => c.tasks.length === 1 && c.tasks[0] === w.id) ? ' Give them another task or remove them before you submit.' : ''), 'Delete', () => {
    RD.work.splice(i, 1); RD.crew.forEach(c => c.tasks = c.tasks.filter(t => t !== w.id)); if (RD.tried) RD.errors = computeErrors(); renderView(); toast('Work item deleted');
  }, true);
};
ACT.repEditWork = el => {
  const r = DB.reports.find(x => x.id === el.dataset.r), i = +el.dataset.i;
  if (!guard(canEditReport(r), 'edit this report')) return;
  openWorkEdit(r.work[i], r.crew, r.date, w => { noteCorrection(r, `Work item “${w.title}” edited (${qtyText(w)}).`); logAct(`edited “${w.title}” on the ${fmtD(r.date)} report for ${proj(r.project).name}`, r.project, 'site'); commit(`${w.title} updated`); });
};
ACT.repDelWork = el => {
  const r = DB.reports.find(x => x.id === el.dataset.r), i = +el.dataset.i, w = r.work[i];
  if (!guard(canEditReport(r), 'edit this report')) return;
  if (r.status === 'Submitted' && r.work.length === 1) { toast('A submitted report needs at least one work item — edit the report to replace it', 'lock'); return; }
  const lone = r.crew.filter(c => c.tasks.length === 1 && c.tasks[0] === w.id);
  if (r.status === 'Submitted' && lone.length) { toast(`${lone.map(c => c.name).join(', ')} only did this task — reassign or remove them first`, 'lock'); return; }
  confirmBox('Delete this work item?', workDeleteText(w, r.crew, r.date), 'Delete', () => {
    r.work.splice(i, 1); r.crew.forEach(c => c.tasks = c.tasks.filter(t => t !== w.id));
    noteCorrection(r, `Work item “${w.title}” removed.`);
    logAct(`deleted “${w.title}” from the ${fmtD(r.date)} report for ${proj(r.project).name}`, r.project, 'site'); commit('Work item deleted');
  }, true);
};
ACT.rdToggle = rdStructural(el => { const c = RD.crew[+el.dataset.c], w = el.dataset.w; c.tasks = c.tasks.includes(w) ? c.tasks.filter(t => t !== w) : [...c.tasks, w]; });
// edit one worker's entry for this day; optionally push name/category/wage back to the register
function openCrewEdit(c, work, date, onSave) {
  const w = worker(c.wid);
  openModal({ title: `Edit ${c.name}`, sub: `Entry for ${fmtDY(date)} only`, body: `<div class="form">
    <div class="row2">${fld('Name', 'name', { req: true, value: c.name })}${fld('Work category', 'trade', { opts: TRADE_LIST, value: c.trade })}</div>
    <div class="row2">${moneyFld('Daily wage (₹)', 'wage', { type: 'number', req: true, value: c.wage, min: 1 })}${fld('Note (optional)', 'note', { value: c.note || '', ph: 'e.g. Overtime 2 hrs, half day' })}</div>
    <div class="field"><span>Tasks done <em>*</em></span><div class="task-picks">${work.map(t => `<label class="pick"><input type="checkbox" name="tasks" data-multi="1" value="${t.id}" ${c.tasks.includes(t.id) ? 'checked' : ''}><span class="nm"><b>${esc(t.title || 'Untitled task')}</b><span>${esc(t.category)}${t.qty ? ` · ${qtyText(t)}` : ''}</span></span></label>`).join('') || '<p class="muted">Add a work item first.</p>'}</div></div>
    ${w ? `<label class="check"><input type="checkbox" name="toRegister"> Also update ${esc(w.name)} in the worker register (name, category and default wage)</label>` : ''}</div>`,
    onSubmit: d => {
      if (!(d.tasks || []).length) { toast('Pick at least one task this worker did', 'lock'); return false; }
      const wage = d.wage != null ? +d.wage : c.wage;
      const v = { name: d.name, trade: d.trade, wage, note: d.note, tasks: d.tasks };
      if (w && d.toRegister) Object.assign(w, { name: d.name, trade: d.trade, ...(d.wage != null ? { wage } : {}) });
      onSave(v);
    } });
}
ACT.rdEditCrew = el => { const i = +el.dataset.i; openCrewEdit(RD.crew[i], RD.work, RD.date, v => { Object.assign(RD.crew[i], v); if (RD.tried) RD.errors = computeErrors(); saveDB(); renderView(); toast(`${v.name} updated`); }); };
ACT.rdRemoveCrew = el => { const i = +el.dataset.i, c = RD.crew[i]; const orphan = RD.work.filter(w => c.tasks.includes(w.id) && RD.crew.filter(x => x.tasks.includes(w.id)).length === 1); confirmBox(`Delete ${c.name} from this report?`, `They will be removed from the crew for ${fmtD(RD.date)} along with their tasks and ${inr(c.wage)} wage.${orphan.length ? ` <b>${esc(orphan.map(w => w.title || 'Untitled task').join(', '))}</b> will need another worker before you submit.` : ''} The worker stays in the register.`, 'Delete', () => { RD.crew.splice(i, 1); if (RD.tried) RD.errors = computeErrors(); renderView(); toast(`${c.name} removed from the report`); }, true); };
ACT.repEditCrew = el => {
  const r = DB.reports.find(x => x.id === el.dataset.r), i = +el.dataset.i;
  if (!guard(canEditReport(r), 'edit this report')) return;
  openCrewEdit(r.crew[i], r.work, r.date, v => { Object.assign(r.crew[i], v); noteCorrection(r, `${v.name}'s entry edited (wage ${inr(v.wage)}).`); logAct(`edited ${v.name} on the ${fmtD(r.date)} report for ${proj(r.project).name}`, r.project, 'site'); commit(`${v.name} updated`); });
};
ACT.repDelCrew = el => {
  const r = DB.reports.find(x => x.id === el.dataset.r), i = +el.dataset.i, c = r.crew[i];
  if (!guard(canEditReport(r), 'edit this report')) return;
  if (r.status === 'Submitted' && r.crew.length === 1) { toast('A submitted report needs at least one worker — edit the report to replace them', 'lock'); return; }
  const orphan = r.work.filter(w => c.tasks.includes(w.id) && workersFor(r, w.id).length === 1);
  confirmBox(`Delete ${c.name} from this report?`, `This removes their entry for ${fmtD(r.date)} and ${inr(c.wage)} from the day's wages.${orphan.length ? ` <b>${esc(orphan.map(w => w.title).join(', '))}</b> will have no workers listed.` : ''} The worker stays in the register.`, 'Delete', () => {
    r.crew.splice(i, 1); noteCorrection(r, `${c.name} removed from the crew.`); logAct(`removed ${c.name} from the ${fmtD(r.date)} report for ${proj(r.project).name}`, r.project, 'site'); commit(`${c.name} removed · day's wages now ${inr(crewWages(r))}`);
  }, true);
};
ACT.rdRemovePhoto = rdStructural(el => RD.photos.splice(+el.dataset.i, 1));
ACT.rdRemoveKeep = rdStructural(el => RD.keep = RD.keep.filter(d => d !== el.dataset.id));
ACT.rdPickPhotos = () => $('#rdFiles').click();
ACT.rdSample = rdStructural(() => { const pool = SAMPLES.site(), mine = pool.filter(s => s.src.includes(`/${RD.project}-`)); const s = (mine.length ? mine : pool)[sampleTurn++ % (mine.length || pool.length)]; RD.samples.push({ ...s, id: rid('ph'), at: Date.now(), by: SESSION, sample: true }); });
ACT.rdRemoveSample = rdStructural(el => RD.samples.splice(+el.dataset.i, 1));
ACT.rdCopyCrew = rdStructural(() => {
  const last = lastReportFor(RD.project, RD.date); if (!last) return;
  const have = new Set(RD.crew.map(c => c.wid));
  // tasks are matched by title so yesterday's assignments carry over where the same work continues
  last.crew.filter(c => !have.has(c.wid)).forEach(c => {
    const tasks = c.tasks.map(t => last.work.find(w => w.id === t)?.title).map(title => RD.work.find(w => w.title && w.title === title)?.id).filter(Boolean);
    RD.crew.push({ key: 'c' + Math.random().toString(36).slice(2, 7), wid: c.wid, name: c.name, trade: c.trade, wage: c.wage, tasks });
  });
  toast(`Copied ${plural(last.crew.length, 'worker')} from ${fmtD(last.date)} — remove anyone who didn't work today`);
});
ACT.rdPickWorkers = () => {
  const have = new Set(RD.crew.map(c => c.wid));
  const recent = new Set(DB.reports.filter(r => r.project === RD.project && daysFrom(r.date) >= -14).flatMap(r => r.crew.map(c => c.wid)));
  const list = DB.workers.filter(w => w.status === 'Active').sort((a, b) => (recent.has(b.id) - recent.has(a.id)) || (b.project === RD.project) - (a.project === RD.project) || a.name.localeCompare(b.name));
  openModal({ title: 'Add workers to today\'s report', sub: `Pick from the worker register, or add someone new.`, wide: true, body: `
    <div class="inline-search" style="margin-bottom:12px">${ico('search', 'sm')}<input class="input" type="search" id="pickQ" placeholder="Search by name, category or code" style="width:100%"></div>
    <div class="pick-list" id="pickList">${list.map(w => `<label class="pick ${have.has(w.id) ? 'dis' : ''}" data-s="${esc(`${w.name} ${w.trade} ${w.code}`.toLowerCase())}"><input type="checkbox" name="pick" data-multi="1" value="${w.id}" ${have.has(w.id) ? 'checked disabled' : ''}>${av(w.name, 'sm')}<span class="nm"><b>${esc(w.name)}</b><span>${esc(w.trade)}${canMoney() ? ` · ${inr(w.wage)}/day` : ''}${recent.has(w.id) ? ' · worked here recently' : w.project && w.project !== RD.project ? ` · usually ${esc(proj(w.project)?.name || '')}` : ''}</span></span></label>`).join('')}</div>
    <div class="form-sec" style="margin-top:18px">New worker (not in the register)</div>
    <div class="form" style="margin-top:12px"><div class="row3">${fld('Name', 'nname', { ph: 'Full name' })}${fld('Work category', 'ntrade', { opts: TRADE_LIST, value: 'Helper' })}${moneyFld('Daily wage (₹)', 'nwage', { type: 'number', value: '', ph: 'e.g. 650', min: 0 })}</div>${fld('Phone (optional)', 'nphone', { type: 'tel', ph: '+91' })}</div>`,
    foot: `<button type="button" class="btn" data-act="closeModal">Cancel</button><button type="submit" class="btn primary">${ico('plus', 'sm')}Add to report</button>`,
    onOpen: m => {
      $('#pickQ', m).addEventListener('input', e => { const q = e.target.value.toLowerCase().trim(); $$('.pick', m).forEach(l => l.hidden = q && !l.dataset.s.includes(q)); });
      $('[name=ntrade]', m).addEventListener('change', e => { const wg = $('[name=nwage]', m); if (!wg.value) wg.placeholder = 'e.g. ' + (DEFAULT_WAGE[e.target.value] || 700); });
    },
    onSubmit: d => {
      const picked = (d.pick || []).filter(id => !have.has(id)).map(worker).filter(Boolean);
      if (d.nname) {
        const wage = +d.nwage || DEFAULT_WAGE[d.ntrade] || 700;
        const w = { id: nid('w'), code: 'W-' + (DB.workers.length + 101), name: d.nname, trade: d.ntrade, wage, phone: d.nphone || '—', project: RD.project, joined: RD.date, status: 'Active', contractor: 'Direct' };
        DB.workers.push(w); picked.push(w); logAct(`added worker ${w.name} to the register`, RD.project, 'site');
      }
      if (!picked.length) { toast('Pick at least one worker or enter a new one', 'lock'); return false; }
      picked.forEach(w => { const e = crewEntry(w); const fit = RD.work.filter(x => x.title && guessFit(x, w.trade)); if (fit.length === 1) e.tasks = [fit[0].id]; RD.crew.push(e); });
      saveDB(); renderView(); toast(`${plural(picked.length, 'worker')} added`);
    } });
};
// suggest a task when exactly one work item suits the worker's category
const FIT = { Mason: ['Masonry', 'Concrete', 'Plastering'], Helper: ['General', 'Curing', 'Excavation', 'Masonry', 'Concrete', 'Plastering'], Carpenter: ['Shuttering', 'Carpentry'], 'Bar bender': ['Reinforcement'], Electrician: ['Electrical'], Plumber: ['Plumbing'], Painter: ['Painting'], Welder: ['Fabrication'], 'Tile layer': ['Flooring'] };
const guessFit = (w, trade) => (FIT[trade] || []).includes(w.category) && (trade !== 'Helper' || RD.work.filter(x => (FIT.Helper).includes(x.category)).length === 1);

function saveReport(status) {
  const p = proj(RD.project);
  if (status === 'Submitted') {
    RD.tried = true;
    RD.errors = computeErrors();
    if (RD.errors.length) { renderView(); toast('Complete the highlighted fields to submit', 'lock'); $('.row-err, .field.err, .ed-sec.err')?.scrollIntoView({ behavior: 'smooth', block: 'center' }); return; }
  }
  const dup = DB.reports.find(r => r.project === RD.project && r.date === RD.date && r.id !== RD.id);
  if (dup) { toast(`A report for ${p.name} on ${fmtD(RD.date)} already exists`, 'lock'); return; }
  const id = RD.id || nid('r');
  const prev = DB.reports.find(r => r.id === id);
  const wasSubmitted = prev?.status === 'Submitted';
  const before = wasSubmitted ? { crew: prev.crew.length, work: prev.work.length, wages: crewWages(prev), photos: repMedia(prev).length, summary: prev.summary } : null;
  const rec = { id, project: RD.project, date: RD.date, by: wasSubmitted ? prev.by : RD.onBehalf || prev?.by || SESSION, uploadedBy: wasSubmitted ? prev.uploadedBy || prev.by : SESSION,
    lateReason: RD.isLate || wasSubmitted ? (RD.lateReason || '').trim() : '', at: wasSubmitted ? prev.at : Date.now(), status, weather: RD.weather, stage: RD.stage, summary: RD.summary.trim(),
    progress: RD.progress === '' || RD.progress == null ? null : Math.max(0, Math.min(100, +RD.progress)), materials: RD.materials.trim(), issues: RD.issues.trim(),
    work: RD.work.map(({ id, title, category, qty, unit, notes, floor, act, actPct }) => ({ id, title: title.trim(), category, qty: +qty || 0, unit, notes: (notes || '').trim(), floor: floor || null, act: act || null, actPct: act && actPct !== '' && actPct != null ? Math.max(0, Math.min(100, +actPct)) : null })),
    crew: RD.crew.map(({ wid, name, trade, wage, tasks, note }) => ({ wid, name, trade, wage: +wage || 0, tasks, note: (note || '').trim() })) };
  if (prev) Object.assign(prev, rec); else DB.reports.push({ ...rec, corrections: [] });
  // photos: drop removed ones, attach new uploads
  DB.documents.filter(d => d.report === id && !RD.keep.includes(d.id)).forEach(d => { BLOBS.delete(d.id); });
  DB.documents = DB.documents.filter(d => d.report !== id || RD.keep.includes(d.id));
  RD.photos.forEach(f => { const did = addUploadedDoc(f.file, RD.project, null, id, RD.stage, 'media'); const d = DB.documents.find(x => x.id === did); d.date = RD.date; });
  RD.samples.forEach(ph => DB.documents.unshift({ id: nid('d'), project: RD.project, name: `Site photo – ${RD.stage || 'progress'} (${fmtD(RD.date)}).jpg`, category: 'Site photos', ext: 'jpg', size: 2.6e6, date: RD.date, by: SESSION, version: 1, art: 'photo', src: ph.src, report: id, stage: RD.stage, sample: true }));
  const saved = DB.reports.find(r => r.id === id);
  if (wasSubmitted) {
    const ch = [];
    if (before.summary !== rec.summary) ch.push('progress description');
    if (before.work !== rec.work.length) ch.push(`work items ${before.work} → ${rec.work.length}`);
    if (before.crew !== rec.crew.length) ch.push(`workers ${before.crew} → ${rec.crew.length}`);
    if (before.wages !== crewWages(rec)) ch.push(`wages ${inr(before.wages)} → ${inr(crewWages(rec))}`);
    if (before.photos !== repMedia(saved).length) ch.push(`photos ${before.photos} → ${repMedia(saved).length}`);
    noteCorrection(saved, `Edited after submission: ${ch.join(', ') || 'quantities and details updated'}.`);
  }
  if (status === 'Submitted' && !wasSubmitted) {
    const q = RD.req && (DB.reportRequests || []).find(x => x.id === RD.req);
    if (q) { Object.assign(q, { status: 'Completed', handledBy: SESSION, handledAt: Date.now(), report: id }); }
    if (rec.uploadedBy !== rec.by) notify([rec.by], `${me().name} uploaded your ${fmtD(rec.date)} report for ${p.name}${rec.lateReason ? ' (late)' : ''}`, `#/site/report/${id}`, 'report');
    if (rec.lateReason) notify([p.pm], `Late daily report: ${p.name} · ${fmtD(rec.date)} — ${rec.lateReason}`, `#/site/report/${id}`, 'report');
  }
  if (status === 'Submitted') {
    if (!projLevels(p).length && rec.progress != null && rec.progress !== p.progress && RD.date === TODAY) { p.progress = rec.progress; DB.updates.unshift({ id: nid('up'), project: p.id, at: Date.now(), by: SESSION, text: rec.summary, pct: rec.progress }); }
    const byFloor = {};
    rec.work.filter(w => w.act && w.actPct != null).forEach(w => {
      const hit = findAct(p, w.act); if (!hit) return;
      const from = setActivity(hit.a, w.actPct, hit.a.status === 'Completed' && w.actPct < 100 ? 'In progress' : hit.a.status);
      hit.a.workers = [...new Set(rec.crew.filter(c => c.tasks.includes(w.id) && c.wid).map(c => c.wid))];
      (byFloor[hit.f.id] ||= []).push({ act: hit.a.id, from, to: hit.a.pct, status: hit.a.status });
    });
    Object.entries(byFloor).forEach(([fid, changes]) => (DB.floorLog ||= []).unshift({ id: nid('fl'), project: p.id, floor: fid, at: Date.now(), by: SESSION, changes, note: rec.summary, photos: [], report: id }));
    if (Object.keys(byFloor).length) syncProjectProgress(p);
    logAct(`${prev?.status === 'Submitted' ? 'updated' : rec.uploadedBy !== rec.by ? `uploaded (on behalf of ${userName(rec.by)})` : rec.lateReason ? 'submitted a late' : 'submitted'} the daily report for ${p.name}`, p.id, 'site');
  }
  RD = null; RD_KEY = null;
  saveDB();
  go(status === 'Submitted' ? `#/site/report/${id}` : '#/site');
  toast(status === 'Submitted' ? `Daily report submitted · ${plural(rec.crew.length, 'worker')}${canMoney() ? ` · ${inr(sum(rec.crew, c => c.wage))}` : ''}` : 'Draft saved');
}
ACT.rdSubmit = () => saveReport('Submitted');
ACT.rdDraft = () => saveReport('Draft');
ACT.rdDelete = () => confirmBox('Delete this report?', 'The report, its crew and wages, and attached photos will be removed.', 'Delete', () => {
  const id = RD.id; DB.reports = DB.reports.filter(r => r.id !== id); DB.documents = DB.documents.filter(d => d.report !== id);
  logAct('deleted a daily report', RD.project, 'site'); RD = null; RD_KEY = null; saveDB(); go('#/site'); toast('Report deleted');
}, true);
ACT.newReport = el => go(`#/site/report/new${el?.dataset?.p ? `?p=${el.dataset.p}` : ''}`);
// drag & drop photos onto the editor drop zone
document.addEventListener('dragover', e => { const z = e.target.closest && e.target.closest('#rdDrop'); if (z) { e.preventDefault(); z.classList.add('over'); } });
document.addEventListener('dragleave', e => { const z = e.target.closest && e.target.closest('#rdDrop'); if (z) z.classList.remove('over'); });
document.addEventListener('drop', e => { const z = e.target.closest && e.target.closest('#rdDrop'); if (!z || !RD) return; e.preventDefault(); [...e.dataTransfer.files].filter(f => /^(image|video)\//.test(f.type)).forEach(f => RD.photos.push({ file: f, url: URL.createObjectURL(f) })); renderView(); });

/* ================= worker register ================= */
function siteWorkers() {
  const { q = '', trade = '', p = '', st = 'Active' } = ROUTE.q;
  const from30 = dayOff(-29);
  const list = DB.workers.filter(w => (!p || w.project === p) && (!trade || w.trade === trade) && (st === 'all' || w.status === st) && (!q || `${w.name} ${w.code} ${w.trade}`.toLowerCase().includes(q.toLowerCase())))
    .map(w => { const en = workerEntries(w.id, from30); const last = en.reduce((m, e) => e.report.date > m ? e.report.date : m, ''); return { w, days: en.length, earned: sum(en, e => e.wage), last }; })
    .sort((a, b) => b.last.localeCompare(a.last) || a.w.name.localeCompare(b.w.name));
  if (ROUTE.q.w) after(() => { const w = worker(ROUTE.q.w); if (w) showWorker(w.id); });
  return `<div class="toolbar">
      <div class="inline-search">${ico('search', 'sm')}<input class="input" type="search" placeholder="Search workers" value="${esc(q)}" data-input="workerQ" aria-label="Search workers"></div>
      ${projSelect(p)}
      <select class="select" data-change="setQ" data-k="trade" aria-label="Category"><option value="">All categories</option>${TRADE_LIST.map(t => `<option ${t === trade ? 'selected' : ''}>${t}</option>`).join('')}</select>
      <select class="select" data-change="setQ" data-k="st" aria-label="Status"><option value="Active" ${st === 'Active' ? 'selected' : ''}>Active</option><option value="Inactive" ${st === 'Inactive' ? 'selected' : ''}>Inactive</option><option value="all" ${st === 'all' ? 'selected' : ''}>All statuses</option></select>
    </div>
    <div class="card"><div class="table-wrap"><table class="t stack-sm"><thead><tr><th>Worker</th><th>Category</th><th>Usual site</th>${canMoney() ? '<th class="r">Default wage</th>' : ''}<th class="r">Days worked (30d)</th>${canMoney() ? '<th class="r">Earned (30d)</th>' : ''}<th>Last worked</th></tr></thead><tbody>
      ${(ROUTE.q.all ? list : list.slice(0, 20)).map(({ w, days, earned, last }) => `<tr class="click" data-act="showWorker" data-id="${w.id}"><td class="full"><div class="person">${av(w.name, 'sm')}<div class="nm"><b>${esc(w.name)}</b><span>${w.code} · ${esc(w.phone)}</span></div></div></td><td>${esc(w.trade)}</td><td class="hide-sm">${esc(proj(w.project)?.name || '—')}</td>${canMoney() ? `<td class="r">${inr(w.wage)}</td>` : ''}<td class="r hide-sm">${days}</td>${canMoney() ? `<td class="r hide-sm">${earned ? inr(earned) : '—'}</td>` : ''}<td class="hide-sm">${last ? relD(last) : '<span class="muted">Not in 30 days</span>'}</td></tr>`).join('') || emptyRow(7, 'No workers found')}
    </tbody></table></div><div class="card-foot" style="justify-content:space-between;align-items:center"><span class="muted" style="font-size:13px">${plural(list.length, 'worker')} in the register — add them to a daily report on days they work</span>${!ROUTE.q.all && list.length > 20 ? `<button class="btn sm" data-act="setQ" data-k="all" data-v="1">Show all</button>` : ''}</div></div>`;
}
INPUT.workerQ = el => { setQ({ q: el.value }); const i = $('[data-input="workerQ"]'); i.focus(); i.setSelectionRange(i.value.length, i.value.length); };
function showWorker(id) {
  const w = worker(id);
  const en = workerEntries(id).sort((a, b) => b.report.date.localeCompare(a.report.date));
  const m30 = en.filter(e => daysFrom(e.report.date) >= -29);
  const advs = DB.advances.filter(a => a.worker === id), adv = workerAdvanceBal(id);
  openDrawer(esc(w.name), `${w.code} · ${esc(w.trade)}`, `
    <div class="person">${av(w.name, 'lg')}<div class="nm"><b>${esc(w.name)}</b><span>${esc(w.trade)} · ${badge(w.status)}</span></div></div>
    <dl class="dl"><div><dt>Phone</dt><dd><a href="tel:${esc(String(w.phone).replace(/\s/g, ''))}">${esc(w.phone)}</a></dd></div>${canMoney() ? `<div><dt>Default daily wage</dt><dd>${inr(w.wage)}</dd></div>` : ''}
      <div><dt>Usual site</dt><dd>${esc(proj(w.project)?.name || '—')}</dd></div><div><dt>Engaged through</dt><dd>${esc(w.contractor)}</dd></div>
      <div><dt>Days worked (30 days)</dt><dd>${m30.length}</dd></div>${canMoney() ? `<div><dt>Earned (30 days)</dt><dd>${inr(sum(m30, e => e.wage))}</dd></div>` : ''}</dl>
    <div><h3>Recent work</h3>${en.length ? `<ul class="list">${en.slice(0, 8).map(e => `<li style="padding:10px 0"><div class="main-t"><b>${fmtD(e.report.date)} · ${esc(proj(e.report.project).name)}</b><span>${esc(e.tasks.map(t => e.report.work.find(x => x.id === t)?.title).filter(Boolean).join(', '))}</span></div>${canMoney() ? `<span class="num strong">${inr(e.wage)}</span>` : ''}</li>`).join('')}</ul>` : '<p class="muted">Not in any daily report yet.</p>'}</div>
    ${canSee('finance') && canMoney() ? `<div><h3>Advances</h3>${advs.length ? `<div>${advs.map(a => `<div class="kv-row"><span>${fmtD(a.date)} · ${esc(a.reason)}</span><b>${inr(a.amount)}${a.recovered ? ` <span class="muted" style="font-weight:400">(${inr(a.recovered)} recovered)</span>` : ''}</b></div>`).join('')}</div><p class="muted" style="margin-top:8px;font-size:13px">Balance to recover: <b>${inr(adv)}</b></p>` : '<p class="muted">No advances taken.</p>'}</div>` : ''}`,
    `${can('site') ? `<button class="btn left" data-act="editWorker" data-id="${id}">${ico('edit', 'sm')}Edit</button>` : ''}${can2('Pay salaries & advances') && canMoney() ? `<button class="btn" data-act="newAdvance" data-w="${id}">Give advance</button>` : ''}<button class="btn primary" data-act="closeDrawer">Done</button>`);
}
ACT.showWorker = el => showWorker(el.dataset.id);
function workerForm(w = {}, pid = ROUTE.q.p) {
  return `<div class="form"><div class="row2">${fld('Full name', 'name', { req: true, value: w.name })}${fld('Phone', 'phone', { type: 'tel', req: true, value: w.phone })}</div>
    <div class="row2">${fld('Work category', 'trade', { opts: TRADE_LIST, value: w.trade || 'Mason' })}${moneyFld('Default daily wage (₹)', 'wage', { type: 'number', req: true, value: w.wage || 950, min: 1, hint: 'Can be changed on each daily report' })}</div>
    <div class="row2">${fld('Usual site', 'project', { opts: projOpts(siteProjects()), value: w.project || pid })}${fld('Engaged through', 'contractor', { opts: CONTRACTORS, value: w.contractor || 'Direct' })}</div>
    ${w.id ? fld('Status', 'status', { opts: ['Active', 'Inactive'], value: w.status }) : ''}</div>`;
}
ACT.newWorker = el => { if (!guard(can('site'), 'add workers')) return; const pid = el?.dataset?.p; openModal({ title: 'Add worker to the register', sub: pid ? `Usual site: ${esc(proj(pid).name)}. Add them to daily reports on days they work.` : 'Add them to daily reports on days they work.', body: workerForm({}, pid || ROUTE.q.p), onSubmit: d => { const n = DB.workers.length + 101; DB.workers.push({ id: nid('w'), code: 'W-' + n, name: d.name, phone: d.phone, trade: d.trade, wage: +d.wage || DEFAULT_WAGE[d.trade] || 700, project: d.project, contractor: d.contractor, joined: TODAY, status: 'Active' }); logAct(`added worker ${d.name}`, d.project, 'site'); commit(`${d.name} added to the worker register`); } }); };
ACT.editWorker = el => { const w = worker(el.dataset.id); closeDrawer(); openModal({ title: 'Edit worker', sub: `${w.code}`, body: workerForm(w), onSubmit: d => { Object.assign(w, { name: d.name, phone: d.phone, trade: d.trade, wage: d.wage != null ? +d.wage : w.wage, project: d.project, contractor: d.contractor, status: d.status }); commit('Worker updated'); } }); };
