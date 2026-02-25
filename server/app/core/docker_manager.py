"""
One Docker container per build. Spins up when build starts, destroyed after deploy.
Artificer writes files here. Guardian attacks the running app here.
"""

import io
import tarfile
import time
import docker
from app.core.config import settings

client = docker.from_env()

# Sensible defaults per framework — fallback only
STACK_DEFAULTS = {
    "fastapi":    {"install": "pip install -r requirements.txt", "start": "uvicorn main:app --host 0.0.0.0 --port 8080", "port": 8080},
    "flask":      {"install": "pip install -r requirements.txt", "start": "python app.py",                               "port": 5000},
    "express":    {"install": "npm install",                     "start": "node index.js",                               "port": 3000},
    "nextjs":     {"install": "npm install",                     "start": "npm start",                                   "port": 3000},
    "django":     {"install": "pip install -r requirements.txt", "start": "python manage.py runserver 0.0.0.0:8000",     "port": 8000},
    "springboot": {"install": "mvn package -q",                  "start": "java -jar target/*.jar",                      "port": 8080},
}


class RunConfig:
    """Parsed run configuration — comes from approved_plan.run_config"""

    def __init__(self, run_config: dict, tech_stack: dict = None):
        framework = (tech_stack or {}).get("framework", "fastapi").lower()
        defaults  = STACK_DEFAULTS.get(framework, STACK_DEFAULTS["fastapi"])

        self.install_command     = run_config.get("install_command")     or defaults["install"]
        self.start_command       = run_config.get("start_command")       or defaults["start"]
        self.port                = int(run_config.get("port")            or defaults["port"])
        self.health_check_path   = run_config.get("health_check_path")   or "/health"
        self.startup_wait_secs   = int(run_config.get("startup_wait_secs") or 5)
        self.build_command       = run_config.get("build_command")       or self.install_command
        self.deploy_command      = run_config.get("deploy_command")      or self.start_command


