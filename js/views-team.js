/* Team: attendance (selfie check-in / check-out with optional GPS verification), leave, and performance & appraisals.
   Every employee except the owner marks their own attendance and applies for leave. The owner and office admin
   see everyone; project managers see the engineers and supervisors on their projects; others see their own records. */
'use strict';

/* ================= shared ================= */
function teamScope() {
  const r = role();
  if (['owner', 'sysadmin', 'admin'].includes(r)) return employees();
  if (r === 'pm') { const mine = new Set(DB.projects.filter(p => p.pm === SESSION).flatMap(p => [p.engineer, p.supervisor])); return employees().filter(u => u.id === SESSION || mine.has(u.id)); }
  return employees().filter(u => u.id === SESSION);
}
const isManager = () => ['owner', 'sysadmin', 'admin', 'pm'].includes(role());
const assignedSites = uid => DB.projects.filter(p => !['Completed'].includes(p.status) && [p.pm, p.engineer, p.supervisor].includes(uid));
const defaultSite = u => ['accounts', 'admin', 'sysadmin'].includes(u.role) || u.role === 'pm' ? 'office' : assignedSites(u.id).find(p => p.status !== 'On hold')?.id || 'office';
const toTs = (day, hm) => { if (!hm) return null; const [h, m] = hm.split(':').map(Number); return tsOn(day, h, m); };
const hhmm = t => t ? `${pad(new Date(t).getHours())}:${pad(new Date(t).getMinutes())}` : '';
const personCell = u => `<div class="person">${av(u.name, 'sm')}<div class="nm"><b>${esc(u.name)}${u.id === SESSION ? ' <span class="tag">You</span>' : ''}</b><span>${esc(u.title || ROLES[u.role].label)}</span></div></div>`;
const monthKey = s => s.slice(0, 7);
const monthLabel = k => parseD(k + '-01').toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
const weekStart = s => { const d = parseD(s), k = (d.getDay() + 6) % 7; d.setDate(d.getDate() - k); return iso(d); };

/* ================= attendance ================= */
const attRec = (uid, day) => DB.attendance.find(a => a.user === uid && a.date === day);
const leaveOn = (uid, day) => DB.leaves.find(l => l.user === uid && l.status === 'Approved' && day >= l.from && day <= l.to);
function attStatus(uid, day) {
  const r = attRec(uid, day), l = leaveOn(uid, day);
  if (r) {
    if (r.status) return r.status;
    if (l?.half || (r.out && (r.out - r.in) / 36e5 < 4.5)) return 'Half day';
    return minsOf(r.in) > SHIFT.start + SHIFT.grace ? 'Late' : 'Present';
  }
  if (l) return 'On leave';
  if (!isWorkDay(day)) return 'Weekly off';
  if (day > TODAY) return '';
  return day === TODAY ? 'Not checked in' : 'Absent';
}
const AT_TONE = { Present: 'ok', Late: 'warn', 'Half day': 'warn', Absent: 'bad', 'On leave': 'info', 'Weekly off': '', 'Not checked in': '', '': '' };
const AT_CODE = { Present: 'P', Late: 'L', 'Half day': 'H', Absent: 'A', 'On leave': 'LV', 'Weekly off': '–', 'Not checked in': '·', '': '' };
const hoursOf = r => r?.out ? (r.out - r.in) / 36e5 : null;
const attTone = st => AT_TONE[st] ?? '';
function attSummary(uid, from, to) {
  const days = daysBetween(from, to > TODAY ? TODAY : to), c = { Present: 0, Late: 0, 'Half day': 0, Absent: 0, 'On leave': 0 };
  let hrs = 0, n = 0;
  days.forEach(d => { const st = attStatus(uid, d); if (c[st] != null) c[st]++; const h = hoursOf(attRec(uid, d)); if (h) { hrs += h; n++; } });
  const due = c.Present + c.Late + c['Half day'] + c.Absent;
  return { ...c, due, rate: due ? Math.round((c.Present + c.Late + c['Half day'] * .5) / due * 100) : 100, punctual: due ? Math.round((c.Present + c.Late * .6 + c['Half day'] * .5) / due * 100) : 100, avgH: n ? hrs / n : 0 };
}
NAV_COUNT_HOOKS.push(() => ({ attendance: can2('Correct attendance') ? (DB.attRequests || []).filter(q => q.status === 'Pending').length : 0 }));

