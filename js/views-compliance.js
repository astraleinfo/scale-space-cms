/* Daily report compliance: reports are due by 8:00 PM on every scheduled working day (Monday – Saturday, excluding
   full-site stoppages). Each site-day is Submitted, Late, Pending or Missing. Supervisors who miss a report ask the
   office administrator to upload it on their behalf; the uploader, actual upload time and late reason are recorded. */
'use strict';

const reportDeadline = day => tsOn(day, REPORT_DEADLINE_H);
const canBehalf = () => can2('Submit reports on behalf of site staff');
const fullStop = (pid, day) => DB.delays.find(d => d.project === pid && d.scope === 'site' && !d.half && day >= d.date && day <= (d.to || TODAY));
function scheduledDay(p, day) { return isWorkDay(day) && day >= p.start && day <= TODAY && !['Completed', 'On hold'].includes(p.status) && !fullStop(p.id, day); }
// status of one project on one day
function reportSlot(p, day) {
  const r = DB.reports.find(x => x.project === p.id && x.date === day && x.status === 'Submitted');
  const draft = !r ? DB.reports.find(x => x.project === p.id && x.date === day && x.status === 'Draft') : null;
  if (r) return { p, day, st: r.at > reportDeadline(day) ? 'Late' : 'Submitted', r };
  if (!scheduledDay(p, day)) return { p, day, st: fullStop(p.id, day) || p.status === 'On hold' ? 'Stoppage' : 'Off', draft };
  if (day === TODAY && Date.now() <= reportDeadline(day)) return { p, day, st: 'Pending', draft };
  return { p, day, st: 'Missing', draft };
}
const lateBy = r => r.at - reportDeadline(r.date);
const viaOffice = r => r.uploadedBy && r.uploadedBy !== r.by;
const SLOT_TONE = { Submitted: 'ok', Late: 'warn', Pending: 'info', Missing: 'bad', Stoppage: '', Off: '' };
const slotGlyph = { Submitted: 'check', Late: 'clock', Pending: 'clock', Missing: 'x', Stoppage: 'alert' };
function noteCorrection(r, note) { if (r.status !== 'Submitted') return; (r.corrections ||= []).push({ at: Date.now(), by: SESSION, note }); }
const officeAdmins = () => usersWithRole('admin');
const openRequests = () => (DB.reportRequests || []).filter(q => q.status === 'Open' && myProjectIds().has(q.project));

function complianceSlots(n, pid = '') {
  const days = []; for (let i = -(n - 1); i <= 0; i++) days.push(dayOff(i));
  const sites = siteProjects().filter(x => !pid || x.id === pid);
  return { days, sites, slots: sites.flatMap(p => days.map(d => reportSlot(p, d))) };
}

