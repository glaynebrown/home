/* Small shared helpers: escaping and numbers, pop-up cards ("sheets") and
   forms, the confirm box, toasts, picking and uploading photos, and the
   full-screen photo viewer. */

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const num = v => {
  const n = parseFloat(String(v ?? '').replace(/[^0-9.\-]/g, ''));
  return Number.isFinite(n) ? n : null;
};
const money = n => (n < 0 ? '−' : '') + '$' + Math.abs(Math.round(n || 0)).toLocaleString('en-US');
const commas = n => Number(n).toLocaleString('en-US', { maximumFractionDigits: 2 });
const thumb = p => (p ? p.thumbUrl || p.url : '');
const newest = (a, b) => (b.t || 0) - (a.t || 0);
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const niceDate = s => {
  if (!s) return '';
  const d = typeof s === 'number' ? new Date(s) : new Date(`${s}T12:00:00`);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};
// Adds https:// when someone types just "planner5d.com".
const fixUrl = u => {
  u = String(u || '').trim();
  if (!u) return '';
  return /^[a-z][a-z0-9+.-]*:/i.test(u) ? u : `https://${u}`;
};
const domain = u => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return ''; } };

// Line icons (24x24, drawn with the current text color).
const ICONS = {
  home: '<path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/>',
  rooms: '<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>',
  plans: '<rect x="3" y="3" width="18" height="18" rx="1.5"/><path d="M3 12h7v9M14 3v6h7M10 12h3"/>',
  money: '<circle cx="12" cy="12" r="9"/><path d="M15 9.3c-.5-.9-1.6-1.5-3-1.5-1.7 0-3 .8-3 2s1.2 1.7 3 2 3 .9 3 2.1-1.3 1.9-3 1.9c-1.5 0-2.6-.6-3-1.6M12 6v12"/>',
  land: '<path d="M2 20l6-8 4 5 3-3 7 6z"/><circle cx="17" cy="6.5" r="2.5"/>',
  links: '<path d="M10 14a4 4 0 0 0 5.66 0l3-3a4 4 0 0 0-5.66-5.66l-1 1"/><path d="M14 10a4 4 0 0 0-5.66 0l-3 3a4 4 0 0 0 5.66 5.66l1-1"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  heart: '<path d="M12 20s-7-4.4-9.2-8.6C1.3 8.5 3 5 6.4 5c2 0 3.3 1.1 4.1 2.3h3C14.3 6.1 15.6 5 17.6 5 21 5 22.7 8.5 21.2 11.4 19 15.6 12 20 12 20z"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/>',
  back: '<path d="M15 5l-7 7 7 7"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  camera: '<path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/><circle cx="12" cy="13.5" r="3.5"/>',
  ruler: '<path d="M3 17L17 3l4 4L7 21z"/><path d="M7 13l2 2M10 10l2 2M13 7l2 2"/>',
  open: '<path d="M14 4h6v6M20 4l-9 9"/><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  note: '<path d="M6 3h9l4 4v14H6z"/><path d="M14 3v5h5M9 12h7M9 16h5"/>',
};
const icon = (name, cls = '') => `<svg class="ic ${cls}" viewBox="0 0 24 24" aria-hidden="true">${ICONS[name]}</svg>`;

// Five tappable hearts (value 0-5). act = the data-act name that sets it.
function hearts(n, act, id) {
  n = n || 0;
  const one = i => `<button class="hrt${i <= n ? ' on' : ''}" ${act ? `data-act="${act}" data-id="${id}" data-n="${i}"` : 'tabindex="-1" disabled'} aria-label="${i} heart${i > 1 ? 's' : ''}">${icon('heart')}</button>`;
  return `<span class="hearts" role="group" aria-label="${n} of 5 hearts">${[1, 2, 3, 4, 5].map(one).join('')}</span>`;
}

// ---------- toast ----------
let toastTimer;
function toast(msg, ms = 2600) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  if (ms) toastTimer = setTimeout(() => el.classList.remove('show'), ms);
}
const toastDone = () => document.getElementById('toast').classList.remove('show');

