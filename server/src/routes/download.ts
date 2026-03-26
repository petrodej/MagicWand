import { Router } from 'express';
import path from 'path';
import fs from 'fs';
const router = Router();

const agentDir = path.resolve(process.cwd(), '../agent');

// Serve downloadable .bat installer — user double-clicks this
router.get('/install.bat', (req, res) => {
  const token = req.query.token || 'TOKEN';
  const serverUrl = `${req.protocol}://${req.get('host')}`;

  const bat = `@echo off
title MagicWand Agent Installer
echo.
echo  === MagicWand Agent Installer ===
echo.
powershell -ExecutionPolicy Bypass -Command "irm '${serverUrl}/api/download/install.ps1?token=${token}' | iex"
if errorlevel 1 (
    echo.
    echo Installation failed. Press any key to close.
    pause >nul
)
`;

  res.setHeader('Content-Type', 'application/octet-stream');
  res.setHeader('Content-Disposition', `attachment; filename="MagicWand-Install.bat"`);
  res.send(bat);
});

// Serve the install script
router.get('/install.ps1', (req, res) => {
  const token = req.query.token || 'TOKEN';
  const serverUrl = `${req.protocol}://${req.get('host')}`;

  const script = `
# MagicWand Agent Installer
$ErrorActionPreference = "Stop"
$installDir = "$env:LOCALAPPDATA\\MagicWand"
$pythonDir = "$installDir\\python"
$agentDir = "$installDir\\agent"
$serverUrl = "${serverUrl}"
$token = "${token}"

Write-Host "=== MagicWand Agent Installer ===" -ForegroundColor Magenta
Write-Host ""

# Create install directory
New-Item -ItemType Directory -Force -Path $installDir | Out-Null
New-Item -ItemType Directory -Force -Path $agentDir | Out-Null

# Download embedded Python if not present
if (-not (Test-Path "$pythonDir\\python.exe")) {
    Write-Host "[1/4] Downloading Python..." -ForegroundColor Cyan
    $pythonUrl = "https://www.python.org/ftp/python/3.12.8/python-3.12.8-embed-amd64.zip"
    $zipPath = "$installDir\\python.zip"
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    Invoke-WebRequest -Uri $pythonUrl -OutFile $zipPath -UseBasicParsing
    Expand-Archive -Path $zipPath -DestinationPath $pythonDir -Force
    Remove-Item $zipPath

    # Enable pip in embedded Python
    $pthFile = Get-ChildItem "$pythonDir\\python*._pth" | Select-Object -First 1
    if ($pthFile) {
        (Get-Content $pthFile.FullName) -replace '#import site', 'import site' | Set-Content $pthFile.FullName
    }

    # Install pip
    Write-Host "[2/4] Installing pip..." -ForegroundColor Cyan
    Invoke-WebRequest -Uri "https://bootstrap.pypa.io/get-pip.py" -OutFile "$pythonDir\\get-pip.py" -UseBasicParsing
    & "$pythonDir\\python.exe" "$pythonDir\\get-pip.py" --no-warn-script-location 2>$null
    Remove-Item "$pythonDir\\get-pip.py"
} else {
    Write-Host "[1/4] Python already installed" -ForegroundColor Green
    Write-Host "[2/4] Pip already installed" -ForegroundColor Green
}

# Download agent files from server
Write-Host "[3/4] Downloading agent..." -ForegroundColor Cyan
$agentFiles = @("main.py", "config.py", "connection.py", "security.py", "requirements.txt")
foreach ($file in $agentFiles) {
    Invoke-WebRequest -Uri "$serverUrl/api/download/agent/$file" -OutFile "$agentDir\\$file" -UseBasicParsing
}

# Download commands
New-Item -ItemType Directory -Force -Path "$agentDir\\commands" | Out-Null
$cmdFiles = @("__init__.py", "execute.py", "screenshot.py", "system_info.py", "processes.py", "event_logs.py", "services.py", "software.py", "files.py", "network.py", "input_control.py")
foreach ($file in $cmdFiles) {
    Invoke-WebRequest -Uri "$serverUrl/api/download/agent/commands/$file" -OutFile "$agentDir\\commands\\$file" -UseBasicParsing
}

# Install Python dependencies
Write-Host "[4/4] Installing dependencies..." -ForegroundColor Cyan
& "$pythonDir\\python.exe" -m pip install -r "$agentDir\\requirements.txt" --no-warn-script-location 2>$null

# Enroll
Write-Host ""
Write-Host "Enrolling with server..." -ForegroundColor Yellow
& "$pythonDir\\python.exe" "$agentDir\\main.py" --enroll $token --server $serverUrl

# Create startup shortcut
$startupDir = [Environment]::GetFolderPath("Startup")
$batPath = "$installDir\\start-agent.bat"
$batContent = "@echo off" + [Environment]::NewLine + "cd /d ""$agentDir""" + [Environment]::NewLine + """$pythonDir\\python.exe"" main.py"
Set-Content -Path $batPath -Value $batContent

Copy-Item $batPath "$startupDir\\MagicWand Agent.bat" -Force

Write-Host ""
Write-Host "=== Installation complete! ===" -ForegroundColor Green
Write-Host "Agent will start automatically on login." -ForegroundColor Gray
Write-Host "Starting agent now..." -ForegroundColor Gray
Write-Host ""

# Start agent
Set-Location $agentDir
& "$pythonDir\\python.exe" main.py
`;

  res.setHeader('Content-Type', 'text/plain');
  res.send(script);
});

// Serve agent files
router.get('/agent/{*filePath}', (req, res) => {
  const rawParam = (req.params as Record<string, string | string[]>).filePath;
  const relativePath = Array.isArray(rawParam) ? rawParam.join('/') : (rawParam || '');
  // Prevent path traversal
  const safePath = path.normalize(relativePath).replace(/^(\.\.(\/|\\|$))+/, '');
  const filePath = path.resolve(agentDir, safePath);

  if (!filePath.startsWith(agentDir)) {
    res.status(403).json({ error: 'FORBIDDEN' });
    return;
  }

  if (!fs.existsSync(filePath)) {
    res.status(404).json({ error: 'NOT_FOUND', tried: filePath });
    return;
  }

  res.sendFile(filePath);
});

export default router;
