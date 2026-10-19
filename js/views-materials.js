/* Materials: purchases (with bill and purchase photos), deliveries and unloading at site, shortages / damage /
   rejections, stock (purchased, received, used, remaining) and the full history. Each purchase is also a supplier
   bill (Invoices & Bills) and a project expense (Payments & Expenses). The actual delivery and unloading time is
   recorded separately from when the record was created and when the photos were uploaded. */
'use strict';

const ISSUE_TYPES = ['Shortage', 'Damaged', 'Incorrect quantity', 'Rejected'];
const puTotal = pu => Math.round(pu.qty * pu.rate * (1 + pu.gst / 100));
const puReceived = pu => sum(pu.deliveries, d => d.receivedQty);
const puAccepted = pu => sum(pu.deliveries, d => d.acceptedQty);
const roundQ = n => Math.round(n * 100) / 100;
function puStatus(pu) {
  if (!pu.deliveries.length) return 'Ordered';
  const acc = puAccepted(pu);
  if (acc <= 0 && pu.deliveries.every(d => d.status === 'Rejected')) return 'Rejected';
  return acc < pu.qty - 1e-6 ? 'Partially received' : 'Received';
}
const PU_TONE = { Ordered: 'info', 'Partially received': 'warn', Received: 'ok', Rejected: 'bad' };
const deliveryAt = (dv) => tsOn(dv.date, +dv.unloadStart.split(':')[0], +dv.unloadStart.split(':')[1]);
const myPurchases = () => (DB.purchases || []).filter(pu => myProjectIds().has(pu.project));
const qtyU = (n, u) => `${num(roundQ(n))} ${u}`;
const sitePeople = p => [p.supervisor, p.engineer, p.pm].filter(Boolean);
SEARCH_HOOKS.push((hit, ids) => canSee('materials') ? (DB.purchases || []).filter(pu => ids.has(pu.project) && (hit(pu.material) || hit(pu.supplier) || hit(pu.po) || hit(pu.billNo))).slice(0, 4).map(pu => ({ g: 'Materials', icon: 'box', t: `${pu.material} · ${qtyU(pu.qty, pu.unit)}`, s: `${pu.po} · ${proj(pu.project).name}`, href: `#/materials?pu=${pu.id}` })) : []);

function stockRows(pid) {
  const by = {};
  myPurchases().filter(pu => pu.project === pid).forEach(pu => { const r = by[pu.material] ||= { material: pu.material, unit: pu.unit, category: pu.category, ordered: 0, received: 0, used: 0 }; r.ordered += pu.qty; r.received += puAccepted(pu); });
  (DB.materialUse || []).filter(u => u.project === pid).forEach(u => { const r = by[u.material] ||= { material: u.material, unit: u.unit, category: '', ordered: 0, received: 0, used: 0 }; r.used += u.qty; });
  return Object.values(by).map(r => ({ ...r, left: Math.max(0, r.received - r.used) })).sort((a, b) => a.material.localeCompare(b.material));
}

