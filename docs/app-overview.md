# Ayuda Terremoto — Functionality & Flow Reference

A complete, detailed map of what the app does, how each feature behaves, and the end-to-end
user flows. This is a descriptive reference of the **implemented** system — where the running
code diverges from the spec, it is flagged explicitly (see [§12](#12-spec-vs-implementation-gaps)).

> Companion docs: product spec in [`crisis-response-spec.md`](crisis-response-spec.md), system
> wiring in [`architecture.md`](architecture.md), i18n rules in [`i18n.md`](i18n.md), animation
> rules in [`animations.md`](animations.md).

---

## 1. What the app is

A **local-first earthquake crisis-response platform** for Venezuela. It lets civilians report
emergencies (even on someone else's behalf), routes those reports to vouched responders, and
gives authorities/command a coordination layer (relief hubs, announcements, audit). It is built
to keep working on bad networks and cracked screens — one primary action per screen, reports
never blocked on connectivity, Spanish-first copy.

**Stack**

| Layer | Technology |
|---|---|
| Front end | Vue 3 + Vite SPA, Pinia stores, vue-router (`createWebHistory`) with View Transitions, Leaflet maps, vue-i18n |
| Native shell | Capacitor (iOS / Android), packages the same `dist/` |
| Back end | One Firebase Cloud Function `api` (JSON REST dispatcher) |
| Data | Firestore via Admin SDK — clients never touch Firestore directly (`firestore.rules` denies it) |
| AI | Google Gemini `2.5-flash`, runs server-side on report submit; optional, never blocks |
| Offline | IndexedDB report queue (`src/lib/offline.ts`) |
| Auth | Firebase Auth (Google Sign-In) — single credential for both field and admin tiers |

In local dev everything runs offline on the Firebase Emulator Suite under the `demo-app` project
id (Functions + Firestore + Auth), with no Firebase login.

---

## 2. Roles & capabilities

Roles escalate and are enforced **server-side** by numeric rank in
[`auth.ts`](../firebase/functions/src/auth.ts) (`hasRole(actor, min)` checks `RANK[role] >= RANK[min]`).
The client also hides controls by role, but the server is the source of truth.

| Role | Rank | How granted | Capabilities (additive) |
|---|---|---|---|
| **Civilian** | 0 | Sign in with Google | Submit personal/proxy reports, mark a pin evacuated, confirm resolution, view map, read announcements, report/search missing persons, report a building status |
| **Responder** | 1 | Redeem a vouch code, or admin approves a responder request | + set incident status (green/yellow/red), mark resolved, mark a missing person found, resolve building-status requests, import hospital patient lists |
| **Authority** | 2 | Provisioned by Command in `/admin` | + create & manage relief hubs, approve/deny responder requests, manage responder roster |
| **Command** | 3 | Provisioned by sudo / seed | + broadcast announcements, manage admin users, approve admin access requests, view audit logs + vouch audit |
| **Sudo** | 4 | Seeded bootstrap admin | + assign/remove other admins including sudo; protected from removal |

Two conceptual **tiers**: *field* (civilian/responder, stored in `users/{email}`) and *admin*
(authority/command/sudo, stored in `adminUsers/{email}`). Both authenticate with the same Google
ID token; `getActor()` checks `adminUsers` first, then `users`, then defaults to civilian.

---

## 3. Navigation map (routes → pages)

Defined in [`router/index.ts`](../app/src/router/index.ts). Every navigation is wrapped in a
View Transition that degrades to instant nav on unsupported browsers / reduced-motion.

| Route | Page | Purpose |
|---|---|---|
| `/` | MapPage | Incident map + relief-hub layer, the home screen |
| `/report` | ReportPage | The 5-step report wizard |
| `/verify` | VerifyPage | Google sign-in, role, volunteer request, vouch redemption |
| `/incidents/:id` | IncidentDetailPage | Single incident + clustered "master incident" + responder actions |
| `/people` | PeoplePage | Missing persons / hospitalized patients / building assessments (3 tabs) |
| `/hubs` | HubsPage | Browse relief hubs |
| `/hubs/create` | HubCreatePage | Create a hub (Authority+) |
| `/hubs/:id` | HubDetailPage | Hub detail (read-only public view) |
| `/hubs/:id/manage` | HubManagePage | Hub inventory/coordinator management |
| `/alerts` | AnnouncementsPage | Read-only announcement feed |
| `/admin` | AdminPage | Admin portal (Authority+/Command) |
| `/guides`, `/guides/:id` | Guides | Static survival guides |
| `/about` | AboutPage | App info & credits |
| `/:pathMatch(.*)*` | NotFoundPage | 404 (needed because Hosting rewrites every URL to `index.html`) |

---

## 4. Reporting — the core flow

`ReportPage` → `POST /reports`. Designed to be panic-proof: one decision per screen, minimal
required fields, never blocked on the network.

### 4.1 Steps

1. **Who** — *Personal* (self) vs. *Proxy* ("I'm reporting for someone else"). A shortcut to
   missing-persons is offered here too.
2. **Category** — one of four:
   - **Medical** — injuries / people
   - **Structural** — building / collapse
   - **Obstruction** — blocked roads / rubble
   - **Resource** — water, medicine, supplies needed
3. **Triage wizard** — category-specific yes/no questions, one per screen, with oversized
   buttons. Answers compute a **triage level 1–5** (1 = critical, 5 = minor) — see [§5](#5-triage-logic).
4. **Details & location**
   - **Location** is required: auto GPS or manual map pin (`LocationPickerMap`). A
     `locationPrecise` flag records whether the pin is trusted GPS or a fallback drop.
   - Category-specific fields: structural damage level, resource type, medical count,
     obstruction type.
   - Optional: unit (floor/apartment), free-text description.
   - **Proxy extras** — when proxy + the subject is trapped/injured/deceased: subject name,
     details, last-seen, contact phone, and an optional checkbox to **also create a
     missing-persons entry** in the same submit.
5. **Success** — confirms "submitted" or "queued offline," returns home.

### 4.2 What the backend does on submit (`POST /reports`)

- Persists the incident with category, triage level, coordinates, description, type
  (`personal`/`proxy`), optional unit and subject fields.
- Runs **proximity clustering** → assigns a `clusterId` (see [§7.1](#71-proximity-clustering)).
- Runs the **AI panic check** → may escalate triage and set `aiFlagged`/`aiReason`
  (see [§7.2](#72-panic-misclassification)). Optional and non-blocking.
- Writes an entry to the append-only audit log (category, level, proxy flag, AI-flagged).
- Returns `201` with a **public** incident view (reporter id/name stripped for non-responders).

### 4.3 Proxy reports

Identity bypass: the system never asks for the victim's ID. The report is tagged
`[PROXY_REPORT]` so responders treat the location/identity as approximate, and it can be
cross-linked into the missing-persons registry.

---

## 5. Triage logic

Defined in [`lib/triage.ts`](../app/src/lib/triage.ts). Each question has a `dangerAnswer` and a
`level`; the final level is the **worst (lowest) triggered**, defaulting to 4 if nothing
triggers (`computeLevel`).

**Medical** — trapped? (→1), deceased? (→2), conscious? *no* →1, breathing? *no* →1,
heavy bleeding? (→2), can move on their own? *no* →3
**Structural** — anyone trapped? (→1), gas/fire? (→1), structural collapse? (→2),
access blocked? *no* →3
**Obstruction** — trapping someone? (→2), causing injuries? (→2), blocking a route? (→3)
**Resource** — life-threatening need? (→2), vulnerable person? (→3), affects many? (→3)

Levels map to status colors and ordering used across the map and incident list.

---

## 6. Incident lifecycle & "don't search twice"

### 6.1 Statuses

- **Green / Yellow / Red** structural status — set by Responder+ via
  `POST /incidents/:id/status`. Setting red/yellow clears any `evacuated`, `resolved`,
  `resolutionConfirmed` flags (a re-flagged site is active again).
- **Evacuated** — any authenticated user can mark a pin evacuated
  (`POST /incidents/:id/evacuate`); status forced to green. The pin gets a persistent
  `[EVACUATED / DO NOT SEARCH]` badge, leaves the active search queue, and moves to a
  Cleared/Evacuated layer.
- **Resolved** — Responder+ marks resolved (`POST /incidents/:id/resolve`).
- **Resolution confirmation** — the original reporter answers "did this actually resolve your
  problem?" (`POST /incidents/:id/resolution`), preventing premature closure.

### 6.2 Master incidents (clusters)

`GET /incidents` groups reports by `clusterId` into **master incidents**:
- The representative is the **worst triage** (lowest level), earliest on tie.
- Returns a count + every member report (what each person said, timestamps, proxy/AI flags,
  unit).
- Reporter names are visible only to Responder+; civilians see anonymized reports.
- Sorted critical → minor.

`IncidentDetailPage` renders the representative plus the "+N nearby reports" contributor list.

---

## 7. AI layer — "the hidden net" (Gemini)

Runs server-side in [`ai.ts`](../firebase/functions/src/ai.ts). The Gemini key is a Secret
Manager secret; with no key the AI passes are simply skipped. Nothing here ever blocks a report.

### 7.1 Proximity clustering

`resolveClusterId(lat, lng, category, precise, unit, ownId)` — a new report inherits an existing
active incident's `clusterId` only if **all** hold: same category, both reports precise GPS
(fallback drops never cluster), same floor/unit, within **60 m**, and the target isn't
evacuated. Otherwise it starts its own cluster. This stops many responders converging on one
spot.

### 7.2 Panic misclassification

On submit, Gemini reads the free-text description and decides whether it implies **worse**
severity than the user declared (signals: trapped, not breathing, gas, fire, structural
collapse, heavy bleeding). If so it **escalates** the triage level/status and sets
`aiFlagged: true` + `aiSeverity` + `aiReason`. It **never downgrades** and silently skips on
error/timeout (15s, temperature 0).

### 7.3 Image triage (Command-only)

`POST /reports/analyze-image` — accepts an image URL or base64 + context. Gemini returns
category, triage level, description, a `locationSearchQuery`, and structured attributes
(structural damage, resource type, medical count, obstruction type, confidence). If no GPS is
supplied it geocodes the query via OpenStreetMap Nominatim, falling back to Caracas (marked
imprecise). Creates the incident as a proxy report.

### 7.4 Patient-list matching

`POST /patients/analyze-list` (Responder+) — OCR/parse a hospital admit list (text or image) via
Gemini, then match each admitted patient to active missing persons by **exact DNI** (digits-only
normalize) or **fuzzy name** (lowercase, strip accents/specials, require ≥2 shared significant
words). Stores `matchedMissingId` when found and audits each admit/match.

---

## 8. Missing persons & people (PeoplePage)

Three tabs.

### 8.1 Missing persons
- **Report** (verified users): name (required), DNI, details, address, last-seen, phone, contact
  phone → `POST /missing`. The contact name is taken from the verified identity, not a form
  field. Optionally synced from a proxy report.
- **Search** by name (live filter).
- **Mark found** (original reporter or Responder+): `POST /missing/:id/found` captures who found
  them (name from identity, phone, note, role, timestamp). Status flips missing → found.
- **Cross-reference**: if a hospital import matched this person, an alert shows the hospital +
  medical notes.

### 8.2 Hospitalized patients (Responder+)
- **Import list**: paste text or upload an image of a hospital admit list + hospital name →
  `POST /patients/analyze-list`. Backend OCRs and auto-matches to missing persons.
- Each patient shows hospital, DNI, notes; matched patients raise a cross-reference alert with
  the missing person's contact info.

### 8.3 Building status requests
- **Report** (verified): building name (required), address, condition note, contact phone →
  `POST /location-requests`. Starts `pending`.
- **Resolve** (Responder+): condition dropdown (safe / damaged / collapsed / unknown) + note →
  `POST /location-requests/:id/resolve`, capturing resolver identity, role, timestamp.

---

## 9. Relief hubs

Connects the "Resource" report category to actual supply points. Public can discover; Authority+
and assigned coordinators manage.

- **Create** (`POST /hubs`, Authority+): name, address, lat/lng (map pin), contact name/phone,
  optional WhatsApp group URL. Status starts `active`.
- **Edit** (`PATCH /hubs/:id`, creator/coordinator): name, address, contact, WhatsApp group,
  status (active/closed).
- **Inventory**:
  - Add/upsert item (`POST /hubs/:id/inventory`): category, name, quantity, unit, optional
    urgency. Urgency auto-derives — **depleted** (qty 0), **low** (≤5), **available** otherwise
    — unless explicitly overridden. Logged as `restock`.
  - Adjust (`POST /hubs/:id/inventory/:itemId/adjust`): change quantity by a delta with an
    action type (`distribute` / `restock` / `adjust`) + note; recomputes urgency, logs the move.
  - Remove (`DELETE …/:itemId`): logs a negative adjustment.
- **Logs** (`GET /hubs/:id/logs`): last 100 transactions, newest first.
- **Coordinators**: add (`POST …/coordinators`, must be an Authority+ admin) / remove
  (`DELETE …/coordinators/:email`, creator only).
- **Discovery** (`GET /hubs`, public): active hubs with current inventory, last 5 logs, and
  coordinator list. The UI shows urgency badges, a **stale warning** if not updated in ~2h, and
  WhatsApp contact / group / share actions plus a QR code for the hub URL.

---

## 10. Announcements — the megaphone

- **Broadcast** (`POST /announcements`, **Command only**): category **urgent** / **logistics** /
  **correction** + message.
- **Feed** (`GET /announcements`, public): newest first, shown on `AnnouncementsPage` and as a
  persistent banner.
- **Delete** (`DELETE /announcements/:id`, Command only).

---

## 11. Identity, vouching & admin provisioning

### 11.1 Sign-in & role resolution
`VerifyPage` + `session.ts` — Google Sign-In via Firebase popup. After sign-in the client calls
`GET /auth/me` to resolve `{ role, name, email }`. `isVerified` simply means "a Google user is
signed in." If the server is unreachable the client falls back to a local `civilian` profile.

### 11.2 Vouch chain (the scaling engine)
- **Generate** (`POST /vouch/generate`, Authority+): an 8-character single-use code from a
  base-32 alphabet (no ambiguous `0/O/1/I`), stored with the issuer's email.
- **Redeem** (`POST /verify/redeem-vouch`): a signed-in user submits the code → promoted to
  **Responder** (`users/{email}`), the code is marked used, and the redemption is written to the
  append-only `vouchAudit` log (`voucher`, `vouchee`, timestamp).
- **Accountability**: if a responder misbehaves, Command filters the vouch audit to find who
  vouched for them and can revoke that voucher's ability to issue codes.

### 11.3 Responder requests (no-code path)
Civilians can request the Responder role from `VerifyPage` (`POST /verify/responder-request`,
phone + note). Authority+ approve/deny in the admin portal.

### 11.4 Admin access requests
Any Google user can request admin access (`POST /access-request`, phone + note). Command
approves with a chosen role (authority/command/sudo) — non-sudo actors cannot grant or modify
sudo. Approval writes `adminUsers/{email}`.

### 11.5 Admin portal (`/admin`)
| Capability | Min role |
|---|---|
| Approve/deny responder requests; manage & revoke responder roster | Authority |
| Approve/deny admin access requests; add/remove admins & assign roles | Command |
| Broadcast & delete announcements | Command |
| Activity audit log + vouch audit log | Command |

---

## 12. Offline-first behavior

Implemented in [`lib/offline.ts`](../app/src/lib/offline.ts) (IndexedDB, zero dependencies).

- **Always-queue-first intent**: a report that fails to POST is written to the
  `pending_reports` object store with a `localId` (uuid) and `queuedAt` timestamp; the UI shows a
  "queued" success state instead of an error.
- **Ordered sync**: `syncReports(submit)` flushes the queue sorted by `queuedAt`. On the first
  recoverable failure it **stops** so ordering is preserved; successfully sent items are deleted.
  Returns the count synced.
- **Pending counter**: `queuedCount()` feeds a visible pending indicator in the shell.
- **Persistence**: IndexedDB survives a browser/app restart, so nothing is lost if the device is
  closed before reconnecting.

---

## 13. Backend API surface (reference)

All under the single `api` Cloud Function ([`api.ts`](../firebase/functions/src/api.ts)).
"Auth" = minimum role; *public* = no auth.

| Method & path | Auth | Purpose |
|---|---|---|
| `GET /health`, `POST /echo` | public | Diagnostics |
| `GET /auth/me` | signed-in | Resolve current role/name/email |
| `POST /verify/redeem-vouch` | signed-in | Redeem vouch code → responder |
| `GET/POST /verify/responder-request` | signed-in | Request/check responder role |
| `POST /vouch/generate` | authority | Create single-use vouch code |
| `GET /vouch/audit` | command | Last 200 vouch redemptions |
| `GET/POST /access-request` | signed-in | Request/check admin access |
| `GET /admin/requests`, `…/approve`, `…/deny` | command | Manage admin access requests |
| `GET /admin/responder-requests`, `…/approve`, `…/deny` | authority | Manage responder requests |
| `GET /admin/responders`, `…/remove` | authority | Responder roster |
| `GET /admin/users`, `POST /admin/users`, `…/remove` | authority / command | Admin user management |
| `GET /admin/me` | admin | Admin self-check |
| `POST /reports` | signed-in | Submit incident (clusters + AI) |
| `POST /reports/analyze-image` | command | AI image → incident |
| `GET /incidents` | public | Clustered master incidents |
| `POST /incidents/:id/status` | responder | Set green/yellow/red |
| `POST /incidents/:id/evacuate` | signed-in | Mark evacuated |
| `POST /incidents/:id/resolve` | responder | Mark resolved |
| `POST /incidents/:id/resolution` | signed-in | Reporter confirms resolution |
| `GET/POST /missing`, `POST /missing/:id/found` | public read / signed-in / reporter-or-responder | Missing persons registry |
| `GET/POST /location-requests`, `…/:id/resolve` | public read / signed-in / responder | Building-status requests |
| `GET/POST /announcements`, `DELETE …/:id` | public / command | Announcements |
| `GET /patients`, `POST /patients/analyze-list` | public / responder | Hospital patient matching |
| `GET/POST /hubs`, `PATCH /hubs/:id` | public / authority | Hub CRUD |
| `POST /hubs/:id/inventory`, `…/:itemId/adjust`, `DELETE …/:itemId` | authority (coordinator) | Inventory |
| `GET /hubs/:id/logs` | authority (coordinator) | Hub logs |
| `POST /hubs/:id/coordinators`, `DELETE …/:email` | authority / creator | Coordinators |

---

## 14. Spec vs. implementation gaps

The spec and `architecture.md` describe an identity model the running code does **not** yet
implement. Notable divergences as of this writing:

- **No Cédula soft-gate.** The spec describes Cédula entry, a randomized 4×5 **name-match grid**
  (anti-spoofing), exponential-backoff cooldowns, and an `IdentityProvider` chain
  (self-host scrape → community CedulaVE API → cache → vouch-only). In code, both tiers
  authenticate purely via **Google Sign-In** ([`auth.ts:19`](../firebase/functions/src/auth.ts));
  `getActor()` only verifies a Firebase ID token. The `IdentityProvider` exists as a seam/stub
  but is not wired into the auth path. The `Actor.id` comment ("dni for field") is aspirational —
  it is actually the email.
- **No device-token sessions.** `architecture.md` describes a `sessions/{token}` device-token
  tier; the implemented field tier is the same Google token, keyed by email in `users/{email}`.
- **Open spec items not yet built** (from spec §10–11): responder check-in / dead-man timer,
  push/SMS notification delivery, offline map tiles, sync-conflict resolution beyond ordered
  replay, report rate-limiting / trust score, cluster split UI, and the SMS/USSD fallback
  channel.

Net effect today: **identity = "you hold a Google account,"** with real trust coming from the
vouch chain + append-only audit log — consistent with the "identity is a soft gate, not auth"
principle, just realized through Google rather than Cédula.
