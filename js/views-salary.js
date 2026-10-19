/* Salary history (one revision per year, usually after the annual appraisal), bonuses, and the last appraisal.
   Salaries are financial: the Owner and Accounts (anyone with "Manage salaries & bonuses" plus financial access)
   see and change everyone's; every employee sees their own, read-only. The Admin role sees none but their own.
   Shown on Performance › employee page, a Performance › Salary & bonus tab, and the user profile. */
'use strict';

ACTIONS.splice(ACTIONS.findIndex(a => a[0] === 'View financial details'), 0, ['Manage salaries & bonuses', r => r === 'owner' || r === 'accounts']);
FIN_ACTIONS.push('Manage salaries & bonuses'); FIN_TEAM_ACTIONS.push('Manage salaries & bonuses');

/* ---------- helpers ---------- */
// own salary is shown even to roles that otherwise have money masked, so these don't go through inr()
const sal = n => '₹' + Math.round(n || 0).toLocaleString('en-IN');
const salS = n => n >= 1e5 ? `₹${(n / 1e5).toFixed(n >= 1e6 ? 1 : 2).replace(/\.?0+$/, '')} L` : sal(n);
const fyStartY = s => { const d = parseD(s); return d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1; };
const fyLabel = s => { const y = fyStartY(s); return `FY ${y}-${String(y + 1).slice(2)}`; };
const fyRange = s => { const y = fyStartY(s); return [`${y}-04-01`, `${y + 1}-03-31`]; };
const canManageSalaries = () => canMoney() && can2('Manage salaries & bonuses');
const canSeeSalary = u => !!u && (u.id === SESSION || canManageSalaries()) && u.role !== 'owner';
const canEditSalary = u => canManageSalaries() && u.id !== SESSION && u.role !== 'owner';
const revisionsOf = uid => (DB.salary || []).filter(r => r.user === uid).sort((a, b) => a.effective.localeCompare(b.effective));
const bonusesOf = uid => (DB.bonuses || []).filter(b => b.user === uid).sort((a, b) => b.date.localeCompare(a.date));
const curRev = uid => revisionsOf(uid).filter(r => r.effective <= TODAY).at(-1) || revisionsOf(uid)[0];
const lastHike = uid => revisionsOf(uid).filter(r => r.effective <= TODAY && r.reason !== 'Joining').at(-1);
const fyBonus = (uid, day = TODAY) => { const [a, b] = fyRange(day); return sum(bonusesOf(uid).filter(x => x.date >= a && x.date <= b), x => x.amount); };
const lastAppraisal = uid => appraisalsOf(uid).find(a => a.rating);
const tenure = from => { const a = parseD(from), b = parseD(TODAY); let m = (b.getFullYear() - a.getFullYear()) * 12 + b.getMonth() - a.getMonth(); if (b.getDate() < a.getDate()) m--; const y = Math.floor(m / 12); return y ? `${plural(y, 'year')}${m % 12 ? ` ${m % 12} mo` : ''}` : plural(Math.max(0, m), 'month'); };
const suggestHike = r => r == null ? [6, 8] : r >= 4.5 ? [12, 15] : r >= 4 ? [9, 12] : r >= 3.5 ? [7, 9] : r >= 3 ? [5, 7] : [0, 4];

