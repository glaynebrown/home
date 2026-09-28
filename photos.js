/* Photo prep, all on the phone before anything uploads: a full-size copy
   (2560px, or bigger for the home page photo) and a thumbnail (800px), both
   JPEG. A 5 MB iPhone photo ends up well under 1 MB, which keeps storage near free.

   Sharpness: iPhone Safari can quietly decode very large photos at a smaller
   size when they're loaded as a plain image, so the photo is read with
   createImageBitmap when possible (full resolution), and shrunk in halves
   with high-quality smoothing instead of one big jump. */
const Photos = (() => {
  const FULL = { edge: 2560, quality: 0.86 };
  const THUMB = { edge: 800, quality: 0.8 };

  function loadImg(file) {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.src = url;
    return img.decode()
      .then(() => img)
      .catch(() => { throw new Error(`Couldn’t open "${file.name || 'that photo'}". Try a different photo.`); })
      .finally(() => setTimeout(() => URL.revokeObjectURL(url), 1000));
  }

  // -> { src, w, h, done() }
  async function load(file) {
    const img = await loadImg(file); // always right-side up, even if smaller inside
    if (self.createImageBitmap) {
      try {
        const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
        // Use the full-size copy only if it's turned the same way as the photo.
        const same = Math.abs(bmp.width / bmp.height - img.naturalWidth / img.naturalHeight) < 0.02;
        if (same && bmp.width >= img.naturalWidth * 0.98) return { src: bmp, w: bmp.width, h: bmp.height, done: () => bmp.close() };
        bmp.close();
      } catch { /* fall back to the plain image */ }
    }
    return { src: img, w: img.naturalWidth, h: img.naturalHeight, done: () => {} };
  }

  function canvas(w, h) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const ctx = c.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    return [c, ctx];
  }

  function shrink(pic, { edge, quality }) {
    const scale = Math.min(1, edge / Math.max(pic.w, pic.h));
    const w = Math.round(pic.w * scale), h = Math.round(pic.h * scale);
    let src = pic.src, sw = pic.w, sh = pic.h, step = null;
    while (sw / 2 >= w) {
      const [c, ctx] = canvas(Math.round(sw / 2), Math.round(sh / 2));
      ctx.drawImage(src, 0, 0, c.width, c.height);
      if (step) step.width = step.height = 0;
      step = src = c; sw = c.width; sh = c.height;
    }
    const [out, ctx] = canvas(w, h);
    ctx.drawImage(src, 0, 0, w, h);
    if (step) step.width = step.height = 0;
    return new Promise((resolve, reject) => out.toBlob(blob => {
      out.width = out.height = 0; // frees memory right away on iPhone
      blob ? resolve({ blob, w, h }) : reject(new Error('Couldn’t shrink that photo.'));
    }, 'image/jpeg', quality));
  }

  // opts.full overrides the full-size settings (the home page photo is bigger).
  // -> { full: {blob,w,h}, thumb: {blob,w,h} }
  async function prepare(file, opts = {}) {
    const pic = await load(file);
    try {
      const full = await shrink(pic, opts.full || FULL);
      const thumb = await shrink(pic, THUMB);
      return { full, thumb };
    } finally {
      pic.done();
    }
  }

  return { prepare, HERO: { edge: 3200, quality: 0.9 } };
})();
