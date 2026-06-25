# Architecture

How the pieces fit together.

## Build & serve flow

- Vite builds the SPA into `app/dist/`.
- `scripts/deploy.sh` copies `app/dist/` → `firebase/app/`, where Firebase Hosting serves it
  with an SPA rewrite (`** → /index.html`). The rewrite is required because the app uses
  `createWebHistory` (real URLs, no hash) — without it, deep links and 404s render an empty
  `RouterView`.
- The same `dist/` is what Capacitor packages into the iOS/Android shells (`webDir: 'dist'`).
- Hosting `public` is `"app"` because the deploy flow stages the build into `firebase/app/`.

## Client → API

- The app talks to one Cloud Function (`api`) over JSON.
- The function has a CORS allow-list that includes both web origins and the Capacitor origins
  (`capacitor://localhost`, `http://localhost`) the native shells send.
- The base URL is read **only** in `src/lib/api.ts` from `VITE_API_URL`, falling back to the
  emulator in dev and the deployed function URL in prod.

## Local-first dev

- In local dev the function runs in the Firebase Emulator Suite under the offline `demo-app`
  project id — any `demo-`-prefixed id makes the suite run fully offline, with no
  `firebase login` and no edits to `.firebaserc`.
- The app targets the Functions emulator via `VITE_API_URL`
  (`http://127.0.0.1:5001/demo-app/us-central1/api`); the web app's Firebase Auth SDK targets
  the Auth emulator on `:9099`.
- The suite runs **Functions, Firestore, and Auth** emulators together
  (`npm run emulators`). All three are offline under `demo-app`.
- Backend state lives in **Firestore** (`incidents`, `announcements`, `vouchCodes`,
  `vouchAudit`, `sessions`, `adminUsers`, `accessRequests`, `challenges`), accessed only via the
  `api` function using the Admin SDK. Direct client access is denied by `firestore.rules`.
- **Seeding is a one-off script**, not automatic — `firebase/functions/src/seed.ts`, run via
  `npm run seed` (see README). It writes demo data (emulator only) and, given an email, a
  Command admin. The request path never seeds, so nothing fake reaches production and there is no
  hardcoded admin in the running function.

## Auth tiers

Two distinct identity tiers:

- **Field tier (civilian / responder):** the offline Cédula soft-gate + a device-token session
  (stored in Firestore `sessions/{token}`). No passwords, works with no Google account. This is
  the deliberate "identity is a soft gate, not auth" model.
- **Admin tier (authority / command):** real authentication via **Firebase Auth (Google
  Sign-In)**. Roles live in `adminUsers/{email}`. The in-app `/admin` portal gates on this.
  Vouch codes only ever grant **Responder**; Authority/Command are provisioned as admins (seed a
  bootstrap Command in `seed.ts`).

The `api` function's `getActor()` accepts either credential on the `Authorization: Bearer` header
— it verifies a Firebase ID token first (admin), then falls back to a device-token session
(field). Capabilities are enforced server-side by role rank.

## AI layer — "the hidden net" (Gemini)

On report submission the `api` function runs two backend passes (spec §7):

- **Proximity clustering** — a new report within ~60 m of an active incident inherits its
  `clusterId` ("Master Incident"), so the map/list can show "+N nearby reports" instead of
  sending many responders to the same place.
- **Panic misclassification** — `ai.ts` sends the report's free text to the **Gemini API**
  (`gemini-2.5-flash`) and, if the text implies worse than the declared triage (gas, fire,
  trapped, not breathing…), escalates the level/status and sets `aiFlagged` + `aiReason`. It
  **never downgrades** and **never blocks the report**: a missing key, error, or 5 s timeout just
  skips AI and the report proceeds.

The Gemini key is a **Secret Manager** secret declared with `defineSecret("GEMINI_API_KEY")`.
Set it for production with `firebase functions:secrets:set GEMINI_API_KEY`; for the emulator, put
`GEMINI_API_KEY=...` in `firebase/functions/.secret.local` (gitignored). With no key set, the AI
pass is simply skipped.

## Crisis-domain layering

- **Identity** flows through the `IdentityProvider` seam (`functions/src/identity/provider.ts`).
  The CNE has no official API — every option scrapes the public web form. The provider is
  ordered: self-hosted scrape → community API (CedulaVE) → cache → vouch-only degraded mode.
  The MVP ships a deterministic **stub** provider so the flow runs offline; swap in the real
  source behind the same interface.
- **Roles & capabilities** are enforced server-side in `api.ts`. The client hides controls by
  role too, but the server is the source of truth.
- **Offline reporting** is queued in IndexedDB (`src/lib/offline.ts`) and flushed in order on
  reconnect, so a report is never lost or blocked on the network.

## Navigation & i18n

- Navigation animations run through the View Transitions wrapper in the router, with automatic
  degradation on unsupported browsers and reduced-motion. See `docs/animations.md`.
- All user-facing strings flow through vue-i18n. See `docs/i18n.md`.

## When you need deep links

Opening `https://ayudaterremoto.org/items/3` (or `/incidents/3`) directly into the **native**
app requires platform deep-link config, which is deliberately **not** scaffolded:

- iOS: an `apple-app-site-association` file + the Associated Domains entitlement (Universal Links).
- Android: an `assetlinks.json` file + intent filters (App Links).

The SPA routes are already shaped to support it. See the official Capacitor deep-links guide:
https://capacitorjs.com/docs/guides/deep-links
