import { db } from "./firebase";

// Append-only audit trail. Every significant action writes one entry. Logging
// must NEVER break the request, so failures are swallowed.

export interface AuditActorLike {
  id: string;
  role: string;
  kind: string;
}

export interface AuditEntry {
  action: string;
  actorId: string;
  actorRole: string;
  actorKind: string;
  targetType: string | null;
  targetId: string | null;
  details: Record<string, unknown> | null;
  timestamp: string;
}

export async function logAudit(
  actor: AuditActorLike | null,
  action: string,
  target?: { type: string; id: string },
  details?: Record<string, unknown>,
): Promise<void> {
  try {
    const entry: AuditEntry = {
      action,
      actorId: actor?.id ?? "anonymous",
      actorRole: actor?.role ?? "none",
      actorKind: actor?.kind ?? "none",
      targetType: target?.type ?? null,
      targetId: target?.id ?? null,
      details: details ?? null,
      timestamp: new Date().toISOString(),
    };
    await db.collection("auditLog").add(entry);
  } catch {
    /* never let logging break the request */
  }
}
