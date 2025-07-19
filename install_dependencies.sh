#!/bin/bash

echo "Instalando dependências do projeto..."

# Verificar se estamos em um ambiente virtual
if [[ "$VIRTUAL_ENV" == "" ]]; then
    echo "Criando ambiente virtual..."
    python -m venv venv
    
    # Ativar ambiente virtual
    if [[ "$OSTYPE" == "msys" || "$OSTYPE" == "win32" ]]; then
        source venv/Scripts/activate
    else
        source venv/bin/activate
    fi
fi

# Atualizar pip
python -m pip install --upgrade pip

# Instalar dependências de produção
echo "Instalando dependências de produção..."
pip install -r requirements.txt

# Instalar dependências de desenvolvimento se o arquivo existir
if [ -f "requirements-dev.txt" ]; then
    echo "Instalando dependências de desenvolvimento..."
    pip install -r requirements-dev.txt
fi

echo "Instalação concluída!"
echo "Para ativar o ambiente virtual, use:"
if [[ "$OSTYPE" == "msys" || "$OSTYPE" == "win32" ]]; then
    echo "  source venv/Scripts/activate"
else
    echo "  source venv/bin/activate"
fi
