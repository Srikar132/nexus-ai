from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
import uuid
from app.models.user import User
from app.utils.encryption import encrypt_token, decrypt_token


async def get_user_by_github_id(db: AsyncSession, github_id: str) -> User | None:
    result = await db.execute(select(User).filter(User.github_id == github_id))
    return result.scalar_one_or_none()


async def get_user_by_id(db: AsyncSession, user_id: uuid.UUID) -> User | None:
    """Get user by database ID"""
    result = await db.execute(select(User).filter(User.id == user_id))
    return result.scalar_one_or_none()


async def create_user(
    db: AsyncSession,
    github_id: str,
    username: str,
    email: str | None = None,
    github_token: str | None = None,
) -> User:
    user = User(
        github_id=github_id,
        username=username,
        email=email,
        github_token_encrypted=encrypt_token(github_token) if github_token else None,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


async def get_user_github_token(db: AsyncSession, github_id: str) -> str | None:
    """Get decrypted GitHub token for API calls"""
    user = await get_user_by_github_id(db, github_id)
    if user and user.github_token_encrypted:
        return decrypt_token(user.github_token_encrypted)
    return None


async def update_user_github_token(
    db: AsyncSession, 
    github_id: str, 
    github_token: str
) -> User | None:
    """Update user's encrypted GitHub token"""
    user = await get_user_by_github_id(db, github_id)
    if user:
        user.github_token_encrypted = encrypt_token(github_token)
        await db.commit()
        await db.refresh(user)
    return user


async def complete_onboarding(
    db: AsyncSession,
    user: User,
    preferred_stack: str | None = None,
    preferred_language: str | None = None,
    developer_level: str = "beginner",
) -> User:
    """Mark user onboarding as complete and update preferences"""
    user.onboarding_completed = 1
    
    if preferred_stack:
        user.preferred_stack = preferred_stack
    if preferred_language:
        user.preferred_language = preferred_language
    if developer_level:
        user.developer_level = developer_level
    
    await db.commit()
    await db.refresh(user)
    return user

