import type { Request } from "firebase-functions/v2/https";
export declare const CORS_ALLOWLIST: string[];
interface HeaderSettable {
    set(field: string, value: string): unknown;
}
export declare function resolveOrigin(req: Request): string | null;
/** Apply CORS headers. Call on every request before routing. */
export declare function applyCors(req: Request, res: HeaderSettable): void;
export {};
