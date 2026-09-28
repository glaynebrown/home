/* The "what does this size feel like?" translator.

   Room sizes can be typed however the plan book writes them:
     14x16   14 x 16   14'6" x 16'   14' 6" x 16' 0"   14-6 x 16   14.5 by 16
   A size is { w, l, area } in feet, with w the shorter side. Plan rooms are
   compared to the rooms in the house you live in now (kind 'room'). */
const Size = (() => {
  function part(s) {
    s = s.trim().toLowerCase().replace(/[’′‘]/g, "'").replace(/[”″“]/g, '"').replace(/''/g, '"');
    let m = s.match(/^(\d+(?:\.\d+)?)\s*(?:'|ft\.?|feet|foot)\s*-?\s*(?:(\d+(?:\.\d+)?)\s*(?:"|in\.?|inch|inches)?)?$/);
    if (m) return +m[1] + (m[2] ? +m[2] / 12 : 0);
    m = s.match(/^(\d+)\s*-\s*(\d+(?:\.\d+)?)\s*(?:"|in)?$/); // 14-6 = 14'6"
    if (m) return +m[1] + +m[2] / 12;
    m = s.match(/^(\d+(?:\.\d+)?)\s*(?:"|in\.?|inches)$/);
    if (m) return +m[1] / 12;
    m = s.match(/^(\d+(?:\.\d+)?)$/);
    if (m) return +m[1];
    return null;
  }

  function parse(str) {
    if (!str) return null;
    const bits = String(str).split(/\s*(?:x|×|\*|by)\s*/i);
    if (bits.length !== 2) return null;
    const a = part(bits[0]), b = part(bits[1]);
    if (!a || !b) return null;
    return { w: Math.min(a, b), l: Math.max(a, b), area: a * b };
  }

  // 14.5 -> 14'6"
  function ft(x) {
    let f = Math.floor(x + 1e-9), i = Math.round((x - f) * 12);
    if (i === 12) { f += 1; i = 0; }
    if (!f) return `${i}"`;
    return i ? `${f}'${i}"` : `${f}'`;
  }
  const dims = d => `${ft(d.w)} × ${ft(d.l)}`;
  const sqft = d => `${Math.round(d.area).toLocaleString('en-US')} sq ft`;

  // Used when you haven't measured your own rooms yet.
  const FALLBACK = [
    { name: 'a parking space', d: parse('9x18'), generic: true },
    { name: 'a one-car garage', d: parse('12x22'), generic: true },
    { name: 'a 10×10 bedroom', d: parse('10x10'), generic: true },
    { name: 'a 12×12 bedroom', d: parse('12x12'), generic: true },
  ];

  // "Living room" -> "your living room"; keeps names like "Nick's office" as typed.
  function label(ref) {
    if (ref.generic) return ref.name;
    let n = ref.name.trim();
    if (/^[A-Z][a-z]/.test(n) && !/[A-Z']/.test(n.slice(1))) n = n.toLowerCase();
    return /^(our|my|the|your)\b/i.test(n) ? n : `your ${n}`;
  }

  // The rooms you measured, as comparison references.
  function refs(rooms) {
    const mine = rooms.map(r => ({ name: r.name, d: parse(r.dims), room: r })).filter(r => r.d);
    return mine.length ? mine : FALLBACK;
  }

  const round5 = x => Math.max(5, Math.round(x / 5) * 5);
  function sentence(d, ref) {
    const r = d.area / ref.d.area, who = label(ref);
    if (r >= 0.93 && r <= 1.07) return `About the same size as ${who}`;
    if (r >= 1.9) return `About ${(Math.round(r * 10) / 10).toString().replace(/\.0$/, '')}× the size of ${who}`;
    if (r > 1) return `About ${round5((r - 1) * 100)}% bigger than ${who}`;
    if (r <= 0.55) return `About ${round5(r * 100)}% of the size of ${who}`;
    return `About ${round5((1 - r) * 100)}% smaller than ${who}`;
  }
  // "2' wider · 1'6" shorter" (short side vs short side, long vs long).
  function sides(d, ref) {
    const say = (diff, more, less) => (Math.abs(diff) < 1 / 24 ? null : `${ft(Math.abs(diff))} ${diff > 0 ? more : less}`);
    const out = [say(d.w - ref.d.w, 'wider', 'narrower'), say(d.l - ref.d.l, 'longer', 'shorter')].filter(Boolean);
    return out.length ? out.join(' · ') : 'Same width and length';
  }

  // Same kind of room if you have one ("Kitchen" -> your kitchen), otherwise
  // the closest in size. -> { ref, text, sides } or null
  const key = s => String(s || '').toLowerCase().replace(/[^a-z ]/g, ' ').replace(/\s+/g, ' ').trim();
  function compare(d, rooms, name) {
    if (!d) return null;
    const list = refs(rooms);
    const n = key(name);
    const same = n && list.find(r => !r.generic && (key(r.name) === n || n.includes(key(r.name)) || key(r.name).includes(n)));
    const ref = same || list.reduce((best, r) => (Math.abs(Math.log(d.area / r.d.area)) < Math.abs(Math.log(d.area / best.d.area)) ? r : best));
    return { ref, text: sentence(d, ref), sides: sides(d, ref) };
  }
  const compareAll = (d, rooms) => refs(rooms).map(ref => ({ ref, text: sentence(d, ref), sides: sides(d, ref) }));

  // Both rooms drawn to scale from the same corner, on a 1-foot grid.
  function overlay(d, ref, names = ['Plan room', 'Now']) {
    const W = 300, H = 200, pad = 12;
    const maxL = Math.max(d.l, ref.d.l), maxW = Math.max(d.w, ref.d.w);
    const s = Math.min((W - pad * 2) / maxL, (H - pad * 2) / maxW);
    const gw = maxL * s, gh = maxW * s;
    const step = s >= 8 ? 1 : 2;
    let grid = '';
    for (let x = step; x < maxL; x += step) grid += `M${(pad + x * s).toFixed(1)} ${pad}v${gh.toFixed(1)}`;
    for (let y = step; y < maxW; y += step) grid += `M${pad} ${(pad + y * s).toFixed(1)}h${gw.toFixed(1)}`;
    return `<svg class="overlay" viewBox="0 0 ${Math.ceil(gw + pad * 2)} ${Math.ceil(gh + pad * 2)}" role="img" aria-label="${esc(names[0])} ${dims(d)} drawn over ${esc(names[1])} ${dims(ref.d)}">
      <path d="${grid}" stroke="var(--line)" stroke-width="1"/>
      <rect x="${pad}" y="${pad}" width="${(d.l * s).toFixed(1)}" height="${(d.w * s).toFixed(1)}" fill="var(--sage)" fill-opacity=".38" stroke="var(--sage-deep)" stroke-width="2.5" rx="2"/>
      <rect x="${pad}" y="${pad}" width="${(ref.d.l * s).toFixed(1)}" height="${(ref.d.w * s).toFixed(1)}" fill="none" stroke="var(--wood)" stroke-width="2.5" stroke-dasharray="7 5" rx="2"/>
    </svg>
    <div class="legend"><span><i class="sw plan"></i>${esc(names[0])} · ${dims(d)}</span><span><i class="sw now"></i>${esc(names[1])} · ${dims(ref.d)}</span></div>`;
  }

  return { parse, ft, dims, sqft, compare, compareAll, overlay, label };
})();
