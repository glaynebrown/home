/* All data access lives here, so the screens only deal in plain objects.

   Everything is shared by the two of you, in one Firestore collection:
     things/{id}   { kind, t (created), by (uid), ...fields }
       kind 'settings'  (id 'settings') { seeded, goal, costPerSqft, subtitle, heroPhoto }
       kind 'person'    (id = uid)      { name }
       kind 'board'     a room board    { name, order, cover (pin id) }
       kind 'pin'       a board photo   { board, photo, caption, link, fav }
       kind 'plan'      a floor plan    { name, source, link, sqft, beds, baths, stories,
                                          hearts, loves, dislikes, photos: [], rooms: [{ name, dims }] }
       kind 'room'      a room in the house you live in now { name, dims, photo }
       kind 'deposit'   savings         { amount (negative = took out), note, date 'YYYY-MM-DD' }
       kind 'upgrade'   now vs. later   { name, room, nowText, nowPhoto, laterText, laterPhoto,
                                          cost, prep, prepNote, done }
       kind 'land'      a property      { name, place, link, acres, price, status, hearts,
                                          notes, photos: [], checks: { key: 'yes'|'no' } }
       kind 'link'      a website       { name, url, category, note, fav }
       kind 'budget'    (id 'budget')   build budget, see budget.js
       kind 'addition'  a section to build later, see additions.js
       (a board with .addition is a future room in that addition)

   A photo is { path, thumbPath, url, thumbUrl, w, h }; files live in Storage
   under photos/. When firebase-config.js hasn't been filled in yet, the app
   can run in "sample mode" instead (demo.js): same functions, in memory. */

// Every photo a thing holds, so deleting it can clean up Storage too.
const photosOf = x => [x.photo, x.nowPhoto, x.laterPhoto, x.heroPhoto, ...(x.photos || [])].filter(Boolean);

const Store = (() => {
  const configured = typeof firebaseConfig !== 'undefined' && !/PASTE/.test(firebaseConfig.apiKey);
  if (!configured) return { configured: false };

  firebase.initializeApp(firebaseConfig);
  const auth = firebase.auth();
  const db = firebase.firestore();
  const storage = firebase.storage();

  db.enablePersistence({ synchronizeTabs: true }).catch(err => {
    console.warn('Firestore offline persistence unavailable:', err.code);
  });

  // Offline, Firestore saves on the phone right away and syncs later; don't
  // make the screen wait for the server in that case.
  const write = p => {
    if (navigator.onLine) return p;
    p.catch(e => console.error('Offline save failed to sync', e));
    return Promise.resolve();
  };
  function needOnline(what) {
    if (!navigator.onLine) throw new Error(`You’re offline. ${what} needs an internet connection.`);
  }

  const things = () => db.collection('things');
  const withId = d => ({ id: d.id, ...d.data() });
  const uid = () => auth.currentUser.uid;

  const ignoreMissing = e => { if (e.code !== 'storage/object-not-found') throw e; };
  const removeFile = path => path ? storage.ref(path).delete().catch(ignoreMissing) : Promise.resolve();

  async function putBlob(path, blob) {
    const ref = storage.ref(path);
    await ref.put(blob, { contentType: 'image/jpeg', cacheControl: 'private, max-age=31536000' });
    return ref.getDownloadURL();
  }

  return {
    configured: true,
    demo: false,

    onAuth: cb => auth.onAuthStateChanged(cb),
    signIn: (email, password) => auth.signInWithEmailAndPassword(email, password),
    signOut: async () => {
      await auth.signOut();
      if (self.caches) await caches.delete('home-photos-v1').catch(() => {});
    },
    resetPassword: email => auth.sendPasswordResetEmail(email),

    // cb(list, fromCache): fromCache is true while the phone's saved copy is
    // all there is (so first-time setup waits for the real data).
    watch: (cb, onError) => things().onSnapshot({ includeMetadataChanges: true },
      snap => cb(snap.docs.map(withId), snap.metadata.fromCache), onError),

    async add(data) {
      const ref = things().doc();
      await write(ref.set({ ...data, t: Date.now(), by: uid() }));
      return ref.id;
    },
    // Creates or merges into a thing with a known id (settings, people).
    put: (id, data) => write(things().doc(id).set(data, { merge: true })),
    update: (id, patch) => write(things().doc(id).update(patch)),
    async remove(item) {
      await write(things().doc(item.id).delete());
      await this.dropPhotos(photosOf(item));
    },
    // Several at once (a board and all its photos).
    async removeMany(list) {
      for (let k = 0; k < list.length; k += 400) {
        const batch = db.batch();
        list.slice(k, k + 400).forEach(x => batch.delete(things().doc(x.id)));
        await write(batch.commit());
      }
      await this.dropPhotos(list.flatMap(photosOf));
    },

    // prepared = output of Photos.prepare(). Unique names so edits never collide.
    async upload(prepared) {
      needOnline('Adding photos');
      const base = `photos/${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const [url, thumbUrl] = await Promise.all([
        putBlob(`${base}.jpg`, prepared.full.blob),
        putBlob(`${base}-thumb.jpg`, prepared.thumb.blob),
      ]);
      return { path: `${base}.jpg`, thumbPath: `${base}-thumb.jpg`, url, thumbUrl, w: prepared.full.w, h: prepared.full.h };
    },
    // Reads a listing link through the helper in functions/index.js.
    async preview(url) {
      needOnline('Reading a listing');
      const call = firebase.app().functions('us-east1').httpsCallable('listingPreview', { timeout: 45000 });
      try {
        return (await call({ url })).data;
      } catch (e) {
        throw new Error(e.code === 'functions/internal' || !e.message ? 'Couldn’t read that listing.' : e.message);
      }
    },
    dropPhotos: list => Promise.all(list.flatMap(p => [removeFile(p.path), removeFile(p.thumbPath)])).catch(console.error),
  };
})();
