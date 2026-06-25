// Domain types shared across the API. Data now lives in Firestore (see firebase.ts
// + seed.ts); these describe the document shapes.

export type Role = "civilian" | "responder" | "authority" | "command";
export type AdminRole = "authority" | "command";
export type TriageStatus = "green" | "yellow" | "red";
export type ReportCategory = "medical" | "structural" | "obstruction" | "resource";

export const ROLE_RANK: Record<Role, number> = {
  civilian: 0, responder: 1, authority: 2, command: 3,
};

export interface FieldSession {
  dni: string;
  name: string;
  role: Role; // field tier only ever holds civilian | responder
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
  voucher: string;     // admin email/id that issued it
  createdAt: string;
}

export interface VouchAuditEntry {
  voucher: string;     // admin who issued the redeemed code
  voucheeDni: string;  // field user who redeemed it
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
  unit?: string;              // floor / apartment
  locationPrecise?: boolean;  // false = fallback pin; never auto-clustered
  isProxy: boolean;
  subjectName?: string;
  subjectDetails?: string;   // proxy: age / appearance / distinguishing features
  lastSeen?: string;         // proxy: when/where last seen
  contact?: string;          // proxy: reporter relationship / phone
  reporterId: string;
  reporterName?: string;     // verified name (shown to responders+, never public)
  evacuated: boolean;
  resolved: boolean;
  resolutionConfirmed: boolean | null;
  createdAt: string;
  // Proximity clustering ("Master Incident") — shared id for nearby reports.
  clusterId?: string;
  // AI "hidden net" (Gemini) flags when the text implies higher severity.
  aiFlagged?: boolean;
  aiSeverity?: string;
  aiReason?: string;
}

export interface MissingPerson {
  id: string;
  name: string;
  details?: string;        // age / appearance
  address?: string;        // home / usual address
  lastSeen?: string;       // when / where last seen
  lat?: number;
  lng?: number;
  phone?: string;          // the missing person's phone
  contactName?: string;    // "requested by" — reporter's display name (NOT their Cédula)
  contactPhone?: string;   // "info at" — number to call with information
  reporterId: string;      // the reporter's id (Cédula/email) — omitted from public payloads
  status: "missing" | "found";
  // Captured when someone marks the person found — provenance for the status change.
  foundBy?: { name?: string; phone?: string; note?: string; role: string; at: string };
  createdAt: string;
}

export interface Announcement {
  id: string;
  category: "urgent" | "logistics" | "correction";
  message: string;
  createdAt: string;
}
