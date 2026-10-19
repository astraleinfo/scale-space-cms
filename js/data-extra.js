/* Sample data for the workflow modules: report compliance, work stoppages, document versions, attendance, leave,
   performance & appraisals, materials, service history and invoices. Built on top of the base seed in data.js
   with its own random sequence, so the original sample data is unchanged. Dates are relative to today. */
'use strict';

const STOP_REASONS = ['Weather', 'Material shortage', 'Labour unavailability', 'Client request', 'Pending approvals', 'Equipment breakdown', 'Budget issues', 'Design change', 'Other'];
const LEAVE_TYPES = { 'Casual leave': 12, 'Sick leave': 8, 'Earned leave': 15, 'Comp-off': null, 'Unpaid leave': null };
const SERVICE_TYPES = ['Maintenance', 'Repair', 'Inspection', 'Defect', 'Corrective action'];
const SERVICE_STATUSES = ['Reported', 'In progress', 'Completed', 'Closed'];
// [name, category, unit, rate (₹, before GST), GST %, usual supplier]
const MAT_CATALOG = [
  ['Cement – Ramco OPC 53', 'Cement', 'bags', 410, 28, 'Sri Lakshmi Traders'],
  ['TMT bars Fe550 – 12 mm', 'Steel', 'MT', 64500, 18, 'Mayura Steel Centre'],
  ['TMT bars Fe550 – 8 mm', 'Steel', 'MT', 66000, 18, 'Mayura Steel Centre'],
  ['M-sand', 'Aggregates', 'units', 5200, 5, 'Kaveri Building Materials'],
  ['Blue metal 20 mm', 'Aggregates', 'units', 4600, 5, 'Kaveri Building Materials'],
  ['Red bricks (wire-cut)', 'Bricks & blocks', 'nos', 9.5, 12, 'Annai Bricks'],
  ['Vitrified tiles 600×600', 'Tiles', 'boxes', 980, 18, 'Lakshmi Tiles & Granite'],
  ['Tile adhesive', 'Tiles', 'bags', 520, 18, 'Lakshmi Tiles & Granite'],
  ['Interior emulsion', 'Paint', 'litres', 310, 18, 'Vinayaga Paints'],
  ['Shuttering plywood 12 mm', 'Wood', 'sheets', 1450, 18, 'Sakthi Hardwares'],
  ['PVC conduit 25 mm', 'Electrical', 'lengths', 145, 18, 'Sakthi Hardwares'],
];
const quarterOf = s => { const d = parseD(s), y = d.getFullYear(), q = Math.floor(d.getMonth() / 3); const start = `${y}-${pad(q * 3 + 1)}-01`; const e = new Date(y, q * 3 + 3, 0);
  return { key: `${y}-Q${q + 1}`, label: `${['Jan–Mar', 'Apr–Jun', 'Jul–Sep', 'Oct–Dec'][q]} ${y}`, short: `Q${q + 1} ${y}`, start, end: iso(e) }; };
const prevQuarter = s => quarterOf(shiftD(quarterOf(s).start, -1));

