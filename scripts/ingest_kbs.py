"""Ingest knowledge base documents into ChromaDB.

Reads files from ./Knowledge Bases/, chunks them by section, embeds with
sentence-transformers, and upserts into the per-KB Chroma collection.

Usage:
    python -m scripts.ingest_kbs                # ingest everything mapped below
    python -m scripts.ingest_kbs --kb-id 4      # only one KB
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from backend.config import settings  # noqa: E402
from backend.rag import chunker, embedder, store  # noqa: E402

# kb_id (matches seeded knowledge_base table) -> list of source files in Knowledge Bases/
KB_FILE_MAP: dict[int, list[str]] = {
    1: ["KB_UDL_Table_accessible.pdf", "KB_udlg3-graphicorganizer-digital-numbers-a11y.pdf"],
    2: ["KB_UDL_Table_accessible.pdf"],
    3: ["KB_CRP.txt"],
    4: ["KB_mll combined.pdf", "P_Spanish-MLL.txt"],
}

KB_DIR = settings.knowledge_bases_dir


def ingest_one(kb_id: int) -> int:
    files = KB_FILE_MAP.get(kb_id, [])
    if not files:
        print(f"  KB {kb_id}: no source files mapped, skipping")
        return 0
    all_chunks = []
    for fname in files:
        path = KB_DIR / fname
        if not path.exists():
            print(f"  KB {kb_id}: file missing {path}, skipping")
            continue
        text = chunker.extract_text(path)
        if not text.strip():
            print(f"  KB {kb_id}: empty extraction from {fname}")
            continue
        chunks = chunker.chunk_by_section(text)
        for c in chunks:
            all_chunks.append((fname, c))
    if not all_chunks:
        print(f"  KB {kb_id}: no chunks produced")
        return 0
    print(f"  KB {kb_id}: {len(all_chunks)} chunks, embedding...")
    docs = [c.text for _, c in all_chunks]
    embs = embedder.embed(docs)
    ids = [f"kb{kb_id}_{src}_{c.order}" for src, c in all_chunks]
    metas = [
        {"kb_id": kb_id, "source_file": src, "section_title": c.section_title, "order": c.order}
        for src, c in all_chunks
    ]
    store.upsert_chunks(kb_id, ids, embs, docs, metas)
    print(f"  KB {kb_id}: upserted {len(ids)} chunks into Chroma")
    return len(ids)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--kb-id", type=int, default=None)
    args = parser.parse_args()

    targets = [args.kb_id] if args.kb_id else sorted(KB_FILE_MAP.keys())
    total = 0
    for kb_id in targets:
        total += ingest_one(kb_id)
    print(f"\nDone. {total} chunks ingested across {len(targets)} KB(s).")


if __name__ == "__main__":
    main()
