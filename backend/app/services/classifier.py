from pydantic import BaseModel

from app.models.schemas import DocumentType
from app.services.chunker import Chunk
from app.services.openai_client import get_openai_client
from app.services.prompts import load_prompt

CLASSIFICATION_MODEL = "gpt-4.1-mini"

# The document type is almost always identifiable from the opening pages
# (title, preamble, structure); sending the whole document adds cost, not signal.
_MAX_INPUT_CHARS = 8000


class _Classification(BaseModel):
    document_type: DocumentType


def classify_document(chunks: list[Chunk]) -> DocumentType:
    text = "\n\n".join(chunk.text for chunk in chunks)[:_MAX_INPUT_CHARS]
    completion = get_openai_client().chat.completions.parse(
        model=CLASSIFICATION_MODEL,
        messages=[
            {"role": "system", "content": load_prompt("classification")},
            {"role": "user", "content": text},
        ],
        response_format=_Classification,
    )
    parsed = completion.choices[0].message.parsed
    if parsed is None:
        return DocumentType.OTHER
    return parsed.document_type
