/* Documents: the paperwork you'll collect along the way (perc results, the
   survey, the pre-approval letter, quotes, contracts), from your phone.
   #/docs
   kind 'doc' { name, category, note, landId, builderId, file }
     file = a photo (like any other photo), or for a PDF:
            { path, url, type: 'application/pdf', size, fileName }
   Photos of paper are shrunk like other photos; PDFs upload as they are. */
const Docs = (() => {
  const CATS = ['Land & surveys', 'Loan & money', 'Builders & quotes', 'Plans & permits', 'Other'];
  const isPdf = f => f && f.type === 'application/pdf';
  const list = () => kind('doc').sort(newest);

  async function upload(file) {
    if (file.type === 'application/pdf' || /\.pdf$/i.test(file.name || '')) {
      if (file.size > 20 * 1024 * 1024) throw new Error('That PDF is over 20 MB. Try a smaller one.');
      toast('Uploading PDF…', 0);
      const f = await DB.uploadFile(file);
      toastDone();
      return f;
    }
    toast('Adding photo…', 0);
    const p = await DB.upload(await Photos.prepare(file));
    toastDone();
    return p;
  }

  function pickDoc() {
    return new Promise(resolve => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*,application/pdf';
      input.hidden = true;
      document.body.appendChild(input);
      input.addEventListener('change', () => { resolve(input.files[0] || null); input.remove(); }, { once: true });
      input.addEventListener('cancel', () => { resolve(null); input.remove(); }, { once: true });
      input.click();
    });
  }

  function docForm(d, file) {
    const props = kind('land').sort(newest);
    const s = form({
      title: d ? 'Edit document' : 'New document',
      intro: file ? `<p>${isPdfFile(file) ? '📄' : '🖼️'} ${esc(file.name || 'Photo')}</p>` : '',
      fields: [
        { name: 'name', label: 'Name', value: d?.name ?? (file ? (file.name || '').replace(/\.[a-z0-9]+$/i, '') : ''), placeholder: 'Perc test results', required: true, autofocus: true },
        { name: 'category', label: 'Type', type: 'select', value: d?.category || CATS[0], options: CATS.map(c => [c, c]) },
        ...(Builders.list().length ? [{ name: 'builderId', label: 'Builder (optional)', type: 'select', value: d?.builderId || '', options: [['', 'None'], ...Builders.list().map(b => [b.id, b.name])] }] : []),
        ...(props.length ? [{ name: 'landId', label: 'Property (optional)', type: 'select', value: d?.landId || '', options: [['', 'None'], ...props.map(p => [p.id, p.name])] }] : []),
        { name: 'note', label: 'Notes', type: 'textarea', value: d?.note, placeholder: 'Approved for a 4-bedroom system' },
      ],
      save: async v => {
        const data = { ...v, landId: v.landId || null, builderId: v.builderId || null };
        if (d) return DB.update(d.id, data);
        const f = await upload(file);
        await DB.add({ kind: 'doc', ...data, file: f });
        toast('Saved');
      },
      remove: d && (async () => {
        if (!(await ask(`Delete “${d.name}”?`))) return false;
        await DB.remove(d);
        return true;
      }),
    });
    return s;
  }
  const isPdfFile = f => f.type === 'application/pdf' || /\.pdf$/i.test(f.name || '');

  function open(d) {
    if (isPdf(d.file)) { window.open(d.file.url, '_blank', 'noopener'); return; }
    viewer([{ photo: d.file, title: d.name, text: d.note || '', sub: esc(d.category || ''), actions: [{ label: 'Edit', fn: () => { docForm(d); return 'close'; } }] }], 0);
  }

  // openAct/editAct: the data-act names to use (another page can show these too).
  const tileHtml = (d, openAct = 'open', editAct = 'edit') => `<div class="doc">
      <button class="doc-open" data-act="${openAct}" data-id="${d.id}">
        ${isPdf(d.file) ? `<span class="doc-pdf">PDF</span>` : `<img src="${esc(thumb(d.file))}" alt="" loading="lazy">`}
      </button>
      <button class="doc-txt" data-act="${editAct}" data-id="${d.id}"><b>${esc(d.name)}</b>
        <small>${[d.builderId && get(d.builderId) && esc(get(d.builderId).name), d.landId && get(d.landId) && esc(get(d.landId).name), niceDate(d.t)].filter(Boolean).join(' · ')}</small>
        ${d.note ? `<small>${esc(d.note)}</small>` : ''}</button>
    </div>`;

  Views.docs = {
    nav: 'home',
    render() {
      const all = list();
      return `${pageTop('Documents', { back: ['#/', 'Home'], sub: 'Surveys, quotes, letters and contracts', right: `<button class="btn small" data-act="add">${icon('plus')} Add</button>` })}
      ${all.length ? CATS.map(c => {
        const inCat = all.filter(d => (d.category || 'Other') === c);
        return inCat.length ? `<section><h2 class="cat-h">${esc(c)}</h2><div class="docs">${inCat.map(d => tileHtml(d)).join('')}</div></section>` : '';
      }).join('')
        : empty('note', 'No documents yet', 'Add photos of paperwork or PDFs: perc results, surveys, your pre-approval letter, builder quotes. They’re saved for both of you.', `<button class="btn" data-act="add">${icon('plus')} Add a document</button>`)}
      <p class="muted small center-note">Photos of paper or PDF files, up to 20 MB each.</p>`;
    },
    acts: {
      async add() {
        const file = await pickDoc();
        if (file) docForm(null, file);
      },
      edit: el => docForm(get(el.dataset.id)),
      open: el => open(get(el.dataset.id)),
    },
  };

  // The home page card (half width, right of Builders & quotes).
  function card() {
    const all = list();
    return `<a class="card pad home-card" href="#/docs">
      <h2>${icon('note')} Documents</h2>
      <p class="muted small">${all.length} saved</p>
      ${all.length ? `<ul class="then small">${all.slice(0, 2).map(d => `<li>${isPdf(d.file) ? '📄' : '🖼️'} ${esc(d.name)}</li>`).join('')}</ul>`
        : '<p class="small muted">Surveys, letters, quotes…</p>'}
    </a>`;
  }

  return { card, open, tile: (d, openAct) => tileHtml(d, openAct, openAct) };
})();
