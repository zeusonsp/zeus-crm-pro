// ============================================
// ZEUS CRM PRO - Main Server v4.0.0
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

// Trust proxy (Render reverse proxy)
app.set('trust proxy', 1);

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
  etag: true,
  lastModified: true,
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-cache');
    } else if (filePath.match(/\.(js|css)$/)) {
      res.setHeader('Cache-Control', 'public, max-age=3600, must-revalidate');
    } else if (filePath.match(/\.(png|jpg|jpeg|gif|ico|svg|webp)$/)) {
      res.setHeader('Cache-Control', 'public, max-age=604800');
    } else {
      res.setHeader('Cache-Control', 'public, max-age=86400');
    }
  }
}));

// ============================================
// API DOCUMENTATION (Swagger)
// ============================================

const { setupSwagger } = require('./config/swagger');
setupSwagger(app);

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
    version: '4.0.0',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    features: [
      'ai', 'campaigns', 'signatures', 'exports',
      'workflows', 'chatbot', 'landing-pages', 'ab-testing',
      'custom-reports', 'scheduled-reports', 'permissions',
      'integrations', 'import-export', 'deduplication',
      'notifications', 'swagger-docs'
    ]
  });
});

// Auth routes (public)
apiRouter.use('/auth', require('./routes/auth'));

// Public routes (no auth needed)
apiRouter.use('/chatbot', require('./routes/chatbot'));
apiRouter.use('/webhooks', require('./routes/webhooks'));

// Protected routes - Core v1-v3
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
apiRouter.use('/ai', authMiddleware, require('./routes/ai'));
apiRouter.use('/exports', authMiddleware, require('./routes/exports'));

// NEW v4.0 - All 12 competitive gaps covered
apiRouter.use('/import', authMiddleware, require('./routes/import'));
apiRouter.use('/deduplication', authMiddleware, require('./routes/deduplication'));
apiRouter.use('/workflows', authMiddleware, require('./routes/workflows'));
apiRouter.use('/landing-pages', authMiddleware, require('./routes/landing-pages'));
apiRouter.use('/ab-tests', authMiddleware, require('./routes/ab-testing'));
apiRouter.use('/custom-reports', authMiddleware, require('./routes/custom-reports'));
apiRouter.use('/scheduled-reports', authMiddleware, require('./routes/scheduled-reports'));
apiRouter.use('/permissions', authMiddleware, require('./routes/permissions'));
apiRouter.use('/integrations', authMiddleware, require('./routes/integrations'));
apiRouter.use('/notifications', authMiddleware, require('./routes/notifications'));

// Mount API
app.use('/api', apiRouter);

// ============================================
// PUBLIC LANDING PAGES (served at /lp/:slug)
// ============================================

app.get('/lp/:slug', async (req, res) => {
  try {
    const admin = require('firebase-admin');
    const db = admin.firestore();
    const snap = await db.collection('landing_pages')
      .where('slug', '==', req.params.slug)
      .where('status', '==', 'published')
      .limit(1)
      .get();

    if (snap.empty) {
      return res.status(404).sendFile(path.join(__dirname, '..', 'public', 'index.html'));
    }

    // Redirect to landing page renderer
    res.redirect(`/api/landing-pages/render/${req.params.slug}`);
  } catch (err) {
    res.status(500).send('Erro ao carregar página');
  }
});

// ============================================
// SOCKET.IO REAL-TIME
// ============================================

io.on('connection', (socket) => {
  logger.info('[Socket] Client connected: ' + socket.id);

  socket.on('join-room', (room) => {
    socket.join(room);
    logger.info('[Socket] ' + socket.id + ' joined room: ' + room);
  });

  socket.on('lead-update', (data) => {
    socket.broadcast.emit('lead-updated', data);
  });

  socket.on('new-notification', (data) => {
    io.emit('notification', data);
  });

  // v4.0 - Workflow triggers via socket
  socket.on('workflow-trigger', async (data) => {
    try {
      const workflowEngine = require('./services/workflow-engine');
      const results = await workflowEngine.processTrigger(data.type, data.payload, io);
      socket.emit('workflow-trigger-result', results);
    } catch (err) {
      socket.emit('workflow-trigger-error', { error: err.message });
    }
  });

  // v4.0 - Chatbot via socket
  socket.on('chatbot-message', async (data) => {
    try {
      const chatbot = require('./services/chatbot');
      const result = await chatbot.processMessage(data.sessionId, data.message);
      socket.emit('chatbot-response', result);
    } catch (err) {
      socket.emit('chatbot-error', { error: err.message });
    }
  });

  socket.on('disconnect', () => {
    logger.info('[Socket] Client disconnected: ' + socket.id);
  });
});

// ============================================
// INITIALIZE BACKGROUND SERVICES
// ============================================

// Start scheduled reports cron jobs
setTimeout(async () => {
  try {
    const scheduler = require('./services/scheduler');
    await scheduler.initScheduler();
    logger.info('[Scheduler] Background report scheduler initialized');
  } catch (err) {
    logger.warn('[Scheduler] Could not initialize scheduler: ' + err.message);
  }
}, 5000); // Delay to let Firebase initialize first

// ============================================
// SPA FALLBACK
// ============================================

app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) {
    return notFoundHandler(req, res);
  }
  res.setHeader('Cache-Control', 'no-cache');
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
  logger.info(' ZEUS CRM PRO v4.0.0');
  logger.info(' Environment: ' + config.env);
  logger.info(' Port: ' + PORT);
  logger.info(' Firebase: ' + config.firebase.projectId);
  logger.info(' AI: ' + (config.openai.apiKey ? 'Enabled' : 'Disabled'));
  logger.info(' ClickSign: ' + (config.clicksign && config.clicksign.apiKey ? 'Enabled' : 'Disabled'));
  logger.info(' Twilio SMS: ' + (config.twilio.accountSid ? 'Enabled' : 'Disabled'));
  logger.info(' Swagger Docs: /api/docs');
  logger.info(' ');
  logger.info(' v4.0 Features:');
  logger.info('   - Workflow Automation Engine');
  logger.info('   - AI Chatbot (GPT-4o-mini)');
  logger.info('   - Landing Pages Builder');
  logger.info('   - Import/Export CSV/Excel');
  logger.info('   - Lead Deduplication');
  logger.info('   - A/B Testing');
  logger.info('   - Custom Reports');
  logger.info('   - Scheduled Reports');
  logger.info('   - RBAC Permissions');
  logger.info('   - Integrations Marketplace');
  logger.info('   - Push Notifications');
  logger.info('   - API Documentation');
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