/* ---------- Site Operations › Submission status tab ---------- */
function siteCompliance() {
  const { p = '', range = '14', st = '' } = ROUTE.q;
  const n = ['7', '14', '30'].includes(range) ? +range : 14;
  const { days, sites, slots } = complianceSlots(n, p);
  const due = slots.filter(s => ['Submitted', 'Late', 'Missing'].includes(s.st));
  const cnt = k => slots.filter(s => s.st === k).length;
  const onTime = Math.round(cnt('Submitted') / Math.max(1, due.length) * 100);
  const reqs = openRequests();
  const mine = isScoped() ? slots.filter(s => s.st === 'Missing') : [];
  const deadlineTxt = Date.now() <= reportDeadline(TODAY) ? `due today by 8:00 PM · ${fmtMins((reportDeadline(TODAY) - Date.now()) / 6e4)} left` : 'deadline passed for today';
  const filters = [['', 'All'], ['Submitted', 'On time'], ['Late', 'Late'], ['Missing', 'Missing'], ['Pending', 'Pending'], ['corrected', 'Corrected'], ['office', 'Uploaded by office']];
  const match = s => !st ? s.st !== 'Off' : st === 'corrected' ? s.r?.corrections?.length : st === 'office' ? s.r && viaOffice(s.r) : s.st === st;
  const log = slots.filter(match).sort((a, b) => b.day.localeCompare(a.day) || a.p.name.localeCompare(b.p.name));
  return `<div class="toolbar">${projSelect(p, { list: siteProjects() })}
      <div class="seg" role="group" aria-label="Period">${[['7', 'Last 7 days'], ['14', 'Last 14 days'], ['30', 'Last 30 days']].map(([v, l]) => `<button class="${String(n) === v ? 'on' : ''}" data-act="setQ" data-k="range" data-v="${v}">${l}</button>`).join('')}</div>
      <span class="grow"></span><span class="muted" style="font-size:13px">${ico('clock', 'sm')} Reports are due by <b>8:00 PM</b> on working days (Mon–Sat)</span></div>
    ${mine.length ? `<div class="banner warn">${ico('alert')}<span><b>${plural(mine.length, 'report')} missing</b> on your sites. If you couldn't upload from site, ask the office administrator to upload it for you.</span><button class="btn sm" data-act="askOffice" data-p="${mine[0].p.id}" data-d="${mine[0].day}">${ico('send', 'sm')}Ask office to upload</button></div>` : ''}
    ${reqs.length && canBehalf() ? `<div class="banner">${ico('report')}<span><b>${plural(reqs.length, 'upload request')}</b> from site staff waiting for the office.</span><a class="btn sm" href="#requests" data-act="scrollTo" data-id="requests">Review</a></div>` : ''}
    <div class="kpis">
      <div class="kpi"><div class="l">${ico('check', 'sm')}On-time rate</div><div class="v">${onTime}%</div><div class="s">${cnt('Submitted')} of ${due.length} due reports by 8 PM</div></div>
      <div class="kpi"><div class="l">${ico('clock', 'sm')}Late submissions</div><div class="v">${cnt('Late')}</div><div class="s">${slots.filter(s => s.r && viaOffice(s.r)).length} uploaded by the office</div></div>
      <div class="kpi"><div class="l">${ico('alert', 'sm')}Missing</div><div class="v">${cnt('Missing')}</div><div class="s">no report after the deadline</div></div>
      <div class="kpi"><div class="l">${ico('report', 'sm')}Pending today</div><div class="v">${cnt('Pending')}</div><div class="s">${deadlineTxt}</div></div>
    </div>
    <div class="card"><div class="card-head"><h2>Report calendar</h2><span class="sub">${plural(sites.length, 'site')} · last ${n} days</span>
      <span class="legend">${['Submitted', 'Late', 'Pending', 'Missing', 'Stoppage'].map(k => `<span><i class="rcl ${k}"></i>${k === 'Stoppage' ? 'Work stopped / off' : k}</span>`).join('')}</span></div>
      <div class="table-wrap" style="margin-top:14px"><table class="t rcal"><thead><tr><th>Site</th>${days.map(d => `<th class="${d === TODAY ? 'today' : ''}${isWorkDay(d) ? '' : ' off'}"><span>${parseD(d).toLocaleDateString('en-IN', { weekday: 'narrow' })}</span>${parseD(d).getDate()}</th>`).join('')}</tr></thead><tbody>
      ${sites.map(x => `<tr><td class="strong">${esc(x.name)}<span class="sub">${esc(userName(x.supervisor))}</span></td>${days.map(d => { const s = reportSlot(x, d); return `<td>${s.st === 'Off' ? '<span class="rcl Off"></span>' : `<button type="button" class="rcl ${s.st}" data-act="slotGo" data-p="${x.id}" data-d="${d}" title="${esc(`${x.name} · ${fmtD(d)} · ${s.st}${s.r ? ` · uploaded ${fmtTs(s.r.at)}` : ''}`)}" aria-label="${esc(`${fmtD(d)}: ${s.st}`)}">${slotGlyph[s.st] ? ico(slotGlyph[s.st], 'sm') : ''}</button>`}</td>`; }).join('')}</tr>`).join('') || emptyRow(days.length + 1, 'No active sites')}
      </tbody></table></div></div>
    ${requestsCard()}
    <div class="card"><div class="card-head"><h2>Submission history</h2><span class="sub">${plural(log.length, 'entry', 'entries')}</span></div>
      <div style="padding:14px 24px 0">${statusChips(filters, st, 'st', v => slots.filter(s => (!v ? s.st !== 'Off' : v === 'corrected' ? s.r?.corrections?.length : v === 'office' ? s.r && viaOffice(s.r) : s.st === v)).length)}</div>
      <div class="table-wrap" style="margin-top:14px"><table class="t stack-sm"><thead><tr><th>Reporting date</th><th>Site</th><th>Status</th><th>Uploaded</th><th>By</th><th class="r">Photos</th><th>Late reason / notes</th><th></th></tr></thead><tbody>
      ${log.slice(0, ROUTE.q.all ? 400 : 40).map(s => { const r = s.r, ph = r ? repMedia(r).length : 0; return `<tr${r ? ` class="click" data-act="go" data-href="#/site/report/${r.id}"` : ''}>
        <td class="nowrap">${fmtD(s.day)}<span class="sub">${parseD(s.day).toLocaleDateString('en-IN', { weekday: 'long' })}</span></td><td class="strong full">${esc(s.p.name)}</td>
        <td>${badge(s.st === 'Submitted' ? 'Submitted' : s.st, SLOT_TONE[s.st])}${r?.corrections?.length ? `<span class="sub">${plural(r.corrections.length, 'correction')}</span>` : ''}</td>
        <td class="nowrap hide-sm">${r ? `${fmtTs(r.at)}${s.st === 'Late' ? `<span class="sub" style="color:var(--warn)">${fmtMins(lateBy(r) / 6e4)} after deadline</span>` : ''}` : s.draft ? '<span class="muted">Draft saved</span>' : '—'}</td>
        <td class="hide-sm">${r ? `${esc(userName(r.by))}${viaOffice(r) ? `<span class="sub">uploaded by ${esc(userName(r.uploadedBy))}</span>` : ''}` : `<span class="muted">${esc(userName(s.p.supervisor))}</span>`}</td>
        <td class="r hide-sm">${r ? (ph || '<span class="muted">0</span>') : '—'}</td>
        <td class="hide-sm" style="max-width:280px;white-space:normal;font-size:13px">${r?.lateReason ? esc(r.lateReason) : s.st === 'Missing' ? requestNote(s) : ''}</td>
        <td class="r">${slotAction(s)}</td></tr>`; }).join('') || emptyRow(8, 'Nothing to show', 'Try another filter or period.')}
      </tbody></table></div>${!ROUTE.q.all && log.length > 40 ? `<div class="card-foot" style="justify-content:center"><button class="btn sm" data-act="setQ" data-k="all" data-v="1">Show all ${log.length}</button></div>` : ''}</div>`;
}
function requestNote(s) { const q = (DB.reportRequests || []).find(x => x.project === s.p.id && x.date === s.day && x.status === 'Open'); return q ? `<span class="badge info">Office asked · ${esc(q.reason)}</span>` : '<span class="muted">No report received</span>'; }
function slotAction(s) {
  if (s.r || s.st === 'Stoppage' || s.st === 'Off') return '';
  const q = (DB.reportRequests || []).find(x => x.project === s.p.id && x.date === s.day && x.status === 'Open');
  if (canBehalf()) return `<a class="btn xs" href="#/site/report/new?p=${s.p.id}&date=${s.day}${q ? `&req=${q.id}` : ''}">${ico('upload', 'sm')}Upload${q || role() === 'admin' ? ' on behalf' : ''}</a>`;
  if (can('site') && s.st === 'Pending') return `<a class="btn xs" href="#/site/report/new?p=${s.p.id}">Submit</a>`;
  if (can('site') && s.st === 'Missing') return q ? badge('Requested', 'info') : `<button class="btn xs" data-act="askOffice" data-p="${s.p.id}" data-d="${s.day}">${ico('send', 'sm')}Ask office</button>`;
  return '';
}
ACT.slotGo = el => {
  const p = proj(el.dataset.p), s = reportSlot(p, el.dataset.d);
  if (s.r) return go(`#/site/report/${s.r.id}`);
  if (s.st === 'Stoppage') return go(`#/progress?tab=stoppages&p=${p.id}`);
  if (s.draft && can('site')) return go(`#/site/report/${s.draft.id}/edit`);
  if (canBehalf() || (can('site') && s.st === 'Pending')) return go(`#/site/report/new?p=${p.id}&date=${s.day}`);
  if (can('site') && s.st === 'Missing') return ACT.askOffice(el);
  toast(`${p.name} · ${fmtD(s.day)}: ${s.st}`);
};
ACT.scrollTo = (el, e) => { e?.preventDefault(); document.getElementById(el.dataset.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); };

