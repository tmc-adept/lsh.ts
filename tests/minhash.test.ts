import { describe, expect, it } from 'vitest';
import { Minhash } from '../src/minhash';

describe('Minhash', () => {
    it('initializes hashvalues below max hash', () => {
        const minhash = new Minhash();
        for (const value of minhash.hashvalues) {
            expect(value).toBeLessThanOrEqual(minhash.maxHash);
        }
        expect(minhash.hashvalues).toHaveLength(minhash.numPerm);
    });

    it('updates hashvalues when new tokens arrive', () => {
        const minhash = new Minhash();
        const before = [...minhash.hashvalues];
        minhash.update('cats');
        expect(minhash.hashvalues).not.toEqual(before);
    });

    it('supports variable signature lengths', () => {
        const longer = new Minhash({ numPerm: 256 });
        expect(longer.hashvalues).toHaveLength(256);
    });

    it('creates permutation arrays without duplicates in range', () => {
        const minhash = new Minhash();
        const seen = new Set<number>();
        const perms = [...minhash.permA, ...minhash.permB];
        for (const value of perms) {
            expect(value).toBeGreaterThanOrEqual(0);
            expect(value).toBeLessThanOrEqual(minhash.maxHash);
            expect(seen.has(value)).toBe(false);
            seen.add(value);
        }
    });

    it('throws when comparing minhashes with incompatible seeds or lengths', () => {
        const differentSeedA = new Minhash({ seed: 1 });
        const differentSeedB = new Minhash({ seed: 2 });
        expect(() => differentSeedA.jaccard(differentSeedB)).toThrowError('seed values differ');

        const shortSignature = new Minhash({ numPerm: 64, seed: 5 });
        const longSignature = new Minhash({ numPerm: 128, seed: 5 });
        expect(() => shortSignature.jaccard(longSignature)).toThrowError('hashvalue counts differ');
    });

    it('returns perfect similarity for identical updates', () => {
        const doc = ['minhash', 'is', 'great'];
        const a = new Minhash();
        const b = new Minhash();
        a.updateAll(doc);
        b.updateAll(doc);
        expect(a.jaccard(b)).toBe(1);
    });

    it('generates random ints inside range', () => {
        const minhash = new Minhash();
        for (let i = 0; i < 1_000; i += 1) {
            const num = minhash.randInt();
            expect(num).toBeGreaterThanOrEqual(0);
            expect(num).toBeLessThanOrEqual(minhash.maxHash);
        }
    });

    it('supports builders, chaining, and reset', () => {
        const tokens = ['alpha', 'beta', 'gamma'];
        const signature = Minhash.fromTokens(tokens)
            .update(42)
            .updateAll(['delta'])
            .toSignature();

        const hydrated = new Minhash().loadSignature(signature).reset();
        expect(hydrated.hashvalues.every((value) => value === hydrated.maxHash)).toBe(true);
    });

    it('serializes and hydrates via JSON helpers', () => {
        const original = Minhash.fromTokens(['cats', 'are', 'cool'], { seed: 7, numPerm: 64 });
        const payload = original.toJSON();
        const clone = Minhash.fromJSON(payload);
        expect(clone.hashvalues).toEqual(original.hashvalues);
        expect(original.jaccard(clone)).toBe(1);
    });
});
