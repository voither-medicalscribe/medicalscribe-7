param(
    [Parameter(Mandatory=$true)]
    [string]$KeyVaultName = "kv-medicalscribe",
    
    [Parameter(Mandatory=$false)]
    [string]$ResourceGroup = "rg-medicalscribe",
    
    [Parameter(Mandatory=$false)]
    [string]$Location = "brazilsouth"
)

Write-Host "Configurando Azure Key Vault..." -ForegroundColor Green

# Criar Key Vault se não existir
$keyVault = az keyvault show --name $KeyVaultName --resource-group $ResourceGroup 2>$null | ConvertFrom-Json
if (-not $keyVault) {
    Write-Host "Criando Key Vault..." -ForegroundColor Yellow
    az keyvault create `
        --name $KeyVaultName `
        --resource-group $ResourceGroup `
        --location $Location `
        --sku standard
}

# Função para adicionar secret
function Add-Secret {
    param(
        [string]$Name,
        [string]$Value
    )
    
    Write-Host "Adicionando secret: $Name" -ForegroundColor Cyan
    az keyvault secret set `
        --vault-name $KeyVaultName `
        --name $Name `
        --value $Value `
        --output none
}

# Azure Cognitive Services - Speech
# SUBSTITUA PELOS SEUS VALORES REAIS
Add-Secret -Name "AZURE-SPEECH-KEY" -Value "<your-azure-speech-key>"
Add-Secret -Name "AZURE-SPEECH-REGION" -Value "brazilsouth"
Add-Secret -Name "AZURE-SPEECH-ENDPOINT" -Value "<your-azure-speech-endpoint>"

# Azure OpenAI - Principal
Add-Secret -Name "AZURE-OPENAI-ENDPOINT" -Value "<your-azure-openai-endpoint>"
Add-Secret -Name "AZURE-OPENAI-KEY" -Value "<your-azure-openai-key>"
Add-Secret -Name "AZURE-OPENAI-DEPLOYMENT" -Value "gpt-4o"
Add-Secret -Name "AZURE-OPENAI-DEPLOYMENT-MINI" -Value "gpt-4o-mini"

# Azure OpenAI - Secondary
Add-Secret -Name "AZURE-OPENAI-SECONDARY-ENDPOINT" -Value "<your-azure-openai-secondary-endpoint>"
Add-Secret -Name "AZURE-OPENAI-SECONDARY-KEY" -Value "<your-azure-openai-secondary-key>"
Add-Secret -Name "AZURE-OPENAI-SECONDARY-DEPLOYMENT" -Value "gpt-4o-summary"
Add-Secret -Name "AZURE-OPENAI-WHISPER-DEPLOYMENT" -Value "whisper"

# Azure Text Analytics
Add-Secret -Name "AZURE-TEXT-ANALYTICS-ENDPOINT" -Value "<your-azure-text-analytics-endpoint>"
Add-Secret -Name "AZURE-TEXT-ANALYTICS-KEY" -Value "<your-azure-text-analytics-key>"

# Azure SignalR
Add-Secret -Name "AZURE-SIGNALR-CONNECTION-STRING" -Value "<your-azure-signalr-connection-string>"

# MongoDB Atlas
Add-Secret -Name "MONGODB-CONNECTION-STRING" -Value "<your-mongodb-connection-string>"
Add-Secret -Name "MONGODB-DATABASE" -Value "voither_medical"

# Azure SQL Server
Add-Secret -Name "SQL-SERVER-CONNECTION-STRING" -Value "<your-sql-server-connection-string>"

# Azure Redis Cache
Add-Secret -Name "AZURE-REDIS-CONNECTION-STRING" -Value "<your-azure-redis-connection-string>"

# Azure Blob Storage
Add-Secret -Name "AZURE-STORAGE-ACCOUNT-NAME" -Value "<your-storage-account-name>"
Add-Secret -Name "AZURE-STORAGE-CONTAINER" -Value "audio-recordings"

# Azure AD B2C
Add-Secret -Name "AZURE-AD-TENANT-ID" -Value "<your-azure-ad-tenant-id>"
Add-Secret -Name "AZURE-AD-CLIENT-ID" -Value "<your-azure-ad-client-id>"
Add-Secret -Name "AZURE-AD-CLIENT-SECRET" -Value "<your-azure-ad-client-secret>"

# Application Insights
Add-Secret -Name "APP-INSIGHTS-CONNECTION-STRING" -Value "<your-app-insights-connection-string>"
Add-Secret -Name "APP-INSIGHTS-INSTRUMENTATION-KEY" -Value "<your-app-insights-instrumentation-key>"

# Azure Resource Info
Add-Secret -Name "AZURE-SUBSCRIPTION-ID" -Value "2290fbe4-e0ae-46e4-9bdd-dd5f7b5397d5"
Add-Secret -Name "AZURE-RESOURCE-GROUP" -Value "rg-medicalscribe"
Add-Secret -Name "AZURE-LOCATION" -Value "brazilsouth"

Write-Host "Key Vault configurado com sucesso!" -ForegroundColor Green
Write-Host "URL do Key Vault: https://$KeyVaultName.vault.azure.net/" -ForegroundColor Yellow
