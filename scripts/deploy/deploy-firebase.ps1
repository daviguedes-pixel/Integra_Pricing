# Script de Deploy para Firebase Hosting
# Execute este script após fazer login no Firebase

Write-Host "🚀 Iniciando deploy para Firebase Hosting..." -ForegroundColor Cyan

# Verificar se está logado
Write-Host "`n📋 Verificando autenticação Firebase..." -ForegroundColor Yellow
firebase projects:list 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Você precisa fazer login no Firebase primeiro!" -ForegroundColor Red
    Write-Host "Execute: firebase login" -ForegroundColor Yellow
    exit 1
}

# Verificar se o build existe
if (-not (Test-Path "dist")) {
    Write-Host "`n📦 Build não encontrado. Fazendo build..." -ForegroundColor Yellow
    npm run build
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Erro ao fazer build!" -ForegroundColor Red
        exit 1
    }
}

# Verificar se há projeto Firebase configurado
if (-not (Test-Path ".firebaserc")) {
    Write-Host "`n⚙️  Configurando projeto Firebase..." -ForegroundColor Yellow
    Write-Host "Por favor, selecione ou crie um projeto Firebase:" -ForegroundColor Cyan
    firebase init hosting
}

# Fazer deploy
Write-Host "`n🚀 Fazendo deploy para Firebase Hosting..." -ForegroundColor Green
firebase deploy --only hosting

if ($LASTEXITCODE -eq 0) {
    Write-Host "`n✅ Deploy concluído com sucesso!" -ForegroundColor Green
    Write-Host "🌐 Seu site está no ar!" -ForegroundColor Cyan
} else {
    Write-Host "`n❌ Erro durante o deploy!" -ForegroundColor Red
    exit 1
}

