"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.api = void 0;
const https_1 = require("firebase-functions/v2/https");
const v2_1 = require("firebase-functions/v2");
const params_1 = require("firebase-functions/params");
const node_crypto_1 = require("node:crypto");
const zod_1 = require("zod");
const cors_1 = require("./helpers/cors");
const ai_1 = require("./ai");
const firebase_1 = require("./firebase");
const auth_1 = require("./auth");
const audit_1 = require("./audit");
// Gemini API key — provisioned via Google Secret Manager (firebase functions
// secrets). Locally, set it in firebase/functions/.secret.local. Force redeploy.
const GEMINI_API_KEY = (0, params_1.defineSecret)("GEMINI_API_KEY");
const CLUSTER_RADIUS_M = 60;
// Una necesidad "tomada" sin confirmar pasado este lapso se marca staleClaim (WS3).
const NEED_STALE_MS = 2 * 24 * 60 * 60 * 1000; // 2 días
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
async function isHubCoordinator(hubId, actorEmail) {
    const adminSnap = await firebase_1.db.doc(`adminUsers/${actorEmail}`).get();
    if (adminSnap.exists) {
        const role = adminSnap.data().role;
        if (role === "organizador")
            return true;
    }
    const hubSnap = await firebase_1.db.doc(`resourceHubs/${hubId}`).get();
    if (!hubSnap.exists)
        return false;
    const hub = hubSnap.data();
    if (hub.createdBy === actorEmail)
        return true;
    const coordSnap = await firebase_1.db.doc(`resourceHubs/${hubId}/coordinators/${actorEmail}`).get();
    return coordSnap.exists;
}
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
        // ── Unified User Profile (any Google-authenticated user) ─────────────
        if (m === "GET" && path === "/auth/me") {
            const actor = await (0, auth_1.getActor)(req);
            if (!actor)
                return send(401, { error: "unauthenticated", message: "Inicie sesión con Google." });
            return send(200, { role: actor.role, email: actor.id, name: actor.name });
        }
        // ── Redeem vouch code (any Google-authenticated user) ────────────────
        if (m === "POST" && path === "/verify/redeem-vouch") {
            const fbUser = await (0, auth_1.getFirebaseUser)(req);
            if (!fbUser)
                return send(401, { error: "unauthenticated", message: "Inicie sesión con Google primero." });
            const { vouchCode } = zod_1.z.object({ vouchCode: zod_1.z.string().min(1) }).parse(req.body);
            const codeRef = firebase_1.db.doc(`vouchCodes/${vouchCode.toUpperCase()}`);
            const codeSnap = await codeRef.get();
            const vc = codeSnap.exists ? codeSnap.data() : null;
            if (!vc || vc.used)
                return send(400, { error: "invalid_vouch_code", message: "Código de aval inválido o ya usado." });
            // Check if user is already an admin
            const adminSnap = firebase_1.db.doc(`adminUsers/${fbUser.email}`);
            const adminDoc = await adminSnap.get();
            if (adminDoc.exists) {
                return send(400, { error: "already_admin", message: "Ya eres administrador." });
            }
            // Upgrade role to coordinador in users collection
            const userRef = firebase_1.db.doc(`users/${fbUser.email}`);
            await userRef.set({ email: fbUser.email, role: "coordinador", name: fbUser.name, updatedAt: new Date().toISOString() });
            // Mark vouch code as used
            await codeRef.update({ used: true });
            await firebase_1.db.collection("vouchAudit").add({ voucher: vc.voucher, voucheeEmail: fbUser.email, timestamp: new Date().toISOString() });
            await (0, audit_1.logAudit)({ id: fbUser.email, role: "coordinador", kind: "field" }, "vouch_redeem", { type: "vouchCode", id: vouchCode.toUpperCase() }, { voucher: vc.voucher });
            return send(200, { role: "coordinador" });
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
                const { phone, note } = models_1.accessRequestSchema.parse(req.body);
                const reqDoc = { email: fbUser.email, name: fbUser.name, phone, note, requestedAt: new Date().toISOString() };
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
            if (!(0, auth_1.hasRole)(actor, "organizador"))
                return send(403, { error: "forbidden" });
            const q = await firebase_1.db.collection("accessRequests").get();
            return send(200, { requests: q.docs.map((d) => d.data()) });
        }
        if (m === "POST" && path === "/admin/requests/approve") {
            const actor = await (0, auth_1.getActor)(req);
            if (!(0, auth_1.hasRole)(actor, "organizador"))
                return send(403, { error: "forbidden" });
            const { email, role } = models_1.adminUserSchema.parse(req.body);
            const key = email.toLowerCase();
            if (role === "fundador" && actor.role !== "fundador") {
                return send(403, { error: "forbidden", message: "Solo un Fundador puede asignar el rol de Fundador." });
            }
            await firebase_1.db.doc(`adminUsers/${key}`).set({ email: key, role });
            await firebase_1.db.doc(`accessRequests/${key}`).delete();
            await (0, audit_1.logAudit)(actor, "access_approve", { type: "adminUser", id: key }, { role });
            return send(200, { user: { email: key, role } });
        }
        if (m === "POST" && path === "/admin/requests/deny") {
            const actor = await (0, auth_1.getActor)(req);
            if (!(0, auth_1.hasRole)(actor, "organizador"))
                return send(403, { error: "forbidden" });
            const { email } = models_1.adminEmailSchema.parse(req.body);
            await firebase_1.db.doc(`accessRequests/${email.toLowerCase()}`).delete();
            await (0, audit_1.logAudit)(actor, "access_deny", { type: "accessRequest", id: email.toLowerCase() });
            return send(200, { denied: email.toLowerCase() });
        }
        // ── Self-service responder request (any signed-in Google user) ──────────
        if (path === "/verify/responder-request") {
            const fbUser = await (0, auth_1.getFirebaseUser)(req);
            if (!fbUser)
                return send(401, { error: "unauthenticated" });
            const actor = await (0, auth_1.getActor)(req);
            if (actor && (0, auth_1.hasRole)(actor, "coordinador")) {
                return send(400, { error: "already_responder", message: "Ya eres Coordinador o superior." });
            }
            const ref = firebase_1.db.doc(`responderRequests/${fbUser.email}`);
            if (m === "POST") {
                const { phone, note, role } = models_1.accessRequestSchema.parse(req.body);
                const reqDoc = {
                    email: fbUser.email,
                    name: fbUser.name,
                    phone,
                    note,
                    requestedRole: role || "coordinador",
                    requestedAt: new Date().toISOString()
                };
                await ref.set(reqDoc);
                await (0, audit_1.logAudit)({ id: fbUser.email, role: "colaborador", kind: "user" }, "responder_request", { type: "responderRequest", id: fbUser.email });
                return send(200, { status: "pending" });
            }
            if (m === "GET") {
                const snap = await ref.get();
                return send(200, { status: snap.exists ? "pending" : null });
            }
        }
        // ── Responder requests management (Authority+) ───────────────────────
        if (m === "GET" && path === "/admin/responder-requests") {
            const actor = await (0, auth_1.getActor)(req);
            if (!(0, auth_1.hasRole)(actor, "organizador"))
                return send(403, { error: "forbidden" });
            const q = await firebase_1.db.collection("responderRequests").get();
            return send(200, { requests: q.docs.map((d) => d.data()) });
        }
        if (m === "POST" && path === "/admin/responder-requests/approve") {
            const actor = await (0, auth_1.getActor)(req);
            if (!(0, auth_1.hasRole)(actor, "organizador"))
                return send(403, { error: "forbidden" });
            const { email } = models_1.adminEmailSchema.parse(req.body);
            const key = email.toLowerCase();
            const reqSnap = await firebase_1.db.doc(`responderRequests/${key}`).get();
            const reqData = reqSnap.exists ? reqSnap.data() : null;
            const userName = reqData?.name || key;
            const approvedRole = reqData?.requestedRole || "coordinador";
            await firebase_1.db.doc(`users/${key}`).set({
                email: key,
                role: approvedRole,
                name: userName,
                updatedAt: new Date().toISOString()
            });
            await firebase_1.db.doc(`responderRequests/${key}`).delete();
            await (0, audit_1.logAudit)(actor, "responder_approve", { type: "user", id: key }, { role: approvedRole });
            return send(200, { user: { email: key, role: approvedRole } });
        }
        if (m === "POST" && path === "/admin/responder-requests/deny") {
            const actor = await (0, auth_1.getActor)(req);
            if (!(0, auth_1.hasRole)(actor, "organizador"))
                return send(403, { error: "forbidden" });
            const { email } = models_1.adminEmailSchema.parse(req.body);
            const key = email.toLowerCase();
            await firebase_1.db.doc(`responderRequests/${key}`).delete();
            await (0, audit_1.logAudit)(actor, "responder_deny", { type: "responderRequest", id: key });
            return send(200, { denied: key });
        }
        // ── Responders management (Authority+) ───────────────────────────────
        if (m === "GET" && path === "/admin/responders") {
            const actor = await (0, auth_1.getActor)(req);
            if (!(0, auth_1.hasRole)(actor, "organizador"))
                return send(403, { error: "forbidden" });
            const q = await firebase_1.db.collection("users").get();
            const responders = q.docs
                .map((d) => d.data())
                .filter((u) => u.role === "coordinador");
            return send(200, { responders });
        }
        if (m === "POST" && path === "/admin/responders/remove") {
            const actor = await (0, auth_1.getActor)(req);
            if (!(0, auth_1.hasRole)(actor, "organizador"))
                return send(403, { error: "forbidden" });
            const { email } = models_1.adminEmailSchema.parse(req.body);
            const key = email.toLowerCase();
            await firebase_1.db.doc(`users/${key}`).delete();
            await (0, audit_1.logAudit)(actor, "responder_remove", { type: "user", id: key });
            return send(200, { removed: key });
        }
        // ── Vouch code generation (Authority+) ───────────────────────────────
        if (m === "POST" && path === "/vouch/generate") {
            const actor = await (0, auth_1.getActor)(req);
            if (!(0, auth_1.hasRole)(actor, "organizador"))
                return send(403, { error: "forbidden", message: "Requiere rol Organizador." });
            const code = newVouchCode();
            const doc = { code, used: false, voucher: actor.id, createdAt: new Date().toISOString() };
            await firebase_1.db.doc(`vouchCodes/${code}`).set(doc);
            await (0, audit_1.logAudit)(actor, "vouch_generate", { type: "vouchCode", id: code });
            return send(200, { code });
        }
        // ── Vouch audit log (Command) ────────────────────────────────────────
        if (m === "GET" && path === "/vouch/audit") {
            const actor = await (0, auth_1.getActor)(req);
            if (!(0, auth_1.hasRole)(actor, "organizador"))
                return send(403, { error: "forbidden" });
            const q = await firebase_1.db.collection("vouchAudit").orderBy("timestamp", "desc").limit(200).get();
            return send(200, { entries: q.docs.map((d) => d.data()) });
        }
        // ── Full activity / audit log (Command) ──────────────────────────────
        if (m === "GET" && path === "/admin/audit") {
            const actor = await (0, auth_1.getActor)(req);
            if (!(0, auth_1.hasRole)(actor, "organizador"))
                return send(403, { error: "forbidden" });
            const q = await firebase_1.db.collection("auditLog").orderBy("timestamp", "desc").limit(300).get();
            return send(200, { entries: q.docs.map((d) => d.data()) });
        }
        // ── Admin user management (Command/Authority for GET) ────────────────
        if (m === "GET" && path === "/admin/users") {
            const actor = await (0, auth_1.getActor)(req);
            if (!(0, auth_1.hasRole)(actor, "organizador"))
                return send(403, { error: "forbidden" });
            const q = await firebase_1.db.collection("adminUsers").get();
            return send(200, { users: q.docs.map((d) => d.data()) });
        }
        if (m === "POST" && path === "/admin/users") {
            const actor = await (0, auth_1.getActor)(req);
            if (!(0, auth_1.hasRole)(actor, "organizador"))
                return send(403, { error: "forbidden" });
            const { email, role } = models_1.adminUserSchema.parse(req.body);
            const key = email.toLowerCase();
            // Check if target is already a sudo user
            const targetSnap = await firebase_1.db.doc(`adminUsers/${key}`).get();
            if (targetSnap.exists) {
                const targetData = targetSnap.data();
                if (targetData.role === "fundador" && actor.role !== "fundador") {
                    return send(403, { error: "cannot_modify_sudo", message: "No se puede modificar a un usuario Fundador." });
                }
            }
            // Check if actor is trying to assign sudo but is not sudo
            if (role === "fundador" && actor.role !== "fundador") {
                return send(403, { error: "forbidden", message: "Solo un Fundador puede asignar el rol de Fundador." });
            }
            await firebase_1.db.doc(`adminUsers/${key}`).set({ email: key, role });
            await (0, audit_1.logAudit)(actor, "admin_set", { type: "adminUser", id: key }, { role });
            return send(200, { user: { email: key, role } });
        }
        if (m === "POST" && path === "/admin/users/remove") {
            const actor = await (0, auth_1.getActor)(req);
            if (!(0, auth_1.hasRole)(actor, "organizador"))
                return send(403, { error: "forbidden" });
            const { email } = models_1.adminEmailSchema.parse(req.body);
            const key = email.toLowerCase();
            if (key === actor.id)
                return send(400, { error: "self_remove", message: "No puede revocar su propio acceso." });
            // Check if target is a sudo user
            const targetSnap = await firebase_1.db.doc(`adminUsers/${key}`).get();
            if (targetSnap.exists) {
                const targetData = targetSnap.data();
                if (targetData.role === "fundador") {
                    return send(403, { error: "cannot_remove_sudo", message: "No se puede remover a un usuario Fundador." });
                }
            }
            await firebase_1.db.doc(`adminUsers/${key}`).delete();
            await (0, audit_1.logAudit)(actor, "admin_remove", { type: "adminUser", id: key });
            return send(200, { removed: key });
        }
        // ── Analyze image and create report (Command only) ───────────────────
        if (m === "POST" && path === "/reports/analyze-image") {
            const actor = await (0, auth_1.getActor)(req);
            if (!actor || !(0, auth_1.hasRole)(actor, "organizador"))
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
                structuralDamage: aiResult.structuralDamage || undefined,
                resourceType: aiResult.resourceType || undefined,
                medicalCount: aiResult.medicalCount || undefined,
                obstructionType: aiResult.obstructionType || undefined,
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
                structuralDamage: r.structuralDamage,
                resourceType: r.resourceType,
                medicalCount: r.medicalCount,
                obstructionType: r.obstructionType,
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
            const showReporters = (0, auth_1.hasRole)(viewer, "coordinador"); // reporter names only for coordinador+
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
                if (!(0, auth_1.hasRole)(actor, "rescatista"))
                    return send(403, { error: "forbidden" });
                const status = models_1.statusSchema.parse(req.body).status;
                const updateData = { status };
                if (status === "red" || status === "yellow") {
                    updateData.evacuated = false;
                    updateData.resolved = false;
                    updateData.resolutionConfirmed = null;
                }
                await ref.update(updateData);
                await (0, audit_1.logAudit)(actor, "incident_status", { type: "incident", id: seg[1] }, { status });
                return send(200, { incident: publicIncident({ ...incident, ...updateData }) });
            }
            if (m === "POST" && action === "evacuate") {
                if (!actor)
                    return send(401, { error: "unauthenticated" });
                await ref.update({ evacuated: true, status: "green" });
                await (0, audit_1.logAudit)(actor, "incident_evacuate", { type: "incident", id: seg[1] });
                return send(200, { incident: publicIncident({ ...incident, evacuated: true, status: "green" }) });
            }
            if (m === "POST" && action === "resolve") {
                if (!(0, auth_1.hasRole)(actor, "rescatista"))
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
            if (!isReporter && !(0, auth_1.hasRole)(actor, "rescatista")) {
                return send(403, { error: "forbidden", message: "Solo el reportante o un rescatista/coordinador puede marcarla." });
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
            if (!(0, auth_1.hasRole)(actor, "rescatista"))
                return send(403, { error: "forbidden", message: "Solo rescatistas o coordinadores pueden responder." });
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
            if (!(0, auth_1.hasRole)(actor, "organizador"))
                return send(403, { error: "forbidden", message: "Solo un Organizador puede transmitir." });
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
            if (!(0, auth_1.hasRole)(actor, "organizador"))
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
            if (!actor || !(0, auth_1.hasRole)(actor, "coordinador")) {
                return send(403, { error: "forbidden", message: "Solo coordinadores pueden ingresar listas de pacientes." });
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
        // ── Resource Hubs / "zonas" (public read; Coordinador create + manage own; Organizador oversees & assigns) ──
        if (m === "GET" && path === "/hubs") {
            const viewer = await (0, auth_1.getActor)(req); // puede ser null (lectura pública)
            const q = await firebase_1.db.collection("resourceHubs").where("status", "==", "active").get();
            const hubs = [];
            for (const d of q.docs) {
                const hub = d.data();
                const invSnap = await firebase_1.db.collection(`resourceHubs/${hub.id}/inventory`).get();
                const inventory = invSnap.docs.map((iv) => {
                    const it = iv.data();
                    const status = it.status ?? "abierta";
                    const staleClaim = status === "tomada" && !!it.claimedAt &&
                        (Date.now() - new Date(it.claimedAt).getTime() > NEED_STALE_MS);
                    // No exponer emails (claimedBy/confirmedBy); en su lugar, flags "mine".
                    const { claimedBy, confirmedBy, ...pub } = it;
                    const mineClaim = !!viewer && !!claimedBy && viewer.id === claimedBy;
                    const mineConfirm = !!viewer && !!confirmedBy && viewer.id === confirmedBy;
                    return { ...pub, status, staleClaim, mineClaim, mineConfirm };
                });
                const logSnap = await firebase_1.db.collection(`resourceHubs/${hub.id}/logs`).orderBy("timestamp", "desc").limit(5).get();
                const recentLogs = logSnap.docs.map((lg) => lg.data());
                const coordSnap = await firebase_1.db.collection(`resourceHubs/${hub.id}/coordinators`).get();
                const coordinators = [];
                // Add creator first if not command
                const creatorEmail = hub.createdBy;
                const creatorAdminSnap = await firebase_1.db.doc(`adminUsers/${creatorEmail}`).get();
                let isCreatorCommand = false;
                if (creatorAdminSnap.exists) {
                    const role = creatorAdminSnap.data().role;
                    if (role === "organizador")
                        isCreatorCommand = true;
                }
                if (!isCreatorCommand) {
                    coordinators.push({
                        email: creatorEmail,
                        name: creatorAdminSnap.exists ? creatorAdminSnap.data().name || creatorEmail : creatorEmail,
                        addedBy: "system",
                        addedAt: hub.createdAt
                    });
                }
                // Add other coordinators
                for (const cd of coordSnap.docs) {
                    const c = cd.data();
                    if (c.email === creatorEmail)
                        continue;
                    const adminSnap = await firebase_1.db.doc(`adminUsers/${c.email}`).get();
                    if (adminSnap.exists) {
                        const role = adminSnap.data().role;
                        if (role === "organizador")
                            continue; // Exclude organizadores
                    }
                    coordinators.push(c);
                }
                hubs.push({ ...hub, inventory, recentLogs, coordinators });
            }
            return send(200, { hubs });
        }
        if (m === "POST" && path === "/hubs") {
            const actor = await (0, auth_1.getActor)(req);
            if (!(0, auth_1.hasRole)(actor, "coordinador"))
                return send(403, { error: "forbidden", message: "Requiere rol Coordinador." });
            const body = models_1.hubCreateSchema.parse(req.body);
            const id = (0, node_crypto_1.randomUUID)();
            const now = new Date().toISOString();
            const hub = { id, ...body, status: "active", createdBy: actor.id, createdAt: now, updatedAt: now };
            await firebase_1.db.doc(`resourceHubs/${id}`).set(hub);
            await (0, audit_1.logAudit)(actor, "hub_create", { type: "resourceHub", id }, { name: body.name });
            return send(201, { hub });
        }
        // ── Hub sub-routes: /hubs/:id/... ────────────────────────────────────
        if (seg[0] === "hubs" && seg.length >= 2) {
            const hubId = seg[1];
            // PATCH /hubs/:id — Update hub
            if (m === "PATCH" && seg.length === 2) {
                const actor = await (0, auth_1.getActor)(req);
                if (!(0, auth_1.hasRole)(actor, "coordinador"))
                    return send(403, { error: "forbidden", message: "Requiere rol Coordinador." });
                if (!(await isHubCoordinator(hubId, actor.id)))
                    return send(403, { error: "forbidden", message: "No es coordinador de esta zona." });
                const body = models_1.hubUpdateSchema.parse(req.body);
                const hubRef = firebase_1.db.doc(`resourceHubs/${hubId}`);
                const hubSnap = await hubRef.get();
                if (!hubSnap.exists)
                    return send(404, { error: "not_found", message: "Zona no encontrada." });
                const updates = { ...body, updatedAt: new Date().toISOString() };
                await hubRef.update(updates);
                const hub = { ...hubSnap.data(), ...updates };
                await (0, audit_1.logAudit)(actor, "hub_update", { type: "resourceHub", id: hubId }, body);
                return send(200, { hub });
            }
            // POST /hubs/:id/inventory — Add/update inventory item
            if (m === "POST" && seg.length === 3 && seg[2] === "inventory") {
                const actor = await (0, auth_1.getActor)(req);
                if (!(0, auth_1.hasRole)(actor, "coordinador"))
                    return send(403, { error: "forbidden", message: "Requiere rol Coordinador." });
                if (!(await isHubCoordinator(hubId, actor.id)))
                    return send(403, { error: "forbidden", message: "No es coordinador de esta zona." });
                const body = models_1.inventoryUpsertSchema.parse(req.body);
                const urgency = body.urgency ?? (body.quantity === 0 ? "depleted" : body.quantity <= 5 ? "low" : "available");
                const itemId = (0, node_crypto_1.randomUUID)();
                const now = new Date().toISOString();
                const item = { id: itemId, category: body.category, name: body.name, quantity: body.quantity, unit: body.unit, urgency, updatedAt: now, status: "abierta", reopenedCount: 0 };
                await firebase_1.db.doc(`resourceHubs/${hubId}/inventory/${itemId}`).set(item);
                const logId = (0, node_crypto_1.randomUUID)();
                const logEntry = { id: logId, action: "restock", itemName: body.name, quantityDelta: body.quantity, unit: body.unit, actorEmail: actor.id, actorName: actor.name || actor.id, timestamp: now };
                await firebase_1.db.doc(`resourceHubs/${hubId}/logs/${logId}`).set(logEntry);
                await (0, audit_1.logAudit)(actor, "hub_inventory_add", { type: "resourceHub", id: hubId }, { itemId, name: body.name, quantity: body.quantity });
                return send(201, { item });
            }
            // DELETE /hubs/:id/inventory/:itemId — Remove inventory item
            if (m === "DELETE" && seg.length === 4 && seg[2] === "inventory") {
                const actor = await (0, auth_1.getActor)(req);
                if (!(0, auth_1.hasRole)(actor, "coordinador"))
                    return send(403, { error: "forbidden", message: "Requiere rol Coordinador." });
                if (!(await isHubCoordinator(hubId, actor.id)))
                    return send(403, { error: "forbidden", message: "No es coordinador de esta zona." });
                const itemId = seg[3];
                const itemRef = firebase_1.db.doc(`resourceHubs/${hubId}/inventory/${itemId}`);
                const itemSnap = await itemRef.get();
                if (!itemSnap.exists)
                    return send(404, { error: "not_found", message: "Artículo no encontrado." });
                const item = itemSnap.data();
                await itemRef.delete();
                const logId = (0, node_crypto_1.randomUUID)();
                const now = new Date().toISOString();
                const logEntry = { id: logId, action: "adjust", itemName: item.name, quantityDelta: -item.quantity, unit: item.unit, note: "Item removed", actorEmail: actor.id, actorName: actor.name || actor.id, timestamp: now };
                await firebase_1.db.doc(`resourceHubs/${hubId}/logs/${logId}`).set(logEntry);
                await (0, audit_1.logAudit)(actor, "hub_inventory_remove", { type: "resourceHub", id: hubId }, { itemId, name: item.name });
                return send(200, { deleted: itemId });
            }
            // POST /hubs/:id/inventory/:itemId/adjust — Adjust quantity
            if (m === "POST" && seg.length === 5 && seg[2] === "inventory" && seg[4] === "adjust") {
                const actor = await (0, auth_1.getActor)(req);
                if (!(0, auth_1.hasRole)(actor, "coordinador"))
                    return send(403, { error: "forbidden", message: "Requiere rol Coordinador." });
                if (!(await isHubCoordinator(hubId, actor.id)))
                    return send(403, { error: "forbidden", message: "No es coordinador de esta zona." });
                const body = models_1.inventoryAdjustSchema.parse(req.body);
                const itemId = seg[3];
                const itemRef = firebase_1.db.doc(`resourceHubs/${hubId}/inventory/${itemId}`);
                const itemSnap = await itemRef.get();
                if (!itemSnap.exists)
                    return send(404, { error: "not_found", message: "Artículo no encontrado." });
                const item = itemSnap.data();
                const newQuantity = Math.max(0, item.quantity + body.delta);
                const urgency = newQuantity === 0 ? "depleted" : newQuantity <= 5 ? "low" : "available";
                const now = new Date().toISOString();
                await itemRef.update({ quantity: newQuantity, urgency, updatedAt: now });
                const logId = (0, node_crypto_1.randomUUID)();
                const logEntry = { id: logId, action: body.action, itemName: item.name, quantityDelta: body.delta, unit: item.unit, note: body.note, actorEmail: actor.id, actorName: actor.name || actor.id, timestamp: now };
                await firebase_1.db.doc(`resourceHubs/${hubId}/logs/${logId}`).set(logEntry);
                await (0, audit_1.logAudit)(actor, "hub_inventory_adjust", { type: "resourceHub", id: hubId }, { itemId, delta: body.delta, action: body.action });
                const updatedItem = { ...item, quantity: newQuantity, urgency, updatedAt: now };
                return send(200, { item: updatedItem });
            }
            // GET /hubs/:id/logs — Fetch hub activity log
            if (m === "GET" && seg.length === 3 && seg[2] === "logs") {
                const actor = await (0, auth_1.getActor)(req);
                if (!(0, auth_1.hasRole)(actor, "coordinador"))
                    return send(403, { error: "forbidden", message: "Requiere rol Coordinador." });
                if (!(await isHubCoordinator(hubId, actor.id)))
                    return send(403, { error: "forbidden", message: "No es coordinador de esta zona." });
                const q = await firebase_1.db.collection(`resourceHubs/${hubId}/logs`).orderBy("timestamp", "desc").limit(100).get();
                const logs = q.docs.map((d) => d.data());
                return send(200, { logs });
            }
            // POST /hubs/:id/coordinators — Add coordinator
            if (m === "POST" && seg.length === 3 && seg[2] === "coordinators") {
                const actor = await (0, auth_1.getActor)(req);
                if (!(0, auth_1.hasRole)(actor, "organizador"))
                    return send(403, { error: "forbidden", message: "Requiere rol Organizador." });
                if (!(await isHubCoordinator(hubId, actor.id)))
                    return send(403, { error: "forbidden", message: "No es coordinador de esta zona." });
                const { email } = models_1.hubCoordinatorSchema.parse(req.body);
                const key = email.toLowerCase();
                // Asignamos Coordinadores (usuarios de campo en users/), no administradores.
                const userSnap = await firebase_1.db.doc(`users/${key}`).get();
                if (!userSnap.exists)
                    return send(400, { error: "invalid_user", message: "El usuario no es un Coordinador registrado." });
                const target = userSnap.data();
                if (target.role !== "coordinador")
                    return send(400, { error: "invalid_user", message: "El usuario debe tener rol Coordinador." });
                const hubSnap = await firebase_1.db.doc(`resourceHubs/${hubId}`).get();
                if (!hubSnap.exists)
                    return send(404, { error: "not_found", message: "Zona no encontrada." });
                const coord = { email: key, name: target.name || key, addedBy: actor.id, addedAt: new Date().toISOString() };
                await firebase_1.db.doc(`resourceHubs/${hubId}/coordinators/${key}`).set(coord);
                await (0, audit_1.logAudit)(actor, "hub_coordinator_add", { type: "resourceHub", id: hubId }, { email: key });
                return send(200, { coordinator: coord });
            }
            // DELETE /hubs/:id/coordinators/:email — Remove coordinator (hub creator only)
            if (m === "DELETE" && seg.length === 4 && seg[2] === "coordinators") {
                const actor = await (0, auth_1.getActor)(req);
                if (!(0, auth_1.hasRole)(actor, "coordinador"))
                    return send(403, { error: "forbidden", message: "Requiere rol Coordinador." });
                const hubRef = firebase_1.db.doc(`resourceHubs/${hubId}`);
                const hubSnap = await hubRef.get();
                if (!hubSnap.exists)
                    return send(404, { error: "not_found", message: "Zona no encontrada." });
                const hub = hubSnap.data();
                if (hub.createdBy !== actor.id)
                    return send(403, { error: "forbidden", message: "Solo el creador de la zona puede remover coordinadores." });
                const coordEmail = decodeURIComponent(seg[3]);
                await firebase_1.db.doc(`resourceHubs/${hubId}/coordinators/${coordEmail}`).delete();
                await (0, audit_1.logAudit)(actor, "hub_coordinator_remove", { type: "resourceHub", id: hubId }, { email: coordEmail });
                return send(200, { removed: coordEmail });
            }
        }
        // ── Needs lifecycle (WS3): un ítem de inventario es una necesidad ──────
        // abierta → (claim) → tomada → (confirm) → confirmada ; (reopen) vuelve a abierta.
        if (seg[0] === "needs" && seg.length === 3) {
            const needId = seg[1];
            const action = seg[2];
            const actor = await (0, auth_1.getActor)(req);
            if (!actor)
                return send(401, { error: "unauthenticated", message: "Inicie sesión." });
            // Los ítems viven en resourceHubs/{hubId}/inventory/{itemId}; los hallamos por
            // collection-group y obtenemos el hubId del path padre (sin denormalizar).
            const found = await firebase_1.db.collectionGroup("inventory").where("id", "==", needId).limit(1).get();
            if (found.empty)
                return send(404, { error: "not_found", message: "Necesidad no encontrada." });
            const itemRef = found.docs[0].ref;
            const hubId = itemRef.parent.parent.id;
            const item = found.docs[0].data();
            const status = item.status ?? "abierta";
            const now = new Date().toISOString();
            if (m === "POST" && action === "claim") {
                // Idempotente: si ya está tomada/confirmada, se rechaza (evita el "don't buy twice").
                if (status !== "abierta")
                    return send(400, { error: "not_open", message: "Esta necesidad ya fue tomada." });
                await itemRef.update({ status: "tomada", claimedBy: actor.id, claimedByName: actor.name ?? actor.id, claimedAt: now, updatedAt: now });
                await (0, audit_1.logAudit)(actor, "need_claim", { type: "inventoryItem", id: needId }, { hubId });
                return send(200, { ok: true, status: "tomada" });
            }
            if (m === "POST" && action === "confirm") {
                if (!(await isHubCoordinator(hubId, actor.id)))
                    return send(403, { error: "forbidden", message: "Solo el coordinador de la zona puede confirmar." });
                if (status !== "tomada")
                    return send(400, { error: "not_claimed", message: "La necesidad no está tomada." });
                // El que se encargó no confirma: el coordinador es la única fuente de verdad.
                if (item.claimedBy && item.claimedBy === actor.id)
                    return send(400, { error: "claimer_cannot_confirm", message: "Quien se encargó no puede confirmar su propia entrega." });
                const { proofUrl } = models_1.needConfirmSchema.parse(req.body ?? {});
                await itemRef.update({ status: "confirmada", confirmedBy: actor.id, confirmedByName: actor.name ?? actor.id, confirmedAt: now, proofUrl: proofUrl ?? null, updatedAt: now });
                await (0, audit_1.logAudit)(actor, "need_confirm", { type: "inventoryItem", id: needId }, { hubId });
                return send(200, { ok: true, status: "confirmada" });
            }
            if (m === "POST" && action === "reopen") {
                if (!(await isHubCoordinator(hubId, actor.id)))
                    return send(403, { error: "forbidden", message: "Solo el coordinador de la zona puede reabrir." });
                if (status === "abierta")
                    return send(400, { error: "already_open", message: "La necesidad ya está abierta." });
                await itemRef.update({
                    status: "abierta",
                    claimedBy: null, claimedByName: null, claimedAt: null,
                    confirmedBy: null, confirmedByName: null, confirmedAt: null, proofUrl: null,
                    reopenedCount: (item.reopenedCount ?? 0) + 1,
                    reopenedByName: actor.name ?? actor.id,
                    updatedAt: now,
                });
                await (0, audit_1.logAudit)(actor, "need_reopen", { type: "inventoryItem", id: needId }, { hubId });
                return send(200, { ok: true, status: "abierta" });
            }
        }
        // ── Unknown route ────────────────────────────────────────────────────
        return send(404, {
            error: "route_not_found",
            message: `No route for ${m} ${path}`,
            routes: [
                "GET /health", "POST /echo",
                "GET /auth/me", "POST /verify/redeem-vouch",
                "GET|POST /verify/responder-request",
                "GET /admin/me", "POST /vouch/generate", "GET /vouch/audit", "GET /admin/audit",
                "GET /admin/users", "POST /admin/users", "POST /admin/users/remove",
                "GET|POST /access-request", "GET /admin/requests",
                "POST /admin/requests/approve", "POST /admin/requests/deny",
                "GET /admin/responder-requests", "POST /admin/responder-requests/approve", "POST /admin/responder-requests/deny",
                "GET /admin/responders", "POST /admin/responders/remove",
                "POST /reports", "POST /reports/analyze-image", "GET /incidents",
                "POST /incidents/:id/status", "POST /incidents/:id/evacuate",
                "POST /incidents/:id/resolve", "POST /incidents/:id/resolution",
                "GET /missing", "POST /missing", "POST /missing/:id/found",
                "GET /patients", "POST /patients/analyze-list",
                "GET /location-requests", "POST /location-requests", "POST /location-requests/:id/resolve",
                "GET /announcements", "POST /announcements", "DELETE /announcements/:id",
                "GET /hubs", "POST /hubs", "PATCH /hubs/:id",
                "POST /hubs/:id/inventory", "DELETE /hubs/:id/inventory/:itemId",
                "POST /hubs/:id/inventory/:itemId/adjust",
                "GET /hubs/:id/logs",
                "POST /hubs/:id/coordinators", "DELETE /hubs/:id/coordinators/:email",
                "POST /needs/:id/claim", "POST /needs/:id/confirm", "POST /needs/:id/reopen",
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
