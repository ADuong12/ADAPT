from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from .. import models, schemas
from ..db import get_db
from ..deps import current_teacher

router = APIRouter(prefix="/api/clusters", tags=["clusters"])


@router.get("", response_model=list[schemas.ClusterWithKBs])
def list_clusters(db: Session = Depends(get_db), _t=Depends(current_teacher)) -> list[schemas.ClusterWithKBs]:
    """Returns every cluster with its KB count and the number of seeded students assigned to it (across all classes)."""
    kb_count_subq = (
        select(models.ClusterKB.cluster_id, func.count(models.ClusterKB.kb_id).label("kb_count"))
        .group_by(models.ClusterKB.cluster_id)
        .subquery()
    )
    student_count_subq = (
        select(models.Student.cluster_id, func.count(models.Student.student_id).label("student_count"))
        .group_by(models.Student.cluster_id)
        .subquery()
    )
    stmt = (
        select(
            models.StudentCluster,
            func.coalesce(kb_count_subq.c.kb_count, 0),
            func.coalesce(student_count_subq.c.student_count, 0),
        )
        .outerjoin(kb_count_subq, kb_count_subq.c.cluster_id == models.StudentCluster.cluster_id)
        .outerjoin(student_count_subq, student_count_subq.c.cluster_id == models.StudentCluster.cluster_id)
        .order_by(models.StudentCluster.cluster_id)
    )
    out: list[schemas.ClusterWithKBs] = []
    for cluster, kb_count, student_count in db.execute(stmt):
        out.append(
            schemas.ClusterWithKBs(
                cluster_id=cluster.cluster_id,
                cluster_name=cluster.cluster_name,
                cluster_description=cluster.cluster_description,
                kb_count=int(kb_count),
                student_count=int(student_count),
            )
        )
    return out


@router.get("/{cluster_id}/kbs", response_model=list[schemas.KnowledgeBaseOut])
def kbs_for_cluster(cluster_id: int, db: Session = Depends(get_db), _t=Depends(current_teacher)) -> list[schemas.KnowledgeBaseOut]:
    rows = db.execute(
        select(models.KnowledgeBase)
        .join(models.ClusterKB, models.ClusterKB.kb_id == models.KnowledgeBase.kb_id)
        .where(models.ClusterKB.cluster_id == cluster_id)
        .order_by(models.KnowledgeBase.category, models.KnowledgeBase.kb_name)
    ).scalars()
    return [schemas.KnowledgeBaseOut.model_validate(r) for r in rows]


@router.put("/{cluster_id}/kbs", response_model=list[schemas.KnowledgeBaseOut])
def update_cluster_kbs(
    cluster_id: int,
    body: schemas.ClusterKBUpdateIn,
    db: Session = Depends(get_db),
    _t=Depends(current_teacher),
) -> list[schemas.KnowledgeBaseOut]:
    cluster = db.get(models.StudentCluster, cluster_id)
    if not cluster:
        raise HTTPException(404, "cluster not found")

    kb_ids = list(dict.fromkeys(body.kb_ids))
    if kb_ids:
        found = set(
            db.execute(
                select(models.KnowledgeBase.kb_id).where(models.KnowledgeBase.kb_id.in_(kb_ids))
            ).scalars()
        )
        missing = sorted(set(kb_ids) - found)
        if missing:
            raise HTTPException(404, f"knowledge base id(s) not found: {missing}")

    db.execute(delete(models.ClusterKB).where(models.ClusterKB.cluster_id == cluster_id))
    for kb_id in kb_ids:
        db.add(models.ClusterKB(cluster_id=cluster_id, kb_id=kb_id))
    db.commit()
    return kbs_for_cluster(cluster_id, db, _t)
