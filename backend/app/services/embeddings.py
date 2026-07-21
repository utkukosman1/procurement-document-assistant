from app.services.openai_client import get_openai_client

EMBEDDING_MODEL = "text-embedding-3-small"

# Well under the API's input limits; one batch covers most single documents.
_BATCH_SIZE = 100


def embed_texts(texts: list[str]) -> list[list[float]]:
    embeddings: list[list[float]] = []
    for i in range(0, len(texts), _BATCH_SIZE):
        response = get_openai_client().embeddings.create(
            model=EMBEDDING_MODEL, input=texts[i : i + _BATCH_SIZE]
        )
        embeddings.extend(item.embedding for item in response.data)
    return embeddings


def embed_query(text: str) -> list[float]:
    return embed_texts([text])[0]
