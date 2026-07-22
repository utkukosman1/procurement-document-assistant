# Design Document — Procurement Document Assistant

An AI-powered tool: upload a strategic procurement PDF, classify it as a standard procurement
document type, and ask questions answered only from the document's content. File paths below
(e.g. `backend/app/services/chunker.py`) name the module implementing each point, so this
document reads as a guided tour of the codebase.

## 1. Overview & system flow

The system has two independently run parts: a FastAPI backend that owns the entire document
pipeline, and a standalone Next.js frontend calling it over a small JSON API. On upload, the
backend extracts the PDF's text, splits it into structure-aware chunks, embeds them with
OpenAI `text-embedding-3-small`, indexes them in embedded ChromaDB, and classifies the
document into one of nine standard procurement types with `gpt-4.1-mini`. Chat answers are
generated only from the most similar retrieved chunks and returned with page-level
citations. Per the assignment's scope, the flow is built around a single "current document".

```text
Ingestion — POST /documents
  PDF upload
    ─▶ validate (extension, %PDF magic bytes, 20 MB cap)
    ─▶ extract text per page                     pypdf
    ─▶ chunk: structural blocks, 300–500 tokens, ~15 % overlap, page numbers kept
    ─▶ embed chunks                              text-embedding-3-small
    ─▶ index in ChromaDB (one collection per document, cosine)
    ─▶ classify into 9-type enum                 gpt-4.1-mini, structured output
    ─▶ persist original PDF + metadata JSON
    ─▶ 201 { document_id, filename, num_pages, num_chunks, document_type }

Chat — POST /chat
  question
    ─▶ embed query (same embedding model)
    ─▶ top-5 cosine retrieval from the document's collection
    ─▶ grounded LLM call: labeled excerpts + answer-from-context-only rules
    ─▶ validate model-cited chunk indexes against the retrieved set
    ─▶ 200 { answer, citations: [ { page_number, chunk_index, snippet } ] }
```

## 2. Architecture

The backend (`backend/app/`) is layered **routes → services → store**, dependencies pointing
one way. Routes handle HTTP concerns only (validation, status codes); each pipeline stage is
a single-purpose service — `pdf_parser`, `chunker`, `embeddings`, `classifier`, `rag` —
composed by `ingestion.py` for the upload flow. The store layer is one class, `VectorStore`
(`store/vector_store.py`), deliberately the *only* abstraction over ChromaDB: a thin wrapper,
not a repository hierarchy, because one concrete store with two call sites does not justify
indirection. Prompts are versioned Markdown files in `app/prompts/`, loaded via
`load_prompt()`, so they can be reviewed and edited like code.

Error handling follows the same boundary: routes reject bad input with specific codes
(413/415/422), while app-level handlers in `main.py` convert OpenAI and ChromaDB failures
into clean 502s — upstream outages never leak stack traces to the client.

The frontend (`frontend/src/`) is a standalone Next.js App Router app. `lib/api.ts` is the
only module aware of fetch, base URLs, and error-body parsing; three components mirror the
three UI responsibilities: `UploadPanel` (drag-and-drop upload), `DocumentRail` (type badge,
page/chunk counts), and `ChatPanel` (conversation, auto-generated overview, per-type
suggested questions, citation chips).

## 3. API contract

| Method & path | Purpose | Success |
|---|---|---|
| `POST /documents` | Upload a PDF; runs the full ingestion pipeline synchronously | `201` |
| `GET /documents/{document_id}` | Fetch metadata for an ingested document | `200` |
| `POST /chat` | Ask a question about an ingested document | `200` |
| `GET /health` | Liveness check | `200` |

Shapes are defined once as Pydantic models (`backend/app/models/schemas.py`) and mirrored by
the TypeScript types in `frontend/src/lib/api.ts`:

```jsonc
// POST /documents → 201        (multipart form, field "file")
{ "document_id": "9f2c…", "filename": "msa.pdf", "num_pages": 12,
  "num_chunks": 31, "document_type": "Contract" }

// POST /chat  { "document_id": "9f2c…", "question": "What are the payment terms?" } → 200
{ "answer": "Payment is due within 30 days of invoice…",
  "citations": [ { "page_number": 4, "chunk_index": 11, "snippet": "4.2 Payment…" } ] }
```

Errors use distinct codes with a human-readable `detail`: **413** upload over the size limit
(default 20 MB); **415** not a PDF (wrong extension or missing `%PDF-` magic bytes); **422**
unusable PDF (encrypted, unreadable, or image-only); **404** unknown `document_id`; **502**
upstream OpenAI/vector-store failure, safe to retry.

## 4. Data model & storage

A document exists in three representations, keyed by a server-generated `document_id`
(UUID, `services/ingestion.py`):

- **Original PDF** on disk at `{UPLOAD_DIR}/{document_id}.pdf`.
- **Metadata JSON** — the `DocumentResponse` record (filename, page count, chunk count,
  type) at `{UPLOAD_DIR}/{document_id}.json`; its existence is the authoritative
  "does this document exist" check for the chat and lookup routes.
- **Chunks + embeddings** — ChromaDB collection `doc_{document_id}` (cosine), each entry:
  id `{document_id}_{chunk_index}`, chunk text, embedding, and metadata
  `{document_id, page_number, chunk_index}`.

Page attribution flows through unchanged — parser → chunk → Chroma metadata → citation — so
a citation's page number is traceable data, not an LLM claim. Storage is local filesystem
plus embedded Chroma by design: the assignment requires only a local run, and with a
single-document scope a database adds setup cost without capability. Embeddings are computed
by our code and passed in explicitly, so Chroma serves purely as similarity index + metadata
store. At multi-user scale, metadata would move to a database and ingestion to a background
queue — changes already isolated to `ingestion.py` and the store layer.