VIEWS.materials = () => {
  const tab = ['deliveries', 'stock', 'history'].includes(ROUTE.q.tab) ? ROUTE.q.tab : 'purchases';
  const all = myPurchases();
  const issues = all.flatMap(pu => pu.deliveries).filter(d => d.issues.length && daysFrom(d.date) >= -30).length;
  const T = tabs([['purchases', `${ico('receipt', 'sm')}Purchases`, all.length], ['deliveries', `${ico('truck', 'sm')}Deliveries & unloading`, issues || null], ['stock', `${ico('box', 'sm')}Stock`], ['history', `${ico('history', 'sm')}History`]], tab);
  if (ROUTE.q.pu) after(() => showPurchase(ROUTE.q.pu));
  const acts = can('materials') ? `${tab === 'stock' ? btn('Record usage', 'newUsage', { icon: 'plus' }) : ''}${canMoney() ? btn('Record purchase', 'newPurchase', { icon: 'plus', cls: 'primary' }) : ''}` : '';
  const body = { purchases: matPurchases, deliveries: matDeliveries, stock: matStock, history: matHistory }[tab]();
  return `${pageHead('Materials', 'Purchases, deliveries and unloading at site, stock and history — linked to supplier bills and project expenses.', acts)}
    ${!can('materials') ? `<div class="banner">${ico('eye')}<span>You have <b>view-only</b> access to materials.</span></div>` : ''}${T}${body}`;
};
function matPurchases() {
  const { p = '', cat = '', st = '', q = '' } = ROUTE.q;
  const base = myPurchases().filter(pu => !p || pu.project === p);
  const list = base.filter(pu => (!cat || pu.category === cat) && (!st || puStatus(pu) === st) && (!q || `${pu.material} ${pu.supplier} ${pu.po} ${pu.billNo}`.toLowerCase().includes(q.toLowerCase()))).sort((a, b) => b.date.localeCompare(a.date) || b.at - a.at);
  const thisM = monthKey(TODAY), cats = [...new Set(MAT_CATALOG.map(m => m[1]))];
  return `<div class="kpis">
      ${canMoney() ? `<div class="kpi"><div class="l">${ico('rupee', 'sm')}Purchased this month</div><div class="v">${inrS(sum(base.filter(pu => pu.date.startsWith(thisM)), puTotal))}</div><div class="s">${plural(base.filter(pu => pu.date.startsWith(thisM)).length, 'purchase')} incl. GST</div></div>` : `<div class="kpi"><div class="l">${ico('box', 'sm')}Purchases this month</div><div class="v">${base.filter(pu => pu.date.startsWith(thisM)).length}</div><div class="s">material orders</div></div>`}
      <div class="kpi"><div class="l">${ico('truck', 'sm')}Awaiting delivery</div><div class="v">${base.filter(pu => ['Ordered', 'Partially received'].includes(puStatus(pu))).length}</div><div class="s">ordered or partly received</div></div>
      <div class="kpi"><div class="l">${ico('alert', 'sm')}Delivery issues</div><div class="v">${base.flatMap(pu => pu.deliveries).filter(d => d.issues.length).length}</div><div class="s">shortage, damage or rejection</div></div>
      ${canMoney() ? `<div class="kpi"><div class="l">${ico('receipt', 'sm')}Supplier dues</div><div class="v">${inrS(sum(base, pu => puTotal(pu) - pu.paid))}</div><div class="s"><a href="#/invoices?tab=supplier">supplier bills</a></div></div>` : `<div class="kpi"><div class="l">${ico('check', 'sm')}Fully received</div><div class="v">${base.filter(pu => puStatus(pu) === 'Received').length}</div><div class="s">of ${plural(base.length, 'purchase')}</div></div>`}</div>
    <div class="toolbar">${searchBox('matQ', q, 'Search material, supplier, PO')}${projSelect(p)}
      <select class="select" data-change="setQ" data-k="cat" aria-label="Category"><option value="">All categories</option>${cats.map(c => `<option ${c === cat ? 'selected' : ''}>${c}</option>`).join('')}</select>
      ${statusChips([['', 'All'], ['Ordered', 'Ordered'], ['Partially received', 'Partial'], ['Received', 'Received'], ['Rejected', 'Rejected']], st)}</div>
    <div class="card"><div class="table-wrap"><table class="t stack-sm"><thead><tr><th>Material</th><th>Project</th><th>Supplier</th><th class="r">Quantity</th>${canMoney() ? '<th class="r">Total (incl. GST)</th>' : ''}<th>Delivery</th>${canMoney() ? '<th>Bill</th>' : ''}</tr></thead><tbody>
      ${list.map(pu => `<tr class="click" data-act="showPurchase" data-id="${pu.id}"><td class="strong full"><div class="person"><span class="mat-thumb">${phThumb(pu.photos[0] || { kind: 'art', art: MAT_ART[pu.category] || 'cement' })}</span><div class="nm"><b>${esc(pu.material)}</b><span>${esc(pu.po)} · ${fmtD(pu.date)}</span></div></div></td>
        <td class="hide-sm">${esc(proj(pu.project).name)}</td><td class="hide-sm">${esc(pu.supplier)}<span class="sub">${esc(pu.billNo)}</span></td><td class="r">${qtyU(pu.qty, pu.unit)}${canMoney() ? `<span class="sub">@ ${inr(pu.rate)} + ${pu.gst}% GST</span>` : ''}</td>${canMoney() ? `<td class="r strong">${inr(puTotal(pu))}</td>` : ''}
        <td>${badge(puStatus(pu), PU_TONE[puStatus(pu)])}${pu.deliveries.some(d => d.issues.length) ? `<span class="sub" style="color:var(--warn)">${esc(pu.deliveries.flatMap(d => d.issues).map(i => i.type).join(', '))}</span>` : ''}</td>${canMoney() ? `<td class="hide-sm">${badge(supplierBillStatus(pu))}</td>` : ''}</tr>`).join('') || emptyRow(7, 'No purchases found', 'Try another filter, or record a purchase.')}
    </tbody></table></div></div>`;
}
INPUT.matQ = liveSearch('matQ');

function matDeliveries() {
  const { p = '', iss = '' } = ROUTE.q;
  const all = myPurchases().filter(pu => !p || pu.project === p);
  const rows = all.flatMap(pu => pu.deliveries.map(d => ({ pu, d }))).filter(({ d }) => !iss || (iss === 'any' ? d.issues.length : d.issues.some(i => i.type === iss))).sort((a, b) => deliveryAt(b.d) - deliveryAt(a.d));
  const expected = all.filter(pu => ['Ordered', 'Partially received'].includes(puStatus(pu))).sort((a, b) => a.date.localeCompare(b.date));
  return `<div class="toolbar">${projSelect(p)}${statusChips([['', 'All deliveries'], ['any', 'With issues'], ...ISSUE_TYPES.map(t => [t, t])], iss, 'iss')}</div>
    ${expected.length ? `<div class="card"><div class="card-head"><h2>Expected at site</h2><span class="sub">${plural(expected.length, 'purchase')} not fully received</span></div>
      <ul class="list" style="margin-top:8px">${expected.map(pu => `<li><span class="sig info">${ico('truck', 'sm')}</span><div class="main-t" data-act="showPurchase" data-id="${pu.id}" style="cursor:pointer"><b>${esc(pu.material)} · ${qtyU(pu.qty - puAccepted(pu), pu.unit)} to come</b><span>${esc(proj(pu.project).name)} · ${esc(pu.supplier)} · ordered ${relD(pu.date).toLowerCase()}</span></div>${can('materials') ? `<button class="btn xs primary" data-act="newDelivery" data-id="${pu.id}">${ico('truck', 'sm')}Record delivery</button>` : badge(puStatus(pu), PU_TONE[puStatus(pu)])}</li>`).join('')}</ul></div>` : ''}
    <div class="card"><div class="card-head"><h2>Deliveries & unloading</h2><span class="sub">Actual unloading time vs when it was recorded and when photos were uploaded</span></div>
      <div class="table-wrap" style="margin-top:12px"><table class="t stack-sm"><thead><tr><th>Delivered & unloaded</th><th>Material</th><th class="r">Received / accepted</th><th>Received by</th><th>Recorded</th><th>Photos uploaded</th><th>Status</th></tr></thead><tbody>
      ${rows.map(({ pu, d }) => `<tr class="click" data-act="showPurchase" data-id="${pu.id}"><td class="nowrap strong">${fmtD(d.date)}<span class="sub">${esc(d.unloadStart)}–${esc(d.unloadEnd)} · ${esc(d.vehicle)}</span></td><td class="full">${esc(pu.material)}<span class="sub">${esc(proj(pu.project).name)} · ${esc(pu.supplier)}</span></td>
        <td class="r">${qtyU(d.receivedQty, pu.unit)}<span class="sub">${d.acceptedQty !== d.receivedQty ? `accepted ${qtyU(d.acceptedQty, pu.unit)}` : 'all accepted'}</span></td><td class="hide-sm">${esc(userName(d.receivedBy))}</td>
        <td class="nowrap hide-sm">${fmtTs(d.recordedAt)}<span class="sub">${fmtMins((d.recordedAt - deliveryAt(d)) / 6e4)} after unloading began</span></td><td class="nowrap hide-sm">${d.photosAt ? `${fmtTs(d.photosAt)}<span class="sub">${plural(d.photos.length, 'photo')}</span>` : '<span class="muted">No photos</span>'}</td>
        <td>${badge(d.status, d.status === 'Accepted' ? 'ok' : d.status === 'Rejected' ? 'bad' : 'warn')}${d.issues.map(i => `<span class="sub">${esc(i.type)} · ${qtyU(i.qty, pu.unit)}</span>`).join('')}</td></tr>`).join('') || emptyRow(7, 'No deliveries match')}
      </tbody></table></div></div>`;
}

