import type { Request } from "firebase-functions/v2/https";
import { adminAuth, db } from "./firebase";
import { ROLE_RANK, type Role, type AdminRole } from "./types";

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

export async function getActor(req: Request): Promise<Actor | null> {
  const token = bearer(req);
  if (!token) return null;

  try {
    const decoded = await adminAuth.verifyIdToken(token);
    const email = decoded.email?.toLowerCase();
    if (email) {
      // 1. Check adminUsers (authority/command)
      const snap = await db.doc(`adminUsers/${email}`).get();
      if (snap.exists) {
        const role = (snap.data() as { role: AdminRole }).role;
        return { role, kind: "admin", id: email, name: decoded.name ?? email };
      }

      // 2. Check users (vouched responders)
      const userSnap = await db.doc(`users/${email}`).get();
      if (userSnap.exists) {
        const role = (userSnap.data() as { role: Role }).role;
        return { role, kind: "field", id: email, name: decoded.name ?? email };
      }

      // 3. Default to colaborador for other Google users
      return { role: "colaborador", kind: "field", id: email, name: decoded.name ?? email };
    }
    return null;
  } catch {
    return null;
  }
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
