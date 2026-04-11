param(
  [string]$Source = ".\restaurant_bot.db",
  [string]$BackupDir = ".\backups",
  [int]$KeepDays = 14
)

$ErrorActionPreference = "Stop"

if (!(Test-Path $Source)) {
  throw "Database file not found at: $Source"
}

if (!(Test-Path $BackupDir)) {
  New-Item -ItemType Directory -Path $BackupDir | Out-Null
}

$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$filename = "restaurant_bot-$timestamp.db"
$destination = Join-Path $BackupDir $filename

Copy-Item -Path $Source -Destination $destination -Force

Get-ChildItem -Path $BackupDir -Filter "*.db" |
  Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-$KeepDays) } |
  Remove-Item -Force

Write-Host "Backup completed: $destination"
