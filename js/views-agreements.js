/* Agreements: building contract agreements (கட்டிட ஒப்பந்தப் பத்திரம்) made from the company's Tamil agreement
   template (FINAL AGREMENT 07-03-2026). The template's wording, clauses and layout are fixed; everything that changes
   from one agreement to the next is a field: date, both parties, site, areas and rates, special works, every number,
   size, type, material and brand in the specification tables, the water tank, the payment schedule, and the
   standards, materials and amounts inside the terms (shown as boxes within the fixed wording). Extra terms can be
   added, and all terms put in any order by dragging; they are numbered in that order and the wording is unchanged.
   Workflow: Fill in → Terms & conditions → Verify → Download, with an optional live preview beside the form.
   - The live preview is closed by default. Opened, it lays the agreement out on A4 pages with the letterhead on every
     page and the same page breaks as the original, and follows every change as it is typed.
   - Verify checks the details (Aadhaar check digit, totals, payment schedule) and a person confirms them; only then
     can the agreement be finalized. A final agreement is read-only (the Owner can reopen it).
   - Download PDF draws each page with the browser's own text engine (html2canvas) into an A4 PDF (jsPDF), so Tamil
     letters, vowel signs and conjuncts come out exactly as in the preview. Print gives a text PDF via "Save as PDF".
   Agreements are kept in browser storage apart from the daily demo data, so the nightly reseed does not lose them. */
'use strict';

IC.grip = '<circle cx="9" cy="6" r="1.3"/><circle cx="15" cy="6" r="1.3"/><circle cx="9" cy="12" r="1.3"/><circle cx="15" cy="12" r="1.3"/><circle cx="9" cy="18" r="1.3"/><circle cx="15" cy="18" r="1.3"/>';
IC.contract = '<path d="M14 3H6.5A1.5 1.5 0 0 0 5 4.5v15A1.5 1.5 0 0 0 6.5 21h11a1.5 1.5 0 0 0 1.5-1.5V8z"/><path d="M14 3v5h5M8.5 9.5h4M8.5 13h7M8.5 17.5c1-1.3 1.8-1.3 2.4 0 .5 1.1 1.2 1.1 2.1-.2"/>';
MODULES.splice(MODULES.findIndex(m => m.id === 'invoices'), 0, { id: 'agreements', label: 'Agreements', icon: 'contract', group: 'Records' });
// agreements carry contract values, so they sit with the financial modules: hidden from roles without financial access
Object.assign(PERMS.owner, { agreements: 'edit' }); Object.assign(PERMS.pm, { agreements: 'edit' }); Object.assign(PERMS.accounts, { agreements: 'edit' }); Object.assign(PERMS.admin, { agreements: 'edit' });
['sysadmin', 'engineer', 'supervisor'].forEach(r => PERMS[r].agreements = 'none');
FIN_MODULES.push('agreements');

/* ================= template (source: FINAL AGREMENT 07-03-2026.pdf) ================= */
const AGR_MONTHS_TA = ['ஜனவரி', 'பிப்ரவரி', 'மார்ச்', 'ஏப்ரல்', 'மே', 'ஜூன்', 'ஜூலை', 'ஆகஸ்ட்', 'செப்டம்பர்', 'அக்டோபர்', 'நவம்பர்', 'டிசம்பர்'];
const AGR_RELS = ['S/O', 'D/O', 'W/O', 'C/O', 'த/பெ.', 'க/பெ.'];
// 1st party: the company's owner, as printed on every agreement
const AGR_CONTRACTOR = { title: 'திரு.', name: 'கௌதம்', aadhaar: '559526572831', rel: 'த/பெ.', father: 'ராஜசேகரன்', address: 'மயிலாடுதுறை மாவட்டம், ஸ்ரீராமஜெயபுரம், மூன்றாவது குறுக்கு தெரு, கதவு எண்.37' };
// terms & conditions — fixed wording; each {slot} is a standard, material or amount filled in from the form
const AGR_TERMS = [
  'அனைத்து பொருட்களும் {std} தர சான்றுடன் இருக்க வேண்டும்.',
  'ஒவ்வொரு கட்டணமும் Release செய்வதற்கு முன் உரிமையாளர் வேலை சரிபார்க்க உரிமை உண்டு.',
  'ஒவ்வொரு கட்டணமும் குறிப்பிட்ட stage முடிந்தவுடன் அடுத்த stage வேலை செய்வதற்கு முன்பே வழங்கப்பட வேண்டும்.',
  'வேலை தொடங்கிய முதல் நாள் முதல் இருதி நாள் வரை அந்தந்த stage - ற்கான முன்பணம் பெற்றே வேலை செய்யப்படும்.',
  'திறமையான (Skilled) தொழிலாளர்களை போதுமான அளவில் வழங்க வேண்டும்.',
  'இந்த ஒப்பந்தத்தில் சேராத புதிய வேலைகள் உரிமையாளர் செய்து கொடுக்கும் படி கேட்டாள் அதற்கு தேவையான தொகையை இருவரும் சேர்ந்து முடிவு செய்து பணம் கொடுத்த பின்னரே கூடுதல் வேலையானது தொடங்கப்படும்.',
  'மழை, மின் தடை, பொருள் தாமதம் போன்ற காரணங்களுக்காக ஒப்பந்ததாரர் பொறுப்பல்ல.',
  'வரைபடம் அல்லது வடிவமைப்பு மாற்றப்பட்டால், அதற்கேற்ப ஒப்பந்த தொகை மற்றும் காலம் மறுமதிப்பீடு செய்யப்படும்.',
  'பண்டிகை காலங்கள் மற்றும் ஞாயிற்று கிழமைகள் கட்டிட வேலைக்கு விடுமுறை அளிக்கப்படும். தேவைப்பட்டால் விடுமுறை நாட்களில் வேலை செய்வது ஒப்பந்தகாரரின் சொந்த முடிவாகும்.',
  'ரூம் கதவுகள் {doorMat} கதவுகளாக பொருத்தி தரும் பட்சட்ச்சில் வீடு உரிமையாளர் ரூபாய் {doorAmt}/- கொடுத்து ஒப்பந்தக்காரர் வைத்து பொருத்தி கொள்ள வேண்டும் .',
  'உள்ள படிக்கட்டு மற்றும் வெளி படிக்கட்டு {railMat} கைப்பிடி டிசைன் வரையறுக்கப்பட்ட தொகையயை விட கூடுதலாக ஆகும் என்றால் இருவரும் கலந்து அதற்கான தொகையை வீடு உரிமையாளர் தரவேண்டும்.',
  'footing & basement இடங்களில் {wp} உரிமையாளர் வாங்கி கொடுக்கும்பச்சத்தில் அப்ளை செய்து தரப்படும்.',
  '{kitchenWork} interior வேலை approximate மதிப்பு ரூபாய் {kitchenAmt}/-',
];
// slot: [form label, template value, kind] — kind 1 prints as an Indian-format amount, 2 as a plain number
const AGR_TERM_SLOTS = { std: ['Quality certification (term 1)', 'ISI/ISO'], doorMat: ['Room door material (term 10)', 'ஸ்டீல்'], doorAmt: ['Room door charge, ₹ (term 10)', 20000, 1],
  railMat: ['Staircase handrail material (term 11)', 'ஸ்டீல்'], wp: ['Waterproofing material (term 12)', 'வாட்டர் proof'], kitchenWork: ['Kitchen work (term 13)', 'மாடுலர் கிட்சேன்'], kitchenAmt: ['Kitchen estimate, ₹ (term 13)', 70000, 1] };
const AGR_TANK_TPL = 'water tank: {count} {mat} {cap}ltr water tank will provide for this project.';
const AGR_TANK_SLOTS = { count: ['Number of tanks', 'one'], mat: ['Tank material', 'pvc'], cap: ['Capacity (litres)', 750, 2] };
const agrSlotDefaults = S => Object.fromEntries(Object.entries(S).map(([k, [, v]]) => [k, v]));
// floors: [English name as printed on pages 2–3, Tamil name for page 1, and the template's second Tamil mention where it differs]
const AGR_FLOORS = [['Ground floor', 'தரைத்தளம்', 'தரை தளம்'], ['First floor', 'முதல் தளம்'], ['Second floor', 'இரண்டாம் தளம்'], ['Third floor', 'மூன்றாம் தளம்'], ['Fourth floor', 'நான்காம் தளம்'], ['Fifth floor', 'ஐந்தாம் தளம்']];
const agrFloorDef = i => { const [en, ta, ta2] = AGR_FLOORS[i] || [`Floor ${i + 1}`, `${i + 1}-வது தளம்`]; return ta2 ? { en, ta, ta2 } : { en, ta }; };
const AGR_SPECIAL_TA = 'basement கூடுதலாக இரண்டு ஆதி ஊர்த்துதல் ,செப்டிக் TANK ,படிக்கட்டு கிரானைட் ,உள்ள படிக்கட்டு கைப்பிடி மற்றும்  முதல் மாடி ஸ்டீல் படிக்கட்டு';
const AGR_SPECIAL = [['Basement rising 5’(3’+2’) from ground level', 350000], ['Septic tank for  7’x7’x 8’(depth)', 0], ['staircase granite', 40000], ['staircase handrail in MS(approximately)', 25000], ['external MS staircase(approximately)', 20000]];
const AGR_STAGES = [['stage-1', 'advance to basement finishing +septic tank', 1150000], ['stage-2', 'after basement to lintel level', 400000], ['stage-3', 'after lintel to roof finishing', 600000],
  ['stage-4', 'after ground floor roof to first floor lintel level', 250000], ['stage-5', 'first floor lintel to first floor roof finishing', 400000], ['stage-6', 'wood work & inner plastering', 400000],
  ['stage-7', 'plumbing & outer plastering', 400000], ['stage-8', 'painting & electrical work', 400000], ['stage-9', 'tile work & finishing work', 314920]];
// rows: { c: [cells], s: '' | 'r' (red) | 'rb' (red, bold) | 'peach' (shaded cell) }; **text** prints bold
const agrRow = (s, ...c) => ({ c, s });
const AGR_ROWS = {
  progress: [agrRow('', 'Excavation.'), agrRow('', 'Pest control'), agrRow('', 'RCC footing.'), agrRow('r', 'Basement height: 3’ from the existing ground level ( extra 2 ’ basement rising charge comes under client side.)'),
    agrRow('', 'Plinth beam as per structural design.'), agrRow('', 'Red Gravel will use for filling'), agrRow('rb', 'Basement level beam at 5 feet.'), agrRow('rb', 'RCC floor mat concrete using 6mm steel rod.'),
    agrRow('', 'RCC framed structure.'), agrRow('', 'Lintel beam at 7’ height'), agrRow('', 'Roof height **10’** from floor level of building.'), agrRow('', 'Brick wall 9” thickness (chamber brick).'),
    agrRow('rb', 'Rcc roof 5” thickness as per plan'), agrRow('', 'Stair case for ground floor  as per dimension of plan.'), agrRow('', 'Sun side for each window.'), agrRow('', 'Electrical and plumbing comes under this estimation.'),
    agrRow('', 'for exterior one coat white wash & primer only.'), agrRow('rb', 'Two coat Putty , primer and painting for interior.'), agrRow('rb', 'primer and 2 coat painting for elevation.'),
    agrRow('rb', 'Staircase will finish with granite.'), agrRow('', 'Parapet wall 4.5”.')],
  spec: [agrRow('', 'FOOTING', '4’X4’( dimension)'), agrRow('', 'MAT BARS', '10mm rod'), agrRow('', 'Plinth beam', '1’3” x9” (dimension) 16mm and 12mm rod.'), agrRow('', 'Basement height', '3’+2’=5’ from ground level'),
    agrRow('rb', 'Basement level beam', '9”x9” as per structural design.'), agrRow('rb', 'RCC flooring', '6mm rod with 1’ spacing (6mm rod using)'),
    agrRow('', 'Column size', '9”x 9” and 9”x12”(dimension)16mm and 12mm rod (as per structural design)'), agrRow('', 'Brick', 'Chamber brick mortar ratio 1:6 for 9” wall, 1:5 for 4.5” wall.'),
    agrRow('', 'Concrete mix ratio', '1: 2: 4'), agrRow('', 'Lintel beam', '7’from the ffl 6”x9”(dimension)12mm & 10mm rod (as per structural design)'), agrRow('', 'Roof slab', '5” thickness 10mm & 8mm rod.'),
    agrRow('', 'Roof height', '10’ height from floor level'), agrRow('rb', 'Parapet wall', '4.5” wall and 3’ height'), agrRow('', 'Sun side', '2’ from wall'),
    agrRow('', 'Loft', '1 Rcc loft for bed rooms and kitchen, RCC kitchen top with wall tiles.'), agrRow('', 'Plastering', 'Outer plastering 1:5, Inner plastering 1:5')],
  doors: [agrRow('', 'ground floor-main door', '5"x4"', '3\'6"x7\'', '1 no.s', 'teak frame', 'teak door'), agrRow('', 'ground floor-back door', '4"x3"', '3\' x 7\'', '1 no.s', 'Steel door', 'Steel door'),
    agrRow('', 'ground floor bed room-1 door', '4"x3"', '3\' x 7\'', '1 no.s', 'teak frame', 'ready made door'), agrRow('', '', '', '', '', '', ''),
    agrRow('', 'first floor bed room-2 door', '4"x3"', '3\' x 7\'', '1 no.s', 'teak frame', 'ready made door'), agrRow('', 'first floor bed room-2 door', '4"x3"', '3\' x 7\'', '1 no.s', 'teak frame', 'ready made door'),
    agrRow('', 'first floor passage door', '4"x3"', '3\' x 7\'', '1 no.s', 'Steel door', 'Steel door')],
  windows: [agrRow('', 'ground floor hall', '4"x3"', '4\'x4\'', '1 no.s', 'Open type', 'upvc'), agrRow('', 'dining hall', '4"x3"', '4\'x4\'', '1 no.s', 'Open type', 'upvc'), agrRow('', 'kitchen', '4"x3"', '4\'x3\'', '1 no.s', 'Open type', 'upvc'),
    agrRow('', 'ground floor bed room-1 door', '4"x3"', '4\'x4\'', '1 no.s', 'Open type', 'upvc'), agrRow('', '', '', '', '', '', ''), agrRow('', 'ventilator for toilet & pooja room', '4"x3"', '2\'x2\'', '3 no.s', 'louver type', 'upvc'),
    agrRow('', 'staircase window', '4"x3"', '2\'x6\'', '1 no.s', 'fixed window', 'upvc'), agrRow('', '', '', '', '', '', ''), agrRow('', 'first floor bed room-2 door', '4"x3"', '4\'x4\'', '1 no.s', 'Open type', 'upvc'),
    agrRow('', 'first floor bed room-3 door', '4"x3"', '4\'x4\'', '1 no.s', 'Open type', 'upvc'), agrRow('', 'ventilator for toilet in first floor', '4"x3"', '2\'x2\'', '2 no.s', 'louver type', 'upvc')],
  extras: [agrRow('', 'WINDOW GRILL', '12MM thickness'), agrRow('', 'TOILET DOORS', 'pvc door 2500rs only'), agrRow('', 'WINDOW GLASS', '40rs/sq.ft glass only')],
  elec: [agrRow('', 'roof & wall pipes', 'isi standard pipes'), agrRow('', 'wire', 'kundan wires'), agrRow('', 'switches', 'legrand alzy varient only white colour'), agrRow('', 'DB', 'kundan db (1 DB ONLY)'),
    agrRow('', 'ac points', '1 ac point per bed room only'), agrRow('', 'heater point', 'heater point for 3 attached bathrooms only'), agrRow('', 'tv point', 'one tv only in hall'),
    agrRow('', 'cctv camera line', 'pipe  line will provide (wire not included)'), agrRow('', 'wifi line', 'pipe  line will provide (wire not included)'), agrRow('', 'invertor wiring', 'invertor wiring will done'),
    agrRow('', 'tube lights', 'tube lights only provide for this project'), agrRow('', 'fan points', 'fan points only provide (fan client scope)')],
  plumbing: [agrRow('', 'western closet', '8000rs only', '3 no.s only', 'parryware'), agrRow('', 'indian toilet', '1500rs worth', '1 no.s  only', 'isi brand'), agrRow('', 'wash basin', '1000rs worth', '5 no.s only', 'sonet'),
    agrRow('', 'hot & cold water tap', '500rs worth', '6 no.s  only', 'parryware'), agrRow('', 'shower', '1000rs worth', '1 no.s  only', 'isi brand'), agrRow('', 'common toilet tap', '500rs worth', '1 no.s  only', 'parryware'),
    agrRow('', 'angle cork', '300rs worth', '', 'isi brand'), agrRow('', 'wash basin tap', '300rs worth', '5 no.s only', 'isi brand'), agrRow('', 'sink tap', '1000rs worth', '1 no.s only', 'parryware')],
  tile: [agrRow('', 'for floors', '45rs/sq.ft worth tiles'), agrRow('', 'for bathroom & kitchen wall', '35rs/sq.ft worth tiles'), agrRow('', 'bathroom wall tile till 7 feet only'), agrRow('', 'Staircase steps finish with granite'),
    agrRow('', 'kitchen top', 'finished with granite with nosing finish.')],
  paint: [agrRow('', 'inner walls', '2coat putty,1coat primer,2coat colour', 'asian'), agrRow('', 'outer walls', '1 coat white wash ,1 coat primer', 'asian'),
    agrRow('peach', 'elevation', '1 coat primer & 2 coat colour no putty for elevation.', 'asian'), agrRow('', 'main door', 'polish work for main door only', 'asian')],
  excl: ['eb service conections, bore well,plan approval', 'current bill,house tax', 'weathering course in terrace floors', 'compound wall, saftey grill', 'vaccant area sand filling',
    'spot lights,elevation lights , fans & invertor', 'false celling, interior works(modular,shelvs doors)', 'rcc over headed tank', 'extra basement rising appart from aggrement', 'front elevation hand rail',
    'elevation tiles apart 50sq.ft', 'any interior wall tiles', 'water proof bituplast', 'modualr kitchen & any interior works(ex:shelvs doors,false celling)', 'roof sheet work for balcony'].map(t => agrRow('', t, 'client scope')),
  mat: [agrRow('', 'cement', 'dalmia/chettinad', 'ppc'), agrRow('', 'steel', 'amman/kauvery', 'tmt'), agrRow('', 'wood', 'teak wood', '2300/cu.feet'), agrRow('', 'room doors', 'ready made doors', '3000rs worth'),
    agrRow('', 'electricals', 'kundan', 'standard'), agrRow('', 'plumbig', 'finolex,parry ware', 'standard'), agrRow('', 'sand', 'msand,psand only', 'no river sand'), agrRow('', 'paint', 'asian paint', 'standard'), agrRow('', 'tiles', '45rs/sq.ft tiles', 'standard')],
};
/* each table: form label, column headings, and how the original prints it — column widths (%) across the text width,
   cell / heading alignment ('c' = centred) and the table's own class (row heights, fonts) */
