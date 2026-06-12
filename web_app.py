from __future__ import annotations

from dotenv import load_dotenv

load_dotenv()  # Load GEMINI_API_KEY (and other vars) from .env if present

from pathlib import Path
from uuid import uuid4

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from src.aegisrag import AegisRAGPipeline

BASE_DIR = Path(__file__).resolve().parent
STATIC_DIR = BASE_DIR / "web" / "static"

app = FastAPI(
    title="AegisRAG Web App",
    description="Hosted API and browser UI for dynamic RAG-based PDF question answering.",
    version="0.1.0",
)
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

_PIPELINES: dict[str, AegisRAGPipeline] = {}
_INGESTED_FILES: dict[str, set[str]] = {}


class SessionResponse(BaseModel):
    session_id: str


class UploadResponse(BaseModel):
    session_id: str
    indexed_files: list[dict[str, int | str]]
    total_chunks: int


class AskRequest(BaseModel):
    session_id: str
    question: str


class SourceResponse(BaseModel):
    document_name: str
    page_number: int
    score: float
    text: str


class AskResponse(BaseModel):
    query_type: str
    answer: str
    sources: list[SourceResponse]


def _get_pipeline(session_id: str) -> AegisRAGPipeline:
    if not session_id:
        raise HTTPException(status_code=400, detail="session_id is required")
    if session_id not in _PIPELINES:
        _PIPELINES[session_id] = AegisRAGPipeline()
        _INGESTED_FILES[session_id] = set()
    return _PIPELINES[session_id]


@app.get("/", include_in_schema=False)
def index() -> FileResponse:
    return FileResponse(BASE_DIR / "web" / "index.html")


@app.post("/api/sessions", response_model=SessionResponse)
def create_session() -> SessionResponse:
    session_id = uuid4().hex
    _PIPELINES[session_id] = AegisRAGPipeline()
    _INGESTED_FILES[session_id] = set()
    return SessionResponse(session_id=session_id)


@app.post("/api/upload", response_model=UploadResponse)
async def upload_pdfs(
    session_id: str = Form(...),
    files: list[UploadFile] = File(...),
) -> UploadResponse:
    pipeline = _get_pipeline(session_id)
    ingested_files = _INGESTED_FILES[session_id]
    indexed_files: list[dict[str, int | str]] = []

    for uploaded_file in files:
        if not uploaded_file.filename.lower().endswith(".pdf"):
            raise HTTPException(status_code=400, detail=f"{uploaded_file.filename} is not a PDF")
        if uploaded_file.filename in ingested_files:
            indexed_files.append({"name": uploaded_file.filename, "chunks": 0, "status": "already_indexed"})
            continue
        chunk_count = pipeline.ingest_pdf(uploaded_file.file, uploaded_file.filename)
        ingested_files.add(uploaded_file.filename)
        indexed_files.append({"name": uploaded_file.filename, "chunks": chunk_count, "status": "indexed"})

    return UploadResponse(session_id=session_id, indexed_files=indexed_files, total_chunks=len(pipeline.chunks))


@app.post("/api/ask", response_model=AskResponse)
def ask_question(request: AskRequest) -> AskResponse:
    if not request.question.strip():
        raise HTTPException(status_code=400, detail="question is required")

    pipeline = _get_pipeline(request.session_id)
    try:
        result = pipeline.ask(request.question)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return AskResponse(
        query_type=result.query_type.value,
        answer=result.answer,
        sources=[
            SourceResponse(
                document_name=item.chunk.document_name,
                page_number=item.chunk.page_number,
                score=item.score,
                text=item.chunk.text,
            )
            for item in result.results
        ],
    )


@app.delete("/api/sessions/{session_id}", response_model=SessionResponse)
def reset_session(session_id: str) -> SessionResponse:
    _PIPELINES.pop(session_id, None)
    _INGESTED_FILES.pop(session_id, None)
    return SessionResponse(session_id=session_id)
