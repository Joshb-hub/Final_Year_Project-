from __future__ import annotations

from dataclasses import dataclass, field
from typing import BinaryIO

from .chunking import chunk_text
from .classifier import QueryType, classify_query
from .embeddings import EmbeddingModel
from .generation import generate_answer
from .models import DocumentChunk, RetrievalResult
from .pdf_loader import extract_pdf_pages
from .retrieval_policy import policy_for_query_type
from .vector_store import FAISSVectorStore, diversify_results


@dataclass
class AskResult:
    query_type: QueryType
    answer: str
    results: list[RetrievalResult] = field(default_factory=list)


class AegisRAGPipeline:
    """End-to-end dynamic RAG pipeline for uploaded PDFs."""

    def __init__(self, embedding_model: EmbeddingModel | None = None) -> None:
        self.embedding_model = embedding_model or EmbeddingModel()
        self.vector_store: FAISSVectorStore | None = None
        self.chunks: list[DocumentChunk] = []

    def ingest_pdf(self, file: str | BinaryIO, document_name: str) -> int:
        pages = extract_pdf_pages(file)
        chunks = chunk_text(pages, document_name)
        if not chunks:
            return 0

        embeddings = self.embedding_model.encode([chunk.text for chunk in chunks])
        if self.vector_store is None:
            self.vector_store = FAISSVectorStore(embeddings.shape[1])
        self.vector_store.add(embeddings, chunks)
        self.chunks.extend(chunks)
        return len(chunks)

    def ask(self, question: str) -> AskResult:
        if self.vector_store is None or not self.chunks:
            raise ValueError("Upload at least one PDF before asking a question.")

        query_type = classify_query(question)
        policy = policy_for_query_type(query_type)
        query_embedding = self.embedding_model.encode([question])
        results = self.vector_store.search(query_embedding, top_k=policy.fetch_k, fetch_k=policy.fetch_k)
        if policy.diversify:
            results = diversify_results(results, policy.top_k)
        else:
            results = results[: policy.top_k]
        return AskResult(query_type=query_type, answer=generate_answer(question, results), results=results)
