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
async function getActor(req) {
    const token = bearer(req);
    if (!token)
        return null;
    try {
        const decoded = await firebase_1.adminAuth.verifyIdToken(token);
        const email = decoded.email?.toLowerCase();
        if (email) {
            // 1. Check adminUsers (authority/command)
            const snap = await firebase_1.db.doc(`adminUsers/${email}`).get();
            if (snap.exists) {
                const role = snap.data().role;
                return { role, kind: "admin", id: email, name: decoded.name ?? email };
            }
            // 2. Check users (vouched responders)
            const userSnap = await firebase_1.db.doc(`users/${email}`).get();
            if (userSnap.exists) {
                const role = userSnap.data().role;
                return { role, kind: "field", id: email, name: decoded.name ?? email };
            }
            // 3. Default to colaborador for other Google users
            return { role: "colaborador", kind: "field", id: email, name: decoded.name ?? email };
        }
        return null;
    }
    catch {
        return null;
    }
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
