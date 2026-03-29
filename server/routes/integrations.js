/**
 * Zeus CRM Pro v4.0 - Integrations Marketplace
 * Manage third-party integrations, webhooks, and connectors
 */
const router = require('express').Router();
const admin = require('firebase-admin');
const { v4: uuid } = require('uuid');

// Pre-built integrations catalog
const CATALOG = [
  {
    id: 'google-calendar',
    name: 'Google Calendar',
    category: 'productivity',
    icon: '📅',
    description: 'Sincronize tarefas e reuniões com Google Calendar',
    fields: ['clientId', 'clientSecret', 'redirectUri'],
    webhookEvents: ['task-created', 'booking-created']
  },
  {
    id: 'google-sheets',
    name: 'Google Sheets',
    category: 'data',
    icon: '📊',
    description: 'Exporte dados de leads automaticamente para Google Sheets',
    fields: ['spreadsheetId', 'apiKey'],
    webhookEvents: ['lead-created', 'lead-updated']
  },
  {
    id: 'slack',
    name: 'Slack',
    category: 'communication',
    icon: '💬',
    description: 'Notificações de leads e contratos no Slack',
    fields: ['webhookUrl', 'channel'],
    webhookEvents: ['lead-created', 'contract-signed', 'deal-won']
  },
  {
    id: 'zapier',
    name: 'Zapier',
    category: 'automation',
    icon: '⚡',
    description: 'Conecte Zeus CRM Pro com 5.000+ aplicativos via Zapier',
    fields: ['webhookUrl'],
    webhookEvents: ['*']
  },
  {
    id: 'make',
    name: 'Make (Integromat)',
    category: 'automation',
    icon: '🔄',
    description: 'Automações visuais com Make/Integromat',
    fields: ['webhookUrl'],
    webhookEvents: ['*']
  },
  {
    id: 'whatsapp-business',
    name: 'WhatsApp Business API',
    category: 'communication',
    icon: '📱',
    description: 'Envio de mensagens e templates via WhatsApp Business',
    fields: ['apiKey', 'phoneId', 'businessId'],
    webhookEvents: ['campaign-sent']
  },
  {
    id: 'stripe',
    name: 'Stripe',
    category: 'payment',
    icon: '💳',
    description: 'Processamento de pagamentos e cobranças',
    fields: ['secretKey', 'publishableKey', 'webhookSecret'],
    webhookEvents: ['contract-signed', 'payment-received']
  },
  {
    id: 'mailchimp',
    name: 'Mailchimp',
    category: 'marketing',
    icon: '📧',
    description: 'Sincronize leads com listas do Mailchimp',
    fields: ['apiKey', 'listId'],
    webhookEvents: ['lead-created']
  },
  {
    id: 'pipefy',
    name: 'Pipefy',
    category: 'automation',
    icon: '🔧',
    description: 'Integre processos do Pipefy com Zeus CRM',
    fields: ['apiToken', 'pipeId'],
    webhookEvents: ['lead-stage-changed']
  },
  {
    id: 'custom-webhook',
    name: 'Webhook Personalizado',
    category: 'custom',
    icon: '🔗',
    description: 'Configure um webhook personalizado para qualquer evento',
    fields: ['url', 'method', 'headers'],
    webhookEvents: ['*']
  }
];

// GET /api/integrations/catalog - Browse available integrations
router.get('/catalog', (req, res) => {
  const { category } = req.query;
  let items = CATALOG;
  if (category) items = items.filter(i => i.category === category);

  const categories = [...new Set(CATALOG.map(i => i.category))];
  res.json({ success: true, items, categories, total: items.length });
});

// GET /api/integrations - List installed/active integrations
router.get('/', async (req, res) => {
  try {
    const db = admin.firestore();
    const snap = await db.collection('integrations').orderBy('installedAt', 'desc').get();
    const items = [];
    snap.forEach(doc => {
      const d = doc.data();
      // Mask sensitive fields
      if (d.config) {
        Object.keys(d.config).forEach(k => {
          if (k.toLowerCase().includes('secret') || k.toLowerCase().includes('key') || k.toLowerCase().includes('token')) {
            d.config[k] = d.config[k] ? '***' + d.config[k].slice(-4) : '';
          }
        });
      }
      items.push(d);
    });
    res.json({ success: true, items, total: items.length });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Erro ao listar integrações' });
  }
});

