/* Dashboard & Reports */
'use strict';
const VIEWS = {};

function lastMonths(n) {
  const out = [], d = parseD(TODAY); d.setDate(1);
  for (let i = n - 1; i >= 0; i--) { const m = new Date(d); m.setMonth(m.getMonth() - i); out.push({ key: `${m.getFullYear()}-${pad(m.getMonth() + 1)}`, label: m.toLocaleDateString('en-IN', { month: 'short' }) }); }
  return out;
}
function quickActions() {
  const list = [];
  if (can('site')) list.push(['New daily report', 'newReport', 'report']);
  if (can('progress')) list.push(['Post progress update', 'newUpdate', 'flag']);
  if (can('documents')) list.push(['Upload files', 'upload', 'upload']);
  if (can2('Record client payments')) list.push(['Record client payment', 'newPayment', 'rupee']);
  if (can2('Add site expenses') && canSee('finance')) list.push(['Add site expense', 'newExpense', 'receipt']);
  if (can('enquiries')) list.push(['New enquiry', 'newEnquiry', 'enquiry']);
  return list;
}
ACT.quickMenu = el => openMenu(el, `<div class="mh">Quick add</div>${quickActions().map(([l, a, i]) => `<button data-act="${a}">${ico(i)}${l}</button>`).join('')}`);

