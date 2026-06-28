export type Role = "colaborador" | "coordinador" | "organizador" | "fundador";
export type AdminRole = "organizador" | "fundador";
export type TriageStatus = "green" | "yellow" | "red";
export type ReportCategory = "medical" | "structural" | "obstruction" | "resource";
export declare const ROLE_RANK: Record<Role, number>;
export interface VouchCode {
    code: string;
    used: boolean;
    voucher: string;
    createdAt: string;
}
export interface VouchAuditEntry {
    voucher: string;
    voucheeEmail: string;
    timestamp: string;
}
export interface AdminUser {
    email: string;
    role: AdminRole;
}
export interface AccessRequest {
    email: string;
    name: string;
    phone: string;
    note?: string;
    requestedAt: string;
}
export interface ResponderRequest {
    email: string;
    name: string;
    phone: string;
    note?: string;
    requestedAt: string;
}
export interface Incident {
    id: string;
    category: ReportCategory;
    triageLevel: number;
    status: TriageStatus;
    lat: number;
    lng: number;
    description: string;
    unit?: string;
    locationPrecise?: boolean;
    isProxy: boolean;
    subjectName?: string;
    subjectDetails?: string;
    lastSeen?: string;
    contact?: string;
    reporterId: string;
    reporterName?: string;
    evacuated: boolean;
    resolved: boolean;
    resolutionConfirmed: boolean | null;
    createdAt: string;
    clusterId?: string;
    aiFlagged?: boolean;
    aiSeverity?: string;
    aiReason?: string;
    structuralDamage?: "minor" | "moderate" | "severe" | "collapse";
    resourceType?: "water" | "food" | "medical" | "shelter" | "tools" | "other";
    medicalCount?: "1" | "2-5" | "6-10" | "10+";
    obstructionType?: "landslide" | "debris" | "trees" | "vehicles" | "other";
}
export interface MissingPerson {
    id: string;
    name: string;
    dni?: string;
    details?: string;
    address?: string;
    lastSeen?: string;
    lat?: number;
    lng?: number;
    phone?: string;
    contactName?: string;
    contactPhone?: string;
    reporterId: string;
    status: "missing" | "found";
    foundBy?: {
        name?: string;
        phone?: string;
        note?: string;
        role: string;
        at: string;
    };
    createdAt: string;
}
export interface Announcement {
    id: string;
    category: "urgent" | "logistics" | "correction";
    message: string;
    createdAt: string;
}
export interface LocationRequest {
    id: string;
    buildingName: string;
    address?: string;
    lat?: number;
    lng?: number;
    note?: string;
    status: "pending" | "investigating" | "resolved";
    resolution?: {
        condition: "safe" | "damaged" | "collapsed" | "unknown";
        note: string;
        answeredBy: {
            name: string;
            role: string;
        };
        at: string;
    };
    contactPhone?: string;
    reporterId: string;
    reporterName: string;
    createdAt: string;
    updatedAt: string;
}
export interface AdmittedPatient {
    id: string;
    name: string;
    dni?: string;
    hospitalName: string;
    notes?: string;
    status: "admitted" | "discharged";
    matchedMissingId?: string | null;
    createdAt: string;
    updatedAt: string;
}
export type HubStatus = "active" | "closed";
export type InventoryCategory = "water" | "food" | "tools" | "medical" | "shelter" | "clothing" | "hygiene" | "other";
export type InventoryUrgency = "available" | "low" | "depleted";
export type HubLogAction = "restock" | "distribute" | "adjust" | "note";
export type NeedStatus = "abierta" | "tomada" | "confirmada";
export interface ResourceHub {
    id: string;
    name: string;
    address: string;
    lat: number;
    lng: number;
    contactPhone: string;
    contactName: string;
    whatsappGroup?: string;
    status: HubStatus;
    createdBy: string;
    createdAt: string;
    updatedAt: string;
}
export interface InventoryItem {
    id: string;
    category: InventoryCategory;
    name: string;
    quantity: number;
    unit: string;
    urgency: InventoryUrgency;
    updatedAt: string;
    status?: NeedStatus;
    claimedBy?: string | null;
    claimedByName?: string | null;
    claimedAt?: string | null;
    confirmedBy?: string | null;
    confirmedByName?: string | null;
    confirmedAt?: string | null;
    proofUrl?: string | null;
    reopenedCount?: number;
    reopenedByName?: string | null;
}
export interface HubLog {
    id: string;
    action: HubLogAction;
    itemName: string;
    quantityDelta: number;
    unit: string;
    note?: string;
    actorEmail: string;
    actorName: string;
    timestamp: string;
}
export interface HubCoordinator {
    email: string;
    name: string;
    addedBy: string;
    addedAt: string;
}