function matStock() {
  const ps = myProjects().filter(p => myPurchases().some(pu => pu.project === p.id));
  const p = ps.find(x => x.id === ROUTE.q.p) || ps[0];
  if (!p) return `<div class="card">${emptyPage('No materials yet', 'Record a purchase to start tracking stock.')}</div>`;
  const rows = stockRows(p.id), use = (DB.materialUse || []).filter(u => u.project === p.id).sort((a, b) => b.date.localeCompare(a.date));
  return `<div class="toolbar">${projSelect(p.id, { all: false, list: ps })}<span class="grow"></span><span class="muted" style="font-size:13px">Remaining = accepted at site − used</span></div>
    <div class="card"><div class="card-head"><h2>Stock at ${esc(p.name)}</h2><span class="sub">${plural(rows.length, 'material')}</span></div>
      <div class="table-wrap" style="margin-top:12px"><table class="t stack-sm"><thead><tr><th>Material</th><th class="r">Purchased</th><th class="r">Received</th><th class="r">Used</th><th class="r">Remaining</th><th style="min-width:150px">Stock left</th>${can('materials') ? '<th></th>' : ''}</tr></thead><tbody>
      ${rows.map(r => { const pct = r.received ? Math.round(r.left / r.received * 100) : 0; return `<tr><td class="strong full">${esc(r.material)}<span class="sub">${esc(r.category)}</span></td><td class="r">${qtyU(r.ordered, r.unit)}</td><td class="r">${qtyU(r.received, r.unit)}</td><td class="r">${qtyU(r.used, r.unit)}</td><td class="r strong">${qtyU(r.left, r.unit)}</td><td>${meter(pct, pct < 15 ? 'bad' : pct < 35 ? 'warn' : '')}</td>${can('materials') ? `<td class="r">${r.left > 0 ? `<button class="btn xs" data-act="newUsage" data-p="${p.id}" data-m="${esc(r.material)}">Use</button>` : ''}</td>` : ''}</tr>`; }).join('') || emptyRow(7, 'No stock')}
      </tbody></table></div></div>
    <div class="card"><div class="card-head"><h2>Usage log</h2><span class="sub">${plural(use.length, 'entry', 'entries')}</span></div>
      <div class="table-wrap" style="margin-top:12px"><table class="t stack-sm"><thead><tr><th>Date</th><th>Material</th><th class="r">Quantity</th><th>Used for</th><th>By</th></tr></thead><tbody>
      ${use.slice(0, 30).map(u => `<tr><td class="nowrap">${fmtD(u.date)}</td><td class="strong full">${esc(u.material)}</td><td class="r">${qtyU(u.qty, u.unit)}</td><td class="hide-sm">${esc(u.note)}</td><td class="hide-sm">${esc(userName(u.by))}</td></tr>`).join('') || emptyRow(5, 'No usage recorded')}</tbody></table></div></div>`;
}

