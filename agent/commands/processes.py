import psutil

async def list_processes(params: dict) -> dict:
    sort_by = params.get("sort_by", "memory")
    top_n = min(params.get("top_n", 30), 100)

    procs = []
    for p in psutil.process_iter(["pid", "name", "cpu_percent", "memory_percent"]):
        try:
            info = p.info
            procs.append({
                "pid": info["pid"],
                "name": info["name"],
                "cpu_percent": round(info["cpu_percent"] or 0, 1),
                "memory_percent": round(info["memory_percent"] or 0, 1),
            })
        except (psutil.NoSuchProcess, psutil.AccessDenied):
            continue

    key = "memory_percent" if sort_by == "memory" else "cpu_percent" if sort_by == "cpu" else "name"
    reverse = key != "name"
    procs.sort(key=lambda p: p.get(key, 0), reverse=reverse)

    return {"processes": procs[:top_n], "total_count": len(procs)}


async def kill_process(params: dict) -> dict:
    pid = params.get("pid")
    if not pid:
        return {"error": "pid is required"}

    try:
        p = psutil.Process(pid)
        name = p.name()
        p.kill()
        return {"success": True, "message": f"Killed process {name} (PID {pid})"}
    except psutil.NoSuchProcess:
        return {"error": f"Process {pid} not found"}
    except psutil.AccessDenied:
        return {"error": f"Access denied killing process {pid}"}
    except Exception as e:
        return {"error": str(e)}
