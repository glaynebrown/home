/* Photo prep, all on the phone before anything uploads: a full-size copy
   (2048px) and a thumbnail (600px), both JPEG. A 4 MB iPhone photo ends up
   around 400 KB, which keeps storage near free. */
const Photos = (() => {
  const FULL = { edge: 2048, quality: 0.82 };
  const THUMB = { edge: 600, quality: 0.78 };

  async function load(file) {
    const url = URL.createObjectURL(file);
    try {
      const img = new Image();
      img.src = url;
      await img.decode();
      return img;
    } catch {
      throw new Error(`Couldn’t open "${file.name}". Try a different photo.`);
    } finally {
      // Safe to revoke after decode: the pixels are already loaded.
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
  }

  function shrink(img, { edge, quality }) {
    const scale = Math.min(1, edge / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.round(img.naturalWidth * scale), h = Math.round(img.naturalHeight * scale);
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    canvas.getContext('2d').drawImage(img, 0, 0, w, h);
    return new Promise((resolve, reject) => canvas.toBlob(blob => {
      canvas.width = canvas.height = 0; // frees memory right away on iPhone
      blob ? resolve({ blob, w, h }) : reject(new Error('Couldn’t shrink that photo.'));
    }, 'image/jpeg', quality));
  }

  // -> { full: {blob,w,h}, thumb: {blob,w,h} }
  async function prepare(file) {
    const img = await load(file);
    const full = await shrink(img, FULL);
    const thumb = await shrink(img, THUMB);
    return { full, thumb };
  }

  return { prepare };
})();
