from __future__ import annotations

import time

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from .. import models, schemas
from ..config import settings
from ..db import get_db
from ..deps import current_teacher
from ..llm import PROVIDERS, make_provider
from ..security import decrypt, encrypt, redact

router = APIRouter(prefix="/api/teachers", tags=["settings"])


def _ensure_self(teacher: models.Teacher, target_id: int) -> None:
    if teacher.teacher_id != target_id:
        raise HTTPException(403, "settings can only be edited by the owning teacher")


@router.get("/{teacher_id}/llm-config", response_model=schemas.LLMConfigOut | None)
def get_llm_config(teacher_id: int, db: Session = Depends(get_db), me: models.Teacher = Depends(current_teacher)):
    _ensure_self(me, teacher_id)
    cfg = db.execute(
        select(models.LLMProviderConfig)
        .where(models.LLMProviderConfig.teacher_id == teacher_id, models.LLMProviderConfig.is_active == 1)
        .order_by(models.LLMProviderConfig.updated_at.desc())
    ).scalar_one_or_none()
    if not cfg:
        return None
    return schemas.LLMConfigOut(
        provider=cfg.provider,
        model=cfg.model or settings.default_models.get(cfg.provider),
        api_key_redacted=redact(decrypt(cfg.api_key_encrypted)),
        is_active=bool(cfg.is_active),
    )


@router.put("/{teacher_id}/llm-config", response_model=schemas.LLMConfigOut)
def put_llm_config(
    teacher_id: int,
    body: schemas.LLMConfigIn,
    db: Session = Depends(get_db),
    me: models.Teacher = Depends(current_teacher),
):
    _ensure_self(me, teacher_id)
    if body.provider.lower() not in PROVIDERS:
        raise HTTPException(400, f"unknown provider; allowed: {sorted(PROVIDERS.keys())}")

    cfg = db.execute(
        select(models.LLMProviderConfig).where(
            models.LLMProviderConfig.teacher_id == teacher_id,
            models.LLMProviderConfig.provider == body.provider.lower(),
        )
    ).scalar_one_or_none()
    encrypted = encrypt(body.api_key)
    if cfg:
        cfg.model = body.model or cfg.model
        cfg.api_key_encrypted = encrypted
        cfg.is_active = 1
    else:
        cfg = models.LLMProviderConfig(
            teacher_id=teacher_id,
            provider=body.provider.lower(),
            model=body.model or settings.default_models.get(body.provider.lower()),
            api_key_encrypted=encrypted,
            is_active=1,
        )
        db.add(cfg)
    # Deactivate other providers for this teacher (one active at a time keeps the UX simple).
    others = db.execute(
        select(models.LLMProviderConfig).where(
            models.LLMProviderConfig.teacher_id == teacher_id,
            models.LLMProviderConfig.provider != body.provider.lower(),
        )
    ).scalars()
    for o in others:
        o.is_active = 0
    db.commit()
    return schemas.LLMConfigOut(
        provider=cfg.provider,
        model=cfg.model,
        api_key_redacted=redact(body.api_key),
        is_active=True,
    )


@router.post("/{teacher_id}/llm-config/test", response_model=schemas.LLMTestResult)
def test_llm_config(teacher_id: int, db: Session = Depends(get_db), me: models.Teacher = Depends(current_teacher)) -> schemas.LLMTestResult:
    _ensure_self(me, teacher_id)
    cfg = db.execute(
        select(models.LLMProviderConfig)
        .where(models.LLMProviderConfig.teacher_id == teacher_id, models.LLMProviderConfig.is_active == 1)
        .order_by(models.LLMProviderConfig.updated_at.desc())
    ).scalar_one_or_none()
    if not cfg:
        return schemas.LLMTestResult(ok=False, provider="none", model=None, error="no config saved")
    provider = make_provider(cfg.provider, decrypt(cfg.api_key_encrypted), cfg.model)
    t0 = time.time()
    ok, err = provider.ping()
    return schemas.LLMTestResult(
        ok=ok,
        provider=cfg.provider,
        model=cfg.model,
        latency_ms=int((time.time() - t0) * 1000),
        error=err,
    )
