import subprocess
import sys
from security import is_dangerous_command, truncate_output

async def execute_command(params: dict) -> dict:
    command = params.get("command", "")
    shell = params.get("shell", "powershell")
    timeout = min(params.get("timeout", 30), 120)

    danger = is_dangerous_command(command)
    if danger:
        return {"stdout": "", "stderr": danger, "exit_code": -1}

    if shell == "powershell":
        cmd = ["powershell", "-NoProfile", "-NonInteractive", "-Command", command]
    elif shell == "cmd":
        cmd = ["cmd", "/c", command]
    else:
        cmd = ["bash", "-c", command]

    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=timeout,
            cwd="C:\\" if sys.platform == "win32" else "/",
        )
        return {
            "stdout": truncate_output(result.stdout),
            "stderr": truncate_output(result.stderr),
            "exit_code": result.returncode,
        }
    except subprocess.TimeoutExpired:
        return {
            "stdout": "",
            "stderr": f"Command timed out after {timeout} seconds",
            "exit_code": -1,
        }
    except Exception as e:
        return {
            "stdout": "",
            "stderr": str(e),
            "exit_code": -1,
        }
