/* Invoices & Bills: client invoices (raised against the billing schedule or for extra work), contractor bills,
   supplier bills (from material purchases) and payment receipts. Status is Draft, Issued, Partially Paid, Paid,
   Overdue or Cancelled. Payments recorded anywhere in the app update the same records. Print / Save as PDF uses
   the browser's print dialog; Download saves a standalone HTML copy. */
'use strict';

const canPayBills = () => can2('Issue invoices & pay bills');
const lineAmt = l => (+l.qty || 0) * (+l.rate || 0);
const taxable = x => Math.round(sum(x.lines || [], lineAmt) * 100) / 100;
const invTotal = inv => Math.round(taxable(inv) * (1 + inv.gst / 100));
const invPaid = inv => inv.status !== 'Issued' ? 0 : sum(DB.payments.filter(x => x.project === inv.project && x.against === inv.label), x => x.amount);
const PAY_ST = (base, total, paid, due) => ['Draft', 'Cancelled'].includes(base) ? base : paid >= total - 2 ? 'Paid' : paid > 0 ? (due < TODAY ? 'Overdue' : 'Partially Paid') : due < TODAY ? 'Overdue' : 'Issued';
const clientStatus = inv => PAY_ST(inv.status, invTotal(inv), invPaid(inv), inv.due);
const billDue = b => b.due;
const contractorStatus = b => PAY_ST(b.status || 'Issued', b.amount, b.paid, b.due);
const supplierDue = pu => shiftD(pu.date, 30);
function supplierBillStatus(pu) { return PAY_ST('Issued', puTotal(pu), pu.paid, supplierDue(pu)); }
const INV_TONE = { Draft: '', Issued: 'info', 'Partially Paid': 'warn', Paid: 'ok', Overdue: 'bad', Cancelled: '' };
const invBadge = st => badge(st, INV_TONE[st]);
const INV_STATUSES = ['Draft', 'Issued', 'Partially Paid', 'Paid', 'Overdue', 'Cancelled'];
function nextInvNo(date) { const fy = fyOf(date); DB.invSeq ||= {}; DB.invSeq[fy] = (DB.invSeq[fy] || 0) + 1; return `SSB/${fy}/INV-${String(DB.invSeq[fy]).padStart(3, '0')}`; }
function nextRct(date) { const fy = fyOf(date); DB.rctSeq ||= {}; DB.rctSeq[fy] = (DB.rctSeq[fy] || 0) + 1; return `SSB/${fy}/RCT-${String(DB.rctSeq[fy]).padStart(3, '0')}`; }
const invFor = (pid, label) => DB.invoices.find(i => i.project === pid && i.label === label && i.status === 'Issued');
// unified rows for the four registers
function invRows(kind) {
  const ids = myProjectIds();
  if (kind === 'client') return DB.invoices.filter(i => ids.has(i.project)).map(i => ({ kind, id: i.id, no: i.no || 'Draft', party: proj(i.project).client.name, project: i.project, title: i.label, date: i.date, due: i.due, total: invTotal(i), paid: invPaid(i), status: clientStatus(i) }));
  if (kind === 'contractor') return DB.contractorBills.filter(b => ids.has(b.project)).map(b => ({ kind, id: b.id, no: b.billNo, party: b.contractor, project: b.project, title: b.work, date: b.date, due: b.due, total: b.amount, paid: b.paid, status: contractorStatus(b) }));
  if (kind === 'supplier') return (DB.purchases || []).filter(pu => ids.has(pu.project)).map(pu => ({ kind, id: pu.id, no: pu.billNo, party: pu.supplier, project: pu.project, title: `${pu.material} · ${qtyU(pu.qty, pu.unit)}`, date: pu.date, due: supplierDue(pu), total: puTotal(pu), paid: pu.paid, status: supplierBillStatus(pu) }));
  return [];
}
SEARCH_HOOKS.push((hit, ids) => canSee('invoices') ? DB.invoices.filter(i => ids.has(i.project) && (hit(i.no || '') || hit(i.label))).slice(0, 4).map(i => ({ g: 'Invoices', icon: 'invoice', t: i.no || `Draft · ${i.label}`, s: `${proj(i.project).name} · ${clientStatus(i)}`, href: `#/invoices?inv=${i.id}` })) : []);
NAV_COUNT_HOOKS.push(() => ({ invoices: canSee('invoices') ? DB.invoices.filter(i => myProjectIds().has(i.project) && clientStatus(i) === 'Overdue').length : 0 }));

