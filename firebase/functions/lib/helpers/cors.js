"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CORS_ALLOWLIST = void 0;
exports.resolveOrigin = resolveOrigin;
exports.applyCors = applyCors;
// REPLACE_ME — set your real production web origins here before deploying.
//
// The last two entries (capacitor://localhost, http://localhost) are what the
// iOS/Android Capacitor shells send as their Origin header. DO NOT delete them
// or the native apps will be blocked by CORS.
exports.CORS_ALLOWLIST = [
    "https://ayudaterremoto.org",
    "https://www.ayudaterremoto.org",
    "https://ayudaterremotovenezuela.web.app",
    "https://ayudaterremotovenezuela.firebaseapp.com",
    "http://localhost:5173",
    "capacitor://localhost",
    "http://localhost",
];
function resolveOrigin(req) {
    const origin = req.headers.origin;
    if (typeof origin === "string" && exports.CORS_ALLOWLIST.includes(origin))
        return origin;
    return null;
}
/** Apply CORS headers. Call on every request before routing. */
function applyCors(req, res) {
    const origin = resolveOrigin(req);
    if (origin)
        res.set("Access-Control-Allow-Origin", origin);
    res.set("Vary", "Origin");
    res.set("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
    res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
    res.set("Access-Control-Max-Age", "3600");
}
