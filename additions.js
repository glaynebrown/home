/* Additions: sections of the house to build later, like a bedroom wing.
   #/additions         all additions
   #/additions/{id}    one addition: photos, which plan, sq ft, cost, its rooms

   kind 'addition' { name, planId, sqft, amount (a builder quote), note, photos: [] }
   Each room in an addition is a room board with board.addition = its id and
   board.dims = its size (see rooms.js), so it gets photos, notes and the
   "Things to decide" suggestions like any other room.
   Cost = sq ft × cost per sq ft + the markup (Budget), unless there's a quote.
   The Budget tab shows the total as "Additions later". */
const Additions = (() => {
  const TABS = [['#/plans', 'Plans'], ['#/additions', 'Additions'], ['#/size', 'Size check']];
  const TIPS = [
    ['Foundation & roof', 'Ask for a layout where the new wing can tie in easily: a straight wall to build off of and a roofline that can extend.'],
    ['Plumbing & electrical', 'Size the water heater, septic and electrical panel for the finished house, not just the starter one.'],
    ['Heating & cooling', 'Plan how the addition will be heated and cooled: a bigger system now, or a separate one later.'],
    ['The doorway', 'Frame a future doorway (or a closet that becomes one) where the hallway will continue.'],
    ['Permits & septic', 'Septic permits are often by number of bedrooms. A 4-bedroom perc lets you add bedrooms later.'],
  ];

  const list = () => kind('addition').sort((a, b) => a.t - b.t);
  const markup = () => (get('budget') || {}).markup ?? 25;
  const cps = () => settings().costPerSqft || 0;
  const roomsOf = a => Rooms.futureBoards(a.id);
  const roomsSqft = a => roomsOf(a).reduce((s, b) => s + ((Size.parse(b.dims) || {}).area || 0), 0);
  const sqftOf = a => a.sqft || Math.round(roomsSqft(a));
  const quoted = a => a.amount != null && a.amount !== '';
  const cost = a => (quoted(a) ? a.amount : sqftOf(a) * cps() * (1 + markup() / 100));
  const total = () => list().reduce((s, a) => s + cost(a), 0);
  const tipsHtml = () => `<details class="card pad tips"><summary>Plan for the addition during the build</summary>
      <ul class="ticks">${TIPS.map(([h, x]) => `<li><b>${h}:</b> ${x}</li>`).join('')}</ul>
      <p class="muted small">Worth bringing up with builders when you get quotes.</p></details>`;
  // The addition's own photo, or a photo from one of its rooms.
  const coverPhoto = a => (a.photos || [])[0] || roomsOf(a).map(Rooms.coverOf).find(Boolean) || null;

  function additionForm(a) {
    const plans = Plans.sorted();
    form({
      title: a ? 'Edit addition' : 'New addition',
      fields: [
        { name: 'name', label: 'What', value: a?.name, placeholder: 'Bedroom wing', required: true, autofocus: !a },
        { name: 'planId', label: 'Adds on to', type: 'select', value: a?.planId || '', options: [['', 'Not picked yet'], ...plans.map(p => [p.id, p.name])] },
        { name: 'sqft', label: 'Square feet', type: 'number', value: a?.sqft, placeholder: '650', hint: 'Leave blank to add up the room sizes.' },
        { name: 'amount', label: 'Or a builder’s quote', type: 'money', value: a?.amount ?? '', placeholder: '140,000', hint: 'Leave blank to estimate from sq ft × cost per sq ft + the markup.' },
        { name: 'note', label: 'Notes', type: 'textarea', value: a?.note, placeholder: '2 bedrooms + a full bath off the main hallway' },
      ],
      save: async v => {
        const data = { ...v, planId: v.planId || null };
        if (a) return DB.update(a.id, data);
        const id = await DB.add({ kind: 'addition', ...data, photos: [] });
        location.hash = `#/additions/${id}`;
      },
      remove: a && (async () => {
        const rooms = roomsOf(a);
        const pins = rooms.flatMap(b => Rooms.pinsIn(b.id));
        if (!(await ask(`Delete “${a.name}”${rooms.length ? `, its ${rooms.length} room board${rooms.length === 1 ? '' : 's'} and their photos` : ''}?`))) return false;
        await DB.removeMany([...pins, ...rooms, a]);
        location.hash = '#/additions';
        return true;
      }),
    });
  }

  function roomForm(a) {
    form({
      title: `Room in ${a.name}`,
      fields: [
        { name: 'name', label: 'Room', placeholder: 'Bedroom 3', required: true, autofocus: true },
        { name: 'dims', label: 'Size (optional)', placeholder: '12 x 13', hint: 'Width × length, like 12x13 or 12\'6" x 13\'.' },
      ],
      save: async v => {
        if (v.dims && !Size.parse(v.dims)) throw new Error(`Couldn’t read the size “${v.dims}”. Try it like 12x13.`);
        await DB.add({ kind: 'board', name: v.name, addition: a.id, dims: v.dims, order: roomsOf(a).length, cover: null });
      },
    });
  }

  const costLine = a => {
    const sq = sqftOf(a);
    if (quoted(a)) return `Builder’s quote: <b>${money(a.amount)}</b>`;
    if (!sq) return '<span class="muted">Add the square feet (or room sizes) for a cost estimate.</span>';
    if (!cps()) return '<span class="muted">Add your cost per sq ft on the Budget tab for a cost estimate.</span>';
    return `${commas(sq)} sq ft × ${money(cps())} + ${markup()}% ≈ <b>${money(cost(a))}</b>`;
  };

  Views.additions = {
    nav: 'plans',
    render([id]) {
      if (id) return detail(id);
      const all = list();
      return `${pageTop('Additions', { link: linkBtn('Floor plans & 3D'), sub: 'Sections of the house to build later', right: `<button class="btn small" data-act="add">${icon('plus')} Addition</button>` })}
      ${tabs(TABS, '#/additions')}
      ${all.length ? `<p class="muted">Additions later: <b>${money(total())}</b> · also on the <a href="#/budget">Budget</a></p>
        <div class="grid plans">${all.map(a => {
          const plan = a.planId && get(a.planId), n = roomsOf(a).length, sq = sqftOf(a);
          return `<a class="plan-card" href="#/additions/${a.id}">${cover(coverPhoto(a), 'plans')}
            <div class="tile-txt"><h3>${esc(a.name)}</h3>
            <p>${[plan && `Adds on to ${esc(plan.name)}`, sq && `${commas(sq)} sq ft`, n && `${n} room${n === 1 ? '' : 's'}`].filter(Boolean).join(' · ')}</p>
            ${cost(a) ? `<p class="muted">≈ ${money(cost(a))}</p>` : ''}</div></a>`;
        }).join('')}</div>`
        : empty('plans', 'No additions yet', 'Starting with a smaller house? Add the section you’ll build later, like a bedroom wing, with its rooms, photos and cost.', `<button class="btn" data-act="add">${icon('plus')} Add an addition</button>`)}
      <section class="card pad">
        <button class="b-row" data-act="markup"><span class="b-name"><span class="b-title">Addition markup</span><small>Adding onto a finished house usually costs more per sq ft than building it at the start</small></span><span class="b-amt">${markup()}%</span></button>
      </section>
      ${tipsHtml()}`;
    },
    acts: {
      add: () => additionForm(null),
      edit: el => additionForm(get(el.dataset.id)),
      addRoom: el => roomForm(get(el.dataset.id)),
      markup() {
        form({
          title: 'Addition markup',
          fields: [{ name: 'markup', label: 'Percent more per sq ft', type: 'number', value: markup(), hint: 'Adding on later usually runs 20–50% more per sq ft.' }],
          save: v => DB.put('budget', { kind: 'budget', markup: v.markup ?? 25 }),
        });
      },
      async addPhotos(el) {
        const a = get(el.dataset.id);
        await addPhotos(async photos => DB.update(a.id, { photos: [...(get(a.id).photos || []), ...photos] }));
      },
      photo(el) {
        const a = get(el.dataset.id);
        viewer((a.photos || []).map((photo, k) => ({
          photo, title: a.name,
          actions: [
            { label: 'Make first', fn: async () => {
              const cur = get(a.id).photos || [];
              await DB.update(a.id, { photos: [cur[k], ...cur.filter((_, j) => j !== k)] });
              toast('Moved to the front');
              return 'close';
            } },
            { label: 'Delete', danger: true, fn: async () => {
              if (!(await ask('Delete this photo?'))) return;
              const cur = get(a.id).photos || [];
              await DB.update(a.id, { photos: cur.filter((_, j) => j !== k) });
              DB.dropPhotos([cur[k]]);
              return 'close';
            } },
          ],
        })), +el.dataset.i);
      },
    },
  };

  function detail(id) {
    const a = get(id);
    if (!a) return empty('plans', 'Addition not found', 'It may have been deleted.', '<a class="btn" href="#/additions">All additions</a>');
    const plan = a.planId && get(a.planId);
    const photos = a.photos || [];
    const rooms = roomsOf(a);
    const sq = sqftOf(a), rsq = Math.round(roomsSqft(a));
    const mine = kind('room');
    return `${pageTop(a.name, {
      back: ['#/additions', 'Additions'],
      sub: plan ? `Adds on to <a href="#/plans/${plan.id}">${esc(plan.name)}</a>` : '',
      right: `<button class="icon-btn" data-act="edit" data-id="${id}" aria-label="Edit addition">${icon('edit')}</button>`,
    })}
    <div class="gallery">
      ${photos.map((ph, i) => `<button class="g-photo" data-act="photo" data-id="${id}" data-i="${i}"><img src="${esc(thumb(ph))}" alt="" loading="lazy"></button>`).join('')}
      <button class="g-add" data-act="addPhotos" data-id="${id}">${icon('camera')}<span>${photos.length ? 'Add more' : 'Add photos or sketches'}</span></button>
    </div>
    <div class="card pad plan-sum">
      ${sq ? `<p class="stats">${commas(sq)} sq ft${!a.sqft ? ' <span class="muted">(from the room sizes)</span>' : ''}</p>` : ''}
      <p class="est">${costLine(a)}</p>
      ${a.note ? `<p class="notes">${esc(a.note)}</p>` : ''}
    </div>
    <section class="card pad">
      <div class="row-head"><h2>Rooms</h2><button class="btn small" data-act="addRoom" data-id="${id}">${icon('plus')} Room</button></div>
      ${rooms.length ? `<div class="future-rooms">${rooms.map(b => {
        const d = Size.parse(b.dims), c = d && Size.compare(d, mine, b.name), n = Rooms.pinsIn(b.id).length;
        return `<a class="now-room" href="#/rooms/${b.id}">${cover(Rooms.coverOf(b), 'rooms', 'sq')}
          <div><h3>${esc(b.name)}</h3><p>${[d && `${Size.dims(d)} · ${Size.sqft(d)}`, `${n} photo${n === 1 ? '' : 's'}`].filter(Boolean).join(' · ')}</p>
          ${c ? `<p class="feel-txt">${esc(c.text)}</p>` : ''}</div></a>`;
      }).join('')}</div>
      ${a.sqft && rsq ? `<p class="muted small">The rooms add up to ${commas(rsq)} sq ft. Halls, closets and walls make up the rest.</p>` : ''}`
        : '<p class="muted">Add each room (Bedroom 3, a bathroom…). Each one gets its own board for photos and notes, listed under Rooms as a future room.</p>'}
    </section>
    ${tipsHtml()}`;
  }

  return { TABS, list, cost, total, sqftOf };
})();
