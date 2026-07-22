from fastapi import APIRouter, HTTPException, UploadFile

from app.core.config import settings
from app.models.schemas import DocumentResponse
from app.services.ingestion import ingest_document, load_document
from app.services.pdf_parser import PdfParseError

router = APIRouter(tags=["documents"])


@router.post("/documents", status_code=201)
def upload_document(file: UploadFile) -> DocumentResponse:
    filename = file.filename or ""
    if not filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=415, detail="Only PDF files are accepted.")

    content = file.file.read()
    if len(content) > settings.max_upload_bytes:
        raise HTTPException(
            status_code=413,
            detail=f"File exceeds the {settings.max_upload_bytes // (1024 * 1024)} MB size limit.",
        )
    if not content.startswith(b"%PDF-"):
        raise HTTPException(status_code=415, detail="File is not a valid PDF.")

    try:
        return ingest_document(content, filename)
    except PdfParseError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@router.get("/documents/{document_id}")
def get_document(document_id: str) -> DocumentResponse:
    document = load_document(document_id)
    if document is None:
        raise HTTPException(status_code=404, detail="Document not found.")
    return document
