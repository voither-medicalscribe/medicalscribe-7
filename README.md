# VOITHER MedicalScribe - Cloudflare Worker Edition

Uma aplicação de assistente clínico para psiquiatras que transcreve consultas em tempo real e utiliza IA para gerar documentação e fornecer suporte consultivo.

**Agora deployado como Cloudflare Worker!**

## Estrutura do Projeto

- **Frontend**: React + Vite (pasta `/src`)
- **Backend**: Cloudflare Worker (pasta `/worker`)
- **Config**: `wrangler.jsonc` para configuração do Worker

## Run Locally

**Prerequisites:** Node.js 18+

### Frontend (React)

1. Install dependencies:
   ```bash
   npm install
   ```

2. Configure environment variables (create `.env` file)

3. Run the frontend:
   ```bash
   npm run dev
   ```

### Backend (Cloudflare Worker)

1. Install wrangler globally (optional):
   ```bash
   npm install -g wrangler
   ```

2. Login to Cloudflare:
   ```bash
   wrangler login
   ```

3. Configure secrets (see CLOUDFLARE_WORKER_SETUP.md)

4. Run the worker locally:
   ```bash
   npm run dev:worker
   ```

## Deploy

### Deploy Worker to Cloudflare:

```bash
npm run deploy:worker
```

### Deploy Frontend:

Build and deploy the frontend to Cloudflare Pages or another static hosting service:

```bash
npm run build
```

## Documentation

- [Cloudflare Worker Setup Guide](./CLOUDFLARE_WORKER_SETUP.md) - Detailed setup instructions
- [Secrets Setup](./SECRETS_SETUP.md) - Azure and environment configuration
