/* Core: utilities, store, roles & permissions, UI primitives, shell, router. */
'use strict';

/* ================= utilities ================= */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pad = n => String(n).padStart(2, '0');
const iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const dayOff = n => { const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() + n); return iso(d); };
const TODAY = dayOff(0);
const parseD = s => { const [y, m, d] = String(s).split('-').map(Number); return new Date(y, m - 1, d); };
const daysFrom = s => Math.round((parseD(s) - parseD(TODAY)) / 864e5);
const shiftD = (s, n) => { const d = parseD(s); d.setDate(d.getDate() + n); return iso(d); };
const fmtD = s => s ? parseD(s).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '—';
const fmtDY = s => s ? parseD(s).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
const fmtLong = s => parseD(s).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const fmtTs = t => new Date(t).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
const relD = s => { const n = daysFrom(s); return n === 0 ? 'Today' : n === -1 ? 'Yesterday' : n === 1 ? 'Tomorrow' : n < 0 ? `${-n} days ago` : `In ${n} days`; };
const ago = t => { if (!t) return 'Never'; const m = (Date.now() - t) / 6e4; if (m < 1) return 'Just now'; if (m < 60) return Math.round(m) + ' min ago'; if (m < 1440) return Math.round(m / 60) + ' h ago'; return Math.round(m / 1440) + ' d ago'; };
// money is masked for roles without "View financial details", so a figure can't leak through any screen
const MONEY_MASK = '₹ •••';
const inr = n => !canMoney() ? MONEY_MASK : '₹' + Math.round(n || 0).toLocaleString('en-IN');
const inrS = n => { if (!canMoney()) return MONEY_MASK; const a = Math.abs(n || 0), sg = n < 0 ? '−' : ''; return a >= 1e7 ? sg + '₹' + (a / 1e7).toFixed(2) + ' Cr' : a >= 1e5 ? sg + '₹' + (a / 1e5).toFixed(1) + ' L' : sg + inr(a); };
const num = n => (+n || 0).toLocaleString('en-IN');
const sum = (a, f = x => x) => a.reduce((s, x) => s + (+f(x) || 0), 0);
const plural = (n, w, pl) => `${n} ${n === 1 ? w : pl || w + 's'}`;
const initials = n => String(n).replace(/^(Dr\.|Mrs\.|Thiru\.|Sri)\s+/, '').split(/\s+/).map(w => w[0]).filter(c => /[A-Za-z]/.test(c)).slice(0, 2).join('').toUpperCase();
const fmtSize = b => !b ? '0 KB' : b >= 1e9 ? (b / 1e9).toFixed(1) + ' GB' : b >= 1e6 ? (b / 1e6).toFixed(1) + ' MB' : Math.max(1, Math.round(b / 1e3)) + ' KB';
const greeting = () => { const h = new Date().getHours(); return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'; };
const AVC = ['#7A4E2D', '#2F5E9E', '#2E7D5B', '#8A3B6B', '#5B4FA8', '#A0522D', '#3C6E71', '#9E3B33', '#4F6D2F'];
const avColor = s => { let h = 7; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) >>> 0; return AVC[h % AVC.length]; };
const av = (name, cls = '') => { const ph = typeof avPhoto === 'function' && avPhoto(name); return `<span class="av ${cls}${ph ? ' has-ph' : ''}" style="--av:${avColor(name)}" title="${esc(name)}" aria-hidden="true">${ph ? `<img src="${ph}" alt="">` : esc(initials(name))}</span>`; };

/* ================= icons ================= */
const IC = {
  home: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V20h14V9.5"/><path d="M10 20v-6h4v6"/>',
  building: '<rect x="4" y="3" width="16" height="18" rx="1.5"/><path d="M9 7h1M14 7h1M9 11h1M14 11h1M9 15h1M14 15h1M10 21v-3h4v3"/>',
  hardhat: '<path d="M3 17h18v2H3z"/><path d="M5 17a7 7 0 0 1 14 0"/><path d="M10 10V5.5a2 2 0 0 1 4 0V10"/>',
  folder: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
  wallet: '<path d="M4 7h14a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a1 1 0 0 1-1-1V7Z"/><path d="M4 7V6a2 2 0 0 1 2-2h10v3"/><circle cx="16" cy="13.5" r="1.2"/>',
  enquiry: '<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.4A8 8 0 1 1 21 12Z"/><path d="M9 10h6M9 13.5h4"/>',
  flag: '<path d="M5 21V4"/><path d="M5 4h11l-2 4 2 4H5"/>',
  panel: '<rect x="3" y="4" width="18" height="16" rx="3"/><path d="M9.5 4v16"/><path d="m15.5 10-2 2 2 2"/>',
  trend: '<path d="M3 17l6-6 4 4 8-8"/><path d="M15 7h6v6"/>',
  chart: '<path d="M4 20V4"/><path d="M4 20h16"/><path d="M8 16v-5M12 16V8M16 16v-3"/>',
  shield: '<path d="M12 3 4.5 6v5.5c0 4.6 3.2 8.2 7.5 9.5 4.3-1.3 7.5-4.9 7.5-9.5V6z"/><path d="m9 12 2 2 4-4"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  chevR: '<path d="m9 6 6 6-6 6"/>', chevL: '<path d="m15 6-6 6 6 6"/>', chevD: '<path d="m6 9 6 6 6-6"/>',
  arrowL: '<path d="M19 12H5M11 6l-6 6 6 6"/>', arrowR: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  pin: '<path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11Z"/><circle cx="12" cy="10" r="2.3"/>',
  phone: '<path d="M5 4h3.5l1.5 4-2 1.5a11 11 0 0 0 6.5 6.5l1.5-2 4 1.5V19a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2Z"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3.5 6.5 8.5 6.5 8.5-6.5"/>',
  cal: '<rect x="3.5" y="5" width="17" height="15.5" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  alert: '<path d="M12 3.5 2.5 20h19z"/><path d="M12 10v4.5M12 17.5v.01"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18 14a6.5 6.5 0 0 1 3.5 6"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  upload: '<path d="M12 16V4M7 9l5-5 5 5"/><path d="M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"/>',
  download: '<path d="M12 4v12M7 11l5 5 5-5"/><path d="M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"/>',
  file: '<path d="M14 3H6.5A1.5 1.5 0 0 0 5 4.5v15A1.5 1.5 0 0 0 6.5 21h11a1.5 1.5 0 0 0 1.5-1.5V8z"/><path d="M14 3v5h5"/>',
  image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="9.5" r="1.8"/><path d="m21 16-5-5-9 9"/>',
  video: '<rect x="3" y="5.5" width="13" height="13" rx="2"/><path d="m16 10 5-3v10l-5-3"/>',
  play: '<path d="M8 5.5v13l10.5-6.5z" fill="currentColor"/>',
  grid: '<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/>',
  rows: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  logout: '<path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3"/><path d="M10 16l-4-4 4-4M6 12h10"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13.5 6.5 4 4"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  lock: '<rect x="5" y="10.5" width="14" height="10" rx="2"/><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3"/>',
  eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z"/><circle cx="12" cy="12" r="3"/>',
  rupee: '<path d="M7 5h10M7 9h10M7 5h3.5a4 4 0 0 1 0 8H7l7 7"/>',
  receipt: '<path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h6"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M4.5 12h-2M21.5 12h-2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4"/>',
  cloud: '<path d="M7 18a4.5 4.5 0 0 1-.5-9 6 6 0 0 1 11.5 1.5A3.8 3.8 0 0 1 17.5 18z"/>',
  rain: '<path d="M7 15a4.5 4.5 0 0 1-.5-9 6 6 0 0 1 11.5 1.5A3.8 3.8 0 0 1 17.5 15z"/><path d="M8 18l-1 2.5M12 18l-1 2.5M16 18l-1 2.5"/>',
  print: '<path d="M7 9V3h10v6"/><rect x="3.5" y="9" width="17" height="8" rx="2"/><path d="M7 14h10v7H7z"/>',
  swap: '<path d="M7 4 3 8l4 4"/><path d="M3 8h14"/><path d="m17 20 4-4-4-4"/><path d="M21 16H7"/>',
  more: '<circle cx="5.5" cy="12" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="18.5" cy="12" r="1.2"/>',
  report: '<path d="M14 3H6.5A1.5 1.5 0 0 0 5 4.5v15A1.5 1.5 0 0 0 6.5 21h11a1.5 1.5 0 0 0 1.5-1.5V8z"/><path d="M14 3v5h5M9 13h6M9 17h4"/>',
  task: '<rect x="4" y="4" width="16" height="16" rx="3"/><path d="m8.5 12 2.5 2.5 4.5-5"/>',
  refresh: '<path d="M20 11a8 8 0 0 0-14.5-4.5L4 8"/><path d="M4 4v4h4"/><path d="M4 13a8 8 0 0 0 14.5 4.5L20 16"/><path d="M20 20v-4h-4"/>',
  moon: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5Z"/>',
  convert: '<path d="M4 12a8 8 0 0 1 14-5.3L20 9"/><path d="M20 4v5h-5"/><path d="M20 12a8 8 0 0 1-14 5.3L4 15"/><path d="M4 20v-5h5"/>',
  filter: '<path d="M4 5h16l-6 7.5V19l-4 1.5v-8z"/>',
  camera: '<path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1Z"/><circle cx="12" cy="13.5" r="3.5"/>',
  bell: '<path d="M6 16v-5a6 6 0 0 1 12 0v5l1.5 2h-15z"/><path d="M10 20.5a2 2 0 0 0 4 0"/>',
  star: '<path d="m12 3.5 2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8L3.5 9.7l5.9-.9z"/>',
  box: '<path d="M3.5 7.5 12 3l8.5 4.5v9L12 21l-8.5-4.5z"/><path d="M3.5 7.5 12 12l8.5-4.5M12 12v9"/>',
  truck: '<path d="M2.5 6h11v10h-11z"/><path d="M13.5 9.5h4l3 3.5v3h-7"/><circle cx="7" cy="17.5" r="1.8"/><circle cx="17" cy="17.5" r="1.8"/>',
  wrench: '<path d="M15 4a5 5 0 0 0-4.6 6.9L4 17.3V20h2.7l6.4-6.4A5 5 0 0 0 20 9l-3 1.5L14.5 8 16 5z"/>',
  userCheck: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="m16 11 2 2 4-4"/>',
  leave: '<rect x="3.5" y="5" width="17" height="15.5" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4M9.5 15l2 2 3.5-3.5"/>',
  gps: '<circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2.5"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>',
  compare: '<rect x="3" y="4" width="7.5" height="16" rx="1.5"/><rect x="13.5" y="4" width="7.5" height="16" rx="1.5"/>',
  archive: '<rect x="3" y="4" width="18" height="4.5" rx="1"/><path d="M5 8.5V20h14V8.5M10 12.5h4"/>',
  history: '<path d="M3.5 12a8.5 8.5 0 1 0 2.6-6.1L3.5 8.5"/><path d="M3.5 4v4.5H8M12 7.5V12l3 2"/>',
  send: '<path d="M21 3 10 14M21 3l-7 18-4-7-7-4z"/>',
  invoice: '<path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9 7.5h6M9 11h6M9 14.5h3"/>',
};
const ico = (n, cls = '') => `<svg class="ico ${cls}" viewBox="0 0 24 24" aria-hidden="true">${IC[n] || ''}</svg>`;

