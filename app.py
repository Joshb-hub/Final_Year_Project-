from __future__ import annotations

from dotenv import load_dotenv

load_dotenv()  # Load GEMINI_API_KEY (and other vars) from .env if present

import streamlit as st

from src.aegisrag import AegisRAGPipeline


st.set_page_config(page_title="AegisRAG", page_icon="🛡️", layout="wide")
st.title("🛡️ AegisRAG")
st.caption("Dynamic RAG-based PDF question answering with query-adaptive FAISS retrieval.")

if "pipeline" not in st.session_state:
    st.session_state.pipeline = AegisRAGPipeline()
if "ingested_files" not in st.session_state:
    st.session_state.ingested_files = set()

uploaded_files = st.file_uploader("Upload one or more PDF documents", type="pdf", accept_multiple_files=True)

if uploaded_files:
    with st.spinner("Extracting text, chunking, embedding, and indexing PDFs..."):
        for uploaded_file in uploaded_files:
            if uploaded_file.name in st.session_state.ingested_files:
                continue
            chunk_count = st.session_state.pipeline.ingest_pdf(uploaded_file, uploaded_file.name)
            st.session_state.ingested_files.add(uploaded_file.name)
            st.success(f"Indexed {uploaded_file.name} into {chunk_count} chunks.")

question = st.text_input("Ask a question about the uploaded PDFs")
ask = st.button("Ask AegisRAG", type="primary", disabled=not question)

if ask:
    try:
        with st.spinner("Classifying query, retrieving context, and generating an answer..."):
            result = st.session_state.pipeline.ask(question)
        st.subheader("Answer")
        st.write(result.answer)
        st.info(f"Query type: {result.query_type.value}")

        with st.expander("Retrieved context"):
            for item in result.results:
                st.markdown(
                    f"**{item.chunk.document_name} — page {item.chunk.page_number}** "
                    f"(score: {item.score:.3f})"
                )
                st.write(item.chunk.text)
    except Exception as exc:  # Streamlit should surface user-actionable errors instead of crashing.
        st.error(str(exc))
