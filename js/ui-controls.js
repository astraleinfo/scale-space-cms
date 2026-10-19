/* Themed dropdowns and date pickers. The browser's own option list and calendar ignore the app theme, so on
   mouse / trackpad devices every <select> and <input type="date"> opens a popover drawn here instead. The native
   control stays the source of truth: picking sets its value and fires input + change, so forms, validation and
   data-change handlers work unchanged. Touch devices keep the OS pickers (they follow the light / dark theme). */
'use strict';

const UIC = { pop: null, src: null, kind: null, onKey: null };
const uicFine = () => matchMedia('(pointer: fine)').matches;
const uicSkip = el => el.disabled || el.dataset.native != null || el.multiple || el.readOnly;
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function uicClose(refocus = false) {
  if (!UIC.pop) return;
  const { pop, src } = UIC;
  try { pop.hidePopover?.(); } catch (e) {}
  pop.remove(); src?.classList.remove('uic-open'); src?.setAttribute('aria-expanded', 'false');
  Object.assign(UIC, { pop: null, src: null, kind: null, onKey: null });
  if (refocus) src?.focus();
}
function uicMount(src, kind, cls) {
  uicClose();
  const pop = document.createElement('div');
  pop.className = `uic-pop ${cls}`;
  if (pop.showPopover) pop.setAttribute('popover', 'manual');
  // a modal dialog makes everything outside it inert, so the popover lives inside the dialog; the top layer
  // (popover API) keeps it above the dialog's own scrolling and clipping
  (src.closest('dialog[open]') || document.body).appendChild(pop);
  try { pop.showPopover?.(); } catch (e) {}
  Object.assign(UIC, { pop, src, kind });
  src.classList.add('uic-open'); src.setAttribute('aria-expanded', 'true');
  return pop;
}
function uicPlace() {
  const { pop, src } = UIC; if (!pop) return;
  const r = src.getBoundingClientRect(), vw = innerWidth, vh = innerHeight;
  if (r.bottom < 0 || r.top > vh) { uicClose(); return; }
  if (vw <= 600 && UIC.kind === 'date') { pop.classList.add('sheet'); return; }
  const w = UIC.kind === 'select' ? Math.min(Math.max(r.width, 200), vw - 16) : pop.offsetWidth;
  pop.style.width = UIC.kind === 'select' ? w + 'px' : '';
  const h = pop.offsetHeight, below = vh - r.bottom - 10, up = below < Math.min(h, 260) && r.top > below;
  pop.style.left = Math.max(8, Math.min(r.left, vw - w - 8)) + 'px';
  pop.style.top = (up ? Math.max(8, r.top - h - 6) : r.bottom + 6) + 'px';
  if (UIC.kind === 'select') pop.style.maxHeight = Math.max(160, Math.min(340, (up ? r.top : below) - 12)) + 'px';
  pop.classList.toggle('up', up);
}

/* ---------- select ---------- */
function openSelect(s) {
  const pop = uicMount(s, 'select', 'uic-sel');
  const opts = [...s.options], many = opts.length > 8;
  pop.setAttribute('role', 'listbox');
  pop.innerHTML = `${many ? `<div class="uic-search">${ico('search', 'sm')}<input type="text" placeholder="Search…" aria-label="Search options" autocomplete="off"></div>` : ''}<div class="uic-list">${[...s.children].map(c => c.tagName === 'OPTGROUP'
      ? `<div class="uic-grp">${esc(c.label)}</div>${[...c.children].map(o => optBtn(o, opts.indexOf(o), s)).join('')}`
      : optBtn(c, opts.indexOf(c), s)).join('')}<div class="uic-none" hidden>No matches</div></div>`;
  uicPlace();
  const list = $('.uic-list', pop), items = () => [...list.querySelectorAll('.uic-opt:not([hidden]):not([aria-disabled="true"])')];
  let act = list.querySelector('.uic-opt[aria-selected="true"]') || items()[0];
  const setAct = el => { list.querySelectorAll('.uic-opt.act').forEach(x => x.classList.remove('act')); act = el; if (el) { el.classList.add('act'); el.scrollIntoView({ block: 'nearest' }); } };
  setAct(act);
  const pick = el => { if (!el || el.getAttribute('aria-disabled') === 'true') return; const i = +el.dataset.i; if (s.selectedIndex !== i) { s.selectedIndex = i; s.dispatchEvent(new Event('input', { bubbles: true })); s.dispatchEvent(new Event('change', { bubbles: true })); } uicClose(true); };
  pop.addEventListener('mousedown', e => { if (!e.target.closest('input')) e.preventDefault(); });
  pop.addEventListener('click', e => pick(e.target.closest('.uic-opt')));
  pop.addEventListener('mousemove', e => { const o = e.target.closest('.uic-opt'); if (o && o !== act && o.getAttribute('aria-disabled') !== 'true') setAct(o); });
  const q = $('.uic-search input', pop);
  if (q) { setTimeout(() => q.focus(), 0); q.addEventListener('input', () => { const t = q.value.trim().toLowerCase(); list.querySelectorAll('.uic-opt').forEach(o => o.hidden = t && !o.textContent.toLowerCase().includes(t)); list.querySelectorAll('.uic-grp').forEach(g => { let n = g.nextElementSibling, any = false; while (n && n.classList.contains('uic-opt')) { if (!n.hidden) any = true; n = n.nextElementSibling; } g.hidden = !any; }); $('.uic-none', list).hidden = items().length > 0; setAct(items()[0]); }); }
  let typed = '', tt;
  UIC.onKey = e => {
    const xs = items(), i = xs.indexOf(act);
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); setAct(xs[Math.max(0, Math.min(xs.length - 1, i + (e.key === 'ArrowDown' ? 1 : -1)))] || xs[0]); }
    else if (e.key === 'Home' || e.key === 'End') { if (e.target === q) return; e.preventDefault(); setAct(e.key === 'Home' ? xs[0] : xs.at(-1)); }
    else if (e.key === 'Enter' || (e.key === ' ' && e.target !== q)) { e.preventDefault(); pick(act); }
    else if (e.key === 'Tab') uicClose();
    else if (!q && e.key.length === 1 && !e.ctrlKey && !e.metaKey) { typed += e.key.toLowerCase(); clearTimeout(tt); tt = setTimeout(() => typed = '', 600); const m = xs.find(o => o.textContent.trim().toLowerCase().startsWith(typed)); if (m) setAct(m); }
  };
}
const optBtn = (o, i, s) => `<div class="uic-opt" role="option" data-i="${i}" aria-selected="${i === s.selectedIndex}" ${o.disabled ? 'aria-disabled="true"' : ''}><span>${esc(o.textContent) || '&nbsp;'}</span>${i === s.selectedIndex ? ico('check', 'sm') : ''}</div>`;

