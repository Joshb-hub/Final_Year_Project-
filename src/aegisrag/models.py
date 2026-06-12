from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class DocumentChunk:
    """A searchable section of extracted document text."""

    id: str
    text: str
    document_name: str
    page_number: int
    chunk_index: int


@dataclass(frozen=True)
class RetrievalResult:
    """A document chunk returned by semantic search."""

    chunk: DocumentChunk
    score: float