function requestsCard() {
  const all = (DB.reportRequests || []).filter(q => myProjectIds().has(q.project) && (canBehalf() || q.by === SESSION || role() === 'pm'));
  if (!all.length) return '';
  const list = all.sort((a, b) => (a.status === 'Open' ? 0 : 1) - (b.status === 'Open' ? 0 : 1) || b.at - a.at).slice(0, 8);
  return `<div class="card" id="requests"><div class="card-head"><h2>Upload requests to the office</h2><span class="sub">${all.filter(q => q.status === 'Open').length} open</span></div>
    <ul class="list" style="margin-top:8px">${list.map(q => `<li style="align-items:flex-start"><span class="sig ${q.status === 'Open' ? 'warn' : 'ok'}">${ico(q.status === 'Open' ? 'send' : 'check', 'sm')}</span>
      <div class="main-t"><b>${esc(proj(q.project).name)} · report for ${fmtD(q.date)}</b><span style="white-space:normal">${esc(userName(q.by))} · ${esc(q.reason)} — ${esc(q.note)}</span><span>Requested ${fmtTs(q.at)}${q.status === 'Completed' ? ` · uploaded by ${esc(userName(q.handledBy))} ${fmtTs(q.handledAt)}` : ''}</span>
      ${q.photos?.length ? `<div style="margin-top:8px">${photoStrip(q.photos, { cls: 'xs' })}</div>` : ''}</div>
      <div class="row-acts">${q.status === 'Open' && canBehalf() ? `<a class="btn xs primary" href="#/site/report/new?p=${q.project}&date=${q.date}&req=${q.id}">${ico('upload', 'sm')}Submit on behalf</a>` : q.status === 'Completed' && q.report ? `<a class="btn xs" href="#/site/report/${q.report}">View report</a>` : badge(q.status, 'info')}</div></li>`).join('')}</ul></div>`;
}

