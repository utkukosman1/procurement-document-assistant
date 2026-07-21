from enum import StrEnum

from pydantic import BaseModel, Field


class DocumentType(StrEnum):
    CONTRACT = "Contract"
    RFP_RFQ = "RFP/RFQ"
    QUOTE_PROPOSAL = "Quote/Proposal"
    INVOICE = "Invoice"
    SLA = "SLA"
    AMENDMENT = "Amendment"
    NDA = "NDA"
    PURCHASE_ORDER = "Purchase Order"
    OTHER = "Other"


class DocumentResponse(BaseModel):
    document_id: str
    filename: str
    num_pages: int
    num_chunks: int
    document_type: DocumentType


class Citation(BaseModel):
    page_number: int
    chunk_index: int
    snippet: str


class ChatRequest(BaseModel):
    document_id: str
    question: str = Field(min_length=1, max_length=2000)


class ChatResponse(BaseModel):
    answer: str
    citations: list[Citation]
