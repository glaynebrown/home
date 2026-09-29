/* Builders & quotes: who you've talked to, what they quoted, what's included,
   and their answers to the questions you ask everyone.
   #/builders            all builders
   #/builders/compare    side by side
   #/builders/questions  the shared questions list
   #/builders/{id}       one builder: contact, quote, what's included, answers, documents
   kind 'builder'  { name, contact, phone, email, website, status, perSqft, total,
                     includes: { site, permits, appliances }, allowances, timeline, notes,
                     answers: { questionId: text } }
   kind 'question' { text, order }   (a starter list is added once: settings.questionsSeeded)
   Documents can be linked to a builder (docs.js, doc.builderId). */
const Builders = (() => {
  const TABS = [['#/builders', 'Builders'], ['#/builders/compare', 'Compare'], ['#/builders/questions', 'Questions']];
  const STATUS = [['contacted', 'Contacted'], ['waiting', 'Waiting on a quote'], ['quoted', 'Got a quote'], ['top', 'Top pick'], ['pass', 'Passed']];
  const statusName = s => (STATUS.find(x => x[0] === s) || STATUS[0])[1];
  const INCLUDES = [['site', 'Site work (clearing, driveway, well, septic)'], ['permits', 'Permits & fees'], ['appliances', 'Appliances']];
  const STARTER_QUESTIONS = [
    'Do you build with construction-to-permanent loans, or work with lenders who do?',
    'What’s your price per sq ft, and what’s included in it?',
    'Is site work included (clearing, driveway, well, septic, power)?',
    'Are permits and fees included?',
    'What are the allowances for cabinets, counters, flooring and fixtures?',
    'How long does a build take, and when could you start?',
    'Can you plan for a future addition (foundation, septic and electrical panel sized for it)?',
    'Can we see a home you’ve built and talk to past clients?',
    'What warranty do you offer?',
    'How do change orders work, and what do they cost?',
  ];

  const list = () => kind('builder').sort((a, b) => (a.status === 'pass') - (b.status === 'pass') || (b.status === 'top') - (a.status === 'top') || a.t - b.t);
  const questions = () => kind('question').sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.t - b.t);

  async function seed() {
    if (settings().questionsSeeded) return;
    await saveSettings({ questionsSeeded: true });
    if (kind('question').length) return;
    for (let i = 0; i < STARTER_QUESTIONS.length; i++) await DB.add({ kind: 'question', text: STARTER_QUESTIONS[i], order: i });
  }

  function builderForm(b) {
    form({
      title: b ? 'Edit builder' : 'New builder',
      fields: [
        { name: 'name', label: 'Builder', value: b?.name, placeholder: 'Company name', required: true, autofocus: !b },
        { name: 'contact', label: 'Who you talked to', value: b?.contact },
        { name: 'phone', label: 'Phone', value: b?.phone },
        { name: 'email', label: 'Email', value: b?.email },
        { name: 'website', label: 'Website', type: 'url', value: b?.website },
        { name: 'status', label: 'Status', type: 'select', value: b?.status || 'contacted', options: STATUS },
        { name: 'perSqft', label: 'Price per sq ft', type: 'money', value: b?.perSqft ?? '' },
        { name: 'total', label: 'Quote total (if they gave one)', type: 'money', value: b?.total ?? '' },
        ...INCLUDES.map(([k, label]) => ({ name: `inc_${k}`, label: `Includes ${label.toLowerCase()}`, type: 'check', value: (b?.includes || {})[k] })),
        { name: 'allowances', label: 'Allowances', type: 'textarea', rows: 2, value: b?.allowances, placeholder: 'Cabinets, counters, flooring, fixtures…' },
        { name: 'timeline', label: 'Timeline', value: b?.timeline, placeholder: 'How long, and when they could start' },
        { name: 'notes', label: 'Notes', type: 'textarea', value: b?.notes },
      ],
      save: async v => {
        const includes = Object.fromEntries(INCLUDES.map(([k]) => [k, !!v[`inc_${k}`]]));
        INCLUDES.forEach(([k]) => delete v[`inc_${k}`]);
        const data = { ...v, includes };
        if (b) return DB.update(b.id, data);
        const id = await DB.add({ kind: 'builder', ...data, answers: {} });
        location.hash = `#/builders/${id}`;
      },
      remove: b && (async () => {
        if (!(await ask(`Delete ${b.name}? Its documents stay on the Documents page.`))) return false;
        await DB.remove(b);
        location.hash = '#/builders';
        return true;
      }),
    });
  }

  const priceLine = b => [b.perSqft && `${money(b.perSqft)}/sq ft`, b.total && `${money(b.total)} total`].filter(Boolean).join(' · ');
  const yesNo = v => (v ? '<span class="yes">✓</span>' : '<span class="no">✗</span>');

  Views.builders = {
    nav: 'home',
    render([sub]) {
      if (sub === 'compare') return compare();
      if (sub === 'questions') return questionsPage();
      if (sub) return detail(sub);
      const all = list();
      return `${pageTop('Builders & quotes', { back: ['#/', 'Home'], sub: 'Who you’ve talked to and what they quoted', right: `<button class="btn small" data-act="add">${icon('plus')} Builder</button>` })}
      ${tabs(TABS, '#/builders')}
      ${all.length ? `<div class="grid plans">${all.map(b => {
        const inc = INCLUDES.filter(([k]) => (b.includes || {})[k]).length;
        return `<a class="card pad builder-card${b.status === 'pass' ? ' faded' : ''}" href="#/builders/${b.id}">
          <div class="title-row"><h3>${esc(b.name)}</h3><span class="badge ${b.status === 'top' ? 'done' : b.status === 'quoted' ? 'prep' : ''}">${statusName(b.status)}</span></div>
          <p>${priceLine(b) || '<span class="muted">No quote yet</span>'}</p>
          <p class="muted small">${[b.contact && esc(b.contact), `${inc} of ${INCLUDES.length} extras included`, b.timeline && esc(b.timeline)].filter(Boolean).join(' · ')}</p>
        </a>`;
      }).join('')}</div>`
        : empty('plans', 'No builders yet', 'Add each builder you talk to. Keep their quote, what’s included, and their answers to your questions in one place.', `<button class="btn" data-act="add">${icon('plus')} Add a builder</button>`)}`;
    },
    acts: {
      add: () => builderForm(null),
      edit: el => builderForm(get(el.dataset.id)),
      async useRate(el) {
        const b = get(el.dataset.id);
        if (!(await ask(`Use ${money(b.perSqft)}/sq ft from ${b.name} for your Budget and floor plan estimates?`, { ok: 'Use it', danger: false, title: 'Use this price?' }))) return;
        await saveSettings({ costPerSqft: b.perSqft });
        toast(`Budget now uses ${money(b.perSqft)}/sq ft`);
      },
      answer(el) {
        const b = get(el.dataset.id), q = get(el.dataset.q);
        form({
          title: 'Their answer',
          intro: `<p><b>${esc(q.text)}</b></p>`,
          fields: [{ name: 'a', label: '', type: 'textarea', rows: 4, value: (b.answers || {})[q.id] || '', autofocus: true }],
          save: v => DB.update(b.id, { answers: { ...(b.answers || {}), [q.id]: v.a } }),
        });
      },
      doc: el => Docs.open(get(el.dataset.id)),
      addQuestion: () => questionForm(null),
      editQuestion: el => questionForm(get(el.dataset.id)),
    },
  };

  function detail(id) {
    const b = get(id);
    if (!b) return empty('plans', 'Builder not found', 'It may have been deleted.', '<a class="btn" href="#/builders">All builders</a>');
    const qs = questions(), ans = b.answers || {};
    const docs = kind('doc').filter(d => d.builderId === id).sort(newest);
    const answered = qs.filter(q => (ans[q.id] || '').trim()).length;
    const links = [
      b.phone && `<a class="btn small ghost" href="tel:${esc(b.phone.replace(/[^0-9+]/g, ''))}">Call</a>`,
      b.email && `<a class="btn small ghost" href="mailto:${esc(b.email)}">Email</a>`,
      b.website && `<a class="btn small ghost" href="${esc(b.website)}" target="_blank" rel="noopener">${icon('open')} Website</a>`,
    ].filter(Boolean).join('');
    return `${pageTop(b.name, {
      back: ['#/builders', 'Builders'],
      sub: [statusName(b.status), b.contact && esc(b.contact)].filter(Boolean).join(' · '),
      right: `<button class="icon-btn" data-act="edit" data-id="${id}" aria-label="Edit builder">${icon('edit')}</button>`,
    })}
    <section class="card pad plan-sum">
      <p class="stats">${priceLine(b) || 'No quote yet'}</p>
      ${b.perSqft ? `<button class="btn small" data-act="useRate" data-id="${id}">${settings().costPerSqft === b.perSqft ? '✓ Your Budget uses this price' : 'Use this price in our Budget'}</button>` : ''}
      ${links ? `<div class="btn-row">${links}</div>` : ''}
    </section>
    <section class="card pad">
      <h2>What’s included</h2>
      <ul class="inc-list">${INCLUDES.map(([k, label]) => `<li>${yesNo((b.includes || {})[k])} ${esc(label)}</li>`).join('')}</ul>
      ${b.allowances ? `<p><b>Allowances:</b> ${esc(b.allowances)}</p>` : ''}
      ${b.timeline ? `<p><b>Timeline:</b> ${esc(b.timeline)}</p>` : ''}
      ${b.notes ? `<p class="notes">${esc(b.notes)}</p>` : ''}
    </section>
    <section class="card pad">
      <div class="row-head"><h2>Questions</h2><span class="muted small">${answered} of ${qs.length} answered</span></div>
      <ul class="qa">${qs.map(q => `<li><button data-act="answer" data-id="${id}" data-q="${q.id}">
        <b>${esc(q.text)}</b>${(ans[q.id] || '').trim() ? `<span>${esc(ans[q.id])}</span>` : '<span class="muted">Tap to add their answer</span>'}</button></li>`).join('')}</ul>
      <a class="linkish" href="#/builders/questions">Edit the questions list</a>
    </section>
    <section class="card pad">
      <h2>Documents</h2>
      ${docs.length ? `<div class="docs">${docs.map(d => Docs.tile(d, 'doc')).join('')}</div>` : '<p class="muted">Add their quote or contract on the Documents page and pick this builder.</p>'}
    </section>`;
  }

  function compare() {
    const all = list().filter(b => b.status !== 'pass');
    const row = (label, f) => `<tr><th scope="row">${label}</th>${all.map(b => `<td>${f(b)}</td>`).join('')}</tr>`;
    return `${pageTop('Builders & quotes', { back: ['#/', 'Home'], sub: 'Side by side' })}
    ${tabs(TABS, '#/builders/compare')}
    ${all.length ? `<div class="card compare-wrap"><table class="compare-table">
      <thead><tr><th></th>${all.map(b => `<th scope="col"><a href="#/builders/${b.id}">${esc(b.name)}</a></th>`).join('')}</tr></thead>
      <tbody>
        ${row('Status', b => statusName(b.status))}
        ${row('Per sq ft', b => (b.perSqft ? money(b.perSqft) : '—'))}
        ${row('Quote total', b => (b.total ? money(b.total) : '—'))}
        ${INCLUDES.map(([k, label]) => row(label.replace(/ \(.*\)/, ''), b => yesNo((b.includes || {})[k]))).join('')}
        ${row('Timeline', b => esc(b.timeline || '—'))}
        ${row('Questions answered', b => `${questions().filter(q => ((b.answers || {})[q.id] || '').trim()).length} of ${questions().length}`)}
      </tbody></table></div>
      <p class="muted small center-note">Passed builders are left out. Swipe sideways to see more.</p>`
      : empty('plans', 'Nothing to compare yet', 'Add builders and their quotes, and they’ll line up here.')}`;
  }

  function questionsPage() {
    const qs = questions();
    return `${pageTop('Builders & quotes', { back: ['#/', 'Home'], sub: 'Questions to ask every builder', right: `<button class="btn small" data-act="addQuestion">${icon('plus')} Question</button>` })}
    ${tabs(TABS, '#/builders/questions')}
    <ol class="q-list">${qs.map(q => `<li><button data-act="editQuestion" data-id="${q.id}">${esc(q.text)}</button></li>`).join('')}</ol>
    <p class="muted small center-note">Each builder’s page has a spot for their answer to every question.</p>`;
  }

  function questionForm(q) {
    form({
      title: q ? 'Edit question' : 'New question',
      fields: [{ name: 'text', label: 'Question', type: 'textarea', rows: 3, value: q?.text, required: true, autofocus: true }],
      save: async v => {
        if (q) return DB.update(q.id, v);
        await DB.add({ kind: 'question', text: v.text, order: questions().length });
      },
      remove: q && (async () => {
        if (!(await ask('Delete this question? Answers to it are hidden too.'))) return false;
        await DB.remove(q);
        return true;
      }),
    });
  }

  // The home page card (half width, left of Documents).
  function card() {
    const all = list(), top = all.find(b => b.status === 'top') || all.find(b => b.perSqft);
    return `<a class="card pad home-card" href="#/builders">
      <h2>${icon('money')} Builders & quotes</h2>
      <p class="muted small">${all.length} builder${all.length === 1 ? '' : 's'}</p>
      ${top ? `<p class="small"><b>${esc(top.name)}</b>${top.perSqft ? ` · ${money(top.perSqft)}/sq ft` : ''}</p>` : '<p class="small muted">Track quotes and what’s included.</p>'}
    </a>`;
  }

  return { seed, card, list };
})();
