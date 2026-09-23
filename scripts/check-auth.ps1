# The two required cURL checks from section 9 of the assignment, for Windows PowerShell.
# Usage: .\scripts\check-auth.ps1 https://your-app.onrender.com
param([string]$Base = "http://localhost:4000")
$Base = $Base.TrimEnd('/')

Write-Host "Base URL: $Base`n"

Write-Host "# Test 1 - no authentication"
Write-Host "curl.exe -i $Base/api/capsules"
curl.exe -i -s "$Base/api/capsules"
Write-Host "`n# Required: 401 Unauthorized`n"

Write-Host "# Test 2 - fake / invalid JWT"
Write-Host "curl.exe -i -H `"Cookie: token=fake-token-123`" $Base/api/capsules"
curl.exe -i -s -H "Cookie: token=fake-token-123" "$Base/api/capsules"
Write-Host "`n# Required: 401 Unauthorized`n"

Write-Host "# Public health check"
curl.exe -i -s "$Base/api/health"
