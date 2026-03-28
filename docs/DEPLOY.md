# Zeus CRM Pro - Guide de Deploy

## Pre-requisitos
- Node.js 18+
- Firebase Blaze plan (recomendado) ou Spark
- Service Account do Firebase (JSON)

## Setup Local

```bash
# 1. Clone e instale
cd zeus-crm-pro
npm install

# 2. Configure variaveis de ambiente
cp .env.example .env
# Edite o .env com suas credenciais

# 3. Gere a Service Account do Firebase:
# - Va em Firebase Console > Project Settings > Service Accounts
# - Clique "Generate new private key"
# - Copie clientEmail e privateKey para o .env

# 4. Rode o servidor
npm run dev
# Acesse: http://localhost:3000
```

## Deploy no Render.com (Recomendado - Gratuito)

1. Crie uma conta em https://render.com
2. Conecte seu repositorio GitHub
3. Crie{ um "New Web Service"
4. Configure:
   - Build Command: `npm install`
   - Start Command: `node server/index.js`
5. Adicione as Environment Variables (do .env)
6. Deploy!

URL final: `https://zeus-crm-pro.onrender.com`

## Deploy no Railway.app

1. Crie conta em https://railway.app
2. New Project > Deploy from GitHub
3. Adicione Environment Variables
4. Deploy automatico!

## Deploy com Docker

```bash
# Build
docker build -t zeus-crm-pro .

# Run
docker run -d -p 3000:3000 --env-file .env zeus-crm-pro

# Ou com Docker Compose
docker-compose up -d
```

## Configurar Dominio Customizado

Apos deploy, configure o DNS:
- CNAME: `api.zeusgetquote.com` -> URL do Render/Railway
- Ou configure diretamente no painel do provedor

## API Endpoints

Base URL: `https://api.zeusgetquote.com/api/v1`

### Auth
- POST `/auth/login` - Login
- POST `/auth/register` - Registro (admin only)

### Leads
- GET `/leads` - Listar
- POST `/leads` - Criar
- PUT `/leads/:id` - Atualizar
- PATCH `/leads/:id/stage` - Mudar estagio
- DELETE `/leads/:id` - Remover
- GET `/leads/search?q=` - Buscar
- GET `/leads/stats` - Estatisticas
- POST `/leads/bulk/stage` - Acao em massa
- POST `/leads/importa` - Importar

### Orcamentos
- GET/POST/PUT/DELETE `/orcamentos`
- PATCH `/orcamentos/:id/status`
- GET `/orcamentos/stats`

### Contratos
- GET/POST/PUT/DELETE `/contracts`
- PATCH `/contracts/:id/sign`

### Produtos
- GET/POST/PUT/DELETE `/products`

### Tarefas
- GET/POST/PUT/DELETE `/tasks`
- PATCH `/tasks/:id/complete`
- GET `/tasks/overdue`

### Reports
- GET `/reports/dashboard` - Dashboard CEO
- GET `/reports/sales?from=&to=` - Vendas
- GET `/reports/pipeline` - Pipeline

### NPS
- GET/POST `/nps`

### Marketing
- GET/POST/PUT/DELETE `/marketing/funnels`
- GET/POST `/marketing/campaigns`
- PATCH `/marketing/campaigns/:id/send`
- GET/POST `/marketing/bookings`
- PATCH `/marketing/bookings/:id/cancel`
- GET/POST `/marketing/reviews`
- PATCH `/marketing/reviews/:id/reply`
- GET/POST/PUT `/marketing/ads`

### Webhooks (Publicos)
- POST `/webhooks/lead` - Capturar lead externo
- POST `/webhooks/booking` - Agendamento externo
- POST `/webhooks/review` - Avaliacao externa
- POST `/webhooks/whatsapp` - Webhook WhatsApp

### Users (Admin)
- GET/POST/PUT/DELETE `/users`

### Settings
- GET/PUT `/settings`
- GET/PUT `/settings/sla`
- GET/PUT `/settings/goals`
