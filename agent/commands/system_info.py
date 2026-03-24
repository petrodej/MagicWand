import platform
import time
import psutil

async def system_info(params: dict) -> dict:
    uname = platform.uname()
    mem = psutil.virtual_memory()
    disk_partitions = psutil.disk_partitions()

    disks = []
    for part in disk_partitions:
        try:
            usage = psutil.disk_usage(part.mountpoint)
            disks.append({
                "device": part.device,
                "mountpoint": part.mountpoint,
                "fstype": part.fstype,
                "total_gb": round(usage.total / (1024**3), 1),
                "used_gb": round(usage.used / (1024**3), 1),
                "free_gb": round(usage.free / (1024**3), 1),
                "percent": usage.percent,
            })
        except (PermissionError, OSError):
            continue

    nets = []
    for name, addrs in psutil.net_if_addrs().items():
        for addr in addrs:
            if addr.family.name == "AF_INET":
                nets.append({"interface": name, "ip": addr.address, "netmask": addr.netmask})

    return {
        "hostname": platform.node(),
        "os": f"{uname.system} {uname.release}",
        "os_version": uname.version,
        "cpu_model": platform.processor() or "Unknown",
        "cpu_count": psutil.cpu_count(),
        "cpu_percent": psutil.cpu_percent(interval=1),
        "ram_total_mb": round(mem.total / (1024**2)),
        "ram_used_mb": round(mem.used / (1024**2)),
        "ram_percent": mem.percent,
        "disks": disks,
        "network_interfaces": nets,
        "uptime_seconds": int(time.time() - psutil.boot_time()),
    }
