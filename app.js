/* The Brown Family Home: sign-in, routing, the home page and settings.
   Each section has its own file: rooms.js, plans.js, money.js, land.js.

   Screens are plain HTML strings. A screen is { nav, render(parts), acts,
   after(root, parts) }: taps on [data-act="name"] call acts.name(el, event). */

let DB = null;
const S = { all: [], uid: null, ready: false };
const Views = {};
const view = document.getElementById('view');

const kind = k => S.all.filter(x => x.kind === k);
const get = id => S.all.find(x => x.id === id);
const settings = () => get('settings') || {};
const saveSettings = patch => DB.put('settings', { kind: 'settings', ...patch });
const personName = uid => {
  const p = get(uid);
  return p && p.name ? p.name : '';
};
const byLine = x => {
  const who = personName(x.by);
  return [who && `Added by ${esc(who)}`, x.t && niceDate(x.t)].filter(Boolean).join(' · ');
};
const savedTotal = () => kind('deposit').reduce((sum, d) => sum + (d.amount || 0), 0);

// ---------- starter content (made once, by whoever signs in first) ----------
const STARTER_BOARDS = ['Kitchen', 'Living room', 'Dining', 'Primary bedroom', 'Primary bath', 'Bedrooms', 'Bathrooms',
  'Mudroom & laundry', 'Front porch', 'Outside the house', 'Barn & homestead', 'Garden & yard'];
const LINK_CATEGORIES = ['Floor plans & 3D', 'Inspiration', 'Land', 'Building & money', 'Other'];
const STARTER_LINKS = [
  ['Space Planner', 'https://app.spaceplanner.co', 'Floor plans & 3D', 'Mock up floor plans and see them in 3D', true],
  ['Planner 5D', 'https://planner5d.com', 'Floor plans & 3D', 'Trace a plan from the book and walk through it in 3D. Has an iPhone app.'],
  ['Homestyler', 'https://www.homestyler.com', 'Floor plans & 3D', 'Free 3D room design and decorating'],
  ['Floorplanner', 'https://floorplanner.com', 'Floor plans & 3D', 'Draw a plan in 2D, then flip to 3D'],
  ['Sweet Home 3D', 'https://www.sweethome3d.com', 'Floor plans & 3D', 'Free download for the Mac. More detailed, more fiddly.'],
  ['Pinterest', 'https://www.pinterest.com', 'Inspiration', 'Swap in your own board’s link, then screenshot favorites into a room board', true],
  ['Redfin', 'https://www.redfin.com', 'Land', 'Paste a Redfin listing link into + Property to fill it in', true],
  ['LandWatch', 'https://www.landwatch.com', 'Land', 'Rural land and acreage listings'],
];

async function seed() {
  const st = settings();
  if (st.seeded) return;
  await saveSettings({ seeded: true });
  if (!kind('board').length) {
    for (let i = 0; i < STARTER_BOARDS.length; i++) await DB.add({ kind: 'board', name: STARTER_BOARDS[i], order: i, cover: null });
  }
  if (!kind('link').length) {
    for (const [name, url, category, note, fav = false] of STARTER_LINKS) await DB.add({ kind: 'link', name, url, category, note, fav });
  }
  if (DB.demo) await DB.addSamples();
}

// The pantry lives in the kitchen (Kitchen has a Pantry suggestion), so the
// old starter Pantry board goes away once. Its photos move to Kitchen (same
// side) and any notes are added to Kitchen's as a "Pantry:" line.
async function foldPantry() {
  if (settings().pantryFolded) return;
  await saveSettings({ pantryFolded: true });
  const named = n => kind('board').find(b => !b.addition && b.name.trim().toLowerCase() === n);
  const pantry = named('pantry'), kitchen = named('kitchen');
  if (!pantry || !kitchen) return;
  for (const p of kind('pin').filter(p => p.board === pantry.id)) await DB.update(p.id, { board: kitchen.id });
  const patch = {};
  for (const key of ['starterNotes', 'notes']) {
    const extra = (pantry[key] || '').trim();
    if (extra) patch[key] = `${(kitchen[key] || '').trim()}${kitchen[key] ? '\n' : ''}Pantry: ${extra.replace(/\n+/g, ' · ')}`;
  }
  if (Object.keys(patch).length) await DB.update(kitchen.id, patch);
  await DB.remove(pantry);
}

