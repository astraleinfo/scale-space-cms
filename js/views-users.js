/* Users › invite / edit with a full profile: photo, mobile, alternate contact (and how they are related), Aadhaar
   number + card, address and role. Also the profile drawer opened from the users list. Aadhaar numbers are shown
   masked everywhere except in the edit form; the card can be opened only by people who can manage that user.
   Photos and cards are kept in browser storage in this demo (images are shrunk first). */
'use strict';

IC.idcard = '<rect x="3" y="5" width="18" height="14" rx="2.5"/><circle cx="9" cy="11" r="2.2"/><path d="M5.8 16c.6-1.5 1.8-2.3 3.2-2.3s2.6.8 3.2 2.3M14.5 10h4M14.5 13.5h3"/>';
IC.contact = '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"/><path d="M15 3.5a6 6 0 0 1 5.5 5.5M15 7a2.6 2.6 0 0 1 2 2"/>';

const IN_STATES = ['Tamil Nadu', 'Puducherry', 'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal', 'Andaman and Nicobar Islands', 'Chandigarh', 'Dadra and Nagar Haveli and Daman and Diu', 'Delhi', 'Jammu and Kashmir', 'Ladakh', 'Lakshadweep'];
const digits = s => String(s ?? '').replace(/\D/g, '');
const fmtAadhaar = s => digits(s).slice(0, 12).replace(/(\d{4})(?=\d)/g, '$1 ');
const maskAadhaar = s => digits(s).length === 12 ? `XXXX XXXX ${digits(s).slice(-4)}` : '';
const mobile10 = s => { const d = digits(s); return d.length === 12 && d.startsWith('91') ? d.slice(2) : d; };
const fmtMobile = s => { const d = mobile10(s); return d.length === 10 ? `+91 ${d.slice(0, 5)} ${d.slice(5)}` : s || ''; };
const okMobile = s => /^[6-9]\d{9}$/.test(mobile10(s));
// Aadhaar numbers end in a Verhoeff check digit and never start with 0 or 1
const VH_D = [[0,1,2,3,4,5,6,7,8,9],[1,2,3,4,0,6,7,8,9,5],[2,3,4,0,1,7,8,9,5,6],[3,4,0,1,2,8,9,5,6,7],[4,0,1,2,3,9,5,6,7,8],[5,9,8,7,6,0,4,3,2,1],[6,5,9,8,7,1,0,4,3,2],[7,6,5,9,8,2,1,0,4,3],[8,7,6,5,9,3,2,1,0,4],[9,8,7,6,5,4,3,2,1,0]];
const VH_P = [[0,1,2,3,4,5,6,7,8,9],[1,5,7,6,2,8,3,0,9,4],[5,8,0,3,7,9,6,1,4,2],[8,9,1,6,0,4,3,5,2,7],[9,4,5,3,1,2,6,8,7,0],[4,2,8,6,5,7,3,9,0,1],[2,7,9,3,8,0,6,4,1,5],[7,0,4,6,9,1,3,2,5,8]];
const okAadhaar = s => { const d = digits(s); if (!/^[2-9]\d{11}$/.test(d)) return false; let c = 0; [...d].reverse().forEach((x, i) => c = VH_D[c][VH_P[i % 8][+x]]); return c === 0; };

/* Aadhaar and address are mandatory; users added before that rule are flagged until someone completes them */
const kycMissing = u => !u.aadhaar || !u.aadhaarCard || !u.address;
/* avatars show the profile photo when there is one */
const avPhoto = name => DB?.users?.find(u => u.name === name && u.photo)?.photo;

/* ---------- image helpers ---------- */
const readURL = f => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(f); });
const loadImg = src => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });
async function shrinkImage(f, max, square) {
  const img = await loadImg(await readURL(f)), c = document.createElement('canvas'), x = c.getContext('2d');
  if (square) { const s = Math.min(img.width, img.height); c.width = c.height = max; x.drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, max, max); }
  else { const k = Math.min(1, max / Math.max(img.width, img.height)); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k); x.drawImage(img, 0, 0, c.width, c.height); }
  return c.toDataURL('image/jpeg', square ? .82 : .74);
}

