/**
 * Zeus CRM Pro v4.0 - AI Chatbot Service
 * WhatsApp/Web chatbot with OpenAI GPT for customer support
 */
const config = require('../config/env');
const admin = require('firebase-admin');

const SYSTEM_PROMPT = `Você é o assistente virtual da Zeus Tecnologia, especializada em soluções de painéis LED e áudio/vídeo profissional.

Suas capacidades:
1. Responder dúvidas sobre produtos (painéis LED indoor/outdoor, telas, etc.)
2. Informar sobre prazos e condições
3. Qualificar leads (perguntar orçamento, prazo, tipo de projeto)
4. Agendar reuniões/visitas com vendedores
5. Compartilhar informações de contato da empresa

Regras:
- Seja sempre profissional e cordial
- Responda em português do Brasil
- Se não souber a resposta, diga que vai transferir para um atendente humano
- Nunca invente preços ou especificações técnicas
- Capture dados do lead: nome, empresa, email, telefone, projeto, orçamento estimado
- Quando tiver dados suficientes, sugira agendar uma reunião

Informações da empresa:
- Zeus Tecnologia - Soluções em Painéis LED e Áudio/Vídeo
- Produtos: Painéis LED P2.5, P3, P4, P5, P6, P8, P10 | Telas LED | Videowall
- Serviços: Venda, Instalação, Manutenção, Locação
- Horário: Seg-Sex 8h-18h, Sáb 8h-12h`;

/**
 * Process a chatbot message and return AI response
 */
async function processMessage(sessionId, userMessage, metadata = {}) {
  const db = admin.firestore();

  // Load conversation history
  const historyRef = db.collection('chatbot_sessions').doc(sessionId);
  const historyDoc = await historyRef.get();
  let session = historyDoc.exists ? historyDoc.data() : {
    id: sessionId,
    messages: [],
    leadData: {},
    status: 'active',
    createdAt: new Date().toISOString()
  };

  // Add user message to history
  session.messages.push({
    role: 'user',
    content: userMessage,
    timestamp: new Date().toISOString()
  });

  // Build messages for OpenAI
  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...session.messages.slice(-20).map(m => ({
      role: m.role,
      content: m.content
    }))
  ];

  // Add context about known products
  const productsSnap = await db.collection('products').limit(20).get();
  if (!productsSnap.empty) {
    const products = [];
    productsSnap.forEach(doc => {
      const p = doc.data();
      products.push(`- ${p.name}: ${p.description || ''} (${p.category || 'LED'})`);
    });
    messages[0].content += `\n\nProdutos disponíveis:\n${products.join('\n')}`;
  }

  // Call OpenAI
  const response = await callOpenAI(messages);

  // Extract lead data from conversation
  const extractedData = extractLeadData(session.messages, userMessage);
  session.leadData = { ...session.leadData, ...extractedData };

  // Add assistant response
  session.messages.push({
    role: 'assistant',
    content: response,
    timestamp: new Date().toISOString()
  });

  session.updatedAt = new Date().toISOString();
  session.messageCount = session.messages.length;

  // Save session
  await historyRef.set(session);

  // Auto-create lead if enough data collected
  let leadCreated = null;
  if (shouldCreateLead(session.leadData) && !session.leadCreated) {
    leadCreated = await createLeadFromChat(session.leadData, sessionId);
    session.leadCreated = true;
    session.leadId = leadCreated.id;
    await historyRef.update({ leadCreated: true, leadId: leadCreated.id });
  }

  return {
    response,
    sessionId,
    leadData: session.leadData,
    leadCreated,
    messageCount: session.messages.length
  };
}

/**
 * Call OpenAI API
 */
