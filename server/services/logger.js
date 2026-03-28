// ============================================
// ZEUS CRM PRO - Logger Service (Winston)
// ============================================
const winston = require('winston');
const config = require('../config/env');

const logger = winston.createLogger({
    level: config.logging.level,
    format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        winston.format.errors({ stack: true }),
        winston.format.json()
    ),
    defaultMeta: { service: 'zeus-crm' },
    transports: [
        new winston.transports.Console({
            format: winston.format.combine(
                winston.format.colorize(),
                winston.format.printf(({ level, message, timestamp }) => {
                    return `${timestamp} [${level}]: ${message}`;
                })
            )
        })
    ]
});

// Add file transport in production
if (config.env === 'production') {
    logger.add(new winston.transports.File({
        filename: 'logs/error.log',
        level: 'error',
        maxsize: 5242880,
        maxFiles: 5
    }));
    logger.add(new winston.transports.File({
        filename: 'logs/combined.log',
        maxsize: 5242880,
        maxFiles: 5
    }));
}

module.exports = logger;
