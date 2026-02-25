"""
tools/deploy_tools.py

Tools given to Deployer agent.
Agent dynamically handles GitHub push failures, deploy errors, retries.
No hardcoded sequences — agent reasons about each error and recovers.
"""
import time
import requests
from langchain_core.tools import tool
from app.core.config import settings
from app.core.docker_manager import DockerManager


def get_deploy_tools(docker: DockerManager, github_token: str, render_api_key: str = "", railway_api_key: str = ""):
    """
    Returns deployment tools bound to this build's credentials.
    Credentials come from user's decrypted account credentials (zero-knowledge).
    """

    GH_HEADERS = {
        "Authorization": f"token {github_token}",
        "Accept":        "application/vnd.github.v3+json",
    }

    @tool
    def create_github_repo(repo_name: str, description: str = "", private: bool = True) -> str:
        """
        Create a new GitHub repository for this project.
        Call this before pushing code.
        repo_name: name for the repository e.g. "my-todo-api"
        private: whether to make it private (default True)
        Returns the clone URL and HTML URL on success.
        """
        try:
            resp = requests.post(
                "https://api.github.com/user/repos",
                headers = GH_HEADERS,
                json    = {
                    "name":        repo_name,
                    "description": description,
                    "private":     private,
                    "auto_init":   False,   # we push our own code
                },
                timeout = 15,
            )
            if resp.status_code == 422:
                # Repo already exists — get it instead
                user_resp = requests.get("https://api.github.com/user", headers=GH_HEADERS)
                username  = user_resp.json().get("login", "unknown")
                get_resp  = requests.get(f"https://api.github.com/repos/{username}/{repo_name}", headers=GH_HEADERS)
                if get_resp.status_code == 200:
                    repo = get_resp.json()
                    return f"✅ Repo already exists: clone_url={repo['clone_url']} html_url={repo['html_url']}"
            resp.raise_for_status()
            repo = resp.json()
            return f"✅ Repo created: clone_url={repo['clone_url']} html_url={repo['html_url']}"
        except Exception as e:
            return f"❌ Failed to create repo: {e}"

    @tool
    def push_to_github(clone_url: str, commit_message: str = "AI build") -> str:
        """
        Push all workspace files to a GitHub repository.
        clone_url: the clone URL returned by create_github_repo
        commit_message: git commit message
        Handles common errors like branch protection, auth issues.
        Returns success or detailed error message.
        """
        # Inject token into clone URL for auth
        token_url = clone_url.replace("https://", f"https://{github_token}@")

        commands = [
            ("git init",                                                "Initializing git"),
            ("git config user.email 'bot@aibuild.com'",                "Configuring git email"),
            ("git config user.name 'AI Build Bot'",                    "Configuring git user"),
            (f"git remote add origin {token_url}",                     "Adding remote origin"),
            ("git add -A",                                              "Staging all files"),
            (f"git commit -m '{commit_message}'",                      "Creating commit"),
            ("git branch -M main",                                      "Setting main branch"),
            ("git push -u origin main --force",                        "Pushing to GitHub"),
        ]

        for cmd, description in commands:
            # Don't log the token URL
            safe_cmd = cmd.replace(github_token, "***") if github_token in cmd else cmd
            exit_code, output = docker.exec(cmd)
            if exit_code != 0 and "nothing to commit" not in output and "already exists" not in output:
                return f"❌ Failed at '{description}':\n{output}\nTry a different approach."
        return f"✅ Successfully pushed to {clone_url.split('@')[-1] if '@' in clone_url else clone_url}"

    @tool
    def deploy_to_render(
        repo_url:        str,
        service_name:    str,
        build_command:   str,
        start_command:   str,
        env_vars:        str = "{}",
    ) -> str:
        """
        Deploy the GitHub repo to Render as a web service.
        repo_url: GitHub HTML URL e.g. "https://github.com/user/my-api"
        service_name: name for the Render service
        build_command: e.g. "pip install -r requirements.txt"
        start_command: e.g. "uvicorn main:app --host 0.0.0.0 --port $PORT"
        env_vars: JSON string of environment variables e.g. '{"DATABASE_URL": "...", "SECRET_KEY": "..."}'
        Returns service URL and service ID for status checking.
        """
        if not render_api_key:
            return "❌ Render API key not configured. Check account credentials."
        try:
            import json
            vars_dict = json.loads(env_vars) if env_vars else {}
            headers   = {"Authorization": f"Bearer {render_api_key}", "Content-Type": "application/json"}
            payload   = {
                "type":         "web_service",
                "name":         service_name,
                "repo":         repo_url,
                "branch":       "main",
                "buildCommand": build_command,
                "startCommand": start_command,
                "envVars":      [{"key": k, "value": v} for k, v in vars_dict.items()],
                "plan":         "free",
            }
            resp = requests.post("https://api.render.com/v1/services", headers=headers, json=payload, timeout=30)
            if resp.status_code == 409:
                return f"⚠️ Service name '{service_name}' already exists on Render. Try a different name."
            resp.raise_for_status()
            svc = resp.json()
            return (
                f"✅ Deployment started on Render\n"
                f"service_id={svc['service']['id']}\n"
                f"url=https://{svc['service']['serviceDetails']['url']}\n"
                f"status=deploying"
            )
        except Exception as e:
            return f"❌ Render deployment failed: {e}"

    @tool
    def deploy_to_railway(
        repo_url:     str,
        project_name: str,
        env_vars:     str = "{}",
    ) -> str:
        """
        Deploy the GitHub repo to Railway.
        repo_url: GitHub HTML URL
        project_name: name for the Railway project
        env_vars: JSON string of environment variables
        Returns project URL.
        """
        if not railway_api_key:
            return "❌ Railway API key not configured. Check account credentials."
        try:
            import json
            headers = {"Authorization": f"Bearer {railway_api_key}", "Content-Type": "application/json"}
            mutation = """
            mutation($name: String!) {
              projectCreate(input: { name: $name }) { id name }
            }
            """
            resp = requests.post(
                "https://backboard.railway.app/graphql/v2",
                headers = headers,
                json    = {"query": mutation, "variables": {"name": project_name}},
                timeout = 30,
            )
            resp.raise_for_status()
            data       = resp.json()
            project_id = data["data"]["projectCreate"]["id"]
            return (
                f"✅ Railway project created\n"
                f"project_id={project_id}\n"
                f"url=https://{project_name}.up.railway.app\n"
                f"status=deploying"
            )
        except Exception as e:
            return f"❌ Railway deployment failed: {e}"

    @tool
    def check_deploy_status(provider: str, service_id: str) -> str:
        """
        Check the current deployment status.
        provider: "render" or "railway"
        service_id: the service/project ID returned by deploy function
        Returns: "live", "deploying", "failed", or error message
        """
        try:
            if provider == "render":
                headers = {"Authorization": f"Bearer {render_api_key}"}
                resp    = requests.get(f"https://api.render.com/v1/services/{service_id}", headers=headers, timeout=10)
                resp.raise_for_status()
                status = resp.json()["service"]["serviceDetails"]["status"]
                return f"Render status: {status}"
            return f"⚠️ Unknown provider: {provider}"
        except Exception as e:
            return f"❌ Status check failed: {e}"

    @tool
    def wait_for_deploy(provider: str, service_id: str, timeout_minutes: int = 10) -> str:
        """
        Poll deployment status until it goes live or fails.
        provider: "render" or "railway"
        service_id: from deploy function
        timeout_minutes: max minutes to wait (default 10)
        """
        deadline = time.time() + (timeout_minutes * 60)
        while time.time() < deadline:
            status = check_deploy_status.invoke({"provider": provider, "service_id": service_id})
            if "live" in status.lower():
                return f"✅ Deployment is LIVE! {status}"
            if "failed" in status.lower():
                return f"❌ Deployment FAILED: {status}"
            time.sleep(30)
        return f"⚠️ Deployment timed out after {timeout_minutes} minutes. Last status: {status}"

    return [
        create_github_repo,
        push_to_github,
        deploy_to_render,
        deploy_to_railway,
        check_deploy_status,
        wait_for_deploy,
    ]