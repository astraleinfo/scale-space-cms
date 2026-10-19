/* Sample data for the Scale Space Builders demo.
   Dates are generated relative to today so the demo always looks current. */
'use strict';

/* Floor-wise construction plan: levels (foundation, each floor, terrace) and the activities on each.
   phase orders the construction sequence so several activities on different floors overlap. */
const FLOOR_ACTS = [['Columns', 'Concrete', 1], ['Roof slab', 'Concrete', 2], ['Brickwork', 'Masonry', 3], ['Electrical conduits', 'Electrical', 4], ['Plumbing lines', 'Plumbing', 4], ['Plastering', 'Plastering', 5], ['Flooring', 'Flooring', 6], ['Painting', 'Painting', 7]];
const BASE_ACTS = [['Excavation', 'Excavation', 0], ['PCC & footings', 'Concrete', 0], ['Column starters', 'Reinforcement', 0], ['Plinth beam', 'Concrete', 0], ['Backfilling', 'General', 0]];
const TERRACE_ACTS = [['Parapet wall', 'Masonry', 3.5], ['Waterproofing', 'Waterproofing', 5.5], ['Overhead tank', 'Plumbing', 6]];
const ZONE_ACTS = [['False ceiling', 'Carpentry', 0], ['Electrical', 'Electrical', 1], ['Carpentry', 'Carpentry', 2], ['Flooring', 'Flooring', 3], ['Painting', 'Painting', 4]];
const FLOOR_NAMES = ['Ground floor', 'First floor', 'Second floor', 'Third floor', 'Fourth floor', 'Fifth floor'];
function floorPlan(p) {
  const mk = (id, name, kind, acts) => ({ id, name, kind, activities: acts.map(([n, cat, phase], i) => ({ id: `${id}a${i + 1}`, name: n, category: cat, phase, status: 'Not started', pct: 0, workers: [], start: null, done: null })) });
  if (p.type === 'Interior fit-out') return ['Reception', 'Consultation rooms', 'Waiting lounge', 'Pharmacy'].map((z, i) => mk(`${p.id}z${i + 1}`, z, 'zone', ZONE_ACTS));
  const m = String(p.floors || '').match(/G\+(\d)/);
  const upper = m ? +m[1] : 0;
  const levels = [mk(`${p.id}f0`, 'Foundation & plinth', 'base', BASE_ACTS)];
  for (let i = 0; i <= upper; i++) levels.push(mk(`${p.id}f${i + 1}`, FLOOR_NAMES[i], 'floor', FLOOR_ACTS));
  levels.push(mk(`${p.id}ft`, 'Terrace', 'terrace', TERRACE_ACTS));
  return levels;
}

