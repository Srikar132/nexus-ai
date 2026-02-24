from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
import uuid
from typing import List
from app.models.message import Message


class MessageRepo:
    """
    Repository pattern for Message entity.
    Handles all database operations for messages.
    """

    def __init__(self, db: AsyncSession):
        self.db = db

    async def create(
        self,
        project_id: uuid.UUID,
        role: str,
        message_type: str,
        content: list,
        metadata: dict = None
    ) -> Message:
        """
        Create a new message.
        """
        m = Message(
            project_id=project_id,
            role=role,
            message_type=message_type,
            content=content,
            metadata_=metadata
        )
        self.db.add(m)
        await self.db.flush()
        await self.db.refresh(m)
        return m

    async def get_paginated(
        self,
        project_id: uuid.UUID,
        limit: int = 50,
        offset: int = 0
    ) -> tuple[list[Message], int]:
        """
        Get paginated messages for a project.
        Returns (messages, total_count).
        """
        # Get total count
        count_r = await self.db.execute(
            select(func.count(Message.id)).where(Message.project_id == project_id)
        )
        total = count_r.scalar_one()
        
        # Get messages with pagination
        r = await self.db.execute(
            select(Message)
            .where(Message.project_id == project_id)
            .order_by(Message.created_at.asc())
            .limit(limit)
            .offset(offset)
        )
        return list(r.scalars().all()), total

    async def get_recent_for_context(
        self,
        project_id: uuid.UUID,
        limit: int = 20
    ) -> list[Message]:
        """
        Get recent messages for context (most recent first, then reversed to chronological order).
        """
        r = await self.db.execute(
            select(Message)
            .where(Message.project_id == project_id)
            .order_by(Message.created_at.desc())
            .limit(limit)
        )
        return list(reversed(r.scalars().all()))