VIEWS.attendance = () => {
  const mgr = isManager(), emp = isEmployee();
  const tab = ['daily', 'weekly', 'monthly', 'corrections'].includes(ROUTE.q.tab) ? ROUTE.q.tab : 'today';
  const pend = (DB.attRequests || []).filter(q => q.status === 'Pending' && teamScope().some(u => u.id === q.user)).length;
  const T = tabs([['today', `${ico('userCheck', 'sm')}Today`], ['daily', 'Daily'], ['weekly', 'Weekly'], ['monthly', 'Monthly'], ['corrections', 'Corrections', pend || null]], tab);
  const mine = emp && attRec(SESSION, TODAY);
  const act = emp ? (!mine ? btn('Check in', 'checkIn', { icon: 'camera', cls: 'primary' }) : !mine.out ? btn('Check out', 'checkOut', { icon: 'camera', cls: 'primary' }) : '') : '';
  if (ROUTE.q.ar) after(() => showAttendance(ROUTE.q.ar));
  const body = { today: attToday, daily: attDaily, weekly: attWeekly, monthly: attMonthly, corrections: attCorrections }[tab]();
  return `<div class="ax">${pageHead('Attendance', `Selfie check-in with GPS · shift 9 AM – 7 PM, late after 9:15${role() === 'owner' ? ' · covers every employee except the owner' : mgr ? '' : ' · your own records'}`, tab === 'today' ? '' : act)}${T}${body}</div>`;
};
function myTodayCard() {
  if (!isEmployee()) return '';
  const r = attRec(SESSION, TODAY), st = attStatus(SESSION, TODAY), l = leaveOn(SESSION, TODAY);
  const m = attSummary(SESSION, monthKey(TODAY) + '-01', TODAY);
  const side = (lbl, t, ph, gps, site) => `<div class="att-side"><div class="att-ph">${ph ? `<button type="button" class="ph-t" data-act="openPhoto" data-id="${ph.id}">${phThumb(ph)}</button>` : `<span class="ph-lost">${ico('camera')}<small>No selfie</small></span>`}</div>
    <div><span class="muted">${lbl}</span><b>${t ? fmtT(t) : '—'}</b>${site ? `<span>${ico('pin', 'sm')}${esc(siteName(site))}</span>` : ''}<span>${gpsBadge(gps)}</span></div></div>`;
  if (r) { PH_REG.set(r.selfieIn?.id, r.selfieIn); if (r.selfieOut) PH_REG.set(r.selfieOut.id, r.selfieOut); }
  return `<div class="card att-me"><div class="card-head"><h2>My attendance · ${fmtD(TODAY)}</h2>${badge(st, attTone(st))}</div>
    <div class="card-body att-me-body">
      ${l && !l.half ? `<div class="empty-state" style="padding:20px">${ico('leave')}<b>You are on ${esc(l.type.toLowerCase())} today</b>Enjoy your day off.</div>`
        : `<div class="att-pair">${side('Check-in', r?.in, r?.selfieIn, r?.gpsIn, r?.site)}${side('Check-out', r?.out, r?.selfieOut, r?.gpsOut, r?.out ? r.site : null)}</div>
      <div class="att-cta">${!r ? `<p class="muted">${nowMins() < SHIFT.start + SHIFT.grace ? `Check in before ${fmtT(tsOn(TODAY, 9, 15))} to be on time.` : 'You are past the 9:15 AM grace time — you will be marked late.'}</p>${btn('Check in with selfie', 'checkIn', { icon: 'camera', cls: 'primary' })}`
        : !r.out ? `<p class="muted">Checked in ${fmtMins((Date.now() - r.in) / 6e4)} ago. Shift ends at 7:00 PM.</p>${btn('Check out with selfie', 'checkOut', { icon: 'camera', cls: 'primary' })}`
        : `<p class="muted">Worked ${fmtMins((r.out - r.in) / 6e4)} today.</p><button class="btn sm" data-act="attRequest" data-d="${TODAY}">Request a correction</button>`}</div>`}
    </div>
    <div class="card-foot att-month"><span><b>${m.Present + m.Late}</b> days present</span><span><b>${m.Late}</b> late</span><span><b>${m['On leave']}</b> on leave</span><span><b>${m.Absent}</b> absent</span><span><b>${m.avgH ? m.avgH.toFixed(1) : '—'}</b> avg hours</span><span class="grow"></span><button class="btn xs" data-act="attRequest">Request a correction</button></div></div>`;
}
/* team list: filter chips, search, list / map, grouped rows with a mini shift timeline */
const AT_FILTERS = [['', 'Everyone'], ['in', 'Checked in'], ['late', 'Late'], ['out', 'Not checked in'], ['leave', 'On leave'], ['far', 'Outside radius']];
function attMatch(f, u, day) {
  const r = attRec(u.id, day), st = attStatus(u.id, day);
  return !f || (f === 'in' ? !!r : f === 'late' ? st === 'Late' : f === 'out' ? ['Not checked in', 'Absent'].includes(st) : f === 'leave' ? st === 'On leave' : f === 'far' ? r?.gpsIn && !r.gpsIn.ok : true);
}
function attMini(r, day) {
  const A = 8 * 60, B = 20 * 60, X = m => Math.max(0, Math.min(100, (m - A) / (B - A) * 100));
  const inM = r?.in ? minsAt(r.in) : null, outM = r?.out ? minsAt(r.out) : r?.in && day === TODAY ? nowMins() : null, late = inM != null && inM > SHIFT.start + SHIFT.grace;
  return `<div class="al-bar" aria-hidden="true"><i class="sh" style="left:${X(SHIFT.start)}%;width:${X(SHIFT.end) - X(SHIFT.start)}%"></i>${inM != null && outM != null ? `<i class="wk ${late ? 'late' : ''} ${r.out ? '' : 'live'}" style="left:${X(inM)}%;width:${Math.max(1.5, X(outM) - X(inM))}%"></i>` : ''}</div>`;
}
function attRowCard(u, day, dateMode = false) {
  const r = attRec(u.id, day), st = attStatus(u.id, day), l = leaveOn(u.id, day), inM = r?.in ? minsAt(r.in) : null;
  [r?.selfieIn, r?.selfieOut].forEach(ph => ph && PH_REG.set(ph.id, ph));
  const lateBy = inM != null && inM > SHIFT.start + SHIFT.grace ? inM - SHIFT.start : 0, h = hoursOf(r);
  const remind = !r && day === TODAY && st === 'Not checked in' && isManager() && u.id !== SESSION;
  const tone = attTone(st) || (st === 'Not checked in' ? 'idle' : '');
  return `<li class="al-row t-${tone}" data-act="showAttendance" data-u="${u.id}" data-d="${day}" tabindex="0" role="button" aria-label="${esc(`${u.name}: ${st}`)}">
    ${dateMode ? `<div class="al-who al-date"><span class="al-dd"><b>${parseD(day).getDate()}</b><small>${parseD(day).toLocaleDateString('en-IN', { month: 'short' })}</small></span><div><b>${parseD(day).toLocaleDateString('en-IN', { weekday: 'long' })}</b><span>${day === TODAY ? 'Today' : fmtDY(day)}</span></div></div>`
      : `<div class="al-who"><span class="al-ring">${u.photo ? `<img class="al-av" src="${u.photo}" alt="">` : av(u.name)}</span><div><b>${esc(u.name)}${u.id === SESSION ? ' <span class="tag">You</span>' : ''}</b><span>${esc(u.title || ROLES[u.role].label)}</span></div></div>`}
    <div class="al-st">${badge(st || '—', attTone(st))}${lateBy ? `<small class="warn">${fmtGap(lateBy)} late</small>` : l ? `<small>${esc(l.type)}${l.half ? ` · ${esc(l.half.toLowerCase())}` : ''}</small>` : ''}</div>
    ${r ? `<div class="al-times"><div class="al-tt"><span><em>In</em>${fmtT(r.in)}</span><span><em>Out</em>${r.out ? fmtT(r.out) : day === TODAY ? '<i class="al-live">on duty</i>' : '—'}</span></div>${attMini(r, day)}</div>
      <div class="al-h"><b>${h ? h.toFixed(1) : day === TODAY && !r.out ? ((nowMins() - inM) / 60).toFixed(1) : '—'}</b><span>hours</span></div>
      <div class="al-site"><b>${esc(siteName(r.site))}</b>${r.gpsIn ? `<span class="${r.gpsIn.ok ? 'ok' : 'warn'}">${ico('gps', 'sm')}${r.gpsIn.ok ? 'On site' : `${fmtDist(r.gpsIn.dist)} away`}</span>` : `<span>${ico('gps', 'sm')}No GPS</span>`}</div>
      <div class="al-sel">${[r.selfieIn, r.selfieOut].filter(Boolean).map(ph => `<span>${phThumb(ph)}</span>`).join('')}</div>`
      : `<div class="al-empty">${st === 'On leave' ? `${ico('leave', 'sm')}On approved leave` : st === 'Weekly off' ? `${ico('cal', 'sm')}Weekly off` : st === 'Absent' ? `${ico('alert', 'sm')}No check-in recorded` : `${ico('clock', 'sm')}${nowMins() > SHIFT.start + SHIFT.grace ? `Past the 9:15 AM grace time` : 'Shift starts at 9:00 AM'}`}</div>`}
    <div class="al-go">${remind ? `<button type="button" class="btn xs" data-act="attRemind" data-u="${u.id}">${ico('bell', 'sm')}Remind</button>` : ''}${ico('chevR', 'sm')}</div></li>`;
}
function attBoard(day, people) {
  const { af = '', aq = '', av: v = 'list' } = ROUTE.q;
  const list = people.filter(u => attMatch(af, u, day) && (!aq || `${u.name} ${u.title}`.toLowerCase().includes(aq.toLowerCase())));
  const groups = [['Checked in', u => !!attRec(u.id, day), 'in'], ['Not checked in', u => ['Not checked in', 'Absent'].includes(attStatus(u.id, day)), 'out'], ['On leave', u => !attRec(u.id, day) && attStatus(u.id, day) === 'On leave', 'leave'], ['Weekly off', u => attStatus(u.id, day) === 'Weekly off', 'off']];
  const byIn = (a, b) => (attRec(a.id, day)?.in || 0) - (attRec(b.id, day)?.in || 0);
  return `<div class="al-tools">
      <div class="chips">${AT_FILTERS.map(([k, l]) => `<button class="chip ${af === k ? 'on' : ''}" data-act="setQ" data-k="af" data-v="${k}">${l} <span class="n">${people.filter(u => attMatch(k, u, day)).length}</span></button>`).join('')}</div>
      <span class="grow"></span>
      <div class="inline-search">${ico('search', 'sm')}<input class="input" type="search" placeholder="Search people" value="${esc(aq)}" data-input="attQ" aria-label="Search people"></div>
      <div class="seg" role="group" aria-label="View"><button class="${v !== 'map' ? 'on' : ''}" data-act="setQ" data-k="av" data-v="list">${ico('rows', 'sm')}List</button><button class="${v === 'map' ? 'on' : ''}" data-act="setQ" data-k="av" data-v="map">${ico('gps', 'sm')}Map</button></div></div>
    ${v === 'map' ? attMapCard(day, list) || `<div class="card">${emptyPage('No GPS check-ins', 'Nobody in this list checked in with a location.')}</div>`
      : list.length ? groups.map(([title, f, k]) => { const xs = list.filter(f).sort(byIn); return xs.length ? `<section class="al-grp g-${k}"><h3>${title}<span>${xs.length}</span></h3><ul class="al-list">${xs.map(u => attRowCard(u, day)).join('')}</ul></section>` : ''; }).join('')
      : `<div class="card">${emptyPage('Nobody matches', 'Try another filter or search.')}</div>`}
    ${v !== 'map' ? `<div class="al-leg"><span><i class="sh"></i>Shift 9 AM – 7 PM</span><span><i class="wk"></i>On duty</span><span><i class="wk late"></i>Arrived late</span><span>Timeline runs 8 AM – 8 PM</span></div>` : ''}`;
}
INPUT.attQ = el => { setQ({ aq: el.value }); const i = $('[data-input="attQ"]'); i.focus(); i.setSelectionRange(i.value.length, i.value.length); };
ACT.attRemind = el => { const u = user(el.dataset.u); notify([u.id], `Reminder from ${me().name}: please check in for today (${fmtD(TODAY)}).`, '#/attendance', 'attendance'); logAct(`reminded ${u.name} to check in`, null, 'user'); saveDB(); renderShell(); toast(`Reminder sent to ${u.name}`); };
// rows act as buttons for the keyboard too
document.addEventListener('keydown', e => { const r = e.target.closest?.('.al-row'); if (r && (e.key === 'Enter' || e.key === ' ') && e.target === r) { e.preventDefault(); showAttendance(r.dataset.u, r.dataset.d); } });
/* Today: a dark hero with the clock, shift progress, your own status and the team ring */
function attDonut(parts, total, label) {
  const R = 52, C = 2 * Math.PI * R; let off = 0;
  const segs = parts.filter(p => p[1] > 0).map(([cls, v]) => { const len = total ? v / total * C : 0, seg = `<circle class="${cls}" r="${R}" cx="64" cy="64" stroke-dasharray="${Math.max(0, len - 3)} ${C}" stroke-dashoffset="${-off}"/>`; off += len; return seg; }).join('');
  return `<svg class="ax-donut" viewBox="0 0 128 128" aria-hidden="true"><circle class="trk" r="${R}" cx="64" cy="64"/>${segs}</svg><div class="ax-dc">${label}</div>`;
}
function attHero() {
  const now = new Date(), hr = now.getHours(), greet = hr < 12 ? 'Good morning' : hr < 17 ? 'Good afternoon' : 'Good evening';
  const nm = nowMins(), pct = Math.max(0, Math.min(100, (nm - SHIFT.start) / (SHIFT.end - SHIFT.start) * 100));
  const left = SHIFT.end - nm, shiftTxt = nm < SHIFT.start ? `Shift starts in ${fmtGap(SHIFT.start - nm)}` : left > 0 ? `${fmtGap(left)} left in today's shift` : 'Shift has ended';
  const emp = isEmployee(), r = emp && attRec(SESSION, TODAY), st = emp && attStatus(SESSION, TODAY), l = emp && leaveOn(SESSION, TODAY);
  const mineBlock = !emp ? '' : `<div class="ax-me">
      ${l && !l.half ? `<span class="ax-k">Your status</span><b class="ax-big">On leave</b><span class="ax-s">${esc(l.type)} · enjoy your day</span>`
      : !r ? `<span class="ax-k">Your status</span><b class="ax-big">Not checked in</b><span class="ax-s">${nm > SHIFT.start + SHIFT.grace ? 'You are past the 9:15 grace time — it will be marked late' : 'Check in before 9:15 to be on time'}</span>${btn('Check in with selfie', 'checkIn', { icon: 'camera', cls: 'primary ax-cta' })}`
      : `<div class="ax-me-row">${r.selfieIn ? `<span class="ax-sf">${phThumb(r.selfieIn)}</span>` : ''}<div><span class="ax-k">${r.out ? 'Checked out' : 'On duty'} · ${esc(siteName(r.site))}</span>
          <b class="ax-big">${fmtT(r.in)}${r.out ? ` <i>→</i> ${fmtT(r.out)}` : ''}</b><span class="ax-s">${r.out ? `${fmtGap(Math.round((r.out - r.in) / 6e4))} worked` : `${fmtGap(Math.max(0, nm - minsAt(r.in)))} so far`} · ${badge(st, attTone(st))}</span></div></div>
        <div class="ax-acts">${!r.out ? btn('Check out', 'checkOut', { icon: 'camera', cls: 'primary ax-cta' }) : ''}<button class="btn ax-ghost" data-act="showAttendance" data-u="${SESSION}" data-d="${TODAY}">View record</button></div>`}</div>`;
  let team = '';
  if (isManager()) {
    const people = teamScope(), sts = people.map(u => attStatus(u.id, TODAY)), c = k => sts.filter(x => x === k).length, inN = c('Present') + c('Late') + c('Half day');
    team = `<div class="ax-team">${attDonut([['p', c('Present')], ['l', c('Late') + c('Half day')], ['v', c('On leave')], ['n', c('Not checked in')]], people.length, `<b>${inN}<small>/${people.length}</small></b><span>checked in</span>`)}
      <ul class="ax-leg">${[['p', 'On time', c('Present'), 'in'], ['l', 'Late', c('Late') + c('Half day'), 'late'], ['v', 'On leave', c('On leave'), 'leave'], ['n', 'Not in yet', c('Not checked in'), 'out']].map(([k, lbl, v, f]) => `<li><button data-act="setQ" data-k="af" data-v="${f}"><i class="${k}"></i>${lbl}<b>${v}</b></button></li>`).join('')}</ul></div>`;
  } else if (emp) {
    const m = attSummary(SESSION, monthKey(TODAY) + '-01', TODAY);
    team = `<div class="ax-team">${attDonut([['p', m.Present], ['l', m.Late + m['Half day']], ['v', m['On leave']], ['n', m.Absent]], m.due + m['On leave'], `<b>${m.rate}<small>%</small></b><span>this month</span>`)}
      <ul class="ax-leg">${[['p', 'On time', m.Present], ['l', 'Late', m.Late + m['Half day']], ['v', 'Leave', m['On leave']], ['n', 'Absent', m.Absent]].map(([k, lbl, v]) => `<li><span><i class="${k}"></i>${lbl}<b>${v}</b></span></li>`).join('')}</ul></div>`;
  }
  return `<section class="ax-hero ${mineBlock ? '' : 'no-me'}">
    <div class="ax-clock"><span class="ax-k">${greet}, ${esc(me().name.split(' ')[0])}</span><b class="ax-time" data-clock>${now.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}</b><span class="ax-s">${now.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}</span>
      <div class="ax-shift"><div class="ax-sbar"><i style="width:${pct}%"></i><em style="left:${pct}%"></em></div><div class="ax-sl"><span>9 AM</span><span>${shiftTxt}</span><span>7 PM</span></div></div></div>
    ${mineBlock}${team}</section>`;
}
setInterval(() => document.querySelectorAll('[data-clock]').forEach(el => el.textContent = new Date().toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })), 30e3);
function attToday() {
  const people = teamScope();
  return attHero() + (isManager() ? `<div class="card al-card"><div class="card-head"><h2>Team today</h2><span class="sub">${plural(people.length, 'person', 'people')} · ${fmtLong(TODAY)}</span></div><div class="card-body">${attBoard(TODAY, people)}</div></div>` : recentMine());
}
function recentMine() {
  const days = daysBetween(shiftD(TODAY, -13), TODAY).reverse(), u = me();
  return `<div class="card al-card"><div class="card-head"><h2>My last 14 days</h2><span class="sub">Tap a day for the full record</span></div><div class="card-body"><ul class="al-list">${days.map(d => attRowCard(u, d, true)).join('')}</ul></div></div>`;
}
function attDaily() {
  const day = ROUTE.q.date && ROUTE.q.date <= TODAY ? ROUTE.q.date : TODAY, people = teamScope();
  const sts = people.map(u => attStatus(u.id, day)), c = k => sts.filter(s => s === k).length;
  return `<div class="card al-card"><div class="card-head al-dayhead"><button class="iconbtn" data-act="setQ" data-k="date" data-v="${shiftD(day, -1)}" aria-label="Previous day">${ico('chevL')}</button>
      <input class="input" type="date" max="${TODAY}" value="${day}" data-change="setQ" data-k="date" aria-label="Date">
      <button class="iconbtn" data-act="setQ" data-k="date" data-v="${day < TODAY ? shiftD(day, 1) : TODAY}" aria-label="Next day" ${day >= TODAY ? 'disabled' : ''}>${ico('chevR')}</button>
      <h2>${fmtLong(day)}</h2>${!isWorkDay(day) ? '<span class="tag">Weekly off</span>' : ''}
      <span class="sub al-sum"><b class="ok">${c('Present')}</b> present · <b class="warn">${c('Late')}</b> late · <b>${c('Half day')}</b> half day · <b class="info">${c('On leave')}</b> on leave · <b class="bad">${c('Absent') + c('Not checked in')}</b> absent</span></div>
    <div class="card-body">${attBoard(day, people)}</div></div>`;
}
function attMapCard(day, people) {
  const recs = people.map(u => [u, attRec(u.id, day)]).filter(([, r]) => r?.gpsIn);
  if (!recs.length) return '';
  const off = recs.filter(([, r]) => !r.gpsIn.ok).length;
  after(() => mountMap($('#attMap'), { sites: recs.map(([, r]) => r.site), points: recs.map(([u, r]) => { const g = r.gpsIn; return { lat: g.lat, lng: g.lng, label: initials(u.name), tone: g.ok ? 'ok' : 'warn', title: u.name,
    popup: () => `<b>${esc(u.name)}</b><span>Checked in ${fmtT(r.in)} · ${fixName(g, r.site)}</span>${fixAddr(g, r.site)}<small>${g.lat}, ${g.lng} · ±${g.acc} m</small><button type="button" class="btn xs" data-gm-open>View attendance</button>`,
    onOpen: c => c.querySelector('[data-gm-open]')?.addEventListener('click', () => showAttendance(u.id, day)) }; }) }));
  return `<div class="card"><div class="card-head"><h2>Check-in locations</h2><span class="sub">${recs.length} GPS check-ins${off ? ` · <span style="color:var(--warn)">${off} outside the site radius</span>` : ''}</span></div>
    <div class="card-body"><div class="geo-map lg" id="attMap"></div>${mapLegend([['site', `Site · ${GEO_RADIUS_M} m radius`], ['ok', 'Checked in on site'], ['warn', 'Outside radius']])}</div></div>`;
}
/* weekly: one tile per person per day with times and hours; monthly: a day-numbered calendar grid per person */
const cellTone = st => st === 'Weekly off' ? 'off' : st === 'Not checked in' ? 'pend' : attTone(st) || 'none';
function weekCell(u, d) {
  const st = attStatus(u.id, d), r = attRec(u.id, d), h = hoursOf(r), inM = r?.in ? minsAt(r.in) : null, late = inM != null && inM > SHIFT.start + SHIFT.grace;
  if (!st) return `<td class="c"><span class="wc fut"></span></td>`;
  const body = r ? `<b>${fmtT(r.in).replace(/\s?([ap]m)/i, '<small>$1</small>')}</b><span>${h ? `${h.toFixed(1)} h` : d === TODAY ? 'on duty' : 'no out'}${late ? ` · <em>+${inM - SHIFT.start}m</em>` : ''}</span>`
    : `<b class="lbl">${st === 'Weekly off' ? 'Off' : st === 'On leave' ? 'Leave' : st === 'Absent' ? 'Absent' : 'Not in'}</b>`;
  return `<td class="c"><button type="button" class="wc ${cellTone(st)} ${late ? 'late' : ''} ${d === TODAY ? 'today' : ''}" data-act="showAttendance" data-u="${u.id}" data-d="${d}" title="${esc(`${u.name} · ${fmtD(d)} · ${st}${r ? ` · ${fmtT(r.in)}–${r.out ? fmtT(r.out) : '…'}` : ''}`)}">${body}</button></td>`;
}
const attLegend = () => `<div class="wl">${[['ok', 'Present'], ['warn', 'Late / half day'], ['info', 'On leave'], ['bad', 'Absent'], ['off', 'Weekly off'], ['pend', 'Not in yet']].map(([t, l]) => `<span><i class="${t}"></i>${l}</span>`).join('')}</div>`;
function attWeekly() {
  const ws = ROUTE.q.wk ? weekStart(ROUTE.q.wk) : weekStart(TODAY), we = shiftD(ws, 6), days = daysBetween(ws, we), people = teamScope();
  const thisW = weekStart(TODAY), lastW = shiftD(thisW, -7), upto = we > TODAY ? TODAY : we;
  const tot = people.map(u => { const s = attSummary(u.id, ws, we); let hrs = 0; days.forEach(d => hrs += hoursOf(attRec(u.id, d)) || 0); return { u, s, hrs }; });
  const due = sum(tot, t => t.s.due), pres = sum(tot, t => t.s.Present + t.s.Late + t.s['Half day'] * .5), workDays = days.filter(d => isWorkDay(d) && d <= TODAY).length;
  return `<div class="card wk-card">
    <div class="wk-head"><div class="wk-nav"><button class="iconbtn" data-act="setQ" data-k="wk" data-v="${shiftD(ws, -7)}" aria-label="Previous week">${ico('chevL')}</button>
        <div><b>${fmtD(ws)} – ${fmtDY(we)}</b><span>${ws === thisW ? 'This week' : ws === lastW ? 'Last week' : `Week of ${fmtD(ws)}`} · ${plural(workDays, 'working day')} so far</span></div>
        <button class="iconbtn" data-act="setQ" data-k="wk" data-v="${shiftD(ws, 7)}" aria-label="Next week" ${shiftD(ws, 7) > TODAY ? 'disabled' : ''}>${ico('chevR')}</button></div>
      <div class="chips"><button class="chip ${ws === thisW ? 'on' : ''}" data-act="setQ" data-k="wk" data-v="${thisW}">This week</button><button class="chip ${ws === lastW ? 'on' : ''}" data-act="setQ" data-k="wk" data-v="${lastW}">Last week</button></div>
      <div class="wk-stats"><div><b>${due ? Math.round(pres / due * 100) : '—'}${due ? '<small>%</small>' : ''}</b><span>attendance</span></div><div><b>${sum(tot, t => t.s.Late)}</b><span>late arrivals</span></div><div><b>${sum(tot, t => t.s.Absent)}</b><span>absences</span></div><div><b>${num(Math.round(sum(tot, t => t.hrs)))}</b><span>hours worked</span></div></div></div>
    <div class="table-wrap"><table class="t wk-grid"><thead><tr><th>Employee</th>${days.map(d => `<th class="c ${d === TODAY ? 'today' : ''} ${!isWorkDay(d) ? 'we' : ''}"><span>${parseD(d).toLocaleDateString('en-IN', { weekday: 'short' })}</span><b>${parseD(d).getDate()}</b></th>`).join('')}<th class="r">Days</th><th class="r">Hours</th></tr></thead><tbody>
      ${tot.map(({ u, s, hrs }) => { const pd = s.Present + s.Late + s['Half day'] * .5, exp = s.due * 10;
        return `<tr><td>${personCell(u)}</td>${days.map(d => weekCell(u, d)).join('')}
          <td class="r"><div class="wk-tot"><b>${pd}<small> / ${s.due}</small></b><i><em style="width:${s.due ? pd / s.due * 100 : 0}%"></em></i></div></td>
          <td class="r"><div class="wk-tot"><b>${hrs.toFixed(1)}</b><i><em class="h" style="width:${exp ? Math.min(100, hrs / exp * 100) : 0}%"></em></i></div></td></tr>`; }).join('') || emptyRow(10, 'No employees')}
    </tbody><tfoot><tr><td>Team present</td>${days.map(d => { const n = people.filter(u => attRec(u.id, d)).length; return `<td class="c">${d > TODAY || !isWorkDay(d) ? '<span class="muted">—</span>' : `<b>${n}</b><span class="muted">/${people.length}</span>`}</td>`; }).join('')}<td></td><td></td></tr></tfoot></table></div>
    <div class="wk-foot">${attLegend()}<span class="muted">Tiles show check-in time and hours worked · click a tile for the full record</span></div></div>`;
}
function attMonthly() {
  const months = [0, 1, 2, 3, 4, 5].map(i => { const d = parseD(TODAY); d.setDate(1); d.setMonth(d.getMonth() - i); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`; });
  const mk = months.includes(ROUTE.q.m) ? ROUTE.q.m : months[0], idx = months.indexOf(mk), sort = ROUTE.q.ms || 'name';
  const first = mk + '-01', e = parseD(first); e.setMonth(e.getMonth() + 1); e.setDate(0); const last = iso(e);
  const days = daysBetween(first, last), people = teamScope(), upto = last > TODAY ? TODAY : last;
  let rows = people.map(u => ({ u, s: attSummary(u.id, first, last) }));
  rows = rows.sort((a, b) => sort === 'rate' ? a.s.rate - b.s.rate : sort === 'late' ? b.s.Late - a.s.Late : a.u.name.localeCompare(b.u.name));
  const due = sum(rows, r => r.s.due), pres = sum(rows, r => r.s.Present + r.s.Late + r.s['Half day'] * .5), hrsN = rows.filter(r => r.s.avgH);
  const rateTone = v => v >= 95 ? 'ok' : v >= 85 ? 'warn' : 'bad';
  return `<div class="card mo-card">
    <div class="wk-head"><div class="wk-nav"><button class="iconbtn" data-act="setQ" data-k="m" data-v="${months[idx + 1] || mk}" aria-label="Previous month" ${idx >= months.length - 1 ? 'disabled' : ''}>${ico('chevL')}</button>
        <div><b>${monthLabel(mk)}</b><span>${plural(workDaysIn(first, upto), 'working day')}${last > TODAY ? ' so far' : ''}</span></div>
        <button class="iconbtn" data-act="setQ" data-k="m" data-v="${months[idx - 1] || mk}" aria-label="Next month" ${idx <= 0 ? 'disabled' : ''}>${ico('chevR')}</button></div>
      <select class="select sm" data-change="setQ" data-k="ms" aria-label="Sort"><option value="name" ${sort === 'name' ? 'selected' : ''}>Sort by name</option><option value="rate" ${sort === 'rate' ? 'selected' : ''}>Lowest attendance first</option><option value="late" ${sort === 'late' ? 'selected' : ''}>Most late first</option></select>
      <div class="wk-stats"><div><b>${due ? Math.round(pres / due * 100) : '—'}${due ? '<small>%</small>' : ''}</b><span>team attendance</span></div><div><b>${sum(rows, r => r.s.Late)}</b><span>late arrivals</span></div><div><b>${sum(rows, r => r.s['On leave'])}</b><span>leave days</span></div><div><b>${sum(rows, r => r.s.Absent)}</b><span>absences</span></div><div><b>${hrsN.length ? (sum(hrsN, r => r.s.avgH) / hrsN.length).toFixed(1) : '—'}</b><span>avg hours / day</span></div></div></div>
    <div class="table-wrap"><table class="t mo-grid" style="--n:${days.length}"><thead><tr><th>Employee</th><th class="mo-days"><div class="mo-row hd">${days.map(d => `<span class="${!isWorkDay(d) ? 'we' : ''} ${d === TODAY ? 'today' : ''}"><small>${parseD(d).toLocaleDateString('en-IN', { weekday: 'narrow' })}</small>${parseD(d).getDate()}</span>`).join('')}</div></th><th class="r">Present</th><th class="r">Late</th><th class="r">Leave</th><th class="r">Absent</th><th>Attendance</th><th class="r">Avg h</th></tr></thead><tbody>
      ${rows.map(({ u, s }) => `<tr><td>${personCell(u)}</td><td class="mo-days"><div class="mo-row">${days.map(d => { const st = attStatus(u.id, d); return `<i class="${st ? cellTone(st) : 'fut'} ${d === TODAY ? 'today' : ''}" ${st ? `data-act="showAttendance" data-u="${u.id}" data-d="${d}"` : ''} title="${esc(`${fmtD(d)} · ${st || 'upcoming'}`)}"></i>`; }).join('')}</div></td>
          <td class="r strong">${s.Present}</td><td class="r ${s.Late ? 'tw' : 'muted'}">${s.Late}</td><td class="r ${s['On leave'] ? 'ti' : 'muted'}">${s['On leave']}</td><td class="r ${s.Absent ? 'tb' : 'muted'}">${s.Absent}</td>
          <td><div class="mo-rate ${rateTone(s.rate)}"><i><em style="width:${s.rate}%"></em></i><b>${s.rate}%</b></div></td><td class="r">${s.avgH ? s.avgH.toFixed(1) : '—'}</td></tr>`).join('') || emptyRow(8, 'No employees')}
    </tbody><tfoot><tr><td>Team present</td><td class="mo-days"><div class="mo-row ft">${days.map(d => { const n = people.filter(u => attRec(u.id, d)).length, f = people.length ? n / people.length : 0; return `<span title="${esc(`${fmtD(d)} · ${n} of ${people.length} present`)}">${d > TODAY || !isWorkDay(d) ? '' : `<i style="height:${Math.max(8, f * 100)}%" class="${f >= .9 ? 'ok' : f >= .7 ? 'warn' : 'bad'}"></i>`}</span>`; }).join('')}</div></td><td colspan="6" class="muted" style="font-size:12px">Bars show how much of the team was in each day</td></tr></tfoot></table></div>
    <div class="wk-foot">${attLegend()}<span class="muted">Click any day for the full record</span></div></div>`;
}

/* attendance record: a wide window with the day's shift timeline, check-in / check-out side by side, and the map */
const minsAt = t => { const d = new Date(t); return d.getHours() * 60 + d.getMinutes(); };
const fmtGap = m => m >= 60 ? `${Math.floor(m / 60)} h ${m % 60 ? `${m % 60} min` : ''}`.trim() : `${m} min`;
function attTimeline(r, day) {
  const A = 8 * 60, B = 20 * 60, X = m => `${Math.max(0, Math.min(100, (m - A) / (B - A) * 100))}%`;
  const inM = r?.in ? minsAt(r.in) : null, outM = r?.out ? minsAt(r.out) : day === TODAY && r?.in ? nowMins() : null;
  const late = inM != null && inM > SHIFT.start + SHIFT.grace;
  return `<div class="ar-tl"><div class="ar-track">
      <i class="ar-shift" style="left:${X(SHIFT.start)};width:calc(${X(SHIFT.end)} - ${X(SHIFT.start)})"></i>
      <i class="ar-grace" style="left:${X(SHIFT.start)};width:calc(${X(SHIFT.start + SHIFT.grace)} - ${X(SHIFT.start)})" title="Grace time until 9:15 AM"></i>
      ${inM != null && outM != null ? `<i class="ar-work ${late ? 'late' : ''} ${!r.out ? 'live' : ''}" style="left:${X(inM)};width:calc(${X(outM)} - ${X(inM)})"></i>` : ''}
      ${inM != null ? `<span class="ar-mk in ${late ? 'late' : ''}" style="left:${X(inM)}"><b><em>In</em>${fmtT(r.in)}</b></span>` : ''}
      ${r?.out ? `<span class="ar-mk out" style="left:${X(outM)}"><b><em>Out</em>${fmtT(r.out)}</b></span>` : inM != null && day === TODAY ? `<span class="ar-mk now" style="left:${X(outM)}"><b><em>Now</em>still on duty</b></span>` : ''}
    </div><div class="ar-hours">${[8, 10, 12, 14, 16, 18, 20].map(h => `<span style="left:${X(h * 60)}">${h > 12 ? h - 12 : h}${h >= 12 ? ' PM' : ' AM'}</span>`).join('')}</div>
    <div class="ar-tl-leg"><span><i class="shift"></i>Shift 9 AM – 7 PM</span><span><i class="grace"></i>Grace until 9:15</span><span><i class="work"></i>Time on duty</span></div></div>`;
}
function attSide(kind, r) {
  const isIn = kind === 'in', t = isIn ? r.in : r.out, ph = isIn ? r.selfieIn : r.selfieOut, g = isIn ? r.gpsIn : r.out ? r.gpsOut : null, m = t ? minsAt(t) : null;
  if (ph) PH_REG.set(ph.id, ph);
  const when = !t ? '' : isIn ? (m > SHIFT.start + SHIFT.grace ? `<span class="ar-flag warn">${fmtGap(m - SHIFT.start)} late</span>` : `<span class="ar-flag ok">On time</span>`)
    : m < SHIFT.end ? `<span class="ar-flag warn">Left ${fmtGap(SHIFT.end - m)} early</span>` : `<span class="ar-flag ok">After shift end</span>`;
  return `<section class="ar-side ${t ? '' : 'empty'}"><div class="ar-sel">${ph ? `<button type="button" class="ph-t" data-act="arZoom" data-id="${ph.id}" data-l="${isIn ? 'Check-in' : 'Check-out'} · ${t ? fmtT(t) : ''}" aria-label="Enlarge ${isIn ? 'check-in' : 'check-out'} selfie">${phThumb(ph)}<span class="ar-zoom-i">${ico('search', 'sm')}</span></button>` : `<span class="ph-lost">${ico('camera')}<small>${t ? 'No selfie' : '—'}</small></span>`}</div>
    <div class="ar-det"><span class="ar-k">${isIn ? 'Check-in' : 'Check-out'}</span><b class="ar-t">${t ? fmtT(t) : isIn ? 'Not checked in' : r.in && TODAY === r.date ? 'Not yet' : 'Not recorded'}</b>${when}
      ${g ? `<div class="ar-gps">${gpsBadge(g)}</div><div class="ar-place"><b>${fixName(g, r.site)}</b>${fixAddr(g, r.site)}<a href="${mapsLink(g)}" target="_blank" rel="noopener">${g.lat}, ${g.lng} · ±${g.acc} m ${ico('arrowR', 'sm')}</a></div>` : t ? `<div class="ar-gps"><span class="muted">Location not captured</span></div>` : ''}</div></section>`;
}
function showAttendance(uid, day) {
  if (!day) { const r = DB.attendance.find(a => a.id === uid); if (!r) return; uid = r.user; day = r.date; }
  const u = user(uid), r = attRec(uid, day), st = attStatus(uid, day), l = leaveOn(uid, day), h = hoursOf(r);
  const pl = r && placeOf(r.site), fixes = r ? [['IN', 'Check-in', r.in, r.gpsIn], ['OUT', 'Check-out', r.out, r.out ? r.gpsOut : null]].filter(f => f[3]) : [];
  const nav = (n, lbl, icon) => { const d = shiftD(day, n); return `<button type="button" class="iconbtn" data-act="showAttendance" data-u="${uid}" data-d="${d}" aria-label="${lbl}" title="${lbl} · ${fmtD(d)}" ${d > TODAY ? 'disabled' : ''}>${ico(icon, 'sm')}</button>`; };
  openModal({ title: `${u.name} · attendance`, sub: `${esc(u.title || ROLES[u.role].label)}`, wide: true, body: `
    <div class="ar-head">${u.photo ? `<img class="ar-av" src="${u.photo}" alt="">` : av(u.name, 'lg')}
      <div class="ar-day"><b>${parseD(day).toLocaleDateString('en-IN', { weekday: 'long' })}</b><span>${fmtDY(day)}</span></div>
      <div class="ar-nav">${nav(-1, 'Previous day', 'chevL')}${nav(1, 'Next day', 'chevR')}</div>
      <div class="ar-sum">${badge(st || '—', attTone(st))}${r ? `<div><b>${h ? fmtGap(Math.round(h * 60)) : r.in && !r.out && day === TODAY ? fmtGap(Math.max(0, nowMins() - minsAt(r.in))) : '—'}</b><span>${h ? 'worked' : r.in && day === TODAY ? 'so far' : 'no check-out'}</span></div>` : ''}
        ${r ? `<div><b>${esc(pl.name)}</b><span>${esc(pl.addr)}</span></div>` : ''}</div></div>
    ${l ? `<div class="banner">${ico('leave')}<span>${esc(l.type)}${l.half ? ` · ${l.half}` : ''} — approved by ${esc(userName(l.decidedBy))}</span></div>` : ''}
    ${r ? `${attTimeline(r, day)}
      <div class="ar-pair">${attSide('in', r)}${attSide('out', r)}</div>
      ${r.note ? `<div class="ar-note">${ico('edit', 'sm')}<div><b>Note</b><p>${esc(r.note)}</p></div></div>` : ''}
      ${fixes.length ? `<div class="ar-map"><div class="geo-map" data-att-map></div>${mapLegend([['site', `${esc(pl.name)} · ${GEO_RADIUS_M} m radius`], ['ok', 'On site'], ['warn', 'Outside radius']])}</div>` : ''}`
      : `<div class="ar-none">${ico(st === 'On leave' ? 'leave' : st === 'Weekly off' ? 'cal' : 'clock')}<b>${st === 'Weekly off' ? 'Sunday — weekly off' : st === 'On leave' ? 'On approved leave' : st === 'Not checked in' ? 'Not checked in yet today' : 'No check-in recorded'}</b><span>${st === 'Absent' ? 'Marked absent for this day.' : ''}</span></div>`}
    <div class="ar-zoom" id="arZoom" hidden></div>
    ${r?.history?.length ? `<div class="ar-hist"><h3>${ico('history', 'sm')}Corrections</h3><ul>${r.history.slice().reverse().map(x => `<li><div><b>${esc(x.field)}</b> ${x.from ? fmtT(x.from) : x.fromText || '—'} → <b>${x.to ? fmtT(x.to) : x.toText || '—'}</b><p>${esc(x.reason)}</p></div><small>${fmtTs(x.at)}<br>${esc(userName(x.by))}</small></li>`).join('')}</ul></div>` : ''}`,
    foot: `${can2('Correct attendance') && u.role !== 'owner' ? `<button type="button" class="btn left" data-act="attCorrect" data-u="${uid}" data-d="${day}">${ico('edit', 'sm')}Correct</button>` : uid === SESSION && day <= TODAY ? `<button type="button" class="btn left" data-act="attRequest" data-d="${day}">Request correction</button>` : ''}<button type="button" class="btn primary" data-act="closeModal">Done</button>`,
    onOpen: m => {
      m.classList.add('xl');
      if (fixes.length) mountMap($('[data-att-map]', m), { sites: [r.site], points: fixes.map(([label, lbl, t, g]) => ({ lat: g.lat, lng: g.lng, label, tone: g.ok ? 'ok' : 'warn',
        popup: () => `<b>${lbl} · ${t ? fmtT(t) : '—'}</b><span>${fixName(g, r.site)}</span>${fixAddr(g, r.site)}<small>${g.lat}, ${g.lng} · ±${g.acc} m · ${fmtDist(g.dist)} from site</small>` })) });
      fillAddrs(m);
    } });
}
ACT.showAttendance = el => showAttendance(el.dataset.u, el.dataset.d);
// selfies open in place, so the record stays open underneath
ACT.arZoom = el => { const z = $('#arZoom'), ph = PH_REG.get(el.dataset.id); if (!z || !ph) return; z.innerHTML = `<figure>${phThumb(ph)}<figcaption>${esc(el.dataset.l)}</figcaption></figure><button type="button" class="iconbtn" data-act="arZoomClose" aria-label="Close">${ico('x')}</button>`; z.hidden = false; };
ACT.arZoomClose = () => { const z = $('#arZoom'); if (z) z.hidden = true; };
$('#modal').addEventListener('close', () => { if (ROUTE.q.ar) { const q = { ...ROUTE.q }; delete q.ar; history.replaceState(null, '', `#/${[ROUTE.mod, ...ROUTE.parts].join('/')}${Object.keys(q).length ? '?' + new URLSearchParams(q) : ''}`); ROUTE = parseRoute(); } });

/* check in / check out */
let GEO_FIX = null;
function gpsBlock(site) {
  return `<div class="field"><span>Location check <small class="muted">(optional)</small></span><div class="gps-box" id="gpsRes">${gpsResult(null, site)}</div>
    <div class="pick-acts"><button type="button" class="btn xs" data-act="gpsCheck">${ico('gps', 'sm')}Verify my location</button><button type="button" class="btn xs" data-act="gpsSim">Simulate on-site location (demo)</button></div></div>`;
}
function gpsResult(g, site) {
  if (!g) return `<span class="muted">${ico('pin', 'sm')} Site: ${esc(siteName(site))} · within ${GEO_RADIUS_M} m counts as on site</span>`;
  if (g.loading) return `<span class="muted">${ico('gps', 'sm')} Getting your location…</span>`;
  if (g.error) return `<span style="color:var(--warn)">${ico('alert', 'sm')} ${esc(g.error)} — you can still check in.</span>`;
  return `${gpsBadge(g)} <span class="muted" style="font-size:12.5px">${g.lat}, ${g.lng} · ±${g.acc} m${g.simulated ? ' · simulated for the demo' : ''}</span>
    <div class="gps-place"><b>${fixName(g, site)}</b>${fixAddr(g, site)}</div><div class="geo-map sm" id="gpsMap"></div>`;
}
/* show a fresh fix: map, then its street address (kept on the fix so the record has it offline too) */
function showFix(g, site) {
  const el = $('#gpsRes'); if (!el) return;
  el.innerHTML = gpsResult(g, site);
  if (!g || g.loading || g.error) return;
  mountMap($('#gpsMap'), { sites: [site], points: [{ lat: g.lat, lng: g.lng, label: 'YOU', tone: g.ok ? 'ok' : 'warn' }] });
  revGeo(g.lat, g.lng).then(v => { if (!v || GEO_FIX !== g) return; Object.assign(g, { addr: v.addr, place: v.name }); const a = $('#gpsRes .gps-place'); if (a) a.innerHTML = `<b>${fixName(g, site)}</b><span class="geo-addr">${esc(v.addr)}</span>`; });
}
const siteOptsFor = u => [...assignedSites(u.id).map(p => [p.id, p.name]), ['office', 'Head office']];
function attModal(kind) {
  const u = me(), r = attRec(SESSION, TODAY), out = kind === 'out';
  delete SNAP.att; GEO_FIX = null;
  const site = out ? r.site : defaultSite(u), late = !out && nowMins() > SHIFT.start + SHIFT.grace, early = out && nowMins() < SHIFT.end;
  openModal({ title: out ? 'Check out' : 'Check in', sub: `${fmtLong(TODAY)} · ${fmtT(Date.now())}`, wide: true, body: `<div class="att-modal">
    ${cameraBox('att')}
    <div class="form">
      ${out ? `<div class="kv-row" style="border:0"><span>Checked in</span><b>${fmtT(r.in)} · ${esc(siteName(r.site))}</b></div>` : `<label class="field"><span>Where are you working today? <em>*</em></span><select class="select" name="site" id="attSite">${siteOptsFor(u).map(([v, l]) => `<option value="${v}" ${v === site ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select></label>`}
      ${gpsBlock(site)}
      ${late ? `<div class="banner warn">${ico('clock')}<span>It is past the 9:15 AM grace time — this check-in will be marked <b>late</b>.</span></div>` : ''}
      ${early ? `<div class="banner warn">${ico('clock')}<span>Your shift ends at 7:00 PM. Add a note if you are leaving early.</span></div>` : ''}
      ${fld('Note', 'note', { type: 'textarea', rows: 2, ph: late ? 'Reason for coming late (optional)' : early ? 'Reason for leaving early' : 'Optional' })}
      <p class="muted" style="font-size:12.5px">${ico('camera', 'sm')} A selfie is required. In this demo the photo stays in your browser's storage.</p></div></div>`,
    foot: `<button type="button" class="btn" data-act="closeModal">Cancel</button><button type="submit" class="btn primary">${ico('check', 'sm')}${out ? 'Check out' : 'Check in'}</button>`,
    onOpen: m => { startCam($('[data-cam]', m)); $('#attSite', m)?.addEventListener('change', e => { GEO_FIX = null; $('#gpsRes').innerHTML = gpsResult(null, e.target.value); }); },
    onSubmit: d => {
      const ph = SNAP.att; if (!ph) { toast('Take a selfie (or use the sample) to continue', 'lock'); return false; }
      if (GEO_FIX && !GEO_FIX.ok && !GEO_FIX.error && !d.note) { toast(`You are ${fmtDist(GEO_FIX.dist)} from the site — add a note to continue`, 'lock'); return false; }
      if (early && !d.note) { toast('Add a note for leaving before 7:00 PM', 'lock'); return false; }
      const g = GEO_FIX && !GEO_FIX.error ? GEO_FIX : null;
      stopCam(); delete SNAP.att;
      if (out) { Object.assign(r, { out: Date.now(), selfieOut: ph, gpsOut: g, note: [r.note, d.note].filter(Boolean).join(' · ') }); logAct(`checked out (${fmtMins((r.out - r.in) / 6e4)} worked)`, null, 'user'); commit(`Checked out at ${fmtT(r.out)} · ${fmtMins((r.out - r.in) / 6e4)} worked`); return; }
      const rec = { id: nid('at'), user: SESSION, date: TODAY, in: Date.now(), out: null, site: d.site, gpsIn: g, gpsOut: null, selfieIn: ph, selfieOut: null, note: d.note, history: [] };
      DB.attendance.push(rec);
      logAct(`checked in at ${siteName(d.site)}${late ? ' (late)' : ''}`, d.site === 'office' ? null : d.site, 'user');
      commit(`Checked in at ${fmtT(rec.in)}${late ? ' · marked late' : ''}${g ? (g.ok ? ' · location verified' : ' · outside site radius') : ''}`);
    } });
}
ACT.checkIn = () => { if (!isEmployee()) { toast('The owner does not mark attendance', 'lock'); return; } if (attRec(SESSION, TODAY)) { toast('You have already checked in today'); return; } attModal('in'); };
ACT.checkOut = () => { const r = attRec(SESSION, TODAY); if (!r) { toast('Check in first', 'lock'); return; } if (r.out) { toast('You have already checked out'); return; } attModal('out'); };
ACT.gpsCheck = () => { const site = $('#attSite')?.value || attRec(SESSION, TODAY)?.site || 'office'; $('#gpsRes').innerHTML = gpsResult({ loading: true }); locateFor(site, g => { GEO_FIX = g; showFix(g, site); }); };
ACT.gpsSim = () => { const site = $('#attSite')?.value || attRec(SESSION, TODAY)?.site || 'office'; GEO_FIX = simulatedFix(site); showFix(GEO_FIX, site); };

/* corrections: authorised edits with history, and employee requests */
const CORR_TYPES = ['Missed check-in', 'Missed check-out', 'Wrong check-in time', 'Wrong check-out time', 'Worked at another site'];
function applyCorrection(uid, day, { inT, outT, site, status }, reason, request = null) {
  let r = attRec(uid, day); const u = user(uid);
  if (!r) { r = { id: nid('at'), user: uid, date: day, in: null, out: null, site: site || defaultSite(u), gpsIn: null, gpsOut: null, selfieIn: null, selfieOut: null, note: 'Created by correction', history: [] }; DB.attendance.push(r); }
  const h = (field, from, to, extra = {}) => r.history.push({ at: Date.now(), by: SESSION, field, from, to, reason, request, ...extra });
  const nIn = toTs(day, inT), nOut = toTs(day, outT);
  if (nIn && nIn !== r.in) { h('Check-in', r.in, nIn); r.in = nIn; }
  if (nOut && nOut !== r.out) { h('Check-out', r.out, nOut); r.out = nOut; }
  if (site && site !== r.site) { h('Site', null, null, { fromText: siteName(r.site), toText: siteName(site) }); r.site = site; }
  if (status !== undefined && (status || null) !== (r.status || null)) { h('Status', null, null, { fromText: r.status || 'Automatic', toText: status || 'Automatic' }); r.status = status || null; }
  if (!r.in) r.in = nOut ? nOut - 4 * 36e5 : tsOn(day, 9);
  return r;
}
ACT.attCorrect = el => {
  if (!guard(can2('Correct attendance'), 'correct attendance')) return;
  const uid = el.dataset.u, day = el.dataset.d, r = attRec(uid, day), u = user(uid); closeDrawer();
  openModal({ title: `Correct attendance · ${esc(u.name)}`, sub: fmtLong(day), body: `<div class="form">
    <div class="row3">${fld('Check-in', 'inT', { type: 'time', value: hhmm(r?.in) })}${fld('Check-out', 'outT', { type: 'time', value: hhmm(r?.out) })}${fld('Site', 'site', { opts: siteOptsFor(u), value: r?.site || defaultSite(u) })}</div>
    ${fld('Status', 'status', { opts: [['', 'Automatic (from times)'], 'Present', 'Late', 'Half day', 'Absent'], value: r?.status || '' })}
    ${fld('Reason for the correction', 'reason', { type: 'textarea', req: true, ph: 'e.g. Site register shows arrival at 9:00 AM; selfie failed to upload' })}
    ${demoNote('Every change is kept in the record\'s change history with who made it, when and why.')}</div>`,
    onSubmit: d => { applyCorrection(uid, day, { inT: d.inT, outT: d.outT, site: d.site, status: d.status }, d.reason); notify([uid], `Your attendance for ${fmtD(day)} was corrected by ${me().name}`, `#/attendance?tab=daily&date=${day}`, 'attendance'); logAct(`corrected attendance for ${u.name} (${fmtD(day)})`, null, 'user'); commit('Attendance corrected — change recorded in history'); } });
};
ACT.attRequest = el => {
  if (!isEmployee()) return;
  const day = el?.dataset?.d || (() => { let n = -1; while (!isWorkDay(dayOff(n))) n--; return dayOff(n); })(); closeDrawer();
  const r = attRec(SESSION, day);
  openModal({ title: 'Request an attendance correction', sub: 'The office administrator reviews and approves corrections.', body: `<div class="form">
    <div class="row2">${fld('Date', 'date', { type: 'date', req: true, value: day })}${fld('What needs correcting?', 'type', { opts: CORR_TYPES, value: r && !r.out ? 'Missed check-out' : r ? 'Wrong check-in time' : 'Missed check-in' })}</div>
    <div class="row2">${fld('Correct check-in', 'inTime', { type: 'time', value: hhmm(r?.in) })}${fld('Correct check-out', 'outTime', { type: 'time', value: hhmm(r?.out) })}</div>
    ${fld('Reason', 'reason', { type: 'textarea', req: true, ph: 'Explain what happened' })}</div>`,
    foot: `<button type="button" class="btn" data-act="closeModal">Cancel</button><button type="submit" class="btn primary">${ico('send', 'sm')}Send request</button>`,
    onSubmit: d => {
      if (d.date > TODAY) { toast('Pick today or an earlier date', 'lock'); return false; }
      if (!d.inTime && !d.outTime) { toast('Enter the correct check-in or check-out time', 'lock'); return false; }
      (DB.attRequests ||= []).unshift({ id: nid('ac'), user: SESSION, date: d.date, type: d.type, inTime: d.inTime, outTime: d.outTime, reason: d.reason, status: 'Pending', at: Date.now(), decidedBy: null, decidedAt: null, comment: '' });
      notify([...usersWithRole('admin', 'sysadmin', 'owner')], `${me().name} requested an attendance correction for ${fmtD(d.date)} (${d.type.toLowerCase()})`, '#/attendance?tab=corrections', 'attendance');
      commit('Correction request sent to the office');
    } });
};
function decideCorr(id, ok) {
  const q = DB.attRequests.find(x => x.id === id); if (!guard(can2('Correct attendance'), 'approve corrections')) return;
  const done = comment => {
    if (ok) applyCorrection(q.user, q.date, { inT: q.inTime, outT: q.outTime }, `${q.type}: ${q.reason}`, q.id);
    Object.assign(q, { status: ok ? 'Approved' : 'Rejected', decidedBy: SESSION, decidedAt: Date.now(), comment });
    notify([q.user], `Your attendance correction for ${fmtD(q.date)} was ${ok ? 'approved' : 'rejected'}${comment ? `: ${comment}` : ''}`, `#/attendance?tab=corrections`, 'attendance');
    logAct(`${ok ? 'approved' : 'rejected'} an attendance correction for ${userName(q.user)}`, null, 'user'); commit(ok ? 'Correction approved and applied' : 'Correction rejected');
  };
  openModal({ title: `${ok ? 'Approve' : 'Reject'} correction`, sub: `${esc(userName(q.user))} · ${fmtLong(q.date)}`, body: `<div class="form"><div class="form-note">${ico('history', 'sm')}<span><b>${esc(q.type)}</b>${q.inTime ? ` · in ${q.inTime}` : ''}${q.outTime ? ` · out ${q.outTime}` : ''} — ${esc(q.reason)}</span></div>${fld('Comment', 'comment', { type: 'textarea', rows: 2, req: !ok, ph: ok ? 'Optional, e.g. Verified with the site register' : 'Why is it rejected?' })}</div>`,
    foot: `<button type="button" class="btn" data-act="closeModal">Cancel</button><button type="submit" class="btn ${ok ? 'primary' : 'danger'}">${ok ? 'Approve & apply' : 'Reject'}</button>`, onSubmit: d => done(d.comment) });
}
ACT.corrApprove = el => decideCorr(el.dataset.id, true);
ACT.corrReject = el => decideCorr(el.dataset.id, false);
function attCorrections() {
  const scope = new Set(teamScope().map(u => u.id)), auth = can2('Correct attendance');
  const reqs = (DB.attRequests || []).filter(q => scope.has(q.user)).sort((a, b) => (a.status === 'Pending' ? 0 : 1) - (b.status === 'Pending' ? 0 : 1) || b.at - a.at);
  const hist = DB.attendance.filter(r => scope.has(r.user)).flatMap(r => (r.history || []).map(h => ({ ...h, r }))).sort((a, b) => b.at - a.at);
  return `<div class="split"><span class="muted">${auth ? 'Approve requests from employees or correct any record directly from its details.' : 'Ask the office to fix a missed or wrong check-in or check-out.'}</span>${isEmployee() ? btn('Request a correction', 'attRequest', { icon: 'plus', cls: 'sm' }) : ''}</div>
    <div class="card"><div class="card-head"><h2>Correction requests</h2><span class="sub">${reqs.filter(q => q.status === 'Pending').length} pending</span></div>
      <div class="table-wrap" style="margin-top:12px"><table class="t stack-sm"><thead><tr><th>Employee</th><th>Date</th><th>Request</th><th>Reason</th><th>Status</th><th class="r"></th></tr></thead><tbody>
      ${reqs.map(q => `<tr><td class="full">${personCell(user(q.user))}</td><td class="nowrap">${fmtD(q.date)}<span class="sub">asked ${ago(q.at)}</span></td><td>${esc(q.type)}<span class="sub">${q.inTime ? `in ${q.inTime} ` : ''}${q.outTime ? `out ${q.outTime}` : ''}</span></td><td class="hide-sm" style="white-space:normal;max-width:300px;font-size:13px">${esc(q.reason)}${q.comment ? `<span class="sub">${esc(userName(q.decidedBy))}: ${esc(q.comment)}</span>` : ''}</td>
        <td>${badge(q.status, q.status === 'Pending' ? 'warn' : undefined)}</td><td class="r">${q.status === 'Pending' && auth ? `<div class="row-acts"><button class="btn xs" data-act="corrReject" data-id="${q.id}">Reject</button><button class="btn xs primary" data-act="corrApprove" data-id="${q.id}">Approve</button></div>` : ''}</td></tr>`).join('') || emptyRow(6, 'No correction requests')}
      </tbody></table></div></div>
    <div class="card"><div class="card-head"><h2>Change history</h2><span class="sub">Every correction made to attendance records</span></div><div class="card-body">
      ${hist.length ? `<ul class="timeline">${hist.slice(0, 30).map(h => `<li class="k-delay"><div class="when">${fmtTs(h.at)} · ${esc(userName(h.by))}${h.request ? ' · from a request' : ''}</div><div class="what"><b>${esc(userName(h.r.user))}</b>, ${fmtD(h.r.date)} — ${esc(h.field)}: ${h.from ? fmtT(h.from) : esc(h.fromText || '—')} → ${h.to ? fmtT(h.to) : esc(h.toText || '—')}</div><div class="muted" style="font-size:13px">${esc(h.reason)}</div></li>`).join('')}</ul>` : '<p class="muted">No corrections yet.</p>'}</div></div>`;
}

/* ================= leave ================= */
const leaveYear = () => TODAY.slice(0, 4);
function leaveBalance(uid) {
  const yr = leaveYear(), mine = DB.leaves.filter(l => l.user === uid && l.from.startsWith(yr));
  return Object.entries(LEAVE_TYPES).map(([type, allot]) => { const used = sum(mine.filter(l => l.type === type && l.status === 'Approved'), l => l.days), pending = sum(mine.filter(l => l.type === type && l.status === 'Pending'), l => l.days); return { type, allot, used, pending, avail: allot == null ? null : allot - used - pending }; });
}
const canApproveLeave = l => can2('Approve leave') && l.user !== SESSION && (['owner', 'sysadmin', 'admin'].includes(role()) || DB.projects.some(p => p.pm === SESSION && [p.engineer, p.supervisor].includes(l.user)));
const leaveApprovers = uid => [...usersWithRole('owner', 'sysadmin', 'admin'), ...DB.projects.filter(p => [p.engineer, p.supervisor].includes(uid)).map(p => p.pm)];
const LV_TONE = { Pending: 'warn', Approved: 'ok', Rejected: 'bad', Cancelled: '' };
const leaveDur = l => l.half ? `Half day (${l.half.toLowerCase()})` : plural(l.days, 'day');
const leaveDates = l => l.from === l.to ? fmtDY(l.from) : `${fmtD(l.from)} – ${fmtDY(l.to)}`;
NAV_COUNT_HOOKS.push(() => ({ leave: (DB.leaves || []).filter(l => l.status === 'Pending' && canApproveLeave(l)).length }));

const lvSlug = t => String(t).toLowerCase().replace(/[^a-z]+/g, '-').replace(/-leave$/, '');
const lvDay = d => `<span class="lx-date"><b>${parseD(d).getDate()}</b><small>${parseD(d).toLocaleDateString('en-IN', { month: 'short' })}</small></span>`;
VIEWS.leave = () => {
  const emp = isEmployee(), appr = can2('Approve leave');
  const opts = [...(emp ? [['my', 'My leave']] : []), ...(appr ? [['approvals', 'Approvals', DB.leaves.filter(l => l.status === 'Pending' && canApproveLeave(l)).length || null]] : []), ...(isManager() ? [['team', 'Team leave & balances']] : [])];
  const tab = opts.some(o => o[0] === ROUTE.q.tab) ? ROUTE.q.tab : opts[0][0];
  const body = tab === 'approvals' ? leaveApprovals() : tab === 'team' ? leaveTeam() : leaveMine();
  return `<div class="ax lx">${pageHead('Leave', 'Full-day and half-day leave · Sundays are not counted', emp ? btn('Apply for leave', 'applyLeave', { icon: 'plus', cls: 'primary' }) : '')}${tabs(opts, tab)}${body}</div>`;
};
/* one leave request as a row */
function leaveItem(l, { who = true, acts = '' } = {}) {
  const u = user(l.user);
  return `<li class="lx-row s-${l.status.toLowerCase()}">
    ${lvDay(l.from)}
    <div class="lx-main">${who ? `<div class="lx-who">${av(u.name, 'sm')}<b>${esc(u.name)}</b><span>${esc(u.title || ROLES[u.role].label)}</span></div>` : ''}
      <div class="lx-what"><span class="lx-type t-${lvSlug(l.type)}">${esc(l.type)}</span><b>${leaveDates(l)}</b><span class="lx-dur">${leaveDur(l)}</span></div>
      <p>${esc(l.reason)}</p>${l.comment ? `<p class="lx-cm">${ico('edit', 'sm')}<span><b>${esc(userName(l.decidedBy))}:</b> ${esc(l.comment)}</span></p>` : ''}</div>
    <div class="lx-st"><span class="lx-status">${esc(l.status)}</span><small>${l.decidedBy && l.status !== 'Cancelled' && l.status !== 'Pending' ? `by ${esc(userName(l.decidedBy).split(' ')[0])} · ` : ''}applied ${fmtD(iso(new Date(l.appliedAt)))}</small></div>
    <div class="lx-acts">${acts}</div></li>`;
}
function balanceCards(uid) {
  const R = 30, C = 2 * Math.PI * R;
  return `<div class="lx-bal">${leaveBalance(uid).map(b => { const lim = b.allot != null, f = lim ? Math.max(0, b.avail) / (b.allot || 1) : 1;
    return `<div class="lx-bc t-${lvSlug(b.type)}">${lim ? `<svg viewBox="0 0 72 72" aria-hidden="true"><circle class="trk" r="${R}" cx="36" cy="36"/><circle class="val" r="${R}" cx="36" cy="36" stroke-dasharray="${f * C} ${C}"/></svg>` : `<span class="lx-inf">∞</span>`}
      <div><span>${esc(b.type)}</span><b>${lim ? num(b.avail) : 'No limit'}${lim ? `<small> of ${b.allot} left</small>` : ''}</b><small>${num(b.used)} used${b.pending ? ` · <em>${num(b.pending)} pending</em>` : ''}</small></div></div>`; }).join('')}</div>`;
}
function leaveMine() {
  const list = DB.leaves.filter(l => l.user === SESSION).sort((a, b) => b.from.localeCompare(a.from));
  const upcoming = list.filter(l => l.to >= TODAY && ['Pending', 'Approved'].includes(l.status));
  const cancel = l => (l.status === 'Pending' || (l.status === 'Approved' && l.from > TODAY)) ? `<button class="btn xs" data-act="cancelLeave" data-id="${l.id}">Cancel</button>` : '';
  return `${balanceCards(SESSION)}
    ${upcoming.length ? `<section class="card lx-card"><div class="card-head"><h2>Coming up</h2><span class="sub">${plural(upcoming.length, 'request')}</span></div><ul class="lx-list">${upcoming.map(l => leaveItem(l, { who: false, acts: cancel(l) })).join('')}</ul></section>` : ''}
    <section class="card lx-card"><div class="card-head"><h2>My leave history</h2><span class="sub">${leaveYear()}</span></div>
      ${list.length ? `<ul class="lx-list">${list.filter(l => !upcoming.includes(l)).map(l => leaveItem(l, { who: false, acts: cancel(l) })).join('') || '<li class="lx-empty">Nothing else this year.</li>'}</ul>` : `<div class="lx-none">${ico('leave')}<b>No leave taken yet</b><span>Use <b>Apply for leave</b> when you need time off.</span></div>`}</section>`;
}
function leaveApprovals() {
  const pend = DB.leaves.filter(l => l.status === 'Pending' && canApproveLeave(l)).sort((a, b) => a.from.localeCompare(b.from));
  const done = DB.leaves.filter(l => l.status !== 'Pending' && l.decidedBy && teamScope().some(u => u.id === l.user)).sort((a, b) => (b.decidedAt || 0) - (a.decidedAt || 0)).slice(0, 10);
  const clash = l => DB.leaves.filter(x => x !== l && x.status === 'Approved' && x.from <= l.to && x.to >= l.from && DB.projects.some(p => [p.engineer, p.supervisor].includes(x.user) && [p.engineer, p.supervisor].includes(l.user)));
  return `<section class="lx-req-wrap">${pend.length ? `<div class="lx-reqs">${pend.map(l => { const u = user(l.user), b = leaveBalance(l.user).find(x => x.type === l.type), c = clash(l);
      return `<article class="card lx-req"><header>${av(u.name)}<div><b>${esc(u.name)}</b><span>${esc(u.title || ROLES[u.role].label)} · applied ${ago(l.appliedAt).toLowerCase()}</span></div></header>
        <div class="lx-req-when">${lvDay(l.from)}<div><span class="lx-type t-${lvSlug(l.type)}">${esc(l.type)}</span><b>${leaveDates(l)}</b><span>${leaveDur(l)}</span></div></div>
        <p class="lx-reason">“${esc(l.reason)}”</p>
        <div class="lx-facts"><span>${ico('leave', 'sm')}${b && b.allot != null ? `<b>${num(b.avail)}</b> of ${b.allot} left after this` : 'No balance limit'}</span>${c.length ? `<span class="warn">${ico('alert', 'sm')}${esc(c.map(x => userName(x.user)).join(', '))} also off then</span>` : `<span class="ok">${ico('check', 'sm')}No clash with site team</span>`}</div>
        <footer><button class="btn" data-act="decideLeave" data-id="${l.id}" data-ok="0">${ico('x', 'sm')}Reject</button><button class="btn primary" data-act="decideLeave" data-id="${l.id}" data-ok="1">${ico('check', 'sm')}Approve</button></footer></article>`; }).join('')}</div>`
      : `<div class="card lx-none">${ico('check')}<b>All caught up</b><span>No leave requests are waiting for you.</span></div>`}</section>
    <section class="card lx-card"><div class="card-head"><h2>Recently decided</h2></div><ul class="lx-list">${done.map(l => leaveItem(l)).join('') || '<li class="lx-empty">Nothing decided yet.</li>'}</ul></section>`;
}
function leaveTeam() {
  const { u = '', st = '' } = ROUTE.q, people = teamScope(), types = Object.keys(LEAVE_TYPES).filter(t => LEAVE_TYPES[t]);
  const list = DB.leaves.filter(l => people.some(x => x.id === l.user) && (!u || l.user === u) && (!st || l.status === st)).sort((a, b) => b.from.localeCompare(a.from));
  const off = people.filter(x => leaveOn(x.id, TODAY));
  return `<section class="card lx-card"><div class="card-head"><h2>Balances · ${leaveYear()}</h2><span class="sub">${off.length ? `${off.map(x => esc(x.name.split(' ')[0])).join(', ')} on leave today` : 'Nobody on leave today'}</span></div>
      <div class="lx-tb"><div class="lx-tb-h"><span>Employee</span>${types.map(t => `<span><i class="lx-dot t-${lvSlug(t)}"></i>${esc(t.replace(' leave', ''))}</span>`).join('')}</div>
      ${people.map(x => `<div class="lx-tb-r ${u === x.id ? 'on' : ''}" data-act="setQ" data-k="u" data-v="${u === x.id ? '' : x.id}" role="button" tabindex="0"><div class="lx-who">${av(x.name, 'sm')}<b>${esc(x.name)}</b>${leaveOn(x.id, TODAY) ? '<em>on leave</em>' : ''}</div>
        ${leaveBalance(x.id).filter(b => b.allot != null).map(b => `<div class="lx-m t-${lvSlug(b.type)}"><i><em style="width:${Math.max(0, b.avail) / b.allot * 100}%"></em></i><b>${num(b.avail)}<small>/${b.allot}</small></b></div>`).join('')}</div>`).join('')}</div></section>
    <section class="card lx-card"><div class="card-head"><h2>Leave history</h2><span class="sub">${plural(list.length, 'request')}${u ? ` · ${esc(userName(u))}` : ''}</span></div>
      <div class="lx-tools"><div class="chips">${[['', 'All'], ['Pending', 'Pending'], ['Approved', 'Approved'], ['Rejected', 'Rejected'], ['Cancelled', 'Cancelled']].map(([k, l]) => `<button class="chip ${st === k ? 'on' : ''}" data-act="setQ" data-k="st" data-v="${k}">${l} <span class="n">${DB.leaves.filter(x => people.some(p => p.id === x.user) && (!u || x.user === u) && (!k || x.status === k)).length}</span></button>`).join('')}</div><span class="grow"></span>
        <select class="select sm" data-change="setQ" data-k="u" aria-label="Employee"><option value="">All employees</option>${people.map(x => `<option value="${x.id}" ${x.id === u ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select></div>
      <ul class="lx-list">${list.map(l => leaveItem(l, { acts: l.status === 'Pending' && canApproveLeave(l) ? `<button class="btn xs primary" data-act="decideLeave" data-id="${l.id}" data-ok="1">Approve</button>` : '' })).join('') || '<li class="lx-empty">No leave requests.</li>'}</ul></section>`;
}
ACT.applyLeave = () => {
  if (!isEmployee()) { toast('The owner does not apply for leave in this app', 'lock'); return; }
  const bal = leaveBalance(SESSION);
  openModal({ title: 'Apply for leave', sub: `${esc(me().name)} · approvals go to your manager and the office`, body: `<div class="form">
    ${fld('Leave type', 'type', { opts: bal.map(b => [b.type, b.allot == null ? b.type : `${b.type} — ${num(b.avail)} of ${b.allot} left`]) })}
    <div class="row3">${fld('From', 'from', { type: 'date', req: true, value: shiftD(TODAY, 1) })}${fld('To', 'to', { type: 'date', req: true, value: shiftD(TODAY, 1) })}${fld('Duration', 'half', { opts: [['', 'Full day(s)'], ['First half', 'Half day · first half'], ['Second half', 'Half day · second half']] })}</div>
    <div class="form-note" id="lvCalc">${ico('cal', 'sm')}<span></span></div>
    ${fld('Reason', 'reason', { type: 'textarea', req: true, ph: 'e.g. Family function at Kumbakonam' })}</div>`,
    foot: `<button type="button" class="btn" data-act="closeModal">Cancel</button><button type="submit" class="btn primary">${ico('send', 'sm')}Submit request</button>`,
    onOpen: m => {
      const f = n => $(`[name=${n}]`, m);
      const calc = () => { const fr = f('from').value, to = f('to').value, h = f('half').value; if (h && to !== fr) f('to').value = fr; const t = f('to').value; const n = !fr || !t || t < fr ? 0 : h ? .5 : workDaysIn(fr, t); const b = bal.find(x => x.type === f('type').value);
        $('#lvCalc span', m).innerHTML = n ? `<b>${num(n)} working ${n === 1 || n === .5 ? 'day' : 'days'}</b> (Sundays excluded)${b?.allot != null ? ` · ${num(b.avail - n)} ${b.type.toLowerCase()} left after this` : ''}` : 'Pick valid dates — the end date must be on or after the start date and include a working day.'; };
      ['type', 'from', 'to', 'half'].forEach(n => f(n).addEventListener('change', calc)); f('from').addEventListener('change', () => { if (f('to').value < f('from').value) f('to').value = f('from').value; calc(); }); calc();
    },
    onSubmit: d => {
      const to = d.half ? d.from : d.to;
      if (to < d.from) { toast('The end date must be on or after the start date', 'lock'); return false; }
      if (d.from < shiftD(TODAY, -7)) { toast('Leave can be applied up to 7 days after the date', 'lock'); return false; }
      const days = d.half ? .5 : workDaysIn(d.from, to);
      if (!days) { toast('The selected dates fall on Sundays — no working days', 'lock'); return false; }
      const b = bal.find(x => x.type === d.type);
      if (b.allot != null && days > b.avail) { toast(`Only ${num(b.avail)} ${d.type.toLowerCase()} left — choose another leave type`, 'lock'); return false; }
      const clash = DB.leaves.find(l => l.user === SESSION && ['Pending', 'Approved'].includes(l.status) && l.from <= to && l.to >= d.from);
      if (clash) { toast(`You already have ${clash.status.toLowerCase()} leave on ${leaveDates(clash)}`, 'lock'); return false; }
      const l = { id: nid('lv'), user: SESSION, type: d.type, from: d.from, to, half: d.half || null, days, reason: d.reason, status: 'Pending', appliedAt: Date.now(), decidedBy: null, decidedAt: null, comment: '' };
      DB.leaves.unshift(l);
      notify(leaveApprovers(SESSION), `${me().name} applied for ${d.type.toLowerCase()} · ${leaveDur(l)} from ${fmtD(l.from)}`, '#/leave?tab=approvals', 'leave');
      logAct(`applied for ${d.type.toLowerCase()} (${leaveDur(l)})`, null, 'user');
      saveDB(); go('#/leave?tab=my'); toast('Leave request submitted for approval');
    } });
};
ACT.decideLeave = el => {
  const l = DB.leaves.find(x => x.id === el.dataset.id), ok = el.dataset.ok === '1';
  if (!guard(canApproveLeave(l), 'approve this leave')) return;
  openModal({ title: `${ok ? 'Approve' : 'Reject'} leave`, sub: `${esc(userName(l.user))} · ${esc(l.type)} · ${leaveDates(l)} · ${leaveDur(l)}`, body: `<div class="form"><div class="form-note">${ico('leave', 'sm')}<span>${esc(l.reason)}</span></div>${fld('Comment', 'comment', { type: 'textarea', rows: 2, req: !ok, ph: ok ? 'Optional' : 'Let them know why' })}</div>`,
    foot: `<button type="button" class="btn" data-act="closeModal">Cancel</button><button type="submit" class="btn ${ok ? 'primary' : 'danger'}">${ok ? 'Approve' : 'Reject'}</button>`,
    onSubmit: d => { Object.assign(l, { status: ok ? 'Approved' : 'Rejected', decidedBy: SESSION, decidedAt: Date.now(), comment: d.comment }); notify([l.user], `Your ${l.type.toLowerCase()} on ${leaveDates(l)} was ${ok ? 'approved' : 'rejected'} by ${me().name}${d.comment ? `: ${d.comment}` : ''}`, '#/leave?tab=my', 'leave'); logAct(`${ok ? 'approved' : 'rejected'} leave for ${userName(l.user)}`, null, 'user'); commit(`Leave ${ok ? 'approved — attendance will show “On leave”' : 'rejected'}`); } });
};
ACT.cancelLeave = el => {
  const l = DB.leaves.find(x => x.id === el.dataset.id);
  confirmBox('Cancel this leave?', `${esc(l.type)} on <b>${leaveDates(l)}</b> (${leaveDur(l)}) will be cancelled${l.status === 'Approved' ? ' and your approver notified' : ''}. The days return to your balance.`, 'Cancel leave', () => {
    const was = l.status; l.status = 'Cancelled';
    if (was === 'Approved') notify(leaveApprovers(l.user), `${me().name} cancelled approved leave on ${leaveDates(l)}`, '#/leave?tab=team', 'leave');
    commit('Leave cancelled');
  }, true);
};

/* ================= performance & appraisals ================= */
const PERF_METRICS = {
  site: [['timeliness', 'Reporting timeliness', 'Daily reports submitted by 8 PM'], ['tasks', 'Task completion', 'Planned floor activities completed on time'], ['quality', 'Work quality', 'Inspections, defects and rework'], ['progress', 'Project progress', 'Actual progress against plan'], ['coordination', 'Workforce coordination', 'Crew planning and sub-contractor coordination']],
  pm: [['progress', 'Project progress', 'Average progress against plan'], ['timeliness', 'Team reporting timeliness', 'Daily reports on their projects by 8 PM'], ['tasks', 'Milestone completion', 'Milestones completed on schedule'], ['quality', 'Work quality', 'Inspections, defects and rework'], ['coordination', 'Client & team coordination', 'Client updates and team coordination']],
  office: [['attendance', 'Attendance & punctuality', 'On-time check-ins and attendance'], ['tasks', 'Task completion', 'Assigned tasks closed on time'], ['quality', 'Work quality', 'Accuracy of records and filings'], ['timeliness', 'Processing timeliness', 'Bills, invoices and documents processed on time'], ['coordination', 'Team coordination', 'Support to site teams and accounts']],
};
const metricSet = u => u.role === 'pm' ? 'pm' : ['engineer', 'supervisor'].includes(u.role) ? 'site' : 'office';
const metricsOf = u => PERF_METRICS[metricSet(u)];
const lastMonthsKeys = n => { const out = []; for (let i = n - 1; i >= 0; i--) { const d = parseD(TODAY); d.setDate(1); d.setMonth(d.getMonth() - i); out.push(`${d.getFullYear()}-${pad(d.getMonth() + 1)}`); } return out; };
// the current month is measured live from reports, attendance and project progress; the rest come from monthly reviews
function monthScores(u, mk) {
  const stored = DB.perf?.[u.id]?.[mk];
  if (mk !== monthKey(TODAY)) return stored || null;
  const prev = DB.perf?.[u.id]?.[lastMonthsKeys(2)[0]] || {};
  const out = { ...prev };
  const ps = DB.projects.filter(p => !['Completed', 'On hold'].includes(p.status) && (u.role === 'pm' ? p.pm === u.id : [p.engineer, p.supervisor].includes(u.id)));
  if (ps.length) {
    const slots = ps.flatMap(p => daysBetween(mk + '-01', TODAY).map(d => reportSlot(p, d))).filter(s => ['Submitted', 'Late', 'Missing'].includes(s.st));
    if (slots.length) out.timeliness = Math.round(slots.filter(s => s.st === 'Submitted').length / slots.length * 100);
    out.progress = Math.round(sum(ps, p => Math.max(40, Math.min(100, 92 + (p.progress - planPct(p)) * 2))) / ps.length);
  }
  out.attendance = attSummary(u.id, mk + '-01', TODAY).punctual;
  return out;
}
const overall = (u, s) => s ? Math.round(sum(metricsOf(u), ([k]) => s[k] || 0) / metricsOf(u).length) : null;
const scoreTone = v => v == null ? '' : v >= 85 ? 'ok' : v >= 70 ? '' : 'bad';
function spark(vals) {
  const v = vals.filter(x => x != null); if (v.length < 2) return '';
  const lo = Math.min(...v) - 4, hi = Math.max(...v) + 4, W = 90, H = 26, step = W / (vals.length - 1);
  const pts = vals.map((x, i) => x == null ? null : `${(i * step).toFixed(1)},${(H - (x - lo) / (hi - lo) * H).toFixed(1)}`).filter(Boolean);
  return `<svg class="spark" viewBox="0 0 ${W} ${H}" aria-hidden="true"><polyline points="${pts.join(' ')}"/><circle cx="${pts[pts.length - 1].split(',')[0]}" cy="${pts[pts.length - 1].split(',')[1]}" r="2.6"/></svg>`;
}
const appraisalsOf = uid => DB.appraisals.filter(a => a.user === uid).sort((a, b) => b.period.localeCompare(a.period));
const cycle = () => prevQuarter(TODAY);
const canReview = a => a.reviewer === SESSION || ['owner', 'sysadmin'].includes(role());
NAV_COUNT_HOOKS.push(() => ({ performance: (DB.appraisals || []).filter(a => a.period === cycle().key && ['Pending', 'Self-review submitted'].includes(a.status) && a.reviewer === SESSION).length }));

VIEWS.performance = () => {
  const mgr = isManager() || role() === 'owner';
  if (!mgr && !ROUTE.q.u && ROUTE.q.tab !== 'appraisals') ROUTE.q.u = SESSION;
  const tab = ROUTE.q.tab === 'appraisals' ? 'appraisals' : ROUTE.q.tab === 'salary' && canManageSalaries() ? 'salary' : 'overview';
  const pend = DB.appraisals.filter(a => a.period === cycle().key && teamScope().some(u => u.id === a.user) && ['Pending', 'Self-review submitted'].includes(a.status)).length;
  const T = tabs([['overview', mgr ? 'Team performance' : 'My performance'], ['appraisals', `Appraisals · ${cycle().short}`, pend || null], ...(canManageSalaries() ? [['salary', `${ico('rupee', 'sm')}Salary &amp; bonus`]] : [])], tab);
  const u = ROUTE.q.u && teamScope().find(x => x.id === ROUTE.q.u);
  const body = tab === 'appraisals' ? perfAppraisals() : tab === 'salary' ? salaryTab() : u ? perfDetail(u) : perfOverview();
  return `${pageHead('Performance', 'Role-specific scorecards from daily reports, attendance and project progress, with monthly and quarterly summaries, feedback and appraisals.', mgr && u && tab === 'overview' ? btn('Add feedback', 'addFeedback', { icon: 'plus', data: `data-u="${u.id}"` }) : '')}${T}${body}`;
};
function perfOverview() {
  const people = teamScope(), mk = monthKey(TODAY), months = lastMonthsKeys(6);
  const rows = people.map(u => { const s = monthScores(u, mk), o = overall(u, s), hist = months.map(k => overall(u, monthScores(u, k))), ap = appraisalsOf(u.id), cur = ap.find(a => a.period === cycle().key), last = ap.find(a => a.rating); return { u, o, hist, cur, last }; });
  const avg = Math.round(sum(rows, r => r.o || 0) / Math.max(1, rows.length));
  const top = rows.slice().sort((a, b) => b.o - a.o)[0], low = rows.filter(r => r.o < 72);
  return `<div class="kpis">
      <div class="kpi"><div class="l">${ico('star', 'sm')}Team score · ${monthLabel(mk).split(' ')[0]}</div><div class="v">${avg}<small> / 100</small></div><div class="s">${plural(rows.length, 'employee')}, month to date</div></div>
      <div class="kpi"><div class="l">${ico('trend', 'sm')}Top performer</div><div class="v" style="font-size:20px;padding-top:5px">${top ? esc(top.u.name.split(' ')[0]) : '—'}</div><div class="s">${top ? `${top.o} / 100 · ${esc(ROLES[top.u.role].label)}` : ''}</div></div>
      <div class="kpi"><div class="l">${ico('alert', 'sm')}Needs support</div><div class="v">${low.length}</div><div class="s">${low.map(r => esc(r.u.name.split(' ')[0])).join(', ') || 'everyone above 72'}</div></div>
      <div class="kpi"><div class="l">${ico('task', 'sm')}Appraisals pending</div><div class="v">${rows.filter(r => r.cur && ['Pending', 'Self-review submitted'].includes(r.cur.status)).length}</div><div class="s">${cycle().label} cycle</div></div></div>
    <div class="card"><div class="card-head"><h2>Scorecards</h2><span class="sub">Current month is measured live; earlier months come from monthly reviews</span></div>
      <div class="table-wrap" style="margin-top:12px"><table class="t stack-sm"><thead><tr><th>Employee</th><th style="min-width:170px">This month</th><th class="hide-sm">6-month trend</th><th>Last appraisal</th><th>${esc(cycle().short)} appraisal</th></tr></thead><tbody>
      ${rows.map(r => `<tr class="click" data-act="setQ" data-k="u" data-v="${r.u.id}"><td class="full">${personCell(r.u)}</td><td>${meter(r.o || 0, scoreTone(r.o))}</td><td class="hide-sm">${spark(r.hist)}</td><td>${r.last ? `${stars(r.last.rating)} <span class="muted" style="font-size:12.5px">${r.last.rating}</span>` : '—'}</td><td>${r.cur ? badge(r.cur.status, r.cur.status === 'Pending' ? 'warn' : r.cur.status === 'Self-review submitted' ? 'info' : 'ok') : '—'}</td></tr>`).join('') || emptyRow(5, 'No employees')}
      </tbody></table></div></div>`;
}
function perfDetail(u) {
  const per = ROUTE.q.per === 'quarter' ? 'quarter' : 'month', months = lastMonthsKeys(6), mk = monthKey(TODAY), ms = metricsOf(u);
  const cur = monthScores(u, mk), o = overall(u, cur);
  const qs = [...new Set(months.map(k => quarterOf(k + '-01').key))].map(qk => { const ks = months.filter(k => quarterOf(k + '-01').key === qk), sc = {}; ms.forEach(([k]) => { const v = ks.map(m => monthScores(u, m)?.[k]).filter(x => x != null); sc[k] = v.length ? Math.round(sum(v) / v.length) : null; }); return { qk, label: quarterOf(ks[0] + '-01').label, sc, partial: ks.includes(mk) }; });
  const fb = (DB.feedback || []).filter(f => f.user === u.id).sort((a, b) => b.at - a.at);
  const ap = appraisalsOf(u.id);
  return `${isManager() || role() === 'owner' ? `<a class="crumb" href="#/performance">${ico('arrowL', 'sm')}Team performance</a>` : ''}
    <div class="proj-hero"><div class="t"><div class="person">${av(u.name, 'lg')}<div class="nm"><b style="font-size:18px">${esc(u.name)}</b><span>${esc(u.title)} · ${esc(ROLES[u.role].label)} metrics</span></div></div></div>
      <div class="perf-score ${scoreTone(o)}"><b>${o ?? '—'}</b><span>score this month</span></div></div>
    ${lastApprCard(u)}
    <div class="perf-metrics">${ms.map(([k, l, hint]) => { const hist = months.map(m => monthScores(u, m)?.[k] ?? null), v = cur?.[k]; return `<div class="card perf-m"><span class="muted">${esc(l)}</span><b class="${scoreTone(v)}">${v ?? '—'}<small>%</small></b>${spark(hist)}<small class="muted">${esc(hint)}${['timeliness', 'progress', 'attendance'].includes(k) ? ' · live' : ''}</small></div>`; }).join('')}</div>
    <div class="card"><div class="card-head"><h2>${per === 'quarter' ? 'Quarterly' : 'Monthly'} summary</h2><div class="seg" role="group" aria-label="Period"><button class="${per === 'month' ? 'on' : ''}" data-act="setQ" data-k="per" data-v="month">Monthly</button><button class="${per === 'quarter' ? 'on' : ''}" data-act="setQ" data-k="per" data-v="quarter">Quarterly</button></div></div>
      <div class="table-wrap" style="margin-top:12px"><table class="t"><thead><tr><th>${per === 'quarter' ? 'Quarter' : 'Month'}</th>${ms.map(([, l]) => `<th class="r">${esc(l)}</th>`).join('')}<th class="r">Overall</th><th>Rating</th></tr></thead><tbody>
      ${(per === 'quarter' ? qs.slice().reverse().map(q => ({ l: q.label + (q.partial ? ' (to date)' : ''), sc: q.sc })) : months.slice().reverse().map(m => ({ l: monthLabel(m) + (m === mk ? ' (to date)' : ''), sc: monthScores(u, m) }))).map(r => { const ov = overall(u, r.sc); return `<tr><td class="strong">${esc(r.l)}</td>${ms.map(([k]) => `<td class="r">${r.sc?.[k] ?? '—'}</td>`).join('')}<td class="r strong" style="color:var(--${scoreTone(ov) === 'bad' ? 'bad' : scoreTone(ov) === 'ok' ? 'ok' : 'ink'})">${ov ?? '—'}</td><td>${ov ? stars(ov / 20) : ''}</td></tr>`; }).join('')}
      </tbody></table></div></div>
    ${compCard(u)}
    <div class="grid g2">
      <div class="card"><div class="card-head"><h2>Manager feedback</h2>${isManager() && u.id !== SESSION ? btn('Add', 'addFeedback', { cls: 'sm', data: `data-u="${u.id}"` }) : ''}</div><ul class="list" style="margin-top:8px">${fb.map(f => `<li style="align-items:flex-start"><span class="sig ${f.kind === 'Appreciation' ? 'ok' : 'warn'}">${ico(f.kind === 'Appreciation' ? 'star' : 'flag', 'sm')}</span><div class="main-t"><b style="white-space:normal">${esc(f.text)}</b><span>${esc(f.kind)} · ${esc(userName(f.by))} · ${fmtDY(iso(new Date(f.at)))}</span></div></li>`).join('') || '<li class="muted">No feedback yet.</li>'}</ul></div>
      <div class="card"><div class="card-head"><h2>Appraisal history</h2></div><ul class="list click" style="margin-top:8px">${ap.map(a => `<li data-act="viewAppraisal" data-id="${a.id}"><span class="sig">${ico('star', 'sm')}</span><div class="main-t"><b>${esc(a.label)}</b><span>Reviewer: ${esc(userName(a.reviewer))}${a.completedAt ? ` · ${fmtDY(iso(new Date(a.completedAt)))}` : ` · due ${fmtD(a.due)}`}</span></div>${a.rating ? `${stars(a.rating)}<span class="num strong">${a.rating}</span>` : badge(a.status, 'warn')}</li>`).join('') || '<li class="muted">No appraisals yet.</li>'}</ul></div>
    </div>`;
}
function perfAppraisals() {
  const q = cycle(), list = DB.appraisals.filter(a => a.period === q.key && teamScope().some(u => u.id === a.user)).sort((a, b) => ['Pending', 'Self-review submitted', 'Completed', 'Acknowledged'].indexOf(a.status) - ['Pending', 'Self-review submitted', 'Completed', 'Acknowledged'].indexOf(b.status));
  const act = a => {
    if (canReview(a) && ['Pending', 'Self-review submitted'].includes(a.status)) return `<button class="btn xs primary" data-act="doAppraisal" data-id="${a.id}">${a.status === 'Pending' ? 'Start appraisal' : 'Complete appraisal'}</button>`;
    if (a.user === SESSION && a.status === 'Pending') return `<button class="btn xs" data-act="selfReview" data-id="${a.id}">Submit self review</button>`;
    if (a.user === SESSION && a.status === 'Completed') return `<button class="btn xs primary" data-act="ackAppraisal" data-id="${a.id}">Acknowledge</button>`;
    return `<button class="btn xs" data-act="viewAppraisal" data-id="${a.id}">View</button>`;
  };
  return `<div class="banner">${ico('cal')}<span>Appraisal cycle <b>${esc(q.label)}</b> · reviews due by ${fmtDY(shiftD(q.end, 20))}. Employees submit a self review, the reviewer rates each metric, then the employee acknowledges.</span></div>
    <div class="card"><div class="table-wrap"><table class="t stack-sm"><thead><tr><th>Employee</th><th>Reviewer</th><th>Quarter score</th><th>Status</th><th>Rating</th><th class="r"></th></tr></thead><tbody>
    ${list.map(a => { const u = user(a.user), ks = lastMonthsKeys(6).filter(k => quarterOf(k + '-01').key === q.key), sc = ks.map(k => overall(u, monthScores(u, k))).filter(x => x != null); const qs = sc.length ? Math.round(sum(sc) / sc.length) : null;
      return `<tr><td class="full">${personCell(u)}</td><td class="hide-sm">${esc(userName(a.reviewer))}</td><td>${qs != null ? meter(qs, scoreTone(qs)) : '—'}</td><td>${badge(a.status, a.status === 'Pending' ? 'warn' : a.status === 'Self-review submitted' ? 'info' : 'ok')}</td><td>${a.rating ? `${stars(a.rating)} ${a.rating}` : '—'}</td><td class="r">${act(a)}</td></tr>`; }).join('') || emptyRow(6, 'No appraisals in this cycle')}
    </tbody></table></div></div>`;
}
ACT.doAppraisal = el => {
  const a = DB.appraisals.find(x => x.id === el.dataset.id), u = user(a.user), ms = metricsOf(u);
  if (!guard(canReview(a), 'complete this appraisal')) return;
  const ks = lastMonthsKeys(6).filter(k => quarterOf(k + '-01').key === a.period);
  const avgOf = k => { const v = ks.map(m => monthScores(u, m)?.[k]).filter(x => x != null); return v.length ? Math.round(sum(v) / v.length) : null; };
  openModal({ title: `Appraisal · ${esc(u.name)}`, sub: `${esc(a.label)} · ${esc(ROLES[u.role].label)} metrics`, wide: true, body: `<div class="form">
    ${a.self ? `<div class="form-note">${ico('user', 'sm')}<span><b>Self review:</b> ${esc(a.self)}</span></div>` : ''}
    <div class="appr-grid">${ms.map(([k, l]) => { const v = avgOf(k), sug = v != null ? Math.max(1, Math.min(5, Math.round(v / 20))) : 3; return `<label class="field"><span>${esc(l)} <small class="muted">· quarter score ${v ?? '—'}</small></span><select class="select" name="r_${k}">${[5, 4, 3, 2, 1].map(n => `<option value="${n}" ${n === sug ? 'selected' : ''}>${'★'.repeat(n)}${'☆'.repeat(5 - n)} · ${['Needs improvement', 'Below expectations', 'Meets expectations', 'Exceeds expectations', 'Outstanding'][n - 1]}</option>`).join('')}</select></label>`; }).join('')}</div>
    <div class="row2">${fld('Strengths', 'strengths', { type: 'textarea', rows: 2, req: true })}${fld('Areas to improve', 'improve', { type: 'textarea', rows: 2, req: true })}</div>
    ${fld('Manager feedback', 'feedback', { type: 'textarea', rows: 3, req: true })}${fld('Goals for next quarter', 'goals', { type: 'textarea', rows: 2 })}</div>`,
    foot: `<button type="button" class="btn" data-act="closeModal">Cancel</button><button type="submit" class="btn primary">${ico('check', 'sm')}Complete appraisal</button>`,
    onSubmit: d => {
      const scores = {}; ms.forEach(([k]) => scores[k] = +d['r_' + k]);
      Object.assign(a, { scores, rating: Math.round(sum(Object.values(scores)) / ms.length * 10) / 10, strengths: d.strengths, improve: d.improve, feedback: d.feedback, goals: d.goals, status: 'Completed', completedAt: Date.now(), reviewer: a.reviewer || SESSION });
      notify([a.user], `Your ${a.label} appraisal is ready — rating ${a.rating} / 5. Please review and acknowledge.`, '#/performance?tab=appraisals', 'appraisal');
      logAct(`completed the ${a.label} appraisal for ${u.name}`, null, 'user'); commit(`Appraisal completed · ${a.rating} / 5`);
    } });
};
ACT.selfReview = el => {
  const a = DB.appraisals.find(x => x.id === el.dataset.id);
  openModal({ title: 'Self review', sub: `${esc(a.label)} · reviewer ${esc(userName(a.reviewer))}`, body: `<div class="form">${fld('Your achievements, challenges and support needed', 'self', { type: 'textarea', rows: 5, req: true, value: a.self })}</div>`,
    onSubmit: d => { a.self = d.self; a.status = 'Self-review submitted'; notify([a.reviewer], `${me().name} submitted a self review for ${a.label}`, '#/performance?tab=appraisals', 'appraisal'); commit('Self review submitted'); } });
};
ACT.ackAppraisal = el => { const a = DB.appraisals.find(x => x.id === el.dataset.id); a.status = 'Acknowledged'; a.ackAt = Date.now(); notify([a.reviewer], `${me().name} acknowledged their ${a.label} appraisal`, '#/performance?tab=appraisals', 'appraisal'); commit('Appraisal acknowledged'); };
function appraisalPaper(a) {
  const u = user(a.user), ms = metricsOf(u);
  return `${paperHead('Performance appraisal')}<div class="grid2"><div><div class="muted">Employee</div><b>${esc(u.name)}</b><div>${esc(u.title)}</div></div><div style="text-align:right"><div class="muted">Period</div><b>${esc(a.label)}</b><div>Reviewer: ${esc(userName(a.reviewer))}</div></div></div>
    <table><tr><th>Metric</th><th class="r">Rating</th></tr>${ms.map(([k, l]) => `<tr><td>${esc(l)}</td><td class="r">${a.scores?.[k] ? '★'.repeat(a.scores[k]) + '☆'.repeat(5 - a.scores[k]) : '—'}</td></tr>`).join('')}<tr class="tot"><td>Overall rating</td><td class="r">${a.rating ?? '—'} / 5</td></tr></table>
    ${a.self ? `<p><b>Self review.</b> ${esc(a.self)}</p>` : ''}<p><b>Strengths.</b> ${esc(a.strengths || '—')}</p><p><b>Areas to improve.</b> ${esc(a.improve || '—')}</p><p><b>Manager feedback.</b> ${esc(a.feedback || '—')}</p><p><b>Goals.</b> ${esc(a.goals || '—')}</p>
    <p class="muted">Status: ${esc(a.status)}${a.completedAt ? ` · completed ${fmtDY(iso(new Date(a.completedAt)))}` : ''}</p>`;
}
ACT.viewAppraisal = el => {
  const a = DB.appraisals.find(x => x.id === el.dataset.id);
  openModal({ title: `${esc(userName(a.user))} · ${esc(a.label)}`, sub: badge(a.status), wide: true, body: `<div class="preview-stage" style="min-height:0"><div class="paper">${appraisalPaper(a)}</div></div>`,
    foot: `<button type="button" class="btn" data-act="printAppraisal" data-id="${a.id}">${ico('print', 'sm')}Print / PDF</button><button type="button" class="btn primary" data-act="closeModal">Close</button>` });
};
ACT.printAppraisal = el => { const a = DB.appraisals.find(x => x.id === el.dataset.id); printPaper(`Appraisal ${userName(a.user)} ${a.label}`, appraisalPaper(a)); };
ACT.addFeedback = el => {
  const u = user(el.dataset.u);
  openModal({ title: `Feedback for ${esc(u.name)}`, body: `<div class="form">${fld('Type', 'kind', { opts: FEEDBACK_KINDS })}${fld('Feedback', 'text', { type: 'textarea', req: true })}</div>`,
    onSubmit: d => { (DB.feedback ||= []).unshift({ id: nid('fb'), user: u.id, by: SESSION, at: Date.now(), kind: d.kind, text: d.text }); notify([u.id], `${me().name} added ${d.kind === 'Appreciation' ? 'appreciation' : 'feedback'} for you`, `#/performance?u=${u.id}`, 'appraisal'); commit('Feedback added'); } });
};
