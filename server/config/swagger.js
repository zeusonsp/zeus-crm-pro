/**
 * Zeus CRM Pro v4.0 - Swagger/OpenAPI Documentation
 */

const swaggerSpec = {
  openapi: '3.0.3',
  info: {
    title: 'Zeus CRM Pro API',
    version: '4.0.0',
    description: 'API completa do Zeus CRM Pro — Sistema de CRM para vendas de painéis LED com AI, assinatura digital, campanhas multi-canal e automação de workflows.',
    contact: { name: 'Zeus Tecnologia', email: 'contato@zeus.com' },
    license: { name: 'Proprietário' }
  },
  servers: [
    { url: '/api', description: 'API Principal' }
  ],
  tags: [
    { name: 'Auth', description: 'Autenticação e autorização' },
    { name: 'Leads', description: 'Gestão de leads e pipeline' },
    { name: 'Orçamentos', description: 'Criação e gestão de orçamentos' },
    { name: 'Contratos', description: 'Contratos com assinatura digital ClickSign' },
    { name: 'Produtos', description: 'Catálogo de produtos' },
    { name: 'Tasks', description: 'Gestão de tarefas' },
    { name: 'Marketing', description: 'Campanhas, funis, anúncios e reviews' },
    { name: 'AI', description: 'Inteligência artificial (GPT-4o-mini)' },
    { name: 'Exports', description: 'Exportação PDF/Excel' },
    { name: 'Import', description: 'Importação de leads CSV/Excel' },
    { name: 'Deduplication', description: 'Deduplicação de leads' },
    { name: 'Workflows', description: 'Automação de workflows' },
    { name: 'Chatbot', description: 'Chatbot AI para atendimento' },
    { name: 'Landing Pages', description: 'Builder de landing pages' },
    { name: 'A/B Tests', description: 'Testes A/B para campanhas' },
    { name: 'Custom Reports', description: 'Relatórios customizáveis' },
    { name: 'Scheduled Reports', description: 'Relatórios agendados' },
    { name: 'Permissions', description: 'Permissões granulares (RBAC)' },
    { name: 'Integrations', description: 'Marketplace de integrações' },
    { name: 'NPS', description: 'Net Promoter Score' },
    { name: 'Users', description: 'Gestão de usuários' },
    { name: 'Settings', description: 'Configurações do sistema' }
  ],
  components: {
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }
    },
    schemas: {
      Lead: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          nome: { type: 'string', example: 'João Silva' },
          empresa: { type: 'string', example: 'Tech Corp' },
          email: { type: 'string', format: 'email' },
          telefone: { type: 'string', example: '(11) 99999-0001' },
          valor: { type: 'number', example: 25000 },
          estagio: { type: 'string', enum: ['novo', 'qualificado', 'proposta', 'negociacao', 'fechado'] },
          origem: { type: 'string', example: 'site' },
          vendedor: { type: 'string' },
          tags: { type: 'array', items: { type: 'string' } },
          aiScore: { type: 'number', minimum: 0, maximum: 100 },
          aiTier: { type: 'string', enum: ['hot', 'warm', 'cold'] },
          createdAt: { type: 'string', format: 'date-time' }
        }
      },
      Contract: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          title: { type: 'string' },
          clientName: { type: 'string' },
          value: { type: 'number' },
          status: { type: 'string', enum: ['draft', 'pending_signature', 'signed', 'cancelled'] },
          signatureStatus: { type: 'string' }
        }
      },
      Workflow: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          trigger: { type: 'object', properties: { type: { type: 'string' }, config: { type: 'object' } } },
          steps: { type: 'array', items: { type: 'object' } },
          active: { type: 'boolean' },
          executionCount: { type: 'number' }
        }
      },
      Error: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: false },
          error: { type: 'string' },
          details: { type: 'string' }
        }
      }
    }
  },
  security: [{ bearerAuth: [] }],
  paths: {
    '/health': {
      get: {
        tags: ['System'],
        summary: 'Health check',
        security: [],
        responses: { 200: { description: 'Serviço online', content: { 'application/json': { schema: { type: 'object', properties: { status: { type: 'string' }, version: { type: 'string' }, uptime: { type: 'number' } } } } } } }
      }
    },
    '/leads': {
      get: {
        tags: ['Leads'], summary: 'Listar leads',
        parameters: [
          { name: 'estagio', in: 'query', schema: { type: 'string' } },
          { name: 'vendedor', in: 'query', schema: { type: 'string' } },
          { name: 'origem', in: 'query', schema: { type: 'string' } }
        ],
        responses: { 200: { description: 'Lista de leads' } }
      },
      post: {
        tags: ['Leads'], summary: 'Criar lead',
        requestBody: { content: { 'application/json': { schema: { '$ref': '#/components/schemas/Lead' } } } },
        responses: { 201: { description: 'Lead criado' } }
      }
    },
    '/leads/{id}': {
      get: { tags: ['Leads'], summary: 'Buscar lead', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'Lead encontrado' } } },
      put: { tags: ['Leads'], summary: 'Atualizar lead', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'Lead atualizado' } } },
      delete: { tags: ['Leads'], summary: 'Remover lead', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'Lead removido' } } }
    },
    '/ai/qualify-lead/{id}': {
      post: { tags: ['AI'], summary: 'Qualificar lead com AI (GPT-4o-mini)', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'Qualificação AI' } } }
    },
    '/ai/generate-message/{id}': {
      post: { tags: ['AI'], summary: 'Gerar mensagem por AI', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'Mensagem gerada' } } }
    },
    '/ai/predict/{id}': {
      post: { tags: ['AI'], summary: 'Previsão de fechamento por AI', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'Previsão' } } }
    },
    '/contracts': {
      get: { tags: ['Contratos'], summary: 'Listar contratos', responses: { 200: { description: 'Lista de contratos' } } },
      post: { tags: ['Contratos'], summary: 'Criar contrato', responses: { 201: { description: 'Contrato criado' } } }
    },
    '/contracts/{id}/sign': {
      post: { tags: ['Contratos'], summary: 'Enviar para assinatura digital (ClickSign)', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'Enviado para assinatura' } } }
    },
    '/import/leads': {
      post: { tags: ['Import'], summary: 'Importar leads de CSV/Excel', requestBody: { content: { 'multipart/form-data': { schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' }, duplicateAction: { type: 'string', enum: ['skip', 'update'] } } } } } }, responses: { 200: { description: 'Resultado da importação' } } }
    },
    '/deduplication/scan': {
      get: { tags: ['Deduplication'], summary: 'Escanear leads duplicados', responses: { 200: { description: 'Duplicatas encontradas' } } }
    },
    '/deduplication/auto-merge': {
      post: { tags: ['Deduplication'], summary: 'Auto-mesclar duplicatas óbvias', responses: { 200: { description: 'Resultado' } } }
    },
    '/workflows': {
      get: { tags: ['Workflows'], summary: 'Listar workflows', responses: { 200: { description: 'Lista' } } },
      post: { tags: ['Workflows'], summary: 'Criar workflow de automação', requestBody: { content: { 'application/json': { schema: { '$ref': '#/components/schemas/Workflow' } } } }, responses: { 201: { description: 'Workflow criado' } } }
    },
    '/workflows/{id}/execute': {
      post: { tags: ['Workflows'], summary: 'Executar workflow manualmente', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'Execução' } } }
    },
    '/chatbot/message': {
      post: { tags: ['Chatbot'], summary: 'Enviar mensagem para chatbot AI', security: [], requestBody: { content: { 'application/json': { schema: { type: 'object', properties: { sessionId: { type: 'string' }, message: { type: 'string' } } } } } }, responses: { 200: { description: 'Resposta do chatbot' } } }
    },
    '/landing-pages': {
      get: { tags: ['Landing Pages'], summary: 'Listar landing pages', responses: { 200: { description: 'Lista' } } },
      post: { tags: ['Landing Pages'], summary: 'Criar landing page', responses: { 201: { description: 'Página criada' } } }
    },
    '/ab-tests': {
      get: { tags: ['A/B Tests'], summary: 'Listar testes A/B', responses: { 200: { description: 'Lista' } } },
      post: { tags: ['A/B Tests'], summary: 'Criar teste A/B', responses: { 201: { description: 'Teste criado' } } }
    },
    '/custom-reports': {
      get: { tags: ['Custom Reports'], summary: 'Listar relatórios customizados', responses: { 200: { description: 'Lista' } } },
      post: { tags: ['Custom Reports'], summary: 'Criar relatório customizado', responses: { 201: { description: 'Relatório criado' } } }
    },
    '/scheduled-reports': {
      get: { tags: ['Scheduled Reports'], summary: 'Listar relatórios agendados', responses: { 200: { description: 'Lista' } } },
      post: { tags: ['Scheduled Reports'], summary: 'Criar agendamento de relatório', responses: { 201: { description: 'Agendamento criado' } } }
    },
    '/permissions/roles': {
      get: { tags: ['Permissions'], summary: 'Listar roles e permissões', responses: { 200: { description: 'Roles' } } }
    },
    '/integrations/catalog': {
      get: { tags: ['Integrations'], summary: 'Catálogo de integrações disponíveis', responses: { 200: { description: 'Catálogo' } } }
    },
    '/integrations': {
      get: { tags: ['Integrations'], summary: 'Listar integrações instaladas', responses: { 200: { description: 'Lista' } } },
      post: { tags: ['Integrations'], summary: 'Instalar integração', responses: { 201: { description: 'Instalada' } } }
    },
    '/exports/dashboard/pdf': {
      get: { tags: ['Exports'], summary: 'Exportar dashboard em PDF branded', responses: { 200: { description: 'PDF file' } } }
    },
    '/exports/dashboard/excel': {
      get: { tags: ['Exports'], summary: 'Exportar dashboard em Excel multi-aba', responses: { 200: { description: 'Excel file' } } }
    },
    '/marketing/campaigns': {
      get: { tags: ['Marketing'], summary: 'Listar campanhas', responses: { 200: { description: 'Lista' } } },
      post: { tags: ['Marketing'], summary: 'Criar campanha (Email/SMS/WhatsApp)', responses: { 201: { description: 'Campanha criada' } } }
    },
    '/nps': {
      get: { tags: ['NPS'], summary: 'Listar respostas NPS', responses: { 200: { description: 'Lista' } } }
    }
  }
};

function setupSwagger(app) {
  // Serve spec as JSON
  app.get('/api/docs/spec.json', (req, res) => {
    res.json(swaggerSpec);
  });

  // Serve Swagger UI (using CDN, no extra dependency)
  app.get('/api/docs', (req, res) => {
    res.send(`<!DOCTYPE html>
<html>
<head>
  <title>Zeus CRM Pro — API Docs</title>
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/5.11.0/swagger-ui.min.css">
  <style>body{margin:0}.topbar{display:none!important}.swagger-ui .info .title{color:#D4AF37}</style>
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/5.11.0/swagger-ui-bundle.min.js"></script>
  <script>SwaggerUIBundle({url:'/api/docs/spec.json',dom_id:'#swagger-ui',deepLinking:true,presets:[SwaggerUIBundle.presets.apis,SwaggerUIBundle.SwaggerUIStandalonePreset],layout:'BaseLayout'})</script>
</body>
</html>`);
  });
}

module.exports = { setupSwagger, swaggerSpec };
