from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession
import httpx
from app.core.database import get_db
from app.api.deps import get_current_user
from app.services.user_service import (
    get_user_by_github_id,
    create_user,
    complete_onboarding,
    update_user_github_token,
)
from app.schemas.user_schemas import (
    UserResponse,
    SignInRequest,
    OnboardingCompleteRequest,
)
from app.models.user import User

router = APIRouter(prefix="/users", tags=["users"])

GITHUB_API = "https://api.github.com"


@router.post("/signin", response_model=UserResponse)
async def signin_with_github(
    signin_request: SignInRequest, 
    db: AsyncSession = Depends(get_db)
):
    """
    Sign in or create user with GitHub token.
    This should be called from NextAuth signIn callback.
    Stores encrypted GitHub token for future API calls.
    """
    try:
        # Verify token with GitHub
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{GITHUB_API}/user",
                headers={
                    "Authorization": f"Bearer {signin_request.github_token}",
                    "Accept": "application/vnd.github.v3+json",
                },
                timeout=10.0,
            )

        if response.status_code != 200:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired GitHub token"
            )

        github_user = response.json()
        github_id = str(github_user["id"])

        # Check if user exists
        user = await get_user_by_github_id(db, github_id)

        if not user:
            # Create new user with encrypted GitHub token
            user = await create_user(
                db,
                github_id=github_id,
                username=github_user.get("login"),
                email=github_user.get("email"),
                github_token=signin_request.github_token,  # Store encrypted token
            )
        else:
            # Update existing user's GitHub token (in case it was refreshed)
            await update_user_github_token(db, github_id, signin_request.github_token)

        return user

    except httpx.TimeoutException:
        raise HTTPException(
            status_code=status.HTTP_408_REQUEST_TIMEOUT,
            detail="GitHub API request timed out"
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal server error: {str(e)}"
        )


@router.get("/me", response_model=UserResponse)
async def read_users_me(current_user: User = Depends(get_current_user)):
    """
    Get current authenticated user.
    Now uses NextAuth JWT middleware with dependency injection.
    """
    return current_user


@router.post("/onboarding/complete", response_model=UserResponse)
async def complete_user_onboarding(
    onboarding_data: OnboardingCompleteRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Complete user onboarding and set preferences.
    Now uses NextAuth JWT middleware with dependency injection.
    """
    # Optional: Check if onboarding already completed
    # if current_user.onboarding_completed == 1:
    #     raise HTTPException(
    #         status_code=status.HTTP_400_BAD_REQUEST,
    #         detail="Onboarding already completed"
    #     )
    
    updated_user = await complete_onboarding(
        db,
        current_user,
        preferred_stack=onboarding_data.preferred_stack,
        preferred_language=onboarding_data.preferred_language,
        developer_level=onboarding_data.developer_level,
    )
    
    return updated_user