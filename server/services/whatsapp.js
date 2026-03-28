// ============================================
// ZEUS CRM PRO - WhatsApp Business API Service
// ============================================
const config = require('../config/env');
const logger = require('./logger');

const WHATSAPP_API_URL = 'https://graph.facebook.com/v18.0';

async function sendWhatsAppMessage({ to, message, templateName = null, templateParams = [] }) {
    if (!config.whatsapp.apiKey || !config.whatsapp.phoneId) {
        logger.warn('[WhatsApp] API not configured');
        return { success: false, error: 'WhatsApp API nao configurada' };
    }

    try {
        const url = `${WHATSAPP_API_URL}/${config.whatsapp.phoneId}/messages`;
        let body;

        if (templateName) {
            body = {
                messaging_product: 'whatsapp',
                to: formatPhone(to),
                type: 'template',
                template: {
                    name: templateName,
                    language: { code: 'pt_BR' },
                    components: templateParams.length > 0 ? [{
                        type: 'body',
                        parameters: templateParams.map(p => ({ type: 'text', text: p }))
                    }] : []
                }
            };
        } else {
            body = {
                messaging_product: 'whatsapp',
                to: formatPhone(to),
                type: 'text',
                text: { body: message }
            };
        }

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${config.whatsapp.apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(body)
        });

        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.error?.message || 'WhatsApp API error');
        }

        logger.info(`[WhatsApp] Message sent to ${to}`);
        return { success: true, messageId: data.messages?.[0]?.id };
    } catch (err) {
        logger.error(`[WhatsApp] Send error:`, err.message);
        return { success: false, error: err.message };
    }
}

async function sendBulkWhatsApp(recipients, message) {
    const results = [];
    for (const phone of recipients) {
        const result = await sendWhatsAppMessage({ to: phone, message });
        results.push({ phone, ...result });
        // Rate limiting: wait 1s between messages
        await new Promise(r => setTimeout(r, 1000));
    }
    return results;
}

function formatPhone(phone) {
    let clean = phone.replace(/\D/g, '');
    if (clean.startsWith('0')) clean = clean.substring(1);
    if (!clean.startsWith('55')) clean = '55' + clean;
    return clean;
}

module.exports = { sendWhatsAppMessage, sendBulkWhatsApp };