// Additions used to be kept on the Budget; now each is its own thing.
async function moveAdditions() {
  const old = (get('budget') || {}).additions || [];
  if (!old.length) return;
  for (const a of old) await DB.add({ kind: 'addition', name: a.name, sqft: a.sqft ?? null, amount: a.amount ?? null, note: a.note || '', planId: null, photos: [] });
  await DB.put('budget', { additions: [] });
}

// ---------- routing ----------
let current = null;
let pending = false;

function parts() {
  return location.hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
}

function render(keepScroll) {
  if (!S.ready) return;
  const [name, ...rest] = parts();
  const v = Views[name] || Views.home;
  current = v;
  const y = window.scrollY;
  view.innerHTML = v.render(rest);
  document.querySelectorAll('#nav a').forEach(a => a.classList.toggle('on', a.dataset.nav === (v.nav || name || 'home')));
  if (v.after) v.after(view, rest);
  window.scrollTo(0, keepScroll ? y : 0);
}

// New data from the other phone (or a save) redraws the screen, except while
// someone is typing in it; then it waits until they leave the box.
function refresh() {
  if (sortingNow) { pending = true; return; }
  const a = document.activeElement;
  if (a && view.contains(a) && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)) { pending = true; return; }
  pending = false;
  render(true);
}
view.addEventListener('focusout', () => setTimeout(() => { if (pending) refresh(); }, 0));
window.addEventListener('hashchange', () => render(false));

document.addEventListener('click', e => {
  const pick = e.target.closest('[data-pickfav]');
  if (pick && view.contains(pick)) { e.preventDefault(); pickFav(pick.dataset.pickfav); return; }
  const a = e.target.closest('[data-act]');
  if (!a || !view.contains(a) || !current || !current.acts) return;
  const fn = current.acts[a.dataset.act];
  if (!fn) return;
  e.preventDefault();
  Promise.resolve(fn(a, e)).catch(err => { console.error(err); toast(err.message || 'Something went wrong.'); });
});

// Shared page top: back link (optional), title, and buttons on the right.
function pageTop(title, { back, sub, right = '', link = '' } = {}) {
  return `<header class="page-top">
    ${back ? `<a class="back" href="${back[0]}">${icon('back')}<span>${esc(back[1])}</span></a>` : ''}
    <div class="page-title"><div><div class="h1-row"><h1>${esc(title)}</h1>${link}</div>${sub ? `<p class="sub">${sub}</p>` : ''}</div><div class="top-btns">${right}</div></div>
  </header>`;
}

// ---------- favorite links ----------
// Each section's link button opens the starred link from one Links category.
const PAGE_LINKS = { Inspiration: 'Rooms', 'Floor plans & 3D': 'Plans', Land: 'Land', 'Building & money': 'Savings' };
const favLink = cat => kind('link').find(l => l.fav && (l.category || 'Other') === cat);

// own = a link of its own (a room board's Pinterest board), used first.
function linkBtn(cat, own) {
  const l = own ? { url: own.url, name: own.name } : favLink(cat);
  if (l) return `<a class="link-btn" href="${esc(l.url)}" target="_blank" rel="noopener" title="${esc(l.name)}" aria-label="Open ${esc(l.name)}">${icon('links')}</a>`;
  return `<button class="link-btn unset" data-pickfav="${esc(cat)}" title="Pick a favorite link" aria-label="Pick a favorite ${esc(cat)} link">${icon('links')}</button>`;
}

