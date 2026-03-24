import subprocess
import sys

async def get_installed_software(params: dict) -> dict:
    name_filter = params.get("filter", "")

    if sys.platform != "win32":
        return {"error": "Only available on Windows"}

    cmd = 'Get-ItemProperty HKLM:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*, HKLM:\\Software\\Wow6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\* | Where-Object { $_.DisplayName } | Select-Object DisplayName, DisplayVersion, Publisher, InstallDate | Sort-Object DisplayName | ConvertTo-Json -Compress'

    if name_filter:
        cmd = f'Get-ItemProperty HKLM:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*, HKLM:\\Software\\Wow6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\* | Where-Object {{ $_.DisplayName -like "*{name_filter}*" }} | Select-Object DisplayName, DisplayVersion, Publisher, InstallDate | Sort-Object DisplayName | ConvertTo-Json -Compress'

    result = subprocess.run(
        ["powershell", "-NoProfile", "-NonInteractive", "-Command", cmd],
        capture_output=True, text=True, timeout=30,
    )

    from security import truncate_output
    return {"stdout": truncate_output(result.stdout.strip()), "exit_code": result.returncode}
