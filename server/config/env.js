// ============================================
// ZEUS CRM PRO - Environment Configuration
// ============================================
require('dotenv').config();

const config = {
    env: process.env.NODE_ENV || 'development',
    port: parseInt(process.env.PORT, 10) || 3000,
    apiBaseUrl: process.env.API_BASE_URL || 'http://localhost:3000',

    jwt: {
        secret: process.env.JWT_SECRET || 'zeus-dev-secret-change-in-production',
        expiresIn: process.env.JWT_EXPIRES_IN || '7d'
    },

    admin: {
        key: process.env.ADMIN_KEY || 'zeus2026admin'
    },

    firebase: {
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY,
        databaseURL: process.env.FIREBASE_DATABASE_URL
    },

    smtp: {
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT, 10) || 587,
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
        from: process.env.SMTP_FROM || 'Zeus CRM <noreply@zeusgetquote.com>'
    },

    whatsapp: {
        apiKey: process.env.WHATSAPP_API_KEY,
        phoneId: process.env.WHATSAPP_PHONE_ID,
        businessId: process.env.WHATSAPP_BUSINESS_ID
    },

    twilio: {
        accountSid: process.env.TWILIO_ACCOUNT_SID,
        authToken: process.env.TWILIO_AUTH_TOKEN,
        phoneNumber: process.env.TWILIO_PHONE_NUMBER
    },

    openai: {
        apiKey: process.env.OPENAI_API_KEY
    },

    rateLimit: {
        windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 900000,
        max: parseInt(process.env.RATE_LIMIT_MAX, 10) || 100
    },

    cors: {
        origin: process.env.CORS_ORIGIN || '*'
    },

    logging: {
        level: process.env.LOG_LEVEL || 'info'
    }
};

module.exports = config;
