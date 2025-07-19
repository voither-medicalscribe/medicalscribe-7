# Gerenciamento de Secrets - VOITHER MedicalScribe

## Visão Geral

Este projeto usa Azure Key Vault para gerenciar secrets de forma segura. Em desenvolvimento, você pode usar variáveis de ambiente como fallback.

## Configuração Inicial

### 1. Azure Key Vault (Produção)

```bash
# Executar o script de configuração
./infra/scripts/setup-keyvault.ps1 -KeyVaultName "kv-medicalscribe"
```

### 2. Desenvolvimento Local

1. Copie `.env.example` para `.env`
2. Adicione os valores dos secrets
3. Nunca commite o arquivo `.env`!

## Validação

Execute o script de validação para verificar se todos os secrets estão configurados:

```bash
python scripts/validate-secrets.py
```

## Lista de Secrets

### Azure Cognitive Services
- `AZURE_SPEECH_KEY`: Chave do Speech Services
- `AZURE_SPEECH_REGION`: Região (brazilsouth)
- `AZURE_SPEECH_ENDPOINT`: Endpoint do serviço

### Azure OpenAI
- `AZURE_OPENAI_ENDPOINT`: Endpoint principal
- `AZURE_OPENAI_KEY`: Chave de acesso
- `AZURE_OPENAI_DEPLOYMENT`: Nome do deployment (gpt-4o)
- `AZURE_OPENAI_DEPLOYMENT_MINI`: Deployment mini (gpt-4o-mini)

### Bancos de Dados
- `MONGODB_CONNECTION_STRING`: String de conexão MongoDB
- `MONGODB_DATABASE`: Nome do banco de dados
- `SQL_SERVER_CONNECTION_STRING`: String de conexão SQL Server

### Outros Serviços
- `AZURE_SIGNALR_CONNECTION_STRING`: SignalR para real-time
- `AZURE_REDIS_CONNECTION_STRING`: Cache Redis
- `APP_INSIGHTS_CONNECTION_STRING`: Application Insights

## Boas Práticas

1. **Nunca hardcode secrets no código**
2. **Use Key Vault em produção**
3. **Rotacione secrets regularmente**
4. **Use Managed Identity quando possível**
5. **Monitore acesso aos secrets**

## Troubleshooting

### Secret não encontrado
- Verifique se o nome está correto (use `-` para Key Vault, `_` para env vars)
- Execute o script de validação
- Verifique permissões no Key Vault

### Erro de autenticação
- Verifique se está logado no Azure CLI: `az login`
- Verifique permissões no Key Vault
- Em produção, verifique Managed Identity

## Segurança

⚠️ **IMPORTANTE**: 
- Nunca commite secrets no repositório
- Adicione arquivos com secrets ao `.gitignore`
- Use RBAC para controlar acesso ao Key Vault
- Habilite logs de auditoria no Key Vault
