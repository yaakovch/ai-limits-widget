param(
  [string]$OutputPath = (Join-Path $PSScriptRoot '..\resources\tray-icon.png'),
  [ValidateRange(64, 1024)]
  [int]$Size = 64
)

Add-Type -AssemblyName System.Drawing

$bitmap = [System.Drawing.Bitmap]::new($Size, $Size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
$graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
$graphics.ScaleTransform($Size / 64, $Size / 64)
$graphics.Clear([System.Drawing.Color]::Transparent)

$tilePath = [System.Drawing.Drawing2D.GraphicsPath]::new()
$tilePath.AddArc(4, 4, 16, 16, 180, 90)
$tilePath.AddArc(44, 4, 16, 16, 270, 90)
$tilePath.AddArc(44, 44, 16, 16, 0, 90)
$tilePath.AddArc(4, 44, 16, 16, 90, 90)
$tilePath.CloseFigure()

$tileBrush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(255, 22, 25, 31))
$borderPen = [System.Drawing.Pen]::new([System.Drawing.Color]::FromArgb(190, 226, 232, 240), 2.5)
$graphics.FillPath($tileBrush, $tilePath)
$graphics.DrawPath($borderPen, $tilePath)

$trackPen = [System.Drawing.Pen]::new([System.Drawing.Color]::FromArgb(255, 55, 65, 81), 6)
$trackPen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
$trackPen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
$cyanPen = [System.Drawing.Pen]::new([System.Drawing.Color]::FromArgb(255, 45, 212, 191), 6)
$cyanPen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
$cyanPen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
$amberPen = [System.Drawing.Pen]::new([System.Drawing.Color]::FromArgb(255, 251, 146, 60), 6)
$amberPen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
$amberPen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round

$ring = [System.Drawing.RectangleF]::new(16, 16, 32, 32)
$graphics.DrawArc($trackPen, $ring, -90, 360)
$graphics.DrawArc($cyanPen, $ring, -90, 155)
$graphics.DrawArc($amberPen, $ring, 82, 105)

$handPen = [System.Drawing.Pen]::new([System.Drawing.Color]::FromArgb(255, 248, 250, 252), 4)
$handPen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
$handPen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
$graphics.DrawLine($handPen, 32, 32, 32, 23)
$graphics.DrawLine($handPen, 32, 32, 39, 36)
$centerBrush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(255, 248, 250, 252))
$graphics.FillEllipse($centerBrush, 29, 29, 6, 6)

$outputDirectory = Split-Path -Parent $OutputPath
[System.IO.Directory]::CreateDirectory($outputDirectory) | Out-Null
$bitmap.Save($OutputPath, [System.Drawing.Imaging.ImageFormat]::Png)

$centerBrush.Dispose()
$handPen.Dispose()
$amberPen.Dispose()
$cyanPen.Dispose()
$trackPen.Dispose()
$borderPen.Dispose()
$tileBrush.Dispose()
$tilePath.Dispose()
$graphics.Dispose()
$bitmap.Dispose()

Write-Output $OutputPath
