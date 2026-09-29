/* Build progress journal: dated notes and photos of each stage once
   construction starts.
   #/journal
   kind 'journal' { date 'YYYY-MM-DD', stage, note, photos: [] }
   The home page shows it in place of Builders & quotes once you switch
   (settings.journalMode; shared). Adding an entry for a stage offers to
   check off the matching step in Steps & timeline. */
const Journal = (() => {
  const STAGES = [
    ['site', 'Site work', /site work/i],
    ['foundation', 'Foundation', /foundation/i],
    ['framing', 'Framing & roof', /framing/i],
    ['systems', 'Plumbing, electrical & heating', /plumbing|electrical/i],
    ['drywall', 'Drywall', /drywall/i],
    ['finishes', 'Finishes', /finishes/i],
    ['final', 'Final walkthrough', /final/i],
    ['other', 'Other', null],
  ];
  const stageName = k => (STAGES.find(s => s[0] === k) || STAGES[STAGES.length - 1])[1];
  let filter = 'all';

  const list = () => kind('journal').sort((a, b) => (b.date || '').localeCompare(a.date || '') || newest(a, b));

  // The step in Steps & timeline that goes with a stage, if any.
  function stepFor(stage) {
    const re = (STAGES.find(s => s[0] === stage) || [])[2];
    return re ? kind('step').sort((a, b) => (a.order ?? 0) - (b.order ?? 0)).find(s => re.test(s.title)) : null;
  }

  function entryForm(e) {
    const keep = [...((e && e.photos) || [])], dropped = [], added = [];
    const sh = sheet(e ? 'Edit entry' : 'New entry', `<form class="topic-form" novalidate>
      <label class="field"><span class="lbl">Date</span><input type="date" name="date" value="${esc(e?.date || today())}"></label>
      <label class="field"><span class="lbl">Stage</span><select name="stage">${STAGES.map(([k, n]) => `<option value="${k}"${(e?.stage || 'site') === k ? ' selected' : ''}>${esc(n)}</option>`).join('')}</select></label>
      <label class="field"><span class="lbl">Notes</span><textarea name="note" rows="4" placeholder="What happened, questions for the builder, things to watch…">${esc(e?.note || '')}</textarea></label>
      <div class="field"><span class="lbl">Photos</span><div class="topic-photos"></div>
        <div class="btn-row"><button type="button" class="btn small ghost" data-pick>${icon('camera')} Choose photos</button>
        ${navigator.clipboard && navigator.clipboard.read ? '<button type="button" class="btn small ghost" data-paste>Paste photo</button>' : ''}</div></div>
      <p class="form-err" hidden></p>
      <div class="sheet-actions">${e ? '<button type="button" class="btn ghost danger" data-remove>Delete</button>' : ''}<span class="grow"></span><button class="btn" data-save>Save</button></div>
    </form>`);
    const grid = sh.q('.topic-photos');
    const draw = () => {
      grid.innerHTML = [
        ...keep.map((p, i) => `<div class="tp"><img src="${esc(thumb(p))}" alt=""><button type="button" class="tp-x" data-k="${i}" aria-label="Remove photo">×</button></div>`),
        ...added.map((f, i) => `<div class="tp"><img src="${f.url}" alt=""><button type="button" class="tp-x" data-n="${i}" aria-label="Remove photo">×</button></div>`),
      ].join('') || '<p class="muted small">No photos yet.</p>';
    };
    draw();
    grid.addEventListener('click', ev => {
      const x = ev.target.closest('.tp-x');
      if (!x) return;
      if (x.dataset.k != null) dropped.push(...keep.splice(+x.dataset.k, 1));
      else added.splice(+x.dataset.n, 1);
      draw();
    });
    const addFile = blob => { added.push({ blob, url: URL.createObjectURL(blob) }); draw(); };
    sh.q('[data-pick]').onclick = async () => (await pickFiles(true)).forEach(addFile);
    const paste = sh.q('[data-paste]');
    if (paste) paste.onclick = async () => {
      try {
        for (const item of await navigator.clipboard.read()) {
          const type = item.types.find(t => t.startsWith('image/'));
          if (type) return addFile(await item.getType(type));
        }
        toast('No photo copied yet. In Safari, press and hold a photo → Copy.', 4000);
      } catch (err) {
        console.warn(err);
        toast('Couldn’t paste. In Safari, press and hold a photo → Copy, then try again.', 4000);
      }
    };

    sh.q('form').addEventListener('submit', async ev => {
      ev.preventDefault();
      const btn = sh.q('[data-save]');
      btn.disabled = true; btn.textContent = 'Saving…';
      try {
        const f = sh.q('form').elements;
        const uploaded = added.length ? await uploadFiles(added.map(a => a.blob)) : [];
        const data = { date: f.date.value || today(), stage: f.stage.value, note: f.note.value.trim(), photos: [...keep, ...uploaded] };
        if (e) await DB.update(e.id, data);
        else await DB.add({ kind: 'journal', ...data });
        if (dropped.length) DB.dropPhotos(dropped);
        sh.close();
        // Offer to check off the matching step.
        const step = stepFor(data.stage);
        if (!e && step && !step.done && await ask(`Mark “${step.title}” as done in Steps & timeline?`, { ok: 'Mark done', danger: false, title: 'Check off the step?' })) {
          await DB.update(step.id, { done: true, date: data.date });
          toast(`${step.title}: done ✓`);
        }
      } catch (err) {
        console.error(err);
        const m = sh.q('.form-err'); m.textContent = err.message || 'Something went wrong. Try again.'; m.hidden = false;
        btn.disabled = false; btn.textContent = 'Save';
      }
    });
    const del = sh.q('[data-remove]');
    if (del) del.onclick = async () => {
      if (!(await ask('Delete this entry and its photos?'))) return;
      await DB.remove(e);
      sh.close();
    };
  }

  Views.journal = {
    nav: 'home',
    render() {
      const all = list();
      const used = STAGES.filter(([k]) => all.some(x => x.stage === k));
      if (filter !== 'all' && !used.some(([k]) => k === filter)) filter = 'all';
      const shown = filter === 'all' ? all : all.filter(x => x.stage === filter);
      const chip = (k, t) => `<button class="chip${filter === k ? ' on' : ''}" data-act="filter" data-f="${k}">${esc(t)}</button>`;
      return `${pageTop('Build journal', { back: ['#/', 'Home'], sub: 'Every stage, from dirt to move-in', right: `<button class="btn small" data-act="add">${icon('plus')} Entry</button>` })}
      ${used.length > 1 ? `<div class="bar-row">${chip('all', 'All')}${used.map(([k, n]) => chip(k, n)).join('')}</div>` : ''}
      ${shown.length ? `<div class="journal">${shown.map(x => `<article class="card pad j-entry">
          <button class="j-head" data-act="edit" data-id="${x.id}">
            <span class="j-date">${niceDate(x.date)}</span><span class="badge">${esc(stageName(x.stage))}</span>
          </button>
          ${x.note ? `<p class="notes">${esc(x.note)}</p>` : ''}
          ${(x.photos || []).length ? `<div class="j-photos">${x.photos.map((p, i) => `<button data-act="photo" data-id="${x.id}" data-i="${i}"><img src="${esc(thumb(p))}" alt="" loading="lazy"></button>`).join('')}</div>` : ''}
          ${byLine(x) ? `<p class="muted small">${byLine(x)}</p>` : ''}
        </article>`).join('')}</div>`
        : empty('camera', 'No entries yet', 'Once construction starts, add photos and notes as each stage happens. It helps catch problems early, and it’s a keepsake too.', `<button class="btn" data-act="add">${icon('plus')} Add an entry</button>`)}
      <p class="muted small center-note"><a href="#/builders">Builders & quotes</a> is still here whenever you need it.</p>`;
    },
    acts: {
      add: () => entryForm(null),
      edit: el => entryForm(get(el.dataset.id)),
      filter(el) { filter = el.dataset.f; render(true); },
      photo(el) {
        const x = get(el.dataset.id);
        viewer((x.photos || []).map(p => ({ photo: p, title: stageName(x.stage), text: x.note || '', sub: niceDate(x.date) })), +el.dataset.i);
      },
    },
  };

  // The home page card (half width, in place of Builders & quotes).
  function card() {
    const all = list(), last = all[0];
    const photo = (all.find(x => (x.photos || []).length) || {}).photos?.[0];
    return `<div class="card pad home-card has-switch">
      <a class="card-link" href="#/journal">
        <h2>${icon('camera')} Build journal</h2>
        ${photo ? `<img class="j-cover" src="${esc(thumb(photo))}" alt="" loading="lazy">` : ''}
        <p class="muted small">${all.length} entr${all.length === 1 ? 'y' : 'ies'}</p>
        ${last ? `<p class="small"><b>${esc(stageName(last.stage))}</b> · ${niceDate(last.date)}</p>` : '<p class="small muted">Photos of every stage.</p>'}
      </a>
      <button class="card-switch" data-act="switchCard" data-to="builders">Back to builders</button>
    </div>`;
  }

  return { card };
})();
