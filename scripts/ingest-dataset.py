#!/usr/bin/env python3
"""Embed Markdown documents with Upstage and replace their Supabase chunks."""

import json
import os
import re
import sys
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parent.parent
DATASET = ROOT / "dataset"
SUPABASE_URL = os.environ.get("SUPABASE_URL", "").rstrip("/")
SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
UPSTAGE_KEY = os.environ.get("UPSTAGE_API_KEY", "")
TABLE_URL = f"{SUPABASE_URL}/rest/v1/maple_guide_chunks_upstage"


def request_json(url: str, method: str, headers: dict, payload=None):
    body = json.dumps(payload, ensure_ascii=False).encode() if payload is not None else None
    request = Request(url, data=body, headers=headers, method=method)
    try:
        with urlopen(request, timeout=60) as response:
            raw = response.read()
            return json.loads(raw) if raw else None
    except HTTPError as error:
        detail = error.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"HTTP {error.code}: {detail}") from error
    except URLError as error:
        raise RuntimeError(f"요청 실패: {error.reason}") from error


def parse_document(markdown: str):
    match = re.match(r"^---\s*\n([\s\S]*?)\n---\s*\n?", markdown)
    metadata = {}
    if match:
        for line in match.group(1).splitlines():
            field = re.match(r"^([\w-]+):\s*[\"']?(.*?)[\"']?\s*$", line)
            if field:
                metadata[field.group(1)] = field.group(2)
        markdown = markdown[match.end():]
    return metadata, markdown.strip()


def split_chunks(text: str, limit: int = 1400):
    paragraphs = [paragraph.strip() for paragraph in re.split(r"\n\s*\n", text) if paragraph.strip()]
    chunks = []
    current = ""
    for paragraph in paragraphs:
        pieces = [paragraph[index:index + limit] for index in range(0, len(paragraph), limit)]
        for piece in pieces:
            if current and len(current) + len(piece) + 2 > limit:
                chunks.append(current)
                current = ""
            current = f"{current}\n\n{piece}" if current else piece
    if current:
        chunks.append(current)
    return chunks


def embed_passages(texts):
    result = request_json(
        "https://api.upstage.ai/v1/embeddings",
        "POST",
        {"Authorization": f"Bearer {UPSTAGE_KEY}", "Content-Type": "application/json"},
        {"model": "solar-embedding-2-passage", "input": texts},
    )
    vectors = [item["embedding"] for item in result["data"]]
    if len(vectors) != len(texts) or any(len(vector) != 1024 for vector in vectors):
        raise RuntimeError("Upstage 임베딩 응답의 개수 또는 벡터 차원이 올바르지 않습니다.")
    return vectors


def replace_document(file: Path):
    relative_path = file.relative_to(ROOT).as_posix()
    metadata, body = parse_document(file.read_text(encoding="utf-8"))
    chunks = split_chunks(body)
    if not chunks:
        return

    vectors = []
    for offset in range(0, len(chunks), 20):
        vectors.extend(embed_passages(chunks[offset:offset + 20]))

    title = metadata.get("title", file.stem)
    rows = [
        {
            "content": chunk,
            "source": relative_path,
            "metadata": {
                "title": title,
                "url": metadata.get("source_url"),
                "date": metadata.get("date"),
                "category": metadata.get("category"),
                "chunk": index,
            },
            "embedding": vectors[index],
        }
        for index, chunk in enumerate(chunks)
    ]
    headers = {"apikey": SERVICE_KEY, "Authorization": f"Bearer {SERVICE_KEY}"}
    query = urlencode({"source": f"eq.{relative_path}"})
    request_json(f"{TABLE_URL}?{query}", "DELETE", headers)
    request_json(
        TABLE_URL,
        "POST",
        {**headers, "Content-Type": "application/json", "Prefer": "return=minimal"},
        rows,
    )
    print(f"적재 완료: {relative_path} ({len(chunks)} chunks)")


def main():
    if not SUPABASE_URL or not SERVICE_KEY or not UPSTAGE_KEY:
        raise RuntimeError("SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, UPSTAGE_API_KEY 환경변수를 설정하세요.")
    if not DATASET.is_dir():
        raise RuntimeError(f"문서 폴더를 찾을 수 없습니다: {DATASET}")
    files = sorted(file for file in DATASET.rglob("*.md") if file.name.lower() != "readme.md")
    if not files:
        print("dataset 폴더에 적재할 Markdown 문서가 없습니다.")
        return
    for file in files:
        replace_document(file)


if __name__ == "__main__":
    try:
        main()
    except (RuntimeError, KeyError, ValueError) as error:
        print(f"적재 실패: {error}", file=sys.stderr)
        raise SystemExit(1) from error
