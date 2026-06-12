from pathlib import Path


def test_hosted_web_app_files_are_present() -> None:
    assert Path("web_app.py").read_text().count("@app.post") >= 3
    assert "AegisRAG" in Path("web/index.html").read_text()
    assert "/api/upload" in Path("web/static/app.js").read_text()
