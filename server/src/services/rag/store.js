const { ChromaClient } = require("chromadb");

function chromaClient() {
  const url = new URL(process.env.CHROMA_URL || "http://127.0.0.1:8000");
  return new ChromaClient({
    host: url.hostname,
    port: Number(url.port || 8000),
    ssl: url.protocol === "https:",
  });
}

const chroma = chromaClient();

// Dummy embedding function — we pass embeddings manually via the embed server.
// ChromaDB v3.x requires an embedding function but we bypass it by always
// providing embeddings in add() and query() calls.
const dummyEmbed = {
  async generate(texts) {
    return texts.map(() => new Array(384).fill(0));
  },
};

async function collectionForKb(kbId) {
  return chroma.getOrCreateCollection({
    name: `kb_${kbId}`,
    metadata: { "hnsw:space": "cosine" },
    embeddingFunction: dummyEmbed,
  });
}

async function upsertChunks(kbId, ids, embeddings, documents, metadatas) {
  if (!ids.length) return;
  const coll = await collectionForKb(kbId);
  await coll.upsert({ ids, embeddings, documents, metadatas });
}

async function query(kbId, queryEmbedding, topK = 3) {
  const coll = await collectionForKb(kbId);
  const count = await coll.count();
  if (count === 0) return [];
  const res = await coll.query({
    queryEmbeddings: [queryEmbedding],
    nResults: Math.min(topK, count),
  });
  return (res.rows()[0] || []).map((row) => ({
    id: row.id,
    document: row.document,
    metadata: row.metadata || {},
    distance: row.distance,
  }));
}

async function deleteCollectionForKb(kbId) {
  try {
    await chroma.deleteCollection({ name: `kb_${kbId}` });
  } catch (e) {
    // Missing collections are fine during reset.
  }
}

module.exports = { upsertChunks, query, collectionForKb, deleteCollectionForKb };
