/* Work stoppages & delays: non-working days or periods per project with the reason, affected floor or activity,
   remarks and photos. Days lost are counted in working days (Mon–Sat); an ongoing stoppage keeps counting until
   it is resolved. The impact on planned completion converts working days lost into calendar days. */
'use strict';

// each working day in the period can carry its own entry: whether any work happened, the reason and a comment.
// Days without an entry count as a full day lost (half for a half-day stoppage) with the stoppage's main reason.
const STOP_ST = { none: ['No work', 1, 'bad'], half: ['Half day worked', .5, 'warn'], worked: ['Worked', 0, 'ok'] };
const stopEnd = d => d.to && d.to < TODAY ? d.to : TODAY;
const stopWorkDays = d => d.date > stopEnd(d) ? [] : daysBetween(d.date, stopEnd(d)).filter(isWorkDay);
const dayEntry = (d, day) => ({ st: d.half ? 'half' : 'none', reason: d.reason, note: '', ...(d.log?.[day] || {}) });
const stopDays = d => sum(stopWorkDays(d), day => STOP_ST[dayEntry(d, day).st]?.[1] ?? 1);
const stopReason = d => d.reason === 'Other' && d.reasonText ? `Other · ${d.reasonText}` : d.reason;
const dayNotes = d => stopWorkDays(d).filter(day => d.log?.[day]?.note).length;
const fmtDays = n => `${num(n)} ${n === 1 ? 'day' : 'days'}`;
function stopWhere(d) {
  if (d.scope === 'site') return 'Entire site';
  const hit = d.activity && findAct(proj(d.project), d.activity), f = projLevels(proj(d.project)).find(x => x.id === d.floor);
  return hit ? `${hit.f.name} · ${hit.a.name}` : f ? f.name : 'Part of site';
}
const projStops = pid => DB.delays.filter(d => d.project === pid);
function completionImpact(p) {
  const st = projStops(p.id), lost = sum(st, stopDays), site = sum(st.filter(d => d.scope === 'site'), stopDays);
  const cal = Math.ceil(lost * 7 / 6);
  return { lost, site, activity: lost - site, cal, revised: shiftD(p.end, cal), open: st.filter(d => d.status === 'Open').length };
}