/* ================= roles & permissions ================= */
const ROLES = {
  owner: { label: 'Owner', desc: 'Full access to every module and setting' },
  sysadmin: { label: 'Admin', desc: 'Users, roles, access, settings, projects and all operations — no financial information' },
  pm: { label: 'Project Manager', desc: 'Runs projects, sites, progress and enquiries' },
  engineer: { label: 'Site Engineer', desc: 'Site operations, documents and progress for assigned projects' },
  supervisor: { label: 'Supervisor', desc: 'Attendance, tasks and daily reports for assigned sites' },
  accounts: { label: 'Accounts', desc: 'Payments, salaries, bills, expenses and reports' },
  admin: { label: 'Office Admin', desc: 'Attendance, leave, document control and reports on behalf of site staff' },
};
const MODULES = [
  { id: 'dashboard', label: 'Dashboard', icon: 'home', group: 'Overview' },
  { id: 'analytics', label: 'Analytics', icon: 'trend', group: 'Overview' },
  { id: 'reports', label: 'Reports', icon: 'chart', group: 'Overview' },
  { id: 'projects', label: 'Projects', icon: 'building', group: 'Construction' },
  { id: 'site', label: 'Site Operations', icon: 'hardhat', group: 'Construction' },
  { id: 'progress', label: 'Progress & History', icon: 'flag', group: 'Construction' },
  { id: 'materials', label: 'Materials', icon: 'box', group: 'Construction' },
  { id: 'service', label: 'Service History', icon: 'wrench', group: 'Construction' },
  { id: 'attendance', label: 'Attendance', icon: 'userCheck', group: 'Team' },
  { id: 'leave', label: 'Leave', icon: 'leave', group: 'Team' },
  { id: 'performance', label: 'Performance', icon: 'star', group: 'Team' },
  { id: 'documents', label: 'Documents & Media', icon: 'folder', group: 'Records' },
  { id: 'invoices', label: 'Invoices & Bills', icon: 'invoice', group: 'Records' },
  { id: 'finance', label: 'Payments & Expenses', icon: 'wallet', group: 'Records' },
  { id: 'enquiries', label: 'Enquiries & Clients', icon: 'enquiry', group: 'Business' },
  { id: 'users', label: 'Users & Access', icon: 'shield', group: 'Admin' },
];
// edit = create & change, view = read-only, none = hidden
// every employee (all roles except the owner) can mark their own attendance and apply for leave, whatever the module access
const PERMS = {
  sysadmin:   { dashboard: 'edit', analytics: 'none', reports: 'view', projects: 'edit', site: 'edit', progress: 'edit', materials: 'edit', service: 'edit', attendance: 'edit', leave: 'edit', performance: 'none', documents: 'edit', invoices: 'none', finance: 'none', enquiries: 'edit', users: 'edit' },
  owner:      { dashboard: 'edit', analytics: 'edit', reports: 'edit', projects: 'edit', site: 'edit', progress: 'edit', materials: 'edit', service: 'edit', attendance: 'edit', leave: 'edit', performance: 'edit', documents: 'edit', invoices: 'edit', finance: 'edit', enquiries: 'edit', users: 'edit' },
  pm:         { dashboard: 'view', analytics: 'none', reports: 'view', projects: 'edit', site: 'edit', progress: 'edit', materials: 'edit', service: 'edit', attendance: 'view', leave: 'edit', performance: 'none', documents: 'edit', invoices: 'view', finance: 'view', enquiries: 'edit', users: 'none' },
  engineer:   { dashboard: 'view', analytics: 'none', reports: 'none', projects: 'view', site: 'edit', progress: 'edit', materials: 'edit', service: 'edit', attendance: 'view', leave: 'view', performance: 'none', documents: 'edit', invoices: 'none', finance: 'none', enquiries: 'none', users: 'none' },
  supervisor: { dashboard: 'view', analytics: 'none', reports: 'none', projects: 'view', site: 'edit', progress: 'view', materials: 'edit', service: 'edit', attendance: 'view', leave: 'view', performance: 'none', documents: 'edit', invoices: 'none', finance: 'none', enquiries: 'none', users: 'none' },
  accounts:   { dashboard: 'view', analytics: 'none', reports: 'view', projects: 'view', site: 'view', progress: 'none', materials: 'view', service: 'view', attendance: 'view', leave: 'view', performance: 'none', documents: 'view', invoices: 'edit', finance: 'edit', enquiries: 'view', users: 'none' },
  admin:      { dashboard: 'view', analytics: 'none', reports: 'view', projects: 'view', site: 'edit', progress: 'view', materials: 'edit', service: 'edit', attendance: 'edit', leave: 'edit', performance: 'none', documents: 'edit', invoices: 'view', finance: 'view', enquiries: 'view', users: 'none' },
};
// finer-grained actions shown in the permission matrix
const ACTIONS = [
  ['Record client payments', r => r === 'owner' || r === 'accounts'],
  ['Pay salaries & advances', r => r === 'owner' || r === 'accounts'],
  ['Add site expenses', r => ['owner', 'accounts', 'pm', 'engineer'].includes(r)],
  ['Submit daily reports', r => ['owner', 'pm', 'engineer', 'supervisor', 'admin'].includes(r)],
  ['Submit reports on behalf of site staff', r => ['owner', 'sysadmin', 'pm', 'admin'].includes(r)],
  ['Correct attendance', r => ['owner', 'sysadmin', 'admin'].includes(r)],
  ['Approve leave', r => ['owner', 'sysadmin', 'pm', 'admin'].includes(r)],
  ['Complete appraisals', r => ['owner', 'sysadmin', 'pm'].includes(r)],
  ['Approve documents & plans', r => ['owner', 'sysadmin', 'pm'].includes(r)],
  ['Issue invoices & pay bills', r => r === 'owner' || r === 'accounts'],
  ['Convert enquiry to project', r => ['owner', 'sysadmin', 'pm'].includes(r)],
  ['View financial details', r => r !== 'sysadmin'],
  ['Manage users & roles', r => r === 'owner' || r === 'sysadmin'],
];