function buildSeed() {
  let s = 20190401;
  const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  const pick = a => a[Math.floor(rnd() * a.length)];
  const between = (a, b) => a + Math.floor(rnd() * (b - a + 1));
  const D = n => { const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() + n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
  const ts = (n, h = 10, m = 0) => { const d = new Date(); d.setDate(d.getDate() + n); d.setHours(h, m, 0, 0); return d.getTime(); };
  const L = 1e5;
  const sum = a => a.reduce((x, y) => x + y, 0);

  /* ---------- users ---------- */
  const users = [
    { id: 'u1', name: 'Gowtham', role: 'owner', title: 'Owner & Managing Director', email: 'gowtham@scalespacebuilders.com', phone: '+91 78454 36496', status: 'Active', last: ts(0, 9, 12) },
    { id: 'u11', name: 'Ramesh Iyer', role: 'sysadmin', title: 'Administrator', email: 'ramesh@scalespacebuilders.com', phone: '+91 97890 14432', status: 'Active', last: ts(0, 9, 5) },
    { id: 'u2', name: 'Karthik Raman', role: 'pm', title: 'Project Manager', email: 'karthik@scalespacebuilders.com', phone: '+91 94433 21870', status: 'Active', last: ts(0, 8, 40) },
    { id: 'u3', name: 'Divya Shankar', role: 'pm', title: 'Project Manager', email: 'divya@scalespacebuilders.com', phone: '+91 98940 66213', status: 'Active', last: ts(-1, 18, 5) },
    { id: 'u4', name: 'Arun Prakash', role: 'engineer', title: 'Site Engineer', email: 'arun@scalespacebuilders.com', phone: '+91 90034 77120', status: 'Active', last: ts(0, 7, 55) },
    { id: 'u5', name: 'Vignesh Murugan', role: 'engineer', title: 'Site Engineer', email: 'vignesh@scalespacebuilders.com', phone: '+91 97877 10453', status: 'Active', last: ts(0, 8, 10) },
    { id: 'u6', name: 'Vishal', role: 'supervisor', title: 'Site Supervisor', email: 'vishal@scalespacebuilders.com', phone: '+91 93611 58842', status: 'Active', last: ts(0, 7, 20) },
    { id: 'u7', name: 'Senthil Kumar', role: 'supervisor', title: 'Site Supervisor', email: 'senthil@scalespacebuilders.com', phone: '+91 96296 40518', status: 'Active', last: ts(0, 7, 45) },
    { id: 'u8', name: 'Kavitha Sundar', role: 'accounts', title: 'Accounts Manager', email: 'kavitha@scalespacebuilders.com', phone: '+91 94862 31077', status: 'Active', last: ts(0, 10, 2) },
    { id: 'u9', name: 'Nandhini Rajan', role: 'accounts', title: 'Accounts Assistant', email: 'nandhini@scalespacebuilders.com', phone: '+91 99442 80651', status: 'Invited', last: null },
    { id: 'u10', name: 'Priya Natarajan', role: 'admin', title: 'Office Administrator', email: 'priya@scalespacebuilders.com', phone: '+91 94875 22164', status: 'Active', last: ts(0, 9, 30) },
  ];

  /* ---------- projects ---------- */
  const STD = ['Site preparation', 'Foundation', 'Plinth', 'Superstructure', 'Brickwork', 'Roofing', 'Plastering', 'Finishes', 'Handover'];
  const INT = ['Design approval', 'Civil changes', 'False ceiling', 'Electrical', 'Carpentry', 'Flooring', 'Painting', 'Handover'];
  const projects = [
    { id: 'p1', code: 'SSB-2501', name: 'Sundaram Residence', type: 'Independent villa', area: 3200, floors: 'G+1',
      client: { name: 'Dr. S. Sundaram', phone: '+91 94431 52786', email: 'drsundaram@gmail.com', address: '14, Kamarajar Salai, Mayiladuthurai' },
      location: 'Lalbahadur Nagar', city: 'Mayiladuthurai', start: D(-260), end: D(70), value: 78 * L, stages: STD, stage: 6, progress: 72,
      status: 'On track', pm: 'u2', engineer: 'u4', supervisor: 'u6' },
    { id: 'p2', code: 'SSB-2502', name: 'Cauvery Heights Apartments', type: 'Residential apartments', area: 18400, floors: 'G+3 · 12 units',
      client: { name: 'Cauvery Promoters Pvt. Ltd.', phone: '+91 435 242 1180', email: 'projects@cauverypromoters.in', address: 'Kumbakonam Road, Mayiladuthurai' },
      location: 'Kumbakonam Road', city: 'Mayiladuthurai', start: D(-210), end: D(250), value: 460 * L, stages: STD, stage: 3, progress: 38,
      status: 'At risk', pm: 'u2', engineer: 'u5', supervisor: 'u6' },
    { id: 'p3', code: 'SSB-2503', name: 'Sri Balaji Commercial Complex', type: 'Commercial complex', area: 9600, floors: 'G+2 · 14 shops',
      client: { name: 'K. Balaji', phone: '+91 98427 30914', email: 'balaji.traders@gmail.com', address: 'Main Road, Sirkazhi' },
      location: 'Main Road', city: 'Sirkazhi', start: D(-240), end: D(45), value: 215 * L, stages: STD, stage: 4, progress: 58,
      status: 'Delayed', pm: 'u3', engineer: 'u4', supervisor: 'u7' },
    { id: 'p4', code: 'SSB-2504', name: 'Meenakshi Kalyana Mandapam', type: 'Marriage hall', area: 14200, floors: 'G+1 · 800 seats',
      client: { name: 'Sri Meenakshi Charitable Trust', phone: '+91 4366 222 905', email: 'trust.meenakshi@gmail.com', address: 'Kamalalayam North Street, Thiruvarur' },
      location: 'South Car Street', city: 'Thiruvarur', start: D(-55), end: D(395), value: 340 * L, stages: STD, stage: 1, progress: 12,
      status: 'On track', pm: 'u3', engineer: 'u5', supervisor: 'u7' },
    { id: 'p5', code: 'SSB-2505', name: 'Anand Farmhouse', type: 'Farmhouse', area: 2400, floors: 'Ground',
      client: { name: 'Anand Krishnan', phone: '+91 90920 41536', email: 'anand.k@outlook.com', address: 'Anna Nagar, Chennai' },
      location: 'Beach Road', city: 'Tharangambadi', start: D(-150), end: D(120), value: 112 * L, stages: STD, stage: 5, progress: 54,
      status: 'On track', pm: 'u2', engineer: 'u5', supervisor: 'u6' },
    { id: 'p6', code: 'SSB-2506', name: 'Fathima Clinic Interiors', type: 'Interior fit-out', area: 2100, floors: 'First floor',
      client: { name: 'Dr. Fathima Begum', phone: '+91 94890 66721', email: 'fathimaclinic@gmail.com', address: 'Thiruvalluvar Street, Karaikal' },
      location: 'Thiruvalluvar Street', city: 'Karaikal', start: D(-75), end: D(18), value: 42 * L, stages: INT, stage: 6, progress: 84,
      status: 'On track', pm: 'u3', engineer: 'u4', supervisor: 'u6' },
    { id: 'p7', code: 'SSB-2508', name: 'Vel Murugan Textiles Showroom', type: 'Commercial showroom', area: 5200, floors: 'G+1',
      client: { name: 'Vel Murugan Textiles', phone: '+91 435 242 7731', email: 'velmurugantex@gmail.com', address: 'Pattamangala Street, Mayiladuthurai' },
      location: 'Pattamangala Street', city: 'Mayiladuthurai', start: D(-120), end: D(160), value: 128 * L, stages: STD, stage: 2, progress: 21,
      status: 'On hold', pm: 'u2', engineer: 'u4', supervisor: 'u7', holdReason: 'Awaiting revised elevation approval from client' },
    { id: 'p8', code: 'SSB-2405', name: 'Raghavan Villa', type: 'Independent villa', area: 2850, floors: 'G+1',
      client: { name: 'T. Raghavan', phone: '+91 94437 81205', email: 'raghavan.t@gmail.com', address: 'Poompuhar Road, Sembanarkoil' },
      location: 'Poompuhar Road', city: 'Sembanarkoil', start: D(-520), end: D(-96), value: 64 * L, stages: STD, stage: 8, progress: 100,
      status: 'Completed', pm: 'u3', engineer: 'u5', supervisor: 'u6', completed: D(-90) },
  ];
  const active = projects.filter(p => !['Completed', 'On hold'].includes(p.status));

  /* ---------- workers ---------- */
  const TRADES = { Mason: 950, Helper: 650, Carpenter: 1000, 'Bar bender': 900, Electrician: 1000, Plumber: 950, Painter: 850, Welder: 950, 'Tile layer': 1000 };
  const men = ['Murugan', 'Selvam', 'Raja', 'Ganesan', 'Kumar', 'Mani', 'Saravanan', 'Ravi', 'Pandian', 'Velu', 'Suresh', 'Anbu', 'Kannan', 'Siva', 'Dinesh', 'Prabhu', 'Elango', 'Balu', 'Karuppaiah', 'Sekar', 'Vijay', 'Manikandan', 'Arumugam', 'Durai', 'Rajendran', 'Mohan', 'Gopal', 'Sakthivel', 'Thangaraj', 'Jeeva', 'Ilayaraja', 'Natarajan', 'Kathir', 'Marimuthu'];
  const women = ['Selvi', 'Valli', 'Pushpa', 'Lakshmi', 'Kamala', 'Rani', 'Muthulakshmi', 'Saroja', 'Jaya', 'Amudha', 'Malar', 'Chitra'];
  const initialsPool = 'ARKMSPVTGNBDE';
  const crew = { p1: { Mason: 4, Helper: 5, Carpenter: 1, Plumber: 1, Electrician: 1 }, p2: { Mason: 6, Helper: 8, 'Bar bender': 3, Carpenter: 3, Welder: 1 },
    p3: { Mason: 4, Helper: 5, Electrician: 1, Plumber: 1 }, p4: { Mason: 3, Helper: 5, 'Bar bender': 2, Carpenter: 1 },
    p5: { Mason: 3, Helper: 3, Carpenter: 2, 'Bar bender': 1 }, p6: { Carpenter: 2, Painter: 2, Electrician: 1, 'Tile layer': 2, Helper: 1 } };
  const workers = [];
  let wn = 1, mi = 0, fi = 0;
  for (const [pid, mix] of Object.entries(crew)) {
    for (const [trade, n] of Object.entries(mix)) {
      for (let i = 0; i < n; i++) {
        const female = trade === 'Helper' && rnd() < .55;
        const first = female ? women[fi++ % women.length] : men[mi++ % men.length];
        workers.push({
          id: 'w' + wn, code: 'W-' + String(100 + wn), name: `${first} ${pick(initialsPool.split(''))}.`, trade,
          wage: TRADES[trade] + (trade === 'Mason' && rnd() < .3 ? 100 : 0), phone: `+91 9${between(1, 9)}${between(100, 999)} ${between(10000, 99999)}`,
          project: pid, joined: D(-between(60, 900)), status: 'Active', gender: female ? 'F' : 'M',
          contractor: trade === 'Electrician' ? 'Sri Murugan Electricals' : trade === 'Plumber' ? 'Ganesh Plumbing Works' : 'Direct',
        });
        wn++;
      }
    }
  }
  workers.push({ id: 'w' + wn++, code: 'W-' + (100 + wn), name: 'Sekar M.', trade: 'Mason', wage: 950, phone: '+91 94422 10833', project: 'p7', joined: D(-400), status: 'Inactive', gender: 'M', contractor: 'Direct' });

  /* ---------- floor-wise progress ---------- */
  // fill activities in construction order up to the project's progress, with a wave of 3 activities in progress at once
  for (const p of projects) {
    p.levels = floorPlan(p);
    const lv = (f) => p.levels.indexOf(f);
    const acts = p.levels.flatMap(f => f.activities.map(a => ({ a, f }))).sort((x, y) => x.a.phase - y.a.phase || lv(x.f) - lv(y.f));
    const n = acts.length, S = p.status === 'Completed' ? n : p.progress / 100 * n;
    const wave = [.6, .3, .1];
    let full = Math.max(0, Math.floor(S - .5)), rest = S - full;
    if (p.status === 'Completed') { full = n; rest = 0; }
    const span = (new Date(p.end) - new Date(p.start)) / 864e5;
    const crew = workers.filter(w => w.project === p.id && w.status === 'Active');
    acts.forEach(({ a }, i) => {
      if (i < full) { a.pct = 100; a.status = 'Completed'; a.done = D(Math.min(-1, Math.round(-((new Date() - new Date(p.start)) / 864e5) + span * (i + 1) / n * .9))); a.start = a.done; return; }
      const k = i - full;
      if (k < 3 && rest > 0) { const v = Math.min(95, Math.max(5, Math.round(Math.min(1, rest * wave[k] / (wave[k] + .0001) ) * 100 * (k === 0 ? .7 : k === 1 ? .4 : .15)))); a.pct = v; a.status = 'In progress'; a.start = D(-between(3, 20)); }
    });
    // assign the matching crew to the activities in progress
    const FIT = { Masonry: ['Mason', 'Helper'], Concrete: ['Mason', 'Helper', 'Bar bender'], Reinforcement: ['Bar bender'], Plastering: ['Mason', 'Helper'], Electrical: ['Electrician'], Plumbing: ['Plumber'], Flooring: ['Tile layer', 'Mason'], Painting: ['Painter'], Carpentry: ['Carpenter'], Excavation: ['Helper'], General: ['Helper'], Waterproofing: ['Mason', 'Helper'] };
    p.levels.forEach(f => f.activities.filter(a => a.status === 'In progress').forEach(a => { a.workers = crew.filter(w => (FIT[a.category] || []).includes(w.trade)).slice(0, 4).map(w => w.id); }));
    if (p.status !== 'Completed') p.progress = Math.round(sum(acts.map(x => x.a.pct)) / n);
  }
  const floorLog = []; let fln = 1;
  for (const p of projects.filter(x => !['Completed'].includes(x.status))) {
    p.levels.forEach(f => f.activities.filter(a => a.status === 'In progress').forEach(a => {
      floorLog.push({ id: 'fl' + fln++, project: p.id, floor: f.id, at: ts(-between(1, 6), 17, between(0, 50)), by: rnd() < .5 ? p.supervisor : p.engineer, changes: [{ act: a.id, from: Math.max(0, a.pct - between(10, 25)), to: a.pct, status: 'In progress' }], note: `${a.name} progressing on the ${f.name.toLowerCase()}.`, photos: [] });
    }));
  }

  /* ---------- daily site reports: work done, crew who worked, wages ---------- */
  // [title, work category, unit, min qty, max qty, trades who do it]
  const WORKS = {
    p1: [['Internal wall plastering – first floor', 'Plastering', 'sq.ft', 280, 520, ['Mason', 'Helper']], ['External plastering – north elevation', 'Plastering', 'sq.ft', 180, 360, ['Mason', 'Helper']],
      ['Concealed conduit & switch boxes', 'Electrical', 'points', 6, 14, ['Electrician', 'Helper']], ['Bathroom waterproofing', 'Plumbing', 'sq.ft', 60, 140, ['Plumber', 'Helper']],
      ['Door frame fixing', 'Carpentry', 'nos', 2, 5, ['Carpenter']], ['Curing of plastered walls', 'Curing', 'sq.ft', 600, 1200, ['Helper']]],
    p2: [['Column reinforcement – Block A', 'Reinforcement', 'MT', 0.8, 2.4, ['Bar bender', 'Helper']], ['Column shuttering', 'Shuttering', 'nos', 4, 10, ['Carpenter', 'Helper']],
      ['Slab reinforcement tying', 'Reinforcement', 'MT', 1, 3, ['Bar bender']], ['Column concreting M25', 'Concrete', 'cu.m', 4, 12, ['Mason', 'Helper']],
      ['First floor brickwork', 'Masonry', 'bricks', 900, 2200, ['Mason', 'Helper']], ['Staircase railing fabrication', 'Fabrication', 'r.ft', 8, 24, ['Welder', 'Helper']],
      ['Material shifting to upper floors', 'General', 'trips', 10, 30, ['Helper']]],
    p3: [['Partition brickwork – first floor shops', 'Masonry', 'bricks', 1200, 2600, ['Mason', 'Helper']], ['Lintel casting', 'Concrete', 'cu.m', 0.8, 2.5, ['Mason', 'Helper']],
      ['Electrical first fix – shops', 'Electrical', 'points', 8, 20, ['Electrician', 'Helper']], ['Sump & drainage line', 'Plumbing', 'r.ft', 20, 60, ['Plumber', 'Helper']],
      ['Debris clearing', 'General', 'trips', 3, 8, ['Helper']]],
    p4: [['Footing excavation', 'Excavation', 'cu.m', 18, 45, ['Helper']], ['PCC 1:4:8 for footings', 'Concrete', 'cu.m', 3, 8, ['Mason', 'Helper']],
      ['Footing reinforcement cages', 'Reinforcement', 'MT', 0.6, 1.6, ['Bar bender', 'Helper']], ['Footing shuttering', 'Shuttering', 'nos', 4, 8, ['Carpenter', 'Helper']]],
    p5: [['Roof slab shuttering', 'Shuttering', 'sq.ft', 300, 700, ['Carpenter', 'Helper']], ['Roof slab reinforcement', 'Reinforcement', 'MT', 0.6, 1.5, ['Bar bender', 'Helper']],
      ['Sunshade & lintel concreting', 'Concrete', 'cu.m', 1, 3, ['Mason', 'Helper']], ['Parapet wall brickwork', 'Masonry', 'bricks', 600, 1400, ['Mason', 'Helper']]],
    p6: [['Wall putty & primer – lounge', 'Painting', 'sq.ft', 300, 650, ['Painter', 'Helper']], ['Vitrified tile laying', 'Flooring', 'sq.ft', 150, 380, ['Tile layer', 'Helper']],
      ['Reception counter carpentry', 'Carpentry', '%', 10, 25, ['Carpenter']], ['Light fixture installation', 'Electrical', 'nos', 6, 18, ['Electrician']]],
  };
  const SUMMARY = {
    p1: ['First floor plastering progressing well; bedroom 2 complete, bedroom 3 started.', 'Kitchen conduits laid; electrician to continue tomorrow.', 'External plastering on the north side is about 60% done.', 'Ground floor walls cured. Bathroom slopes checked by engineer.'],
    p2: ['Block A column reinforcement inspected and approved for shuttering.', 'Column shuttering for C14–C18 completed and plumb checked.', 'Brickwork resumed after rain on the first floor.', 'Received 12 MT TMT steel; stacked on raised platform.'],
    p3: ['Partition walls for shops 5 and 6 completed.', 'Brickwork stopped at 2 pm due to heavy rain.', 'Lintel reinforcement checked by engineer for shops 7–10.', 'Half crew deployed for debris clearance.'],
    p4: ['Excavation completed for footings F1–F10.', 'PCC laid for footings F1–F8.', 'Soil at grid H softer than expected – structural consultant informed.'],
    p5: ['Roof shuttering for living and dining area in progress.', 'Props checked; slab casting planned in four days.', 'Bedroom 2 lintel concreting completed.'],
    p6: ['Consultation room flooring complete; skirting pending.', 'Reception counter frame fixed; laminate work tomorrow.', 'Lounge putty second coat done; primer started.'],
  };
  const ISSUES = ['', '', '', 'Cement delivery delayed by half a day.', 'Water tanker arrived late.', 'Two helpers sent to the Thiruvarur site for the afternoon.', ''];
  const MATS = ['Cement 40 bags, M-sand 2 units', 'Bricks 1,500 nos, cement 22 bags', 'TMT 8mm 0.6 MT, binding wire 25 kg', 'Cement 30 bags, P-sand 1 unit', 'Tiles 38 boxes, tile adhesive 12 bags', 'Shuttering plywood 18 sheets'];
  const WEATHER = ['Sunny', 'Sunny', 'Cloudy', 'Light rain', 'Heavy rain', 'Sunny', 'Cloudy'];
  const qtyOf = (lo, hi, unit) => { const v = lo + rnd() * (hi - lo); return unit === 'bricks' ? Math.round(v / 50) * 50 : ['nos', 'points', 'trips', '%'].includes(unit) ? Math.max(1, Math.round(v)) : hi <= 5 ? Math.round(v * 10) / 10 : Math.round(v); };
  const reports = []; let rn = 1;
  const doneToday = ['p1', 'p2', 'p6'];
  for (let d = -29; d <= 0; d++) {
    for (const p of active) {
      if (!WORKS[p.id] || D(d) < p.start) continue;
      if (d === 0 ? !doneToday.includes(p.id) : rnd() < .06) continue;
      const usual = workers.filter(w => w.project === p.id && w.status === 'Active');
      const crewW = usual.filter(() => rnd() < .88);
      if (!crewW.length) continue;
      const trades = new Set(crewW.map(w => w.trade));
      const tpl = WORKS[p.id].filter(t => t[5].some(tr => trades.has(tr)) && rnd() < .7);
      trades.forEach(tr => { if (!tpl.some(t => t[5].includes(tr))) { const t = WORKS[p.id].find(x => x[5].includes(tr)); if (t) tpl.push(t); } });
      const work = tpl.map((t, i) => ({ id: 'wk' + (i + 1), title: t[0], category: t[1], unit: t[2], qty: qtyOf(t[3], t[4], t[2]), notes: '' }));
      const crew = crewW.map(w => {
        const fits = tpl.map((t, i) => t[5].includes(w.trade) ? work[i].id : null).filter(Boolean);
        const tasks = fits.length > 1 && rnd() < .3 ? fits.slice(0, 2) : [pick(fits)];
        return { wid: w.id, name: w.name, trade: w.trade, wage: w.wage + (rnd() < .06 ? 150 : 0), tasks };
      });
      const used = new Set(crew.flatMap(c => c.tasks));
      for (let k = work.length - 1; k >= 0; k--) if (!used.has(work[k].id)) work.splice(k, 1);
      const weather = d === 0 ? 'Sunny' : pick(WEATHER);
      reports.push({ id: 'r' + rn++, project: p.id, date: D(d), by: rnd() < .55 ? p.supervisor : p.engineer, at: d === 0 ? ts(0, 13, between(5, 50)) : ts(d, 18, between(0, 50)), status: 'Submitted',
        weather, stage: p.stages[p.stage], summary: pick(SUMMARY[p.id]), work, crew, materials: pick(MATS),
        issues: weather === 'Heavy rain' ? 'Work stopped for 2 hours due to heavy rain.' : pick(ISSUES) });
    }
  }

  /* ---------- documents ---------- */
  const documents = []; let dn = 1;
  const addDoc = (project, name, category, ext, kb, daysAgo, by, extra = {}) => documents.push({ id: 'd' + dn++, project, name, category, ext, size: kb * 1024, date: D(-daysAgo), by, version: extra.version || 1, art: extra.art || null, ...extra });
  for (const p of projects) {
    const age = Math.max(5, Math.round((new Date() - new Date(p.start)) / 864e5));
    if (p.stages === INT) {
      addDoc(p.id, `${p.code} Interior layout plan.pdf`, 'Floor plans', 'pdf', 2860, age - 4, p.pm, { version: 3, art: 'plan' });
      addDoc(p.id, `${p.code} Reflected ceiling plan.dwg`, 'Electrical plans', 'dwg', 1420, age - 12, p.engineer, { art: 'elec' });
      addDoc(p.id, `${p.code} 3D view – reception.jpg`, 'Architectural drawings', 'jpg', 1840, age - 6, p.pm, { art: 'photo', tone: 3, src: 'assets/media/p6-3d-reception.jpg' });
    } else {
      addDoc(p.id, `${p.code} Architectural plans – GF & FF.pdf`, 'Floor plans', 'pdf', 4210, age - 2, p.pm, { version: 2, art: 'plan' });
      addDoc(p.id, `${p.code} Structural drawings – footing & columns.dwg`, 'Structural drawings', 'dwg', 3380, age - 6, p.engineer, { version: 2, art: 'struct' });
      addDoc(p.id, `${p.code} Elevation – front.pdf`, 'Elevations', 'pdf', 1620, age - 8, p.pm, { art: 'elev' });
      addDoc(p.id, `${p.code} Electrical layout – GF.pdf`, 'Electrical plans', 'pdf', 1180, age - 30, p.engineer, { art: 'elec' });
      addDoc(p.id, `${p.code} Plumbing & drainage layout.pdf`, 'Plumbing layouts', 'pdf', 1340, age - 34, p.engineer, { art: 'plumb' });
      addDoc(p.id, `${p.code} Building plan approval.pdf`, 'Approvals', 'pdf', 980, age + 20, 'u1', { art: 'doc' });
    }
    addDoc(p.id, `${p.code} Construction agreement.pdf`, 'Contracts', 'pdf', 640, age + 10, 'u1', { art: 'doc' });
    addDoc(p.id, `${p.code} BOQ & estimate.xlsx`, 'Contracts', 'xlsx', 210, age + 12, 'u8', { art: 'sheet' });
    if (p.progress > 5) {
      const n = p.id === 'p1' || p.id === 'p2' ? 4 : 2;
      const done = p.status === 'Completed' ? Math.round((new Date() - new Date(p.end)) / 864e5) : 0;
      for (let i = 0; i < n; i++) {
        const st = p.stages[Math.max(0, p.stage - (i % 2))];
        addDoc(p.id, `Site photo – ${st} ${Math.floor(i / 2) + 1}.jpg`, 'Site photos', 'jpg', between(1800, 4200), done + 1 + i * 5 + (i % 2) * 9, p.supervisor, { art: 'photo', tone: between(0, 4), stage: st, src: `assets/media/${p.id}-photo-${i + 1}.jpg` });
      }
      addDoc(p.id, `Progress walkthrough – ${p.stages[p.stage]}.mp4`, 'Videos', 'mp4', between(38000, 92000), done + 2, p.engineer, { art: 'photo', tone: between(0, 4), stage: p.stages[p.stage], src: `assets/media/${p.id}-video`, poster: `assets/media/${p.id}-video-poster.jpg`, duration: 7 });
    }
    if (p.progress > 30) addDoc(p.id, `Monthly progress report – ${p.code}.pdf`, 'Reports', 'pdf', 760, between(5, 25), p.engineer, { art: 'doc' });
  }
  addDoc('p2', 'Soil test report – Cauvery Heights.pdf', 'Reports', 'pdf', 1240, 220, 'u5', { art: 'doc' });
  addDoc('p3', 'Fire NOC application.pdf', 'Approvals', 'pdf', 520, 30, 'u3', { art: 'doc' });
  addDoc('p8', 'Handover certificate – Raghavan Villa.pdf', 'Approvals', 'pdf', 410, 90, 'u1', { art: 'doc' });

  documents.filter(d => ['Site photos', 'Videos'].includes(d.category)).forEach(doc => {
    const reps = reports.filter(r => r.project === doc.project);
    if (!reps.length) return;
    const near = reps.reduce((a, r) => Math.abs(new Date(r.date) - new Date(doc.date)) < Math.abs(new Date(a.date) - new Date(doc.date)) ? r : a);
    if (Math.abs(new Date(near.date) - new Date(doc.date)) <= 7 * 864e5) { doc.date = near.date; doc.report = near.id; }
  });

  /* ---------- billing schedule & client payments ---------- */
  const SCHED = [['Advance on agreement', 10], ['Foundation complete', 15], ['Plinth complete', 10], ['Roof slab – ground floor', 15], ['Roof slab – first floor', 10], ['Brickwork complete', 10], ['Plastering complete', 10], ['Flooring & finishes', 15], ['Handover', 5]];
  const ISCHED = [['Advance on order', 30], ['Civil & ceiling complete', 25], ['Electrical & carpentry', 25], ['Finishes & painting', 15], ['Handover', 5]];
  const payments = []; let pn = 1;
  const billing = [];
  const MODES = ['NEFT', 'NEFT', 'RTGS', 'Cheque', 'UPI'];
  const shift = (iso, n) => { const d = new Date(iso + 'T00:00:00'); d.setDate(d.getDate() + n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
  for (const p of projects) {
    const sched = p.stages === INT ? ISCHED : SCHED;
    const span = (new Date(p.end) - new Date(p.start)) / 864e5;
    let cum = 0;
    const rows = sched.map(([label, pct], i) => {
      const prev = cum; cum += pct;
      const billed = i === 0 || p.progress >= prev + pct * .6;
      const due = billed ? shift(p.start, Math.round(span * Math.min(prev + pct * .6, p.progress) / 100)) : shift(p.start, Math.round(span * cum / 100));
      return { id: `b${p.id}${i}`, project: p.id, label, pct, amount: Math.round(p.value * pct / 100), billed, due: billed && due > D(-1) ? D(-2) : due };
    });
    billing.push(...rows);
    const billedRows = rows.filter(r => r.billed);
    billedRows.forEach((r, idx) => {
      const isLast = idx === billedRows.length - 1 && p.status !== 'Completed';
      const unpaidSecond = p.id === 'p3' && idx === billedRows.length - 2;
      const pDate = r.due < D(-8) ? shift(r.due, between(3, 8)) : D(-between(1, 3));
      if (unpaidSecond) { payments.push({ id: 'cp' + pn++, project: p.id, date: pDate, amount: Math.round(r.amount * .4 / 1000) * 1000, mode: pick(MODES), ref: 'TXN' + between(100000, 999999), against: r.label, by: 'u8' }); return; }
      if (isLast) {
        if (['p1', 'p6', 'p4'].includes(p.id)) payments.push({ id: 'cp' + pn++, project: p.id, date: pDate, amount: Math.round(r.amount * .5 / 1000) * 1000, mode: pick(MODES), ref: 'TXN' + between(100000, 999999), against: r.label, by: 'u8' });
        return;
      }
      payments.push({ id: 'cp' + pn++, project: p.id, date: pDate, amount: r.amount, mode: pick(MODES), ref: 'TXN' + between(100000, 999999), against: r.label, by: 'u8' });
    });
  }
  payments.sort((a, b) => b.date.localeCompare(a.date));

  /* ---------- site expenses ---------- */
  const EXP = [['Materials', ['Cement – Ramco 53 grade', 'TMT steel – Kamachi', 'M-sand & P-sand', 'Red bricks', 'Blue metal 20mm', 'Tiles & adhesive', 'Plywood & props', 'Paint – Asian Paints']], ['Equipment rental', ['Concrete mixer rental', 'Vibrator & needle', 'JCB – excavation', 'Scaffolding rental']], ['Transport', ['Lorry hire – material shifting', 'Tractor trips – sand']], ['Fuel', ['Diesel for generator', 'Diesel for mixer']], ['Utilities', ['Water tanker', 'EB temporary connection']], ['Site misc.', ['Safety helmets & gloves', 'Tea & refreshments', 'Tarpaulin sheets', 'Hardware & consumables']]];
  const VENDORS = { Materials: ['Sri Lakshmi Traders', 'Mayura Steel Centre', 'Kaveri Building Materials', 'Annai Bricks', 'Sakthi Hardwares'], 'Equipment rental': ['Murugan Machinery Rentals', 'SRS Earthmovers'], Transport: ['Velan Transports'], Fuel: ['Indian Oil – Koorainadu'], Utilities: ['Ganga Water Supply', 'TNEB'], 'Site misc.': ['Sakthi Hardwares', 'Local purchase'] };
  const expenses = []; let en = 1;
  for (const p of projects) {
    const received = payments.filter(x => x.project === p.id).reduce((a, x) => a + x.amount, 0);
    const target = received * (.5 + rnd() * .14);
    const from = Math.round((new Date(p.start) - new Date(D(0))) / 864e5);
    const to = p.status === 'Completed' ? Math.round((new Date(p.end) - new Date(D(0))) / 864e5) : 0;
    let spent = 0;
    while (spent < target) {
      const [cat, items] = rnd() < .6 ? EXP[0] : pick(EXP.slice(1));
      const share = cat === 'Materials' ? .004 + rnd() * .014 : cat === 'Equipment rental' ? .001 + rnd() * .004 : .0003 + rnd() * .0014;
      const amount = Math.max(1500, Math.round(p.value * share / 100) * 100);
      spent += amount;
      expenses.push({ id: 'e' + en++, project: p.id, date: D(between(Math.max(from, -420), to)), category: cat, item: pick(items), vendor: pick(VENDORS[cat]), amount, mode: pick(['Bank transfer', 'Cash', 'UPI', 'Cheque']), by: pick([p.engineer, 'u8', p.supervisor]) });
    }
  }
  expenses.sort((a, b) => b.date.localeCompare(a.date));

  /* ---------- contractor bills ---------- */
  const bills = [
    ['Sri Murugan Electricals', 'p1', 'Electrical conduit & wiring – ground floor', 2.4, 1, 24], ['Ganesh Plumbing Works', 'p1', 'Plumbing first fix – both floors', 1.85, .5, 12],
    ['Bharath Shuttering Contractors', 'p2', 'Shuttering – first floor slab', 6.2, 1, 40], ['Bharath Shuttering Contractors', 'p2', 'Shuttering – second floor columns', 3.4, 0, 6],
    ['Kaveri RMC', 'p2', 'Ready-mix concrete M25 – 86 m³', 5.9, .6, 18], ['AK Fabrication', 'p3', 'Staircase railing & rolling shutters (advance)', 2.8, .4, 14],
    ['Sri Murugan Electricals', 'p3', 'Electrical first fix – shops 1–6', 1.6, 0, 3], ['Lakshmi Tiles & Granite', 'p6', 'Vitrified tiles & granite counter', 3.15, 1, 21],
    ['Arul Interiors', 'p6', 'Carpentry – reception & cabinets', 4.6, .5, 9], ['SRS Earthmovers', 'p4', 'Excavation – footings & sump', 2.25, 0, 5],
    ['Bharath Shuttering Contractors', 'p5', 'Shuttering – roof slab', 1.9, 0, 2], ['Ganesh Plumbing Works', 'p8', 'Final plumbing & fixtures', 1.35, 1, 110],
  ];
  const contractorBills = bills.map(([contractor, project, work, lakhs, paidFrac, daysAgo], i) => {
    const amount = Math.round(lakhs * L); const paid = Math.round(amount * paidFrac / 1000) * 1000;
    return { id: 'cb' + (i + 1), billNo: `${contractor.split(' ').map(w => w[0]).join('').slice(0, 3).toUpperCase()}/${26 - (i % 2)}/${String(40 + i * 7)}`, contractor, project, work, amount, paid, date: D(-daysAgo), due: D(-daysAgo + 15) };
  });

  /* ---------- salaries & advances ---------- */
  const advances = [];
  const advW = workers.filter(w => w.status === 'Active');
  [[3, 5000, 'Family function'], [9, 3000, 'Medical'], [14, 8000, 'Child school fees'], [21, 2000, 'Personal'], [27, 5000, 'Deepavali advance'], [33, 4000, 'House repair'], [40, 3000, 'Medical'], [45, 6000, 'Deepavali advance']].forEach(([wi, amt, reason], i) => {
    const w = advW[wi % advW.length];
    advances.push({ id: 'a' + (i + 1), worker: w.id, date: D(-between(2, 30)), amount: amt, reason, recovered: i % 3 === 0 ? amt / 2 : 0, by: 'u8' });
  });
  const salaryRuns = [];
  // weekly payouts every Saturday for the past three weeks
  const sat = new Date(); sat.setHours(0, 0, 0, 0); while (sat.getDay() !== 6) sat.setDate(sat.getDate() - 1);
  for (let wk = 0; wk < 3; wk++) {
    const end = new Date(sat); end.setDate(end.getDate() - wk * 7);
    const start = new Date(end); start.setDate(start.getDate() - 6);
    const f = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    salaryRuns.push(wk === 0 ? { id: 'sr1', start: f(start), end: f(end), paidOn: null, status: 'Pending', paid: {}, by: 'u8' } : { id: 'sr' + (wk + 1), start: f(start), end: f(end), paidOn: f(end), status: 'Paid', by: 'u8' });
  }

  /* ---------- milestones ---------- */
  const milestones = []; let mn = 1;
  for (const p of projects) {
    const span = (new Date(p.end) - new Date(p.start)) / 864e5;
    const startOff = Math.round((new Date(p.start) - new Date(D(0))) / 864e5);
    p.stages.forEach((st, i) => {
      const due = D(startOff + Math.round(span * (i + 1) / p.stages.length));
      let status, pct, done = null;
      if (i < p.stage) { status = 'Completed'; pct = 100; done = D(startOff + Math.round(span * (i + 1) / p.stages.length) + between(-4, 9)); }
      else if (i === p.stage) { status = 'In progress'; pct = p.status === 'Completed' ? 100 : between(25, 75); if (p.status === 'Completed') { status = 'Completed'; done = p.completed; } }
      else { status = 'Not started'; pct = 0; }
      milestones.push({ id: 'm' + mn++, project: p.id, name: st, due, done, status, pct });
    });
  }

  /* ---------- delays ---------- */
  const delays = [
    { id: 'dl1', project: 'p3', date: D(-34), reason: 'Material shortage', days: 9, note: 'Cement supply disrupted due to lorry strike; brickwork paused for shops 7–14.', status: 'Resolved' },
    { id: 'dl2', project: 'p3', date: D(-8), reason: 'Weather', days: 4, note: 'Northeast monsoon showers – external works stopped.', status: 'Open' },
    { id: 'dl3', project: 'p2', date: D(-21), reason: 'Labour shortage', days: 6, note: 'Bar benders unavailable; second floor reinforcement behind plan.', status: 'Open' },
    { id: 'dl4', project: 'p2', date: D(-62), reason: 'Design change', days: 5, note: 'Client revised flat 304 layout; column C17 shifted.', status: 'Resolved' },
    { id: 'dl5', project: 'p7', date: D(-26), reason: 'Client decision pending', days: 26, note: 'Front elevation revision awaiting client sign-off. Work on hold.', status: 'Open' },
    { id: 'dl6', project: 'p1', date: D(-48), reason: 'Weather', days: 3, note: 'Heavy rain delayed first floor roof casting.', status: 'Resolved' },
    { id: 'dl7', project: 'p5', date: D(-15), reason: 'Approval pending', days: 2, note: 'Coastal regulation clearance copy needed before roof casting.', status: 'Resolved' },
  ];

  /* ---------- progress updates ---------- */
  const updates = [
    ['p1', -1, 'u4', 'First floor internal plastering crossed 70%. External plastering started on north elevation.', 72],
    ['p1', -6, 'u2', 'Ground floor plastering completed and handed for curing.', 69],
    ['p1', -15, 'u4', 'Brickwork completed for both floors. Plastering started.', 64],
    ['p2', -2, 'u5', 'Block A second floor column casting completed (C1–C13).', 38],
    ['p2', -9, 'u2', 'First floor slab of Block B cast – 64 m³ RMC.', 35],
    ['p2', -19, 'u5', 'Bar bender shortage – reinforcement crew reduced to 3.', 33],
    ['p3', -3, 'u4', 'Brickwork resumed after rain. Shops 5 and 6 walls completed.', 58],
    ['p3', -12, 'u3', 'Ground floor shop partitions complete; first floor partition started.', 55],
    ['p4', -2, 'u5', 'Footing PCC completed for F1–F8. Reinforcement cages under fabrication.', 12],
    ['p4', -14, 'u3', 'Site cleared and marked. Excavation started.', 6],
    ['p5', -4, 'u5', 'Roof shuttering 60% complete. Casting planned for this week.', 54],
    ['p5', -16, 'u2', 'Lintel level reached for all rooms.', 47],
    ['p6', -1, 'u4', 'Flooring done for consultation rooms; painting started in lounge.', 84],
    ['p6', -8, 'u3', 'False ceiling and electrical first fix completed.', 76],
    ['p7', -27, 'u2', 'Plinth beam casting completed. Work paused for elevation revision.', 21],
    ['p8', -90, 'u3', 'Project handed over to client. Handover certificate signed.', 100],
  ].map(([project, d, by, text, pct], i) => ({ id: 'up' + (i + 1), project, at: ts(d, 17, 30), by, text, pct }));

  /* ---------- enquiries ---------- */
  const E = (id, name, phone, source, city, type, plot, budget, req, status, owner, created, extra = {}) => ({ id, name, phone, email: extra.email || '', source, city, type, plot, budget, requirement: req, status, owner, created: D(created), followUps: extra.fu || [], quote: extra.quote || null, project: extra.project || null, lostReason: extra.lostReason || '' });
  const enquiries = [
    E('en1', 'Prakash Venkatesan', '+91 98421 55730', 'Walk-in', 'Mayiladuthurai', 'Independent house', '2,400 sq.ft plot', 55 * L, 'G+1 house, 3 BHK with car parking and terrace garden. Wants to start after Pongal.', 'New', 'u2', -1, { fu: [{ date: D(1), note: 'Call to schedule site visit', done: false, by: 'u2' }] }),
    E('en2', 'Mrs. Revathi Ganesh', '+91 94435 77812', 'Referral', 'Kuthalam', 'Independent house', '1,800 sq.ft plot', 38 * L, 'Single floor 2 BHK, Vastu compliant. Referred by Dr. Sundaram.', 'Contacted', 'u3', -5, { fu: [{ date: D(-3), note: 'Shared past project photos on WhatsApp', done: true, by: 'u3' }, { date: D(0), note: 'Follow up on site visit date', done: false, by: 'u3' }] }),
    E('en3', 'Al-Ameen Educational Trust', '+91 4364 280 115', 'Phone', 'Sirkazhi', 'School building', '1.2 acres', 380 * L, 'G+2 school block with 18 classrooms, labs and toilet blocks.', 'Site visit', 'u1', -12, { email: 'alameentrust@gmail.com', fu: [{ date: D(-7), note: 'Site visit done; soil looks good', done: true, by: 'u1' }, { date: D(2), note: 'Share preliminary layout and estimate', done: false, by: 'u2' }] }),
    E('en4', 'S. Mahendran', '+91 90036 41277', 'Website', 'Kumbakonam', 'Commercial complex', '4,000 sq.ft plot', 120 * L, 'Ground floor shops with first floor office space.', 'Quotation sent', 'u2', -20, { fu: [{ date: D(-10), note: 'Requirement meeting at office', done: true, by: 'u2' }, { date: D(-2), note: 'Quotation sent by email', done: true, by: 'u2' }, { date: D(3), note: 'Call to discuss quotation', done: false, by: 'u2' }], quote: { no: 'QT-2026-041', date: D(-2), amount: 124.5 * L, status: 'Sent', valid: D(28) } }),
    E('en5', 'Dr. Jayanthi Raman', '+91 94431 90225', 'Referral', 'Mayiladuthurai', 'Clinic renovation', '1,600 sq.ft', 24 * L, 'Clinic interior renovation with modular reception and 3 consultation rooms.', 'Negotiation', 'u3', -26, { fu: [{ date: D(-14), note: 'Site measurement done', done: true, by: 'u4' }, { date: D(-6), note: 'Quotation revised – reduced ceiling scope', done: true, by: 'u3' }, { date: D(-1), note: 'Client asked for 5% discount', done: false, by: 'u3' }], quote: { no: 'QT-2026-038', date: D(-6), amount: 26.8 * L, status: 'Revised', valid: D(24) } }),
    E('en6', 'Ramalingam & Sons', '+91 435 242 6620', 'Walk-in', 'Mayiladuthurai', 'Godown / warehouse', '6,000 sq.ft plot', 70 * L, 'Steel structure warehouse with office cabin.', 'Contacted', 'u2', -4, { fu: [{ date: D(-1), note: 'Discussed PEB vs RCC options', done: true, by: 'u2' }, { date: D(4), note: 'Arrange site visit with engineer', done: false, by: 'u2' }] }),
    E('en7', 'Lakshmi Priya', '+91 97878 33015', 'Website', 'Karaikal', 'Independent house', '1,500 sq.ft plot', 32 * L, 'Compact duplex, budget conscious.', 'New', 'u3', 0, {}),
    E('en8', 'Thiru. Sivaraman', '+91 98943 22704', 'Walk-in', 'Thiruvarur', 'Independent house', '3,000 sq.ft plot', 85 * L, 'Luxury villa with home theatre and lift provision.', 'Quotation sent', 'u1', -15, { fu: [{ date: D(-9), note: 'Visited Sundaram Residence site', done: true, by: 'u1' }, { date: D(-4), note: 'Quotation shared', done: true, by: 'u2' }, { date: D(-1), note: 'Follow up on quotation', done: false, by: 'u2' }], quote: { no: 'QT-2026-040', date: D(-4), amount: 88 * L, status: 'Sent', valid: D(26) } }),
    E('en9', 'Vel Murugan Textiles', '+91 435 242 7731', 'Referral', 'Mayiladuthurai', 'Commercial showroom', '5,200 sq.ft', 125 * L, 'G+1 showroom with glass façade.', 'Won', 'u2', -150, { quote: { no: 'QT-2026-019', date: D(-138), amount: 128 * L, status: 'Accepted', valid: D(-108) }, project: 'p7' }),
    E('en10', 'K. Balaji', '+91 98427 30914', 'Walk-in', 'Sirkazhi', 'Commercial complex', '9,600 sq.ft', 210 * L, '14 shop commercial complex on main road.', 'Won', 'u1', -270, { quote: { no: 'QT-2025-077', date: D(-262), amount: 215 * L, status: 'Accepted', valid: D(-232) }, project: 'p3' }),
    E('en11', 'Mohammed Ibrahim', '+91 90804 11526', 'Phone', 'Nagapattinam', 'Independent house', '2,000 sq.ft plot', 42 * L, 'G+1 house near beach, needs salt-resistant design.', 'Lost', 'u3', -45, { quote: { no: 'QT-2026-030', date: D(-35), amount: 46 * L, status: 'Declined', valid: D(-5) }, lostReason: 'Chose a local contractor with lower quote' }),
    E('en12', 'Sri Abirami Hospital', '+91 4364 279 300', 'Website', 'Sirkazhi', 'Hospital extension', '7,500 sq.ft', 260 * L, 'Additional ward block G+2 adjacent to existing hospital.', 'Site visit', 'u1', -9, { email: 'admin@abiramihospital.in', fu: [{ date: D(-2), note: 'Site visit with structural consultant', done: true, by: 'u1' }, { date: D(5), note: 'Present concept and budget estimate', done: false, by: 'u1' }] }),
    E('en13', 'Gowri Shankar', '+91 96559 08134', 'Walk-in', 'Mayiladuthurai', 'Renovation', '1,100 sq.ft', 9 * L, 'Kitchen and two bathrooms renovation.', 'Contacted', 'u3', -7, { fu: [{ date: D(-2), note: 'Missed call – client to call back', done: false, by: 'u3' }] }),
  ];

  /* ---------- activity ---------- */
  const activity = [
    { at: ts(0, 13, 20), by: 'u6', project: 'p1', kind: 'site', text: 'submitted the daily report for Sundaram Residence' },
    { at: ts(0, 13, 5), by: 'u5', project: 'p2', kind: 'site', text: 'submitted the daily report for Cauvery Heights Apartments' },
    { at: ts(-1, 18, 20), by: 'u4', project: 'p1', kind: 'progress', text: 'posted a progress update on Sundaram Residence (72%)' },
    { at: ts(-1, 16, 0), by: 'u8', project: 'p6', kind: 'payment', text: 'recorded a contractor payment to Arul Interiors' },
    { at: ts(-2, 11, 30), by: 'u2', project: null, kind: 'enquiry', text: 'sent quotation QT-2026-041 to S. Mahendran' },
  ];

  return extendSeed({ users, projects, workers, reports, floorLog, documents, billing, payments, expenses, contractorBills, advances, salaryRuns, milestones, delays, updates, enquiries, activity, seq: 500 });
}