function stoppagesTab() {
  const { p = '', reason = '', st = '' } = ROUTE.q;
  const ids = myProjectIds();
  const all = DB.delays.filter(d => ids.has(d.project) && (!p || d.project === p));
  const list = all.filter(d => (!reason || d.reason === reason) && (!st || d.status === st)).sort((a, b) => (a.status === 'Open' ? 0 : 1) - (b.status === 'Open' ? 0 : 1) || b.date.localeCompare(a.date));
  const byReason = {}; all.forEach(d => byReason[d.reason] = (byReason[d.reason] || 0) + stopDays(d));
  const top = Object.entries(byReason).sort((a, b) => b[1] - a[1])[0];
  const ps = myProjects().filter(x => (!p || x.id === p) && x.status !== 'Completed').map(x => ({ p: x, im: completionImpact(x) })).filter(r => r.im.lost > 0 || r.p.id === p);
  if (ROUTE.q.sd) after(() => showStop(ROUTE.q.sd));
  return `<div class="toolbar">${projSelect(p)}
      <select class="select" data-change="setQ" data-k="reason" aria-label="Reason"><option value="">All reasons</option>${STOP_REASONS.map(r => `<option ${r === reason ? 'selected' : ''}>${r}</option>`).join('')}</select>
      ${statusChips([['', 'All'], ['Open', 'Ongoing'], ['Resolved', 'Resolved']], st, 'st', v => all.filter(d => !v || d.status === v).length)}</div>
    <div class="kpis">
      <div class="kpi"><div class="l">${ico('cal', 'sm')}Non-working days</div><div class="v">${num(sum(all, stopDays))}</div><div class="s">${num(sum(all.filter(d => d.scope === 'site'), stopDays))} with the entire site stopped</div></div>
      <div class="kpi"><div class="l">${ico('alert', 'sm')}Ongoing stoppages</div><div class="v">${all.filter(d => d.status === 'Open').length}</div><div class="s">${all.filter(d => d.status === 'Open').map(d => esc(proj(d.project).name)).slice(0, 2).join(', ') || 'none right now'}</div></div>
      <div class="kpi"><div class="l">${ico('flag', 'sm')}Top reason</div><div class="v" style="font-size:20px;padding-top:5px">${top ? esc(top[0]) : '—'}</div><div class="s">${top ? fmtDays(top[1]) + ' lost' : 'no stoppages recorded'}</div></div>
      <div class="kpi"><div class="l">${ico('clock', 'sm')}Completion pushed</div><div class="v">${ps.filter(r => r.im.cal > 0).length}<small> / ${ps.length || 0}</small></div><div class="s">projects with a revised completion date</div></div>
    </div>
    <div class="grid g-main">
      <div class="card"><div class="card-head"><h2>Impact on planned completion</h2><span class="sub">Working days lost × 7/6 = calendar days added</span></div>
        <div class="table-wrap" style="margin-top:12px"><table class="t stack-sm"><thead><tr><th>Project</th><th>Planned</th><th class="r">Days lost</th><th>Revised completion</th></tr></thead><tbody>
        ${ps.map(({ p: x, im }) => `<tr class="click" data-act="setQ" data-k="p" data-v="${x.id}"><td class="strong full">${esc(x.name)}<span class="sub">${im.open ? `${im.open} ongoing · ` : ''}${fmtDays(im.site)} site-wide · ${fmtDays(im.activity)} on activities</span></td><td class="nowrap">${fmtDY(x.end)}</td><td class="r strong">${num(im.lost)}</td>
          <td class="nowrap">${im.cal ? `${fmtDY(im.revised)} <span class="badge ${im.cal > 14 ? 'bad' : 'warn'}">+${im.cal} days</span>` : '<span class="muted">No change</span>'}</td></tr>`).join('') || emptyRow(4, 'No stoppages recorded')}
        </tbody></table></div></div>
      <div class="card"><div class="card-head"><h2>Days lost by reason</h2></div><div class="card-body">${Object.keys(byReason).length ? hBars(Object.entries(byReason).sort((a, b) => b[1] - a[1]).map(([label, value]) => ({ label, value })), fmtDays) : '<p class="muted">No stoppages recorded.</p>'}</div></div>
    </div>
    <div class="card"><div class="card-head"><h2>Stoppage history</h2><span class="sub">${plural(list.length, 'record')}</span></div>
      <div class="table-wrap" style="margin-top:12px"><table class="t stack-sm"><thead><tr><th>Period</th><th>Project</th><th>Reason</th><th>Affected</th><th class="r">Days lost</th><th>Status</th><th class="r">Photos</th></tr></thead><tbody>
      ${list.map(d => `<tr class="click" data-act="showStop" data-id="${d.id}"><td class="nowrap">${fmtD(d.date)}${d.to !== d.date ? ` – ${d.to ? fmtD(d.to) : '<b>ongoing</b>'}` : ''}<span class="sub">${d.half ? 'Half day' : d.to === d.date ? 'Full day' : ''}</span></td>
        <td class="strong full">${esc(proj(d.project).name)}<span class="sub" style="white-space:normal">${esc(d.note)}</span></td><td>${esc(stopReason(d))}${dayNotes(d) ? `<span class="sub">${ico('edit', 'sm')} ${plural(dayNotes(d), 'day comment')}</span>` : ''}</td><td class="hide-sm">${esc(stopWhere(d))}</td><td class="r strong">${num(stopDays(d))}</td><td>${badge(d.status === 'Open' ? 'Ongoing' : 'Resolved', d.status === 'Open' ? 'bad' : 'ok')}</td><td class="r hide-sm">${(d.photos || []).length || '—'}</td></tr>`).join('') || emptyRow(7, 'No stoppages match', 'Try another filter.')}
      </tbody></table></div></div>`;
}

