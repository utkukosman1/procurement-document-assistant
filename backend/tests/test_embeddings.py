from unittest.mock import MagicMock, patch

from app.services.embeddings import _BATCH_SIZE, embed_texts


@patch("app.services.embeddings.get_openai_client")
def test_embed_texts_batches_large_input(mock_get_client):
    texts = [f"chunk {i}" for i in range(_BATCH_SIZE + 20)]

    def fake_create(model, input):
        return MagicMock(data=[MagicMock(embedding=[float(len(text))]) for text in input])

    mock_get_client.return_value.embeddings.create.side_effect = fake_create

    result = embed_texts(texts)

    assert mock_get_client.return_value.embeddings.create.call_count == 2
    assert result == [[float(len(text))] for text in texts]
