/* Motion: page-enter stagger and number count-up.
   Animations run only when navigating to a new page or tab, not on every re-render. */
'use strict';

const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
let lastViewKey = null;

function countUp(el) {
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  let node;
  while ((node = walker.nextNode())) {
    const m = node.nodeValue.match(/\d[\d,]*(\.\d+)?/);
    if (!m) continue;
    const raw = m[0], target = parseFloat(raw.replace(/,/g, '')), dec = (m[1] || '').length ? m[1].length - 1 : 0;
    if (!isFinite(target) || target === 0) return;
    const pre = node.nodeValue.slice(0, m.index), post = node.nodeValue.slice(m.index + raw.length);
    const commas = raw.includes(',');
    const fmt = v => commas ? v.toLocaleString('en-IN', { minimumFractionDigits: dec, maximumFractionDigits: dec }) : v.toFixed(dec);
    const t0 = performance.now(), dur = 900;
    const tick = now => {
      const k = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - k, 3);
      node.nodeValue = pre + fmt(target * e) + post;
      if (k < 1) requestAnimationFrame(tick); else node.nodeValue = pre + raw + post;
    };
    requestAnimationFrame(tick);
    return;
  }
}

// keep chart text ~12px on screen whatever width the chart is drawn at
function fitChartText(root = document) {
  $$('.chart svg', root).forEach(svg => {
    const vb = svg.viewBox.baseVal?.width, w = svg.getBoundingClientRect().width;
    if (vb && w) svg.style.setProperty('--fs', (12 * vb / w).toFixed(2) + 'px');
  });
}
addEventListener('resize', () => { clearTimeout(fitChartText.t); fitChartText.t = setTimeout(() => fitChartText(), 120); });
document.addEventListener('click', e => { if (e.target.closest('[data-act="vizMode"], .side-toggle, .side-arrow')) setTimeout(() => fitChartText(), 360); });

function enhance(root, animate) {
  fitChartText(root);
  if (!animate || REDUCED) return;
  [...root.children].forEach((el, i) => el.style.setProperty('--i', Math.min(i, 8)));
  $$('.grid, .kpis, .pcards, .media-grid, .files, .folders', root).forEach(g => [...g.children].forEach((el, i) => el.style.setProperty('--i', Math.min(i, 10))));
  $$('.kpi .v, .hero-pills b', root).forEach(countUp);
}

// wrap the core renderers so every render gets enhanced
const _renderView = renderView;
renderView = function () {
  const v = $('#view');
  const key = `${ROUTE.mod}/${ROUTE.parts.join('/')}?${ROUTE.q.tab || ''}|${SESSION}`;
  const animate = key !== lastViewKey;
  lastViewKey = key;
  v.classList.remove('animate');
  _renderView();
  if (animate) { void v.offsetWidth; v.classList.add('animate'); }
  enhance(v, animate);
};
const _renderLogin = renderLogin;
renderLogin = function () { _renderLogin(); lastViewKey = null; enhance($('#loginRoot'), false); };
