/* Savings and the upgrade wishlist. Kept simple on purpose: one goal, what's
   saved so far, and what each upgrade costs. No monthly math.
   #/money      savings
   #/upgrades   now vs. someday */
const Money = (() => {
  const TABS = [['#/money', 'Savings'], ['#/budget', 'Budget'], ['#/upgrades', 'Upgrades']];
  let showAll = false;
  let filter = 'all';

  const deposits = () => kind('deposit').sort((a, b) => (b.date || '').localeCompare(a.date || '') || newest(a, b));

  function editGoal() {
    const st = settings();
    form({
      title: 'Our goal',
      fields: [
        { name: 'goal', label: 'Savings goal', type: 'money', value: st.goal ?? '', placeholder: '150,000', hint: 'Whatever you’re saving toward right now: land, the build, or both.' },
        { name: 'costPerSqft', label: 'Build cost per sq ft (optional)', type: 'money', value: st.costPerSqft ?? '', placeholder: '175', hint: 'From builder quotes in your area. Used for rough estimates on each floor plan.' },
      ],
      save: v => saveSettings({ goal: v.goal, costPerSqft: v.costPerSqft }),
    });
  }

  function depositForm(d) {
    const out = d && d.amount < 0;
    form({
      title: d ? 'Edit' : 'Add to savings',
      fields: [
        { name: 'dir', type: 'seg', value: out ? 'out' : 'in', options: [['in', 'Put in'], ['out', 'Took out']] },
        { name: 'amount', label: 'Amount', type: 'money', value: d ? Math.abs(d.amount) : '', placeholder: '1,500', required: true, autofocus: !d },
        { name: 'note', label: 'Note (optional)', value: d?.note, placeholder: 'OT check' },
        { name: 'date', label: 'Date', type: 'date', value: d?.date || today() },
      ],
      saveLabel: d ? 'Save' : 'Add',
      save: async v => {
        if (!(v.amount > 0)) throw new Error('Type an amount above $0.');
        const data = { amount: v.dir === 'out' ? -v.amount : v.amount, note: v.note, date: v.date || today() };
        if (d) return DB.update(d.id, data);
        await DB.add({ kind: 'deposit', ...data });
        toast(v.dir === 'out' ? 'Saved' : `${money(v.amount)} added. Nice!`);
      },
      remove: d && (async () => {
        if (!(await ask('Delete this entry?'))) return false;
        await DB.remove(d);
        return true;
      }),
    });
  }

  Views.money = {
    nav: 'home',
    render() {
      const st = settings();
      const saved = savedTotal(), goal = st.goal || 0;
      const pct = goal ? saved / goal : 0;
      const list = deposits();
      const shown = showAll ? list : list.slice(0, 6);
      const topPlan = Plans.sorted().find(p => p.sqft);
      const est = topPlan && Plans.estimate(topPlan);
      return `${pageTop('Savings', { back: ['#/', 'Home'], link: linkBtn('Building & money'), sub: 'Our land and build fund' })}
      ${tabs(TABS, '#/money')}
      <section class="card pad goal-card">
        <div class="goal-house">${houseSvg(pct)}</div>
        <div class="goal-txt">
          <p class="big">${money(saved)}</p>
          ${goal ? `<p class="muted">saved of ${money(goal)}</p>
            <div class="bar"><i style="width:${Math.min(100, pct * 100).toFixed(1)}%"></i></div>
            <p class="pct">${pct >= 1 ? 'Goal reached! 🎉' : `${Math.floor(pct * 100)}% there`}</p>`
            : '<p class="muted">saved so far</p>'}
          <div class="btn-row">
            <button class="btn" data-act="add">${icon('plus')} Add to savings</button>
            <button class="btn ghost" data-act="goal">${goal ? 'Edit goal' : 'Set a goal'}</button>
          </div>
        </div>
      </section>

      ${est ? `<a class="card pad est-card" href="#/plans/${topPlan.id}">
        <p class="eyebrow">Rough build estimate</p>
        <p><b>${esc(topPlan.name)}</b>: ${commas(topPlan.sqft)} sq ft × ${money(st.costPerSqft)} ≈ <b>${money(est)}</b></p>
        <p class="muted small">Your top-hearted plan. Land, well, septic and driveway are extra.</p></a>` : ''}

      <section class="card pad">
        <div class="row-head"><h2>History</h2></div>
        ${list.length ? `<ul class="history">${shown.map(d => `<li><button data-act="edit" data-id="${d.id}">
            <span class="h-amt${d.amount < 0 ? ' out' : ''}">${d.amount < 0 ? '−' : '+'}${money(Math.abs(d.amount))}</span>
            <span class="h-note">${esc(d.note || (d.amount < 0 ? 'Took out' : 'Added'))}<small>${[niceDate(d.date), personName(d.by)].filter(Boolean).map(esc).join(' · ')}</small></span>
          </button></li>`).join('')}</ul>
          ${list.length > 6 ? `<button class="linkish" data-act="all">${showAll ? 'Show less' : `Show all ${list.length}`}</button>` : ''}`
          : '<p class="muted">Add your current balance as the first entry, then add OT money as it goes in.</p>'}
      </section>`;
    },
    acts: {
      add: () => depositForm(null),
      edit: el => depositForm(get(el.dataset.id)),
      goal: () => editGoal(),
      all() { showAll = !showAll; render(true); },
    },
  };

  // ---------- upgrades ----------
  const BUILD_TIPS = [
    ['Plumbing', 'Run pipes anywhere you might want water later: island sink, pot filler, laundry sink, outdoor spigots.'],
    ['Electrical', 'Extra outlets and circuits, wiring for under-cabinet lights, porch fans, a future hot tub or workshop.'],
    ['Walls', 'Wood blocking behind drywall for TVs, grab bars, floating shelves and heavy mirrors.'],
    ['Size & shape', 'Foundation size, ceiling height, wide doorways and hallways, window placement. Nearly impossible to change later.'],
    ['The shell', 'Insulation, roof, windows and HVAC sizing. Much cheaper to do right the first time.'],
  ];
  const LATER = 'Cabinets, countertops, flooring, paint, trim, light fixtures, faucets, appliances, backsplash and hardware are all fine to start basic and upgrade later.';

  function upgradeForm(u, room = '') {
    form({
      title: u ? 'Edit upgrade' : 'New upgrade',
      fields: [
        { name: 'name', label: 'What', value: u?.name, placeholder: 'Kitchen cabinets', required: true, autofocus: !u },
        { name: 'room', label: 'Room', value: u?.room || room, placeholder: 'Kitchen', hint: 'Use the room board’s name to show it with that room.' },
        { name: 'nowText', label: 'Starting with', value: u?.nowText, placeholder: 'Builder-grade white shaker' },
        { name: 'nowPhoto', label: 'Photo of the starter version', type: 'photo', value: u?.nowPhoto || null },
        { name: 'laterText', label: 'Dream version', value: u?.laterText, placeholder: 'Sage green, glass-front uppers' },
        { name: 'laterPhoto', label: 'Photo of the dream version', type: 'photo', value: u?.laterPhoto || null },
        { name: 'cost', label: 'About how much?', type: 'money', value: u?.cost ?? '', placeholder: '18,000' },
        { name: 'prep', label: 'Needs prep during the build', type: 'check', value: u?.prep },
        { name: 'prepNote', label: 'What to ask the builder for', value: u?.prepNote, placeholder: 'Run plumbing to the island' },
        ...(u ? [{ name: 'done', label: 'We did it!', type: 'check', value: u.done }] : []),
      ],
      save: async v => {
        if (u) return DB.update(u.id, v);
        await DB.add({ kind: 'upgrade', ...v, done: false });
      },
      remove: u && (async () => {
        if (!(await ask(`Delete “${u.name}”?`))) return false;
        await DB.remove(u);
        return true;
      }),
    });
  }

  const side = (photo, text, label) => `<div class="side">
    ${photo ? `<img src="${esc(thumb(photo))}" alt="" loading="lazy">` : `<div class="side-ph">${icon('camera')}</div>`}
    <p><span class="eyebrow">${label}</span>${esc(text || '')}</p></div>`;

  const upCard = u => `<button class="card up-card${u.done ? ' done' : ''}" data-act="edit" data-id="${u.id}">
      <div class="pair">${side(u.nowPhoto, u.nowText, 'Now')}<span class="pair-arrow">${icon('arrow')}</span>${side(u.laterPhoto, u.laterText, 'Someday')}</div>
      <div class="up-foot"><div><h3>${esc(u.name)}</h3><p class="muted">${[u.room && esc(u.room), u.cost && money(u.cost)].filter(Boolean).join(' · ')}</p></div>
        ${u.done ? '<span class="badge done">Done ✓</span>' : u.prep ? '<span class="badge prep">Prep at build</span>' : ''}</div>
      ${u.prep && u.prepNote && !u.done ? `<p class="prep-note">${esc(u.prepNote)}</p>` : ''}
    </button>`;

  // A room's Starter side next to its Upgrades side, pulled from its board,
  // with "Cabinets: …" lines from both sides' notes lined up, then that
  // room's cost items.
  function roomCard(b, items) {
    const st = Rooms.sideInfo(b, 'starter'), up = Rooms.sideInfo(b, 'upgrade');
    if (!st.count && !up.count && !st.notes && !up.notes && !items.length) return '';
    const sn = Rooms.parseNotes(st.notes), un = Rooms.parseNotes(up.notes);
    const keys = [...new Set([...sn.items, ...un.items].map(i => i.key))];
    const rows = keys.map(k => {
      const a = sn.items.find(i => i.key === k), z = un.items.find(i => i.key === k);
      return `<li><b>${esc((a || z).label)}</b><span class="from">${a ? esc(a.text) : '<i>not decided</i>'}</span>${icon('arrow')}<span class="to">${z ? esc(z.text) : '<i>not decided</i>'}</span></li>`;
    }).join('');
    const loose = (label, list) => list.length ? `<p class="side-note"><i>${label}</i>${esc(list.join(' · '))}</p>` : '';
    const pic = (info, label) => `<div class="side">${info.photo ? `<img src="${esc(thumb(info.photo))}" alt="" loading="lazy">` : `<div class="side-ph">${icon('camera')}</div>`}
      <p><span class="eyebrow">${label}</span>${info.count} photo${info.count === 1 ? '' : 's'}</p></div>`;
    return `<section class="card pad room-up">
      <div class="row-head"><h2>${esc(b.name)}</h2><a href="#/rooms/${b.id}">Open board</a></div>
      <a class="pair" href="#/rooms/${b.id}">${pic(st, 'Starter')}<span class="pair-arrow">${icon('arrow')}</span>${pic(up, 'Upgrades')}</a>
      ${rows ? `<ul class="compare-rows">${rows}</ul>` : ''}
      ${loose('Starter', sn.other)}${loose('Upgrades', un.other)}
      ${items.length ? `<div class="grid ups">${items.map(upCard).join('')}</div>` : ''}
      <button class="btn small ghost" data-act="add" data-room="${esc(b.name)}">${icon('plus')} Cost item for ${esc(b.name.toLowerCase())}</button>
    </section>`;
  }

  Views.upgrades = {
    nav: 'home',
    render() {
      const all = kind('upgrade').sort((a, b) => !!a.done - !!b.done || (a.room || '').localeCompare(b.room || '') || a.t - b.t);
      if ((filter === 'prep' && !all.some(u => u.prep && !u.done)) || (filter === 'done' && !all.some(u => u.done))) filter = 'all';
      const list = all.filter(u => filter === 'all' ? !u.done : filter === 'prep' ? u.prep && !u.done : u.done);
      const total = all.filter(u => !u.done).reduce((s, u) => s + (u.cost || 0), 0);
      const prepN = all.filter(u => u.prep && !u.done).length, doneN = all.filter(u => u.done).length;
      const chip = (key, text) => `<button class="chip${filter === key ? ' on' : ''}" data-act="filter" data-f="${key}">${text}</button>`;
      return `${pageTop('Upgrades', { back: ['#/', 'Home'], link: linkBtn('Building & money'), sub: 'Start basic now, upgrade someday', right: `<button class="btn small" data-act="add">${icon('plus')} Upgrade</button>` })}
      ${tabs(TABS, '#/upgrades')}
      ${all.length ? `<div class="bar-row">${chip('all', 'Wishlist')}${prepN ? chip('prep', `Prep at build (${prepN})`) : ''}${doneN ? chip('done', `Done (${doneN})`) : ''}
        ${total ? `<span class="total">Wishlist total <b>${money(total)}</b></span>` : ''}</div>` : ''}
      ${filter === 'all' ? byRoom(list) : list.length ? `<div class="grid ups">${list.map(upCard).join('')}</div>` : '<p class="muted center">Nothing here.</p>'}
      <details class="card pad tips">
        <summary>What to get right during the build</summary>
        <p class="muted">These are hard or expensive to change once the house is done:</p>
        <ul class="ticks">${BUILD_TIPS.map(([h, t]) => `<li><b>${h}:</b> ${t}</li>`).join('')}</ul>
        <p class="muted">${LATER}</p>
      </details>`;
    },
    acts: {
      add: el => upgradeForm(null, el.dataset.room || ''),
      edit: el => upgradeForm(get(el.dataset.id)),
      filter(el) { filter = el.dataset.f; render(true); },
    },
  };

  // Wishlist view: every room with something on its board, in board order;
  // cost items for rooms without a board go last.
  function byRoom(list) {
    const boards = Rooms.mainBoards();
    const key = s => String(s || '').trim().toLowerCase();
    const names = new Set(boards.map(b => key(b.name)));
    const cards = boards.map(b => roomCard(b, list.filter(u => key(u.room) === key(b.name)))).join('');
    const other = list.filter(u => !names.has(key(u.room)));
    if (!cards && !other.length) {
      return empty('money', 'Nothing to compare yet', 'Fill in the Starter and Upgrades sides of your room boards, and each room lines up here automatically. Add cost items for anything you’re saving toward.', `<button class="btn" data-act="add">${icon('plus')} Add a cost item</button>`);
    }
    return `${cards}${other.length ? `<section class="card pad room-up"><div class="row-head"><h2>Other upgrades</h2></div><div class="grid ups">${other.map(upCard).join('')}</div></section>` : ''}`;
  }

  return { editGoal, depositForm, TABS };
})();
