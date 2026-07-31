param(
    [switch]$Update,
    [switch]$SkipVerify,
    [string]$Version = "ae56d74"
)

$ErrorActionPreference = "Stop"
$InstallDir = "$env:LOCALAPPDATA\pgautopilot"
$BinDir = "$InstallDir\bin"
$Repo = "https://github.com/cyberreinxy/pgautopilot.git"
$BundleFile = "dist\pgautopilot.bundle.cjs"
$Launcher = "$BinDir\pgautopilot.cmd"

Write-Host "PGAutoPilot — Local Install (no npm)" -ForegroundColor Cyan
Write-Host ""

$nodeCmd = (Get-Command node -ErrorAction SilentlyContinue)?.Source
if (-not $nodeCmd) {
    $nodeCmd = (Get-Command node.exe -ErrorAction SilentlyContinue)?.Source
}
if (-not $nodeCmd) {
    Write-Host "Node.js is not installed." -ForegroundColor Red
    Write-Host "Install it from https://nodejs.org (v18+) and try again."
    exit 1
}

$nodeVer = & node -v
$major = [int]($nodeVer -replace 'v','' -replace '\..*','')
if ($major -lt 18) {
    Write-Host "Node.js 18+ required. You have $nodeVer." -ForegroundColor Red
    Write-Host "Upgrade at https://nodejs.org"
    exit 1
}

Write-Host "Node.js $nodeVer detected."

Write-Host "Installing version: $Version" -ForegroundColor Cyan

if (Test-Path $InstallDir) {
    Write-Host "Updating existing install at $InstallDir ..."
    Push-Location $InstallDir
    git fetch --depth 1 origin $Version 2>$null
    git checkout $Version 2>$null
    Pop-Location
} else {
    Write-Host "Cloning PGAutoPilot into $InstallDir ..."
    New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null
    git clone $Repo $InstallDir
    Push-Location $InstallDir
    git fetch --depth 1 origin $Version
    git checkout $Version
    Pop-Location
}

$BundlePath = Join-Path $InstallDir $BundleFile
if (-not (Test-Path $BundlePath)) {
    Write-Host "Bundle not found at $BundlePath" -ForegroundColor Red
    Write-Host "The repository may be missing the pre-built bundle. Try:"
    Write-Host "  cd $InstallDir; npm install; npm run bundle"
    exit 1
}

if (-not $SkipVerify) {
    # Fetch checksums from GitHub raw content at the pinned version
    # (independent source from the cloned repository, so a compromised
    # clone cannot tamper with the checksums).
    $ChecksumsUrl = "https://raw.githubusercontent.com/cyberreinxy/pgautopilot/$Version/dist/checksums.txt"
    $RemoteChecksums = Join-Path $env:TEMP "pgap-checksums-$([System.IO.Path]::GetRandomFileName())"
    try {
        Invoke-WebRequest -Uri $ChecksumsUrl -OutFile $RemoteChecksums -ErrorAction Stop
    } catch {
        # Fallback to local if remote unavailable (offline install, etc.)
        $LocalChecksums = Join-Path $InstallDir "dist\checksums.txt"
        if (Test-Path $LocalChecksums) {
            Copy-Item $LocalChecksums $RemoteChecksums
        } else {
            Write-Host "Checksums unavailable — skipping verification." -ForegroundColor Yellow
            Write-Host "After install, run 'cd $InstallDir; npm run verify' to check manually." -ForegroundColor Cyan
        }
    }
    if (Test-Path $RemoteChecksums) {
        Write-Host "Verifying software integrity..." -ForegroundColor Cyan
        $verified = $true
        $content = Get-Content $RemoteChecksums -Encoding utf8
        foreach ($line in $content) {
            if ([string]::IsNullOrWhiteSpace($line)) { continue }
            $parts = $line -split '\s+', 2
            if ($parts.Count -lt 2) { continue }
            $expectedHash = $parts[0]
            $relPath = $parts[1]
            $targetFile = Join-Path $InstallDir $relPath
            if (-not (Test-Path $targetFile)) {
                Write-Host "  MISSING: $relPath" -ForegroundColor Red
                $verified = $false
                continue
            }
            $actualHash = (Get-FileHash $targetFile -Algorithm SHA256).Hash.ToLower()
            if ($actualHash -ne $expectedHash.ToLower()) {
                Write-Host "  HASH MISMATCH: $relPath" -ForegroundColor Red
                $verified = $false
            }
        }
        $SigFile = Join-Path $InstallDir "dist\checksums.txt.sig"
        if (Test-Path $SigFile) {
            Write-Host "  GPG signature file found. Verify with: gpg --verify $SigFile $RemoteChecksums" -ForegroundColor Cyan
            Write-Host "  Import the maintainer's public key from a keyserver to verify authenticity." -ForegroundColor Cyan
        }
        Remove-Item $RemoteChecksums -Force
        if (-not $verified) {
            Write-Host "INTEGRITY CHECK FAILED. Software may be tampered with." -ForegroundColor Red
            Write-Host "Use -SkipVerify to bypass, or re-install from the official repository." -ForegroundColor Yellow
            exit 1
        }
        Write-Host "Integrity check passed." -ForegroundColor Green
    }
}

New-Item -ItemType Directory -Force -Path $BinDir | Out-Null

$cmdContent = @"
@echo off
node "$BundlePath" %*
"@

Set-Content -Path $Launcher -Value $cmdContent -Encoding ASCII

$userPath = [Environment]::GetEnvironmentVariable("Path", "User")
if ($userPath -notlike "*$BinDir*") {
    [Environment]::SetEnvironmentVariable("Path", "$BinDir;$userPath", "User")
    $env:Path = "$BinDir;$env:Path"
    Write-Host "Added $BinDir to your user PATH."
}

Write-Host ""
Write-Host "PGAutoPilot installed successfully." -ForegroundColor Green
Write-Host ""
Write-Host "Run it:  pgautopilot"
Write-Host "Or:      node $BundlePath"
Write-Host ""
Write-Host "Usage:   pgautopilot [--readonly] [--dev] [DATABASE_URL]"
Write-Host ""
Write-Host "Set DATABASE_URL in your environment:"
Write-Host '  setx DATABASE_URL "postgresql://user:pass@localhost:5432/mydb"'
Write-Host ""
Write-Host "Then configure your MCP client (Claude Desktop, Cursor, VS Code):"
Write-Host '  "pgautopilot": { "command": "pgautopilot" }'
Write-Host ""
Write-Host "Need a quick test database?" -ForegroundColor Cyan
Write-Host "  docker run -e POSTGRES_PASSWORD=pass -p 5432:5432 postgres:16-alpine"
Write-Host ""
Write-Host "IMPORTANT: Close and reopen your terminal for PATH changes to take effect." -ForegroundColor Yellow
