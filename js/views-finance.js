/* Payments & Expenses */
'use strict';

VIEWS.finance = () => {
  const tab = ROUTE.q.tab || 'overview';
  const T = [['overview', 'Overview'], ['receipts', 'Client payments'], ['salaries', 'Salaries & advances'], ['bills', 'Contractor bills', DB.contractorBills.filter(b => myProjectIds().has(b.project) && !['Paid', 'Cancelled'].includes(billStatus(b))).length], ['expenses', 'Site expenses']];
  const acts = { overview: '', receipts: can2('Record client payments') ? btn('Record payment', 'newPayment', { icon: 'plus', cls: 'primary' }) : '', salaries: can2('Pay salaries & advances') ? btn('Give advance', 'newAdvance', { icon: 'plus', cls: 'primary' }) : '', bills: can('finance') ? btn('Add bill', 'newBill', { icon: 'plus', cls: 'primary' }) : '', expenses: can2('Add site expenses') ? btn('Add expense', 'newExpense', { icon: 'plus', cls: 'primary' }) : '' };
  const body = { overview: finOverview, receipts: finReceipts, salaries: finSalaries, bills: finBills, expenses: finExpenses }[tab]();
  return `${pageHead('Payments & Expenses', 'Client receipts, worker salaries, contractor bills and site spending.', acts[tab])}
    ${!can('finance') ? `<div class="banner">${ico('eye')}<span>You have <b>view-only</b> access to finance${can2('Add site expenses') ? ' — you can still add site expenses' : ''}.</span></div>` : ''}
    ${tabs(T, tab)}${body}`;
};
function finOverview() {
  const ps = myProjects();
  const rows = ps.map(p => ({ p, f: projFinance(p.id) }));
  const T = k => sum(rows, r => r.f[k]);
  const ex = DB.expenses.filter(e => myProjectIds().has(e.project));
  return `<div class="kpis">
      <div class="kpi"><div class="l">Contract value</div><div class="v">${inrS(T('value'))}</div><div class="s">${plural(ps.length, 'project')}</div></div>
      <div class="kpi"><div class="l">Received from clients</div><div class="v">${inrS(T('received'))}</div><div class="s">of ${inrS(T('billed'))} billed</div></div>
      <div class="kpi"><div class="l">Outstanding</div><div class="v">${inrS(T('outstanding'))}</div><div class="s">billed, not yet received</div></div>
      <div class="kpi"><div class="l">Total spent</div><div class="v">${inrS(T('spent'))}</div><div class="s">${inrS(T('contractorDue'))} contractor dues</div></div></div>
    <div class="card"><div class="card-head"><h2>Project-wise summary</h2><span class="sub">Spent = site expenses + labour + contractor payments</span></div>
      <div class="table-wrap" style="margin-top:12px"><table class="t"><thead><tr><th>Project</th><th class="r">Contract</th><th class="r">Billed</th><th class="r">Received</th><th class="r">Outstanding</th><th class="r">Spent</th><th class="r">Cash position</th><th style="min-width:130px">Collected</th></tr></thead>
      <tbody>${rows.map(({ p, f }) => `<tr class="click" data-act="go" data-href="#/projects/${p.id}?tab=finance"><td class="strong">${esc(p.name)}<span class="sub">${p.code}</span></td><td class="r">${inrS(f.value)}</td><td class="r">${inrS(f.billed)}</td><td class="r">${inrS(f.received)}</td><td class="r">${f.outstanding > 0 ? inrS(f.outstanding) : '—'}</td><td class="r">${inrS(f.spent)}</td><td class="r" style="color:var(${f.balance < 0 ? '--bad' : '--ink'})">${inrS(f.balance)}</td><td>${meter(Math.round(f.received / f.value * 100))}</td></tr>`).join('')}</tbody>
      <tfoot><tr><td>Total</td><td class="r">${inrS(T('value'))}</td><td class="r">${inrS(T('billed'))}</td><td class="r">${inrS(T('received'))}</td><td class="r">${inrS(T('outstanding'))}</td><td class="r">${inrS(T('spent'))}</td><td class="r">${inrS(T('balance'))}</td><td></td></tr></tfoot></table></div></div>
    <div class="grid g2">
      <div class="card"><div class="card-head"><h2>Where the money goes</h2><span class="sub">All projects, to date</span></div><div class="card-body">${hBars([{ label: 'Materials & site costs', value: T('expenses') }, { label: 'Labour wages', value: T('labour') }, { label: 'Contractor payments', value: T('contractor') }])}</div></div>
      <div class="card"><div class="card-head"><h2>Outstanding by project</h2></div><div class="card-body">${hBars(rows.filter(r => r.f.outstanding > 0).sort((a, b) => b.f.outstanding - a.f.outstanding).map(r => ({ label: r.p.name, value: r.f.outstanding })))}</div></div>
    </div>`;
}
function projectFinanceTab(p) {
  const f = projFinance(p.id);
  const sched = DB.billing.filter(b => b.project === p.id);
  const pays = DB.payments.filter(x => x.project === p.id);
  const recvFor = label => sum(pays.filter(x => x.against === label), x => x.amount);
  return `<div class="grid g-main">
    <div class="card"><div class="card-head"><h2>Billing schedule</h2><span class="sub">Stage-linked client payments</span>${can2('Record client payments') ? btn('Record payment', 'newPayment', { cls: 'sm', data: `data-p="${p.id}"` }) : ''}</div>
      <div class="table-wrap" style="margin-top:12px"><table class="t stack-sm"><thead><tr><th>Stage</th><th class="r">Amount</th><th class="r">Received</th><th>Status</th>${can('finance') ? '<th></th>' : ''}</tr></thead><tbody>
      ${sched.map(b => { const r = recvFor(b.label); const st = !b.billed ? 'Not billed' : r >= b.amount ? 'Paid' : r > 0 ? 'Part paid' : 'Pending'; return `<tr><td class="strong full">${esc(b.label)}<span class="sub">${b.pct}% · ${b.billed ? 'billed' : 'due'} ${fmtD(b.due)}</span></td><td class="r">${inr(b.amount)}</td><td class="r">${r ? inr(r) : '—'}</td><td>${badge(st, st === 'Not billed' ? '' : undefined)}</td>${can('finance') ? `<td class="r">${!b.billed ? `<button class="btn xs" data-act="raiseBill" data-id="${b.id}">Raise invoice</button>` : (() => { const inv = DB.invoices.find(i => i.billing === b.id && i.status === 'Issued'); return inv ? `<button class="btn xs" data-act="openInv" data-kind="client" data-id="${inv.id}">${esc(inv.no)}</button>` : ''; })()}</td>` : ''}</tr>`; }).join('')}
      </tbody></table></div></div>
    <div class="card"><div class="card-head"><h2>Summary</h2></div><div class="card-body">
      ${[['Contract value', f.value], ['Billed to date', f.billed], ['Received', f.received], ['Outstanding', f.outstanding], ['Site expenses', f.expenses], ['Labour wages', f.labour], ['Contractor payments', f.contractor], ['Contractor dues', f.contractorDue]].map(([l, v]) => `<div class="kv-row"><span>${l}</span><b>${inr(v)}</b></div>`).join('')}
      <div class="kv-row"><span><b style="font-weight:600">Cash position</b></span><b style="color:var(${f.balance < 0 ? '--bad' : '--ok'})">${inr(f.balance)}</b></div></div></div></div>
    <div class="card"><div class="card-head"><h2>Payments received</h2><span class="sub">${plural(pays.length, 'payment')} · ${inr(sum(pays, x => x.amount))}</span></div>
      <div class="table-wrap" style="margin-top:12px"><table class="t stack-sm"><thead><tr><th>Date</th><th>Against</th><th>Mode</th><th class="r">Amount</th><th class="r">Receipt</th></tr></thead><tbody>
      ${pays.slice().sort((a, b) => b.date.localeCompare(a.date)).map(x => `<tr class="click" data-act="openReceipt" data-id="${x.id}"><td class="nowrap">${fmtDY(x.date)}</td><td class="strong full">${esc(x.against)}</td><td class="hide-sm">${esc(x.mode)}<span class="sub">${esc(x.ref)}</span></td><td class="r strong">${inr(x.amount)}</td><td class="r"><span class="btn xs">${ico('receipt', 'sm')}${esc(x.rno || 'Receipt')}</span>${x.sent?.length ? '<span class="sub" style="color:var(--ok)">sent to client</span>' : ''}</td></tr>`).join('') || emptyRow(5, 'No payments yet')}
      </tbody></table></div></div>
    <div class="card"><div class="card-head"><h2>Recent site expenses</h2><a class="btn ghost sm" href="#/finance?tab=expenses&p=${p.id}">All expenses</a></div>${expenseTable(DB.expenses.filter(e => e.project === p.id).slice(0, 6), false)}</div>`;
}
ACT.raiseBill = el => {
  if (!guard(can('finance'), 'raise invoices')) return;
  const b = DB.billing.find(x => x.id === el.dataset.id), p = proj(b.project);
  confirmBox('Raise invoice?', `Invoice <b>${esc(b.label)}</b> for <b>${inr(b.amount)}</b> (incl. 18% GST) to ${esc(p.client.name)}, due in 15 days. It appears in Invoices & Bills.`, 'Raise invoice', () => {
    let inv = DB.invoices.find(i => i.billing === b.id && i.status === 'Draft');
    if (!inv) { inv = { id: nid('iv'), no: null, kind: 'client', project: b.project, billing: b.id, label: b.label, status: 'Draft', gst: 18, lines: [{ desc: `${b.label} — ${b.pct}% of contract value (${p.code})`, qty: 1, unit: 'LS', rate: Math.round(b.amount / 1.18 * 100) / 100 }], notes: 'Stage payment as per the construction agreement.', by: SESSION }; DB.invoices.unshift(inv); }
    Object.assign(inv, { date: TODAY, due: shiftD(TODAY, 15) });
    issueInvoice(inv); commit(`Invoice ${inv.no} raised`);
  });
};

