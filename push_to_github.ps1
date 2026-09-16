# Helper script to push OfficeTalk to GitHub
$env:PATH = "C:\Users\dbs-540\.gemini\antigravity\bin\node\node-v20.18.0-win-x64;" + $env:PATH
Write-Host "🚀 Pushing OfficeTalk to https://github.com/alapatisagar/office-talkie.git..." -ForegroundColor Cyan
git push -u origin master
if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Successfully pushed to GitHub!" -ForegroundColor Green
} else {
    Write-Host "⚠️ If the repository does not exist on GitHub yet, create it first at https://github.com/new?name=office-talkie" -ForegroundColor Yellow
}
