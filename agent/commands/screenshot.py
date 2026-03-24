import base64
import io
import mss
from PIL import Image

async def screenshot(params: dict) -> dict:
    monitor_index = params.get("monitor", 0)

    with mss.mss() as sct:
        monitors = sct.monitors
        if monitor_index >= len(monitors):
            monitor_index = 0

        monitor = monitors[monitor_index]
        img = sct.grab(monitor)

        pil_img = Image.frombytes("RGB", img.size, img.bgra, "raw", "BGRX")

        max_width = 1920
        if pil_img.width > max_width:
            ratio = max_width / pil_img.width
            new_size = (max_width, int(pil_img.height * ratio))
            pil_img = pil_img.resize(new_size, Image.LANCZOS)

        buf = io.BytesIO()
        pil_img.save(buf, format="JPEG", quality=75)
        b64 = base64.b64encode(buf.getvalue()).decode("ascii")

        return {
            "image_base64": b64,
            "width": pil_img.width,
            "height": pil_img.height,
            "format": "jpeg",
        }
