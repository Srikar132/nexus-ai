from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
import uuid
from typing import Optional
from app.models.user import User
from app.utils.encryption import encrypt_token, decrypt_token


class UserRepo:
    """
    Repository pattern for User entity.
    Handles all database operations for users.
    """

    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_by_github_id(self, github_id: str) -> Optional[User]:
        """Get user by GitHub ID."""
        result = await self.db.execute(
            select(User).where(User.github_id == github_id)
        )
        return result.scalar_one_or_none()

    async def get_by_id(self, user_id: uuid.UUID) -> Optional[User]:
        """Get user by database ID."""
        result = await self.db.execute(
            select(User).where(User.id == user_id)
        )
        return result.scalar_one_or_none()

    async def create(
        self,
        github_id: str,
        username: str,
        email: Optional[str] = None,
        github_token: Optional[str] = None,
    ) -> User:
        """Create a new user with encrypted GitHub token."""
        user = User(
            github_id=github_id,
            username=username,
            email=email,
            github_token_encrypted=encrypt_token(github_token) if github_token else None,
        )
        self.db.add(user)
        await self.db.flush()
        await self.db.refresh(user)
        return user

    async def get_github_token(self, github_id: str) -> Optional[str]:
        """Get decrypted GitHub token for API calls."""
        user = await self.get_by_github_id(github_id)
        if user and user.github_token_encrypted:
            return decrypt_token(user.github_token_encrypted)
        return None

    async def update_github_token(
        self,
        github_id: str,
        github_token: str
    ) -> Optional[User]:
        """Update user's encrypted GitHub token."""
        user = await self.get_by_github_id(github_id)
        if user:
            user.github_token_encrypted = encrypt_token(github_token)
            await self.db.flush()
            await self.db.refresh(user)
        return user

    async def complete_onboarding(
        self,
        user: User,
        preferred_stack: Optional[str] = None,
        preferred_language: Optional[str] = None,
        developer_level: str = "beginner",
    ) -> User:
        """Mark user onboarding as complete and update preferences."""
        user.onboarding_completed = 1

        if preferred_stack:
            user.preferred_stack = preferred_stack
        if preferred_language:
            user.preferred_language = preferred_language
        if developer_level:
            user.developer_level = developer_level

        await self.db.flush()
        await self.db.refresh(user)
        return user

    async def update(
        self,
        user_id: uuid.UUID,
        **fields
    ) -> Optional[User]:
        """Update user fields dynamically."""
        await self.db.execute(
            update(User)
            .where(User.id == user_id)
            .values(**fields)
        )
        await self.db.flush()
        return await self.get_by_id(user_id)

