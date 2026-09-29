/* Budget: what the build might cost, all in one place.
   #/budget

   Shared, in one thing (id 'budget'):
     { landId | landPrice, planPick ('auto' = our favorite plan, 'manual' = sqft, or a plan id), sqft, cushion (%), markup (%, used by additions),
       site: [{ key, name, amount, quote, note, custom }] }
   Additions live on Plans → Additions (additions.js); only their total shows here.

   The savings goal can be figured from all this (settings.goalMode 'budget'):
   the land is bought and the build starts right after, and the land counts
   toward the down payment, so
     goal = down % of (our land share + site work + house)
          + cushion (cash; it can't come out of the loan)
          + land closing % of our land share
          + construction loan closing % of the loan
          + our share of the perc test, surveys and plan revisions
   "Enough to buy the land" = land down % of our share + land closing + those costs.
   Loan settings live in budget.loan (all adjustable).
   Cost per sq ft is the same one the floor plans use (settings.costPerSqft).

   Total project cost = land + site work + starter house + cushion (on site work
   and the house). Later = upgrades (from the Upgrades page) + additions.
   The savings goal is separate: you set it yourself. */
const Budget = (() => {
  const SITE = [
    ['well', 'Well', 'Usually $10k–$25k'],
    ['septic', 'Septic', 'Usually $10k–$30k+, more if an alternative system is needed'],
    ['driveway', 'Driveway', 'Depends on length. Gravel is cheapest.'],
    ['clearing', 'Clearing & grading', 'Depends on trees and slope'],
    ['power', 'Power to the house', 'Cheap near the road, $10k+ for a long run'],
    ['permits', 'Permits, survey & fees', ''],
    ['utilities', 'Utility hookups', 'Internet, propane, and so on'],
    ['barn', 'Barn / outbuildings', 'Optional'],
    ['fencing', 'Fencing', 'Optional'],
  ];

  const LOAN = { split: 50, down: 20, landDown: 15, landClosing: 2.5, loanClosing: 3, perc: 750, boundary: 750, subdivision: 2000, revisions: 1400 };
  // [key, label, kind, hint]
  const LOAN_FIELDS = {
    split: ['Split', 'pct', 'Your share of the land price and land closing costs'],
    down: ['Down payment', 'pct', 'Construction loans usually need 20–25%'],
    landDown: ['Land down payment', 'pct', 'Usually 10–15% for raw land. Used for the “enough to buy the land” marker.'],
    landClosing: ['Land closing costs', 'pct', 'Usually 1–2.5% of the land price'],
    loanClosing: ['Construction loan closing costs', 'pct', 'Often 2–5% of the loan'],
    perc: ['Perc test', 'money', 'Split cost · our share. Paid up front, not part of the loan.'],
    boundary: ['Boundary survey', 'money', 'Split cost · our share'],
    subdivision: ['Subdivision survey', 'money', 'Split cost · our share. Estimated $1,000–$2,000.'],
    revisions: ['Plan revisions', 'money', 'Split cost · our share'],
  };
  const data = () => get('budget') || {};
  const loan = () => ({ ...LOAN, ...(data().loan || {}) });
  const save = patch => DB.put('budget', { kind: 'budget', ...patch });
  const cps = () => settings().costPerSqft || 0;

  // Site lines: the standard ones (in order) plus any you added.
  function siteLines() {
    const saved = data().site || [];
    const std = SITE.map(([key, name, hint]) => ({ key, name, hint, ...(saved.find(l => l.key === key) || {}) }));
    return [...std, ...saved.filter(l => l.custom)];
  }
  const saveSite = lines => save({ site: lines.filter(l => l.custom || l.amount != null || l.note || l.quote).map(({ hint, ...l }) => l) });

  function totals() {
    const d = data();
    const landItem = d.landId && get(d.landId);
    const landFull = landItem ? landItem.price || 0 : d.landPrice || 0;
    const L = loan();
    const land = Math.round(landFull * L.split / 100);
    const lines = siteLines();
    const site = lines.reduce((s, l) => s + (l.amount || 0), 0);
    // Which plan: our favorite (the most hearts) unless one is picked.
    const pick = d.planPick || (d.planId ? d.planId : d.sqft ? 'manual' : 'auto');
    const favorite = Plans.sorted().find(p => p.sqft) || Plans.sorted()[0] || null;
    const plan = pick === 'auto' ? favorite : pick === 'manual' ? null : get(pick) || favorite;
    const sqft = plan ? plan.sqft || 0 : d.sqft || 0;
    const house = sqft * cps();
    // Special starter items: extra costs added on a room's Starter side.
    const extrasList = Rooms.starterExtras();
    const extras = extrasList.reduce((s, x) => s + x.amount, 0);
    const build = house + extras;
    const cushionPct = d.cushion ?? 10;
    const cushion = Math.round((site + build) * cushionPct / 100);
    const additions = Additions.total();
    const upgrades = kind('upgrade').filter(u => !u.done).reduce((s, u) => s + (u.cost || 0), 0);
    return {
      d, L, landItem, landFull, land, lines, site, pick, favorite, plan, sqft, house, extrasList, extras, build, cushionPct, cushion, additions, upgrades,
      moveIn: land + site + build + cushion,
      quotes: lines.filter(l => l.amount != null && l.quote).length, filled: lines.filter(l => l.amount != null).length,
    };
  }

  // The cash to have saved before the loan.
  function cash() {
    const t = totals(), L = t.L;
    const financed = t.land + t.site + t.build;
    const down = Math.round(financed * L.down / 100);
    const landClosing = Math.round(t.land * L.landClosing / 100);
    const loanAmount = financed - down;
    const loanClosing = Math.round(loanAmount * L.loanClosing / 100);
    const fees = (L.perc || 0) + (L.boundary || 0) + (L.subdivision || 0) + (L.revisions || 0);
    const goal = down + t.cushion + landClosing + loanClosing + fees;
    const landReady = Math.round(t.land * L.landDown / 100) + landClosing + fees;
    return { t, L, financed, down, landClosing, loanAmount, loanClosing, fees, goal, landReady };
  }

  // The goal the savings card uses: figured from the Budget, or a set amount.
  // settings.goalMode: 'budget' = everything (cash we need), 'land' = just
  // enough to buy the land, 'fixed' = a set amount (settings.goal).
  function goalNow() {
    const st = settings();
    if (st.goalMode === 'budget') { const c = cash(); return { amount: c.goal, land: c.landReady, auto: true, label: 'Cash we need' }; }
    if (st.goalMode === 'land') { const c = cash(); return { amount: c.landReady, land: null, auto: true, label: 'Cash for the land' }; }
    return { amount: st.goal || 0, land: null, auto: false, label: 'Our savings goal' };
  }
  // Progress bar with a marker for "enough to buy the land".
  // showPct puts "28%" to the right of the bar, on the same line.
  function goalBar(saved, g, showPct) {
    const pct = g.amount ? Math.min(100, saved / g.amount * 100) : 0;
    const m = g.land && g.amount && g.land < g.amount ? g.land / g.amount * 100 : null;
    const bar = `<div class="bar"><i style="width:${pct.toFixed(1)}%"></i>${m != null ? `<b class="mark" style="left:${m.toFixed(1)}%"></b>` : ''}</div>`;
    return `${showPct ? `<div class="bar-line">${bar}<span class="bar-pct">${saved >= g.amount ? '🎉' : `${Math.floor(pct)}%`}</span></div>` : bar}
      ${m != null ? `<p class="mark-note">${saved >= g.land ? '✓ Enough to buy the land' : `▲ Enough to buy the land at ${money(g.land)}`}</p>` : ''}`;
  }

  const row = (label, amount, act, sub = '') => `<button class="b-row" data-act="${act}">
      <span class="b-name"><span class="b-title">${label}</span>${sub ? `<small>${sub}</small>` : ''}</span><span class="b-amt">${amount}</span></button>`;

  Views.budget = {
    nav: 'budget',
    render() {
      const t = totals(), st = settings(), c = cash();
      const saved = savedTotal();
      const perc = t.landItem && (t.landItem.checks || {}).perc === 'yes';
      const roomsSqft = t.plan ? (t.plan.rooms || []).reduce((s, r) => s + ((Size.parse(r.dims) || {}).area || 0), 0) : 0;
      const dash = '<span class="muted">—</span>';
      return `${pageTop('Budget', { back: ['#/', 'Home'], link: linkBtn('Building & money'), sub: 'What the build might cost' })}
      ${tabs(Money.TABS, '#/budget')}

      <section class="card pad b-sum">
        <p class="eyebrow">Total project cost</p>
        <p class="big mid">${money(t.moveIn)}</p>
        <p class="muted small">What the land and house cost in all. Most of it is covered by the loan.</p>
        <ul class="b-parts">
          <li><span>Land (our share)</span><b>${money(t.land)}</b></li>
          <li><span>Site work</span><b>${money(t.site)}</b></li>
          <li><span>Starter house</span><b>${money(t.house)}</b></li>
          ${t.extras ? `<li><span>Special starter items</span><b>${money(t.extras)}</b></li>` : ''}
          <li><span>Cushion (${t.cushionPct}%)</span><b>${money(t.cushion)}</b></li>
        </ul>
        <div class="b-paid">
          <p class="lbl">How it’s paid</p>
          <ul class="b-parts">
            <li><span>Construction loan (about)</span><b>${money(c.loanAmount)}</b></li>
            <li><span>Our down payment (${c.L.down}%)</span><b>${money(c.down)}</b></li>
            <li><span>Cushion (our cash)</span><b>${money(t.cushion)}</b></li>
          </ul>
          <p class="muted small">Closing costs and split costs (${money(c.landClosing + c.loanClosing + c.fees)}) are cash too, but they aren’t part of the project cost.</p>
        </div>
        <div class="b-later">
          <a href="#/upgrades"><span>Upgrades later</span><b>${money(t.upgrades)}</b></a>
          <a href="#/additions"><span>Additions later</span><b>${money(t.additions)}</b></a>
        </div>
      </section>

      <section class="card pad">
        <div class="row-head"><h2>Land</h2></div>
        ${row(t.landItem ? esc(t.landItem.name) : t.d.landPrice ? 'Placeholder amount' : 'Pick a property', t.landFull ? money(t.landFull) : dash, 'land',
          t.landItem ? [t.landItem.acres && `${commas(t.landItem.acres)} acres`, esc(t.landItem.place || '')].filter(Boolean).join(' · ') : 'From your Land page, or a placeholder amount')}
        ${row('Split cost · our share', `${t.L.split}%`, 'loan" data-k="split', t.landFull ? `Our share of the land: ${money(t.land)}` : 'Your share of the land price')}
      </section>

      <section class="card pad">
        <div class="row-head"><h2>Site work</h2><span class="muted small">${t.quotes} of ${t.filled} are real quotes</span></div>
        <div class="b-list">${t.lines.map((l, i) => row(
          `${esc(l.name)}${l.amount != null ? ` <span class="badge ${l.quote ? 'done' : ''}">${l.quote ? 'Quote ✓' : 'Estimate'}</span>` : ''}`,
          l.amount != null ? money(l.amount) : dash, `site" data-i="${i}`,
          [l.key === 'septic' && perc ? `Perc approval on file for ${esc(t.landItem.name)}` : '', esc(l.note || l.hint || '')].filter(Boolean).join(' · '),
        )).join('')}</div>
        <div class="b-foot"><button class="btn small ghost" data-act="addSite">${icon('plus')} Add a line</button><span>Site work <b>${money(t.site)}</b></span></div>
      </section>

      <section class="card pad">
        <div class="row-head"><h2>Starter house</h2></div>
        ${row(t.plan ? esc(t.plan.name) : t.pick === 'manual' ? 'Square feet' : 'Add a floor plan', t.sqft ? `${commas(t.sqft)} sq ft` : dash, 'house',
          [t.pick === 'auto' && t.plan ? 'Our favorite plan (follows the hearts)' : '',
            t.plan ? (t.plan.sqft ? [t.plan.beds && `${t.plan.beds} bed`, t.plan.baths && `${t.plan.baths} bath`].filter(Boolean).join(' · ') : 'This plan has no square feet yet. Add it on the plan.') : t.pick === 'manual' ? 'Typed in' : 'Add plans on the Plans page'].filter(Boolean).join(' · '))}
        ${row('Cost per sq ft', cps() ? money(cps()) : dash, 'cps', 'From builder quotes in Louisa County. Builder-grade finishes are usually included.')}
        <p class="b-math">${t.sqft && cps() ? `${commas(t.sqft)} sq ft × ${money(cps())} = <b>${money(t.house)}</b>` : 'Add the square feet and cost per sq ft to see the starter house cost.'}</p>
        ${row('Special starter items', t.extras ? money(t.extras) : dash, 'extras',
          t.extrasList.length ? t.extrasList.slice(0, 3).map(x => `${esc(x.label)} (${esc(x.board.name)}) +${money(x.amount)}`).join(' · ') + (t.extrasList.length > 3 ? ` · +${t.extrasList.length - 3} more` : '')
            : 'Something fancier than builder-grade? Add an extra cost from a room’s Starter side.')}
        ${roomsSqft ? `<p class="muted small">The rooms listed on this plan add up to ${commas(Math.round(roomsSqft))} sq ft. Halls, closets, stairs and walls make up the rest, so the plan’s total is the one to use.</p>` : ''}
      </section>

      ${goalHtml()}`;
    },
    acts: {
      land() {
        const t = totals();
        const props = kind('land').filter(p => p.status !== 'pass').sort(newest);
        form({
          title: 'Land',
          fields: [
            { name: 'landId', label: 'Property', type: 'select', value: t.d.landId || '', options: [['', 'Not picked yet'], ...props.map(p => [p.id, `${p.name}${p.price ? ` · ${money(p.price)}` : ''}`])] },
            { name: 'landPrice', label: 'Or a placeholder amount', type: 'money', value: t.d.landPrice ?? '', placeholder: '120,000', hint: 'Used when no property is picked.' },
          ],
          save: v => save({ landId: v.landId || null, landPrice: v.landPrice }),
        });
      },
      site(el) {
        const lines = siteLines(), i = +el.dataset.i, l = lines[i];
        form({
          title: l.name,
          intro: l.hint ? `<p>${esc(l.hint)}</p>` : '',
          fields: [
            ...(l.custom ? [{ name: 'name', label: 'What', value: l.name, required: true }] : []),
            { name: 'amount', label: 'Amount', type: 'money', value: l.amount ?? '', placeholder: '15,000', autofocus: true },
            { name: 'quote', label: 'This is a real quote', type: 'check', value: l.quote },
            { name: 'note', label: 'Note', value: l.note || '', placeholder: 'Who quoted it, what’s included…' },
          ],
          save: v => { lines[i] = { ...l, ...v }; return saveSite(lines); },
          remove: async () => {
            if (!(await ask(l.custom ? `Delete “${l.name}”?` : `Clear the ${l.name.toLowerCase()} amount?`, { ok: l.custom ? 'Delete' : 'Clear' }))) return false;
            if (l.custom) lines.splice(i, 1); else lines[i] = { key: l.key, name: l.name };
            await saveSite(lines);
            return true;
          },
          removeLabel: l.custom ? 'Delete' : 'Clear',
        });
      },
      addSite() {
        const lines = siteLines();
        form({
          title: 'Add a line',
          fields: [
            { name: 'name', label: 'What', placeholder: 'Culvert, retaining wall…', required: true, autofocus: true },
            { name: 'amount', label: 'Amount', type: 'money', placeholder: '5,000' },
            { name: 'quote', label: 'This is a real quote', type: 'check' },
            { name: 'note', label: 'Note' },
          ],
          save: v => saveSite([...lines, { key: `x${Date.now()}`, custom: true, ...v }]),
        });
      },
      house() {
        const t = totals();
        const plans = Plans.sorted();
        form({
          title: 'Starter house',
          fields: [
            { name: 'planPick', label: 'Floor plan', type: 'select', value: t.pick, options: [
              ['auto', `Our favorite plan (follows the hearts)${t.favorite ? `: ${t.favorite.name}` : ''}`],
              ...plans.map(p => [p.id, `${p.name}${p.sqft ? ` · ${commas(p.sqft)} sq ft` : ''}`]),
              ['manual', 'Type the square feet instead'],
            ] },
            { name: 'sqft', label: 'Square feet', type: 'number', value: t.d.sqft ?? '', hint: 'Used with “Type the square feet instead.”' },
          ],
          save: v => save({ planPick: v.planPick, planId: null, sqft: v.sqft }),
        });
      },
      extras() {
        const list = totals().extrasList;
        const s = sheet('Special starter items', `<p class="intro">Anything fancier than builder-grade for the first build, like a nicer sink and faucet. Add them from a room’s <b>Starter</b> side: tap a suggestion (e.g. + Sink & faucet) and fill in <b>Extra cost for the starter build</b>.</p>
          ${list.length ? `<div class="b-list">${list.map(x => `<a class="b-row" href="#/rooms/${x.board.id}"><span class="b-name"><span class="b-title">${esc(x.label)}</span><small>${esc(x.board.name)}</small></span><span class="b-amt">+${money(x.amount)}</span></a>`).join('')}</div>
            <div class="b-total"><span>Total</span><b>${money(list.reduce((a, x) => a + x.amount, 0))}</b></div>` : '<p class="muted">None yet.</p>'}`);
        s.el.addEventListener('click', e => { if (e.target.closest('a.b-row')) s.close(); });
      },
      cps() {
        form({
          title: 'Cost per sq ft',
          fields: [{ name: 'costPerSqft', label: 'Cost per sq ft', type: 'money', value: settings().costPerSqft ?? '', placeholder: '175', autofocus: true, hint: 'From builder quotes. Floor plan estimates use it too.' }],
          save: v => saveSettings({ costPerSqft: v.costPerSqft }),
        });
      },
      toGoal: () => document.getElementById('b-goal').scrollIntoView({ behavior: 'smooth', block: 'start' }),
      loan(el) {
        const k = el.dataset.k, [label, type, hint] = LOAN_FIELDS[k];
        form({
          title: label,
          fields: [{ name: 'v', label: type === 'pct' ? 'Percent' : 'Our share', type: type === 'pct' ? 'number' : 'money', value: loan()[k], hint, autofocus: true }],
          save: v => save({ loan: { ...(data().loan || {}), [k]: v.v ?? LOAN[k] } }),
        });
      },
      async useGoal(el) {
        await saveSettings({ goalMode: el.dataset.mode || 'budget' });
        toast('Your savings goal now follows the Budget');
      },
      cushion() {
        form({
          title: 'Cushion',
          fields: [{ name: 'cushion', label: 'Percent', type: 'number', value: data().cushion ?? 10, hint: '10% is a common starting point. It’s cash: it can’t come out of the loan.' }],
          save: v => save({ cushion: v.cushion ?? 10 }),
        });
      },
    },
  };

  function goalHtml() {
    const c = cash(), L = c.L, t = c.t;
    const mode = settings().goalMode;
    const auto = mode === 'budget' || mode === 'land';
    const pctRow = (k, amount, sub) => row(`${LOAN_FIELDS[k][0]} <span class="muted">(${L[k]}%)</span>`, money(amount), `loan" data-k="${k}`, sub);
    const feeRow = k => row(LOAN_FIELDS[k][0], money(L[k] || 0), `loan" data-k="${k}`, 'Split cost · our share');
    return `<section class="card pad" id="b-goal">
      <div class="row-head"><h2>Cash we need</h2>${mode === 'budget' ? '<span class="badge done">Our savings goal</span>' : ''}</div>
      <p class="muted small">Buy the land, then start building right after. The land counts toward the down payment.</p>
      <div class="b-list">
        ${pctRow('down', c.down, `Of our land share + site work + house (${money(c.financed)})`)}
        ${row(`Cushion <span class="muted">(${t.cushionPct}%)</span>`, money(t.cushion), 'cushion', 'Cash, in case the build runs over. It can’t come out of the loan.')}
        ${pctRow('landClosing', c.landClosing, `Of our land share (${money(t.land)})`)}
        ${pctRow('loanClosing', c.loanClosing, `Of the ${money(c.loanAmount)} loan`)}
        ${feeRow('perc')}${feeRow('boundary')}${feeRow('subdivision')}${feeRow('revisions')}
      </div>
      <div class="b-total"><span>Savings goal</span><b>${money(c.goal)}</b></div>
      ${row(`Enough to buy the land <span class="muted">(${L.landDown}% down)</span>`, money(c.landReady), 'loan" data-k="landDown', 'Land down payment + land closing + the split costs above. Shown as a marker on the savings bar.')}
      ${mode === 'budget' ? '<p class="muted small">Your savings goal follows this total. You can switch it to just the land, or a set amount, with Edit goal on the Savings tab.</p>'
        : `<div class="btn-row"><button class="btn" data-act="useGoal" data-mode="budget">Use the total as our savings goal</button>${mode !== 'land' ? '<button class="btn ghost" data-act="useGoal" data-mode="land">Use the land amount</button>' : ''}</div>`}
    </section>`;
  }

  return { totals, cash, goalNow, goalBar };
})();
