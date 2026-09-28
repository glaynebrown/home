/* Room boards: a photo board for each room (Kitchen, Front porch, ...).
   #/rooms          all the boards
   #/rooms/{id}     one board */
const Rooms = (() => {
  let lovedOnly = false;

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
        sub: [board && esc(board.name), byLine(p), p.link && `<a href="${esc(p.link)}" target="_blank" rel="noopener">Open link</a>`].filter(Boolean).join(' · '),
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
          <div class="tile-txt"><h3>${esc(b.name)}</h3><p>${pins.length} photo${pins.length === 1 ? '' : 's'}${loved ? ` · ${loved} ${icon('heart', 'tiny filled')}` : ''}</p></div></a>`;
      }).join('')}</div>` : empty('rooms', 'No boards yet', 'Add a board for each room you’re dreaming about.')}`;
    },
    acts: {
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
          for (const photo of photos) await DB.add({ kind: 'pin', board: id, photo, caption: '', link: '', fav: false });
        });
      },
      loved() { lovedOnly = !lovedOnly; render(true); },
      open(el) {
        const b = get(el.dataset.board);
        let pins = pinsIn(b.id);
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
    const all = pinsIn(id);
    const pins = lovedOnly ? all.filter(p => p.fav) : all;
    const lovedN = all.filter(p => p.fav).length;
    return `${pageTop(b.name, {
      back: ['#/rooms', 'Room boards'],
      link: linkBtn('Inspiration', b.link && { url: b.link, name: `${b.name} board link` }),
      sub: `${all.length} photo${all.length === 1 ? '' : 's'}`,
      right: `<button class="icon-btn" data-act="editBoard" data-id="${id}" aria-label="Edit board">${icon('edit')}</button>`,
    })}
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
        : empty('camera', 'Nothing here yet', 'Add photos from your camera roll: screenshots from Pinterest, Instagram, model homes, anything you love.')}`;
  }

  return { view, boards, pinsIn };
})();