function extendSeed(db) {
  let s = 4096251;
  const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  const pick = a => a[Math.floor(rnd() * a.length)];
  const between = (a, b) => a + Math.floor(rnd() * (b - a + 1));
  const D = dayOff, ts = (n, h, m = 0) => tsOn(D(n), h, m);
  const P = id => db.projects.find(p => p.id === id);
  const U = id => db.users.find(u => u.id === id);
  const art = (a, extra = {}) => ({ id: 'ph' + (++phn), kind: 'art', art: a, name: `${a}.jpg`, sample: true, ...extra });
  const src = (path, extra = {}) => ({ id: 'ph' + (++phn), kind: 'src', src: path, name: path.split('/').pop(), sample: true, ...extra });
  let phn = 0;
  const lastWD = (() => { let n = -1; while (!isWorkDay(D(n))) n--; return n; })();
  const activeP = db.projects.filter(p => !['Completed', 'On hold'].includes(p.status));
  const projectsOf = uid => activeP.filter(p => [p.pm, p.engineer, p.supervisor].includes(uid));

  /* ---------- daily report compliance ---------- */
  const rep = (pid, n) => db.reports.find(r => r.project === pid && r.date === D(n));
  db.reports.forEach(r => { r.uploadedBy = r.by; r.corrections = []; });
  // two missed reports in the last few working days
  [['p3', lastWD], ['p5', lastWD - 2]].forEach(([pid, n]) => { const r = rep(pid, n); if (r) db.reports = db.reports.filter(x => x !== r); });
  [['p2', -4, 21, 35, 'Concrete pour ran late; report filed after the crew left site.'], ['p1', -6, 20, 50, 'Mobile network down at site until late evening.'], ['p4', -9, 22, 10, 'Supervisor was at the Thiruvarur taluk office for the approval; filed from home.']]
    .forEach(([pid, n, h, m, why]) => { const r = rep(pid, n); if (r) { r.at = ts(n, h, m); r.lateReason = why; } });
  const behalf = rep('p5', -5);
  if (behalf) { behalf.by = P('p5').supervisor; behalf.uploadedBy = 'u10'; behalf.at = ts(-4, 10, 20); behalf.lateReason = 'Supervisor\'s phone was damaged on site — photos and notes were sent on WhatsApp and uploaded by the office.'; }
  const c1 = rep('p1', -2); if (c1) c1.corrections.push({ at: ts(-1, 9, 10), by: 'u2', note: 'Plastering quantity corrected after measurement (first floor bedroom 3).' });
  const c2 = rep('p2', -1); if (c2) c2.corrections.push({ at: ts(0, 8, 5) < Date.now() ? ts(0, 8, 5) : ts(-1, 20, 40), by: 'u5', note: 'Added two bar benders who joined after lunch.' });
  db.reportRequests = [
    { id: 'rq1', project: 'p3', date: D(lastWD), by: 'u7', at: tsOn(D(lastWD), 21, 5), reason: 'Network issue', note: 'No mobile signal at the Sirkazhi site after 6 PM. Sent 3 photos and the work summary to the office on WhatsApp — please upload.', photos: [src('assets/media/p3-photo-1.jpg', { at: tsOn(D(lastWD), 18, 40), by: 'u7' }), src('assets/media/p3-photo-2.jpg', { at: tsOn(D(lastWD), 18, 42), by: 'u7' })], status: 'Open', handledBy: null, report: null },
    ...(behalf ? [{ id: 'rq0', project: 'p5', date: D(-5), by: P('p5').supervisor, at: ts(-5, 20, 30), reason: 'Phone issue', note: 'Phone screen broke during slab work. Sending photos from my son\'s phone.', photos: [], status: 'Completed', handledBy: 'u10', handledAt: behalf.at, report: behalf.id }] : []),
  ];

  /* ---------- work stoppages & delays ---------- */
  const stop = (id, pid, from, to, reason, scope, floor, act, half, note, status, photos = [], by = null) => ({ id, project: pid, date: D(from), to: to == null ? null : D(to), reason, scope, floor: floor ? `${pid}${floor}` : null, activity: act && floor ? `${pid}${floor}${act}` : null, half, note, status, photos, by: by || P(pid).supervisor, at: ts(from, 18, 30) });
  db.delays = [
    stop('dl1', 'p3', -44, -36, 'Material shortage', 'site', null, null, false, 'Cement supply disrupted by the lorry strike; all masonry and concrete work paused.', 'Resolved'),
    stop('dl2', 'p3', -8, -8, 'Weather', 'activity', 'f2', 'a3', true, 'Heavy rain from 2 PM — first floor brickwork stopped and walls covered with tarpaulin.', 'Resolved', [src('assets/media/p3-photo-1.jpg')]),
    stop('dl3', 'p2', -21, -16, 'Labour unavailability', 'activity', 'f3', 'a1', false, 'Bar benders unavailable (festival leave); second floor column reinforcement paused.', 'Resolved'),
    stop('dl4', 'p2', -62, -58, 'Design change', 'activity', 'f2', 'a1', false, 'Client revised the flat 304 layout; column C17 shifted. First floor columns held until the revised drawing was issued.', 'Resolved'),
    stop('dl5', 'p7', -26, null, 'Client request', 'site', null, null, false, 'Client asked to hold all work until the revised front elevation is approved.', 'Open', [src('assets/media/p7-photo-1.jpg')]),
    stop('dl6', 'p1', -48, -46, 'Weather', 'activity', 'f2', 'a2', false, 'Heavy rain — first floor roof slab casting postponed.', 'Resolved'),
    stop('dl7', 'p5', -15, -14, 'Pending approvals', 'activity', 'f1', 'a2', false, 'Coastal regulation clearance copy needed before roof casting.', 'Resolved'),
    stop('dl8', 'p4', -3, -3, 'Equipment breakdown', 'activity', 'f0', 'a2', true, 'Concrete mixer gearbox failed at 1 PM; PCC for footings F9–F10 moved to the next day.', 'Resolved', [art('truck')]),
    stop('dl9', 'p3', -4, null, 'Budget issues', 'activity', 'f1', 'a7', false, 'Ground floor flooring material purchase on hold until the client releases the pending stage payment.', 'Open', [], 'u3'),
  ];
  // day-by-day comments: why there was no work on each day
  const dayLog = (id, notes) => { const d = db.delays.find(x => x.id === id), days = daysBetween(d.date, d.to || D(0)).filter(isWorkDay); d.log = {}; notes.forEach(([i, st, note, reason]) => { const k = days[i < 0 ? days.length + i : i]; if (k) d.log[k] = { st, reason: reason || d.reason, note, by: d.by || P(d.project).supervisor }; }); };
  dayLog('dl1', [[0, 'none', 'No cement delivered — lorry strike from this morning. Crew did curing only.'], [1, 'none', 'Strike continues; dealer has no stock at the Sirkazhi depot.'], [2, 'half', 'Used 40 bags left over from last week for the first-floor lintel; rest of the day idle.'],
    [3, 'none', 'Still no supply. Sent 6 masons to the Raghavan site.', 'Labour unavailability'], [-2, 'none', 'Supplier confirmed dispatch for tomorrow.'], [-1, 'half', 'Cement arrived at 1 PM; masonry restarted in the afternoon.']]);
  dayLog('dl3', [[0, 'none', 'Bar benders left for Deepavali; nobody to tie column steel.'], [1, 'none', 'Contractor could not send a replacement gang.'], [-1, 'half', 'Two bar benders back; started C1–C6 reinforcement.']]);
  dayLog('dl5', [[0, 'none', 'Client called at 9 AM to stop all work until the new front elevation is approved.'], [1, 'none', 'Waiting for the architect\'s revised elevation.'], [2, 'half', 'Did rear-side plastering only (not affected by the change).', 'Client request'],
    [5, 'none', 'Revised drawing sent to the client for approval.', 'Pending approvals'], [9, 'none', 'Client travelling; approval expected next week.'], [-3, 'half', 'Shifted 4 workers to curing and site cleaning.'], [-1, 'none', 'Still no approval. Followed up with the client by phone.']]);
  dayLog('dl9', [[0, 'none', 'Flooring tiles order on hold — stage payment not yet received.'], [-1, 'half', 'Did skirting preparation with material in stock.']]);
  db.delays.forEach(d => { d.days = workDaysIn(d.date, d.to || D(0)) * (d.half ? .5 : 1); });

  /* ---------- documents: versions, review status, archive ---------- */
  const REV = ['Dimensions updated after site measurement', 'Revised as per client comments', 'Structural consultant remarks incorporated', 'Door and window schedule corrected'];
  db.documents.filter(d => !['Site photos', 'Videos'].includes(d.category)).forEach(d => {
    const n = d.version || 1;
    const p = P(d.project);
    d.versions = Array.from({ length: n }, (_, i) => {
      const date = i === n - 1 ? d.date : shiftD(d.date, -(n - 1 - i) * between(14, 40));
      return { v: i + 1, date, at: tsOn(date, between(10, 17), between(0, 59)), by: d.by, size: Math.round(d.size * (.86 + .05 * i)), note: i === 0 ? 'Initial issue' : pick(REV), status: i === n - 1 ? 'Approved' : 'Superseded', reviewedBy: p.pm === d.by ? 'u1' : p.pm, reviewedAt: tsOn(shiftD(date, 1), 11, 0), reviewNote: '' };
    });
  });
  const doc = (pid, frag) => db.documents.find(d => d.project === pid && d.name.includes(frag));
  const addVer = (d, v) => { if (!d) return; d.versions.push({ v: d.versions.length + 1, size: Math.round(d.size * 1.04), reviewedBy: null, reviewedAt: null, reviewNote: '', ...v }); d.version = d.versions.length; d.date = v.date; d.by = v.by; };
  const p2plan = doc('p2', 'Architectural plans');
  if (p2plan) { p2plan.versions[0].status = 'Superseded'; p2plan.versions[1].note = 'Kitchen and utility swapped for flats 101–104'; p2plan.versions[1].status = 'Superseded';
    addVer(p2plan, { date: D(-58), at: ts(-58, 16, 20), by: 'u5', note: 'Flat 304 layout revised; column C17 shifted 450 mm east', status: 'Approved', reviewedBy: 'u2', reviewedAt: ts(-57, 11, 5), reviewNote: 'Approved — structural check done by consultant.' }); }
  addVer(doc('p1', 'Structural drawings'), { date: D(-1), at: ts(-1, 15, 40), by: 'u4', note: 'Staircase headroom beam lowered by 150 mm; mid-landing beam B12 resized', status: 'Under Review' });
  addVer(doc('p7', 'Elevation'), { date: D(-6), at: ts(-6, 16, 10), by: 'u2', note: 'Revised glass façade with vertical aluminium fins, as per client feedback', status: 'Under Review' });
  addVer(doc('p6', 'Interior layout'), { date: D(-3), at: ts(-3, 12, 30), by: 'u4', note: 'Pharmacy counter moved to the lounge side', status: 'Rejected', reviewedBy: 'u3', reviewedAt: ts(-2, 10, 15), reviewNote: 'Rejected — the counter blocks the fire exit route. Keep it on the east wall.' });
  addVer(doc('p5', 'Elevation'), { date: D(-1), at: ts(-1, 11, 0), by: 'u2', note: 'Verandah roof changed to sloped Mangalore tile', status: 'Draft' });
  const noc = doc('p3', 'Fire NOC'); if (noc) { noc.versions[0].status = 'Under Review'; noc.versions[0].reviewedBy = null; }
  ['BOQ & estimate', 'Monthly progress report'].forEach(f => { const d = doc('p8', f); if (d) { d.archived = true; d.archivedAt = ts(-80, 12, 0); d.archivedBy = 'u1'; } });

  /* ---------- leave ---------- */
  const lv = (id, uid, type, from, to, half, reason, status, by = null, comment = '') => ({ id, user: uid, type, from: D(from), to: D(to), half, reason, status, appliedAt: ts(Math.min(from, 0) - 3, 10, 15), decidedBy: by, decidedAt: by ? ts(Math.min(from, 0) - 2, 12, 0) : null, comment });
  db.leaves = [
    lv('lv1', 'u4', 'Casual leave', -12, -12, null, 'Family function at Kumbakonam', 'Approved', 'u2'),
    lv('lv2', 'u6', 'Sick leave', -25, -24, null, 'Fever — doctor advised rest', 'Approved', 'u2'),
    lv('lv3', 'u8', 'Earned leave', -40, -38, null, 'Visiting native place', 'Approved', 'u1'),
    lv('lv4', 'u5', 'Casual leave', 3, 3, null, 'Sister\'s engagement', 'Pending'),
    lv('lv5', 'u7', 'Casual leave', 1, 1, 'First half', 'Bank work — home loan documentation', 'Pending'),
    lv('lv6', 'u10', 'Casual leave', -5, -5, 'Second half', 'Parent-teacher meeting', 'Approved', 'u1'),
    lv('lv7', 'u3', 'Earned leave', 10, 14, null, 'Family trip to Madurai', 'Pending'),
    lv('lv8', 'u6', 'Casual leave', -50, -50, null, 'Personal work', 'Rejected', 'u2', 'Slab casting is scheduled that day — please pick another date.'),
    lv('lv9', 'u2', 'Casual leave', -30, -30, null, 'Personal work', 'Cancelled'),
  ].map(l => ({ ...l, days: l.half ? .5 : workDaysIn(l.from, l.to) }));
  const onLeave = (uid, day) => db.leaves.find(l => l.user === uid && l.status === 'Approved' && day >= l.from && day <= l.to);

  /* ---------- attendance (selfie check-in / check-out) ---------- */
  const emps = db.users.filter(u => u.role !== 'owner' && u.status === 'Active');
  db.attendance = []; let an = 1;
  const now = new Date(), nowM = now.getHours() * 60 + now.getMinutes();
  for (let n = -62; n <= 0; n++) {
    const day = D(n); if (!isWorkDay(day)) continue;
    emps.forEach(u => {
      const l = onLeave(u.id, day);
      if (l && !l.half) return;
      if (n === 0 && !['u2', 'u3', 'u5', 'u7'].includes(u.id)) return;   // leave today's check-in to the demo users
      if (n < 0 && rnd() < .02) return;                                    // occasional absence
      const office = ['accounts', 'admin', 'sysadmin'].includes(u.role), ps = projectsOf(u.id);
      const site = office || !ps.length || (u.role === 'pm' && rnd() < .5) ? 'office' : ps[(n + 70) % ps.length].id;
      const late = rnd() < .1, halfIn = l?.half === 'First half';
      let inM = halfIn ? 13 * 60 + between(30, 50) : late ? 9 * 60 + between(18, 55) : 8 * 60 + between(38, 72);
      if (n === 0 && inM + 4 > nowM) return;
      let outM = l?.half === 'Second half' ? 13 * 60 + between(0, 20) : 18 * 60 + between(5, 70);
      if (n > -40 && n < 0 && rnd() < .025) outM = 14 * 60 + between(0, 30);
      const off = rnd() < .05, dist = off ? between(420, 1600) : between(15, 180);
      const [la, lo] = geoOf(site);
      db.attendance.push({ id: 'at' + an++, user: u.id, date: day, in: tsOn(day, Math.floor(inM / 60), inM % 60), out: n === 0 && outM > nowM ? null : tsOn(day, Math.floor(outM / 60), outM % 60), site,
        gpsIn: { lat: +(la + dist / 111e3).toFixed(5), lng: lo, acc: between(8, 25), dist, ok: !off }, gpsOut: { lat: la, lng: lo, acc: between(8, 25), dist: between(10, 140), ok: true },
        selfieIn: { id: 'ph' + (++phn), kind: 'art', art: 'selfie', seed: u.name, name: 'selfie-in.jpg', sample: true }, selfieOut: { id: 'ph' + (++phn), kind: 'art', art: 'selfie', seed: u.name, name: 'selfie-out.jpg', sample: true },
        note: off ? pick(['Collected tiles samples from the supplier yard before reaching site', 'Checked in from the parking lot across the road']) : '', history: [] });
    });
  }
  // a forgotten check-out, and a corrected check-in with its change history
  const vy = db.attendance.find(a => a.user === 'u6' && a.date === D(lastWD)); if (vy) vy.out = null;
  const fixA = db.attendance.find(a => a.user === 'u4' && a.date === D(lastWD - 5));
  if (fixA) { const was = fixA.in; fixA.in = tsOn(fixA.date, 9, 2); fixA.history.push({ at: tsOn(D(lastWD - 4), 11, 20), by: 'u10', field: 'Check-in', from: was, to: fixA.in, reason: 'Selfie upload failed at site (no network); site entry register confirms arrival at 9:00 AM.', request: 'ac0' }); }
  db.attRequests = [
    ...(fixA ? [{ id: 'ac0', user: 'u4', date: fixA.date, type: 'Wrong check-in time', inTime: '09:02', outTime: '', reason: 'Selfie did not upload until I reached network at 10:10. Arrived at 9:00.', status: 'Approved', at: tsOn(fixA.date, 18, 30), decidedBy: 'u10', decidedAt: tsOn(D(lastWD - 4), 11, 20), comment: 'Verified with site register.' }] : []),
    ...(vy ? [{ id: 'ac1', user: 'u6', date: vy.date, type: 'Missed check-out', inTime: '', outTime: '19:05', reason: 'Left in a hurry after slab curing and forgot to check out. Left site at 7:05 PM.', status: 'Pending', at: tsOn(vy.date, 21, 10), decidedBy: null, decidedAt: null, comment: '' }] : []),
  ];

  /* ---------- performance & appraisals ---------- */
  const base = { u2: 86, u3: 82, u4: 88, u5: 76, u6: 80, u7: 72, u8: 90, u10: 84 };
  db.perf = {};
  emps.forEach(u => {
    const b = base[u.id] || 78; db.perf[u.id] = {};
    for (let i = 6; i >= 1; i--) {
      const d = parseD(D(0)); d.setDate(1); d.setMonth(d.getMonth() - i);
      const k = `${d.getFullYear()}-${pad(d.getMonth() + 1)}`, drift = (6 - i) * (u.id === 'u7' ? -.8 : .6), v = () => Math.max(48, Math.min(99, Math.round(b + drift + (rnd() - .5) * 14)));
      db.perf[u.id][k] = { timeliness: v(), tasks: v(), quality: v(), progress: v(), coordination: v(), attendance: v() };
    }
  });
  const q0 = prevQuarter(D(0)), q1 = prevQuarter(shiftD(q0.start, -1)), q2 = prevQuarter(shiftD(q1.start, -1));
  const reviewerOf = u => ['pm', 'accounts', 'admin'].includes(u.role) ? 'u1' : ['u4', 'u6'].includes(u.id) ? 'u2' : 'u3';
  const FB = { good: ['Consistently files daily reports on time with clear photos.', 'Good coordination with sub-contractors; crew deployment well planned.', 'Accurate measurements and quantities in reports.', 'Proactive about material indents and stock checks.'],
    improve: ['Needs to close snag lists faster before stage billing.', 'Report photos should cover every floor that had work.', 'Plan labour a day ahead to avoid idle crew.', 'Follow up on pending approvals earlier.'] };
  db.appraisals = []; let apn = 1;
  emps.forEach(u => [q2, q1, q0].forEach((q, qi) => {
    const pend = qi === 2 && ['u5', 'u6', 'u7', 'u3'].includes(u.id), self = qi === 2 && u.id === 'u6';
    const r = Math.max(2.6, Math.min(4.9, (base[u.id] || 78) / 20 + (rnd() - .5) * .6));
    db.appraisals.push({ id: 'ap' + apn++, user: u.id, period: q.key, label: q.label, reviewer: reviewerOf(u), status: pend ? (self ? 'Self-review submitted' : 'Pending') : qi === 2 && rnd() < .5 ? 'Completed' : 'Acknowledged',
      rating: pend ? null : Math.round(r * 10) / 10, scores: pend ? null : { timeliness: between(3, 5), tasks: between(3, 5), quality: between(3, 5), progress: between(3, 5), coordination: between(3, 5) },
      strengths: pend ? '' : pick(FB.good), improve: pend ? '' : pick(FB.improve), feedback: pend ? '' : `${pick(FB.good)} ${pick(FB.improve)}`, goals: pend ? '' : 'Keep daily report compliance above 95%; complete current stage on schedule.',
      self: self ? 'Handled two slab castings and the Cauvery Heights block A columns this quarter. Need support with additional bar benders.' : '',
      due: shiftD(q.end, 20), completedAt: pend ? null : tsOn(shiftD(q.end, between(8, 18)), 12, 0) });
  }));
  db.feedback = [
    { id: 'fb1', user: 'u4', by: 'u2', at: ts(-9, 18, 0), kind: 'Appreciation', text: 'Excellent handling of the Sundaram Residence plastering sequence — no rework this month.' },
    { id: 'fb2', user: 'u7', by: 'u3', at: ts(-6, 17, 0), kind: 'Improvement', text: 'Two daily reports missed in the last fortnight. Please flag network issues to the office early.' },
    { id: 'fb3', user: 'u6', by: 'u2', at: ts(-14, 12, 0), kind: 'Appreciation', text: 'Quick response during the cement shortage — rearranged crew to curing and shifting.' },
    { id: 'fb4', user: 'u8', by: 'u1', at: ts(-20, 16, 0), kind: 'Appreciation', text: 'Month-end closing completed two days early.' },
  ];

  /* ---------- materials: purchase, delivery, unloading, usage ---------- */
  const M = name => MAT_CATALOG.find(m => m[0].startsWith(name));
  // [project, material, qty, days ago, delivery lag (null = not delivered yet), issue]
  const PLAN = [
    ['p1', 'Cement', 120, 40, 0], ['p1', 'M-sand', 4, 34, 1], ['p1', 'Cement', 80, 18, 0], ['p1', 'PVC conduit', 200, 12, 1], ['p1', 'Cement', 60, 3, 1],
    ['p2', 'TMT bars Fe550 – 12', 8, 44, 1], ['p2', 'TMT bars Fe550 – 8', 3, 30, 1, ['Shortage', .15, 'Weighbridge slip shows 2.85 MT against 3 MT billed.']], ['p2', 'Cement', 300, 25, 0, ['Damaged', 6, '6 bags torn and wet — returned to the supplier with the driver.']],
    ['p2', 'Blue metal', 6, 20, 1], ['p2', 'M-sand', 6, 14, 0], ['p2', 'Red bricks', 12000, 9, 1, ['Shortage', 400, 'Counted 11,600 bricks at unloading; driver acknowledged.']], ['p2', 'Cement', 200, 1, null],
    ['p3', 'Red bricks', 10000, 33, 1], ['p3', 'Cement', 150, 22, 0], ['p3', 'M-sand', 3, 11, 0, ['Rejected', 3, 'High silt content in the field test — whole load rejected and sent back.']], ['p3', 'M-sand', 3, 10, 0],
    ['p4', 'Cement', 200, 28, 0], ['p4', 'TMT bars Fe550 – 12', 4, 21, 1], ['p4', 'Blue metal', 8, 16, 1], ['p4', 'M-sand', 5, 6, 0, ['Incorrect quantity', .5, 'Lorry body measured 4.5 units against 5 units billed.']],
    ['p5', 'Shuttering plywood', 60, 26, 1], ['p5', 'TMT bars Fe550 – 8', 1.5, 15, 1], ['p5', 'Cement', 100, 7, 0],
    ['p6', 'Vitrified tiles', 180, 24, 2, ['Damaged', 7, '7 boxes had broken tiles — replacement promised with the next load.']], ['p6', 'Tile adhesive', 60, 23, 1], ['p6', 'Interior emulsion', 240, 8, 1], ['p6', 'Vitrified tiles', 40, 2, null],
  ];
  const VEH = () => `TN ${pick(['51', '68', '82', '49'])} ${pick(['AB', 'AC', 'BK', 'CM', 'Q'])} ${between(1000, 9899)}`;
  db.purchases = []; db.materialUse = []; let pun = 1, mun = 1, en = 9000;
  const poSeq = {};
  PLAN.sort((a, b) => b[3] - a[3]).forEach(([pid, mname, qty, ago, lag, issue]) => {
    const [name, cat, unit, rate, gst, supplier] = M(mname), p = P(pid);
    const date = D(-ago), fy = fyOf(date); poSeq[fy] = (poSeq[fy] || 40) + 1;
    const total = Math.round(qty * rate * (1 + gst / 100));
    const pu = { id: 'pu' + pun++, po: `PO/${fy}/${String(poSeq[fy]).padStart(4, '0')}`, project: pid, material: name, category: cat, unit, qty, rate, gst, supplier, date,
      billNo: `${supplier.split(' ').map(w => w[0]).join('').slice(0, 3).toUpperCase()}/${between(1100, 4800)}`, by: rnd() < .5 ? p.pm : p.engineer, at: tsOn(date, between(10, 16), between(0, 59)),
      billPhotos: [art('bill', { at: tsOn(date, 17, between(0, 50)) })], photos: [art(MAT_ART[cat] || 'cement', { at: tsOn(date, 17, between(0, 50)) })], paid: ago > 20 ? total : ago > 8 ? Math.round(total / 2 / 100) * 100 : 0, deliveries: [], expense: null, note: '' };
    if (lag != null && ago - lag >= 0) {
      const dd = D(-(ago - lag)), sH = between(8, 15), sM = between(0, 55), dur = between(25, 95);
      const endM = sH * 60 + sM + dur;
      const recAt = tsOn(dd, Math.floor(endM / 60), endM % 60) + between(20, 200) * 6e4, phAt = recAt + between(5, 300) * 6e4;
      const [itype, iqty, inote] = issue || [];
      const rejected = itype === 'Rejected';
      const bad = rejected ? qty : itype ? iqty : 0;
      const received = itype === 'Shortage' || itype === 'Incorrect quantity' ? qty - iqty : qty;
      const accepted = rejected ? 0 : itype === 'Damaged' ? qty - iqty : received;
      const sup = p.supervisor;
      pu.deliveries.push({ id: 'dv' + pu.id.slice(2), date: dd, unloadStart: `${pad(sH)}:${pad(sM)}`, unloadEnd: `${pad(Math.floor(endM / 60))}:${pad(endM % 60)}`, vehicle: VEH(), receivedQty: Math.round(received * 100) / 100, acceptedQty: Math.round(accepted * 100) / 100,
        receivedBy: sup, issues: itype ? [{ type: itype, qty: Math.round(bad * 100) / 100, note: inote }] : [], status: rejected ? 'Rejected' : itype ? 'Accepted with issues' : 'Accepted',
        photos: [art('truck', { at: phAt, by: sup }), art(MAT_ART[cat] || 'cement', { at: phAt, by: sup })], recordedAt: recAt, recordedBy: sup, photosAt: phAt, note: '' });
      // usage drawn from accepted stock for older deliveries
      if (accepted > 0 && ago - lag > 3) {
        const share = Math.min(.92, .35 + (ago - lag) / 60), parts = between(1, 3);
        const lv = (p.levels || []).filter(f => f.activities.some(a => a.status !== 'Not started'));
        for (let k = 0; k < parts; k++) {
          const q = Math.round(accepted * share / parts * 100) / 100, f = lv.length ? pick(lv) : null;
          db.materialUse.push({ id: 'mu' + mun++, project: pid, material: name, unit, date: D(-(ago - lag) + 1 + k * 2 > 0 ? 0 : -(ago - lag) + 1 + k * 2), qty: unit === 'nos' || unit === 'bags' || unit === 'lengths' || unit === 'boxes' || unit === 'sheets' ? Math.round(q) : q, floor: f?.id || null, note: f ? `${pick(f.activities.filter(a => a.status !== 'Not started')).name} – ${f.name}` : 'General use', by: sup });
        }
      }
    }
    const e = { id: 'e' + en++, project: pid, date, category: 'Materials', item: `${name} – ${num(qty)} ${unit}`, vendor: supplier, amount: total, mode: 'Supplier bill', by: pu.by, purchase: pu.id };
    db.expenses.push(e); pu.expense = e.id;
    db.purchases.push(pu);
  });
  db.expenses.sort((a, b) => b.date.localeCompare(a.date));

  /* ---------- project service history ---------- */
  const sv = (id, pid, ago, type, title, description, location, resp, mats, labour, other, status, before, after, follow, log) => ({ id, ref: `SRV-${String(100 + +id.slice(2)).padStart(4, '0')}`, project: pid, date: D(-ago), type, title, description, location, responsible: resp,
    materials: mats.map(([item, qty, cost]) => ({ item, qty, cost })), labour, other, status, before, after, attachments: [], followUp: follow ? { date: D(follow[0]), note: follow[1], done: !!follow[2] } : null,
    log: log.map(([d, h, by, st, note]) => ({ at: ts(-d, h, 0), by, status: st, note })), reportedBy: log[0]?.[2] || 'u1', expensed: false });
  db.services = [
    sv('sv1', 'p8', 62, 'Defect', 'Terrace waterproofing leak near overhead tank', 'Seepage on the first-floor bedroom ceiling below the OHT platform after the first heavy rain.', 'Terrace · OHT platform', 'Arul Waterproofing Works', [['Polyurethane waterproofing membrane', '18 sq.m', 14800], ['Cement & sand for screed', '6 bags', 3100]], 9500, 1500, 'Closed',
      [art('leak', { at: ts(-62, 11, 0), by: 'u5' })], [art('fixed', { at: ts(-53, 16, 0), by: 'u5' })], [-30, 'Re-check after the next heavy rain', true],
      [[62, 11, 'u5', 'Reported', 'Client called about ceiling seepage. Inspected and photographed.'], [58, 10, 'u5', 'In progress', 'Old coating removed; PU membrane applied in two coats.'], [53, 16, 'u5', 'Completed', 'Flood test for 48 hours — no leakage.'], [30, 12, 'u3', 'Closed', 'Re-checked after rain; client signed off.']]),
    sv('sv2', 'p8', 21, 'Repair', 'Kitchen sink drain blockage', 'Slow drain in the kitchen; grease trap choked.', 'Ground floor · Kitchen', 'Ganesh Plumbing Works', [['PVC trap & coupling', '1 set', 650]], 1200, 0, 'Completed',
      [], [], null, [[21, 10, 'u3', 'Reported', 'Client request over phone.'], [20, 15, 'u5', 'Completed', 'Trap replaced and line flushed.']]),
    sv('sv3', 'p8', 5, 'Inspection', 'Quarterly post-handover inspection', 'Routine inspection of structure, plumbing, electrical and finishes three months after handover.', 'Whole building', 'u5', [], 0, 800, 'Completed',
      [src('assets/media/p8-photo-1.jpg', { at: ts(-5, 12, 0), by: 'u5' })], [], [10, 'Touch-up paint on compound wall patch before the monsoon'],
      [[5, 10, 'u5', 'Reported', 'Inspection scheduled with the client.'], [5, 13, 'u5', 'Completed', 'No structural issues. Minor paint touch-up noted as follow-up.']]),
    sv('sv4', 'p8', 3, 'Defect', 'Hairline crack on first-floor bedroom wall', 'Hairline crack (about 0.3 mm) along the lintel level of bedroom 2, west wall.', 'First floor · Bedroom 2', 'u5', [], 0, 0, 'Reported',
      [art('crack', { at: ts(-3, 17, 0), by: 'u5' })], [], [2, 'Fill with crack filler and repaint after monitoring for a week'], [[3, 17, 'u5', 'Reported', 'Reported by client during visit. Tell-tale fixed for monitoring.']]),
    sv('sv5', 'p1', 12, 'Inspection', 'Curing inspection – first floor slab', 'Checked curing records and surface cracks on the first floor slab.', 'First floor · Roof slab', 'u4', [], 0, 0, 'Closed',
      [src('assets/media/p1-photo-2.jpg', { at: ts(-12, 11, 0), by: 'u4' })], [], null, [[12, 10, 'u4', 'Reported', 'Weekly quality inspection.'], [12, 12, 'u4', 'Completed', 'Curing adequate; no shrinkage cracks.'], [11, 10, 'u2', 'Closed', 'Reviewed.']]),
    sv('sv6', 'p2', 9, 'Maintenance', 'Concrete mixer service', 'Scheduled service — oil change, drum bearing greasing and belt replacement.', 'Site equipment yard', 'Murugan Machinery Rentals', [['Engine oil 5 L', '1 can', 1650], ['V-belt', '2 nos', 900]], 1500, 0, 'Completed',
      [], [], null, [[9, 9, 'u5', 'Reported', 'Due for 250-hour service.'], [9, 15, 'u5', 'Completed', 'Serviced and test run done.']]),
    sv('sv7', 'p3', 6, 'Defect', 'Honeycombing at column C7', 'Honeycombing near the bottom of column C7 (ground floor) after de-shuttering.', 'Ground floor · Column C7', 'u4', [['Micro-concrete repair mortar', '4 bags', 5200], ['Bonding agent', '2 L', 1400]], 3500, 0, 'In progress',
      [art('column', { at: ts(-6, 16, 0), by: 'u7' })], [], [1, 'Engineer to approve the repaired surface before plastering'],
      [[6, 16, 'u7', 'Reported', 'Found after de-shuttering; photographs taken.'], [4, 11, 'u4', 'In progress', 'Loose concrete chipped out; micro-concrete repair started.']]),
    sv('sv8', 'p6', 4, 'Corrective action', 'False ceiling panel sag – consultation room 2', 'Gypsum panel sagging near the AC cut-out; additional hangers required.', 'Consultation room 2', 'Arul Interiors', [['GI hangers & channels', '1 lot', 1800]], 2200, 0, 'In progress',
      [art('crack', { at: ts(-4, 15, 0), by: 'u6' })], [], [3, 'Repaint ceiling after the fix'], [[4, 15, 'u6', 'Reported', 'Noticed during painting.'], [2, 10, 'u4', 'In progress', 'Contractor fixing additional hangers.']]),
    sv('sv9', 'p5', 2, 'Inspection', 'Scaffolding & safety inspection', 'Weekly safety check of scaffolding, props and edge protection before slab casting.', 'Roof level', 'u6', [], 0, 0, 'Completed',
      [src('assets/media/p5-photo-1.jpg', { at: ts(-2, 10, 0), by: 'u6' })], [], null, [[2, 9, 'u6', 'Reported', 'Weekly safety inspection.'], [2, 11, 'u6', 'Completed', 'Two loose couplers tightened; edge rope replaced.']]),
    sv('sv10', 'p4', 1, 'Repair', 'Dewatering pump not starting', 'Dewatering pump at the footing pit trips on start; footing pit F11 holding water.', 'Foundation · Pit F11', 'Murugan Machinery Rentals', [], 0, 0, 'Reported',
      [], [], [0, 'Pump to be repaired or replaced before excavation resumes'], [[1, 16, 'u7', 'Reported', 'Raised with the rental company.']]),
  ];

  /* ---------- invoices: client invoices from the billing schedule ---------- */
  const invSeq = {};
  const nextInv = date => { const fy = fyOf(date); invSeq[fy] = (invSeq[fy] || 0) + 1; return `SSB/${fy}/INV-${String(invSeq[fy]).padStart(3, '0')}`; };
  const taxable = amt => Math.round(amt / 1.18 * 100) / 100;
  db.invoices = []; let ivn = 1;
  db.billing.filter(b => b.billed).sort((a, b) => a.due.localeCompare(b.due)).forEach(b => {
    const p = P(b.project), date = shiftD(b.due, -10) < p.start ? p.start : shiftD(b.due, -10);
    db.invoices.push({ id: 'iv' + ivn++, no: nextInv(date), kind: 'client', project: b.project, billing: b.id, label: b.label, date, due: b.due, status: 'Issued', gst: 18,
      lines: [{ desc: `${b.label} — ${b.pct}% of contract value (${p.code})`, qty: 1, unit: 'LS', rate: taxable(b.amount) }], notes: 'Stage payment as per the construction agreement.', by: 'u8', issuedAt: tsOn(date, 11, 0) });
  });
  const p1 = P('p1'), extraTot = Math.round((62000 + 28500) * 1.18);
  const xb = { id: 'bx1', project: 'p1', label: 'Extra work – terrace toilet', pct: 0, amount: extraTot, billed: true, due: D(-1) };
  db.billing.push(xb);
  db.invoices.push({ id: 'iv' + ivn++, no: nextInv(D(-15)), kind: 'client', project: 'p1', billing: xb.id, label: xb.label, date: D(-15), due: D(-1), status: 'Issued', gst: 18,
    lines: [{ desc: 'Brickwork, plastering & waterproofing – additional terrace toilet', qty: 1, unit: 'LS', rate: 62000 }, { desc: 'Sanitary fittings – EWC, wash basin & CP fittings', qty: 1, unit: 'set', rate: 28500 }], notes: 'Extra work approved by the client on site visit.', by: 'u8', issuedAt: ts(-15, 12, 0) });
  db.invoices.push({ id: 'iv' + ivn++, no: nextInv(D(-20)), kind: 'client', project: 'p1', billing: null, label: 'Extra work – MS main gate', date: D(-20), due: D(-5), status: 'Cancelled', gst: 18,
    lines: [{ desc: 'MS main gate fabrication & fixing', qty: 1, unit: 'LS', rate: 85000 }], notes: '', by: 'u8', issuedAt: ts(-20, 11, 0), cancelledAt: ts(-19, 10, 0), cancelledBy: 'u1', cancelReason: 'Raised in error — the main gate is included in the contract scope.' });
  const nb = db.billing.find(b => b.project === 'p5' && !b.billed);
  if (nb) db.invoices.push({ id: 'iv' + ivn++, no: null, kind: 'client', project: 'p5', billing: nb.id, label: nb.label, date: D(0), due: shiftD(D(0), 15), status: 'Draft', gst: 18,
    lines: [{ desc: `${nb.label} — ${nb.pct}% of contract value (${P('p5').code})`, qty: 1, unit: 'LS', rate: taxable(nb.amount) }], notes: 'Raise once the roof slab is cast.', by: 'u8', issuedAt: null });
  db.invSeq = invSeq;
  // contractor bills: line items, and a draft and a cancelled bill
  db.contractorBills.forEach(b => { b.lines = [{ desc: b.work, qty: 1, unit: 'LS', rate: taxable(b.amount) }]; b.gst = 18; b.status = 'Issued'; });
  db.contractorBills.push(
    { id: 'cb13', billNo: 'AI/26/118', contractor: 'Arul Interiors', project: 'p6', work: 'Reception counter laminate & edge banding – final', amount: 68440, paid: 0, date: D(-1), due: D(14), gst: 18, status: 'Draft', lines: [{ desc: 'Laminate & edge banding – reception counter', qty: 1, unit: 'LS', rate: 42000 }, { desc: 'Hardware – soft-close hinges & handles', qty: 1, unit: 'set', rate: 16000 }] },
    { id: 'cb14', billNo: 'SE/26/77', contractor: 'SRS Earthmovers', project: 'p4', work: 'Excavation – footings & sump (duplicate)', amount: 225000, paid: 0, date: D(-4), due: D(11), gst: 18, status: 'Cancelled', cancelReason: 'Duplicate of bill SE/26/61 already recorded.', lines: [{ desc: 'Excavation – footings & sump', qty: 1, unit: 'LS', rate: taxable(225000) }] });
  // payment receipts get running numbers per financial year
  const rs = {};
  db.payments.slice().sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id)).forEach(x => { const fy = fyOf(x.date); rs[fy] = (rs[fy] || 0) + 1; x.rno = `SSB/${fy}/RCT-${String(rs[fy]).padStart(3, '0')}`; });
  db.rctSeq = rs;

  /* ---------- notifications & activity ---------- */
  const N = (to, at, text, href, kind, by) => ({ id: 'n' + (++phn), at, to, text, href, kind, by, read: [] });
  db.notifications = [
    N(['u1', 'u2'], ts(-1, 15, 45), 'Revised plan uploaded for review: Structural drawings v3 · Sundaram Residence', '#/documents?tab=review', 'doc', 'u4'),
    N(['u1'], ts(-6, 16, 15), 'Revised elevation awaiting approval: Elevation – front v2 · Vel Murugan Textiles Showroom', '#/documents?tab=review', 'doc', 'u2'),
    N(['u10', 'u1'], tsOn(D(lastWD), 21, 6), `Senthil Kumar asked the office to upload the ${fmtD(D(lastWD))} report for Sri Balaji Commercial Complex`, '#/site?tab=compliance', 'report', 'u7'),
    N(['u2', 'u10', 'u1'], ts(-3, 10, 30), 'Vignesh Murugan applied for casual leave', '#/leave?tab=approvals', 'leave', 'u5'),
    N(['u3', 'u10', 'u1'], ts(-2, 9, 10), 'Senthil Kumar applied for a half day (first half)', '#/leave?tab=approvals', 'leave', 'u7'),
    N(['u1', 'u10'], ts(-3, 18, 0), 'Divya Shankar applied for 5 days of earned leave', '#/leave?tab=approvals', 'leave', 'u3'),
    N(['u10', 'u1'], tsOn(D(lastWD), 21, 12), 'Vishal requested an attendance correction (missed check-out)', '#/attendance?tab=corrections', 'attendance', 'u6'),
    N(['u4'], ts(-2, 10, 16), 'Interior layout plan v4 was rejected: the counter blocks the fire exit route', '#/documents?tab=review', 'doc', 'u3'),
    N(['u2', 'u8'], ts(-9, 13, 0), 'Delivery issue at Cauvery Heights: 400 bricks short on the latest load', '#/materials?tab=deliveries', 'material', 'u6'),
    N(['u3', 'u4'], ts(-6, 16, 5), 'Defect reported: honeycombing at column C7 · Sri Balaji Commercial Complex', '#/service', 'service', 'u7'),
    N(['u1', 'u2', 'u3'], ts(-1, 9, 0), `${plural(4, 'quarterly appraisal')} for ${q0.label} are pending`, '#/performance?tab=appraisals', 'appraisal', null),
  ];
  db.activity.unshift(
    { at: ts(-1, 15, 45), by: 'u4', project: 'p1', kind: 'doc', text: 'uploaded Structural drawings v3 for review on Sundaram Residence' },
    { at: ts(-2, 10, 15), by: 'u3', project: 'p6', kind: 'doc', text: 'rejected Interior layout plan v4 for Fathima Clinic Interiors' });
  db.seq = 5000;
  return db;
}
