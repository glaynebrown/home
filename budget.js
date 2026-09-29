/* Budget: what the build might cost, all in one place.
   #/budget

   Shared, in one thing (id 'budget'):
     { landId | landPrice, planId | sqft, cushion (%), markup (%, used by additions),
       site: [{ key, name, amount, quote, note, custom }] }
   Additions live on Plans → Additions (additions.js); only their total shows here.
   Cost per sq ft is the same one the floor plans use (settings.costPerSqft).

   Move-in total = land + site work + starter house + cushion (on site work
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

  const data = () => get('budget') || {};
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
    const land = landItem ? landItem.price || 0 : d.landPrice || 0;
    const lines = siteLines();
    const site = lines.reduce((s, l) => s + (l.amount || 0), 0);
    const plan = d.planId && get(d.planId);
    const sqft = plan ? plan.sqft || 0 : d.sqft || 0;
    const house = sqft * cps();
    const cushionPct = d.cushion ?? 10;
    const cushion = Math.round((site + house) * cushionPct / 100);
    const additions = Additions.total();
    const upgrades = kind('upgrade').filter(u => !u.done).reduce((s, u) => s + (u.cost || 0), 0);
    return {
      d, landItem, land, lines, site, plan, sqft, house, cushionPct, cushion, additions, upgrades,
      moveIn: land + site + house + cushion,
      quotes: lines.filter(l => l.amount != null && l.quote).length, filled: lines.filter(l => l.amount != null).length,
    };
  }

  const row = (label, amount, act, sub = '') => `<button class="b-row" data-act="${act}">
      <span class="b-name"><span class="b-title">${label}</span>${sub ? `<small>${sub}</small>` : ''}</span><span class="b-amt">${amount}</span></button>`;

  Views.budget = {
    nav: 'home',
    render() {
      const t = totals(), st = settings();
      const saved = savedTotal();
      const perc = t.landItem && (t.landItem.checks || {}).perc === 'yes';
      const roomsSqft = t.plan ? (t.plan.rooms || []).reduce((s, r) => s + ((Size.parse(r.dims) || {}).area || 0), 0) : 0;
      const dash = '<span class="muted">—</span>';
      return `${pageTop('Budget', { back: ['#/', 'Home'], link: linkBtn('Building & money'), sub: 'What the build might cost' })}
      ${tabs(Money.TABS, '#/budget')}

      <section class="card pad b-sum">
        <p class="eyebrow">Move-in total</p>
        <p class="big">${money(t.moveIn)}</p>
        <ul class="b-parts">
          <li><span>Land</span><b>${money(t.land)}</b></li>
          <li><span>Site work</span><b>${money(t.site)}</b></li>
          <li><span>Starter house</span><b>${money(t.house)}</b></li>
          <li><span>Cushion (${t.cushionPct}%)</span><b>${money(t.cushion)}</b></li>
        </ul>
        <p class="muted small">Saved so far: ${money(saved)}${st.goal ? ` · your goal: ${money(st.goal)}` : ''}</p>
        <div class="b-later">
          <a href="#/upgrades"><span>Upgrades later</span><b>${money(t.upgrades)}</b></a>
          <a href="#/additions"><span>Additions later</span><b>${money(t.additions)}</b></a>
        </div>
      </section>

      <section class="card pad">
        <div class="row-head"><h2>Land</h2></div>
        ${row(t.landItem ? esc(t.landItem.name) : t.d.landPrice ? 'Placeholder amount' : 'Pick a property', t.land ? money(t.land) : dash, 'land',
          t.landItem ? [t.landItem.acres && `${commas(t.landItem.acres)} acres`, esc(t.landItem.place || '')].filter(Boolean).join(' · ') : 'From your Land page, or a placeholder amount')}
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
        ${row(t.plan ? esc(t.plan.name) : t.d.sqft ? 'Square feet' : 'Pick a floor plan', t.sqft ? `${commas(t.sqft)} sq ft` : dash, 'house',
          t.plan ? (t.plan.sqft ? `${[t.plan.beds && `${t.plan.beds} bed`, t.plan.baths && `${t.plan.baths} bath`].filter(Boolean).join(' · ')}` : 'This plan has no square feet yet. Add it on the plan.') : 'From your Plans page, or type the square feet')}
        ${row('Cost per sq ft', cps() ? money(cps()) : dash, 'cps', 'From builder quotes in Louisa County. Builder-grade finishes are usually included.')}
        <p class="b-math">${t.sqft && cps() ? `${commas(t.sqft)} sq ft × ${money(cps())} = <b>${money(t.house)}</b>` : 'Add the square feet and cost per sq ft to see the starter house cost.'}</p>
        ${roomsSqft ? `<p class="muted small">The rooms listed on this plan add up to ${commas(Math.round(roomsSqft))} sq ft. Halls, closets, stairs and walls make up the rest, so the plan’s total is the one to use.</p>` : ''}
        ${row('Cushion', `${t.cushionPct}%`, 'cushion', `Builds almost always run over. ${money(t.cushion)} on site work and the house.`)}
      </section>`;
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
            { name: 'planId', label: 'Floor plan', type: 'select', value: t.d.planId || '', options: [['', 'Not picked yet'], ...plans.map(p => [p.id, `${p.name}${p.sqft ? ` · ${commas(p.sqft)} sq ft` : ''}`])] },
            { name: 'sqft', label: 'Or square feet', type: 'number', value: t.d.sqft ?? '', placeholder: '1,400', hint: 'Used when no plan is picked.' },
          ],
          save: v => save({ planId: v.planId || null, sqft: v.sqft }),
        });
      },
      cps() {
        form({
          title: 'Cost per sq ft',
          fields: [{ name: 'costPerSqft', label: 'Cost per sq ft', type: 'money', value: settings().costPerSqft ?? '', placeholder: '175', autofocus: true, hint: 'From builder quotes. Floor plan estimates use it too.' }],
          save: v => saveSettings({ costPerSqft: v.costPerSqft }),
        });
      },
      cushion() {
        form({
          title: 'Cushion',
          fields: [{ name: 'cushion', label: 'Percent', type: 'number', value: data().cushion ?? 10, hint: '10% is a common starting point.' }],
          save: v => save({ cushion: v.cushion ?? 10 }),
        });
      },
    },
  };

  return { totals };
})();
