import json
import uuid
from pathlib import Path

from app.core.config import settings
from app.models.schemas import DocumentResponse
from app.services.chunker import chunk_pages
from app.services.classifier import classify_document
from app.services.embeddings import embed_texts
from app.services.pdf_parser import extract_pages
from app.store.vector_store import get_vector_store


def _upload_dir() -> Path:
    path = Path(settings.upload_dir)
    path.mkdir(parents=True, exist_ok=True)
    return path


def load_document(document_id: str) -> DocumentResponse | None:
    meta_path = _upload_dir() / f"{document_id}.json"
    if not meta_path.exists():
        return None
    return DocumentResponse.model_validate_json(meta_path.read_text(encoding="utf-8"))


def ingest_document(content: bytes, filename: str) -> DocumentResponse:
    document_id = uuid.uuid4().hex
    upload_dir = _upload_dir()
    pdf_path = upload_dir / f"{document_id}.pdf"
    pdf_path.write_bytes(content)

    pages = extract_pages(pdf_path)
    chunks = chunk_pages(pages)

    embeddings = embed_texts([chunk.text for chunk in chunks])
    get_vector_store().add_chunks(document_id, chunks, embeddings)
    document_type = classify_document(chunks)

    document = DocumentResponse(
        document_id=document_id,
        filename=filename,
        num_pages=len(pages),
        num_chunks=len(chunks),
        document_type=document_type,
    )
    (upload_dir / f"{document_id}.json").write_text(
        json.dumps(document.model_dump(), indent=2), encoding="utf-8"
    )
    return document
