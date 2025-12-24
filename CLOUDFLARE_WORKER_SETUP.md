# Cloudflare Worker Deployment Guide

Este projeto foi transformado para ser deployado como um Cloudflare Worker.

## Estrutura do Projeto

```
/worker
  /index.ts          - Entry point do Worker
  /handlers          - Handlers de API específicos (se necessário)
/wrangler.jsonc      - Configuração do Wrangler
/tsconfig.worker.json - TypeScript config para o Worker
```

## Pré-requisitos

1. Conta Cloudflare
2. Node.js 18+ instalado
3. Wrangler CLI instalado: `npm install -g wrangler`

## Configuração

### 1. Login no Cloudflare

```bash
wrangler login
```

### 2. Configurar Variáveis de Ambiente

Crie os secrets necessários:

```bash
# Azure Speech Service
wrangler secret put AZURE_SPEECH_KEY
wrangler secret put AZURE_SPEECH_REGION

# Azure OpenAI
wrangler secret put AZURE_OPENAI_ENDPOINT
wrangler secret put AZURE_OPENAI_KEY
wrangler secret put AZURE_OPENAI_DEPLOYMENT

# MongoDB (se necessário)
wrangler secret put MONGODB_CONNECTION_STRING
wrangler secret put MONGODB_DATABASE
```

### 3. Criar KV Namespace (para sessões)

```bash
# Produção
wrangler kv:namespace create "SESSIONS_KV"

# Preview/Dev
wrangler kv:namespace create "SESSIONS_KV" --preview
```

Copie os IDs gerados e atualize o `wrangler.jsonc`.

### 4. (Opcional) Configurar D1 Database

Se você precisa de um banco de dados SQL:

```bash
wrangler d1 create medicalscribe-db
```

Descomente a seção `d1_databases` no `wrangler.jsonc` e adicione o ID gerado.

### 5. (Opcional) Configurar R2 Storage

Para armazenar arquivos de áudio:

```bash
wrangler r2 bucket create medicalscribe-audio
```

Descomente a seção `r2_buckets` no `wrangler.jsonc`.

## Desenvolvimento Local

Execute o worker localmente:

```bash
npm run dev:worker
```

Isso iniciará o worker em `http://localhost:8787`

## Deploy

### Deploy para produção:

```bash
npm run deploy:worker
```

ou

```bash
wrangler deploy
```

## API Endpoints

O worker expõe os seguintes endpoints:

- `GET /api/get_speech_token` - Obtém token do Azure Speech Service
- `GET/POST/PUT/DELETE /api/patient_management` - CRUD de pacientes
- `POST /api/negotiate` - Negociação SignalR (requer Durable Objects)
- `POST /api/realtime_transcription` - Transcrição em tempo real
- `POST /api/send_message` - Enviar mensagens
- `POST /api/run_analysis_pipeline` - Executar pipeline de análise

## Notas Importantes

### Limitações do Cloudflare Workers

1. **CPU Time**: Workers têm um limite de 50ms de CPU time por request (pode ser aumentado com plano pago)
2. **Memory**: 128MB de memória por request
3. **WebSockets**: Requer Durable Objects para WebSocket connections persistentes
4. **Python**: Workers não suportam Python - todo código foi portado para TypeScript

### Funcionalidades que requerem implementação adicional

1. **SignalR**: Requer Durable Objects ou serviço externo para WebSocket real-time
2. **Azure Speech SDK**: A transcrição em tempo real precisa ser reimplementada com chamadas HTTP
3. **MongoDB**: Considere migrar para D1 (SQL) ou usar MongoDB Atlas via HTTP
4. **Blob Storage**: Use R2 para armazenamento de arquivos

## Troubleshooting

### Verificar logs

```bash
wrangler tail
```

### Testar localmente

```bash
wrangler dev
```

### Ver secrets configurados

```bash
wrangler secret list
```

## Próximos Passos

1. Configurar Durable Objects para funcionalidades real-time
2. Migrar MongoDB para D1 ou manter conexão externa via HTTPS
3. Implementar autenticação JWT
4. Configurar domínio customizado
5. Adicionar rate limiting e caching

## Suporte

Para mais informações sobre Cloudflare Workers:
- [Documentação oficial](https://developers.cloudflare.com/workers/)
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/)
- [Durable Objects](https://developers.cloudflare.com/durable-objects/)
