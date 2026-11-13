import re
import hashlib
import uuid
from pathlib import Path
from typing import Tuple
from app.core.exceptions import DocumentValidationError
from app.core.config import get_settings

settings = get_settings()

PDF_MAGIC_BYTES = b"%PDF-"
PDF_EOF_MARKER = b"%%EOF"

# Prohibited dangerous PDF objects/active content
SUSPICIOUS_TOKENS = [
    b"/JavaScript",
    b"/JS",
    b"/Launch",
    b"/EmbeddedFiles",
]


def validate_pdf_content(content: bytes) -> Tuple[int, str]:
    """
    Validates uploaded file bytes:
    1. Size enforcement (<= 10MB)
    2. Magic bytes verification (%PDF- header)
    3. Terminal EOF marker (%%EOF within last 1024 bytes)
    4. Rejection of embedded executable / scripting payloads
    Returns (file_size, sha256_hash).
    """
    file_size = len(content)
    if file_size == 0:
        raise DocumentValidationError("Uploaded file is empty.")
    
    if file_size > settings.MAX_FILE_SIZE_BYTES:
        raise DocumentValidationError(
            f"File size exceeds maximum permitted limit of {settings.MAX_FILE_SIZE_BYTES // (1024*1024)}MB."
        )

    # Magic byte check: must start with %PDF- in the header window
    header_window = content[:1024]
    if not header_window.startswith(PDF_MAGIC_BYTES):
        raise DocumentValidationError("Invalid file signature: File is not a valid PDF document.")

    # Terminal EOF marker check
    trailer_window = content[-1024:]
    if PDF_EOF_MARKER not in trailer_window:
        raise DocumentValidationError("Corrupted or incomplete PDF: Missing terminal %%EOF marker.")

    # Active scripting tokens check
    for token in SUSPICIOUS_TOKENS:
        if token in content:
            raise DocumentValidationError(
                "Security rejection: PDF contains prohibited active scripting or launch action."
            )

    sha256_hash = hashlib.sha256(content).hexdigest()
    return file_size, sha256_hash


def extract_pdf_page_count(content: bytes) -> int:
    """
    Extracts the page count from PDF bytes.
    First checks /Count in the /Pages catalog or searches /Type /Page objects.
    Defaults to 1 if count cannot be extracted.
    """
    try:
        matches = re.findall(rb"/Type\s*/Pages.*?/Count\s+(\d+)", content, re.DOTALL)
        if matches:
            counts = [int(m) for m in matches if m.isdigit()]
            if counts:
                return max(counts)
        page_matches = re.findall(rb"/Type\s*/Page\b", content)
        if page_matches:
            return len(page_matches)
    except Exception:
        pass
    return 1


def sanitize_filename(client_filename: str) -> str:
    """Sanitizes user filename to prevent path traversal and XSS."""
    clean = Path(client_filename).name
    # Remove any characters other than alphanumeric, underscore, hyphen, space, dot
    clean = re.sub(r"[^\w\s\.-]", "_", clean)
    if not clean.lower().endswith(".pdf"):
        clean += ".pdf"
    return clean[:128]  # Bound filename length


def generate_storage_key(user_id: str) -> str:
    """
    Generates an isolated storage key using user UUID and file UUID to prevent path traversal.
    Layout: {user_id}/{file_uuid}.pdf
    """
    file_uuid = str(uuid.uuid4())
    return f"{user_id}/{file_uuid}.pdf"
