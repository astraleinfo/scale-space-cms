/* Dashboard additions: pending actions for the signed-in role, and one compact tile per workflow module
   (team, site reports & stoppages, invoices & expenses, documents, materials, service). */
'use strict';

const _quickActions = quickActions;
quickActions = function () {
  const list = _quickActions();
  if (isEmployee()) { const r = attRec(SESSION, TODAY); if (!r) list.unshift(['Check in', 'checkIn', 'camera']); else if (!r.out) list.unshift(['Check out', 'checkOut', 'camera']); list.push(['Apply for leave', 'applyLeave', 'leave']); }
  if (can('progress') || can('site')) list.push(['Record work stoppage', 'newDelay', 'alert']);
  if (can('materials') && canMoney()) list.push(['Record material purchase', 'newPurchase', 'box']);
  if (can('service')) list.push(['Record service activity', 'newService', 'wrench']);
  if (canPayBills()) list.push(['New client invoice', 'newInvoice', 'invoice']);
  return list;
};

// pending actions added to the dashboard's "Needs attention" list
function workflowAttention() {
  const out = [], ids = myProjectIds();
  if (isEmployee() && isWorkDay(TODAY) && !attRec(SESSION, TODAY) && !leaveOn(SESSION, TODAY)) out.push({ tone: nowMins() > SHIFT.start + SHIFT.grace ? 'bad' : 'warn', icon: 'userCheck', t: 'You haven\'t checked in today', s: `Shift started at 9:00 AM${nowMins() > SHIFT.start + SHIFT.grace ? ' · you will be marked late' : ''}`, href: '#/attendance', first: true });
  const lv = DB.leaves.filter(l => l.status === 'Pending' && canApproveLeave(l));
  if (lv.length) out.push({ tone: 'warn', icon: 'leave', t: `${plural(lv.length, 'leave request')} to approve`, s: lv.slice(0, 2).map(l => `${userName(l.user)} · ${fmtD(l.from)}`).join(', '), href: '#/leave?tab=approvals', first: true });
  if (can2('Correct attendance')) { const c = (DB.attRequests || []).filter(q => q.status === 'Pending'); if (c.length) out.push({ tone: 'warn', icon: 'userCheck', t: `${plural(c.length, 'attendance correction')} to review`, s: c.map(q => `${userName(q.user)} · ${q.type.toLowerCase()}`).slice(0, 2).join(', '), href: '#/attendance?tab=corrections', first: true }); }
  const dq = DB.documents.filter(d => !isMedia(d) && !d.archived && docStatus(d) === 'Under Review' && isReviewer(d));
  if (dq.length) out.push({ tone: 'warn', icon: 'file', t: `${plural(dq.length, 'document')} awaiting your approval`, s: dq.slice(0, 2).map(d => `${d.name.replace(/\.\w+$/, '')} v${d.version}`).join(', '), href: '#/documents?tab=review', first: true });
  if (canBehalf()) { const rq = openRequests(); if (rq.length) out.push({ tone: 'bad', icon: 'send', t: `${plural(rq.length, 'report upload request')} from site`, s: rq.map(q => `${userName(q.by)} · ${proj(q.project).name}`).slice(0, 2).join(', '), href: '#/site?tab=compliance', first: true }); }
  if (canSee('site')) { const miss = complianceSlots(3).slots.filter(s => s.st === 'Missing' && s.day < TODAY); if (miss.length) out.push({ tone: 'bad', icon: 'report', t: `${plural(miss.length, 'daily report')} missed`, s: miss.slice(0, 2).map(s => `${s.p.name} · ${fmtD(s.day)}`).join(', '), href: '#/site?tab=compliance&st=Missing' }); }
  const ap = DB.appraisals.filter(a => a.period === cycle().key && ['Pending', 'Self-review submitted'].includes(a.status) && a.reviewer === SESSION);
  if (ap.length && canSee('performance')) out.push({ tone: 'warn', icon: 'star', t: `${plural(ap.length, 'appraisal')} to complete`, s: `${cycle().label} cycle`, href: '#/performance?tab=appraisals' });
  if (canSee('invoices')) { const od = DB.invoices.filter(i => ids.has(i.project) && clientStatus(i) === 'Overdue'); if (od.length) out.push({ tone: 'bad', icon: 'invoice', t: `${plural(od.length, 'client invoice')} overdue`, s: `${inrS(sum(od, i => invTotal(i) - invPaid(i)))} to collect`, href: '#/invoices?st=Overdue' }); }
  if (canSee('materials')) { const iss = myPurchases().flatMap(pu => pu.deliveries.filter(d => d.issues.length && daysFrom(d.date) >= -7).map(d => ({ pu, d }))); if (iss.length) out.push({ tone: 'warn', icon: 'truck', t: `${plural(iss.length, 'delivery issue')} this week`, s: iss.slice(0, 2).map(x => `${x.d.issues[0].type} · ${x.pu.material}`).join(', '), href: '#/materials?tab=deliveries&iss=any' }); }
  if (canSee('service')) { const fu = myServices().filter(s => fuDue(s) && daysFrom(s.followUp.date) <= 0); if (fu.length) out.push({ tone: 'warn', icon: 'wrench', t: `${plural(fu.length, 'service follow-up')} due`, s: fu.slice(0, 2).map(s => s.followUp.note).join(', '), href: '#/service' }); }
  const stops = DB.delays.filter(d => ids.has(d.project) && d.status === 'Open');
  if (stops.length) out.push({ tone: 'bad', icon: 'alert', t: `${plural(stops.length, 'work stoppage')} ongoing`, s: stops.map(d => `${proj(d.project).name} · ${d.reason}`).slice(0, 2).join(', '), href: '#/progress?tab=stoppages&st=Open' });
  return out;
}

