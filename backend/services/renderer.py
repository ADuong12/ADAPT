from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import Any

from jinja2 import Environment, FileSystemLoader, select_autoescape

_TEMPLATE_DIR = Path(__file__).resolve().parent.parent / "templates"


@lru_cache(maxsize=1)
def _env() -> Environment:
    return Environment(
        loader=FileSystemLoader(str(_TEMPLATE_DIR)),
        autoescape=select_autoescape(["html"]),
        trim_blocks=True,
        lstrip_blocks=True,
    )


def render_lesson_plan(
    *,
    lesson: dict[str, Any],
    cluster: dict[str, Any],
    plan_json: dict[str, Any],
    knowledge_bases_used: list[dict[str, Any]],
    provider: str,
    model_used: str,
) -> str:
    tpl = _env().get_template("lesson_plan.html.j2")
    return tpl.render(
        lesson=lesson,
        cluster=cluster,
        recommendations=plan_json.get("recommendations") or [],
        plan_steps=plan_json.get("plan_steps") or [],
        companion_materials=plan_json.get("companion_materials") or [],
        knowledge_bases_used=knowledge_bases_used,
        provider=provider,
        model_used=model_used,
    )
