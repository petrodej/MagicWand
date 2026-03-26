import os
import stat
import base64
from datetime import datetime
from security import is_blocked_write_path


async def list_directory(params: dict) -> dict:
    """List contents of a directory."""
    path = params.get("path", "C:\\")

    try:
        entries = []
        for name in os.listdir(path):
            full_path = os.path.join(path, name)
            try:
                st = os.stat(full_path)
                entries.append({
                    "name": name,
                    "path": full_path,
                    "isDir": stat.S_ISDIR(st.st_mode),
                    "size": st.st_size if not stat.S_ISDIR(st.st_mode) else 0,
                    "modified": datetime.fromtimestamp(st.st_mtime).isoformat(),
                })
            except (PermissionError, OSError):
                entries.append({
                    "name": name,
                    "path": full_path,
                    "isDir": False,
                    "size": 0,
                    "modified": "",
                    "error": "access denied",
                })

        # Sort: directories first, then alphabetical
        entries.sort(key=lambda e: (not e["isDir"], e["name"].lower()))

        return {
            "path": path,
            "entries": entries,
            "parent": os.path.dirname(path) if path != os.path.splitdrive(path)[0] + "\\" else None,
        }
    except FileNotFoundError:
        return {"error": f"Directory not found: {path}"}
    except PermissionError:
        return {"error": f"Permission denied: {path}"}
    except Exception as e:
        return {"error": str(e)}


async def download_file(params: dict) -> dict:
    """Read a file and return as base64 for download."""
    path = params.get("path", "")
    if not path:
        return {"error": "path is required"}

    try:
        size = os.path.getsize(path)
        max_size = 50 * 1024 * 1024  # 50MB limit
        if size > max_size:
            return {"error": f"File too large ({size // (1024*1024)}MB). Max is 50MB."}

        with open(path, "rb") as f:
            data = base64.b64encode(f.read()).decode("ascii")

        return {
            "path": path,
            "name": os.path.basename(path),
            "size": size,
            "data_base64": data,
        }
    except FileNotFoundError:
        return {"error": f"File not found: {path}"}
    except PermissionError:
        return {"error": f"Permission denied: {path}"}
    except Exception as e:
        return {"error": str(e)}


async def upload_file(params: dict) -> dict:
    """Write a base64-encoded file to disk."""
    path = params.get("path", "")
    data_base64 = params.get("data_base64", "")
    if not path or not data_base64:
        return {"error": "path and data_base64 are required"}

    blocked = is_blocked_write_path(path)
    if blocked:
        return {"error": blocked}

    try:
        data = base64.b64decode(data_base64)
        with open(path, "wb") as f:
            f.write(data)
        return {"success": True, "path": path, "size": len(data)}
    except PermissionError:
        return {"error": f"Permission denied: {path}"}
    except Exception as e:
        return {"error": str(e)}


async def delete_path(params: dict) -> dict:
    """Delete a file or empty directory."""
    path = params.get("path", "")
    if not path:
        return {"error": "path is required"}

    blocked = is_blocked_write_path(path)
    if blocked:
        return {"error": blocked}

    try:
        if os.path.isdir(path):
            os.rmdir(path)  # Only empty directories
        else:
            os.remove(path)
        return {"success": True, "path": path}
    except PermissionError:
        return {"error": f"Permission denied: {path}"}
    except OSError as e:
        return {"error": str(e)}


async def create_directory(params: dict) -> dict:
    """Create a new directory."""
    path = params.get("path", "")
    if not path:
        return {"error": "path is required"}

    blocked = is_blocked_write_path(path)
    if blocked:
        return {"error": blocked}

    try:
        os.makedirs(path, exist_ok=True)
        return {"success": True, "path": path}
    except PermissionError:
        return {"error": f"Permission denied: {path}"}
    except Exception as e:
        return {"error": str(e)}
