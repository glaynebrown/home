/* Room boards: a photo board for each room (Kitchen, Front porch, ...).
   Each board has two sides, Starter (what you'll build with first) and
   Upgrades (the dream version), each with its own photos and notes. Boards
   always open on Starter.
     pin.side          'starter' | 'upgrade' (older photos have none = Upgrades)
     board.starterNotes, starterNotesBy, starterNotesAt    Starter notes
     board.notes, notesBy, notesAt                         Upgrades notes
   #/rooms          all the boards
   #/rooms/{id}     one board */
const Rooms = (() => {
  let lovedOnly = false;
  let side = 'starter';
  let openBoard = null;

  const SIDES = { starter: 'Starter', upgrade: 'Upgrades' };
  const sideOf = p => (p.side === 'starter' ? 'starter' : 'upgrade');
  const noteKey = s => (s === 'starter' ? 'starterNotes' : 'notes');
  const notesOf = (b, s) => (b[noteKey(s)] || '').trim();

  // Suggested things to decide, by the kind of room (matched from its name).
  const FOCUS = [
    [/kitchen/, ['Cabinets', 'Countertops', 'Island', 'Pantry', 'Backsplash', 'Sink & faucet', 'Appliances', 'Lighting', 'Flooring', 'Hardware']],
    [/pantry/, ['Shelving', 'Door', 'Counter space', 'Outlets', 'Lighting']],
    [/(primary|master).*bath/, ['Vanity', 'Shower', 'Tub', 'Tile', 'Countertops', 'Fixtures', 'Lighting', 'Storage']],
    [/bath/, ['Vanity', 'Shower & tub', 'Tile', 'Fixtures', 'Lighting', 'Storage']],
    [/(primary|master).*bed/, ['Closet', 'Flooring', 'Ceiling fan', 'Lighting', 'Windows', 'Paint color']],
    [/bed/, ['Closets', 'Flooring', 'Ceiling fans', 'Lighting', 'Paint color']],
    [/living|great|family/, ['Flooring', 'Fireplace', 'Ceiling & beams', 'Built-ins', 'Windows', 'Lighting', 'Paint color']],
    [/dining/, ['Light fixture', 'Flooring', 'Built-in hutch', 'Windows', 'Paint color']],
    [/mud|laundry/, ['Bench & lockers', 'Washer & dryer', 'Laundry sink', 'Cabinets', 'Folding counter', 'Flooring', 'Drop zone']],
    [/porch|deck|patio/, ['Depth', 'Ceiling', 'Columns', 'Railings', 'Ceiling fans', 'Lighting', 'Swing']],
    [/outside|exterior/, ['Siding', 'Roof', 'Windows', 'Front door', 'Garage', 'Paint colors', 'Landscaping']],
    [/barn|homestead/, ['Barn', 'Chicken coop', 'Fencing', 'Water line', 'Power', 'Workshop', 'Storage']],
    [/garden|yard/, ['Garden beds', 'Fencing', 'Irrigation', 'Trees', 'Patio', 'Fire pit']],
    [/office|study/, ['Desk', 'Built-ins', 'Outlets', 'Lighting', 'Door']],
  ];
  const focusFor = b => (FOCUS.find(([re]) => re.test(b.name.toLowerCase())) || [null, ['Flooring', 'Lighting', 'Paint color', 'Storage', 'Windows']])[1];

  // "Cabinets: white shaker" lines become items; other lines stay as notes.
  const labelKey = s => s.toLowerCase().replace(/[^a-z]/g, '').replace(/s$/, '');
  function parseNotes(text) {
    const items = [], other = [];
    String(text || '').split('\n').forEach(line => {
      const m = line.match(/^\s*[-•*]?\s*([^:]{2,30}):\s*(.*)$/);
      if (m && m[2].trim()) items.push({ label: m[1].trim(), key: labelKey(m[1]), text: m[2].trim() });
      else if (line.trim() && !(m && !m[2].trim())) other.push(line.trim());
    });
    return { items, other };
  }

  // Loved photo first, otherwise the newest, for one side of a board.
  function sideInfo(b, s) {
    const pins = pinsIn(b.id).filter(p => sideOf(p) === s);
    return { photo: (pins.find(p => p.fav) || pins[0] || {}).photo || null, count: pins.length, notes: notesOf(b, s) };
  }
  // Leaving a board means it opens on Starter next time.
  window.addEventListener('hashchange', () => {
    if (openBoard && location.hash !== `#/rooms/${openBoard}`) openBoard = null;
  });

  const boards = () => kind('board').sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.t - b.t);
  const pinsIn = id => kind('pin').filter(p => p.board === id).sort(newest);
  const coverOf = b => {
    const pins = pinsIn(b.id);
    return (pins.find(p => p.id === b.cover) || pins[0] || {}).photo;
  };

  // Full-screen photos with Love / Note / Cover / Move / Delete.
  function view(list, start) {
    const item = p => {
      const board = get(p.board);
      return {
        photo: p.photo,
        title: p.caption || '',
        sub: [board && `${esc(board.name)} · ${SIDES[sideOf(p)]}`, byLine(p), p.link && `<a href="${esc(p.link)}" target="_blank" rel="noopener">Open link</a>`].filter(Boolean).join(' · '),
        actions: [
          { label: `${icon('heart', p.fav ? 'filled' : '')} ${p.fav ? 'Loved' : 'Love'}`, fn: async () => {
            await DB.update(p.id, { fav: !p.fav });
            return { item: item({ ...p, fav: !p.fav }) };
          } },
          { label: 'Note', fn: () => new Promise(resolve => {
            form({
              title: 'Photo note',
              fields: [
                { name: 'caption', label: 'Note', type: 'textarea', value: p.caption || '', placeholder: 'What do you love about it?' },
                { name: 'link', label: 'Link (optional)', type: 'url', value: p.link || '', placeholder: 'Pinterest pin, store page…' },
              ],
              save: async v => { await DB.update(p.id, v); resolve({ item: item({ ...p, ...v }) }); },
            });
          }) },
          { label: `Move to ${sideOf(p) === 'starter' ? 'Upgrades' : 'Starter'}`, fn: async () => {
            const to = sideOf(p) === 'starter' ? 'upgrade' : 'starter';
            await DB.update(p.id, { side: to });
            toast(`Moved to ${SIDES[to]}`);
            return 'close';
          } },
          { label: 'Make cover', fn: async () => { await DB.update(p.board, { cover: p.id }); toast('Board cover set'); } },
          { label: 'Move', fn: () => new Promise(resolve => {
            form({
              title: 'Move to another board',
              fields: [{ name: 'board', label: 'Board', type: 'select', value: p.board, options: boards().map(b => [b.id, b.name]) }],
              saveLabel: 'Move',
              save: async v => { await DB.update(p.id, { board: v.board }); toast(`Moved to ${get(v.board).name}`); resolve('close'); },
            });
          }) },
          { label: 'Delete', danger: true, fn: async () => {
            if (!(await ask('Delete this photo from the board?'))) return;
            await DB.remove(p);
            return 'close';
          } },
        ],
      };
    };
    viewer(list.map(item), start);
  }

  Views.rooms = {
    nav: 'rooms',
    render([id]) {
      if (id) return board(id);
      const list = boards();
      return `${pageTop('Room boards', { link: linkBtn('Inspiration'), sub: 'Ideas and inspiration for every room', right: `<button class="btn small" data-act="addBoard">${icon('plus')} Room</button>` })}
      ${list.length ? `<div class="grid boards">${list.map(b => {
        const pins = pinsIn(b.id);
        const loved = pins.filter(p => p.fav).length;
        return `<a class="board-card" href="#/rooms/${b.id}">${cover(coverOf(b), 'rooms')}
          <div class="tile-txt"><h3>${esc(b.name)}</h3><p>${pins.length} photo${pins.length === 1 ? '' : 's'}${loved ? ` · ${loved} ${icon('heart', 'tiny filled')}` : ''}${notesOf(b, 'starter') || notesOf(b, 'upgrade') ? ` · ${icon('note', 'tiny')} notes` : ''}</p></div></a>`;
      }).join('')}</div>` : empty('rooms', 'No boards yet', 'Add a board for each room you’re dreaming about.')}`;
    },
    // Long notes fold to a few lines with Show more.
    after(root) {
      const n = root.querySelector('.notes.clamp'), more = root.querySelector('.more');
      if (n && more) more.hidden = n.scrollHeight <= n.clientHeight + 2;
    },
    acts: {
      notes(el) {
        const b = get(el.dataset.id), key = noteKey(side);
        // A suggestion chip adds "Cabinets: " on a new line, ready to type.
        const topic = el.dataset.topic;
        const cur = (b[key] || '').replace(/\s+$/, '');
        const value = topic ? `${cur}${cur ? '\n' : ''}${topic}: ` : b[key] || '';
        const s = form({
          title: `${b.name}: ${SIDES[side]} notes`,
          fields: [{ name: 'notes', label: '', type: 'textarea', rows: 10, value, autofocus: true,
            placeholder: side === 'starter' ? 'Builder-grade white shaker cabinets\nLaminate counters for now\nAsk about soft-close hinges' : 'Sage green cabinets, glass-front uppers\nQuartz counters\nFarmhouse sink' }],
          save: v => DB.update(b.id, { [key]: v.notes, [`${key}By`]: S.uid, [`${key}At`]: Date.now() }),
        });
        const t = s.q('textarea');
        setTimeout(() => { t.focus(); t.setSelectionRange(t.value.length, t.value.length); t.scrollTop = t.scrollHeight; }, 80);
      },
      side(el) { side = el.dataset.side; lovedOnly = false; render(true); },
      more(el) {
        const n = el.previousElementSibling;
        n.classList.toggle('clamp');
        el.textContent = n.classList.contains('clamp') ? 'Show more' : 'Show less';
      },
      addBoard() {
        form({
          title: 'New room board',
          fields: [{ name: 'name', label: 'Room', placeholder: 'Craft room, Screened porch…', required: true, autofocus: true }],
          save: async v => {
            const id = await DB.add({ kind: 'board', name: v.name, order: boards().length, cover: null });
            location.hash = `#/rooms/${id}`;
          },
        });
      },
      async addPhotos(el) {
        const id = el.dataset.id;
        await addPhotos(async photos => {
          for (const photo of photos) await DB.add({ kind: 'pin', board: id, side, photo, caption: '', link: '', fav: false });
        });
      },
      loved() { lovedOnly = !lovedOnly; render(true); },
      open(el) {
        const b = get(el.dataset.board);
        let pins = pinsIn(b.id).filter(p => sideOf(p) === side);
        if (lovedOnly) pins = pins.filter(p => p.fav);
        view(pins, +el.dataset.i);
      },
      async fav(el) {
        const p = get(el.dataset.id);
        await DB.update(p.id, { fav: !p.fav });
      },
      editBoard(el) {
        const b = get(el.dataset.id);
        const list = boards();
        const at = list.findIndex(x => x.id === b.id);
        form({
          title: 'Edit board',
          fields: [
            { name: 'name', label: 'Room', value: b.name, required: true },
            { name: 'link', label: 'Link for this room (optional)', type: 'url', value: b.link || '', placeholder: 'pinterest.com/you/dream-kitchen', hint: 'The link button on this board opens it. Leave blank to use your Inspiration favorite.' },
            { name: 'pos', label: 'Position in the list', type: 'select', value: at, options: list.map((x, i) => [i, `${i + 1}. ${x.id === b.id ? '(here now)' : x.name}`]) },
          ],
          save: async v => {
            const order = list.filter(x => x.id !== b.id);
            order.splice(+v.pos, 0, b);
            for (let i = 0; i < order.length; i++) {
              const x = order[i];
              const patch = x.id === b.id ? { name: v.name, link: v.link, order: i } : { order: i };
              if (x.id === b.id || x.order !== i) await DB.update(x.id, patch);
            }
          },
          remove: async () => {
            const pins = pinsIn(b.id);
            const msg = pins.length ? `Delete the ${b.name} board and its ${pins.length} photo${pins.length === 1 ? '' : 's'}?` : `Delete the ${b.name} board?`;
            if (!(await ask(msg))) return false;
            await DB.removeMany([...pins, b]);
            location.hash = '#/rooms';
            return true;
          },
        });
      },
    },
  };

  function board(id) {
    const b = get(id);
    if (!b) return empty('rooms', 'Board not found', 'It may have been deleted.', '<a class="btn" href="#/rooms">All boards</a>');
    // A different board (or coming back to one) always starts on Starter.
    if (openBoard !== id) { openBoard = id; side = 'starter'; lovedOnly = false; }
    const every = pinsIn(id);
    const count = s => every.filter(p => sideOf(p) === s).length;
    const all = every.filter(p => sideOf(p) === side);
    const pins = lovedOnly ? all.filter(p => p.fav) : all;
    const lovedN = all.filter(p => p.fav).length;
    const notes = notesOf(b, side), key = noteKey(side);
    return `${pageTop(b.name, {
      back: ['#/rooms', 'Room boards'],
      link: linkBtn('Inspiration', b.link && { url: b.link, name: `${b.name} board link` }),
      sub: `${every.length} photo${every.length === 1 ? '' : 's'}`,
      right: `<button class="icon-btn" data-act="editBoard" data-id="${id}" aria-label="Edit board">${icon('edit')}</button>`,
    })}
    <div class="side-toggle" role="tablist" aria-label="Starter or upgrades">
      ${Object.entries(SIDES).map(([k, label]) => `<button role="tab" aria-selected="${side === k}" class="${side === k ? 'on' : ''}" data-act="side" data-side="${k}">${label}<span>${count(k)}</span></button>`).join('')}
    </div>
    ${notes ? `<section class="card pad notes-card">
      <div class="row-head"><h2>${icon('note')} ${SIDES[side]} notes</h2><button class="btn small ghost" data-act="notes" data-id="${id}">Edit</button></div>
      <p class="notes clamp">${esc(notes)}</p>
      <button class="linkish more" data-act="more" hidden>Show more</button>
      ${b[`${key}At`] ? `<p class="muted small">Updated${personName(b[`${key}By`]) ? ` by ${esc(personName(b[`${key}By`]))}` : ''} · ${niceDate(b[`${key}At`])}</p>` : ''}
    </section>` : `<button class="add-notes" data-act="notes" data-id="${id}">${icon('note')} Add ${side === 'starter' ? 'starter' : 'upgrade'} notes for the ${esc(b.name.toLowerCase())}</button>`}
    <div class="focus">
      <p class="lbl">Things to decide <span class="muted">· tap one to add it to your ${side === 'starter' ? 'starter' : 'upgrade'} notes</span></p>
      <div class="focus-chips">${focusFor(b).map(t => {
        const done = parseNotes(notes).items.some(i => i.key === labelKey(t));
        return `<button class="chip${done ? ' on' : ''}" data-act="notes" data-id="${id}" data-topic="${esc(t)}">${done ? '✓ ' : '+ '}${esc(t)}</button>`;
      }).join('')}</div>
    </div>
    <div class="bar-row">
      <button class="btn" data-act="addPhotos" data-id="${id}">${icon('camera')} Add photos</button>
      ${lovedN ? `<button class="chip${lovedOnly ? ' on' : ''}" data-act="loved">${icon('heart', 'tiny filled')} Loved (${lovedN})</button>` : ''}
    </div>
    ${pins.length ? `<div class="masonry">${pins.map((p, i) => `<figure class="pin">
        <button class="pin-img" data-act="open" data-board="${id}" data-i="${i}"><img src="${esc(thumb(p.photo))}" alt="${esc(p.caption || '')}" loading="lazy" ${p.photo.w ? `width="${p.photo.w}" height="${p.photo.h}"` : ''}></button>
        <button class="pin-fav${p.fav ? ' on' : ''}" data-act="fav" data-id="${p.id}" aria-label="${p.fav ? 'Loved' : 'Love'}">${icon('heart')}</button>
        ${p.caption ? `<figcaption>${esc(p.caption)}</figcaption>` : ''}
      </figure>`).join('')}</div>`
      : lovedOnly ? empty('heart', 'No loved photos', 'Tap the heart on a photo to love it.')
        : side === 'starter' ? empty('camera', 'No starter photos yet', 'Add what you’ll build with first: builder-grade finishes, model home photos, the basic version.')
          : empty('camera', 'No upgrade photos yet', 'Add the dream version: screenshots from Pinterest, Instagram, anything you love.')}`;
  }

  return { view, boards, pinsIn, notesOf, SIDES, sideInfo, parseNotes };
})();