// workforce pulse: ring gauge (today vs average, sites reported), smooth 14-day trend, a tile per site
function workforcePulse({ days, totals, series, sites, today, avg, peakI, done }) {
  const pctAvg = avg ? today / avg : 0, pctSites = done.reported.length / Math.max(1, sites.length);
  const ring = (r, w, pct, cls) => { const c = 2 * Math.PI * r; return `<circle class="rg-track" cx="60" cy="60" r="${r}" stroke-width="${w}"/><circle class="rg-arc ${cls}" cx="60" cy="60" r="${r}" stroke-width="${w}" stroke-dasharray="${c}" style="--len:${c};--off:${c * (1 - Math.min(1, pct))}"/>`; };
  // smooth trend
  const W = 640, H = 210, pl = 40, pr = 76, pt = 18, pb = 26, iw = W - pl - pr, ih = H - pt - pb;
  const { top, ticks } = niceTicks(Math.max(...totals, avg));
  const X = i => pl + iw * i / (totals.length - 1), Y = v => pt + ih - v / top * ih;
  const P = totals.map((v, i) => [X(i), Y(v)]);
  let d = `M${P[0][0]},${P[0][1]}`;
  for (let i = 0; i < P.length - 1; i++) { const p0 = P[i - 1] || P[i], p1 = P[i], p2 = P[i + 1], p3 = P[i + 2] || p2, t = .18;
    d += ` C${p1[0] + (p2[0] - p0[0]) * t},${p1[1] + (p2[1] - p0[1]) * t} ${p2[0] - (p3[0] - p1[0]) * t},${p2[1] - (p3[1] - p1[1]) * t} ${p2[0]},${p2[1]}`; }
  const last = P[P.length - 1];
  let svg = `<defs><linearGradient id="pulseFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style="stop-color:var(--viz);stop-opacity:.22"/><stop offset="1" style="stop-color:var(--viz);stop-opacity:0"/></linearGradient></defs>`;
  ticks.forEach(v => svg += `<line class="gl" x1="${pl}" x2="${W - pr}" y1="${Y(v)}" y2="${Y(v)}"/><text class="ax" x="${pl - 8}" y="${Y(v) + 4}" text-anchor="end">${v}</text>`);
  svg += `<line class="avg" x1="${pl}" x2="${W - pr}" y1="${Y(avg)}" y2="${Y(avg)}"/><text class="lbl" x="${W - pr + 8}" y="${Y(avg) + 4}">avg ${avg}</text>`;
  svg += `<path class="fill" d="${d} L${last[0]},${pt + ih} L${P[0][0]},${pt + ih} Z"/><path class="ln" d="${d}"/>`;
  const step = iw / (totals.length - 1);
  totals.forEach((v, i) => {
    const tip = `<b>${fmtD(days[i])}</b> · ${v} workers${i === totals.length - 1 && done.pending.length ? ` · ${done.pending.length} sites still to report` : ''}<br>${series.filter(sr => sr.values[i]).map(sr => `${esc(sr.name)}: ${sr.values[i]}`).join('<br>')}`;
    svg += `<g class="pt" data-tip="${esc(tip)}"><rect class="hit" x="${X(i) - step / 2}" y="${pt}" width="${step}" height="${ih}"/><line class="guide" x1="${X(i)}" x2="${X(i)}" y1="${pt}" y2="${pt + ih}"/><circle class="dot" cx="${X(i)}" cy="${Y(v)}" r="4.5"/></g>`;
    if ((totals.length - 1 - i) % 2 === 0) svg += `<text class="ax" x="${X(i)}" y="${H - 6}" text-anchor="middle">${i === totals.length - 1 ? 'Today' : parseD(days[i]).getDate()}</text>`;
  });
  svg += `<circle class="now-ring" cx="${last[0]}" cy="${last[1]}" r="9"/><circle class="now" cx="${last[0]}" cy="${last[1]}" r="5"/>`;
  // per-site tiles with a 7-day mini chart
  const tiles = sites.map(p => {
    const sr = series.find(x => x.name === p.name), v7 = sr.values.slice(-7), mx = Math.max(1, ...v7), r = reportFor(TODAY, p.id);
    const bars = v7.map((v, i) => { const h = Math.max(2, v / mx * 26), isT = i === 6; return isT && !r ? `<rect class="mb pend" x="${i * 11}" y="2" width="7" height="26" rx="2"/>` : `<rect class="mb${isT ? ' t' : ''}" x="${i * 11}" y="${28 - h}" width="7" height="${h}" rx="2"/>`; }).join('');
    return `<a class="ptile ${r ? 'ok' : 'pending'}" href="${r ? `#/site/report/${r.id}` : `#/site/report/new?p=${p.id}`}">
      <span class="pt-top"><span class="pt-dot"></span><span class="pt-nm">${esc(p.name)}</span></span>
      <span class="pt-mid">${r ? `<b>${r.crew.length}</b><small>workers</small>` : `<span class="pt-pend">${ico('clock', 'sm')}Pending</span>`}<svg class="pt-bars" viewBox="0 0 73 30" aria-hidden="true">${bars}</svg></span></a>`;
  }).join('');
  return `<section class="card pulse">
    <div class="card-head"><h2>Workers on site</h2><span class="sub">From daily reports · last 14 days</span><a class="btn ghost sm" href="#/site?tab=insights">By project ${ico('arrowR', 'sm')}</a></div>
    <div class="pulse-body">
      <div class="pulse-ring"><svg viewBox="0 0 120 120" aria-hidden="true">${ring(52, 9, pctAvg, 'a')}${ring(39, 7, pctSites, 'b')}</svg>
        <div class="pr-c"><b>${today}</b><span>today</span></div></div>
      <div class="pulse-stats">
        <div><i class="k a"></i><span>Of daily average</span><b>${Math.round(pctAvg * 100)}%</b><small>average ${avg} workers</small></div>
        <div><i class="k b"></i><span>Sites reported</span><b>${done.reported.length}<em>/${sites.length}</em></b><small>${done.pending.length ? `${done.pending.length} still to report` : 'all reported'}</small></div>
        <div><i class="k c"></i><span>14-day peak</span><b>${totals[peakI]}</b><small>${fmtD(days[peakI])}</small></div>
      </div>
      <div class="pulse-trend chart"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Workers on site, last 14 days">${svg}</svg></div>
    </div>
    <div class="pulse-sites">${tiles}</div>
  </section>`;
}

VIEWS.dashboard = () => {
  const u = me(), ids = myProjectIds();
  const mine = myProjects();
  const activeP = mine.filter(p => !['Completed', 'On hold'].includes(p.status));
  const risky = activeP.filter(p => ['Delayed', 'At risk'].includes(p.status));
  const att = siteSummary(TODAY, activeP.map(p => p.id));
  const showFin = canSee('finance') && canMoney(), showEnq = canSee('enquiries');
  const todaysWork = DB.reports.filter(r => ids.has(r.project) && r.date === TODAY && r.status === 'Submitted').flatMap(r => r.work.map(w => ({ ...w, r })));
  const openEnq = DB.enquiries.filter(e => !['Won', 'Lost'].includes(e.status));
  const fus = openEnq.flatMap(e => e.followUps.filter(f => !f.done).map(f => ({ ...f, e }))).sort((a, b) => a.date.localeCompare(b.date));
  const fin = activeP.concat(mine.filter(p => p.status === 'On hold')).map(p => projFinance(p.id));
  const outstanding = sum(fin, f => f.outstanding);

  const kpis = [
    `<div class="kpi"><div class="l">${ico('building', 'sm')}Ongoing projects</div><div class="v">${activeP.length}</div><div class="s">${risky.length ? `<span class="down">${risky.length} need attention</span>` : 'All on schedule'}</div></div>`,
    `<div class="kpi"><div class="l">${ico('users', 'sm')}Workers on site today</div><div class="v">${att.workers}</div><div class="s">${att.pending.length ? `${plural(att.pending.length, 'site')} yet to report` : 'All sites reported'}</div></div>`,
    showFin
      ? `<div class="kpi"><div class="l">${ico('rupee', 'sm')}Client outstanding</div><div class="v">${inrS(outstanding)}</div><div class="s">across ${plural(fin.filter(f => f.outstanding > 0).length, 'project')}</div></div>`
      : `<div class="kpi"><div class="l">${ico('task', 'sm')}Work items today</div><div class="v">${todaysWork.length}</div><div class="s">from ${plural(att.reported.length, 'daily report')}</div></div>`,
    showEnq
      ? `<div class="kpi"><div class="l">${ico('enquiry', 'sm')}Open enquiries</div><div class="v">${openEnq.length}</div><div class="s">${fus.filter(f => daysFrom(f.date) <= 0).length} follow-ups due</div></div>`
      : `<div class="kpi"><div class="l">${ico('alert', 'sm')}Open delays</div><div class="v">${DB.delays.filter(d => ids.has(d.project) && d.status === 'Open').length}</div><div class="s">on your projects</div></div>`,
  ];

  // needs attention
  const att2 = [];
  risky.forEach(p => att2.push({ tone: p.status === 'Delayed' ? 'bad' : 'warn', icon: 'alert', t: `${p.name} is ${p.status.toLowerCase()}`, s: `${p.progress}% done vs ${planPct(p)}% planned`, href: `#/progress?p=${p.id}` }));
  att.pending.forEach(pid => att2.push({ tone: 'warn', icon: 'report', t: `Daily report pending`, s: proj(pid).name, href: `#/site/report/new?p=${pid}` }));
  if (showEnq) fus.filter(f => daysFrom(f.date) < 0).slice(0, 2).forEach(f => att2.push({ tone: 'bad', icon: 'phone', t: `Overdue follow-up: ${f.e.name}`, s: `${f.note} · ${relD(f.date)}`, href: `#/enquiries?e=${f.e.id}` }));
  if (showFin) DB.contractorBills.filter(b => ids.has(b.project) && billStatus(b) === 'Overdue').slice(0, 2).forEach(b => att2.push({ tone: 'bad', icon: 'receipt', t: `Contractor bill overdue`, s: `${b.contractor} · ${inrS(b.amount - b.paid)}`, href: `#/finance?tab=bills` }));
  DB.milestones.filter(m => ids.has(m.project) && m.status !== 'Completed' && daysFrom(m.due) < 0 && proj(m.project).status !== 'On hold').slice(0, 2).forEach(m => att2.push({ tone: 'warn', icon: 'flag', t: `Milestone past due: ${m.name}`, s: `${proj(m.project).name} · due ${fmtD(m.due)}`, href: `#/progress?p=${m.project}` }));
  const wfa = workflowAttention();
  att2.unshift(...wfa.filter(x => x.first)); att2.push(...wfa.filter(x => !x.first));

  const projRows = activeP.sort((a, b) => (b.status === 'Delayed') - (a.status === 'Delayed') || b.value - a.value).slice(0, 6).map(p => `
    <li data-act="go" data-href="#/projects/${p.id}">
      <div class="main-t"><b>${esc(p.name)}</b><span>${esc(p.stages[p.stage])} · ${esc(p.city)}</span></div>
      <div style="width:min(220px,34%)">${meter(p.progress, projTone(p), planPct(p))}</div>
      <div style="width:94px;text-align:right">${badge(p.status)}</div>
    </li>`).join('');

  const attBlock = `<ul class="list click">${activeP.map(p => { const r = reportFor(TODAY, p.id); return r
      ? `<li data-act="go" data-href="#/site/report/${r.id}"><span class="sig ok">${ico('check', 'sm')}</span><div class="main-t"><b>${esc(p.name)}</b><span>${plural(r.crew.length, 'worker')} · ${plural(r.work.length, 'work item')}${canMoney() ? ` · ${inr(crewWages(r))} wages` : ''}</span></div>${ico('chevR', 'sm')}</li>`
      : `<li><span class="sig warn">${ico('clock', 'sm')}</span><div class="main-t"><b>${esc(p.name)}</b><span>Report pending</span></div>${can('site') ? `<a class="btn sm" href="#/site/report/new?p=${p.id}">Submit</a>` : badge('Pending', 'warn')}</li>`; }).join('')}</ul>`;

  const right2 = showEnq
    ? `<div class="card"><div class="card-head"><h2>Upcoming follow-ups</h2><a class="btn ghost sm" href="#/enquiries?tab=followups">View all</a></div>
        <ul class="list click" style="margin-top:8px">${fus.slice(0, 5).map(f => `<li data-act="go" data-href="#/enquiries?e=${f.e.id}">${av(f.e.name, 'sm')}<div class="main-t"><b>${esc(f.e.name)}</b><span>${esc(f.note)}</span></div><span class="meta ${daysFrom(f.date) < 0 ? '' : ''}">${daysFrom(f.date) < 0 ? `<span class="badge bad">${relD(f.date)}</span>` : relD(f.date)}</span></li>`).join('') || `<li class="muted">No follow-ups scheduled</li>`}</ul></div>`
    : `<div class="card"><div class="card-head"><h2>Work completed today</h2><a class="btn ghost sm" href="#/site">Daily reports</a></div>
        <ul class="list click" style="margin-top:8px">${todaysWork.slice(0, 6).map(w => `<li data-act="go" data-href="#/site/report/${w.r.id}"><span class="sig ok">${ico('task', 'sm')}</span><div class="main-t"><b>${esc(w.title)}</b><span>${esc(proj(w.r.project).name)} · ${plural(workersFor(w.r, w.id).length, 'worker')}</span></div><span class="num strong">${qtyText(w)}</span></li>`).join('') || `<li class="muted">No reports submitted yet today</li>`}</ul></div>`;

  let finBlock = '';
  if (showFin) {
    const months = lastMonths(6);
    const spendBy = months.map(m => ({ label: m.label, value: sum(DB.expenses.filter(e => ids.has(e.project) && e.date.startsWith(m.key)), e => e.amount) }));
    const recvBy = months.map(m => sum(DB.payments.filter(x => ids.has(x.project) && x.date.startsWith(m.key)), x => x.amount));
    const thisM = months[months.length - 1].key;
    const contractorDue = sum(DB.contractorBills.filter(b => ids.has(b.project)), b => b.amount - b.paid);
    finBlock = `<div class="card"><div class="card-head"><h2>Site expenses</h2><span class="sub">Last 6 months · materials, rentals, transport and site costs</span></div>
      <div class="grid g-main" style="padding:8px 24px 24px;align-items:center">
        ${barChart(spendBy.map((x, i) => ({ ...x, tip: `<b>${x.label}</b> · Spent ${inrS(x.value)} · Received ${inrS(recvBy[i])}` })), { h: 210, hiLast: true })}
        <div>
          <div class="kv-row"><span>Received this month</span><b>${inrS(sum(DB.payments.filter(x => ids.has(x.project) && x.date.startsWith(thisM)), x => x.amount))}</b></div>
          <div class="kv-row"><span>Spent this month</span><b>${inrS(spendBy[spendBy.length - 1].value)}</b></div>
          <div class="kv-row"><span>Client outstanding</span><b>${inrS(outstanding)}</b></div>
          <div class="kv-row"><span>Contractor dues</span><b>${inrS(contractorDue)}</b></div>
          <div style="margin-top:14px"><a class="btn sm" href="#/finance">Open finance ${ico('arrowR', 'sm')}</a></div>
        </div>
      </div></div>`;
  }
  // workforce trend from daily reports, scoped to this person's sites
  const wfDays = []; for (let i = -13; i <= 0; i++) wfDays.push(dayOff(i));
  const wfSites = activeP.filter(p => DB.reports.some(r => r.project === p.id)).sort((a, b) => a.code.localeCompare(b.code));
  const wfSeries = wfSites.map(p => ({ name: p.name, color: siteColor(p.id), values: wfDays.map(d => reportFor(d, p.id)?.crew.length || 0) }));
  const wfWages = wfDays.map(d => { const s = siteSummary(d, wfSites.map(p => p.id)); return { label: fmtD(d), value: s.wages, tip: `<b>${fmtD(d)}</b> · ${inr(s.wages)} wages · ${s.workers} workers${s.pending.length ? ` · ${s.pending.length} not reported` : ''}` }; });
  const wk = (a, b) => sum(wfWages.slice(a, b), x => x.value);
  const wkCh = wk(7, 14) && wk(0, 7) ? Math.round((wk(7, 14) / wk(0, 7) - 1) * 100) : null;
  const wfTotals = wfDays.map((d, i) => sum(wfSeries, sr => sr.values[i]));
  const wfToday = wfTotals[wfTotals.length - 1], wfDone = siteSummary(TODAY, wfSites.map(p => p.id));
  const wfPast = wfTotals.slice(0, -1).filter(v => v > 0);
  const wfAvg = Math.round(sum(wfPast) / Math.max(1, wfPast.length));
  const wfPeakI = wfTotals.indexOf(Math.max(...wfTotals));
  const wfBlock = wfSites.length ? workforcePulse({ days: wfDays, totals: wfTotals, series: wfSeries, sites: wfSites, today: wfToday, avg: wfAvg, peakI: wfPeakI, done: wfDone }) : '';
  const wageCard = wfSites.length && canMoney() ? `<div class="card"><div class="card-head"><h2>Daily wage bill</h2><a class="btn ghost sm" href="#/site?tab=insights">Insights</a></div>
        <div class="card-body"><div class="wf-sum"><div><span>Last 7 days</span><b>${inrS(wk(7, 14))}</b></div><div><span>Previous 7 days</span><b>${inrS(wk(0, 7))}</b></div>${wkCh != null ? `<div><span>Change</span><b style="color:var(${wkCh > 0 ? '--warn' : '--ok'})">${wkCh > 0 ? '▲' : '▼'} ${Math.abs(wkCh)}%</b></div>` : ''}</div>
        ${areaChart(wfWages, { h: 230, w: 520 })}</div></div>` : '';
  const qa = quickActions();
  const dueFU = fus.filter(f => daysFrom(f.date) <= 0).length;
  const pills = [
    [`<b>${activeP.length}</b> ongoing projects`, '#/projects', '#8EB5EE'],
    [`<b>${att.workers}</b> on site today`, '#/site', '#6CCB97'],
    risky.length ? [`<b>${risky.length}</b> need attention`, '#/progress', '#F08C84'] : null,
    showEnq ? [`<b>${dueFU}</b> follow-ups due`, '#/enquiries?tab=followups', '#E8B651'] : [`<b>${att.pending.length}</b> reports pending`, '#/site', '#E8B651'],
  ].filter(Boolean);
  return `
    <section class="hero">
      <img class="hero-mark" src="assets/logo.png" alt="">
      <div class="hero-t"><div class="hero-k">${fmtLong(TODAY)} · ${esc(ROLES[u.role].label)}</div>
        <h1>${greeting()}, ${esc(u.name.split(' ')[0])}</h1>
        <p>${isScoped() ? `You are assigned to ${plural(mine.length, 'project')}.` : 'Here is what is happening across your sites today.'}</p>
        <div class="hero-pills">${pills.map(([t, h, c]) => `<a href="${h}"><span class="dot" style="--dc:${c}"></span>${t}</a>`).join('')}</div></div>
      <div class="hero-a">${role() === 'owner' ? `<a class="btn" href="#/analytics">${ico('trend')}Analytics</a>` : ''}${qa.length ? `<button class="btn primary" data-act="quickMenu" aria-haspopup="menu">${ico('plus')}Quick add</button>` : ''}</div>
    </section>
    <div class="kpis">${kpis.join('')}</div>
    ${wfBlock}
    ${floorDashCard()}
    <div class="grid g-main">
      <div class="card"><div class="card-head"><h2>Ongoing projects</h2><a class="btn ghost sm" href="#/projects">All projects</a></div>
        <ul class="list click" style="margin-top:8px">${projRows || '<li class="muted">No ongoing projects</li>'}</ul>
        <div class="card-foot" style="justify-content:flex-start"><span class="legend"><span><i style="width:2px;height:12px;background:var(--ink);border-radius:2px"></i>Planned progress for today</span></span></div>
      </div>
      <div class="card"><div class="card-head"><h2>Needs attention</h2><span class="sub">${att2.length}</span></div>
        <ul class="list click" style="margin-top:8px">${att2.slice(0, 7).map(x => `<li data-act="go" data-href="${x.href}"><span class="sig ${x.tone}">${ico(x.icon, 'sm')}</span><div class="main-t"><b>${esc(x.t)}</b><span>${esc(x.s)}</span></div>${ico('chevR', 'sm')}</li>`).join('') || '<li class="muted">Nothing needs your attention right now.</li>'}</ul>
      </div>
    </div>
    ${opsTiles()}
    <div class="grid g2">
      ${wageCard || `<div class="card"><div class="card-head"><h2>Today's site reports</h2><a class="btn ghost sm" href="#/site">All reports</a></div><div style="margin-top:8px">${attBlock}</div></div>`}
      ${right2}
    </div>
    ${finBlock}`;
};

/* ================= Reports ================= */
function csvDownload(name, rows) {
  const csv = rows.map(r => r.map(c => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  toast(`Exported ${name}`);
}
let REPORT_ROWS = null;
ACT.exportReport = () => REPORT_ROWS && csvDownload(REPORT_ROWS.name, REPORT_ROWS.rows);
ACT.print = () => print();

VIEWS.reports = () => {
  const money = canMoney();
  // financial reports are limited to roles with financial access, even when opened from a link
  const tab = ROUTE.q.tab === 'expenses' && !(canSee('finance') && money) ? 'projects' : ROUTE.q.tab || 'projects';
  const ids = myProjectIds();
  const ps = myProjects();
  let body = '';
  if (tab === 'projects' && !money) {
    const act = ps.filter(p => !['Completed'].includes(p.status));
    REPORT_ROWS = { name: 'project-progress.csv', rows: [['Code', 'Project', 'Status', 'Stage', 'Progress %', 'Planned %', 'Days lost to stoppages', 'Target completion'], ...ps.map(p => [p.code, p.name, p.status, p.stages[p.stage], p.progress, planPct(p), completionImpact(p).lost, p.end])] };
    body = `<div class="kpis">
      <div class="kpi"><div class="l">Projects</div><div class="v">${ps.length}</div><div class="s">${act.length} ongoing</div></div>
      <div class="kpi"><div class="l">Average progress</div><div class="v">${Math.round(sum(act, p => p.progress) / Math.max(1, act.length))}%</div><div class="s">ongoing projects</div></div>
      <div class="kpi"><div class="l">Behind schedule</div><div class="v">${act.filter(p => p.progress - planPct(p) < -5).length}</div><div class="s">more than 5 pts behind plan</div></div>
      <div class="kpi"><div class="l">Days lost</div><div class="v">${num(sum(ps, p => completionImpact(p).lost))}</div><div class="s">to work stoppages</div></div></div>
      <div class="card"><div class="card-head"><h2>Project summary</h2><span class="sub">Progress against plan · financial figures are limited to the Owner and Accounts</span></div>
      <div class="table-wrap" style="margin-top:12px"><table class="t"><thead><tr><th>Project</th><th>Status</th><th style="min-width:170px">Progress</th><th>Stage</th><th class="r">Days lost</th><th>Target completion</th></tr></thead>
      <tbody>${ps.map(p => `<tr class="click" data-act="go" data-href="#/projects/${p.id}"><td class="strong">${esc(p.name)}<span class="sub">${p.code} · ${esc(p.city)}</span></td><td>${badge(p.status)}</td><td>${meter(p.progress, projTone(p), planPct(p))}</td><td>${esc(p.stages[p.stage])}</td><td class="r">${num(completionImpact(p).lost)}</td><td class="nowrap">${fmtDY(p.end)}</td></tr>`).join('')}</tbody></table></div></div>`;
  } else if (tab === 'projects') {
    const rows = ps.map(p => ({ p, f: projFinance(p.id) }));
    const T = k => sum(rows, r => r.f[k]);
    REPORT_ROWS = { name: 'project-summary.csv', rows: [['Code', 'Project', 'Status', 'Progress %', 'Planned %', 'Contract value', 'Billed', 'Received', 'Outstanding', 'Spent'], ...rows.map(({ p, f }) => [p.code, p.name, p.status, p.progress, planPct(p), f.value, f.billed, f.received, f.outstanding, f.spent])] };
    body = `<div class="kpis">
      <div class="kpi"><div class="l">Contract value</div><div class="v">${inrS(T('value'))}</div><div class="s">${plural(ps.length, 'project')}</div></div>
      <div class="kpi"><div class="l">Billed to clients</div><div class="v">${inrS(T('billed'))}</div><div class="s">${Math.round(T('billed') / T('value') * 100)}% of contract value</div></div>
      <div class="kpi"><div class="l">Received</div><div class="v">${inrS(T('received'))}</div><div class="s">${Math.round(T('received') / Math.max(1, T('billed')) * 100)}% of billed</div></div>
      <div class="kpi"><div class="l">Spent to date</div><div class="v">${inrS(T('spent'))}</div><div class="s">materials, labour, contractors</div></div></div>
      <div class="card"><div class="card-head"><h2>Project summary</h2><span class="sub">Progress against plan and financial position</span></div>
      <div class="table-wrap" style="margin-top:12px"><table class="t"><thead><tr><th>Project</th><th>Status</th><th style="min-width:170px">Progress</th><th class="r">Contract</th><th class="r">Received</th><th class="r">Outstanding</th><th class="r">Spent</th></tr></thead>
      <tbody>${rows.map(({ p, f }) => `<tr class="click" data-act="go" data-href="#/projects/${p.id}"><td class="strong">${esc(p.name)}<span class="sub">${p.code} · ${esc(p.city)}</span></td><td>${badge(p.status)}</td><td>${meter(p.progress, projTone(p), planPct(p))}</td><td class="r">${inrS(f.value)}</td><td class="r">${inrS(f.received)}</td><td class="r">${f.outstanding > 0 ? inrS(f.outstanding) : '—'}</td><td class="r">${inrS(f.spent)}</td></tr>`).join('')}</tbody>
      <tfoot><tr><td>Total</td><td></td><td></td><td class="r">${inrS(T('value'))}</td><td class="r">${inrS(T('received'))}</td><td class="r">${inrS(T('outstanding'))}</td><td class="r">${inrS(T('spent'))}</td></tr></tfoot></table></div></div>`;
  } else if (tab === 'workforce') {
    const days = []; for (let i = -13; i <= 0; i++) days.push(dayOff(i));
    const act = ps.filter(p => !['Completed', 'On hold'].includes(p.status)).map(p => p.id);
    const series = days.map(d => { const s = siteSummary(d, act); return { label: parseD(d).getDate() + '', value: s.workers, tip: `<b>${fmtD(d)}</b> · ${s.workers} workers${money ? ` · ${inrS(s.wages)}` : ''}${s.pending.length ? ` · ${s.pending.length} site(s) not reported` : ''}` }; });
    const from = dayOff(-13);
    const reps14 = DB.reports.filter(r => act.includes(r.project) && r.status === 'Submitted' && r.date >= from);
    const trades = {};
    reps14.forEach(r => r.crew.forEach(c => { (trades[c.trade] ||= { n: 0, wage: 0 }); trades[c.trade].n++; trades[c.trade].wage += c.wage; }));
    const perP = act.map(pid => { const rs = reps14.filter(r => r.project === pid); return { p: proj(pid), crew: new Set(rs.flatMap(r => r.crew.map(c => c.wid || c.name))).size, md: sum(rs, r => r.crew.length), cost: sum(rs, crewWages) }; });
    REPORT_ROWS = { name: 'workforce-14-days.csv', rows: money ? [['Project', 'Crew', 'Man-days (14d)', 'Labour cost (14d)'], ...perP.map(r => [r.p.name, r.crew, r.md, r.cost])] : [['Project', 'Crew', 'Man-days (14d)'], ...perP.map(r => [r.p.name, r.crew, r.md])] };
    body = `<div class="card"><div class="card-head"><h2>Workers on site</h2><span class="sub">Daily headcount from site reports, last 14 days</span></div><div class="card-body">${barChart(series, { h: 280, w: 1200, fmt: v => Math.round(v), hiLast: true })}</div></div>
      <div class="grid g2">
        <div class="card"><div class="card-head"><h2>Labour by project</h2><span class="sub">Last 14 days</span></div>
          <div class="table-wrap" style="margin-top:12px"><table class="t"><thead><tr><th>Project</th><th class="r">Different workers</th><th class="r">Man-days</th>${money ? '<th class="r">Labour cost</th>' : ''}</tr></thead>
          <tbody>${perP.map(r => `<tr><td class="strong">${esc(r.p.name)}</td><td class="r">${r.crew}</td><td class="r">${num(r.md)}</td>${money ? `<td class="r">${inrS(r.cost)}</td>` : ''}</tr>`).join('')}</tbody></table></div></div>
        <div class="card"><div class="card-head"><h2>Man-days by category</h2><span class="sub">Last 14 days</span></div>
          <div class="card-body">${hBars(Object.entries(trades).sort((a, b) => b[1].n - a[1].n).map(([t, v]) => ({ label: t, value: v.n, extra: money ? `avg wage ${inr(v.wage / v.n)}/day` : '' })), v => plural(v, 'day'))}</div></div>
      </div>`;
  } else if (tab === 'expenses') {
    const ex = DB.expenses.filter(e => ids.has(e.project));
    const months = lastMonths(6);
    const cats = {}; ex.forEach(e => cats[e.category] = (cats[e.category] || 0) + e.amount);
    const byP = ps.map(p => ({ label: p.name, value: sum(ex.filter(e => e.project === p.id), e => e.amount) })).filter(x => x.value).sort((a, b) => b.value - a.value);
    REPORT_ROWS = { name: 'site-expenses.csv', rows: [['Date', 'Project', 'Category', 'Item', 'Vendor', 'Amount', 'Mode'], ...ex.map(e => [e.date, proj(e.project).name, e.category, e.item, e.vendor, e.amount, e.mode])] };
    body = `<div class="card"><div class="card-head"><h2>Monthly site expenses</h2><span class="sub">Last 6 months</span></div><div class="card-body">${barChart(months.map(m => ({ label: m.label, value: sum(ex.filter(e => e.date.startsWith(m.key)), e => e.amount) })), { h: 280, w: 1200, hiLast: true })}</div></div>
      <div class="grid g2">
        <div class="card"><div class="card-head"><h2>By category</h2><span class="sub">All time</span></div><div class="card-body">${hBars(Object.entries(cats).sort((a, b) => b[1] - a[1]).map(([label, value]) => ({ label, value })))}</div></div>
        <div class="card"><div class="card-head"><h2>By project</h2><span class="sub">All time</span></div><div class="card-body">${hBars(byP)}</div></div>
      </div>`;
  } else if (tab === 'enquiries') {
    const en = DB.enquiries;
    const ST = ['New', 'Contacted', 'Site visit', 'Quotation sent', 'Negotiation', 'Won', 'Lost'];
    const won = en.filter(e => e.status === 'Won').length, lost = en.filter(e => e.status === 'Lost').length;
    const src = {}; en.forEach(e => src[e.source] = (src[e.source] || 0) + 1);
    const pipeline = sum(en.filter(e => !['Won', 'Lost'].includes(e.status)), e => e.quote?.amount || e.budget);
    REPORT_ROWS = { name: 'enquiries.csv', rows: [['Name', 'Phone', 'Source', 'City', 'Type', ...(money ? ['Budget'] : []), 'Status', 'Owner', 'Created'], ...en.map(e => [e.name, e.phone, e.source, e.city, e.type, ...(money ? [e.budget] : []), e.status, userName(e.owner), e.created])] };
    body = `<div class="kpis"><div class="kpi"><div class="l">Total enquiries</div><div class="v">${en.length}</div></div>
      ${money ? `<div class="kpi"><div class="l">Open pipeline</div><div class="v">${inrS(pipeline)}</div><div class="s">quoted or budget value</div></div>` : `<div class="kpi"><div class="l">Open enquiries</div><div class="v">${en.filter(e => !['Won', 'Lost'].includes(e.status)).length}</div><div class="s">in the pipeline</div></div>`}
      <div class="kpi"><div class="l">Won</div><div class="v">${won}</div><div class="s">converted to projects</div></div>
      <div class="kpi"><div class="l">Win rate</div><div class="v">${Math.round(won / Math.max(1, won + lost) * 100)}%</div><div class="s">of closed enquiries</div></div></div>
      <div class="grid g2">
        <div class="card"><div class="card-head"><h2>Enquiries by stage</h2></div><div class="card-body">${hBars(ST.map(s => ({ label: s, value: en.filter(e => e.status === s).length })), v => v)}</div></div>
        <div class="card"><div class="card-head"><h2>Enquiries by source</h2></div><div class="card-body">${hBars(Object.entries(src).sort((a, b) => b[1] - a[1]).map(([label, value]) => ({ label, value })), v => v)}</div></div>
      </div>`;
  }
  const T = [['projects', 'Projects'], ['workforce', 'Workforce']];
  if (canSee('finance') && money) T.push(['expenses', 'Expenses']);
  if (canSee('enquiries')) T.push(['enquiries', 'Enquiries']);
  return `${pageHead('Reports', money ? 'Summaries across projects, workforce, spending and sales.' : 'Summaries across projects, workforce and sales. Financial reports are limited to the Owner and Accounts.', `<button class="btn" data-act="print">${ico('print')}Print</button><button class="btn" data-act="exportReport">${ico('download')}Export CSV</button>`)}
    ${tabs(T, tab)}${body}`;
};

/* ================= Analytics (owner) ================= */
function monthsBack(n) { const d = parseD(TODAY); d.setDate(1); d.setMonth(d.getMonth() - (n - 1)); return iso(d); }
const inRange = (date, from, to) => date >= from && date <= to;
const pct = (a, b) => b ? Math.round(a / b * 100) : 0;
function delta(cur, prev, { invert = false, unit = '%' } = {}) {
  if (!prev) return '<span class="muted">no earlier data</span>';
  const ratio = cur / prev, ch = Math.round((ratio - 1) * 100);
  if (ratio > 10) return '<span class="muted">little activity in the previous period</span>';
  const good = invert ? ch <= 0 : ch >= 0;
  const txt = ch >= 100 ? `${ratio.toFixed(1)}×` : `${Math.abs(ch)}${unit}`;
  return `<span class="${good ? 'up' : 'down'}">${ch >= 0 ? '▲' : '▼'} ${txt}</span> vs previous period`;
}
function projEconomics(p) {
  const f = projFinance(p.id);
  const done = p.status === 'Completed' ? 100 : p.progress;
  const eac = done >= 10 ? f.spent / (done / 100) : null; // estimated cost at completion
  const margin = eac != null ? (p.value - eac) / p.value : null;
  return { p, f, eac, margin, sqft: eac && p.area ? eac / p.area : null, varc: p.progress - planPct(p) };
}
ACT.exportAnalytics = () => {
  const rows = myProjects().map(projEconomics);
  csvDownload('project-profitability.csv', [['Project', 'Status', 'Progress %', 'Schedule variance (pts)', 'Contract value', 'Spent to date', 'Estimated cost at completion', 'Projected margin %', 'Cost per sq.ft'],
    ...rows.map(r => [r.p.name, r.p.status, r.p.progress, r.p.status === 'Completed' ? 0 : r.varc, r.p.value, r.f.spent, r.eac ? Math.round(r.eac) : '', r.margin != null ? Math.round(r.margin * 100) : '', r.sqft ? Math.round(r.sqft) : ''])]);
};

VIEWS.analytics = () => {
  const n = [3, 6, 12].includes(+ROUTE.q.range) ? +ROUTE.q.range : 6;
  const from = monthsBack(n), to = TODAY;
  const pFrom = shiftD(from, -Math.round((parseD(to) - parseD(from)) / 864e5) - 1), pTo = shiftD(from, -1);
  const ps = DB.projects;
  const active = ps.filter(p => !['Completed', 'On hold'].includes(p.status));
  const econ = ps.map(projEconomics);

  // financial
  const collected = sum(DB.payments.filter(x => inRange(x.date, from, to)), x => x.amount);
  const collectedPrev = sum(DB.payments.filter(x => inRange(x.date, pFrom, pTo)), x => x.amount);
  const spend = sum(DB.expenses.filter(x => inRange(x.date, from, to)), x => x.amount);
  const spendPrev = sum(DB.expenses.filter(x => inRange(x.date, pFrom, pTo)), x => x.amount);
  const billed = sum(econ, e => e.f.billed), received = sum(econ, e => e.f.received);
  const orderBook = sum(ps.filter(p => p.status !== 'Completed'), p => p.value - projFinance(p.id).billed);
  const withM = econ.filter(e => e.margin != null);
  const portMargin = sum(withM, e => e.p.value - e.eac) / Math.max(1, sum(withM, e => e.p.value));

  // delivery & operations
  const onSched = active.filter(p => p.progress - planPct(p) >= -5).length;
  const avgVar = Math.round(sum(active, p => p.progress - planPct(p)) / Math.max(1, active.length));
  let due = 0, filed = 0, md = 0, wg = 0;
  for (let i = -13; i <= 0; i++) { const s = siteSummary(dayOff(i), active.map(p => p.id)); due += s.reported.length + s.pending.length; filed += s.reported.length; md += s.workers; wg += s.wages; }
  const openDelays = DB.delays.filter(d => d.status === 'Open');

  // sales
  const en = DB.enquiries, won = en.filter(e => e.status === 'Won').length, lost = en.filter(e => e.status === 'Lost').length;
  const pipeline = sum(en.filter(e => !['Won', 'Lost'].includes(e.status)), e => e.quote?.amount || e.budget);

  const months = lastMonths(n);
  const coll = months.map(m => ({ label: m.label, value: sum(DB.payments.filter(x => x.date.startsWith(m.key)), x => x.amount) }));
  const spm = months.map(m => ({ label: m.label, value: sum(DB.expenses.filter(x => x.date.startsWith(m.key)), x => x.amount) }));
  const attDays = []; for (let i = -13; i <= 0; i++) { const d = dayOff(i), s = siteSummary(d, active.map(p => p.id)); attDays.push({ label: String(parseD(d).getDate()), value: s.workers, tip: `<b>${fmtD(d)}</b> · ${s.workers} workers · ${inrS(s.wages)} wages` }); }
  const reasons = {}; DB.delays.forEach(d => reasons[d.reason] = (reasons[d.reason] || 0) + stopDays(d));
  const ST = ['New', 'Contacted', 'Site visit', 'Quotation sent', 'Negotiation', 'Won'];
  const reached = s => en.filter(e => e.status !== 'Lost' && ST.indexOf(e.status) >= ST.indexOf(s)).length + (ST.indexOf(s) <= 3 ? en.filter(e => e.status === 'Lost' && e.quote).length : 0);
  const src = {}; en.forEach(e => { (src[e.source] ||= { n: 0, won: 0 }); src[e.source].n++; if (e.status === 'Won') src[e.source].won++; });

  const marginCell = e => e.margin == null ? '<span class="muted">Too early</span>' : e.margin < 0 ? `<span class="badge bad">${Math.round(e.margin * 100)}% · loss risk</span>` : e.margin < .12 ? `<span class="badge warn">${Math.round(e.margin * 100)}% · thin</span>` : `<span class="badge ok">${Math.round(e.margin * 100)}%</span>`;
  const risky = withM.filter(e => e.margin < .12 && e.p.status !== 'Completed');

  return `${pageHead('Analytics', 'Business performance across finance, delivery, workforce and sales. Visible to the owner only.',
      `<div class="seg" role="group" aria-label="Period">${[3, 6, 12].map(m => `<button class="${n === m ? 'on' : ''}" data-act="setQ" data-k="range" data-v="${m}">${m} months</button>`).join('')}</div><button class="btn" data-act="exportAnalytics">${ico('download')}Export</button>`)}
    ${risky.length ? `<div class="banner warn">${ico('alert')}<span><b>${plural(risky.length, 'project')}</b> trending to a thin or negative margin: ${risky.map(e => esc(e.p.name)).join(', ')}. Review cost to complete.</span></div>` : ''}
    <div><div class="section-title"><h2>Financial health</h2><span class="muted" style="font-size:13px">${fmtD(from)} – ${fmtD(to)}</span></div>
    <div class="kpis">
      <div class="kpi"><div class="l">Collections</div><div class="v">${inrS(collected)}</div><div class="s">${delta(collected, collectedPrev)}</div></div>
      <div class="kpi"><div class="l">Site spending</div><div class="v">${inrS(spend)}</div><div class="s">${delta(spend, spendPrev, { invert: true })}</div></div>
      <div class="kpi"><div class="l">Projected portfolio margin</div><div class="v">${Math.round(portMargin * 100)}%</div><div class="s">based on cost to date vs progress</div></div>
      <div class="kpi"><div class="l">Order book</div><div class="v">${inrS(orderBook)}</div><div class="s">contract value still to bill</div></div>
    </div></div>
    <div><div class="section-title"><h2>Delivery & operations</h2></div>
    <div class="kpis">
      <div class="kpi"><div class="l">Projects on schedule</div><div class="v">${onSched}<small> / ${active.length}</small></div><div class="s">within 5 pts of plan</div></div>
      <div class="kpi"><div class="l">Avg. schedule variance</div><div class="v" style="color:var(${avgVar < -5 ? '--bad' : avgVar < 0 ? '--warn' : '--ok'})">${avgVar > 0 ? '+' : ''}${avgVar}<small> pts</small></div><div class="s">actual vs planned progress</div></div>
      <div class="kpi"><div class="l">Daily report compliance</div><div class="v">${pct(filed, due)}%</div><div class="s">${Math.round(md / 14)} workers/day · ${inrS(wg / 14)} wages/day</div></div>
      <div class="kpi"><div class="l">Collection efficiency</div><div class="v">${pct(received, billed)}%</div><div class="s">${inrS(billed - received)} billed, not received</div></div>
    </div></div>
    <div class="grid g2">
      <div class="card"><div class="card-head"><h2>Collections by month</h2><span class="sub">Client payments received</span></div><div class="card-body">${barChart(coll, { h: 200, hiLast: true })}</div></div>
      <div class="card"><div class="card-head"><h2>Site spending by month</h2><span class="sub">Materials, rentals, transport, site costs</span></div><div class="card-body">${barChart(spm, { h: 200, hiLast: true })}</div></div>
    </div>
    <div class="card"><div class="card-head"><h2>Project profitability</h2><span class="sub">Estimated cost at completion = cost to date ÷ progress</span></div>
      <div class="table-wrap" style="margin-top:12px"><table class="t"><thead><tr><th>Project</th><th class="r">Contract</th><th class="r">Spent to date</th><th class="r">Est. final cost</th><th class="r">Cost / sq.ft</th><th class="r">Schedule</th><th>Projected margin</th></tr></thead>
      <tbody>${econ.sort((a, b) => (a.margin ?? 9) - (b.margin ?? 9)).map(e => `<tr class="click" data-act="go" data-href="#/projects/${e.p.id}?tab=finance"><td class="strong">${esc(e.p.name)}<span class="sub">${e.p.progress}% complete · ${esc(e.p.status)}</span></td><td class="r">${inrS(e.p.value)}</td><td class="r">${inrS(e.f.spent)}</td><td class="r">${e.eac ? inrS(e.eac) : '—'}</td><td class="r">${e.sqft ? inr(e.sqft) : '—'}</td><td class="r">${e.p.status === 'Completed' ? '—' : `<span style="color:var(${e.varc < -5 ? '--bad' : e.varc < 0 ? '--warn' : '--ok'})">${e.varc > 0 ? '+' : ''}${e.varc} pts</span>`}</td><td>${marginCell(e)}</td></tr>`).join('')}</tbody></table></div></div>
    <div class="grid g2">
      <div class="card"><div class="card-head"><h2>Workers on site</h2><span class="sub">Last 14 days · from daily reports</span></div><div class="card-body">${barChart(attDays, { h: 190, fmt: v => Math.round(v), hiLast: true })}</div></div>
      <div class="card"><div class="card-head"><h2>Days lost to delays</h2><span class="sub">${openDelays.length} open · by cause</span></div><div class="card-body">${hBars(Object.entries(reasons).sort((a, b) => b[1] - a[1]).map(([label, value]) => ({ label, value })), fmtDays)}</div></div>
    </div>
    <div class="grid g2">
      <div class="card"><div class="card-head"><h2>Sales funnel</h2><span class="sub">Win rate ${pct(won, won + lost)}% · pipeline ${inrS(pipeline)}</span></div><div class="card-body">${hBars(ST.map(s => ({ label: s === 'Won' ? 'Won (project)' : s, value: s === 'New' ? en.length : reached(s) })), v => v)}</div></div>
      <div class="card"><div class="card-head"><h2>Lead sources</h2><span class="sub">Enquiries and wins by source</span></div><div class="card-body">${hBars(Object.entries(src).sort((a, b) => b[1].n - a[1].n).map(([label, v]) => ({ label, value: v.n, extra: `${v.won} won` })), v => v)}</div></div>
    </div>`;
};
