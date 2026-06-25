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
export interface ImageAnalysisResult {
    category: "medical" | "structural" | "obstruction" | "resource";
    triageLevel: number;
    description: string;
    locationSearchQuery: string;
    subjectName?: string | null;
    subjectDetails?: string | null;
    lastSeen?: string | null;
    contact?: string | null;
    confidence: number;
    structuralDamage?: "minor" | "moderate" | "severe" | "collapse" | null;
    resourceType?: "water" | "food" | "medical" | "shelter" | "tools" | "other" | null;
    medicalCount?: "1" | "2-5" | "6-10" | "10+" | null;
    obstructionType?: "landslide" | "debris" | "trees" | "vehicles" | "other" | null;
}
export declare function analyzeImage(opts: {
    base64Data: string;
    mimeType: string;
    context?: string;
    apiKey: string;
}): Promise<ImageAnalysisResult | null>;
export declare function geocodeAddress(query: string): Promise<{
    lat: number;
    lng: number;
} | null>;
export declare function analyzePatientList(opts: {
    textInput?: string;
    base64Data?: string;
    mimeType?: string;
    apiKey: string;
    hospitalName: string;
}): Promise<{
    name: string;
    dni?: string | null;
    notes?: string | null;
}[] | null>;
export declare function fuzzyNameMatch(nameA: string, nameB: string): boolean;
