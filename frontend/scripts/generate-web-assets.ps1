param([string]$ProjectRoot = (Split-Path -Parent $PSScriptRoot))
Add-Type -AssemblyName System.Drawing
$assetRoot = Join-Path $ProjectRoot 'src/assets'
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

function Save-Jpeg([System.Drawing.Bitmap]$Bitmap, [string]$Destination, [long]$Quality = 82) {
  $encoder = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object MimeType -eq 'image/jpeg'
  $parameters = New-Object System.Drawing.Imaging.EncoderParameters(1)
  $parameters.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter([System.Drawing.Imaging.Encoder]::Quality, $Quality)
  try { $Bitmap.Save($Destination, $encoder, $parameters) } finally { $parameters.Dispose() }
}

Save-ResizedPng (Join-Path $publicRoot 'sti-vio-log-favicon.png') (Join-Path $publicRoot 'favicon-32.png') 32
Save-ResizedPng (Join-Path $publicRoot 'sti-vio-log-favicon.png') (Join-Path $publicRoot 'apple-touch-icon.png') 180

$building = [System.Drawing.Image]::FromFile((Join-Path $assetRoot 'sti-global-city-building-night.jpg'))
try {
  $social = New-Object System.Drawing.Bitmap(1200, 630)
  try {
    $graphics = [System.Drawing.Graphics]::FromImage($social)
    try {
      $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
      $sourceRatio = $building.Width / $building.Height
      $targetRatio = 1200 / 630
      if ($sourceRatio -gt $targetRatio) {
        $cropWidth = [int]($building.Height * $targetRatio)
        $sourceRectangle = New-Object System.Drawing.Rectangle([int](($building.Width - $cropWidth) / 2), 0, $cropWidth, $building.Height)
      } else {
        $cropHeight = [int]($building.Width / $targetRatio)
        $sourceRectangle = New-Object System.Drawing.Rectangle(0, [int](($building.Height - $cropHeight) / 2), $building.Width, $cropHeight)
      }
      $graphics.Clear([System.Drawing.Color]::FromArgb(7, 20, 33))
      $sourceRectangle = New-Object System.Drawing.Rectangle(312, 0, 576, 825)
      $graphics.DrawImage($building, (New-Object System.Drawing.Rectangle(760, 0, 440, 630)), $sourceRectangle, [System.Drawing.GraphicsUnit]::Pixel)
      $overlay = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(125, 7, 20, 33))
      $accent = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 244, 197, 66))
      $muted = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 180, 200, 220))
      try {
        $graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
        $graphics.FillRectangle($overlay, 760, 0, 440, 630)
        $graphics.FillRectangle($accent, 64, 240, 44, 3)
        $graphics.FillRectangle($accent, 760, 626, 440, 4)
        $titleFont = New-Object System.Drawing.Font('Segoe UI', 72, [System.Drawing.FontStyle]::Bold)
        $bodyFont = New-Object System.Drawing.Font('Segoe UI', 17, [System.Drawing.FontStyle]::Regular)
        $smallFont = New-Object System.Drawing.Font('Segoe UI', 15, [System.Drawing.FontStyle]::Bold)
        $logoImage = [System.Drawing.Image]::FromFile((Join-Path $assetRoot 'sti-logo-web-transparent.png'))
        try {
          $graphics.DrawImage($logoImage, 58, 38, 240, 135)
          $graphics.DrawString('STI GLOBAL CITY / STUDENT PORTAL', $smallFont, $muted, 64, 190)
          $graphics.DrawString('Know your', $titleFont, [System.Drawing.Brushes]::White, 54, 258)
          $graphics.DrawString('next step.', $titleFont, $accent, 54, 362)
          $graphics.DrawString('Records. Service. Clearance.', $bodyFont, $muted, 64, 520)
          $graphics.DrawString('sti-vio-log.vercel.app', $bodyFont, $muted, 64, 561)
        } finally { $titleFont.Dispose(); $bodyFont.Dispose(); $smallFont.Dispose(); $logoImage.Dispose() }
      } finally { $overlay.Dispose(); $accent.Dispose(); $muted.Dispose() }
    } finally { $graphics.Dispose() }
    Save-Jpeg $social (Join-Path $publicRoot 'social-preview.jpg') 84
  } finally { $social.Dispose() }
} finally { $building.Dispose() }

Get-Item (Join-Path $assetRoot 'sti-logo-web.png'), (Join-Path $assetRoot 'sti-global-city-building-web.jpg'), (Join-Path $publicRoot 'favicon-32.png'), (Join-Path $publicRoot 'apple-touch-icon.png'), (Join-Path $publicRoot 'social-preview.jpg') | Select-Object Name, Length