/* ================= store ================= */
const KEY = 'ssb-demo-v1';
let DB, SESSION = null;
const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* storage unavailable: demo still works in memory */ } },
  del(k) { try { localStorage.removeItem(k); } catch { } },
};
function loadDB() {
  const raw = store.get(KEY);
  if (raw) { try { const d = JSON.parse(raw); if (d && d.v === 5 && d.seedDay === TODAY) return d.data; } catch { } }
  return buildSeed();
}
function saveDB() { store.set(KEY, JSON.stringify({ v: 5, seedDay: TODAY, data: DB })); }
// run after the data is loaded or rebuilt (e.g. to re-apply saved dropdown settings)
const LOAD_HOOKS = [];
function resetDB() { DB = buildSeed(); BLOBS.clear(); LOAD_HOOKS.forEach(f => f()); saveDB(); }
const nid = p => p + (++DB.seq);
const BLOBS = new Map(); // uploaded files live only for this browser session

const me = () => DB.users.find(u => u.id === SESSION);
const role = () => me()?.role;
const perm = mod => PERMS[role()]?.[mod] || 'none';
const can = mod => perm(mod) === 'edit';
const canSee = mod => perm(mod) !== 'none';
const isScoped = () => ['engineer', 'supervisor'].includes(role());
const myProjects = () => DB.projects.filter(p => !isScoped() || [p.engineer, p.supervisor].includes(SESSION));
const myProjectIds = () => new Set(myProjects().map(p => p.id));
const user = id => DB.users.find(u => u.id === id);
const userName = id => user(id)?.name || '—';
const proj = id => DB.projects.find(p => p.id === id);
const worker = id => DB.workers.find(w => w.id === id);
// saved overrides from Users & Access › Roles & permissions: { [action label]: { [role]: true | false } }
const ACTION_OVR = {};
const actionAllowed = (label, r) => { const o = ACTION_OVR[label]?.[r]; if (o != null) return o; const a = ACTIONS.find(x => x[0] === label); return a ? a[1](r) : false; };
const can2 = label => actionAllowed(label, role());
// financial information (amounts, invoices, bills, payments, wages, budgets) is limited to roles with this permission
const canMoney = () => actionAllowed('View financial details', role());

function logAct(text, project = null, kind = 'info') { DB.activity.unshift({ at: Date.now(), by: SESSION, project, kind, text }); DB.activity = DB.activity.slice(0, 80); }
function commit(msg) { saveDB(); render(); if (msg) toast(msg); }

/* guard: wraps an action that needs edit rights */
function guard(ok, what = 'make changes here') {
  if (ok) return true;
  toast(`Your role (${ROLES[role()].label}) can't ${what}.`, 'lock');
  return false;
}
const lockAttr = ok => ok ? '' : ` class-lock="1" aria-disabled="true" title="Not available for your role"`;
function btn(label, act, { icon, cls = '', ok = true, data = '' } = {}) {
  return `<button type="button" class="btn ${cls} ${ok ? '' : 'locked'}" data-act="${act}" ${data}${ok ? '' : ' aria-disabled="true" title="Not available for your role"'}>${icon ? ico(icon) : ''}${ok ? '' : ico('lock', 'sm')}${label}</button>`;
}

/* ================= domain helpers ================= */
function planPct(p) {
  if (p.status === 'Completed') return 100;
  const t = (parseD(TODAY) - parseD(p.start)) / (parseD(p.end) - parseD(p.start));
  return Math.max(0, Math.min(100, Math.round(t * 100)));
}
const STATUS_TONE = { 'On track': 'ok', 'At risk': 'warn', Delayed: 'bad', 'On hold': '', Completed: 'info',
  'In progress': 'info', 'Not started': '', Planned: '', Done: 'ok', Open: 'bad', Resolved: 'ok',
  New: 'info', Contacted: '', 'Site visit': 'warn', 'Quotation sent': 'brand', Negotiation: 'warn', Won: 'ok', Lost: 'bad',
  Paid: 'ok', 'Part paid': 'warn', Pending: 'bad', Overdue: 'bad', Active: 'ok', Inactive: '', Invited: 'warn',
  Sent: 'brand', Revised: 'warn', Accepted: 'ok', Declined: 'bad', Draft: '',
  Issued: 'info', 'Partially Paid': 'warn', Cancelled: '', 'Under Review': 'warn', Approved: 'ok', Finalized: 'final', Rejected: 'bad', Superseded: '', Archived: '',
  Submitted: 'ok', Late: 'warn', Missing: 'bad', Stoppage: '', Reported: 'warn', Closed: '',
  Present: 'ok', 'Half day': 'warn', Absent: 'bad', 'On leave': 'info', 'Weekly off': '', 'Not checked in': '',
  Ordered: 'info', Received: 'ok', 'Partially received': 'warn' };
