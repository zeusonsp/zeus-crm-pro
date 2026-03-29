// ============================================
// ZEUS CRM PRO - Digital Signature Service
// ClickSign / DocuSign Integration
// ============================================

const config = require('../config/env');
const logger = require('./logger');

const CLICKSIGN_API = 'https://app.clicksign.com/api/v1';

/**
 * Create a document for signature on ClickSign
 */
async function createSignatureRequest(contract) {
  if (!config.clicksign || !config.clicksign.apiKey) {
    logger.warn('[Signature] ClickSign not configured');
    return { success: false, error: 'ClickSign API key not configured' };
  }

  try {
    // Step 1: Create document
    const docResponse = await fetch(`${CLICKSIGN_API}/documents?access_token=${config.clicksign.apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        document: {
          path: `/zeus-crm/contrato-${contract.id}.html`,
          content_base64: Buffer.from(generateContractHTML(contract)).toString('base64'),
          deadline_at: getDeadline(30),
          auto_close: true,
          locale: 'pt-BR',
          sequence_enabled: false
        }
      })
    });

    if (!docResponse.ok) {
      const err = await docResponse.text();
      throw new Error(`ClickSign document creation failed: ${err}`);
    }

    const docData = await docResponse.json();
    const documentKey = docData.document.key;

    logger.info(`[Signature] Document created: ${documentKey}`);

    // Step 2: Add signer
    const signerResponse = await fetch(`${CLICKSIGN_API}/signers?access_token=${config.clicksign.apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        signer: {
          email: contract.clientEmail,
          phone_number: formatPhone(contract.clientPhone || ''),
          auths: ['email'],
          name: contract.clientName,
          documentation: contract.clientDoc || '',
          birthday: '',
          has_documentation: !!contract.clientDoc,
          selfie_enabled: false,
          handwritten_enabled: false,
          official_document_enabled: false,
          liveness_enabled: false,
          facial_biometrics_enabled: false
        }
      })
    });

    if (!signerResponse.ok) {
      const err = await signerResponse.text();
      throw new Error(`ClickSign signer creation failed: ${err}`);
    }

    const signerData = await signerResponse.json();
    const signerKey = signerData.signer.key;

    // Step 3: Add signer to document
    const listResponse = await fetch(`${CLICKSIGN_API}/lists?access_token=${config.clicksign.apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        list: {
          document_key: documentKey,
          signer_key: signerKey,
          sign_as: 'sign',
          refusable: true,
          message: `${contract.clientName}, por favor assine o contrato da Zeus Tecnologia.`
        }
      })
    });

    if (!listResponse.ok) {
      const err = await listResponse.text();
      throw new Error(`ClickSign list creation failed: ${err}`);
    }

    // Step 4: Send notification
    await fetch(`${CLICKSIGN_API}/notifications?access_token=${config.clicksign.apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        request_signature_key: (await listResponse.json()).list.request_signature_key,
        message: `Olá ${contract.clientName}, você tem um contrato da Zeus Tecnologia para assinar.`
      })
    });

    return {
      success: true,
      documentKey,
      signerKey,
      status: 'pending',
      signUrl: `https://app.clicksign.com/sign/${documentKey}`
    };

  } catch (err) {
    logger.error('[Signature] Error:', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Check signature status
 */
async function checkSignatureStatus(documentKey) {
  if (!config.clicksign || !config.clicksign.apiKey) {
    return { success: false, error: 'ClickSign not configured' };
  }

  try {
    const response = await fetch(
      `${CLICKSIGN_API}/documents/${documentKey}?access_token=${config.clicksign.apiKey}`
    );

    if (!response.ok) throw new Error('Document not found');

    const data = await response.json();
    const doc = data.document;

    return {
      success: true,
      status: doc.status,
      signedAt: doc.status === 'closed' ? doc.updated_at : null,
      events: (doc.events || []).map(e => ({
        type: e.name,
        occurredAt: e.occurred_at,
        signer: e.signer ? e.signer.email : null
      }))
    };
  } catch (err) {
    logger.error('[Signature] Status check error:', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Cancel signature request
 */
async function cancelSignature(documentKey) {
  if (!config.clicksign || !config.clicksign.apiKey) {
    return { success: false, error: 'ClickSign not configured' };
  }

  try {
    const response = await fetch(
      `${CLICKSIGN_API}/documents/${documentKey}/cancel?access_token=${config.clicksign.apiKey}`,
      { method: 'PATCH', headers: { 'Content-Type': 'application/json' } }
    );

    return { success: response.ok, status: 'cancelled' };
  } catch (err) {
    logger.error('[Signature] Cancel error:', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Process ClickSign webhook (called when document is signed/refused)
 */
function processWebhook(payload) {
  const event = payload.event;
  const doc = payload.document;

  return {
    eventType: event.name, // 'close', 'sign', 'refuse', 'deadline'
    documentKey: doc.key,
    status: doc.status,
    signerEmail: event.signer ? event.signer.email : null,
    occurredAt: event.occurred_at
  };
}

/**
 * Generate contract HTML for signing
 */
function generateContractHTML(contract) {
  const today = new Date().toLocaleDateString('pt-BR');
  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><title>Contrato Zeus Tecnologia</title></head>
<body style="font-family:Arial,sans-serif;max-width:800px;margin:40px auto;padding:0 20px;color:#333;line-height:1.8;">
  <div style="text-align:center;margin-bottom:40px;">
    <h1 style="color:#0A0A0A;letter-spacing:4px;margin-bottom:4px;">ZEUS</h1>
    <p style="color:#D4AF37;font-size:12px;letter-spacing:2px;">TECNOLOGIA - ALTA PERFORMANCE</p>
    <hr style="border:1px solid #D4AF37;margin:20px 0;">
  </div>

  <h2 style="text-align:center;">CONTRATO DE PRESTACAO DE SERVICOS</h2>
  <p style="text-align:center;color:#666;">N° ${contract.id || 'N/A'} | Data: ${today}</p>

  <h3>1. PARTES</h3>
  <p><strong>CONTRATADA:</strong> Zeus Tecnologia LTDA, inscrita no CNPJ sob o n° [CNPJ], com sede em [endereco].</p>
  <p><strong>CONTRATANTE:</strong> ${contract.clientName || 'N/A'}, ${contract.clientDoc ? `inscrito no CPF/CNPJ sob o n° ${contract.clientDoc},` : ''} email: ${contract.clientEmail || 'N/A'}.</p>

  <h3>2. OBJETO</h3>
  <p>${contract.description || 'Fornecimento de solucoes em paineis LED e equipamentos audiovisuais conforme proposta comercial.'}</p>

  <h3>3. VALOR</h3>
  <p>O valor total do presente contrato e de <strong>R$ ${(contract.value || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong>.</p>

  <h3>4. CONDICOES DE PAGAMENTO</h3>
  <p>${contract.paymentTerms || 'Conforme acordado entre as partes na proposta comercial.'}</p>

  <h3>5. PRAZO</h3>
  <p>O presente contrato tem vigencia a partir da data de assinatura digital.</p>

  <h3>6. DISPOSICOES GERAIS</h3>
  <p>As partes elegem o foro da Comarca de [cidade] para dirimir quaisquer questoes oriundas deste contrato.</p>

  <div style="margin-top:60px;text-align:center;">
    <p style="color:#666;font-size:12px;">Documento assinado digitalmente via ClickSign</p>
    <p style="color:#666;font-size:12px;">${today}</p>
  </div>
</body>
</html>`;
}

/**
 * Helper: format phone for ClickSign
 */
function formatPhone(phone) {
  const digits = phone.replace(/\D/g, '');
  if (digits.length >= 10) {
    return '+55' + digits.slice(-11);
  }
  return '';
}

/**
 * Helper: get deadline date
 */
function getDeadline(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

module.exports = {
  createSignatureRequest,
  checkSignatureStatus,
  cancelSignature,
  processWebhook
};
