// ============================================
// ZEUS CRM PRO - SMS Service (Twilio)
// ============================================

const config = require('../config/env');
const logger = require('./logger');

const TWILIO_API = 'https://api.twilio.com/2010-04-01';

/**
 * Send SMS via Twilio
 */
async function sendSMS(to, body) {
  if (!config.twilio.accountSid || !config.twilio.authToken) {
    logger.warn('[SMS] Twilio not configured, skipping SMS');
    return { success: false, error: 'Twilio not configured' };
  }

  try {
    const url = `${TWILIO_API}/Accounts/${config.twilio.accountSid}/Messages.json`;
    const auth = Buffer.from(`${config.twilio.accountSid}:${config.twilio.authToken}`).toString('base64');

    // Format Brazilian number
    let phone = to.replace(/\D/g, '');
    if (phone.length === 11) phone = '55' + phone;
    if (phone.length === 10) phone = '55' + phone;
    if (!phone.startsWith('+')) phone = '+' + phone;

    const params = new URLSearchParams({
      To: phone,
      From: config.twilio.phoneNumber,
      Body: body
    });

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: params.toString()
    });

    const data = await response.json();

    if (response.ok) {
      logger.info(`[SMS] Sent to ${phone}: SID ${data.sid}`);
      return { success: true, sid: data.sid, status: data.status };
    } else {
      logger.error(`[SMS] Error: ${data.message}`);
      return { success: false, error: data.message, code: data.code };
    }
  } catch (err) {
    logger.error('[SMS] Send error:', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Send bulk SMS with rate limiting
 */
async function sendBulkSMS(recipients, body) {
  const results = [];
  for (const recipient of recipients) {
    const phone = typeof recipient === 'string' ? recipient : recipient.telefone;
    if (!phone) {
      results.push({ phone: 'unknown', success: false, error: 'No phone number' });
      continue;
    }

    const personalizedBody = typeof recipient === 'object' && recipient.nome
      ? body.replace('{nome}', recipient.nome).replace('{empresa}', recipient.empresa || '')
      : body;

    const result = await sendSMS(phone, personalizedBody);
    results.push({ phone, ...result });

    // Rate limit: 1 SMS per second
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  return {
    total: recipients.length,
    sent: results.filter(r => r.success).length,
    failed: results.filter(r => !r.success).length,
    results
  };
}

module.exports = { sendSMS, sendBulkSMS };