function matHistory() {
  const p = ROUTE.q.p || '', ids = myProjectIds();
  const ev = [];
  myPurchases().filter(pu => !p || pu.project === p).forEach(pu => {
    ev.push({ t: pu.at, k: 'progress', h: `<b>${esc(userName(pu.by))}</b> recorded purchase <b>${esc(pu.po)}</b>: ${esc(pu.material)} · ${qtyU(pu.qty, pu.unit)} from ${esc(pu.supplier)}${canMoney() ? ` · ${inr(puTotal(pu))}` : ''}`, s: `${proj(pu.project).name}${canMoney() ? ` · bill ${pu.billNo}` : ''}`, id: pu.id });
    pu.deliveries.forEach(d => ev.push({ t: deliveryAt(d), k: d.issues.length ? 'delay' : 'payment', h: `Delivered & unloaded at <b>${esc(proj(pu.project).name)}</b>: ${esc(pu.material)} · received ${qtyU(d.receivedQty, pu.unit)}, accepted ${qtyU(d.acceptedQty, pu.unit)}`, s: `${d.unloadStart}–${d.unloadEnd} · received by ${userName(d.receivedBy)} · recorded ${fmtTs(d.recordedAt)}${d.photosAt ? ` · photos ${fmtTs(d.photosAt)}` : ''}${d.issues.length ? ' · ' + d.issues.map(i => `${i.type}: ${i.note}`).join('; ') : ''}`, id: pu.id }));
  });
  (DB.materialUse || []).filter(u => ids.has(u.project) && (!p || u.project === p)).forEach(u => ev.push({ t: tsOn(u.date, 17), k: 'milestone', h: `${esc(userName(u.by))} used <b>${qtyU(u.qty, u.unit)}</b> ${esc(u.material)}`, s: `${proj(u.project).name} · ${u.note}` }));
  ev.sort((a, b) => b.t - a.t);
  return `<div class="toolbar">${projSelect(p)}</div><div class="card"><div class="card-head"><h2>Purchase, delivery and usage history</h2><span class="sub">${plural(ev.length, 'event')}</span></div><div class="card-body">
    ${ev.length ? `<ul class="timeline">${ev.slice(0, ROUTE.q.all ? 300 : 40).map(e => `<li class="k-${e.k}"${e.id ? ` data-act="showPurchase" data-id="${e.id}" style="cursor:pointer"` : ''}><div class="when">${fmtTs(e.t)}</div><div class="what">${e.h}</div><div class="muted" style="font-size:13px">${esc(e.s)}</div></li>`).join('')}</ul>${!ROUTE.q.all && ev.length > 40 ? `<button class="btn sm" data-act="setQ" data-k="all" data-v="1">Show all ${ev.length}</button>` : ''}` : '<p class="muted">No history yet.</p>'}</div></div>`;
}

