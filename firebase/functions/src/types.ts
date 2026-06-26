// Domain types shared across the API. Data now lives in Firestore (see firebase.ts
// + seed.ts); these describe the document shapes.

export type Role = "civilian" | "responder" | "authority" | "command" | "sudo";
export type AdminRole = "authority" | "command" | "sudo";
export type TriageStatus = "green" | "yellow" | "red";
export type ReportCategory = "medical" | "structural" | "obstruction" | "resource";

export const ROLE_RANK: Record<Role, number> = {
  civilian: 0, responder: 1, authority: 2, command: 3, sudo: 4,
};

export interface VouchCode {
  code: string;
  used: boolean;
  voucher: string;     // admin email/id that issued it
  createdAt: string;
}

export interface VouchAuditEntry {
  voucher: string;     // admin who issued the redeemed code
  voucheeEmail: string; // field user who redeemed it
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
  structuralDamage?: "minor" | "moderate" | "severe" | "collapse";
  resourceType?: "water" | "food" | "medical" | "shelter" | "tools" | "other";
  medicalCount?: "1" | "2-5" | "6-10" | "10+";
  obstructionType?: "landslide" | "debris" | "trees" | "vehicles" | "other";
}

export interface MissingPerson {
  id: string;
  name: string;
  dni?: string;
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
    answeredBy: { name: string; role: string };
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
