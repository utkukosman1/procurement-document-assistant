import re
from dataclasses import dataclass
from functools import lru_cache

import tiktoken

from app.services.pdf_parser import Page

# Target 300-500 tokens per chunk: large enough to hold a full contract clause,
# small enough that retrieval stays precise. Overlap ~15% so clauses at chunk
# boundaries are not lost.
MAX_CHUNK_TOKENS = 500
OVERLAP_TOKENS = 75

# Lines that start a new structural block: numbered sections ("1.", "2.3", "4)")
# or short ALL-CAPS headings ("ARTICLE IV", "PAYMENT TERMS").
_HEADING_RE = re.compile(r"^\s*(\d+(\.\d+)*[.)]?\s+\S|[A-Z][A-Z0-9 ,&\-/]{3,}$)")
_SENTENCE_SPLIT_RE = re.compile(r"(?<=[.!?])\s+")


@dataclass
class Chunk:
    text: str
    page_number: int
    chunk_index: int


@lru_cache(maxsize=1)
def _encoding() -> tiktoken.Encoding:
    return tiktoken.get_encoding("cl100k_base")


def count_tokens(text: str) -> int:
    return len(_encoding().encode(text))


def _split_blocks(text: str) -> list[str]:
    """Split page text into structural blocks: paragraphs, further split at headings."""
    # pypdf sometimes emits blank lines mid-sentence (fragmented extraction).
    # Keep a paragraph break only when it follows sentence-terminal punctuation;
    # merge all other blank lines back into the running sentence.
    text = re.sub(r"(?<![.!?:;\s])[ \t]*\n[ \t]*\n\s*", " ", text)
    blocks: list[str] = []
    for paragraph in re.split(r"\n\s*\n", text):
        lines = paragraph.splitlines()
        current: list[str] = []
        for line in lines:
            if _HEADING_RE.match(line) and current:
                blocks.append(" ".join(current))
                current = []
            if line.strip():
                current.append(line.strip())
        if current:
            blocks.append(" ".join(current))
    return [b for b in blocks if b.strip()]


def _fit_to_budget(text: str) -> list[str]:
    """Split a single oversized block into pieces of at most MAX_CHUNK_TOKENS."""
    if count_tokens(text) <= MAX_CHUNK_TOKENS:
        return [text]

    pieces: list[str] = []
    current: list[str] = []
    current_tokens = 0
    for sentence in _SENTENCE_SPLIT_RE.split(text):
        sentence_tokens = count_tokens(sentence)
        if sentence_tokens > MAX_CHUNK_TOKENS:
            if current:
                pieces.append(" ".join(current))
                current, current_tokens = [], 0
            # A single sentence over budget (e.g. a long table): hard-split by tokens.
            tokens = _encoding().encode(sentence)
            for i in range(0, len(tokens), MAX_CHUNK_TOKENS):
                pieces.append(_encoding().decode(tokens[i : i + MAX_CHUNK_TOKENS]))
            continue
        if current and current_tokens + sentence_tokens > MAX_CHUNK_TOKENS:
            pieces.append(" ".join(current))
            current, current_tokens = [], 0
        current.append(sentence)
        current_tokens += sentence_tokens
    if current:
        pieces.append(" ".join(current))
    return pieces


def _overlap_tail(text: str) -> str:
    """Last sentences of a chunk, up to OVERLAP_TOKENS, carried into the next chunk."""
    sentences = _SENTENCE_SPLIT_RE.split(text)
    tail: list[str] = []
    total = 0
    for sentence in reversed(sentences):
        sentence_tokens = count_tokens(sentence)
        if total + sentence_tokens > OVERLAP_TOKENS:
            break
        tail.insert(0, sentence)
        total += sentence_tokens
    if not tail:
        tokens = _encoding().encode(text)
        return _encoding().decode(tokens[-OVERLAP_TOKENS:])
    return " ".join(tail)


def chunk_pages(pages: list[Page]) -> list[Chunk]:
    """Structure-first chunking: split pages into blocks (paragraphs/headings),
    then greedily pack blocks into chunks within the token budget, carrying a
    sentence-level overlap between consecutive chunks."""
    blocks: list[tuple[int, str]] = []
    for page in pages:
        for block in _split_blocks(page.text):
            for piece in _fit_to_budget(block):
                blocks.append((page.page_number, piece))

    chunks: list[Chunk] = []
    overlap = ""
    current: list[str] = []
    current_page = 0
    current_tokens = count_tokens(overlap)

    def close_current() -> None:
        nonlocal overlap, current, current_tokens
        parts = ([overlap] if overlap else []) + current
        text = "\n\n".join(parts)
        chunks.append(Chunk(text=text, page_number=current_page, chunk_index=len(chunks)))
        overlap = _overlap_tail(text)
        current = []
        current_tokens = count_tokens(overlap)

    for page_number, block in blocks:
        # +2 accounts for the "\n\n" separator joined between blocks.
        block_tokens = count_tokens(block) + 2
        if current and current_tokens + block_tokens > MAX_CHUNK_TOKENS:
            close_current()
        if not current:
            current_page = page_number
        current.append(block)
        current_tokens += block_tokens
    if current:
        close_current()

    return chunks
