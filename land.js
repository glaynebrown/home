/* Land and design links.
   #/land          properties you're watching
   #/land/{id}     one property: photos, numbers, checklist, notes
   #/links         saved websites (floor plan + 3D tools, inspiration, land) */
const Land = (() => {
  const STATUS = [['looking', 'Looking'], ['visited', 'Visited'], ['favorite', 'Favorite'], ['pass', 'Passed']];
  const statusName = s => (STATUS.find(x => x[0] === s) || STATUS[0])[1];
  const CHECKS = [
    ['road', 'Road access'], ['power', 'Power nearby'], ['water', 'Water / well'], ['perc', 'Perc test (septic)'],
    ['zoning', 'Zoning OK for what we want'], ['internet', 'Internet / cell signal'], ['flood', 'Not in a flood zone'], ['spot', 'Good building spot'],
  ];
  let filter = 'all';

  const perAcre = p => (p.price && p.acres ? p.price / p.acres : null);
  const facts = p => [p.acres && `${commas(p.acres)} acres`, p.price && money(p.price), perAcre(p) && `${money(perAcre(p))}/acre`].filter(Boolean).join(' · ');

  // pre = values filled in from a listing (listing.js), for a new property.
  function landForm(p, pre = {}) {
    const v0 = p || pre;
    const hinted = !p && pre.checks ? Object.keys(pre.checks).map(k => Listing.HINT_NAMES[k]).filter(Boolean) : [];
    const filled = !p && (pre.price || pre.acres || pre.photoBlob || pre.notes);
    const checks = { ...(pre.checks || {}) };
    const msg = pre.note ? `<p>${esc(pre.note)}</p>`
      : filled ? `<p>Filled in from the listing. Check it over, then save.${hinted.length ? ` The listing also mentions: <b>${hinted.map(esc).join(', ')}</b>, so ${hinted.length > 1 ? 'those are' : 'that’s'} checked on the checklist for you to confirm.` : ''}</p>` : '';
    const pasteBox = p ? '' : `<details class="paste in-form"${pre.pasteOpen ? ' open' : ''}><summary>Paste the listing text to fill in more</summary>
      ${Listing.TIPS}<textarea data-paste rows="5" placeholder="Paste here"></textarea>
      <button type="button" class="btn small" data-fill>Fill in from text</button></details>`;
    const s = form({
      title: p ? 'Edit property' : 'New property',
      intro: msg + pasteBox,
      fields: [
        { name: 'name', label: 'Name', value: v0.name, placeholder: 'Pasture off Route 9', required: true, autofocus: !p && !v0.name },
        { name: 'place', label: 'Where', value: v0.place, placeholder: 'County, town' },
        { name: 'acres', label: 'Acres', type: 'number', value: v0.acres, placeholder: '15' },
        { name: 'price', label: 'Price', type: 'money', value: v0.price ?? '', placeholder: '120,000' },
        ...(p ? [] : [{ name: 'photo', label: 'Main photo', type: 'photo', value: null, file: pre.photoBlob, hint: 'From a listing: in Safari, press and hold its photo → Copy, then tap Paste photo.' }]),
        { name: 'status', label: 'Status', type: 'select', value: v0.status || 'looking', options: STATUS },
        { name: 'link', label: 'Listing link', type: 'url', value: v0.link, placeholder: 'redfin.com/…' },
        { name: 'notes', label: 'Notes', type: 'textarea', value: v0.notes, rows: 5, placeholder: 'Creek on the back side, flat spot near the road…' },
      ],
      save: async v => {
        if (p) return DB.update(p.id, v);
        const { photo, ...rest } = v;
        const id = await DB.add({ kind: 'land', ...rest, hearts: 0, photos: photo ? [photo] : [], checks });
        location.hash = `#/land/${id}`;
      },
      remove: p && (async () => {
        if (!(await ask(`Delete “${p.name}” and its photos?`))) return false;
        await DB.remove(p);
        location.hash = '#/land';
        return true;
      }),
    });

    // Pasted listing text fills in what it finds (and never erases what's there).
    if (!p) s.q('[data-fill]').onclick = () => {
      const text = s.q('[data-paste]').value;
      if (!text.trim()) return toast('Paste the listing text first.');
      const f = s.q('form').elements;
      const got = Listing.build({ link: fixUrl(f.link.value), text });
      const found = [];
      const put = (name, val, label, replace) => {
        if (val == null || val === '') return;
        if (!replace && f[name].value.trim()) return;
        f[name].value = name === 'price' ? commas(val) : val;
        found.push(label);
      };
      put('name', got.name, 'name');
      put('place', got.place, 'place');
      put('acres', got.acres, 'acres', true);
      put('price', got.price, 'price', true);
      put('notes', got.notes, 'notes');
      const newChecks = Object.keys(got.checks).filter(k => !checks[k]);
      Object.assign(checks, got.checks);
      const extra = newChecks.map(k => Listing.HINT_NAMES[k]).filter(Boolean);
      s.q('details.paste').open = false;
      toast(found.length || extra.length
        ? `Filled in ${found.join(', ') || 'the checklist'}${extra.length ? `. Checklist: ${extra.join(', ')}` : ''}`
        : 'Couldn’t find a price or acres in that text.', 4000);
    };
  }

  Views.land = {
    nav: 'land',
    render([id]) {
      if (id) return detail(id);
      const all = kind('land').sort((a, b) => (a.status === 'pass') - (b.status === 'pass') || (b.hearts || 0) - (a.hearts || 0) || newest(a, b));
      const list = filter === 'all' ? all : all.filter(p => p.status === filter);
      const count = s => all.filter(p => p.status === s).length;
      const chip = (key, text) => `<button class="chip${filter === key ? ' on' : ''}" data-act="filter" data-f="${key}">${text}</button>`;
      return `${pageTop('Land', { link: linkBtn('Land'), sub: 'Properties we’re watching', right: `<button class="btn small" data-act="add">${icon('plus')} Property</button>` })}
      ${all.length ? `<div class="bar-row">${chip('all', 'All')}${STATUS.filter(([k]) => count(k)).map(([k, t]) => chip(k, `${t} (${count(k)})`)).join('')}</div>` : ''}
      ${list.length ? `<div class="grid plans">${list.map(p => `<a class="plan-card${p.status === 'pass' ? ' faded' : ''}" href="#/land/${p.id}">${cover((p.photos || [])[0], 'land')}
          <div class="tile-txt"><div class="title-row"><h3>${esc(p.name)}</h3><span class="badge ${esc(p.status || 'looking')}">${statusName(p.status)}</span></div>
          ${hearts(p.hearts)}<p>${facts(p) || esc(p.place || '')}</p>${p.place && facts(p) ? `<p class="muted">${esc(p.place)}</p>` : ''}</div></a>`).join('')}</div>`
        : all.length ? '<p class="muted center">Nothing here.</p>'
          : empty('land', 'No properties yet', 'Save listings you’re watching and photos from land visits, then compare them side by side.', `<button class="btn" data-act="add">${icon('plus')} Add a property</button>`)}`;
    },
    acts: {
      add: () => Listing.start(),
      edit: el => landForm(get(el.dataset.id)),
      filter(el) { filter = el.dataset.f; render(true); },
      async hearts(el) {
        const p = get(el.dataset.id), n = +el.dataset.n;
        await DB.update(p.id, { hearts: p.hearts === n ? n - 1 : n });
      },
      // Tap cycles: not sure -> yes -> no -> not sure.
      async check(el) {
        const p = get(el.dataset.id), key = el.dataset.k;
        const cur = (p.checks || {})[key];
        const next = !cur ? 'yes' : cur === 'yes' ? 'no' : null;
        const checks = { ...(p.checks || {}) };
        if (next) checks[key] = next; else delete checks[key];
        await DB.update(p.id, { checks });
      },
      async addPhotos(el) {
        const p = get(el.dataset.id);
        await addPhotos(async photos => DB.update(p.id, { photos: [...(get(p.id).photos || []), ...photos] }));
      },
      photo(el) {
        const p = get(el.dataset.id);
        viewer((p.photos || []).map((photo, k) => ({
          photo, title: p.name,
          actions: [
            { label: 'Make first', fn: async () => {
              const cur = get(p.id).photos || [];
              await DB.update(p.id, { photos: [cur[k], ...cur.filter((_, j) => j !== k)] });
              toast('Moved to the front');
              return 'close';
            } },
            { label: 'Delete', danger: true, fn: async () => {
              if (!(await ask('Delete this photo?'))) return;
              const cur = get(p.id).photos || [];
              await DB.update(p.id, { photos: cur.filter((_, j) => j !== k) });
              DB.dropPhotos([cur[k]]);
              return 'close';
            } },
          ],
        })), +el.dataset.i);
      },
    },
  };

  function detail(id) {
    const p = get(id);
    if (!p) return empty('land', 'Property not found', 'It may have been deleted.', '<a class="btn" href="#/land">All land</a>');
    const photos = p.photos || [];
    const checks = p.checks || {};
    const yes = CHECKS.filter(([k]) => checks[k] === 'yes').length;
    return `${pageTop(p.name, {
      back: ['#/land', 'Land'],
      sub: esc(p.place || ''),
      right: `<button class="icon-btn" data-act="edit" data-id="${id}" aria-label="Edit property">${icon('edit')}</button>`,
    })}
    <div class="gallery">
      ${photos.map((ph, i) => `<button class="g-photo" data-act="photo" data-id="${id}" data-i="${i}"><img src="${esc(thumb(ph))}" alt="" loading="lazy"></button>`).join('')}
      <button class="g-add" data-act="addPhotos" data-id="${id}">${icon('camera')}<span>${photos.length ? 'Add more' : 'Add photos'}</span></button>
    </div>
    <div class="card pad plan-sum">
      <div class="title-row">${hearts(p.hearts, 'hearts', id)}<span class="badge ${esc(p.status || 'looking')}">${statusName(p.status)}</span></div>
      ${facts(p) ? `<p class="stats">${facts(p)}</p>` : ''}
      ${p.link ? `<a class="btn small ghost" href="${esc(p.link)}" target="_blank" rel="noopener">${icon('open')} Open listing</a>` : ''}
    </div>
    <section class="card pad">
      <div class="row-head"><h2>Checklist</h2><span class="muted">${yes} of ${CHECKS.length}</span></div>
      <p class="muted small">Tap to mark: ? not sure yet → ✓ yes → ✗ no</p>
      <ul class="checks">${CHECKS.map(([k, text]) => {
        const v = checks[k];
        return `<li><button class="ck ${v || 'unk'}" data-act="check" data-id="${id}" data-k="${k}"><span class="ck-mark">${v === 'yes' ? '✓' : v === 'no' ? '✗' : '?'}</span>${esc(text)}</button></li>`;
      }).join('')}</ul>
    </section>
    ${p.notes ? `<section class="card pad"><h2>Notes</h2><p class="notes">${esc(p.notes)}</p></section>` : ''}`;
  }

  // ---------- links ----------
  function linkForm(l, cat) {
    form({
      title: l ? 'Edit link' : 'New link',
      fields: [
        { name: 'name', label: 'Name', value: l?.name, placeholder: 'Space Planner', required: true, autofocus: !l },
        { name: 'url', label: 'Web address', type: 'url', value: l?.url, placeholder: 'app.spaceplanner.co', required: true },
        { name: 'category', label: 'Type', type: 'select', value: l?.category || cat || LINK_CATEGORIES[0], options: LINK_CATEGORIES.map(c => [c, c]) },
        { name: 'note', label: 'Note', value: l?.note, placeholder: 'What it’s good for' },
      ],
      save: async v => {
        if (!domain(v.url)) throw new Error('That web address doesn’t look right.');
        if (l) {
          // Moving a favorite to another category drops the star.
          return DB.update(l.id, v.category !== l.category ? { ...v, fav: false } : v);
        }
        // The first link in a category becomes its favorite.
        const fav = !favLink(v.category);
        await DB.add({ kind: 'link', ...v, fav });
        if (fav && PAGE_LINKS[v.category]) toast(`${v.name} opens from the ${PAGE_LINKS[v.category]} page`);
      },
      remove: l && (async () => {
        if (!(await ask(`Delete “${l.name}”?`))) return false;
        await DB.remove(l);
        return true;
      }),
    });
  }

  // A soft letter tile, colored by name, instead of fetching each site's logo.
  const TINTS = ['var(--sage)', 'var(--wood)', 'var(--sage-deep)', 'var(--taupe)', 'var(--clay)'];
  const tint = s => TINTS[[...s].reduce((a, c) => a + c.charCodeAt(0), 0) % TINTS.length];

  Views.links = {
    nav: 'links',
    render([focus]) {
      const all = kind('link').sort((a, b) => a.t - b.t);
      const cats = [...LINK_CATEGORIES, ...new Set(all.map(l => l.category).filter(c => !LINK_CATEGORIES.includes(c)))];
      return `${pageTop('Design links', { sub: 'Star a favorite in each group and it opens from that page’s link button', right: `<button class="btn small" data-act="add">${icon('plus')} Link</button>` })}
      ${all.length || focus ? cats.map(c => {
        const list = all.filter(l => (l.category || 'Other') === c);
        const page = PAGE_LINKS[c];
        const fav = list.find(l => l.fav);
        const hint = page ? `<p class="cat-hint">${fav ? `★ ${esc(fav.name)} opens from the ${page} page` : `Star one to open it from the ${page} page`}</p>` : '';
        return list.length || c === focus ? `<section id="cat-${encodeURIComponent(c)}"><h2 class="cat-h">${esc(c)}</h2>${hint}
          ${list.length ? '' : `<button class="btn small ghost" data-act="add" data-cat="${esc(c)}">${icon('plus')} Add a link</button>`}
          <div class="grid links">${list.map(l => `<div class="link-card${l.fav ? ' is-fav' : ''}">
            <button class="star${l.fav ? ' on' : ''}" data-act="star" data-id="${l.id}" aria-pressed="${!!l.fav}" aria-label="${l.fav ? 'Favorite' : 'Make favorite'}: ${esc(l.name)}">${l.fav ? '★' : '☆'}</button>
            <a href="${esc(l.url)}" target="_blank" rel="noopener" class="link-main">
              <span class="mono" style="background:${tint(l.name)}">${esc(l.name.trim()[0] || '?').toUpperCase()}</span>
              <span class="link-txt"><b>${esc(l.name)}</b><small>${esc(domain(l.url))}</small>${l.note ? `<span>${esc(l.note)}</span>` : ''}</span>
              ${icon('open', 'dim')}
            </a>
            <button class="icon-btn" data-act="edit" data-id="${l.id}" aria-label="Edit ${esc(l.name)}">${icon('edit')}</button>
          </div>`).join('')}</div></section>` : '';
      }).join('') : empty('links', 'No links yet', 'Save websites for mocking up floor plans in 3D, finding land and inspiration.', `<button class="btn" data-act="add">${icon('plus')} Add a link</button>`)}`;
    },
    after(root, [focus]) {
      const sec = focus && root.querySelector(`#cat-${CSS.escape(encodeURIComponent(focus))}`);
      if (sec) sec.scrollIntoView({ block: 'start' });
    },
    acts: {
      add: el => linkForm(null, el.dataset.cat),
      edit: el => linkForm(get(el.dataset.id)),
      star: el => setFav(get(el.dataset.id)),
    },
  };

  return { form: landForm, linkForm };
})();
