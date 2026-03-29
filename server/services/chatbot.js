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
    /(?:me chamo|meu nome é|sou o|sou a|eu sou)\s+([A-ZÀ-Ù][a-zà-ú]+(?:\s+[A-ZÀ-Ù][a-zà-ú]+)*)/i,
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