async function callOpenAI(messages) {
  const apiKey = config.openai?.apiKey;
  if (!apiKey) return 'Desculpe, o assistente está temporariamente indisponível. Por favor, entre em contato conosco pelo telefone.';

  try {
    const fetch = globalThis.fetch || require('node-fetch');
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages,
        temperature: 0.7,
        max_tokens: 500
      })
    });

    const data = await res.json();
    if (data.choices && data.choices[0]) {
      return data.choices[0].message.content;
    }
    return 'Desculpe, não consegui processar sua mensagem. Tente novamente.';
  } catch (err) {
    console.error('[Chatbot] OpenAI error:', err.message);
    return 'Estamos com dificuldades técnicas. Um atendente humano entrará em contato em breve.';
  }
}

/**
 * Extract lead data from conversation messages
 */
function extractLeadData(messages, lastMessage) {
  const data = {};
  const allText = messages.map(m => m.content).join(' ') + ' ' + lastMessage;

  // Email
  const emailMatch = allText.match(/[\w.-]+@[\w.-]+\.\w+/);
  if (emailMatch) data.email = emailMatch[0];

  // Phone (Brazilian formats)
  const phoneMatch = allText.match(/\(?\d{2}\)?\s*\d{4,5}[-.\s]?\d{4}/);
  if (phoneMatch) data.telefone = phoneMatch[0];

  // Name patterns (after common greetings)
  const namePatterns = [
    /(?:me chamo|meu nome é|sou o|sou a|eu sou)\s+([A-ZÀ-Ú][a-zà-ú]+(?:\s+[A-ZÀ-Ú][a-zà-ú]+)*)/i,
    /(?:nome:?\s*)([A-ZÀ-Ú][a-zà-ú]+(?:\s+[A-ZÀ-Ú][a-zà-ú]+)*)/i
  ];
  for (const pattern of namePatterns) {
    const match = lastMessage.match(pattern);
    if (match) { data.nome = match[1]; break; }
  }

  // Company
  const companyPatterns = [
    /(?:empresa|companhia|trabalho na|trabalho no)\s+([A-ZÀ-Ú][\w\s&]+)/i
  ];
  for (const pattern of companyPatterns) {
    const match = lastMessage.match(pattern);
    if (match) { data.empresa = match[1].trim(); break; }
  }

  return data;
}

/**
 * Check if we have enough data to create a lead
 */
function shouldCreateLead(leadData) {
  const hasContact = leadData.email || leadData.telefone;
  const hasName = leadData.nome;
  return hasContact && hasName;
}

/**
 * Create a lead from chatbot conversation
 */
async function createLeadFromChat(leadData, sessionId) {
  const db = admin.firestore();
  const id = require('uuid').v4();

  const lead = {
    id,
    nome: leadData.nome || '',
    empresa: leadData.empresa || '',
    email: leadData.email || '',
    telefone: leadData.telefone || '',
    valor: 0,
    estagio: 'novo',
    origem: 'chatbot',
    tags: ['chatbot', 'auto-captured'],
    notas: `Lead capturado automaticamente pelo chatbot.\nSessão: ${sessionId}`,
    chatbotSessionId: sessionId,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  await db.collection('leads').doc(id).set(lead);
  return lead;
}

/**
 * Transfer chat to human agent
 */
async function transferToHuman(sessionId, reason) {
  const db = admin.firestore();
  await db.collection('chatbot_sessions').doc(sessionId).update({
    status: 'transferred',
    transferReason: reason,
    transferredAt: new Date().toISOString()
  });
  return { transferred: true, reason };
}

/**
 * Get chat session history
 */
async function getSession(sessionId) {
  const db = admin.firestore();
  const doc = await db.collection('chatbot_sessions').doc(sessionId).get();
  return doc.exists ? doc.data() : null;
}

/**
 * List active chat sessions
 */
async function listSessions(status = 'active') {
  const db = admin.firestore();
  const snap = await db.collection('chatbot_sessions')
    .where('status', '==', status)
    .orderBy('updatedAt', 'desc')
    .limit(50)
    .get();
  const items = [];
  snap.forEach(doc => items.push(doc.data()));
  return items;
}

module.exports = {
  processMessage, transferToHuman, getSession, listSessions
};
