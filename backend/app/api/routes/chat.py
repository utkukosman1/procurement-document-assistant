from fastapi import APIRouter, HTTPException

from app.models.schemas import ChatRequest, ChatResponse
from app.services.ingestion import load_document
from app.services.rag import answer_question

router = APIRouter(tags=["chat"])


@router.post("/chat")
def chat(request: ChatRequest) -> ChatResponse:
    if load_document(request.document_id) is None:
        raise HTTPException(status_code=404, detail="Document not found.")
    return answer_question(request.document_id, request.question)
