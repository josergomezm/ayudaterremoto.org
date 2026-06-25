import { onRequest, type Request } from "firebase-functions/v2/https";
import { logger } from "firebase-functions/v2";
import { defineSecret } from "firebase-functions/params";
import { randomBytes, randomUUID } from "node:crypto";
import { ZodError } from "zod";

import { applyCors } from "./helpers/cors";
import { activeProvider, buildNameOptions } from "./identity/provider";
import { assessReport, severityToLevel, distanceMeters } from "./ai";
import { db } from "./firebase";
import { getActor, getFirebaseUser, hasRole } from "./auth";
import { logAudit } from "./audit";

// Gemini API key — provisioned via Google Secret Manager (firebase functions
// secrets). Locally, set it in firebase/functions/.secret.local. Force redeploy.
const GEMINI_API_KEY = defineSecret("GEMINI_API_KEY");

const CLUSTER_RADIUS_M = 60;
const IS_EMULATOR = process.env.FUNCTIONS_EMULATOR === "true";

function statusForLevel(level: number): "red" | "yellow" | "green" {
  return level <= 2 ? "red" : level === 3 ? "yellow" : "green";
}

function normUnit(u?: string): string {
  return (u ?? "").trim().toLowerCase();
}

/**
 * Suggest a Master Incident to merge into — conservative on purpose, because a
 * wrong merge can hide victims (e.g. different floors of one tower). A new report
 * only joins an existing one when ALL hold: same category, both precise GPS
 * (approximate/fallback pins never merge), same floor/unit (or both blank), and
 * within CLUSTER_RADIUS_M. Otherwise it starts its own cluster.
 */
async function resolveClusterId(
  lat: number, lng: number, category: string, precise: boolean, unit: string | undefined, ownId: string,
): Promise<string> {
  if (!precise) return ownId; // fallback pin → never auto-merge
  const u = normUnit(unit);
  const q = await db.collection("incidents").get();
  for (const d of q.docs) {
    const i = d.data() as Incident;
    if (i.evacuated || i.category !== category || !i.clusterId) continue;
    if (i.locationPrecise === false) continue;   // don't merge into an approximate pin
    if (normUnit(i.unit) !== u) continue;         // different floor/unit ⇒ different incident
    if (distanceMeters(lat, lng, i.lat, i.lng) <= CLUSTER_RADIUS_M) return i.clusterId;
  }
  return ownId;
}
import type {
  Incident, Announcement, VouchCode, PendingChallenge, AdminUser, FieldSession, AccessRequest, MissingPerson,
} from "./types";
import {
  echoSchema, verifyLookupSchema, verifyConfirmSchema,
  reportSchema, statusSchema, resolutionConfirmSchema, announcementSchema,
  adminUserSchema, adminEmailSchema, accessRequestSchema, missingPersonSchema, missingFoundSchema,
} from "./models";

const CHALLENGE_TTL_MS = 5 * 60 * 1000;

function publicIncident(i: Incident) {
  // reporterId and reporterName are never sent in public payloads.
  const { reporterId, reporterName, ...rest } = i;
  void reporterId; void reporterName;
  return rest;
}

function newVouchCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no ambiguous 0/O/1/I
  return Array.from(randomBytes(8), (b) => alphabet[b % alphabet.length]).join("");
}

