export type AiSeverity = "critical" | "high" | "moderate" | "low";
export interface AiAssessment {
    escalate: boolean;
    severity: AiSeverity;
    reason: string;
}
export declare function assessReport(opts: {
    description: string;
    category: string;
    declaredLevel: number;
    apiKey: string;
}): Promise<AiAssessment | null>;
export declare function severityToLevel(s: AiSeverity): number;
/** Meters between two lat/lng points (haversine). For proximity clustering. */
export declare function distanceMeters(aLat: number, aLng: number, bLat: number, bLng: number): number;