const AGR_TBL = {
  progress: { label: 'Work progress', sub: 'Work progress for Ground floor & first floor construction', head: ['Item'], styles: true },
  spec: { label: 'Specification of work', sub: 'Dimension of frame work and bar detail', head: ['Item', 'Specification'], styles: true },
  doors: { label: 'Doors', sub: 'Doors details of both floors based on project plan', head: ['BOTH FLOOR DOORS DETAILS', 'frame thicknes', 'size', 'no.s', 'frame type', 'material'], cols: [31.5, 16.5, 10.6, 10.9, 11.9, 18.6], ca: ['c'], ha: ['c'] },
  windows: { label: 'Windows', sub: 'Window details of both floors based on project plan', head: ['BOTH FLOOR WINDOW DETAILS', 'frame thicknes', 'size', 'no.s', 'door type', 'material'], cols: [31.8, 15.6, 10.1, 10, 14.7, 17.8], ca: ['c'], ha: ['c'] },
  extras: { label: 'Window grill, toilet doors & glass', head: ['Item', 'Specification'], cols: [60, 40], ca: ['c'], noHead: true, cls: 't-extras' },
  elec: { label: 'Electricals', head: ['ELECTRICALS DETAILS', 'DETAILS'], cols: [37.5, 62.5], ha: ['', 'c'], cls: 't-elec' },
  plumbing: { label: 'Plumbing', head: ['FITTINGS FOR ONE TOILET', 'cost', 'no.s', 'brand'], cols: [37.7, 24.8, 17.7, 19.8], ca: ['c'], ha: ['c'], cls: 't-plumb' },
  tile: { label: 'Tile', head: ['tile work', 'cost'], cols: [37.6, 62.4], ca: ['', 'c'], ha: ['c', 'c'], cls: 't-tile' },
  paint: { label: 'Painting', head: ['painting works', 'specifications', 'brand'], cols: [32, 53.2, 14.8], ca: ['c', 'c'], ha: ['', 'c'], cls: 't-paint' },
  excl: { label: 'Work not included (client scope)', sub: 'Work not comes under this estimation', head: ['work not comes under contractor side', 'scope'], cols: [81.8, 18.2], cls: 't-excl' },
  mat: { label: 'Materials used', sub: 'Materials used for this project', head: ['MATERAILS USED FOR THIS PROJECT', 'BRAND', 'specifications'], cols: [54.2, 25.8, 20], cls: 't-mat' },
};
const agrClone = o => JSON.parse(JSON.stringify(o));

/* ================= storage ================= */
const AGR_KEY = KEY + '-agreements';
let AGRS = (() => { try { const v = JSON.parse(store.get(AGR_KEY) || 'null'); return Array.isArray(v) ? v : null; } catch { return null; } })();
store.del(KEY + '-agr-seal'); // the company seal was taken out of agreements; drop any seal image saved for it
let agrSaveT = 0;
const saveAgrs = () => { clearTimeout(agrSaveT); store.set(AGR_KEY, JSON.stringify(AGRS)); };
const saveAgrsSoon = () => { clearTimeout(agrSaveT); agrSaveT = setTimeout(saveAgrs, 400); };
addEventListener('pagehide', () => { if (agrSaveT) saveAgrs(); });

function agrBlank() {
  return { id: 'ag' + Date.now().toString(36), ref: '', status: 'Draft', project: '', date: TODAY,
    c: { ...AGR_CONTRACTOR }, o: { name: '', aadhaar: '', rel: 'S/O', father: '', place: '' }, site: '',
    floors: [{ ...agrFloorDef(0), area: '', rate: 2500 }, { ...agrFloorDef(1), area: '', rate: 2330 }],
    special: AGR_SPECIAL.map(([d]) => ({ d, amt: '' })), specialTa: AGR_SPECIAL_TA,
    stages: AGR_STAGES.map(([n, d]) => ({ n, d, amt: '' })), terms: agrSlotDefaults(AGR_TERM_SLOTS),
    tables: agrClone(AGR_ROWS), tank: agrSlotDefaults(AGR_TANK_SLOTS), customTerms: [], termOrder: AGR_TERMS.map((_, n) => 't' + n),
    createdAt: Date.now(), createdBy: SESSION, updatedAt: Date.now(), updatedBy: SESSION };
}
// the signed agreement of 01.03.2026, so the template can be compared page by page with the original
function agrSample() {
  const a = agrBlank(), at = tsOn('2026-03-01', 11);
  return Object.assign(a, { id: 'ag1', ref: 'SSB/AGR/25-26/001', status: 'Final', date: '2026-03-01',
    o: { name: 'மணிவண்ணன்', aadhaar: '337299800998', rel: 'S/O', father: 'சுப்ரமணியன்', place: 'மயிலாடுதுறை மாவட்டம் , சீர்காழி வைத்தீஸ்வரன் கோவிலல் அட்டகுளம்' },
    site: 'கதவு என் -17, ST-4 அட்டகுளம் ,சட்டநாதபுரம் போஸ்ட் ,சீர்காழி தாலுகா pin:609109',
    floors: [{ ...agrFloorDef(0), area: 1017, rate: 2500 }, { ...agrFloorDef(1), area: 574, rate: 2330 }],
    special: AGR_SPECIAL.map(([d, amt]) => ({ d, amt })), stages: AGR_STAGES.map(([n, d, amt]) => ({ n, d, amt })),
    createdAt: at, createdBy: 'u1', updatedAt: at, updatedBy: 'u1', finalAt: at, finalBy: 'u1' });
}
const agrTermId = () => Math.random().toString(36).slice(2, 9);
// agreements saved before the terms, the water tank, added terms, the term order and the floor list had their own fields
function agrUpgrade(a) {
  if (!a.terms) { a.terms = agrSlotDefaults(AGR_TERM_SLOTS); if (a.steelDoor !== undefined) a.terms.doorAmt = a.steelDoor; if (a.kitchen !== undefined) a.terms.kitchenAmt = a.kitchen; }
  if (!a.tank) { const m = /^water tank:\s*(\S+)\s+(\S+)\s+(\d+)\s*ltr/i.exec(a.waterTank || ''); a.tank = m ? { count: m[1], mat: m[2], cap: +m[3] } : agrSlotDefaults(AGR_TANK_SLOTS); }
  a.customTerms ||= [];
  a.customTerms.forEach(t => { t.id ||= agrTermId(); });
  if (!a.termOrder) { // added terms used to be placed with "after template term n"
    const out = [], place = n => a.customTerms.forEach(t => { if (Math.min(AGR_TERMS.length, Math.max(0, +t.after || 0)) === n) out.push('c' + t.id); });
    place(0); AGR_TERMS.forEach((_, n) => { out.push('t' + n); place(n + 1); }); a.termOrder = out;
  }
  a.customTerms.forEach(t => delete t.after);
  if (!a.floors) a.floors = [{ ...agrFloorDef(0), area: a.gf?.area ?? '', rate: a.gf?.rate ?? 2500 }, { ...agrFloorDef(1), area: a.ff?.area ?? '', rate: a.ff?.rate ?? 2330 }];
  delete a.gf; delete a.ff;
  delete a.steelDoor; delete a.kitchen; delete a.waterTank;
  return a;
}
if (!AGRS) { AGRS = [agrSample()]; saveAgrs(); }
AGRS.forEach(agrUpgrade);
function agrRef(date) {
  const fy = fyOf(date || TODAY), pre = `SSB/AGR/${fy}/`;
  const n = Math.max(0, ...AGRS.filter(a => a.ref?.startsWith(pre)).map(a => +a.ref.slice(pre.length) || 0)) + 1;
  return pre + String(n).padStart(3, '0');
}
const agrById = id => AGRS.find(a => a.id === id);
const agrEditable = a => !!a && a.status !== 'Final' && can('agreements');
function agrTouch(a) { a.updatedAt = Date.now(); a.updatedBy = SESSION; saveAgrsSoon(); }
const agrGet = (o, p) => p.split('.').reduce((x, k) => x?.[k], o);
const agrSet = (o, p, v) => { const ks = p.split('.'), last = ks.pop(); const t = ks.reduce((x, k) => x?.[k], o); if (t) t[last] = v; };

/* ================= amounts ================= */
const agrN = v => +String(v ?? '').replace(/[^\d.]/g, '') || 0;
const agrRs = n => Math.round(n || 0).toLocaleString('en-IN');
const agrBlankNum = v => v === '' || v == null;
function agrCalc(a) {
  const floors = a.floors.map(f => Math.round(agrN(f.area) * agrN(f.rate))), fl = sum(floors);
  const sp = sum(a.special, s => agrN(s.amt)), total = fl + sp, sched = sum(a.stages, s => agrN(s.amt));
  return { floors, fl, sp, total, sched, diff: total - sched };
}
// Indian numbering in words, as the template writes the total: FORTY THREE LAKHS FOURTEEN THOUSAND …
function agrWords(n) {
  n = Math.round(n || 0); if (!n) return 'ZERO';
  const a = ['', 'ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN', 'EIGHT', 'NINE', 'TEN', 'ELEVEN', 'TWELVE', 'THIRTEEN', 'FOURTEEN', 'FIFTEEN', 'SIXTEEN', 'SEVENTEEN', 'EIGHTEEN', 'NINETEEN'];
  const t = ['', '', 'TWENTY', 'THIRTY', 'FORTY', 'FIFTY', 'SIXTY', 'SEVENTY', 'EIGHTY', 'NINETY'];
  const two = x => x < 20 ? a[x] : t[Math.floor(x / 10)] + (x % 10 ? ' ' + a[x % 10] : '');
  const three = x => [x >= 100 ? a[Math.floor(x / 100)] + ' HUNDRED' : '', x % 100 ? two(x % 100) : ''].filter(Boolean).join(' ');
  const cr = Math.floor(n / 1e7), lk = Math.floor(n / 1e5) % 100, th = Math.floor(n / 1e3) % 100, rest = n % 1000;
  return [cr && `${three(cr)} ${cr > 1 ? 'CRORES' : 'CRORE'}`, lk && `${two(lk)} ${lk > 1 ? 'LAKHS' : 'LAKH'}`, th && `${two(th)} THOUSAND`, rest && three(rest)].filter(Boolean).join(' ');
}
const agrDateParts = s => { if (!s) return null; const d = parseD(s); return { Y: d.getFullYear(), M: AGR_MONTHS_TA[d.getMonth()], DD: pad(d.getDate()), MM: pad(d.getMonth() + 1) }; };

