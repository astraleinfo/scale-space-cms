/* Settings › Dropdown values. Each editable list points at the array (or object) the forms already read, so a saved
   change shows up in every form and filter at once. Lists are saved in browser storage apart from the daily demo
   data, so they survive the nightly reseed and "Reset demo data"; renames are re-applied to the sample records.
   Values the app's logic depends on are locked (they can't be renamed or removed), and status lists that drive
   workflows are shown read-only. */
'use strict';

IC.sliders = '<path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0"/><circle cx="16" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="18" r="2"/>';
MODULES.push({ id: 'settings', label: 'Settings', icon: 'sliders', group: 'Admin' });
Object.assign(PERMS.owner, { settings: 'edit' }); Object.assign(PERMS.admin, { settings: 'edit' }); Object.assign(PERMS.sysadmin, { settings: 'edit' }); Object.assign(PERMS.pm, { settings: 'view' });
['engineer', 'supervisor', 'accounts'].forEach(r => PERMS[r].settings = 'none');
ACTIONS.splice(ACTIONS.length - 1, 0, ['Manage dropdown values', r => ['owner', 'sysadmin', 'admin'].includes(r)]);

const all = (list, field) => () => (list() || []).map(o => [o, field]);
// kind: list (text values) · numbers · allowance ([name, days per year or null]) · catalog ([name, category, unit, rate, GST %, supplier])
const LIST_DEFS = [
  { group: 'Projects & site', key: 'projectTypes', label: 'Project types', ref: PROJECT_TYPES, locked: ['Interior fit-out'], used: 'New project, project filters, enquiries', refs: () => [...all(() => DB.projects, 'type')(), ...all(() => DB.enquiries, 'type')()], why: { 'Interior fit-out': 'Uses zones instead of floors' } },
  { group: 'Projects & site', key: 'noteKinds', label: 'Project note types', ref: NOTE_KINDS, used: 'Project › Notes', refs: all(() => DB.notes, 'kind') },
  { group: 'Projects & site', key: 'trades', label: 'Worker categories', ref: TRADE_LIST, used: 'Worker register, daily report crew', refs: () => [...all(() => DB.workers, 'trade')(), ...DB.reports.flatMap(r => r.crew.map(c => [c, 'trade']))] },
  { group: 'Projects & site', key: 'contractors', label: 'Engaged through (labour contractors)', ref: CONTRACTORS, locked: ['Direct'], used: 'Worker register', refs: all(() => DB.workers, 'contractor') },
  { group: 'Projects & site', key: 'workCats', label: 'Work categories', ref: WORK_CATS, used: 'Daily report work items', refs: () => DB.reports.flatMap(r => r.work.map(w => [w, 'category'])) },
  { group: 'Projects & site', key: 'units', label: 'Units of measure', ref: UNITS, used: 'Daily report quantities', refs: () => DB.reports.flatMap(r => r.work.map(w => [w, 'unit'])) },
  { group: 'Projects & site', key: 'weather', label: 'Weather', ref: WEATHER_OPTS, used: 'Daily reports', refs: all(() => DB.reports, 'weather') },
  { group: 'Projects & site', key: 'stopReasons', label: 'Work stoppage reasons', ref: STOP_REASONS, used: 'Record stoppage, stoppage filters and reports', refs: all(() => DB.delays, 'reason') },
  { group: 'Projects & site', key: 'missedReasons', label: 'Missed report reasons', ref: MISSED_REASONS, used: 'Ask office to upload a report', refs: all(() => DB.reportRequests, 'reason') },
  { group: 'Projects & site', key: 'serviceTypes', label: 'Service activity types', ref: SERVICE_TYPES, used: 'Service history', refs: all(() => DB.services, 'type') },
  { group: 'Materials', key: 'catalog', money: true, label: 'Material catalogue', kind: 'catalog', ref: MAT_CATALOG, used: 'Record purchase (pre-fills unit, rate, GST and supplier), material filters', refs: () => [...all(() => DB.purchases, 'material')(), ...all(() => DB.materialUse, 'material')()] },
  { group: 'Materials', key: 'issueTypes', label: 'Delivery issue types', ref: ISSUE_TYPES, locked: ['Shortage', 'Damaged', 'Incorrect quantity', 'Rejected'], used: 'Record delivery', refs: () => (DB.purchases || []).flatMap(pu => pu.deliveries.flatMap(d => d.issues.map(i => [i, 'type']))), why: { Rejected: 'Rejects the whole load', Damaged: 'Reduces the accepted quantity', Shortage: 'Reduces the received quantity', 'Incorrect quantity': 'Reduces the received quantity' } },
  { group: 'Materials', key: 'gst', money: true, label: 'GST rates (%)', kind: 'numbers', ref: GST_RATES, used: 'Record purchase, client invoices' },
  { group: 'Team', key: 'leaveTypes', label: 'Leave types & yearly allowance', kind: 'allowance', ref: LEAVE_TYPES, used: 'Apply for leave, leave balances', refs: all(() => DB.leaves, 'type') },
  { group: 'Team', key: 'corrTypes', label: 'Attendance correction types', ref: CORR_TYPES, used: 'Request an attendance correction', refs: all(() => DB.attRequests, 'type') },
  { group: 'Team', key: 'relations', label: 'Alternate contact relationships', ref: RELATIONS, used: 'Invite / edit user › Alternate contact', refs: () => (DB.users || []).filter(u => u.alt).map(u => [u.alt, 'rel']) },
  { group: 'Team', key: 'feedback', label: 'Feedback types', ref: FEEDBACK_KINDS, locked: ['Appreciation'], used: 'Performance › Add feedback', refs: all(() => DB.feedback, 'kind') },
  { group: 'Finance', key: 'payIn', money: true, label: 'Client payment modes', ref: PAY_MODES_IN, used: 'Record client payment, receipts', refs: all(() => DB.payments, 'mode') },
  { group: 'Finance', key: 'payOut', money: true, label: 'Outgoing payment modes', ref: PAY_MODES_OUT, used: 'Site expenses, contractor and supplier payments', refs: all(() => DB.expenses, 'mode') },
  { group: 'Finance', key: 'expCats', money: true, label: 'Expense categories', ref: EXP_CATS, locked: ['Materials', 'Site misc.'], used: 'Add site expense, expense filters and reports', refs: all(() => DB.expenses, 'category'), why: { Materials: 'Material purchases are filed here', 'Site misc.': 'Service costs are filed here' } },
  { group: 'Finance', key: 'advReasons', money: true, label: 'Salary advance reasons', ref: ADVANCE_REASONS, used: 'Give salary advance', refs: all(() => DB.advances, 'reason') },
  { group: 'Finance', key: 'revReasons', money: true, label: 'Salary revision reasons', ref: REVISION_REASONS, locked: ['Annual appraisal', 'Promotion'], used: 'Revise salary', refs: all(() => DB.salary, 'reason'), why: { 'Annual appraisal': 'Counted as the yearly increment', Promotion: 'Highlighted in salary history' } },
  { group: 'Finance', key: 'bonusTypes', money: true, label: 'Bonus types', ref: BONUS_TYPES, used: 'Add bonus', refs: all(() => DB.bonuses, 'type') },
  { group: 'Sales', key: 'sources', label: 'Enquiry sources', ref: ENQ_SOURCES, used: 'New enquiry, enquiry filters, reports', refs: all(() => DB.enquiries, 'source') },
  { group: 'Sales', key: 'lost', label: 'Reasons an enquiry is lost', ref: LOST_REASONS, used: 'Mark enquiry as lost' },
  { group: 'Documents', key: 'docCats', label: 'Document categories', ref: DOC_CATS, locked: [...DRAWING_CATS, 'Approvals', 'Contracts', 'Invoices'], used: 'Upload documents, document folders', refs: all(() => DB.documents, 'category'), why: { ...Object.fromEntries(DRAWING_CATS.map(c => [c, 'Revisions need approval'])), Approvals: 'Revisions need approval', Contracts: 'Revisions need approval', Invoices: 'Bill photos are filed here' } },
];
const kindOf = d => d.kind || 'list';
const listValues = d => kindOf(d) === 'allowance' ? Object.entries(d.ref).map(([k, v]) => [k, v]) : d.ref.map(v => Array.isArray(v) ? [...v] : v);
const nameOf = (d, v) => ['allowance', 'catalog'].includes(kindOf(d)) ? String(v[0]) : String(v);
function setList(d, values) {
  if (kindOf(d) === 'allowance') { Object.keys(d.ref).forEach(k => delete d.ref[k]); values.forEach(([k, v]) => d.ref[k] = v); }
  else d.ref.splice(0, d.ref.length, ...values.map(v => Array.isArray(v) ? [...v] : v));
}
LIST_DEFS.forEach(d => d.defaults = JSON.parse(JSON.stringify(listValues(d))));

