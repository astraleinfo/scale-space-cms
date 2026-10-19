/* Breadcrumbs above every page — Home › Module › item › tab — built from the route after each render, so pages
   don't add their own. The older "← back" links (.crumb) and per-page trails (.crumbs) are hidden in favour of it. */
'use strict';

function bcTrail() {
  const mod = MODULES.find(m => m.id === ROUTE.mod);
  if (!mod || mod.id === 'dashboard' || !canSee(mod.id)) return [];
  const [a, b, c] = ROUTE.parts, out = [['Home', '#/dashboard'], [mod.label, `#/${mod.id}`]];
  if (mod.id === 'projects' && a) { const p = proj(a); out.push([p ? p.name : 'Not found', `#/projects/${a}`]); }
  else if (mod.id === 'site' && a === 'report') {
    if (b === 'new') out.push(['New daily report']);
    else { const r = DB.reports.find(x => x.id === b); out.push([r ? `${proj(r.project)?.name} · ${fmtD(r.date)}` : 'Report', `#/site/report/${b}`]); if (c === 'edit') out.push(['Edit']); }
  } else if (a) { const h = $('#view h1')?.textContent.trim(); if (h) out.push([h]); }
  if (mod.id === 'performance' && ROUTE.q.u) { const u = user(ROUTE.q.u); if (u) out.push([u.name, `#/performance?u=${u.id}`]); }
  // the open tab, when it isn't the page's first one
  const tabs = $$('#view .tabs [role="tab"]'), on = tabs.find(t => t.getAttribute('aria-selected') === 'true');
  if (on && on !== tabs[0] && ROUTE.q.tab) { const t = on.cloneNode(true); t.querySelectorAll('.n, .ico').forEach(x => x.remove()); const l = t.textContent.trim(); if (l) out.push([l]); }
  return out;
}
function renderCrumbs() {
  const v = $('#view'), list = bcTrail();
  v.querySelector(':scope > .bc')?.remove();
  if (list.length < 2) return;
  v.insertAdjacentHTML('afterbegin', `<nav class="bc" aria-label="Breadcrumb"><ol>${list.map(([t, h], i) => {
    const last = i === list.length - 1;
    return `<li>${last || !h ? `<span ${last ? 'aria-current="page"' : ''}>${i === 0 ? ico('home', 'sm') : ''}${esc(t)}</span>` : `<a href="${h}">${i === 0 ? ico('home', 'sm') : ''}${esc(t)}</a>`}</li>`;
  }).join('')}</ol></nav>`);
  // on narrow screens keep the current page in view
  const ol = v.querySelector(':scope > .bc ol'); if (ol) ol.scrollLeft = ol.scrollWidth;
}
const _renderViewBc = renderView;
renderView = function () { _renderViewBc(); renderCrumbs(); };