// POST /api/integrations - Install/configure integration
router.post('/', async (req, res) => {
  try {
    const { catalogId, config: integrationConfig, events } = req.body;
    const catalogItem = CATALOG.find(c => c.id === catalogId);
    if (!catalogItem) {
      return res.status(400).json({ success: false, error: 'Integração não encontrada no catálogo' });
    }

    const db = admin.firestore();
    const id = uuid();
    const integration = {
      id,
      catalogId,
      name: catalogItem.name,
      category: catalogItem.category,
      icon: catalogItem.icon,
      config: integrationConfig || {},
      events: events || catalogItem.webhookEvents,
      active: true,
      installedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      eventsSent: 0,
      lastEventAt: null
    };

    await db.collection('integrations').doc(id).set(integration);

    const io = req.app.get('io');
    if (io) io.emit('integration-installed', { id, name: catalogItem.name });

    res.status(201).json({ success: true, item: integration });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Erro ao instalar integração' });
  }
});

// PUT /api/integrations/:id - Update integration config
router.put('/:id', async (req, res) => {
  try {
    const db = admin.firestore();
    const updates = { ...req.body, updatedAt: new Date().toISOString() };
    delete updates.id;
    await db.collection('integrations').doc(req.params.id).update(updates);
    const updated = await db.collection('integrations').doc(req.params.id).get();
    res.json({ success: true, item: updated.data() });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Erro ao atualizar integração' });
  }
});

// DELETE /api/integrations/:id - Uninstall integration
router.delete('/:id', async (req, res) => {
  try {
    const db = admin.firestore();
    await db.collection('integrations').doc(req.params.id).delete();
    res.json({ success: true, message: 'Integração removida' });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Erro ao remover integração' });
  }
});

// POST /api/integrations/:id/toggle - Toggle active
router.post('/:id/toggle', async (req, res) => {
  try {
    const db = admin.firestore();
    const doc = await db.collection('integrations').doc(req.params.id).get();
    if (!doc.exists) return res.status(404).json({ success: false, error: 'Não encontrada' });
    const newActive = !doc.data().active;
    await db.collection('integrations').doc(req.params.id).update({ active: newActive });
    res.json({ success: true, active: newActive });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Erro ao alternar integração' });
  }
});

// POST /api/integrations/:id/test - Test integration
router.post('/:id/test', async (req, res) => {
  try {
    const db = admin.firestore();
    const doc = await db.collection('integrations').doc(req.params.id).get();
    if (!doc.exists) return res.status(404).json({ success: false, error: 'Não encontrada' });

    const integration = doc.data();
    const testPayload = {
      event: 'test',
      data: { message: 'Zeus CRM Pro - teste de integração', timestamp: new Date().toISOString() },
      source: 'zeus-crm-pro'
    };

    // Try to send webhook
    if (integration.config.webhookUrl || integration.config.url) {
      const url = integration.config.webhookUrl || integration.config.url;
      const fetch = globalThis.fetch || require('node-fetch');
      const response = await fetch(url, {
        method: integration.config.method || 'POST',
        headers: { 'Content-Type': 'application/json', ...(integration.config.headers || {}) },
        body: JSON.stringify(testPayload)
      });
      return res.json({ success: true, status: response.status, statusText: response.statusText });
    }

    res.json({ success: true, message: 'Teste de configuração OK (sem webhook URL)' });
  } catch (err) {
    res.status(500).json({ success: false, error: `Teste falhou: ${err.message}` });
  }
});

// POST /api/integrations/dispatch - Dispatch event to all active integrations
router.post('/dispatch', async (req, res) => {
  try {
    const { event, data } = req.body;
    const result = await dispatchEvent(event, data);
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Erro ao despachar evento' });
  }
});

/**
 * Dispatch an event to all matching integrations
 */
async function dispatchEvent(event, data) {
  const db = admin.firestore();
  const snap = await db.collection('integrations')
    .where('active', '==', true)
    .get();

  let sent = 0;
  let failed = 0;
  const fetch = globalThis.fetch || require('node-fetch');

  for (const doc of snap.docs) {
    const integration = doc.data();
    if (!integration.events.includes('*') && !integration.events.includes(event)) continue;

    const url = integration.config.webhookUrl || integration.config.url;
    if (!url) continue;

    try {
      await fetch(url, {
        method: integration.config.method || 'POST',
        headers: { 'Content-Type': 'application/json', ...(integration.config.headers || {}) },
        body: JSON.stringify({ event, data, source: 'zeus-crm-pro', timestamp: new Date().toISOString() })
      });

      await db.collection('integrations').doc(integration.id).update({
        eventsSent: admin.firestore.FieldValue.increment(1),
        lastEventAt: new Date().toISOString()
      });
      sent++;
    } catch (err) {
      failed++;
    }
  }

  return { sent, failed, event };
}

module.exports = router;
module.exports.dispatchEvent = dispatchEvent;
