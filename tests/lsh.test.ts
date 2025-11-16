import { describe, expect, it } from 'vitest';
import { LshIndex } from '../src/lsh';
import { Minhash } from '../src/minhash';

describe('LshIndex', () => {
    it('inserts documents and returns matches', () => {
        const index = new LshIndex();
        const docA = new Minhash();
        const docB = new Minhash();
        docA.update('hello');
        docB.update('hello');

        index.insert('a', docA);
        index.insert('b', docB);

        const results = index.query(docA);
        expect(results).toContain('a');
        expect(results).toContain('b');
    });

    it('supports configurable band sizes', () => {
        const index = new LshIndex({ bandSize: 3 });
        const doc = new Minhash();
        index.insert('doc', doc);
        expect(doc.hashbands).toBeDefined();
        expect(doc.hashbands?.[0]?.split('.')).toHaveLength(3);
    });

    it('deduplicates matches inside the same bucket', () => {
        const index = new LshIndex();
        const doc = new Minhash();
        doc.update('something');
        index.insert('doc', doc);
        index.insert('doc', doc);
        expect(index.query(doc)).toEqual(['doc']);
    });

    it('supports scored search with payloads and limits', () => {
        const index = new LshIndex<{ title: string }>();
        const docA = Minhash.fromTokens(['hello', 'world']);
        const docB = Minhash.fromTokens(['hello', 'mars']);
        const query = Minhash.fromTokens(['hello']);

        index.insert('a', docA, { title: 'Earth' });
        index.insert('b', docB, { title: 'Mars' });

        const results = index.search(query, { limit: 1 });
        expect(results).toHaveLength(1);
        expect(results[0]).toMatchObject({ key: 'a' });
        expect(results[0].value?.title).toBe('Earth');
    });

    it('removes documents and clears buckets', () => {
        const index = new LshIndex();
        const doc = Minhash.fromTokens(['foo']);
        index.insert('foo', doc);
        expect(index.size).toBe(1);
        expect(index.remove('foo')).toBe(true);
        expect(index.size).toBe(0);
        index.insert('bar', doc);
        index.clear();
        expect(index.size).toBe(0);
        expect(index.query(doc)).toEqual([]);
    });
});