/* supervisor → office administrator: contact and request an upload */
ACT.askOffice = el => {
  const p = proj(el.dataset.p), day = el.dataset.d, admins = officeAdmins().map(user);
  const a = admins[0];
  openModal({ title: 'Ask the office to upload your report', sub: `${esc(p.name)} · ${fmtLong(day)}`, body: `<div class="form">
    ${a ? `<div class="contact-card">${av(a.name)}<div class="nm"><b>${esc(a.name)}</b><span>${esc(a.title)} · ${esc(a.phone)}</span></div>
      <a class="btn sm" href="tel:${esc(a.phone.replace(/\s/g, ''))}">${ico('phone', 'sm')}Call</a><a class="btn sm" target="_blank" rel="noopener" href="https://wa.me/${esc(a.phone.replace(/\D/g, ''))}?text=${encodeURIComponent(`Daily report for ${p.name} (${fmtD(day)}) — please upload on my behalf.`)}">${ico('enquiry', 'sm')}WhatsApp</a></div>` : ''}
    <div class="row2">${fld('Why was it missed?', 'reason', { opts: MISSED_REASONS })}<div></div></div>
    ${fld('Work summary for the office', 'note', { type: 'textarea', req: true, ph: 'What was done, workers on site, materials used. The office will enter it for you.' })}
    ${photoInput('askPh', { label: 'Photos for the report', sample: 'site', prefer: p.id })}
    ${demoNote('The office administrator gets a notification and uploads the report on your behalf. The report keeps your name as the reporter, records who uploaded it and when, and the reason it was late.')}</div>`,
    foot: `<button type="button" class="btn" data-act="closeModal">Cancel</button><button type="submit" class="btn primary">${ico('send', 'sm')}Send request</button>`,
    onSubmit: d => {
      const q = { id: nid('rq'), project: p.id, date: day, by: SESSION, at: Date.now(), reason: d.reason, note: d.note, photos: takePicks('askPh'), status: 'Open', handledBy: null, report: null };
      (DB.reportRequests ||= []).unshift(q);
      notify([...officeAdmins(), p.pm], `${me().name} asked the office to upload the ${fmtD(day)} report for ${p.name}`, '#/site?tab=compliance', 'report');
      logAct(`asked the office to upload the ${fmtD(day)} report for ${p.name}`, p.id, 'site');
      commit(`Request sent to ${a ? a.name : 'the office'}`);
    } });
};