function finReceipts() {
  const { p = '', mode = '' } = ROUTE.q;
  const ids = myProjectIds();
  const list = DB.payments.filter(x => ids.has(x.project) && (!p || x.project === p) && (!mode || x.mode === mode)).sort((a, b) => b.date.localeCompare(a.date));
  const ps = myProjects().filter(x => !p || x.id === p);
  const out = ps.map(x => ({ p: x, f: projFinance(x.id) })).filter(r => r.f.outstanding > 0).sort((a, b) => b.f.outstanding - a.f.outstanding);
  return `<div class="toolbar">${projSelect(p)}<select class="select" data-change="setQ" data-k="mode" aria-label="Mode"><option value="">All modes</option>${PAY_MODES_IN.map(m => `<option ${m === mode ? 'selected' : ''}>${m}</option>`).join('')}</select></div>
    <div class="grid g-main">
      <div class="card"><div class="card-head"><h2>Payments received</h2><span class="sub">${plural(list.length, 'payment')} · ${inrS(sum(list, x => x.amount))}</span></div>
        <div class="table-wrap" style="margin-top:12px"><table class="t stack-sm"><thead><tr><th>Date</th><th>Project</th><th>Against</th><th>Mode</th><th class="r">Amount</th><th class="r">Receipt</th></tr></thead><tbody>
        ${list.map(x => `<tr class="click" data-act="openReceipt" data-id="${x.id}"><td class="nowrap">${fmtDY(x.date)}</td><td class="strong full">${esc(proj(x.project).name)}</td><td class="hide-sm">${esc(x.against)}</td><td class="hide-sm">${esc(x.mode)}<span class="sub">${esc(x.ref)}</span></td><td class="r strong">${inr(x.amount)}</td><td class="r"><span class="btn xs">${ico('receipt', 'sm')}${x.sent?.length ? 'Sent' : 'Send'}</span></td></tr>`).join('') || emptyRow(6, 'No payments found')}
        </tbody></table></div></div>
      <div class="card" style="align-self:start"><div class="card-head"><h2>Outstanding</h2><span class="sub">${inrS(sum(out, r => r.f.outstanding))}</span></div>
        <ul class="list" style="margin-top:8px">${out.map(r => `<li><div class="main-t"><b>${esc(r.p.name)}</b><span>${esc(r.p.client.name)}</span></div><span class="num strong">${inrS(r.f.outstanding)}</span>${can2('Record client payments') ? `<button class="btn xs" data-act="newPayment" data-p="${r.p.id}">Record</button>` : ''}</li>`).join('') || '<li class="muted">Nothing outstanding</li>'}</ul></div>
    </div>`;
}
ACT.newPayment = el => {
  if (!guard(can2('Record client payments'), 'record client payments')) return;
  const ps = myProjects().filter(p => projFinance(p.id).outstanding > 0 || p.status !== 'Completed');
  const pid = el.dataset.p || ROUTE.q.p || ps[0]?.id;
  const billedOpts = pid => DB.billing.filter(b => b.project === pid && b.billed).map(b => { const r = sum(DB.payments.filter(x => x.project === pid && x.against === b.label), x => x.amount); return { b, due: b.amount - r }; }).filter(x => x.due > 0);
  const pre = el.dataset.against;
  const opts = pid => { const o = billedOpts(pid); return o.length ? o.map(x => `<option value="${esc(x.b.label)}" data-due="${x.due}" ${x.b.label === pre ? 'selected' : ''}>${esc(x.b.label)} — ${inr(x.due)} due</option>`).join('') : '<option value="On account">On account</option>'; };
  openModal({ title: 'Record client payment', sub: 'Log money received from a client.', body: `<div class="form">
    ${fld('Project', 'project', { opts: projOpts(ps), value: pid })}
    <label class="field"><span>Against billing stage</span><select class="select" name="against" id="payAgainst">${opts(pid)}</select></label>
    <div class="row2">${fld('Amount received (₹)', 'amount', { type: 'number', req: true, value: (billedOpts(pid).find(x => x.b.label === pre) || billedOpts(pid)[0])?.due || '', min: 1 })}${fld('Date', 'date', { type: 'date', value: TODAY })}</div>
    <div class="row2">${fld('Payment mode', 'mode', { opts: PAY_MODES_IN })}${fld('Reference / cheque no.', 'ref', { ph: 'UTR or cheque number' })}</div></div>`,
    onOpen: m => { const sel = $('#payAgainst'); const amt = $('[name=amount]', m); $('[name=project]', m).addEventListener('change', e => { sel.innerHTML = opts(e.target.value); amt.value = sel.selectedOptions[0]?.dataset.due || ''; }); sel.addEventListener('change', () => amt.value = sel.selectedOptions[0]?.dataset.due || amt.value); },
    onSubmit: d => { const x = { id: nid('cp'), project: d.project, date: d.date, amount: +d.amount, mode: d.mode, ref: d.ref || '—', against: d.against, by: SESSION, rno: nextRct(d.date) }; DB.payments.unshift(x); logAct(`recorded a client payment of ${inr(+d.amount)} (receipt ${x.rno})`, d.project, 'payment'); commit(`Payment of ${inr(+d.amount)} recorded · receipt ${x.rno}`); setTimeout(() => openReceipt(x.id, true), 80); } });
};