/* ---------- module tiles ---------- */
const tile = (icon, tone, title, href, linkLabel, stats, lines) => `<div class="card tile"><div class="card-head"><span class="sig ${tone}">${ico(icon, 'sm')}</span><h2>${title}</h2><a class="btn ghost sm" href="${href}">${linkLabel} ${ico('arrowR', 'sm')}</a></div>
  <div class="tile-stats">${stats.map(([v, l, c]) => `<div><b${c ? ` style="color:var(--${c})"` : ''}>${v}</b><span>${l}</span></div>`).join('')}</div>
  ${lines.length ? `<ul class="tile-list">${lines.map(([t, s, h]) => `<li>${h ? `<a href="${h}">` : '<span>'}<b>${t}</b><span>${s}</span>${h ? '</a>' : '</span>'}</li>`).join('')}</ul>` : ''}</div>`;
function opsTiles() {
  const ids = myProjectIds(), tiles = [];
  if (canSee('attendance')) {
    if (isManager()) {
      const ppl = teamScope(), sts = ppl.map(u => attStatus(u.id, TODAY)), c = k => sts.filter(s => s === k).length;
      const lv = DB.leaves.filter(l => l.status === 'Pending' && canApproveLeave(l)), mk = monthKey(TODAY);
      const avg = Math.round(sum(ppl, u => overall(u, monthScores(u, mk)) || 0) / Math.max(1, ppl.length));
      const apP = DB.appraisals.filter(a => a.period === cycle().key && ['Pending', 'Self-review submitted'].includes(a.status) && ppl.some(u => u.id === a.user)).length;
      tiles.push(tile('userCheck', 'ok', 'Team today', '#/attendance', 'Attendance', [[`${c('Present') + c('Late') + c('Half day')}<em>/${ppl.length}</em>`, 'present'], [c('Late'), 'late', c('Late') ? 'warn' : ''], [c('On leave'), 'on leave'], [c('Not checked in'), 'not in']],
        [[`${plural(lv.length, 'leave request')} pending`, lv.length ? lv.slice(0, 2).map(l => userName(l.user)).join(', ') : 'nothing to approve', '#/leave?tab=approvals'], ...(canSee('performance') ? [[`Team score ${avg} / 100`, `${apP} appraisals pending · ${cycle().short}`, '#/performance']] : [])]));
    } else if (isEmployee()) {
      const r = attRec(SESSION, TODAY), st = attStatus(SESSION, TODAY), b = leaveBalance(SESSION).find(x => x.type === 'Casual leave'), m = attSummary(SESSION, monthKey(TODAY) + '-01', TODAY);
      tiles.push(tile('userCheck', 'ok', 'My day', '#/attendance', 'Attendance', [[st === 'Not checked in' ? '—' : fmtT(r?.in).replace(/\s/, ''), st === 'Not checked in' ? 'not checked in' : 'checked in'], [m.Present + m.Late, 'days this month'], [num(b.avail), 'casual leave left']],
        [[r ? (r.out ? `Checked out ${fmtT(r.out)}` : 'Remember to check out by 7:00 PM') : 'Check in with a selfie', r ? siteName(r.site) : 'Shift 9:00 AM – 7:00 PM', '#/attendance'], canSee('performance') ? ['My performance', `${overall(me(), monthScores(me(), monthKey(TODAY))) ?? '—'} / 100 this month`, '#/performance'] : ['Leave balance', `${num(b.avail)} casual days left this year`, '#/leave']]));
    }
  }
  if (canSee('site')) {
    const { slots } = complianceSlots(7), due = slots.filter(s => ['Submitted', 'Late', 'Missing'].includes(s.st)), td = slots.filter(s => s.day === TODAY);
    const stops = DB.delays.filter(d => ids.has(d.project) && d.status === 'Open');
    tiles.push(tile('report', 'info', 'Daily site reports', '#/site?tab=compliance', 'Status', [[`${td.filter(s => ['Submitted', 'Late'].includes(s.st)).length}<em>/${td.filter(s => !['Off', 'Stoppage'].includes(s.st)).length}</em>`, 'in today'], [`${Math.round(due.filter(s => s.st === 'Submitted').length / Math.max(1, due.length) * 100)}%`, 'on time (7d)'], [slots.filter(s => s.st === 'Late').length, 'late', 'warn'], [slots.filter(s => s.st === 'Missing').length, 'missing', slots.some(s => s.st === 'Missing') ? 'bad' : '']],
      [[`${plural(stops.length, 'work stoppage')} ongoing`, stops.length ? stops.map(d => `${proj(d.project).name}: ${d.reason}`).slice(0, 2).join(' · ') : `${fmtDays(sum(DB.delays.filter(d => ids.has(d.project) && daysFrom(d.date) >= -30), stopDays))} lost in the last 30 days`, '#/progress?tab=stoppages'], ['Due by 8:00 PM', Date.now() <= reportDeadline(TODAY) ? `${fmtMins((reportDeadline(TODAY) - Date.now()) / 6e4)} left today` : 'deadline passed for today', '#/site']]));
  }
  if ((canSee('invoices') || canSee('finance')) && canMoney()) {
    const live = DB.invoices.filter(i => ids.has(i.project) && !['Draft', 'Cancelled'].includes(i.status)), mk = monthKey(TODAY);
    const od = live.filter(i => clientStatus(i) === 'Overdue'), ex = sum(DB.expenses.filter(e => ids.has(e.project) && e.date.startsWith(mk)), e => e.amount);
    tiles.push(tile('invoice', 'brand', 'Invoices & expenses', canSee('invoices') ? '#/invoices' : '#/finance', canSee('invoices') ? 'Invoices' : 'Finance', [[inrS(sum(live.filter(i => i.date.startsWith(mk)), invTotal)), 'invoiced this month'], [inrS(sum(live, i => Math.max(0, invTotal(i) - invPaid(i)))), 'outstanding'], [inrS(ex), 'spent this month']],
      [[`${plural(od.length, 'invoice')} overdue`, od.length ? od.slice(0, 2).map(i => `${i.no} · ${proj(i.project).name}`).join(', ') : 'all invoices within due date', canSee('invoices') ? '#/invoices?st=Overdue' : ''], ['Bills to pay', `${inrS(sum([...DB.contractorBills.filter(b => ids.has(b.project) && (!b.status || b.status === 'Issued')).map(b => b.amount - b.paid), ...myPurchases().map(pu => puTotal(pu) - pu.paid)]))} to contractors & suppliers`, canSee('invoices') ? '#/invoices?tab=contractor' : '']]));
  }
  if (canSee('documents')) {
    const docs = DB.documents.filter(d => ids.has(d.project) && !isMedia(d) && d.versions), q = docs.filter(d => !d.archived && docStatus(d) === 'Under Review');
    const rev = docs.flatMap(d => d.versions.filter(v => v.v > 1).map(v => ({ d, v }))).sort((a, b) => b.v.date.localeCompare(a.v.date)).slice(0, 2);
    tiles.push(tile('file', 'warn', 'Documents & plans', '#/documents?tab=review', 'Approvals', [[q.length, 'awaiting approval', q.length ? 'warn' : ''], [docs.filter(d => !d.archived && docStatus(d) === 'Draft').length, 'drafts'], [docs.filter(d => d.archived).length, 'archived']],
      rev.map(({ d, v }) => [`${esc(d.name.replace(/\.\w+$/, ''))} · v${v.v}`, `${v.status} · ${fmtD(v.date)} · ${esc(proj(d.project).name)}`, `#/documents?d=${d.id}`])));
  }
  if (canSee('materials')) {
    const pus = myPurchases(), wk = shiftD(TODAY, -6), dvs = pus.flatMap(pu => pu.deliveries.map(d => ({ pu, d }))).sort((a, b) => deliveryAt(b.d) - deliveryAt(a.d));
    tiles.push(tile('box', '', 'Materials', '#/materials', 'Materials', [canMoney() ? [inrS(sum(pus.filter(pu => pu.date >= wk), puTotal)), 'bought this week'] : [pus.filter(pu => pu.date >= wk).length, 'purchases this week'], [dvs.filter(x => x.d.date >= wk).length, 'deliveries this week'], [pus.filter(pu => ['Ordered', 'Partially received'].includes(puStatus(pu))).length, 'awaiting delivery']],
      dvs.slice(0, 2).map(({ pu, d }) => [`${esc(pu.material)} · ${qtyU(d.receivedQty, pu.unit)}`, `${fmtD(d.date)} ${d.unloadStart} · ${esc(proj(pu.project).name)}${d.issues.length ? ` · ${d.issues[0].type.toLowerCase()}` : ''}`, `#/materials?pu=${pu.id}`])));
  }
  if (canSee('service')) {
    const sv = myServices(), open = sv.filter(svOpen), fu = sv.filter(fuDue);
    tiles.push(tile('wrench', 'bad', 'Service & maintenance', '#/service', 'History', [[open.length, 'open items', open.length ? 'warn' : ''], [fu.length, 'follow-ups'], [sv.filter(s => daysFrom(s.date) >= -30).length, 'in 30 days']],
      sv.slice().sort((a, b) => b.date.localeCompare(a.date)).slice(0, 2).map(s => [esc(s.title), `${s.type} · ${s.status} · ${esc(proj(s.project).name)}`, `#/service?sv=${s.id}`])));
  }
  return tiles.length ? `<div><div class="section-title"><h2>Operations at a glance</h2></div><div class="ops-grid">${tiles.join('')}</div></div>` : '';
}
