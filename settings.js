/* Settings.
   - Home page (shared with Nick): the photo and how it sits, the line under
     the title, build cost per sq ft.
   - Your look (just you): palette, custom colors, title and body fonts.
   - You: name, sign out. */
const Settings = (() => {
  const HERO = { x: 50, y: 50, zoom: 1, dark: 0.3, pos: 'bottom' };
  let colorsOpen = false;

  const myLook = () => Look.normalize((get(S.uid) || {}).look);
  function saveLook(l) {
    Look.apply(l);
    Look.cache(l);
    return DB.put(S.uid, { kind: 'person', look: l });
  }

  // ---------- home page photo ----------
  async function pickHero() {
    const [file] = await pickFiles(false);
    if (!file) return;
    const old = settings().heroPhoto;
    toast('Adding photo…', 0);
    try {
      const photo = await DB.upload(await Photos.prepare(file, { full: Photos.HERO }));
      await saveSettings({ heroPhoto: photo, hero: HERO });
      toastDone();
      if (old) DB.dropPhotos([old]);
      adjustHero();
    } catch (e) {
      console.error(e);
      toast(e.message || 'That photo didn’t upload.');
    }
  }

  // Drag to move, pinch / scroll / slider to zoom, darken, title position.
  function adjustHero() {
    const st = settings();
    if (!st.heroPhoto) return;
    const h = { ...HERO, ...(st.hero || {}) };
    const s = sheet('Adjust photo', `<div class="hero-edit">${heroHtml(st, true)}</div>
      <p class="muted small">Drag the photo to move it. Pinch, scroll, or use the slider to zoom.</p>
      <label class="field"><span class="lbl">Zoom</span><input type="range" name="zoom" min="1" max="3" step="0.01" value="${h.zoom}"></label>
      <label class="field"><span class="lbl">Darken (helps the title stand out)</span><input type="range" name="dark" min="0" max="0.7" step="0.01" value="${h.dark}"></label>
      ${fieldHtml({ name: 'pos', label: 'Title', type: 'seg', value: h.pos, options: [['top', 'Top'], ['middle', 'Middle'], ['bottom', 'Bottom']] })}
      <div class="sheet-actions"><button type="button" class="btn ghost" data-reset>Reset</button><span class="grow"></span><button type="button" class="btn" data-save>Save</button></div>`);
    const box = s.q('.hero'), img = s.q('.hero-img'), photo = st.heroPhoto;
    const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
    const draw = () => {
      img.style.cssText = heroImgStyle(h);
      box.style.setProperty('--dark', h.dark);
      box.className = `hero has-photo pos-${h.pos}`;
      s.q('[name=zoom]').value = h.zoom;
      s.q('[name=dark]').value = h.dark;
      const r = s.q(`input[name=pos][value="${h.pos}"]`);
      if (r) r.checked = true;
    };
    // How far the photo reaches past the frame, so a drag moves it 1:1.
    const overflow = () => {
      const W = box.clientWidth, H = box.clientHeight;
      const k = Math.max(W / (photo.w || W), H / (photo.h || H)) * h.zoom;
      return [(photo.w || W) * k - W, (photo.h || H) * k - H];
    };
    const pts = new Map();
    let pinch = null;
    const spread = () => { const [a, b] = [...pts.values()]; return Math.hypot(a.x - b.x, a.y - b.y) || 1; };
    box.addEventListener('pointerdown', e => {
      box.setPointerCapture(e.pointerId);
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      pinch = pts.size === 2 ? { d: spread(), zoom: h.zoom } : null;
    });
    box.addEventListener('pointermove', e => {
      const prev = pts.get(e.pointerId);
      if (!prev) return;
      const cur = { x: e.clientX, y: e.clientY };
      pts.set(e.pointerId, cur);
      if (pts.size === 2 && pinch) h.zoom = clamp(pinch.zoom * spread() / pinch.d, 1, 3);
      else if (pts.size === 1) {
        const [ox, oy] = overflow();
        if (ox > 0.5) h.x = clamp(h.x - (cur.x - prev.x) / ox * 100, 0, 100);
        if (oy > 0.5) h.y = clamp(h.y - (cur.y - prev.y) / oy * 100, 0, 100);
      }
      draw();
    });
    const lift = e => { pts.delete(e.pointerId); pinch = null; };
    box.addEventListener('pointerup', lift);
    box.addEventListener('pointercancel', lift);
    box.addEventListener('wheel', e => { e.preventDefault(); h.zoom = clamp(h.zoom - e.deltaY * 0.002, 1, 3); draw(); }, { passive: false });
    s.q('[name=zoom]').addEventListener('input', e => { h.zoom = +e.target.value; draw(); });
    s.q('[name=dark]').addEventListener('input', e => { h.dark = +e.target.value; draw(); });
    s.qa('input[name=pos]').forEach(r => r.addEventListener('change', () => { h.pos = r.value; draw(); }));
    s.q('[data-reset]').onclick = () => { Object.assign(h, HERO); draw(); };
    s.q('[data-save]').onclick = async () => {
      const round = v => Math.round(v * 100) / 100;
      await saveSettings({ hero: { x: round(h.x), y: round(h.y), zoom: round(h.zoom), dark: round(h.dark), pos: h.pos } });
      s.close();
      toast('Photo saved');
    };
  }

  // ---------- your look ----------
  function lookHtml() {
    const l = myLook(), c = Look.colorsOf(l);
    const custom = Object.keys(l.colors).length > 0;
    const pal = p => `<button class="pal${l.preset === p.id ? ' on' : ''}" data-act="preset" data-id="${p.id}" style="background:${p.c.bg};color:${p.c.ink}" aria-pressed="${l.preset === p.id}">
      <span class="dots">${[p.c.primary, p.c.accent, p.c.wood, Look.mix(p.c.bg, p.c.wood, 0.28), p.c.paper].map(x => `<i style="background:${x}"></i>`).join('')}</span>
      ${esc(p.name)}${l.preset === p.id && custom ? ' <small>(customized)</small>' : ''}</button>`;
    const row = ([key, label]) => `<div class="color-row">
      <input type="color" data-slot="${key}" value="${c[key].toLowerCase()}" aria-label="${label} color">
      <span>${label}</span>
      <input class="hex" data-hex="${key}" value="${c[key]}" maxlength="7" autocapitalize="characters" autocomplete="off" aria-label="${label} hex code">
      <button class="icon-btn" data-act="resetColor" data-slot="${key}" title="Back to the palette’s color" aria-label="Reset ${label}"${l.colors[key] ? '' : ' disabled'}>↺</button>
    </div>`;
    const font = (name, kindOf, sample) => `<button class="font-opt ${kindOf}${l[kindOf] === name ? ' on' : ''}" data-act="font" data-kind="${kindOf}" data-name="${esc(name)}" aria-pressed="${l[kindOf] === name}">
      <span class="sample" style="font-family:'${esc(name)}'">${sample}</span><small>${esc(name)}</small></button>`;
    return `<section class="card pad stack set-card">
      <div><h2>Your look</h2><p class="muted">Just for you. Nick picks his own.</p></div>
      <div><p class="lbl">Palette</p><div class="palettes">${Look.PRESETS.map(pal).join('')}</div></div>
      <details class="cust"${colorsOpen ? ' open' : ''}><summary>Customize colors</summary>
        <div class="color-rows">${Look.SLOTS.map(row).join('')}</div>
      </details>
      <div><p class="lbl">Title font</p><div class="fonts">${Look.TITLE_FONTS.map(([n]) => font(n, 'title', 'The Brown Family Home')).join('')}</div></div>
      <div><p class="lbl">Body font</p><div class="fonts">${Look.BODY_FONTS.map(([n]) => font(n, 'body', 'Kitchen · 3 photos · 13.16 acres')).join('')}</div></div>
      <button class="btn ghost" data-act="resetLook">Back to the original look</button>
    </section>`;
  }

  Views.settings = {
    nav: 'home',
    render() {
      const st = settings(), me = get(S.uid) || {};
      return `${pageTop('Settings', { back: ['#/', 'Home'] })}
      <section class="card pad stack set-card">
        <div><h2>Home page</h2><p class="muted">Shared: Nick sees these too.</p></div>
        <div class="set-row"><div><p class="lbl">Photo behind “The Brown Family Home”</p><p>${st.heroPhoto ? 'Your photo' : 'Farmhouse drawing'}</p></div>
          <div class="set-btns"><button class="btn small ghost" data-act="heroPick">${st.heroPhoto ? 'Change' : 'Choose photo'}</button>
          ${st.heroPhoto ? '<button class="btn small" data-act="heroAdjust">Adjust</button><button class="btn small ghost danger" data-act="heroRemove">Remove</button>' : ''}</div></div>
        <div class="set-row"><div><p class="lbl">Line under the title</p><p>${esc(st.subtitle || 'None')}</p></div><button class="btn small ghost" data-act="subtitle">Change</button></div>
        <div class="set-row"><div><p class="lbl">Build cost per sq ft</p><p>${st.costPerSqft ? `${money(st.costPerSqft)} (for rough plan estimates)` : 'Not set'}</p></div><button class="btn small ghost" data-act="goal">Change</button></div>
      </section>
      ${lookHtml()}
      <section class="card pad stack set-card">
        <div class="set-row"><div><p class="lbl">Your name</p><p>${esc(me.name || 'Not set')}</p></div><button class="btn small ghost" data-act="name">Change</button></div>
        <p class="muted">${DB.demo ? 'Sample mode: nothing is saved.' : `Signed in as ${esc(me.email || S.email || '')}`}</p>
        <button class="btn ghost" data-act="signout">${DB.demo ? 'Leave sample mode' : 'Sign out'}</button>
      </section>`;
    },
    after(root) {
      // Every font choice, so each preview shows in its own font.
      Look.useFonts('look-fonts-all', [...Look.TITLE_FONTS, ...Look.BODY_FONTS].map(f => f[0]));
      const details = root.querySelector('details.cust');
      details.addEventListener('toggle', () => { colorsOpen = details.open; });
      const withColor = (key, val) => { const l = myLook(); l.colors[key] = val.toUpperCase(); return l; };
      root.querySelectorAll('[data-slot]').forEach(inp => {
        if (inp.type !== 'color') return;
        const hexBox = root.querySelector(`[data-hex="${inp.dataset.slot}"]`);
        inp.addEventListener('input', () => { Look.apply(withColor(inp.dataset.slot, inp.value)); hexBox.value = inp.value.toUpperCase(); });
        inp.addEventListener('change', () => saveLook(withColor(inp.dataset.slot, inp.value)));
      });
      root.querySelectorAll('[data-hex]').forEach(inp => inp.addEventListener('change', () => {
        let v = inp.value.trim();
        if (!v.startsWith('#')) v = `#${v}`;
        if (!Look.isHex(v)) { toast('Use a 6-digit color code, like #5E6E51'); inp.value = Look.colorsOf(myLook())[inp.dataset.hex]; return; }
        saveLook(withColor(inp.dataset.hex, v));
      }));
    },
    acts: {
      heroPick: () => pickHero(),
      heroAdjust: () => adjustHero(),
      async heroRemove() {
        if (!(await ask('Go back to the farmhouse drawing?', { ok: 'Remove photo' }))) return;
        const old = settings().heroPhoto;
        await saveSettings({ heroPhoto: null, hero: null });
        if (old) DB.dropPhotos([old]);
      },
      subtitle() {
        form({
          title: 'Line under the title', fields: [{ name: 'subtitle', label: 'Shown under “The Brown Family Home” (leave blank for none)', value: settings().subtitle || '', placeholder: 'our homestead, someday' }],
          save: v => saveSettings({ subtitle: v.subtitle }),
        });
      },
      goal: () => Money.editGoal(),
      name: () => askName(),
      preset: el => saveLook({ ...myLook(), preset: el.dataset.id, colors: {} }),
      resetColor(el) { const l = myLook(); delete l.colors[el.dataset.slot]; return saveLook(l); },
      font: el => saveLook({ ...myLook(), [el.dataset.kind]: el.dataset.name }),
      async resetLook() {
        if (!(await ask('Go back to the Cottage colors and the original fonts?', { ok: 'Reset', danger: false, title: 'Reset your look?' }))) return;
        await saveLook({ ...Look.DEFAULT, colors: {} });
      },
      async signout() {
        if (!DB.demo && !(await ask('You’ll need your email and password to sign back in.', { ok: 'Sign out', danger: false, title: 'Sign out?' }))) return;
        await DB.signOut();
      },
    },
  };

  return { adjustHero };
})();
