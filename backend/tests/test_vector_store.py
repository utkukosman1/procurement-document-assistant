from app.services.chunker import Chunk
from app.store.vector_store import VectorStore


def _make_chunks() -> list[Chunk]:
    return [
        Chunk(text="Payment is due within 30 days of invoice.", page_number=1, chunk_index=0),
        Chunk(text="Either party may terminate with 60 days notice.", page_number=2, chunk_index=1),
    ]


def test_add_chunks_and_query_round_trip(tmp_path):
    store = VectorStore(persist_dir=str(tmp_path))
    chunks = _make_chunks()
    embeddings = [[1.0, 0.0, 0.0], [0.0, 1.0, 0.0]]
    store.add_chunks("doc-1", chunks, embeddings)

    results = store.query("doc-1", query_embedding=[1.0, 0.0, 0.0], top_k=1)

    assert len(results) == 1
    assert results[0].text == chunks[0].text
    assert results[0].page_number == 1
    assert results[0].chunk_index == 0


def test_query_caps_n_results_to_available_chunk_count(tmp_path):
    store = VectorStore(persist_dir=str(tmp_path))
    chunks = _make_chunks()
    embeddings = [[1.0, 0.0, 0.0], [0.0, 1.0, 0.0]]
    store.add_chunks("doc-2", chunks, embeddings)

    results = store.query("doc-2", query_embedding=[0.5, 0.5, 0.0], top_k=10)

    assert len(results) == 2
