Write-Host "Instalando dependências do projeto..." -ForegroundColor Green

# Verificar se Python está instalado
if (-not (Get-Command python -ErrorAction SilentlyContinue)) {
    Write-Host "Python não encontrado. Por favor, instale Python 3.9 ou superior." -ForegroundColor Red
    exit 1
}

# Criar ambiente virtual se não existir
if (-not (Test-Path "venv")) {
    Write-Host "Criando ambiente virtual..." -ForegroundColor Yellow
    python -m venv venv
}

# Ativar ambiente virtual
Write-Host "Ativando ambiente virtual..." -ForegroundColor Yellow
& ".\venv\Scripts\Activate.ps1"

# Atualizar pip
Write-Host "Atualizando pip..." -ForegroundColor Yellow
python -m pip install --upgrade pip

# Instalar dependências de produção
Write-Host "Instalando dependências de produção..." -ForegroundColor Yellow
pip install -r requirements.txt

# Instalar dependências de desenvolvimento se existir
if (Test-Path "requirements-dev.txt") {
    Write-Host "Instalando dependências de desenvolvimento..." -ForegroundColor Yellow
    pip install -r requirements-dev.txt
}

Write-Host "Instalação concluída!" -ForegroundColor Green
Write-Host "O ambiente virtual já está ativado." -ForegroundColor Cyan
