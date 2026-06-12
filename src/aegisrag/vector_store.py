from __future__ import annotations

from typing import TYPE_CHECKING

from .models import DocumentChunk, RetrievalResult


if TYPE_CHECKING:
    import numpy as np


class FAISSVectorStore:
    """FAISS index for cosine-similarity search over normalized embeddings."""

    def __init__(self, dimension: int) -> None:
        import faiss

        self._faiss = faiss
        self.index = faiss.IndexFlatIP(dimension)
        self.chunks: list[DocumentChunk] = []

    def add(self, embeddings: np.ndarray, chunks: list[DocumentChunk]) -> None:
        if len(embeddings) != len(chunks):
            raise ValueError("embeddings and chunks must have the same length")
        if len(chunks) == 0:
            return
        import numpy as np

        self.index.add(np.asarray(embeddings, dtype="float32"))
        self.chunks.extend(chunks)

    def search(self, query_embedding: np.ndarray, *, top_k: int, fetch_k: int | None = None) -> list[RetrievalResult]:
        if self.index.ntotal == 0:
            return []
        candidate_count = min(fetch_k or top_k, self.index.ntotal)
        import numpy as np

        scores, indices = self.index.search(np.asarray(query_embedding, dtype="float32"), candidate_count)
        results: list[RetrievalResult] = []
        for score, index in zip(scores[0], indices[0], strict=False):
            if index < 0:
                continue
            results.append(RetrievalResult(chunk=self.chunks[int(index)], score=float(score)))
        return results[:top_k]


def diversify_results(results: list[RetrievalResult], top_k: int) -> list[RetrievalResult]:
    """Prefer coverage across documents and pages while preserving relevance."""

    selected: list[RetrievalResult] = []
    seen_sections: set[tuple[str, int]] = set()

    for result in results:
        section = (result.chunk.document_name, result.chunk.page_number)
        if section in seen_sections:
            continue
        selected.append(result)
        seen_sections.add(section)
        if len(selected) == top_k:
            return selected

    for result in results:
        if result not in selected:
            selected.append(result)
        if len(selected) == top_k:
            break
    return selected
