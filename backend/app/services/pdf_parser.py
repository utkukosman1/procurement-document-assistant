from dataclasses import dataclass
from pathlib import Path

from pypdf import PdfReader


class PdfParseError(Exception):
    pass


@dataclass
class Page:
    page_number: int
    text: str


def extract_pages(path: Path) -> list[Page]:
    try:
        reader = PdfReader(path)
        if reader.is_encrypted:
            raise PdfParseError("The PDF is password-protected.")
        pages = [
            Page(page_number=i + 1, text=page.extract_text() or "")
            for i, page in enumerate(reader.pages)
        ]
    except PdfParseError:
        raise
    except Exception as exc:
        raise PdfParseError(f"Could not read the PDF: {exc}") from exc

    if not any(page.text.strip() for page in pages):
        raise PdfParseError(
            "No extractable text found. The PDF may be scanned or image-only, "
            "which is not supported."
        )
    return pages
