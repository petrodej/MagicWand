import ctypes
import time
import mss

# Windows input constants
INPUT_MOUSE = 0
INPUT_KEYBOARD = 1
MOUSEEVENTF_MOVE = 0x0001
MOUSEEVENTF_LEFTDOWN = 0x0002
MOUSEEVENTF_LEFTUP = 0x0004
MOUSEEVENTF_RIGHTDOWN = 0x0008
MOUSEEVENTF_RIGHTUP = 0x0010
MOUSEEVENTF_WHEEL = 0x0800
MOUSEEVENTF_ABSOLUTE = 0x8000
KEYEVENTF_KEYUP = 0x0002
WHEEL_DELTA = 120


class MOUSEINPUT(ctypes.Structure):
    _fields_ = [("dx", ctypes.c_long), ("dy", ctypes.c_long),
                ("mouseData", ctypes.c_ulong), ("dwFlags", ctypes.c_ulong),
                ("time", ctypes.c_ulong), ("dwExtraInfo", ctypes.POINTER(ctypes.c_ulong))]

class KEYBDINPUT(ctypes.Structure):
    _fields_ = [("wVk", ctypes.c_ushort), ("wScan", ctypes.c_ushort),
                ("dwFlags", ctypes.c_ulong), ("time", ctypes.c_ulong),
                ("dwExtraInfo", ctypes.POINTER(ctypes.c_ulong))]

class INPUT_UNION(ctypes.Union):
    _fields_ = [("mi", MOUSEINPUT), ("ki", KEYBDINPUT)]

class INPUT(ctypes.Structure):
    _fields_ = [("type", ctypes.c_ulong), ("union", INPUT_UNION)]


# Virtual key code mapping
VK_MAP = {
    'enter': 0x0D, 'backspace': 0x08, 'tab': 0x09, 'escape': 0x1B,
    'space': 0x20, 'delete': 0x2E, 'up': 0x26, 'down': 0x28,
    'left': 0x25, 'right': 0x27, 'home': 0x24, 'end': 0x23,
    'pageup': 0x21, 'pagedown': 0x22, 'insert': 0x2D,
    'ctrl': 0x11, 'alt': 0x12, 'shift': 0x10, 'win': 0x5B,
    'f1': 0x70, 'f2': 0x71, 'f3': 0x72, 'f4': 0x73, 'f5': 0x74,
    'f6': 0x75, 'f7': 0x76, 'f8': 0x77, 'f9': 0x78, 'f10': 0x79,
    'f11': 0x7A, 'f12': 0x7B, 'capslock': 0x14, 'numlock': 0x90,
    'printscreen': 0x2C, 'scrolllock': 0x91, 'pause': 0x13,
}


def _send_input(*inputs):
    """Send input events via Windows SendInput API."""
    n = len(inputs)
    arr = (INPUT * n)(*inputs)
    ctypes.windll.user32.SendInput(n, arr, ctypes.sizeof(INPUT))


def _get_screen_size():
    """Get actual screen resolution for coordinate scaling."""
    with mss.mss() as sct:
        monitor = sct.monitors[0]
        return monitor["width"], monitor["height"]


def _scale_coords(x: float, y: float, canvas_width: float, canvas_height: float) -> tuple:
    """Scale coordinates from canvas space to actual screen space."""
    screen_w, screen_h = _get_screen_size()
    actual_x = int(x * (screen_w / canvas_width))
    actual_y = int(y * (screen_h / canvas_height))
    return actual_x, actual_y


def _move_mouse(x: int, y: int):
    """Move mouse to absolute screen position."""
    # Convert to normalized 0-65535 range for MOUSEEVENTF_ABSOLUTE
    screen_w = ctypes.windll.user32.GetSystemMetrics(0)
    screen_h = ctypes.windll.user32.GetSystemMetrics(1)
    nx = int(x * 65535 / screen_w)
    ny = int(y * 65535 / screen_h)

    inp = INPUT()
    inp.type = INPUT_MOUSE
    inp.union.mi.dx = nx
    inp.union.mi.dy = ny
    inp.union.mi.dwFlags = MOUSEEVENTF_MOVE | MOUSEEVENTF_ABSOLUTE
    _send_input(inp)


