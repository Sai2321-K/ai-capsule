# Builds the submission ZIP, excluding node_modules, build output, data and secrets.
# Usage from the project root:  .\scripts\make-zip.ps1
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$stage = Join-Path $env:TEMP "ai-capsule-submission"
$zip = Join-Path $root "ai-capsule-submission.zip"

if (Test-Path $stage) { Remove-Item $stage -Recurse -Force }
if (Test-Path $zip) { Remove-Item $zip -Force }
New-Item -ItemType Directory -Path $stage | Out-Null

$exclude = @('node_modules', 'dist', 'build', 'data', '.git', '.env')

Get-ChildItem -Path $root -Recurse -File | Where-Object {
  $rel = $_.FullName.Substring($root.Length + 1)
  $parts = $rel -split '\\'
  $skip = $false
  foreach ($part in $parts) { if ($exclude -contains $part) { $skip = $true } }
  if ($_.Name -eq '.env') { $skip = $true }
  if ($_.Name -like '*.db*') { $skip = $true }
  if ($_.Name -eq 'ai-capsule-submission.zip') { $skip = $true }
  -not $skip
} | ForEach-Object {
  $rel = $_.FullName.Substring($root.Length + 1)
  $dest = Join-Path $stage $rel
  New-Item -ItemType Directory -Path (Split-Path $dest -Parent) -Force | Out-Null
  Copy-Item $_.FullName $dest
}

Compress-Archive -Path (Join-Path $stage '*') -DestinationPath $zip
Remove-Item $stage -Recurse -Force

Write-Host "Created $zip"
Write-Host "Contents:"
Expand-Archive -Path $zip -DestinationPath (Join-Path $env:TEMP "ai-capsule-verify") -Force
Get-ChildItem (Join-Path $env:TEMP "ai-capsule-verify") -Recurse -File | ForEach-Object { $_.FullName.Substring((Join-Path $env:TEMP "ai-capsule-verify").Length + 1) }
Remove-Item (Join-Path $env:TEMP "ai-capsule-verify") -Recurse -Force
