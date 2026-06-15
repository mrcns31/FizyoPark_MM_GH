Add-Type -AssemblyName System.Drawing
$src = Join-Path $PSScriptRoot "..\icons\fizyopark-logo.png"
$dest = Join-Path $PSScriptRoot "..\icons\fizyopark-logo-web.png"
$img = [System.Drawing.Image]::FromFile($src)
$newWidth = 360
$newHeight = [int][Math]::Round($img.Height * ($newWidth / $img.Width))
$bmp = New-Object System.Drawing.Bitmap $newWidth, $newHeight
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
$g.DrawImage($img, 0, 0, $newWidth, $newHeight)
$bmp.Save($dest, [System.Drawing.Imaging.ImageFormat]::Png)
$g.Dispose(); $bmp.Dispose(); $img.Dispose()
Write-Output ((Get-Item $dest).Length)
