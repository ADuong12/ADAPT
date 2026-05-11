"""Create lesson_plan_version rows from the 4 sample adapted_lessons.

The SQL seed data has 4 adapted_lesson rows with recommendations/adapted_plan/companion_materials
as plain text blobs. This script wraps each into a properly formatted plan_json + rendered HTML
and creates version 1 with is_head=1 so the results.html UI can find them.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

import sqlite3

DB = ROOT / "adapt.db"


def main() -> None:
    con = sqlite3.connect(DB)
    cur = con.cursor()

    # Check if we already have rows
    exist = cur.execute("SELECT COUNT(*) FROM lesson_plan_version").fetchone()[0]
    if exist:
        print(f"  {exist} version rows already exist, skipping")
        con.close()
        return

    rows = cur.execute(
        """SELECT a.adapted_id, a.lesson_id, a.teacher_id, a.cluster_id,
                  a.recommendations, a.adapted_plan, a.companion_materials,
                  l.title, l.grade_level, l.cs_topic, l.cs_standard,
                  sc.cluster_name, sc.cluster_description
           FROM adapted_lesson a
           JOIN lesson l ON l.lesson_id = a.lesson_id
           JOIN student_cluster sc ON sc.cluster_id = a.cluster_id
        """
    ).fetchall()

    for row in rows:
        (
            adapted_id,
            lesson_id,
            teacher_id,
            cluster_id,
            recs_raw,
            plan_raw,
            mats_raw,
            title,
            grade_level,
            cs_topic,
            cs_standard,
            cluster_name,
            cluster_description,
        ) = row

        # Build a plan_json structure from the text blobs
        plan_json = {
            "recommendations": [
                {"title": "Recommendation", "body": recs_raw or "", "tag": "other", "sources": []}
            ],
            "plan_steps": [
                {"title": "Adapted plan", "duration": "—", "body": plan_raw or ""}
            ],
            "companion_materials": [
                {"title": "Companion materials", "description": mats_raw or ""}
            ],
        }

        rendered = f"""<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8">
<title>{title} — {cluster_name}</title>
<style>
  body {{ font-family: system-ui; max-width: 760px; margin: 32px auto; padding: 0 24px; line-height: 1.55; }}
  h1 {{ font-size: 26px; }}
  section {{ margin: 28px 0; }}
  section h2 {{ font-size: 18px; border-bottom: 1px solid #ddd; }}
  .rec {{ border-left: 3px solid #1E40AF; padding: 10px 14px; background: #f5f5f5; margin: 10px 0; }}
  .step {{ margin: 12px 0; }}
  .material {{ background: #f5f5f5; padding: 12px 14px; border-radius: 8px; }}
</style>
</head>
<body>
<h1>{title}</h1>
<div style="color:#666;font-size:14px;">Adapted for {cluster_name}</div>
<section id="recommendations"><h2>Recommendations</h2>
<div class="rec"><p>{recs_raw or "—"}</p></div></section>
<section id="adapted-plan"><h2>Adapted lesson plan</h2>
<div class="step"><p>{plan_raw or "—"}</p></div></section>
<section id="companion-materials"><h2>Companion materials</h2>
<div class="material"><p>{mats_raw or "—"}</p></div></section>
</body>
</html>"""

        cur.execute(
            """INSERT INTO lesson_plan_version
               (adapted_id, parent_version_id, version_number, is_head, instruction,
                rendered_html, plan_json, model_used, provider, token_count, created_at)
               VALUES (?, NULL, 1, 1, NULL, ?, ?, 'sample-data', 'seed', 0, CURRENT_TIMESTAMP)""",
            (adapted_id, rendered, json.dumps(plan_json)),
        )
        print(f"  adapted_id={adapted_id} → v1 (seed)")

    con.commit()
    print(f"\nCreated {len(rows)} version row(s).")
    con.close()


if __name__ == "__main__":
    main()