/* ---------- project page › Materials tab ---------- */
function projectMaterialsTab(p) {
  const pus = myPurchases().filter(pu => pu.project === p.id).sort((a, b) => b.date.localeCompare(a.date) || b.at - a.at);
  const add = can('materials') && canMoney() && p.status !== 'Completed' ? btn('Record purchase', 'newPurchase', { icon: 'plus', cls: 'sm', data: `data-p="${p.id}"` }) : '';
  if (!pus.length) return `<div class="split"><span class="muted">Material purchases, deliveries and stock for this project</span>${add}</div><div class="card">${emptyPage('No materials recorded yet', 'Purchases, deliveries and stock for this project will appear here.')}</div>`;
  const rows = stockRows(p.id), dvs = pus.flatMap(pu => pu.deliveries.map(d => ({ pu, d }))).sort((a, b) => deliveryAt(b.d) - deliveryAt(a.d));
  const tot = sum(pus, puTotal), paid = sum(pus, pu => pu.paid), waiting = pus.filter(pu => ['Ordered', 'Partially received'].includes(puStatus(pu)));
  return `<div class="split"><span class="muted">Purchases, deliveries & unloading and stock at site · <a href="#/materials?p=${p.id}">open in Materials</a></span><div class="row-acts">${can('materials') && rows.some(r => r.left > 0) ? btn('Record usage', 'newUsage', { cls: 'sm', data: `data-p="${p.id}"` }) : ''}${add}</div></div>
    <div class="kpis">
      ${canMoney() ? `<div class="kpi"><div class="l">${ico('rupee', 'sm')}Materials purchased</div><div class="v">${inrS(tot)}</div><div class="s">${plural(pus.length, 'purchase')} incl. GST</div></div>
      <div class="kpi"><div class="l">${ico('receipt', 'sm')}Due to suppliers</div><div class="v">${inrS(tot - paid)}</div><div class="s">${inrS(paid)} paid</div></div>` : `<div class="kpi"><div class="l">${ico('box', 'sm')}Purchases</div><div class="v">${pus.length}</div><div class="s">material orders</div></div><div class="kpi"><div class="l">${ico('check', 'sm')}Fully received</div><div class="v">${pus.filter(pu => puStatus(pu) === 'Received').length}</div><div class="s">of ${plural(pus.length, 'purchase')}</div></div>`}
      <div class="kpi"><div class="l">${ico('truck', 'sm')}Awaiting delivery</div><div class="v">${waiting.length}</div><div class="s">${waiting.map(pu => esc(pu.material.split(' –')[0])).slice(0, 2).join(', ') || 'all received'}</div></div>
      <div class="kpi"><div class="l">${ico('alert', 'sm')}Delivery issues</div><div class="v">${dvs.filter(x => x.d.issues.length).length}</div><div class="s">shortage, damage or rejection</div></div></div>
    <div class="card"><div class="card-head"><h2>Stock at site</h2><span class="sub">Remaining = accepted at site − used</span><a class="btn ghost sm" href="#/materials?tab=stock&p=${p.id}">Usage log</a></div>
      <div class="table-wrap" style="margin-top:12px"><table class="t stack-sm"><thead><tr><th>Material</th><th class="r">Purchased</th><th class="r">Received</th><th class="r">Used</th><th class="r">Remaining</th><th style="min-width:150px">Stock left</th></tr></thead><tbody>
      ${rows.map(r => { const pct = r.received ? Math.round(r.left / r.received * 100) : 0; return `<tr><td class="strong full">${esc(r.material)}<span class="sub">${esc(r.category)}</span></td><td class="r">${qtyU(r.ordered, r.unit)}</td><td class="r">${qtyU(r.received, r.unit)}</td><td class="r">${qtyU(r.used, r.unit)}</td><td class="r strong">${qtyU(r.left, r.unit)}</td><td>${meter(pct, pct < 15 ? 'bad' : pct < 35 ? 'warn' : '')}</td></tr>`; }).join('')}
      </tbody></table></div></div>
    <div class="card"><div class="card-head"><h2>Purchases</h2><span class="sub">${plural(pus.length, 'purchase')}${canMoney() ? ` · ${inr(tot)}` : ''}</span></div>
      <div class="table-wrap" style="margin-top:12px"><table class="t stack-sm"><thead><tr><th>Material</th><th>Supplier</th><th class="r">Quantity</th>${canMoney() ? '<th class="r">Total</th>' : ''}<th>Delivery</th>${canMoney() ? '<th>Bill</th>' : ''}</tr></thead><tbody>
      ${pus.map(pu => `<tr class="click" data-act="showPurchase" data-id="${pu.id}"><td class="strong full"><div class="person"><span class="mat-thumb">${phThumb(pu.photos[0] || { kind: 'art', art: MAT_ART[pu.category] || 'cement' })}</span><div class="nm"><b>${esc(pu.material)}</b><span>${esc(pu.po)} · ${fmtD(pu.date)}</span></div></div></td>
        <td class="hide-sm">${esc(pu.supplier)}<span class="sub">${esc(pu.billNo)}</span></td><td class="r">${qtyU(pu.qty, pu.unit)}${canMoney() ? `<span class="sub">@ ${inr(pu.rate)} + ${pu.gst}%</span>` : ''}</td>${canMoney() ? `<td class="r strong">${inr(puTotal(pu))}</td>` : ''}
        <td>${badge(puStatus(pu), PU_TONE[puStatus(pu)])}${pu.deliveries.some(d => d.issues.length) ? `<span class="sub" style="color:var(--warn)">${esc(pu.deliveries.flatMap(d => d.issues).map(i => i.type).join(', '))}</span>` : ''}</td>${canMoney() ? `<td class="hide-sm">${badge(supplierBillStatus(pu))}</td>` : ''}</tr>`).join('')}
      </tbody></table></div></div>
    <div class="card"><div class="card-head"><h2>Deliveries & unloading</h2><span class="sub">Actual unloading time, when it was recorded and when photos were uploaded</span></div>
      <div class="table-wrap" style="margin-top:12px"><table class="t stack-sm"><thead><tr><th>Delivered & unloaded</th><th>Material</th><th class="r">Received / accepted</th><th>Received by</th><th>Recorded</th><th>Photos</th><th>Status</th></tr></thead><tbody>
      ${dvs.map(({ pu, d }) => `<tr class="click" data-act="showPurchase" data-id="${pu.id}"><td class="nowrap strong">${fmtD(d.date)}<span class="sub">${esc(d.unloadStart)}–${esc(d.unloadEnd)} · ${esc(d.vehicle)}</span></td><td class="full">${esc(pu.material)}<span class="sub">${esc(pu.supplier)}</span></td>
        <td class="r">${qtyU(d.receivedQty, pu.unit)}<span class="sub">${d.acceptedQty !== d.receivedQty ? `accepted ${qtyU(d.acceptedQty, pu.unit)}` : 'all accepted'}</span></td><td class="hide-sm">${esc(userName(d.receivedBy))}</td>
        <td class="nowrap hide-sm">${fmtTs(d.recordedAt)}</td><td class="hide-sm">${d.photos.length ? `<span class="sv-thumbs">${d.photos.slice(0, 2).map(ph => `<span>${phThumb(ph)}</span>`).join('')}</span>` : '<span class="muted">—</span>'}</td>
        <td>${badge(d.status, d.status === 'Accepted' ? 'ok' : d.status === 'Rejected' ? 'bad' : 'warn')}${d.issues.map(i => `<span class="sub">${esc(i.type)} · ${qtyU(i.qty, pu.unit)}</span>`).join('')}</td></tr>`).join('') || emptyRow(7, 'No deliveries yet')}
      </tbody></table></div></div>`;
}

