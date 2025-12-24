# Migration Guide: Azure Functions → Cloudflare Workers

Este documento descreve as mudanças principais na transformação do projeto de Azure Functions para Cloudflare Workers.

## Resumo das Mudanças

### Arquitetura

**Antes (Azure):**
- Frontend: Azure Static Web Apps
- Backend: Azure Functions (Python)
- Banco de dados: MongoDB (Azure CosmosDB)
- Storage: Azure Blob Storage
- Real-time: Azure SignalR Service
- Speech: Azure Speech SDK (Python)

**Depois (Cloudflare):**
- Frontend: Pode ser deployado em Cloudflare Pages ou qualquer host estático
- Backend: Cloudflare Workers (TypeScript)
- Banco de dados: Cloudflare D1 (SQL) ou MongoDB externo via HTTPS
- Storage: Cloudflare R2
- Real-time: Cloudflare Durable Objects (requer implementação adicional)
- Speech: Azure Speech Service via HTTP API

## Estrutura de Arquivos

### Novos Arquivos

```
/worker/
  index.ts              # Entry point do Cloudflare Worker (TypeScript)
  
wrangler.jsonc          # Configuração do Wrangler CLI
tsconfig.worker.json    # TypeScript config específica para o worker
.dev.vars.example       # Template de variáveis de ambiente para dev
.dev.vars               # Variáveis de ambiente locais (não commitado)
CLOUDFLARE_WORKER_SETUP.md  # Guia de setup detalhado
```

### Arquivos Mantidos (mas não mais usados em produção)

```
/api/                   # Azure Functions Python (legacy)
host.json               # Azure Functions config (legacy)
staticwebapp.config.json # Azure SWA config (legacy)
```

## Principais Diferenças Técnicas

### 1. Linguagem: Python → TypeScript

Todos os endpoints da API foram reescritos de Python para TypeScript para compatibilidade com Cloudflare Workers.

**Exemplo - Get Speech Token:**

**Antes (Python):**
```python
async def main(req: func.HttpRequest) -> func.HttpResponse:
    response = requests.post(token_endpoint, headers=headers)
    return func.HttpResponse(json.dumps(result))
```

**Depois (TypeScript):**
```typescript
async function handleGetSpeechToken(request: Request, env: Env): Promise<Response> {
    const response = await fetch(tokenEndpoint, { headers });
    return jsonResponse(result);
}
```

### 2. Variáveis de Ambiente

**Antes (Azure):**
- Configuradas via Azure Portal ou `local.settings.json`
- Acesso via `os.environ` em Python

**Depois (Cloudflare):**
- Configuradas via `wrangler secret` ou Cloudflare Dashboard
- Para dev local: arquivo `.dev.vars`
- Acesso via `env` object no worker

**Comandos:**
```bash
# Azure
# Configurado no portal ou local.settings.json

# Cloudflare
wrangler secret put AZURE_SPEECH_KEY
```

### 3. Storage de Dados

**Antes (Azure):**
- MongoDB via PyMongo
- Connection string direto do Azure

**Depois (Cloudflare):**
- **Opção 1**: Cloudflare D1 (banco SQL serverless)
- **Opção 2**: MongoDB Atlas via HTTPS (Data API)
- **Opção 3**: Cloudflare KV para dados simples key-value

**Exemplo com KV:**
```typescript
// Salvar sessão
await env.SESSIONS_KV.put(
  `session:${sessionId}`,
  JSON.stringify(sessionData),
  { expirationTtl: 86400 }
);

// Recuperar sessão
const data = await env.SESSIONS_KV.get(`session:${sessionId}`);
const session = JSON.parse(data);
```

### 4. File Storage

**Antes (Azure):**
- Azure Blob Storage
- SDK Python

**Depois (Cloudflare):**
- Cloudflare R2 (S3-compatible)

**Exemplo:**
```typescript
// Upload para R2
await env.AUDIO_STORAGE.put('audio.wav', audioBuffer, {
  httpMetadata: { contentType: 'audio/wav' }
});

// Download
const object = await env.AUDIO_STORAGE.get('audio.wav');
const blob = await object.blob();
```

### 5. Real-time Communication (SignalR)

**Antes (Azure):**
- Azure SignalR Service (built-in)
- Binding automático em Azure Functions

