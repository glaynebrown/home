/* Room boards: a photo board for each room (Kitchen, Front porch, ...).
   Each board has two sides, Starter (what you'll build with first) and
   Upgrades (the dream version), each with its own photos and notes. Boards
   always open on Starter.
     pin.side          'starter' | 'upgrade' (older photos have none = Upgrades)
     board.starterNotes, starterNotesBy, starterNotesAt    Starter notes
     board.notes, notesBy, notesAt                         Upgrades notes
   One-sided boards have no Starter | Upgrades toggle: future rooms and
   "general" boards like General layout (board.general = true).
   Future rooms (board.addition = an addition's id, board.dims = its size)
   belong to an addition on the Plans page. They have no Starter | Upgrades
   toggle: one set of photos and notes (stored like the Upgrades side).
   #/rooms          all the boards
   #/rooms/{id}     one board */
const Rooms = (() => {
  let lovedOnly = false;
  let dragControl = null;
  let focusOpen = false;
  let side = 'starter';
  let openBoard = null;

  const SIDES = { starter: 'Starter', upgrade: 'Upgrades' };
  const sideOf = p => (p.side === 'starter' ? 'starter' : 'upgrade');
  const noteKey = s => (s === 'starter' ? 'starterNotes' : 'notes');
  const notesOf = (b, s) => (b[noteKey(s)] || '').trim();

  // Suggested things to decide, by the kind of room (matched from its name).
  const FOCUS = [
    [/layout|flow/, ['Kitchen & dining', 'Living & kitchen', 'Entry & mudroom', 'Bedrooms & baths', 'Laundry', 'Hallways', 'Outdoor access', 'Room to add on']],
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
    [/outside|exterior/, ['Front porch', 'Back porch', 'Siding', 'Roof', 'Windows', 'Front door', 'Garage', 'Paint colors', 'Landscaping']],
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

  // Extra costs for the starter build, by topic: board.starterExtras =
  // { key: { label, amount } }. They add up to "Special starter items" on the Budget.
  const extraOf = (b, key) => ((b.starterExtras || {})[key] || {}).amount || 0;
  const starterExtras = () => mainBoards().flatMap(b => Object.entries(b.starterExtras || {})
    .filter(([, x]) => x && x.amount > 0).map(([key, x]) => ({ board: b, key, label: x.label || key, amount: x.amount })));

  // Topic photos: pins tagged with a notes topic (pin.topic = its key,
  // pin.topicLabel = how it's written), on the same side of the board.
  const topicPins = (b, s, key) => pinsIn(b.id).filter(p => p.topic === key && sideOf(p) === s);

  // Everything on one side's notes, in order: "Label: text" topics (with
  // their photos), plain lines, then topics that only have photos so far.
  function noteParts(b, s) {
    const parts = [], seen = new Set();
    String(notesOf(b, s)).split('\n').forEach(line => {
      const m = line.match(/^\s*[-•*]?\s*([^:]{2,30}):\s*(.*)$/);
      if (m) {
        const key = labelKey(m[1]);
        if (seen.has(key)) return;
        seen.add(key);
        const pics = topicPins(b, s, key);
        const extra = s === 'starter' ? extraOf(b, key) : 0;
        if (m[2].trim() || pics.length || extra) parts.push({ topic: true, label: m[1].trim(), key, text: m[2].trim(), pics, extra });
      } else if (line.trim()) parts.push({ topic: false, text: line.trim() });
    });
    pinsIn(b.id).filter(p => p.topic && sideOf(p) === s && !seen.has(p.topic)).forEach(p => {
      seen.add(p.topic);
      parts.push({ topic: true, label: p.topicLabel || p.topic, key: p.topic, text: '', pics: topicPins(b, s, p.topic), extra: s === 'starter' ? extraOf(b, p.topic) : 0 });
    });
    if (s === 'starter' && !oneSided(b)) Object.entries(b.starterExtras || {}).forEach(([key, x]) => {
      if (seen.has(key) || !(x && x.amount > 0)) return;
      seen.add(key);
      parts.push({ topic: true, label: x.label || key, key, text: '', pics: [], extra: x.amount });
    });
    return parts;
  }

  // Writes (or removes) the "Label: text" line for one topic.
  function withTopicLine(text, label, value) {
    const key = labelKey(label), out = [];
    let found = false;
    String(text || '').split('\n').forEach(line => {
      const m = line.match(/^\s*[-•*]?\s*([^:]{2,30}):\s*(.*)$/);
      if (m && labelKey(m[1]) === key) {
        if (!found && value) out.push(`${label}: ${value}`);
        found = true;
        return;
      }
      out.push(line);
    });
    if (!found && value) out.push(`${label}: ${value}`);
    return out.join('\n').replace(/^\s+|\s+$/g, '');
  }

  // A topic's own card: a note plus example photos (e.g. "Pantry").
  function topicForm(b, s, label) {
    const key = labelKey(label);
    const part = noteParts(b, s).find(x => x.topic && x.key === key);
    if (part) label = part.label;
    const keep = [...(part ? part.pics : [])];
    const dropped = [];
    const added = [];
    const sh = sheet(label, `<form class="topic-form" novalidate>
      <label class="field"><span class="lbl">Note</span><textarea name="note" rows="4">${esc(part ? part.text : '')}</textarea></label>
      ${s === 'starter' && !oneSided(b) ? `<label class="field"><span class="lbl">Extra cost for the starter build (optional)</span>
        <div class="inp has-pre"><i class="pre">+$</i><input name="extra" inputmode="decimal" value="${part && part.extra ? commas(part.extra) : ''}"></div>
        <small>For something fancier than builder-grade. It’s added to the Budget as a special starter item.</small></label>` : ''}
      <div class="field"><span class="lbl">Photos</span><div class="topic-photos"></div>
        <div class="btn-row"><button type="button" class="btn small ghost" data-pick>${icon('camera')} Choose photos</button>
        ${navigator.clipboard && navigator.clipboard.read ? '<button type="button" class="btn small ghost" data-paste>Paste photo</button>' : ''}</div></div>
      <p class="muted small">Photos also go on the ${oneSided(b) ? '' : `${SIDES[s].toLowerCase()} side of the `}board, tagged “${esc(label)}.”</p>
      <p class="form-err" hidden></p>
      <div class="sheet-actions">${part ? '<button type="button" class="btn ghost danger" data-remove>Delete</button>' : ''}<span class="grow"></span><button class="btn" data-save>Save</button></div>
    </form>`);
    const grid = sh.q('.topic-photos');
    const draw = () => {
      grid.innerHTML = [
        ...keep.map((p, i) => `<div class="tp"><img src="${esc(thumb(p.photo))}" alt=""><button type="button" class="tp-x" data-k="${i}" aria-label="Remove photo">×</button></div>`),
        ...added.map((f, i) => `<div class="tp"><img src="${f.url}" alt=""><button type="button" class="tp-x" data-n="${i}" aria-label="Remove photo">×</button></div>`),
      ].join('') || '<p class="muted small">No photos yet.</p>';
    };
    draw();
    grid.addEventListener('click', e => {
      const x = e.target.closest('.tp-x');
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
    const noteKey_ = noteKey(s);
    const saveNote = value => {
      const cur = b[noteKey_] || '';
      const next = withTopicLine(cur, label, value);
      return next === cur.trim() ? null : DB.update(b.id, { [noteKey_]: next, [`${noteKey_}By`]: S.uid, [`${noteKey_}At`]: Date.now() });
    };
    // Only writes when the amount actually changed.
    const saveExtra = amount => {
      const before = get(b.id).starterExtras || {};
      const cur = { ...before };
      if (amount > 0) cur[key] = { label, amount }; else delete cur[key];
      return JSON.stringify(cur) === JSON.stringify(before) ? null : DB.update(b.id, { starterExtras: cur });
    };
    sh.q('form').addEventListener('submit', async e => {
      e.preventDefault();
      const btn = sh.q('[data-save]');
      btn.disabled = true; btn.textContent = 'Saving…';
      try {
        const photos = added.length ? await uploadFiles(added.map(a => a.blob)) : [];
        for (const photo of photos) await DB.add({ kind: 'pin', board: b.id, side: s, topic: key, topicLabel: label, photo, caption: '', link: '', fav: false });
        if (dropped.length) await DB.removeMany(dropped);
        await saveNote(sh.q('[name=note]').value.trim().replace(/\n+/g, ' '));
        const ex = sh.q('[name=extra]');
        if (ex) await saveExtra(num(ex.value));
        sh.close();
      } catch (err) {
        console.error(err);
        const m = sh.q('.form-err'); m.textContent = err.message || 'Something went wrong. Try again.'; m.hidden = false;
        btn.disabled = false; btn.textContent = 'Save';
      }
    });
    const del = sh.q('[data-remove]');
    if (del) del.onclick = async () => {
      const pics = part.pics.length;
      if (!(await ask(`Delete the ${label} note${pics ? ` and its ${pics} photo${pics === 1 ? '' : 's'}` : ''}?`))) return;
      if (pics) await DB.removeMany(part.pics);
      await saveNote('');
      if (s === 'starter') await saveExtra(null);
      sh.close();
    };
    setTimeout(() => sh.q('[name=note]').focus(), 60);
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
  const mainBoards = () => boards().filter(b => !b.addition);
  const futureBoards = addId => boards().filter(b => b.addition === addId);
  const siblings = b => (b.addition ? futureBoards(b.addition) : mainBoards());
  const oneSided = b => !!(b.addition || b.general);
  const boardLabel = b => { const a = b.addition && get(b.addition); return a ? `${b.name} (${a.name})` : b.name; };
  // Photos you've rearranged keep their spot; new ones show up first.
  const pinsIn = id => kind('pin').filter(p => p.board === id).sort((a, b) => {
    const x = a.order, y = b.order;
    if (x == null && y == null) return newest(a, b);
    if (x == null) return -1;
    if (y == null) return 1;
    return x - y;
  });
  // A board's thumbnail is the first photo on its Starter side (drag a photo
  // to the front to change it). No starter photos yet: the first Upgrades photo.
  const coverOf = b => {
    const pins = pinsIn(b.id);
    return ((oneSided(b) ? null : pins.find(p => sideOf(p) === 'starter')) || pins[0] || {}).photo;
  };

  // Full-screen photos with Love / Note / Cover / Move / Delete.
  function view(list, start) {
    const item = p => {
      const board = get(p.board);
      return {
        photo: p.photo,
        title: p.caption || '',
        sub: [p.topic && `<b>${esc(p.topicLabel || p.topic)}</b>`, board && (board.addition ? `${esc(board.name)} · Future room` : board.general ? esc(board.name) : `${esc(board.name)} · ${SIDES[sideOf(p)]}`), byLine(p), p.link && `<a href="${esc(p.link)}" target="_blank" rel="noopener">Open link</a>`].filter(Boolean).join(' · '),
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
          ...(board && oneSided(board) ? [] : [{ label: `Move to ${sideOf(p) === 'starter' ? 'Upgrades' : 'Starter'}`, fn: async () => {
            const to = sideOf(p) === 'starter' ? 'upgrade' : 'starter';
            await DB.update(p.id, { side: to });
            toast(`Moved to ${SIDES[to]}`);
            return 'close';
          } }]),
          { label: 'Move', fn: () => new Promise(resolve => {
            form({
              title: 'Move to another board',
              fields: [{ name: 'board', label: 'Board', type: 'select', value: p.board, options: boards().map(b => [b.id, boardLabel(b)]) }],
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
      const list = mainBoards();
      const card = b => {
        const pins = pinsIn(b.id);
        const loved = pins.filter(p => p.fav).length;
        return `<a class="board-card" href="#/rooms/${b.id}" data-sort="${b.id}">${cover(coverOf(b), 'rooms')}
          <div class="tile-txt"><h3>${esc(b.name)}</h3><p>${pins.length} photo${pins.length === 1 ? '' : 's'}${loved ? ` · ${loved} ${icon('heart', 'tiny filled')}` : ''}${notesOf(b, 'starter') || notesOf(b, 'upgrade') ? ` · ${icon('note', 'tiny')} notes` : ''}</p></div></a>`;
      };
      const future = kind('addition').sort((a, b) => a.t - b.t).map(a => [a, futureBoards(a.id)]).filter(([, bs]) => bs.length);
      return `${pageTop('Room boards', { link: linkBtn('Inspiration'), sub: 'Ideas and inspiration for every room', right: `<button class="btn small" data-act="addBoard">${icon('plus')} Room</button>` })}
      ${list.length ? `<div class="grid boards" data-group="main">${list.map(card).join('')}</div>` : empty('rooms', 'No boards yet', 'Add a board for each room you’re dreaming about.')}
      ${future.map(([a, bs]) => `<section class="future-group">
        <div class="row-head"><h2>Future rooms: ${esc(a.name)}</h2><a href="#/additions/${a.id}">The addition</a></div>
        <div class="grid boards" data-group="${a.id}">${bs.map(card).join('')}</div></section>`).join('')}
`;
    },
    // Long notes fold to a few lines with Show more.
    after(root) {
      const n = root.querySelector('.notes.clamp'), more = root.querySelector('.more');
      if (n && more) more.hidden = n.scrollHeight <= n.clientHeight + 2;
      // Hold and drag: room cards (each group on its own) and photos on a board.
      if (dragControl) dragControl.abort();
      dragControl = new AbortController();
      const signal = dragControl.signal;
      const saveOrder = async ids => {
        for (let i = 0; i < ids.length; i++) {
          const x = get(ids[i]);
          if (x && x.order !== i) await DB.update(ids[i], { order: i });
        }
      };
      root.querySelectorAll('.grid.boards').forEach(box => sortable(box, { item: '.board-card', onDrop: saveOrder, signal }));
      const photos = root.querySelector('.masonry');
      if (photos && !lovedOnly) sortable(photos, { item: '.pin', onDrop: saveOrder, signal, byIndex: true });
    },
    acts: {
      notes(el) {
        const b = get(el.dataset.id), key = noteKey(side), future = oneSided(b);
        // A suggestion chip adds "Cabinets: " on a new line, ready to type.
        const topic = el.dataset.topic;
        const cur = (b[key] || '').replace(/\s+$/, '');
        const value = topic ? `${cur}${cur ? '\n' : ''}${topic}: ` : b[key] || '';
        const s = form({
          title: future ? `${b.name} notes` : `${b.name}: ${SIDES[side]} notes`,
          fields: [{ name: 'notes', label: '', type: 'textarea', rows: 10, value, autofocus: true,
            placeholder: side === 'starter' ? 'Builder-grade white shaker cabinets\nLaminate counters for now\nAsk about soft-close hinges' : 'Sage green cabinets, glass-front uppers\nQuartz counters\nFarmhouse sink' }],
          save: v => DB.update(b.id, { [key]: v.notes, [`${key}By`]: S.uid, [`${key}At`]: Date.now() }),
        });
        const t = s.q('textarea');
        setTimeout(() => { t.focus(); t.setSelectionRange(t.value.length, t.value.length); t.scrollTop = t.scrollHeight; }, 80);
      },
      focusToggle() { focusOpen = !focusOpen; render(true); },
      side(el) { side = el.dataset.side; lovedOnly = false; render(true); },
      topic(el) { topicForm(get(el.dataset.id), side, el.dataset.topic); },
      topicPhoto(el) {
        const b = get(el.dataset.id), pics = topicPins(b, side, el.dataset.key);
        view(pics, pics.findIndex(p => p.id === el.dataset.pin));
      },
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
            const id = await DB.add({ kind: 'board', name: v.name, order: mainBoards().length, cover: null });
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
        const list = siblings(b);
        const at = list.findIndex(x => x.id === b.id);
        form({
          title: 'Edit board',
          fields: [
            { name: 'name', label: 'Room', value: b.name, required: true },
            ...(b.addition ? [{ name: 'dims', label: 'Size', value: b.dims || '', placeholder: '12 x 13', hint: 'Width × length, like 12x13 or 12\'6" x 13\'.' }] : []),
            { name: 'link', label: 'Link for this room (optional)', type: 'url', value: b.link || '', placeholder: 'pinterest.com/you/dream-kitchen', hint: 'The link button on this board opens it. Leave blank to use your Inspiration favorite.' },
            { name: 'pos', label: 'Position in the list', type: 'select', value: at, options: list.map((x, i) => [i, `${i + 1}. ${x.id === b.id ? '(here now)' : x.name}`]) },
          ],
          save: async v => {
            if (v.dims && !Size.parse(v.dims)) throw new Error(`Couldn’t read the size “${v.dims}”. Try it like 12x13.`);
            const order = list.filter(x => x.id !== b.id);
            order.splice(+v.pos, 0, b);
            for (let i = 0; i < order.length; i++) {
              const x = order[i];
              const patch = x.id === b.id ? { name: v.name, link: v.link, order: i, ...(b.addition ? { dims: v.dims } : {}) } : { order: i };
              if (x.id === b.id || x.order !== i) await DB.update(x.id, patch);
            }
          },
          remove: async () => {
            const pins = pinsIn(b.id);
            const msg = pins.length ? `Delete the ${b.name} board and its ${pins.length} photo${pins.length === 1 ? '' : 's'}?` : `Delete the ${b.name} board?`;
            if (!(await ask(msg))) return false;
            await DB.removeMany([...pins, b]);
            location.hash = b.addition ? `#/additions/${b.addition}` : '#/rooms';
            return true;
          },
        });
      },
    },
  };

  // Photo board layout: each photo goes into whichever column is shortest,
  // using its known shape, so the columns stay even (iPhone Safari's own
  // column layout could pile photos into one column before they loaded).
  const colCount = () => (innerWidth >= 980 ? 4 : innerWidth >= 720 ? 3 : 2);
  let lastCols = colCount();
  addEventListener('resize', () => {
    const n = colCount();
    if (n !== lastCols) { lastCols = n; if (location.hash.startsWith('#/rooms/')) render(true); }
  });
  function masonry(list, html) {
    const cols = Array.from({ length: colCount() }, () => ({ h: 0, items: [] }));
    list.forEach((p, i) => {
      const c = cols.reduce((a, b) => (b.h < a.h - 0.001 ? b : a));
      c.items.push(html(p, i));
      c.h += (p.photo.h || 3) / (p.photo.w || 4) + (p.caption ? 0.18 : 0) + 0.05;
    });
    return `<div class="masonry">${cols.map(c => `<div class="m-col">${c.items.join('')}</div>`).join('')}</div>`;
  }

  function board(id) {
    const b = get(id);
    if (!b) return empty('rooms', 'Board not found', 'It may have been deleted.', '<a class="btn" href="#/rooms">All boards</a>');
    // A different board (or coming back to one) always starts on Starter.
    if (openBoard !== id) { openBoard = id; side = 'starter'; lovedOnly = false; }
    // Future rooms have one set of photos and notes (kept as the Upgrades side).
    const add = b.addition && get(b.addition);
    const single = oneSided(b);
    if (single) side = 'upgrade';
    const dims = b.addition && Size.parse(b.dims);
    const feel = dims && Size.compare(dims, kind('room'), b.name);
    const every = pinsIn(id);
    const count = s => every.filter(p => sideOf(p) === s).length;
    const all = every.filter(p => sideOf(p) === side);
    const pins = lovedOnly ? all.filter(p => p.fav) : all;
    const lovedN = all.filter(p => p.fav).length;
    const notes = notesOf(b, side), key = noteKey(side);
    const parts = noteParts(b, side);
    return `${pageTop(b.name, {
      back: add ? [`#/additions/${add.id}`, add.name] : ['#/rooms', 'Room boards'],
      link: linkBtn('Inspiration', b.link && { url: b.link, name: `${b.name} board link` }),
      sub: add ? `Future room · ${esc(add.name)}${dims ? ` · ${Size.dims(dims)}` : ''}` : `${every.length} photo${every.length === 1 ? '' : 's'}`,
      right: `<button class="icon-btn" data-act="editBoard" data-id="${id}" aria-label="Edit board">${icon('edit')}</button>`,
    })}
    ${single ? (feel ? `<p class="feel-line">${esc(feel.text)}</p>` : '') : `<div class="side-toggle" role="tablist" aria-label="Starter or upgrades">
      ${Object.entries(SIDES).map(([k, label]) => `<button role="tab" aria-selected="${side === k}" class="${side === k ? 'on' : ''}" data-act="side" data-side="${k}">${label}<span>${count(k)}</span></button>`).join('')}
    </div>`}
    ${parts.length ? `<section class="card pad notes-card">
      <div class="row-head"><h2>${icon('note')} ${single ? 'Notes' : `${SIDES[side]} notes`}</h2><button class="btn small ghost" data-act="notes" data-id="${id}">Edit all</button></div>
      <div class="notes clamp">${parts.map(x => x.topic ? `<div class="topic-line">
          <button class="tl-txt" data-act="topic" data-id="${id}" data-topic="${esc(x.label)}"><b>${esc(x.label)}:</b> ${x.text ? esc(x.text) : `<span class="muted">${x.pics.length ? 'photos only' : 'extra cost'}</span>`}${x.extra ? ` <span class="badge prep">+${money(x.extra)}</span>` : ''}</button>
          ${x.pics.length ? `<span class="tl-pics">${x.pics.slice(0, 3).map(p => `<button class="tl-pic" data-act="topicPhoto" data-id="${id}" data-key="${x.key}" data-pin="${p.id}"><img src="${esc(thumb(p.photo))}" alt="${esc(x.label)} photo" loading="lazy"></button>`).join('')}${x.pics.length > 3 ? `<span class="tl-more">+${x.pics.length - 3}</span>` : ''}</span>` : ''}
        </div>` : `<p>${esc(x.text)}</p>`).join('')}</div>
      <button class="linkish more" data-act="more" hidden>Show more</button>
      ${b[`${key}At`] ? `<p class="muted small">Updated${personName(b[`${key}By`]) ? ` by ${esc(personName(b[`${key}By`]))}` : ''} · ${niceDate(b[`${key}At`])}</p>` : ''}
    </section>` : `<button class="add-notes" data-act="notes" data-id="${id}">${icon('note')} Add ${single ? '' : side === 'starter' ? 'starter ' : 'upgrade '}notes${b.general ? '' : ` for the ${esc(b.name.toLowerCase())}`}</button>`}
    <div class="bar-row">
      <button class="btn" data-act="addPhotos" data-id="${id}">${icon('camera')} Add photos</button>
      ${lovedN ? `<button class="chip${lovedOnly ? ' on' : ''}" data-act="loved">${icon('heart', 'tiny filled')} Loved (${lovedN})</button>` : ''}
      <button class="focus-plus${focusOpen ? ' open' : ''}" data-act="focusToggle" aria-expanded="${focusOpen}" aria-label="Things to decide">+</button>
    </div>
    ${focusOpen ? `<div class="focus-chips">${focusFor(b).map(t => {
        const done = parts.some(x => x.topic && x.key === labelKey(t));
        return `<button class="chip${done ? ' on' : ''}" data-act="topic" data-id="${id}" data-topic="${esc(t)}">${done ? '✓ ' : '+ '}${esc(t)}</button>`;
      }).join('')}</div>` : ''}
    ${pins.length ? masonry(pins, (p, i) => `<figure class="pin" data-sort="${p.id}" data-i="${i}">
        <button class="pin-img" data-act="open" data-board="${id}" data-i="${i}"><img src="${esc(thumb(p.photo))}" alt="${esc(p.caption || '')}" loading="lazy" style="aspect-ratio:${p.photo.w || 4} / ${p.photo.h || 3}"></button>
        <button class="pin-fav${p.fav ? ' on' : ''}" data-act="fav" data-id="${p.id}" aria-label="${p.fav ? 'Loved' : 'Love'}">${icon('heart')}</button>
        ${p.topic ? `<span class="pin-tag">${esc(p.topicLabel || p.topic)}</span>` : ''}
        ${p.caption ? `<figcaption>${esc(p.caption)}</figcaption>` : ''}
      </figure>`)
      : lovedOnly ? empty('heart', 'No loved photos', 'Tap the heart on a photo to love it.')
        : b.general ? empty('camera', 'No photos yet', 'Add photos of layouts you like: how the kitchen opens to the dining room, where the mudroom meets the entry, and so on.')
        : add ? empty('camera', 'No photos yet', 'Add ideas for this room: screenshots from Pinterest, Instagram, anything you love.')
        : side === 'starter' ? empty('camera', 'No starter photos yet', 'Add what you’ll build with first: builder-grade finishes, model home photos, the basic version.')
          : empty('camera', 'No upgrade photos yet', 'Add the dream version: screenshots from Pinterest, Instagram, anything you love.')}`;
  }

  return { oneSided, view, boards, mainBoards, futureBoards, pinsIn, notesOf, SIDES, sideInfo, parseNotes, coverOf, topicPins, starterExtras };
})();
