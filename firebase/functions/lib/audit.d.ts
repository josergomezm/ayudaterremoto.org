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
export declare function logAudit(actor: AuditActorLike | null, action: string, target?: {
    type: string;
    id: string;
}, details?: Record<string, unknown>): Promise<void>;
