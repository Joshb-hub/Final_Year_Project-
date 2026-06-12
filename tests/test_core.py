from src.aegisrag.chunking import chunk_text
from src.aegisrag.classifier import QueryType, classify_query
from src.aegisrag.retrieval_policy import policy_for_query_type
from src.aegisrag.vector_store import diversify_results
from src.aegisrag.models import DocumentChunk, RetrievalResult


def test_classify_query_types() -> None:
    assert classify_query("What is the warranty period?") == QueryType.FACTUAL
    assert classify_query("Summarize the main points") == QueryType.SUMMARIZATION
    assert classify_query("Compare section A versus section B") == QueryType.COMPARISON


def test_retrieval_policy_is_adaptive() -> None:
    factual = policy_for_query_type(QueryType.FACTUAL)
    summary = policy_for_query_type(QueryType.SUMMARIZATION)
    comparison = policy_for_query_type(QueryType.COMPARISON)

    assert factual.top_k < summary.top_k
    assert comparison.diversify is True
    assert summary.fetch_k >= summary.top_k


def test_chunk_text_uses_overlap_and_metadata() -> None:
    chunks = chunk_text([(1, "abcdefghijklmnopqrstuvwxyz")], "demo.pdf", chunk_size=10, overlap=2)

    assert [chunk.text for chunk in chunks] == ["abcdefghij", "ijklmnopqr", "qrstuvwxyz"]
    assert chunks[0].document_name == "demo.pdf"
    assert chunks[0].page_number == 1


def test_diversify_results_prefers_different_pages() -> None:
    results = [
        RetrievalResult(DocumentChunk("a", "text", "doc.pdf", 1, 0), 0.99),
        RetrievalResult(DocumentChunk("b", "text", "doc.pdf", 1, 1), 0.98),
        RetrievalResult(DocumentChunk("c", "text", "doc.pdf", 2, 0), 0.97),
    ]

    diversified = diversify_results(results, top_k=2)

    assert [item.chunk.id for item in diversified] == ["a", "c"]
