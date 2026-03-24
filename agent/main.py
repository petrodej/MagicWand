import argparse
import asyncio
import sys
import platform
import psutil
import requests

from config import load_config, save_config
from connection import AgentConnection

AGENT_VERSION = "0.1.0"

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
    """Dispatch to the appropriate command handler. Implemented in Task 14+."""
    # Placeholder — will import from commands/ modules later
    return {"error": f"Command '{command}' not yet implemented"}

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

    conn = AgentConnection(
        server_url=config["server_url"],
        agent_secret=config["agent_secret"],
        computer_id=config["computer_id"],
        command_handler=handle_command,
    )

    asyncio.run(conn.connect_and_run())

if __name__ == "__main__":
    main()
