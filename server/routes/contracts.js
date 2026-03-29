// ============================================
// ZEUS CRM PRO - Contracts Routes
// v3.0 - ClickSign Digital Signature Integration
// ============================================

const router = require('express').Router();
const FirestoreService = require('../services/firestore');
const logger = require('../services/logger');
const {
  createSignatureRequest,
  checkSignatureStatus,
  cancelSignature,
  processWebhook
} = require('../services/signature');

const contractsDB = new FirestoreService('zeus_contracts');

// ============================================
// CRUD
// ============================================

router.get('/', async (req, res) => {
  try {
    const filters = {};
    if (req.query.status) filters.status = req.query.status;
    if (req.query.clientId) filters.clientId = req.query.clientId;

    const result = await contractsDB.getAll({ sort: 'createdAt', order: 'desc', filters });
    res.json({ success: true, ...result });
  } catch (err) {
    logger.error('[Contracts] List error:', err.message);
    res.status(500).json({ success: false, error: 'Erro ao listar contratos' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const contract = await contractsDB.getById(req.params.id);
    if (!contract) return res.status(404).json({ success: false, error: 'Contrato nao encontrado' });
    res.json({ success: true, contract });
  } catch (err) {
    logger.error('[Contracts] Get error:', err.message);
    res.status(500).json({ success: false, error: 'Erro ao buscar contrato' });
  }
});

router.post('/', async (req, res) => {
  try {
    const contract = await contractsDB.create({
      title: req.body.title,
      clientName: req.body.clientName,
      clientEmail: req.body.clientEmail || '',
      clientCpfCnpj: req.body.clientCpfCnpj || '',
      clientPhone: req.body.clientPhone || '',
      quoteId: req.body.quoteId || null,
      items: req.body.items || [],
      totalValue: +req.body.totalValue || 0,
      paymentTerms: req.body.paymentTerms || '',
      deliveryTerms: req.body.deliveryTerms || '',
      warranty: req.body.warranty || '12 meses',
      notes: req.body.notes || '',
      status: 'rascunho',
      signatureStatus: null,
      signatureDocumentKey: null,
      signatureRequestId: null,
      signedAt: null,
      cancelledAt: null
    });

    const io = req.app.get('io');
    if (io) io.emit('contract-created', { id: contract.id, title: contract.title });

    res.status(201).json({ success: true, contract });
  } catch (err) {
    logger.error('[Contracts] Create error:', err.message);
    res.status(500).json({ success: false, error: 'Erro ao criar contrato' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const existing = await contractsDB.getById(req.params.id);
    if (!existing) return res.status(404).json({ success: false, error: 'Contrato nao encontrado' });

    // Don't allow editing signed contracts
    if (existing.status === 'assinado') {
      return res.status(400).json({ success: false, error: 'Contrato ja assinado nao pode ser editado' });
    }

    const contract = await contractsDB.update(req.params.id, req.body);
    res.json({ success: true, contract });
  } catch (err) {
    logger.error('[Contracts] Update error:', err.message);
    res.status(500).json({ success: false, error: 'Erro ao atualizar contrato' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const existing = await contractsDB.getById(req.params.id);
    if (!existing) return res.status(404).json({ success: false, error: 'Contrato nao encontrado' });

    if (existing.status === 'assinado') {
      return res.status(400).json({ success: false, error: 'Contrato assinado nao pode ser removido' });
    }

    // If pending signature, cancel it first
    if (existing.signatureDocumentKey && existing.signatureStatus === 'pending') {
      try {
        await cancelSignature(existing.signatureDocumentKey);
      } catch (cancelErr) {
        logger.warn('[Contracts] Could not cancel signature on delete:', cancelErr.message);
      }
    }

    await contractsDB.delete(req.params.id);
    res.json({ success: true, message: 'Contrato removido' });
  } catch (err) {
    logger.error('[Contracts] Delete error:', err.message);
    res.status(500).json({ success: false, error: 'Erro ao remover contrato' });
  }
});

// ============================================
// DIGITAL SIGNATURE (ClickSign)
// ============================================

// POST /contracts/:id/sign - Send contract for digital signature
router.post('/:id/sign', async (req, res) => {
  try {
    const contract = await contractsDB.getById(req.params.id);
    if (!contract) {
      return res.status(404).json({ success: false, error: 'Contrato nao encontrado' });
    }

    if (contract.status === 'assinado') {
      return res.status(400).json({ success: false, error: 'Contrato ja esta assinado' });
    }

    if (contract.signatureStatus === 'pending') {
      return res.status(400).json({ success: false, error: 'Contrato ja enviado para assinatura. Aguarde ou cancele.' });
    }

    if (!contract.clientEmail) {
      return res.status(400).json({ success: false, error: 'Email do cliente e obrigatorio para assinatura digital' });
    }

    if (!contract.clientCpfCnpj) {
      return res.status(400).json({ success: false, error: 'CPF/CNPJ do cliente e obrigatorio para assinatura digital' });
    }

    // Send to ClickSign
    const result = await createSignatureRequest(contract);

    // Update contract with signature info
    await contractsDB.update(req.params.id, {
      status: 'enviado_assinatura',
      signatureStatus: 'pending',
      signatureDocumentKey: result.documentKey,
      signatureRequestId: result.requestKey,
      signatureSentAt: new Date().toISOString()
    });

    // Real-time notification
    const io = req.app.get('io');
    if (io) {
      io.emit('contract-sent-signature', {
        contractId: req.params.id,
        title: contract.title,
        clientName: contract.clientName
      });
    }

    res.json({
      success: true,
      message: 'Contrato enviado para assinatura digital',
      signatureUrl: result.signUrl,
      documentKey: result.documentKey
    });
  } catch (err) {
    logger.error('[Contracts] Sign error:', err.message);
    res.status(500).json({ success: false, error: 'Erro ao enviar para assinatura', details: err.message });
  }
});

// GET /contracts/:id/signature-status - Check signature status
router.get('/:id/signature-status', async (req, res) => {
  try {
    const contract = await contractsDB.getById(req.params.id);
    if (!contract) {
      return res.status(404).json({ success: false, error: 'Contrato nao encontrado' });
    }

    if (!contract.signatureDocumentKey) {
      return res.json({ success: true, status: 'not_sent', message: 'Contrato ainda nao enviado para assinatura' });
    }

    const signatureInfo = await checkSignatureStatus(contract.signatureDocumentKey);

    // Update local status if changed
    if (signatureInfo.status !== contract.signatureStatus) {
      const updates = { signatureStatus: signatureInfo.status };

      if (signatureInfo.status === 'signed') {
        updates.status = 'assinado';
        updates.signedAt = new Date().toISOString();
      } else if (signatureInfo.status === 'cancelled') {
        updates.status = 'cancelado';
        updates.cancelledAt = new Date().toISOString();
      }

      await contractsDB.update(req.params.id, updates);

      // Notify if signed
      if (signatureInfo.status === 'signed') {
        const io = req.app.get('io');
        if (io) {
          io.emit('contract-signed', {
            contractId: req.params.id,
            title: contract.title,
            clientName: contract.clientName
          });
        }
      }
    }

    res.json({ success: true, signature: signatureInfo });
  } catch (err) {
    logger.error('[Contracts] Signature status error:', err.message);
    res.status(500).json({ success: false, error: 'Erro ao verificar assinatura' });
  }
});

// POST /contracts/:id/cancel-signature - Cancel pending signature
router.post('/:id/cancel-signature', async (req, res) => {
  try {
    const contract = await contractsDB.getById(req.params.id);
    if (!contract) {
      return res.status(404).json({ success: false, error: 'Contrato nao encontrado' });
    }

    if (!contract.signatureDocumentKey) {
      return res.status(400).json({ success: false, error: 'Contrato nao possui assinatura pendente' });
    }

    if (contract.signatureStatus !== 'pending') {
      return res.status(400).json({ success: false, error: 'Apenas assinaturas pendentes podem ser canceladas' });
    }

    await cancelSignature(contract.signatureDocumentKey);

    await contractsDB.update(req.params.id, {
      status: 'rascunho',
      signatureStatus: 'cancelled',
      cancelledAt: new Date().toISOString()
    });

    res.json({ success: true, message: 'Assinatura cancelada com sucesso' });
  } catch (err) {
    logger.error('[Contracts] Cancel signature error:', err.message);
    res.status(500).json({ success: false, error: 'Erro ao cancelar assinatura' });
  }
});

// ============================================
// CLICKSIGN WEBHOOK
// ============================================

// POST /contracts/webhook/clicksign - ClickSign callback
router.post('/webhook/clicksign', async (req, res) => {
  try {
    const result = await processWebhook(req.body);

    if (result && result.documentKey) {
      // Find contract by signature document key
      const contracts = await contractsDB.getAll({
        filters: { signatureDocumentKey: result.documentKey }
      });

      if (contracts.items && contracts.items.length > 0) {
        const contract = contracts.items[0];
        const updates = { signatureStatus: result.status };

        if (result.status === 'signed') {
          updates.status = 'assinado';
          updates.signedAt = result.signedAt || new Date().toISOString();

          const io = req.app.get('io');
          if (io) {
            io.emit('contract-signed', {
              contractId: contract.id,
              title: contract.title,
              clientName: contract.clientName
            });
          }

          logger.info(`[Contracts] Contract ${contract.id} signed via webhook`);
        } else if (result.status === 'cancelled') {
          updates.status = 'cancelado';
          updates.cancelledAt = new Date().toISOString();
        }

        await contractsDB.update(contract.id, updates);
      }
    }

    // Always return 200 to ClickSign
    res.json({ received: true });
  } catch (err) {
    logger.error('[Contracts] Webhook error:', err.message);
    // Still return 200 to avoid retries
    res.json({ received: true, error: err.message });
  }
});

// ============================================
// CONTRACT STATS
// ============================================

router.get('/stats/summary', async (req, res) => {
  try {
    const result = await contractsDB.getAll({});
    const contracts = result.items || [];

    const total = contracts.length;
    const signed = contracts.filter(c => c.status === 'assinado').length;
    const pending = contracts.filter(c => c.status === 'enviado_assinatura').length;
    const draft = contracts.filter(c => c.status === 'rascunho').length;
    const cancelled = contracts.filter(c => c.status === 'cancelado').length;

    const totalValue = contracts.reduce((s, c) => s + (c.totalValue || 0), 0);
    const signedValue = contracts.filter(c => c.status === 'assinado')
      .reduce((s, c) => s + (c.totalValue || 0), 0);

    res.json({
      success: true,
      stats: {
        total,
        signed,
        pending,
        draft,
        cancelled,
        totalValue,
        signedValue,
        signRate: total > 0 ? ((signed / total) * 100).toFixed(1) : 0
      }
    });
  } catch (err) {
    logger.error('[Contracts] Stats error:', err.message);
    res.status(500).json({ success: false, error: 'Erro ao buscar estatisticas' });
  }
});

module.exports = router;
