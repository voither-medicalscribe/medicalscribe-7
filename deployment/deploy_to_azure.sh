#!/bin/bash

# Variáveis de configuração
RESOURCE_GROUP="rg-medicalscribe"
FUNCTION_APP_NAME="medicalscribe-functions"
STORAGE_ACCOUNT="medscriberstorage"
LOCATION="brazilsouth"

echo "Iniciando deployment para Azure..."

# Criar arquivo zip para deployment
echo "Criando pacote de deployment..."
cd ..
zip -r deploy.zip . -x "*.git*" -x "*venv*" -x "*.vscode*" -x "*__pycache__*" -x "*.pytest_cache*" -x "local.settings.json"

# Deploy para Azure Functions
echo "Fazendo deploy para Azure Functions..."
az functionapp deployment source config-zip \
    --resource-group $RESOURCE_GROUP \
    --name $FUNCTION_APP_NAME \
    --src deploy.zip

# Configurar settings da aplicação
echo "Configurando application settings..."
az functionapp config appsettings set \
    --name $FUNCTION_APP_NAME \
    --resource-group $RESOURCE_GROUP \
    --settings \
    "AZURE_KEYVAULT_URL=https://medscriber.vault.azure.net/" \
    "AZURE_FUNCTIONS_ENVIRONMENT=Production" \
    "WEBSITE_RUN_FROM_PACKAGE=1"

# Atribuir Managed Identity ao Function App
echo "Configurando Managed Identity..."
az functionapp identity assign \
    --name $FUNCTION_APP_NAME \
    --resource-group $RESOURCE_GROUP \
    --identities "/subscriptions/2290fbe4-e0ae-46e4-9bdd-dd5f7b5397d5/resourcegroups/rg-medicalscribe/providers/Microsoft.ManagedIdentity/userAssignedIdentities/id-medicalscriberWeb-kg3kz4ih63c4c"

echo "Deploy concluído!"
echo "URL da aplicação: https://$FUNCTION_APP_NAME.azurewebsites.net"

# Limpar arquivo temporário
rm deploy.zip