// Starring a link makes it the favorite for its category (tap again to unstar).
async function setFav(link) {
  const cat = link.category || 'Other';
  const turnOn = !link.fav;
  for (const l of kind('link').filter(x => (x.category || 'Other') === cat)) {
    const want = turnOn && l.id === link.id;
    if (!!l.fav !== want) await DB.update(l.id, { fav: want });
  }
  const page = PAGE_LINKS[cat];
  if (turnOn) toast(page ? `${link.name} opens from the ${page} page` : `${link.name} is your ${cat} favorite`);
}

// No favorite yet: pick one of that category's links right here, or add one.
function pickFav(cat) {
  const list = kind('link').filter(l => (l.category || 'Other') === cat).sort((a, b) => a.t - b.t);
  const s = sheet(`${cat} link`, `<p class="intro">Pick the website this button should open. You can change it anytime by starring a different link on the Links page.</p>
    ${list.length ? `<div class="pick-list">${list.map(l => `<button type="button" class="pick-row" data-id="${l.id}"><b>${esc(l.name)}</b><small>${esc(domain(l.url))}</small></button>`).join('')}</div>`
      : '<p class="muted">No links in this category yet.</p>'}
    <button type="button" class="btn ghost" data-new>${icon('plus')} Add a ${esc(cat)} link</button>`, { cls: 'small' });
  s.el.addEventListener('click', async e => {
    const row = e.target.closest('[data-id]');
    if (row) { await setFav(get(row.dataset.id)); s.close(); }
    if (e.target.closest('[data-new]')) { s.close(); Land.linkForm(null, cat); }
  });
}
// Segmented tabs inside a section, e.g. Plans | Size check.
function tabs(list, on) {
  return `<nav class="tabs">${list.map(([href, text]) => `<a href="${href}" class="${href === on ? 'on' : ''}">${esc(text)}</a>`).join('')}</nav>`;
}
function empty(iconName, title, text, button = '') {
  return `<div class="empty">${icon(iconName, 'big')}<h3>${esc(title)}</h3><p>${text}</p>${button}</div>`;
}
// A cover photo, or a soft placeholder with an icon.
function cover(photo, iconName, cls = '') {
  return photo
    ? `<div class="cover ${cls}"><img src="${esc(thumb(photo))}" alt="" loading="lazy"></div>`
    : `<div class="cover ph ${cls}">${icon(iconName)}</div>`;
}

// ---------- home ----------
Views.home = {
  nav: 'home',
  render() {
    const st = settings();
    const pins = kind('pin').sort(newest);
    const ups = kind('upgrade');
    const g = Budget.goalNow();
    const saved = savedTotal(), goal = g.amount;
    const pct = goal ? saved / goal : 0;
    const loved = pins.filter(p => p.fav);
    const strip = (loved.length >= 4 ? loved : pins).slice(0, 14);
    const upPhoto = (ups.find(u => u.laterPhoto) || {}).laterPhoto;

    const tile = (href, iconName, title, sub, photo) => `<a class="tile" href="${href}">${cover(photo, iconName)}
      <div class="tile-txt"><h3>${esc(title)}</h3><p>${sub}</p></div></a>`;

    return `
    ${heroHtml(st)}

    <a class="card save-card" href="#/money">
      <div class="save-house">${houseSvg(pct)}</div>
      <div class="save-txt">
        <p class="eyebrow">Our savings</p>
        <p class="big">${money(saved)}</p>
        ${goal ? `<p class="muted">of ${money(goal)} · ${Math.floor(pct * 100)}% there</p>
          ${Budget.goalBar(saved, g)}`
          : '<p class="muted">Tap to set your goal</p>'}
      </div>
    </a>

    ${Steps.card()}

    <div class="tiles two-up">
      ${tile('#/size', 'ruler', 'Size check', 'How big does it feel?', null)}
      ${tile('#/upgrades', 'money', 'Upgrades', ups.length ? `${ups.filter(u => !u.done).length} on the wishlist` : 'Now vs. someday', upPhoto)}
    </div>

    <div class="tiles two-up half-cards">
      ${Builders.card()}
      ${Docs.card()}
    </div>

    ${strip.length ? `<section class="strip-wrap">
      <div class="row-head"><h2>${loved.length >= 4 ? 'Loved ideas' : 'Newest ideas'}</h2><a href="#/rooms">All boards</a></div>
      <div class="strip">${strip.map((p, i) => `<button class="strip-pin" data-act="pin" data-i="${i}"><img src="${esc(thumb(p.photo))}" alt="${esc(p.caption || '')}" loading="lazy"></button>`).join('')}</div>
    </section>` : ''}`;
  },
  acts: {
    pin(el) {
      const pins = kind('pin').sort(newest);
      const loved = pins.filter(p => p.fav);
      const strip = (loved.length >= 4 ? loved : pins).slice(0, 14);
      Rooms.view(strip, +el.dataset.i);
    },
  },
};

