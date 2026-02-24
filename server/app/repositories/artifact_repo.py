from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
import uuid
from typing import Optional
from app.models.artifact import Artifact


class ArtifactRepo:
    """
    Repository pattern for Artifact entity.
    Handles all database operations for artifacts.
    """

    def __init__(self, db: AsyncSession):
        self.db = db

    async def create(
        self,
        project_id: uuid.UUID,
        artifact_type: str,
        title: str,
        content: dict,
        build_id: uuid.UUID = None
    ) -> Artifact:
        """
        Create a new artifact.
        """
        a = Artifact(
            project_id=project_id,
            build_id=build_id,
            artifact_type=artifact_type,
            title=title,
            content=content
        )
        self.db.add(a)
        await self.db.flush()
        await self.db.refresh(a)
        return a

    async def get_by_id(
        self,
        artifact_id: uuid.UUID,
        project_id: uuid.UUID
    ) -> Optional[Artifact]:
        """
        Get an artifact by ID and project ID.
        """
        r = await self.db.execute(
            select(Artifact).where(
                Artifact.id == artifact_id,
                Artifact.project_id == project_id
            )
        )
        return r.scalar_one_or_none()

    async def get_many_by_ids(
        self,
        artifact_ids: list[uuid.UUID]
    ) -> dict[str, Artifact]:
        """
        Get multiple artifacts by their IDs.
        Returns a dictionary mapping artifact_id (as string) to Artifact object.
        """
        if not artifact_ids:
            return {}
        
        r = await self.db.execute(
            select(Artifact).where(Artifact.id.in_(artifact_ids))
        )
        return {str(a.id): a for a in r.scalars().all()}

    async def update(
        self,
        artifact_id: uuid.UUID,
        project_id: uuid.UUID,
        **fields
    ) -> Optional[Artifact]:
        """
        Update artifact fields.
        Returns updated artifact or None if not found.
        """
        await self.db.execute(
            update(Artifact)
            .where(
                Artifact.id == artifact_id,
                Artifact.project_id == project_id
            )
            .values(**fields)
        )
        await self.db.flush()
        return await self.get_by_id(artifact_id, project_id)
