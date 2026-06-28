# Refocus v1 — Progress & Handoff

> **For the next agent (or human):** this branch (`refocus-v1`) repivots Ayuda Terremoto
> from an earthquake **search-and-rescue (SAR)** app into a **supply-coordination + accountability**
> layer. This doc is the single source of truth for *what changed, why, where we are, and what's next*.
> Read it before touching domain logic. The original brief is [`refocus-plan.md`](refocus-plan.md);
> the app baseline is described in [`app-overview.md`](app-overview.md).

---

## 1. The big picture (non-technical)

**Before:** the app helped people report earthquake emergencies (injuries, collapses, missing
people) and routed them to responders — a 911-style crisis tool.

**Now:** the app is becoming a way to **coordinate donated supplies**. A coordinator at a relief
point ("zone") posts what they need (water, formula, blankets); a volunteer taps **"I'll handle
it"**; they bring it; the coordinator **confirms it arrived**. The app moves **information and
accountability — never money**. The core loop is:

> **Need → someone takes it on → it arrives → the coordinator confirms.**

The roles were simplified and renamed to fit this world, the old SAR features were switched off
(but preserved), and the Home screen was redesigned around a list of needs.

**Status:** working locally on the Firebase emulator. **Nothing has been deployed; production and
the `main` branch are untouched.** Five of the planned workstreams are done; the Home redesign is
partially built (Phase A).

---

## 2. Where the work lives

| Branch | Purpose |
|---|---|
| `main` | **Untouched.** Original SAR app. Do not change without explicit approval. |
| `refocus-v1` | **All the refocus work.** This is the active branch. |
| `parked/sar-engine` | Snapshot of `main` (full SAR engine) preserved before disconnecting it. |

Commits on `refocus-v1` (newest first): WS5 Phase A → WS4 → WS1–WS3 → (`main`).

**Hard rules (from the brief, still in force):**
1. **Plan first, wait for the user's OK before coding** each workstream.
2. **Emulator only.** Never run against the real Firebase project. There's a guard for this (see §4).
3. **No deploy.** Merge to `main` and deploy are the user's separate decision.
4. Stack stays Vue 3 + Pinia + vue-router + Leaflet + vue-i18n. Server is the source of truth for
   roles. Offline-first intact. All user-facing strings go through i18n (es + en parity).

---

## 3. Workstream status

| WS | What | Status |
|---|---|---|
| **0** | Anti-production guard | ✅ Done |
| **1** | Collapse + rename roles (4 ranks) | ✅ Done |
| **2** | Free hubs → coordinator "zonas" | ✅ Done |
| **3** | "Need" lifecycle (open→claimed→confirmed) | ✅ Done |
| **4** | Park the SAR engine, disconnect from client | ✅ Done |
| **5** | Redesigned needs-first Home (Claude Design) | 🟡 Phase A done; B (map) + C (My activity) pending |

---

## 4. Technical details by workstream

### WS0 — Anti-production guard
- `firebase/functions/src/guard.ts`:
  - `assertNotProdInEmulator()` — called at backend bootstrap ([firebase.ts](../firebase/functions/src/firebase.ts)); throws if an emulator session points at the real project id `ayudaterremotovenezuela`. No-op in real production.
  - `assertEmulator(label)` — guards one-off scripts (seed, migrations): aborts unless `FIRESTORE_EMULATOR_HOST` is set and the project isn't prod.
- ⚠️ `.firebaserc` still points `default` at the **real** project `ayudaterremotovenezuela`. Local
  isolation depends on always starting the emulator with `--project demo-app`.

### WS1 — Roles collapsed to 4
| Old | → New | Rank | Stored in |
|---|---|---|---|
| `civilian` | `colaborador` | 0 | — (default) |
| `responder` | `coordinador` | 1 | `users/{email}` |
| `authority` + `command` | `organizador` | 2 | `adminUsers/{email}` |
| `sudo` | `fundador` | 3 | `adminUsers/{email}` |
- `fundador` is **seed-only** (not assignable from the admin portal).
- Touched: `types.ts` (`Role`/`AdminRole`/`ROLE_RANK`), `auth.ts`, `api.ts` (all gates/messages),
  `models.ts` (admin role enum), `seed.ts`. Client: `stores/session.ts`, `stores/admin.ts`, and
  all role gating + i18n (`roles.ts`, `verify.ts`, `admin.ts`, `welcome.ts`, `onboarding.ts`,
  `about.ts`, `announcements.ts`, components).
- **Migration:** `firebase/functions/src/migrations/001-roles.ts` — idempotent, emulator-only,
  run via `npm run migrate:roles`. Maps existing `adminUsers`/`users` docs to the new roles.

### WS2 — Hubs → coordinator "zonas"
- Creating a zone + managing its inventory dropped from `authority` to **`coordinador` owner**
  (ownership enforced server-side by `isHubCoordinator`: organizador, `createdBy`, or the
  `coordinators` subcollection). `Organizador+` oversees all and **assigns** coordinators.
- `POST /hubs/:id/coordinators` now assigns **field Coordinadores** (from `users/`), not admins.
- UI rename "hub/centro" → **"zona/punto"** (i18n only; the Firestore model stays `resourceHubs`).
- Client manage gating moved from role-blanket to ownership (`HubsPage`/`HubDetailPage`/`HubManagePage`).

### WS3 — Need lifecycle
- An **inventory item is a need** with a state machine: `abierta → tomada → confirmada`
  (`reabierta` = back to `abierta`). Fields added to `InventoryItem`: `status`, `claimedBy/Name/At`,
  `confirmedBy/Name/At`, `proofUrl?`, `reopenedCount`, `reopenedByName`; plus derived `staleClaim`
  (a `tomada` need unconfirmed after **2 days**).
