# Ayuda Terremoto

Open source: https://github.com/josergomezm/ayudaterremoto.org

Earthquake crisis-response app for Venezuela. A local-first **Vue 3 + Vite + Capacitor** front
end with a **Firebase Hosting + Cloud Functions** back end. Runs entirely on the Firebase
Emulator Suite with no Firebase project and no login.

## What's in the box

- **Vue 3 + Vite + Capacitor** web app that ships to iOS/Android with no restructuring.
- **Firebase Hosting + one Cloud Functions API** (`api`, hand-rolled router, no Express).
- **Full local dev** via the Emulator Suite under the offline `demo-app` project id.
- **View Transitions animation system** (hero/shared-element morphs, page + list animations) —
  no animation library. See `docs/animations.md`.
- **vue-i18n** wired in from day one, Spanish-first. See `docs/i18n.md`.
- **Crisis MVP flows**: identity verification + vouch chain, personal + proxy reporting with a
  triage wizard, an incident map with triage-status markers and an evacuated/cleared layer,
  Command announcements, and an offline report queue. Spec: `docs/crisis-response-spec.md`.

External services (CNE identity scrape, AI clustering, push) are **stubbed behind clean seams** —
the flows run fully offline today; swap in real backends without touching app code.

### Two auth tiers + admin portal

- **Field tier (civilian/responder):** offline Cédula soft-gate + device token. No passwords.
- **Admin tier (authority/command):** Google Sign-In (Firebase Auth). The in-app **`/admin`**
  portal (linked from the sidebar and the About page) lets admins generate vouch codes, view the
  vouch audit log, manage admin roles, and broadcast alerts.

State persists in **Firestore** (via the emulator). Seeding is a **one-off script**, not
automatic:

```bash
cd firebase/functions
npm run seed                       # demo data only (emulator)
npm run seed -- you@example.com    # demo data + make that email a Command admin
```

Then sign in with that email in the Auth emulator's account chooser to get full access, and
add/manage the rest from the `/admin` portal.

**Production:** there's no auto-seed and no hardcoded admin. Create your first Command admin by
adding an `adminUsers/{your-email}` document (`{ email, role: "command" }`) in the Firebase
console, or run the same script against your project with credentials
(`GOOGLE_APPLICATION_CREDENTIALS=… node lib/seed.js you@example.com`).

## Quick start — fully local, no Firebase account

```bash
# 0. one-time: the emulator CLI (global)
npm i -g firebase-tools

# 1. install deps (firebase/ has the emulator helper; functions/ has the API)
cd firebase && npm install && cd functions && npm install && npm run build && cd ..

# 2. start the backend (offline; NO Firebase project needed)
# This auto-rebuilds functions on save (tsc --watch) AND runs the emulators together.
npm run emulators                   # functions :5001 · firestore :8080 · auth :9099 · UI :4000

# 3. one-off: seed demo data + your Command admin (emulator must be running)
cd functions && npm run seed -- you@example.com

# 4. in a second terminal: the web app, already pointed at the emulator
cd app && cp .env.example .env && npm install && npm run dev   # :5173
```

Visit `http://localhost:5173/about` — a green "API connected" means the app reached the emulated
`/health` function. The whole thing works on a fresh clone with the `REPLACE_ME` `.firebaserc`
untouched, because any `demo-`-prefixed project id makes the Emulator Suite run fully offline.

### Daily workflow

- Terminal 1, in `firebase/`: `npm run emulators` — this now runs `tsc --watch` **and** the
  emulators together, so editing a function recompiles `lib/` and the emulator hot-reloads. No
  more stale builds.
- Terminal 2, in `app/`: `npm run dev`.

`npm run emulators:all` additionally serves the built app from `firebase/app/` on :5000 for a
production-like smoke test; day-to-day dev uses Vite on :5173.

## How to add a hero transition

Three steps (full recipe in `docs/animations.md`): put
`:style="{ viewTransitionName: 'incident-' + incident.id }"` on the source block, the **same**
name on the target block on the next page, done — the browser morphs between them. Names must be
unique per page; always derive them from the item id (never a static name in a `v-for`).
Reference: `IncidentCard.vue` → `IncidentDetailPage.vue`.

## How to add a translated string / a new locale

Add the key to **both** `src/i18n/locales/en.json` and `es.json`, resolve it with `t('...')`.
New locale: create the JSON, add the code to `SUPPORTED_LOCALES`, add it to `messages`. Details
in `docs/i18n.md`.

## How to add an API endpoint

1. Add a zod schema to `firebase/functions/src/models.ts`.
2. Add a route branch in `firebase/functions/src/api.ts`.
3. Call it via `apiFetch` / `useApi` from the app.

It's testable immediately against the emulator — no deploy needed.

## Going native

```bash
cd app && npm run build
npx cap add ios && npx cap add android      # one-time
# drop a 1024×1024 icon.png + 2732×2732 splash.png into app/assets, then:
npm run cap:assets                          # generates all icon/splash sizes
npx cap sync && npx cap open ios            # or: open android
```

The API CORS allow-list already includes the Capacitor origins, and the Android hardware/gesture
back button is already handled in `src/lib/native.ts`.

## Deploy

1. Set the real project id in `.firebaserc`.
2. Set `VITE_API_URL` for the prod build (the deployed function URL).
3. `./scripts/deploy.sh` — builds the app, stages `dist/` into `firebase/app/`, and runs
   `firebase deploy`. It fails fast if `.firebaserc` still says `REPLACE_ME`.

## Keeping dependencies fresh

Versions in `package.json` are pinned to the dates this boilerplate was
generated. They're intentionally NOT auto-updated on install — the goal is
that `npm install && npm run dev` always works on day one.

Recommended workflow when starting a new project from this scaffold:

1. `npm install` in both `app/` and `firebase/functions/` and confirm
   `npm run dev` boots cleanly.
2. Commit the scaffold as your baseline (`git commit -m "initial scaffold"`).
3. Run `npm outdated` in each folder to see drift, and `npm audit` for
   security issues.
4. Upgrade deliberately — one major version at a time, testing between each.
   Watch especially for breaking changes in Vite, Capacitor, Tailwind,
   Firebase Functions, and zod (these have all shipped breaking majors in
   the past).
5. After upgrading, re-run `npm run dev`, click through the hero transition
   and the /about health check before committing.

Avoid running `npm update` blindly — it will pull breaking majors without
warning and you'll lose the "clean baseline" property.