// ---------- sheets (pop-up cards) ----------
function sheet(title, bodyHtml, { cls = '' } = {}) {
  const wrap = document.createElement('div');
  wrap.className = 'sheet-wrap';
  wrap.innerHTML = `<div class="sheet ${cls}" role="dialog" aria-modal="true" aria-label="${esc(title)}">
    <header class="sheet-head"><h2>${esc(title)}</h2><button type="button" class="icon-btn close" aria-label="Close">×</button></header>
    <div class="sheet-body">${bodyHtml}</div></div>`;
  document.body.appendChild(wrap);
  document.body.classList.add('locked');
  const close = () => {
    wrap.remove();
    if (!document.querySelector('.sheet-wrap, .viewer')) document.body.classList.remove('locked');
  };
  wrap.addEventListener('click', e => { if (e.target === wrap || e.target.closest('.close')) close(); });
  wrap._close = close;
  return { el: wrap, q: s => wrap.querySelector(s), qa: s => [...wrap.querySelectorAll(s)], close };
}
document.addEventListener('keydown', e => {
  if (e.key !== 'Escape') return;
  const top = [...document.querySelectorAll('.sheet-wrap, .viewer')].pop();
  if (top && top._close) top._close();
});

function ask(message, { ok = 'Delete', danger = true, title = 'Are you sure?' } = {}) {
  return new Promise(resolve => {
    const s = sheet(title, `<p class="ask-msg">${esc(message)}</p>
      <div class="sheet-actions"><button type="button" class="btn ghost" data-no>Cancel</button><button type="button" class="btn ${danger ? 'danger' : ''}" data-yes>${esc(ok)}</button></div>`, { cls: 'small' });
    let answered = false;
    const done = v => { if (answered) return; answered = true; s.close(); resolve(v); };
    s.q('[data-yes]').onclick = () => done(true);
    s.q('[data-no]').onclick = () => done(false);
    const obs = new MutationObserver(() => { if (!s.el.isConnected) { obs.disconnect(); done(false); } });
    obs.observe(document.body, { childList: true });
  });
}

// ---------- photos ----------
function pickFiles(multiple) {
  return new Promise(resolve => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.multiple = !!multiple;
    input.hidden = true;
    document.body.appendChild(input);
    input.addEventListener('change', () => { resolve([...input.files]); input.remove(); }, { once: true });
    input.addEventListener('cancel', () => { resolve([]); input.remove(); }, { once: true });
    input.click();
  });
}

// Shrinks and uploads each file, with a progress toast. -> [photo]
async function uploadFiles(files) {
  const out = [];
  for (let i = 0; i < files.length; i++) {
    toast(files.length > 1 ? `Adding photo ${i + 1} of ${files.length}…` : 'Adding photo…', 0);
    try {
      out.push(await DB.upload(await Photos.prepare(files[i])));
    } catch (e) {
      console.error(e);
      toast(e.message || 'That photo didn’t upload.');
      await new Promise(r => setTimeout(r, 1800));
    }
  }
  toastDone();
  return out;
}

// Pick photos and hand the uploaded ones to save(). Returns how many.
async function addPhotos(save, multiple = true) {
  const files = await pickFiles(multiple);
  if (!files.length) return 0;
  const photos = await uploadFiles(files);
  if (photos.length) await save(photos);
  if (photos.length) toast(photos.length > 1 ? `${photos.length} photos added` : 'Photo added');
  return photos.length;
}

