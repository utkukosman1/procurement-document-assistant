import chromadb.errors
import openai
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.routes.chat import router as chat_router
from app.api.routes.documents import router as documents_router
from app.api.routes.health import router as health_router
from app.core.config import settings

app = FastAPI(title=settings.app_name)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health_router)
app.include_router(documents_router)
app.include_router(chat_router)


@app.exception_handler(openai.OpenAIError)
def openai_error_handler(request: Request, exc: openai.OpenAIError) -> JSONResponse:
    return JSONResponse(
        status_code=502,
        content={"detail": "The AI service is temporarily unavailable. Please try again."},
    )


@app.exception_handler(chromadb.errors.ChromaError)
def chroma_error_handler(request: Request, exc: chromadb.errors.ChromaError) -> JSONResponse:
    return JSONResponse(
        status_code=502,
        content={"detail": "The document store is temporarily unavailable. Please try again."},
    )
