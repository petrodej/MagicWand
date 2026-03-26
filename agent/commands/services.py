import json
import subprocess
import sys


async def list_services(params: dict) -> dict:
    if sys.platform != "win32":
        return {"error": "Only supported on Windows"}

    filter_status = params.get("status", "")  # "Running", "Stopped", or "" for all
    search = params.get("search", "").lower()

    cmd = 'Get-Service | Select-Object Name, DisplayName, Status, StartType | ConvertTo-Json'
    result = subprocess.run(
        ["powershell", "-NoProfile", "-NonInteractive", "-Command", cmd],
        capture_output=True, text=True, timeout=30,
    )
    if result.returncode != 0:
        return {"error": result.stderr.strip() or "Failed to list services"}

    try:
        services = json.loads(result.stdout)
        if isinstance(services, dict):
            services = [services]
    except Exception:
        return {"error": "Failed to parse service list"}

    # Map Status enum values to strings
    status_map = {1: "Stopped", 2: "StartPending", 3: "StopPending", 4: "Running"}
    start_map = {0: "Boot", 1: "System", 2: "Automatic", 3: "Manual", 4: "Disabled"}
    for s in services:
        if isinstance(s.get("Status"), int):
            s["Status"] = status_map.get(s["Status"], str(s["Status"]))
        if isinstance(s.get("StartType"), int):
            s["StartType"] = start_map.get(s["StartType"], str(s["StartType"]))

    if filter_status:
        services = [s for s in services if s.get("Status", "").lower() == filter_status.lower()]
    if search:
        services = [s for s in services if search in s.get("Name", "").lower() or search in s.get("DisplayName", "").lower()]

    return {"services": services, "total_count": len(services)}


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
