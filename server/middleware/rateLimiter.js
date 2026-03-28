// ============================================
// ZEUS CRM PRO - Rate Limiting
// ============================================
const rateLimit = require('express-rate-limit');
const config = require('../config/env');

const apiLimiter = rateLimit({
    windowMs: config.rateLimit.windowMs,
    max: config.rateLimit.max,
    message: {
        success: false,
        error: 'Muitas requisicoes. Tente novamente em alguns minutos.',
        code: 'RATE_LIMIT_EXCEEDED'
    },
    standardHeaders: true,
    legacyHeaders: false
});

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: {
        success: false,
        error: 'Muitas tentativas de login. Tente novamente em 15 minutos.',
        code: 'AUTH_RATE_LIMIT'
    }
});

const webhookLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 50,
    message: {
        success: false,
        error: 'Limite de webhooks excedido.',
        code: 'WEBHOOK_RATE_LIMIT'
    }
});

module.exports = { apiLimiter, authLimiter, webhookLimiter };
