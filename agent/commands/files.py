from security import is_blocked_write_path, MAX_WRITE_SIZE

async def read_file(params: dict) -> dict:
    path = params.get("path", "")
    max_lines = params.get("max_lines", 200)

    if not path:
        return {"error": "path is required"}

    try:
        with open(path, "r", encoding="utf-8", errors="replace") as f:
            lines = []
            for i, line in enumerate(f):
                if i >= max_lines:
                    lines.append(f"\n[TRUNCATED — showing first {max_lines} lines]")
                    break
                lines.append(line)
        return {"content": "".join(lines), "path": path}
    except FileNotFoundError:
        return {"error": f"File not found: {path}"}
    except PermissionError:
        return {"error": f"Permission denied: {path}"}
    except Exception as e:
        return {"error": str(e)}

async def write_file(params: dict) -> dict:
    path = params.get("path", "")
    content = params.get("content", "")

    if not path:
        return {"error": "path is required"}

    blocked = is_blocked_write_path(path)
    if blocked:
        return {"error": blocked}

    if len(content.encode("utf-8")) > MAX_WRITE_SIZE:
        return {"error": f"Content exceeds maximum size of {MAX_WRITE_SIZE // 1024}KB"}

    try:
        with open(path, "w", encoding="utf-8") as f:
            f.write(content)
        return {"success": True, "path": path, "bytes_written": len(content.encode("utf-8"))}
    except PermissionError:
        return {"error": f"Permission denied: {path}"}
    except Exception as e:
        return {"error": str(e)}
