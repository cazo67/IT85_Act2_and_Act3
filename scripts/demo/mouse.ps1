# Persistent helper: moves the REAL Windows cursor so a screen recorder captures it.
# Protocol (stdin, one command per line; replies "ok"):
#   glide X Y MS | down | up | place TITLE-PATTERN X Y W H | pos
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public static class W {
  [StructLayout(LayoutKind.Sequential)] public struct POINT { public int X; public int Y; }
  [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
  [DllImport("user32.dll")] public static extern bool SetCursorPos(int x, int y);
  [DllImport("user32.dll")] public static extern bool GetCursorPos(out POINT p);
  [DllImport("user32.dll")] public static extern void mouse_event(uint f, uint dx, uint dy, uint d, UIntPtr e);
  [DllImport("user32.dll")] public static extern bool SetWindowPos(IntPtr h, IntPtr after, int x, int y, int cx, int cy, uint flags);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h, int cmd);
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
}
"@
[W]::SetProcessDPIAware() | Out-Null
$inv = [Globalization.CultureInfo]::InvariantCulture

function Glide($tx, $ty, $ms) {
  $p = New-Object W+POINT
  [W]::GetCursorPos([ref]$p) | Out-Null
  $sx = $p.X; $sy = $p.Y
  $dx = $tx - $sx; $dy = $ty - $sy
  $dist = [math]::Sqrt($dx * $dx + $dy * $dy)
  if ($dist -lt 1) { return }
  $nx = -$dy / $dist; $ny = $dx / $dist          # perpendicular, for a slight natural arc
  $amp = [math]::Min(40, $dist * 0.05)
  $sw = [Diagnostics.Stopwatch]::StartNew()
  while ($true) {
    $t = [math]::Min(1.0, $sw.ElapsedMilliseconds / [double]$ms)
    $e = if ($t -lt 0.5) { 2 * $t * $t } else { 1 - [math]::Pow(-2 * $t + 2, 2) / 2 }
    $arc = [math]::Sin([math]::PI * $e) * $amp
    [W]::SetCursorPos([int]($sx + $dx * $e + $nx * $arc), [int]($sy + $dy * $e + $ny * $arc)) | Out-Null
    if ($t -ge 1.0) { break }
    Start-Sleep -Milliseconds 4
  }
  [W]::SetCursorPos([int]$tx, [int]$ty) | Out-Null
}

while ($null -ne ($line = [Console]::In.ReadLine())) {
  $a = $line.Trim() -split "\s+"
  switch ($a[0]) {
    "glide" { Glide ([double]::Parse($a[1], $inv)) ([double]::Parse($a[2], $inv)) ([double]::Parse($a[3], $inv)) }
    "down"  { [W]::mouse_event(0x0002, 0, 0, 0, [UIntPtr]::Zero) }
    "up"    { [W]::mouse_event(0x0004, 0, 0, 0, [UIntPtr]::Zero) }
    "place" {
      $proc = Get-Process chrome -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowTitle -like "*$($a[1])*" } | Select-Object -First 1
      if ($proc) {
        $h = $proc.MainWindowHandle
        [W]::ShowWindow($h, 9) | Out-Null
        [W]::SetWindowPos($h, [IntPtr](-1), [int]$a[2], [int]$a[3], [int]$a[4], [int]$a[5], 0x0040) | Out-Null
        [W]::SetForegroundWindow($h) | Out-Null
      } else { [Console]::Out.WriteLine("nowindow"); [Console]::Out.Flush(); continue }
    }
  }
  [Console]::Out.WriteLine("ok"); [Console]::Out.Flush()
}