const badge = (s, tone) => `<span class="badge ${tone ?? STATUS_TONE[s] ?? ''}">${esc(s)}</span>`;
const meter = (pct, tone = '', plan = null) => `<div class="meter ${tone}" role="img" aria-label="${pct}% complete${plan != null ? `, planned ${plan}%` : ''}"><div class="bar ${plan != null ? 'plan' : ''}"><i style="width:${Math.max(0, Math.min(100, pct))}%"></i>${plan != null ? `<b style="left:calc(${plan}% - 1px)" title="Planned ${plan}%"></b>` : ''}</div><span>${pct}%</span></div>`;
const projTone = p => p.status === 'Delayed' ? 'bad' : p.status === 'At risk' ? 'warn' : p.status === 'Completed' ? 'ok' : '';

function projFinance(pid) {
  const p = proj(pid);
  const billed = sum(DB.billing.filter(b => b.project === pid && b.billed), b => b.amount);
  const received = sum(DB.payments.filter(x => x.project === pid), x => x.amount);
  const expenses = sum(DB.expenses.filter(x => x.project === pid), x => x.amount);
  const bills = DB.contractorBills.filter(x => x.project === pid && !['Draft', 'Cancelled'].includes(x.status));
  const contractor = sum(bills, b => b.paid);
  const contractorDue = sum(bills, b => b.amount - b.paid);
  const labour = labourCost(pid);
  const spent = expenses + contractor + labour;
  return { value: p.value, billed, received, outstanding: billed - received, expenses, contractor, contractorDue, labour, spent, balance: received - spent };
}
const crewWages = r => sum(r.crew, c => c.wage);
function labourCost(pid) {
  const reps = DB.reports.filter(r => r.project === pid && r.status === 'Submitted');
  let c = sum(reps, crewWages);
  // labour before the reporting history is estimated from the average reported day
  const p = proj(pid);
  const first = reps.length ? reps.reduce((m, r) => r.date < m ? r.date : m, TODAY) : (p.status === 'Completed' ? p.end : TODAY);
  const before = Math.max(0, Math.round((parseD(first) - parseD(p.start)) / 864e5));
  const avgDay = reps.length ? c / reps.length : sum(DB.workers.filter(w => w.project === pid), w => w.wage) || 9000;
  c += before * avgDay * .9 + (p.status === 'Completed' ? 14e5 : 0);
  return Math.round(c / 100) * 100;
}
function billStatus(b) { return ['Draft', 'Cancelled'].includes(b.status) ? b.status : b.paid >= b.amount ? 'Paid' : b.paid > 0 ? 'Part paid' : daysFrom(b.due) < 0 ? 'Overdue' : 'Pending'; }
function reportFor(day, pid) { return DB.reports.find(r => r.project === pid && r.date === day && r.status === 'Submitted') || null; }
// workforce for a day = workers listed in that day's submitted reports
function siteSummary(day, pids) {
  let workers = 0, wages = 0, tasks = 0; const reported = [], pending = [];
  for (const pid of pids) {
    const r = reportFor(day, pid);
    if (!r) { pending.push(pid); continue; }
    reported.push(pid); workers += r.crew.length; wages += crewWages(r); tasks += r.work.length;
  }
  return { workers, wages, tasks, reported, pending };
}
function workerAdvanceBal(wid) { return sum(DB.advances.filter(a => a.worker === wid), a => a.amount - a.recovered); }
function workerEntries(wid, from = '0000', to = '9999') {
  return DB.reports.filter(r => r.status === 'Submitted' && r.date >= from && r.date <= to).flatMap(r => r.crew.filter(c => c.wid === wid).map(c => ({ ...c, report: r })));
}
const workerDays = (wid, from, to) => workerEntries(wid, from, to).length;

/* ================= UI primitives ================= */
function toast(msg, kind = '') {
  const host = $('#toasts');
  const el = document.createElement('div');
  el.className = 'toast ' + kind;
  el.innerHTML = ico(kind === 'lock' ? 'lock' : 'check') + `<span>${esc(msg)}</span>`;
  host.appendChild(el);
  // keep toasts above open dialogs by re-entering the top layer
  if (host.showPopover) { try { if (host.matches(':popover-open')) host.hidePopover(); host.showPopover(); } catch { } }
  setTimeout(() => { el.style.transition = 'opacity .25s'; el.style.opacity = '0'; setTimeout(() => { el.remove(); if (!host.children.length && host.hidePopover) try { host.hidePopover(); } catch { } }, 260); }, 3200);
}

let modalSubmit = null;
function openModal({ title, sub = '', body, foot, wide = false, onSubmit = null, onOpen = null }) {
  const m = $('#modal');
  m.className = 'modal' + (wide ? ' wide' : '');
  m.innerHTML = `<form method="dialog" class="mform" novalidate style="display:contents">
    <div class="m-head"><div class="t"><h2>${esc(title)}</h2>${sub ? `<p>${sub}</p>` : ''}</div><button type="button" class="iconbtn" data-act="closeModal" aria-label="Close">${ico('x')}</button></div>
    <div class="m-body">${body}</div>
    ${foot !== false ? `<div class="m-foot">${foot || `<button type="button" class="btn" data-act="closeModal">Cancel</button><button type="submit" class="btn primary">Save</button>`}</div>` : ''}
  </form>`;
  modalSubmit = onSubmit;
  if (!m.open) m.showModal();
  onOpen && onOpen(m);
  const first = $('input:not([type=hidden]):not([type=file]),select,textarea', m);
  if (first && !first.closest('.m-foot')) setTimeout(() => first.focus(), 30);
}
function closeModal() { const m = $('#modal'); if (m.open) m.close(); modalSubmit = null; }
function formData(form) {
  const o = {};
  $$('[name]', form).forEach(el => { if (el.type === 'checkbox') { if (el.dataset.multi) { (o[el.name] ||= []); if (el.checked) o[el.name].push(el.value); } else o[el.name] = el.checked; } else if (el.type !== 'file') o[el.name] = el.value.trim(); });
  return o;
}
function validate(form) {
  let ok = true;
  $$('.field', form).forEach(f => { f.classList.remove('err'); $('.msg', f)?.remove(); });
  $$('[required]', form).forEach(el => {
    const bad = !el.value.trim() || (el.type === 'number' && (isNaN(+el.value) || +el.value <= 0 && el.min !== '0'));
    if (bad) { ok = false; const f = el.closest('.field'); f.classList.add('err'); f.insertAdjacentHTML('beforeend', `<span class="msg">${el.type === 'number' ? 'Enter a valid amount' : 'This field is required'}</span>`); }
  });
  if (!ok) $('.field.err input, .field.err select, .field.err textarea', form)?.focus();
  return ok;
}
/* field builders */
const fld = (label, name, { type = 'text', value = '', req = false, ph = '', opts = null, hint = '', min, step, rows } = {}) => {
  let control;
  if (opts) control = `<select class="select" name="${name}" ${req ? 'required' : ''}>${opts.map(o => { const [v, l] = Array.isArray(o) ? o : [o, o]; return `<option value="${esc(v)}" ${String(v) === String(value) ? 'selected' : ''}>${esc(l)}</option>`; }).join('')}</select>`;
  else if (type === 'textarea') control = `<textarea name="${name}" ${req ? 'required' : ''} placeholder="${esc(ph)}" rows="${rows || 3}">${esc(value)}</textarea>`;
  else control = `<input class="input" type="${type}" name="${name}" value="${esc(value)}" ${req ? 'required' : ''} placeholder="${esc(ph)}" ${min != null ? `min="${min}"` : ''} ${step ? `step="${step}"` : ''} ${type === 'number' ? 'inputmode="decimal"' : ''}>`;
  return `<label class="field"><span>${esc(label)}${req ? ' <em>*</em>' : ''}</span>${control}${hint ? `<small>${hint}</small>` : ''}</label>`;
};
// a money field for finance roles only; for others the field is left out and the saved value is kept as it is
const moneyFld = (label, name, o = {}) => canMoney() ? fld(label, name, o) : '';
const projOpts = (list = myProjects().filter(p => p.status !== 'Completed')) => list.map(p => [p.id, p.name]);
const userOpts = roles => DB.users.filter(u => !roles || roles.includes(u.role)).filter(u => u.status !== 'Inactive').map(u => [u.id, `${u.name} · ${ROLES[u.role].label}`]);