/* ---------- purchase details ---------- */
function showPurchase(id) {
  const pu = (DB.purchases || []).find(x => x.id === id); if (!pu) return;
  const p = proj(pu.project), tot = puTotal(pu), e = DB.expenses.find(x => x.id === pu.expense), ok = can('materials');
  openDrawer(`${esc(pu.material)}`, `${esc(pu.po)} · ${esc(p.name)}`, `
    <div class="split">${badge(puStatus(pu), PU_TONE[puStatus(pu)])}${canMoney() ? badge(supplierBillStatus(pu)) : ''}</div>
    <dl class="dl"><div><dt>Supplier</dt><dd>${esc(pu.supplier)}</dd></div>${canMoney() ? `<div><dt>Bill number</dt><dd>${esc(pu.billNo)}</dd></div>` : `<div><dt>Purchase order</dt><dd>${esc(pu.po)}</dd></div>`}
      <div><dt>Purchase date</dt><dd>${fmtDY(pu.date)}</dd></div><div><dt>Recorded</dt><dd>${fmtTs(pu.at)} · ${esc(userName(pu.by))}</dd></div>
      <div><dt>Quantity</dt><dd>${qtyU(pu.qty, pu.unit)} · ${esc(pu.category)}</dd></div>${canMoney() ? `<div><dt>Unit price</dt><dd>${inr(pu.rate)} + ${pu.gst}% GST</dd></div>
      <div><dt>Total cost</dt><dd>${inr(tot)}</dd></div><div><dt>Paid</dt><dd>${inr(pu.paid)}${tot - pu.paid > 0 ? ` <span class="muted">· ${inr(tot - pu.paid)} due</span>` : ''}</dd></div>` : `<div><dt>Status</dt><dd>${esc(puStatus(pu))}</dd></div>`}</dl>
    ${canMoney() ? `<div class="link-row">${e && canSee('finance') ? `<a href="#/finance?tab=expenses&p=${pu.project}">${ico('wallet', 'sm')}Project expense · ${inr(e.amount)}</a>` : ''}${canSee('invoices') ? `<a href="#/invoices?tab=supplier&inv=${pu.id}">${ico('invoice', 'sm')}Supplier bill ${esc(pu.billNo)}</a>` : ''}</div>` : ''}
    <div class="grid ${canMoney() ? 'g2' : ''}" style="gap:16px">${canMoney() ? `<div><h3>Bill</h3>${photoStrip(pu.billPhotos, { empty: 'No bill photo' })}</div>` : ''}<div><h3>Purchase photos</h3>${photoStrip(pu.photos, { empty: 'No photos' })}</div></div>
    <div><div class="split" style="margin-bottom:10px"><h3 style="margin:0">Deliveries & unloading</h3>${ok && puStatus(pu) !== 'Received' ? `<button class="btn xs" data-act="newDelivery" data-id="${pu.id}">${ico('plus', 'sm')}Record delivery</button>` : ''}</div>
      ${pu.deliveries.length ? pu.deliveries.map(d => `<div class="dv">
        <div class="split"><b>${fmtLong(d.date)}</b>${badge(d.status, d.status === 'Accepted' ? 'ok' : d.status === 'Rejected' ? 'bad' : 'warn')}</div>
        <div class="dv-times"><div><span>${ico('truck', 'sm')}Delivered & unloaded</span><b>${esc(d.unloadStart)} – ${esc(d.unloadEnd)}</b></div><div><span>${ico('edit', 'sm')}Record created</span><b>${fmtTs(d.recordedAt)}</b><small>${fmtMins((d.recordedAt - deliveryAt(d)) / 6e4)} after unloading began · ${esc(userName(d.recordedBy))}</small></div><div><span>${ico('camera', 'sm')}Photos uploaded</span><b>${d.photosAt ? fmtTs(d.photosAt) : '—'}</b>${d.photosAt ? `<small>${fmtMins((d.photosAt - deliveryAt(d)) / 6e4)} after unloading began</small>` : ''}</div></div>
        <div class="kv-row"><span>Vehicle</span><b>${esc(d.vehicle)}</b></div><div class="kv-row"><span>Received / accepted</span><b>${qtyU(d.receivedQty, pu.unit)} / ${qtyU(d.acceptedQty, pu.unit)}</b></div><div class="kv-row"><span>Received by</span><b>${esc(userName(d.receivedBy))}</b></div>
        ${d.issues.map(i => `<div class="form-note" style="margin-top:8px">${ico('alert', 'sm')}<span><b>${esc(i.type)} · ${qtyU(i.qty, pu.unit)}</b> — ${esc(i.note)}</span></div>`).join('')}
        ${d.note ? `<p class="muted" style="font-size:13px;margin-top:6px">${esc(d.note)}</p>` : ''}
        <div style="margin-top:10px">${photoStrip(d.photos, { empty: 'No delivery photos yet' })}</div>${ok ? `<button class="btn xs" style="margin-top:8px" data-act="dvPhotos" data-id="${pu.id}" data-d="${d.id}">${ico('camera', 'sm')}Add unloading photos</button>` : ''}</div>`).join('') : '<p class="muted">Not delivered yet.</p>'}</div>
    <div><h3>Used at site</h3>${(() => { const u = (DB.materialUse || []).filter(x => x.project === pu.project && x.material === pu.material); return u.length ? u.map(x => `<div class="kv-row"><span>${fmtD(x.date)} · ${esc(x.note)}</span><b>${qtyU(x.qty, x.unit)}</b></div>`).join('') : '<p class="muted">No usage recorded for this material yet.</p>'; })()}</div>`,
    `${canPayBills() && tot > pu.paid ? `<button class="btn left" data-act="payInv" data-kind="supplier" data-id="${pu.id}">${ico('rupee', 'sm')}Record payment</button>` : ''}<button class="btn primary" data-act="closeDrawer">Done</button>`);
}
ACT.showPurchase = el => showPurchase(el.dataset.id);
$('#drawer').addEventListener('close', () => { if (ROUTE.q.pu) { const q = { ...ROUTE.q }; delete q.pu; history.replaceState(null, '', `#/${[ROUTE.mod, ...ROUTE.parts].join('/')}${Object.keys(q).length ? '?' + new URLSearchParams(q) : ''}`); ROUTE = parseRoute(); } });

