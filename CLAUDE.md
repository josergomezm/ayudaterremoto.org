# Ayuda Terremoto

Earthquake crisis-response app for Venezuela. Vue 3 + Vite + Capacitor front end, Firebase
Hosting + Cloud Functions back end. Local-first: the whole stack runs on the Firebase Emulator
Suite with no Firebase project and no login.

The product spec lives in `docs/crisis-response-spec.md` — read it before changing domain logic.

## Project Structure

- `app/` — Vue 3 + Vite web app, wrapped by Capacitor for iOS/Android
- `firebase/` — Firebase Hosting config + Cloud Functions API + emulator scripts
- `docs/` — Spec + internal docs (read `docs/animations.md` before touching any animation,
  `docs/i18n.md` before touching any user-facing string)

## Development

- **Do not** run `vite build`, `npm run build`, `cap sync`, or any build commands unless asked.
- **Do not** prompt the user asking if they want to run a build.
- The dev server (`npm run dev`) and the Firebase emulators (`npm run emulators` in `firebase/`)
  are managed by the user separately.
- Local dev never needs a real Firebase project — the emulators run offline under `demo-app`.
- Use `npm` as the package manager (not yarn or pnpm).

## Crisis domain rules

- **Identity is a soft gate, not auth.** The Cédula check (CNE) only deduplicates accounts and
  attaches a real name for accountability. Real trust comes from the vouch chain + audit log.
  Never treat a passed Cédula check as proof of who is holding the device.
- **All identity lookups go through `firebase/functions/src/identity/provider.ts`** (the
  `IdentityProvider` seam). The CNE source is unofficial and frequently down — the provider
  layers self-host → community API → cache → vouch-only degraded mode. App code never knows
  which source answered.
- **Roles** escalate Civilian → Responder → Authority → Command. Capabilities are enforced
  server-side in `api.ts` via `getActor()` + role rank, not just hidden in the UI.
- **Two auth tiers.** Field tier (civilian/responder) = offline Cédula soft-gate + device-token
  session. Admin tier (authority/command) = Firebase Auth (Google) with roles in `adminUsers/`.
  Vouch codes only grant Responder; admins are provisioned in the `/admin` portal.
- **Persistence is Firestore** (emulator in dev), accessed only through the `api` function's
  Admin SDK; clients never touch Firestore directly (`firestore.rules` denies it).
- **Offline-first.** Reports must be submittable with no connectivity (queued in IndexedDB via
  `src/lib/offline.ts`) and synced in order on reconnect. Never block a report on the network.
- **Proxy reports** (`[PROXY_REPORT]`) and evacuated pins (`[EVACUATED]`) carry persistent,
  unmistakable badges. Once a pin is `[EVACUATED]` it leaves the active search queue.

## i18n rules (non-negotiable)

- No hardcoded user-facing strings in templates or stores — every string is a key in a
  per-feature TS module under `src/i18n/locales/{configs,components,pages}/`, resolved with
  `useI18n()`'s `t()`. See `docs/i18n.md`.
- Each module exports `{ es, en }` with `en: typeof es`, so locale key parity is a
  **compile-time** error. Add a string = add it to both `es` and `en` in the same edit.
- Spanish is the primary field language and the source of truth; `en` is the fallback.
- Stores/data hold message **keys** (enum labels, statuses); user-typed content is not translated.

## Animation rules (non-negotiable)

- Page-to-page animation goes through the View Transitions wrapper in `src/router/index.ts` —
  never call `document.startViewTransition` anywhere else.
- Hero transitions = matching `view-transition-name` on source and target, derived from the
  item id. Names must be unique per page.
- Animate only `transform` and `opacity`. Durations 200–350ms.
- All transition CSS lives in `src/assets/css/transitions.css`, organized as numbered recipes.
- Every animation must degrade gracefully: reduced-motion and unsupported browsers get instant
  navigation.
