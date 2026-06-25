import type { Request } from "firebase-functions/v2/https";

// REPLACE_ME — set your real production web origins here before deploying.
//
// The last two entries (capacitor://localhost, http://localhost) are what the
// iOS/Android Capacitor shells send as their Origin header. DO NOT delete them
// or the native apps will be blocked by CORS.
export const CORS_ALLOWLIST = [
  "https://ayudaterremoto.org",
  "https://www.ayudaterremoto.org",
  "https://ayudaterremotovenezuela.web.app",
  "https://ayudaterremotovenezuela.firebaseapp.com",
  "http://localhost:5173",
  "capacitor://localhost",
  "http://localhost",
];

// Minimal structural type so this helper doesn't depend on @types/express.
interface HeaderSettable {
  set(field: string, value: string): unknown;
}

export function resolveOrigin(req: Request): string | null {
  const origin = req.headers.origin;
  if (typeof origin === "string" && CORS_ALLOWLIST.includes(origin)) return origin;
  return null;
}

/** Apply CORS headers. Call on every request before routing. */
export function applyCors(req: Request, res: HeaderSettable): void {
  const origin = resolveOrigin(req);
  if (origin) res.set("Access-Control-Allow-Origin", origin);
  res.set("Vary", "Origin");
  res.set("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.set("Access-Control-Max-Age", "3600");
}
