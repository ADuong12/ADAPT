from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from .. import models, schemas
from ..db import get_db
from ..deps import current_teacher

router = APIRouter(prefix="/api/knowledge-bases", tags=["knowledge_bases"])


@router.get("", response_model=list[schemas.KnowledgeBaseOut])
def list_kbs(db: Session = Depends(get_db), _t=Depends(current_teacher)) -> list[schemas.KnowledgeBaseOut]:
    rows = db.execute(
        select(models.KnowledgeBase).order_by(models.KnowledgeBase.category, models.KnowledgeBase.kb_id)
    ).scalars()
    return [schemas.KnowledgeBaseOut.model_validate(r) for r in rows]