def _mouse_click(x: int, y: int, button: str = "left"):
    """Click at position."""
    _move_mouse(x, y)
    time.sleep(0.01)

    down_flag = MOUSEEVENTF_LEFTDOWN if button == "left" else MOUSEEVENTF_RIGHTDOWN
    up_flag = MOUSEEVENTF_LEFTUP if button == "left" else MOUSEEVENTF_RIGHTUP

    inp_down = INPUT()
    inp_down.type = INPUT_MOUSE
    inp_down.union.mi.dwFlags = down_flag

    inp_up = INPUT()
    inp_up.type = INPUT_MOUSE
    inp_up.union.mi.dwFlags = up_flag

    _send_input(inp_down, inp_up)


def _get_vk(key: str) -> int:
    """Get virtual key code for a key string."""
    key = key.lower()
    if key in VK_MAP:
        return VK_MAP[key]
    if len(key) == 1:
        # For single characters, use VkKeyScan
        result = ctypes.windll.user32.VkKeyScanW(ord(key))
        if result != -1:
            return result & 0xFF
    return 0


def _key_down(vk: int):
    inp = INPUT()
    inp.type = INPUT_KEYBOARD
    inp.union.ki.wVk = vk
    _send_input(inp)


def _key_up(vk: int):
    inp = INPUT()
    inp.type = INPUT_KEYBOARD
    inp.union.ki.wVk = vk
    inp.union.ki.dwFlags = KEYEVENTF_KEYUP
    _send_input(inp)


async def input_control(params: dict) -> dict:
    """Handle mouse and keyboard input events."""
    action = params.get("action")
    canvas_width = params.get("canvas_width", 1280)
    canvas_height = params.get("canvas_height", 720)

    try:
        if action == "mouse_move":
            x, y = _scale_coords(params["x"], params["y"], canvas_width, canvas_height)
            _move_mouse(x, y)

        elif action == "mouse_click":
            x, y = _scale_coords(params["x"], params["y"], canvas_width, canvas_height)
            button = params.get("button", "left")
            _mouse_click(x, y, button)

        elif action == "mouse_double_click":
            x, y = _scale_coords(params["x"], params["y"], canvas_width, canvas_height)
            _mouse_click(x, y)
            time.sleep(0.05)
            _mouse_click(x, y)

        elif action == "mouse_scroll":
            x, y = _scale_coords(params["x"], params["y"], canvas_width, canvas_height)
            _move_mouse(x, y)
            delta = params.get("delta", 0)
            inp = INPUT()
            inp.type = INPUT_MOUSE
            inp.union.mi.dwFlags = MOUSEEVENTF_WHEEL
            inp.union.mi.mouseData = delta * WHEEL_DELTA
            _send_input(inp)

        elif action == "key_press":
            key = params.get("key", "")
            vk = _get_vk(key)
            if vk:
                _key_down(vk)
                time.sleep(0.02)
                _key_up(vk)

        elif action == "key_combo":
            keys = params.get("keys", [])
            vks = [_get_vk(k) for k in keys]
            # Press all modifier keys down, then the last key, then release in reverse
            for vk in vks:
                if vk:
                    _key_down(vk)
                    time.sleep(0.02)
            for vk in reversed(vks):
                if vk:
                    _key_up(vk)
                    time.sleep(0.02)

        elif action == "key_type":
            text = params.get("text", "")
            for char in text:
                vk = _get_vk(char)
                if vk:
                    _key_down(vk)
                    time.sleep(0.02)
                    _key_up(vk)
                    time.sleep(0.02)

        else:
            return {"success": False, "error": f"Unknown action: {action}"}

        return {"success": True}

    except Exception as e:
        return {"success": False, "error": str(e)}
