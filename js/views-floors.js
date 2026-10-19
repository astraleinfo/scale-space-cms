/* Floor-wise construction progress: each level (foundation, floors, terrace / interior zones) has its own
   activities that run in parallel. Engineers and supervisors update them, assign workers and add photos. */
'use strict';

const ACT_STATUSES = ['Not started', 'In progress', 'Completed'];
const floorPct = f => Math.round(sum(f.activities, a => a.pct) / Math.max(1, f.activities.length));
const floorStatus = f => f.activities.every(a => a.status === 'Completed') ? 'Completed' : f.activities.some(a => a.pct > 0 || a.status !== 'Not started') ? 'In progress' : 'Not started';
const projLevels = p => p.levels || [];
const levelsTopDown = p => projLevels(p).slice().reverse();
const activeActs = p => projLevels(p).flatMap(f => f.activities.filter(a => a.status === 'In progress').map(a => ({ f, a })));
const actTone = s => s === 'Completed' ? 'ok' : s === 'In progress' ? 'info' : '';
const findAct = (p, actId) => { for (const f of projLevels(p)) { const a = f.activities.find(x => x.id === actId); if (a) return { f, a }; } return null; };
const floorPhotos = (p, f) => DB.documents.filter(d => d.project === p.id && d.floor === f.id).sort((a, b) => b.date.localeCompare(a.date));
const canUpdateFloors = () => can('site');

function syncProjectProgress(p) {
  const acts = projLevels(p).flatMap(f => f.activities);
  if (acts.length && p.status !== 'Completed') p.progress = Math.round(sum(acts, a => a.pct) / acts.length);
}
// apply one activity change (from the floor form or a daily report) and normalise status / dates
function setActivity(a, pct, status) {
  pct = Math.max(0, Math.min(100, Math.round(+pct || 0)));
  if (status === 'Completed') pct = 100;
  else if (pct >= 100) status = 'Completed';
  else if (pct > 0 && status === 'Not started') status = 'In progress';
  else if (pct === 0 && status === 'In progress') pct = Math.max(pct, 0);
  const from = a.pct;
  a.pct = pct; a.status = status;
  if (status !== 'Not started' && !a.start) a.start = TODAY;
  a.done = status === 'Completed' ? (a.done || TODAY) : null;
  return from;
}

/* ---------- compact floor stack (dashboard + progress page) ---------- */
function floorStack(p, { link = true } = {}) {
  return `<div class="fstack">${levelsTopDown(p).map(f => {
    const pct = floorPct(f), st = floorStatus(f), act = f.activities.filter(a => a.status === 'In progress');
    const done = f.activities.filter(a => a.status === 'Completed').length;
    return `<a class="frow ${st === 'Completed' ? 'done' : st === 'In progress' ? 'live' : 'idle'}" href="#/projects/${p.id}?tab=floors&fl=${f.id}">
      <span class="fr-name"><b>${esc(f.name)}</b><small>${done}/${f.activities.length} activities done</small></span>
      <span class="fr-bar"><span class="fr-track"><i style="width:${pct}%"></i></span><b>${pct}%</b></span>
      <span class="fr-acts">${act.length ? act.slice(0, 3).map(a => `<span class="achip"><i></i>${esc(a.name)} <b>${a.pct}%</b></span>`).join('') + (act.length > 3 ? `<span class="muted">+${act.length - 3}</span>` : '') : `<span class="fr-st">${badge(st, actTone(st))}</span>`}</span>
    </a>`; }).join('')}</div>`;
}

