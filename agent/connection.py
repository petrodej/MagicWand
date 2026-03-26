import asyncio
import json
import time
import websockets
from websockets.asyncio.client import connect

class AgentConnection:
    def __init__(self, server_url: str, agent_secret: str, computer_id: str, command_handler=None, update_checker=None):
        self.server_url = server_url.rstrip("/")
        self.agent_secret = agent_secret
        self.computer_id = computer_id
        self.command_handler = command_handler
        self.update_checker = update_checker  # callable(server_url) -> bool
        self.ws = None
        self._backoff = 1
        self._max_backoff = 60
        self._running = True

    async def connect_and_run(self):
        while self._running:
            try:
                ws_url = self.server_url.replace("http://", "ws://").replace("https://", "wss://")
                ws_url = f"{ws_url}/ws/agent"
                print(f"Connecting to {ws_url}...")

                async with connect(ws_url) as ws:
                    self.ws = ws
                    self._backoff = 1
                    print("Connected!")

                    # Authenticate
                    await ws.send(json.dumps({
                        "type": "auth",
                        "agentSecret": self.agent_secret,
                        "computerId": self.computer_id,
                    }))

                    # Start heartbeat and update check tasks
                    heartbeat_task = asyncio.create_task(self._heartbeat_loop())
                    update_task = asyncio.create_task(self._update_check_loop())

                    try:
                        async for message in ws:
                            data = json.loads(message)
                            if data.get("type") == "command" and self.command_handler:
                                asyncio.create_task(self._handle_command(data))
                    finally:
                        heartbeat_task.cancel()
                        update_task.cancel()

            except Exception as e:
                print(f"Connection lost: {e}. Reconnecting in {self._backoff}s...")
                await asyncio.sleep(self._backoff)
                self._backoff = min(self._backoff * 2, self._max_backoff)

    async def _heartbeat_loop(self):
        import psutil
        while True:
            try:
                await self.ws.send(json.dumps({
                    "type": "heartbeat",
                    "cpu_percent": psutil.cpu_percent(interval=1),
                    "ram_percent": psutil.virtual_memory().percent,
                    "uptime_seconds": int(time.time() - psutil.boot_time()),
                }))
            except Exception:
                return
            await asyncio.sleep(30)

    async def _update_check_loop(self):
        """Check for updates every 5 minutes."""
        while True:
            await asyncio.sleep(300)  # 5 minutes
            try:
                if self.update_checker:
                    # Run in executor since it uses blocking requests
                    loop = asyncio.get_event_loop()
                    await loop.run_in_executor(None, self.update_checker, self.server_url)
            except Exception:
                pass

    async def _handle_command(self, data: dict):
        request_id = data.get("id")
        command = data.get("command")
        params = data.get("params", {})

        try:
            result = await self.command_handler(command, params)
            await self.ws.send(json.dumps({
                "id": request_id,
                "type": "command_result",
                "success": True,
                "data": result,
            }))
        except Exception as e:
            await self.ws.send(json.dumps({
                "id": request_id,
                "type": "command_result",
                "success": False,
                "error": str(e),
            }))

    def stop(self):
        self._running = False
