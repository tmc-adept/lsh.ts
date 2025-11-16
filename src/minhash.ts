export type MinhashInput = string | number | boolean | bigint | symbol | { toString(): string } | null | undefined;

export interface MinhashConfig {
    /** Number of hash permutations (signature length). Higher values improve accuracy at the cost of memory. */
    numPerm?: number;
    /** Seed used by the deterministic pseudo-random generator that creates permutation coefficients. */
    seed?: number;
}

export type MinhashSignature = ReadonlyArray<number>;

export interface SerializedMinhash {
    numPerm: number;
    seed: number;
    hashvalues: number[];
}

type PermutationPair = {
    permA: ReadonlyArray<number>;
    permB: ReadonlyArray<number>;
};

/**
 * Generates MinHash signatures for a collection of tokens.
 * A signature is represented by an array of integers whose
 * element-wise minimum captures the resemblance between sets.
 */
export class Minhash {
    private static readonly PRIME = 4_294_967_311; // Smallest prime > 2^32 - 1
    private static readonly MAX_HASH = 2 ** 32 - 1;
    private static readonly permutationCache = new Map<string, PermutationPair>();

    public readonly prime = Minhash.PRIME;
    public readonly maxHash = Minhash.MAX_HASH;

    public readonly numPerm: number;
    private readonly permutationSeed: number;
    private randSeed: number;

    public readonly hashvalues: number[];
    public readonly permA: ReadonlyArray<number>;
    public readonly permB: ReadonlyArray<number>;
    /** Cached band signatures used by LSH. */
    public hashbands?: string[];

    constructor(config: MinhashConfig = {}) {
        this.numPerm = config.numPerm ?? 128;
        if (!Number.isInteger(this.numPerm) || this.numPerm <= 0) {
            throw new Error('`numPerm` must be a positive integer');
        }

        this.permutationSeed = config.seed ?? 1;
        this.randSeed = this.permutationSeed;
        this.hashvalues = Array.from({ length: this.numPerm }, () => this.maxHash);

        const permutations = Minhash.getPermutations(this.numPerm, this.permutationSeed);
        this.permA = permutations.permA;
        this.permB = permutations.permB;
    }

    /**
     * Creates a new Minhash from an iterable of tokens.
     */
    public static fromTokens(tokens: Iterable<MinhashInput>, config?: MinhashConfig): Minhash {
        return new Minhash(config).updateAll(tokens);
    }

    /**
     * Builds a Minhash instance from serialized data (e.g., JSON).
     */
    public static fromJSON(payload: SerializedMinhash): Minhash {
        const instance = new Minhash({ numPerm: payload.numPerm, seed: payload.seed });
        instance.loadSignature(payload.hashvalues);
        return instance;
    }

    /**
     * Serializes the signature for persistence or transport.
     */
    public toJSON(): SerializedMinhash {
        return {
            numPerm: this.numPerm,
            seed: this.permutationSeed,
            hashvalues: [...this.hashvalues]
        };
    }

    /**
     * Resets the signature back to its initial (empty) state.
     */
    public reset(): this {
        this.hashvalues.fill(this.maxHash);
        this.hashbands = undefined;
        return this;
    }

    /**
     * Loads a signature (e.g., from toJSON or toSignature output) into the instance.
     */
    public loadSignature(signature: MinhashSignature): this {
        if (signature.length !== this.numPerm) {
            throw new Error('hashvalue counts differ');
        }
        for (let i = 0; i < this.numPerm; i += 1) {
            this.hashvalues[i] = signature[i];
        }
        this.hashbands = undefined;
        return this;
    }

    /**
     * Returns a defensive copy of the current signature.
     */
    public toSignature(): MinhashSignature {
        return [...this.hashvalues];
    }

    /**
     * Updates the signature with a new token.
     */
    public update(token: MinhashInput): this {
        const normalized = this.normalizeToken(token);
        if (normalized === null) {
            return this;
        }

        const hashedToken = this.hash(normalized);
        for (let i = 0; i < this.numPerm; i += 1) {
            const hash = (this.permA[i] * hashedToken + this.permB[i]) % this.prime;
            if (hash < this.hashvalues[i]) {
                this.hashvalues[i] = hash;
            }
        }
        this.hashbands = undefined;
        return this;
    }

    /**
     * Updates the signature with an iterable of tokens.
     */
    public updateAll(tokens: Iterable<MinhashInput>): this {
        for (const token of tokens) {
            this.update(token);
        }
        return this;
    }

    /**
     * Estimates the Jaccard similarity between this signature and another.
     */
    public jaccard(other: Minhash): number {
        if (this.hashvalues.length !== other.hashvalues.length) {
            throw new Error('hashvalue counts differ');
        }

        if (this.permutationSeed !== other.permutationSeed) {
            throw new Error('seed values differ');
        }

        let shared = 0;
        for (let i = 0; i < this.hashvalues.length; i += 1) {
            if (this.hashvalues[i] === other.hashvalues[i]) {
                shared += 1;
            }
        }
        return shared / this.hashvalues.length;
    }

    /**
     * Returns a deterministic pseudo-random integer in [0, MAX_HASH].
     */
    public randInt(): number {
        const x = Math.sin(this.randSeed++) * this.maxHash;
        const fractional = x - Math.floor(x);
        return Math.floor(fractional * this.maxHash);
    }

    /**
     * Convert a string to a 32-bit unsigned integer hash.
     */
    public hash(str: string): number {
        if (str.length === 0) {
            return this.maxHash;
        }

        let hash = 0;
        for (let i = 0; i < str.length; i += 1) {
            hash = (hash << 5) - hash + str.charCodeAt(i);
            hash |= 0; // force 32-bit
        }
        return hash >>> 0; // convert to unsigned 32-bit
    }

    private normalizeToken(token: MinhashInput): string | null {
        if (token === null || token === undefined) {
            return null;
        }
        if (typeof token === 'string') {
            return token;
        }
        return token.toString();
    }

    private static getPermutations(numPerm: number, seed: number): PermutationPair {
        const key = `${numPerm}:${seed}`;
        const cached = this.permutationCache.get(key);
        if (cached) {
            return cached;
        }

        const used = new Set<number>();
        const permA: number[] = [];
        const permB: number[] = [];
        let localSeed = seed;

        const nextRand = (): number => {
            const x = Math.sin(localSeed++) * this.MAX_HASH;
            const fractional = x - Math.floor(x);
            return Math.floor(fractional * this.MAX_HASH);
        };

        const nextUnique = (): number => {
            let value = nextRand();
            while (used.has(value)) {
                value = nextRand();
            }
            used.add(value);
            return value;
        };

        for (let i = 0; i < numPerm; i += 1) {
            permA.push(nextUnique());
        }
        for (let i = 0; i < numPerm; i += 1) {
            permB.push(nextUnique());
        }

        const result: PermutationPair = {
            permA: Object.freeze(permA.slice()),
            permB: Object.freeze(permB.slice())
        };
        this.permutationCache.set(key, result);
        return result;
    }
}
