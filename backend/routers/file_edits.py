from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse

from ..deps import current_teacher
from ..services import source_editor

router = APIRouter(prefix="/api/lesson-file-edits", tags=["lesson-file-edits"])


@router.get("/{filename}")
def download_edit(filename: str, _teacher=Depends(current_teacher)) -> FileResponse:
    try:
        path = source_editor.edited_file_path(filename)
    except LookupError as e:
        raise HTTPException(404, str(e)) from e
    return FileResponse(path=str(path), filename=path.name)
