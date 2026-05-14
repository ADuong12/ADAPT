const EMBED_URL = process.env.EMBED_SERVER_URL || "http://127.0.0.1:9876/embed";

async function embed(texts) {
  if (!texts || texts.length === 0) return [];
  const res = await fetch(EMBED_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ texts }),
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) throw new Error(`Embedding service error: ${res.status}`);
  const data = await res.json();
  return data.embeddings;
}

async function healthCheck() {
  try {
    const res = await fetch(EMBED_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ texts: ["test"] }),
      signal: AbortSignal.timeout(5000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

module.exports = { embed, healthCheck };
