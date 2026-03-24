import sys
from datetime import datetime, timedelta

async def get_event_logs(params: dict) -> dict:
    if sys.platform != "win32":
        return {"error": "Event logs are only available on Windows"}

    import win32evtlog
    import win32evtlogutil

    log_name = params.get("log_name", "System")
    level = params.get("level")
    last_n = min(params.get("last_n", 20), 100)
    hours_back = params.get("hours_back")

    level_map = {
        "Error": 2,
        "Warning": 3,
        "Information": 4,
        "Critical": 1,
    }

    cutoff = None
    if hours_back:
        cutoff = datetime.now() - timedelta(hours=hours_back)

    try:
        hand = win32evtlog.OpenEventLog(None, log_name)
        flags = win32evtlog.EVENTLOG_BACKWARDS_READ | win32evtlog.EVENTLOG_SEQUENTIAL_READ

        entries = []
        while len(entries) < last_n:
            events = win32evtlog.ReadEventLog(hand, flags, 0)
            if not events:
                break

            for event in events:
                if len(entries) >= last_n:
                    break

                event_time = datetime(
                    event.TimeGenerated.year, event.TimeGenerated.month,
                    event.TimeGenerated.day, event.TimeGenerated.hour,
                    event.TimeGenerated.minute, event.TimeGenerated.second,
                )

                if cutoff and event_time < cutoff:
                    break

                if level and level_map.get(level) and event.EventType != level_map[level]:
                    continue

                entries.append({
                    "time": event_time.isoformat(),
                    "source": event.SourceName,
                    "event_id": event.EventID & 0xFFFF,
                    "level": {1: "Critical", 2: "Error", 3: "Warning", 4: "Information"}.get(event.EventType, "Unknown"),
                    "message": win32evtlogutil.SafeFormatMessage(event, log_name)[:2000],
                })

        win32evtlog.CloseEventLog(hand)
        return {"log_name": log_name, "entries": entries}

    except Exception as e:
        return {"error": str(e)}
