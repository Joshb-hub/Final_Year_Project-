from __future__ import annotations

from enum import Enum


class QueryType(str, Enum):
    """Supported retrieval intents."""

    FACTUAL = "factual"
    SUMMARIZATION = "summarization"
    COMPARISON = "comparison"


_SUMMARY_TERMS = {
    "summarize",
    "summary",
    "overview",
    "brief",
    "main points",
    "key points",
    "gist",
    "abstract",
}

_COMPARISON_TERMS = {
    "compare",
    "contrast",
    "difference",
    "differences",
    "similar",
    "similarities",
    "versus",
    " vs ",
    "pros and cons",
    "tradeoff",
    "trade-off",
}


def classify_query(query: str) -> QueryType:
    """Classify a user query into the retrieval behavior it needs.

    The classifier is intentionally deterministic and lightweight so the app can
    route retrieval before calling an LLM. It can be replaced later with a model
    based classifier without changing the retrieval policy interface.
    """

    normalized = f" {query.lower().strip()} "
    if any(term in normalized for term in _COMPARISON_TERMS):
        return QueryType.COMPARISON
    if any(term in normalized for term in _SUMMARY_TERMS):
        return QueryType.SUMMARIZATION
    return QueryType.FACTUAL