/* ---------- sample data ---------- */
function seedSalary(db) {
  const rng = s => { let h = 2166136261; for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return () => { h += 0x6D2B79F5; let t = h; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; }; };
  const JOIN = { u2: '2017-06-12', u3: '2019-02-04', u4: '2020-07-01', u5: '2022-03-14', u6: '2018-09-10', u7: '2021-11-22', u8: '2016-04-18', u10: '2019-08-05', u11: '2023-01-09' };
  const START = { pm: 420000, engineer: 300000, supervisor: 180000, accounts: 260000, admin: 200000, sysadmin: 420000 };
  const PROMO = { u2: ['2021', 'Site Engineer', 'Project Manager'], u8: ['2020', 'Accounts Executive', 'Accounts Manager'], u6: ['2022', 'Junior Supervisor', 'Site Supervisor'] };
  const r1000 = n => Math.round(n / 1000) * 1000;
  db.salary = []; db.bonuses = []; let sn = 1, bn = 1;
  db.users.filter(u => u.role !== 'owner' && u.status === 'Active').forEach(u => {
    const R = rng(u.id), join = JOIN[u.id] || '2021-06-01';
    u.joined ||= join;
    let ctc = r1000((START[u.role] || 240000) * (.9 + R() * .2));
    db.salary.push({ id: 'sv' + sn++, user: u.id, effective: join, ctc, prev: null, pct: null, reason: 'Joining', rating: null, by: 'u1', note: `Joined as ${PROMO[u.id]?.[1] || u.title}` });
    const apr = db.appraisals.filter(a => a.user === u.id && a.rating), recent = apr.length ? sum(apr, a => a.rating) / apr.length : null;
    for (let y = fyStartY(join) + 1; `${y}-04-01` <= TODAY; y++) {
      if (parseD(`${y}-04-01`) - parseD(join) < 270 * 864e5) continue;   // first hike after at least 9 months
      const last = `${y + 1}-04-01` > TODAY, rating = Math.round((last && recent ? recent : 3.1 + R() * 1.6) * 10) / 10;
      const promo = PROMO[u.id]?.[0] === String(y);
      const pct = promo ? 18 + Math.round(R() * 4) : Math.max(4, Math.min(14, Math.round(2 + (rating - 3) * 5 + R() * 2)));
      const prev = ctc; ctc = r1000(ctc * (1 + pct / 100));
      db.salary.push({ id: 'sv' + sn++, user: u.id, effective: `${y}-04-01`, ctc, prev, pct: Math.round((ctc / prev - 1) * 1000) / 10, reason: promo ? 'Promotion' : 'Annual appraisal', rating, by: 'u1',
        note: promo ? `Promoted to ${PROMO[u.id][2]}` : rating >= 4.3 ? 'Top rating in the annual review' : '' });
      // performance bonus in May for a strong year
      if (rating >= 4.2 && `${y}-05-10` <= TODAY) db.bonuses.push({ id: 'bn' + bn++, user: u.id, date: `${y}-05-10`, type: 'Performance bonus', amount: r1000(prev * (.05 + R() * .03)), note: `For ${fyLabel(`${y - 1}-04-01`)} · rating ${rating}`, by: 'u1' });
    }
    // Diwali bonus every year, from the first Diwali after joining
    for (let y = +join.slice(0, 4); y <= +TODAY.slice(0, 4); y++) {
      const day = `${y}-${['2016', '2018', '2021', '2024'].includes(String(y)) ? '10-28' : '11-03'}`;
      if (day < join || day > TODAY) continue;
      const c = [...db.salary].reverse().find(s => s.user === u.id && s.effective <= day)?.ctc || ctc;
      db.bonuses.push({ id: 'bn' + bn++, user: u.id, date: day, type: 'Festival bonus (Diwali)', amount: r1000(c / 12 * (day.slice(0, 4) - join.slice(0, 4) >= 1 ? 1 : .5)), note: '', by: 'u1' });
    }
  });
  db.bonuses.push({ id: 'bn' + bn++, user: 'u4', date: shiftD(TODAY, -90), type: 'Project completion bonus', amount: 25000, note: 'Raghavan Residence handed over 2 weeks ahead of schedule', by: 'u1' });
}
LOAD_HOOKS.push(() => { if (!DB.salary) seedSalary(DB); });

