"""Loopback API. One temporary archive, replaced only by successful imports."""
from concurrent.futures import ThreadPoolExecutor
from contextlib import asynccontextmanager
import json
from pathlib import Path
from threading import Lock

from fastapi import FastAPI, HTTPException, UploadFile
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from .core import Archive, extract_suggestions, normalize, query
from .synthetic import generate

executor = ThreadPoolExecutor(max_workers=1, thread_name_prefix="suggestions")
archive_lock = Lock()
active_archive: Archive | None = None


@asynccontextmanager
async def lifespan(app):
    yield
    executor.shutdown(wait=False, cancel_futures=True)


app = FastAPI(title="ECHO local archive API", lifespan=lifespan)


class Keyword(BaseModel):
    id: str
    text: str = Field(min_length=1)


class Query(BaseModel):
    channels: list[str] | None = None
    start: str | None = None
    end: str | None = None
    keywords: list[Keyword] = []


def current() -> Archive:
    with archive_lock:
        result = active_archive
    if result is None:
        raise HTTPException(409, "Import an archive first.")
    return result


def suggestions_task(archive: Archive):
    try:
        archive.suggestions = extract_suggestions(archive)
    except Exception:
        archive.suggestion_error = "Suggestion extraction failed. Message browsing is still available."


def activate(archive: Archive):
    global active_archive
    with archive_lock:
        active_archive = archive
    executor.submit(suggestions_task, archive)
    return archive.payload()


@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.post("/api/import")
def import_archive(file: UploadFile):
    try:
        # utf-8-sig also accepts ordinary UTF-8; ignore filenames as filesystem paths.
        raw = json.loads(file.file.read().decode("utf-8-sig"), parse_constant=lambda value: (_ for _ in ()).throw(ValueError(f"Invalid JSON constant: {value}")))
        archive = normalize(raw, file.filename or "archive.json")
    except (ValueError, UnicodeError, RecursionError) as error:
        raise HTTPException(422, f"Cannot import archive: {error}") from error
    return activate(archive)


@app.post("/api/demo")
def demo():
    return activate(normalize(generate(), "echo-synthetic-7000.json"))


@app.post("/api/query")
def query_archive(request: Query):
    try:
        return query(current(), channels=request.channels, start=request.start, end=request.end,
                     keywords=[k.model_dump() for k in request.keywords])
    except (ValueError, ArithmeticError) as error:
        raise HTTPException(422, str(error)) from error


@app.get("/api/suggestions")
def suggestions():
    archive = current()
    if archive.suggestion_error:
        return {"status": "error", "error": archive.suggestion_error, "items": []}
    return {"status": "ready" if archive.suggestions is not None else "pending", "items": (archive.suggestions or [])[:100]}


@app.delete("/api/archive")
def reset():
    global active_archive
    with archive_lock:
        active_archive = None
    return {"status": "cleared"}


# A built frontend is served by the same loopback process; no hosting required.
dist = Path(__file__).resolve().parents[2] / "frontend" / "dist"
if dist.is_dir():
    app.mount("/", StaticFiles(directory=dist, html=True), name="frontend")
