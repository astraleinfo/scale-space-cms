/* Analytics (owner): one page that answers "how is the business doing?" in plain language. Every section says what
   the numbers mean, charts carry their own legends and hover details, and the top of the page lists the takeaways.
   Replaces the earlier analytics view in views-overview.js; the CSV export there is kept. */
'use strict';

const AN_ST = ['New', 'Contacted', 'Site visit', 'Quotation sent', 'Negotiation', 'Won'];
const anPct = v => `${v > 0 ? '+' : ''}${v}%`;
const anTone = (good, warn) => good ? 'ok' : warn ? 'warn' : 'bad';

function anSpark(vals, cls = '') {
  if (vals.length < 2) return '';
  const W = 120, H = 34, lo = Math.min(...vals), hi = Math.max(...vals), k = hi - lo || 1, st = W / (vals.length - 1);
  const pts = vals.map((v, i) => [i * st, H - 3 - (v - lo) / k * (H - 8)]);
  const d = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join('');
  return `<svg class="an-spark ${cls}" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true"><path class="a" d="${d}L${W},${H}L0,${H}Z"/><path class="l" d="${d}"/><circle cx="${pts.at(-1)[0]}" cy="${pts.at(-1)[1]}" r="3"/></svg>`;
}
const anHead = (n, title, what) => `<div class="an-sec-h"><span class="an-n">${n}</span><div><h2>${title}</h2><p>${what}</p></div></div>`;

/* cash in vs cash out per month, with the net line */
function anCashChart(months) {
  const W = 960, H = 280, pl = 64, pr = 12, pt = 16, pb = 30, iw = W - pl - pr, ih = H - pt - pb;
  const max = Math.max(1, ...months.flatMap(m => [m.in, m.out])), minNet = Math.min(0, ...months.map(m => m.in - m.out));
  const top = max * 1.08, bot = minNet * 1.15, Y = v => pt + (top - v) / (top - bot) * ih, g = iw / months.length, bw = Math.min(26, g / 3.4);
  const ticks = [0, .25, .5, .75, 1].map(f => bot + (top - bot) * f);
  let s = ticks.map(t => `<line class="gl" x1="${pl}" x2="${W - pr}" y1="${Y(t)}" y2="${Y(t)}"/><text class="ax" x="${pl - 8}" y="${Y(t) + 4}" text-anchor="end">${inrS(t)}</text>`).join('');
  s += `<line class="zero" x1="${pl}" x2="${W - pr}" y1="${Y(0)}" y2="${Y(0)}"/>`;
  const net = months.map((m, i) => [pl + g * i + g / 2, Y(m.in - m.out)]);
  months.forEach((m, i) => {
    const cx = pl + g * i + g / 2, n = m.in - m.out;
    s += `<g class="col" data-tip="${esc(`<b>${m.label}</b><br>Collected ${inrS(m.in)}<br>Spent ${inrS(m.out)}<br>Net ${n >= 0 ? '+' : '−'}${inrS(Math.abs(n))}`)}"><rect class="hit" x="${pl + g * i}" y="${pt}" width="${g}" height="${ih}"/>
      <rect class="in" x="${cx - bw - 2}" y="${Y(m.in)}" width="${bw}" height="${Math.max(0, Y(0) - Y(m.in))}" rx="5"/><rect class="out" x="${cx + 2}" y="${Y(m.out)}" width="${bw}" height="${Math.max(0, Y(0) - Y(m.out))}" rx="5"/></g>
      <text class="ax" x="${cx}" y="${H - 8}" text-anchor="middle">${m.label}</text>`;
  });
  s += `<path class="net" d="${net.map((p, i) => `${i ? 'L' : 'M'}${p[0]},${p[1]}`).join('')}"/>${net.map((p, i) => `<circle class="netd ${months[i].in - months[i].out < 0 ? 'neg' : ''}" cx="${p[0]}" cy="${p[1]}" r="4"/>`).join('')}`;
  return `<div class="chart wide an-cash"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Cash collected and spent by month">${s}</svg></div>`;
}