/* ---------- blocks ---------- */
function compStats(u) {
  const c = curRev(u.id), h = lastHike(u.id), fy = fyLabel(TODAY);
  if (!c) return '';
  return `<div class="comp-stats">
    <div><span>Current CTC</span><b>${salS(c.ctc)}<small> / year</small></b><em>${sal(c.ctc)}</em></div>
    <div><span>Monthly gross</span><b>${sal(c.ctc / 12)}</b><em>effective ${fmtDY(c.effective)}</em></div>
    <div><span>Last increment</span><b class="${h ? 'up' : ''}">${h ? `+${h.pct}%` : '—'}</b><em>${h ? `${esc(h.reason)} · ${fmtDY(h.effective)}` : 'No revision yet'}</em></div>
    <div><span>Bonus · ${fy}</span><b>${sal(fyBonus(u.id))}</b><em>${plural(bonusesOf(u.id).length, 'bonus', 'bonuses')} in total</em></div>
    <div><span>With the company</span><b>${u.joined ? tenure(u.joined) : '—'}</b><em>${u.joined ? `joined ${fmtDY(u.joined)}` : ''}</em></div></div>`;
}
function compChart(u) {
  // the salary in force for each financial year since joining
  const revs = revisionsOf(u.id); if (!revs.length) return '';
  const ys = []; for (let y = fyStartY(revs[0].effective); y <= fyStartY(TODAY); y++) ys.push(y);
  const pts = ys.map(y => { const end = `${y + 1}-03-31` < TODAY ? `${y + 1}-03-31` : TODAY, r = [...revs].reverse().find(x => x.effective <= end), h = revs.find(x => fyStartY(x.effective) === y && x.reason !== 'Joining');
    return { y, ctc: r?.ctc || 0, h, b: sum(bonusesOf(u.id).filter(x => fyStartY(x.date) === y), x => x.amount) }; });
  const max = Math.max(...pts.map(p => p.ctc + p.b)) || 1;
  return `<div class="comp-chart" role="img" aria-label="Salary by financial year">${pts.map(p => `<div class="cc-col" title="${esc(`FY ${p.y}-${String(p.y + 1).slice(2)} · CTC ${sal(p.ctc)}${p.b ? ` · bonus ${sal(p.b)}` : ''}`)}">
      <span class="cc-tag ${p.h?.reason === 'Promotion' ? 'promo' : ''}">${p.h ? `+${p.h.pct}%` : ''}</span>
      <div class="cc-bar"><i class="b" style="height:${p.b / max * 100}%"></i><i class="c" style="height:${p.ctc / max * 100}%"></i></div>
      <b>${salS(p.ctc)}</b><small>${`${String(p.y).slice(2)}-${String(p.y + 1).slice(2)}`}</small></div>`).join('')}</div>
    <div class="geo-legend" style="margin-top:4px"><span><i style="--c:var(--brand)"></i>CTC for the year</span><span><i style="--c:#E8A33A"></i>Bonus paid</span><span><i style="--c:var(--ok)"></i>Increment · <b style="color:#7A3FB0">promotion</b></span></div>`;
}
function compHistory(u, edit) {
  const revs = revisionsOf(u.id).slice().reverse(), bs = bonusesOf(u.id);
  return `<div class="comp-tables"><div><h3>Salary history</h3><div class="table-wrap"><table class="t"><thead><tr><th>Year</th><th>Effective</th><th class="r">CTC / year</th><th class="r hide-sm">Monthly</th><th class="r">Change</th><th class="hide-sm">Reason</th><th class="r hide-sm">Rating</th><th></th></tr></thead><tbody>
      ${revs.map(r => `<tr><td class="nowrap strong">${fyLabel(r.effective).replace('FY ', '')}</td><td class="nowrap">${fmtDY(r.effective)}${r.effective > TODAY ? ' <span class="tag">Upcoming</span>' : ''}</td><td class="r num strong">${sal(r.ctc)}</td><td class="r num hide-sm">${sal(r.ctc / 12)}</td>
        <td class="r nowrap">${r.pct != null ? `<span class="chg ${r.pct >= 0 ? 'up' : 'down'}">${r.pct >= 0 ? '+' : ''}${r.pct}%</span><span class="sub">${r.prev ? `${r.ctc >= r.prev ? '+' : '−'}${sal(Math.abs(r.ctc - r.prev))}` : ''}</span>` : '<span class="muted">—</span>'}</td>
        <td class="hide-sm">${r.reason === 'Promotion' ? '<span class="badge info">Promotion</span>' : esc(r.reason)}${r.note ? `<span class="sub">${esc(r.note)}</span>` : ''}</td><td class="r hide-sm nowrap">${r.rating ? `${r.rating} <span class="muted">/ 5</span>` : '—'}</td>
        <td class="r"><button class="iconbtn" data-act="salLetter" data-id="${r.id}" aria-label="Print letter" title="${r.reason === 'Joining' ? 'Offer summary' : 'Revision letter'}">${ico('print', 'sm')}</button></td></tr>`).join('') || emptyRow(8, 'No salary recorded', edit ? 'Use “Revise salary” to set the starting salary.' : '')}
    </tbody></table></div></div>
    <div><h3>Bonuses</h3><div class="table-wrap"><table class="t"><thead><tr><th>Date</th><th>Type</th><th class="r">Amount</th>${edit ? '<th></th>' : ''}</tr></thead><tbody>
      ${bs.map(b => `<tr><td class="nowrap">${fmtDY(b.date)}<span class="sub">${fyLabel(b.date)}</span></td><td>${esc(b.type)}${b.note ? `<span class="sub">${esc(b.note)}</span>` : ''}</td><td class="r num strong">${sal(b.amount)}</td>${edit ? `<td class="r"><button class="iconbtn" data-act="delBonus" data-id="${b.id}" aria-label="Remove bonus">${ico('trash', 'sm')}</button></td>` : ''}</tr>`).join('') || emptyRow(edit ? 4 : 3, 'No bonuses yet')}
      ${bs.length ? `<tr class="tot"><td colspan="2">Total paid</td><td class="r num strong">${sal(sum(bs, b => b.amount))}</td>${edit ? '<td></td>' : ''}</tr>` : ''}
    </tbody></table></div></div></div>`;
}
function compCard(u) {
  if (!canSeeSalary(u)) return '';
  const edit = canEditSalary(u);
  return `<div class="card comp"><div class="card-head"><h2>${ico('rupee', 'sm')} Salary &amp; bonus</h2><span class="sub">${ico('lock', 'sm')} Confidential${u.id === SESSION ? ' · only you, the Owner and Accounts can see this' : ''}</span>
      ${edit ? `<div class="acts">${btn('Add bonus', 'addBonus', { icon: 'plus', cls: 'sm', data: `data-u="${u.id}"` })}${btn('Revise salary', 'reviseSalary', { icon: 'trend', cls: 'sm primary', data: `data-u="${u.id}"` })}</div>` : ''}</div>
    <div class="card-body">${compStats(u)}${compChart(u)}${compHistory(u, edit)}</div></div>`;
}
function lastApprCard(u) {
  const a = lastAppraisal(u.id); if (!a) return '';
  const ms = metricsOf(u), h = canSeeSalary(u) && revisionsOf(u.id).find(r => r.effective > iso(new Date(a.completedAt || 0)) && r.reason !== 'Joining');
  return `<div class="card la"><div class="card-head"><h2>${ico('star', 'sm')} Last appraisal</h2><span class="sub">${esc(a.label)} · ${badge(a.status, a.status === 'Acknowledged' ? 'ok' : 'info')}</span><div class="acts"><button class="btn sm" data-act="viewAppraisal" data-id="${a.id}">Full appraisal</button></div></div>
    <div class="card-body la-body">
      <div class="la-score"><b>${a.rating}</b><span>out of 5</span>${stars(a.rating)}<small>${esc(['Needs improvement', 'Below expectations', 'Meets expectations', 'Exceeds expectations', 'Outstanding'][Math.max(0, Math.min(4, Math.round(a.rating) - 1))])}</small></div>
      <div class="la-main">
        <div class="la-meta"><span>${ico('user', 'sm')}Reviewer <b>${esc(userName(a.reviewer))}</b></span><span>${ico('cal', 'sm')}Completed <b>${a.completedAt ? fmtDY(iso(new Date(a.completedAt))) : '—'}</b></span>${h ? `<span>${ico('trend', 'sm')}Increment <b class="up">+${h.pct}%</b> from ${fmtDY(h.effective)}</span>` : ''}</div>
        <div class="la-ms">${ms.map(([k, l]) => { const v = a.scores?.[k] || 0; return `<div><span>${esc(l)}</span><i class="la-dots">${[1, 2, 3, 4, 5].map(n => `<em class="${n <= v ? 'on' : ''}"></em>`).join('')}</i><b>${v || '—'}</b></div>`; }).join('')}</div>
        <div class="la-notes"><div><h4>Strengths</h4><p>${esc(a.strengths || '—')}</p></div><div><h4>Areas to improve</h4><p>${esc(a.improve || '—')}</p></div><div><h4>Goals</h4><p>${esc(a.goals || '—')}</p></div></div>
      </div></div></div>`;
}

