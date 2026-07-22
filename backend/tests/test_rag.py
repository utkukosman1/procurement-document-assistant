from unittest.mock import MagicMock, patch

from app.services.rag import _SNIPPET_CHARS, answer_question
from app.store.vector_store import RetrievedChunk


def _retrieved_chunks() -> list[RetrievedChunk]:
    return [
        RetrievedChunk(text="A" * 250, page_number=1, chunk_index=0),
        RetrievedChunk(text="B" * 250, page_number=2, chunk_index=1),
    ]


def _mock_completion(answer: str, cited_chunk_indexes: list[int]) -> MagicMock:
    parsed = MagicMock(answer=answer, cited_chunk_indexes=cited_chunk_indexes)
    completion = MagicMock()
    completion.choices = [MagicMock(message=MagicMock(parsed=parsed))]
    return completion


@patch("app.services.rag.embed_query", return_value=[0.1, 0.2])
@patch("app.services.rag.get_openai_client")
@patch("app.services.rag.get_vector_store")
def test_answer_question_builds_deduped_ordered_citations(
    mock_get_store, mock_get_client, _mock_embed
):
    mock_get_store.return_value.query.return_value = _retrieved_chunks()
    mock_get_client.return_value.chat.completions.parse.return_value = _mock_completion(
        "Payment is due in 30 days.", cited_chunk_indexes=[1, 0, 1]
    )

    result = answer_question("doc-1", "When is payment due?")

    assert [c.chunk_index for c in result.citations] == [1, 0]
    assert result.citations[0].page_number == 2
    assert result.citations[0].snippet == ("B" * 250)[:_SNIPPET_CHARS]
    assert len(result.citations[0].snippet) == _SNIPPET_CHARS


@patch("app.services.rag.embed_query", return_value=[0.1, 0.2])
@patch("app.services.rag.get_openai_client")
@patch("app.services.rag.get_vector_store")
def test_answer_question_ignores_cited_index_outside_retrieved_set(
    mock_get_store, mock_get_client, _mock_embed
):
    mock_get_store.return_value.query.return_value = _retrieved_chunks()
    mock_get_client.return_value.chat.completions.parse.return_value = _mock_completion(
        "Some answer.", cited_chunk_indexes=[0, 99]
    )

    result = answer_question("doc-1", "question")

    assert [c.chunk_index for c in result.citations] == [0]


@patch("app.services.rag.embed_query", return_value=[0.1, 0.2])
@patch("app.services.rag.get_openai_client")
@patch("app.services.rag.get_vector_store")
def test_answer_question_handles_unparsed_response(mock_get_store, mock_get_client, _mock_embed):
    mock_get_store.return_value.query.return_value = _retrieved_chunks()
    completion = MagicMock()
    completion.choices = [MagicMock(message=MagicMock(parsed=None))]
    mock_get_client.return_value.chat.completions.parse.return_value = completion

    result = answer_question("doc-1", "question")

    assert result.answer == "Sorry, the question could not be answered."
    assert result.citations == []
