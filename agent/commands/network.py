import subprocess
import sys
import socket

async def network_diagnostics(params: dict) -> dict:
    action = params.get("action", "")
    target = params.get("target", "")
    port = params.get("port")

    if not action or not target:
        return {"error": "action and target are required"}

    if action == "ping":
        flag = "-n" if sys.platform == "win32" else "-c"
        result = subprocess.run(
            ["ping", flag, "4", target],
            capture_output=True, text=True, timeout=30,
        )
        return {"stdout": result.stdout, "exit_code": result.returncode}

    elif action == "traceroute":
        cmd = "tracert" if sys.platform == "win32" else "traceroute"
        result = subprocess.run(
            [cmd, target],
            capture_output=True, text=True, timeout=60,
        )
        return {"stdout": result.stdout, "exit_code": result.returncode}

    elif action == "nslookup":
        result = subprocess.run(
            ["nslookup", target],
            capture_output=True, text=True, timeout=15,
        )
        return {"stdout": result.stdout, "exit_code": result.returncode}

    elif action == "port_check":
        if not port:
            return {"error": "port is required for port_check"}
        try:
            sock = socket.create_connection((target, port), timeout=5)
            sock.close()
            return {"open": True, "target": target, "port": port}
        except (socket.timeout, ConnectionRefusedError, OSError) as e:
            return {"open": False, "target": target, "port": port, "error": str(e)}

    else:
        return {"error": f"Unknown action: {action}"}
