"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getActor = getActor;
exports.hasRole = hasRole;
exports.getFirebaseUser = getFirebaseUser;
const firebase_1 = require("./firebase");
const types_1 = require("./types");
function bearer(req) {
    const a = req.headers.authorization;
    return typeof a === "string" && a.startsWith("Bearer ") ? a.slice(7) : null;
}
/**
 * Resolve the caller. Tries the admin tier first (a Firebase ID token), then the
 * field tier (a device-token session). Returns null if neither matches.
 */
async function getActor(req) {
    const token = bearer(req);
    if (!token)
        return null;
    // Admin tier — a Firebase ID token. verifyIdToken throws on a non-JWT, so a
    // field device token simply falls through to the next block.
    try {
        const decoded = await firebase_1.adminAuth.verifyIdToken(token);
        const email = decoded.email?.toLowerCase();
        if (email) {
            const snap = await firebase_1.db.doc(`adminUsers/${email}`).get();
            if (snap.exists) {
                const role = snap.data().role;
                return { role, kind: "admin", id: email, name: decoded.name ?? email };
            }
        }
        return null; // authenticated with Google but not an authorized admin
    }
    catch {
        /* not a Firebase token — treat as a field session token */
    }
    const s = await firebase_1.db.doc(`sessions/${token}`).get();
    if (s.exists) {
        const d = s.data();
        return { role: d.role, kind: "field", id: d.dni, name: d.name };
    }
    return null;
}
function hasRole(actor, min) {
    return actor !== null && types_1.ROLE_RANK[actor.role] >= types_1.ROLE_RANK[min];
}
/**
 * Resolve a signed-in Google user regardless of admin status. Used for the
 * self-service "request access" flow, where the caller is authenticated but not
 * (yet) an admin.
 */
async function getFirebaseUser(req) {
    const token = bearer(req);
    if (!token)
        return null;
    try {
        const decoded = await firebase_1.adminAuth.verifyIdToken(token);
        const email = decoded.email?.toLowerCase();
        if (!email)
            return null;
        return { email, name: decoded.name ?? email };
    }
    catch {
        return null;
    }
}
