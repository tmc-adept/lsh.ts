import { Minhash } from './minhash';

export interface LshOptions {
    /** Number of hash values grouped together into a band. */
    bandSize?: number;
}

export interface QueryOptions {
    /** Maximum number of hits to return (highest similarity first). */
    limit?: number;
    /** Minimum Jaccard similarity required to keep a result. */
    minSimilarity?: number;
}

export interface QueryResult<TValue> {
    key: string;
    score: number;
    value?: TValue;
}

/**
 * Locality Sensitive Hashing index for MinHash signatures.
 * Documents that share a band are considered potential matches.
 */
export class LshIndex<TValue = undefined> {
    private readonly bandSize: number;
    private readonly buckets = new Map<string, Set<string>>();
    private readonly keyToBands = new Map<string, string[]>();
    private readonly documents = new Map<string, Minhash>();
    private readonly payloads = new Map<string, TValue>();

    constructor(options: LshOptions = {}) {
        this.bandSize = options.bandSize ?? 4;
        if (!Number.isInteger(this.bandSize) || this.bandSize <= 0) {
            throw new Error('`bandSize` must be a positive integer');
        }
    }

    public get size(): number {
        return this.documents.size;
    }

    public has(key: string): boolean {
        return this.documents.has(key);
    }

    public get(key: string): Minhash | undefined {
        return this.documents.get(key);
    }

    public getPayload(key: string): TValue | undefined {
        return this.payloads.get(key);
    }

    public insert(key: string, minhash: Minhash, value?: TValue): void {
        this.remove(key);
        this.documents.set(key, minhash);
        if (value !== undefined) {
            this.payloads.set(key, value);
        }
        this.addToBuckets(key, minhash);
    }

    public remove(key: string): boolean {
        const existed = this.documents.delete(key);
        this.payloads.delete(key);
        this.removeFromBuckets(key);
        return existed;
    }

    public clear(): void {
        this.buckets.clear();
        this.keyToBands.clear();
        this.documents.clear();
        this.payloads.clear();
    }

    /**
     * Returns the set of candidate keys that share at least one band with the query.
     */
    public query(minhash: Minhash): string[] {
        return [...this.collectMatches(minhash)];
    }

    /**
     * Returns scored matches sorted by similarity (highest first).
     */
    public search(minhash: Minhash, options: QueryOptions = {}): QueryResult<TValue>[] {
        const matches = this.collectMatches(minhash);
        const hits: QueryResult<TValue>[] = [];
        const minSimilarity = options.minSimilarity ?? 0;

        for (const key of matches) {
            const candidate = this.documents.get(key);
            if (!candidate) continue;
            const score = minhash.jaccard(candidate);
            if (score < minSimilarity) continue;

            const hit: QueryResult<TValue> = { key, score };
            if (this.payloads.has(key)) {
                hit.value = this.payloads.get(key);
            }
            hits.push(hit);
        }

        hits.sort((a, b) => b.score - a.score);
        if (typeof options.limit === 'number') {
            return hits.slice(0, options.limit);
        }
        return hits;
    }

    private collectMatches(minhash: Minhash): Set<string> {
        const matches = new Set<string>();
        for (const band of this.getHashbands(minhash)) {
            const bucket = this.buckets.get(band);
            if (!bucket) continue;
            for (const key of bucket) {
                matches.add(key);
            }
        }
        return matches;
    }

    private addToBuckets(key: string, minhash: Minhash): void {
        const bands = this.getHashbands(minhash);
        this.keyToBands.set(key, [...bands]);
        for (const band of bands) {
            if (!this.buckets.has(band)) {
                this.buckets.set(band, new Set());
            }
            this.buckets.get(band)!.add(key);
        }
    }

    private removeFromBuckets(key: string): void {
        const bands = this.keyToBands.get(key);
        if (!bands) {
            return;
        }
        for (const band of bands) {
            const bucket = this.buckets.get(band);
            if (!bucket) continue;
            bucket.delete(key);
            if (bucket.size === 0) {
                this.buckets.delete(band);
            }
        }
        this.keyToBands.delete(key);
    }

    private getHashbands(minhash: Minhash): string[] {
        if (minhash.hashbands && minhash.hashbands.length > 0) {
            return minhash.hashbands;
        }

        const hashbands: string[] = [];
        const totalBands = Math.floor(minhash.hashvalues.length / this.bandSize);
        for (let i = 0; i < totalBands; i += 1) {
            const start = i * this.bandSize;
            const band = minhash.hashvalues.slice(start, start + this.bandSize);
            hashbands.push(band.join('.'));
        }
        minhash.hashbands = hashbands;
        return hashbands;
    }
}