/* ---------- date ---------- */
function openDate(inp, focusGrid = false) {
  const pop = uicMount(inp, 'date', 'uic-cal');
  const min = inp.min || '', max = inp.max || '', today = TODAY;
  let sel = inp.value || '', view = (sel || (max && max < today ? max : min && min > today ? min : today)).slice(0, 7), mode = 'days', cursor = sel || today;
  const ok = d => (!min || d >= min) && (!max || d <= max);
  const draw = () => {
    const [y, m] = view.split('-').map(Number);
    let body;
    if (mode === 'months') {
      body = `<div class="uic-mgrid">${MONTHS.map((n, i) => { const k = `${y}-${pad(i + 1)}`, dis = (min && k < min.slice(0, 7)) || (max && k > max.slice(0, 7)); return `<button type="button" class="${k === view ? 'on' : ''} ${k === today.slice(0, 7) ? 'now' : ''}" data-m="${k}" ${dis ? 'disabled' : ''}>${n.slice(0, 3)}</button>`; }).join('')}</div>`;
    } else {
      const first = new Date(y, m - 1, 1), start = new Date(first); start.setDate(1 - first.getDay());
      const cells = []; for (let i = 0; i < 42; i++) { const d = new Date(start); d.setDate(start.getDate() + i); cells.push(iso(d)); }
      body = `<div class="uic-week">${['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(w => `<span>${w}</span>`).join('')}</div>
        <div class="uic-days" role="grid">${cells.map(d => `<button type="button" data-d="${d}" class="${d.slice(0, 7) !== view ? 'out' : ''} ${d === today ? 'now' : ''} ${d === sel ? 'on' : ''} ${d === cursor ? 'cur' : ''}" ${ok(d) ? '' : 'disabled'} tabindex="${d === cursor ? 0 : -1}" aria-label="${parseD(d).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}" ${d === sel ? 'aria-pressed="true"' : ''}>${+d.slice(8)}</button>`).join('')}</div>`;
    }
    const prevOk = mode === 'months' ? !min || `${y - 1}-12` >= min.slice(0, 7) : !min || iso(new Date(y, m - 1, 0)) >= min;
    const nextOk = mode === 'months' ? !max || `${y + 1}-01` <= max.slice(0, 7) : !max || iso(new Date(y, m, 1)) <= max;
    pop.innerHTML = `<div class="uic-head"><button type="button" class="uic-nav" data-nav="-1" aria-label="${mode === 'months' ? 'Previous year' : 'Previous month'}" ${prevOk ? '' : 'disabled'}>${ico('chevL', 'sm')}</button>
        <button type="button" class="uic-title" data-mode aria-label="Choose month">${mode === 'months' ? y : `${MONTHS[m - 1]} ${y}`}${ico('chevD', 'sm')}</button>
        <button type="button" class="uic-nav" data-nav="1" aria-label="${mode === 'months' ? 'Next year' : 'Next month'}" ${nextOk ? '' : 'disabled'}>${ico('chevR', 'sm')}</button></div>
      ${body}
      <div class="uic-foot">${!inp.required && sel ? '<button type="button" class="uic-link" data-clear>Clear</button>' : '<span></span>'}${ok(today) ? `<button type="button" class="uic-link strong" data-d="${today}">Today</button>` : ''}</div>`;
    uicPlace();
    if (focusGrid) $('.uic-days .cur', pop)?.focus();
  };
  const set = d => { inp.value = d; sel = d; inp.dispatchEvent(new Event('input', { bubbles: true })); inp.dispatchEvent(new Event('change', { bubbles: true })); uicClose(true); };
  const move = (d, n, unit = 'd') => { const x = parseD(d); if (unit === 'm') x.setMonth(x.getMonth() + n); else x.setDate(x.getDate() + n); let k = iso(x); if (min && k < min) k = min; if (max && k > max) k = max; return k; };
  pop.addEventListener('mousedown', e => e.preventDefault());
  pop.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b || b.disabled) return;
    if (b.dataset.nav) { const [y, m] = view.split('-').map(Number), d = mode === 'months' ? new Date(y + +b.dataset.nav, m - 1, 1) : new Date(y, m - 1 + +b.dataset.nav, 1); view = iso(d).slice(0, 7); draw(); }
    else if (b.dataset.mode != null) { mode = mode === 'months' ? 'days' : 'months'; draw(); }
    else if (b.dataset.m) { view = b.dataset.m; mode = 'days'; draw(); }
    else if (b.dataset.clear != null) { inp.value = ''; inp.dispatchEvent(new Event('input', { bubbles: true })); inp.dispatchEvent(new Event('change', { bubbles: true })); uicClose(true); }
    else if (b.dataset.d) set(b.dataset.d);
  });
  UIC.onKey = e => {
    const inGrid = pop.contains(document.activeElement);
    if (!inGrid) { if (e.key === 'ArrowDown' && e.altKey) { e.preventDefault(); focusGrid = true; draw(); } else if (e.key === 'Tab') uicClose(); return; }
    const k = { ArrowLeft: [-1], ArrowRight: [1], ArrowUp: [-7], ArrowDown: [7], PageUp: [-1, 'm'], PageDown: [1, 'm'] }[e.key];
    if (k && mode === 'days') { e.preventDefault(); cursor = move(cursor, ...k); view = cursor.slice(0, 7); focusGrid = true; draw(); }
    else if (e.key === 'Enter' || e.key === ' ') { const b = document.activeElement.closest('button'); if (b) { e.preventDefault(); b.click(); } }
  };
  // typing into the field moves the calendar along with it
  const sync = () => { if (UIC.src !== inp) { inp.removeEventListener('input', sync); return; } if (inp.value && inp.value !== sel) { sel = cursor = inp.value; view = sel.slice(0, 7); focusGrid = false; draw(); } };
  inp.addEventListener('input', sync);
  draw();
}