/* salaries: weekly payroll ending Saturday */
function weekEnds(n) { const d = parseD(TODAY); while (d.getDay() !== 6) d.setDate(d.getDate() - 1); const out = []; for (let i = 0; i < n; i++) { const e = new Date(d); e.setDate(e.getDate() - i * 7); out.push(iso(e)); } return out; }
function payrollFor(end, pfilter) {
  const start = shiftD(end, -6), ids = myProjectIds();
  const by = {};
  DB.reports.filter(r => r.status === 'Submitted' && r.date >= start && r.date <= end && ids.has(r.project) && (!pfilter || r.project === pfilter))
    .forEach(r => r.crew.forEach(c => { if (!c.wid) return; const x = by[c.wid] ||= { days: 0, gross: 0, sites: new Set() }; x.days++; x.gross += c.wage; x.sites.add(r.project); }));
  return Object.entries(by).map(([wid, x]) => { const w = worker(wid), bal = workerAdvanceBal(wid); return w && { w, days: x.days, gross: x.gross, sites: [...x.sites], bal, rec: Math.min(bal, Math.round(x.gross * .25 / 100) * 100) }; })
    .filter(Boolean).sort((a, b) => a.sites[0].localeCompare(b.sites[0]) || a.w.name.localeCompare(b.w.name));
}
function finSalaries() {
  const ends = weekEnds(4);
  const end = ROUTE.q.wk && ends.includes(ROUTE.q.wk) ? ROUTE.q.wk : ends[0];
  const p = ROUTE.q.p || '';
  let run = DB.salaryRuns.find(r => r.end === end);
  const rows = payrollFor(end, p);
  const paidMap = run?.status === 'Paid' ? null : (run?.paid || {});
  const isPaid = r => !paidMap || paidMap[r.w.id] != null;
  const ok = can2('Pay salaries & advances');
  const pending = rows.filter(r => !isPaid(r));
  const advs = DB.advances.filter(a => myProjectIds().has(worker(a.worker)?.project)).sort((a, b) => b.date.localeCompare(a.date));
  return `<div class="toolbar"><select class="select" data-change="setQ" data-k="wk" aria-label="Week">${ends.map(e => `<option value="${e}" ${e === end ? 'selected' : ''}>Week ${fmtD(shiftD(e, -6))} – ${fmtD(e)}</option>`).join('')}</select>${projSelect(p)}<span class="grow"></span>${pending.length && ok ? `<button class="btn primary" data-act="payAll" data-wk="${end}">Pay ${plural(pending.length, 'worker')} · ${inr(sum(pending, r => r.gross - r.rec))}</button>` : ''}</div>
    <div class="kpis"><div class="kpi"><div class="l">Workers paid</div><div class="v">${rows.length - pending.length}<small> / ${rows.length}</small></div></div>
      <div class="kpi"><div class="l">Gross wages</div><div class="v">${inrS(sum(rows, r => r.gross))}</div><div class="s">${num(sum(rows, r => r.days))} man-days</div></div>
      <div class="kpi"><div class="l">Advance recovery</div><div class="v">${inrS(sum(rows, r => r.rec))}</div><div class="s">deducted this week</div></div>
      <div class="kpi"><div class="l">Net payable</div><div class="v">${inrS(sum(pending, r => r.gross - r.rec))}</div><div class="s">${pending.length ? 'pending' : 'all settled'}</div></div></div>
    <div class="card"><div class="card-head"><h2>Weekly payroll</h2><span class="sub">From daily reports · ${end > TODAY ? 'week in progress' : `payday ${fmtDY(end)}`}</span></div>
      <div class="table-wrap" style="margin-top:12px"><table class="t stack-sm"><thead><tr><th>Worker</th><th>Site</th><th class="r">Days</th><th class="r">Gross</th><th class="r">Advance cut</th><th class="r">Net</th><th class="r">Status</th></tr></thead><tbody>
      ${(ROUTE.q.all ? rows : rows.slice(0, 15)).map(r => `<tr><td class="full"><div class="person">${av(r.w.name, 'sm')}<div class="nm"><b>${esc(r.w.name)}</b><span>${esc(r.w.trade)} · avg ${inr(r.gross / r.days)}/day</span></div></div></td><td class="hide-sm">${r.sites.map(x => esc(proj(x).name)).join(', ')}</td><td class="r hide-sm">${num(r.days)}</td><td class="r hide-sm">${inr(r.gross)}</td><td class="r hide-sm">${r.rec ? '− ' + inr(r.rec) : '—'}</td><td class="r strong">${inr(r.gross - r.rec)}</td>
        <td class="r">${isPaid(r) ? badge('Paid') : end > TODAY ? badge('Accruing', '') : ok ? `<button class="btn xs" data-act="payOne" data-w="${r.w.id}" data-wk="${end}">Pay</button>` : badge('Pending')}</td></tr>`).join('') || emptyRow(7, 'No daily reports for this week')}
      </tbody></table></div>${!ROUTE.q.all && rows.length > 15 ? `<div class="card-foot" style="justify-content:center"><button class="btn sm" data-act="setQ" data-k="all" data-v="1">Show all ${rows.length} workers</button></div>` : ''}</div>
    <div class="card"><div class="card-head"><h2>Advances</h2><span class="sub">${inrS(sum(advs, a => a.amount - a.recovered))} to recover</span>${ok ? btn('Give advance', 'newAdvance', { cls: 'sm' }) : ''}</div>
      <div class="table-wrap" style="margin-top:12px"><table class="t stack-sm"><thead><tr><th>Worker</th><th>Date</th><th>Reason</th><th class="r">Amount</th><th class="r">Recovered</th><th class="r">Balance</th></tr></thead><tbody>
      ${advs.map(a => { const w = worker(a.worker); return `<tr class="click" data-act="showWorker" data-id="${w.id}"><td class="strong full">${esc(w.name)}<span class="sub">${esc(proj(w.project).name)}</span></td><td class="nowrap">${fmtD(a.date)}</td><td class="hide-sm">${esc(a.reason)}</td><td class="r">${inr(a.amount)}</td><td class="r hide-sm">${a.recovered ? inr(a.recovered) : '—'}</td><td class="r strong">${a.amount - a.recovered ? inr(a.amount - a.recovered) : badge('Cleared')}</td></tr>`; }).join('') || emptyRow(6, 'No advances')}
      </tbody></table></div></div>`;
}
function payWorkers(end, wids) {
  let run = DB.salaryRuns.find(r => r.end === end);
  if (!run) { run = { id: nid('sr'), start: shiftD(end, -6), end, status: 'Pending', paid: {}, by: SESSION }; DB.salaryRuns.push(run); }
  run.paid ||= {};
  const rows = payrollFor(end);
  let total = 0;
  rows.filter(r => wids.includes(r.w.id)).forEach(r => {
    let left = r.rec;
    DB.advances.filter(a => a.worker === r.w.id && a.amount > a.recovered).sort((a, b) => a.date.localeCompare(b.date)).forEach(a => { const take = Math.min(left, a.amount - a.recovered); a.recovered += take; left -= take; });
    run.paid[r.w.id] = r.gross - r.rec; total += r.gross - r.rec;
  });
  if (rows.every(r => run.paid[r.w.id] != null)) { run.status = 'Paid'; run.paidOn = TODAY; }
  return total;
}
ACT.payOne = el => { if (!guard(can2('Pay salaries & advances'), 'pay salaries')) return; const w = worker(el.dataset.w); const t = payWorkers(el.dataset.wk, [w.id]); logAct(`paid weekly wages to ${w.name}`, w.project, 'payment'); commit(`${inr(t)} paid to ${w.name}`); };
ACT.payAll = el => {
  if (!guard(can2('Pay salaries & advances'), 'pay salaries')) return;
  const end = el.dataset.wk, run = DB.salaryRuns.find(r => r.end === end), paid = run?.paid || {};
  const rows = payrollFor(end, ROUTE.q.p).filter(r => paid[r.w.id] == null);
  confirmBox('Pay weekly wages?', `Pay <b>${plural(rows.length, 'worker')}</b> a total of <b>${inr(sum(rows, r => r.gross - r.rec))}</b> for the week ending ${fmtDY(end)}. Advance recoveries will be deducted automatically.`, 'Confirm payment', () => { const t = payWorkers(end, rows.map(r => r.w.id)); logAct(`paid weekly wages (${inr(t)})`, null, 'payment'); commit(`Wages paid · ${inr(t)}`); });
};
ACT.newAdvance = el => {
  if (!guard(can2('Pay salaries & advances'), 'give advances')) return;
  closeDrawer();
  const ws = DB.workers.filter(w => w.status === 'Active' && myProjectIds().has(w.project));
  openModal({ title: 'Give salary advance', sub: 'Advances are recovered from weekly wages.', body: `<div class="form">
    ${fld('Worker', 'worker', { opts: ws.map(w => [w.id, `${w.name} · ${w.trade} · ${proj(w.project).name}`]), value: el.dataset.w })}
    <div class="row2">${fld('Amount (₹)', 'amount', { type: 'number', req: true, min: 1 })}${fld('Date', 'date', { type: 'date', value: TODAY })}</div>
    ${fld('Reason', 'reason', { opts: ADVANCE_REASONS })}</div>`,
    onSubmit: d => { DB.advances.unshift({ id: nid('a'), worker: d.worker, date: d.date, amount: +d.amount, reason: d.reason, recovered: 0, by: SESSION }); logAct(`gave an advance of ${inr(+d.amount)} to ${worker(d.worker).name}`, worker(d.worker).project, 'payment'); commit(`Advance of ${inr(+d.amount)} recorded`); } });
};