/* ---------- Performance › Salary & bonus tab ---------- */
function salaryTab() {
  const people = DB.users.filter(u => u.role !== 'owner' && u.status === 'Active'), fy = fyLabel(TODAY), [fa] = fyRange(TODAY);
  const rows = people.map(u => ({ u, c: curRev(u.id), h: lastHike(u.id), b: fyBonus(u.id), a: lastAppraisal(u.id) }));
  const payroll = sum(rows, r => r.c?.ctc || 0), revised = rows.filter(r => r.h && r.h.effective >= fa), avg = revised.length ? sum(revised, r => r.h.pct) / revised.length : 0;
  const due = rows.filter(r => !r.h || r.h.effective < fa);
  return `<div class="kpis">
      <div class="kpi"><div class="l">${ico('rupee', 'sm')}Annual payroll (CTC)</div><div class="v">${salS(payroll)}</div><div class="s">${sal(payroll / 12)} a month · ${plural(people.length, 'employee')}</div></div>
      <div class="kpi"><div class="l">${ico('trend', 'sm')}Average increment · ${fy}</div><div class="v">${avg ? `+${avg.toFixed(1)}%` : '—'}</div><div class="s">${plural(revised.length, 'revision')} this year</div></div>
      <div class="kpi"><div class="l">${ico('star', 'sm')}Bonuses paid · ${fy}</div><div class="v">${salS(sum(rows, r => r.b))}</div><div class="s">${rows.filter(r => r.b).length} employees</div></div>
      <div class="kpi"><div class="l">${ico('clock', 'sm')}Revision due</div><div class="v">${due.length}</div><div class="s">${due.length ? esc(due.slice(0, 2).map(r => r.u.name.split(' ')[0]).join(', ')) + (due.length > 2 ? '…' : '') : 'everyone revised this year'}</div></div></div>
    <div class="card"><div class="card-head"><h2>Salary &amp; bonus</h2><span class="sub">${ico('lock', 'sm')} Confidential · Owner and Accounts</span></div>
      <div class="table-wrap" style="margin-top:12px"><table class="t stack-sm"><thead><tr><th>Employee</th><th class="hide-sm">Joined</th><th class="r">CTC / year</th><th class="r hide-sm">Monthly</th><th class="r">Last increment</th><th class="r hide-sm">Bonus · ${fy}</th><th class="hide-sm">Last appraisal</th><th class="r"></th></tr></thead><tbody>
      ${rows.map(({ u, c, h, b, a }) => `<tr class="click" data-act="openComp" data-u="${u.id}"><td class="full">${personCell(u)}</td><td class="hide-sm nowrap">${u.joined ? fmtDY(u.joined) : '—'}<span class="sub">${u.joined ? tenure(u.joined) : ''}</span></td>
        <td class="r num strong">${c ? sal(c.ctc) : '<span class="muted">Not set</span>'}</td><td class="r num hide-sm">${c ? sal(c.ctc / 12) : '—'}</td>
        <td class="r nowrap">${h ? `<span class="chg up">+${h.pct}%</span><span class="sub">${fmtDY(h.effective)}</span>` : '—'}</td><td class="r num hide-sm">${b ? sal(b) : '—'}</td>
        <td class="hide-sm nowrap">${a ? `${stars(a.rating)} ${a.rating}<span class="sub">${esc(a.label)}</span>` : '<span class="muted">—</span>'}</td>
        <td class="r nowrap">${canEditSalary(u) ? `<button class="btn xs" data-act="addBonus" data-u="${u.id}">Bonus</button> <button class="btn xs primary" data-act="reviseSalary" data-u="${u.id}">Revise</button>` : ''}</td></tr>`).join('')}
      </tbody></table></div></div>`;
}
function openComp(uid) {
  const u = user(uid); if (!canSeeSalary(u)) return;
  openDrawer(esc(u.name), `${esc(u.title)} · salary, bonus &amp; appraisal`, `<div class="comp-drawer">${compCard(u)}${lastApprCard(u)}</div>`,
    `${PERMS[role()]?.performance !== 'none' && teamScope().some(x => x.id === u.id) ? `<a class="btn left" href="#/performance?u=${u.id}" data-act="closeDrawer">Performance page</a>` : ''}<button class="btn primary" data-act="closeDrawer">Done</button>`);
  $('#drawer').classList.add('wide');
}
ACT.openComp = el => openComp(el.dataset.u);
$('#drawer').addEventListener('close', () => $('#drawer').classList.remove('wide'));