- Endpoints (in `api.ts`): `POST /needs/:id/claim` (Colaborador+, idempotent — rejects if not open),
  `POST /needs/:id/confirm` (zone coordinator only; the claimer can't confirm),
  `POST /needs/:id/reopen` (zone coordinator). The `:id` is resolved via a Firestore
  `collectionGroup('inventory')` query; `hubId` comes from the parent path.
- **No money/payment fields, ever.**
- Prod-only index: `firebase/firestore.indexes.json` (collection-group `inventory.id`), wired in
  `firebase.json`. The emulator doesn't need it.
- Client: `stores/hubs.ts` (`claimNeed`/`confirmNeed`/`reopenNeed`), need UI on `HubDetailPage`,
  i18n in `hubs.ts`.

### WS4 — Park SAR, disconnect from client
- `parked/sar-engine` branch holds the full engine. On `refocus-v1`, the client was **disconnected**
  (not deleted): `router/index.ts` removed `/` (incident map), `/incidents/:id`, `/report`, `/people`;
  `AppShell` nav trimmed. SAR pages (`MapPage`, `IncidentDetailPage`, `ReportPage`, `PeoplePage`),
  `lib/triage.ts`, and `missing`/`patients`/`buildings` stores became unreferenced (tree-shaken).
- **Backend SAR endpoints are kept intact** (`/reports`, `/missing`, `/location-requests`,
  `/patients`, image/panic AI, clustering). Announcements kept (user's call — revisit in WS5).

### WS5 — Redesigned Home (Phase A done)
- Source: Claude Design handoff at [`design/Home-Suministros.dc.html`](design/Home-Suministros.dc.html).
  (The `claude_design` MCP could not connect — endpoint turned down + `/design-login` needs an
  interactive terminal — so the user downloaded the handoff bundle instead.)
- **New files:**
  - `app/src/components/NeedCard.vue` — the need card in 4 states, role-aware actions.
  - `app/src/pages/NeedsHomePage.vue` — the Home at `/`: Colaborador feed (search + filters +
    empty state) and Coordinador "Mi zona" view.
  - `app/src/pages/MyActivityPage.vue` — `/me`, **stub** (fleshed out in Phase C).
  - `app/src/i18n/locales/pages/home.ts` — new i18n namespace.
- **Theme:** warm tokens + Plus Jakarta Sans via `.supply-theme` (`main.css` + `index.html`).
  `MaterialIcon` gained a `fill` prop.
- **Nav:** `AppShell` bottom-tab restyled to **Necesidades / Zonas / Mi actividad / Organizar**
  (Organizar = Organizador+). Desktop sidebar keeps the fuller set.
- **Backend:** `GET /hubs` now also returns `confirmedByName`/`reopenedByName` and `mineClaim`/
  `mineConfirm` flags (without leaking emails).
- **Demo seed:** `seedSupplyDemo()` in `seed.ts` (run by `npm run seed`, emulator-only, idempotent)
  creates demo coordinators, 2 zones, and 6 needs covering all 4 states + a logistics announcement.

**Pending in WS5:** Phase B (real Leaflet map toggle — currently a placeholder), Phase C (full "Mi
actividad"), and a later restyle pass over the remaining screens (Zonas/Alertas/Guías/Admin/onboarding),
which still use the old slate styling.

---

## 5. Running it locally (WSL)

Dev runs in **WSL**, Node 22 via nvm (`nvm use 22`), JDK 21 for the emulators. Three things run:

```bash
# Terminal A — emulators (must be up first). Use the direct command (the npm wrapper had a
# concurrently issue). Firestore does NOT persist across restarts.
cd /mnt/c/Development/AyudaTerremoto/firebase
firebase emulators:start --only functions,firestore,auth --project demo-app

# Terminal B — web app (Vite on :5173)
cd /mnt/c/Development/AyudaTerremoto/app && npm run dev

# Terminal C — build backend + seed demo data + make yourself Fundador (one-off; `npm run seed`
# runs `npm run build` first, so it also reloads the API).
cd /mnt/c/Development/AyudaTerremoto/firebase/functions && npm run seed -- luisger94@gmail.com
```

Then open http://localhost:5173. Sign in at `/verify` (the Auth emulator shows a fake account
chooser). To see the Coordinador "Mi zona" view, sign in as a seeded coordinator
(`maria@demo.com`); as `luisger94` (Fundador) you see the full feed with coordinator controls.

**Notes**
- Per `CLAUDE.md`, do not run `vite build`/`cap sync`. `npm run build` in `functions/` is fine and
  type-checks the backend.
- The compiled `firebase/functions/lib/` is checked into git (repo convention) and is kept in sync.
- Demo over the LAN works from a phone; over ngrok the UI loads but data fails (the app calls the
  emulator at `127.0.0.1`, and HTTPS→HTTP localhost is blocked as mixed content). Use the LAN URL
  for same-network demos.

---

## 6. Open threads / next session
- **WS5 Phase B:** wire the List/Map toggle to a real Leaflet map of zones/needs + bottom sheet.
- **WS5 Phase C:** build out `MyActivityPage` (claimed/confirmed needs + offline queue).
- **Restyle pass:** bring Zonas/Alertas/Guías/Admin/onboarding to the warm design.
- **Optional robustness:** wrap the Auth-emulator connect in `firebase.ts` (client) in try/catch so
  a mixed-content failure degrades gracefully instead of white-screening (only matters for ngrok).
- **Decision still open from WS2:** hub coordinator-list display semantics may need a revisit.
- Full front-end type-check (`npm run build` in `app/`) had not been run as of this handoff — worth
  doing to catch any vue-tsc issues in the new WS5 files.
