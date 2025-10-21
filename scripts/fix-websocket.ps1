# WebSocket Integration Fix Script
# Installs Socket.IO dependencies and verifies setup

Write-Host ""
Write-Host "🔧 WebSocket Integration Fix" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

# Check if we're in the right directory
if (-not (Test-Path "apps/web/package.json")) {
    Write-Host "❌ Error: Must run from project root" -ForegroundColor Red
    Write-Host "   Current directory: $(Get-Location)" -ForegroundColor Yellow
    exit 1
}

Write-Host "📦 Installing Socket.IO dependencies..." -ForegroundColor Yellow
cd apps/web

# Install dependencies
Write-Host "   Running: pnpm add socket.io socket.io-client" -ForegroundColor Gray
pnpm add socket.io@^4.7.2 socket.io-client@^4.7.2

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to install dependencies" -ForegroundColor Red
    exit 1
}

Write-Host "✅ Dependencies installed successfully" -ForegroundColor Green
Write-Host ""

# Verify installation
Write-Host "🔍 Verifying installation..." -ForegroundColor Yellow
$socketIO = pnpm list socket.io 2>&1 | Select-String "socket.io"
$socketIOClient = pnpm list socket.io-client 2>&1 | Select-String "socket.io-client"

if ($socketIO -and $socketIOClient) {
    Write-Host "✅ Socket.IO packages verified:" -ForegroundColor Green
    Write-Host "   $socketIO" -ForegroundColor Gray
    Write-Host "   $socketIOClient" -ForegroundColor Gray
} else {
    Write-Host "⚠️  Warning: Could not verify package installation" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "📋 Next Steps:" -ForegroundColor Cyan
Write-Host "   1. Restart your development server" -ForegroundColor White
Write-Host "      cd apps/web" -ForegroundColor Gray
Write-Host "      pnpm dev" -ForegroundColor Gray
Write-Host ""
Write-Host "   2. Check server logs for:" -ForegroundColor White
Write-Host "      > WebSocket server ready on ws://..." -ForegroundColor Gray
Write-Host ""
Write-Host "   3. Open browser and check console for:" -ForegroundColor White
Write-Host "      Socket connected: <id>" -ForegroundColor Gray
Write-Host ""
Write-Host "✅ WebSocket fix complete!" -ForegroundColor Green
Write-Host ""
Write-Host "📚 For more details, see:" -ForegroundColor Cyan
Write-Host "   .kiro/specs/websocket/WEBSOCKET_INTEGRATION_FIX.md" -ForegroundColor Gray
Write-Host ""

cd ../..