/* ---------- report view: submission record ---------- */
function submissionCard(r) {
  if (r.status !== 'Submitted') return '';
  const late = r.at > reportDeadline(r.date), cs = r.corrections || [];
  return `<div class="card"><div class="card-head"><h2>Submission record</h2>${badge(late ? 'Late' : 'Submitted', late ? 'warn' : 'ok')}${viaOffice(r) ? '<span class="tag">Uploaded by office</span>' : ''}</div>
    <div class="card-body stack"><dl class="dl c3">
      <div><dt>Reporting date</dt><dd>${fmtDY(r.date)}</dd></div><div><dt>Deadline</dt><dd>${fmtDY(r.date)}, 8:00 PM</dd></div>
      <div><dt>Actual upload time</dt><dd>${fmtTs(r.at)}${late ? `<span class="muted" style="display:block;font-weight:400;font-size:12.5px">${fmtMins(lateBy(r) / 6e4)} after the deadline</span>` : ''}</dd></div>
      <div><dt>Reported by</dt><dd>${esc(userName(r.by))}</dd></div><div><dt>Uploaded by</dt><dd>${esc(userName(r.uploadedBy || r.by))}${viaOffice(r) ? ' <span class="muted" style="font-weight:400">(on behalf)</span>' : ''}</dd></div>
      <div><dt>Photos</dt><dd>${repMedia(r).length}</dd></div></dl>
      ${r.lateReason ? `<div class="form-note">${ico('clock', 'sm')}<span><b>Reason for late submission:</b> ${esc(r.lateReason)}</span></div>` : ''}
      ${cs.length ? `<div><h3 style="margin-bottom:10px">Corrections</h3><ul class="timeline">${cs.slice().reverse().map(c => `<li class="k-delay"><div class="when">${fmtTs(c.at)} · ${esc(userName(c.by))}</div><div class="what">${esc(c.note)}</div></li>`).join('')}</ul></div>` : '<p class="muted" style="font-size:13px">No corrections since submission.</p>'}</div></div>`;
}

/* report editor support */
function editorLateBlock() {
  if (!RD) return '';
  const prev = RD.id && DB.reports.find(r => r.id === RD.id);
  const late = !(prev && prev.status === 'Submitted') && Date.now() > reportDeadline(RD.date);
  RD.isLate = late;
  const p = proj(RD.project);
  const staff = [p.supervisor, p.engineer].filter(Boolean);
  const behalf = canBehalf() && !(prev && prev.status === 'Submitted') ? `<div class="row2"><label class="field"><span>Reported by</span><select class="select" data-rd="onBehalf">${[['', `Myself (${me().name})`], ...staff.map(u => [u, `${userName(u)} · on their behalf`])].map(([v, l]) => `<option value="${v}" ${v === (RD.onBehalf || '') ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select><small>The report keeps the site staff member as the reporter and records you as the uploader.</small></label><div></div></div>` : '';
  return `${behalf}${late ? `<div class="banner warn">${ico('clock')}<span>This report is <b>late</b> — the deadline was 8:00 PM on ${fmtD(RD.date)}. The actual upload time will be recorded.</span></div>
    <label class="field${RD.errors.includes('late') ? ' err' : ''}"><span>Reason for late submission <em>*</em></span><textarea rows="2" data-rd="lateReason" placeholder="e.g. No network at site after 6 PM">${esc(RD.lateReason || '')}</textarea></label>` : ''}`;
}