VIEWS.analytics = () => {
  const n = [3, 6, 12].includes(+ROUTE.q.range) ? +ROUTE.q.range : 6, pv = ROUTE.q.pv === 'table' ? 'table' : 'chart';
  const from = monthsBack(n), to = TODAY, days = Math.round((parseD(to) - parseD(from)) / 864e5) + 1;
  const pFrom = shiftD(from, -days), pTo = shiftD(from, -1);
  const ps = DB.projects, active = ps.filter(p => !['Completed', 'On hold'].includes(p.status)), econ = ps.map(projEconomics);
  const months = lastMonths(n).map(m => ({ label: m.label, in: sum(DB.payments.filter(x => x.date.startsWith(m.key)), x => x.amount), out: sum(DB.expenses.filter(x => x.date.startsWith(m.key)), x => x.amount) }));

  // money
  const inP = sum(DB.payments.filter(x => inRange(x.date, from, to)), x => x.amount), inPrev = sum(DB.payments.filter(x => inRange(x.date, pFrom, pTo)), x => x.amount);
  const outP = sum(DB.expenses.filter(x => inRange(x.date, from, to)), x => x.amount), outPrev = sum(DB.expenses.filter(x => inRange(x.date, pFrom, pTo)), x => x.amount);
  const netP = inP - outP, billed = sum(econ, e => e.f.billed), received = sum(econ, e => e.f.received), unpaid = billed - received;
  const orderBook = sum(ps.filter(p => p.status !== 'Completed'), p => p.value - projFinance(p.id).billed);
  const withM = econ.filter(e => e.margin != null), portMargin = sum(withM, e => e.p.value - e.eac) / Math.max(1, sum(withM, e => e.p.value));
  const profit = sum(withM, e => e.p.value - e.eac);
  const chg = (a, b) => b ? Math.round((a / b - 1) * 100) : null;

  // delivery
  const onSched = active.filter(p => p.progress - planPct(p) >= -5), behind = active.filter(p => p.progress - planPct(p) < -5).sort((a, b) => (a.progress - planPct(a)) - (b.progress - planPct(b)));
  let due = 0, filed = 0, md = 0, wg = 0; const crew = [];
  for (let i = -13; i <= 0; i++) { const d = dayOff(i), s = siteSummary(d, active.map(p => p.id)); due += s.reported.length + s.pending.length; filed += s.reported.length; md += s.workers; wg += s.wages; crew.push({ d, w: s.workers, wages: s.wages }); }
  const reasons = {}; DB.delays.forEach(d => reasons[d.reason] = (reasons[d.reason] || 0) + stopDays(d));
  const rs = Object.entries(reasons).sort((a, b) => b[1] - a[1]), lostDays = sum(rs, r => r[1]), openDelays = DB.delays.filter(d => d.status === 'Open');

  // sales
  const en = DB.enquiries, won = en.filter(e => e.status === 'Won').length, lost = en.filter(e => e.status === 'Lost').length, winRate = pct(won, won + lost);
  const pipeline = sum(en.filter(e => !['Won', 'Lost'].includes(e.status)), e => e.quote?.amount || e.budget);
  const reached = s => s === 'New' ? en.length : en.filter(e => e.status !== 'Lost' && AN_ST.indexOf(e.status) >= AN_ST.indexOf(s)).length + (AN_ST.indexOf(s) <= 3 ? en.filter(e => e.status === 'Lost' && e.quote).length : 0);
  const src = {}; en.forEach(e => { (src[e.source] ||= { n: 0, won: 0, lost: 0 }); src[e.source].n++; if (e.status === 'Won') src[e.source].won++; if (e.status === 'Lost') src[e.source].lost++; });
  const srcs = Object.entries(src).sort((a, b) => b[1].n - a[1].n), best = srcs.filter(([, v]) => v.won).sort((a, b) => b[1].won / b[1].n - a[1].won / a[1].n)[0];

  // takeaways, worst first
  const risky = withM.filter(e => e.margin < .12 && e.p.status !== 'Completed').sort((a, b) => a.margin - b.margin);
  const tk = [];
  if (risky.length) tk.push(['bad', 'alert', `<b>${risky.map(e => esc(e.p.name)).join(', ')}</b> ${risky.length > 1 ? 'are' : 'is'} heading for ${risky[0].margin < 0 ? 'a loss' : 'a thin margin'} (${Math.round(risky[0].margin * 100)}% projected). Check the cost to complete.`, `#/projects/${risky[0].p.id}?tab=finance`]);
  if (behind.length) tk.push(['warn', 'clock', `<b>${plural(behind.length, 'project')}</b> behind plan — ${esc(behind[0].name)} is furthest behind at ${behind[0].progress - planPct(behind[0])} pts.`, `#/projects/${behind[0].id}`]);
  tk.push([netP >= 0 ? 'ok' : 'bad', 'rupee', `Net cash ${netP >= 0 ? 'in' : 'out'} of <b>${inrS(Math.abs(netP))}</b> in the last ${n} months — collected ${inrS(inP)}${chg(inP, inPrev) != null ? ` (${anPct(chg(inP, inPrev))} on the previous ${n} months)` : ''}, spent ${inrS(outP)}.`, '#/finance']);
  if (unpaid > 0) tk.push([pct(received, billed) >= 85 ? 'ok' : 'warn', 'invoice', `<b>${inrS(unpaid)}</b> billed to clients is still unpaid — ${pct(received, billed)}% of everything billed has been collected.`, '#/invoices']);
  if (rs.length) tk.push(['info', 'flag', `<b>${esc(rs[0][0])}</b> caused ${fmtDays(rs[0][1])} of the ${fmtDays(lostDays)} lost to stoppages (${pct(rs[0][1], lostDays)}%).`, '#/stoppages']);
  if (en.length) tk.push(['info', 'enquiry', `Win rate is <b>${winRate}%</b> with ${inrS(pipeline)} in the pipeline${best ? `; ${esc(best[0])} converts best (${best[1].won} of ${best[1].n})` : ''}.`, '#/enquiries']);

  const scaleMax = Math.min(1.5, Math.max(1.05, ...econ.map(e => Math.max(e.eac || 0, e.f.spent) / e.p.value)));
  const sortedE = econ.slice().sort((a, b) => (a.margin ?? 9) - (b.margin ?? 9));
  const crewAvg = Math.round(md / 14), crewMax = Math.max(1, ...crew.map(c => c.w));

  const R = 50, C = 2 * Math.PI * R, pm = Math.max(0, Math.min(1, portMargin));
  const donut = `<svg class="anx-donut" viewBox="0 0 124 124" aria-hidden="true"><circle class="trk" r="${R}" cx="62" cy="62"/><circle class="cost" r="${R}" cx="62" cy="62" stroke-dasharray="${Math.max(0, (1 - pm) * C - 3)} ${C}"/><circle class="gain ${anTone(portMargin >= .15, portMargin >= .08)}" r="${R}" cx="62" cy="62" stroke-dasharray="${Math.max(0, pm * C - 3)} ${C}" stroke-dashoffset="${-(1 - pm) * C}"/></svg>`;
  const tile = (icon, l, v, sub, bar = null, tone = '') => `<div class="anx-k"><span>${ico(icon, 'sm')}${l}</span><b>${v}</b><small>${sub}</small>${bar != null ? `<i class="anx-tb ${tone}"><em style="width:${bar}%"></em></i>` : ''}</div>`;
  return `<div class="ax anx">${pageHead('Analytics', `How the business is doing · ${fmtDY(from)} – ${fmtDY(to)}, compared with the ${n} months before`,
      `<div class="seg" role="group" aria-label="Period">${[3, 6, 12].map(m => `<button class="${n === m ? 'on' : ''}" data-act="setQ" data-k="range" data-v="${m}">${m} months</button>`).join('')}</div><button class="btn" data-act="exportAnalytics">${ico('download')}Export</button>`)}
    <section class="anx-kpis simple">
      <div class="anx-k"><span>${ico('download', 'sm')}Money received</span><b>${inrS(inP)}</b><small>from clients in the last ${n} months</small></div>
      <div class="anx-k"><span>${ico('wallet', 'sm')}Money spent</span><b>${inrS(outP)}</b><small>on sites in the last ${n} months</small></div>
      <div class="anx-k ${netP >= 0 ? 'pos' : 'neg'}"><span>${ico('rupee', 'sm')}${netP >= 0 ? 'Left over' : 'Short by'}</span><b>${inrS(Math.abs(netP))}</b><small>received minus spent</small></div>
      <div class="anx-k ${unpaid > 0 ? 'owe' : ''}"><span>${ico('invoice', 'sm')}Clients still owe</span><b>${inrS(unpaid)}</b><small>billed but not paid yet</small></div>
    </section>
    <section class="card anx-take"><div class="card-head"><h2>Key takeaways</h2><span class="sub">What needs your attention, worst first</span></div>
      <ul>${tk.map(([t, i, txt, href]) => `<li class="${t}"><a href="${href}"><span class="an-ti">${ico(i, 'sm')}</span><span class="tx">${txt}</span>${ico('arrowR', 'sm')}</a></li>`).join('')}</ul></section>

    <section class="an-sec">${anHead(1, 'Cash flow', 'Money collected from clients against money spent on sites, month by month. The line is what was left over (or short).')}
      <div class="card"><div class="card-body"><div class="an-legend"><span><i class="in"></i>Collected <b>${inrS(inP)}</b></span><span><i class="out"></i>Spent <b>${inrS(outP)}</b></span><span><i class="net"></i>Net <b class="${netP >= 0 ? 'pos' : 'neg'}">${netP >= 0 ? '+' : '−'}${inrS(Math.abs(netP))}</b></span></div>${anCashChart(months)}</div></div></section>

    <section class="an-sec">${anHead(2, 'Project profitability', 'For each project: money spent so far, our estimate of the final cost, and the contract value. The estimate assumes the remaining work costs the same per % as the work done so far.')}
      <div class="card"><div class="card-head"><div class="an-legend"><span><i class="sp"></i>Spent so far</span><span><i class="est"></i>Estimated final cost</span><span><i class="ct"></i>Contract value</span></div>
        <div class="seg sm" role="group" aria-label="View"><button class="${pv === 'chart' ? 'on' : ''}" data-act="setQ" data-k="pv" data-v="chart">Chart</button><button class="${pv === 'table' ? 'on' : ''}" data-act="setQ" data-k="pv" data-v="table">Table</button></div></div>
      ${pv === 'chart' ? `<div class="an-prof">${sortedE.map(e => { const t = e.margin == null ? '' : e.margin < 0 ? 'bad' : e.margin < .12 ? 'warn' : 'ok', W = v => Math.min(100, v / e.p.value / scaleMax * 100);
        return `<a class="an-pr ${t}" href="#/projects/${e.p.id}?tab=finance" data-tip="${esc(`<b>${esc(e.p.name)}</b><br>Contract ${inrS(e.p.value)}<br>Spent ${inrS(e.f.spent)}${e.eac ? `<br>Est. final cost ${inrS(e.eac)}` : ''}${e.sqft ? `<br>${inr(e.sqft)} per sq.ft` : ''}`)}">
          <div class="nm"><b>${esc(e.p.name)}</b><span>${e.p.progress}% done · ${esc(e.p.status)}</span></div>
          <div class="tr"><i class="est" style="width:${e.eac ? W(e.eac) : 0}%"></i><i class="sp" style="width:${W(e.f.spent)}%"></i><em class="ct" style="left:${100 / scaleMax}%"></em></div>
          <div class="mg">${e.margin == null ? '<span class="muted">Too early</span>' : `<b>${Math.round(e.margin * 100)}%</b><span>${e.margin < 0 ? `loss ≈ ${inrS(e.eac - e.p.value)}` : `profit ≈ ${inrS(e.p.value - e.eac)}`}</span>`}</div></a>`; }).join('')}
        <div class="an-axis"><span></span><span style="left:${100 / scaleMax}%">Contract value</span></div></div>`
      : `<div class="table-wrap"><table class="t"><thead><tr><th>Project</th><th class="r">Contract</th><th class="r">Spent so far</th><th class="r">Est. final cost</th><th class="r hide-sm">Cost / sq.ft</th><th class="r">Schedule</th><th class="r">Expected margin</th></tr></thead><tbody>
        ${sortedE.map(e => `<tr class="click" data-act="go" data-href="#/projects/${e.p.id}?tab=finance"><td class="strong">${esc(e.p.name)}<span class="sub">${e.p.progress}% done · ${esc(e.p.status)}</span></td><td class="r">${inrS(e.p.value)}</td><td class="r">${inrS(e.f.spent)}</td><td class="r">${e.eac ? inrS(e.eac) : '—'}</td><td class="r hide-sm">${e.sqft ? inr(e.sqft) : '—'}</td><td class="r">${e.p.status === 'Completed' ? '—' : `<span class="an-chg ${e.varc >= -5 ? 'up' : 'down'}">${e.varc > 0 ? '+' : ''}${e.varc} pts</span>`}</td><td class="r">${e.margin == null ? '<span class="muted">Too early</span>' : badge(`${Math.round(e.margin * 100)}%`, e.margin < 0 ? 'bad' : e.margin < .12 ? 'warn' : 'ok')}</td></tr>`).join('')}</tbody></table></div>`}</div></section>

    <section class="an-sec">${anHead(3, 'Schedule', 'Where each running project should be today (planned) against where it is (actual). Points behind plan are work that needs catching up.')}
      <div class="card"><div class="card-body"><div class="an-legend"><span><i class="pl"></i>Planned today</span><span><i class="dot"></i>Actual progress</span></div>
        <div class="an-sched">${active.slice().sort((a, b) => (a.progress - planPct(a)) - (b.progress - planPct(b))).map(p => { const pl = planPct(p), v = p.progress - pl, t = v >= -5 ? 'ok' : v >= -15 ? 'warn' : 'bad';
          return `<a class="an-sr ${t}" href="#/projects/${p.id}" data-tip="${esc(`<b>${esc(p.name)}</b><br>Planned ${pl}% · actual ${p.progress}%`)}"><div class="nm"><b>${esc(p.name)}</b><span>due ${fmtDY(p.end)}</span></div>
            <div class="tr"><em class="gap" style="left:${Math.min(p.progress, pl)}%;width:${Math.abs(v)}%"></em><i class="pl" style="left:${pl}%"></i><i class="dot" style="left:${p.progress}%"></i></div>
            <div class="vr"><b>${v > 0 ? '+' : ''}${v}</b><span>pts</span></div></a>`; }).join('') || '<p class="muted">No running projects.</p>'}
          <div class="an-scale"><span>0%</span><span>25%</span><span>50%</span><span>75%</span><span>100%</span></div></div></div></div></section>

    <section class="an-sec">${anHead(4, 'Workforce &amp; stoppages', 'How many workers were on site each day (from daily reports), and how many working days were lost to stoppages, by cause.')}
      <div class="grid g2">
        <div class="card"><div class="card-head"><h2>Workers on site</h2><span class="sub">Last 14 days</span></div><div class="card-body">
          <div class="an-legend"><span>Average <b>${crewAvg}</b> a day</span><span>Wages <b>${inrS(wg)}</b></span><span>Busiest <b>${crewMax}</b></span></div>
          <div class="an-crew">${crew.map(c => `<div class="c ${c.d === TODAY ? 'now' : ''} ${!isWorkDay(c.d) ? 'off' : ''}" data-tip="${esc(`<b>${fmtD(c.d)}</b> · ${c.w} workers · ${inrS(c.wages)} wages`)}"><i style="height:${c.w / crewMax * 100}%"></i><small>${parseD(c.d).toLocaleDateString('en-IN', { weekday: 'narrow' })}<br>${+c.d.slice(8)}</small></div>`).join('')}<em class="avg" style="bottom:calc(${crewAvg / crewMax} * (100% - 34px) + 34px)"><span>avg ${crewAvg}</span></em></div></div></div>
        <div class="card"><div class="card-head"><h2>Days lost to stoppages</h2><span class="sub">${fmtDays(lostDays)} in total · ${openDelays.length} still open</span></div><div class="card-body">
          <div class="an-causes">${rs.map(([l, v], i) => `<div class="cz" data-tip="${esc(`<b>${esc(l)}</b> · ${fmtDays(v)} (${pct(v, lostDays)}%)`)}"><span class="nm">${esc(l)}</span><span class="tr"><i style="width:${v / rs[0][1] * 100}%;--o:${1 - i * .09}"></i></span><b>${fmtDays(v)}</b><small>${pct(v, lostDays)}%</small></div>`).join('') || '<p class="muted">No stoppages recorded.</p>'}</div></div></div>
      </div></section>

    <section class="an-sec">${anHead(5, 'Sales', 'How enquiries move towards a signed project, and which lead sources bring work that converts.')}
      <div class="grid g2">
        <div class="card"><div class="card-head"><h2>Enquiry funnel</h2><span class="sub">Win rate ${winRate}% · pipeline ${inrS(pipeline)}</span></div><div class="card-body"><div class="an-funnel">
          ${AN_ST.map((s, i) => { const v = reached(s), prev = i ? reached(AN_ST[i - 1]) : null; return `${i ? `<div class="cv">${ico('chevD', 'sm')}${pct(v, prev)}% move on</div>` : ''}<div class="st ${s === 'Won' ? 'won' : ''}" style="--w:${Math.max(18, v / Math.max(1, en.length) * 100)}%"><span>${s === 'Won' ? 'Won · became a project' : s}</span><b>${v}</b></div>`; }).join('')}</div></div></div>
        <div class="card"><div class="card-head"><h2>Lead sources</h2><span class="sub">Enquiries by where they came from</span></div><div class="card-body">
          <div class="an-legend"><span><i class="won"></i>Won</span><span><i class="open"></i>Still open</span><span><i class="lost"></i>Lost</span></div>
          <div class="an-src">${srcs.map(([l, v]) => { const max = srcs[0][1].n, o = v.n - v.won - v.lost; return `<div class="ls" data-tip="${esc(`<b>${esc(l)}</b> · ${v.n} enquiries · ${v.won} won · ${v.lost} lost`)}"><span class="nm">${esc(l)}</span><span class="tr" style="width:${v.n / max * 100}%"><i class="won" style="flex:${v.won}"></i><i class="open" style="flex:${o}"></i><i class="lost" style="flex:${v.lost}"></i></span><b>${v.n}</b><small>${v.won + v.lost ? `${pct(v.won, v.won + v.lost)}% win` : '—'}</small></div>`; }).join('')}</div></div></div>
      </div></section></div>`;
};
