from __future__ import annotations

from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from .config import ROOT, settings
from .routers import adaptations, admin, auth, clusters, file_edits, knowledge_bases, lessons, settings as settings_router, teachers

app = FastAPI(title="ADAPT", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(lessons.router)
app.include_router(file_edits.router)
app.include_router(clusters.router)
app.include_router(knowledge_bases.router)
app.include_router(teachers.router)
app.include_router(adaptations.router)
app.include_router(settings_router.router)
app.include_router(admin.router)


@app.get("/api/health")
def health() -> dict:
    return {"ok": True, "db": settings.db_path.name}


# Serve the prototype as static files at /app for convenience.
_FRONTEND_DIR: Path = ROOT / "adapt-frontend-prototype-echristian-aduong"
if _FRONTEND_DIR.exists():
    app.mount("/app", StaticFiles(directory=str(_FRONTEND_DIR), html=True), name="app")


@app.get("/")
def root() -> dict:
    return {
        "service": "ADAPT",
        "frontend": "/app/login.html",
        "openapi": "/docs",
    }
