from functools import lru_cache

from openai import OpenAI

from app.core.config import settings


@lru_cache(maxsize=1)
def get_openai_client() -> OpenAI:
    return OpenAI(api_key=settings.openai_api_key)
