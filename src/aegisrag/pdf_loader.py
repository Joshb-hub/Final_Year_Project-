from __future__ import annotations

from pathlib import Path
from typing import BinaryIO

from pypdf import PdfReader


def extract_pdf_pages(file: str | Path | BinaryIO) -> list[tuple[int, str]]:
    """Extract text from each page of a PDF file-like object or path."""

    reader = PdfReader(file)
    pages: list[tuple[int, str]] = []
    for index, page in enumerate(reader.pages, start=1):
        pages.append((index, page.extract_text() or ""))
    return pages