/* saved settings: { key: { values, renames: [[from, to], …] } } */
const LISTS_KEY = KEY + '-lists';
let LIST_CFG = (() => { try { return JSON.parse(store.get(LISTS_KEY) || '{}') || {}; } catch { return {}; } })();
const saveCfg = () => store.set(LISTS_KEY, JSON.stringify(LIST_CFG));
function renameRecords(d, pairs) {
  if (!d.refs || !pairs.length || !DB) return 0;
  let n = 0;
  d.refs().forEach(([o, f]) => pairs.forEach(([from, to]) => { if (o[f] === from) { o[f] = to; n++; } }));
  return n;
}
// the sample data is always built from the default lists, then saved settings are applied on top
const _buildSeed = buildSeed;
buildSeed = function () { LIST_DEFS.forEach(d => setList(d, JSON.parse(JSON.stringify(d.defaults)))); return _buildSeed(); };
LOAD_HOOKS.push(() => LIST_DEFS.forEach(d => { const c = LIST_CFG[d.key]; if (!c) return; setList(d, c.values); renameRecords(d, c.renames || []); }));
const usage = (d, name) => d.refs ? d.refs().filter(([o, f]) => o[f] === name).length : null;

/* ================= page ================= */
let ED = null; // { key, rows: [{ orig, v }], dirty }
// financial lists (rates, GST, payment modes, expense categories) are only shown to roles with financial access
const visibleLists = () => LIST_DEFS.filter(d => !d.money || canMoney());
const defOf = k => visibleLists().find(d => d.key === k);
const addNoun = d => ({ catalog: 'material', allowance: 'leave type', numbers: 'rate' })[kindOf(d)] || 'value';
function startEdit(d) { ED = { key: d.key, rows: listValues(d).map(v => ({ orig: nameOf(d, v), v })), dirty: false }; }

