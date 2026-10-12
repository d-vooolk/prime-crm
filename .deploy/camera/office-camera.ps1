# Камера офиса → сервер CRM. Запускается при включении компьютера (задача планировщика,
# install-office-camera.ps1) и работает, пока компьютер включён.
# Забирает видео со звуком с камеры по RTSP, перекодирует H.265 → H.264 и G.711 → AAC
# (браузеры показывают их везде)
# и отправляет на сервер по зашифрованному SRT. Камера ещё не загрузилась или пропала связь —
# повторяет попытку каждые 10 секунд. Подробно — .deploy/README-camera.md

$ErrorActionPreference = 'Stop'
$dir = $PSScriptRoot
$confPath = Join-Path $dir 'camera.conf'
$logPath = Join-Path $dir 'camera.log'
$ffmpegLog = Join-Path $dir 'ffmpeg-last.log'

function Write-Log([string]$text) {
  # Лог не растёт бесконечно: больше 2 МБ — начинаем заново
  if ((Test-Path $logPath) -and (Get-Item $logPath).Length -gt 2MB) { Remove-Item $logPath -Force }
  Add-Content -Path $logPath -Value "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')  $text" -Encoding UTF8
}

# camera.conf: строки КЛЮЧ=значение (образец — camera.conf.example)
$conf = @{}
foreach ($line in Get-Content $confPath -Encoding UTF8) {
  if ($line -match '^\s*([A-Z_]+)\s*=\s*(.*?)\s*$') { $conf[$Matches[1]] = $Matches[2] }
}
foreach ($key in 'CAMERA_RTSP_URL', 'SERVER_HOST', 'SRT_PASSPHRASE') {
  if (-not $conf[$key]) { Write-Log "В camera.conf не задан $key — остановка"; exit 1 }
}
$ffmpeg = if ($conf['FFMPEG']) { $conf['FFMPEG'] } else { Join-Path $dir 'ffmpeg.exe' }
$width = if ($conf['WIDTH']) { $conf['WIDTH'] } else { '1152' }
$bitrate = if ($conf['BITRATE_KBPS']) { [int]$conf['BITRATE_KBPS'] } else { 1200 }

$srt = "srt://$($conf['SERVER_HOST']):8890?streamid=publish:office&passphrase=$($conf['SRT_PASSPHRASE'])&pbkeylen=32&latency=500000&mode=caller"

# Камера отдаёт 12 кадров/с; ключевой кадр раз в секунду — под секундные сегменты HLS на сервере
$ffArgs = @(
  '-hide_banner', '-loglevel', 'warning', '-nostdin',
  '-rtsp_transport', 'tcp', '-timeout', '10000000',
  '-i', "`"$($conf['CAMERA_RTSP_URL'])`"",
  # Звук камеры — G.711 8 кГц; AAC 16 кГц моно, async — без щелчков при пропусках пакетов
  '-c:a', 'aac', '-b:a', '48k', '-ar', '16000', '-ac', '1', '-af', 'aresample=async=1',
  '-vf', "scale=$($width):-2",
  '-c:v', 'libx264', '-preset', 'veryfast', '-tune', 'zerolatency',
  '-profile:v', 'main', '-pix_fmt', 'yuv420p',
  '-r', '12', '-g', '12', '-keyint_min', '12', '-sc_threshold', '0',
  '-b:v', "$($bitrate)k", '-maxrate', "$([int]($bitrate * 1.25))k", '-bufsize', "$($bitrate * 2)k",
  '-f', 'mpegts', "`"$srt`""
) -join ' '

Write-Log 'Старт трансляции камеры'
while ($true) {
  $started = Get-Date
  $proc = Start-Process -FilePath $ffmpeg -ArgumentList $ffArgs -NoNewWindow -Wait -PassThru `
    -RedirectStandardError $ffmpegLog
  $seconds = [int]((Get-Date) - $started).TotalSeconds
  # Пароли в лог не пишем — причина остановки в ffmpeg-last.log
  Write-Log "ffmpeg остановился (код $($proc.ExitCode), работал $seconds с) — повтор через 10 с"
  Start-Sleep -Seconds 10
}
