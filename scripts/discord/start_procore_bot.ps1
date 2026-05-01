$ErrorActionPreference = "Stop"

$RepoRoot = "D:\procore-repo"
$Python = "C:\Users\ottoy\AppData\Local\Python\pythoncore-3.14-64\python.exe"
$BotScript = Join-Path $RepoRoot "scripts\discord\procore_bot.py"
$LogDir = Join-Path $RepoRoot "logs"
$LogFile = Join-Path $LogDir "procore-discord-bot.log"

New-Item -ItemType Directory -Force -Path $LogDir | Out-Null
Set-Location $RepoRoot

function Import-DotEnvFile {
    param([string]$Path)

    if (-not (Test-Path -LiteralPath $Path)) {
        return
    }

    Get-Content -LiteralPath $Path | ForEach-Object {
        $line = $_.Trim()
        if (-not $line -or $line.StartsWith("#") -or -not $line.Contains("=")) {
            return
        }

        $parts = $line.Split("=", 2)
        $name = $parts[0].Trim()
        $value = $parts[1].Trim()

        if (($value.StartsWith('"') -and $value.EndsWith('"')) -or ($value.StartsWith("'") -and $value.EndsWith("'"))) {
            $value = $value.Substring(1, $value.Length - 2)
        }

        if ($name) {
            [Environment]::SetEnvironmentVariable($name, $value, "Process")
        }
    }
}

Import-DotEnvFile (Join-Path $RepoRoot ".env")
Import-DotEnvFile (Join-Path $RepoRoot ".env.local")
Import-DotEnvFile (Join-Path $RepoRoot "scripts\discord\.env")

function Import-PersistedEnvVar {
    param([string]$Name)

    if ([Environment]::GetEnvironmentVariable($Name, "Process")) {
        return
    }

    $userValue = [Environment]::GetEnvironmentVariable($Name, "User")
    if ($userValue) {
        [Environment]::SetEnvironmentVariable($Name, $userValue, "Process")
        return
    }

    $machineValue = [Environment]::GetEnvironmentVariable($Name, "Machine")
    if ($machineValue) {
        [Environment]::SetEnvironmentVariable($Name, $machineValue, "Process")
    }
}

@(
    "DISCORD_BOT_TOKEN",
    "DISCORD_PROCORE_CHANNEL_ID",
    "PROCORE_DISCORD_PREFIX",
    "PROCORE_AI_PROVIDER",
    "PROCORE_USE_GEMINI",
    "GEMINI_API_KEY",
    "GEMINI_MODEL",
    "PROCORE_DISCORD_AUTO_CASE",
    "PROCORE_DISCORD_AUTO_DEPLOY",
    "PROCORE_DISCORD_AUTO_BLOGGER",
    "BLOGGER_SMTP_USER",
    "BLOGGER_SMTP_APP_PASSWORD",
    "BLOGGER_EMAIL_TARGET"
) | ForEach-Object { Import-PersistedEnvVar $_ }

$stamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
Add-Content -LiteralPath $LogFile -Value "[$stamp] Starting ProCore Discord bot..."

if (-not $env:DISCORD_BOT_TOKEN) {
    Add-Content -LiteralPath $LogFile -Value "[$stamp] Missing DISCORD_BOT_TOKEN. Set it as a user environment variable or in .env."
    exit 2
}

$env:PYTHONUNBUFFERED = "1"
$command = "`"$Python`" `"$BotScript`" >> `"$LogFile`" 2>&1"
& "$env:ComSpec" /d /s /c $command
$exitCode = $LASTEXITCODE
$stamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
Add-Content -LiteralPath $LogFile -Value "[$stamp] ProCore Discord bot exited with code $exitCode."
exit $exitCode