**Depois (Cloudflare):**
- **Requer implementação com Durable Objects**
- Durable Objects fornecem WebSocket persistente
- Requer código adicional (não incluído nesta versão inicial)

**Próximos passos para implementar:**
1. Criar Durable Object para gerenciar conexões WebSocket
2. Implementar broadcast de mensagens
3. Atualizar frontend para conectar ao Durable Object

### 6. Transcrição em Tempo Real

**Antes (Azure):**
- Azure Speech SDK (Python) com streaming
- Push audio stream diretamente

**Depois (Cloudflare):**
- HTTP API do Azure Speech Service
- Requer implementação alternativa para streaming
- Pode usar WebSockets via Durable Objects

### 7. Limites e Considerações

| Característica | Azure Functions | Cloudflare Workers |
|---------------|-----------------|-------------------|
| CPU Time | ~10 min (configurable) | 50ms (standard), 30s (unbound workers) |
| Memory | ~1.5GB | 128MB |
| Request Size | ~100MB | 100MB |
| Response Size | ~100MB | 100MB |
| Linguagem | Python, Node, .NET, Java | JavaScript/TypeScript only |
| Cold Start | ~5-10s (Python) | <1ms |
| Custo | Pay per execution | 100k requests/day grátis |
| Localização | Regions específicas | Edge global (275+ cidades) |

## Funcionalidades Implementadas

✅ **Implementado nesta versão:**
- Estrutura básica do Worker
- Roteamento de API (/api/*)
- CORS headers
- Get Speech Token (Azure Speech)
- Patient Management (CRUD simplificado)
- Environment variables e secrets
- TypeScript com tipos corretos
- Configuração do Wrangler

⚠️ **Parcialmente implementado (requer trabalho adicional):**
- SignalR/Real-time (placeholder, requer Durable Objects)
- Realtime Transcription (skeleton, requer WebSocket)
- Analysis Pipeline (simplificado)
- Database operations (usando placeholders)

❌ **Não implementado (requer implementação futura):**
- Durable Objects para WebSocket real-time
- Integração completa com MongoDB/D1
- Upload/download de arquivos via R2
- Autenticação JWT completa
- Rate limiting
- Logging/monitoring avançado

## Scripts NPM

```json
{
  "dev": "vite",              // Frontend dev server
  "dev:worker": "wrangler dev", // Worker dev server local
  "build": "tsc && vite build", // Build frontend
  "build:worker": "...",        // Worker é built pelo wrangler
  "deploy:worker": "wrangler deploy", // Deploy worker para Cloudflare
  "preview": "vite preview"     // Preview frontend build
}
```

## Deployment

### Frontend
O frontend React continua funcionando da mesma forma. Deploy para:
- Cloudflare Pages
- Vercel
- Netlify
- Ou qualquer host de SPA

### Backend (Worker)
```bash
# 1. Configure secrets
wrangler secret put AZURE_SPEECH_KEY

# 2. Configure KV/D1/R2 namespaces
wrangler kv:namespace create "SESSIONS_KV"

# 3. Atualize wrangler.jsonc com os IDs gerados

# 4. Deploy
npm run deploy:worker
```

## Próximos Passos Recomendados

1. **Implementar Durable Objects** para funcionalidades real-time (SignalR replacement)
2. **Migrar para D1** ou configurar MongoDB Atlas Data API
3. **Configurar R2** para storage de arquivos de áudio
4. **Implementar autenticação** JWT completa
5. **Adicionar monitoring** com Cloudflare Analytics
6. **Configurar domínio customizado** no Cloudflare
7. **Implementar cache** com Cloudflare Cache API
8. **Rate limiting** com Cloudflare Rate Limiting

## Recursos e Documentação

- [Cloudflare Workers Docs](https://developers.cloudflare.com/workers/)
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/)
- [Durable Objects](https://developers.cloudflare.com/durable-objects/)
- [Cloudflare D1](https://developers.cloudflare.com/d1/)
- [Cloudflare R2](https://developers.cloudflare.com/r2/)
- [Cloudflare KV](https://developers.cloudflare.com/kv/)

## Suporte

Para questões sobre a migração, consulte:
- CLOUDFLARE_WORKER_SETUP.md - Setup detalhado
- README.md - Instruções gerais
- wrangler.jsonc - Configuração do worker
