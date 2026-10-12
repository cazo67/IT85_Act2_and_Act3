# Persistent desktop helper driven over stdin (one command per line, one reply line per command).
# Moves the REAL cursor with human-like paths, clicks/scrolls/types at OS level, and places/inspects windows.
#   seed N | glide X Y [MS] | down | up | wheel N | keys TEXT | type TEXT | key NAME
#   place TITLE X Y W H | rect TITLE | tab TITLE_SUBSTRING | front TITLE | pos
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes
Add-Type -TypeDefinition @"
using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;
using System.Text;
public static class W {
  [StructLayout(LayoutKind.Sequential)] public struct POINT { public int X; public int Y; }
  [StructLayout(LayoutKind.Sequential)] public struct RECT { public int L; public int T; public int R; public int B; }
  public delegate bool EnumProc(IntPtr h, IntPtr l);
  [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
  [DllImport("user32.dll")] public static extern bool SetCursorPos(int x, int y);
  [DllImport("user32.dll")] public static extern bool GetCursorPos(out POINT p);
  [DllImport("user32.dll")] public static extern void mouse_event(uint f, uint dx, uint dy, int d, UIntPtr e);
  [DllImport("user32.dll")] public static extern void keybd_event(byte vk, byte scan, uint flags, UIntPtr e);
  [DllImport("user32.dll")] public static extern bool SetWindowPos(IntPtr h, IntPtr after, int x, int y, int cx, int cy, uint flags);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h, int cmd);
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h, out RECT r);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr h);
  [DllImport("user32.dll")] public static extern int GetWindowText(IntPtr h, StringBuilder s, int n);
  [DllImport("user32.dll")] public static extern bool EnumWindows(EnumProc p, IntPtr l);
  [DllImport("dwmapi.dll")] public static extern int DwmGetWindowAttribute(IntPtr h, int attr, out RECT r, int size);
  public static IntPtr Find(string part) {
    IntPtr found = IntPtr.Zero;
    EnumWindows((h, l) => {
      if (!IsWindowVisible(h)) return true;
      var sb = new StringBuilder(512); GetWindowText(h, sb, 512);
      if (sb.Length > 0 && sb.ToString().IndexOf(part, StringComparison.OrdinalIgnoreCase) >= 0) { found = h; return false; }
      return true;
    }, IntPtr.Zero);
    return found;
  }
}
"@
[W]::SetProcessDPIAware() | Out-Null
$inv = [Globalization.CultureInfo]::InvariantCulture
$script:rng = New-Object System.Random 1
function Rand($a, $b) { return $a + $script:rng.NextDouble() * ($b - $a) }

function Bezier($p0, $p1, $p2, $p3, $t) {
  $u = 1 - $t
  return $u*$u*$u*$p0 + 3*$u*$u*$t*$p1 + 3*$u*$t*$t*$p2 + $t*$t*$t*$p3
}

function MoveOnce($tx, $ty, $ms) {
  $p = New-Object W+POINT
  [W]::GetCursorPos([ref]$p) | Out-Null
  $sx = [double]$p.X; $sy = [double]$p.Y
  $dx = $tx - $sx; $dy = $ty - $sy
  $dist = [math]::Sqrt($dx*$dx + $dy*$dy)
  if ($dist -lt 2) { [W]::SetCursorPos([int]$tx, [int]$ty) | Out-Null; return }
  $nx = -$dy / $dist; $ny = $dx / $dist
  $bend1 = (Rand (-0.10) 0.10) * $dist; $bend2 = (Rand (-0.08) 0.08) * $dist
  $c1x = $sx + $dx * 0.30 + $nx * $bend1; $c1y = $sy + $dy * 0.30 + $ny * $bend1
  $c2x = $sx + $dx * 0.72 + $nx * $bend2; $c2y = $sy + $dy * 0.72 + $ny * $bend2
  $a = Rand 1.4 2.4                                   # varying acceleration profile per movement
  $sw = [Diagnostics.Stopwatch]::StartNew()
  while ($true) {
    $t = [math]::Min(1.0, $sw.ElapsedMilliseconds / [double]$ms)
    $s = [math]::Pow($t, $a) / ([math]::Pow($t, $a) + [math]::Pow(1 - $t, $a))
    $x = Bezier $sx $c1x $c2x $tx $s
    $y = Bezier $sy $c1y $c2y $ty $s
    [W]::SetCursorPos([int][math]::Round($x), [int][math]::Round($y)) | Out-Null
    if ($t -ge 1.0) { break }
    Start-Sleep -Milliseconds 7
  }
  [W]::SetCursorPos([int]$tx, [int]$ty) | Out-Null
}

function Glide($tx, $ty, $ms) {
  $p = New-Object W+POINT
  [W]::GetCursorPos([ref]$p) | Out-Null
  $dist = [math]::Sqrt(($tx - $p.X) * ($tx - $p.X) + ($ty - $p.Y) * ($ty - $p.Y))
  if ($ms -le 0) { $ms = (280 + 0.34 * $dist) * (Rand 0.85 1.2) }
  if ($dist -gt 380 -and $script:rng.NextDouble() -lt 0.35) {
    # occasional small overshoot followed by a short correction
    $over = Rand 5 12
    $ox = $tx + ($tx - $p.X) / $dist * $over; $oy = $ty + ($ty - $p.Y) / $dist * $over
    MoveOnce $ox $oy $ms
    Start-Sleep -Milliseconds ([int](Rand 60 140))
    MoveOnce $tx $ty (Rand 110 190)
  } else { MoveOnce $tx $ty $ms }
}

function SendEscaped($ch) {
  if ("+^%~(){}[]".Contains([string]$ch)) { [Windows.Forms.SendKeys]::SendWait("{" + $ch + "}") }
  else { [Windows.Forms.SendKeys]::SendWait([string]$ch) }
}