class DockerManager:

    def __init__(self, project_id: str, build_id: str):
        self.project_id     = project_id
        self.build_id       = build_id
        self.container_name = f"build-{build_id}"
        self.container      = None
        self.app_port       = None
        self.run_config: RunConfig | None = None
    
    
    def spin_up(self, port: int = 8080) -> str:
        """Spin up container with a default port mapping (can be reconfigured later)"""
        self.container = client.containers.run(
            image       = settings.DOCKER_BASE_IMAGE,
            name        = self.container_name,
            command     = "tail -f /dev/null",
            detach      = True,
            network     = settings.DOCKER_NETWORK,
            ports       = {f"{port}/tcp": None},   # Map to random host port
            environment = {
                "PROJECT_ID": self.project_id,
                "BUILD_ID":   self.build_id,
                "PORT":       str(port),
            },
            mem_limit   = "512m",
            cpu_quota   = 50000,
            cpu_period  = 100000,
        )
        
        # Get the mapped host port
        self.container.reload()
        bindings = self.container.ports.get(f"{port}/tcp")
        if bindings:
            self.app_port = bindings[0]["HostPort"]
        
        self.exec("mkdir -p /workspace")
        self.exec("apt-get update -qq && apt-get install -y -qq git curl")
        return self.container.id

    def configure_port(self, run_config: RunConfig):
        """
        Called by Artificer after writing files — now we know the port.
        Recreates container with correct port mapping, restores files.
        """
        self.run_config = run_config

        # Snapshot existing files before recreation
        existing_files = self._snapshot_workspace()

        # Recreate with correct port
        self.container.stop(timeout=5)
        self.container.remove(force=True)

        self.container = client.containers.run(
            image       = settings.DOCKER_BASE_IMAGE,
            name        = self.container_name,
            command     = "tail -f /dev/null",
            detach      = True,
            network     = settings.DOCKER_NETWORK,
            ports       = {f"{run_config.port}/tcp": None},   # dynamic host port
            environment = {
                "PROJECT_ID": self.project_id,
                "BUILD_ID":   self.build_id,
                "PORT":       str(run_config.port),
            },
            mem_limit   = "512m",
            cpu_quota   = 50000,
            cpu_period  = 100000,
        )
        self.exec("mkdir -p /workspace")
        self.exec("apt-get update -qq && apt-get install -y -qq git curl")

        # Restore files
        for path, content in existing_files.items():
            self.write_file(path, content)

        # Get the mapped host port
        self.container.reload()
        bindings = self.container.ports.get(f"{run_config.port}/tcp")
        if bindings:
            self.app_port = bindings[0]["HostPort"]

    def start_app(self) -> str:
        """Install deps + start app. Returns URL Guardian will attack."""
        if not self.run_config:
            raise RuntimeError("run_config not set. Call configure_port() first.")

        # Install dependencies
        exit_code, output = self.exec(f"cd /workspace && {self.run_config.install_command}")
        if exit_code != 0:
            raise RuntimeError(f"Install failed:\n{output}")

        # Start app in background
        self.exec(f"cd /workspace && nohup {self.run_config.start_command} > /workspace/app.log 2>&1 &")

        # Wait for startup
        time.sleep(self.run_config.startup_wait_secs)

        # Health check
        exit_code, output = self.exec(
            f"curl -sf http://localhost:{self.run_config.port}{self.run_config.health_check_path} || echo 'HEALTH_FAILED'"
        )
        if "HEALTH_FAILED" in output:
            _, logs = self.exec("cat /workspace/app.log")
            raise RuntimeError(f"App failed to start.\n{logs}")

        return f"http://localhost:{self.app_port}"

    def get_app_logs(self) -> str:
        _, logs = self.exec("cat /workspace/app.log 2>/dev/null || echo 'No logs'")
        return logs

    def exec(self, command: str) -> tuple[int, str]:
        if not self.container:
            raise RuntimeError("Container not started")
        result = self.container.exec_run(["/bin/sh", "-c", command], workdir="/workspace")
        return result.exit_code, (result.output or b"").decode("utf-8")

    def write_file(self, path: str, content: str):
        parent = "/".join(path.split("/")[:-1])
        if parent:
            self.exec(f"mkdir -p /workspace/{parent}")
        stream = io.BytesIO()
        with tarfile.open(fileobj=stream, mode="w") as tar:
            encoded   = content.encode("utf-8")
            info      = tarfile.TarInfo(name=path)
            info.size = len(encoded)
            tar.addfile(info, io.BytesIO(encoded))
        stream.seek(0)
        self.container.put_archive("/workspace", stream)

    def read_file(self, path: str) -> str:
        _, output = self.exec(f"cat /workspace/{path}")
        return output

    def list_files(self) -> list[str]:
        _, out = self.exec("find /workspace -type f | sed 's|/workspace/||'")
        return [f.strip() for f in out.strip().split("\n") if f.strip()]

    def _snapshot_workspace(self) -> dict[str, str]:
        files = {}
        for path in self.list_files():
            try:
                files[path] = self.read_file(path)
            except Exception:
                pass
        return files

    def spin_down(self):
        if not self.container:
            return
        try:
            self.container.stop(timeout=10)
            self.container.remove(force=True)
        except docker.errors.NotFound:
            pass
        self.container = None

    @classmethod
    def reattach(cls, build_id: str, run_config: RunConfig = None) -> "DockerManager":
        mgr = cls.__new__(cls)
        mgr.project_id     = None
        mgr.build_id       = build_id
        mgr.container_name = f"build-{build_id}"
        mgr.run_config     = run_config
        mgr.app_port       = None
        try:
            mgr.container = client.containers.get(mgr.container_name)
            mgr.container.reload()
            if run_config:
                bindings = mgr.container.ports.get(f"{run_config.port}/tcp")
                if bindings:
                    mgr.app_port = bindings[0]["HostPort"]
        except docker.errors.NotFound:
            mgr.container = None
        return mgr