// The top of the home page: your photo (placed the way you set it in
// Settings → Adjust photo) or the farmhouse drawing. Also used by the adjuster.
function heroHtml(st, editing) {
  const h = { x: 50, y: 50, zoom: 1, dark: 0.3, pos: 'bottom', ...(st.hero || {}) };
  const photo = st.heroPhoto;
  return `<section class="hero${photo ? ` has-photo pos-${esc(h.pos)}` : ''}" style="--dark:${+h.dark}">
    ${photo ? `<img class="hero-img" src="${esc(photo.url)}" alt="" draggable="false" style="${heroImgStyle(h)}">` : `<div class="hero-art">${heroArt()}</div>`}
    <div class="hero-txt">
      <h1>The Brown Family Home</h1>
      ${st.subtitle ? `<p>${esc(st.subtitle)}</p>` : ''}
    </div>
    ${editing ? '' : `<a class="icon-btn hero-gear" href="#/settings" aria-label="Settings">${icon('gear')}</a>`}
  </section>`;
}
// The photo point at x%,y% stays in place at any screen size, and zoom grows around it.
const heroImgStyle = h => `object-position:${+h.x}% ${+h.y}%;transform:scale(${+h.zoom});transform-origin:${+h.x}% ${+h.y}%`;

// A soft hillside farmhouse for the top of the home page (until you pick a photo).
function heroArt() {
  return `<svg viewBox="0 0 400 190" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
    <circle cx="318" cy="58" r="26" fill="var(--sand)" opacity=".7"/>
    <path d="M0 150 C80 110 150 120 220 138 S340 150 400 128 V190 H0Z" fill="var(--sage-soft)"/>
    <path d="M0 170 C90 146 170 150 250 162 S360 170 400 158 V190 H0Z" fill="var(--sage)" opacity=".75"/>
    <g transform="translate(150 78)">
      <rect x="62" y="0" width="10" height="20" fill="var(--wood)"/>
      <path d="M8 70V36L50 8l42 28v34z" fill="var(--paper)" stroke="var(--wood-deep)" stroke-width="2.5" stroke-linejoin="round"/>
      <path d="M0 40L50 4l50 36" fill="none" stroke="var(--wood-deep)" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M8 50h84" stroke="var(--wood-deep)" stroke-width="2"/>
      <rect x="42" y="50" width="16" height="20" fill="var(--wood)" stroke="var(--wood-deep)" stroke-width="2"/>
      <rect x="18" y="54" width="13" height="11" fill="var(--sand)" stroke="var(--wood-deep)" stroke-width="1.8"/>
      <rect x="69" y="54" width="13" height="11" fill="var(--sand)" stroke="var(--wood-deep)" stroke-width="1.8"/>
      <circle cx="50" cy="30" r="5.5" fill="var(--sand)" stroke="var(--wood-deep)" stroke-width="1.8"/>
    </g>
    <g fill="var(--sage-deep)"><circle cx="118" cy="140" r="14"/><circle cx="132" cy="146" r="10"/><circle cx="284" cy="142" r="12"/><circle cx="72" cy="150" r="9"/></g>
    <path d="M118 140v14M284 142v12" stroke="var(--wood-deep)" stroke-width="2"/>
  </svg>`;
}

