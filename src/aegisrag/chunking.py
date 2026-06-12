from __future__ import annotations

from collections.abc import Iterable

from .models import DocumentChunk


def chunk_text(
    pages: Iterable[tuple[int, str]],
    document_name: str,
    *,
    chunk_size: int = 900,
    overlap: int = 150,
) -> list[DocumentChunk]:
    """Split extracted PDF pages into overlapping character chunks."""

    if chunk_size <= 0:
        raise ValueError("chunk_size must be positive")
    if overlap < 0 or overlap >= chunk_size:
        raise ValueError("overlap must be non-negative and smaller than chunk_size")

    chunks: list[DocumentChunk] = []
    for page_number, raw_text in pages:
        text = " ".join(raw_text.split())
        if not text:
            continue

        start = 0
        chunk_index = 0
        while start < len(text):
            end = min(start + chunk_size, len(text))
            chunk = text[start:end].strip()
            if chunk:
                chunks.append(
                    DocumentChunk(
                        id=f"{document_name}:p{page_number}:c{chunk_index}",
                        text=chunk,
                        document_name=document_name,
                        page_number=page_number,
                        chunk_index=chunk_index,
                    )
                )
            if end == len(text):
                break
            start = end - overlap
            chunk_index += 1
    return chunks
