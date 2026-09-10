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

Save-ResizedPng (Join-Path $assetRoot 'sti-logo.png') (Join-Path $assetRoot 'sti-logo-web.png') 420
Save-ResizedPng (Join-Path $assetRoot 'sti-vio-log-logo.png') (Join-Path $assetRoot 'sti-vio-log-logo-web.png') 620
Save-ResizedPng (Join-Path $publicRoot 'sti-vio-log-favicon.png') (Join-Path $publicRoot 'favicon-32.png') 32
Save-ResizedPng (Join-Path $publicRoot 'sti-vio-log-favicon.png') (Join-Path $publicRoot 'apple-touch-icon.png') 180

$building = [System.Drawing.Image]::FromFile((Join-Path $assetRoot 'sti-global-city-building.jpg'))
try {
  $buildingWeb = New-Object System.Drawing.Bitmap($building.Width, $building.Height)
  try {
    $buildingGraphics = [System.Drawing.Graphics]::FromImage($buildingWeb)
    try { $buildingGraphics.DrawImage($building, 0, 0, $building.Width, $building.Height) } finally { $buildingGraphics.Dispose() }
    Save-Jpeg $buildingWeb (Join-Path $assetRoot 'sti-global-city-building-web.jpg') 76
  } finally { $buildingWeb.Dispose() }

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
      $graphics.DrawImage($building, (New-Object System.Drawing.Rectangle(0, 0, 1200, 630)), $sourceRectangle, [System.Drawing.GraphicsUnit]::Pixel)
      $overlay = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(196, 0, 38, 91))
      $accent = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 255, 213, 31))
      try {
        $graphics.FillRectangle($overlay, 0, 0, 1200, 630)
        $graphics.FillRectangle($accent, 0, 0, 18, 630)
        $titleFont = New-Object System.Drawing.Font('Arial', 68, [System.Drawing.FontStyle]::Bold)
        $bodyFont = New-Object System.Drawing.Font('Arial', 28, [System.Drawing.FontStyle]::Regular)
        $smallFont = New-Object System.Drawing.Font('Arial', 21, [System.Drawing.FontStyle]::Bold)
        try {
          $graphics.DrawString('STI Vio-Log', $titleFont, [System.Drawing.Brushes]::White, 72, 310)
          $graphics.DrawString('Discipline. Accountability. A Brighter Tomorrow.', $bodyFont, [System.Drawing.Brushes]::White, 76, 400)
          $graphics.DrawString('STI GLOBAL CITY', $smallFont, $accent, 77, 475)
        } finally { $titleFont.Dispose(); $bodyFont.Dispose(); $smallFont.Dispose() }
      } finally { $overlay.Dispose(); $accent.Dispose() }
    } finally { $graphics.Dispose() }
    Save-Jpeg $social (Join-Path $publicRoot 'social-preview.jpg') 84
  } finally { $social.Dispose() }
} finally { $building.Dispose() }

Get-Item (Join-Path $assetRoot 'sti-logo-web.png'), (Join-Path $assetRoot 'sti-vio-log-logo-web.png'), (Join-Path $assetRoot 'sti-global-city-building-web.jpg'), (Join-Path $publicRoot 'favicon-32.png'), (Join-Path $publicRoot 'apple-touch-icon.png'), (Join-Path $publicRoot 'social-preview.jpg') | Select-Object Name, Length