const GROUP_ICO = { 'Projects & site': 'building', Materials: 'box', Team: 'users', Finance: 'rupee', Sales: 'enquiry', Documents: 'folder' };
VIEWS.settings = () => {
  const d = defOf(ROUTE.q.l) || visibleLists()[0];
  if (!ED || ED.key !== d.key) startEdit(d);
  const groups = {}; visibleLists().forEach(x => (groups[x.group] ||= []).push(x));
  const custom = visibleLists().filter(x => LIST_CFG[x.key]).length;
  return `<div class="svx">${pageHead('Settings', 'Dropdown choices used across the app — edit a list and every form updates')}
    ${!can('settings') ? `<div class="banner">${ico('eye')}<span>You have <b>view-only</b> access to settings.</span></div>` : ''}
    <div class="sv-layout">
      <aside class="card sv-nav" aria-label="Lists">
        <div class="sv-nav-h"><b>Dropdown lists</b><span>${visibleLists().length} lists${custom ? ` · ${custom} customised` : ''}</span></div>
        <div class="inline-search">${ico('search', 'sm')}<input class="input" type="search" placeholder="Find a list" data-input="setFind" aria-label="Find a list"></div>
        ${Object.entries(groups).map(([g, xs]) => `<div class="sv-g"><div class="sv-gl">${ico(GROUP_ICO[g] || 'folder', 'sm')}${esc(g)}</div>${xs.map(x => `<button type="button" class="sv-item ${x.key === d.key ? 'on' : ''}" data-act="setPick" data-k="${x.key}" data-s="${esc(x.label.toLowerCase())}" ${x.key === d.key ? 'aria-current="true"' : ''}><span>${esc(x.label)}</span>${LIST_CFG[x.key] ? '<i class="sv-dot" title="Changed from the defaults"></i>' : ''}<small>${listValues(x).length}</small></button>`).join('')}</div>`).join('')}
      </aside>
      <section class="card sv-ed">${editorPanel(d)}</section>
    </div></div>`;
};
INPUT.setFind = el => { const q = el.value.toLowerCase().trim(); $$('.sv-item').forEach(b => b.hidden = q && !b.dataset.s.includes(q)); $$('.sv-g').forEach(g => g.hidden = !$$('.sv-item:not([hidden])', g).length); };
function editorPanel(d) {
  const ok = can('settings'), k = kindOf(d), locked = new Set(d.locked || []);
  const names = ED.rows.map(r => nameOf(d, r.v).trim().toLowerCase());
  const dup = i => names[i] && names.indexOf(names[i]) !== i;
  const ro = (r, name = false) => !ok || (name && locked.has(r.orig)) ? 'readonly' : '';
  // small notes under a value: new, renamed, duplicate
  const notes = (r, i) => { const nm = nameOf(d, r.v).trim(); const n = [r.orig == null ? '<span class="sv-tag new">New</span>' : r.orig !== nm ? `<span class="sv-tag ren">Renamed from “${esc(r.orig)}”</span>` : '', dup(i) ? '<span class="sv-tag bad">Duplicate</span>' : ''].join(''); return n ? `<span class="sv-notes">${n}</span>` : ''; };
  const use = r => { const u = r.orig != null ? usage(d, r.orig) : null, lk = locked.has(r.orig);
    return `${lk ? `<span class="sv-req" title="${esc(d.why?.[r.orig] || 'Required by the app')}">${ico('lock', 'sm')}Required</span>` : ''}${u ? `<span class="sv-use">${plural(u, 'record')}</span>` : ''}`; };
  const acts = (r, i) => !ok ? '' : `<span class="sv-acts"><button type="button" class="sv-ib" data-act="setMove" data-i="${i}" data-dir="-1" aria-label="Move up" title="Move up" ${i ? '' : 'disabled'}>${ico('chevD', 'sm')}</button><button type="button" class="sv-ib dn" data-act="setMove" data-i="${i}" data-dir="1" aria-label="Move down" title="Move down" ${i < ED.rows.length - 1 ? '' : 'disabled'}>${ico('chevD', 'sm')}</button>${locked.has(r.orig) ? '<span class="sv-ib ghost"></span>' : `<button type="button" class="sv-ib del" data-act="setDel" data-i="${i}" aria-label="Remove ${esc(nameOf(d, r.v))}" title="Remove">${ico('trash', 'sm')}</button>`}</span>`;
  let body;
  if (k === 'catalog') {
    const cats = [...new Set(MAT_CATALOG.map(m => m[1]))];
    body = `<datalist id="matCats">${cats.map(c => `<option value="${esc(c)}">`).join('')}</datalist>
      <div class="table-wrap"><table class="sv-table"><colgroup><col style="width:40px"><col><col style="width:142px"><col style="width:80px"><col style="width:108px"><col style="width:72px"><col style="width:204px"><col style="width:108px"></colgroup><thead><tr><th class="c">#</th><th>Material</th><th>Category</th><th>Unit</th><th class="r">Rate (₹)</th><th class="r">GST</th><th>Usual supplier</th><th></th></tr></thead><tbody>
      ${ED.rows.map((r, i) => `<tr class="${dup(i) ? 'dup' : ''}"><td class="c sv-n">${i + 1}</td>
        <td class="w-name"><input class="sv-in" value="${esc(r.v[0])}" data-ed="${i}:0" aria-label="Material name" placeholder="Material name" ${ro(r, true)}><span class="sv-sub">${notes(r, i)}<span class="sv-meta">${use(r)}</span></span></td>
        <td class="w-cat"><input class="sv-in" value="${esc(r.v[1])}" data-ed="${i}:1" list="matCats" aria-label="Category" placeholder="Category" ${ro(r)}></td>
        <td class="w-unit"><input class="sv-in" value="${esc(r.v[2])}" data-ed="${i}:2" aria-label="Unit" placeholder="Unit" ${ro(r)}></td>
        <td class="w-num"><input class="sv-in r" type="number" min="0" step="any" value="${r.v[3]}" data-ed="${i}:3" aria-label="Rate" ${ro(r)}></td>
        <td class="w-gst"><select class="sv-in sv-sel r" data-ed="${i}:4" aria-label="GST" ${ok ? '' : 'disabled'}>${[...new Set([...GST_RATES, +r.v[4]])].map(g => `<option value="${g}" ${+g === +r.v[4] ? 'selected' : ''}>${g}%</option>`).join('')}</select></td>
        <td class="w-sup"><input class="sv-in" value="${esc(r.v[5])}" data-ed="${i}:5" aria-label="Supplier" placeholder="Supplier" ${ro(r)}></td>
        <td class="sv-act-c">${acts(r, i)}</td></tr>`).join('')}
      </tbody></table></div>`;
  } else {
    body = `<div class="sv-list ${k}">${k === 'allowance' ? '<div class="sv-row sv-h"><span></span><span>Leave type</span><span>Days per year</span><span></span><span></span></div>' : ''}
      ${ED.rows.map((r, i) => `<div class="sv-row${dup(i) ? ' dup' : ''}"><span class="sv-n">${i + 1}</span>
        <div class="sv-main">${k === 'numbers' ? `<span class="sv-suffix"><input class="sv-in" type="number" min="0" max="100" step="0.25" value="${esc(r.v)}" data-ed="${i}:v" aria-label="Rate ${i + 1}" placeholder="0" ${ro(r, true)}><em>%</em></span>`
          : `<input class="sv-in" value="${esc(k === 'allowance' ? r.v[0] : r.v)}" data-ed="${i}:${k === 'allowance' ? 0 : 'v'}" aria-label="${k === 'allowance' ? 'Leave type' : `Value ${i + 1}`}" placeholder="${k === 'allowance' ? 'Leave type' : 'Type a value'}" ${ro(r, true)}>`}${notes(r, i)}</div>
        ${k === 'allowance' ? `<span class="sv-suffix days"><input class="sv-in r" type="number" min="0" step="0.5" value="${r.v[1] ?? ''}" placeholder="No limit" data-ed="${i}:1" aria-label="Days per year" ${ro(r)}><em>days</em></span>` : ''}
        <span class="sv-meta">${use(r)}</span>${acts(r, i)}</div>`).join('')}</div>`;
  }
  return `<div class="sv-head"><span class="sv-hic">${ico(GROUP_ICO[d.group] || 'folder', 'sm')}</span><div class="sv-ht"><h2>${esc(d.label)}</h2><p><b>${plural(ED.rows.length, 'value')}</b>${d.used.split(/,\s*(?![^()]*\))/).map(u => `<span class="sv-used">${esc(u)}</span>`).join('')}</p></div>
      ${ok ? `<div class="sv-ha">${LIST_CFG[d.key] ? `<button type="button" class="btn ghost sm" data-act="setDefaults" title="Go back to the values the app started with">${ico('refresh', 'sm')}Restore defaults</button>` : ''}<button type="button" class="btn sm primary" data-act="setAdd">${ico('plus', 'sm')}Add ${addNoun(d)}</button></div>` : ''}</div>
    ${d.refs && ok ? `<p class="sv-hint">${ico('edit', 'sm')}Click a value to edit it. Renaming also updates the records that already use it.</p>` : ''}
    ${body}
    ${ok ? `<div class="sv-save ${ED.dirty ? 'on' : ''}" role="status"><span>${ico('alert', 'sm')}<b>Unsaved changes</b> to ${esc(d.label.toLowerCase())}</span><button type="button" class="btn sm" data-act="setDiscard">Discard</button><button type="button" class="btn sm primary" data-act="setSave">${ico('check', 'sm')}Save changes</button></div>` : ''}`;
}
const markDirty = () => { ED.dirty = true; $('.sv-save')?.classList.add('on'); };
document.addEventListener('input', e => {
  const el = e.target; if (!ED || !el.dataset?.ed) return;
  const [i, f] = el.dataset.ed.split(':'), r = ED.rows[+i], d = defOf(ED.key);
  const val = el.type === 'number' ? (el.value === '' ? (kindOf(d) === 'allowance' ? null : '') : +el.value) : el.value;
  if (f === 'v') r.v = val; else r.v[+f] = val;
  markDirty();
});
document.addEventListener('change', e => { if (ED && e.target.dataset?.ed && e.target.tagName === 'SELECT') renderView(); });

