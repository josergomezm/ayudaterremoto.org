import type { Request } from "firebase-functions/v2/https";
import { adminAuth, db } from "./firebase";
import { ROLE_RANK, type Role, type AdminRole, type FieldSession } from "./types";

// Unified actor: either an admin (Firebase Auth + adminUsers role) or a field-tier
// user (device-token session). Routes check capability via hasRole().
export interface Actor {
  role: Role;
  kind: "field" | "admin";
  id: string;        // dni for field, email for admin
  name?: string;
}

function bearer(req: Request): string | null {
  const a = req.headers.authorization;
  return typeof a === "string" && a.startsWith("Bearer ") ? a.slice(7) : null;
}

/**
 * Resolve the caller. Tries the admin tier first (a Firebase ID token), then the
 * field tier (a device-token session). Returns null if neither matches.
 */
export async function getActor(req: Request): Promise<Actor | null> {
  const token = bearer(req);
  if (!token) return null;

  // Admin tier — a Firebase ID token. verifyIdToken throws on a non-JWT, so a
  // field device token simply falls through to the next block.
  try {
    const decoded = await adminAuth.verifyIdToken(token);
    const email = decoded.email?.toLowerCase();
    if (email) {
      const snap = await db.doc(`adminUsers/${email}`).get();
      if (snap.exists) {
        const role = (snap.data() as { role: AdminRole }).role;
        return { role, kind: "admin", id: email, name: decoded.name ?? email };
      }
    }
    return null; // authenticated with Google but not an authorized admin
  } catch {
    /* not a Firebase token — treat as a field session token */
  }

  const s = await db.doc(`sessions/${token}`).get();
  if (s.exists) {
    const d = s.data() as FieldSession;
    return { role: d.role, kind: "field", id: d.dni, name: d.name };
  }
  return null;
}

export function hasRole(actor: Actor | null, min: Role): boolean {
  return actor !== null && ROLE_RANK[actor.role] >= ROLE_RANK[min];
}

export interface FirebaseUser { email: string; name: string }

/**
 * Resolve a signed-in Google user regardless of admin status. Used for the
 * self-service "request access" flow, where the caller is authenticated but not
 * (yet) an admin.
 */
export async function getFirebaseUser(req: Request): Promise<FirebaseUser | null> {
  const token = bearer(req);
  if (!token) return null;
  try {
    const decoded = await adminAuth.verifyIdToken(token);
    const email = decoded.email?.toLowerCase();
    if (!email) return null;
    return { email, name: decoded.name ?? email };
  } catch {
    return null;
  }
}
