# Procurement Document Assistant

Upload a strategic procurement PDF, have it classified as a standard procurement document
type, and ask questions answered only from the document's content — with page-level
citations. Built as a take-home assessment for the Monq Software Engineer role.
Stack: FastAPI · Next.js · OpenAI · embedded ChromaDB.

The reasoning behind the architecture, chunking, RAG, and classification design is in the
**[Design Document](docs/design.md)**.

## What it does

- **Upload** a PDF (drag-and-drop or file picker) with validation: type, 20 MB limit, and
  rejection of encrypted or scanned/image-only files with clear errors.
- **Vectorize** — text is extracted per page, chunked along the document's structure
  (300–500 tokens, ~15 % overlap), embedded, and indexed for semantic search.
- **Classify** the document into one of nine standard procurement types (Contract, RFP/RFQ,
  Quote/Proposal, Invoice, SLA, Amendment, NDA, Purchase Order, Other).
- **Chat** about the document — answers are grounded in retrieved chunks only, each with
  source citations (page number + snippet), and the assistant says so when the document
  doesn't contain the answer.

## Prerequisites

- **Python 3.11+**
- **Node.js 20+**
- An **OpenAI API key** (used for embeddings, classification, and chat)

## Setup & run

Backend and frontend run independently; start the backend first.

### Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r requirements-dev.txt
cp .env.example .env               # then put your OPENAI_API_KEY in .env
uvicorn app.main:app --reload
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Open **http://localhost:3000** for the app. The API runs at `http://localhost:8000`, with
interactive API docs (Swagger) at `http://localhost:8000/docs`.

## Running tests

```bash
# backend
cd backend
pytest

# frontend
cd frontend
npm test
```

Neither suite requires an API key or a running server. Backend tests mock the OpenAI
client (vector-store tests run against a real embedded ChromaDB in a temporary directory);
the frontend suite (Vitest + Testing Library) mocks the API layer. Lint/format:
`ruff check .` and `black .` (backend), `npm run lint` and `npm run format:check`
(frontend).

## Environment variables

| Variable | Where | Required | Default |
|---|---|---|---|
| `OPENAI_API_KEY` | `backend/.env` | **Yes** | — |
| `ENVIRONMENT` | `backend/.env` | No | `development` |
| `CORS_ORIGINS` | `backend/.env` | No | `["http://localhost:3000"]` |
| `UPLOAD_DIR` | `backend/.env` | No | `./data/uploads` |
| `CHROMA_PERSIST_DIR` | `backend/.env` | No | `./data/chroma` |
| `NEXT_PUBLIC_API_BASE_URL` | `frontend/.env` | No | `http://localhost:8000` |

Copy `backend/.env.example` (and optionally `frontend/.env.example`) to `.env` in the same
directory. Only the OpenAI key has no working default.

## Repository structure

```text
backend/
  app/
    api/routes/     HTTP endpoints: documents (upload/lookup), chat, health
    core/           settings loaded from .env
    models/         Pydantic schemas shared across routes and services
    prompts/        LLM prompts as versioned Markdown files
    services/       the pipeline: pdf_parser, chunker, embeddings, classifier, rag, ingestion
    store/          VectorStore — the single thin wrapper around ChromaDB
  tests/            pytest suite (API, chunker, RAG, classifier, vector store)
frontend/
  src/
    app/            Next.js App Router entry (single-page workspace)
    components/     UploadPanel, DocumentRail, ChatPanel
    lib/api.ts      the only HTTP layer talking to the backend
  tests/            Vitest + Testing Library suite (upload, chat, API error handling)
docs/               design document and tools & process summary
```

## Documentation

- **[Design Document](docs/design.md)** — architecture, API contract, data model, chunking
  strategy, RAG approach, classification, and trade-offs.
- **[Tools & process summary](docs/tools-and-process.md)** — tools used to build this,
  including the AI-tool acknowledgment and how output was validated.
