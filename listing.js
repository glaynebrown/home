/* Filling in a new property from a listing.

   1. Paste the link -> the listingPreview helper (functions/index.js) reads the
      listing: address, price, description, main photo.
   2. If the site won't share, the link itself often holds the address
      (Redfin and Zillow links do).
   3. Backup: paste the listing's text, and the price, acres and place are
      picked out of it.
   Acres and checklist hints ("already perced", "existing well") come from the
   description text either way. Everything lands in the form to check first. */
const Listing = (() => {
  const NUM = String.raw`(\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?)`;
  const toNum = s => Number(String(s).replace(/,/g, ''));

  function acresIn(text) {
    const m = text.match(new RegExp(`${NUM}\\s*(?:\\+/-|±|\\+/−)?\\s*(?:[a-z-]+\\s+){0,2}acres?\\b`, 'i'))
      || text.match(new RegExp(`acre(?:s|age)?\\s*[:\\-]?\\s*${NUM}`, 'i'));
    if (m) return toNum(m[1]);
    const lot = text.match(new RegExp(`lot(?:\\s+size)?\\s*[:\\-]?\\s*${NUM}\\s*(?:sq\\.?\\s*ft|sqft|square\\s+feet)`, 'i'));
    return lot ? Math.round(toNum(lot[1]) / 43560 * 100) / 100 : null;
  }

  function priceIn(text) {
    const m = text.match(/(?:list(?:ing)?\s+)?price\s*[:\-]?\s*\$\s?(\d{1,3}(?:,\d{3})+|\d{4,})/i)
      || text.match(/\$\s?(\d{1,3}(?:,\d{3})+)(?!\s*\/\s*(?:mo|month|acre))/);
    return m ? toNum(m[1]) : null;
  }

  // "1 Wesbey Dr, Louisa, VA 23093" -> name + place
  function addressIn(text) {
    const m = text.match(/(\d+[A-Za-z0-9 .#'-]{2,40}?),\s*([A-Za-z .'-]{2,30}),\s*([A-Z]{2})\s*(\d{5})?/);
    return m ? { street: m[1].trim(), city: m[2].trim(), state: m[3], zip: m[4] || '' } : null;
  }
  const countyIn = text => (text.match(/\b([A-Z][a-zA-Z]+(?:\s[A-Z][a-zA-Z]+)?)\s+County\b/) || [])[1] || '';

  // Checklist hints. Only ever marks "yes"; you confirm them on the property page.
  const HINTS = [
    ['perc', /\bperc(?:ed|\s+(?:test\s+)?(?:on\s+file|approved|passed|completed?))\b|\bperked\b|approved\s+perc|passed\s+perc|perc\s+(?:test\s+)?(?:has\s+been\s+)?(?:done|approved)/i, /\bno\s+perc|perc\s+(?:failed|not)|not\s+perc/i],
    ['water', /(?:existing|drilled|private)\s+well\b|\bwell\s+(?:on\s+site|in\s+place|already)/i, /no\s+well/i],
    ['power', /(?:electric(?:ity)?|power)\s+(?:is\s+)?(?:available|at\s+the\s+road|on\s+site|on\s+(?:the\s+)?property|nearby|already)/i, /no\s+(?:electric|power)/i],
    ['road', /road\s+frontage|frontage\s+on|state[- ]maintained\s+road|paved\s+road/i, /no\s+road\s+frontage|landlocked/i],
    ['flood', /not\s+in\s+(?:a\s+)?flood\s*(?:zone|plain)|no\s+flood/i, null],
  ];
  const HINT_NAMES = { perc: 'Perc test', water: 'Water / well', power: 'Power nearby', road: 'Road access', flood: 'Not in a flood zone' };
  function checksIn(text) {
    const out = {};
    HINTS.forEach(([key, yes, no]) => { if (yes.test(text) && !(no && no.test(text))) out[key] = 'yes'; });
    return out;
  }

  // Addresses written into the link itself.
  function fromUrl(link) {
    let u;
    try { u = new URL(link); } catch { return {}; }
    const title = s => decodeURIComponent(s).replace(/-/g, ' ').replace(/\s+/g, ' ').trim();
    let m = u.pathname.match(/^\/([A-Z]{2})\/([^/]+)\/(.+)-(\d{5})\/home\//); // Redfin
    if (m) return { name: title(m[3]), place: `${title(m[2])}, ${m[1]} ${m[4]}` };
    m = u.pathname.match(/\/homedetails\/(.+)-([A-Z]{2})-(\d{5})\//); // Zillow
    if (m) return { name: title(m[1]), place: `${m[2]} ${m[3]}` };
    return {};
  }

  // Pulls the form values out of whatever we got. -> prefill for the land form
  function build({ link = '', title = '', text = '', price = null, address = null, extra = '' }) {
    const all = `${title}\n${text}\n${extra}`;
    const addr = address && address.street ? address : addressIn(all);
    const county = countyIn(all);
    const byUrl = fromUrl(link);
    const place = addr && addr.city ? `${addr.city}, ${addr.state} ${addr.zip}`.trim() : byUrl.place || (county ? `${county} County` : '');
    const mls = (all.match(/MLS\s*#?\s*:?\s*([A-Z0-9-]{5,})/i) || [])[1];
    return {
      link,
      name: (addr && addr.street) || byUrl.name || title.split(/[|,]/)[0].trim() || '',
      place: county && !place.includes(county) ? `${place}${place ? ' · ' : ''}${county} County` : place,
      acres: acresIn(all),
      price: price || priceIn(all),
      notes: [text.trim(), mls && `MLS# ${mls}`].filter(Boolean).join('\n\n'),
      checks: checksIn(all),
    };
  }

  const blobOf = p => new Blob([Uint8Array.from(atob(p.data), c => c.charCodeAt(0))], { type: p.type });

  // The first step of "+ Property": link, pasted text, or type it in.
  function start() {
    const s = sheet('New property', `<p class="intro">Paste the listing link and we’ll fill in what we can. You check everything before it saves.</p>
      <label class="field"><span class="lbl">Listing link</span>
        <input name="url" inputmode="url" autocapitalize="off" autocorrect="off" placeholder="redfin.com/…"></label>
      <button type="button" class="btn" data-fetch>Fill in from link</button>
      <p class="form-err" hidden></p>
      <details class="paste"><summary>Or paste the listing text</summary>
        <p class="muted small">On the listing, select all the text, copy it, and paste it here.</p>
        <textarea name="text" rows="6" placeholder="Paste here"></textarea>
        <button type="button" class="btn ghost" data-text>Fill in from text</button>
      </details>
      <button type="button" class="linkish" data-skip>Skip, I’ll type it in</button>`);
    const input = s.q('[name=url]'), err = s.q('.form-err'), go = s.q('[data-fetch]'), skip = s.q('[data-skip]');
    setTimeout(() => input.focus(), 50);
    const link = () => fixUrl(input.value);
    const open = pre => { s.close(); Land.form(null, pre); };

    go.onclick = async () => {
      err.hidden = true;
      if (!domain(link())) { err.textContent = 'Paste a listing link first.'; err.hidden = false; return; }
      go.disabled = true; go.textContent = 'Reading the listing…';
      try {
        const r = await DB.preview(link());
        const pre = build({ link: r.url || link(), title: r.title, text: r.description, price: r.price, address: r.address, extra: r.ogDescription });
        if (r.site) pre.notes += `${pre.notes ? '\n\n' : ''}From ${r.site}`;
        if (r.photo) pre.photoBlob = blobOf(r.photo);
        open(pre);
      } catch (e) {
        console.error(e);
        go.disabled = false; go.textContent = 'Fill in from link';
        err.textContent = `${e.message || 'Couldn’t read that listing.'} You can paste the listing text below, or continue with just the link.`;
        err.hidden = false;
        s.q('details.paste').open = true;
        skip.textContent = 'Continue with just the link';
      }
    };
    s.q('[data-text]').onclick = () => {
      const text = s.q('[name=text]').value;
      if (!text.trim()) { err.textContent = 'Paste the listing text first.'; err.hidden = false; return; }
      open(build({ link: link(), text }));
    };
    skip.onclick = () => open(link() && domain(link()) ? { link: link(), ...fromUrl(link()) } : {});
  }

  return { start, build, HINT_NAMES };
})();
