from app.services.chunker import (
    MAX_CHUNK_TOKENS,
    OVERLAP_TOKENS,
    _fit_to_budget,
    _overlap_tail,
    _split_blocks,
    chunk_pages,
    count_tokens,
)
from app.services.pdf_parser import Page


def test_split_blocks_starts_new_block_at_heading():
    text = (
        "Intro paragraph text ends here.\n"
        "ARTICLE FOUR PAYMENT TERMS\n"
        "Payment is due within 30 days of invoice date."
    )

    blocks = _split_blocks(text)

    assert blocks == [
        "Intro paragraph text ends here.",
        "ARTICLE FOUR PAYMENT TERMS Payment is due within 30 days of invoice date.",
    ]


def test_fit_to_budget_splits_oversized_block_without_breaking_sentences():
    sentences = [
        f"Clause {i} states an obligation regarding delivery timelines." for i in range(60)
    ]
    block = " ".join(sentences)

    pieces = _fit_to_budget(block)

    assert len(pieces) > 1
    assert all(count_tokens(piece) <= MAX_CHUNK_TOKENS for piece in pieces)
    rejoined = " ".join(pieces)
    for sentence in sentences:
        assert sentence in rejoined


def test_overlap_tail_returns_bounded_trailing_sentences():
    sentences = [f"Sentence number {i} contains some filler words for length." for i in range(30)]
    text = " ".join(sentences)

    tail = _overlap_tail(text)

    assert tail != ""
    assert text.endswith(tail)
    assert count_tokens(tail) <= OVERLAP_TOKENS


def test_chunk_pages_assigns_page_numbers_and_sequential_indexes_across_a_boundary():
    words = "obligation clause payment delivery schedule liability termination warranty".split()
    page_one_text = ""
    i = 0
    while count_tokens(page_one_text) < MAX_CHUNK_TOKENS - 5:
        page_one_text += words[i % len(words)] + " "
        i += 1
    pages = [
        Page(page_number=1, text=page_one_text),
        Page(page_number=2, text="A short closing clause on page two."),
    ]

    chunks = chunk_pages(pages)

    assert len(chunks) >= 2
    assert chunks[0].page_number == 1
    assert count_tokens(chunks[0].text) <= MAX_CHUNK_TOKENS
    assert [c.chunk_index for c in chunks] == list(range(len(chunks)))
    assert any(c.page_number == 2 for c in chunks)
