// ============================================
// ZEUS CRM PRO - AI Service (OpenAI)
// Qualificacao, sugestoes, previsoes, resumos
// ============================================

const config = require('../config/env');
const logger = require('./logger');

const OPENAI_API = 'https://api.openai.com/v1/chat/completions';

/**
 * Call OpenAI API
 */
async function callOpenAI(messages, options = {}) {
  if (!config.openai.apiKey) {
    throw new Error('OPENAI_API_KEY not configured');
  }

  const body = {
    model: options.model || 'gpt-4o-mini',
    messages,
    temperature: options.temperature || 0.3,
    max_tokens: options.maxTokens || 1000
  };

  const response = await fetch(OPENAI_API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.openai.apiKey}`
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const err = await response.text();
    logger.error('[AI] OpenAI API error:', err);
    throw new Error(`OpenAI API error: ${response.status}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

async function qualifyLead(lead) { const msg=[{role:'system',content:'Analise lead e retorne JSON com score,tier,reasoning,nextAction,urgency'},{role:'user',content:JSON.stringify(lead)}];const r=await callOpenAI(msg);try{return JSON.parse(r)}catch{return{score:50,tier:'warm',reasoning:r,nextAction:'Contatar',urgency:'media'}}}

module.exports={qualifyLead,bulkQualifyLeads:async(leads)=>{rst=[];for(const l of leads){try{rst.push({leadId:l.id,...await qualifyLead(l)})}catch(e){rst.push({leadId:l.id,score:0,tier:'cold'})}}return rst},suggestFollowUp:async(l,i)=>{},predictClosing:async(l,p)=>{},summarizeNotes:async(n,c)=>{},generateMessage:async(l,t,p)=>{},analyzeSalesPerformance:async(d)=>{}};