/* ================= document ================= */
// a filled-in value: linked to its form field so the preview can highlight it; empty values show the field name
const agrF = (path, v, ph = '') => { const e = v === '' || v == null; return `<span class="agr-v${e ? ' empty' : ''}" data-f="${esc(path)}">${e ? esc(ph ? `[${ph}]` : '[ ]') : esc(v)}</span>`; };
const agrFh = (path, html) => `<span class="agr-v" data-f="${esc(path)}">${html}</span>`;
const agrFlName = (f, i, lower = i > 0) => { const n = String(f.en ?? '').trim(); return lower ? n.toLowerCase() : n; };
const agrFlList = a => { const n = a.floors.map((f, i) => agrFlName(f, i)).filter(Boolean); return n.length > 1 ? `${n.slice(0, -1).join(', ')} & ${n[n.length - 1]}` : n[0] || ''; };
const agrTxt = v => esc(v).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
const agrHead = () => `<header class="agr-head"><img src="${AGR_LOGO}" alt=""><div class="agr-co"><b>SCALE SPACE BUILDERS</b><span>Big Kannar Street, Mayiladuthurai</span><span>Nagapattinam (DT)-609 001</span></div></header>`;
/* the terms in print order. termOrder lists keys — 't0'…'t12' for the template's terms, 'c<id>' for added ones — in the
   order chosen by dragging; any key it lacks goes at the end, so every term is always printed once */
function agrTermKeys(a) {
  const all = [...AGR_TERMS.map((_, n) => 't' + n), ...(a.customTerms || []).map(c => 'c' + c.id)], seen = new Set(), out = [];
  (a.termOrder || []).forEach(k => { if (all.includes(k) && !seen.has(k)) { seen.add(k); out.push(k); } });
  all.forEach(k => { if (!seen.has(k)) out.push(k); });
  return out;
}
function agrTermList(a) {
  const C = a.customTerms || [];
  return agrTermKeys(a).map(key => { if (key[0] === 't') return { key, custom: false, n: +key.slice(1), t: AGR_TERMS[+key.slice(1)] };
    const i = C.findIndex(c => 'c' + c.id === key); return { key, custom: true, i, t: C[i] }; });
}
// true when the template's own terms are no longer in their original order (added terms may sit anywhere)
const agrTplMoved = a => { const n = agrTermKeys(a).filter(k => k[0] === 't').map(k => +k.slice(1)); return n.some((x, i) => x !== i); };
const agrCustomHtml = (i, text) => String(text ?? '').trim() ? agrFh(`customTerms.${i}.text`, esc(String(text).trim()).replace(/\n/g, '<br>')) : agrF(`customTerms.${i}.text`, '', 'புதிய நிபந்தனை');
const agrPage = (inner, cls = '') => `<section class="agr-page ${cls}">${agrHead()}<div class="agr-body">${inner}</div></section>`;
function agrSign(a) {
  return `<div class="agr-sign">
    <div class="agr-party"><div class="sp"></div><div class="ln"></div><div class="lb">1-வது பார்ட்டி</div><div class="nm">${agrF('c.name', a.c.name ? a.c.title + a.c.name : '', 'பெயர்')}</div></div>
    <div class="agr-party r"><div class="sp"></div><div class="ln"></div><div class="lb">2-வது பார்ட்டி</div><div class="nm">${agrF('o.name', a.o.name, 'உரிமையாளர் பெயர்')}</div></div></div>`;
}
function agrPage1(a, c) {
  const d = agrDateParts(a.date), D = (v, ph) => agrF('date', d ? v : '', ph), o = a.o, k = a.c;
  const aad = (p, v) => agrF(p, digits(v) ? fmtAadhaar(v) : '', 'ஆதார் எண்');
  const amt = (p, n, has) => agrFh(p, has ? agrRs(n) : '<span class="empty">[ ]</span>');
  const floorsTa = a.floors.map((f, i) => `${agrF(`floors.${i}.ta`, f.ta, 'தளம்')} ${agrF(`floors.${i}.area`, f.area, 'சதுரடி')}சதுரடி மேலும் ஒரு சதுரடிக்கு ருபாய் ${agrF(`floors.${i}.rate`, f.rate, 'விகிதம்')} விகிதம் ${agrF(`floors.${i}.ta`, f.ta2 || f.ta, 'தளம்')} கட்டித்தருவதற்கு <b>ருபாய் ${amt(`floors.${i}.area floors.${i}.rate`, c.floors[i], !agrBlankNum(f.area))}/-</b>`).join(' மற்றும் ');
  const intro = `${D(d?.Y, 'ஆண்டு')} ஆம் ஆண்டு ${D(d?.M, 'மாதம்')} மாதம் ${D(d?.DD, 'தேதி')} ஆம் தேதி (${D(d && `${d.DD}.${d.MM}.${d.Y}`, 'தேதி')}) ${agrF('c.address', k.address, 'முகவரி')}-ல் வசிக்கும் Scale Space Builder’s நிறுவனத்தின் உரிமையாளர் ${agrF('c.name', k.name ? k.title + k.name : '', 'பெயர்')} (ஆதார் எண். ${aad('c.aadhaar', k.aadhaar)}) ${agrF('c.rel', k.rel)} ${agrF('c.father', k.father, 'தந்தை பெயர்')} ஒப்பந்தக்காரர் 1-வது பார்ட்டி ஆவார் ${agrF('o.place', o.place, 'ஊர்')} என்ற ஊரில் வசிக்கும் ${agrF('o.name', o.name, 'உரிமையாளர் பெயர்')}(ஆதார் என் ${aad('o.aadhaar', o.aadhaar)}) ${agrF('o.rel', o.rel)} ${agrF('o.father', o.father, 'தந்தை பெயர்')} என்பவர் கட்டிடத்தின் உரிமையாளர் 2-வது பார்ட்டி ஆவார் மற்றும் அவருக்கு சொந்தமான ${agrF('site', a.site, 'கட்டிட முகவரி')} என்ற முகவரியில் உள்ள இடத்தில ${floorsTa} மேலும் தனி சிறப்பு வேளைகளான ${agrF('specialTa', a.specialTa, 'சிறப்பு வேலைகள்')} அனைத்தும் சேர்த்து மொத்தம் <b>${amt('special', c.sp, true)}/- ருபாய்</b> அடங்கிய கட்டிடம் கட்டித்தருவதற்கான ஒப்பந்த பாத்திரம்.`;
  return `<div class="agr-p1"><div class="agr-p1-space"></div><h1 class="agr-title">கட்டிட ஒப்பந்தப் பத்திரம்</h1><p class="agr-intro">${intro}</p>${agrSign(a)}</div>`;
}
// blocks that flow over pages 2 onwards; page: starts a new page (as in the original), kwn: keep with the next block
function agrBlocks(a, c) {
  const B = [], T = a.tables;
  const H = (html, o = {}) => B.push({ html, ...o });
  const cell = (k, i, j, v) => v === '' ? '' : `<span class="agr-v" data-f="tables.${k}.${i}.c.${j}">${agrTxt(v)}</span>`;
  const TB = (k, o = {}) => B.push({ table: { k, ...AGR_TBL[k], rows: T[k].map((r, i) => ({ cls: r.s ? 's-' + r.s : '', span: r.c.length === 1 && AGR_TBL[k].head.length > 1, cells: r.c.map((v, j) => cell(k, i, j, v)) })) }, ...o });
  const rsF = (p, v) => agrBlankNum(v) ? agrF(p, '', 'amount') : agrFh(p, agrRs(agrN(v)));
  const slots = (tpl, base, S) => esc(tpl).replace(/\{(\w+)\}/g, (_, k) => { const [ph, , kind] = S[k], v = a[base][k]; return kind === 1 ? rsF(`${base}.${k}`, v) : agrF(`${base}.${k}`, agrBlankNum(v) ? '' : String(v), ph); });
  // area and cost
  H('<h2 class="agr-area-h">AREA DETAILS OF PROJECT:</h2>', { page: true, kwn: true });
  a.floors.forEach((f, i) => H(`<p class="agr-area"><span class="k">${agrF(`floors.${i}.en`, agrFlName(f, i, false).toUpperCase(), 'FLOOR')}</span>: ${agrF(`floors.${i}.area`, f.area, 'sq.ft')}&nbsp; sq.ft</p>`));
  H('<p class="agr-l agr-bu">WORKING COST AND WORKING CONDITIONS:</p>', { kwn: true });
  a.floors.forEach((f, i) => H(`<p class="agr-l"><u>${agrF(`floors.${i}.en`, agrFlName(f, i), 'floor')} will be execute for <b>Rs.${agrF(`floors.${i}.rate`, f.rate, 'rate')}per sq.ft</b></u></p>`));
  a.floors.forEach((f, i) => H(`<p class="agr-l"><span class="agr-calc"><span>${agrF(`floors.${i}.en`, agrFlName(f, i, true), 'floor')}</span><span>${agrF(`floors.${i}.area`, f.area, 'sq.ft')} sq.ft x Rs.${agrF(`floors.${i}.rate`, f.rate, 'rate')}</span><span>= Rs. ${agrFh(`floors.${i}.area floors.${i}.rate`, agrRs(c.floors[i]))}/-</span></span></p>`));
  H('<p class="agr-l agr-bu red">Special work requirement:</p>', { kwn: true });
  a.special.forEach((s, i) => H(`<p class="agr-sp"><span class="agr-calc"><span>${i + 1})</span><span>${agrF(`special.${i}.d`, s.d, 'description')}</span><span>= Rs.${rsF(`special.${i}.amt`, s.amt)}/-</span></span></p>`));
  H(`<p class="agr-sp tot"><span class="agr-calc"><span>TOTAL ESTIMATION OF PROJECT:</span><span>= Rs. ${agrFh('total', agrRs(c.total))}/-</span></span></p>`);
  H(`<p class="agr-words">IN WORDS ${agrFh('total', agrWords(c.total))} RUPEES ONLY</p>`);
  // work progress and specification
  H(`<p class="agr-dbl agr-bu">Work progress for ${esc(agrFlList(a))} construction.</p>`, { page: true, kwn: true });
  T.progress.forEach((r, i) => H(`<p class="agr-dbl ${r.s ? 's-' + r.s : ''}"><u>${cell('progress', i, 0, r.c[0])}</u></p>`));
  H('<p class="agr-dbl agr-bu">SPECIFICATION OF WORK</p>', { kwn: true });
  H('<p class="agr-dbl">DIMENSION OF FRAME WORK AND BAR DETAIL</p>', { kwn: true });
  T.spec.forEach((r, i) => H(`<p class="agr-spec ${r.s ? 's-' + r.s : ''}"><span class="k">${cell('spec', i, 0, r.c[0])}</span><span class="c">:</span><span class="v">${cell('spec', i, 1, r.c[1] ?? '')}</span></p>`));
  // doors, windows and fittings
  H('<p class="agr-th agr-bu">DOORS DETAILS OF BOTH FLOORS BASED ON PROJECT PLAN</p>', { page: true, kwn: true });
  TB('doors');
  H('<p class="agr-th agr-bu gap">WINDOW DETAILS OF BOTH FLOORS BASED ON PROJECT PLAN</p>', { kwn: true });
  TB('windows');
  TB('extras', { cls: 'gap-xl' });
  H('<p class="agr-th gap"><b class="agr-hl">ELECTRICALS:</b></p>', { kwn: true });
  TB('elec');
  H('<p class="agr-th gap"><b class="agr-hl">PLUMBING</b></p>', { kwn: true });
  TB('plumbing');
  H(`<p class="agr-th agr-bu gap">${slots(AGR_TANK_TPL, 'tank', AGR_TANK_SLOTS)}</p>`);
  H('<p class="agr-th agr-bu">TILE:</p>', { kwn: true });
  TB('tile');
  H('<p class="agr-th agr-bu gap">PAINTING:</p>', { kwn: true });
  TB('paint');
  // exclusions, materials and terms
  H('<p class="agr-th agr-bu red big">Work not comes under this estimation.</p>', { page: true, kwn: true });
  TB('excl');
  H('<p class="agr-th agr-bu red big gap">Materials used for this project:</p>', { kwn: true });
  TB('mat');
  H('<p class="agr-terms-h">நிபந்தனைகள் <span>(Terms &amp; Conditions)</span></p>', { kwn: true });
  agrTermList(a).forEach((x, n) => H(`<p class="agr-term"><span class="no">${n + 1}.</span><span>${x.custom ? agrCustomHtml(x.i, x.t.text) : slots(x.t, 'terms', AGR_TERM_SLOTS)}</span></p>`));
  // payment schedule
  H('<p class="agr-th agr-bu big">Payment schedule:</p>', { page: true, kwn: true });
  B.push({ table: { k: 'stages', head: ['stages', 'payment schedule details', 'amount'], cols: [14.4, 71, 14.6], ha: ['', 'c'], cls: 't-pay', foot: true,
    rows: [...a.stages.map((s, i) => ({ cells: [agrF(`stages.${i}.n`, s.n), agrF(`stages.${i}.d`, s.d, 'details'), agrBlankNum(s.amt) ? agrF(`stages.${i}.amt`, '', 'amount') : agrF(`stages.${i}.amt`, String(Math.round(agrN(s.amt))))] })),
      { cls: 'tot', cells: ['total', '', agrFh('stages', String(c.sched))] }] } });
  H(agrSign(a), { cls: 'agr-sign-blk' });
  return B;
}

