import argparse
import asyncio
import hashlib
import sys
import os
import platform

# Ensure the agent's own directory is on the module path (needed for embedded Python)
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import psutil
import requests

from config import load_config, save_config
from connection import AgentConnection

AGENT_VERSION = "0.2.0"

AGENT_FILES = [
    "main.py", "config.py", "connection.py", "security.py", "requirements.txt",
]
AGENT_CMD_FILES = [
    "__init__.py", "execute.py", "screenshot.py", "system_info.py", "processes.py",
    "event_logs.py", "services.py", "software.py", "files.py", "network.py",
    "input_control.py", "file_manager.py",
]


def compute_file_hashes() -> dict:
    """Compute MD5 hashes of all agent files."""
    agent_dir = os.path.dirname(os.path.abspath(__file__))
    hashes = {}

    for f in AGENT_FILES:
        fpath = os.path.join(agent_dir, f)
        if os.path.exists(fpath):
            with open(fpath, "rb") as fh:
                hashes[f] = hashlib.md5(fh.read()).hexdigest()

    for f in AGENT_CMD_FILES:
        fpath = os.path.join(agent_dir, "commands", f)
        key = f"commands/{f}"
        if os.path.exists(fpath):
            with open(fpath, "rb") as fh:
                hashes[key] = hashlib.md5(fh.read()).hexdigest()

    return hashes


def check_for_updates(server_url: str) -> bool:
    """Check server for updates, download changed files. Returns True if restart needed."""
    agent_dir = os.path.dirname(os.path.abspath(__file__))
    base_url = server_url.rstrip("/")

    hashes = compute_file_hashes()
    try:
        resp = requests.post(f"{base_url}/api/agent/check-update", json={"hashes": hashes}, timeout=15)
        resp.raise_for_status()
    except Exception as e:
        print(f"Update check failed: {e}")
        return False

    data = resp.json()
    updates = data.get("updates", [])
    if not updates:
        print("Agent is up to date.")
        return False

    print(f"Downloading {len(updates)} updated file(s)...")
    for update in updates:
        file_path = update["path"]
        url = update["url"]
        dest = os.path.join(agent_dir, file_path.replace("/", os.sep))

        # Ensure directory exists
        os.makedirs(os.path.dirname(dest), exist_ok=True)

        try:
            dl = requests.get(f"{base_url}{url}", timeout=30)
            dl.raise_for_status()
            with open(dest, "wb") as fh:
                fh.write(dl.content)
            print(f"  Updated: {file_path}")
        except Exception as e:
            print(f"  Failed to download {file_path}: {e}")

    requires_restart = data.get("requiresRestart", False)
    if requires_restart:
        print("Core files changed — restarting agent...")
        os.execv(sys.executable, [sys.executable] + sys.argv)

    return False

def get_system_metadata() -> dict:
    uname = platform.uname()
    mem = psutil.virtual_memory()
    return {
        "hostname": platform.node(),
        "os": f"{uname.system} {uname.release} {uname.version}",
        "cpuModel": platform.processor() or "Unknown",
        "ramTotalMb": round(mem.total / (1024 * 1024)),
        "agentVersion": AGENT_VERSION,
    }

def enroll(token: str, server_url: str) -> None:
    metadata = get_system_metadata()
    metadata["token"] = token

    url = f"{server_url.rstrip('/')}/api/agent/enroll"
    print(f"Enrolling with {url}...")

    try:
        resp = requests.post(url, json=metadata, timeout=15)
        resp.raise_for_status()
    except requests.RequestException as e:
        print(f"Enrollment failed: {e}")
        if hasattr(e, 'response') and e.response is not None:
            print(f"Server response: {e.response.text}")
        sys.exit(1)

    data = resp.json()
    save_config({
        "server_url": server_url,
        "agent_secret": data["agentSecret"],
        "computer_id": data["computerId"],
    })
    print(f"Enrolled successfully! Computer ID: {data['computerId']}")

async def handle_command(command: str, params: dict) -> dict:
    """Dispatch to the appropriate command handler."""
    from commands.execute import execute_command
    from commands.screenshot import screenshot
    from commands.system_info import system_info
    from commands.processes import list_processes
    from commands.event_logs import get_event_logs
    from commands.services import manage_service
    from commands.software import get_installed_software
    from commands.files import read_file, write_file
    from commands.network import network_diagnostics

    handlers = {
        "execute_command": execute_command,
        "screenshot": screenshot,
        "system_info": system_info,
        "list_processes": list_processes,
        "get_event_logs": get_event_logs,
        "manage_service": manage_service,
        "get_installed_software": get_installed_software,
        "read_file": read_file,
        "write_file": write_file,
        "network_diagnostics": network_diagnostics,
    }

    # Import optional commands separately so a failure doesn't break other commands
    try:
        from commands.input_control import input_control
        handlers["input_control"] = input_control
    except Exception:
        pass

    try:
        from commands.file_manager import list_directory, download_file, upload_file, delete_path, create_directory
        handlers["list_directory"] = list_directory
        handlers["download_file"] = download_file
        handlers["upload_file"] = upload_file
        handlers["delete_path"] = delete_path
        handlers["create_directory"] = create_directory
    except Exception:
        pass

    handler = handlers.get(command)
    if not handler:
        return {"error": f"Unknown command: {command}"}

    return await handler(params)

def main():
    parser = argparse.ArgumentParser(description="MagicWand Agent")
    parser.add_argument("--enroll", metavar="TOKEN", help="Enrollment token")
    parser.add_argument("--server", metavar="URL", help="Server URL (required for enrollment)")
    args = parser.parse_args()

    if args.enroll:
        if not args.server:
            print("Error: --server is required for enrollment")
            sys.exit(1)
        enroll(args.enroll, args.server)
        return

    config = load_config()
    if not config:
        print("Error: Not enrolled. Run with --enroll <TOKEN> --server <URL> first.")
        sys.exit(1)

    print(f"MagicWand Agent v{AGENT_VERSION}")
    print(f"Computer ID: {config['computer_id']}")
    print(f"Server: {config['server_url']}")

    # Check for updates before connecting
    check_for_updates(config["server_url"])

    conn = AgentConnection(
        server_url=config["server_url"],
        agent_secret=config["agent_secret"],
        computer_id=config["computer_id"],
        command_handler=handle_command,
    )

    asyncio.run(conn.connect_and_run())

if __name__ == "__main__":
    main()
