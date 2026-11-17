# MapleStory Chatbot 문서 데이터

이 폴더의 Markdown 문서가 챗봇의 RAG 검색 대상입니다. `announcements/`에는 넥슨 공식 공지의 핵심 내용을 정리하고, 원문 URL과 게시일을 함께 기록합니다. 공지 내용이 수정되거나 기간이 끝나면 원문을 확인해 문서를 갱신하세요. 현재 포함된 공지는 참고용으로 정리한 스냅샷이며 실시간으로 자동 동기화되지 않습니다.

문서 앞부분의 메타데이터 예시:

```yaml
---
title: 공지 제목
source_url: https://maplestory.nexon.com/News/Notice/...
date: 2026-11-17
category: notice
---
```

변경 후 저장소 루트에서 아래 명령으로 Supabase에 재적재합니다. 같은 파일은 기존 chunk를 지우고 새 임베딩으로 교체합니다.

```bash
python3 scripts/ingest-dataset.py
```

필요 환경변수는 `dataset/.env.example`을 참고하세요. 실제 `.env`는 Git에 커밋하지 마세요. 임베딩에는 Upstage `solar-embedding-2-passage` (1024차원), 질문 검색에는 `solar-embedding-2-query`를 사용합니다.