/* ---------- form ---------- */
let UF = { photo: null, card: null };
const roleOk = k => canAssignRole(k);
function roleInfo(k) {
  const r = ROLES[k], mods = MODULES.filter(m => (PERMS[k]?.[m.id] || 'none') !== 'none');
  return `<div class="uf-role-i"><span class="uf-role-ic">${ico(hasFinAccess(k) ? 'rupee' : 'user', 'sm')}</span><div><b>${esc(r.label)}${hasFinAccess(k) ? ' <span class="tag fin-tag">Financial</span>' : ''}</b><p>${esc(r.desc)}</p>
    <div class="uf-mods">${mods.map(m => `<span class="${PERMS[k][m.id] === 'view' ? 'v' : ''}" title="${PERMS[k][m.id] === 'view' ? 'View only' : 'Full access'}">${esc(m.label)}</span>`).join('') || '<span class="muted">No modules</span>'}</div></div></div>`;
}
function photoBox(u) {
  const p = UF.photo;
  return `<div class="uf-ph ${p ? 'has' : ''}">${p ? `<img src="${p}" alt="Profile photo">` : u.name ? `<span class="uf-ini" style="--av:${avColor(u.name)}">${esc(initials(u.name))}</span>` : ico('user')}</div>
    <div class="uf-ph-acts"><label class="btn xs">${ico('camera', 'sm')}${p ? 'Change' : 'Upload photo'}<input type="file" accept="image/*" data-uf="photo" hidden></label>${p ? `<button type="button" class="btn xs ghost" data-act="ufDrop" data-k="photo">Remove</button>` : ''}</div>`;
}
function cardBox() {
  const c = UF.card;
  if (!c) return `<label class="uf-drop">${ico('upload')}<span><b>Upload Aadhaar card</b><small>Photo or PDF of the front and back · up to 2 MB</small></span><input type="file" accept="image/*,application/pdf" data-uf="card" hidden></label>`;
  return `<div class="uf-file"><span class="uf-file-t">${c.type === 'pdf' ? `<span class="uf-pdf">PDF</span>` : `<img src="${c.src}" alt="">`}</span><span class="nm"><b>${esc(c.name)}</b><small>${c.type === 'pdf' ? 'PDF document' : 'Image'} · ${Math.max(1, Math.round(c.size / 1024))} KB</small></span>
    <button type="button" class="btn xs" data-act="ufView">View</button><label class="btn xs">Replace<input type="file" accept="image/*,application/pdf" data-uf="card" hidden></label><button type="button" class="iconbtn" data-act="ufDrop" data-k="card" aria-label="Remove card">${ico('trash', 'sm')}</button></div>`;
}
const sec = (n, icon, title, sub, body) => `<section class="uf-sec"><header><span class="uf-n">${ico(icon, 'sm')}</span><div><h3>${title}</h3>${sub ? `<p>${sub}</p>` : ''}</div></header>${body}</section>`;
function profileForm(u = {}) {
  const roleSel = u.role || 'engineer', a = u.address || {}, alt = u.alt || {};
  const roleOpts = Object.entries(ROLES).map(([k, r]) => `<option value="${k}" ${k === roleSel ? 'selected' : ''} ${roleOk(k) || k === u.role ? '' : 'disabled'}>${esc(r.label)}${hasFinAccess(k) ? ' · financial' : ''}${roleOk(k) || k === u.role ? '' : ' (Owner only)'}</option>`).join('');
  return `<div class="form uf">
    <section class="uf-sec uf-top"><div class="uf-photo" id="ufPhoto">${photoBox(u)}</div>
      <div class="uf-main"><div class="row2">${fld('Full name', 'name', { req: true, value: u.name, ph: 'As on Aadhaar' })}${fld('Job title', 'title', { value: u.title, ph: 'e.g. Site Engineer' })}</div>
        <div class="row2">${fld('Email', 'email', { type: 'email', req: true, value: u.email, ph: 'name@example.com', hint: u.id ? '' : 'The invite is sent here' })}
          <label class="field"><span>Mobile number <em>*</em></span><div class="uf-tel"><span>+91</span><input class="input" type="tel" name="phone" inputmode="numeric" maxlength="11" required value="${esc(fmtMobile(u.phone).replace('+91 ', ''))}" placeholder="98765 43210" data-uf-fmt="tel"></div></label></div></div></section>
    ${sec(1, 'shield', 'Role &amp; access', 'Decides which pages and actions they can use.', `<label class="field"><span>Role <em>*</em></span><select class="select" name="role" id="ufRole">${roleOpts}</select></label><div id="ufRoleInfo">${roleInfo(roleSel)}</div>`)}
    ${sec(2, 'contact', 'Alternate contact', 'Someone we can reach in an emergency.', `<div class="uf-3">
      <label class="field"><span>Alternate mobile</span><div class="uf-tel"><span>+91</span><input class="input" type="tel" name="altPhone" inputmode="numeric" maxlength="11" value="${esc(alt.phone ? fmtMobile(alt.phone).replace('+91 ', '') : '')}" placeholder="98765 43210" data-uf-fmt="tel"></div></label>
      ${fld('Contact person', 'altName', { value: alt.name, ph: 'Their name' })}
      <label class="field"><span>Relationship to ${u.name ? esc(u.name.split(' ')[0]) : 'the user'}</span><select class="select" name="altRel"><option value="">Select…</option>${RELATIONS.map(r => `<option ${r === alt.rel ? 'selected' : ''}>${esc(r)}</option>`).join('')}</select></label></div>`)}
    ${sec(3, 'idcard', 'Aadhaar', 'Required for KYC and payroll records. Shown masked in the app.', `<div class="uf-aad">
      <label class="field"><span>Aadhaar number <em>*</em></span><input class="input mono" name="aadhaar" required inputmode="numeric" maxlength="14" autocomplete="off" value="${esc(fmtAadhaar(u.aadhaar))}" placeholder="XXXX XXXX XXXX" data-uf-fmt="aadhaar"><small id="ufAadOk">12 digits, as printed on the card</small></label>
      <div class="field" id="ufCardF"><span>Aadhaar card <em>*</em></span><input type="hidden" name="cardOk" id="ufCardOk" required value="${UF.card ? 1 : ''}"><div id="ufCard">${cardBox()}</div></div></div>`)}
    ${sec(4, 'home', 'Address', 'Current residential address. All fields are required.', `${fld('House no., street, area', 'addrLine', { type: 'textarea', rows: 2, req: true, value: a.line, ph: 'e.g. 12, Pattamangala Street, near Mayura Theatre' })}
      <div class="uf-3">${fld('City / town', 'addrCity', { req: true, value: a.city, ph: 'Mayiladuthurai' })}${fld('State', 'addrState', { req: true, opts: IN_STATES, value: a.state || 'Tamil Nadu' })}
      <label class="field"><span>PIN code <em>*</em></span><input class="input mono" name="addrPin" required inputmode="numeric" maxlength="6" value="${esc(a.pin || '')}" placeholder="609001" data-uf-fmt="pin"></label></div>`)}
  </div>`;
}
function bindProfileForm(m) {
  $$('[data-uf-fmt]', m).forEach(el => el.addEventListener('input', () => {
    const k = el.dataset.ufFmt, d = digits(el.value);
    el.value = k === 'aadhaar' ? fmtAadhaar(d) : k === 'pin' ? d.slice(0, 6) : d.slice(0, 10).replace(/^(\d{5})(\d)/, '$1 $2');
    if (k === 'aadhaar') { const s = $('#ufAadOk'); const n = d.length; s.className = n === 12 ? (okAadhaar(d) ? 'ok' : 'bad') : ''; s.textContent = n === 12 ? (okAadhaar(d) ? '✓ Valid Aadhaar number' : 'This is not a valid Aadhaar number') : `${n} of 12 digits`; }
  }));
  m.addEventListener('input', e => { const f = e.target.closest('.field.err'); if (f) { f.classList.remove('err'); $('.msg', f)?.remove(); } });
  m.addEventListener('change', e => { const f = e.target.closest('.field.err'); if (f && e.target.tagName === 'SELECT') { f.classList.remove('err'); $('.msg', f)?.remove(); } });
  $('#ufRole', m).addEventListener('change', e => $('#ufRoleInfo').innerHTML = roleInfo(e.target.value));
  $('[name=name]', m).addEventListener('input', e => { if (!UF.photo) $('#ufPhoto').innerHTML = photoBox({ name: e.target.value.trim() }); });
  m.addEventListener('change', async e => {
    const inp = e.target.closest('[data-uf]'); if (!inp || !inp.files[0]) return;
    const f = inp.files[0], k = inp.dataset.uf;
    try {
      if (k === 'photo') { if (!f.type.startsWith('image/')) throw new Error('Choose an image file'); UF.photo = await shrinkImage(f, 192, true); $('#ufPhoto').innerHTML = photoBox({ name: $('[name=name]', m).value }); }
      else {
        if (f.size > 2 * 1024 * 1024) throw new Error('The file is larger than 2 MB');
        const pdf = f.type === 'application/pdf';
        if (!pdf && !f.type.startsWith('image/')) throw new Error('Upload a photo or a PDF');
        const src = pdf ? await readURL(f) : await shrinkImage(f, 1100);
        UF.card = { name: f.name, type: pdf ? 'pdf' : 'image', src, size: Math.round(src.length * .75), at: Date.now() };
        $('#ufCard').innerHTML = cardBox(); $('#ufCardOk').value = 1; const cf = $('#ufCardF'); cf.classList.remove('err'); $('.msg', cf)?.remove();
      }
    } catch (err) { toast(err.message || 'Could not read that file', 'lock'); }
  });
}
ACT.ufDrop = el => { UF[el.dataset.k] = null; if (el.dataset.k === 'photo') $('#ufPhoto').innerHTML = photoBox({ name: $('#modal [name=name]').value }); else { $('#ufCard').innerHTML = cardBox(); $('#ufCardOk').value = ''; } };
ACT.ufView = () => openCard(UF.card);
function openCard(c) {
  if (!c) return;
  const w = window.open('', '_blank'); if (!w) { toast('Allow pop-ups to view the card', 'lock'); return; }
  w.document.title = c.name;
  w.document.body.style.cssText = 'margin:0;background:#222;display:grid;place-items:center;min-height:100vh';
  if (c.type === 'pdf') { w.document.body.innerHTML = `<iframe style="border:0;width:100vw;height:100vh" title="Aadhaar card"></iframe>`; fetch(c.src).then(r => r.blob()).then(b => { w.document.querySelector('iframe').src = URL.createObjectURL(b); }); }
  else { const i = w.document.createElement('img'); i.src = c.src; i.alt = 'Aadhaar card'; i.style.cssText = 'max-width:96vw;max-height:96vh'; w.document.body.appendChild(i); }
}

