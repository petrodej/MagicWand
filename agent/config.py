import json
import os
import sys

def get_config_dir() -> str:
    if sys.platform == "win32":
        base = os.environ.get("APPDATA", os.path.expanduser("~"))
    else:
        base = os.path.expanduser("~")
    return os.path.join(base, "Pulse")

def get_config_path() -> str:
    return os.path.join(get_config_dir(), "config.json")

def load_config() -> dict | None:
    path = get_config_path()
    if not os.path.exists(path):
        return None
    with open(path, "r") as f:
        return json.load(f)

def save_config(data: dict) -> None:
    config_dir = get_config_dir()
    os.makedirs(config_dir, exist_ok=True)
    path = get_config_path()
    with open(path, "w") as f:
        json.dump(data, f, indent=2)
    print(f"Config saved to {path}")
