from dataclasses import dataclass
from functools import lru_cache

import chromadb
from chromadb.config import Settings as ChromaSettings

from app.core.config import settings
from app.services.chunker import Chunk


@dataclass
class RetrievedChunk:
    text: str
    page_number: int
    chunk_index: int


class VectorStore:
    """Thin wrapper around an embedded ChromaDB instance.

    One collection per document; embeddings are computed by us and passed in
    explicitly, so Chroma is used purely as a similarity index + metadata store.
    """

    def __init__(self, persist_dir: str | None = None):
        self._client = chromadb.PersistentClient(
            path=persist_dir or settings.chroma_persist_dir,
            settings=ChromaSettings(anonymized_telemetry=False),
        )

    def _collection_name(self, document_id: str) -> str:
        return f"doc_{document_id}"

    def add_chunks(
        self, document_id: str, chunks: list[Chunk], embeddings: list[list[float]]
    ) -> None:
        collection = self._client.get_or_create_collection(
            name=self._collection_name(document_id),
            metadata={"hnsw:space": "cosine"},
        )
        collection.add(
            ids=[f"{document_id}_{chunk.chunk_index}" for chunk in chunks],
            documents=[chunk.text for chunk in chunks],
            embeddings=embeddings,
            metadatas=[
                {
                    "document_id": document_id,
                    "page_number": chunk.page_number,
                    "chunk_index": chunk.chunk_index,
                }
                for chunk in chunks
            ],
        )

    def query(
        self, document_id: str, query_embedding: list[float], top_k: int
    ) -> list[RetrievedChunk]:
        collection = self._client.get_collection(self._collection_name(document_id))
        result = collection.query(
            query_embeddings=[query_embedding],
            n_results=min(top_k, collection.count()),
            include=["documents", "metadatas"],
        )
        return [
            RetrievedChunk(
                text=text,
                page_number=metadata["page_number"],
                chunk_index=metadata["chunk_index"],
            )
            for text, metadata in zip(result["documents"][0], result["metadatas"][0], strict=True)
        ]


@lru_cache(maxsize=1)
def get_vector_store() -> VectorStore:
    return VectorStore()