function Front($h) {
  [W]::keybd_event(0x12, 0, 0, [UIntPtr]::Zero); [W]::keybd_event(0x12, 0, 2, [UIntPtr]::Zero)   # Alt tap lifts the foreground lock
  [W]::ShowWindow($h, 9) | Out-Null
  [W]::SetWindowPos($h, [IntPtr](-1), 0, 0, 0, 0, 0x0043) | Out-Null   # TOPMOST, no move/size
  [W]::SetForegroundWindow($h) | Out-Null
}

function VisibleRect($h) {
  $r = New-Object W+RECT
  [W]::DwmGetWindowAttribute($h, 9, [ref]$r, 16) | Out-Null
  return $r
}

while ($null -ne ($line = [Console]::In.ReadLine())) {
  $reply = "ok"
  try {
    $sp = $line.IndexOf(" ")
    $cmd = if ($sp -lt 0) { $line } else { $line.Substring(0, $sp) }
    $rest = if ($sp -lt 0) { "" } else { $line.Substring($sp + 1) }
    $a = $rest -split "\s+"
    switch ($cmd) {
      "seed"  { $script:rng = New-Object System.Random ([int]$a[0]) }
      "glide" { Glide ([double]::Parse($a[0], $inv)) ([double]::Parse($a[1], $inv)) $(if ($a.Count -gt 2) { [double]::Parse($a[2], $inv) } else { 0 }) }
      "down"  { [W]::mouse_event(0x0002, 0, 0, 0, [UIntPtr]::Zero) }
      "up"    { [W]::mouse_event(0x0004, 0, 0, 0, [UIntPtr]::Zero) }
      "wheel" { [W]::mouse_event(0x0800, 0, 0, [int]([double]::Parse($a[0], $inv) * 120), [UIntPtr]::Zero) }
      "keys"  { [Windows.Forms.SendKeys]::SendWait($rest) }
      "type"  { foreach ($ch in $rest.ToCharArray()) { SendEscaped $ch; Start-Sleep -Milliseconds ([int](Rand 80 120)) } }
      "pos"   { $p = New-Object W+POINT; [W]::GetCursorPos([ref]$p) | Out-Null; $reply = "$($p.X) $($p.Y)" }
      "front" { $h = [W]::Find($rest); if ($h -eq [IntPtr]::Zero) { $reply = "nowindow" } else { Front $h } }
      "place" {
        $title = $rest.Substring(0, $rest.IndexOf("|")); $n = $rest.Substring($rest.IndexOf("|") + 1) -split "\s+"
        $h = [W]::Find($title)
        if ($h -eq [IntPtr]::Zero) { $reply = "nowindow" } else {
          Front $h
          $x = [int]$n[0]; $y = [int]$n[1]; $w = [int]$n[2]; $hh = [int]$n[3]
          [W]::SetWindowPos($h, [IntPtr](-1), $x, $y, $w, $hh, 0x0040) | Out-Null
          $win = New-Object W+RECT; [W]::GetWindowRect($h, [ref]$win) | Out-Null
          $vis = VisibleRect $h
          $l = $vis.L - $win.L; $t = $vis.T - $win.T; $r = $win.R - $vis.R; $b = $win.B - $vis.B
          [W]::SetWindowPos($h, [IntPtr](-1), $x - $l, $y - $t, $w + $l + $r, $hh + $t + $b, 0x0040) | Out-Null
          Start-Sleep -Milliseconds 250
          $vis = VisibleRect $h
          $reply = "$($vis.L) $($vis.T) $($vis.R - $vis.L) $($vis.B - $vis.T)"
        }
      }
      "rawplace" {
        $title = $rest.Substring(0, $rest.IndexOf("|")); $n = $rest.Substring($rest.IndexOf("|") + 1) -split "\s+"
        $h = [W]::Find($title)
        if ($h -eq [IntPtr]::Zero) { $reply = "nowindow" } else {
          Front $h
          [W]::SetWindowPos($h, [IntPtr](-1), [int]$n[0], [int]$n[1], [int]$n[2], [int]$n[3], 0x0040) | Out-Null
          Start-Sleep -Milliseconds 250
          $v = VisibleRect $h; $reply = "$($v.L) $($v.T) $($v.R - $v.L) $($v.B - $v.T)"
        }
      }
      "rect"  { $h = [W]::Find($rest); if ($h -eq [IntPtr]::Zero) { $reply = "nowindow" } else { $v = VisibleRect $h; $reply = "$($v.L) $($v.T) $($v.R - $v.L) $($v.B - $v.T)" } }
      "tab"   {
        $title = $rest.Substring(0, $rest.IndexOf("|")); $tabName = $rest.Substring($rest.IndexOf("|") + 1)
        $h = [W]::Find($title)
        if ($h -eq [IntPtr]::Zero) { $reply = "nowindow" } else {
          $root = [Windows.Automation.AutomationElement]::FromHandle($h)
          $cond = New-Object Windows.Automation.PropertyCondition ([Windows.Automation.AutomationElement]::ControlTypeProperty), ([Windows.Automation.ControlType]::TabItem)
          $reply = "none"
          foreach ($el in $root.FindAll([Windows.Automation.TreeScope]::Descendants, $cond)) {
            if ($el.Current.Name -like "*$tabName*") { $b = $el.Current.BoundingRectangle; $reply = "$([int]$b.X) $([int]$b.Y) $([int]$b.Width) $([int]$b.Height)"; break }
          }
        }
      }
      default { $reply = "unknown" }
    }
  } catch { $reply = "error " + $_.Exception.Message }
  [Console]::Out.WriteLine($reply); [Console]::Out.Flush()
}
