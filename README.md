# lsh.ts

My attempt at a TypeScript implementation of MinHash signatures and a Locality Sensitive Hashing (LSH) index. Use it to estimate Jaccard similarity between sets and to build fast approximate nearest-neighbor lookups.

## Features

- Written in TypeScript with strict typings.
- Deterministic MinHash signatures with configurable permutation counts and reusable permutation caches.
- Helper builders plus `toJSON`/`fromJSON` for easy serialization.
- Locality Sensitive Hashing index with band-size tuning, payload support, and scored queries.
- Tested with Vitest and linted using oxlint.

## Getting Started

```bash
bun install lsh.ts
```

Or, within this repo:

```bash
bun install
```

## Usage

```ts
import { LshIndex, Minhash } from 'lsh.ts';

const documents = [
  { id: 'm1', title: 'Probabilistic data', tokens: ['minhash', 'probabilistic', 'data', 'structure'] },
  { id: 'm2', title: 'Similarity search', tokens: ['minhash', 'probability', 'structure'] },
  { id: 'm3', title: 'Cats singing', tokens: ['cats', 'are', 'known', 'to', 'sing'] }
];

const index = new LshIndex<{ title: string }>();
for (const doc of documents) {
  const signature = Minhash.fromTokens(doc.tokens);
  index.insert(doc.id, signature, { title: doc.title });
}

const query = Minhash.fromTokens(['minhash', 'probabilistic', 'structure']);
const hits = index.search(query, { minSimilarity: 0.4 });

hits.forEach((hit) => {
  console.log(`${hit.key} ${(hit.score * 100).toFixed(1)}% – ${hit.value?.title ?? 'Untitled'}`);
});
```

### Serialization Helpers

```ts
const signature = Minhash.fromTokens(['foo', 'bar']).toJSON();
await bun.write('signature.json', JSON.stringify(signature));

const hydrated = Minhash.fromJSON(signature);
console.log(hydrated.jaccard(Minhash.fromTokens(['foo', 'bar']))); // 1
```

## Credits
Heavily inspired by `minhash.js` by Douglas Duhaime - https://github.com/duhaime/minhash

## License

MIT
