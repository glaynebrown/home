/* Floor plans and the size check.
   #/plans          all plans, favorites first
   #/plans/{id}     one plan: photos of the pages, hearts, loves, room sizes
   #/size           size check + the rooms in the house you live in now */
const Plans = (() => {
  const TABS = [['#/plans', 'Plans'], ['#/additions', 'Additions'], ['#/size', 'Size check']];
  const sorted = () => kind('plan').sort((a, b) => (b.hearts || 0) - (a.hearts || 0) || newest(a, b));
  const myRooms = () => kind('room').sort((a, b) => a.t - b.t);
  const estimate = p => {
    const c = settings().costPerSqft;
    return c && p.sqft ? p.sqft * c : null;
  };
  const stats = p => [
    p.sqft && `${commas(p.sqft)} sq ft`,
    p.beds && `${p.beds} bed`,
    p.baths && `${p.baths} bath`,
    p.stories && `${p.stories} stor${p.stories === 1 ? 'y' : 'ies'}`,
  ].filter(Boolean).join(' · ');
  const lines = s => String(s || '').split('\n').map(x => x.trim()).filter(Boolean);

  function planForm(p) {
    form({
      title: p ? 'Edit plan' : 'New floor plan',
      fields: [
        { name: 'name', label: 'Plan name', value: p?.name, placeholder: 'The Magnolia', required: true, autofocus: !p },
        { name: 'source', label: 'Where it’s from', value: p?.source, placeholder: 'Plan book, page 112' },
        { name: 'sqft', label: 'Square feet', type: 'number', value: p?.sqft, placeholder: '2150' },
        { name: 'beds', label: 'Bedrooms', type: 'number', value: p?.beds, placeholder: '4' },
        { name: 'baths', label: 'Bathrooms', type: 'number', value: p?.baths, placeholder: '2.5' },
        { name: 'stories', label: 'Stories', type: 'number', value: p?.stories, placeholder: '1' },
        { name: 'loves', label: 'What we love (one per line)', type: 'textarea', value: p?.loves, placeholder: 'Big pantry\nMudroom by the garage' },
        { name: 'dislikes', label: 'Not so much (one per line)', type: 'textarea', value: p?.dislikes, placeholder: 'Laundry is far from the bedrooms' },
        { name: 'notes', label: 'Notes', type: 'textarea', rows: 4, value: p?.notes, placeholder: '2 floors, attached 2-car garage, basement option' },
        { name: 'link', label: 'Link (optional)', type: 'url', value: p?.link, placeholder: 'If the plan is online too' },
      ],
      save: async v => {
        if (p) return DB.update(p.id, v);
        const id = await DB.add({ kind: 'plan', ...v, hearts: 0, photos: [], rooms: [] });
        location.hash = `#/plans/${id}`;
      },
      remove: p && (async () => {
        if (!(await ask(`Delete “${p.name}” and its photos?`))) return false;
        await DB.remove(p);
        location.hash = '#/plans';
        return true;
      }),
    });
  }

  // Rows of name + size; blank rows are dropped.
  function roomsForm(p) {
    const row = (r = {}) => `<div class="room-row"><input name="rn" value="${esc(r.name || '')}" placeholder="Room" aria-label="Room name">
      <input name="rd" value="${esc(r.dims || '')}" placeholder="Size" aria-label="Size" autocapitalize="off">
      <button type="button" class="icon-btn" data-del aria-label="Remove row">×</button></div>`;
    const s = sheet('Rooms & sizes', `<p class="intro">Copy the room sizes from the plan, the way the book writes them: <b>14x16</b>, <b>14'6" x 16'</b>, <b>14-6 x 16</b>…</p>
      <div class="rows">${(p.rooms && p.rooms.length ? p.rooms : [{}, {}, {}]).map(row).join('')}</div>
      <button type="button" class="btn small ghost" data-add>${icon('plus')} Add a room</button>
      <p class="form-err" hidden></p>
      <div class="sheet-actions"><span class="grow"></span><button type="button" class="btn" data-save>Save</button></div>`);
    const rows = s.q('.rows');
    s.q('[data-add]').onclick = () => { rows.insertAdjacentHTML('beforeend', row()); rows.lastElementChild.querySelector('input').focus(); };
    rows.addEventListener('click', e => { const d = e.target.closest('[data-del]'); if (d) d.parentElement.remove(); });
    s.q('[data-save]').onclick = async () => {
      const list = s.qa('.room-row').map(r => ({ name: r.querySelector('[name=rn]').value.trim(), dims: r.querySelector('[name=rd]').value.trim() }))
        .filter(r => r.name || r.dims);
      const bad = list.find(r => r.dims && !Size.parse(r.dims));
      if (bad) {
        const err = s.q('.form-err');
        err.textContent = `Couldn’t read the size “${bad.dims}”. Try it like 14x16 or 14'6" x 16'.`;
        err.hidden = false;
        return;
      }
      await DB.update(p.id, { rooms: list.map(r => ({ name: r.name || 'Room', dims: r.dims })) });
      s.close();
    };
  }

  // One plan room next to your current rooms, drawn to scale.
  function compareSheet(name, d) {
    const rooms = myRooms();
    const all = Size.compareAll(d, rooms);
    const best = Size.compare(d, rooms, name);
    const html = `<p class="compare-big">${esc(best.text)}</p>
      <p class="muted">${Size.dims(d)} · ${Size.sqft(d)} · ${esc(best.sides)}</p>
      <div class="overlay-box">${Size.overlay(d, best.ref, [name, best.ref.generic ? best.ref.name : `Now: ${best.ref.name}`])}</div>
      ${all.length > 1 ? `<h3 class="mini-h">Compared to ${rooms.length ? 'your other rooms' : 'everyday spaces'}</h3>
        <ul class="cmp-list">${all.filter(c => c.ref !== best.ref).map(c => `<li><button type="button" data-ref="${esc(c.ref.name)}"><b>${esc(c.text)}</b><span>${esc(c.sides)}</span></button></li>`).join('')}</ul>` : ''}
      ${rooms.length ? '' : '<p class="tip">Tip: measure a few rooms where you live now (Size check → Our rooms now), and every plan room will be compared to rooms you know by heart.</p>'}`;
    const s = sheet(name, html);
    s.el.addEventListener('click', e => {
      const b = e.target.closest('[data-ref]');
      if (!b) return;
      const c = all.find(x => x.ref.name === b.dataset.ref);
      s.q('.overlay-box').innerHTML = Size.overlay(d, c.ref, [name, c.ref.generic ? c.ref.name : `Now: ${c.ref.name}`]);
      s.q('.compare-big').textContent = c.text;
      s.q('.overlay-box').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
  }

  Views.plans = {
    nav: 'plans',
    render([id]) {
      if (id) return detail(id);
      const list = sorted();
      return `${pageTop('Floor plans', { link: linkBtn('Floor plans & 3D'), sub: 'From the plan book and beyond', right: `<button class="btn small" data-act="add">${icon('plus')} Plan</button>` })}
      ${tabs(TABS, '#/plans')}
      ${list.length ? `<div class="grid plans">${list.map(p => {
        const est = estimate(p);
        return `<a class="plan-card" href="#/plans/${p.id}">${cover((p.photos || [])[0], 'plans')}
          <div class="tile-txt"><h3>${esc(p.name)}</h3>${hearts(p.hearts)}
          <p>${stats(p) || esc(p.source || '')}</p>${est ? `<p class="muted">≈ ${money(est)} to build</p>` : ''}</div></a>`;
      }).join('')}</div>`
        : empty('plans', 'No plans yet', 'Snap a photo of a plan you like in the book, then add its room sizes to see how big they really feel.', `<button class="btn" data-act="add">${icon('plus')} Add a plan</button>`)}`;
    },
    acts: {
      add: () => planForm(null),
      edit: el => planForm(get(el.dataset.id)),
      rooms: el => roomsForm(get(el.dataset.id)),
      async hearts(el) {
        const p = get(el.dataset.id), n = +el.dataset.n;
        await DB.update(p.id, { hearts: p.hearts === n ? n - 1 : n });
      },
      async addPhotos(el) {
        const p = get(el.dataset.id);
        await addPhotos(async photos => DB.update(p.id, { photos: [...(get(p.id).photos || []), ...photos] }));
      },
      photo(el) {
        const p = get(el.dataset.id);
        const list = (p.photos || []).map((photo, k) => ({
          photo, title: p.name, text: '',
          actions: [
            { label: 'Make first', fn: async () => {
              const cur = get(p.id).photos || [];
              const ph = cur[k];
              await DB.update(p.id, { photos: [ph, ...cur.filter((_, j) => j !== k)] });
              toast('Moved to the front');
              return 'close';
            } },
            { label: 'Delete', danger: true, fn: async () => {
              if (!(await ask('Delete this photo from the plan?'))) return;
              const cur = get(p.id).photos || [];
              await DB.update(p.id, { photos: cur.filter((_, j) => j !== k) });
              DB.dropPhotos([cur[k]]);
              return 'close';
            } },
          ],
        }));
        viewer(list, +el.dataset.i);
      },
      room(el) {
        const p = get(el.dataset.id), r = p.rooms[+el.dataset.i];
        compareSheet(r.name, Size.parse(r.dims));
      },
    },
  };

  function detail(id) {
    const p = get(id);
    if (!p) return empty('plans', 'Plan not found', 'It may have been deleted.', '<a class="btn" href="#/plans">All plans</a>');
    const photos = p.photos || [];
    const est = estimate(p);
    const rooms = myRooms();
    const loves = lines(p.loves), dislikes = lines(p.dislikes);
    return `${pageTop(p.name, {
      back: ['#/plans', 'Floor plans'],
      sub: esc(p.source || ''),
      right: `<button class="icon-btn" data-act="edit" data-id="${id}" aria-label="Edit plan">${icon('edit')}</button>`,
    })}
    <div class="gallery">
      ${photos.map((ph, i) => `<button class="g-photo" data-act="photo" data-id="${id}" data-i="${i}"><img src="${esc(thumb(ph))}" alt="Plan page ${i + 1}" loading="lazy"></button>`).join('')}
      <button class="g-add" data-act="addPhotos" data-id="${id}">${icon('camera')}<span>${photos.length ? 'Add more' : 'Add photos of the plan'}</span></button>
    </div>

    <div class="card pad plan-sum">
      <div>${hearts(p.hearts, 'hearts', id)}</div>
      ${stats(p) ? `<p class="stats">${stats(p)}</p>` : ''}
      ${est ? `<p class="est">Rough build estimate: <b>${money(est)}</b> <span class="muted">(${commas(p.sqft)} sq ft × ${money(settings().costPerSqft)})</span></p>`
        : p.sqft ? `<p class="muted small">Add your build cost per sq ft on the Savings page to see a rough estimate.</p>` : ''}
      ${kind('addition').filter(x => x.planId === id).map(x => `<p class="add-line">+ <a href="#/additions/${x.id}">${esc(x.name)}</a> later${Additions.sqftOf(x) ? ` (${commas(Additions.sqftOf(x))} sq ft)` : ''}</p>`).join('')}
      ${p.link ? `<a class="btn small ghost" href="${esc(p.link)}" target="_blank" rel="noopener">${icon('open')} Open plan online</a>` : ''}
    </div>

    ${(p.notes || '').trim() ? `<section class="card pad plan-notes">
      <div class="row-head"><h2>${icon('note')} Notes</h2><button class="btn small ghost" data-act="edit" data-id="${id}">Edit</button></div>
      <p class="notes">${esc(p.notes.trim())}</p>
    </section>` : ''}
    ${loves.length || dislikes.length ? `<div class="two">
      ${loves.length ? `<div class="card pad"><h3 class="mini-h love">What we love</h3><ul class="ticks">${loves.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div>` : ''}
      ${dislikes.length ? `<div class="card pad"><h3 class="mini-h meh">Not so much</h3><ul class="ticks meh">${dislikes.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div>` : ''}
    </div>` : ''}

    <section class="card pad">
      <div class="row-head"><h2>How big does it feel?</h2><button class="btn small ghost" data-act="rooms" data-id="${id}">${(p.rooms || []).length ? 'Edit sizes' : `${icon('plus')} Add room sizes`}</button></div>
      ${(p.rooms || []).length ? `<ul class="feel-list">${p.rooms.map((r, i) => {
        const d = Size.parse(r.dims), c = Size.compare(d, rooms, r.name);
        return `<li><button data-act="room" data-id="${id}" data-i="${i}"${d ? '' : ' disabled'}>
          <div class="feel-name"><b>${esc(r.name)}</b><span>${d ? `${Size.dims(d)} · ${Size.sqft(d)}` : esc(r.dims || 'No size')}</span></div>
          ${c ? `<p class="feel-txt">${esc(c.text)}</p>` : ''}</button></li>`;
      }).join('')}</ul>
      ${rooms.length ? '' : '<p class="tip">These compare to everyday spaces for now. Measure a few rooms in your house now under <a href="#/size">Size check</a> for a real feel.</p>'}`
        : '<p class="muted">Add the room sizes from the plan and each one will be compared to rooms you already know.</p>'}
    </section>`;
  }

  // ---------- size check ----------
  let lastCheck = '';
  function checkHtml(str) {
    const d = Size.parse(str);
    if (!str.trim()) return '<p class="muted">Type a room size from a plan to see how it compares.</p>';
    if (!d) return '<p class="muted">Type it like 14x16 or 14\'6" x 16\'.</p>';
    const rooms = myRooms();
    const c = Size.compare(d, rooms);
    return `<p class="compare-big">${esc(c.text)}</p>
      <p class="muted">${Size.dims(d)} · ${Size.sqft(d)} · ${esc(c.sides)}</p>
      <div class="overlay-box">${Size.overlay(d, c.ref, ['This size', c.ref.generic ? c.ref.name : `Now: ${c.ref.name}`])}</div>
      <button class="btn small ghost" data-act="more">Compare to every room</button>`;
  }

  Views.size = {
    nav: 'plans',
    render() {
      const rooms = myRooms();
      return `${pageTop('Size check', { link: linkBtn('Floor plans & 3D'), sub: 'What does this size feel like?' })}
      ${tabs(TABS, '#/size')}
      <section class="card pad">
        <label class="field"><span class="lbl">Room size from a plan</span>
          <input id="check" value="${esc(lastCheck)}" autocapitalize="off" autocomplete="off"></label>
        <div id="check-out">${checkHtml(lastCheck)}</div>
      </section>
      <section>
        <div class="row-head"><h2>Our rooms now</h2><button class="btn small" data-act="addRoom">${icon('plus')} Room</button></div>
        <p class="muted">Measure wall to wall where you live now. These are what every plan room gets compared to.</p>
        ${rooms.length ? `<div class="grid now-rooms">${rooms.map(r => {
          const d = Size.parse(r.dims);
          return `<button class="now-room" data-act="editRoom" data-id="${r.id}">${cover(r.photo, 'ruler', 'sq')}
            <div><h3>${esc(r.name)}</h3><p>${d ? `${Size.dims(d)} · ${Size.sqft(d)}` : esc(r.dims)}</p></div></button>`;
        }).join('')}</div>`
          : empty('ruler', 'No rooms measured yet', 'Start with the rooms you know best: living room, bedroom, kitchen. A photo of each helps too!', `<button class="btn" data-act="addRoom">${icon('plus')} Add a room</button>`)}
      </section>`;
    },
    after(root) {
      const input = root.querySelector('#check');
      input.addEventListener('input', () => {
        lastCheck = input.value;
        root.querySelector('#check-out').innerHTML = checkHtml(lastCheck);
      });
    },
    acts: {
      more() {
        const d = Size.parse(lastCheck);
        if (d) compareSheet('This size', d);
      },
      addRoom: () => roomForm(null),
      editRoom: el => roomForm(get(el.dataset.id)),
    },
  };

  function roomForm(r) {
    form({
      title: r ? 'Edit room' : 'A room in our house now',
      fields: [
        { name: 'name', label: 'Room', value: r?.name, placeholder: 'Living room', required: true, autofocus: !r },
        { name: 'dims', label: 'Size', value: r?.dims, placeholder: '14 x 18', required: true, hint: 'Width × length, wall to wall. 14x18 or 14\'6" x 18\' both work.' },
        { name: 'photo', label: 'Photo (optional)', type: 'photo', value: r?.photo || null },
      ],
      save: async v => {
        if (!Size.parse(v.dims)) throw new Error(`Couldn’t read the size “${v.dims}”. Try it like 14x18.`);
        if (r) return DB.update(r.id, v);
        await DB.add({ kind: 'room', ...v });
      },
      remove: r && (async () => {
        if (!(await ask(`Delete ${r.name}?`))) return false;
        await DB.remove(r);
        return true;
      }),
    });
  }

  return { sorted, estimate };
})();
