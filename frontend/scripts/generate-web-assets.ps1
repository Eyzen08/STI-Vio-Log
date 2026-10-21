param([string]$ProjectRoot = (Split-Path -Parent $PSScriptRoot))
Add-Type -AssemblyName System.Drawing
$publicRoot = Join-Path $ProjectRoot 'public'

function Save-ResizedPng([string]$Source, [string]$Destination, [int]$Width) {
  $sourceImage = [System.Drawing.Image]::FromFile($Source)
  try {
    $height = [int][Math]::Round($sourceImage.Height * $Width / $sourceImage.Width)
    $bitmap = New-Object System.Drawing.Bitmap($Width, $height, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    try {
      $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
      try {
        $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
        $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
        $graphics.DrawImage($sourceImage, 0, 0, $Width, $height)
      } finally { $graphics.Dispose() }
      $bitmap.Save($Destination, [System.Drawing.Imaging.ImageFormat]::Png)
    } finally { $bitmap.Dispose() }
  } finally { $sourceImage.Dispose() }
}

Save-ResizedPng (Join-Path $publicRoot 'sti-vio-log-favicon.png') (Join-Path $publicRoot 'favicon-32.png') 32
Save-ResizedPng (Join-Path $publicRoot 'sti-vio-log-favicon.png') (Join-Path $publicRoot 'apple-touch-icon.png') 180

# The generated social preview is maintained separately; icon generation must not replace it.
Get-Item (Join-Path $publicRoot 'favicon-32.png'), (Join-Path $publicRoot 'apple-touch-icon.png') | Select-Object Name, Length
