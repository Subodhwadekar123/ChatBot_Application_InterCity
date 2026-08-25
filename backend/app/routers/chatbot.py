"""
InterCity Chatbot - Chatbot Router
===================================
Public endpoints for the real-estate chatbot assistant.
No login or authentication required.
"""

import re
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, field_validator
from typing import List, Dict
from sqlalchemy.orm import Session

from app.database import get_db
from app.services.property_service import PropertyService
from app.utils.logger import setup_logger

logger = setup_logger(__name__)
router = APIRouter()

# Maximum question length for input sanitization
MAX_QUESTION_LENGTH = 500


class ChatQueryRequest(BaseModel):
    question: str
    history: List[Dict[str, str]] = []

    @field_validator("question")
    @classmethod
    def sanitize_question(cls, v: str) -> str:
        """Strip excessive whitespace, HTML tags, and enforce length limit."""
        v = re.sub(r"<[^>]+>", "", v)
        v = re.sub(r"\s+", " ", v).strip()
        if len(v) > MAX_QUESTION_LENGTH:
            v = v[:MAX_QUESTION_LENGTH]
        return v


@router.post("/chatbot/query", summary="Query the Real-Estate Chatbot")
def query_properties_chatbot(
    req: ChatQueryRequest,
    db: Session = Depends(get_db),
):
    """
    Submits a natural-language search query to the property assistant.
    Public endpoint — no authentication required.
    Queries live SQL Server property tables directly.
    """
    if not req.question.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Question cannot be empty.",
        )

    try:
        logger.info(f"Chatbot question asked: {req.question}")

        result = PropertyService.query_chatbot(
            db=db,
            question=req.question,
            history=req.history,
        )
        return result
    except Exception as e:
        logger.error(f"Chatbot query error: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Chatbot failed to process request: {str(e)}",
        )


@router.get("/properties/metadata", summary="Get Property Database Stats")
def get_properties_metadata(
    db: Session = Depends(get_db),
):
    """
    Retrieves live statistics about the property database.
    Public endpoint — no authentication required.
    """
    meta = PropertyService.get_metadata(db)
    if not meta:
        return {"total_properties": 0}
    return meta
