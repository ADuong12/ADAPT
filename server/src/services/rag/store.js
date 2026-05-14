const { ChromaClient } = require("chromadb");

const chroma = new ChromaClient({ path: process.env.CHROMA_URL || "http://localhost:8000" });

async function collectionForKb(kbId) {
  return chroma.getOrCreateCollection({
    name: `kb_${kbId}`,
    metadata: { "hnsw:space": "cosine" },
  });
}

async function upsertChunks(kbId, ids, embeddings, documents, metadatas) {
  if (!ids.length) return;
  const coll = await collectionForKb(kbId);
  await coll.add({ ids, embeddings, documents, metadatas });
}

async function query(kbId, queryEmbedding, topK = 3) {
  const coll = await collectionForKb(kbId);
  const count = await coll.count();
  if (count === 0) return [];
  const res = await coll.query({
    queryEmbeddings: [queryEmbedding],
    nResults: Math.min(topK, count),
  });
  return res.rows().map((row) => ({
    id: row.id,
    document: row.document,
    metadata: row.metadata || {},
    distance: row.distance,
  }));
}

module.exports = { upsertChunks, query, collectionForKb };
