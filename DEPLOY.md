# Deploy / Go-Live Guide

Ayuda Terremoto in production: **Firebase Hosting** (web app) + **Cloud Functions** (the `api`)
+ **Firestore** + **Firebase Auth** (Google, admin tier only). Everything below is the real-project
path — the emulator workflow in `README.md` is unchanged and stays the dev default.

> Estimated time for a clean first deploy: **~1–2 hours**, mostly mechanical.

---

## 0. Prerequisites

```bash
npm i -g firebase-tools
firebase login            # the Google account that owns the Firebase project
node -v                   # use Node 20 (matches functions/ "engines")
```

---

## 1. Create the Firebase project (one-time, in the console)

1. https://console.firebase.google.com → **Add project** (e.g. `ayudaterremoto-prod`).
2. **Build → Authentication → Get started → Sign-in method → Google → Enable.**
   Add your domain under **Authorized domains** (e.g. `ayudaterremoto.org`).
3. **Build → Firestore Database → Create database → Production mode**, pick a region
   (e.g. `us-central1` or `southamerica-east1` — keep it close to users).
4. **Upgrade to the Blaze (pay-as-you-go) plan** — Cloud Functions require it. Set a budget alert.

---

## 2. Point the repo at the real project

Replace every `REPLACE_ME` / `demo-` placeholder. **The build will silently misbehave if you skip
these** (auth fails, API calls 404).

**a. `.firebaserc`** (repo root):
```json
{ "projects": { "default": "ayudaterremoto-prod" } }
```

**b. `app/src/lib/firebase.ts`** — paste the real web config from
**Console → Project settings → General → Your apps → Web app → SDK setup (Config)**:
```ts
const app = initializeApp({
  apiKey: 'AIza...real...',
  authDomain: 'ayudaterremoto-prod.firebaseapp.com',
  projectId: 'ayudaterremoto-prod',
  // appId, messagingSenderId, storageBucket as given
})
```
> The `if (import.meta.env.DEV) connectAuthEmulator(...)` line stays — it only runs in dev, so prod
> talks to real Auth automatically.

**c. `app/.env.production`** — the deployed Functions URL (region must match step 4):
```
VITE_API_URL=https://us-central1-ayudaterremoto-prod.cloudfunctions.net/api
```

**d. `firebase/functions/src/helpers/cors.ts`** — set the real origins; **keep the two Capacitor
entries** (`capacitor://localhost`, `http://localhost`) for the native apps:
```ts
export const CORS_ALLOWLIST = [
  'https://ayudaterremoto.org',
  'https://www.ayudaterremoto.org',
  'capacitor://localhost',
  'http://localhost',
]
```

---

## 3. Secrets (Secret Manager)

```bash
cd firebase/functions
firebase functions:secrets:set GEMINI_API_KEY     # paste your Gemini API key when prompted
```
`api.ts` already declares it via `defineSecret('GEMINI_API_KEY')`. If you skip this, the AI
escalation pass is simply skipped — reports still work.

---

## 4. Deploy backend (Firestore rules + Functions)

```bash
cd firebase/functions && npm install && npm run build
cd ..                                              # back to firebase/
firebase deploy --only firestore:rules --project ayudaterremoto-prod
firebase deploy --only functions --project ayudaterremoto-prod
```
Confirm the function URL printed matches your `VITE_API_URL` region. Smoke test:
```bash
curl https://us-central1-ayudaterremoto-prod.cloudfunctions.net/api/health
# → {"ok":true,"ts":"..."}
```

---

## 5. Seed the first Command admin (NOT demo data)

In production the seed script **only** creates the bootstrap admin (demo incidents are
emulator-only). Run it once with real credentials:

```bash
cd firebase/functions
GOOGLE_APPLICATION_CREDENTIALS=/path/to/serviceAccount.json \
GCLOUD_PROJECT=ayudaterremoto-prod \
node lib/seed.js you@example.com
```
(Download a service-account key from **Console → Project settings → Service accounts → Generate
new private key**.) Or simply add the doc by hand: Firestore → `adminUsers/{your-email}` →
`{ email: "...", role: "command" }`.

---

## 6. Build + deploy the web app (Hosting)

```bash
cd app
cp .env.production .env       # or ensure VITE_API_URL is set for the build
npm install && npm run build  # vue-tsc -b && vite build  → app/dist/
```
Then the one-true deploy path (it stages `app/dist/` into `firebase/app/` and deploys):
```bash
cd .. && ./scripts/deploy.sh
```
`scripts/deploy.sh` aborts if `.firebaserc` still says `REPLACE_ME`. Hosting serves the SPA with the
`** → /index.html` rewrite already configured in `firebase/firebase.json`.

Point your domain: **Console → Hosting → Add custom domain → `ayudaterremoto.org`** and follow the
DNS steps.

---

## 7. Post-deploy smoke test (do all of these)

- [ ] Open the site → `/about` shows **"API connected"** (green).
- [ ] Sign in at `/admin` with your Command email → you see the dashboard (not "request access").
- [ ] Generate a vouch code; redeem it through `/verify` on another device/browser → becomes Responder.
- [ ] File a report (allow location) → it appears on the map.
- [ ] Broadcast an urgent alert → the red banner shows; clear it → banner gone.
- [ ] Report a missing person; mark found → status updates.
- [ ] Confirm the **dev name hint does NOT appear** on `/verify` (it's emulator-only).
- [ ] Switch ES/EN.

---

## ⚠️ Known limitations at launch (decide consciously)

These are **not** wired yet. Launching without them is a pilot, not a finished product — make sure
stakeholders know:

1. **Identity is NOT really verified.** The CedulaVE/CNE provider is a **stub**: anyone can "verify"
   with any 6–9 digit Cédula and a synthesized name. The vouch chain still gates Responder, but
   civilian/missing-person reporting is effectively open. Wire the real provider behind
   `firebase/functions/src/identity/provider.ts` before relying on identity for accountability.
2. **Maps need connectivity.** Tiles come from OpenStreetMap online; the map won't render offline
   (reports still queue and sync offline — only the map is affected).
3. **No push / SMS.** Responders only see updates when the app is open.
4. **No rate limiting / abuse protection** on the public `api` endpoints. Expect spam under load;
   monitor and add throttling.
5. **No automated tests.** Verified by type-checks and manual QA only.
6. **Cluster actions** (status/evacuate/resolve) apply to a Master Incident's representative report,
   not every grouped report.

## Rollback

```bash
firebase hosting:rollback --project ayudaterremoto-prod      # revert the web app to the previous release
```
Functions have **no** one-command rollback — `git checkout` the last known-good commit and
`firebase deploy --only functions` again. (Tag each deploy in git so you always have a target.)

## Where things live

- Two auth tiers, roles, data model: `docs/architecture.md`
- Product spec + roadmap: `docs/crisis-response-spec.md`
- i18n / animation rules: `docs/i18n.md`, `docs/animations.md`