/* field-level errors in the same style as the built-in required check */
function fieldErr(form, name, msg) {
  const f = $(`[name=${name}]`, form)?.closest('.field'); if (!f) return;
  f.classList.add('err'); $('.msg', f)?.remove(); f.insertAdjacentHTML('beforeend', `<span class="msg">${esc(msg)}</span>`);
}
function readProfile(d, form, u) {
  const errs = [];
  const bad = (n, m) => { errs.push(n); fieldErr(form, n, m); };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email)) bad('email', 'Enter a valid email address');
  else if (DB.users.some(x => x !== u && x.email.toLowerCase() === d.email.toLowerCase())) bad('email', 'Another user already has this email');
  if (!okMobile(d.phone)) bad('phone', 'Enter a 10-digit mobile number');
  if (d.altPhone) {
    if (!okMobile(d.altPhone)) bad('altPhone', 'Enter a 10-digit mobile number');
    else if (mobile10(d.altPhone) === mobile10(d.phone)) bad('altPhone', 'Use a different number from the main mobile');
    if (!d.altRel) bad('altRel', 'Choose how they are related');
    if (!d.altName) bad('altName', 'Enter the contact person’s name');
  } else if (d.altName || d.altRel) bad('altPhone', 'Enter the alternate mobile number');
  {
    if (!okAadhaar(d.aadhaar)) bad('aadhaar', digits(d.aadhaar).length !== 12 ? 'Aadhaar has 12 digits' : 'This is not a valid Aadhaar number');
    else if (DB.users.some(x => x !== u && digits(x.aadhaar) === digits(d.aadhaar))) bad('aadhaar', 'This Aadhaar number is already on another user');
  }
  if (!UF.card) { errs.push('card'); const f = $('#ufCardF', form); f.classList.add('err'); $('.msg', f)?.remove(); f.insertAdjacentHTML('beforeend', '<span class="msg">Upload a photo or PDF of the Aadhaar card</span>'); }
  if (!/^[1-9]\d{5}$/.test(d.addrPin)) bad('addrPin', 'Enter a 6-digit PIN code');
  if (errs.length) { const el = errs[0] === 'card' ? $('#ufCardF', form) : $(`[name=${errs[0]}]`, form); el?.focus(); el?.scrollIntoView({ block: 'center', behavior: 'smooth' }); return null; }
  return {
    name: d.name, title: d.title || ROLES[d.role].label, email: d.email, phone: fmtMobile(d.phone), role: d.role,
    photo: UF.photo, aadhaar: digits(d.aadhaar), aadhaarCard: UF.card,
    alt: d.altPhone ? { phone: fmtMobile(d.altPhone), name: d.altName, rel: d.altRel } : null,
    address: { line: d.addrLine, city: d.addrCity, state: d.addrState, pin: d.addrPin },
  };
}
const formFoot = lbl => `<span class="uf-foot-note">${ico('lock', 'sm')}Aadhaar details are visible only to people who manage users.</span><button type="button" class="btn" data-act="closeModal">Cancel</button><button type="submit" class="btn primary">${lbl}</button>`;

