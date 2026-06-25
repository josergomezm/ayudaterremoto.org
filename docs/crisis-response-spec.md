# Venezuela Crisis Response System
### Technical & Functional Specification

---

## Overview

A decentralized crisis-response platform for earthquake relief. The system scales through a verified chain of trust rather than a central admin bottleneck, verifies users against national identity records, captures panic-resistant reports, and uses AI to deduplicate and prioritize incidents. It is designed to function under degraded connectivity.

**Roles:** Civilian → Responder → Authority → Command (see [Section 8](#8-role-summary)).

---

## 1. Trust & Vouching — The Scaling Engine

The system runs on a decentralized **Chain of Trust**: a verified hierarchy replaces a single-admin bottleneck.

**The chain:**
Command/Authority vouch for Community Leads → Community Leads vouch for Responders.

**The handshake:**

1. An admin generates a unique, single-use **VouchCode** (random 8-character string) from their dashboard.
2. The admin sends the code to the volunteer via WhatsApp (as text, QR code, or deep link).

**Activation:**

1. The volunteer opens the app, enters their Cédula, and verifies their identity ([Section 2](#2-verification--the-gateway)).
2. They enter the VouchCode.
3. The system validates the code, applies the **Responder** role, and marks the code **Used**.

**Audit log (accountability):**
Every vouch is written to a permanent `vouch_audit_log` table:

| Field | Description |
|---|---|
| `voucher_id` | Cédula of the person who issued the code |
| `vouchee_id` | Cédula of the volunteer who redeemed it |
| `timestamp` | Time of redemption |

**Bad-actor mitigation:**
If a volunteer causes problems, an admin filters the audit log by that Cédula, identifies who vouched for them, and can immediately revoke the voucher's ability to issue new codes.

---

## 2. Verification — The Gateway

**Cédula identity check:**
A server-side wrapper queries the Cédula API to confirm identity. The intended provider is **CedulaVE-API** (`megacreativo/cedulave-api`) — see the [API Reality Check](#9-api-reality-check--cedulave) before committing to it.

The API returns: `nac`, `dni`, `name`, `lastname`, `fullname`, plus the voter's registered **voting center** (`state`, `municipality`, `parish`, `voting`, `address`).

> ⚠️ **`address` is the voting-center address, not the person's home.** Do not use it as a location for reports.

**Name-match challenge (anti-spoofing):**

- Input: `V-12345678`
- API returns: `Jose Perez`
- The frontend displays a randomized 4×5 grid of names; the correct name (`Jose Perez`) is one of them. Decoy names should be plausible (similar length/origin) to resist guessing.
- Selecting the wrong name logs a **Verification Failed** event and triggers an exponential-backoff cooldown.

**Tokenization:**
On success, the server issues an encrypted device-local token. No passwords are used. If the user clears their browser or app data, they must re-verify via Cédula.

> **Token lifecycle (gap):** Define expiry, refresh, and a remote **revocation** path for lost/stolen devices. Define behavior on shared devices.

---

## 3. Reporting Flows — Panic-Proof Architecture

### A. Personal report (self-reporting)

1. **Category** — one of four: Medical, Structural, Obstruction, Resource.
2. **Triage wizard** — 3–5 yes/no questions (e.g., "Is anyone trapped?", "Are they breathing?", "Is there a gas smell?").
3. **Submission** — coordinates plus a standardized triage level.

### B. Proxy report — the "my neighbor" scenario

1. **Intent** — user selects "I am reporting for someone else."
2. **Identity bypass** — the system does *not* request the victim's Cédula. It collects:
   - **Name or description** (optional): e.g., "Sr. Carlos" or "Vecino Apt 4B."
   - **Location**: manually drop a pin on the map.
   - **Context**: e.g., "Stuck on the 3rd floor; I am outside."
3. **Validation** — the report is tagged `[PROXY_REPORT]` so responders know the location and identity may be approximate.

---

## 4. Triage & Accountability — The "Don't Search Twice" Logic

**Building status (Authority view):**
Authority-level users get an **Assessment** map mode with three markers:

| Marker | Meaning |
|---|---|
| 🟢 Green | Safe |
| 🟡 Yellow | Caution |
| 🔴 Red | Insecure |

**Evacuation flag:**
If a civilian reports "Everyone is out safely," the system auto-tags the pin with a persistent `[EVACUATED / DO NOT SEARCH]` badge, visible to all responders.

**Rule:** Once a pin is marked `[EVACUATED]`, it moves to a **Cleared Sites** map layer and is removed from the active search queue.

---

## 5. Official Announcements — The Megaphone

**Permissions:** Only **Command** can broadcast.

**Persistence:** Alerts appear as a non-dismissable banner at the top of the screen.

**Categories:**

- **Urgent** — e.g., "Aftershock imminent."
- **Logistics** — e.g., "Water station open at X."
- **Correction** — e.g., "Rumor control: the bridge is NOT collapsed."

---

## 6. Resilience — Offline Strategy

**Reporting:** All submissions are saved locally to IndexedDB.

**Sync:** On reconnect, a `sync_reports()` function pushes local logs to the database in order.

**Offline UX:** A clear banner reads — *"System offline: reports saved locally. Syncing on reconnect."*

---

## 7. AI Integration — The Hidden Net

**Chaos clustering:**
The backend groups nearby reports (within a shared lat/lng radius) into a single **Master Incident**, preventing dozens of responders from converging on the same location.

**Panic misclassification:**
NLP scans the description field. If a report is marked Green but contains keywords such as "gas," "fire," or "trapped," the AI upgrades its priority to **High** and flags it on the admin dashboard.

**Resolution verification:**
When a responder marks a ticket **Resolved**, the system asks the original reporter: *"The responder says this is fixed. Did it resolve your problem? (Yes/No)."* This prevents tickets from being closed prematurely.

---

## 8. Role Summary

| Role | Verification | Capabilities |
|---|---|---|
| **Civilian** | Cédula + name test | Report, view Safe Map, read announcements |
| **Responder** | Vouched by admin | Claim reports, escalate, post structural updates |
| **Authority** | Manual admin approval | Structural assessment, mark relief hubs, close tickets |
| **Command** | Root / system admin | Broadcast alerts, manage roles, audit vouch logs |

---

## 9. API Reality Check — CedulaVE

**There is no official CNE API.** The CNE only exposes a public web form ("Consulta de tu Registro Electoral"). Every programmatic option — including CedulaVE-API — works by scraping that same form. So the question isn't "find a better source"; there isn't one. The question is **who owns the scrape and how it degrades.**

**Recommended architecture: self-hosted scrape + cache, community API as fallback.**

1. **Own the scrape.** Run your own server-side wrapper against the CNE portal. This keeps you alive when the free community relay (`api.megacreativo.com`) is down or rate-limited.
2. **Cache aggressively.** A Cédula→name mapping never changes. Cache every successful lookup permanently — it serves repeat verifications and feeds the name-match decoy pool without re-hitting the source.
3. **CedulaVE-API as fallback only.** If your own scrape fails, fall back to the community endpoint, then to degraded mode.
4. **Degraded mode is mandatory.** Assume the CNE portal is unreachable during the post-quake surge — exactly when you need it. **Vouch-only onboarding must work with zero identity API.**

Wrap all of this behind a single internal `IdentityProvider` interface so the app logic never knows or cares which source answered.

| Concern | Reality | Mitigation |
|---|---|---|
| **No official source** | CNE offers only a web form; all APIs scrape it. The form itself is frequently down. | Self-host the scrape + cache; don't depend on one relay. |
| **Single point of failure** | If the only source is unreachable (likely under load), verification breaks for everyone. | Layered fallback: own scrape → community API → vouch-only degraded mode. |
| **Stack mismatch** | CedulaVE-API is PHP; your app is JS/web. | Call the source over HTTP from your own backend. Never call any identity source from the client. |
| **Coverage gaps** | Only **CNE-registered voters (18+)** resolve. Minors, unregistered, and some foreign nationals 404. | Vouch-based fallback so non-registered people aren't locked out. |
| **Privacy & legality** | You are querying citizens' personal/electoral data. | Store only a verification flag + hashed Cédula, not full records. Get consent at onboarding. Confirm legal basis before launch. |

**Error handling (from CedulaVE-API):** `404` not registered, `301` bad nationality (`[V|E]` only), `302/303` non-numeric input. Map each to a clear message and route `404` to the vouch fallback, not a dead end.

---

## 10. Gaps & Risks

Prioritized issues the current spec doesn't yet address.

### High priority

- **Offline maps.** Reporting depends on dropping pins, but the offline strategy only covers report submission. Pre-cache map tiles for the affected region so the map works with no connectivity.
- **Geolocation accuracy.** GPS is unreliable indoors and inside collapsed structures. Always allow manual pin adjustment and show an accuracy radius.
- **Responder safety.** A responder claims an incident and walks into a damaged building — with no check-in. Add a **check-in / dead-man timer**: if a responder doesn't check back in, escalate to Command.
- **Notification delivery.** The spec never says how responders learn about new incidents or announcements. Define push notifications with an **SMS fallback** for degraded networks.
- **Offline vouching.** VouchCodes are delivered over WhatsApp, which may be down. Support **in-person QR handoff** that validates once the device reconnects.
- **Sync conflicts.** Two responders editing the same incident offline will collide. Define conflict resolution (last-write-wins is unsafe here — prefer append-only event logs).

### Medium priority

- **Report abuse / flooding.** No rate limiting on submissions. Add per-user/device throttles and a trust score; weight reports from vouched users higher.
- **Resolution verification breaks for proxy reports.** Proxy reports have no reachable original reporter. Define an alternate confirmation (e.g. a second responder or Authority sign-off).
- **Clustering false merges.** Radius-based clustering can merge genuinely distinct incidents (e.g. two apartments). Let responders split a Master Incident.
- **Dispatch logic.** Nothing assigns responders to incidents — it's pull-only ("claim"). Consider suggested-assignment by proximity and capability to avoid gaps and pile-ups.
- **Capacity & load.** Earthquakes produce traffic spikes. Confirm backend autoscaling and a submission queue.

### Lower priority / policy

- **Data retention & deletion.** Define how long personal data and reports are kept, and a purge policy after the response ends.
- **Triage standard.** Align the yes/no wizard to an established field-triage protocol (START / SALT) so output is interoperable with professional responders.
- **Accessibility & language.** Spanish-first, with low-literacy and screen-reader support (see UI/UX below).

---

## 11. Scope Enhancements (Proposed)

Capabilities not in the current draft that are high-value in earthquake response:

- **Missing persons / family reunification.** A registry where people can post "looking for" entries and mark themselves "I am safe," cross-referenced against reports. This is one of the most-used features in real disasters.
- **Resource matching.** The "Resource" report category currently has nowhere to go. Connect needs (water, insulin, blankets) to relief hubs marked by Authorities, with simple supply/demand status.
- **SMS / USSD fallback channel.** Many users post-quake have a feature phone or no data. A basic SMS gateway for reporting and receiving alerts dramatically widens reach.
- **Shelter & hub directory.** A civilian-facing map layer of open shelters, water stations, and medical points (ties into the Megaphone "Logistics" category).
- **Situation dashboard for Command.** Aggregate view: open incidents by severity, responder positions, cleared sites, announcement reach — for coordination decisions.

---

## 12. UI/UX Principles

The system's users are stressed, possibly injured, on cracked screens in bad lighting. Design for the worst case.

**Panic-proof interaction**

- One primary action per screen; large touch targets operable one-thumb.
- The triage wizard shows **one question per screen** with oversized Yes/No buttons.
- Minimize required fields; never block a report on optional data.
- Confirmation + **undo** on irreversible actions (e.g. marking a pin `[EVACUATED]`).

**Legibility & accessibility**

- Never rely on color alone. Green/Yellow/Red markers must also carry an **icon and text label** (color-blindness, sunlight).
- High-contrast, large default type; respect OS text-scaling.
- Spanish-first copy. Support low literacy with icons and optional **voice input** for descriptions.

**Trust & status signals**

- Always show the user's role and, for responders, their vouch chain.
- Render `[PROXY_REPORT]` and `[EVACUATED / DO NOT SEARCH]` as bold, unmistakable badges.
- Clear connectivity states: an explicit **offline banner**, per-report "saved locally / syncing / synced" status, and visible sync progress.

**Map UX**

- Cluster dense pins; filter by category and severity.
- Distinct visual layers for active, cleared, and proxy incidents.
- Responder view: claimed incidents, turn-by-turn navigation, and the check-in control surfaced prominently.

**Resilience UX**

- A **battery/data-saver mode** (reduced tile fidelity, deferred sync).
- Graceful degradation: every core action (report, verify, view map) must have a usable offline state.