// ---------- forms ----------
// fields: [{ name, label, type, value, placeholder, hint, options, required, rows }]
//   type: text (default) | textarea | number | money | url | date | select | check | photo | seg
// save(values) runs after photos upload; photo fields come back as the final
// photo (or null). Old photos that were replaced are removed afterwards.
function fieldHtml(f) {
  const v = f.value ?? '';
  const hint = f.hint ? `<small>${esc(f.hint)}</small>` : '';
  const label = f.label ? `<span class="lbl">${esc(f.label)}</span>` : '';
  switch (f.type) {
    case 'textarea':
      return `<label class="field">${label}<textarea name="${f.name}" rows="${f.rows || 3}" placeholder="${esc(f.placeholder || '')}">${esc(v)}</textarea>${hint}</label>`;
    case 'select':
      return `<label class="field">${label}<select name="${f.name}">${f.options.map(([val, text]) => `<option value="${esc(val)}"${String(val) === String(v) ? ' selected' : ''}>${esc(text)}</option>`).join('')}</select>${hint}</label>`;
    case 'seg':
      return `<div class="field">${label}<div class="seg" role="radiogroup">${f.options.map(([val, text]) => `<label><input type="radio" name="${f.name}" value="${esc(val)}"${String(val) === String(v) ? ' checked' : ''}><span>${esc(text)}</span></label>`).join('')}</div>${hint}</div>`;
    case 'check':
      return `<label class="check"><input type="checkbox" name="${f.name}"${v ? ' checked' : ''}><span>${esc(f.label)}</span></label>${hint}`;
    case 'photo':
      return `<div class="field photo-field" data-photo="${f.name}">${label}<div class="pf">
        <div class="pf-thumb">${v ? `<img src="${esc(thumb(v))}" alt="">` : icon('camera')}</div>
        <div class="pf-btns"><button type="button" class="btn small ghost" data-pick>${v ? 'Change' : 'Choose photo'}</button>
        ${navigator.clipboard && navigator.clipboard.read ? '<button type="button" class="btn small ghost" data-paste-photo>Paste photo</button>' : ''}
        <button type="button" class="btn small ghost" data-clear${v ? '' : ' hidden'}>Remove</button></div></div>${hint}</div>`;
    default: {
      const numeric = f.type === 'money' || f.type === 'number';
      // No example values in number, money or size boxes (they read like real amounts).
      const ph = numeric || f.name === 'dims' ? '' : f.placeholder || '';
      const shown = f.type === 'money' && v !== '' && v != null ? commas(v) : v;
      const type = f.type === 'date' ? 'date' : 'text';
      const mode = numeric ? ' inputmode="decimal"' : f.type === 'url' ? ' inputmode="url" autocapitalize="off" autocorrect="off"' : '';
      return `<label class="field">${label}<div class="inp${f.type === 'money' ? ' has-pre' : ''}">${f.type === 'money' ? '<i class="pre">$</i>' : ''}
        <input type="${type}" name="${f.name}" value="${esc(shown)}" placeholder="${esc(ph)}"${mode}${f.required ? ' required' : ''}${f.autofocus ? ' autofocus' : ''}></div>${hint}</label>`;
    }
  }
}