VIEWS.invoices = () => {
  const tab = ['contractor', 'supplier', 'receipts'].includes(ROUTE.q.tab) ? ROUTE.q.tab : 'client';
  const fy = fyOf(TODAY), cl = invRows('client'), live = cl.filter(r => !['Draft', 'Cancelled'].includes(r.status));
  const pay = [...invRows('contractor'), ...invRows('supplier')].filter(r => !['Draft', 'Cancelled'].includes(r.status));
  const T = tabs([['client', `${ico('invoice', 'sm')}Client invoices`, cl.filter(r => r.status === 'Overdue').length || null], ['contractor', 'Contractor bills'], ['supplier', 'Supplier bills'], ['receipts', 'Payment receipts']], tab);
  const acts = !canPayBills() ? '' : tab === 'client' ? btn('New invoice', 'newInvoice', { icon: 'plus', cls: 'primary' }) : tab === 'contractor' ? btn('Add contractor bill', 'newBill', { icon: 'plus', cls: 'primary' }) : tab === 'supplier' ? `<a class="btn primary" href="#/materials">${ico('plus')}Record purchase</a>` : can2('Record client payments') ? btn('Record payment', 'newPayment', { icon: 'plus', cls: 'primary' }) : '';
  if (ROUTE.q.inv) after(() => openInvoice(tab === 'client' ? 'client' : tab, ROUTE.q.inv));
  return `${pageHead('Invoices & Bills', 'Client invoices, contractor and supplier bills, and payment receipts — with line items, GST and payment status.', acts)}
    ${!canPayBills() ? `<div class="banner">${ico('eye')}<span>You have <b>view-only</b> access to invoices and bills.</span></div>` : ''}
    <div class="kpis">
      <div class="kpi"><div class="l">${ico('invoice', 'sm')}Invoiced · FY ${fy}</div><div class="v">${inrS(sum(live.filter(r => fyOf(r.date) === fy), r => r.total))}</div><div class="s">${plural(live.filter(r => fyOf(r.date) === fy).length, 'client invoice')}</div></div>
      <div class="kpi"><div class="l">${ico('rupee', 'sm')}Client outstanding</div><div class="v">${inrS(sum(live, r => Math.max(0, r.total - r.paid)))}</div><div class="s">${live.filter(r => ['Issued', 'Partially Paid', 'Overdue'].includes(r.status)).length} invoices open</div></div>
      <div class="kpi"><div class="l">${ico('alert', 'sm')}Overdue</div><div class="v">${inrS(sum(live.filter(r => r.status === 'Overdue'), r => r.total - r.paid))}</div><div class="s">${plural(live.filter(r => r.status === 'Overdue').length, 'invoice')} past due</div></div>
      <div class="kpi"><div class="l">${ico('receipt', 'sm')}Bills to pay</div><div class="v">${inrS(sum(pay, r => Math.max(0, r.total - r.paid)))}</div><div class="s">contractors & suppliers</div></div></div>
    ${T}${tab === 'receipts' ? receiptsTab() : registerTab(tab)}`;
};
function registerTab(kind) {
  const { p = '', st = '', q = '' } = ROUTE.q;
  const base = invRows(kind).filter(r => !p || r.project === p);
  const list = base.filter(r => (!st || r.status === st) && (!q || `${r.no} ${r.party} ${r.title}`.toLowerCase().includes(q.toLowerCase()))).sort((a, b) => b.date.localeCompare(a.date));
  const sts = kind === 'supplier' ? INV_STATUSES.filter(s => !['Draft', 'Cancelled'].includes(s)) : INV_STATUSES;
  return `<div class="toolbar">${searchBox('invQ', q, 'Search number, party, description')}${projSelect(p)}</div>
    ${statusChips([['', 'All'], ...sts.map(s => [s, s])], st, 'st', v => base.filter(r => !v || r.status === v).length)}
    <div class="card"><div class="table-wrap"><table class="t stack-sm"><thead><tr><th>${kind === 'client' ? 'Invoice' : 'Bill'}</th><th>${kind === 'client' ? 'Client' : kind === 'contractor' ? 'Contractor' : 'Supplier'}</th><th>Project</th><th>Date</th><th class="r">Total</th><th class="r">Balance</th><th>Status</th></tr></thead><tbody>
      ${list.map(r => `<tr class="click" data-act="openInv" data-kind="${kind}" data-id="${r.id}"><td class="strong full">${esc(r.no)}<span class="sub" style="white-space:normal">${esc(r.title)}</span></td><td class="hide-sm">${esc(r.party)}</td><td class="hide-sm">${esc(proj(r.project).name)}</td>
        <td class="nowrap hide-sm">${fmtD(r.date)}<span class="sub">due ${fmtD(r.due)}</span></td><td class="r">${inr(r.total)}</td><td class="r strong">${['Cancelled', 'Draft'].includes(r.status) ? '—' : r.total - r.paid > 2 ? inr(r.total - r.paid) : '—'}</td><td>${invBadge(r.status)}</td></tr>`).join('') || emptyRow(7, 'Nothing found', 'Try another filter.')}
    </tbody>${list.length ? `<tfoot><tr><td colspan="4">Total · ${plural(list.length, kind === 'client' ? 'invoice' : 'bill')}</td><td class="r">${inr(sum(list.filter(r => r.status !== 'Cancelled'), r => r.total))}</td><td class="r">${inr(sum(list.filter(r => !['Cancelled', 'Draft'].includes(r.status)), r => Math.max(0, r.total - r.paid)))}</td><td></td></tr></tfoot>` : ''}</table></div></div>`;
}
INPUT.invQ = liveSearch('invQ');
function receiptsTab() {
  const { p = '', q = '' } = ROUTE.q, ids = myProjectIds();
  const list = DB.payments.filter(x => ids.has(x.project) && (!p || x.project === p) && (!q || `${x.rno} ${x.against} ${x.ref} ${proj(x.project).client.name}`.toLowerCase().includes(q.toLowerCase()))).sort((a, b) => b.date.localeCompare(a.date));
  return `<div class="toolbar">${searchBox('invQ', q, 'Search receipt, client, reference')}${projSelect(p)}</div>
    <div class="card"><div class="table-wrap"><table class="t stack-sm"><thead><tr><th>Receipt</th><th>Received from</th><th>Against invoice</th><th>Date</th><th>Mode</th><th class="r">Amount</th></tr></thead><tbody>
    ${list.slice(0, ROUTE.q.all ? 500 : 40).map(x => { const inv = invFor(x.project, x.against); return `<tr class="click" data-act="openReceipt" data-id="${x.id}"><td class="strong full">${esc(x.rno || '—')}<span class="sub">${esc(proj(x.project).name)}</span></td><td class="hide-sm">${esc(proj(x.project).client.name)}</td><td class="hide-sm">${inv ? esc(inv.no) : esc(x.against)}<span class="sub">${esc(x.against)}</span></td><td class="nowrap">${fmtDY(x.date)}</td><td class="hide-sm">${esc(x.mode)}<span class="sub">${esc(x.ref)}</span></td><td class="r strong">${inr(x.amount)}${x.sent?.length ? '<span class="sub" style="color:var(--ok)">sent to client</span>' : ''}</td></tr>`; }).join('') || emptyRow(6, 'No receipts')}
    </tbody></table></div>${!ROUTE.q.all && list.length > 40 ? `<div class="card-foot" style="justify-content:center"><button class="btn sm" data-act="setQ" data-k="all" data-v="1">Show all ${list.length}</button></div>` : ''}</div>`;
}

