from .base import BModel
from uuid import UUID
from pydantic import field_serializer, Field
from typing import Literal

class SignInRequest(BModel):
    github_token: str


class OnboardingCompleteRequest(BModel):
    """Request to mark onboarding as completed"""
    preferred_stack: str | None = Field(None, description="User's preferred tech stack (e.g., nextjs, fastapi)")
    preferred_language: str | None = Field(None, description="User's preferred programming language (e.g., python, typescript)")
    developer_level: Literal["beginner", "intermediate", "advanced", "founder"] = Field("beginner", description="User's developer level")


class UserUpdate(BModel):
    """Schema for updating user fields"""
    username: str | None = Field(None, description="User's username")
    preferred_stack: str | None = Field(None, description="User's preferred tech stack (e.g., nextjs, fastapi)")
    preferred_language: str | None = Field(None, description="User's preferred programming language (e.g., python, typescript)")
    developer_level: Literal["beginner", "intermediate", "advanced", "founder"] | None = Field(None, description="User's developer level")




class UserResponse(BModel):
    id: UUID
    github_id: str
    email: str | None
    username: str
    preferred_stack: str | None
    preferred_language: str | None
    developer_level: str
    onboarding_completed: int
    subscription_tier: str
    monthly_builds_used: int
    monthly_builds_limit: int

    @field_serializer('id')
    def serialize_id(self, value: UUID) -> str:
        """Convert UUID to string for JSON serialization"""
        return str(value)

    class Config:
        from_attributes = True