function form({ title, intro = '', fields, save, remove, saveLabel = 'Save', removeLabel = 'Delete' }) {
  const s = sheet(title, `<form novalidate>${intro ? `<div class="intro">${intro}</div>` : ''}${fields.map(fieldHtml).join('')}
    <p class="form-err" hidden></p>
    <div class="sheet-actions">${remove ? `<button type="button" class="btn ghost danger" data-remove>${esc(removeLabel)}</button>` : ''}<span class="grow"></span>
      <button class="btn" data-save>${esc(saveLabel)}</button></div></form>`);

  // Photo fields: remember the old photo, a newly picked file, or a removal.
  const photos = {};
  fields.filter(f => f.type === 'photo').forEach(f => {
    const st = photos[f.name] = { old: f.value || null, file: f.file || null, removed: false };
    const box = s.q(`[data-photo="${f.name}"]`);
    if (st.file) {
      box.querySelector('.pf-thumb').innerHTML = `<img src="${URL.createObjectURL(st.file)}" alt="">`;
      box.querySelector('[data-pick]').textContent = 'Change';
      box.querySelector('[data-clear]').hidden = false;
    }
    box.querySelector('[data-pick]').onclick = async () => {
      const [file] = await pickFiles(false);
      if (!file) return;
      st.file = file; st.removed = false;
      box.querySelector('.pf-thumb').innerHTML = `<img src="${URL.createObjectURL(file)}" alt="">`;
      box.querySelector('[data-pick]').textContent = 'Change';
      box.querySelector('[data-clear]').hidden = false;
    };
    // A photo copied in Safari (press and hold → Copy).
    const pasteBtn = box.querySelector('[data-paste-photo]');
    if (pasteBtn) pasteBtn.onclick = async () => {
      try {
        let blob = null;
        for (const item of await navigator.clipboard.read()) {
          const type = item.types.find(t => t.startsWith('image/'));
          if (type) { blob = await item.getType(type); break; }
        }
        if (!blob) return toast('No photo copied yet. In Safari, press and hold a photo → Copy.', 4000);
        st.file = blob; st.removed = false;
        box.querySelector('.pf-thumb').innerHTML = `<img src="${URL.createObjectURL(blob)}" alt="">`;
        box.querySelector('[data-pick]').textContent = 'Change';
        box.querySelector('[data-clear]').hidden = false;
      } catch (e) {
        console.warn(e);
        toast('Couldn’t paste. In Safari, press and hold a photo → Copy, then try again.', 4000);
      }
    };
    box.querySelector('[data-clear]').onclick = () => {
      st.file = null; st.removed = true;
      box.querySelector('.pf-thumb').innerHTML = icon('camera');
      box.querySelector('[data-pick]').textContent = 'Choose photo';
      box.querySelector('[data-clear]').hidden = true;
    };
  });

  const err = s.q('.form-err');
  const fail = msg => { err.textContent = msg; err.hidden = false; };
  const btn = s.q('[data-save]');

  s.q('form').addEventListener('submit', async e => {
    e.preventDefault();
    err.hidden = true;
    const el = s.q('form').elements;
    const values = {};
    for (const f of fields) {
      if (f.type === 'photo') continue;
      if (f.type === 'check') values[f.name] = el[f.name].checked;
      else if (f.type === 'seg') values[f.name] = (s.q(`input[name="${f.name}"]:checked`) || {}).value;
      else if (f.type === 'money' || f.type === 'number') values[f.name] = num(el[f.name].value);
      else if (f.type === 'url') values[f.name] = fixUrl(el[f.name].value);
      else values[f.name] = el[f.name].value.trim();
      if (f.required && (values[f.name] === '' || values[f.name] == null)) return fail(`Please fill in “${f.label}”.`);
      if ((f.type === 'money' || f.type === 'number') && el[f.name].value.trim() && values[f.name] == null) return fail(`“${f.label}” should be a number.`);
    }
    btn.disabled = true;
    btn.textContent = 'Saving…';
    const replaced = [];
    try {
      for (const [name, st] of Object.entries(photos)) {
        if (st.file) {
          toast('Adding photo…', 0);
          values[name] = await DB.upload(await Photos.prepare(st.file));
          toastDone();
        } else values[name] = st.removed ? null : st.old;
        if ((st.file || st.removed) && st.old) replaced.push(st.old);
      }
      const result = await save(values);
      if (result === false) { btn.disabled = false; btn.textContent = saveLabel; return; }
      if (replaced.length) DB.dropPhotos(replaced);
      s.close();
    } catch (x) {
      console.error(x);
      toastDone();
      fail(x.message || 'Something went wrong. Try again.');
      btn.disabled = false;
      btn.textContent = saveLabel;
    }
  });

  if (remove) s.q('[data-remove]').onclick = async () => {
    if (await remove()) s.close();
  };
  const first = s.q('[autofocus]');
  if (first) setTimeout(() => first.focus(), 50);
  return s;
}

// ---------- full-screen photo viewer ----------
// list: [{ photo, title, text, actions: [{ label, fn(item, i), danger }] }]
function viewer(list, start = 0) {
  if (!list.length) return;
  let i = Math.max(0, Math.min(start, list.length - 1));
  const el = document.createElement('div');
  el.className = 'viewer';
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-modal', 'true');
  document.body.appendChild(el);
  document.body.classList.add('locked');
  const close = () => {
    el.remove();
    if (!document.querySelector('.sheet-wrap, .viewer')) document.body.classList.remove('locked');
  };
  el._close = close;

  function draw() {
    const it = list[i];
    el.innerHTML = `<button class="icon-btn v-close" aria-label="Close">×</button>
      <div class="v-stage">${list.length > 1 ? `<button class="v-nav prev" aria-label="Previous">‹</button>` : ''}
        <img src="${esc(it.photo.url)}" alt="${esc(it.title || '')}">
        ${list.length > 1 ? `<button class="v-nav next" aria-label="Next">›</button>` : ''}</div>
      <div class="v-info">
        ${it.title ? `<p class="v-title">${esc(it.title)}</p>` : ''}
        ${it.text ? `<p class="v-text">${esc(it.text)}</p>` : ''}
        ${it.sub ? `<p class="v-sub">${it.sub}</p>` : ''}
        ${list.length > 1 ? `<p class="v-count">${i + 1} of ${list.length}</p>` : ''}
        <div class="v-actions">${(it.actions || []).map((a, k) => `<button class="btn small ${a.danger ? 'ghost-light danger' : 'ghost-light'}" data-k="${k}">${a.label}</button>`).join('')}</div>
      </div>`;
  }
  const go = d => { i = (i + d + list.length) % list.length; draw(); };
  el.addEventListener('click', async e => {
    if (e.target.closest('.v-close')) return close();
    if (e.target.closest('.prev')) return go(-1);
    if (e.target.closest('.next')) return go(1);
    const b = e.target.closest('[data-k]');
    if (b) {
      const a = list[i].actions[+b.dataset.k];
      const r = await a.fn(list[i], i);
      if (r === 'close') close();
      else if (r && r.item) { list[i] = r.item; draw(); }
    }
  });
  let x0 = null;
  el.addEventListener('touchstart', e => { x0 = e.touches[0].clientX; }, { passive: true });
  el.addEventListener('touchend', e => {
    if (x0 == null || list.length < 2) return;
    const dx = e.changedTouches[0].clientX - x0;
    if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1);
    x0 = null;
  });
  el.tabIndex = -1;
  el.addEventListener('keydown', e => { if (e.key === 'ArrowRight') go(1); if (e.key === 'ArrowLeft') go(-1); });
  draw();
  el.focus();
  return { close };
}