ACT.inviteUser = () => {
  if (!guard(can('users'), 'invite users')) return;
  UF = { photo: null, card: null };
  openModal({ title: 'Invite user', sub: 'They will get an email and SMS to set up their account.', wide: true, body: profileForm(), foot: formFoot(`${ico('send', 'sm')}Send invite`), onOpen: bindProfileForm,
    onSubmit: (d, f) => {
      if (!canAssignRole(d.role)) { toast('Only the Owner can assign a role with financial access', 'lock'); return false; }
      const p = readProfile(d, f, null); if (!p) return false;
      DB.users.push({ id: nid('u'), ...p, status: 'Invited', last: null, invitedBy: SESSION, invitedAt: Date.now() });
      logAct(`invited ${p.name} as ${ROLES[p.role].label}`, null, 'user'); commit(`Invite sent to ${p.email} and ${p.phone}`);
    } });
};
ACT.editUser = el => {
  const u = user(el.dataset.id); if (!guard(can('users') && canManageUser(u), 'edit this user')) return;
  UF = { photo: u.photo || null, card: u.aadhaarCard || null };
  closeDrawer();
  openModal({ title: 'Edit user', sub: esc(u.email), wide: true, body: profileForm(u), foot: formFoot('Save changes'), onOpen: bindProfileForm,
    onSubmit: (d, f) => {
      const r = d.role;
      if (r !== u.role && !canAssignRole(r)) { toast('Only the Owner can assign a role with financial access', 'lock'); return false; }
      if (u.id === SESSION && r !== 'owner' && u.role === 'owner' && !DB.users.some(x => x.id !== u.id && x.role === 'owner' && x.status === 'Active')) { toast('At least one active owner is required', 'lock'); return false; }
      const p = readProfile(d, f, u); if (!p) return false;
      const roleChanged = r !== u.role;
      Object.assign(u, p);
      logAct(roleChanged ? `changed ${u.name}'s role to ${ROLES[r].label}` : `updated ${u.name}'s profile`, null, 'user'); commit('User updated');
    } });
};

