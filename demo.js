/* Sample mode: lets you try the app before Firebase is set up. Same functions
   as store.js, but everything lives in memory and disappears on reload.
   Photos you add stay on this device only (never uploaded). */
const DemoStore = (() => {
  let things = [];
  let n = 0;
  const newId = () => `d${++n}`;
  const listeners = [];
  const clone = x => JSON.parse(JSON.stringify(x));
  const emit = () => setTimeout(() => listeners.forEach(cb => cb(clone(things), false)));

  // Soft placeholder "photos" in the cottage colors, so sample boards aren't empty.
  function samplePhoto(i, [a, b]) {
    const h = [300, 420, 360, 480, 330][i % 5];
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="${h}" viewBox="0 0 400 ${h}"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs><rect width="400" height="${h}" fill="url(#g)"/><circle cx="${80 + (i * 97) % 240}" cy="${h * 0.3}" r="${26 + (i * 13) % 30}" fill="#fff" opacity=".35"/><path d="M0 ${h * 0.75} Q120 ${h * 0.6} 220 ${h * 0.72} T400 ${h * 0.68} V${h} H0Z" fill="#000" opacity=".12"/></svg>`;
    const url = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    return { path: `sample-${i}`, thumbPath: `sample-${i}-t`, url, thumbUrl: url, w: 400, h };
  }
  const COLORS = [['#F3EDE2', '#A3AE92'], ['#E6D8C3', '#9A7452'], ['#DCE3D2', '#5F6F52'], ['#FAF6EF', '#C9B8A0'], ['#E9E1D3', '#7D8C6E']];

  return {
    configured: true,
    demo: true,

    onAuth: cb => setTimeout(() => cb({ uid: 'sample', email: 'sample' })),
    signIn: async () => {},
    signOut: async () => { try { sessionStorage.removeItem('home-sample'); } catch {} location.hash = '#/'; location.reload(); },
    resetPassword: async () => {},

    watch(cb) { listeners.push(cb); emit(); return () => {}; },
    async add(data) {
      const x = { ...clone(data), id: newId(), t: Date.now() + n, by: 'sample' };
      things.push(x); emit();
      return x.id;
    },
    async put(id, data) {
      const old = things.find(x => x.id === id);
      if (old) Object.assign(old, clone(data));
      else things.push({ ...clone(data), id, t: Date.now() });
      emit();
    },
    async update(id, patch) {
      things = things.map(x => (x.id === id ? { ...x, ...clone(patch) } : x)); emit();
    },
    async remove(item) { things = things.filter(x => x.id !== item.id); emit(); },
    async removeMany(list) {
      const ids = new Set(list.map(x => x.id));
      things = things.filter(x => !ids.has(x.id)); emit();
    },
    async upload(p) {
      const url = URL.createObjectURL(p.full.blob), thumbUrl = URL.createObjectURL(p.thumb.blob);
      return { path: url, thumbPath: thumbUrl, url, thumbUrl, w: p.full.w, h: p.full.h };
    },
    dropPhotos: async () => {},
    uploadFile: async file => ({ path: 'sample', url: URL.createObjectURL(file), type: file.type || 'application/pdf', size: file.size, fileName: file.name || '' }),
    preview: async () => { throw new Error('Reading listing links needs Firebase, so it doesn’t work in sample mode.'); },

    // Called once the starter boards exist, so sample mode has a little to
    // show. Made-up examples only.
    async addSamples() {
      const t = Date.now();
      const boards = things.filter(x => x.kind === 'board').sort((a, b) => a.order - b.order);
      const byName = name => (boards.find(b => b.name === name) || boards[0]).id;
      const pins = [['Kitchen', 'Sample: love the open shelves'], ['Kitchen', ''], ['Kitchen', 'Sample: sage cabinets'],
        ['Living room', 'Sample: wood beams!'], ['Living room', ''], ['Primary bath', ''], ['Front porch', 'Sample: wraparound porch'],
        ['Primary bedroom', ''], ['Mudroom & laundry', 'Sample: hooks + bench']];
      pins.forEach(([board, caption], i) => things.push({ id: newId(), kind: 'pin', board: byName(board), caption, link: '', fav: i % 3 === 0, photo: samplePhoto(i, COLORS[i % 5]), t: t - i * 1000, by: 'sample' }));

      const settings = things.find(x => x.id === 'settings');
      Object.assign(settings, { goal: 150000, costPerSqft: 175 });
      [[42000, 'Sample: starting balance', '2026-06-01'], [1850, 'Sample: OT check', '2026-08-15'], [2200, 'Sample: OT check', '2026-09-12']]
        .forEach(([amount, note, date], i) => things.push({ id: newId(), kind: 'deposit', amount, note, date, t: t - 5000 + i, by: 'sample' }));

      [['Living room', '14x18'], ['Primary bedroom', '13x14'], ['Kitchen', '11x12'], ['Bathroom', '5x8']]
        .forEach(([name, dims], i) => things.push({ id: newId(), kind: 'room', name, dims, photo: null, t: t + i, by: 'sample' }));

      things.push({
        id: newId(), kind: 'plan', name: 'The Magnolia (sample)', source: 'Plan book, page 112', link: '', sqft: 2150, beds: 4, baths: 2.5, stories: 1, hearts: 4,
        loves: 'Big pantry off the kitchen\nMudroom by the garage', dislikes: 'Laundry is far from the bedrooms',
        photos: [samplePhoto(2, COLORS[3]), samplePhoto(4, COLORS[1])],
        rooms: [{ name: 'Great room', dims: `20'x22'` }, { name: 'Kitchen', dims: `14'6" x 16'` }, { name: 'Primary bedroom', dims: '15x16' }, { name: 'Bedroom 2', dims: '11x12' }, { name: 'Primary bath', dims: '10x12' }],
        t: t - 2000, by: 'sample',
      }, {
        id: newId(), kind: 'plan', name: 'Cedar Hollow (sample)', source: 'Plan book, page 58', link: '', sqft: 1890, beds: 3, baths: 2, stories: 1, hearts: 3,
        loves: 'Wraparound porch', dislikes: 'Small primary closet', photos: [samplePhoto(1, COLORS[0])],
        rooms: [{ name: 'Living room', dims: '16x18' }, { name: 'Kitchen', dims: '12x14' }], t: t - 3000, by: 'sample',
      });

      things.push({
        id: newId(), kind: 'upgrade', name: 'Kitchen cabinets', room: 'Kitchen', nowText: 'Builder-grade white shaker', laterText: 'Sage green, glass-front uppers',
        nowPhoto: samplePhoto(3, COLORS[3]), laterPhoto: samplePhoto(0, COLORS[2]), cost: 18000, prep: false, prepNote: '', done: false, t, by: 'sample',
      }, {
        id: newId(), kind: 'upgrade', name: 'Island sink', room: 'Kitchen', nowText: 'Island without a sink', laterText: 'Farmhouse sink in the island',
        nowPhoto: null, laterPhoto: samplePhoto(1, COLORS[4]), cost: 3500, prep: true, prepNote: 'Run plumbing to the island during the build', done: false, t: t + 1, by: 'sample',
      });

      things.push({
        id: newId(), kind: 'land', name: 'Rolling pasture (sample)', place: 'Sample County', link: '', acres: 15, price: 120000, status: 'favorite', hearts: 4,
        notes: 'Sample: creek on the back side, nice flat spot near the road.', photos: [samplePhoto(0, COLORS[2]), samplePhoto(3, COLORS[4])],
        checks: { road: 'yes', power: 'yes', water: 'no' }, t, by: 'sample',
      });
      emit();
    },
  };
})();
