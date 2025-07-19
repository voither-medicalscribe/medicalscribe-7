# Configuração de Segredos

Este projeto utiliza Azure Key Vault para armazenar todos os segredos de produção. Os segredos **NUNCA** devem ser commitados no repositório.

## Arquivos de Configuração Local

### 1. local.settings.json
Copie `local.settings.template.json` para `local.settings.json` e configure:
```bash
cp local.settings.template.json local.settings.json
```

### 2. api/local.settings.json
Copie `api/local.settings.template.json` para `api/local.settings.json` e configure:
```bash
cp api/local.settings.template.json api/local.settings.json
```

## Configuração do Azure Key Vault

### Pré-requisitos
- Azure CLI instalado
- Acesso ao subscription do Azure
- Permissões para criar Key Vault

### Script de Setup
1. Edite o arquivo `infra/scripts/setup-keyvault.ps1`
2. Substitua todos os placeholders `<your-*>` pelos valores reais
3. Execute o script:
```powershell
cd infra/scripts
.\setup-keyvault.ps1 -ResourceGroup "your-resource-group" -SubscriptionId "your-subscription-id"
```

## Segredos Necessários

O script configurará automaticamente os seguintes segredos no Azure Key Vault:

### Azure Services
- `AZURE-SPEECH-KEY`
- `AZURE-SPEECH-REGION`
- `AZURE-SPEECH-ENDPOINT`
- `AZURE-OPENAI-ENDPOINT`
- `AZURE-OPENAI-KEY`
- `AZURE-OPENAI-SECONDARY-ENDPOINT`
- `AZURE-OPENAI-SECONDARY-KEY`
- `AZURE-TEXT-ANALYTICS-ENDPOINT`
- `AZURE-TEXT-ANALYTICS-KEY`
- `AZURE-SIGNALR-CONNECTION-STRING`

### Database Services
- `MONGODB-CONNECTION-STRING`
- `MONGODB-DATABASE`
- `SQL-SERVER-CONNECTION-STRING`
- `AZURE-REDIS-CONNECTION-STRING`

### Azure AD
- `AZURE-AD-TENANT-ID`
- `AZURE-AD-CLIENT-ID`
- `AZURE-AD-CLIENT-SECRET`

### Storage & Monitoring
- `AZURE-STORAGE-ACCOUNT-NAME`
- `AZURE-STORAGE-CONTAINER`
- `APP-INSIGHTS-CONNECTION-STRING`
- `APP-INSIGHTS-INSTRUMENTATION-KEY`

## Desenvolvimento Local

Para desenvolvimento local, você pode:
1. Usar os templates de configuração
2. Configurar variáveis de ambiente
3. Usar Azure Key Vault localmente com Managed Identity

## Segurança

⚠️ **IMPORTANTE**: 
- Nunca commite arquivos com segredos reais
- Use sempre placeholders nos templates
- Verifique o .gitignore antes de fazer push
- Configure Managed Identity para produção