/* ---------- revise salary / add bonus ---------- */
ACT.reviseSalary = el => {
  const u = user(el.dataset.u); if (!guard(canEditSalary(u), 'revise this salary')) return;
  const c = curRev(u.id), a = lastAppraisal(u.id), [lo, hi] = suggestHike(a?.rating), [fa] = fyRange(TODAY);
  const eff = !lastHike(u.id) || lastHike(u.id).effective < fa ? (fa <= TODAY ? TODAY : fa) : `${fyStartY(TODAY) + 1}-04-01`;
  const start = c ? c.ctc : 0;
  openModal({ title: c ? `Revise salary · ${esc(u.name)}` : `Set salary · ${esc(u.name)}`, sub: `${esc(u.title)}${u.joined ? ` · joined ${fmtDY(u.joined)}` : ''}`, wide: true, body: `<div class="form">
    ${c ? `<div class="rv-now"><div><span>Current CTC</span><b>${sal(c.ctc)}</b><small>${sal(c.ctc / 12)} a month · since ${fmtDY(c.effective)}</small></div>
      <div><span>Last appraisal</span><b>${a ? `${a.rating} / 5` : '—'}</b><small>${a ? `${esc(a.label)} · suggested increment ${lo}–${hi}%` : 'No appraisal yet'}</small></div></div>` : ''}
    <div class="row3">${fld('Effective from', 'effective', { type: 'date', req: true, value: eff })}
      ${c ? `<label class="field"><span>Increment % <em>*</em></span><input class="input" type="number" name="pct" step="0.1" value="${Math.round((lo + hi) / 2)}" required min="-50" id="rvPct"></label>` : ''}
      <label class="field"><span>New CTC per year (₹) <em>*</em></span><input class="input" type="number" name="ctc" step="1000" min="1" required value="${c ? Math.round(start * (1 + Math.round((lo + hi) / 2) / 100) / 1000) * 1000 : ''}" id="rvCtc"></label></div>
    <div class="rv-prev" id="rvPrev"></div>
    <div class="row2">${fld('Reason', 'reason', { opts: c ? REVISION_REASONS : ['Joining', ...REVISION_REASONS], value: c ? 'Annual appraisal' : 'Joining' })}${fld('New job title', 'title', { value: '', ph: `Keep “${u.title}”` , hint: 'Only for a promotion or role change' })}</div>
    ${fld('Note', 'note', { type: 'textarea', rows: 2, ph: 'Shown on the revision letter (optional)' })}</div>`,
    foot: `<button type="button" class="btn" data-act="closeModal">Cancel</button><button type="submit" class="btn primary">${ico('check', 'sm')}Save revision</button>`,
    onOpen: m => {
      const p = $('#rvPct', m), n = $('#rvCtc', m);
      const show = () => { const v = +n.value || 0; $('#rvPrev').innerHTML = v ? `<span>${c ? `${sal(start / 12)} → ` : ''}<b>${sal(v / 12)}</b> a month</span>${c ? `<span class="chg ${v >= start ? 'up' : 'down'}">${v >= start ? '+' : '−'}${sal(Math.abs(v - start))} a year</span>` : ''}` : ''; };
      p?.addEventListener('input', () => { n.value = Math.round(start * (1 + (+p.value || 0) / 100) / 1000) * 1000; show(); });
      n.addEventListener('input', () => { if (p && start) p.value = Math.round((+n.value / start - 1) * 1000) / 10; show(); });
      show();
    },
    onSubmit: d => {
      const ctc = Math.round(+d.ctc);
      if (!(ctc > 0)) { toast('Enter the new CTC', 'lock'); return false; }
      if (revisionsOf(u.id).some(r => r.effective === d.effective)) { toast('There is already a revision on that date', 'lock'); return false; }
      const prev = [...revisionsOf(u.id)].reverse().find(r => r.effective < d.effective)?.ctc ?? null;
      DB.salary.push({ id: nid('sv'), user: u.id, effective: d.effective, ctc, prev, pct: prev ? Math.round((ctc / prev - 1) * 1000) / 10 : null, reason: d.reason, rating: a?.rating ?? null, by: SESSION, note: d.note || (d.title ? `Now ${d.title}` : ''), at: Date.now() });
      if (d.title) u.title = d.title;
      if (d.reason === 'Joining' && !u.joined) u.joined = d.effective;
      notify([u.id], `Your salary has been revised from ${fmtDY(d.effective)}. See Performance › Salary & bonus.`, `#/performance?u=${u.id}`, 'appraisal');
      logAct(`recorded a salary revision for ${u.name}`, null, 'user'); commit(`Salary revised for ${u.name}`);
      if ($('#drawer').open) openComp(u.id);
    } });
};
ACT.addBonus = el => {
  const u = user(el.dataset.u); if (!guard(canEditSalary(u), 'add a bonus')) return;
  const c = curRev(u.id), m1 = c ? Math.round(c.ctc / 12 / 500) * 500 : 0;
  openModal({ title: `Add bonus · ${esc(u.name)}`, sub: c ? `CTC ${sal(c.ctc)} · ${sal(c.ctc / 12)} a month` : '', body: `<div class="form">
    <div class="row2">${fld('Bonus type', 'type', { opts: BONUS_TYPES, req: true })}${fld('Paid on', 'date', { type: 'date', req: true, value: TODAY })}</div>
    <label class="field"><span>Amount (₹) <em>*</em></span><input class="input" type="number" name="amount" min="1" step="100" required id="bnAmt">
      ${c ? `<div class="pick-acts" style="margin-top:8px">${[[.5, '½ month'], [1, '1 month'], [.05 * 12, '5% of CTC']].map(([k, l]) => `<button type="button" class="btn xs" data-bn="${Math.round(m1 * k / 100) * 100}">${l} · ${sal(Math.round(m1 * k / 100) * 100)}</button>`).join('')}</div>` : ''}</label>
    ${fld('Note', 'note', { ph: 'e.g. For FY 2025-26 performance' })}</div>`,
    foot: `<button type="button" class="btn" data-act="closeModal">Cancel</button><button type="submit" class="btn primary">${ico('check', 'sm')}Add bonus</button>`,
    onOpen: m => m.addEventListener('click', e => { const b = e.target.closest('[data-bn]'); if (b) $('#bnAmt').value = b.dataset.bn; }),
    onSubmit: d => {
      (DB.bonuses ||= []).push({ id: nid('bn'), user: u.id, date: d.date, type: d.type, amount: Math.round(+d.amount), note: d.note, by: SESSION, at: Date.now() });
      notify([u.id], `A ${d.type.toLowerCase()} has been added for you.`, `#/performance?u=${u.id}`, 'appraisal');
      logAct(`added a ${d.type.toLowerCase()} for ${u.name}`, null, 'user'); commit(`Bonus added for ${u.name}`);
      if ($('#drawer').open) openComp(u.id);
    } });
};
ACT.delBonus = el => {
  const b = DB.bonuses.find(x => x.id === el.dataset.id), u = user(b.user); if (!guard(canEditSalary(u), 'remove this bonus')) return;
  confirmBox('Remove bonus?', `${esc(b.type)} of ${sal(b.amount)} paid on ${fmtDY(b.date)} will be removed from ${esc(u.name)}’s record.`, 'Remove', () => {
    DB.bonuses = DB.bonuses.filter(x => x !== b); logAct(`removed a bonus entry for ${u.name}`, null, 'user'); commit('Bonus removed');
    if ($('#drawer').open) setTimeout(() => openComp(u.id), 40);
  }, true);
};
function salLetter(r) {
  const u = user(r.user), join = r.reason === 'Joining';
  return `${paperHead(join ? 'Salary on joining' : 'Salary revision letter')}<p class="muted">${fmtLong(r.effective)}</p><p>Dear <b>${esc(u.name)}</b>,</p>
    <p>${join ? `Welcome to Scale Space Builders. Your compensation on joining as ${esc(u.title)} is set out below.` : `Further to your ${r.rating ? `appraisal (overall rating ${r.rating} / 5)` : 'review'}, we are pleased to revise your compensation with effect from <b>${fmtLong(r.effective)}</b>.`}</p>
    <table><tr><th>Component</th>${r.prev ? '<th class="r">Previous</th>' : ''}<th class="r">${join ? 'Amount' : 'Revised'}</th></tr>
      <tr><td>Cost to company (per year)</td>${r.prev ? `<td class="r">${sal(r.prev)}</td>` : ''}<td class="r">${sal(r.ctc)}</td></tr>
      <tr><td>Gross salary (per month)</td>${r.prev ? `<td class="r">${sal(r.prev / 12)}</td>` : ''}<td class="r">${sal(r.ctc / 12)}</td></tr>
      ${r.pct != null ? `<tr class="tot"><td>Increment</td><td class="r" colspan="${r.prev ? 2 : 1}">+${r.pct}%</td></tr>` : ''}</table>
    ${r.note ? `<p>${esc(r.note)}.</p>` : ''}<p>All other terms of your employment remain unchanged. This letter is confidential.</p>
    <div class="grid2" style="margin-top:28px"><div>Accepted by<br><br><span class="muted">${esc(u.name)}</span></div><div style="text-align:right">For Scale Space Builders<br><br><span class="muted">${esc(userName(r.by))}, authorised signatory</span></div></div>`;
}
ACT.salLetter = el => {
  const r = DB.salary.find(x => x.id === el.dataset.id), u = user(r.user); if (!canSeeSalary(u)) return;
  printPaper(`${r.reason === 'Joining' ? 'Salary' : 'Revision letter'} ${u.name} ${r.effective}`, salLetter(r));
};