export const api = onRequest({ region: "us-central1", maxInstances: 10, secrets: [GEMINI_API_KEY] }, async (req, res) => {
  applyCors(req, res);
  if (req.method === "OPTIONS") { res.status(204).send(""); return; }

  const send = (status: number, body: unknown): void => { res.status(status).json(body); };

  const rawPath = (req.path || "/").replace(/\/+$/, "") || "/";
  const path = rawPath.replace(/^\/api/, "") || "/";
  const seg = path.split("/").filter(Boolean);
  const m = req.method;

  try {
    // ── Health ───────────────────────────────────────────────────────────
    if (m === "GET" && path === "/health") {
      return send(200, { ok: true, ts: new Date().toISOString() });
    }
    if (m === "POST" && path === "/echo") {
      return send(200, { success: true, echoed: echoSchema.parse(req.body) });
    }

    // ── Verification step 1: lookup + name-match grid ────────────────────
    if (m === "POST" && path === "/verify/lookup") {
      const { nac, dni } = verifyLookupSchema.parse(req.body);
      const record = await activeProvider.lookup(nac, dni);
      if (!record) {
        return send(404, { error: "not_registered", message: "Cédula no inscrita. Use el código de aval.", fallback: "vouch" });
      }
      const challengeId = randomUUID();
      const options = buildNameOptions(record.fullname, challengeId);
      const challenge: PendingChallenge = { dni, nac, correctName: record.fullname, expiresAt: Date.now() + CHALLENGE_TTL_MS };
      await db.doc(`challenges/${challengeId}`).set(challenge);
      // The correct name is deliberately NOT returned to the client — EXCEPT in
      // the emulator, where the CNE is stubbed and a tester can't know the
      // synthesized name. `hint` is never included in production.
      return send(200, { challengeId, options, ...(IS_EMULATOR ? { hint: record.fullname } : {}) });
    }

    // ── Verification step 2: confirm name, optionally redeem a vouch code ─
    if (m === "POST" && path === "/verify/confirm") {
      const { challengeId, selectedName, vouchCode } = verifyConfirmSchema.parse(req.body);
      const ref = db.doc(`challenges/${challengeId}`);
      const snap = await ref.get();
      if (!snap.exists) return send(410, { error: "challenge_expired", message: "Verificación expirada. Intente de nuevo." });
      const ch = snap.data() as PendingChallenge;
      if (ch.expiresAt < Date.now()) {
        await ref.delete();
        return send(410, { error: "challenge_expired", message: "Verificación expirada. Intente de nuevo." });
      }
      if (selectedName !== ch.correctName) {
        await ref.delete(); // single attempt → forces cooldown + re-lookup
        logger.warn("verification_failed", { dni: ch.dni });
        await logAudit({ id: ch.dni, role: "civilian", kind: "field" }, "verify_failed");
        return send(401, { error: "verification_failed", message: "Nombre incorrecto.", cooldownMs: 30000 });
      }

      let role: FieldSession["role"] = "civilian";
      if (vouchCode) {
        const codeRef = db.doc(`vouchCodes/${vouchCode.toUpperCase()}`);
        const codeSnap = await codeRef.get();
        const vc = codeSnap.exists ? (codeSnap.data() as VouchCode) : null;
        if (!vc || vc.used) return send(400, { error: "invalid_vouch_code", message: "Código de aval inválido o ya usado." });
        role = "responder"; // vouch codes only ever grant Responder
        await codeRef.update({ used: true });
        await db.collection("vouchAudit").add({ voucher: vc.voucher, voucheeDni: ch.dni, timestamp: new Date().toISOString() });
        await logAudit({ id: ch.dni, role, kind: "field" }, "vouch_redeem", { type: "vouchCode", id: vouchCode.toUpperCase() }, { voucher: vc.voucher });
      }

      await ref.delete();
      const token = randomUUID();
      const session: FieldSession = { dni: ch.dni, name: ch.correctName, role };
      await db.doc(`sessions/${token}`).set(session);
      await logAudit({ id: ch.dni, role, kind: "field" }, "verify_success", undefined, { role });
      return send(200, { token, role, name: ch.correctName });
    }

    // ── Admin: who am I (role gate for the portal) ───────────────────────
    if (m === "GET" && path === "/admin/me") {
      const actor = await getActor(req);
      if (!actor || actor.kind !== "admin") return send(403, { error: "forbidden" });
      return send(200, { role: actor.role, email: actor.id, name: actor.name });
    }

    // ── Self-service access request (any signed-in Google user) ──────────
    if (path === "/access-request") {
      const fbUser = await getFirebaseUser(req);
      if (!fbUser) return send(401, { error: "unauthenticated" });
      const ref = db.doc(`accessRequests/${fbUser.email}`);
      if (m === "POST") {
        const { note } = accessRequestSchema.parse(req.body);
        const reqDoc: AccessRequest = { email: fbUser.email, name: fbUser.name, note, requestedAt: new Date().toISOString() };
        await ref.set(reqDoc);
        await logAudit({ id: fbUser.email, role: "none", kind: "user" }, "access_request", { type: "accessRequest", id: fbUser.email });
        return send(200, { status: "pending" });
      }
      if (m === "GET") {
        const snap = await ref.get();
        return send(200, { status: snap.exists ? "pending" : null });
      }
    }

    // ── Access requests management (Command) ─────────────────────────────
    if (m === "GET" && path === "/admin/requests") {
      const actor = await getActor(req);
      if (!hasRole(actor, "command")) return send(403, { error: "forbidden" });
      const q = await db.collection("accessRequests").get();
      return send(200, { requests: q.docs.map((d) => d.data() as AccessRequest) });
    }
    if (m === "POST" && path === "/admin/requests/approve") {
      const actor = await getActor(req);
      if (!hasRole(actor, "command")) return send(403, { error: "forbidden" });
      const { email, role } = adminUserSchema.parse(req.body);
      const key = email.toLowerCase();
      await db.doc(`adminUsers/${key}`).set({ email: key, role });
      await db.doc(`accessRequests/${key}`).delete();
      await logAudit(actor, "access_approve", { type: "adminUser", id: key }, { role });
      return send(200, { user: { email: key, role } });
    }
    if (m === "POST" && path === "/admin/requests/deny") {
      const actor = await getActor(req);
      if (!hasRole(actor, "command")) return send(403, { error: "forbidden" });
      const { email } = adminEmailSchema.parse(req.body);
      await db.doc(`accessRequests/${email.toLowerCase()}`).delete();
      await logAudit(actor, "access_deny", { type: "accessRequest", id: email.toLowerCase() });
      return send(200, { denied: email.toLowerCase() });
    }

    // ── Vouch code generation (Authority+) ───────────────────────────────
    if (m === "POST" && path === "/vouch/generate") {
      const actor = await getActor(req);
      if (!hasRole(actor, "authority")) return send(403, { error: "forbidden", message: "Requiere rol Autoridad o Comando." });
      const code = newVouchCode();
      const doc: VouchCode = { code, used: false, voucher: actor!.id, createdAt: new Date().toISOString() };
      await db.doc(`vouchCodes/${code}`).set(doc);
      await logAudit(actor, "vouch_generate", { type: "vouchCode", id: code });
      return send(200, { code });
    }

    // ── Vouch audit log (Command) ────────────────────────────────────────
    if (m === "GET" && path === "/vouch/audit") {
      const actor = await getActor(req);
      if (!hasRole(actor, "command")) return send(403, { error: "forbidden" });
      const q = await db.collection("vouchAudit").orderBy("timestamp", "desc").limit(200).get();
      return send(200, { entries: q.docs.map((d) => d.data()) });
    }

    // ── Full activity / audit log (Command) ──────────────────────────────
    if (m === "GET" && path === "/admin/audit") {
      const actor = await getActor(req);
      if (!hasRole(actor, "command")) return send(403, { error: "forbidden" });
      const q = await db.collection("auditLog").orderBy("timestamp", "desc").limit(300).get();
      return send(200, { entries: q.docs.map((d) => d.data()) });
    }

    // ── Admin user management (Command) ──────────────────────────────────
    if (m === "GET" && path === "/admin/users") {
      const actor = await getActor(req);
      if (!hasRole(actor, "command")) return send(403, { error: "forbidden" });
      const q = await db.collection("adminUsers").get();
      return send(200, { users: q.docs.map((d) => d.data() as AdminUser) });
    }
    if (m === "POST" && path === "/admin/users") {
      const actor = await getActor(req);
      if (!hasRole(actor, "command")) return send(403, { error: "forbidden" });
      const { email, role } = adminUserSchema.parse(req.body);
      const key = email.toLowerCase();
      await db.doc(`adminUsers/${key}`).set({ email: key, role });
      await logAudit(actor, "admin_set", { type: "adminUser", id: key }, { role });
      return send(200, { user: { email: key, role } });
    }
    if (m === "POST" && path === "/admin/users/remove") {
      const actor = await getActor(req);
      if (!hasRole(actor, "command")) return send(403, { error: "forbidden" });
      const { email } = adminEmailSchema.parse(req.body);
      if (email.toLowerCase() === actor!.id) return send(400, { error: "self_remove", message: "No puede revocar su propio acceso." });
      await db.doc(`adminUsers/${email.toLowerCase()}`).delete();
      await logAudit(actor, "admin_remove", { type: "adminUser", id: email.toLowerCase() });
      return send(200, { removed: email.toLowerCase() });
    }

    // ── Reports (any authenticated actor) ────────────────────────────────
    if (m === "POST" && path === "/reports") {
      const actor = await getActor(req);
      if (!actor) return send(401, { error: "unauthenticated", message: "Verifíquese para reportar." });
      const r = reportSchema.parse(req.body);
      const id = randomUUID();
      const incident: Incident = {
        id, category: r.category, triageLevel: r.triageLevel,
        status: statusForLevel(r.triageLevel),
        lat: r.lat, lng: r.lng, description: r.description,
        unit: r.unit, locationPrecise: r.locationPrecise ?? true,
        isProxy: r.type === "proxy", subjectName: r.subjectName,
        subjectDetails: r.subjectDetails, lastSeen: r.lastSeen, contact: r.contact,
        reporterId: actor.id, reporterName: actor.name, evacuated: false, resolved: false, resolutionConfirmed: null,
        createdAt: new Date().toISOString(),
        clusterId: id,
      };

      // Suggest a Master Incident to merge into (conservative — see resolveClusterId).
      const precise = incident.locationPrecise ?? true;
      incident.clusterId = await resolveClusterId(r.lat, r.lng, r.category, precise, r.unit, id);

      // Gemini "hidden net" — escalate (never downgrade) if the text implies worse.
      let apiKey = "";
      try { apiKey = GEMINI_API_KEY.value(); } catch { apiKey = ""; }
      const ai = await assessReport({ description: r.description, category: r.category, declaredLevel: r.triageLevel, apiKey });
      if (ai?.escalate) {
        const aiLevel = severityToLevel(ai.severity);
        if (aiLevel < incident.triageLevel) {
          incident.triageLevel = aiLevel;
          incident.status = statusForLevel(aiLevel);
        }
        incident.aiFlagged = true;
        incident.aiSeverity = ai.severity;
        incident.aiReason = ai.reason;
      }

      await db.doc(`incidents/${id}`).set(incident);
      await logAudit(actor, "report_create", { type: "incident", id }, {
        category: incident.category, triageLevel: incident.triageLevel, isProxy: incident.isProxy, aiFlagged: incident.aiFlagged ?? false,
      });
      return send(201, { incident: publicIncident(incident) });
    }

    // ── Incidents list (public) ──────────────────────────────────────────
    if (m === "GET" && path === "/incidents") {
      const viewer = await getActor(req);
      const showReporters = hasRole(viewer, "responder"); // reporter names only for responders+
      const q = await db.collection("incidents").get();
      const all = q.docs.map((d) => d.data() as Incident);

      // Group into Master Incidents by clusterId (fall back to own id).
      const groups = new Map<string, Incident[]>();
      for (const i of all) {
        const key = i.clusterId ?? i.id;
        const arr = groups.get(key) ?? [];
        arr.push(i);
        groups.set(key, arr);
      }

      const clusters = [...groups.values()].map((members) => {
        // Representative = worst (lowest triageLevel), tie → earliest.
        const rep = [...members].sort((a, b) => a.triageLevel - b.triageLevel || a.createdAt.localeCompare(b.createdAt))[0];
        const reports = [...members]
          .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
          .map((mm) => ({
            id: mm.id,
            category: mm.category,
            description: mm.description,
            unit: mm.unit ?? null,
            createdAt: mm.createdAt,
            isProxy: mm.isProxy,
            aiFlagged: mm.aiFlagged ?? false,
            aiReason: mm.aiReason ?? null,
            reporter: showReporters ? (mm.reporterName ?? null) : undefined,
          }));
        return { ...publicIncident(rep), count: members.length, reports };
      });

      clusters.sort((a, b) => a.triageLevel - b.triageLevel);
      return send(200, { incidents: clusters });
    }

    // ── Incident sub-routes: /incidents/:id/... ──────────────────────────
    if (seg[0] === "incidents" && seg.length === 3) {
      const ref = db.doc(`incidents/${seg[1]}`);
      const snap = await ref.get();
      if (!snap.exists) return send(404, { error: "not_found", message: "Incidente no encontrado." });
      const incident = snap.data() as Incident;
      const action = seg[2];
      const actor = await getActor(req);

      if (m === "POST" && action === "status") {
        if (!hasRole(actor, "responder")) return send(403, { error: "forbidden" });
        const status = statusSchema.parse(req.body).status;
        await ref.update({ status });
        await logAudit(actor, "incident_status", { type: "incident", id: seg[1] }, { status });
        return send(200, { incident: publicIncident({ ...incident, status }) });
      }
      if (m === "POST" && action === "evacuate") {
        if (!actor) return send(401, { error: "unauthenticated" });
        await ref.update({ evacuated: true, status: "green" });
        await logAudit(actor, "incident_evacuate", { type: "incident", id: seg[1] });
        return send(200, { incident: publicIncident({ ...incident, evacuated: true, status: "green" }) });
      }
      if (m === "POST" && action === "resolve") {
        if (!hasRole(actor, "responder")) return send(403, { error: "forbidden" });
        await ref.update({ resolved: true, resolutionConfirmed: null });
        await logAudit(actor, "incident_resolve", { type: "incident", id: seg[1] });
        return send(200, { incident: publicIncident({ ...incident, resolved: true, resolutionConfirmed: null }) });
      }
      if (m === "POST" && action === "resolution") {
        if (!actor) return send(401, { error: "unauthenticated" });
        const confirmed = resolutionConfirmSchema.parse(req.body).confirmed;
        await ref.update({ resolutionConfirmed: confirmed });
        await logAudit(actor, "incident_resolution", { type: "incident", id: seg[1] }, { confirmed });
        return send(200, { incident: publicIncident({ ...incident, resolutionConfirmed: confirmed }) });
      }
    }

    // ── Missing persons (public read; verified report) ───────────────────
    if (m === "GET" && path === "/missing") {
      const viewer = await getActor(req); // may be null (public)
      const q = await db.collection("missingPersons").orderBy("createdAt", "desc").get();
      const people = q.docs.map((d) => {
        const { reporterId, ...rest } = d.data() as MissingPerson; // hide who reported
        // `mine` lets the reporter (only) see the "mark found" control, without
        // ever exposing reporterId to clients.
        return { ...rest, mine: !!viewer && viewer.id === reporterId };
      });
      return send(200, { people });
    }
    if (m === "POST" && path === "/missing") {
      const actor = await getActor(req);
      if (!actor) return send(401, { error: "unauthenticated", message: "Verifíquese para reportar." });
      const p = missingPersonSchema.parse(req.body);
      const id = randomUUID();
      // "Reported by" comes from the reporter's VERIFIED identity (name only —
      // never their Cédula), not from a form field.
      const person: MissingPerson = { id, ...p, contactName: actor.name, reporterId: actor.id, status: "missing", createdAt: new Date().toISOString() };
      await db.doc(`missingPersons/${id}`).set(person);
      await logAudit(actor, "missing_report", { type: "missingPerson", id }, { name: p.name });
      const { reporterId, ...pub } = person;
      void reporterId;
      return send(201, { person: pub });
    }
    if (m === "POST" && seg[0] === "missing" && seg.length === 3 && seg[2] === "found") {
      const actor = await getActor(req);
      if (!actor) return send(401, { error: "unauthenticated" });
      const ref = db.doc(`missingPersons/${seg[1]}`);
      const personSnap = await ref.get();
      if (!personSnap.exists) return send(404, { error: "not_found" });
      // Only the original reporter (matched by id) or a responder+ may close it.
      const person = personSnap.data() as MissingPerson;
      const isReporter = actor.id === person.reporterId;
      if (!isReporter && !hasRole(actor, "responder")) {
        return send(403, { error: "forbidden", message: "Solo el reportante o un brigadista puede marcarla." });
      }
      const { byPhone, note } = missingFoundSchema.parse(req.body || {});
      // Finder name comes from the verified identity, not a form field.
      const foundBy = { name: actor.name, phone: byPhone, note, role: actor.role, at: new Date().toISOString() };
      await ref.update({ status: "found", foundBy });
      await logAudit(actor, "missing_found", { type: "missingPerson", id: seg[1] }, { phone: byPhone });
      return send(200, { ok: true });
    }

    // ── Announcements ────────────────────────────────────────────────────
    if (m === "GET" && path === "/announcements") {
      const q = await db.collection("announcements").orderBy("createdAt", "desc").get();
      return send(200, { announcements: q.docs.map((d) => d.data() as Announcement) });
    }
    if (m === "POST" && path === "/announcements") {
      const actor = await getActor(req);
      if (!hasRole(actor, "command")) return send(403, { error: "forbidden", message: "Solo Comando puede transmitir." });
      const a = announcementSchema.parse(req.body);
      const id = randomUUID();
      const announcement: Announcement = { id, ...a, createdAt: new Date().toISOString() };
      await db.doc(`announcements/${id}`).set(announcement);
      await logAudit(actor, "announcement_broadcast", { type: "announcement", id }, { category: a.category });
      return send(201, { announcement });
    }
    // Clear an announcement (Command) — takes the banner down once it's stale.
    if (m === "DELETE" && seg[0] === "announcements" && seg.length === 2) {
      const actor = await getActor(req);
      if (!hasRole(actor, "command")) return send(403, { error: "forbidden" });
      await db.doc(`announcements/${seg[1]}`).delete();
      await logAudit(actor, "announcement_delete", { type: "announcement", id: seg[1] });
      return send(200, { deleted: seg[1] });
    }

    // ── Unknown route ────────────────────────────────────────────────────
    return send(404, {
      error: "route_not_found",
      message: `No route for ${m} ${path}`,
      routes: [
        "GET /health", "POST /echo",
        "POST /verify/lookup", "POST /verify/confirm",
        "GET /admin/me", "POST /vouch/generate", "GET /vouch/audit", "GET /admin/audit",
        "GET /admin/users", "POST /admin/users", "POST /admin/users/remove",
        "GET|POST /access-request", "GET /admin/requests",
        "POST /admin/requests/approve", "POST /admin/requests/deny",
        "POST /reports", "GET /incidents",
        "POST /incidents/:id/status", "POST /incidents/:id/evacuate",
        "POST /incidents/:id/resolve", "POST /incidents/:id/resolution",
        "GET /missing", "POST /missing", "POST /missing/:id/found",
        "GET /announcements", "POST /announcements", "DELETE /announcements/:id",
      ],
    });
  } catch (err) {
    if (err instanceof ZodError) return send(400, { error: "validation_failed", details: err.flatten() });
    logger.error("unhandled_error", err);
    return send(500, { error: "internal", message: "Unexpected server error." });
  }
});
