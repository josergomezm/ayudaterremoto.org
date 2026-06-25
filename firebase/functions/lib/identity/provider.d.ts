export interface IdentityRecord {
    nac: "V" | "E";
    dni: string;
    fullname: string;
    state: string;
    municipality: string;
}
export interface IdentityProvider {
    /** Resolve a Cédula to a record, or null if not registered (CNE 404). */
    lookup(nac: "V" | "E", dni: string): Promise<IdentityRecord | null>;
}
export declare const stubProvider: IdentityProvider;
/**
 * Build the name-match challenge grid: the real name plus plausible decoys,
 * deterministically shuffled from `seed` so the same challenge is reproducible.
 * The CALLER must remember which option is correct (never sent to the client).
 */
export declare function buildNameOptions(realName: string, seed: string, count?: number): string[];
export declare const pnpProvider: IdentityProvider;
export declare const activeProvider: IdentityProvider;
