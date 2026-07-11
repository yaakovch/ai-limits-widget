$ErrorActionPreference = "SilentlyContinue"

$inputJson = [Console]::In.ReadToEnd()
if ([string]::IsNullOrWhiteSpace($inputJson)) {
  exit 0
}

try {
  $data = $inputJson | ConvertFrom-Json -ErrorAction Stop
} catch {
  Write-Output "Limits unavailable"
  exit 0
}

$rateLimits = $data.rate_limits
$modelName = if ($data.model.display_name) { $data.model.display_name } else { "Claude" }
$contextUsed = $data.context_window.used_percentage
$contextText = if ($null -ne $contextUsed) { "ctx $([math]::Round([double]$contextUsed, 0))%" } else { "ctx --" }

if ($null -eq $rateLimits -or ($null -eq $rateLimits.five_hour -and $null -eq $rateLimits.seven_day)) {
  Write-Output "$modelName | $contextText | limits waiting"
  exit 0
}

$appDir = Join-Path $env:APPDATA "AI Limits Widget"
$cachePath = Join-Path $appDir "claude-limits.json"
New-Item -ItemType Directory -Force -Path $appDir | Out-Null

function New-LimitWindow($id, $usedPercent, $resetsAt, $durationMinutes) {
  if ($null -eq $usedPercent) {
    $used = $null
    $remaining = $null
  } else {
    $used = [math]::Max([double]0, [math]::Min([double]100, [double]$usedPercent))
    $remaining = [math]::Max([double]0, [math]::Min([double]100, [double](100 - $used)))
  }

  return [ordered]@{
    id = $id
    label = if ($id -eq "fiveHour") { "5h" } else { "Weekly" }
    usedPercent = $used
    remainingPercent = $remaining
    resetsAt = $resetsAt
    durationMinutes = $durationMinutes
  }
}

$windows = [ordered]@{}
if ($null -ne $rateLimits.five_hour) {
  $windows.fiveHour = New-LimitWindow "fiveHour" $rateLimits.five_hour.used_percentage $rateLimits.five_hour.resets_at 300
}
if ($null -ne $rateLimits.seven_day) {
  $windows.weekly = New-LimitWindow "weekly" $rateLimits.seven_day.used_percentage $rateLimits.seven_day.resets_at 10080
}

$payload = [ordered]@{
  version = 1
  provider = "claude"
  source = "claude-statusline"
  fetchedAt = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
  windows = $windows
}

$json = $payload | ConvertTo-Json -Depth 8
$utf8NoBom = [System.Text.UTF8Encoding]::new($false)
[System.IO.File]::WriteAllText($cachePath, $json, $utf8NoBom)

$five = if ($null -ne $windows.fiveHour.usedPercent) { "5h $([math]::Round($windows.fiveHour.usedPercent, 1))% used" } else { "5h --" }
$week = if ($null -ne $windows.weekly.usedPercent) { "7d $([math]::Round($windows.weekly.usedPercent, 1))% used" } else { "7d --" }
Write-Output "$modelName | $contextText | $five | $week"