## 5. Chunking strategy

Chunking (`backend/app/services/chunker.py`) is **structure-first**: text splits along the
document's own boundaries before any token budget applies; token-based cutting is only the
fallback for material with no usable structure.

Per page: (1) repair pypdf extraction artifacts — blank lines emitted mid-sentence are
merged away unless they follow sentence-terminal punctuation; (2) split into blocks at
paragraph breaks and detected headings — numbered sections (`7.`, `2.3`) and short ALL-CAPS
lines (`PAYMENT TERMS`), the two dominant heading styles in procurement documents; (3) split
oversized blocks at sentence boundaries, never mid-sentence, with a raw token split reserved
for pathological cases such as long tables; (4) greedily pack consecutive blocks into chunks
of at most **500 tokens** (`cl100k_base` via tiktoken); (5) carry each closed chunk's
trailing sentences — up to **75 tokens (~15 % overlap)** — into the start of the next.

Every choice serves retrieval. 300–500 tokens is roughly one contract clause with its
context: smaller, and a clause's meaning fragments across chunks; larger, and each embedding
averages several topics, blurring similarity scores. Structural boundaries keep each chunk
about *one thing*, which is what makes its embedding discriminative — an arbitrary
fixed-length cut through a termination clause yields two chunks that both half-match a
termination question. Sentence overlap protects facts straddling a boundary, at ~15 % index
redundancy. Each chunk records its starting page, enabling page-level citations downstream.

## 6. Retrieval & prompting (RAG)

**Retrieval** (`backend/app/services/rag.py`): the question is embedded with the same model
as the chunks, and the document's collection is queried for the **top 5** by cosine
similarity (capped at collection size). Five chunks of 300–500 tokens is ~2,000 tokens of
context — enough to cover the relevant clause and its neighbors, small enough not to invite
synthesis from marginally related excerpts. There is no reranker or hybrid keyword stage:
against a single document, plain cosine over single-topic chunks retrieves the right
material — the chunking strategy carries that weight.

**Prompting & grounding** (`backend/app/prompts/chat.md`): retrieved chunks are passed as
labeled excerpts (`[chunk 11 | page 4]`) under a system prompt with explicit rules — answer
*only* from the excerpts, never from outside knowledge; if they don't contain the answer,
say the document does not appear to contain it and cite nothing; quote names, figures,
dates, and amounts exactly. The response is structured output (`{answer,
cited_chunk_indexes}` via `chat.completions.parse`), not free text.

Citations double as the anti-hallucination check: the model must attribute the excerpts it
actually used, and the server treats those indexes as untrusted input — deduplicated,
out-of-range dropped — before resolving them to `{page_number, chunk_index, snippet}`. A
citation can never point at text that wasn't retrieved from this document, and an answer
with no valid citations is visibly ungrounded in the UI.

Example: *"What are the payment terms?"* retrieves the payment clause and its neighbors; the
answer quotes the 30-day term and cites `p. 4`. *"What is the CEO's salary?"* returns "the
document does not appear to contain this information" with zero citations.

## 7. Classification

Classification (`backend/app/services/classifier.py`) supports the assignment's nine types —
Contract, RFP/RFQ, Quote/Proposal, Invoice, SLA, Amendment, NDA, Purchase Order, Other —
using `gpt-4.1-mini` with structured output constrained to the `DocumentType` enum: the
model cannot return an unknown label, and an unparseable response falls back to `Other`. An
LLM beats keyword or rule matching here because types differ by *intent*, not vocabulary — a
supply contract full of confidentiality clauses is still a Contract, not an NDA; the prompt
(`backend/app/prompts/classification.md`) encodes per-category guidance and exactly these
disambiguation rules. Only the first ~8,000 characters are sent: a document's type is nearly
always identifiable from its opening pages, so the full text adds cost, not signal.

## 8. Trade-offs, assumptions & out-of-scope

**Assumptions.** PDFs are text-based — scanned or image-only files are rejected with an
explicit 422 rather than silently indexing nothing. One document is active at a time, though
each upload gets its own id and collection, so nothing is overwritten. Chat is stateless:
each question retrieves on its own merits, judged a better trade than follow-up convenience.
Single trusted local user — no auth, rate limiting, or multi-tenancy.

**Trade-offs taken.** Ingestion is synchronous — extract → chunk → embed → classify inside
the upload request (seconds for typical documents) — keeping the API and frontend state
simple; a background queue is the obvious change for large documents. Retrieval is pure
vector search: rerankers and hybrid BM25 earn their complexity in large multi-document
corpora, not here. Citations are model-attributed rather than a blanket list of everything
retrieved — more precise for the reader, with server-side index validation compensating for
trusting the attribution.

**Testing.** 21 pytest tests (`backend/tests/`) cover the API surface with error paths,
chunker behavior (heading splits, budget, overlap, page attribution), citation validation,
classifier fallback, and embedding batching. The mocking boundary is the OpenAI client —
tests assert on our logic, not the model — while vector-store tests run against a real
embedded Chroma instance in a temp directory. The frontend has an intentionally small
Vitest + Testing Library suite covering the key user-facing behaviors — upload success and
error surfacing, the ask-and-answer flow, and citation-display dedup — mocked at the
`lib/api.ts` boundary; the aim is thoughtful coverage of what the user sees, not breadth.

**Out of scope.** Multi-document sessions (single-document is explicitly sufficient), OCR
(rejected clearly instead), and streaming responses (answers are short).
