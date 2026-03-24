import re
import os

# Patterns that indicate dangerous commands
DANGEROUS_PATTERNS = [
    r'\bformat\b.*[a-zA-Z]:',
    r'\bdiskpart\b',
    r'\bdel\b.*/s.*/q.*[a-zA-Z]:\\',
    r'\brmdir\b.*/s.*[a-zA-Z]:\\',
    r'Remove-Item.*-Recurse.*[a-zA-Z]:\\',
    r'\brm\b\s+-rf\s+/',
    r'\bshutdown\b',
    r'\bRestart-Computer\b',
    r'\bStop-Computer\b',
    r'\breg\b\s+delete\s+HKLM',
    r'Remove-ItemProperty.*HKLM',
    r'Set-ExecutionPolicy\s+Unrestricted',
    r'Set-MpPreference\s+-DisableRealtimeMonitoring',
    r'netsh\s+advfirewall\s+set\s+.*state\s+off',
]

COMPILED_PATTERNS = [re.compile(p, re.IGNORECASE) for p in DANGEROUS_PATTERNS]

BLOCKED_WRITE_PATHS = [
    r'C:\\Windows\\',
    r'C:\\Program Files\\',
    r'C:\\Program Files \(x86\)\\',
    r'C:\\Boot\\',
    r'C:\\Recovery\\',
    r'C:\\System Volume Information\\',
]

COMPILED_WRITE_BLOCKS = [re.compile(p, re.IGNORECASE) for p in BLOCKED_WRITE_PATHS]

MAX_WRITE_SIZE = 100 * 1024  # 100KB
MAX_OUTPUT_SIZE = 50 * 1024  # 50KB

def is_dangerous_command(command: str) -> str | None:
    for pattern in COMPILED_PATTERNS:
        if pattern.search(command):
            return f"Command blocked by safety filter: matches pattern '{pattern.pattern}'"
    return None

def is_blocked_write_path(path: str) -> str | None:
    try:
        canonical = os.path.realpath(os.path.abspath(path))
    except (ValueError, OSError):
        return f"Invalid path: {path}"
    for pattern in COMPILED_WRITE_BLOCKS:
        if pattern.match(canonical):
            return f"Write blocked: path '{canonical}' is in a protected directory"
    return None

def truncate_output(output: str) -> str:
    if len(output.encode('utf-8', errors='replace')) > MAX_OUTPUT_SIZE:
        truncated = output.encode('utf-8', errors='replace')[:MAX_OUTPUT_SIZE].decode('utf-8', errors='replace')
        return truncated + "\n\n[OUTPUT TRUNCATED — exceeded 50KB limit]"
    return output
