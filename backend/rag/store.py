from __future__ import annotations

from functools import lru_cache

from ..config import settings


@lru_cache(maxsize=1)
def get_client():
    import chromadb
    return chromadb.PersistentClient(path=str(settings.chroma_path))


def collection_for_kb(kb_id: int):
    client = get_client()
    return client.get_or_create_collection(
        name=f"kb_{kb_id}",
        metadata={"hnsw:space": "cosine"},
    )


def upsert_chunks(kb_id: int, ids: list[str], embeddings: list[list[float]], documents: list[str], metadatas: list[dict]) -> None:
    if not ids:
        return
    coll = collection_for_kb(kb_id)
    coll.upsert(ids=ids, embeddings=embeddings, documents=documents, metadatas=metadatas)


def query(kb_id: int, query_embedding: list[float], top_k: int = 3) -> list[dict]:
    coll = collection_for_kb(kb_id)
    if coll.count() == 0:
        return []
    res = coll.query(query_embeddings=[query_embedding], n_results=min(top_k, coll.count()))
    out = []
    for i in range(len(res["ids"][0])):
        out.append(
            {
                "id": res["ids"][0][i],
                "document": res["documents"][0][i],
                "metadata": res["metadatas"][0][i] if res.get("metadatas") else {},
                "distance": res["distances"][0][i] if res.get("distances") else None,
            }
        )
    return out
