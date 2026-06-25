"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logAudit = logAudit;
const firebase_1 = require("./firebase");
async function logAudit(actor, action, target, details) {
    try {
        const entry = {
            action,
            actorId: actor?.id ?? "anonymous",
            actorRole: actor?.role ?? "none",
            actorKind: actor?.kind ?? "none",
            targetType: target?.type ?? null,
            targetId: target?.id ?? null,
            details: details ?? null,
            timestamp: new Date().toISOString(),
        };
        await firebase_1.db.collection("auditLog").add(entry);
    }
    catch {
        /* never let logging break the request */
    }
}
