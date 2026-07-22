from unittest.mock import MagicMock, patch

from app.models.schemas import DocumentType
from app.services.chunker import Chunk
from app.services.classifier import classify_document


def _chunks() -> list[Chunk]:
    return [
        Chunk(
            text="This Non-Disclosure Agreement is entered into by and between the parties.",
            page_number=1,
            chunk_index=0,
        )
    ]


def _mock_completion(document_type: DocumentType | None) -> MagicMock:
    parsed = MagicMock(document_type=document_type) if document_type is not None else None
    completion = MagicMock()
    completion.choices = [MagicMock(message=MagicMock(parsed=parsed))]
    return completion


@patch("app.services.classifier.get_openai_client")
def test_classify_document_returns_parsed_type(mock_get_client):
    mock_get_client.return_value.chat.completions.parse.return_value = _mock_completion(
        DocumentType.NDA
    )

    result = classify_document(_chunks())

    assert result == DocumentType.NDA


@patch("app.services.classifier.get_openai_client")
def test_classify_document_falls_back_to_other_when_unparsed(mock_get_client):
    mock_get_client.return_value.chat.completions.parse.return_value = _mock_completion(None)

    result = classify_document(_chunks())

    assert result == DocumentType.OTHER
