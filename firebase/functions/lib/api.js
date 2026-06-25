"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.api = void 0;
const https_1 = require("firebase-functions/v2/https");
const v2_1 = require("firebase-functions/v2");
const params_1 = require("firebase-functions/params");
const node_crypto_1 = require("node:crypto");
const zod_1 = require("zod");
const cors_1 = require("./helpers/cors");
const provider_1 = require("./identity/provider");
const ai_1 = require("./ai");
const firebase_1 = require("./firebase");
const auth_1 = require("./auth");
const audit_1 = require("./audit");
// Gemini API key — provisioned via Google Secret Manager (firebase functions
// secrets). Locally, set it in firebase/functions/.secret.local. Force redeploy.
const GEMINI_API_KEY = (0, params_1.defineSecret)("GEMINI_API_KEY");
const CLUSTER_RADIUS_M = 60;
const IS_EMULATOR = process.env.FUNCTIONS_EMULATOR === "true";
function statusForLevel(level) {
    return level <= 2 ? "red" : level === 3 ? "yellow" : "green";
}
function normUnit(u) {
    return (u ?? "").trim().toLowerCase();
}
/**
 * Suggest a Master Incident to merge into — conservative on purpose, because a
 * wrong merge can hide victims (e.g. different floors of one tower). A new report
 * only joins an existing one when ALL hold: same category, both precise GPS
 * (approximate/fallback pins never merge), same floor/unit (or both blank), and
 * within CLUSTER_RADIUS_M. Otherwise it starts its own cluster.
 */