/* ================= pagination ================= */
let AGR_HOST = null;
function agrHost() {
  if (!AGR_HOST?.isConnected) { AGR_HOST = document.createElement('div'); AGR_HOST.className = 'agr-doc agr-measure'; AGR_HOST.setAttribute('aria-hidden', 'true'); document.body.appendChild(AGR_HOST); }
  return AGR_HOST;
}
const agrBlockEl = b => { const d = document.createElement('div'); d.className = 'agr-blk ' + (b.cls || ''); if (b.kwn) d.dataset.kwn = '1'; d.innerHTML = b.html; return d; };
// head: false for the part of a table that continues on the next page (no heading row, no space above)
function agrTableEl(b, head) {
  const t = b.table, d = document.createElement('div');
  d.className = 'agr-blk agr-tw ' + (head ? b.cls || '' : 'cont');
  d.innerHTML = `<table class="agr-t ${t.cls || ''}"><colgroup>${t.cols.map(w => `<col style="width:${w}%">`).join('')}</colgroup>${head && !t.noHead ? `<thead><tr>${t.head.map((h, i) => `<th class="${t.ha?.[i] || ''}">${esc(h)}</th>`).join('')}</tr></thead>` : ''}<tbody></tbody></table>`;
  return d;
}
function agrRowEl(b, r) {
  const t = b.table, tb = document.createElement('tbody');
  tb.innerHTML = `<tr class="${r.cls || ''}">${r.span ? `<td colspan="${t.cols.length}">${r.cells[0]}</td>` : r.cells.map((h, i) => `<td class="${t.ca?.[i] || ''}">${h}</td>`).join('')}</tr>`;
  return tb.firstElementChild;
}
/* lays the agreement out on A4 pages by filling each page until the next block no longer fits; tables split between
   rows and continue on the next page without repeating the heading row, as in the original */
function agrLayout(a) {
  const c = agrCalc(a), host = agrHost();
  host.innerHTML = agrPage(agrPage1(a, c), 'p1');
  const b1 = $('.agr-body', host), p1Over = b1.scrollHeight > b1.clientHeight + 1;
  let body = null;
  const newPage = () => { host.insertAdjacentHTML('beforeend', agrPage('')); body = $('.agr-body', host.lastElementChild); };
  const over = el => el.getBoundingClientRect().bottom > body.getBoundingClientRect().bottom + .5;
  // carries a heading over with the block it introduces
  const carry = from => { const tail = []; let x = from.lastElementChild; while (x?.dataset.kwn && x.previousElementSibling) { tail.unshift(x); x = x.previousElementSibling; } tail.reverse().forEach(t => body.prepend(t)); };
  for (const b of agrBlocks(a, c)) {
    if (b.page || !body) newPage();
    if (!b.table) {
      const el = agrBlockEl(b); body.appendChild(el);
      if (over(el) && el.previousElementSibling) { const old = body; newPage(); body.appendChild(el); carry(old); }
      continue;
    }
    let wrap = agrTableEl(b, true), tb = $('tbody', wrap); body.appendChild(wrap);
    for (const r of b.table.rows) {
      const tr = agrRowEl(b, r); tb.appendChild(tr);
      if (!over(tr)) continue;
      tb.removeChild(tr);
      const old = body;
      if (!tb.rows.length) { if (wrap.previousElementSibling) { newPage(); body.appendChild(wrap); carry(old); } tb.appendChild(tr); continue; }
      newPage(); wrap = agrTableEl(b, false); tb = $('tbody', wrap); body.appendChild(wrap); tb.appendChild(tr);
    }
  }
  const pages = $$('.agr-page', host).map(p => p.outerHTML);
  host.innerHTML = '';
  return { pages, p1Over };
}