/* ---------- printable paper ---------- */
function words(n) {
  n = Math.round(n); if (!n) return 'Zero';
  const a = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'], b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  const two = x => x < 20 ? a[x] : b[Math.floor(x / 10)] + (x % 10 ? ' ' + a[x % 10] : '');
  const three = x => (x >= 100 ? a[Math.floor(x / 100)] + ' Hundred' + (x % 100 ? ' ' : '') : '') + (x % 100 ? two(x % 100) : '');
  const parts = [[1e7, 'Crore'], [1e5, 'Lakh'], [1e3, 'Thousand']]; let out = [];
  parts.forEach(([v, l]) => { if (n >= v) { out.push(`${two(Math.floor(n / v))} ${l}`); n %= v; } });
  if (n) out.push(three(n));
  return out.join(' ');
}
function docPaper(kind, x) {
  const p = proj(x.project);
  const doc = kind === 'client' ? { title: 'TAX INVOICE', no: x.no || 'DRAFT', from: { n: 'Scale Space Builders', a: 'Mayiladuthurai' }, to: { n: p.client.name, a: p.client.address }, lines: x.lines, gst: x.gst, total: invTotal(x), paid: invPaid(x), st: clientStatus(x), date: x.date, due: x.due, notes: x.notes }
    : kind === 'contractor' ? { title: 'CONTRACTOR BILL', no: x.billNo, from: { n: x.contractor, a: 'Sub-contractor' }, to: { n: 'Scale Space Builders', a: 'Mayiladuthurai' }, lines: x.lines || [{ desc: x.work, qty: 1, unit: 'LS', rate: x.amount / 1.18 }], gst: x.gst || 18, total: x.amount, paid: x.paid, st: contractorStatus(x), date: x.date, due: x.due, notes: x.cancelReason ? `Cancelled: ${x.cancelReason}` : '' }
    : { title: 'SUPPLIER BILL', no: x.billNo, from: { n: x.supplier, a: 'Supplier' }, to: { n: 'Scale Space Builders', a: 'Mayiladuthurai' }, lines: [{ desc: x.material, qty: x.qty, unit: x.unit, rate: x.rate }], gst: x.gst, total: puTotal(x), paid: x.paid, st: supplierBillStatus(x), date: x.date, due: supplierDue(x), notes: `Purchase order ${x.po}` };
  const tx = Math.round(sum(doc.lines, lineAmt) * 100) / 100, tax = doc.total - tx;
  const stc = { Paid: '#1D7347', Overdue: '#B3261E', Cancelled: '#777', Draft: '#777', 'Partially Paid': '#935F00', Issued: '#2A5EA6' }[doc.st];
  return `${paperHead(kind === 'client' ? '' : 'Bill register copy')}
    <div class="grid2"><div><h4 style="letter-spacing:.06em">${doc.title}</h4><div class="muted">No. <b style="color:#222">${esc(doc.no)}</b></div><div class="muted">Date ${fmtDY(doc.date)} · Due ${fmtDY(doc.due)}</div></div><div style="text-align:right"><span class="stamp" style="color:${stc}">${esc(doc.st)}</span></div></div>
    <div class="grid2" style="margin-top:14px"><div><div class="muted">${kind === 'client' ? 'Bill to' : 'From'}</div><b>${esc(kind === 'client' ? doc.to.n : doc.from.n)}</b><div>${esc(kind === 'client' ? doc.to.a : doc.from.a)}</div></div><div style="text-align:right"><div class="muted">Project</div><b>${esc(p.name)}</b><div>${esc(p.code)} · ${esc(p.location)}, ${esc(p.city)}</div></div></div>
    <table><tr><th>#</th><th>Description</th><th class="r">Qty</th><th class="r">Rate</th><th class="r">Amount</th></tr>
      ${doc.lines.map((l, i) => `<tr><td>${i + 1}</td><td>${esc(l.desc)}</td><td class="r">${num(l.qty)} ${esc(l.unit || '')}</td><td class="r">${inr(l.rate)}</td><td class="r">${inr(lineAmt(l))}</td></tr>`).join('')}
      <tr><td></td><td>Taxable value</td><td></td><td></td><td class="r">${inr(tx)}</td></tr>
      ${doc.gst ? `<tr><td></td><td>CGST @ ${doc.gst / 2}%</td><td></td><td></td><td class="r">${inr(tax / 2)}</td></tr><tr><td></td><td>SGST @ ${doc.gst / 2}%</td><td></td><td></td><td class="r">${inr(tax / 2)}</td></tr>` : ''}
      <tr class="tot"><td></td><td>Total</td><td></td><td></td><td class="r">${inr(doc.total)}</td></tr>
      ${doc.st !== 'Draft' && doc.st !== 'Cancelled' ? `<tr><td></td><td>Paid</td><td></td><td></td><td class="r">${inr(doc.paid)}</td></tr><tr class="tot"><td></td><td>Balance due</td><td></td><td></td><td class="r">${inr(Math.max(0, doc.total - doc.paid))}</td></tr>` : ''}</table>
    <div class="muted">Amount in words: Rupees ${words(doc.total)} only</div>
    ${doc.notes ? `<p style="margin-top:10px">${esc(doc.notes)}</p>` : ''}
    ${kind === 'client' ? `<div class="grid2" style="margin-top:18px"><div class="muted">Bank: Indian Bank, Mayiladuthurai · A/c 6123 4567 890 · IFSC IDIB000M012 (demo)</div><div style="text-align:right">For Scale Space Builders<br><br><span class="muted">Authorised signatory</span></div></div>` : ''}
    <div class="demo">Sample document generated by the Scale Space Builders demo — not a valid tax invoice.</div>`;
}
function receiptPaper(x) {
  const p = proj(x.project), inv = invFor(x.project, x.against);
  return `${paperHead('')}<div class="grid2"><div><h4 style="letter-spacing:.06em">PAYMENT RECEIPT</h4><div class="muted">No. <b style="color:#222">${esc(x.rno || '—')}</b> · ${fmtDY(x.date)}</div></div><div style="text-align:right"><span class="stamp" style="color:#1D7347">Received</span></div></div>
    <p style="margin-top:16px">Received with thanks from <b>${esc(p.client.name)}</b> the sum of <b>${inr(x.amount)}</b> (Rupees ${words(x.amount)} only) by ${esc(x.mode)}${x.ref && x.ref !== '—' ? ` (ref. ${esc(x.ref)})` : ''} towards <b>${esc(x.against)}</b>${inv ? `, invoice ${esc(inv.no)}` : ''} for the project <b>${esc(p.name)}</b> (${esc(p.code)}).</p>
    ${inv ? `<table><tr><td>Invoice total</td><td class="r">${inr(invTotal(inv))}</td></tr><tr><td>Received to date</td><td class="r">${inr(invPaid(inv))}</td></tr><tr class="tot"><td>Balance</td><td class="r">${inr(Math.max(0, invTotal(inv) - invPaid(inv)))}</td></tr></table>` : ''}
    <div class="grid2" style="margin-top:24px"><div class="muted">Recorded by ${esc(userName(x.by))}</div><div style="text-align:right">For Scale Space Builders<br><br><span class="muted">Authorised signatory</span></div></div>
    <div class="demo">Sample receipt generated by the Scale Space Builders demo.</div>`;
}
const recOf = (kind, id) => kind === 'client' ? DB.invoices.find(i => i.id === id) : kind === 'contractor' ? DB.contractorBills.find(b => b.id === id) : (DB.purchases || []).find(pu => pu.id === id);
function openInvoice(kind, id) {
  const x = recOf(kind, id); if (!x) return;
  const st = kind === 'client' ? clientStatus(x) : kind === 'contractor' ? contractorStatus(x) : supplierBillStatus(x);
  const ok = canPayBills(), no = kind === 'client' ? x.no || 'Draft invoice' : x.billNo;
  const pays = kind === 'client' && x.status === 'Issued' ? DB.payments.filter(y => y.project === x.project && y.against === x.label) : [];
  const paid = kind === 'client' ? invPaid(x) : x.paid;
  const acts = [];
  if (ok && kind === 'client' && x.status === 'Draft') acts.push(`<button type="button" class="btn" data-act="editInvoice" data-id="${x.id}">${ico('edit', 'sm')}Edit</button>`, `<button type="button" class="btn primary" data-act="issueInv" data-id="${x.id}">${ico('send', 'sm')}Issue invoice</button>`);
  if (ok && kind === 'contractor' && x.status === 'Draft') acts.push(`<button type="button" class="btn primary" data-act="approveBill" data-id="${x.id}">${ico('check', 'sm')}Approve bill</button>`);
  if (ok && ['Issued', 'Partially Paid', 'Overdue'].includes(st) && (kind !== 'client' || can2('Record client payments'))) acts.push(`<button type="button" class="btn primary" data-act="payInv" data-kind="${kind}" data-id="${x.id}">${ico('rupee', 'sm')}Record payment</button>`);
  openModal({ title: `${kind === 'client' ? 'Invoice' : kind === 'contractor' ? 'Contractor bill' : 'Supplier bill'} ${esc(no)}`, sub: `${esc(proj(x.project).name)} · ${invBadge(st)}`, wide: true, body: `
    ${kind === 'client' && x.status === 'Issued' ? `<div style="margin-bottom:14px">${sendPanel('invoice', x)}</div>` : ''}
    <div class="preview-stage" style="min-height:0"><div class="paper inv">${docPaper(kind, x)}</div></div>
    ${pays.length ? `<div style="margin-top:16px"><h3 style="margin-bottom:8px">Payments received</h3>${pays.map(y => `<div class="kv-row"><span>${fmtDY(y.date)} · ${esc(y.mode)} · <button class="linkbtn" data-act="openReceipt" data-id="${y.id}">${esc(y.rno || 'receipt')}</button></span><b>${inr(y.amount)}</b></div>`).join('')}</div>` : ''}
    ${x.cancelReason || (kind === 'client' && x.status === 'Cancelled') ? `<div class="form-note" style="margin-top:12px">${ico('x', 'sm')}<span><b>Cancelled${x.cancelledBy ? ` by ${esc(userName(x.cancelledBy))}` : ''}:</b> ${esc(x.cancelReason || '')}</span></div>` : ''}
    ${kind === 'supplier' ? `<div class="link-row" style="margin-top:12px"><a href="#/materials?pu=${x.id}">${ico('box', 'sm')}Purchase ${esc(x.po)} — deliveries & photos</a></div>` : ''}`,
    foot: `${ok && !['Cancelled', 'Paid'].includes(st) && !paid && kind !== 'supplier' ? `<button type="button" class="btn ghost danger left" data-act="cancelInv" data-kind="${kind}" data-id="${x.id}">Cancel</button>` : ''}
      <button type="button" class="btn" data-act="printInv" data-kind="${kind}" data-id="${x.id}">${ico('print', 'sm')}Print / PDF</button><button type="button" class="btn" data-act="dlInv" data-kind="${kind}" data-id="${x.id}">${ico('download', 'sm')}Download</button>${acts.join('')}` });
}
ACT.openInv = el => openInvoice(el.dataset.kind, el.dataset.id);
ACT.printInv = el => { const x = recOf(el.dataset.kind, el.dataset.id); printPaper(`${el.dataset.kind === 'client' ? x.no || 'Draft invoice' : x.billNo}`, docPaper(el.dataset.kind, x)); };
ACT.dlInv = el => { const x = recOf(el.dataset.kind, el.dataset.id), no = (el.dataset.kind === 'client' ? x.no || 'draft-invoice' : x.billNo).replace(/[^\w-]+/g, '-'); downloadPaper(`${no}.html`, no, docPaper(el.dataset.kind, x)); };
function openReceipt(id, fresh = false) {
  const x = DB.payments.find(y => y.id === id); if (!x) return;
  if (!x.rno) x.rno = nextRct(x.date);
  const c = proj(x.project).client;
  openModal({ title: `Receipt ${esc(x.rno)}`, sub: `${esc(proj(x.project).name)} · ${inr(x.amount)} · ${esc(c.name)}`, wide: true, body: `
    ${fresh ? `<div class="banner ok">${ico('check')}<span><b>Payment of ${inr(x.amount)} recorded.</b> Send the receipt to ${esc(c.name)} or download it.</span></div>` : ''}
    ${sendPanel('receipt', x)}
    <div class="preview-stage" style="min-height:0;margin-top:14px"><div class="paper inv">${receiptPaper(x)}</div></div>`,
    foot: `<button type="button" class="btn" data-act="printRct" data-id="${x.id}">${ico('print', 'sm')}Print / PDF</button><button type="button" class="btn" data-act="dlRct" data-id="${x.id}">${ico('download', 'sm')}Download</button><button type="button" class="btn primary" data-act="closeModal">Done</button>` });
}
ACT.openReceipt = el => openReceipt(el.dataset.id);

