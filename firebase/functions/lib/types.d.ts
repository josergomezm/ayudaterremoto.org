export type Role = "civilian" | "responder" | "authority" | "command";
export type AdminRole = "authority" | "command";
export type TriageStatus = "green" | "yellow" | "red";
export type ReportCategory = "medical" | "structural" | "obstruction" | "resource";
export declare const ROLE_RANK: Record<Role, number>;
export interface FieldSession {
    dni: string;
    name: string;
    role: Role;
}
export interface PendingChallenge {
    dni: string;
    nac: "V" | "E";
    correctName: string;
    expiresAt: number;
}
export interface VouchCode {
    code: string;
    used: boolean;
    voucher: string;
    createdAt: string;
}
export interface VouchAuditEntry {
    voucher: string;
    voucheeDni: string;
    timestamp: string;
}
export interface AdminUser {
    email: string;
    role: AdminRole;
}
export interface AccessRequest {
    email: string;
    name: string;
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
}
export interface MissingPerson {
    id: string;
    name: string;
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