function finBills() {
  const { p = '', st = '' } = ROUTE.q;
  const ids = myProjectIds();
  const all = DB.contractorBills.filter(b => ids.has(b.project) && (!p || b.project === p));
  const list = all.filter(b => !st || billStatus(b) === st).sort((a, b) => b.date.localeCompare(a.date));
  const ok = can('finance');
  return `<div class="toolbar">${projSelect(p)}<div class="chips">${['', 'Overdue', 'Pending', 'Part paid', 'Paid'].map(s => `<button class="chip ${st === s ? 'on' : ''}" data-act="setQ" data-k="st" data-v="${s}">${s || 'All'} <span class="n">${all.filter(b => !s || billStatus(b) === s).length}</span></button>`).join('')}</div></div>
    <div class="kpis k3"><div class="kpi"><div class="l">Total billed</div><div class="v">${inrS(sum(all.filter(b => !b.status || b.status === 'Issued'), b => b.amount))}</div><div class="s">${plural(all.length, 'bill')}</div></div>
      <div class="kpi"><div class="l">Paid</div><div class="v">${inrS(sum(all, b => b.paid))}</div></div>
      <div class="kpi"><div class="l">Balance due</div><div class="v">${inrS(sum(all.filter(b => !b.status || b.status === 'Issued'), b => b.amount - b.paid))}</div><div class="s">${all.filter(b => billStatus(b) === 'Overdue').length} overdue</div></div></div>
    <div class="card"><div class="table-wrap"><table class="t stack-sm"><thead><tr><th>Contractor</th><th>Project</th><th>Bill date</th><th class="r">Amount</th><th class="r">Balance</th><th>Status</th>${ok ? '<th></th>' : ''}</tr></thead><tbody>
      ${list.map(b => `<tr><td class="strong full">${esc(b.contractor)}<span class="sub">${esc(b.billNo)} · ${esc(b.work)}</span></td><td class="hide-sm">${esc(proj(b.project).name)}</td><td class="nowrap hide-sm">${fmtD(b.date)}<span class="sub">due ${fmtD(b.due)}</span></td><td class="r">${inr(b.amount)}</td><td class="r strong">${b.amount - b.paid ? inr(b.amount - b.paid) : '—'}</td><td>${badge(billStatus(b))}</td>${ok ? `<td class="r">${b.amount > b.paid && !['Draft', 'Cancelled'].includes(b.status) ? `<button class="btn xs" data-act="payBill" data-id="${b.id}">Pay</button>` : `<button class="btn xs" data-act="openInv" data-kind="contractor" data-id="${b.id}">View</button>`}</td>` : ''}</tr>`).join('') || emptyRow(7, 'No bills found')}
    </tbody></table></div></div>`;
}
ACT.newBill = () => {
  if (!guard(can('finance'), 'add contractor bills')) return;
  openModal({ title: 'Add contractor bill', sub: 'Record a bill from a sub-contractor or supplier.', body: `<div class="form">
    <div class="row2">${fld('Contractor', 'contractor', { req: true, ph: 'e.g. Sri Murugan Electricals' })}${fld('Bill number', 'billNo', { req: true })}</div>
    ${fld('Project', 'project', { opts: projOpts(myProjects()), value: ROUTE.q.p })}
    ${fld('Work description', 'work', { req: true, ph: 'e.g. Electrical first fix – first floor' })}
    <div class="row3">${fld('Amount (₹)', 'amount', { type: 'number', req: true, min: 1 })}${fld('Bill date', 'date', { type: 'date', value: TODAY })}${fld('Due date', 'due', { type: 'date', value: shiftD(TODAY, 15) })}</div></div>`,
    onSubmit: d => { DB.contractorBills.unshift({ id: nid('cb'), contractor: d.contractor, billNo: d.billNo, project: d.project, work: d.work, amount: +d.amount, paid: 0, date: d.date, due: d.due, gst: 18, status: 'Issued', lines: [{ desc: d.work, qty: 1, unit: 'LS', rate: Math.round(+d.amount / 1.18 * 100) / 100 }] }); logAct(`added a bill from ${d.contractor}`, d.project, 'payment'); commit('Bill added'); } });
};
ACT.payBill = el => {
  const b = DB.contractorBills.find(x => x.id === el.dataset.id);
  if (!guard(can('finance'), 'pay contractor bills')) return;
  if (['Draft', 'Cancelled'].includes(b.status)) { toast(`This bill is ${b.status.toLowerCase()} — approve it before paying`, 'lock'); return; }
  openModal({ title: 'Pay contractor', sub: `${esc(b.contractor)} · ${esc(b.billNo)}`, body: `<div class="form"><div class="form-note">${ico('receipt', 'sm')}<span>${esc(b.work)} · balance <b>${inr(b.amount - b.paid)}</b> of ${inr(b.amount)}</span></div>
    <div class="row3">${fld('Amount (₹)', 'amount', { type: 'number', req: true, value: b.amount - b.paid, min: 1 })}${fld('Date', 'date', { type: 'date', value: TODAY })}${fld('Mode', 'mode', { opts: PAY_MODES_OUT })}</div></div>`,
    onSubmit: d => { const amt = Math.min(+d.amount, b.amount - b.paid); b.paid += amt; logAct(`paid ${inr(amt)} to ${b.contractor}`, b.project, 'payment'); commit(`${inr(amt)} paid to ${b.contractor}`); } });
};