ACT.setPick = el => {
  if (el.dataset.k === ED?.key) return;
  const goTo = () => { ED = null; setQ({ l: el.dataset.k }); };
  if (ED?.dirty) confirmBox('Discard unsaved changes?', `Your changes to <b>${esc(defOf(ED.key).label)}</b> haven't been saved.`, 'Discard', goTo, true); else goTo();
};
ACT.setMove = el => { const i = +el.dataset.i, j = i + +el.dataset.dir; [ED.rows[i], ED.rows[j]] = [ED.rows[j], ED.rows[i]]; ED.dirty = true; renderView(); };
ACT.setAdd = () => {
  const d = defOf(ED.key), k = kindOf(d);
  if (k === 'catalog') { ED.rows.push({ orig: null, v: ['', MAT_CATALOG[0]?.[1] || 'Cement', 'nos', 0, 18, ''] }); }
  else if (k === 'allowance') ED.rows.push({ orig: null, v: ['', null] });
  else ED.rows.push({ orig: null, v: '' });
  ED.dirty = true; renderView();
  // new rows go to the end of the list; bring the empty field into view and start typing in it
  setTimeout(() => { const el = $(`[data-ed="${ED.rows.length - 1}:${k === 'list' || k === 'numbers' ? 'v' : '0'}"]`); if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); el.focus({ preventScroll: true }); } }, 30);
};
ACT.setDel = el => {
  const i = +el.dataset.i, d = defOf(ED.key), r = ED.rows[i], u = r.orig != null ? usage(d, r.orig) : 0;
  const drop = () => { ED.rows.splice(i, 1); ED.dirty = true; renderView(); };
  if (ED.rows.length === 1) { toast('A list needs at least one value', 'lock'); return; }
  if (u) confirmBox(`Remove “${esc(r.orig)}”?`, `It is used in <b>${plural(u, 'record')}</b>. Those records keep the value; it just won't be offered in forms any more. The change takes effect when you save.`, 'Remove', drop, true);
  else drop();
};
ACT.setDiscard = () => { ED = null; renderView(); toast('Changes discarded'); };
ACT.setDefaults = () => {
  const d = defOf(ED.key);
  confirmBox('Restore the default values?', `<b>${esc(d.label)}</b> goes back to the ${plural(d.defaults.length, 'value')} the app started with. Records keep whatever values they already have.`, 'Restore defaults', () => {
    setList(d, JSON.parse(JSON.stringify(d.defaults))); delete LIST_CFG[d.key]; saveCfg(); ED = null;
    logAct(`restored the default ${d.label.toLowerCase()}`, null, 'user'); commit(`${d.label} restored to defaults`);
  });
};
ACT.setSave = () => {
  if (!guard(can('settings'), 'change dropdown values')) return;
  const d = defOf(ED.key), k = kindOf(d), rows = ED.rows;
  const clean = rows.map(r => { const v = Array.isArray(r.v) ? r.v.map((x, j) => typeof x === 'string' ? x.trim() : x) : typeof r.v === 'string' ? r.v.trim() : r.v; return { ...r, v }; });
  const names = clean.map(r => nameOf(d, r.v));
  if (names.some(n => !n)) { toast('Fill in or remove the empty rows', 'lock'); return; }
  if (new Set(names.map(n => n.toLowerCase())).size !== names.length) { toast('Each value must be unique', 'lock'); renderView(); return; }
  if (k === 'numbers' && clean.some(r => isNaN(+r.v) || +r.v < 0 || +r.v > 100)) { toast('Rates must be between 0 and 100', 'lock'); return; }
  if (k === 'catalog' && clean.some(r => !r.v[1] || !r.v[2] || !(+r.v[3] > 0) || !r.v[5])) { toast('Each material needs a category, unit, rate and supplier', 'lock'); return; }
  if (k === 'allowance' && clean.some(r => r.v[1] != null && r.v[1] !== '' && (isNaN(+r.v[1]) || +r.v[1] < 0))) { toast('Days per year must be 0 or more, or empty for no limit', 'lock'); return; }
  const missing = (d.locked || []).filter(l => !names.includes(l));
  if (missing.length) { toast(`${missing.join(', ')} can't be removed`, 'lock'); return; }
  const values = clean.map(r => k === 'numbers' ? +r.v : k === 'catalog' ? [r.v[0], r.v[1], r.v[2], +r.v[3], +r.v[4], r.v[5]] : k === 'allowance' ? [r.v[0], r.v[1] === '' || r.v[1] == null ? null : +r.v[1]] : r.v);
  const renames = clean.filter(r => r.orig != null && r.orig !== nameOf(d, r.v)).map(r => [r.orig, nameOf(d, r.v)]);
  setList(d, values);
  const n = renameRecords(d, renames);
  LIST_CFG[d.key] = { values, renames: [...(LIST_CFG[d.key]?.renames || []), ...renames] }; saveCfg();
  logAct(`updated the ${d.label.toLowerCase()} list`, null, 'user');
  ED = null; commit(`${d.label} saved${renames.length ? ` · ${plural(renames.length, 'value')} renamed${n ? `, ${plural(n, 'record')} updated` : ''}` : ''}`);
};