// ---------- savings house ----------
// A little farmhouse that fills with sage from the ground up as you save.
let houseN = 0;
function houseSvg(pct) {
  const p = Math.max(0, Math.min(1, pct || 0));
  const id = `hc${++houseN}`;
  const body = 'M34 150V86L100 36l66 50v64z';
  const y = 150 - (150 - 36) * p;
  return `<svg viewBox="0 0 200 162" class="house" role="img" aria-label="${Math.round(p * 100)}% of the goal saved">
    <defs><clipPath id="${id}"><path d="${body}"/></clipPath></defs>
    <rect x="128" y="34" width="15" height="30" fill="var(--wood)" stroke="var(--wood-deep)" stroke-width="2.5"/>
    <path d="${body}" fill="var(--paper)"/>
    <rect x="0" y="${y.toFixed(1)}" width="200" height="162" fill="var(--sage)" clip-path="url(#${id})"/>
    <path d="${body}" fill="none" stroke="var(--wood-deep)" stroke-width="3" stroke-linejoin="round"/>
    <path d="M22 95L100 30l78 65" fill="none" stroke="var(--wood-deep)" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="100" cy="74" r="9" fill="var(--paper)" stroke="var(--wood-deep)" stroke-width="2.5"/>
    <g fill="var(--paper)" stroke="var(--wood-deep)" stroke-width="2.5">
      <rect x="50" y="100" width="24" height="22" rx="2"/><rect x="126" y="100" width="24" height="22" rx="2"/>
    </g>
    <path d="M62 100v22M50 111h24M138 100v22M126 111h24" stroke="var(--wood-deep)" stroke-width="2"/>
    <rect x="88" y="112" width="24" height="38" rx="2" fill="var(--wood)" stroke="var(--wood-deep)" stroke-width="2.5"/>
    <circle cx="106" cy="132" r="1.8" fill="var(--wood-deep)"/>
    <g fill="var(--sage-deep)"><circle cx="30" cy="146" r="9"/><circle cx="41" cy="148" r="7"/><circle cx="170" cy="146" r="9"/><circle cx="159" cy="148" r="7"/></g>
    <path d="M8 151h184" stroke="var(--sage-deep)" stroke-width="3" stroke-linecap="round"/>
  </svg>`;
}