function expenseTable(list, total = true) {
  return `<div class="table-wrap" style="margin-top:12px"><table class="t stack-sm"><thead><tr><th>Date</th><th>Item</th><th>Category</th><th>Project</th><th>Paid via</th><th class="r">Amount</th></tr></thead><tbody>
    ${list.map(e => `<tr><td class="nowrap">${fmtD(e.date)}</td><td class="strong full">${esc(e.item)}<span class="sub">${esc(e.vendor)}</span></td><td class="hide-sm">${esc(e.category)}</td><td class="hide-sm">${esc(proj(e.project).name)}</td><td class="hide-sm">${esc(e.mode)}</td><td class="r strong">${inr(e.amount)}</td></tr>`).join('') || emptyRow(6, 'No expenses found')}
    </tbody>${total && list.length ? `<tfoot><tr><td colspan="5">Total · ${plural(list.length, 'entry', 'entries')}</td><td class="r">${inr(sum(list, e => e.amount))}</td></tr></tfoot>` : ''}</table></div>`;
}
function finExpenses() {
  const { p = '', cat = '', m = '' } = ROUTE.q;
  const ids = myProjectIds();
  const months = lastMonths(6).reverse();
  const list = DB.expenses.filter(e => ids.has(e.project) && (!p || e.project === p) && (!cat || e.category === cat) && (!m || e.date.startsWith(m))).sort((a, b) => b.date.localeCompare(a.date));
  const shown = list.slice(0, 60);
  return `<div class="toolbar">${projSelect(p)}
      <select class="select" data-change="setQ" data-k="cat" aria-label="Category"><option value="">All categories</option>${EXP_CATS.map(c => `<option ${c === cat ? 'selected' : ''}>${c}</option>`).join('')}</select>
      <select class="select" data-change="setQ" data-k="m" aria-label="Month"><option value="">All months</option>${months.map(x => `<option value="${x.key}" ${x.key === m ? 'selected' : ''}>${parseD(x.key + '-01').toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}</option>`).join('')}</select></div>
    <div class="card"><div class="card-head"><h2>Site expenses</h2><span class="sub">${inrS(sum(list, e => e.amount))} · ${plural(list.length, 'entry', 'entries')}${list.length > shown.length ? ` · showing latest ${shown.length}` : ''}</span></div>${expenseTable(shown)}</div>`;
}
ACT.newExpense = () => {
  if (!guard(can2('Add site expenses'), 'add expenses')) return;
  openModal({ title: 'Add site expense', sub: 'Record materials, rentals, transport and other site costs.', body: `<div class="form">
    <div class="row2">${fld('Project', 'project', { opts: projOpts(), value: ROUTE.q.p })}${fld('Category', 'category', { opts: EXP_CATS })}</div>
    <div class="row2">${fld('Item / description', 'item', { req: true, ph: 'e.g. Cement – 50 bags' })}${fld('Vendor', 'vendor', { ph: 'e.g. Sri Lakshmi Traders' })}</div>
    <div class="row3">${fld('Amount (₹)', 'amount', { type: 'number', req: true, min: 1 })}${fld('Date', 'date', { type: 'date', value: TODAY })}${fld('Paid via', 'mode', { opts: PAY_MODES_OUT })}</div>
    <div class="field"><span>Bill / receipt photo</span><input class="input" type="file" accept="image/*,application/pdf" id="expFile" style="padding-top:7px"></div></div>`,
    onSubmit: d => { DB.expenses.unshift({ id: nid('e'), project: d.project, date: d.date, category: d.category, item: d.item, vendor: d.vendor || '—', amount: +d.amount, mode: d.mode, by: SESSION }); const f = $('#expFile').files[0]; if (f) addUploadedDoc(f, d.project, 'Invoices'); logAct(`added an expense of ${inr(+d.amount)} (${d.item})`, d.project, 'payment'); commit(`Expense of ${inr(+d.amount)} added`); } });
};
