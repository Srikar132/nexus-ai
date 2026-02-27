"""
Repositories package - imports all repository classes for easy access.

Usage:
    from app.repositories import UserRepo, ProjectRepo, BuildRepo, MessageRepo, ArtifactRepo
"""

from .user_repo import UserRepo
from .project_repo import ProjectRepo
from .build_repo import BuildRepo
from .message_repo import MessageRepo
from .artifact_repo import ArtifactRepo

__all__ = [
    "UserRepo",
    "ProjectRepo", 
    "BuildRepo",
    "MessageRepo",
    "ArtifactRepo",
]
