from __future__ import annotations

from dataclasses import dataclass

from .classifier import QueryType


@dataclass(frozen=True)
class RetrievalPolicy:
    """Retrieval parameters selected from query intent."""

    top_k: int
    fetch_k: int
    diversify: bool


_POLICIES = {
    QueryType.FACTUAL: RetrievalPolicy(top_k=4, fetch_k=8, diversify=False),
    QueryType.SUMMARIZATION: RetrievalPolicy(top_k=12, fetch_k=24, diversify=True),
    QueryType.COMPARISON: RetrievalPolicy(top_k=8, fetch_k=20, diversify=True),
}


def policy_for_query_type(query_type: QueryType) -> RetrievalPolicy:
    """Return adaptive retrieval settings for the classified query type."""

    return _POLICIES[query_type]
