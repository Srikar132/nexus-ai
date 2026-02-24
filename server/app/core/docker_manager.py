"""
One Docker container per build. Spins up when build starts, destroyed after deploy.
Artificer writes files here. Guardian attacks the running app here.
"""

import io
import tarfile
import docker
from app.core.config import settings

client = docker.from_env()


class DockerManager:
    def __init__(self, project_id: str, build_id: str , github_token: str):
        self.project_id     = project_id
        self.build_id       = build_id
        self.container_name = f"build-{build_id}"
        self.container      = None
        self.app_port       = None   # port where the app runs for Guardian to attack
        self.github_token   = github_token

    