function showStop(id) {
  const d = DB.delays.find(x => x.id === id); if (!d) return;
  const p = proj(d.project), ok = can('progress') || can('site');
  openDrawer(`${esc(stopReason(d))} · ${esc(p.name)}`, `${fmtDY(d.date)}${d.to !== d.date ? ` – ${d.to ? fmtDY(d.to) : 'ongoing'}` : ''}`, `
    <div class="split">${badge(d.status === 'Open' ? 'Ongoing' : 'Resolved', d.status === 'Open' ? 'bad' : 'ok')}<span class="muted" style="font-size:13px">${fmtDays(stopDays(d))} lost</span></div>
    <dl class="dl"><div><dt>Project</dt><dd><a href="#/projects/${p.id}">${esc(p.name)}</a></dd></div><div><dt>Reason</dt><dd>${esc(stopReason(d))}</dd></div>
      <div><dt>From</dt><dd>${fmtDY(d.date)}</dd></div><div><dt>To</dt><dd>${d.to ? fmtDY(d.to) : 'Still stopped'}</dd></div>
      <div><dt>Days lost</dt><dd>${fmtDays(stopDays(d))} <span class="muted">of ${plural(stopWorkDays(d).length, 'working day')}</span></dd></div><div><dt>Affected</dt><dd>${esc(stopWhere(d))}</dd></div>
      <div><dt>Recorded by</dt><dd>${esc(userName(d.by))}</dd></div><div><dt>Recorded on</dt><dd>${d.at ? fmtTs(d.at) : fmtDY(d.date)}</dd></div></dl>
    <div><h3>Why work stopped</h3><p class="ink2">${esc(d.note)}</p>${d.resolution ? `<p class="ink2" style="margin-top:8px"><b>Resolution:</b> ${esc(d.resolution)}</p>` : ''}</div>
    ${stopLogView(d, ok)}
    <div><h3>Supporting photos</h3>${photoStrip(d.photos, { empty: 'No photos attached.' })}</div>
    <div><h3>Impact</h3><div class="kv-row"><span>Planned completion</span><b>${fmtDY(p.end)}</b></div><div class="kv-row"><span>All stoppages on this project</span><b>${fmtDays(completionImpact(p).lost)}</b></div><div class="kv-row"><span>Revised completion</span><b>${fmtDY(completionImpact(p).revised)}</b></div></div>`,
    ok ? `<button class="btn left" data-act="editStop" data-id="${d.id}">${ico('edit', 'sm')}Edit</button>${d.status === 'Open' ? `<button class="btn primary" data-act="resolveDelay" data-id="${d.id}">${ico('check', 'sm')}Mark resolved</button>` : `<button class="btn primary" data-act="closeDrawer">Done</button>`}` : `<button class="btn primary" data-act="closeDrawer">Done</button>`);
}
ACT.showStop = el => showStop(el.dataset.id);
$('#drawer').addEventListener('close', () => { if (ROUTE.q.sd) { const q = { ...ROUTE.q }; delete q.sd; history.replaceState(null, '', `#/${[ROUTE.mod, ...ROUTE.parts].join('/')}${Object.keys(q).length ? '?' + new URLSearchParams(q) : ''}`); ROUTE = parseRoute(); } });

