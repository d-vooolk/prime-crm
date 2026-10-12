# Установка трансляции камеры на компьютер в офисе. Запускать от администратора:
#   powershell -ExecutionPolicy Bypass -File install-office-camera.ps1
# Что делает:
#  1. копирует скрипт и ffmpeg в C:\ProgramData\PrimeCamera (доступ — только администраторам и системе);
#  2. создаёт camera.conf из образца, если его ещё нет (заполнить по README-camera.md);
#  3. регистрирует задачу планировщика «PrimeCRM Camera»: запуск при включении компьютера,
#     без входа пользователя и без окна.
# Повторный запуск безопасен: обновляет скрипт и задачу, camera.conf не трогает.

$ErrorActionPreference = 'Stop'
$src = $PSScriptRoot
$target = 'C:\ProgramData\PrimeCamera'
$taskName = 'PrimeCRM Camera'

$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole(
  [Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) { throw 'Запустите PowerShell от имени администратора' }

# ffmpeg: winget install --id Gyan.FFmpeg -e (в сборке есть SRT и libx264)
$ff = Get-Command ffmpeg -ErrorAction SilentlyContinue
if (-not $ff) { throw 'ffmpeg не найден. Установите: winget install --id Gyan.FFmpeg -e — и откройте новое окно PowerShell' }
$ffPath = $ff.Source
# winget кладёт в PATH ярлык — копируем сам exe: задача работает от SYSTEM и не видит PATH пользователя
$item = Get-Item $ffPath
if ($item.LinkType -and $item.Target) { $ffPath = @($item.Target)[0] }
if (-not ((& $ffPath -hide_banner -protocols 2>$null) -match '^\s*srt\s*$')) {
  throw "В этой сборке ffmpeg нет SRT ($ffPath). Нужна сборка Gyan.FFmpeg"
}

New-Item -ItemType Directory -Force $target | Out-Null
Copy-Item (Join-Path $src 'office-camera.ps1') $target -Force
Copy-Item $ffPath (Join-Path $target 'ffmpeg.exe') -Force

$conf = Join-Path $target 'camera.conf'
if (-not (Test-Path $conf)) {
  Copy-Item (Join-Path $src 'camera.conf.example') $conf
  Write-Host "Создан $conf — заполните его и запустите установку ещё раз" -ForegroundColor Yellow
}

# В camera.conf пароли камеры и SRT — папку видят только администраторы и система
icacls $target /inheritance:r /grant:r '*S-1-5-18:(OI)(CI)F' '*S-1-5-32-544:(OI)(CI)F' | Out-Null

$action = New-ScheduledTaskAction -Execute 'powershell.exe' `
  -Argument "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$target\office-camera.ps1`""
$trigger = New-ScheduledTaskTrigger -AtStartup
$principal = New-ScheduledTaskPrincipal -UserId 'SYSTEM' -LogonType ServiceAccount -RunLevel Highest
# Без ограничения по времени, на батарее тоже; упал — перезапуск через минуту
$settings = New-ScheduledTaskSettingsSet -ExecutionTimeLimit ([TimeSpan]::Zero) -AllowStartIfOnBatteries `
  -DontStopIfGoingOnBatteries -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1) -StartWhenAvailable
Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Principal $principal `
  -Settings $settings -Force | Out-Null

$filled = (Get-Content $conf -Encoding UTF8) -match '^\s*SRT_PASSPHRASE\s*=\s*\S+'
if ($filled) {
  Stop-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
  Get-CimInstance Win32_Process -Filter "Name='ffmpeg.exe'" |
    Where-Object { $_.ExecutablePath -like "$target*" } |
    ForEach-Object { Stop-Process -Id $_.ProcessId -Force }
  Start-ScheduledTask -TaskName $taskName
  Write-Host "Готово: трансляция запущена. Журнал — $target\camera.log" -ForegroundColor Green
} else {
  Write-Host "Задача создана, но camera.conf не заполнен — трансляция начнётся после заполнения и повторной установки"
}
