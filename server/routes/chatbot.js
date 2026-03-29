/**
 * Zeus CRM Pro v4.0 - AI Chatbot Routes
 * Customer-facing chatbot + admin management
 */
const router = require('express').Router();
const chatService = require('../services/chatbot');
const { v4: uuid } = require('uuid');

// POST /api/chatbot/message - Send message (public - no auth for customer widget)
router.post('/message', async (req, res) => {
  try {
    const { sessionId, message, metadata } = req.body;
    if (!message) {
      return res.status(400).json({ success: false, error: 'message é obrigatório' });
    }

    const sid = sessionId || uuid();
    const result = await chatService.processMessage(sid, message, metadata);

    // Real-time notification to admin
    const io = req.app.get('io');
    if (io) {
      io.emit('chatbot-message', {
        sessionId: sid,
        userMessage: message,
        botResponse: result.response,
        leadData: result.leadData
      });
    }

    res.json({ success: true, ...result });
  } catch (err) {
    console.error('[Chatbot] Message error:', err.message);
    res.status(500).json({ success: false, error: 'Erro ao processar mensagem' });
  }
});

// POST /api/chatbot/transfer/:sessionId - Transfer to human
router.post('/transfer/:sessionId', async (req, res) => {
  try {
    const { reason } = req.body;
    const result = await chatService.transferToHuman(req.params.sessionId, reason || 'Solicitado pelo agente');

    const io = req.app.get('io');
    if (io) io.emit('chatbot-transferred', { sessionId: req.params.sessionId });

    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Erro ao transferir chat' });
  }
});

// GET /api/chatbot/sessions - List chat sessions (admin)
router.get('/sessions', async (req, res) => {
  try {
    const { status = 'active' } = req.query;
    const items = await chatService.listSessions(status);
    res.json({ success: true, items, total: items.length });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Erro ao listar sessões' });
  }
});

// GET /api/chatbot/sessions/:id - Get session details
router.get('/sessions/:id', async (req, res) => {
  try {
    const session = await chatService.getSession(req.params.id);
    if (!session) return res.status(404).json({ success: false, error: 'Sessão não encontrada' });
    res.json({ success: true, item: session });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Erro ao buscar sessão' });
  }
});

// GET /api/chatbot/widget - Serve chatbot widget script
router.get('/widget', (req, res) => {
  const script = `
(function() {
  var API = '${req.protocol}://${req.get('host')}/api/chatbot';
  var sessionId = localStorage.getItem('zeus_chat_id') || '${uuid()}';
  localStorage.setItem('zeus_chat_id', sessionId);

  var container = document.createElement('div');
  container.id = 'zeus-chatbot';
  container.innerHTML = \`
    <div id="zeus-chat-btn" style="position:fixed;bottom:20px;right:20px;width:60px;height:60px;border-radius:50%;background:#D4AF37;cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 12px rgba(0,0,0,0.3);z-index:99999;font-size:28px;color:#000">⚡</div>
    <div id="zeus-chat-box" style="display:none;position:fixed;bottom:90px;right:20px;width:380px;height:500px;background:#0a0a0a;border:1px solid #333;border-radius:12px;box-shadow:0 8px 32px rgba(0,0,0,0.5);z-index:99999;flex-direction:column;font-family:system-ui,sans-serif">
      <div style="background:#D4AF37;color:#000;padding:16px;border-radius:12px 12px 0 0;font-weight:700">⚡ Zeus Assistente</div>
      <div id="zeus-messages" style="flex:1;overflow-y:auto;padding:12px;color:#e0e0e0;font-size:14px"></div>
      <div style="padding:12px;border-top:1px solid #222;display:flex;gap:8px">
        <input id="zeus-input" type="text" placeholder="Digite sua mensagem..." style="flex:1;padding:10px;border:1px solid #333;border-radius:8px;background:#111;color:#fff;font-size:14px" />
        <button id="zeus-send" style="padding:10px 16px;background:#D4AF37;color:#000;border:none;border-radius:8px;font-weight:700;cursor:pointer">Enviar</button>
      </div>
    </div>
  \`;
  document.body.appendChild(container);

  var btn = document.getElementById('zeus-chat-btn');
  var box = document.getElementById('zeus-chat-box');
  var input = document.getElementById('zeus-input');
  var sendBtn = document.getElementById('zeus-send');
  var msgs = document.getElementById('zeus-messages');

  btn.onclick = function() {
    box.style.display = box.style.display === 'none' ? 'flex' : 'none';
    if (box.style.display === 'flex' && msgs.children.length === 0) {
      addMessage('bot', 'Olá! 👋 Sou o assistente virtual da Zeus Tecnologia. Como posso ajudar?');
    }
  };

  function addMessage(type, text) {
    var div = document.createElement('div');
    div.style.cssText = 'margin:8px 0;padding:10px 14px;border-radius:12px;max-width:85%;font-size:13px;line-height:1.4;' +
      (type === 'user' ? 'background:#D4AF37;color:#000;margin-left:auto;' : 'background:#1a1a1a;color:#e0e0e0;');
    div.textContent = text;
    msgs.appendChild(div);
    msgs.scrollTop = msgs.scrollHeight;
  }

  async function send() {
    var text = input.value.trim();
    if (!text) return;
    addMessage('user', text);
    input.value = '';
    try {
      var r = await fetch(API + '/message', {
        method: 'POST', headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ sessionId: sessionId, message: text })
      });
      var data = await r.json();
      addMessage('bot', data.response || 'Desculpe, houve um erro.');
    } catch(e) { addMessage('bot', 'Erro de conexão. Tente novamente.'); }
  }

  sendBtn.onclick = send;
  input.onkeypress = function(e) { if(e.key==='Enter') send(); };
})();`;

  res.setHeader('Content-Type', 'application/javascript');
  res.send(script);
});

module.exports = router;