function openDrawer(title, sub, body, foot = '') {
  const d = $('#drawer');
  d.innerHTML = `<div class="m-head"><div class="t"><h2>${title}</h2>${sub ? `<p>${sub}</p>` : ''}</div><button type="button" class="iconbtn" data-act="closeDrawer" aria-label="Close">${ico('x')}</button></div>
    <div class="m-body">${body}</div>${foot ? `<div class="m-foot">${foot}</div>` : ''}`;
  if (!d.open) d.showModal();
}
function closeDrawer() { const d = $('#drawer'); if (d.open) d.close(); }

function confirmBox(title, text, okLabel, onOk, danger = false) {
  openModal({ title, body: `<p class="ink2">${text}</p>`, foot: `<button type="button" class="btn" data-act="closeModal">Cancel</button><button type="submit" class="btn ${danger ? 'danger' : 'primary'}">${esc(okLabel)}</button>`, onSubmit: () => { onOk(); return true; } });
}

let menuEl = null;
function openMenu(anchor, html) {
  closeMenu();
  menuEl = document.createElement('div');
  menuEl.className = 'menu'; menuEl.innerHTML = html; menuEl.setAttribute('role', 'menu');
  document.body.appendChild(menuEl);
  const r = anchor.getBoundingClientRect(), mw = menuEl.offsetWidth, mh = menuEl.offsetHeight;
  let left = Math.min(r.left, innerWidth - mw - 12), top = r.bottom + 6;
  if (top + mh > innerHeight - 8) top = Math.max(8, r.top - mh - 6);
  menuEl.style.left = Math.max(8, left) + 'px'; menuEl.style.top = top + 'px';
  setTimeout(() => $('button', menuEl)?.focus(), 0);
}
function closeMenu() { menuEl?.remove(); menuEl = null; }

/* tooltip for charts */
function showTip(html, x, y) { const t = $('#tip'); t.innerHTML = html; t.hidden = false; t.style.left = x + 'px'; t.style.top = y + 'px'; }
function hideTip() { $('#tip').hidden = true; }

/* ================= charts ================= */
// axis ticks: a round step (1/2/2.5/5 × 10^k) giving 3–5 intervals, so the top sits just above the data
function niceTicks(max) {
  max = Math.max(1, max);
  const raw = max / 4, e = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 2.5, 5, 10].map(m => m * e).find(st => max / st <= 5) || 10 * e;
  const top = Math.ceil(max / step) * step;
  const ticks = []; for (let v = 0; v <= top + 1e-9; v += step) ticks.push(Math.round(v * 1e6) / 1e6);
  return { top, ticks };
}

// single-series vertical bars: items [{label, value, tip}]
function barChart(items, { h = 200, fmt = inrS, hiLast = false, w = 640 } = {}) {
  const W = w, padL = 78, padB = 26, padT = 12, H = h;
  const max = Math.max(1, ...items.map(i => i.value));
  const { top: nice, ticks } = niceTicks(max);
  const ih = H - padB - padT, iw = W - padL - 6, bw = Math.min(24, iw / items.length * .56), gap = iw / items.length;
  const y = v => padT + ih - v / nice * ih;
  let g = '';
  for (const v of ticks) { g += `<line class="gl" x1="${padL}" x2="${W}" y1="${y(v)}" y2="${y(v)}"/><text class="ax" x="${padL - 10}" y="${y(v) + 4}" text-anchor="end">${fmt(v)}</text>`; }
  items.forEach((it, i) => {
    const x = padL + gap * i + (gap - bw) / 2, top = y(it.value), bh = Math.max(0, padT + ih - top);
    const r = Math.min(4, bh);
    const path = bh > 0 ? `M${x},${padT + ih} V${top + r} Q${x},${top} ${x + r},${top} H${x + bw - r} Q${x + bw},${top} ${x + bw},${top + r} V${padT + ih} Z` : '';
    g += `<g data-tip="${esc(it.tip || `<b>${esc(it.label)}</b> · ${fmt(it.value)}`)}"><rect class="hit" x="${padL + gap * i}" y="${padT}" width="${gap}" height="${ih}"/><path class="bar ${hiLast && i === items.length - 1 ? 'hi' : ''}" d="${path}"/></g>
      <text class="ax" x="${x + bw / 2}" y="${H - 6}" text-anchor="middle">${esc(it.label)}</text>`;
  });
  const defs = `<defs><linearGradient id="vizGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style="stop-color:color-mix(in srgb, var(--viz) 62%, #fff)"/><stop offset="1" style="stop-color:var(--viz)"/></linearGradient><linearGradient id="vizGradHi" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style="stop-color:#F26B68"/><stop offset="1" style="stop-color:var(--viz-hi)"/></linearGradient></defs>`;
  return `<div class="chart${W > 700 ? ' wide' : ''}" style="--axm:${Math.round(12 * W / 720)}px"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Bar chart">${defs}${g}</svg></div>`;
}
const inrK = n => !canMoney() ? MONEY_MASK : n >= 1e5 ? inrS(n) : n >= 1000 ? '₹' + Math.round(n / 1000) + 'k' : '₹' + Math.round(n);
const niceMax = max => { const e = Math.pow(10, Math.floor(Math.log10(Math.max(1, max)))), m = max / e; return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 2.5 ? 2.5 : m <= 5 ? 5 : 10) * e; };
// stacked columns: labels[], series [{ name, color (css var), values[] }]; 2px surface gap between segments
function stackedChart(labels, series, { h = 230, fmt = v => num(v), unit = '', w = 640 } = {}) {
  const W = w, padL = 78, padB = 26, padT = 12, H = h, ih = H - padB - padT, iw = W - padL - 6;
  const totals = labels.map((_, i) => sum(series, sr => sr.values[i]));
  const { top, ticks } = niceTicks(Math.max(1, ...totals)), y = v => padT + ih - v / top * ih;
  const gap = iw / labels.length, bw = Math.min(24, gap * .6);
  let g = '';
  for (const v of ticks) { g += `<line class="gl" x1="${padL}" x2="${W}" y1="${y(v)}" y2="${y(v)}"/><text class="ax" x="${padL - 10}" y="${y(v) + 4}" text-anchor="end">${fmt(v)}</text>`; }
  labels.forEach((lb, i) => {
    const x = padL + gap * i + (gap - bw) / 2;
    let acc = 0, segs = '';
    const live = series.filter(sr => sr.values[i] > 0);
    live.forEach((sr, j) => {
      const v = sr.values[i], y0 = y(acc), y1 = y(acc + v), isTop = j === live.length - 1;
      const hgt = Math.max(0, y0 - y1 - (isTop ? 0 : 2)), yt = y0 - hgt - (isTop ? 0 : 0);
      const r = isTop ? Math.min(4, hgt) : 0;
      segs += r ? `<path fill="var(${sr.color})" d="M${x},${y0} V${yt + r} Q${x},${yt} ${x + r},${yt} H${x + bw - r} Q${x + bw},${yt} ${x + bw},${yt + r} V${y0} Z"/>` : `<rect fill="var(${sr.color})" x="${x}" y="${yt}" width="${bw}" height="${hgt}"/>`;
      acc += v; if (!isTop) acc += 0;
    });
    const tip = `<b>${esc(lb)}</b> · ${fmt(totals[i])}${unit}<br>${series.filter(sr => sr.values[i]).map(sr => `${esc(sr.name)}: ${fmt(sr.values[i])}`).join('<br>')}`;
    const every = labels.length > 10 ? 2 : 1, showLb = (labels.length - 1 - i) % every === 0;
    g += `<g class="col" data-tip="${esc(tip)}"><rect class="hit" x="${padL + gap * i}" y="${padT}" width="${gap}" height="${ih}"/><g class="stack">${segs}</g></g>${showLb ? `<text class="ax" x="${x + bw / 2}" y="${H - 6}" text-anchor="middle">${esc(lb)}</text>` : ''}`;
  });
  const legend = `<div class="legend chart-legend">${series.map(sr => `<span><i style="background:var(${sr.color})"></i>${esc(sr.name)}</span>`).join('')}</div>`;
  const table = `<div class="table-wrap chart-table"><table class="t"><thead><tr><th>Day</th>${series.map(sr => `<th class="r">${esc(sr.name)}</th>`).join('')}<th class="r">Total</th></tr></thead><tbody>${labels.map((lb, i) => `<tr><td>${esc(lb)}</td>${series.map(sr => `<td class="r">${fmt(sr.values[i])}</td>`).join('')}<td class="r strong">${fmt(totals[i])}</td></tr>`).join('')}</tbody></table></div>`;
  return `<div class="viz-swap">${legend}<div class="chart stacked${W > 700 ? ' wide' : ''}" style="--axm:${Math.round(12 * W / 720)}px"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Stacked column chart">${g}</svg></div>${table}</div>`;
}
// single-series area/line with hover guide and an end label
function areaChart(items, { h = 200, fmt = inrS, w = 640 } = {}) {
  const W = w, padL = 78, padB = 26, padT = 16, padR = 64, H = h, ih = H - padB - padT, iw = W - padL - padR;
  const { top, ticks } = niceTicks(Math.max(1, ...items.map(i => i.value))), y = v => padT + ih - v / top * ih;
  const step = items.length > 1 ? iw / (items.length - 1) : 0, x = i => padL + step * i;
  let g = '';
  for (const v of ticks) { g += `<line class="gl" x1="${padL}" x2="${W - padR}" y1="${y(v)}" y2="${y(v)}"/><text class="ax" x="${padL - 10}" y="${y(v) + 4}" text-anchor="end">${inrK(v)}</text>`; }
  const pts = items.map((it, i) => `${x(i)},${y(it.value)}`);
  g += `<path class="area" d="M${x(0)},${y(0)} L${pts.join(' L')} L${x(items.length - 1)},${y(0)} Z"/><path class="line" d="M${pts.join(' L')}"/>`;
  const every = Math.ceil(items.length / (W > 700 ? 8 : 5));
  items.forEach((it, i) => {
    g += `<g class="pt" data-tip="${esc(it.tip || `<b>${esc(it.label)}</b> · ${fmt(it.value)}`)}"><rect class="hit" x="${x(i) - step / 2}" y="${padT}" width="${Math.max(step, 8)}" height="${ih}"/><line class="guide" x1="${x(i)}" x2="${x(i)}" y1="${padT}" y2="${padT + ih}"/><circle class="dot" cx="${x(i)}" cy="${y(it.value)}" r="4"/></g>`;
    if ((items.length - 1 - i) % every === 0) g += `<text class="ax" x="${x(i)}" y="${H - 6}" text-anchor="middle">${esc(it.label)}</text>`;
  });
  const last = items[items.length - 1];
  if (last) g += `<circle class="end" cx="${x(items.length - 1)}" cy="${y(last.value)}" r="4"/><text class="lbl" x="${x(items.length - 1) + 10}" y="${y(last.value) + 4}">${fmt === inrS ? inrK(last.value) : fmt(last.value)}</text>`;
  return `<div class="chart area-chart${W > 700 ? ' wide' : ''}" style="--axm:${Math.round(12 * W / 720)}px"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Line chart">${g}</svg></div>`;
}

