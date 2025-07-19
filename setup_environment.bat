@echo off
echo Configurando ambiente Azure Functions...

REM Criar ambiente virtual se não existir
if not exist ".venv" (
    echo Criando ambiente virtual...
    python -m venv .venv
)

REM Ativar ambiente virtual
echo Ativando ambiente virtual...
call .venv\Scripts\activate.bat

REM Atualizar pip
echo Atualizando pip...
python -m pip install --upgrade pip

REM Instalar dependências
echo Instalando dependências...
pip install -r requirements.txt

REM Verificar instalação
echo.
echo Verificando instalação do azure-functions...
pip show azure-functions

echo.
echo Ambiente configurado com sucesso!
pause
