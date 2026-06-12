# AegisRAG

AegisRAG is a dynamic RAG-based PDF question-answering system. Users upload PDF documents, the app extracts and chunks their text, embeds the chunks, stores them in a FAISS vector index, classifies each question, adaptively retrieves the most useful context, and generates an answer from the retrieved evidence.

## Key idea

Traditional RAG systems often retrieve a fixed number of chunks for every prompt. AegisRAG changes retrieval behavior by query type:

- **Factual** questions retrieve a small set of highly relevant chunks.
- **Summarization** requests retrieve broader coverage across the document set.
- **Comparison** questions retrieve more chunks and diversify results across documents/sections.

## Quick start

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
streamlit run app.py

# Or run the hosted browser app/API
uvicorn web_app:app --host 0.0.0.0 --port 8000
```

Set `GEMINI_API_KEY` in a `.env` file at the project root to enable AI-generated answers via Gemini. Optionally set `AEGISRAG_GEMINI_MODEL` to override the default model (`gemini-2.5-flash-lite`).

## Project layout

```text
app.py                    Streamlit web interface
web_app.py                FastAPI hosted web app and API
src/aegisrag/             Core package
  chunking.py             Text chunking
  classifier.py           Query classification
  embeddings.py           Embedding model wrapper
  generation.py           LLM/extractive answer generation
  pdf_loader.py           PDF text extraction
  pipeline.py             End-to-end orchestration
  retrieval_policy.py     Query-adaptive retrieval settings
  vector_store.py         FAISS-backed semantic search
web/                      Browser UI assets for the hosted app
tests/                    Unit tests for core behavior
```

## Hosted web app

Run `uvicorn web_app:app --host 0.0.0.0 --port 8000` and open `http://localhost:8000`. The hosted app exposes:

- `POST /api/sessions` to create an isolated in-memory browser session.
- `POST /api/upload` to index one or more PDFs for that session.
- `POST /api/ask` to classify the question, retrieve adaptive context, and return an answer with sources.
- `DELETE /api/sessions/{session_id}` to reset a session.