/* ---------- send an invoice or receipt to the client ---------- */
const canSendClient = () => can2('Record client payments') || canPayBills();
function clientMsg(kind, x) {
  const p = proj(x.project), c = p.client;
  if (kind === 'receipt') {
    const inv = invFor(x.project, x.against), bal = inv ? Math.max(0, invTotal(inv) - invPaid(inv)) : null;
    return { subject: `Payment receipt ${x.rno} — ${p.name}`, text: `Dear ${c.name},\n\nThank you. We have received ${inr(x.amount)} on ${fmtDY(x.date)} by ${x.mode}${x.ref && x.ref !== '—' ? ` (ref. ${x.ref})` : ''} towards "${x.against}"${inv ? ` (invoice ${inv.no})` : ''} for ${p.name}.\n\nReceipt no.: ${x.rno}${bal != null ? `\nBalance on this invoice: ${inr(bal)}` : ''}\n\nThe receipt is attached.\n\nRegards,\nScale Space Builders\n+91 78454 36496` };
  }
  return { subject: `Invoice ${x.no} — ${p.name}`, text: `Dear ${c.name},\n\nPlease find attached invoice ${x.no} dated ${fmtDY(x.date)} for "${x.label}" on ${p.name}.\n\nAmount: ${inr(invTotal(x))}${invPaid(x) ? `\nReceived: ${inr(invPaid(x))}\nBalance: ${inr(Math.max(0, invTotal(x) - invPaid(x)))}` : ''}\nDue date: ${fmtDY(x.due)}\n\nBank: Indian Bank, Mayiladuthurai · A/c 6123 4567 890 · IFSC IDIB000M012\n\nRegards,\nScale Space Builders\n+91 78454 36496` };
}
function sendPanel(kind, x) {
  if (!canSendClient()) return '';
  const c = proj(x.project).client, log = x.sent || [];
  const via = { whatsapp: 'WhatsApp', email: 'email', share: 'share' };
  return `<div class="send-box"><div class="send-h"><b>${ico('send', 'sm')}Send to client</b><span class="muted">${esc(c.name)} · ${esc(c.phone)}${c.email ? ` · ${esc(c.email)}` : ''}</span></div>
    <div class="send-acts"><button type="button" class="btn sm" data-act="sendDoc" data-via="whatsapp" data-kind="${kind}" data-id="${x.id}">${ico('enquiry', 'sm')}WhatsApp</button>
      <button type="button" class="btn sm" data-act="sendDoc" data-via="email" data-kind="${kind}" data-id="${x.id}" ${c.email ? '' : 'disabled title="No email on file for this client"'}>${ico('mail', 'sm')}Email</button>
      ${navigator.share ? `<button type="button" class="btn sm" data-act="sendDoc" data-via="share" data-kind="${kind}" data-id="${x.id}">${ico('send', 'sm')}Share…</button>` : ''}</div>
    <p class="muted send-note">The ${kind === 'receipt' ? 'receipt' : 'invoice'} is downloaded and WhatsApp or your email app opens with the message ready — attach the downloaded file and send. Nothing is sent automatically in this demo.</p>
    ${log.length ? `<div class="send-log">${log.slice().reverse().map(l => `<span>${ico('check', 'sm')}Sent by ${via[l.via]} · ${fmtTs(l.at)} · ${esc(userName(l.by))}</span>`).join('')}</div>` : ''}</div>`;
}
ACT.sendDoc = el => {
  const { kind, id, via } = el.dataset, x = kind === 'receipt' ? DB.payments.find(y => y.id === id) : DB.invoices.find(i => i.id === id);
  const p = proj(x.project), c = p.client, { subject, text } = clientMsg(kind, x);
  const no = (kind === 'receipt' ? x.rno : x.no).replace(/[^\w-]+/g, '-'), paper = kind === 'receipt' ? receiptPaper(x) : docPaper('client', x);
  const log = () => { (x.sent ||= []).push({ at: Date.now(), by: SESSION, via }); logAct(`sent ${kind === 'receipt' ? `receipt ${x.rno}` : `invoice ${x.no}`} to ${c.name} by ${via === 'email' ? 'email' : via === 'share' ? 'share' : 'WhatsApp'}`, x.project, 'payment'); saveDB(); setTimeout(() => kind === 'receipt' ? openReceipt(x.id) : openInvoice('client', x.id), 80); };
  if (via === 'share') {
    const file = new File([paperHtml(no, paper)], `${no}.html`, { type: 'text/html' });
    const data = navigator.canShare?.({ files: [file] }) ? { title: subject, text, files: [file] } : { title: subject, text };
    navigator.share(data).then(log).catch(() => { });
    return;
  }
  downloadPaper(`${no}.html`, no, paper);
  const a = document.createElement('a');
  if (via === 'whatsapp') { a.href = `https://wa.me/${c.phone.replace(/\D/g, '')}?text=${encodeURIComponent(text)}`; a.target = '_blank'; a.rel = 'noopener'; }
  else a.href = `mailto:${encodeURIComponent(c.email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}`;
  document.body.appendChild(a); a.click(); a.remove();
  log(); setTimeout(() => toast(`Message ready in ${via === 'email' ? 'your email app' : 'WhatsApp'} — attach the downloaded ${kind === 'receipt' ? 'receipt' : 'invoice'}`), 400);
};
ACT.printRct = el => { const x = DB.payments.find(y => y.id === el.dataset.id); printPaper(x.rno, receiptPaper(x)); };
ACT.dlRct = el => { const x = DB.payments.find(y => y.id === el.dataset.id); downloadPaper(`${x.rno.replace(/[^\w-]+/g, '-')}.html`, x.rno, receiptPaper(x)); };

