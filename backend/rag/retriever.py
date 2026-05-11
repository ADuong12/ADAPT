from __future__ import annotations

from dataclasses import dataclass

from . import embedder, store


@dataclass
class RetrievedChunk:
    kb_id: int
    kb_name: str
    section_title: str
    text: str
    distance: float | None


def retrieve_for_lesson(query_text: str, kb_specs: list[dict], top_k_per_kb: int = 3) -> list[RetrievedChunk]:
    """kb_specs is a list of {'kb_id': int, 'kb_name': str}. Returns chunks across all listed KBs."""
    if not kb_specs:
        return []
    [q_emb] = embedder.embed([query_text]) or [[]]
    if not q_emb:
        return []
    out: list[RetrievedChunk] = []
    for spec in kb_specs:
        results = store.query(spec["kb_id"], q_emb, top_k=top_k_per_kb)
        for r in results:
            md = r.get("metadata") or {}
            out.append(
                RetrievedChunk(
                    kb_id=spec["kb_id"],
                    kb_name=spec["kb_name"],
                    section_title=md.get("section_title", "Section"),
                    text=r["document"],
                    distance=r.get("distance"),
                )
            )
    return out