// ---------- hold and drag to rearrange ----------
// Press and hold an item (about half a second) until it lifts, drag it to a
// new spot, let go. A quick tap still works as a tap, and a swipe still
// scrolls. onDrop(ids) gets the new order of data-sort ids.
// While something is being dragged, the screen doesn't redraw (sortingNow).
let sortingNow = false;
function sortable(box, { item, onDrop, signal }) {
  const HOLD_MS = 450, SLOP = 10;
  const opts = { signal };
  let timer = null, start = null, el = null, ghost = null, offset = null, dragging = false, justDragged = false, scroller = null, last = null;
  const items = () => [...box.querySelectorAll(item)];
  const cancelHold = () => { clearTimeout(timer); timer = null; };
  const begin = (t, x, y) => { el = t; start = { x, y }; cancelHold(); timer = setTimeout(pickUp, HOLD_MS); };

  function pickUp() {
    timer = null;
    if (!el || !el.isConnected) return;
    dragging = sortingNow = true;
    const r = el.getBoundingClientRect();
    offset = { x: start.x - r.left, y: start.y - r.top };
    ghost = el.cloneNode(true);
    ghost.classList.add('sort-ghost');
    Object.assign(ghost.style, { left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px` });
    document.body.appendChild(ghost);
    el.classList.add('sort-placeholder');
    box.classList.add('sorting');
    if (navigator.vibrate) navigator.vibrate(10);
    // Near the top or bottom of the screen, the page scrolls along.
    scroller = setInterval(() => {
      if (!last) return;
      const edge = 90;
      if (last.y < edge) window.scrollBy(0, -Math.ceil((edge - last.y) / 6));
      else if (last.y > innerHeight - edge - 70) window.scrollBy(0, Math.ceil((last.y - innerHeight + edge + 70) / 6));
      else return;
      place(last.x, last.y);
    }, 16);
  }

  function place(x, y) {
    const over = document.elementFromPoint(x, y);
    const target = over && over.closest(item);
    if (!target || target === el || !box.contains(target)) return;
    const list = items();
    box.insertBefore(el, list.indexOf(target) > list.indexOf(el) ? target.nextSibling : target);
  }
  function moveTo(x, y) {
    if (!ghost) return;
    last = { x, y };
    ghost.style.left = `${x - offset.x}px`;
    ghost.style.top = `${y - offset.y}px`;
    place(x, y);
  }

  // Always cleans up, even if the touch was interrupted.
  function drop() {
    clearInterval(scroller); scroller = null; last = null;
    if (ghost) ghost.remove();
    ghost = null;
    if (el) el.classList.remove('sort-placeholder');
    box.classList.remove('sorting');
    dragging = sortingNow = false;
    justDragged = true;
    setTimeout(() => { justDragged = false; }, 350);
    Promise.resolve(onDrop(items().map(t => t.dataset.sort)))
      .catch(e => { console.error(e); toast(e.message || 'Couldn’t save the new order.'); })
      .finally(() => { if (typeof pending !== 'undefined' && pending) refresh(); });
  }
  const end = () => { cancelHold(); if (dragging) drop(); };

  // Phone: touch.
  box.addEventListener('touchstart', e => {
    const t = e.target.closest(item);
    if (!t || e.touches.length > 1) return;
    begin(t, e.touches[0].clientX, e.touches[0].clientY);
  }, { passive: true, ...opts });
  box.addEventListener('touchmove', e => {
    const p = e.touches[0];
    if (dragging) { e.preventDefault(); moveTo(p.clientX, p.clientY); return; } // the finger moves the card, not the page
    if (timer && Math.hypot(p.clientX - start.x, p.clientY - start.y) > SLOP) cancelHold(); // it's a scroll
  }, { passive: false, ...opts });
  box.addEventListener('touchend', end, opts);
  box.addEventListener('touchcancel', end, opts);

  // Computer: mouse.
  box.addEventListener('pointerdown', e => {
    if (e.pointerType !== 'mouse' || e.button > 0) return;
    const t = e.target.closest(item);
    if (t) begin(t, e.clientX, e.clientY);
  }, opts);
  window.addEventListener('pointermove', e => {
    if (e.pointerType !== 'mouse') return;
    if (dragging) { e.preventDefault(); moveTo(e.clientX, e.clientY); return; }
    if (timer && Math.hypot(e.clientX - start.x, e.clientY - start.y) > SLOP) cancelHold();
  }, opts);
  window.addEventListener('pointerup', e => { if (e.pointerType === 'mouse') end(); }, opts);

  // The tap that ends a drag doesn't also open the card.
  box.addEventListener('click', e => {
    if (dragging || justDragged) { e.preventDefault(); e.stopPropagation(); }
  }, { capture: true, ...opts });
  box.addEventListener('contextmenu', e => { if (e.target.closest(item)) e.preventDefault(); }, opts);
  box.addEventListener('dragstart', e => e.preventDefault(), opts);
}
