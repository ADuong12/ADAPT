"""Apply CREATE TABLE / CREATE INDEX statements from adapt-database.sql to adapt.db.

Idempotent (every statement uses IF NOT EXISTS). Run this any time the schema
file gains new tables or indexes.
"""

from __future__ import annotations

import sqlite3
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DB = ROOT / "adapt.db"
SQL = ROOT / "adapt-database.sql"


def main() -> None:
    if not DB.exists():
        print(f"creating empty {DB}")
    text = SQL.read_text(encoding="utf-8")
    blocks: list[str] = []
    buf: list[str] = []
    in_block = False
    for line in text.splitlines():
        s = line.strip().upper()
        if s.startswith("CREATE TABLE") or s.startswith("CREATE INDEX"):
            in_block = True
        if in_block:
            buf.append(line)
            if line.strip().endswith(";"):
                blocks.append("\n".join(buf))
                buf = []
                in_block = False

    con = sqlite3.connect(DB)
    for stmt in blocks:
        con.execute(stmt)
    con.commit()
    print(f"applied {len(blocks)} DDL statements; tables now in {DB.name}:")
    for (n,) in con.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"):
        print(f"  - {n}")
    con.close()


if __name__ == "__main__":
    main()
