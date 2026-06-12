from __future__ import annotations

import os
from pathlib import Path

from dotenv import load_dotenv

# Explicitly load .env from the project root so this module works correctly
# regardless of import order or working directory.
_ENV_PATH = Path(__file__).resolve().parents[2] / ".env"  # src/aegisrag/generation.py → parents[2] = project root
load_dotenv(dotenv_path=_ENV_PATH, override=True)

from .models import RetrievalResult

# Ordered list of models to try — falls back if one is quota-exhausted.
_MODEL_FALLBACK = [
    "gemini-2.5-flash-lite",   # confirmed available
    "gemini-2.5-flash",
    "gemini-flash-lite-latest",
    "gemini-flash-latest",
    "gemini-2.0-flash-lite",
    "gemini-2.0-flash",
]


def build_context(results: list[RetrievalResult]) -> str:
    """Format retrieved chunks with source labels for answer generation."""

    return "\n\n".join(
        f"Source: {result.chunk.document_name}, page {result.chunk.page_number}\n{result.chunk.text}"
        for result in results
    )


def generate_answer(question: str, results: list[RetrievalResult]) -> str:
    """Generate an answer with Gemini when configured, otherwise use extractive context."""

    if not results:
        return "I could not find relevant context in the uploaded PDFs."

    api_key = os.getenv("GEMINI_API_KEY")
    context = build_context(results)

    if api_key:
        try:
            from google import genai
            from google.genai import types

            client = genai.Client(api_key=api_key)

            # Use env override, then try fallback model list.
            env_model = os.getenv("AEGISRAG_GEMINI_MODEL")
            models_to_try = [env_model] if env_model else _MODEL_FALLBACK

            last_error: Exception | None = None
            for model_name in models_to_try:
                try:
                    response = client.models.generate_content(
                        model=model_name,
                        contents=f"Question: {question}\n\nContext:\n{context}",
                        config=types.GenerateContentConfig(
                            system_instruction=(
                                "Answer using only the provided PDF context. "
                                "If the context is insufficient, say what is missing. "
                                "Include concise source references by document and page."
                            ),
                            temperature=0.2,
                        ),
                    )
                    return response.text or "No answer was generated."
                except Exception as exc:
                    exc_str = str(exc)
                    # Quota / rate-limit: try next model.
                    if "429" in exc_str or "RESOURCE_EXHAUSTED" in exc_str or "quota" in exc_str.lower():
                        last_error = exc
                        continue
                    # Any other error: surface it immediately.
                    return (
                        f"Gemini API error ({model_name}): {exc_str}\n\n"
                        "Here is the most relevant retrieved context instead:\n\n"
                        f"{context[:2500]}"
                    )

            # All models exhausted quota.
            return (
                f"All Gemini models have exceeded their quota ({last_error}).\n\n"
                "Here is the most relevant retrieved context instead:\n\n"
                f"Question: {question}\n\n{context[:2500]}"
            )

        except ImportError:
            pass  # Fall through to extractive answer below.

    sources = ", ".join(
        f"{result.chunk.document_name} p.{result.chunk.page_number}" for result in results[:3]
    )
    return (
        "GEMINI_API_KEY is not set, so here is the most relevant retrieved context instead.\n\n"
        f"Question: {question}\n\nSources: {sources}\n\n{context[:2500]}"
    )
