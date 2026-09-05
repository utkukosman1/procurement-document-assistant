# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## What this project is

A 7-day take-home technical assessment for a Software Engineer role at Monq: an "AI-Powered
Strategic Procurement Negotiation Platform" (upload PDF → extract/chunk/embed → classify
procurement doc type → RAG chat). Source spec: `se-hometask.pdf` (gitignored, confidential).

Evaluation weights: Chunking & RAG quality 25%, End-to-end flow 20%, Architecture & APIs 20%,
Code quality 20%, Testing 10%, Reasoning & AI use 5%. Prioritize RAG/chunking/architecture
quality over frontend polish or infra sophistication.

**IP/submission constraints:** candidate keeps IP; must not be shared/deployed publicly.
Never `git push` to a public remote or add repo collaborators without explicit user go-ahead.

## Workflow

- **Docs deferred to Day 5.** Do not write `docs/architecture.md`, API contract docs, or README
  content during early implementation days. When a day's plan mentions "finalize the
  architecture/API contract/data model," implement that as project structure, Pydantic models,
  and route signatures — not as prose documentation — unless a day's brief explicitly names a
  document deliverable.
- Build incrementally, one step at a time. Don't jump ahead to the next day's work unprompted.
- Commit messages must NOT include a `Co-Authored-By: Codex` trailer.

## Architecture decisions (standing design — don't relitigate without asking)

- FastAPI backend + Next.js frontend. Next.js is a standalone frontend calling the FastAPI
  backend (not using its own API routes as a fullstack framework).
- OpenAI for everything: `gpt-4o-mini`/`4.1-mini` for classification + chat via
  `client.chat.completions.parse(...)` structured outputs, `text-embedding-3-small` for
  embeddings. Single `OPENAI_API_KEY` env var.
- ChromaDB, embedded via `PersistentClient` (local directory, no server/container).
- `backend/app/store/vector_store.py`'s `VectorStore` class is the *only* abstraction layer over
  Chroma — no repository/factory/adapter pattern on top. Don't reintroduce one "for
  swappability."
- Chunking: 300–500 token chunks (`tiktoken`), 10–20% overlap, structural boundaries
  (headings/paragraphs) split first rather than naive fixed-length slicing. Each chunk retains
  its source PDF page number(s).
- Classification: structured output constrained to a 9-category enum, not free-form parsing.
- Prompts live in `backend/app/prompts/*.md`, loaded at runtime via `load_prompt()` — not
  hardcoded inline strings.
- Chat responses include source citations (page number / chunk id) from retrieved chunk
  metadata.
- Current design is single-document, single-collection (one Chroma collection per
  `document_id`); no multi-document or session concept yet.

## Commands

Backend (run from `backend/`):
- Dev server: `uvicorn app.main:app --reload`
- Tests: `pytest`
- Lint/format: `ruff check .` / `black .`

Frontend (run from `frontend/`):
- Dev server: `npm run dev` (forced `--webpack`, not Turbopack — avoids a subprocess crash on
  Windows; don't remove that flag)
- Tests: `npm test` (Vitest + Testing Library; API layer mocked, no backend needed)
- Lint: `npm run lint`
- Format: `npm run format` / `npm run format:check`

## Environment variables

- `backend/.env`: `OPENAI_API_KEY` (required, no default), plus `ENVIRONMENT`, `CORS_ORIGINS`,
  `UPLOAD_DIR`, `CHROMA_PERSIST_DIR` (all have working defaults in `.env.example`).
- `frontend/.env`: `NEXT_PUBLIC_API_BASE_URL` (defaults to `http://localhost:8000` in code if
  unset).
