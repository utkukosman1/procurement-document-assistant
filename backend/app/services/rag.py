from pydantic import BaseModel

from app.models.schemas import ChatResponse, Citation
from app.services.embeddings import embed_query
from app.services.openai_client import get_openai_client
from app.services.prompts import load_prompt
from app.store.vector_store import get_vector_store

CHAT_MODEL = "gpt-4.1-mini"

# 5 chunks of ~300-500 tokens gives ~2k tokens of context: enough to cover the
# relevant clause plus its neighbors in a single-document corpus, while keeping
# the model focused on genuinely similar excerpts.
TOP_K = 5

_SNIPPET_CHARS = 200


class _ChatAnswer(BaseModel):
    answer: str
    cited_chunk_indexes: list[int]


def answer_question(document_id: str, question: str) -> ChatResponse:
    retrieved = get_vector_store().query(document_id, embed_query(question), TOP_K)

    context = "\n\n".join(
        f"[chunk {chunk.chunk_index} | page {chunk.page_number}]\n{chunk.text}"
        for chunk in retrieved
    )
    completion = get_openai_client().chat.completions.parse(
        model=CHAT_MODEL,
        messages=[
            {"role": "system", "content": load_prompt("chat")},
            {
                "role": "user",
                "content": f"Context excerpts:\n\n{context}\n\nQuestion: {question}",
            },
        ],
        response_format=_ChatAnswer,
    )
    parsed = completion.choices[0].message.parsed
    if parsed is None:
        return ChatResponse(answer="Sorry, the question could not be answered.", citations=[])

    by_index = {chunk.chunk_index: chunk for chunk in retrieved}
    citations = [
        Citation(
            page_number=by_index[i].page_number,
            chunk_index=i,
            snippet=by_index[i].text[:_SNIPPET_CHARS],
        )
        for i in dict.fromkeys(parsed.cited_chunk_indexes)
        if i in by_index
    ]
    return ChatResponse(answer=parsed.answer, citations=citations)
