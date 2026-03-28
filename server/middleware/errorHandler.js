// ============================================
// ZEUS CRM PRO - Error Handling
// ============================================
const logger = require('../services/logger');

function errorHandler(err, req, res, next) {
    logger.error(`[Error] ${err.message}`, {
        stack: err.stack,
        url: req.originalUrl,
        method: req.method,
        ip: req.ip
    });

    const status = err.statusCode || err.status || 500;
    const message = status === 500 ? 'Erro interno do servidor' : err.message;

    res.status(status).json({
        success: false,
        error: message,
        code: err.code || 'INTERNAL_ERROR',
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    });
}

function notFoundHandler(req, res) {
    res.status(404).json({
        success: false,
        error: `Rota nao encontrada: ${req.method} ${req.originalUrl}`,
        code: 'NOT_FOUND'
    });
}

// Custom error class
class AppError extends Error {
    constructor(message, statusCode = 400, code = 'APP_ERROR') {
        super(message);
        this.statusCode = statusCode;
        this.code = code;
        Error.captureStackTrace(this, this.constructor);
    }
}

module.exports = { errorHandler, notFoundHandler, AppError };
