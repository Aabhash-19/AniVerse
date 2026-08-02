from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime
from uuid import UUID

class SemanticSearchRequest(BaseModel):
    query: str = Field(..., min_length=2, max_length=500)

class NaturalLanguageSearchRequest(BaseModel):
    query: str = Field(..., min_length=2, max_length=500)

class FeedbackRequest(BaseModel):
    feedback_type: str = Field(..., pattern="^(INTERESTED|NOT_INTERESTED)$")

class RecommendationItem(BaseModel):
    id: int
    slug: str
    title: dict
    cover_url: Optional[str]
    format: Optional[str]
    status: Optional[str]
    average_score: Optional[float]
    score: float  # Recommendation score
    reasons: List[str]  # Explanation list

    class Config:
        from_attributes = True

class SearchResponse(BaseModel):
    total: int
    items: List[dict]
    latency_ms: float
