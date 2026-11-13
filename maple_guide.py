"""Lightweight local Markdown retrieval for the MapleStory guide tool."""

import re
from pathlib import Path


GUIDE_ROOT = Path(__file__).parent / "knowledge_base"


def search_maple_guide(query: str, limit: int = 4) -> list[dict]:
    query_terms = _terms(query)
    if not query_terms:
        return []

    chunks = []
    for path in GUIDE_ROOT.rglob("*.md") if GUIDE_ROOT.exists() else []:
        if path.name.lower() in {"readme.md", "contributing.md"}:
            continue
        try:
            text = path.read_text(encoding="utf-8")
        except OSError:
            continue
        for block in re.split(r"\n\s*\n", text):
            block = block.strip()
            if len(block) < 40:
                continue
            terms = _terms(block)
            overlap = sum(1 for term in query_terms if term in terms)
            if overlap:
                chunks.append((overlap / len(query_terms), path, block))

    chunks.sort(key=lambda row: row[0], reverse=True)
    return [
        {"source": str(path.relative_to(GUIDE_ROOT)), "score": round(score, 3), "text": text[:1800]}
        for score, path, text in chunks[:limit]
    ]


def _terms(text: str) -> set[str]:
    return {term.lower() for term in re.findall(r"[가-힣]{2,}|[a-zA-Z0-9_]+", text)}
