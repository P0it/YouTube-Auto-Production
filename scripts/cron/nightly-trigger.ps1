# Nightly trigger for the YouTube auto-production pipeline (Windows).
# See docs\scheduling.md for schtasks setup.

$ErrorActionPreference = "Stop"

$Date = Get-Date -Format "yyyy-MM-dd"
$Slug = "nightly-$Date"
$Theme = $env:NIGHTLY_THEME
$BaseUrl = if ($env:DASHBOARD_URL) { $env:DASHBOARD_URL } else { "http://localhost:3000" }

$Body = @{
  id       = $Slug
  theme    = $Theme
  language = "ko"
} | ConvertTo-Json

Write-Host "[nightly] POST $BaseUrl/api/projects slug=$Slug theme='$Theme'"
Invoke-RestMethod -Method POST -Uri "$BaseUrl/api/projects" `
  -ContentType "application/json" -Body $Body