/* ---------- payments ---------- */
ACT.payInv = el => {
  const kind = el.dataset.kind, x = recOf(kind, el.dataset.id); closeModal(); closeDrawer();
  if (kind === 'client') return ACT.newPayment({ dataset: { p: x.project, against: x.label } });
  if (kind === 'contractor') return ACT.payBill({ dataset: { id: x.id } });
  if (!guard(canPayBills(), 'pay supplier bills')) return;
  const due = puTotal(x) - x.paid;
  openModal({ title: 'Pay supplier bill', sub: `${esc(x.supplier)} · ${esc(x.billNo)}`, body: `<div class="form"><div class="form-note">${ico('box', 'sm')}<span>${esc(x.material)} · ${qtyU(x.qty, x.unit)} · balance <b>${inr(due)}</b> of ${inr(puTotal(x))}</span></div>
    <div class="row3">${fld('Amount (₹)', 'amount', { type: 'number', req: true, value: due, min: 1 })}${fld('Date', 'date', { type: 'date', value: TODAY })}${fld('Mode', 'mode', { opts: PAY_MODES_OUT })}</div></div>`,
    onSubmit: d => { const amt = Math.min(+d.amount, due); x.paid += amt; logAct(`paid ${inr(amt)} to ${x.supplier} (${x.billNo})`, x.project, 'payment'); commit(`${inr(amt)} paid to ${x.supplier}`); } });
};

