from __future__ import annotations

import re
from dataclasses import dataclass
from pathlib import Path


@dataclass
class Chunk:
    section_title: str
    text: str
    order: int


_HEADING_RE = re.compile(r"^(?:\d+\.\s+|[A-Z][A-Z\s]{4,}|[•\-]\s+)(.+)$")


def extract_text(path: Path) -> str:
    suffix = path.suffix.lower()
    if suffix == ".txt":
        return path.read_text(encoding="utf-8", errors="ignore")
    if suffix == ".pdf":
        try:
            import pdfplumber
            text_parts = []
            with pdfplumber.open(path) as pdf:
                for page in pdf.pages:
                    text_parts.append(page.extract_text() or "")
            return "\n".join(text_parts)
        except Exception:
            pass
        try:
            from PyPDF2 import PdfReader
            reader = PdfReader(str(path))
            return "\n".join((p.extract_text() or "") for p in reader.pages)
        except Exception:
            return ""
    return path.read_text(encoding="utf-8", errors="ignore")


def chunk_by_section(raw: str, min_len: int = 120, max_len: int = 1400) -> list[Chunk]:
    """Split on heading-like lines (numbered, all-caps, bullets); fall back to paragraph windows."""
    lines = [ln.rstrip() for ln in raw.splitlines() if ln.strip()]
    sections: list[tuple[str, list[str]]] = []
    current_title = "Introduction"
    current_body: list[str] = []
    for ln in lines:
        m = _HEADING_RE.match(ln.strip())
        is_heading = bool(m) and len(ln.strip()) <= 80
        if is_heading and current_body:
            sections.append((current_title, current_body))
            current_title = m.group(1).strip()
            current_body = []
        elif is_heading:
            current_title = m.group(1).strip()
        else:
            current_body.append(ln)
    if current_body:
        sections.append((current_title, current_body))

    chunks: list[Chunk] = []
    order = 0
    for title, body_lines in sections:
        body = " ".join(body_lines).strip()
        if not body:
            continue
        if len(body) <= max_len:
            if len(body) >= min_len:
                chunks.append(Chunk(section_title=title, text=body, order=order))
                order += 1
            continue
        # too long: window it
        for i in range(0, len(body), max_len):
            piece = body[i : i + max_len].strip()
            if len(piece) >= min_len:
                chunks.append(Chunk(section_title=f"{title} ({i // max_len + 1})", text=piece, order=order))
                order += 1
    return chunks
