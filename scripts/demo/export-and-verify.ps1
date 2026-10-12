param([Parameter(Mandatory)][string]$OutDir)
$ErrorActionPreference = "Stop"
$raw = Join-Path $OutDir "raw\raw.webm"
$capture = Get-Content (Join-Path $OutDir "raw\capture.json") | ConvertFrom-Json
$mp4 = Join-Path $OutDir "demo.mp4"
$frames = Join-Path $OutDir "frames"
New-Item -ItemType Directory -Force $frames | Out-Null

$offset = [math]::Round($capture.offsetSeconds, 3)
& ffmpeg -y -v error -ss $offset -i $raw -t 25 -vf "fps=30,scale=1920:1080:flags=lanczos,tpad=stop_mode=clone:stop_duration=3,trim=duration=25,setpts=PTS-STARTPTS,format=yuv420p" -c:v libx264 -preset slow -crf 16 -r 30 -fps_mode cfr -an -movflags +faststart $mp4
if ($LASTEXITCODE -ne 0) { throw "ffmpeg export failed." }

$probe = & ffprobe -v error -show_entries "stream=codec_type,codec_name,width,height,pix_fmt,avg_frame_rate,r_frame_rate:format=duration" -of json $mp4 | ConvertFrom-Json
$streams = @($probe.streams)
$v = $streams | Where-Object codec_type -eq "video"
$duration = [double]$probe.format.duration
$checks = [ordered]@{
  codec_h264      = ($v.codec_name -eq "h264")
  pix_fmt_yuv420p = ($v.pix_fmt -eq "yuv420p")
  size_1920x1080  = ($v.width -eq 1920 -and $v.height -eq 1080)
  fps_30_constant = ($v.r_frame_rate -eq "30/1" -and $v.avg_frame_rate -eq "30/1")
  no_audio        = (@($streams | Where-Object codec_type -eq "audio").Count -eq 0)
  duration_25s    = ([math]::Abs($duration - 25) -le 0.2)
}
foreach ($t in 2, 7, 12, 17, 23) {
  & ffmpeg -y -v error -ss $t -i $mp4 -frames:v 1 (Join-Path $frames "frame-${t}s.png")
}
[ordered]@{ file = $mp4; duration = $duration; video = $v; checks = $checks; slots = $capture.slots } |
  ConvertTo-Json -Depth 6 | Set-Content (Join-Path $OutDir "metadata.json") -Encoding utf8
$checks.GetEnumerator() | ForEach-Object { "{0,-16} {1}" -f $_.Key, $(if ($_.Value) { "PASS" } else { "FAIL" }) }
if ($checks.Values -contains $false) { throw "Verification failed; see metadata.json." }