/* ---------- client invoice create / edit / issue / cancel ---------- */
function invForm(inv = null, pid = ROUTE.q.p) {
  const ps = myProjects().filter(p => p.status !== 'Completed' || inv);
  pid = inv?.project || (ps.some(p => p.id === pid) ? pid : ps[0]?.id);
  const lines = inv?.lines || [];
  return `<div class="form"><input type="hidden" name="mode" value="draft">
    <div class="row2">${fld('Project', 'project', { opts: projOpts(ps), value: pid })}<label class="field"><span>Bill for</span><select class="select" name="billing" id="invStage">${stageOpts(pid, inv?.billing)}</select></label></div>
    <div class="row3">${fld('Invoice date', 'date', { type: 'date', value: inv?.date || TODAY })}${fld('Due date', 'due', { type: 'date', value: inv?.due || shiftD(TODAY, 15) })}${fld('GST', 'gst', { opts: GST_RATES.map(g => [g, g ? `${g}%${g === 18 ? ' (works contract)' : ''}` : 'No GST']), value: inv?.gst ?? 18 })}</div>
    <div class="field"><span>Line items <em>*</em></span><div class="inv-lines"><div class="il-h"><span>Description</span><span>Qty</span><span>Unit</span><span>Rate (₹)</span><span class="r">Amount</span></div>
      ${[0, 1, 2, 3].map(i => `<div class="il"><input class="input" name="ld${i}" value="${esc(lines[i]?.desc || '')}" placeholder="${i ? 'Optional' : 'e.g. Roof slab – first floor (stage payment)'}" aria-label="Description ${i + 1}"><input class="input" type="number" step="any" min="0" name="lq${i}" value="${lines[i]?.qty ?? (i ? '' : 1)}" aria-label="Quantity ${i + 1}"><input class="input" name="lu${i}" value="${esc(lines[i]?.unit || (i ? '' : 'LS'))}" aria-label="Unit ${i + 1}"><input class="input" type="number" step="any" min="0" name="lr${i}" value="${lines[i]?.rate ?? ''}" aria-label="Rate ${i + 1}"><span class="r num" data-la="${i}">—</span></div>`).join('')}</div></div>
    <div class="form-note" id="invCalc">${ico('rupee', 'sm')}<span></span></div>
    ${fld('Notes', 'notes', { value: inv?.notes || 'Payable within 15 days as per the construction agreement.' })}</div>`;
}
function stageOpts(pid, cur) {
  const rows = DB.billing.filter(b => b.project === pid && (!b.billed || b.id === cur) && !DB.invoices.some(i => i.billing === b.id && i.status === 'Draft' && i.billing !== cur));
  return `${rows.map(b => `<option value="${b.id}" ${b.id === cur ? 'selected' : ''} data-amt="${b.amount}" data-label="${esc(b.label)}" data-pct="${b.pct}">${esc(b.label)} — ${b.pct ? `${b.pct}% · ` : ''}${inr(b.amount)}</option>`).join('')}<option value="" ${cur === null || !rows.length ? 'selected' : ''}>Extra work / other</option>`;
}
function bindInvForm(m, fillStage = true) {
  const f = n => $(`[name=${n}]`, m);
  const calc = () => { const g = +f('gst').value; let t = 0; [0, 1, 2, 3].forEach(i => { const a = (+f('lq' + i).value || 0) * (+f('lr' + i).value || 0); t += a; $(`[data-la="${i}"]`, m).textContent = a ? inr(a) : '—'; }); $('#invCalc span', m).innerHTML = t ? `Taxable ${inr(t)} + GST ${inr(t * g / 100)} = <b>${inr(t * (1 + g / 100))}</b>` : 'Add at least one line with a rate'; };
  const fill = () => { const o = f('billing').selectedOptions[0]; if (!o?.value) return; const p = proj(f('project').value); f('ld0').value = `${o.dataset.label} — ${o.dataset.pct}% of contract value (${p.code})`; f('lq0').value = 1; f('lu0').value = 'LS'; f('lr0').value = Math.round(+o.dataset.amt / (1 + +f('gst').value / 100) * 100) / 100; calc(); };
  f('project').addEventListener('change', () => { f('billing').innerHTML = stageOpts(f('project').value); fill(); });
  f('billing').addEventListener('change', fill);
  $$('.inv-lines input, [name=gst]', m).forEach(i => i.addEventListener('input', calc)); f('gst').addEventListener('change', calc);
  $$('[data-mode]', m).forEach(b => b.addEventListener('click', () => f('mode').value = b.dataset.mode));
  if (fillStage) fill(); calc();
}
const readLines = d => [0, 1, 2, 3].map(i => ({ desc: d['ld' + i], qty: +d['lq' + i] || 0, unit: d['lu' + i], rate: +d['lr' + i] || 0 })).filter(l => l.desc && l.qty && l.rate);
function saveInvoice(d, inv) {
  const lines = readLines(d);
  if (!lines.length) { toast('Add at least one line item with quantity and rate', 'lock'); return false; }
  if (d.due < d.date) { toast('The due date must be on or after the invoice date', 'lock'); return false; }
  const b = d.billing && DB.billing.find(x => x.id === d.billing);
  Object.assign(inv, { project: d.project, billing: b ? b.id : null, label: b ? b.label : `Extra work – ${lines[0].desc.slice(0, 48)}`, date: d.date, due: d.due, gst: +d.gst, lines, notes: d.notes });
  if (d.mode === 'issue') issueInvoice(inv);
  return true;
}
function issueInvoice(inv) {
  const tot = invTotal(inv);
  let b = inv.billing && DB.billing.find(x => x.id === inv.billing);
  if (!b) { b = { id: nid('b'), project: inv.project, label: inv.label, pct: 0, amount: tot, billed: true, due: inv.due }; DB.billing.push(b); inv.billing = b.id; }
  Object.assign(b, { billed: true, amount: tot, due: inv.due });
  Object.assign(inv, { status: 'Issued', no: inv.no || nextInvNo(inv.date), issuedAt: Date.now() });
  logAct(`issued invoice ${inv.no} (${inv.label}) for ${inr(tot)}`, inv.project, 'payment');
}
ACT.newInvoice = el => {
  if (!guard(canPayBills(), 'raise invoices')) return;
  openModal({ title: 'New client invoice', sub: 'Bill a stage from the billing schedule, or extra work.', wide: true, body: invForm(null, el?.dataset?.p),
    foot: `<button type="button" class="btn" data-act="closeModal">Cancel</button><button type="submit" class="btn" data-mode="draft">Save draft</button><button type="submit" class="btn primary" data-mode="issue">${ico('send', 'sm')}Issue invoice</button>`,
    onOpen: m => bindInvForm(m),
    onSubmit: d => { const inv = { id: nid('iv'), no: null, kind: 'client', status: 'Draft', by: SESSION, issuedAt: null }; if (!saveInvoice(d, inv)) return false; DB.invoices.unshift(inv); if (inv.status === 'Draft') logAct(`saved a draft invoice for ${proj(inv.project).name}`, inv.project, 'payment'); commit(inv.status === 'Issued' ? `Invoice ${inv.no} issued · ${inr(invTotal(inv))}` : 'Draft invoice saved'); setTimeout(() => openInvoice('client', inv.id), 60); } });
};
ACT.editInvoice = el => {
  const inv = DB.invoices.find(i => i.id === el.dataset.id);
  openModal({ title: 'Edit draft invoice', sub: esc(proj(inv.project).name), wide: true, body: invForm(inv),
    foot: `<button type="button" class="btn" data-act="closeModal">Cancel</button><button type="submit" class="btn" data-mode="draft">Save draft</button><button type="submit" class="btn primary" data-mode="issue">${ico('send', 'sm')}Issue invoice</button>`,
    onOpen: m => bindInvForm(m, false),
    onSubmit: d => { if (!saveInvoice(d, inv)) return false; commit(inv.status === 'Issued' ? `Invoice ${inv.no} issued` : 'Draft updated'); setTimeout(() => openInvoice('client', inv.id), 60); } });
};
ACT.issueInv = el => {
  const inv = DB.invoices.find(i => i.id === el.dataset.id);
  confirmBox('Issue this invoice?', `It gets the next invoice number and <b>${inr(invTotal(inv))}</b> is added to ${esc(proj(inv.project).client.name)}'s billed amount, due ${fmtDY(inv.due)}.`, 'Issue invoice', () => { issueInvoice(inv); commit(`Invoice ${inv.no} issued`); setTimeout(() => openInvoice('client', inv.id), 60); });
};
ACT.approveBill = el => { const b = DB.contractorBills.find(x => x.id === el.dataset.id); b.status = 'Issued'; logAct(`approved bill ${b.billNo} from ${b.contractor}`, b.project, 'payment'); commit('Bill approved for payment'); setTimeout(() => openInvoice('contractor', b.id), 60); };
ACT.cancelInv = el => {
  const kind = el.dataset.kind, x = recOf(kind, el.dataset.id);
  openModal({ title: 'Cancel this ' + (kind === 'client' ? 'invoice' : 'bill') + '?', sub: esc(kind === 'client' ? x.no || 'Draft invoice' : x.billNo), body: `<div class="form"><p class="ink2">The record stays in the register marked <b>Cancelled</b>${kind === 'client' && x.status === 'Issued' ? ' and its amount is removed from the billed total' : ''}.</p>${fld('Reason', 'reason', { type: 'textarea', req: true, ph: 'e.g. Raised in error' })}</div>`,
    foot: `<button type="button" class="btn" data-act="closeModal">Keep</button><button type="submit" class="btn danger">Cancel ${kind === 'client' ? 'invoice' : 'bill'}</button>`,
    onSubmit: d => {
      if (kind === 'client') {
        const b = x.billing && DB.billing.find(y => y.id === x.billing);
        if (b && x.status === 'Issued') { if (b.pct === 0) DB.billing = DB.billing.filter(y => y !== b); else b.billed = false; }
        Object.assign(x, { status: 'Cancelled', cancelledAt: Date.now(), cancelledBy: SESSION, cancelReason: d.reason });
      } else Object.assign(x, { status: 'Cancelled', cancelReason: d.reason });
      logAct(`cancelled ${kind === 'client' ? `invoice ${x.no || '(draft)'}` : `bill ${x.billNo}`}`, x.project, 'payment'); commit('Cancelled');
    } });
};
