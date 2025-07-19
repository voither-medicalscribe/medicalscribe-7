#!/bin/bash

# Variáveis
KEYVAULT_NAME="MedScriber"
MANAGED_IDENTITY_OBJECT_ID="37ab2041-cac2-49e0-b29f-79ca728eaf7c"
RESOURCE_GROUP="rg-medicalscribe"

# Atribuir permissões de leitura de segredos para a Managed Identity
az keyvault set-policy \
    --name $KEYVAULT_NAME \
    --resource-group $RESOURCE_GROUP \
    --object-id $MANAGED_IDENTITY_OBJECT_ID \
    --secret-permissions get list

echo "Permissões do Key Vault configuradas para Managed Identity"