async function resolveClusterId(lat, lng, category, precise, unit, ownId) {
    if (!precise)
        return ownId; // fallback pin → never auto-merge
    const u = normUnit(unit);
    const q = await firebase_1.db.collection("incidents").get();
    for (const d of q.docs) {
        const i = d.data();
        if (i.evacuated || i.category !== category || !i.clusterId)
            continue;
        if (i.locationPrecise === false)
            continue; // don't merge into an approximate pin
        if (normUnit(i.unit) !== u)
            continue; // different floor/unit ⇒ different incident
        if ((0, ai_1.distanceMeters)(lat, lng, i.lat, i.lng) <= CLUSTER_RADIUS_M)
            return i.clusterId;
    }
    return ownId;
}
const models_1 = require("./models");
const CHALLENGE_TTL_MS = 5 * 60 * 1000;
function publicIncident(i) {
    // reporterId and reporterName are never sent in public payloads.
    const { reporterId, reporterName, ...rest } = i;
    void reporterId;
    void reporterName;
    return rest;
}
function newVouchCode() {
    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no ambiguous 0/O/1/I
    return Array.from((0, node_crypto_1.randomBytes)(8), (b) => alphabet[b % alphabet.length]).join("");
}
exports.api = (0, https_1.onRequest)({ region: "us-central1", maxInstances: 10, secrets: [GEMINI_API_KEY] }, async (req, res) => {
    (0, cors_1.applyCors)(req, res);
    if (req.method === "OPTIONS") {
        res.status(204).send("");
        return;
    }
    const send = (status, body) => { res.status(status).json(body); };
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
            return send(200, { success: true, echoed: models_1.echoSchema.parse(req.body) });
        }
        // ── Verification step 1: lookup + name-match grid ────────────────────
        if (m === "POST" && path === "/verify/lookup") {
            const { nac, dni } = models_1.verifyLookupSchema.parse(req.body);
            const record = await provider_1.activeProvider.lookup(nac, dni);
            if (!record) {
                return send(404, { error: "not_registered", message: "Cédula no inscrita. Use el código de aval.", fallback: "vouch" });
            }
            const challengeId = (0, node_crypto_1.randomUUID)();
            const options = (0, provider_1.buildNameOptions)(record.fullname, challengeId);
            const challenge = { dni, nac, correctName: record.fullname, expiresAt: Date.now() + CHALLENGE_TTL_MS };
            await firebase_1.db.doc(`challenges/${challengeId}`).set(challenge);
            // The correct name is deliberately NOT returned to the client — EXCEPT in
            // the emulator, where the CNE is stubbed and a tester can't know the
            // synthesized name. `hint` is never included in production.
            return send(200, { challengeId, options, ...(IS_EMULATOR ? { hint: record.fullname } : {}) });
        }
        // ── Verification step 2: confirm name, optionally redeem a vouch code ─
        if (m === "POST" && path === "/verify/confirm") {
            const { challengeId, selectedName, vouchCode } = models_1.verifyConfirmSchema.parse(req.body);
            const ref = firebase_1.db.doc(`challenges/${challengeId}`);
            const snap = await ref.get();
            if (!snap.exists)
                return send(410, { error: "challenge_expired", message: "Verificación expirada. Intente de nuevo." });
            const ch = snap.data();
            if (ch.expiresAt < Date.now()) {
                await ref.delete();
                return send(410, { error: "challenge_expired", message: "Verificación expirada. Intente de nuevo." });
            }
            if (selectedName !== ch.correctName) {
                await ref.delete(); // single attempt → forces cooldown + re-lookup
                v2_1.logger.warn("verification_failed", { dni: ch.dni });
                await (0, audit_1.logAudit)({ id: ch.dni, role: "civilian", kind: "field" }, "verify_failed");
                return send(401, { error: "verification_failed", message: "Nombre incorrecto.", cooldownMs: 30000 });
            }
            let role = "civilian";
            if (vouchCode) {
                const codeRef = firebase_1.db.doc(`vouchCodes/${vouchCode.toUpperCase()}`);
                const codeSnap = await codeRef.get();
                const vc = codeSnap.exists ? codeSnap.data() : null;
                if (!vc || vc.used)
                    return send(400, { error: "invalid_vouch_code", message: "Código de aval inválido o ya usado." });
                role = "responder"; // vouch codes only ever grant Responder
                await codeRef.update({ used: true });
                await firebase_1.db.collection("vouchAudit").add({ voucher: vc.voucher, voucheeDni: ch.dni, timestamp: new Date().toISOString() });
                await (0, audit_1.logAudit)({ id: ch.dni, role, kind: "field" }, "vouch_redeem", { type: "vouchCode", id: vouchCode.toUpperCase() }, { voucher: vc.voucher });
            }
            await ref.delete();
            const token = (0, node_crypto_1.randomUUID)();
            const session = { dni: ch.dni, name: ch.correctName, role };
            await firebase_1.db.doc(`sessions/${token}`).set(session);
            await (0, audit_1.logAudit)({ id: ch.dni, role, kind: "field" }, "verify_success", undefined, { role });
            return send(200, { token, role, name: ch.correctName });
        }
        // ── Admin: who am I (role gate for the portal) ───────────────────────
        if (m === "GET" && path === "/admin/me") {
            const actor = await (0, auth_1.getActor)(req);
            if (!actor || actor.kind !== "admin")
                return send(403, { error: "forbidden" });
            return send(200, { role: actor.role, email: actor.id, name: actor.name });
        }
        // ── Self-service access request (any signed-in Google user) ──────────
        if (path === "/access-request") {
            const fbUser = await (0, auth_1.getFirebaseUser)(req);
            if (!fbUser)
                return send(401, { error: "unauthenticated" });
            const ref = firebase_1.db.doc(`accessRequests/${fbUser.email}`);
            if (m === "POST") {
                const { note } = models_1.accessRequestSchema.parse(req.body);
                const reqDoc = { email: fbUser.email, name: fbUser.name, note, requestedAt: new Date().toISOString() };
                await ref.set(reqDoc);
                await (0, audit_1.logAudit)({ id: fbUser.email, role: "none", kind: "user" }, "access_request", { type: "accessRequest", id: fbUser.email });
                return send(200, { status: "pending" });
            }
            if (m === "GET") {
                const snap = await ref.get();
                return send(200, { status: snap.exists ? "pending" : null });
            }
        }
        // ── Access requests management (Command) ─────────────────────────────
        if (m === "GET" && path === "/admin/requests") {
            const actor = await (0, auth_1.getActor)(req);
            if (!(0, auth_1.hasRole)(actor, "command"))
                return send(403, { error: "forbidden" });
            const q = await firebase_1.db.collection("accessRequests").get();
            return send(200, { requests: q.docs.map((d) => d.data()) });
        }
        if (m === "POST" && path === "/admin/requests/approve") {
            const actor = await (0, auth_1.getActor)(req);
            if (!(0, auth_1.hasRole)(actor, "command"))
                return send(403, { error: "forbidden" });
            const { email, role } = models_1.adminUserSchema.parse(req.body);
            const key = email.toLowerCase();
            await firebase_1.db.doc(`adminUsers/${key}`).set({ email: key, role });
            await firebase_1.db.doc(`accessRequests/${key}`).delete();
            await (0, audit_1.logAudit)(actor, "access_approve", { type: "adminUser", id: key }, { role });
            return send(200, { user: { email: key, role } });
        }
        if (m === "POST" && path === "/admin/requests/deny") {
            const actor = await (0, auth_1.getActor)(req);
            if (!(0, auth_1.hasRole)(actor, "command"))
                return send(403, { error: "forbidden" });
            const { email } = models_1.adminEmailSchema.parse(req.body);
            await firebase_1.db.doc(`accessRequests/${email.toLowerCase()}`).delete();
            await (0, audit_1.logAudit)(actor, "access_deny", { type: "accessRequest", id: email.toLowerCase() });
            return send(200, { denied: email.toLowerCase() });
        }
        // ── Vouch code generation (Authority+) ───────────────────────────────
        if (m === "POST" && path === "/vouch/generate") {
            const actor = await (0, auth_1.getActor)(req);
            if (!(0, auth_1.hasRole)(actor, "authority"))
                return send(403, { error: "forbidden", message: "Requiere rol Autoridad o Comando." });
            const code = newVouchCode();
            const doc = { code, used: false, voucher: actor.id, createdAt: new Date().toISOString() };
            await firebase_1.db.doc(`vouchCodes/${code}`).set(doc);
            await (0, audit_1.logAudit)(actor, "vouch_generate", { type: "vouchCode", id: code });
            return send(200, { code });
        }
        // ── Vouch audit log (Command) ────────────────────────────────────────
        if (m === "GET" && path === "/vouch/audit") {
            const actor = await (0, auth_1.getActor)(req);
            if (!(0, auth_1.hasRole)(actor, "command"))
                return send(403, { error: "forbidden" });
            const q = await firebase_1.db.collection("vouchAudit").orderBy("timestamp", "desc").limit(200).get();
            return send(200, { entries: q.docs.map((d) => d.data()) });
        }
        // ── Full activity / audit log (Command) ──────────────────────────────
        if (m === "GET" && path === "/admin/audit") {
            const actor = await (0, auth_1.getActor)(req);
            if (!(0, auth_1.hasRole)(actor, "command"))
                return send(403, { error: "forbidden" });
            const q = await firebase_1.db.collection("auditLog").orderBy("timestamp", "desc").limit(300).get();
            return send(200, { entries: q.docs.map((d) => d.data()) });
        }
        // ── Admin user management (Command) ──────────────────────────────────
        if (m === "GET" && path === "/admin/users") {
            const actor = await (0, auth_1.getActor)(req);
            if (!(0, auth_1.hasRole)(actor, "command"))
                return send(403, { error: "forbidden" });
            const q = await firebase_1.db.collection("adminUsers").get();
            return send(200, { users: q.docs.map((d) => d.data()) });
        }
        if (m === "POST" && path === "/admin/users") {
            const actor = await (0, auth_1.getActor)(req);
            if (!(0, auth_1.hasRole)(actor, "command"))
                return send(403, { error: "forbidden" });
            const { email, role } = models_1.adminUserSchema.parse(req.body);
            const key = email.toLowerCase();
            await firebase_1.db.doc(`adminUsers/${key}`).set({ email: key, role });
            await (0, audit_1.logAudit)(actor, "admin_set", { type: "adminUser", id: key }, { role });
            return send(200, { user: { email: key, role } });
        }
        if (m === "POST" && path === "/admin/users/remove") {
            const actor = await (0, auth_1.getActor)(req);
            if (!(0, auth_1.hasRole)(actor, "command"))
                return send(403, { error: "forbidden" });
            const { email } = models_1.adminEmailSchema.parse(req.body);
            if (email.toLowerCase() === actor.id)
                return send(400, { error: "self_remove", message: "No puede revocar su propio acceso." });
            await firebase_1.db.doc(`adminUsers/${email.toLowerCase()}`).delete();
            await (0, audit_1.logAudit)(actor, "admin_remove", { type: "adminUser", id: email.toLowerCase() });
            return send(200, { removed: email.toLowerCase() });
        }
        // ── Analyze image and create report (Command only) ───────────────────
        if (m === "POST" && path === "/reports/analyze-image") {
            const actor = await (0, auth_1.getActor)(req);
            if (!actor || !(0, auth_1.hasRole)(actor, "command"))
                return send(403, { error: "forbidden" });
            const { imageUrl, imageBase64, context, lat, lng } = req.body;
            if (!imageUrl && !imageBase64) {
                return send(400, { error: "missing_image", message: "Debe proporcionar imageUrl o imageBase64." });
            }
            let base64Data = "";
            let mimeType = "image/jpeg";
            if (imageBase64) {
                if (imageBase64.startsWith("data:")) {
                    const match = imageBase64.match(/^data:([^;]+);base64,(.+)$/);
                    if (!match) {
                        return send(400, { error: "invalid_base64", message: "Formato de URI de datos base64 inválido." });
                    }
                    mimeType = match[1];
                    base64Data = match[2];
                }
                else {
                    base64Data = imageBase64;
                }
            }
            else if (imageUrl) {
                try {
                    const res = await fetch(imageUrl);
                    if (!res.ok) {
                        return send(400, {
                            error: "failed_to_fetch_image",
                            message: `No se pudo obtener la imagen del URL (status ${res.status}).`,
                        });
                    }
                    mimeType = res.headers.get("content-type") || "image/jpeg";
                    const arrayBuffer = await res.arrayBuffer();
                    base64Data = Buffer.from(arrayBuffer).toString("base64");
                }
                catch (e) {
                    return send(400, {
                        error: "failed_to_fetch_image",
                        message: "Error al descargar la imagen: " + (e instanceof Error ? e.message : String(e)),
                    });
                }
            }
            let apiKey = "";
            try {
                apiKey = GEMINI_API_KEY.value();
            }
            catch {
                apiKey = "";
            }
            if (!apiKey) {
                return send(500, { error: "missing_api_key", message: "API key de Gemini no configurada." });
            }
            const aiResult = await (0, ai_1.analyzeImage)({ base64Data, mimeType, context, apiKey });
            if (!aiResult) {
                return send(500, { error: "analysis_failed", message: "El análisis de la imagen por IA falló." });
            }
            let finalLat = lat;
            let finalLng = lng;
            let precise = true;
            if (finalLat === undefined || finalLng === undefined) {
                if (aiResult.locationSearchQuery) {
                    const coords = await (0, ai_1.geocodeAddress)(aiResult.locationSearchQuery);
                    if (coords) {
                        finalLat = coords.lat;
                        finalLng = coords.lng;
                    }
                }
                if (finalLat === undefined || finalLng === undefined) {
                    finalLat = 10.5;
                    finalLng = -66.91;
                    precise = false;
                }
            }
            const id = (0, node_crypto_1.randomUUID)();
            const incident = {
                id,
                category: aiResult.category,
                triageLevel: aiResult.triageLevel,
                status: statusForLevel(aiResult.triageLevel),
                lat: finalLat,
                lng: finalLng,
                description: aiResult.description || "Reporte creado vía análisis de imagen por IA.",
                locationPrecise: precise,
                isProxy: true,
                subjectName: aiResult.subjectName || undefined,
                subjectDetails: aiResult.subjectDetails || undefined,
                lastSeen: aiResult.lastSeen || undefined,
                contact: aiResult.contact || undefined,
                reporterId: actor.id,
                reporterName: actor.name || "IA / " + actor.id,
                evacuated: false,
                resolved: false,
                resolutionConfirmed: null,
                createdAt: new Date().toISOString(),
                clusterId: id,
                aiFlagged: aiResult.confidence > 0.7,
                aiSeverity: aiResult.triageLevel <= 2 ? "high" : "moderate",
                aiReason: `Análisis de imagen: ${aiResult.category}. Confianza: ${Math.round(aiResult.confidence * 100)}%`,
            };
            // Suggest a Master Incident to merge into
            incident.clusterId = await resolveClusterId(finalLat, finalLng, aiResult.category, precise, undefined, id);
            await firebase_1.db.doc(`incidents/${id}`).set(incident);
            await (0, audit_1.logAudit)(actor, "report_create", { type: "incident", id }, {
                category: incident.category,
                triageLevel: incident.triageLevel,
                isProxy: incident.isProxy,
                aiFlagged: incident.aiFlagged ?? false,
                imageUrl: imageUrl || "upload",
            });
            return send(201, { incident: publicIncident(incident), analysis: aiResult });
        }
        // ── Reports (any authenticated actor) ────────────────────────────────
        if (m === "POST" && path === "/reports") {
            const actor = await (0, auth_1.getActor)(req);
            if (!actor)
                return send(401, { error: "unauthenticated", message: "Verifíquese para reportar." });
            const r = models_1.reportSchema.parse(req.body);
            const id = (0, node_crypto_1.randomUUID)();
            const incident = {
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
            try {
                apiKey = GEMINI_API_KEY.value();
            }
            catch {
                apiKey = "";
            }
            const ai = await (0, ai_1.assessReport)({ description: r.description, category: r.category, declaredLevel: r.triageLevel, apiKey });
            if (ai?.escalate) {
                const aiLevel = (0, ai_1.severityToLevel)(ai.severity);
                if (aiLevel < incident.triageLevel) {
                    incident.triageLevel = aiLevel;
                    incident.status = statusForLevel(aiLevel);
                }
                incident.aiFlagged = true;
                incident.aiSeverity = ai.severity;
                incident.aiReason = ai.reason;
            }
            await firebase_1.db.doc(`incidents/${id}`).set(incident);
            await (0, audit_1.logAudit)(actor, "report_create", { type: "incident", id }, {
                category: incident.category, triageLevel: incident.triageLevel, isProxy: incident.isProxy, aiFlagged: incident.aiFlagged ?? false,
            });
            return send(201, { incident: publicIncident(incident) });
        }
        // ── Incidents list (public) ──────────────────────────────────────────
        if (m === "GET" && path === "/incidents") {
            const viewer = await (0, auth_1.getActor)(req);
            const showReporters = (0, auth_1.hasRole)(viewer, "responder"); // reporter names only for responders+
            const q = await firebase_1.db.collection("incidents").get();
            const all = q.docs.map((d) => d.data());
            // Group into Master Incidents by clusterId (fall back to own id).
            const groups = new Map();
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
            const ref = firebase_1.db.doc(`incidents/${seg[1]}`);
            const snap = await ref.get();
            if (!snap.exists)
                return send(404, { error: "not_found", message: "Incidente no encontrado." });
            const incident = snap.data();
            const action = seg[2];
            const actor = await (0, auth_1.getActor)(req);
            if (m === "POST" && action === "status") {
                if (!(0, auth_1.hasRole)(actor, "responder"))
                    return send(403, { error: "forbidden" });
                const status = models_1.statusSchema.parse(req.body).status;
                await ref.update({ status });
                await (0, audit_1.logAudit)(actor, "incident_status", { type: "incident", id: seg[1] }, { status });
                return send(200, { incident: publicIncident({ ...incident, status }) });
            }
            if (m === "POST" && action === "evacuate") {
                if (!actor)
                    return send(401, { error: "unauthenticated" });
                await ref.update({ evacuated: true, status: "green" });
                await (0, audit_1.logAudit)(actor, "incident_evacuate", { type: "incident", id: seg[1] });
                return send(200, { incident: publicIncident({ ...incident, evacuated: true, status: "green" }) });
            }
            if (m === "POST" && action === "resolve") {
                if (!(0, auth_1.hasRole)(actor, "responder"))
                    return send(403, { error: "forbidden" });
                await ref.update({ resolved: true, resolutionConfirmed: null });
                await (0, audit_1.logAudit)(actor, "incident_resolve", { type: "incident", id: seg[1] });
                return send(200, { incident: publicIncident({ ...incident, resolved: true, resolutionConfirmed: null }) });
            }
            if (m === "POST" && action === "resolution") {
                if (!actor)
                    return send(401, { error: "unauthenticated" });
                const confirmed = models_1.resolutionConfirmSchema.parse(req.body).confirmed;
                await ref.update({ resolutionConfirmed: confirmed });
                await (0, audit_1.logAudit)(actor, "incident_resolution", { type: "incident", id: seg[1] }, { confirmed });
                return send(200, { incident: publicIncident({ ...incident, resolutionConfirmed: confirmed }) });
            }
        }
        // ── Missing persons (public read; verified report) ───────────────────
        if (m === "GET" && path === "/missing") {
            const viewer = await (0, auth_1.getActor)(req); // may be null (public)
            const q = await firebase_1.db.collection("missingPersons").orderBy("createdAt", "desc").get();
            const people = q.docs.map((d) => {
                const { reporterId, ...rest } = d.data(); // hide who reported
                // `mine` lets the reporter (only) see the "mark found" control, without
                // ever exposing reporterId to clients.
                return { ...rest, mine: !!viewer && viewer.id === reporterId };
            });
            return send(200, { people });
        }
        if (m === "POST" && path === "/missing") {
            const actor = await (0, auth_1.getActor)(req);
            if (!actor)
                return send(401, { error: "unauthenticated", message: "Verifíquese para reportar." });
            const p = models_1.missingPersonSchema.parse(req.body);
            const id = (0, node_crypto_1.randomUUID)();
            // "Reported by" comes from the reporter's VERIFIED identity (name only —
            // never their Cédula), not from a form field.
            const person = { id, ...p, contactName: actor.name, reporterId: actor.id, status: "missing", createdAt: new Date().toISOString() };
            await firebase_1.db.doc(`missingPersons/${id}`).set(person);
            await (0, audit_1.logAudit)(actor, "missing_report", { type: "missingPerson", id }, { name: p.name });
            const { reporterId, ...pub } = person;
            void reporterId;
            return send(201, { person: pub });
        }
        if (m === "POST" && seg[0] === "missing" && seg.length === 3 && seg[2] === "found") {
            const actor = await (0, auth_1.getActor)(req);
            if (!actor)
                return send(401, { error: "unauthenticated" });
            const ref = firebase_1.db.doc(`missingPersons/${seg[1]}`);
            const personSnap = await ref.get();
            if (!personSnap.exists)
                return send(404, { error: "not_found" });
            // Only the original reporter (matched by id) or a responder+ may close it.
            const person = personSnap.data();
            const isReporter = actor.id === person.reporterId;
            if (!isReporter && !(0, auth_1.hasRole)(actor, "responder")) {
                return send(403, { error: "forbidden", message: "Solo el reportante o un brigadista puede marcarla." });
            }
            const { byPhone, note } = models_1.missingFoundSchema.parse(req.body || {});
            // Finder name comes from the verified identity, not a form field.
            const foundBy = { name: actor.name, phone: byPhone, note, role: actor.role, at: new Date().toISOString() };
            await ref.update({ status: "found", foundBy });
            await (0, audit_1.logAudit)(actor, "missing_found", { type: "missingPerson", id: seg[1] }, { phone: byPhone });
            return send(200, { ok: true });
        }
        // ── Location status requests (public read; verified report; responder resolve) ──
        if (m === "GET" && path === "/location-requests") {
            const viewer = await (0, auth_1.getActor)(req); // may be null (public)
            const q = await firebase_1.db.collection("locationRequests").orderBy("createdAt", "desc").get();
            const requests = q.docs.map((d) => {
                const { reporterId, ...rest } = d.data();
                return { ...rest, mine: !!viewer && viewer.id === reporterId };
            });
            return send(200, { requests });
        }
        if (m === "POST" && path === "/location-requests") {
            const actor = await (0, auth_1.getActor)(req);
            if (!actor)
                return send(401, { error: "unauthenticated", message: "Verifíquese para solicitar información." });
            const body = models_1.locationRequestSchema.parse(req.body);
            const id = (0, node_crypto_1.randomUUID)();
            const request = {
                id,
                ...body,
                status: "pending",
                reporterId: actor.id,
                reporterName: actor.name || actor.id,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            };
            await firebase_1.db.doc(`locationRequests/${id}`).set(request);
            await (0, audit_1.logAudit)(actor, "location_request_create", { type: "locationRequest", id }, { buildingName: body.buildingName });
            const { reporterId, ...pub } = request;
            void reporterId;
            return send(201, { request: pub });
        }
        if (m === "POST" && seg[0] === "location-requests" && seg.length === 3 && seg[2] === "resolve") {
            const actor = await (0, auth_1.getActor)(req);
            if (!actor)
                return send(401, { error: "unauthenticated" });
            if (!(0, auth_1.hasRole)(actor, "responder"))
                return send(403, { error: "forbidden", message: "Solo brigadistas o coordinadores pueden responder." });
            const ref = firebase_1.db.doc(`locationRequests/${seg[1]}`);
            const requestSnap = await ref.get();
            if (!requestSnap.exists)
                return send(404, { error: "not_found" });
            const { condition, note } = models_1.locationResolveSchema.parse(req.body);
            const resolution = {
                condition,
                note,
                answeredBy: { name: actor.name, role: actor.role },
                at: new Date().toISOString(),
            };
            await ref.update({
                status: "resolved",
                resolution,
                updatedAt: new Date().toISOString(),
            });
            await (0, audit_1.logAudit)(actor, "location_request_resolve", { type: "locationRequest", id: seg[1] }, { condition });
            return send(200, { ok: true });
        }
        // ── Announcements ────────────────────────────────────────────────────
        if (m === "GET" && path === "/announcements") {
            const q = await firebase_1.db.collection("announcements").orderBy("createdAt", "desc").get();
            return send(200, { announcements: q.docs.map((d) => d.data()) });
        }
        if (m === "POST" && path === "/announcements") {
            const actor = await (0, auth_1.getActor)(req);
            if (!(0, auth_1.hasRole)(actor, "command"))
                return send(403, { error: "forbidden", message: "Solo Comando puede transmitir." });
            const a = models_1.announcementSchema.parse(req.body);
            const id = (0, node_crypto_1.randomUUID)();
            const announcement = { id, ...a, createdAt: new Date().toISOString() };
            await firebase_1.db.doc(`announcements/${id}`).set(announcement);
            await (0, audit_1.logAudit)(actor, "announcement_broadcast", { type: "announcement", id }, { category: a.category });
            return send(201, { announcement });
        }
        // Clear an announcement (Command) — takes the banner down once it's stale.
        if (m === "DELETE" && seg[0] === "announcements" && seg.length === 2) {
            const actor = await (0, auth_1.getActor)(req);
            if (!(0, auth_1.hasRole)(actor, "command"))
                return send(403, { error: "forbidden" });
            await firebase_1.db.doc(`announcements/${seg[1]}`).delete();
            await (0, audit_1.logAudit)(actor, "announcement_delete", { type: "announcement", id: seg[1] });
            return send(200, { deleted: seg[1] });
        }
        // ── Admitted Patients (GET public; POST analyze and save for responder+) ──
        if (m === "GET" && path === "/patients") {
            const q = await firebase_1.db.collection("admittedPatients").orderBy("createdAt", "desc").get();
            const patients = q.docs.map((d) => d.data());
            return send(200, { patients });
        }
        if (m === "POST" && path === "/patients/analyze-list") {
            const actor = await (0, auth_1.getActor)(req);
            if (!actor || !(0, auth_1.hasRole)(actor, "responder")) {
                return send(403, { error: "forbidden", message: "Solo brigadistas o coordinadores pueden ingresar listas de pacientes." });
            }
            const input = models_1.hospitalInputSchema.parse(req.body);
            let base64Data;
            let mimeType;
            if (input.imageBase64) {
                const match = input.imageBase64.match(/^data:([^;]+);base64,(.+)$/);
                if (match) {
                    mimeType = match[1];
                    base64Data = match[2];
                }
                else {
                    base64Data = input.imageBase64;
                    mimeType = "image/jpeg";
                }
            }
            let apiKey = "";
            try {
                apiKey = GEMINI_API_KEY.value();
            }
            catch {
                apiKey = "";
            }
            if (!apiKey) {
                return send(500, { error: "missing_api_key", message: "API key de Gemini no configurada." });
            }
            const parsedPatients = await (0, ai_1.analyzePatientList)({
                textInput: input.textInput,
                base64Data,
                mimeType,
                apiKey,
                hospitalName: input.hospitalName,
            });
            if (!parsedPatients) {
                return send(500, { error: "analysis_failed", message: "El análisis de la lista por IA falló." });
            }
            // Fetch active missing persons to cross-reference
            const missingPersonsSnap = await firebase_1.db.collection("missingPersons").where("status", "==", "missing").get();
            const missingPersons = missingPersonsSnap.docs.map(doc => doc.data());
            const savedPatients = [];
            let matchedCount = 0;
            for (const p of parsedPatients) {
                const id = (0, node_crypto_1.randomUUID)();
                let matchedMissingId = null;
                // Try exact DNI/CI match first (digits only comparison)
                if (p.dni) {
                    const normDni = p.dni.replace(/\D/g, "");
                    const match = missingPersons.find(m => m.dni && m.dni.replace(/\D/g, "") === normDni);
                    if (match) {
                        matchedMissingId = match.id;
                        matchedCount++;
                    }
                }
                // If no DNI match, try fuzzy name matching
                if (!matchedMissingId) {
                    const match = missingPersons.find(m => (0, ai_1.fuzzyNameMatch)(p.name, m.name));
                    if (match) {
                        matchedMissingId = match.id;
                        matchedCount++;
                    }
                }
                const patientDoc = {
                    id,
                    name: p.name,
                    dni: p.dni || undefined,
                    hospitalName: input.hospitalName,
                    notes: p.notes || undefined,
                    status: "admitted",
                    matchedMissingId,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                };
                await firebase_1.db.doc(`admittedPatients/${id}`).set(patientDoc);
                savedPatients.push(patientDoc);
                await (0, audit_1.logAudit)(actor, "patient_admit", { type: "admittedPatient", id }, {
                    name: p.name,
                    hospitalName: input.hospitalName,
                    matchedMissingId: matchedMissingId || undefined,
                });
            }
            return send(201, { patients: savedPatients, matchedCount });
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
                "POST /reports", "POST /reports/analyze-image", "GET /incidents",
                "POST /incidents/:id/status", "POST /incidents/:id/evacuate",
                "POST /incidents/:id/resolve", "POST /incidents/:id/resolution",
                "GET /missing", "POST /missing", "POST /missing/:id/found",
                "GET /patients", "POST /patients/analyze-list",
                "GET /location-requests", "POST /location-requests", "POST /location-requests/:id/resolve",
                "GET /announcements", "POST /announcements", "DELETE /announcements/:id",
            ],
        });
    }
    catch (err) {
        if (err instanceof zod_1.ZodError)
            return send(400, { error: "validation_failed", details: err.flatten() });
        v2_1.logger.error("unhandled_error", err);
        return send(500, { error: "internal", message: "Unexpected server error." });
    }
});
