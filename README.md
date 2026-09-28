# Home: The Brown Family Home

A shared planner for our dream homestead, for Gabriella and Nick:

- **Room boards**: a photo board for each room (Kitchen, Front porch, Barn & homestead…)
- **Floor plans**: photos of plan-book pages, hearts, what we love / not so much,
  room sizes, and a rough build estimate (sq ft × cost per sq ft)
- **Size check**: "what does this size feel like?" Compares any plan room to
  the rooms in the house we live in now, with both drawn to scale
- **Savings**: one goal, what's saved so far, a little house that fills up
- **Upgrades**: start basic now, upgrade someday (now vs. dream photos and cost),
  plus what to get right during the build
- **Land**: paste a listing link (or the listing's text) and the name, place,
  price, acres, main photo and checklist hints fill in; then photos, price per
  acre, a checklist and notes
- **Design links**: Space Planner, Planner 5D and other helpful sites

Plain HTML/CSS/JS + Firebase (Auth, Firestore, Storage), hosted on GitHub Pages.
Until `firebase-config.js` is filled in, the app offers **sample mode** (nothing saved).

## Setup (same steps as My Worlds / CertKeeper)

1. **Firebase project**: create one (Blaze plan for Storage, with a budget alert).
2. **Authentication** → Email/Password → enable. Add two users (Gabriella and
   Nick) under Users. Then Settings → User actions → turn off sign-ups (create)
   and deletion. Settings → Authorized domains → add `glaynebrown.github.io`.
3. **Firestore** and **Storage**: create both, then publish `firestore.rules`
   and `storage.rules` (`firebase deploy --only firestore:rules,storage`).
4. **Web app**: Project settings → Your apps → add a Web app, and paste its
   config into `firebase-config.js`.
6. **Listing helper**: `cd functions && npm install`, then
   `firebase deploy --only functions` (needs Blaze). It reads listing links
   for the Land page (`functions/index.js`).
5. **GitHub**: new repo, upload the site files below, then Settings → Pages →
   deploy from the main branch.

The first person to sign in gets the starter room boards and design links;
after that, everything is shared between both accounts.

## Site files (upload these to GitHub)

index.html, styles.css, app.js, rooms.js, plans.js, money.js, land.js, main.js,
listing.js, ui.js, size.js, store.js, demo.js, photos.js, firebase-config.js, sw.js,
manifest.json, icon-192.png, icon-512.png, apple-touch-icon.png

(`firestore.rules`, `storage.rules`, `firebase.json` and the `functions` folder are for Firebase, not the site.)
