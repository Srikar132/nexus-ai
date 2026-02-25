from typing import Any, Dict, Optional
from uuid import UUID
from pydantic import BaseModel
from fastapi_nextauth_jwt import NextAuthJWT
from app.core.config import settings


class UserJWEModel(BaseModel):
    """User model matching NextAuth JWT structure"""
    id: str  # Database user ID
    email: Optional[str]=None
    username: Optional[str] = None
    onboardingCompleted: Optional[bool] = False
    name: Optional[str] = None
    # NextAuth standard fields
    sub: Optional[str] = None  # Usually same as id
    iat: Optional[int] = None  # Issued at
    exp: Optional[int] = None  # Expires at
    jti: Optional[str] = None  # JWT ID


# Initialize the NextAuth JWT handler
# This reads the JWE token from the "authjs.session-token" cookie,
# derives the key using HKDF, and decrypts it automatically.
#
# secure_cookie=False → cookie name is "authjs.session-token" (for localhost/HTTP)
# secure_cookie=True  → cookie name is "__Secure-authjs.session-token" (for HTTPS)
JWT_HANDLER = NextAuthJWT(
    secret=settings.NEXTAUTH_SECRET,
    secure_cookie=False,  # False for localhost (HTTP), set True for production (HTTPS)
    csrf_prevention_enabled=False,
    check_expiry=True,
)

print(f"[jwt_utils] NextAuthJWT initialized, cookie_name={JWT_HANDLER.cookie_name}")


def extract_user_data_from_jwt(user_model: UserJWEModel) -> Dict[str, Any]:
    """
    Extract user data from the validated JWT model
    """
    try:
        user_uuid = UUID(user_model.id)
    except (ValueError, TypeError):
        raise ValueError("Invalid user_id in JWT")

    return {
        "user_id": user_uuid,
        "email": user_model.email,
        "username": user_model.username,
        "onboarding_completed": user_model.onboardingCompleted or False,
    }