// ============================================
// ZEUS CRM PRO - Main Server
// Zeus Tecnologia - @zeustecnologiaonlife
// ============================================
const express = require('express');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const http = require('http');
const { Server } = require('socket.io');

const config = require('./config/env');
const { initializeFirebase } = require('./config/firebase');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');
const { authMiddleware } = require('./middleware/auth');
const { apiLimiter } = require('./middleware/rateLimiter');
const logger = require('./services/logger');

// Initialize Firebase
initializeFirebase();

// Create Express app
const app = express();
const server = http.createServer(app);

// Socket.IO for real-time updates
const io = new Server(server, {
    cors: {
        origin: config.cors.origin,
        methods: ['GET', 'POST']
    }
});

// Make io accessible to routes
app.set('io', io);

// ============================================
// GLOBAL MIDDLEWARE
// ============================================
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://cdnjs.cloudflare.com"],
            fontSrc: ["'self'", "https://fonts.gstatic.com"],
            scriptSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com", "https://cdn.jsdelivr.net"],
            imgSrc: ["'self'", "data:", "blob:", "https:"],
            connectSrc: ["'self'", "https://firestore.googleapis.com", "wss:", "ws:"]
        }
    }
}));

app.use(compression());
app.use(cors({
    origin: config.env === 'production' ? config.cors.origin : '*',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Admin-Key']
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Logging
if (config.env === 'production') {
    app.use(morgan('combined', {
        stream: { write: (msg) => logger.info(msg.trim()) }
    }));
} else {
    app.use(morgan('dev'));
}

// ============================================
// STATIC FILES
// ============================================
app.use(express.static(path.join(__dirname, '..', 'public'), {
    maxAge: config.env === 'production' ? '1d' : 0,
    etag: true
}));

// ============================================
// API ROUTES
// ============================================
const apiRouter = express.Router();
apiRouter.use(apiLimiter);

// Health check (public)
apiRouter.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        service: 'Zeus CRM Pro',
        version: '2.0.0',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

// Auth routes (public)
apiRouter.use('/auth', require('./routes/auth'));

// Protected routes
apiRouter.use('/leads', authMiddleware, require('./routes/leads'));
apiRouter.use('/orcamentos', authMiddleware, require('./routes/orcamentos'));
apiRouter.use('/contracts', authMiddleware, require('./routes/contracts'));
apiRouter.use('/products', authMiddleware, require('./routes/products'));
apiRouter.use('/tasks', authMiddleware, require('./routes/tasks'));
apiRouter.use('/nps', authMiddleware, require('./routes/nps'));
apiRouter.use('/reports', authMiddleware, require('./routes/reports'));
apiRouter.use('/marketing', authMiddleware, require('./routes/marketing'));
apiRouter.use('/users', authMiddleware, require('./routes/users'));
apiRouter.use('/settings', authMiddleware, require('./routes/settings'));
apiRouter.use('/webhooks', require('./routes/webhooks'));

// Mount API
app.use('/api/v1', apiRouter);

// ============================================
// SOCKET.IO REAL-TIME
// ============================================
io.on('connection', (socket) => {
    logger.info(`[Socket] Client connected: ${socket.id}`);

    socket.on('join-room', (room) => {
        socket.join(room);
        logger.info(`[Socket] ${socket.id} joined room: ${room}`);
    });

    socket.on('lead-update', (data) => {
        socket.broadcast.emit('lead-updated', data);
    });

    socket.on('new-notification', (data) => {
        io.emit('notification', data);
    });

    socket.on('disconnect', () => {
        logger.info(`[Socket] Client disconnected: ${socket.id}`);
    });
});

// ============================================
// SPA FALLBACK
// ============================================
app.get('*', (req, res) => {
    if (req.path.startsWith('/api/')) {
        return notFoundHandler(req, res);
    }
    res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// ===========================================
// ERROR HANDLING
// ===========================================
app.use(notFoundHandler);
app.use(errorHandler);

// ===========================================
// START SERVER
// ===========================================
const PORT = config.port;
server.listen(PORT, () => {
    logger.info('========================================');
    logger.info('  ZEUS CRM PRO v2.0.0');
    logger.info('  Environment: ' + config.env);
    logger.info('  Port: ' + PORT);
    logger.info('  Firebase: ' + config.firebase.projectId);
    logger.info('========================================');
});

// Graceful shutdown
process.on('SIGTERM', () => {
    logger.info('[Server] SIGTERM received. Shutting down...');
    server.close(() => {
        logger.info('[Server] Server closed');
        process.exit(0);
    });
});

process.on('unhandledRejection', (err) => {
    logger.error('[Server] Unhandled rejection:', err);
});

module.exports = { app, server, io };