/* ================= fonts & libraries ================= */
const AGR_FONT_URL = 'https://fonts.googleapis.com/css2?family=Barlow:wght@500&family=Barlow+Semi+Condensed:wght@500&family=Carlito:wght@400;700&family=Noto+Sans+Tamil:wght@400;600;700&family=Tinos:wght@400;700&display=swap';
let agrFontsP = null;
const AGR_FACES = ['400 16px "Noto Sans Tamil"', '700 16px "Noto Sans Tamil"', '400 16px Tinos', '700 16px Tinos', '500 16px Barlow', '500 16px "Barlow Semi Condensed"', '400 16px Carlito'];
const agrLoadFaces = doc => Promise.all(AGR_FACES.map(f => doc.fonts.load(f, 'தமிழ் Aa').catch(() => null)));
function agrFonts() {
  return agrFontsP ||= new Promise(res => {
    const done = () => agrLoadFaces(document).then(() => res(), () => res());
    if ($('#agrFonts')) { done(); return; }
    const l = document.createElement('link'); l.id = 'agrFonts'; l.rel = 'stylesheet'; l.href = AGR_FONT_URL;
    l.onload = done; l.onerror = () => res(); // offline: the system's Tamil font is used instead
    document.head.appendChild(l); setTimeout(res, 8000);
  });
}
const AGR_LIBS = ['https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js', 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js'];
let agrLibsP = null;
function agrLibs() {
  if (window.html2canvas && window.jspdf) return Promise.resolve();
  return agrLibsP ||= Promise.all(AGR_LIBS.map(src => new Promise((res, rej) => {
    const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => { s.remove(); rej(new Error('PDF library unavailable')); }; document.head.appendChild(s);
  }))).catch(e => { agrLibsP = null; throw e; });
}


/* ================= checks ================= */
// ok: true = passed, false = must be fixed before finalizing, 'warn' = worth a second look
function agrChecks(a, layout) {
  const c = agrCalc(a), out = [], add = (ok, t, s = '', f = '') => out.push({ ok, t, s, f });
  const miss = [['date', 'Agreement date'], ['o.name', 'Building owner’s name'], ['o.father', 'Owner’s father / husband'], ['o.place', 'Owner’s place of residence'], ['site', 'Construction site address'],
    ['c.name', 'Contractor’s name'], ['c.father', 'Contractor’s father'], ['c.address', 'Contractor’s address'], ['specialTa', 'Special works (Tamil)']]
    .filter(([p]) => !String(agrGet(a, p) ?? '').trim());
  add(!miss.length, miss.length ? `${plural(miss.length, 'detail')} missing` : 'All details are filled in', miss.map(m => m[1]).join(', '), miss[0]?.[0]);
  [['o.aadhaar', 'Building owner’s Aadhaar'], ['c.aadhaar', 'Contractor’s Aadhaar']].forEach(([p, l]) => { const v = agrGet(a, p); add(okAadhaar(v), okAadhaar(v) ? `${l} is valid` : `${l} is ${digits(v).length === 12 ? 'not a valid Aadhaar number' : 'incomplete'}`, digits(v) ? fmtAadhaar(v) : 'Not entered', p); });
  if (okAadhaar(a.o.aadhaar) && digits(a.o.aadhaar) === digits(a.c.aadhaar)) add(false, 'Both parties have the same Aadhaar number', 'The building owner and the contractor must be different people', 'o.aadhaar');
  const noAmt = a.special.map((s, i) => [s, i]).filter(([s]) => agrBlankNum(s.amt) || !String(s.d).trim());
  add(!noAmt.length, noAmt.length ? 'Special works need a description and an amount' : `Special works total ₹${agrRs(c.sp)}`, noAmt.length ? `Item ${noAmt.map(([, i]) => i + 1).join(', ')} — enter 0 for work done free of charge` : `${plural(a.special.length, 'item')}; check the Tamil description on page 1 lists the same works`, noAmt.length ? `special.${noAmt[0][1]}.${String(noAmt[0][0].d).trim() ? 'amt' : 'd'}` : 'specialTa');
  const badFl = a.floors.map((f, i) => [f, i]).filter(([f]) => !String(f.en ?? '').trim() || !String(f.ta ?? '').trim() || !agrN(f.area) || !agrN(f.rate));
  if (!a.floors.length) add(false, 'There are no floors in the agreement', 'Add at least the ground floor', '');
  else add(!badFl.length, badFl.length ? `${plural(badFl.length, 'floor')} ${badFl.length === 1 ? 'needs' : 'need'} a name, area and rate` : `${plural(a.floors.length, 'floor')} · ${agrRs(sum(a.floors, f => agrN(f.area)))} sq.ft`,
    badFl.length ? badFl.map(([f, i]) => String(f.en ?? '').trim() || `Floor ${i + 1}`).join(', ') : a.floors.map(f => f.en).join(', '),
    badFl.length ? `floors.${badFl[0][1]}.${!String(badFl[0][0].en ?? '').trim() ? 'en' : !String(badFl[0][0].ta ?? '').trim() ? 'ta' : !agrN(badFl[0][0].area) ? 'area' : 'rate'}` : '');
  add(c.total > 0, c.total > 0 ? `Agreement value ₹${agrRs(c.total)}` : 'The agreement value is zero', c.total > 0 ? `${agrWords(c.total)} RUPEES ONLY` : 'Enter the floor areas and rates', 'floors.0.area');
  const blankStage = a.stages.findIndex(s => agrBlankNum(s.amt));
  if (blankStage >= 0) add(false, 'Payment schedule has stages without an amount', `Stage ${blankStage + 1} — ${a.stages[blankStage].d}`, `stages.${blankStage}.amt`);
  else add(c.diff === 0, c.diff === 0 ? 'Payment schedule adds up to the agreement value' : `Payment schedule is ₹${agrRs(Math.abs(c.diff))} ${c.diff > 0 ? 'short of' : 'more than'} the agreement value`, `Schedule ₹${agrRs(c.sched)} · agreement ₹${agrRs(c.total)}`, `stages.${a.stages.length - 1}.amt`);
  const noSlot = [['terms', AGR_TERM_SLOTS], ['tank', AGR_TANK_SLOTS]].flatMap(([b, S]) => Object.entries(S).filter(([k]) => !String(a[b]?.[k] ?? '').trim()).map(([k, [l]]) => [`${b}.${k}`, l]));
  const noText = (a.customTerms || []).map((t, i) => [t, i]).filter(([t]) => !String(t.text ?? '').trim());
  if (agrTplMoved(a)) add('warn', 'The template’s terms are in a different order', 'Check this was intended; Restore template order on the Terms & conditions step puts them back', 'terms.std');
  if (noText.length) add(false, `${plural(noText.length, 'added term')} without any text`, 'Write the term or remove it', `customTerms.${noText[0][1]}.text`);
  if (noSlot.length) add(false, `${plural(noSlot.length, 'detail')} missing in the terms or water tank`, noSlot.map(x => x[1]).join(', '), noSlot[0][0]);
  if (layout) add(!layout.p1Over, layout.p1Over ? 'Page 1 text does not fit on one page' : `Laid out on ${layout.pages.length} A4 pages`, layout.p1Over ? 'Shorten the addresses or the special works description' : 'Same page order as the company template', layout.p1Over ? 'site' : '');
  return out;
}

/* ================= list ================= */
SEARCH_HOOKS.push(hit => canSee('agreements') && canMoney() ? AGRS.filter(a => hit(a.o.name) || hit(a.site) || hit(a.ref || '')).slice(0, 4).map(a => ({ g: 'Agreements', icon: 'contract', t: a.o.name || 'New agreement', s: `${a.ref || 'Draft'} · ${a.status}`, href: `#/agreements/${a.id}` })) : []);
NAV_COUNT_HOOKS.push(() => ({ agreements: canSee('agreements') ? AGRS.filter(a => a.status === 'Draft').length : 0 }));
const agrBadge = a => badge(a.status === 'Final' ? 'Final' : 'Draft', a.status === 'Final' ? 'ok' : 'warn');
INPUT.agrQ = liveSearch('agrQ');

VIEWS.agreements = () => {
  if (!canMoney()) return noAccess(MODULES.find(m => m.id === 'agreements'));
  agrFonts();
  if (!ROUTE.parts[0]) { AGR_ED = null; return `<div class="agr-ui">${agrList()}</div>`; }
  const a = agrById(ROUTE.parts[0]);
  if (!a) return `<div class="card">${emptyPage('Agreement not found', 'It may have been deleted.')}</div>`;
  return `<div class="agr-ui">${agrEditor(a)}</div>`;
};
function agrList() {
  const st = ROUTE.q.st || '', q = (ROUTE.q.q || '').toLowerCase();
  const all = AGRS.slice().sort((x, y) => y.updatedAt - x.updatedAt);
  const list = all.filter(a => (!st || a.status === st) && (!q || `${a.ref} ${a.o.name} ${a.site} ${proj(a.project)?.name || ''}`.toLowerCase().includes(q)));
  return `${pageHead('Agreements', 'Building contract agreements in Tamil (கட்டிட ஒப்பந்தப் பத்திரம்) made from the company template: fill in the details, add terms if needed, verify and download the PDF.', can('agreements') ? btn('New agreement', 'agrNew', { icon: 'plus', cls: 'primary' }) : '')}
    ${!can('agreements') ? `<div class="banner">${ico('eye')}<span>You have <b>view-only</b> access to agreements.</span></div>` : ''}
    <div class="toolbar">${searchBox('agrQ', ROUTE.q.q || '', 'Search owner, site, ref.')}</div>
    ${statusChips([['', 'All'], ['Draft', 'Drafts'], ['Final', 'Final']], st, 'st', v => all.filter(a => !v || a.status === v).length)}
    <div class="card"><div class="table-wrap"><table class="t stack-sm agr-list"><thead><tr><th>Building owner</th><th>Site</th><th>Agreement date</th><th class="r">Agreement value</th><th>Status</th><th>Updated</th><th></th></tr></thead><tbody>
      ${list.map(a => `<tr class="click" data-act="go" data-href="#/agreements/${a.id}"><td class="strong full"><span class="ta">${esc(a.o.name || 'Owner not entered')}</span><span class="sub">${esc(a.ref || 'Draft')}${a.project ? ` · ${esc(proj(a.project)?.name || '')}` : ''}</span></td>
        <td class="hide-sm"><span class="ta clamp2">${esc(a.site || '—')}</span></td><td class="nowrap">${a.date ? fmtDY(a.date) : '—'}</td><td class="r strong nowrap">₹${agrRs(agrCalc(a).total)}</td><td>${agrBadge(a)}</td>
        <td class="nowrap hide-sm muted">${ago(a.updatedAt)}<span class="sub">${esc(userName(a.updatedBy))}</span></td>
        <td class="r">${can('agreements') ? `<button class="iconbtn" data-act="agrRowMenu" data-id="${a.id}" aria-label="Actions">${ico('more')}</button>` : ''}</td></tr>`).join('') || emptyRow(7, all.length ? 'Nothing found' : 'No agreements yet', all.length ? 'Try another filter.' : 'Start one with New agreement.')}
    </tbody></table></div></div>`;
}
ACT.agrRowMenu = el => { const a = agrById(el.dataset.id); openMenu(el, `<button data-act="go" data-href="#/agreements/${a.id}">${ico('edit')}Open</button><button data-act="agrDup" data-id="${a.id}">${ico('file')}Duplicate</button>${a.status !== 'Final' ? `<hr><button data-act="agrDel" data-id="${a.id}" class="danger">${ico('trash')}Delete draft</button>` : ''}`); };
ACT.agrNew = () => {
  if (!guard(can('agreements'), 'create agreements')) return;
  const a = agrBlank(); a.ref = agrRef(a.date); AGRS.unshift(a); saveAgrs();
  logAct(`started agreement ${a.ref}`); go(`#/agreements/${a.id}`);
};
ACT.agrDup = el => {
  if (!guard(can('agreements'), 'create agreements')) return;
  const src = agrById(el.dataset.id), a = Object.assign(agrClone(src), { id: 'ag' + Date.now().toString(36), status: 'Draft', date: TODAY, createdAt: Date.now(), createdBy: SESSION, updatedAt: Date.now(), updatedBy: SESSION });
  delete a.finalAt; delete a.finalBy; delete a.downloads; a.ref = agrRef(a.date);
  AGRS.unshift(a); saveAgrs(); go(`#/agreements/${a.id}`); toast(`Copied as draft ${a.ref}`);
};
ACT.agrDel = el => {
  const a = agrById(el.dataset.id); if (!guard(agrEditable(a), 'delete this agreement')) return;
  confirmBox('Delete this draft?', `<b>${esc(a.ref)}</b>${a.o.name ? ` for <span class="ta">${esc(a.o.name)}</span>` : ''} will be removed.`, 'Delete', () => { AGRS = AGRS.filter(x => x !== a); saveAgrs(); logAct(`deleted draft agreement ${a.ref}`); if (ROUTE.parts[0]) go('#/agreements'); else render(); toast('Draft deleted'); }, true);
};

/* ================= editor ================= */
let AGR_ED = null, AGR_LAST = null;
const AGR_STEPS = [['fill', 'Fill in details'], ['terms', 'Terms & conditions'], ['verify', 'Verify'], ['download', 'Download PDF']];
// the live preview starts closed for each agreement; it stays open or closed while moving between its steps
let AGR_PV_OPEN = false, AGR_PV_FOR = null;
function agrEditor(a) {
  AGR_ED = a;
  if (AGR_PV_FOR !== a.id) { AGR_PV_FOR = a.id; AGR_PV_OPEN = false; }
  const step = AGR_STEPS.some(s => s[0] === ROUTE.q.step) ? ROUTE.q.step : 'fill', si = AGR_STEPS.findIndex(s => s[0] === step), fin = a.status === 'Final';
  const steps = `<nav class="agr-steps" aria-label="Agreement steps">${AGR_STEPS.map(([id, l], i) => { const done = fin ? i < 3 : i < si; return `<button type="button" class="agr-step ${id === step ? 'cur' : ''} ${done ? 'done' : ''}" data-act="setQ" data-k="step" data-v="${id}" ${id === step ? 'aria-current="step"' : ''}><i>${done ? ico('check', 'sm') : i + 1}</i><span>${l}</span></button>`; }).join('')}</nav>`;
  const acts = `${fin && role() === 'owner' ? btn('Edit again', 'agrReopen', { icon: 'edit' }) : ''}${can('agreements') ? btn('Duplicate', 'agrDup', { icon: 'file', data: `data-id="${a.id}"` }) : ''}`;
  const body = step === 'terms' ? agrTermsStep(a) : step === 'verify' ? agrVerifyStep(a) : step === 'download' ? agrDownloadStep(a) : agrFillStep(a);
  after(() => agrMountPreview(a));
  return `${pageHead(`<span class="ta">${esc(a.o.name || 'New agreement')}</span>`, `${esc(a.ref || '')} · ${agrBadge(a)} · Agreement date ${a.date ? fmtDY(a.date) : '—'}${fin ? ` · finalized by ${esc(userName(a.finalBy))} on ${fmtDY(iso(new Date(a.finalAt)))}` : ''}`, acts)}
    ${steps}
    <div class="agr-pvbar"><button type="button" class="btn sm agr-pvbtn" data-act="agrPvToggle" aria-controls="agrLive" aria-expanded="${AGR_PV_OPEN}">${ico('eye', 'sm')}<span data-agr-pvlbl>${AGR_PV_OPEN ? 'Hide live preview' : 'Show live preview'}</span></button><span class="muted">See the agreement as it will print, updating while you type.</span></div>
    <div class="agr-work ${AGR_PV_OPEN ? 'pv-open' : ''}" id="agrWork"><div class="agr-main">${body}</div>
      <aside class="agr-live" id="agrLive" aria-label="Live preview"><div class="agr-live-h"><b>Live preview</b><span class="muted" data-agr-pages></span><button type="button" class="btn sm" data-act="agrPvToggle">${ico('x', 'sm')}Hide</button></div>
        <div class="agr-pv" id="agrPv"><div class="agr-pv-wait">Laying out the pages…</div></div></aside>
      <button type="button" class="agr-pvfab" data-act="agrPvToggle" aria-controls="agrLive">${ico('eye', 'sm')}Live preview</button></div>`;
}
// opens or closes the live preview without re-rendering the form, so typing and scroll position carry on
function agrPvSet(open) {
  AGR_PV_OPEN = open;
  $('#agrWork')?.classList.toggle('pv-open', open);
  $$('[data-agr-pvlbl]').forEach(l => l.textContent = open ? 'Hide live preview' : 'Show live preview');
  $$('.agr-pvbtn').forEach(b => b.setAttribute('aria-expanded', String(open)));
  if (open) agrFonts().then(() => { agrRenderPreview(); const f = document.activeElement?.dataset?.agr; if (f) agrHl(f); });
}
ACT.agrPvToggle = () => agrPvSet(!AGR_PV_OPEN);
ACT.agrPvOpen = () => agrPvSet(true);
const agrNext = (back, next) => `<div class="agr-nav">${back ? `<button type="button" class="btn" data-act="setQ" data-k="step" data-v="${back[0]}">${ico('arrowL', 'sm')}${back[1]}</button>` : '<span></span>'}${next ? `<button type="button" class="btn primary" data-act="setQ" data-k="step" data-v="${next[0]}">${next[1]}${ico('arrowR', 'sm')}</button>` : ''}</div>`;

/* ---------- step 1: fill in ---------- */
function af(label, path, { type = 'text', ph = '', hint = '', req = false, ta = false, opts = null, kind = '', tamil = false, rows = 2, min } = {}) {
  const v = agrGet(AGR_ED, path) ?? '', attrs = `data-agr="${path}"${kind ? ` data-kind="${kind}"` : ''}${tamil ? ' lang="ta"' : ''}`;
  const cls = tamil ? ' ta' : '';
  const control = opts ? `<select class="select" ${attrs}>${opts.map(o => `<option ${o === v ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select>`
    : ta ? `<textarea class="${cls.trim()}" ${attrs} rows="${rows}" placeholder="${esc(ph)}">${esc(v)}</textarea>`
    : `<input class="input${cls}${kind === 'aadhaar' ? ' mono' : ''}" type="${type}" ${attrs} value="${esc(kind === 'aadhaar' ? fmtAadhaar(v) : v)}" placeholder="${esc(ph)}"${kind === 'aadhaar' ? ' inputmode="numeric" maxlength="14" autocomplete="off"' : ''}${type === 'number' ? ` inputmode="decimal"${min != null ? ` min="${min}"` : ''}` : ''}>`;
  const aadHint = kind === 'aadhaar' ? `<small data-agr-aad="${path}">${agrAadHint(v)}</small>` : '';
  return `<label class="field"><span>${esc(label)}${req ? ' <em>*</em>' : ''}</span>${control}${aadHint}${hint ? `<small>${hint}</small>` : ''}</label>`;
}
const agrAadHint = v => { const n = digits(v).length; return n === 12 ? (okAadhaar(v) ? '<b class="ok">✓ Valid Aadhaar number</b>' : '<b class="bad">Not a valid Aadhaar number</b>') : `${n} of 12 digits`; };
// fixed wording with the parts that change as inline boxes
const agrSlotW = (v, num) => `${Math.max(num ? 8 : 5, String(v ?? '').length + (num ? 3 : 2))}ch`;
function agrSlotEd(tpl, base, S) {
  return tpl.split(/(\{\w+\})/).map(part => { const m = /^\{(\w+)\}$/.exec(part); if (!m) return esc(part);
    const k = m[1], [label, , kind] = S[k], v = agrGet(AGR_ED, `${base}.${k}`) ?? '';
    return `<input class="input agr-slot" ${kind ? 'type="number" min="0" inputmode="decimal" data-kind="num"' : 'type="text"'} data-agr="${base}.${k}" value="${esc(v)}" aria-label="${esc(label)}" title="${esc(label)}" style="width:${agrSlotW(v, kind)}">`; }).join('');
}
// pick-or-type suggestions for a table column: the template's values and those used in other agreements
const agrSuggest = (k, j) => [...new Set([...AGR_ROWS[k], ...AGRS.flatMap(x => x.tables?.[k] || [])].filter(r => r.c.length > 1 || AGR_TBL[k].head.length === 1).map(r => String(r.c[j] ?? '').trim()).filter(Boolean))].sort((x, y) => x.localeCompare(y)).slice(0, 80);
// the fill-in step's sections, listed down the left side for a direct jump
const AGR_TOC = [['Agreement details', [['date', 'Agreement'], ['owner', 'Building owner'], ['site', 'Construction site'], ['area', 'Floors & rates'], ['special', 'Special works'], ['pay', 'Payment schedule'], ['contractor', 'Contractor']]],
  ['Specifications', [['progress', 'Work progress'], ['specw', 'Specification of work'], ['doors', 'Doors & windows'], ['elec', 'Electricals'], ['plumb', 'Plumbing & water tank'], ['tile', 'Tile & painting'], ['mat', 'Materials & brands'], ['excl', 'Work not included']]]];
// sections that still have required details missing, marked with a dot in the list
function agrTodo(a) {
  const c = agrCalc(a), blank = v => !String(v ?? '').trim(), out = new Set();
  if (blank(a.date)) out.add('date');
  if (blank(a.o.name) || blank(a.o.father) || blank(a.o.place) || !okAadhaar(a.o.aadhaar)) out.add('owner');
  if (blank(a.site)) out.add('site');
  if (!a.floors.length || a.floors.some(f => blank(f.en) || blank(f.ta) || !agrN(f.area) || !agrN(f.rate))) out.add('area');
  if (blank(a.specialTa) || a.special.some(x => blank(x.d) || agrBlankNum(x.amt))) out.add('special');
  if (a.stages.some(x => agrBlankNum(x.amt)) || c.diff) out.add('pay');
  if (blank(a.c.name) || blank(a.c.father) || blank(a.c.address) || !okAadhaar(a.c.aadhaar)) out.add('contractor');
  if (Object.entries(AGR_TANK_SLOTS).some(([k]) => blank(a.tank?.[k]))) out.add('plumb');
  return out;
}
const agrToc = a => { const todo = agrTodo(a);
  return `<nav class="agr-toc" aria-label="Form sections">${AGR_TOC.map(([g, items]) => `<div class="agr-toc-g"><div class="agr-toc-h">${esc(g)}</div>${items.map(([id, l]) => `<button type="button" data-act="agrJump" data-id="${id}" class="${todo.has(id) ? 'todo' : ''}"><span>${esc(l)}</span><i title="Details missing" aria-label="details missing"></i></button>`).join('')}</div>`).join('')}
    <div class="agr-toc-g"><button type="button" class="agr-toc-next" data-act="setQ" data-k="step" data-v="terms"><span>Terms &amp; conditions</span>${ico('arrowR', 'sm')}</button></div></nav>`; };
function agrTocSync() { const a = AGR_ED, nav = $('.agr-toc'); if (!a || !nav) return; const todo = agrTodo(a); $$('[data-act="agrJump"]', nav).forEach(b => b.classList.toggle('todo', todo.has(b.dataset.id))); }
// highlights the section being read, as the page scrolls
let agrIO = null;
function agrSpy() {
  agrIO?.disconnect(); const nav = $('.agr-toc'); if (!nav) return;
  const seen = new Map();
  agrIO = new IntersectionObserver(es => { es.forEach(e => seen.set(e.target.id, e.isIntersecting));
    const cur = $$('.agr-sec').find(el => seen.get(el.id));
    if (!cur) return; $$('[data-act="agrJump"]', nav).forEach(b => b.classList.toggle('on', `agrs-${b.dataset.id}` === cur.id));
    const b = $('.on', nav); if (b && nav.scrollWidth > nav.clientWidth + 2) nav.scrollTo({ left: b.offsetLeft - 8, behavior: 'smooth' }); }, { rootMargin: '-120px 0px -55% 0px' });
  $$('.agr-sec').forEach(el => agrIO.observe(el));
}
// scrolls the page itself (scrollIntoView would also shift the app's clipped containers)
const agrScrollTo = (el, offset = 92) => el && scrollTo({ top: el.getBoundingClientRect().top + scrollY - offset, behavior: 'smooth' });
// on phones the strip of sections sits under the top bar, so sections stop a little lower
ACT.agrJump = el => { agrScrollTo($(`#agrs-${el.dataset.id}`), matchMedia('(max-width: 900px)').matches ? 124 : 92); $$('.agr-toc [data-act="agrJump"]').forEach(b => b.classList.toggle('on', b === el)); };
// editor column widths follow the longest value in the column, so sizes and brands aren't cut off
const agrColW = (k, j) => Math.round(Math.min(270, Math.max(72, 32 + 7.7 * Math.max(0, ...[...AGR_ROWS[k], ...(AGR_ED?.tables[k] || [])].filter(r => r.c.length > 1).map(r => String(r.c[j] ?? '').length)))));
const agrSec = (id, title, sub, body) => `<section class="card agr-sec" id="agrs-${id}"><div class="card-head"><div><h2>${title}</h2>${sub ? `<p class="muted">${sub}</p>` : ''}</div></div><div class="card-body form">${body}</div></section>`;
function agrFillStep(a) {
  const c = agrCalc(a), edit = agrEditable(a), T = a.tables;
  const tableEd = (k, head = false) => { const d = AGR_TBL[k], n = d.head.length, one = r => r.c.length === 1 && n > 1;
    const lists = d.head.map((_, j) => `<datalist id="agrdl-${k}-${j}">${agrSuggest(k, j).map(v => `<option value="${esc(v)}">`).join('')}</datalist>`).join('');
    const cellIn = (r, i, j, label) => `<input class="input sm" data-agr="tables.${k}.${i}.c.${j}" value="${esc(r.c[j] ?? '')}" list="agrdl-${k}-${j}" aria-label="${esc(label)}">`;
    const del = i => `<button type="button" class="iconbtn sm" data-act="agrDelRow" data-k="${k}" data-i="${i}" aria-label="Remove row ${i + 1}" title="Remove row">${ico('x', 'sm')}</button>`;
    // wide tables (doors, windows, plumbing): one card per row so every size, type, material and brand stays in view
    const rows = n >= 4 ? `<div class="agr-rcs">${T[k].map((r, i) => `<div class="agr-rc"><div class="agr-rc-top"><span class="n">${i + 1}</span>${cellIn(r, i, 0, `${d.head[0]}, row ${i + 1}`)}${del(i)}</div>
        <div class="agr-rc-f" style="grid-template-columns:${d.head.slice(1).map((_, x) => `minmax(0,${agrColW(k, x + 1)}fr)`).join(' ')}">${d.head.slice(1).map((h, x) => `<label><span title="${esc(h)}">${esc(h)}</span>${cellIn(r, i, x + 1, `${h}, row ${i + 1}`)}</label>`).join('')}</div></div>`).join('')}</div>` : '';
    return `<div class="agr-tbl">${head ? `<div class="agr-tbl-h"><b>${esc(d.label)}</b>${d.sub ? `<small>${esc(d.sub)}</small>` : ''}</div>` : ''}${lists}${rows || `
      <div class="agr-grid" style="--cols:${d.head.map((_, j) => n === 1 ? 'minmax(260px,1fr)' : `minmax(${agrColW(k, j)}px,${(agrColW(k, j) / 60).toFixed(2)}fr)`).join(' ')}${d.styles ? ' 104px' : ''} 34px">
        <div class="agr-gh">${d.head.map(h => `<span>${esc(h)}</span>`).join('')}${d.styles ? '<span>Style</span>' : ''}<span></span></div>
        ${T[k].map((r, i) => `<div class="agr-gr">${one(r) ? `<input class="input sm span" data-agr="tables.${k}.${i}.c.0" value="${esc(r.c[0])}" list="agrdl-${k}-0" aria-label="Row ${i + 1}">` : r.c.map((v, j) => `<input class="input sm" data-agr="tables.${k}.${i}.c.${j}" value="${esc(v)}" list="agrdl-${k}-${j}" aria-label="${esc(d.head[j])}, row ${i + 1}">`).join('')}
          ${d.styles ? `<select class="select sm" data-agr="tables.${k}.${i}.s" aria-label="Style, row ${i + 1}">${[['', 'Normal'], ['r', 'Red'], ['rb', 'Red, bold']].map(([v, l]) => `<option value="${v}" ${r.s === v ? 'selected' : ''}>${l}</option>`).join('')}</select>` : ''}
          ${del(i)}</div>`).join('')}
      </div>`}
      <div class="agr-grid-acts"><button type="button" class="btn sm" data-act="agrAddRow" data-k="${k}">${ico('plus', 'sm')}Add row</button><button type="button" class="linkbtn" data-act="agrResetTable" data-k="${k}">Restore the template rows</button><span class="tag">${plural(T[k].length, 'row')}</span>${d.styles ? '<small class="muted">Write **text** to print it in bold.</small>' : ''}</div></div>`; };
  const projs = myProjects();
  after(agrSpy);
  return `<div class="agr-fillwrap">${agrToc(a)}<div class="agr-form">
      ${a.status === 'Final' ? `<div class="banner ok">${ico('lock')}<span>This agreement is <b>final</b> and can't be changed.${role() === 'owner' ? ' Use <b>Edit again</b> to reopen it as a draft.' : ''} Use <b>Duplicate</b> to start a new one from it.</span></div>` : !can('agreements') ? `<div class="banner">${ico('eye')}<span>You have view-only access.</span></div>` : `<div class="form-note">${ico('alert', 'sm')}<span>The template's wording stays as it is. Every number, size, type, material and brand can be changed — jump to any section from the section list; a dot marks sections with details still missing. Open the live preview to see the agreement update as you type; clicking a field highlights it there.</span></div>`}
      <fieldset class="agr-fs" ${edit ? '' : 'disabled'}>
      ${agrSec('date', 'Agreement', '', `<div class="row2">${af('Agreement date', 'date', { type: 'date', req: true })}
        <label class="field"><span>Project (optional)</span><select class="select" data-agr="project"><option value="">Not linked</option>${projs.map(p => `<option value="${p.id}" ${a.project === p.id ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</select><small>For your records only; not printed.</small></label></div>`)}
      ${agrSec('owner', '2nd party · Building owner', 'கட்டிடத்தின் உரிமையாளர் — type the details in Tamil as they should appear on page 1', `
        <div class="row2">${af('Name', 'o.name', { req: true, tamil: true, ph: 'e.g. மணிவண்ணன்' })}${af('Aadhaar number', 'o.aadhaar', { req: true, kind: 'aadhaar', ph: 'XXXX XXXX XXXX' })}</div>
        <div class="row2 agr-rel">${af('Relation', 'o.rel', { opts: AGR_RELS })}${af('Father / husband’s name', 'o.father', { req: true, tamil: true, ph: 'e.g. சுப்ரமணியன்' })}</div>
        ${af('Place of residence (ஊர்)', 'o.place', { req: true, ta: true, tamil: true, ph: 'e.g. மயிலாடுதுறை மாவட்டம் , சீர்காழி …', hint: 'Printed before “என்ற ஊரில் வசிக்கும்”.' })}`)}
      ${agrSec('site', 'Construction site', 'சொந்தமான இடம் — where the building will be constructed', af('Site address', 'site', { req: true, ta: true, tamil: true, rows: 3, ph: 'Door no., street, village, post, taluk, PIN', hint: 'Printed before “என்ற முகவரியில் உள்ள இடத்தில”.' }))}
      ${agrSec('area', 'Floors, area &amp; rates', 'Add every floor being built; amounts are worked out from the area and the rate per sq.ft', `
        <datalist id="agrdl-floor-en">${AGR_FLOORS.map(f => `<option value="${esc(f[0])}">`).join('')}</datalist><datalist id="agrdl-floor-ta">${AGR_FLOORS.map(f => `<option value="${esc(f[1])}">`).join('')}</datalist>
        <div class="agr-fls">${a.floors.map((f, i) => `<div class="agr-rc agr-fl">
          <div class="agr-fl-top"><span class="n">${i + 1}</span>
            <label><span>Floor <small>· printed on pages 2–3</small></span><input class="input sm" data-agr="floors.${i}.en" value="${esc(f.en)}" list="agrdl-floor-en" placeholder="e.g. Second floor"></label>
            <label><span>Tamil name <small>· page 1</small></span><input class="input sm ta" lang="ta" data-agr="floors.${i}.ta" value="${esc(f.ta)}" list="agrdl-floor-ta" placeholder="e.g. இரண்டாம் தளம்"></label>
            <button type="button" class="iconbtn sm" data-act="agrDelFloor" data-i="${i}" aria-label="Remove floor ${i + 1}" title="Remove floor" ${a.floors.length < 2 ? 'disabled' : ''}>${ico('x', 'sm')}</button></div>
          <div class="agr-fl-nums">${['area', 'rate'].map(k => `<label><span>${k === 'area' ? 'Area (sq.ft)' : 'Rate (₹ / sq.ft)'} <em>*</em></span><input class="input sm r" type="number" min="0" inputmode="decimal" data-agr="floors.${i}.${k}" data-kind="num" value="${esc(f[k])}" placeholder="0"></label>`).join('')}
            <div class="amt"><span>Amount</span><output data-agr-out="fl${i}">₹${agrRs(c.floors[i])}</output></div></div></div>`).join('')}</div>
        <div class="agr-grid-acts"><button type="button" class="btn sm" data-act="agrAddFloor">${ico('plus', 'sm')}Add floor</button><span class="agr-sum">Floors total <output data-agr-out="fl">₹${agrRs(c.fl)}</output></span></div>`)}
      ${agrSec('special', 'Special works', 'Special work requirement — listed on page 2 with their amounts', `
        <div class="agr-grid" style="--cols:minmax(180px,1fr) 130px 34px"><div class="agr-gh"><span>Description (as printed on page 2)</span><span>Amount (₹)</span><span></span></div>
          ${a.special.map((s, i) => `<div class="agr-gr"><input class="input sm" data-agr="special.${i}.d" value="${esc(s.d)}" aria-label="Special work ${i + 1}"><input class="input sm r" type="number" min="0" inputmode="decimal" data-agr="special.${i}.amt" data-kind="num" value="${esc(s.amt)}" placeholder="0" aria-label="Amount for special work ${i + 1}"><button type="button" class="iconbtn sm" data-act="agrDelRow" data-k="special" data-i="${i}" aria-label="Remove special work ${i + 1}">${ico('x', 'sm')}</button></div>`).join('')}
        </div>
        <div class="agr-grid-acts"><button type="button" class="btn sm" data-act="agrAddRow" data-k="special">${ico('plus', 'sm')}Add special work</button><span class="agr-sum">Total <output data-agr-out="sp">₹${agrRs(c.sp)}</output></span></div>
        ${af('The same works in Tamil, for page 1', 'specialTa', { req: true, ta: true, tamil: true, rows: 3, hint: 'Printed after “மேலும் தனி சிறப்பு வேளைகளான” and before the total. Keep it in step with the list above.' })}`)}
      ${agrSec('pay', 'Payment schedule', 'Printed on the last page; must add up to the agreement value', `
        <div class="agr-grid" style="--cols:96px minmax(180px,1fr) 130px 34px"><div class="agr-gh"><span>Stage</span><span>Payment schedule details</span><span>Amount (₹)</span><span></span></div>
          ${a.stages.map((s, i) => `<div class="agr-gr"><input class="input sm" data-agr="stages.${i}.n" value="${esc(s.n)}" aria-label="Stage ${i + 1} name"><input class="input sm" data-agr="stages.${i}.d" value="${esc(s.d)}" aria-label="Stage ${i + 1} details"><input class="input sm r" type="number" min="0" inputmode="decimal" data-agr="stages.${i}.amt" data-kind="num" value="${esc(s.amt)}" placeholder="0" aria-label="Stage ${i + 1} amount"><button type="button" class="iconbtn sm" data-act="agrDelRow" data-k="stages" data-i="${i}" aria-label="Remove stage ${i + 1}">${ico('x', 'sm')}</button></div>`).join('')}
        </div>
        <div class="agr-grid-acts"><button type="button" class="btn sm" data-act="agrAddRow" data-k="stages">${ico('plus', 'sm')}Add stage</button><button type="button" class="btn sm" data-act="agrBalance">Put the balance in the last stage</button></div>
        <div class="agr-totals"><div><span>Agreement value</span><output data-agr-out="total">₹${agrRs(c.total)}</output></div><div><span>Payment schedule</span><output data-agr-out="sched">₹${agrRs(c.sched)}</output></div><div data-agr-diff class="${c.diff ? 'bad' : 'ok'}"><span>Difference</span><output data-agr-out="diff">${c.diff ? '₹' + agrRs(Math.abs(c.diff)) + (c.diff > 0 ? ' short' : ' over') : 'Matches'}</output></div></div>`)}
      ${agrSec('contractor', '1st party · Contractor', 'ஒப்பந்தக்காரர் — the company’s owner, filled in from the template', `
        <div class="row3 agr-c3">${af('Title', 'c.title', { tamil: true })}${af('Name', 'c.name', { req: true, tamil: true })}${af('Aadhaar number', 'c.aadhaar', { req: true, kind: 'aadhaar' })}</div>
        <div class="row2 agr-rel">${af('Relation', 'c.rel', { opts: AGR_RELS })}${af('Father’s name', 'c.father', { req: true, tamil: true })}</div>
        ${af('Address', 'c.address', { req: true, ta: true, tamil: true, hint: 'Printed before “-ல் வசிக்கும் Scale Space Builder’s நிறுவனத்தின் உரிமையாளர்”.' })}`)}
      ${agrSec('progress', 'Work progress', `Page 3 · Work progress for ${esc(agrFlList(a))} construction`, tableEd('progress'))}
      ${agrSec('specw', 'Specification of work', 'Page 4 · dimension of frame work and bar detail — sizes, rods, ratios and heights', tableEd('spec'))}
      ${agrSec('doors', 'Doors &amp; windows', 'Page 5 · frame thickness, size, numbers, types and materials from the project plan', tableEd('doors', true) + tableEd('windows', true) + tableEd('extras', true))}
      ${agrSec('elec', 'Electricals', 'Pipes, wires, switches and points — brands and numbers', tableEd('elec'))}
      ${agrSec('plumb', 'Plumbing &amp; water tank', 'Fittings for one toilet — cost, numbers and brand', `${tableEd('plumbing')}
        <div class="field"><span>Water tank <small class="muted">· printed in bold below the plumbing table</small></span><div class="agr-sentence">${agrSlotEd(AGR_TANK_TPL, 'tank', AGR_TANK_SLOTS)}</div></div>`)}
      ${agrSec('tile', 'Tile &amp; painting', 'Tile rates per sq.ft, painting coats and brands', tableEd('tile', true) + tableEd('paint', true))}
      ${agrSec('mat', 'Materials &amp; brands', 'Materials used for this project — brand and specification', tableEd('mat'))}
      ${agrSec('excl', 'Work not included', 'Work not comes under this estimation — and whose scope it is', tableEd('excl'))}
      </fieldset>
      ${agrNext(null, ['terms', 'Next: Terms & conditions'])}
  </div></div>`;
}

/* ---------- step 2: terms & conditions ---------- */
function agrTermsStep(a) {
  const edit = agrEditable(a), list = agrTermList(a), C = a.customTerms;
  const grip = (n, label) => edit ? `<button type="button" class="agr-drag" aria-label="Move term ${n}: drag, or use the arrow keys" title="Drag to move">${ico('grip', 'sm')}</button>` : '<span></span>';
  return `<div class="agr-form">
    ${a.status === 'Final' ? `<div class="banner ok">${ico('lock')}<span>This agreement is <b>final</b>; its terms can't be changed.</span></div>` : ''}
    <fieldset class="agr-fs" ${edit ? '' : 'disabled'}>
    ${agrSec('terms', 'Terms &amp; conditions', 'நிபந்தனைகள் — drag a term by its handle to change the order; the template’s terms keep their wording, with the standards, materials and amounts in the boxes', `
      <ol class="agr-tlist" id="agrTlist" lang="ta">${list.map((x, n) => x.custom
        ? `<li class="agr-ti custom" data-key="${x.key}">${grip(n + 1)}<span class="no">${n + 1}.</span><div class="ct">
            <textarea class="ta" data-agr="customTerms.${x.i}.text" rows="2" lang="ta" placeholder="Type the term in Tamil or English" aria-label="Added term">${esc(x.t.text || '')}</textarea>
            <div class="ct-acts"><button type="button" class="btn sm" data-act="agrDelTerm" data-i="${x.i}">${ico('trash', 'sm')}Remove</button></div></div><span class="tag agr-tag-add">Added</span></li>`
        : `<li class="agr-ti ${x.t.includes('{') ? 'has' : ''}" data-key="${x.key}">${grip(n + 1)}<span class="no">${n + 1}.</span><div class="tx">${agrSlotEd(x.t, 'terms', AGR_TERM_SLOTS)}</div><span class="tag" title="Template term ${x.n + 1}">Template ${x.n + 1}</span></li>`).join('')}</ol>
      <p class="sr" aria-live="polite" id="agrTermLive"></p>
      <div class="agr-grid-acts"><button type="button" class="btn sm" data-act="agrAddTerm">${ico('plus', 'sm')}Add a term</button>${agrTplMoved(a) ? `<button type="button" class="btn sm" data-act="agrTermsReset">${ico('refresh', 'sm')}Restore template order</button>` : ''}<small class="muted">${C.length ? `${plural(C.length, 'term')} added · ` : ''}Drag ${ico('grip', 'sm')} to move a term; terms are numbered in the order shown.</small></div>`)}
    </fieldset>
    ${agrNext(['fill', 'Back to details'], ['verify', 'Next: Verify'])}
  </div>`;
}
ACT.agrAddTerm = () => agrChange(a => { const id = agrTermId(); a.customTerms.push({ id, text: '' }); a.termOrder = [...agrTermKeys(a).filter(k => k !== 'c' + id), 'c' + id];
  const i = a.customTerms.length - 1; after(() => { const t = $(`[data-agr="customTerms.${i}.text"]`); if (t) { agrScrollTo(t, innerHeight / 3); t.focus({ preventScroll: true }); } }); }, 'Term added at the end — drag it to where it belongs');
// back to the template's order 1–13, keeping each added term after the template term it currently follows
ACT.agrTermsReset = () => agrChange(a => {
  const follows = new Map(); let prev = -1;
  agrTermKeys(a).forEach(k => { if (k[0] === 't') prev = +k.slice(1); else (follows.get(prev) || follows.set(prev, []).get(prev)).push(k); });
  a.termOrder = [...(follows.get(-1) || []), ...AGR_TERMS.flatMap((_, n) => ['t' + n, ...(follows.get(n) || [])])];
}, 'Template order restored');
ACT.agrDelTerm = el => { const a = AGR_ED, i = +el.dataset.i, t = a?.customTerms[i]; if (!t) return;
  const go = () => agrChange(x => { x.termOrder = agrTermKeys(x).filter(k => k !== 'c' + t.id); x.customTerms.splice(i, 1); }, 'Term removed');
  if (String(t.text || '').trim()) confirmBox('Remove this term?', `“${esc(String(t.text).trim().slice(0, 140))}” will be taken out of the agreement.`, 'Remove', go, true); else go(); };

/* reordering terms: drag by the handle (pointer events, so it works with a mouse and on touch screens), or focus the
   handle and use the arrow keys. The list re-orders as the pointer moves, the other terms slide out of the way, and
   the page scrolls when the pointer nears the top or bottom edge. Escape puts the term back. */
let agrDrag = null;
const agrTermNos = list => [...list.children].forEach((li, n) => { const no = $('.no', li); if (no) no.textContent = `${n + 1}.`; $('.agr-drag', li)?.setAttribute('aria-label', `Move term ${n + 1}: drag, or use the arrow keys`); });
function agrSlide(list, move) { // FLIP: let the other terms glide to their new places
  const items = [...list.children], top0 = new Map(items.map(x => [x, x.offsetTop]));
  move();
  items.forEach(x => { const d = top0.get(x) - x.offsetTop; if (!d || x === agrDrag?.li) return; x.style.transition = 'none'; x.style.transform = `translateY(${d}px)`;
    requestAnimationFrame(() => { x.style.transition = 'transform .16s ease'; x.style.transform = ''; }); });
  agrTermNos(list);
}
function agrTermsSave(list, li) {
  const a = AGR_ED; if (!agrEditable(a)) return;
  a.termOrder = [...list.children].map(x => x.dataset.key); agrTouch(a); saveAgrs(); agrPreviewSoon();
  const n = [...list.children].indexOf(li) + 1, live = $('#agrTermLive'); if (live) live.textContent = `Moved to term ${n}`;
  const acts = $('#agrs-terms .agr-grid-acts'), has = !!$('[data-act="agrTermsReset"]', acts);
  if (acts && has !== agrTplMoved(a)) { if (has) $('[data-act="agrTermsReset"]', acts).remove(); else acts.children[0].insertAdjacentHTML('afterend', `<button type="button" class="btn sm" data-act="agrTermsReset">${ico('refresh', 'sm')}Restore template order</button>`); }
}
function agrDragTo(y) {
  const { li, list } = agrDrag, rel = y - list.getBoundingClientRect().top;
  const before = [...list.children].find(x => x !== li && rel < x.offsetTop + x.offsetHeight / 2);
  if (before ? li.nextElementSibling !== before : list.lastElementChild !== li) agrSlide(list, () => before ? list.insertBefore(li, before) : list.appendChild(li));
}
function agrDragScroll() {
  if (!agrDrag) return;
  const y = agrDrag.y, top = 110, bottom = innerHeight - 70, d = y < top ? -Math.ceil((top - y) / 5) : y > bottom ? Math.ceil((y - bottom) / 5) : 0;
  if (d) { scrollBy(0, d); agrDragTo(y); }
  agrDrag.raf = requestAnimationFrame(agrDragScroll);
}
function agrDragEnd(cancel) {
  const d = agrDrag; if (!d) return; agrDrag = null; cancelAnimationFrame(d.raf);
  d.li.classList.remove('dragging'); d.list.classList.remove('sorting');
  if (cancel) { d.order.forEach(k => d.list.appendChild(d.list.querySelector(`[data-key="${k}"]`))); agrTermNos(d.list); return; }
  if (d.order.join() !== [...d.list.children].map(x => x.dataset.key).join()) agrTermsSave(d.list, d.li);
}
document.addEventListener('pointerdown', e => {
  const h = e.target.closest?.('.agr-drag'); if (!h || e.button > 0 || !agrEditable(AGR_ED)) return;
  e.preventDefault(); h.focus({ preventScroll: true }); h.setPointerCapture(e.pointerId);
  const li = h.closest('.agr-ti'), list = li.parentElement;
  agrDrag = { li, list, id: e.pointerId, y: e.clientY, order: [...list.children].map(x => x.dataset.key) };
  li.classList.add('dragging'); list.classList.add('sorting'); agrDrag.raf = requestAnimationFrame(agrDragScroll);
});
document.addEventListener('pointermove', e => { if (!agrDrag || e.pointerId !== agrDrag.id) return; agrDrag.y = e.clientY; agrDragTo(e.clientY); });
document.addEventListener('pointerup', e => { if (agrDrag && e.pointerId === agrDrag.id) agrDragEnd(false); });
document.addEventListener('pointercancel', e => { if (agrDrag && e.pointerId === agrDrag.id) agrDragEnd(true); });
document.addEventListener('keydown', e => {
  if (agrDrag && e.key === 'Escape') { agrDragEnd(true); return; }
  const h = e.target.closest?.('.agr-drag'); if (!h || !['ArrowUp', 'ArrowDown', 'Home', 'End'].includes(e.key) || !agrEditable(AGR_ED)) return;
  e.preventDefault();
  const li = h.closest('.agr-ti'), list = li.parentElement;
  const to = e.key === 'Home' ? list.firstElementChild : e.key === 'End' ? null : e.key === 'ArrowUp' ? li.previousElementSibling : li.nextElementSibling?.nextElementSibling ?? null;
  if ((e.key === 'ArrowUp' || e.key === 'Home') && (!to || to === li)) return;
  if (e.key === 'ArrowDown' && !li.nextElementSibling) return;
  agrSlide(list, () => list.insertBefore(li, to)); h.focus({ preventScroll: true }); agrTermsSave(list, li);
});

/* ---------- step 3: verify ---------- */
function agrVerifyStep(a) {
  const c = agrCalc(a), checks = agrChecks(a, AGR_LAST?.id === a.id && AGR_LAST.at === a.updatedAt ? AGR_LAST.layout : null), bad = checks.filter(x => x.ok === false).length, fin = a.status === 'Final';
  const d = agrDateParts(a.date), row = (l, v, f = '') => `<div class="agr-kv"><dt>${l}</dt><dd>${v || '<span class="muted">—</span>'}</dd>${f && agrEditable(a) ? `<button type="button" class="linkbtn" data-act="agrEditField" data-f="${f}">Edit</button>` : '<span></span>'}</div>`;
  const ta = v => v ? `<span class="ta">${esc(v)}</span>` : '';
  return `<div class="agr-verify">
    <section class="card"><div class="card-head"><div><h2>Checks</h2><p class="muted">${bad ? `${plural(bad, 'item')} to fix before the agreement can be finalized` : 'Nothing is blocking — read through the details and confirm'}</p></div></div>
      <ul class="agr-checks" id="agrChecks">${agrCheckItems(checks, a)}</ul></section>
    <section class="card"><div class="card-head"><div><h2>Details to confirm</h2><p class="muted">Compare these with the owner’s Aadhaar card, the site documents and the approved plan</p></div></div>
      <dl class="agr-dl">
        <div class="agr-dl-h">Agreement</div>
        ${row('Date', d ? `${fmtLong(a.date)}<span class="sub ta">${d.Y} ஆம் ஆண்டு ${d.M} மாதம் ${d.DD} ஆம் தேதி</span>` : '', 'date')}
        <div class="agr-dl-h">2nd party · Building owner</div>
        ${row('Name', ta(a.o.name), 'o.name')}${row('Relation', a.o.rel && a.o.father ? `${esc(a.o.rel)} ${ta(a.o.father)}` : '', 'o.father')}
        ${row('Aadhaar', digits(a.o.aadhaar) ? `<span class="mono">${fmtAadhaar(a.o.aadhaar)}</span>` : '', 'o.aadhaar')}${row('Residence', ta(a.o.place), 'o.place')}${row('Site', ta(a.site), 'site')}
        <div class="agr-dl-h">1st party · Contractor</div>
        ${row('Name', ta(a.c.title + a.c.name), 'c.name')}${row('Aadhaar', digits(a.c.aadhaar) ? `<span class="mono">${fmtAadhaar(a.c.aadhaar)}</span>` : '', 'c.aadhaar')}${row('Address', ta(a.c.address), 'c.address')}
        <div class="agr-dl-h">Value</div>
        ${a.floors.map((f, i) => row(esc(f.en || `Floor ${i + 1}`), `${esc(f.area || 0)} sq.ft × ₹${esc(f.rate || 0)} = <b>₹${agrRs(c.floors[i])}</b><span class="sub ta">${esc(f.ta)}</span>`, `floors.${i}.area`)).join('')}
        ${row('Special works', `<b>₹${agrRs(c.sp)}</b><span class="sub">${a.special.map(s => `${esc(s.d)} — ₹${agrRs(agrN(s.amt))}`).join('<br>')}</span><span class="sub ta">${esc(a.specialTa)}</span>`, 'specialTa')}
        ${row('Agreement value', `<b class="big">₹${agrRs(c.total)}</b><span class="sub">${agrWords(c.total)} RUPEES ONLY</span>`)}
        ${row('Payment schedule', `<b>₹${agrRs(c.sched)}</b> in ${plural(a.stages.length, 'stage')}<span class="sub">${a.stages.map(s => `${esc(s.n)}: ₹${agrRs(agrN(s.amt))}`).join(' · ')}</span>`, `stages.${a.stages.length - 1}.amt`)}
        ${row('Terms', Object.entries(AGR_TERM_SLOTS).map(([k, [l, , n]]) => `${esc(l.replace(/(, ₹)? \(term \d+\)/, ''))}: <span class="ta">${n ? '₹' + agrRs(agrN(a.terms[k])) : esc(a.terms[k])}</span>`).join('<br>'), 'terms.std')}
        ${row('Added terms', (a.customTerms || []).length ? agrTermList(a).map((x, n) => x.custom ? `<span class="sub ta">${n + 1}. ${esc(String(x.t.text || '').trim() || '—')}</span>` : '').join('') : 'None', 'customTerms.0.text')}
        ${row('Water tank', `${esc(a.tank.count)} ${esc(a.tank.mat)} ${esc(a.tank.cap)} ltr`, 'tank.count')}
      </dl></section>
    <section class="card agr-confirm">${fin
      ? `<div class="agr-done">${ico('check')}<div><b>Verified and finalized</b><span>by ${esc(userName(a.finalBy))} on ${fmtTs(a.finalAt)}. The agreement is locked.</span></div>${btn('Go to download', 'setQ', { icon: 'download', cls: 'primary', data: 'data-k="step" data-v="download"' })}</div>`
      : agrEditable(a) ? `<label class="check"><input type="checkbox" id="agrOk" ${bad ? 'disabled' : ''}> I have read the agreement in the live preview and checked the details above against the owner’s documents.</label>
        <div class="agr-confirm-acts"><button type="button" class="btn" data-act="agrPvOpen">${ico('eye', 'sm')}Open the live preview</button><button type="button" class="btn primary" data-act="agrFinalize" id="agrFinBtn" disabled>${ico('lock', 'sm')}Finalize agreement</button></div>
        <small class="muted">Finalizing locks the agreement so the PDF that is signed matches what was verified.</small>`
      : `<span class="muted">You can't finalize agreements with your role.</span>`}</section></div>
    ${agrNext(['terms', 'Back to terms'], fin ? ['download', 'Next: Download'] : null)}`;
}
const agrCheckItems = (checks, a) => checks.map(x => `<li class="${x.ok === true ? 'ok' : x.ok === 'warn' ? 'warn' : 'bad'}">${ico(x.ok === true ? 'check' : 'alert', 'sm')}<div><b>${esc(x.t)}</b>${x.s ? `<span>${esc(x.s)}</span>` : ''}</div>${x.ok !== true && x.f && agrEditable(a) ? `<button type="button" class="btn sm" data-act="agrEditField" data-f="${x.f}">Fix</button>` : ''}</li>`).join('');
document.addEventListener('change', e => { if (e.target.id === 'agrOk') { const b = $('#agrFinBtn'); if (b) b.disabled = !e.target.checked; } });

/* ---------- step 4: download ---------- */
function agrDownloadStep(a) {
  if (a.status !== 'Final') return `<div class="card pad agr-locked">${ico('lock', 'lg')}<div><h2>Verify the agreement first</h2><p class="muted">The PDF can be downloaded once the details have been verified and the agreement is finalized, so the copy that is signed is the one that was checked.</p></div>${btn('Go to Verify', 'setQ', { icon: 'shield', cls: 'primary', data: 'data-k="step" data-v="verify"' })}</div>${agrNext(['verify', 'Back to verify'], null)}`;
  return `<div class="agr-dl-grid">
    <section class="card pad agr-get"><h2>Download the agreement</h2>
      <p class="muted">An A4 PDF of every page exactly as in the preview, in Tamil, with the letterhead on every page and both parties’ signature lines on page 1 and the last page.</p>
      <div class="agr-get-acts"><button type="button" class="btn primary lg" data-act="agrPdf" id="agrPdfBtn">${ico('download')}Download PDF</button><button type="button" class="btn lg" data-act="agrPrint">${ico('print')}Print</button></div>
      <small class="muted">Print opens the browser’s print dialog; choosing <b>Save as PDF</b> there gives a PDF with selectable text. Set paper to A4 and margins to none.</small>
      ${a.downloads ? `<small class="muted">Downloaded ${plural(a.downloads, 'time')} · last ${fmtTs(a.lastDownload)}</small>` : ''}</section></div>
    ${agrNext(['verify', 'Back to verify'], null)}`;
}

/* ---------- live preview ---------- */
let agrRO = null, agrPvT = 0;
function agrMountPreview(a) {
  const pv = $('#agrPv');
  agrRO?.disconnect();
  if (pv) { agrRO = new ResizeObserver(() => agrScale()); agrRO.observe(pv); }
  agrFonts().then(() => { if (AGR_ED === a) agrRenderPreview(); });
}
// lays the pages out when the preview is open, or when the verify step needs them for its page-fit check
function agrRenderPreview() {
  const a = AGR_ED, pv = $('#agrPv'), ch = $('#agrChecks'), show = !!pv && AGR_PV_OPEN;
  if (!a || ROUTE.mod !== 'agreements' || (!show && !ch)) return;
  const layout = agrLayout(a);
  AGR_LAST = { id: a.id, at: a.updatedAt, layout };
  if (ch) ch.innerHTML = agrCheckItems(agrChecks(a, layout), a);
  $$('[data-agr-pages]').forEach(el => el.textContent = plural(layout.pages.length, 'page'));
  if (!show) return;
  const st = pv.scrollTop;
  pv.innerHTML = layout.pages.map((p, i) => `<div class="agr-sheet" aria-label="Page ${i + 1} of ${layout.pages.length}">${p}<span class="agr-pno">${i + 1} / ${layout.pages.length}</span></div>`).join('');
  pv.scrollTop = st;
  agrScale();
  const f = document.activeElement?.dataset?.agr; if (f) agrHl(f, false);
}
function agrScale() {
  const pv = $('#agrPv'); if (!pv) return;
  pv.style.setProperty('--s', Math.max(.2, Math.min(1, (pv.clientWidth - 28) / 793.7)).toFixed(4));
}
const agrPreviewSoon = () => { clearTimeout(agrPvT); agrPvT = setTimeout(agrRenderPreview, 220); };
// highlights a field's value in the preview and brings it into view
function agrHl(path, scroll = true) {
  const pv = $('#agrPv'); if (!pv || !AGR_PV_OPEN) return;
  $$('.agr-v.hl', pv).forEach(x => x.classList.remove('hl'));
  const hits = $$('.agr-v', pv).filter(x => x.dataset.f.split(' ').includes(path) || (path.startsWith('special.') && x.dataset.f === 'special') || (path.startsWith('stages.') && path.endsWith('.amt') && x.dataset.f === 'stages'));
  hits.forEach(x => x.classList.add('hl'));
  const h = hits[0]; if (!h || !scroll) return;
  const r = h.getBoundingClientRect(), pr = pv.getBoundingClientRect();
  if (r.top < pr.top + 20 || r.bottom > pr.bottom - 20) pv.scrollTo({ top: pv.scrollTop + r.top - pr.top - pv.clientHeight / 3, behavior: 'smooth' });
}
function agrOuts() {
  const a = AGR_ED, c = agrCalc(a), set = (k, v) => $$(`[data-agr-out="${k}"]`).forEach(o => o.textContent = v);
  c.floors.forEach((v, i) => set('fl' + i, '₹' + agrRs(v)));
  ['fl', 'sp', 'total', 'sched'].forEach(k => set(k, '₹' + agrRs(c[k])));
  set('diff', c.diff ? '₹' + agrRs(Math.abs(c.diff)) + (c.diff > 0 ? ' short' : ' over') : 'Matches');
  const d = $('[data-agr-diff]'); if (d) d.className = c.diff ? 'bad' : 'ok';
  agrTocSync();
}
document.addEventListener('input', e => {
  const el = e.target.closest?.('[data-agr]'), a = AGR_ED;
  if (!el || !a || ROUTE.mod !== 'agreements' || !agrEditable(a)) return;
  const p = el.dataset.agr, k = el.dataset.kind;
  let v = el.value;
  if (k === 'aadhaar') { const f = fmtAadhaar(v); if (el.value !== f) el.value = f; v = digits(v).slice(0, 12); const h = $(`[data-agr-aad="${p}"]`); if (h) h.innerHTML = agrAadHint(v); }
  else if (k === 'num') v = el.value === '' ? '' : +el.value;
  agrSet(a, p, v);
  if (/^floors\.\d+\.ta$/.test(p)) delete agrGet(a, p.replace(/\.ta$/, '')).ta2;
  if (el.classList.contains('agr-slot')) el.style.width = agrSlotW(el.value, k === 'num');
  if (p === 'project' && v) { const pr = proj(v); if (pr && !a.site) { a.site = `${pr.location}, ${pr.city}`; const s = $('[data-agr="site"]'); if (s) s.value = a.site; } }
  if (p === 'date' && v && a.status !== 'Final' && a.ref && !a.ref.includes(`/${fyOf(v)}/`)) a.ref = agrRef(v);
  agrTouch(a); agrOuts(); agrPreviewSoon();
  if (/^floors\.\d+\.en$/.test(p)) { const h = $('#agrs-progress .card-head p'); if (h) h.textContent = `Page 3 · Work progress for ${agrFlList(a)} construction`; }
});
document.addEventListener('focusin', e => { const el = e.target.closest?.('[data-agr]'); if (el && ROUTE.mod === 'agreements') agrHl(el.dataset.agr); });

/* ---------- editing actions ---------- */
const agrRowsOf = k => k === 'special' ? AGR_ED.special : k === 'stages' ? AGR_ED.stages : AGR_ED.tables[k];
function agrChange(fn, msg) { const a = AGR_ED; if (!guard(agrEditable(a), 'change this agreement')) return; fn(a); agrTouch(a); saveAgrs(); renderView(); if (msg) toast(msg); }
ACT.agrAddRow = el => agrChange(() => { const k = el.dataset.k, l = agrRowsOf(k);
  if (k === 'special') l.push({ d: '', amt: '' }); else if (k === 'stages') l.push({ n: `stage-${l.length + 1}`, d: '', amt: '' }); else l.push({ c: AGR_TBL[k].head.map(() => ''), s: '' });
  after(() => { const ins = $$(`[data-agr^="${k === 'special' || k === 'stages' ? k : 'tables.' + k}.${l.length - 1}."]`); ins[0]?.focus(); });
});
ACT.agrAddFloor = () => agrChange(a => { const n = a.floors.length, last = a.floors[n - 1];
  a.floors.push({ ...agrFloorDef(n), area: '', rate: last ? last.rate : '' });
  after(() => $(`[data-agr="floors.${n}.area"]`)?.focus()); }, `${agrFloorDef(AGR_ED?.floors.length || 0).en} added`);
ACT.agrDelFloor = el => { const a = AGR_ED, i = +el.dataset.i, f = a?.floors[i]; if (!f || a.floors.length < 2) return;
  const go = () => agrChange(x => x.floors.splice(i, 1), `${f.en || 'Floor'} removed`);
  if (agrN(f.area)) confirmBox('Remove this floor?', `<b>${esc(f.en)}</b> (${esc(f.area)} sq.ft) will be taken out of the agreement and its amount removed from the total.`, 'Remove floor', go, true); else go(); };
ACT.agrDelRow = el => agrChange(() => agrRowsOf(el.dataset.k).splice(+el.dataset.i, 1));
ACT.agrResetTable = el => { const k = el.dataset.k; if (!guard(agrEditable(AGR_ED), 'change this agreement')) return;
  confirmBox('Restore the template rows?', `The <b>${esc(AGR_TBL[k].label)}</b> table goes back to the rows in the company template. Your changes to it are lost.`, 'Restore', () => agrChange(a => { a.tables[k] = agrClone(AGR_ROWS[k]); }, 'Template rows restored')); };
ACT.agrBalance = () => agrChange(a => { const c = agrCalc(a), last = a.stages[a.stages.length - 1]; if (!last) return; last.amt = Math.max(0, agrN(last.amt) + c.diff); }, 'Balance put in the last stage');
ACT.agrEditField = el => { const f = el.dataset.f; setQ({ step: /^(terms|customTerms)\./.test(f) ? 'terms' : 'fill' });
  requestAnimationFrame(() => { const i = $(`[data-agr="${f}"]`); if (!i) return; agrScrollTo(i, innerHeight / 3); i.focus({ preventScroll: true }); }); };
ACT.agrFinalize = () => {
  const a = AGR_ED; if (!guard(agrEditable(a), 'finalize agreements')) return;
  if (!$('#agrOk')?.checked) { toast('Tick the box to confirm you have checked the details', 'lock'); return; }
  agrFonts().then(() => {
    const layout = agrLayout(a), bad = agrChecks(a, layout).filter(x => x.ok === false);
    if (bad.length) { toast(bad[0].t, 'lock'); renderView(); return; }
    Object.assign(a, { status: 'Final', finalAt: Date.now(), finalBy: SESSION }); agrTouch(a); saveAgrs();
    logAct(`finalized agreement ${a.ref} for ${a.o.name}`, a.project || null, 'ok');
    setQ({ step: 'download' }); renderShell(); toast('Agreement verified and finalized');
  });
};
ACT.agrReopen = () => { const a = AGR_ED; if (!guard(role() === 'owner', 'reopen a final agreement')) return;
  confirmBox('Edit this agreement again?', 'It goes back to draft and has to be verified and finalized again before it can be downloaded.', 'Reopen as draft', () => { a.status = 'Draft'; delete a.finalAt; delete a.finalBy; agrTouch(a); saveAgrs(); logAct(`reopened agreement ${a.ref}`); setQ({ step: 'fill' }); renderShell(); toast('Reopened as a draft'); }); };

/* ---------- PDF and print ---------- */
const agrFileName = a => `Agreement ${(a.ref || 'draft').replace(/\//g, '-')} ${a.date ? a.date.split('-').reverse().join('-') : ''}`.trim() + '.pdf';
ACT.agrPdf = async el => {
  const a = AGR_ED; if (a?.status !== 'Final') return;
  const label = el.innerHTML; el.disabled = true;
  const say = t => { el.innerHTML = `${ico('clock', 'sm')}${t}`; };
  let host = null;
  try {
    say('Loading…'); await Promise.all([agrLibs(), agrFonts()]);
    const { pages } = agrLayout(a);
    host = document.createElement('div'); host.className = 'agr-doc agr-render'; host.innerHTML = pages.join(''); document.body.appendChild(host);
    await Promise.all($$('img', host).map(i => i.decode?.().catch(() => null)));
    const pdf = new window.jspdf.jsPDF({ unit: 'mm', format: 'a4', compress: true });
    const els = $$('.agr-page', host);
    for (let i = 0; i < els.length; i++) {
      say(`Page ${i + 1} of ${els.length}…`);
      const cv = await html2canvas(els[i], { scale: 2.4, backgroundColor: '#ffffff', logging: false, useCORS: true,
        ignoreElements: n => n.id === 'appRoot' || n.id === 'loginRoot' || n.tagName === 'DIALOG' || n.classList?.contains('agr-measure'),
        onclone: d => { const h = d.querySelector('.agr-render'); if (h) h.style.left = '0px'; } });
      if (i) pdf.addPage();
      pdf.addImage(cv.toDataURL('image/jpeg', .86), 'JPEG', 0, 0, 210, 297, undefined, 'FAST');
    }
    pdf.setProperties({ title: `கட்டிட ஒப்பந்தப் பத்திரம் — ${a.o.name}`, subject: `Building agreement ${a.ref}`, author: 'Scale Space Builders', creator: 'Scale Space Builders' });
    pdf.save(agrFileName(a));
    a.downloads = (a.downloads || 0) + 1; a.lastDownload = Date.now(); saveAgrs();
    logAct(`downloaded agreement ${a.ref}`, a.project || null);
    toast(`Downloaded ${agrFileName(a)}`);
  } catch (e) {
    toast(/library/.test(e.message) ? 'The PDF tools could not load — check the internet connection, or use Print › Save as PDF' : 'The PDF could not be made — try Print › Save as PDF', 'lock');
  } finally { host?.remove(); el.disabled = false; el.innerHTML = label; if (ROUTE.q.step === 'download') renderView(); }
};
ACT.agrPrint = () => {
  const a = AGR_ED; if (a?.status !== 'Final') return;
  agrFonts().then(() => {
    const { pages } = agrLayout(a), base = location.href.replace(/[#?].*$/, '').replace(/[^/]*$/, '');
    const f = document.createElement('iframe'); f.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0';
    f.srcdoc = `<!doctype html><html lang="ta"><head><meta charset="utf-8"><title>${esc(agrFileName(a).replace(/\.pdf$/, ''))}</title><base href="${esc(base)}"><link rel="stylesheet" href="${AGR_FONT_URL}"><link rel="stylesheet" href="css/agreements.css"><style>@page{size:A4;margin:0}html,body{margin:0;background:#fff}</style></head><body class="agr-doc agr-print">${pages.join('')}</body></html>`;
    f.onload = async () => {
      const d = f.contentDocument;
      try { await agrLoadFaces(d); await d.fonts.ready; } catch { }
      try { f.contentWindow.focus(); f.contentWindow.print(); } catch { toast('Printing is blocked in this browser', 'lock'); }
      setTimeout(() => f.remove(), 2000);
    };
    document.body.appendChild(f);
    toast('Choose “Save as PDF” in the print dialog for a PDF copy');
  });
};