function stopForm(d = {}, pid) {
  const p = proj(d.project || pid);
  const lv = projLevels(p);
  const f = lv.find(x => x.id === d.floor);
  return `<div class="form">
    <div class="row2">${fld('Project', 'project', { opts: projOpts(myProjects().filter(x => x.status !== 'Completed')), value: p.id })}${fld('Main reason', 'reason', { opts: STOP_REASONS, value: d.reason || 'Weather' })}</div>
    <div data-other-f>${fld('Specify the reason', 'reasonText', { value: d.reasonText || '', ph: 'e.g. Local festival procession blocked site access' })}</div>
    <div class="row3">${fld('From date', 'from', { type: 'date', req: true, value: d.date || TODAY })}${fld('To date', 'to', { type: 'date', value: d.to || '', hint: 'Leave empty while work is still stopped' })}${fld('Usual impact per day', 'half', { opts: [['', 'No work all day'], ['1', 'Half day worked']], value: d.half ? '1' : '' })}</div>
    <div class="row3">${fld('Affected', 'scope', { opts: [['site', 'Entire site'], ['activity', 'Specific floor / activity']], value: d.scope || 'site' })}
      <label class="field" data-scope-f><span>Floor / zone</span><select class="select" name="floor">${lv.map(x => `<option value="${x.id}" ${x.id === d.floor ? 'selected' : ''}>${esc(x.name)}</option>`).join('') || '<option value="">—</option>'}</select></label>
      <label class="field" data-scope-f><span>Activity</span><select class="select" name="activity"><option value="">Whole floor</option>${(f || lv[0])?.activities.map(a => `<option value="${a.id}" ${a.id === d.activity ? 'selected' : ''}>${esc(a.name)}</option>`).join('') || ''}</select></label></div>
    ${fld('Why did work stop? (details)', 'note', { type: 'textarea', req: true, value: d.note || '', ph: 'What happened, what was affected and what is being done about it' })}
    <div class="field"><span>Day-by-day — why no work on each day</span><div class="sl" id="stopLog"></div></div>
    ${photoInput('stopPh', { label: d.id ? 'Add more photos' : 'Supporting photos', sample: 'site', prefer: p.id })}</div>`;
}
function bindStopForm(m) {
  const sel = $('[name=scope]', m), fl = $('[name=floor]', m), ac = $('[name=activity]', m), pj = $('[name=project]', m);
  const sync = () => $$('[data-scope-f]', m).forEach(x => x.hidden = sel.value !== 'activity');
  const acts = () => { const f = projLevels(proj(pj.value)).find(x => x.id === fl.value); ac.innerHTML = `<option value="">Whole floor</option>${f ? f.activities.map(a => `<option value="${a.id}">${esc(a.name)}</option>`).join('') : ''}`; };
  pj.addEventListener('change', () => { fl.innerHTML = projLevels(proj(pj.value)).map(x => `<option value="${x.id}">${esc(x.name)}</option>`).join('') || '<option value="">—</option>'; acts(); });
  fl.addEventListener('change', acts); sel.addEventListener('change', sync); sync();
  const rs = $('[name=reason]', m), other = () => { $('[data-other-f]', m).hidden = rs.value !== 'Other'; $('[name=reasonText]', m).required = rs.value === 'Other'; };
  rs.addEventListener('change', () => { other(); drawStopLog(m); }); other();
  ['from', 'to', 'half'].forEach(n => $(`[name=${n}]`, m).addEventListener('change', () => drawStopLog(m)));
  $('#stopLog', m).addEventListener('change', e => { const r = e.target.closest('[data-day]'); if (r) { readLogRow(r); drawStopSum(m); } });
  $('#stopLog', m).addEventListener('input', e => { const r = e.target.closest('[data-day]'); if (r && e.target.dataset.f === 'note') readLogRow(r); });
  $('#stopLog', m).addEventListener('click', e => { if (e.target.closest('[data-fill]')) { const rows = $$('[data-day]', m), first = rows.find(r => $('[data-f=note]', r).value.trim()); if (!first) { toast('Write a comment on one day first'); return; } const t = $('[data-f=note]', first).value; rows.forEach(r => { const i = $('[data-f=note]', r); if (!i.value.trim() && $('[data-f=st]', r).value !== 'worked') { i.value = t; readLogRow(r); } }); } });
  drawStopLog(m);
}
/* day-by-day log inside the form; entries the user touched are kept in STOPLOG, the rest follow the main reason */
let STOPLOG = {};
function readLogRow(r) { STOPLOG[r.dataset.day] = { st: $('[data-f=st]', r).value, reason: $('[data-f=reason]', r).value, note: $('[data-f=note]', r).value.trim() }; }
function formStop(m) { const v = n => $(`[name=${n}]`, m).value; return { date: v('from'), to: v('to') || null, half: !!v('half'), reason: v('reason'), log: STOPLOG }; }
function drawStopSum(m) {
  const d = formStop(m), el = $('#stopLogSum', m); if (!el) return;
  el.innerHTML = `${plural(stopWorkDays(d).length, 'working day')} · <b>${fmtDays(stopDays(d))} lost</b>`;
}
function drawStopLog(m) {
  const d = formStop(m), box = $('#stopLog', m);
  if (!d.date || d.date > TODAY) { box.innerHTML = '<p class="muted sl-empty">Pick the from date to list each day.</p>'; return; }
  if (d.to && d.to < d.date) { box.innerHTML = '<p class="muted sl-empty">The to date is before the from date.</p>'; return; }
  const all = daysBetween(d.date, stopEnd(d)), shown = all.slice(-62);
  box.innerHTML = `<div class="sl-head"><span id="stopLogSum"></span><button type="button" class="linkbtn" data-fill>Copy the top comment to empty no-work days</button></div>
    ${all.length > shown.length ? `<p class="muted sl-more">Showing the last ${shown.length} days of ${all.length}.</p>` : ''}
    <div class="sl-cols" aria-hidden="true"><span>Day</span><span>Work done</span><span>Reason that day</span><span>Comment — why no work</span></div>
    <div class="sl-rows">${shown.slice().reverse().map(day => {
      const dt = parseD(day), lbl = `<div class="sl-d"><b>${dt.getDate()} ${dt.toLocaleDateString('en-IN', { month: 'short' })}</b><span>${dt.toLocaleDateString('en-IN', { weekday: 'short' })}${day === TODAY ? ' · today' : ''}</span></div>`;
      if (!isWorkDay(day)) return `<div class="sl-row off">${lbl}<span class="muted">Sunday — weekly off, not counted</span></div>`;
      const e = dayEntry(d, day);
      return `<div class="sl-row st-${e.st}" data-day="${day}">${lbl}
        <select class="select sm" data-f="st" aria-label="Work done on ${day}">${Object.entries(STOP_ST).map(([k, [l]]) => `<option value="${k}" ${k === e.st ? 'selected' : ''}>${l}</option>`).join('')}</select>
        <select class="select sm" data-f="reason" aria-label="Reason on ${day}">${STOP_REASONS.map(r => `<option ${r === e.reason ? 'selected' : ''}>${esc(r)}</option>`).join('')}</select>
        <input class="input sm" data-f="note" value="${esc(e.note)}" placeholder="e.g. Rain until 3 PM, site flooded" aria-label="Comment for ${day}"></div>`; }).join('')}</div>`;
  $$('[data-day]', box).forEach(r => $('[data-f=st]', r).addEventListener('change', () => r.className = `sl-row st-${$('[data-f=st]', r).value}`));
  drawStopSum(m);
}
/* day-by-day view in the drawer */
function stopLogView(d, ok) {
  const days = stopWorkDays(d).slice().reverse();
  if (!days.length) return '';
  return `<div><div class="split" style="margin-bottom:10px"><h3 style="margin:0">Day by day</h3>${ok && d.status === 'Open' ? `<button class="btn xs" data-act="logStopDay" data-id="${d.id}">${ico('plus', 'sm')}Log today</button>` : ''}</div>
    <ul class="sl-tl">${days.map(day => { const e = dayEntry(d, day), [l, , t] = STOP_ST[e.st] || STOP_ST.none;
      return `<li class="${t}"><div class="sl-d"><b>${fmtD(day)}</b><span>${parseD(day).toLocaleDateString('en-IN', { weekday: 'short' })}</span></div><div><div class="sl-tl-h">${badge(l, t)}${e.reason !== d.reason ? `<span class="tag">${esc(e.reason)}</span>` : ''}</div>${e.note ? `<p>${esc(e.note)}</p>` : '<p class="muted">No comment</p>'}</div></li>`; }).join('')}</ul></div>`;
}
ACT.logStopDay = el => {
  const d = DB.delays.find(x => x.id === el.dataset.id); if (!guard(can('progress') || can('site'), 'update stoppages')) return;
  const day = isWorkDay(TODAY) ? TODAY : shiftD(TODAY, -1), e = dayEntry(d, day); closeDrawer();
  openModal({ title: 'Log a stoppage day', sub: `${esc(proj(d.project).name)} · ${esc(stopReason(d))}`, body: `<div class="form">
    <div class="row2">${fld('Day', 'day', { type: 'date', req: true, value: day })}${fld('Work done', 'st', { opts: Object.entries(STOP_ST).map(([k, [l]]) => [k, l]), value: e.st })}</div>
    ${fld('Reason that day', 'reason', { opts: STOP_REASONS, value: e.reason })}
    ${fld('Why was there no work?', 'note', { type: 'textarea', rows: 3, req: true, value: e.note, ph: 'e.g. Client still has not approved the elevation; crew moved to Anand Farmhouse' })}</div>`,
    onSubmit: x => {
      if (x.day < d.date || x.day > TODAY) { toast(`Pick a day between ${fmtD(d.date)} and today`, 'lock'); return false; }
      if (!isWorkDay(x.day)) { toast('Sunday is a weekly off and is not counted', 'lock'); return false; }
      (d.log ||= {})[x.day] = { st: x.st, reason: x.reason, note: x.note, by: SESSION, at: Date.now() }; d.days = stopDays(d);
      logAct(`logged ${fmtD(x.day)} on a work stoppage (${x.reason})`, d.project, 'delay'); commit(`${fmtD(x.day)} logged · ${fmtDays(stopDays(d))} lost so far`);
      setTimeout(() => showStop(d.id), 40);
    } });
};
function saveStop(d, rec) {
  if (d.to && d.to < d.from) { toast('The end date must be on or after the start date', 'lock'); return false; }
  if (d.from > TODAY) { toast('A stoppage can only be recorded for today or earlier', 'lock'); return false; }
  if (d.reason === 'Other' && !d.reasonText) { toast('Specify the reason', 'lock'); return false; }
  Object.assign(rec, { project: d.project, reason: d.reason, reasonText: d.reason === 'Other' ? d.reasonText : '', date: d.from, to: d.to || null, half: !!d.half, scope: d.scope, floor: d.scope === 'activity' ? d.floor || null : null, activity: d.scope === 'activity' ? d.activity || null : null, note: d.note });
  if (rec.half && !rec.to) rec.to = rec.date;
  rec.status = rec.to ? 'Resolved' : 'Open';
  const end = rec.to && rec.to < TODAY ? rec.to : TODAY;
  rec.log = Object.fromEntries(Object.entries(STOPLOG).filter(([k]) => k >= rec.date && k <= end && isWorkDay(k)));
  rec.photos = [...(rec.photos || []), ...takePicks('stopPh')];
  rec.days = stopDays(rec);
  return true;
}
ACT.newDelay = el => {
  if (!guard(can('progress') || can('site'), 'record stoppages')) return;
  const pid = el?.dataset?.p || ROUTE.q.p || myProjects().find(p => p.status !== 'Completed')?.id;
  STOPLOG = {};
  openModal({ title: 'Record a work stoppage', sub: 'Days with no work (or only part of a day), the reason, and a comment for each day.', wide: true, body: stopForm({}, pid), onOpen: bindStopForm,
    onSubmit: d => {
      const rec = { id: nid('dl'), by: SESSION, at: Date.now(), status: d.to ? 'Resolved' : 'Open' };
      if (!saveStop(d, rec)) return false;
      DB.delays.unshift(rec);
      const p = proj(rec.project);
      notify([p.pm, p.engineer, p.supervisor, 'u1'], `Work stoppage recorded on ${p.name}: ${rec.reason} (${stopWhere(rec)})`, `#/progress?tab=stoppages&p=${p.id}&sd=${rec.id}`, 'delay');
      logAct(`recorded a work stoppage (${rec.reason}) — ${stopWhere(rec)}`, rec.project, 'delay');
      commit(`Stoppage recorded · ${fmtDays(stopDays(rec))} so far`);
    } });
};
ACT.editStop = el => {
  const rec = DB.delays.find(x => x.id === el.dataset.id); closeDrawer();
  STOPLOG = JSON.parse(JSON.stringify(rec.log || {}));
  openModal({ title: 'Edit stoppage', sub: `${esc(proj(rec.project).name)} · ${esc(rec.reason)}`, wide: true, body: stopForm(rec), onOpen: bindStopForm,
    onSubmit: d => { if (!saveStop(d, rec)) return false; logAct(`edited a work stoppage (${rec.reason})`, rec.project, 'delay'); commit('Stoppage updated'); } });
};
ACT.resolveDelay = el => {
  const d = DB.delays.find(x => x.id === el.dataset.id); closeDrawer();
  const last = d.to || (shiftD(TODAY, -1) < d.date ? d.date : shiftD(TODAY, -1));
  openModal({ title: 'Mark stoppage as resolved', sub: `${esc(proj(d.project).name)} · ${esc(d.reason)}`, body: `<div class="form">
    <div class="row2">${fld('Last day affected', 'to', { type: 'date', req: true, value: last })}<div></div></div>
    ${fld('How was it resolved?', 'resolution', { type: 'textarea', ph: 'e.g. Material received; work resumed on all floors' })}</div>`,
    foot: `<button type="button" class="btn" data-act="closeModal">Cancel</button><button type="submit" class="btn primary">${ico('check', 'sm')}Mark resolved</button>`,
    onSubmit: x => {
      if (x.to < d.date) { toast('The last day must be on or after the start date', 'lock'); return false; }
      Object.assign(d, { to: x.to, status: 'Resolved', resolution: x.resolution, resolvedBy: SESSION, resolvedAt: Date.now() }); d.days = stopDays(d);
      const p = proj(d.project);
      notify([p.pm, p.supervisor], `Stoppage resolved on ${p.name}: ${d.reason} · ${fmtDays(stopDays(d))} lost`, `#/progress?tab=stoppages&p=${p.id}`, 'delay');
      logAct(`resolved a work stoppage (${d.reason})`, d.project, 'delay'); commit(`Marked resolved · ${fmtDays(stopDays(d))} lost`);
    } });
};