/* ---------- dashboard card ---------- */
function floorDashCard() {
  const ps = myProjects().filter(p => projLevels(p).length && p.status !== 'Completed');
  if (!ps.length) return '';
  const p = ps.find(x => x.id === ROUTE.q.fp) || ps[0];
  const live = activeActs(p);
  const doneFloors = projLevels(p).filter(f => floorStatus(f) === 'Completed').length;
  return `<div class="card floors-card"><div class="card-head"><h2>Floor-wise progress</h2><span class="sub">${esc(p.name)}</span><a class="btn ghost sm" href="#/projects/${p.id}?tab=floors">Open floors ${ico('arrowR', 'sm')}</a></div>
    <div class="fp-pills" role="tablist" aria-label="Project">${ps.map(x => `<button role="tab" aria-selected="${x.id === p.id}" class="chip ${x.id === p.id ? 'on' : ''}" data-act="setQ" data-k="fp" data-v="${x.id}">${esc(x.name)} <span class="n">${x.progress}%</span></button>`).join('')}</div>
    <div class="fp-sum"><div><span>Overall</span><b>${p.progress}%</b></div><div><span>${p.type === 'Interior fit-out' ? 'Zones' : 'Levels'} complete</span><b>${doneFloors}<em>/${projLevels(p).length}</em></b></div><div><span>Activities in progress</span><b>${live.length}</b></div>
      <div class="fp-live">${live.slice(0, 4).map(({ f, a }) => `<span class="achip"><i></i>${esc(a.name)} · ${esc(f.name)} <b>${a.pct}%</b></span>`).join('')}</div></div>
    ${floorStack(p)}
    <div class="card-foot" style="justify-content:flex-start"><span class="legend"><span><i class="lg-done"></i>Completed</span><span><i class="lg-live"></i>In progress</span><span><i class="lg-idle"></i>Not started</span></span></div></div>`;
}

/* ---------- project page: Floors tab ---------- */
function floorsTab(p) {
  if (!projLevels(p).length) return `<div class="card">${emptyPage('No floor plan', 'This project has no floors set up.')}</div>`;
  const live = activeActs(p), acts = projLevels(p).flatMap(f => f.activities);
  const log = (DB.floorLog || []).filter(l => l.project === p.id).sort((a, b) => b.at - a.at).slice(0, 8);
  const ok = canUpdateFloors() && p.status !== 'Completed';
  const zone = p.type === 'Interior fit-out' ? 'zone' : 'floor';
  return `<div class="kpis k3">
      <div class="kpi"><div class="l">${ico('flag', 'sm')}Overall progress</div><div class="v">${p.progress}%</div><div class="s">average of ${plural(acts.length, 'activity', 'activities')}</div></div>
      <div class="kpi"><div class="l">${ico('building', 'sm')}${zone === 'zone' ? 'Zones' : 'Levels'} complete</div><div class="v">${projLevels(p).filter(f => floorStatus(f) === 'Completed').length}<small> / ${projLevels(p).length}</small></div><div class="s">${acts.filter(a => a.status === 'Completed').length} activities completed</div></div>
      <div class="kpi"><div class="l">${ico('hardhat', 'sm')}In progress now</div><div class="v">${live.length}</div><div class="s">${live.length ? esc([...new Set(live.map(x => x.f.name))].join(', ')) : 'No active work'}</div></div>
    </div>
    ${live.length ? `<div class="card"><div class="card-head"><h2>Happening now</h2><span class="sub">Activities running in parallel across ${zone}s</span></div><div class="card-body"><div class="now-grid">${live.map(({ f, a }) => `<a class="now-act" href="javascript:void 0" data-act="scrollFloor" data-id="${f.id}"><span class="na-top"><b>${esc(a.name)}</b><span class="tag">${esc(f.name)}</span></span>${meter(a.pct, 'info')}<span class="na-w">${a.workers.length ? `<span class="avs">${a.workers.slice(0, 4).map(worker).filter(Boolean).map(w => av(w.name, 'sm')).join('')}</span>${plural(a.workers.length, 'worker')}` : '<span class="muted">No workers assigned</span>'}</span></a>`).join('')}</div></div></div>` : ''}
    <div class="building">${levelsTopDown(p).map(f => {
      const pct = floorPct(f), st = floorStatus(f), ph = floorPhotos(p, f);
      return `<section class="card floor ${st === 'Completed' ? 'done' : st === 'In progress' ? 'live' : 'idle'}" id="${f.id}">
        <div class="fl-head"><div class="fl-name"><h3>${esc(f.name)}</h3>${badge(st, actTone(st))}</div>
          <div class="fl-pct"><span class="fr-track"><i style="width:${pct}%"></i></span><b>${pct}%</b></div>
          ${ok ? `<button class="btn sm primary" data-act="updateFloor" data-p="${p.id}" data-f="${f.id}">${ico('edit', 'sm')}Update ${zone}</button>` : ''}</div>
        <div class="acts">${f.activities.map(a => `<div class="act ${a.status === 'Completed' ? 'done' : a.status === 'In progress' ? 'live' : 'idle'}">
          <div class="ac-top"><b>${esc(a.name)}</b><span class="ac-st">${a.status === 'Completed' ? ico('check', 'sm') : a.status === 'In progress' ? '<i class="pulse-dot"></i>' : ''}${a.status}</span></div>
          <div class="ac-bar"><i style="width:${a.pct}%"></i></div>
          <div class="ac-foot"><span>${a.pct}%${a.done ? ` · done ${fmtD(a.done)}` : a.start ? ` · started ${fmtD(a.start)}` : ''}</span>${a.workers.length ? `<span class="avs">${a.workers.slice(0, 3).map(worker).filter(Boolean).map(w => av(w.name, 'sm')).join('')}${a.workers.length > 3 ? `<span class="av sm more">+${a.workers.length - 3}</span>` : ''}</span>` : ''}</div>
        </div>`).join('')}</div>
        ${ph.length ? `<div class="fl-photos">${mediaGrid(ph.slice(0, 4), false)}</div>` : ''}
      </section>`; }).join('')}</div>
    <div class="card"><div class="card-head"><h2>Floor update history</h2><span class="sub">Latest changes recorded from site</span></div><div class="card-body">
      ${log.length ? `<ul class="timeline">${log.map(l => { const f = projLevels(p).find(x => x.id === l.floor); return `<li class="k-progress"><div class="when">${fmtTs(l.at)} · ${esc(userName(l.by))}${l.report ? ` · <a href="#/site/report/${l.report}">daily report</a>` : ''}</div>
        <div class="what"><b>${esc(f?.name || '')}</b>: ${l.changes.map(c => { const a = f?.activities.find(x => x.id === c.act); return `${esc(a?.name || '')} ${c.from}% → <b>${c.to}%</b>`; }).join(', ')}</div>${l.note ? `<div class="muted" style="font-size:13.5px">${esc(l.note)}</div>` : ''}</li>`; }).join('')}</ul>` : '<p class="muted">No floor updates yet.</p>'}</div></div>`;
}

