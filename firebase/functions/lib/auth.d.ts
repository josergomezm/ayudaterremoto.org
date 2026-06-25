import type { Request } from "firebase-functions/v2/https";
import { type Role } from "./types";
export interface Actor {
    role: Role;
    kind: "field" | "admin";
    id: string;
    name?: string;
}
/**
 * Resolve the caller. Tries the admin tier first (a Firebase ID token), then the
 * field tier (a device-token session). Returns null if neither matches.
 */
export declare function getActor(req: Request): Promise<Actor | null>;
export declare function hasRole(actor: Actor | null, min: Role): boolean;
export interface FirebaseUser {
    email: string;
    name: string;
}
/**
 * Resolve a signed-in Google user regardless of admin status. Used for the
 * self-service "request access" flow, where the caller is authenticated but not
 * (yet) an admin.
 */
export declare function getFirebaseUser(req: Request): Promise<FirebaseUser | null>;
