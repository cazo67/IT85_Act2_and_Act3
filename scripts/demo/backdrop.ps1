# Plain full-screen backdrop shown behind a narrow browser window so the real desktop is not recorded.
# Stays open until its owning process kills it. Covers the primary 1920x1080 display.
Add-Type -AssemblyName System.Windows.Forms
$f = New-Object Windows.Forms.Form
$f.Text = "SIMS Backdrop"
$f.FormBorderStyle = "None"
$f.StartPosition = "Manual"
$f.Location = New-Object Drawing.Point 0, 0
$f.Size = New-Object Drawing.Size 1920, 1080
$f.BackColor = [Drawing.Color]::FromArgb(229, 231, 235)
$f.TopMost = $true
$f.ShowInTaskbar = $false
$f.Add_Shown({ $f.Activate() })
[void]$f.ShowDialog()
