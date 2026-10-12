# Initialises the visible demo terminal (a real interactive PowerShell). Not secret-bearing.
param([string]$Root, [string]$Work)
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public static class CF {
  [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
  public struct FONTEX { public uint cbSize; public uint nFont; public short X; public short Y; public int Family; public int Weight; [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 32)] public string Face; }
  [DllImport("kernel32.dll")] public static extern IntPtr GetStdHandle(int n);
  [DllImport("kernel32.dll", SetLastError = true)] public static extern bool SetCurrentConsoleFontEx(IntPtr h, bool max, ref FONTEX f);
}
"@
$f = New-Object CF+FONTEX
$f.cbSize = [Runtime.InteropServices.Marshal]::SizeOf($f)
$f.X = 0; $f.Y = 26; $f.Family = 54; $f.Weight = 400; $f.Face = "Consolas"
[CF]::SetCurrentConsoleFontEx([CF]::GetStdHandle(-11), $false, [ref]$f) | Out-Null
$Host.UI.RawUI.WindowTitle = "SIMS Terminal"
$Host.UI.RawUI.BackgroundColor = "Black"; $Host.UI.RawUI.ForegroundColor = "Gray"
try { Set-PSReadLineOption -PredictionSource None } catch {}
$max = $Host.UI.RawUI.MaxPhysicalWindowSize
try {
  $Host.UI.RawUI.BufferSize = New-Object Management.Automation.Host.Size ($max.Width), 3000
  $Host.UI.RawUI.WindowSize = New-Object Management.Automation.Host.Size ($max.Width), ($max.Height)
} catch {}
$global:R = $Root
$global:API = "http://127.0.0.1:8200"
Set-Location $Work
function global:prompt { "PS> " }
# Shows a numbered range of a real source file.
function global:v($file, [int]$from, [int]$to) {
  $n = $from
  Get-Content (Join-Path $global:R $file) | Select-Object -Skip ($from - 1) -First ($to - $from + 1) | ForEach-Object { "{0,4}  {1}" -f $n, $_; $n++ }
}
Clear-Host
