from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc, update, func
import uuid
from typing import Optional
from app.models.build import Build


class BuildRepo:
    """
    Repository pattern for Build entity.
    Handles all database operations for builds.
    """

    def __init__(self, db: AsyncSession):
        self.db = db

    async def create(self, project_id: uuid.UUID) -> Build:
        """
        Create a new build with auto-incremented build_number per project.
        """
        # Get the next build number for this project
        r = await self.db.execute(
            select(func.coalesce(func.max(Build.build_number), 0))
            .where(Build.project_id == project_id)
        )
        next_num = r.scalar_one() + 1
        
        b = Build(project_id=project_id, build_number=next_num)
        self.db.add(b)
        await self.db.flush()
        await self.db.refresh(b)
        return b

    async def get_by_id(
        self,
        build_id: uuid.UUID,
        project_id: uuid.UUID
    ) -> Optional[Build]:
        """
        Get a build by ID and project ID.
        """
        r = await self.db.execute(
            select(Build).where(
                Build.id == build_id,
                Build.project_id == project_id
            )
        )
        return r.scalar_one_or_none()

    async def get_active_build(
        self,
        project_id: uuid.UUID
    ) -> Optional[Build]:
        """
        Get the active (non-completed/non-failed) build for a project.
        Statuses: building, waiting_env, deploying.
        """
        r = await self.db.execute(
            select(Build)
            .where(
                Build.project_id == project_id,
                Build.status.in_([
                    "building",
                    "waiting_env",
                    "deploying",
                ])
            )
            .order_by(desc(Build.created_at))
            .limit(1)
        )
        return r.scalar_one_or_none()

    async def get_latest_build(
        self,
        project_id: uuid.UUID
    ) -> Optional[Build]:
        """
        Get the most recent build for a project regardless of status.
        Used to show Live button after deployment completes (status=completed, deploy_url set).
        """
        r = await self.db.execute(
            select(Build)
            .where(Build.project_id == project_id)
            .order_by(desc(Build.created_at))
            .limit(1)
        )
        return r.scalar_one_or_none()

    async def list_by_project(
        self,
        project_id: uuid.UUID
    ) -> list[Build]:
        """
        Get all builds for a project, ordered by build_number descending.
        """
        r = await self.db.execute(
            select(Build)
            .where(Build.project_id == project_id)
            .order_by(Build.build_number.desc())
        )
        return list(r.scalars().all())

    async def update(
        self,
        build_id: uuid.UUID,
        **fields
    ) -> Optional[Build]:
        """
        Update build fields.
        Returns updated build or None if not found.
        """
        await self.db.execute(
            update(Build)
            .where(Build.id == build_id)
            .values(**fields)
        )
        await self.db.flush()
        r = await self.db.execute(
            select(Build).where(Build.id == build_id)
        )
        return r.scalar_one_or_none()
