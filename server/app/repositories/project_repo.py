from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc, update, func
import uuid
from typing import List, Optional
from app.models.project import Project
from app.core.llm import get_llm
import json


class ProjectRepo:
    """
    Repository pattern for Project entity.
    Handles all database operations for projects.
    """

    def __init__(self, db: AsyncSession):
        self.db = db

    async def create(
        self,
        user_id: uuid.UUID,
        name: str | None = None,
        description: str | None = None,
        user_prompt: str | None = None
    ) -> Project:
        """
        Create a new project.
        """
        
        if not name and not description and user_prompt:
            try:
                llm = get_llm("llama-3.1-8b")

                response = llm.chat(
                    messages=[
                        {"role": "user", "content": f"Create a project name and description based on this user prompt: '{user_prompt}'. Return only a JSON object with 'name' and 'description' fields. Example: {{\"name\": \"Project Name\", \"description\": \"Project description\"}}"}
                    ]
                )

                data = json.loads(response.content)
                name = data.get("name", f"Project for: {user_prompt[:50]}...")
                description = data.get("description", user_prompt)
            except (json.JSONDecodeError, Exception) as e:
                # Fallback if LLM fails or returns invalid JSON
                name = f"Project for: {user_prompt[:50]}..."
                description = user_prompt
        
        # Ensure we always have a name
        if not name:
            name = "Untitled Project"
            
        # Ensure we always have a description
        if not description:
            description = user_prompt or "No description provided"

        project = Project(
            user_id=user_id,
            name=name,
            description=description,
            status="active"
        )
        
        self.db.add(project)
        await self.db.commit()
        await self.db.refresh(project)
        return project

    async def get_by_id(
        self,
        project_id: uuid.UUID,
        user_id: uuid.UUID
    ) -> Optional[Project]:
        """
        Get a project by ID for a specific user.
        Excludes deleted projects.
        """
        result = await self.db.execute(
            select(Project).where(
                Project.id == project_id,
                Project.user_id == user_id,
                Project.status != "deleted"
            )
        )
        return result.scalar_one_or_none()

    async def list_by_user(
        self,
        user_id: uuid.UUID,
        page: int = 1,
        limit: int = 10
    ) -> tuple[List[Project], int]:
        """
        Get all projects for a user with pagination.
        Returns (projects, total_count).
        Excludes deleted projects.
        """
        from sqlalchemy import func
        
        # Get total count
        count_query = select(func.count()).select_from(Project).filter(
            Project.user_id == user_id,
            Project.status != "deleted"
        )
        count_result = await self.db.execute(count_query)
        total_count = count_result.scalar()
        
        # Get projects with pagination
        offset = (page - 1) * limit
        query = (
            select(Project)
            .filter(
                Project.user_id == user_id,
                Project.status != "deleted"
            )
            .order_by(desc(Project.created_at))
            .offset(offset)
            .limit(limit)
        )
        
        result = await self.db.execute(query)
        projects = result.scalars().all()
        
        return list(projects), total_count

    async def update(
        self,
        project_id: uuid.UUID,
        user_id: uuid.UUID,
        **fields
    ) -> Optional[Project]:
        """
        Update project fields.
        Returns updated project or None if not found.
        """
        await self.db.execute(
            update(Project)
            .where(
                Project.id == project_id,
                Project.user_id == user_id,
                Project.status != "deleted"
            )
            .values(**fields)
        )
        await self.db.flush()
        return await self.get_by_id(project_id, user_id)

    async def soft_delete(
        self,
        project_id: uuid.UUID,
        user_id: uuid.UUID
    ) -> bool:
        """
        Soft delete a project by setting status to 'deleted'.
        Returns True if successful, False otherwise.
        """
        result = await self.db.execute(
            update(Project)
            .where(
                Project.id == project_id,
                Project.user_id == user_id
            )
            .values(status="deleted")
        )
        await self.db.flush()
        return result.rowcount > 0