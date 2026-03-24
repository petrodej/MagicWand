import subprocess
import sys

async def manage_service(params: dict) -> dict:
    service_name = params.get("service_name", "")
    action = params.get("action", "status")

    if not service_name:
        return {"error": "service_name is required"}

    if sys.platform == "win32":
        if action == "status":
            cmd = f'Get-Service -Name "{service_name}" | Select-Object Name, Status, DisplayName | ConvertTo-Json'
        elif action == "start":
            cmd = f'Start-Service -Name "{service_name}"; Get-Service -Name "{service_name}" | Select-Object Name, Status | ConvertTo-Json'
        elif action == "stop":
            cmd = f'Stop-Service -Name "{service_name}" -Force; Get-Service -Name "{service_name}" | Select-Object Name, Status | ConvertTo-Json'
        elif action == "restart":
            cmd = f'Restart-Service -Name "{service_name}" -Force; Get-Service -Name "{service_name}" | Select-Object Name, Status | ConvertTo-Json'
        else:
            return {"error": f"Unknown action: {action}"}

        result = subprocess.run(
            ["powershell", "-NoProfile", "-NonInteractive", "-Command", cmd],
            capture_output=True, text=True, timeout=30,
        )
        return {"stdout": result.stdout.strip(), "stderr": result.stderr.strip(), "exit_code": result.returncode}
    else:
        return {"error": "Service management currently only supports Windows"}
