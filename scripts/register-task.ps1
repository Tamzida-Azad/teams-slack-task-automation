# Registers a Windows Scheduled Task for Calysta Teams -> Slack daily digest.
# Cadence: weekdays 12:10 PM local Asia/Dhaka (GMT+6).
# Uses StartWhenAvailable so a missed run can fire once when the PC comes back on.
# Cursor IDE does NOT need to be open — the bat runs Node + Cursor SDK locally.

$ErrorActionPreference = 'Stop'

$taskName = 'SJ-Teams-Slack-Daily'
$projectRoot = Split-Path -Parent $PSScriptRoot
$batPath = Join-Path $PSScriptRoot 'run-daily.bat'

if (-not (Test-Path $batPath)) {
  throw "Missing runner: $batPath"
}

$envFile = Join-Path $projectRoot '.env'
if (-not (Test-Path $envFile)) {
  Write-Warning "No .env yet. Copy .env.example to .env and set CURSOR_API_KEY before the first scheduled run."
}

$action = New-ScheduledTaskAction -Execute $batPath -WorkingDirectory $projectRoot
$trigger = New-ScheduledTaskTrigger -Weekly -DaysOfWeek Monday,Tuesday,Wednesday,Thursday,Friday -At '12:10PM'
$settings = New-ScheduledTaskSettingsSet `
  -AllowStartIfOnBatteries `
  -DontStopIfGoingOnBatteries `
  -StartWhenAvailable `
  -WakeToRun `
  -MultipleInstances IgnoreNew `
  -ExecutionTimeLimit (New-TimeSpan -Hours 2)

$principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive -RunLevel Limited

$description = 'Calysta Teams to Slack digest for calystaproemr. Weekdays 12:10 PM Asia/Dhaka (GMT+6). Cursor IDE not required.'

Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Description $description -Force | Out-Null

Write-Host "Scheduled task registered: $taskName"
Write-Host "Project:  $projectRoot"
Write-Host "Schedule: Mon-Fri at 12:10 PM local (Asia/Dhaka, GMT+6)"
Write-Host "Action:   $batPath"
Write-Host "Missed:   StartWhenAvailable (one catch-up when PC comes on)"
Write-Host "Wake:     WakeToRun enabled"
Write-Host ""
Write-Host "Useful commands:"
Write-Host "  Get-ScheduledTask -TaskName '$taskName' | Get-ScheduledTaskInfo"
Write-Host "  Start-ScheduledTask -TaskName '$taskName'"
Write-Host "  Unregister-ScheduledTask -TaskName '$taskName' -Confirm:`$false"