function askName(first) {
  const me = get(S.uid) || {};
  form({
    title: first ? 'Welcome home!' : 'Your name',
    intro: first ? 'What should the app call you? It shows who added each photo.' : '',
    fields: [{ name: 'name', label: 'Your name', value: me.name || '', placeholder: 'Gabriella', required: true, autofocus: true }],
    save: v => DB.put(S.uid, { kind: 'person', name: v.name, email: me.email || S.email || '' }),
  });
}

// ---------- sign in ----------
function signInScreen(message = '') {
  document.body.classList.add('signed-out');
  view.innerHTML = `<div class="signin">
    <div class="signin-art">${heroArt()}</div>
    <h1>The Brown Family Home</h1>
    ${Store.configured ? `<form class="card pad stack" id="signin">
      <label class="field"><span class="lbl">Email</span><input type="email" name="email" autocomplete="username" required></label>
      <label class="field"><span class="lbl">Password</span><input type="password" name="password" autocomplete="current-password" required></label>
      <p class="form-err"${message ? '' : ' hidden'}>${esc(message)}</p>
      <button class="btn">Sign in</button>
      <button type="button" class="linkish" id="forgot">Forgot password?</button>
    </form>` : `<div class="card pad stack">
      <p>Firebase isn’t connected yet, so nothing can be saved. You can look around in sample mode (it resets when you reload).</p>
      <button class="btn" id="sample">Try sample mode</button>
    </div>`}
  </div>`;
  const f = document.getElementById('signin');
  if (f) {
    f.addEventListener('submit', async e => {
      e.preventDefault();
      const btn = f.querySelector('.btn');
      btn.disabled = true; btn.textContent = 'Signing in…';
      try {
        await DB.signIn(f.email.value.trim(), f.password.value);
      } catch (err) {
        const bad = /wrong-password|user-not-found|invalid-credential|invalid-login/.test(err.code || '');
        signInScreen(bad ? 'That email and password don’t match.' : (err.message || 'Couldn’t sign in.'));
      }
    });
    document.getElementById('forgot').onclick = async () => {
      const email = f.email.value.trim();
      if (!email) return toast('Type your email first.');
      try { await DB.resetPassword(email); toast('Check your email for a reset link.'); } catch (err) { toast(err.message); }
    };
  }
  const sample = document.getElementById('sample');
  if (sample) sample.onclick = () => { try { sessionStorage.setItem('home-sample', '1'); } catch {} start(DemoStore); };
}

// ---------- start ----------
let unwatch = null;
function start(store) {
  DB = store;
  document.getElementById('banner').hidden = !DB.demo;
  DB.onAuth(user => {
    if (unwatch) { unwatch(); unwatch = null; }
    S.ready = false;
    S.all = [];
    if (!user) { S.uid = null; signInScreen(); return; }
    S.uid = user.uid;
    S.email = user.email;
    document.body.classList.remove('signed-out');
    view.innerHTML = '<p class="loading">Loading…</p>';
    let setUp = false;
    unwatch = DB.watch((all, fromCache) => {
      S.all = all;
      S.ready = true;
      Look.sync(get(S.uid));
      if (!setUp && !fromCache) {
        setUp = true;
        seed().then(moveAdditions).then(foldPantry).then(() => Steps.seed()).then(() => Builders.seed()).then(() => { if (!personName(S.uid)) askName(true); }).catch(console.error);
      }
      refresh();
    }, err => {
      console.error(err);
      view.innerHTML = `<div class="empty"><h3>Couldn’t load your home</h3><p>${esc(err.message)}</p></div>`;
    });
  });
}

// Runs from main.js, after every section file has added its screens.
function boot() {
  const offline = document.getElementById('offline-bar');
  const net = () => { offline.hidden = navigator.onLine; };
  addEventListener('online', net); addEventListener('offline', net); net();

  let sample = false;
  try { sample = sessionStorage.getItem('home-sample') === '1'; } catch {}
  if (Store.configured) start(Store);
  else if (sample) start(DemoStore);
  else signInScreen();

  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    navigator.serviceWorker.register('sw.js').catch(err => console.warn('Offline support unavailable', err));
  }
}