/* ---------- wiring ---------- */
document.addEventListener('mousedown', e => {
  if (UIC.pop && UIC.pop.contains(e.target)) return;
  const s = e.target.closest('select'), d = !s && e.target.closest('input[type=date]');
  if (e.button !== 0 || !uicFine()) { if (UIC.pop) uicClose(); return; }
  if (s && !uicSkip(s)) { e.preventDefault(); s.focus(); if (UIC.src === s) uicClose(); else openSelect(s); return; }
  if (d && !uicSkip(d)) { if (UIC.src !== d) setTimeout(() => openDate(d)); return; }
  if (UIC.pop) uicClose();
}, true);
// Firefox opens its own calendar on click
document.addEventListener('click', e => { const d = e.target.closest('input[type=date]'); if (d && !uicSkip(d) && uicFine()) e.preventDefault(); }, true);
document.addEventListener('keydown', e => {
  if (UIC.pop) {
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); uicClose(true); return; }
    UIC.onKey?.(e); return;
  }
  const s = e.target.closest?.('select');
  if (s && !uicSkip(s) && uicFine() && (e.key === 'Enter' || e.key === ' ' || e.key === 'F4' || ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && (e.altKey || /Mac/.test(navigator.platform))))) { e.preventDefault(); openSelect(s); return; }
  const d = e.target.closest?.('input[type=date]');
  if (d && !uicSkip(d) && uicFine() && e.key === 'ArrowDown' && e.altKey) { e.preventDefault(); openDate(d, true); }
}, true);
document.addEventListener('scroll', e => { if (UIC.pop && !UIC.pop.contains(e.target)) uicPlace(); }, true);
addEventListener('resize', () => uicClose());
['modal', 'drawer'].forEach(id => document.getElementById(id)?.addEventListener('close', () => uicClose()));
addEventListener('hashchange', () => uicClose());
