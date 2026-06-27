# Build the web app, stage it for Firebase Hosting, and deploy on Windows (PowerShell).
# Keep in sync with the staging logic in scripts/deploy.sh.

$Root = Split-Path -Parent $PSScriptRoot

# Fail fast if project id was never set
$rcPath = Join-Path $Root ".firebaserc"
if (Test-Path $rcPath) {
    $content = Get-Content $rcPath -Raw
    if ($content -like "*REPLACE_ME*") {
        Write-Error "[ERROR] .firebaserc still contains REPLACE_ME. Set your real Firebase project id first."
        exit 1
    }
}

Write-Host "--> Building app/ ..." -ForegroundColor Cyan
Set-Location (Join-Path $Root "app")
npm run build

Write-Host "--> Staging dist/ into firebase/app/ ..." -ForegroundColor Cyan
$firebaseAppDir = Join-Path $Root "firebase/app"
if (Test-Path $firebaseAppDir) {
    Remove-Item -Recurse -Force $firebaseAppDir
}
Copy-Item -Recurse -Force (Join-Path $Root "app/dist") $firebaseAppDir

Write-Host "--> Deploying to Firebase ..." -ForegroundColor Cyan
Set-Location (Join-Path $Root "firebase")
firebase deploy

Write-Host "[SUCCESS] Deploy complete." -ForegroundColor Green
