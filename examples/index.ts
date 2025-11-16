import { LshIndex, Minhash } from '../src';

type Document = {
    id: string;
    tokens: string[];
    title: string;
};

const documents: Document[] = [
    {
        id: 'm1',
        title: 'Probabilistic data structures',
        tokens: ['minhash', 'is', 'a', 'probabilistic', 'data', 'structure']
    },
    {
        id: 'm2',
        title: 'Probability and similarity',
        tokens: ['minhash', 'is', 'a', 'probability', 'data', 'structure']
    },
    {
        id: 'm3',
        title: 'Cats singing loudly',
        tokens: ['cats', 'are', 'known', 'to', 'sing', 'loudly']
    }
];

const index = new LshIndex<{ title: string }>({ bandSize: 2 });

for (const doc of documents) {
    const signature = Minhash.fromTokens(doc.tokens);
    index.insert(doc.id, signature, { title: doc.title });
}

const query = Minhash.fromTokens(['minhash', 'probabilistic', 'similarity', 'structure']);
const hits = index.search(query, { minSimilarity: 0.2 });

console.log('Top matches (score, title):');
for (const hit of hits) {
    const title = hit.value?.title ?? 'Unknown';
    console.log(`- ${hit.key}: ${(hit.score * 100).toFixed(1)}% – ${title}`);
}

const serialized = query.toJSON();
const roundTrip = Minhash.fromJSON(serialized);
console.log('Round-trip similarity:', query.jaccard(roundTrip).toFixed(2));
