"""AegisRAG dynamic PDF question-answering package."""

from .classifier import QueryType, classify_query

__all__ = ["AegisRAGPipeline", "QueryType", "classify_query"]


def __getattr__(name: str):
    if name == "AegisRAGPipeline":
        from .pipeline import AegisRAGPipeline

        return AegisRAGPipeline
    raise AttributeError(name)
