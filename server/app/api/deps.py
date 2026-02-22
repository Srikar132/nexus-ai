# dependencies.py — one clean place to fetch + reuse the user
from fastapi import Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.services.user_service import get_user_by_id
from app.models.user import User

async def get_current_user(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> User:
    user = await get_user_by_id(db=db, user_id=request.state.user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    return user