// horizontal bars with labels
function hBars(items, fmt = inrS) {
  const max = Math.max(1, ...items.map(i => i.value));
  return `<div class="hbars">${items.map(i => `<div class="hbar" data-tip="${esc(`<b>${esc(i.label)}</b> · ${fmt(i.value)}${i.extra ? ' · ' + esc(i.extra) : ''}`)}"><span class="nm">${esc(i.label)}</span><span class="tr"><i style="width:${i.value / max * 100}%"></i></span><span class="vl">${fmt(i.value)}</span></div>`).join('')}</div>`;
}

/* ================= shell ================= */
let ROUTE = { mod: 'dashboard', parts: [], q: {} };
function parseRoute() {
  const h = location.hash.replace(/^#\/?/, '');
  const [path, qs] = h.split('?');
  const parts = path.split('/').filter(Boolean);
  const q = Object.fromEntries(new URLSearchParams(qs || ''));
  return { mod: parts[0] || 'dashboard', parts: parts.slice(1), q };
}
function go(hash) { if (location.hash === hash) render(); else location.hash = hash; }
function setQ(patch) {
  const q = { ...ROUTE.q, ...patch };
  Object.keys(q).forEach(k => (q[k] === '' || q[k] == null) && delete q[k]);
  const qs = new URLSearchParams(q).toString();
  history.replaceState(null, '', `#/${[ROUTE.mod, ...ROUTE.parts].join('/')}${qs ? '?' + qs : ''}`);
  ROUTE = parseRoute(); renderView();
}

// modules add their own sidebar counts, dashboard attention items and search results through these hooks
const NAV_COUNT_HOOKS = [], SEARCH_HOOKS = [];
function navCounts() {
  const ids = myProjectIds();
  const c = {
    projects: DB.projects.filter(p => ids.has(p.id) && !['Completed'].includes(p.status)).length,
    enquiries: DB.enquiries.filter(e => !['Won', 'Lost'].includes(e.status)).length,
  };
  NAV_COUNT_HOOKS.forEach(f => Object.assign(c, f()));
  return c;
}
function renderShell() {
  const u = me();
  const counts = navCounts();
  const groups = {};
  MODULES.filter(m => canSee(m.id)).forEach(m => (groups[m.group] ||= []).push(m));
  $('#nav').innerHTML = Object.entries(groups).map(([g, ms]) => `<div class="nav-group"><div class="nav-label">${g}</div>${ms.map(m => `<a href="#/${m.id}" data-label="${m.label}" class="${ROUTE.mod === m.id ? 'on' : ''}" ${ROUTE.mod === m.id ? 'aria-current="page"' : ''}>${ico(m.icon)}<span class="nl">${m.label}</span>${counts[m.id] ? `<span class="count">${counts[m.id]}</span>` : ''}</a>`).join('')}</div>`).join('');
  const collapsed = document.body.classList.contains('side-collapsed');
  // collapse / expand arrow sits on the sidebar's top edge, level with the logo
  const sa = $('#sideArrow');
  if (sa) { const l = collapsed ? 'Expand menu' : 'Collapse menu'; sa.innerHTML = ico('chevL', 'sm'); sa.setAttribute('aria-label', l); sa.setAttribute('aria-expanded', String(!collapsed)); sa.title = `${l} ( [ )`; }
  $('#sideFoot').innerHTML = `<button class="me" data-act="userMenu" aria-haspopup="menu" data-label="${esc(u.name)} · ${esc(ROLES[u.role].label)}">${av(u.name)}<span class="who"><b>${esc(u.name)}</b><span>${esc(ROLES[u.role].label)}</span></span>${ico('chevD', 'sm')}</button>`;
  $('#rolePill').innerHTML = `<span class="dot"></span><span class="lbl">Viewing as</span> <b>${esc(ROLES[u.role].label)}</b>${ico('chevD', 'sm')}`;
  renderBell();
  $('#todayLbl').textContent = parseD(TODAY).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}
function renderView() {
  const v = $('#view');
  const mod = MODULES.find(m => m.id === ROUTE.mod);
  if (!mod) { v.innerHTML = emptyPage('Page not found', 'The page you are looking for does not exist.'); return; }
  if (!canSee(mod.id)) { v.innerHTML = noAccess(mod); return; }
  v.innerHTML = VIEWS[mod.id]();
  document.title = `${mod.label} · Scale Space Builders`;
  AFTER.forEach(f => f()); AFTER = [];
}
let AFTER = [];
const after = f => AFTER.push(f);
function render() {
  if (!SESSION || !me()) { renderLogin(); setTheme(isDark() ? 'dark' : 'light', false); return; }
  $('#loginRoot').hidden = true; $('#appRoot').hidden = false;
  renderShell(); renderView(); setTheme(isDark() ? 'dark' : 'light', false);
}
function noAccess(mod) {
  return `<div class="card pad" style="max-width:560px;margin:60px auto;text-align:center">
    <div class="sig" style="margin:0 auto 14px;width:48px;height:48px;border-radius:12px">${ico('lock', 'lg')}</div>
    <h2>${esc(mod.label)} isn't available for your role</h2>
    <p class="muted" style="margin:8px 0 20px">You're signed in as <b>${esc(ROLES[role()].label)}</b>. Ask the owner to change your access, or switch to another demo role.</p>
    <button class="btn" data-act="roleMenu">${ico('swap')}Switch role</button></div>`;
}
const emptyPage = (t, s) => `<div class="empty-state">${ico('search')}<b>${esc(t)}</b>${esc(s)}</div>`;
const emptyRow = (cols, t, s = '') => `<tr><td colspan="${cols}"><div class="empty-state">${ico('search')}<b>${esc(t)}</b>${esc(s)}</div></td></tr>`;
function pageHead(title, sub, acts = '') { return `<div class="page-head"><div class="t"><h1>${title}</h1>${sub ? `<p>${sub}</p>` : ''}</div>${acts ? `<div class="acts">${acts}</div>` : ''}</div>`; }
function tabs(list, cur, key = 'tab') { return `<div class="tabs" role="tablist">${list.map(([id, label, n]) => `<button role="tab" aria-selected="${cur === id}" class="${cur === id ? 'on' : ''}" data-act="setQ" data-k="${key}" data-v="${id}">${label}${n != null ? `<span class="n">${n}</span>` : ''}</button>`).join('')}</div>`; }
function projSelect(cur, { all = true, key = 'p', list = myProjects() } = {}) {
  return `<select class="select" data-change="setQ" data-k="${key}" aria-label="Project">${all ? `<option value="">All projects</option>` : ''}${list.map(p => `<option value="${p.id}" ${cur === p.id ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</select>`;
}

/* ================= login ================= */
function renderLogin() {
  $('#appRoot').hidden = true; $('#loginRoot').hidden = false;
  const picks = ['u1', 'u11', 'u2', 'u4', 'u6', 'u8', 'u10'].map(user);
  $('#loginRoot').innerHTML = `<div class="login">
    <div class="login-art">
      <div class="lg"><img src="assets/logo.png" alt=""><div><b>Scale Space Builders</b><span>Construction &amp; Design Firm · Mayiladuthurai</span></div></div>
      <div><h1>Every site, every rupee, every client — <em>in one place.</em></h1>
      <p>Projects, daily site operations, documents, payments and enquiries for the Scale Space team.</p></div>
      <div class="foot">Demo build · sample data only · no real accounts</div>
      <img class="tri" src="assets/logo.png" alt="">
    </div>
    <div class="login-form"><button class="iconbtn theme-btn login-theme" data-act="theme"></button><div class="box">
      <h2>Sign in to the demo</h2>
      <p>Choose a role to see what each team member can access.</p>
      <div class="roles">${picks.map(u => `<button class="role-opt" data-act="login" data-id="${u.id}">${av(u.name, 'lg')}<span class="nm"><b>${esc(u.name)}</b><span>${esc(ROLES[u.role].label)} — ${esc(ROLES[u.role].desc)}</span></span>${ico('arrowR')}</button>`).join('')}</div>
    </div></div></div>`;
}

/* ================= global search ================= */
let searchSel = 0;
function searchAll(q) {
  q = q.toLowerCase().trim(); if (!q) return [];
  const ids = myProjectIds(), out = [];
  const hit = s => String(s).toLowerCase().includes(q);
  if (canSee('projects')) DB.projects.filter(p => ids.has(p.id) && (hit(p.name) || hit(p.code) || hit(p.client.name) || hit(p.city))).slice(0, 5).forEach(p => out.push({ g: 'Projects', icon: 'building', t: p.name, s: `${p.code} · ${p.city}`, href: `#/projects/${p.id}` }));
  if (canSee('site')) DB.workers.filter(w => ids.has(w.project) && (hit(w.name) || hit(w.trade) || hit(w.code))).slice(0, 5).forEach(w => out.push({ g: 'Workers', icon: 'user', t: w.name, s: `${w.trade} · ${proj(w.project)?.name}`, href: `#/site?tab=workers&w=${w.id}` }));
  if (canSee('enquiries')) DB.enquiries.filter(e => hit(e.name) || hit(e.city) || hit(e.type)).slice(0, 4).forEach(e => out.push({ g: 'Enquiries', icon: 'enquiry', t: e.name, s: `${e.type} · ${e.status}`, href: `#/enquiries?e=${e.id}` }));
  if (canSee('documents')) DB.documents.filter(d => ids.has(d.project) && docVisible(d) && (hit(d.name) || hit(d.title || ''))).slice(0, 5).forEach(d => out.push({ g: 'Documents', icon: 'file', t: d.title || d.name, s: d.category, href: `#/documents?${MEDIA_CATS.includes(d.category) ? 'tab=media&' : ''}d=${d.id}` }));
  SEARCH_HOOKS.forEach(f => out.push(...f(hit, ids)));
  return out;
}
function renderSearch() {
  const q = $('#search').value, pop = $('#searchPop');
  if (!q.trim()) { pop.hidden = true; return; }
  const res = searchAll(q); searchSel = Math.min(searchSel, Math.max(0, res.length - 1));
  let g = '';
  pop.innerHTML = res.length ? res.map((r, i) => { const h = r.g !== g ? `<div class="grp">${r.g}</div>` : ''; g = r.g; return `${h}<a href="${r.href}" class="${i === searchSel ? 'sel' : ''}" data-i="${i}">${ico(r.icon)}<span>${esc(r.t)}</span><small>${esc(r.s)}</small></a>`; }).join('') : `<div class="empty">No matches for “${esc(q)}”</div>`;
  pop.hidden = false;
}

/* ================= collapsed-sidebar tooltips ================= */
function showNavTip(el) {
  if (!document.body.classList.contains('side-collapsed') || matchMedia('(max-width: 900px)').matches) return;
  const t = $('#navTip'), r = el.getBoundingClientRect();
  t.textContent = el.dataset.label; t.hidden = false;
  t.style.left = r.right + 14 + 'px'; t.style.top = r.top + r.height / 2 + 'px';
}
function hideNavTip() { const t = $('#navTip'); if (t) t.hidden = true; }

/* ================= theme ================= */
const isDark = () => document.documentElement.dataset.theme === 'dark';
function setTheme(t, persist = true) {
  document.documentElement.dataset.theme = t;
  if (persist) store.set(KEY + '-theme', t);
  const label = t === 'dark' ? 'Switch to light theme' : 'Switch to dark theme';
  $$('.theme-btn').forEach(b => { b.innerHTML = ico(t === 'dark' ? 'sun' : 'moon'); b.setAttribute('aria-label', label); b.title = label; });
}

/* ================= events ================= */
const ACT = {
  closeModal, closeDrawer,
  setQ: el => setQ({ [el.dataset.k]: el.dataset.v }),
  go: el => go(el.dataset.href),
  toggleNav: () => document.body.classList.toggle('nav-open'),
  toggleSide: () => { const c = document.body.classList.toggle('side-collapsed'); store.set(KEY + '-side', c ? 'collapsed' : 'expanded'); hideNavTip(); renderShell(); },
  login: el => { SESSION = el.dataset.id; store.set(KEY + '-session', SESSION); location.hash = '#/dashboard'; ROUTE = parseRoute(); render(); toast(`Signed in as ${me().name}`); },
  roleMenu: el => openMenu(el, `<div class="mh">Switch demo role</div>${DB.users.filter(u => u.status === 'Active').map(u => `<button data-act="switchUser" data-id="${u.id}" class="${u.id === SESSION ? 'on' : ''}">${av(u.name, 'sm')}<span>${esc(u.name)}</span><span class="sub">${ROLES[u.role].label}</span></button>`).join('')}`),
  userMenu: el => openMenu(el, `<div class="mh">${esc(me().name)}</div><button data-act="roleMenuFromUser">${ico('swap')}Switch role</button><button data-act="theme">${ico(isDark() ? 'sun' : 'moon')}${isDark() ? 'Light theme' : 'Dark theme'}</button><button data-act="resetDemo">${ico('refresh')}Reset demo data</button><hr><button data-act="logout">${ico('logout')}Sign out</button>`),
  roleMenuFromUser: () => ACT.roleMenu($('#rolePill')),
  switchUser: el => { SESSION = el.dataset.id; store.set(KEY + '-session', SESSION); closeMenu(); ROUTE = parseRoute(); render(); toast(`Now viewing as ${me().name} (${ROLES[role()].label})`); },
  theme: () => setTheme(isDark() ? 'light' : 'dark'),
  resetDemo: () => confirmBox('Reset demo data?', 'All changes you made in this demo will be discarded and the sample data restored.', 'Reset data', () => { resetDB(); render(); toast('Demo data restored'); }, true),
  logout: () => { SESSION = null; store.del(KEY + '-session'); closeMenu(); render(); },
};
const CHANGE = { setQ: el => setQ({ [el.dataset.k]: el.value }) };

function bindEvents() {
  document.addEventListener('click', e => {
    const a = e.target.closest('[data-act]');
    if (menuEl && !e.target.closest('.menu') && !(a && ['userMenu', 'roleMenu'].includes(a.dataset.act))) closeMenu();
    if (!e.target.closest('.search')) $('#searchPop').hidden = true;
    if (e.target.closest('.nav a')) document.body.classList.remove('nav-open');
    if (!a) return;
    if (a.tagName === 'A' && a.getAttribute('href')?.startsWith('#') && a.dataset.act === 'go') e.preventDefault();
    const fn = ACT[a.dataset.act];
    if (fn) { if (a.closest('.menu') && !['roleMenuFromUser'].includes(a.dataset.act)) closeMenu(); fn(a, e); }
  });
  document.addEventListener('change', e => { const el = e.target.closest('[data-change]'); if (el && CHANGE[el.dataset.change]) CHANGE[el.dataset.change](el, e); });
  let deb;
  document.addEventListener('input', e => {
    const el = e.target.closest('[data-input]');
    if (el && INPUT[el.dataset.input]) { clearTimeout(deb); deb = setTimeout(() => INPUT[el.dataset.input](el), 160); }
  });
  $('#modal').addEventListener('submit', e => {
    e.preventDefault();
    const form = e.target;
    if (!modalSubmit) { closeModal(); return; }
    if (!validate(form)) return;
    const r = modalSubmit(formData(form), form);
    if (r !== false) closeModal();
  });
  $('#modal').addEventListener('close', () => { modalSubmit = null; });
  [$('#modal'), $('#drawer')].forEach(d => d.addEventListener('click', e => { if (e.target === d) d.close(); }));
  // search
  const s = $('#search');
  s.addEventListener('input', () => { searchSel = 0; renderSearch(); });
  s.addEventListener('focus', renderSearch);
  s.addEventListener('keydown', e => {
    const items = $$('#searchPop a');
    if (e.key === 'ArrowDown') { e.preventDefault(); searchSel = Math.min(items.length - 1, searchSel + 1); renderSearch(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); searchSel = Math.max(0, searchSel - 1); renderSearch(); }
    else if (e.key === 'Enter' && items[searchSel]) { location.hash = items[searchSel].getAttribute('href'); s.value = ''; $('#searchPop').hidden = true; s.blur(); }
    else if (e.key === 'Escape') { s.value = ''; $('#searchPop').hidden = true; s.blur(); }
  });
  $('#searchPop').addEventListener('click', e => { if (e.target.closest('a')) { s.value = ''; $('#searchPop').hidden = true; } });
  document.addEventListener('keydown', e => {
    if (e.key === '/' && !e.target.closest('input,textarea,select') && SESSION) { e.preventDefault(); s.focus(); }
    if (e.key === 'Escape') { closeMenu(); document.body.classList.remove('nav-open'); }
    if (e.key === '[' && !e.target.closest('input,textarea,select') && SESSION && !e.ctrlKey && !e.metaKey) ACT.toggleSide();
  });
  // chart tooltips
  document.addEventListener('pointerover', e => { const t = e.target.closest('[data-tip]'); if (!t) return; const r = t.getBoundingClientRect(); showTip(t.dataset.tip, r.left + r.width / 2, r.top); });
  document.addEventListener('pointerout', e => { if (e.target.closest('[data-tip]')) hideTip(); });
  addEventListener('scroll', () => { hideTip(); $('.topbar')?.classList.toggle('scrolled', scrollY > 4); }, { passive: true });
  addEventListener('hashchange', () => { ROUTE = parseRoute(); closeDrawer(); closeModal(); render(); scrollTo(0, 0); });
}
const INPUT = {};

function init() {
  setTheme(store.get(KEY + '-theme') === 'dark' ? 'dark' : 'light', false);
  if (store.get(KEY + '-side') !== 'expanded') document.body.classList.add('side-collapsed');
  const side = $('.sidebar');
  side.addEventListener('pointerover', e => { const a = e.target.closest('[data-label]'); if (a) showNavTip(a); });
  side.addEventListener('pointerout', e => { if (e.target.closest('[data-label]')) hideNavTip(); });
  side.addEventListener('focusin', e => { const a = e.target.closest('[data-label]'); if (a) showNavTip(a); });
  side.addEventListener('focusout', hideNavTip);
  $('.nav').addEventListener('scroll', hideNavTip, { passive: true });
  DB = loadDB(); LOAD_HOOKS.forEach(f => f()); saveDB();
  SESSION = store.get(KEY + '-session');
  ROUTE = parseRoute();
  bindEvents();
  render();
}