/* ---------- update a floor: activities, workers, note, photos ---------- */
ACT.updateFloor = el => {
  const p = proj(el.dataset.p), f = projLevels(p).find(x => x.id === el.dataset.f);
  if (!guard(canUpdateFloors(), 'update floor progress')) return;
  const recent = new Set(DB.reports.filter(r => r.project === p.id && daysFrom(r.date) >= -14).flatMap(r => r.crew.map(c => c.wid)));
  const pool = DB.workers.filter(w => w.status === 'Active' && (w.project === p.id || recent.has(w.id))).sort((a, b) => a.trade.localeCompare(b.trade) || a.name.localeCompare(b.name));
  openModal({ title: `Update ${f.name}`, sub: `${esc(p.name)} · set progress for each activity, assign workers and add photos`, wide: true, body: `<div class="form">
    <div class="fu-list">${f.activities.map((a, i) => `<div class="fu-row" data-i="${i}">
      <div class="fu-name"><b>${esc(a.name)}</b><span>${esc(a.category)}</span></div>
      <select class="select sm" name="st${i}" aria-label="Status of ${esc(a.name)}">${ACT_STATUSES.map(s => `<option ${s === a.status ? 'selected' : ''}>${s}</option>`).join('')}</select>
      <div class="fu-pct"><input type="range" min="0" max="100" step="5" value="${a.pct}" data-fu-range="${i}" aria-label="Progress of ${esc(a.name)}"><input class="input sm" type="number" min="0" max="100" name="pct${i}" value="${a.pct}" data-fu-num="${i}" aria-label="Percent"><span>%</span></div>
      <details class="fu-w"><summary>${ico('users', 'sm')}<span data-fu-wc="${i}">${a.workers.length ? plural(a.workers.length, 'worker') : 'Assign workers'}</span></summary>
        <div class="fu-wlist">${pool.map(w => `<label class="check"><input type="checkbox" name="w${i}" data-multi="1" value="${w.id}" ${a.workers.includes(w.id) ? 'checked' : ''}> ${esc(w.name)} <span class="muted" style="font-size:12px">${esc(w.trade)}</span></label>`).join('') || '<p class="muted">No workers on this site yet.</p>'}</div></details>
    </div>`).join('')}</div>
    ${fld('Note', 'note', { type: 'textarea', rows: 2, ph: `What changed on the ${f.name.toLowerCase()} today?` })}
    <div class="field"><span>Progress photos</span><div class="dropzone" data-act="pickPhotos">${ico('image')}<div><b>Add photos or videos</b> of this ${p.type === 'Interior fit-out' ? 'zone' : 'floor'}</div><input type="file" id="fuFiles" accept="image/*,video/*" multiple hidden></div><ul class="picked" id="fuPicked"></ul></div></div>`,
    onOpen: m => {
      $$('[data-fu-range]', m).forEach(r => r.addEventListener('input', () => { const i = r.dataset.fuRange, n = $(`[data-fu-num="${i}"]`, m), st = $(`[name=st${i}]`, m); n.value = r.value; st.value = +r.value >= 100 ? 'Completed' : +r.value > 0 ? 'In progress' : st.value === 'Completed' ? 'In progress' : st.value; }));
      $$('[data-fu-num]', m).forEach(n => n.addEventListener('input', () => { const i = n.dataset.fuNum; $(`[data-fu-range="${i}"]`, m).value = n.value; }));
      $$('select[name^=st]', m).forEach(s => s.addEventListener('change', () => { const i = s.name.slice(2), n = $(`[name=pct${i}]`, m), r = $(`[data-fu-range="${i}"]`, m); if (s.value === 'Completed') n.value = r.value = 100; if (s.value === 'Not started') n.value = r.value = 0; }));
      $$('.fu-w input', m).forEach(c => c.addEventListener('change', () => { const i = c.name.slice(1), k = $$(`[name=w${i}]:checked`, m).length; $(`[data-fu-wc="${i}"]`, m).textContent = k ? plural(k, 'worker') : 'Assign workers'; }));
      const inp = $('#fuFiles'); inp.addEventListener('change', () => $('#fuPicked').innerHTML = [...inp.files].map(x => `<li>${ico(/^video/.test(x.type) ? 'video' : 'image', 'sm')}<span>${esc(x.name)}</span><small class="muted">${fmtSize(x.size)}</small></li>`).join(''));
      bindDrop($('.dropzone', m), inp);
    },
    onSubmit: d => {
      const changes = [];
      f.activities.forEach((a, i) => {
        const before = a.pct, beforeSt = a.status;
        setActivity(a, d['pct' + i], d['st' + i]);
        a.workers = d['w' + i] || [];
        if (a.pct !== before || a.status !== beforeSt) changes.push({ act: a.id, from: before, to: a.pct, status: a.status });
      });
      const files = [...$('#fuFiles').files];
      const label = changes.length === 1 ? `${f.activities.find(a => a.id === changes[0].act).name} · ${f.name}` : f.name;
      const photos = files.map(file => { const id = addUploadedDoc(file, p.id, null, null, label, 'media'); DB.documents.find(x => x.id === id).floor = f.id; return id; });
      if (!changes.length && !photos.length && !d.note) { toast('No changes to save'); return; }
      (DB.floorLog ||= []).unshift({ id: nid('fl'), project: p.id, floor: f.id, at: Date.now(), by: SESSION, changes, note: d.note, photos });
      syncProjectProgress(p);
      logAct(`updated ${f.name} on ${p.name}${changes.length ? ` (${changes.map(c => `${f.activities.find(a => a.id === c.act).name} ${c.to}%`).join(', ')})` : ''}`, p.id, 'progress');
      commit(`${f.name} updated · project now ${p.progress}%`);
    } });
};
ACT.scrollFloor = el => { const t = document.getElementById(el.dataset.id); if (t) { t.scrollIntoView({ behavior: 'smooth', block: 'start' }); t.classList.add('flash'); setTimeout(() => t.classList.remove('flash'), 1400); } };
