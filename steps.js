/* Steps & timeline: the whole path from pre-approval to move-in.
   #/steps
   kind 'step' { title, order, done, date ('YYYY-MM-DD': planned, or when it
   was done), note }. A starter list is added once (settings.stepsSeeded);
   everything can be edited, reordered (hold and drag), added or deleted. */
const Steps = (() => {
  const STARTER = [
    'Get pre-approved for a construction loan',
    'Find the land',
    'Perc test',
    'Boundary survey',
    'Subdivision survey',
    'Make an offer on the land',
    'Land closing',
    'Pick a builder',
    'Plan revisions',
    'Permits',
    'Construction loan closing',
    'Site work: clearing, driveway, well, septic, power',
    'Foundation',
    'Framing & roof',
    'Plumbing, electrical & heating/cooling',
    'Drywall & finishes',
    'Final inspection',
    'Move in!',
  ];
  let dragControl = null;

  const list = () => kind('step').sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.t - b.t);
  const next = () => list().filter(s => !s.done);

  async function seed() {
    if (settings().stepsSeeded) return;
    await saveSettings({ stepsSeeded: true });
    if (kind('step').length) return;
    for (let i = 0; i < STARTER.length; i++) await DB.add({ kind: 'step', title: STARTER[i], order: i, done: false, date: '', note: '' });
  }

  function stepForm(s) {
    form({
      title: s ? 'Edit step' : 'New step',
      fields: [
        { name: 'title', label: 'Step', value: s?.title, required: true, autofocus: !s },
        { name: 'date', label: s && s.done ? 'Done on' : 'Planned date (optional)', type: 'date', value: s?.date || '' },
        { name: 'note', label: 'Notes', type: 'textarea', value: s?.note, placeholder: 'Who to call, what to bring…' },
        ...(s ? [{ name: 'done', label: 'Done', type: 'check', value: s.done }] : []),
      ],
      save: async v => {
        if (s) return DB.update(s.id, v);
        await DB.add({ kind: 'step', ...v, done: false, order: list().length });
      },
      remove: s && (async () => {
        if (!(await ask(`Delete “${s.title}”?`))) return false;
        await DB.remove(s);
        return true;
      }),
    });
  }

  const when = s => (s.date ? `${s.done ? 'Done ' : ''}${niceDate(s.date)}` : '');

  Views.steps = {
    nav: 'home',
    render() {
      const all = list(), done = all.filter(s => s.done).length;
      const nx = next()[0];
      return `${pageTop('Steps & timeline', { back: ['#/', 'Home'], sub: 'From pre-approval to move-in', right: `<button class="btn small" data-act="add">${icon('plus')} Step</button>` })}
      ${all.length ? `<section class="card pad">
        <div class="row-head"><h2>${done} of ${all.length} done</h2></div>
        <div class="bar"><i style="width:${(done / all.length * 100).toFixed(1)}%"></i></div>
        ${nx ? `<p class="next-step">Next: <b>${esc(nx.title)}</b>${nx.date ? ` · ${niceDate(nx.date)}` : ''}</p>` : '<p class="next-step"><b>Everything’s done. Welcome home! 🏡</b></p>'}
      </section>
      <ol class="steps">${all.map((s, i) => `<li class="step${s.done ? ' done' : ''}${s === nx ? ' next' : ''}" data-sort="${s.id}">
          <button class="step-check" data-act="toggle" data-id="${s.id}" aria-label="${s.done ? 'Mark not done' : 'Mark done'}: ${esc(s.title)}">${s.done ? '✓' : i + 1}</button>
          <button class="step-body" data-act="edit" data-id="${s.id}">
            <span class="step-title">${esc(s.title)}</span>
            ${when(s) || s.note ? `<small>${[when(s), s.note && esc(s.note)].filter(Boolean).join(' · ')}</small>` : ''}
          </button>
        </li>`).join('')}</ol>
      <p class="muted small center-note">Tap the circle to check a step off. Press and hold a step to move it.</p>`
        : empty('plans', 'No steps yet', 'Add the steps between now and move-in day.', `<button class="btn" data-act="add">${icon('plus')} Add a step</button>`)}`;
    },
    after(root) {
      if (dragControl) dragControl.abort();
      dragControl = new AbortController();
      const box = root.querySelector('.steps');
      if (box) sortable(box, {
        item: '.step', signal: dragControl.signal,
        onDrop: async ids => {
          for (let i = 0; i < ids.length; i++) if (get(ids[i]) && get(ids[i]).order !== i) await DB.update(ids[i], { order: i });
        },
      });
    },
    acts: {
      add: () => stepForm(null),
      edit: el => stepForm(get(el.dataset.id)),
      async toggle(el) {
        const s = get(el.dataset.id);
        // Checking a step off with no date records today.
        await DB.update(s.id, s.done ? { done: false } : { done: true, date: s.date || today() });
      },
    },
  };

  // The home page card.
  function card() {
    const all = list(), done = all.filter(s => s.done).length, up = next();
    return `<a class="card pad home-card" href="#/steps">
      <div class="row-head"><h2>${icon('plans')} Steps & timeline</h2><span class="muted small">${done} of ${all.length} done</span></div>
      ${all.length ? `<div class="bar"><i style="width:${(done / all.length * 100).toFixed(1)}%"></i></div>` : ''}
      ${up.length ? `<p class="next-step">Next: <b>${esc(up[0].title)}</b>${up[0].date ? ` · ${niceDate(up[0].date)}` : ''}</p>
        ${up.length > 1 ? `<ul class="then">${up.slice(1, 3).map(s => `<li>${esc(s.title)}${s.date ? ` · ${niceDate(s.date)}` : ''}</li>`).join('')}</ul>` : ''}`
        : all.length ? '<p class="next-step"><b>Everything’s done. Welcome home! 🏡</b></p>' : '<p class="muted">Tap to plan the steps from pre-approval to move-in.</p>'}
    </a>`;
  }

  return { seed, card };
})();
