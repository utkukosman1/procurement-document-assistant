# Tools & Process Summary

## Toolchain

| Category | Tool | Used for |
|---|---|---|
| Languages / runtimes | Python 3.13, Node.js 20 | Backend and frontend runtimes |
| Backend | FastAPI, Uvicorn, Pydantic | API, request validation, settings |
| Frontend | Next.js (App Router), Tailwind CSS | Upload and chat UI |
| PDF parsing | pypdf | Per-page text extraction |
| Tokenization | tiktoken (`cl100k_base`) | Token-budgeted chunking |
| Embeddings / LLM | OpenAI `text-embedding-3-small`, `gpt-4.1-mini` | Chunk/query embeddings; classification and grounded chat |
| Vector store | ChromaDB (embedded) | Similarity index + chunk metadata |
| Testing | pytest + FastAPI TestClient; Vitest + React Testing Library | Backend and frontend test suites |
| Lint / format | ruff, black (backend); ESLint, Prettier (frontend) | Code quality gates |
| Version control | Git | Incremental development history |
| AI assistants | Claude Code (terminal), ChatGPT | See below |

The working environment was Claude Code in the terminal; no separate IDE was used.

## How AI was used

**Claude Code** (Anthropic's terminal coding agent) was the primary tool and drafted the
majority of the first-pass code, tests, and documentation. Work proceeded in day-sized
increments, and each increment started with a written plan or outline that was reviewed and
approved before any code was produced — for example, the chunker's structural-splitting
approach (heading/paragraph blocks, token budget, sentence overlap) was specified and agreed
on before implementation. Architecture decisions were recorded up front as standing
constraints the assistant worked within rather than re-deciding per session. The
documentation was produced the same way: the assistant re-read the full repository and the
assignment brief before any document was outlined or written.

**ChatGPT** played a secondary role: brainstorming and background research, and
second-opinion reviews of plans and designs produced with Claude Code. No code from ChatGPT
entered the repository.

## Engineering decisions & human oversight

Every engineering decision was made by the developer; the assistant's role was to surface
options with their trade-offs, not to choose. Interpreting the assignment and setting scope,
the stack, the storage design (local files + embedded Chroma, no database), keeping
`VectorStore` a thin wrapper instead of a repository abstraction, the chunking parameters,
and the accepted trade-offs (synchronous ingestion, stateless chat) were all explicit
decisions, made after weighing alternatives and then recorded so they could not be silently
relitigated. Each increment's output was reviewed as a diff before being accepted, and work
was redirected when it drifted from the agreed plan — including deferring all documentation
until the implementation was final, so the documents describe what was built rather than
what was intended.

## Validation

AI-drafted output was treated as unverified until checked:

- **Tests** — the 21-test backend pytest suite was run throughout development. The OpenAI
  client is mocked, so tests assert on this codebase's logic (chunking, citation
  validation, error paths) rather than on model behavior; vector-store tests run against a
  real embedded Chroma instance. A small frontend suite (Vitest + React Testing Library,
  API layer mocked) covers the key user-facing flows: upload, ask-and-answer, and citation
  display.
- **Manual end-to-end testing** — real procurement PDFs were uploaded and taken through the
  full upload → classification → chat flow, with answers and citations checked by hand
  against the source documents.
- **Static gates** — ruff/black and ESLint/Prettier on all code.
- **Documentation** — the Design Document and README were written only after the
  implementation was complete, and were cross-checked against both the final codebase and
  the assignment requirements to ensure technical accuracy and consistency; statements in
  the documents trace to specific modules.
