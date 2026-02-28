"""
tools/docker_tools.py

Tools given to the Artificer agent.

Design principles:
  - NO hardcoded framework logic. The agent reasons about everything.
  - Tools are thin wrappers around DockerManager — they give the agent
    eyes and hands inside the container, but the agent decides what to do.
  - `emit_run_config` is a proper tool call (not echo-parsing).
  - `analyse_env_vars` inspects the actual code to determine what env vars
    the app needs — no keyword guessing.
"""
import json
import os
from langchain_core.tools import tool
from app.core.docker_manager import DockerManager


def get_docker_tools(docker: DockerManager) -> list:
    """
    Returns tool functions bound to this build's DockerManager instance.
    Call once per build, pass returned list to run_react_agent().
    """

    @tool
    def exec_command(command: str) -> str:
        """
        Run any shell command inside the Docker build container at /workspace.
        Use for: installing packages, running scripts, checking errors, viewing output.
        Returns exit code status and full command output.

        Examples:
          exec_command("pip install -r requirements.txt")
          exec_command("python -m pytest tests/ -v")
          exec_command("ls -la")
          exec_command("cat requirements.txt")
          exec_command("python -c 'import fastapi; print(fastapi.__version__)'")
        """
        exit_code, output = docker.exec(command)
        status = "✅ EXIT 0" if exit_code == 0 else f"❌ EXIT {exit_code}"
        result = output.strip() if output.strip() else "(no output)"
        return f"{status}\n{result}"

    @tool
    def write_file(path: str, content: str) -> str:
        """
        Write a complete file into /workspace/{path} inside the container.
        Parent directories are created automatically.
        Always write the COMPLETE file — never partial or truncated content.
        IMPORTANT: Always use relative paths like "main.py" or "src/models.py".
        Do NOT use absolute paths like "/tmp/..." or "/workspace/...".

        Examples:
          write_file("main.py", "from fastapi import FastAPI\\napp = FastAPI()\\n...")
          write_file("src/models.py", "from sqlalchemy import ...\\n...")
          write_file("requirements.txt", "fastapi==0.115.0\\nuvicorn[standard]==0.30.0\\n")
        """
        try:
            docker.write_file(path, content)
            lines = len(content.splitlines())
            size  = len(content.encode("utf-8"))
            return f"✅ Written: {path} ({lines} lines, {size} bytes)"
        except Exception as e:
            return f"❌ Failed to write {path}: {e}"

    @tool
    def read_file(path: str) -> str:
        """
        Read the current contents of a file from /workspace/{path}.
        Use this before modifying an existing file to see what's there.

        Example: read_file("main.py")
        """
        try:
            content = docker.read_file(path)
            return content if content.strip() else "(file is empty)"
        except Exception as e:
            return f"❌ Cannot read {path}: {e}"

    @tool
    def list_files() -> str:
        """
        List all files currently in /workspace.
        Use this to see what has been created, check structure, or verify a file exists.
        """
        files = docker.list_files()
        if not files:
            return "(workspace is empty — no files written yet)"
        return "\n".join(sorted(files))

    @tool
    def check_syntax(path: str) -> str:
        """
        Validate the syntax of a Python or JavaScript/TypeScript file without running it.
        Call this after writing each file to catch syntax errors early.

        Examples:
          check_syntax("main.py")
          check_syntax("src/models.py")
          check_syntax("index.js")
        """
        ext = os.path.splitext(path)[1].lower()
        if ext == ".py":
            exit_code, output = docker.exec(
                f"python3 -m py_compile /workspace/{path} 2>&1 && echo 'SYNTAX_OK'"
            )
            if "SYNTAX_OK" in output:
                return f"✅ {path} — syntax OK"
            return f"❌ {path} — syntax error:\n{output}"

        elif ext in (".js", ".ts", ".jsx", ".tsx"):
            if ext in (".ts", ".tsx"):
                exit_code, output = docker.exec(
                    f"npx tsc --noEmit /workspace/{path} 2>&1 || node --check /workspace/{path} 2>&1 && echo 'SYNTAX_OK'"
                )
            else:
                exit_code, output = docker.exec(
                    f"node --check /workspace/{path} 2>&1 && echo 'SYNTAX_OK'"
                )
            if "SYNTAX_OK" in output or exit_code == 0:
                return f"✅ {path} — syntax OK"
            return f"❌ {path} — syntax error:\n{output}"

        return f"⚠️ Syntax check not available for {ext} files — skipped"

    @tool
    def get_app_logs() -> str:
        """
        Get the current application runtime logs.
        Use this to diagnose startup failures or runtime errors.
        The logs come from /workspace/app.log written when the app starts.
        """
        return docker.get_app_logs()

    @tool
    def delete_file(path: str) -> str:
        """
        Delete a file from /workspace/{path}.
        Use when you need to replace a file completely or clean up.

        Example: delete_file("old_config.py")
        """
        try:
            exit_code, output = docker.exec(f"rm -f /workspace/{path}")
            if exit_code == 0:
                return f"✅ Deleted: {path}"
            return f"❌ Delete failed: {output}"
        except Exception as e:
            return f"❌ Error deleting {path}: {e}"

    @tool
    def emit_run_config(
        install_command: str,
        start_command: str,
        health_check_path: str = "/health",
        startup_wait_secs: int = 8,
    ) -> str:
        """
        Register the application's run configuration with the system.
        You MUST call this as the FINAL step after all files are written,
        dependencies installed, syntax checked, and Swagger integrated.

        The system uses this config to start and health-check the app.
        Without calling this tool, the application CANNOT be started.

        Args:
            install_command: Command to install dependencies (e.g. "pip install -r requirements.txt")
            start_command: Command to start the application (e.g. "uvicorn main:app --host 0.0.0.0 --port 8080")
            health_check_path: HTTP path that returns 200 when app is ready (e.g. "/health")
            startup_wait_secs: Seconds to wait for the app to start before health check (e.g. 8)
        """
        config = {
            "install_command":   install_command,
            "start_command":     start_command,
            "health_check_path": health_check_path,
            "startup_wait_secs": startup_wait_secs,
        }
        # Store on the docker manager so the node can retrieve it
        docker._run_config_from_tool = config
        return (
            f"✅ Run config registered:\n"
            f"  install: {install_command}\n"
            f"  start:   {start_command}\n"
            f"  health:  {health_check_path}\n"
            f"  wait:    {startup_wait_secs}s"
        )

    @tool
    def analyse_env_vars() -> str:
        """
        Analyse the application source code in /workspace to determine what
        environment variables the app reads at runtime.

        Scans source files for patterns like os.environ, os.getenv, process.env,
        config references, .env file templates, etc. and returns a list of
        environment variable names the app expects.

        Call this after all source code is written so the analysis is complete.
        """
        try:
            files = docker.list_files()
            if not files:
                return "No files in workspace — nothing to analyse."

            # Use grep to find env var references across all source files
            patterns = [
                "os\\.environ",
                "os\\.getenv",
                "process\\.env",
                "ENV\\[",
                "System\\.getenv",
                "os\\.Getenv",
                "viper\\.Get",
                "\\$\\{[A-Z_]+\\}",
            ]
            grep_pattern = "|".join(patterns)
            exit_code, output = docker.exec(
                f"grep -rn -E '{grep_pattern}' /workspace/ "
                f"--include='*.py' --include='*.js' --include='*.ts' "
                f"--include='*.go' --include='*.java' --include='*.rb' "
                f"--include='*.env*' --include='*.yml' --include='*.yaml' "
                f"--include='*.toml' --include='*.cfg' "
                f"2>/dev/null || echo 'NO_MATCHES'"
            )

            # Also check for .env.example or .env.template
            env_exit, env_out = docker.exec(
                "cat /workspace/.env.example 2>/dev/null || "
                "cat /workspace/.env.template 2>/dev/null || "
                "cat /workspace/.env.sample 2>/dev/null || "
                "echo 'NO_ENV_TEMPLATE'"
            )

            result_parts = []
            if output.strip() and output.strip() != "NO_MATCHES":
                result_parts.append(
                    "=== Environment variable references found in source code ===\n"
                    f"{output.strip()}"
                )
            else:
                result_parts.append("No environment variable references found in source code.")

            if env_out.strip() and env_out.strip() != "NO_ENV_TEMPLATE":
                result_parts.append(
                    "\n=== .env template file found ===\n"
                    f"{env_out.strip()}"
                )

            return "\n\n".join(result_parts)

        except Exception as e:
            return f"❌ analyse_env_vars failed: {e}"

    return [
        exec_command,
        write_file,
        read_file,
        list_files,
        check_syntax,
        get_app_logs,
        delete_file,
        emit_run_config,
        analyse_env_vars,
    ]