/* ---------- forms ---------- */
ACT.newPurchase = el => {
  if (!guard(can('materials') && canMoney(), 'record purchases with prices')) return;
  const ps = myProjects().filter(p => !['Completed'].includes(p.status));
  const m0 = MAT_CATALOG[0];
  openModal({ title: 'Record material purchase', sub: 'Creates a supplier bill and a project expense automatically.', wide: true, body: `<div class="form">
    <div class="row2">${fld('Project', 'project', { opts: projOpts(ps), value: el?.dataset?.p || ROUTE.q.p })}${fld('Material', 'material', { opts: MAT_CATALOG.map(m => [m[0], `${m[0]} · ${m[1]}`]), value: m0[0] })}</div>
    <div class="row3">${fld('Supplier', 'supplier', { req: true, value: m0[5] })}${fld('Bill number', 'billNo', { req: true, ph: 'e.g. SLT/2231' })}${fld('Purchase date', 'date', { type: 'date', value: TODAY })}</div>
    <div class="row3">${fld('Quantity', 'qty', { type: 'number', req: true, min: 0, step: 'any', hint: `<span data-unit>${m0[2]}</span>` })}${fld('Unit price (₹, before GST)', 'rate', { type: 'number', req: true, value: m0[3], min: 0, step: 'any' })}${fld('GST %', 'gst', { opts: GST_RATES.map(g => [g, `${g}%`]), value: m0[4] })}</div>
    <div class="form-note" id="puCalc">${ico('rupee', 'sm')}<span>Enter quantity and price</span></div>
    <div class="row2">${fld('Paid now (₹)', 'paid', { type: 'number', value: 0, min: 0, hint: 'Leave 0 for credit purchases' })}${fld('Note', 'note', { ph: 'Optional' })}</div>
    <div class="row2">${photoInput('puBill', { label: 'Bill / invoice photo', sample: 'bill', camera: true })}${photoInput('puPh', { label: 'Purchase photos', sample: 'material', camera: true })}</div></div>`,
    onOpen: m => {
      const f = n => $(`[name=${n}]`, m);
      const calc = () => { const cat = MAT_CATALOG.find(x => x[0] === f('material').value), q = +f('qty').value || 0, r = +f('rate').value || 0, g = +f('gst').value || 0; $('[data-unit]', m).textContent = cat?.[2] || ''; $('#puCalc span', m).innerHTML = q && r ? `${num(q)} ${cat?.[2] || ''} × ${inr(r)} = ${inr(q * r)} + GST ${inr(q * r * g / 100)} = <b>${inr(q * r * (1 + g / 100))}</b>` : 'Enter quantity and price'; };
      f('material').addEventListener('change', () => { const c = MAT_CATALOG.find(x => x[0] === f('material').value); f('rate').value = c[3]; f('gst').value = c[4]; f('supplier').value = c[5]; calc(); });
      ['qty', 'rate', 'gst'].forEach(n => f(n).addEventListener('input', calc)); f('gst').addEventListener('change', calc);
    },
    onSubmit: d => {
      const c = MAT_CATALOG.find(x => x[0] === d.material), fy = fyOf(d.date);
      if (d.date > TODAY) { toast('The purchase date cannot be in the future', 'lock'); return false; }
      const n = (DB.purchases || []).filter(x => x.po.includes(`/${fy}/`)).length + 41;
      const pu = { id: nid('pu'), po: `PO/${fy}/${String(n + 1).padStart(4, '0')}`, project: d.project, material: c[0], category: c[1], unit: c[2], qty: +d.qty, rate: +d.rate, gst: +d.gst, supplier: d.supplier, date: d.date, billNo: d.billNo, by: SESSION, at: Date.now(), billPhotos: takePicks('puBill'), photos: takePicks('puPh'), paid: 0, deliveries: [], expense: null, note: d.note };
      pu.paid = Math.min(+d.paid || 0, puTotal(pu));
      const e = { id: nid('e'), project: d.project, date: d.date, category: 'Materials', item: `${c[0]} – ${num(pu.qty)} ${c[2]}`, vendor: d.supplier, amount: puTotal(pu), mode: 'Supplier bill', by: SESSION, purchase: pu.id };
      DB.expenses.unshift(e); pu.expense = e.id; (DB.purchases ||= []).unshift(pu);
      logAct(`recorded a purchase of ${c[0]} (${qtyU(pu.qty, c[2])}) for ${inr(puTotal(pu))}`, d.project, 'payment');
      commit(`Purchase ${pu.po} recorded · added to project expenses and supplier bills`);
    } });
};
ACT.newDelivery = el => {
  const pu = DB.purchases.find(x => x.id === el.dataset.id), p = proj(pu.project); closeDrawer();
  if (!guard(can('materials'), 'record deliveries')) return;
  const left = roundQ(pu.qty - puAccepted(pu)), now = new Date();
  const start = `${pad(Math.max(7, now.getHours() - 1))}:${pad(now.getMinutes())}`;
  openModal({ title: 'Record delivery & unloading', sub: `${esc(pu.material)} · ${esc(pu.po)} · ${esc(p.name)}`, wide: true, body: `<div class="form">
    <div class="form-note">${ico('box', 'sm')}<span>Ordered <b>${qtyU(pu.qty, pu.unit)}</b> from ${esc(pu.supplier)} on ${fmtD(pu.date)} · <b>${qtyU(left, pu.unit)}</b> still to receive</span></div>
    <div class="row3">${fld('Delivery date', 'date', { type: 'date', req: true, value: TODAY })}${fld('Unloading started', 'start', { type: 'time', req: true, value: start })}${fld('Unloading finished', 'end', { type: 'time', req: true, value: `${pad(now.getHours())}:${pad(now.getMinutes())}` })}</div>
    <div class="row3">${fld(`Quantity received (${pu.unit})`, 'received', { type: 'number', req: true, value: left, min: 0, step: 'any' })}${fld('Vehicle number', 'vehicle', { ph: 'TN 51 AB 1234' })}${fld('Received by', 'receivedBy', { opts: sitePeople(p).map(u => [u, userName(u)]), value: sitePeople(p).includes(SESSION) ? SESSION : p.supervisor })}</div>
    <div class="row3">${fld('Issue', 'issue', { opts: [['', 'No issues'], ...ISSUE_TYPES] })}${fld(`Issue quantity (${pu.unit})`, 'issueQty', { type: 'number', value: '', min: 0, step: 'any', hint: 'Short, damaged or rejected quantity' })}${fld('Issue details', 'issueNote', { ph: 'e.g. 6 bags torn and wet' })}</div>
    ${photoInput('dvPh', { label: 'Delivery & unloading photos', sample: 'material', camera: true })}
    ${fld('Note', 'note', { ph: 'Optional' })}
    ${demoNote('The delivery and unloading time you enter is kept separately from the time this record is created and the time photos are uploaded.')}</div>`,
    onSubmit: d => {
      if (d.date > TODAY) { toast('The delivery date cannot be in the future', 'lock'); return false; }
      if (d.end < d.start) { toast('Unloading must finish after it starts', 'lock'); return false; }
      const rec = +d.received || 0, iq = +d.issueQty || 0;
      if (d.issue && !iq && d.issue !== 'Rejected') { toast('Enter the issue quantity', 'lock'); return false; }
      if (d.issue && !d.issueNote) { toast('Describe the issue', 'lock'); return false; }
      if (iq > rec && d.issue === 'Damaged') { toast('Damaged quantity cannot exceed the quantity received', 'lock'); return false; }
      const rejected = d.issue === 'Rejected', accepted = rejected ? 0 : d.issue === 'Damaged' ? rec - iq : rec;
      const photos = takePicks('dvPh'), now = Date.now();
      const dv = { id: nid('dv'), date: d.date, unloadStart: d.start, unloadEnd: d.end, vehicle: d.vehicle || '—', receivedQty: rec, acceptedQty: roundQ(accepted), receivedBy: d.receivedBy, issues: d.issue ? [{ type: d.issue, qty: rejected ? rec : iq, note: d.issueNote }] : [],
        status: rejected ? 'Rejected' : d.issue ? 'Accepted with issues' : 'Accepted', photos, recordedAt: now, recordedBy: SESSION, photosAt: photos.length ? now : null, note: d.note };
      pu.deliveries.push(dv);
      if (d.issue) notify([p.pm, ...usersWithRole('accounts')], `Delivery issue at ${p.name}: ${d.issue.toLowerCase()} — ${pu.material} (${d.issueNote})`, `#/materials?tab=deliveries&pu=${pu.id}`, 'material');
      logAct(`recorded delivery of ${pu.material} (${qtyU(rec, pu.unit)}${d.issue ? `, ${d.issue.toLowerCase()}` : ''})`, pu.project, 'site');
      commit(`Delivery recorded · ${qtyU(accepted, pu.unit)} accepted into stock`);
    } });
};
ACT.dvPhotos = el => {
  const pu = DB.purchases.find(x => x.id === el.dataset.id), dv = pu.deliveries.find(x => x.id === el.dataset.d); closeDrawer();
  openModal({ title: 'Add unloading photos', sub: `${esc(pu.material)} · delivered ${fmtD(dv.date)} ${esc(dv.unloadStart)}`, body: `<div class="form">${photoInput('dvMore', { label: 'Photos', req: true, sample: 'material', camera: true })}${demoNote('The upload time is recorded now, separately from the actual delivery time.')}</div>`,
    onSubmit: () => { const ph = takePicks('dvMore'); if (!ph.length) { toast('Add at least one photo', 'lock'); return false; } dv.photos.push(...ph); dv.photosAt = Date.now(); logAct(`added ${plural(ph.length, 'unloading photo')} for ${pu.material}`, pu.project, 'site'); commit(`${plural(ph.length, 'photo')} added · uploaded ${fmtMins((dv.photosAt - deliveryAt(dv)) / 6e4)} after delivery`); setTimeout(() => showPurchase(pu.id), 60); } });
};
ACT.newUsage = el => {
  if (!guard(can('materials'), 'record material usage')) return;
  const pid = el?.dataset?.p || ROUTE.q.p || myProjects().find(p => myPurchases().some(pu => pu.project === p.id))?.id;
  if (!pid) { toast('Record a purchase first', 'lock'); return; }
  const p = proj(pid), rows = stockRows(pid).filter(r => r.left > 0);
  if (!rows.length) { toast(`No stock left at ${p.name}`, 'lock'); return; }
  const lv = projLevels(p);
  openModal({ title: 'Record material usage', sub: esc(p.name), body: `<div class="form">
    ${fld('Material', 'material', { opts: rows.map(r => [r.material, `${r.material} · ${qtyU(r.left, r.unit)} left`]), value: el?.dataset?.m })}
    <div class="row2">${fld('Quantity used', 'qty', { type: 'number', req: true, min: 0, step: 'any' })}${fld('Date', 'date', { type: 'date', value: TODAY })}</div>
    <div class="row2">${fld('Floor / zone', 'floor', { opts: [['', 'General / site'], ...lv.map(f => [f.id, f.name])] })}${fld('Used for', 'note', { req: true, ph: 'e.g. First floor plastering' })}</div></div>`,
    onSubmit: d => {
      const r = rows.find(x => x.material === d.material);
      if (+d.qty > r.left + 1e-6) { toast(`Only ${qtyU(r.left, r.unit)} left in stock`, 'lock'); return false; }
      const f = lv.find(x => x.id === d.floor);
      (DB.materialUse ||= []).unshift({ id: nid('mu'), project: pid, material: d.material, unit: r.unit, date: d.date, qty: +d.qty, floor: d.floor || null, note: f ? `${d.note} – ${f.name}` : d.note, by: SESSION });
      logAct(`used ${qtyU(+d.qty, r.unit)} ${d.material}`, pid, 'site'); commit(`Usage recorded · ${qtyU(r.left - +d.qty, r.unit)} left`);
    } });
};
