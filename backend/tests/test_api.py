from unittest.mock import patch

import openai
import pytest
from fastapi.testclient import TestClient

from app.core.config import settings
from app.main import app
from app.models.schemas import ChatResponse, Citation, DocumentResponse, DocumentType

client = TestClient(app)


@pytest.fixture(autouse=True)
def isolated_upload_dir(tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "upload_dir", str(tmp_path))


def _document_response() -> DocumentResponse:
    return DocumentResponse(
        document_id="abc123",
        filename="contract.pdf",
        num_pages=3,
        num_chunks=9,
        document_type=DocumentType.CONTRACT,
    )


def test_upload_rejects_non_pdf_filename():
    response = client.post(
        "/documents", files={"file": ("notes.txt", b"hello world", "text/plain")}
    )

    assert response.status_code == 415


def test_upload_rejects_invalid_pdf_content():
    response = client.post(
        "/documents", files={"file": ("contract.pdf", b"not a real pdf", "application/pdf")}
    )

    assert response.status_code == 415


def test_upload_rejects_oversized_file(monkeypatch):
    monkeypatch.setattr(settings, "max_upload_bytes", 10)

    response = client.post(
        "/documents",
        files={"file": ("contract.pdf", b"%PDF-1.4 more bytes than allowed", "application/pdf")},
    )

    assert response.status_code == 413


@patch("app.api.routes.documents.ingest_document")
def test_upload_success_returns_document_response(mock_ingest):
    mock_ingest.return_value = _document_response()

    response = client.post(
        "/documents", files={"file": ("contract.pdf", b"%PDF-1.4 fake body", "application/pdf")}
    )

    assert response.status_code == 201
    assert response.json()["document_id"] == "abc123"
    assert response.json()["document_type"] == "Contract"


def test_get_document_not_found():
    response = client.get("/documents/does-not-exist")

    assert response.status_code == 404


def test_chat_returns_404_for_missing_document():
    response = client.post(
        "/chat", json={"document_id": "does-not-exist", "question": "What is the payment term?"}
    )

    assert response.status_code == 404


@patch("app.api.routes.chat.answer_question")
@patch("app.api.routes.chat.load_document")
def test_chat_happy_path_returns_answer_and_citations(mock_load_document, mock_answer_question):
    mock_load_document.return_value = _document_response()
    mock_answer_question.return_value = ChatResponse(
        answer="Payment is due in 30 days.",
        citations=[Citation(page_number=2, chunk_index=1, snippet="Payment terms...")],
    )

    response = client.post(
        "/chat", json={"document_id": "abc123", "question": "When is payment due?"}
    )

    assert response.status_code == 200
    body = response.json()
    assert body["answer"] == "Payment is due in 30 days."
    assert body["citations"] == [
        {"page_number": 2, "chunk_index": 1, "snippet": "Payment terms..."}
    ]


@patch("app.api.routes.chat.answer_question")
@patch("app.api.routes.chat.load_document")
def test_chat_returns_clean_502_on_openai_error(mock_load_document, mock_answer_question):
    mock_load_document.return_value = _document_response()
    mock_answer_question.side_effect = openai.OpenAIError("boom")

    response = client.post(
        "/chat", json={"document_id": "abc123", "question": "When is payment due?"}
    )

    assert response.status_code == 502
    assert response.json() == {
        "detail": "The AI service is temporarily unavailable. Please try again."
    }