/* ---------- profile drawer ---------- */
function viewUser(id) {
  const u = user(id); if (!u) return;
  const mng = can('users') && canManageUser(u), self = u.id === SESSION, see = mng || self, a = u.address, ps = userProjects(u);
  const row = (k, v) => `<div><dt>${k}</dt><dd>${v || '<span class="muted">Not added</span>'}</dd></div>`;
  openDrawer(esc(u.name), u.title && u.title !== ROLES[u.role].label ? `${esc(u.title)} · ${esc(ROLES[u.role].label)}` : esc(ROLES[u.role].label), `
    <div class="up-hero">${u.photo ? `<img class="up-ph" src="${u.photo}" alt="">` : `<span class="up-ph av" style="--av:${avColor(u.name)}">${esc(initials(u.name))}</span>`}
      <div><b>${esc(u.name)}</b><span>${esc(u.title)}</span><div class="up-tags">${badge(u.status)}${u.title !== ROLES[u.role].label ? `<span class="tag">${esc(ROLES[u.role].label)}</span>` : ''}${hasFinAccess(u.role) ? '<span class="tag fin-tag">Financial</span>' : ''}</div></div></div>
    ${mng && kycMissing(u) ? `<div class="banner warn">${ico('alert')}<span>Aadhaar and address details are required. <button type="button" class="linkbtn" data-act="editUser" data-id="${u.id}">Complete the profile</button></span></div>` : ''}
    <div class="up-sec"><h3>${ico('contact', 'sm')}Contact</h3><dl class="dl c1">
      ${row('Email', `<a href="mailto:${esc(u.email)}">${esc(u.email)}</a>`)}${row('Mobile', u.phone && u.phone !== '—' ? `<a href="tel:${esc(digits(u.phone))}">${esc(fmtMobile(u.phone))}</a>` : '')}
      ${row('Alternate contact', u.alt ? `<a href="tel:${esc(digits(u.alt.phone))}">${esc(u.alt.phone)}</a><span class="sub" style="display:block">${esc(u.alt.name)} · ${esc(u.alt.rel)}</span>` : '')}</dl></div>
    ${see ? `<div class="up-sec"><h3>${ico('idcard', 'sm')}Aadhaar</h3><dl class="dl c1">${row('Aadhaar number', u.aadhaar ? `<span class="mono">${maskAadhaar(u.aadhaar)}</span>` : '')}
      ${row('Aadhaar card', u.aadhaarCard ? `<button type="button" class="btn xs" data-act="viewCard" data-id="${u.id}">${ico('eye', 'sm')}View ${u.aadhaarCard.type === 'pdf' ? 'PDF' : 'card'}</button>` : '')}</dl></div>
    <div class="up-sec"><h3>${ico('home', 'sm')}Address</h3><p class="up-addr">${a ? [a.line, [a.city, a.state].filter(Boolean).join(', ') + (a.pin ? ` – ${esc(a.pin)}` : '')].filter(Boolean).map(esc).join('<br>') : '<span class="muted">Not added</span>'}</p></div>` : ''}
    ${profileComp(u)}
    <div class="up-sec"><h3>${ico('building', 'sm')}Projects</h3><p>${['owner', 'sysadmin', 'accounts', 'admin'].includes(u.role) ? '<span class="muted">All projects</span>' : ps.length ? ps.map(p => esc(p.name)).join(', ') : '<span class="muted">None assigned</span>'}</p></div>
    ${u.status === 'Invited' && u.invitedAt ? `<p class="muted" style="font-size:12.5px">Invited ${ago(u.invitedAt)} by ${esc(userName(u.invitedBy))}.</p>` : ''}`,
    `${mng && u.status === 'Invited' ? `<button class="btn left" data-act="resendInvite" data-id="${u.id}">${ico('mail', 'sm')}Resend invite</button>` : ''}${mng ? `<button class="btn" data-act="editUser" data-id="${u.id}">${ico('edit', 'sm')}Edit</button>` : ''}<button class="btn primary" data-act="closeDrawer">Done</button>`);
}
/* salary and last appraisal in the profile: salary only for people allowed to see it */
function profileComp(u) {
  const c = canSeeSalary(u) && curRev(u.id), h = c && lastHike(u.id), a = u.role !== 'owner' && canSee('performance') && lastAppraisal(u.id);
  if (!c && !a) return '';
  return `<div class="up-sec"><h3>${ico(c ? 'rupee' : 'star', 'sm')}${c ? 'Salary &amp; appraisal' : 'Last appraisal'}</h3><dl class="dl">
    ${c ? `<div><dt>Current CTC</dt><dd class="strong">${sal(c.ctc)}<span class="sub">${sal(c.ctc / 12)} a month</span></dd></div><div><dt>Last increment</dt><dd>${h ? `<span class="chg up">+${h.pct}%</span><span class="sub">${fmtDY(h.effective)}</span>` : '—'}</dd></div>
      <div><dt>Bonus · ${fyLabel(TODAY)}</dt><dd>${sal(fyBonus(u.id))}</dd></div>` : ''}
    ${a ? `<div><dt>Last appraisal</dt><dd>${stars(a.rating)} <b>${a.rating}</b><span class="sub">${esc(a.label)} · ${esc(userName(a.reviewer))}</span></dd></div>` : ''}</dl>
    ${c ? `<button type="button" class="btn sm" style="margin-top:12px" data-act="openComp" data-u="${u.id}">${ico('history', 'sm')}Salary history &amp; bonuses</button>` : a ? `<button type="button" class="btn sm" style="margin-top:12px" data-act="viewAppraisal" data-id="${a.id}">Full appraisal</button>` : ''}</div>`;
}
ACT.viewUser = el => viewUser(el.dataset.id);
ACT.viewCard = el => { const u = user(el.dataset.id); if (!guard(can('users') && canManageUser(u) || u.id === SESSION, 'view this Aadhaar card')) return; openCard(u.aadhaarCard); };
