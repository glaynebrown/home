/* Your look: the app's colors and fonts, chosen in Settings.

   Each person has their own (Nick's picks never change yours). It's saved on
   your person record, so your phone and computer match, and on this device, so
   it shows the moment the app opens. Loaded in <head>, before the page draws.

   A palette is six colors; the in-between shades (borders, soft fills, muted
   text) are mixed from those six, so any combination still hangs together. */
const Look = (() => {
  const PRESETS = [
    { id: 'cottage', name: 'Cottage', c: { bg: '#FAF6EF', paper: '#FFFDF9', primary: '#5E6E51', accent: '#B98A72', ink: '#3D362F', wood: '#A57E58' } },
    { id: 'farmhouse', name: 'Modern farmhouse', c: { bg: '#F6F5F2', paper: '#FFFFFF', primary: '#2E2E2C', accent: '#B08968', ink: '#1F1F1D', wood: '#8A6A4F' } },
    { id: 'earthy', name: 'Earthy homestead', c: { bg: '#F6EEE4', paper: '#FFFBF6', primary: '#66733F', accent: '#C0674A', ink: '#3B2F27', wood: '#8C5A3C' } },
    { id: 'airy', name: 'Light & airy', c: { bg: '#FCFBF8', paper: '#FFFFFF', primary: '#6B7B70', accent: '#D2A29C', ink: '#4A4845', wood: '#B7A38C' } },
    { id: 'blue', name: 'Dusty blue', c: { bg: '#F4F6F5', paper: '#FFFFFF', primary: '#4D6B7F', accent: '#C98B86', ink: '#2C3A43', wood: '#9C8069' } },
  ];
  const SLOTS = [['bg', 'Background'], ['paper', 'Cards'], ['primary', 'Buttons & headings'], ['accent', 'Hearts & stars'], ['ink', 'Text'], ['wood', 'Wood trim']];
  // [name, size adjustment (fonts run bigger or smaller), fallback, weights]
  const TITLE_FONTS = [
    ['Cormorant Garamond', 1, 'Georgia, serif', '500;600;700'],
    ['Playfair Display', 0.86, 'Georgia, serif', '500;600;700'],
    ['Lora', 0.9, 'Georgia, serif', '500;600;700'],
    ['Libre Baskerville', 0.8, 'Georgia, serif', '400;700'],
    ['Dancing Script', 1.08, 'cursive', '500;600;700'],
    ['Josefin Sans', 0.88, 'system-ui, sans-serif', '500;600;700'],
  ];
  const BODY_FONTS = [
    ['Nunito Sans', 'system-ui, sans-serif', null], // already loaded by index.html
    ['Lato', 'system-ui, sans-serif', '400;700'],
    ['Source Sans 3', 'system-ui, sans-serif', '400;600;700'],
    ['Lora', 'Georgia, serif', '400;600;700'],
  ];
  const DEFAULT = { preset: 'cottage', colors: {}, title: 'Cormorant Garamond', body: 'Nunito Sans' };
  const KEY = 'home-look';

  // ----- color math -----
  const rgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
  const hex = a => '#' + a.map(v => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('').toUpperCase();
  const mix = (a, b, t) => { const x = rgb(a), y = rgb(b); return hex(x.map((v, i) => v + (y[i] - v) * t)); };
  const lum = h => {
    const [r, g, b] = rgb(h).map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const contrast = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };
  const isHex = s => /^#[0-9a-f]{6}$/i.test(s || '');

  const normalize = l => ({ ...DEFAULT, ...(l || {}), colors: { ...((l && l.colors) || {}) } });
  const presetOf = l => PRESETS.find(p => p.id === l.preset) || PRESETS[0];
  const colorsOf = l => ({ ...presetOf(l).c, ...Object.fromEntries(Object.entries(l.colors).filter(([, v]) => isHex(v))) });

  function vars(l) {
    const c = colorsOf(l);
    let muted = mix(c.ink, c.bg, 0.3);
    for (let t = 0.25; contrast(muted, c.bg) < 4.5 && t >= 0; t -= 0.05) muted = mix(c.ink, c.bg, t);
    const onPrimary = contrast('#FFFFFF', c.primary) >= 4.5 ? '#FFFFFF' : (contrast(c.ink, c.primary) > contrast('#FFFFFF', c.primary) ? c.ink : '#FFFFFF');
    const title = TITLE_FONTS.find(f => f[0] === l.title) || TITLE_FONTS[0];
    const body = BODY_FONTS.find(f => f[0] === l.body) || BODY_FONTS[0];
    return {
      '--bg': c.bg, '--paper': c.paper, '--ink': c.ink, '--sage-deep': c.primary, '--clay': c.accent, '--wood': c.wood,
      '--cream': mix(c.bg, c.wood, 0.1), '--sand': mix(c.bg, c.wood, 0.28), '--line': mix(c.bg, c.wood, 0.16),
      '--sage': mix(c.primary, c.bg, 0.45), '--sage-soft': mix(c.bg, c.primary, 0.16),
      '--wood-deep': mix(c.wood, c.ink, 0.45), '--taupe': mix(c.ink, c.bg, 0.4), '--muted': muted,
      '--on-primary': onPrimary,
      '--tint-warm': mix(c.paper, c.wood, 0.1), '--tint-good': mix(c.paper, c.primary, 0.08), '--tint-bad': mix(c.paper, '#A4493D', 0.07),
      '--serif': `'${title[0]}', ${title[2]}`, '--sans': `'${body[0]}', ${body[1]}`, '--ts': String(title[1]),
    };
  }

  // Google Fonts for the chosen fonts (or every choice, for the Settings previews).
  function fontsUrl(names) {
    const fams = names.map(n => {
      const f = TITLE_FONTS.find(x => x[0] === n) || BODY_FONTS.find(x => x[0] === n);
      const w = f && (f.length === 4 ? f[3] : f[2]);
      return f && w && n !== 'Cormorant Garamond' ? `family=${n.replace(/ /g, '+')}:wght@${w}` : null;
    }).filter(Boolean);
    return fams.length ? `https://fonts.googleapis.com/css2?${[...new Set(fams)].join('&')}&display=swap` : null;
  }
  function useFonts(id, names) {
    const url = fontsUrl(names);
    let link = document.getElementById(id);
    if (!url) { if (link) link.remove(); return; }
    if (!link) { link = document.createElement('link'); link.rel = 'stylesheet'; link.id = id; document.head.appendChild(link); }
    if (link.href !== url) link.href = url;
  }

  let applied = '';
  function apply(l) {
    l = normalize(l);
    const v = vars(l);
    const root = document.documentElement.style;
    Object.entries(v).forEach(([k, val]) => root.setProperty(k, val));
    useFonts('look-fonts', [l.title, l.body]);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = v['--bg'];
    applied = JSON.stringify(l);
  }
  function cache(l) { try { localStorage.setItem(KEY, JSON.stringify(normalize(l))); } catch {} }
  function cached() { try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { return null; } }

  // Called whenever data arrives: use what's saved on your person record.
  function sync(person) {
    if (!person || !person.look) return;
    const l = normalize(person.look);
    if (JSON.stringify(l) === applied) return;
    apply(l);
    cache(l);
  }

  // Before anything draws.
  apply(cached());

  return { PRESETS, SLOTS, TITLE_FONTS, BODY_FONTS, DEFAULT, normalize, presetOf, colorsOf, apply, cache, sync, useFonts, isHex, mix };
})();
