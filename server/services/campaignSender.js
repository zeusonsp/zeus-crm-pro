// ============================================
// ZEUS CRM PRO - Campaign Sender Service
// Envio real de emails, SMS e WhatsApp
// ============================================

const emailService = require('./email');
const smsService = require('./sms');
const whatsappService = require('./whatsapp');
const db = require('./firestore');
const logger = require('./logger');

async function executeCampaign(campaignId) {
  const campaign = await db.getById('zeus_campaigns', campaignId);
  if (!campaign) throw new Error('Campaign not found');
  if (campaign.status === 'enviada') throw new Error('Campaign already sent');
  const targets = await getTargetAudience(campaign.segment);
  if (targets.length === 0) throw new Error('No targets found');
  let results;
  switch (campaign.type) {
    case 'email': results = await sendEmailCampaign(campaign, targets); break;
    case 'sms': results = await sendSMSCampaign(campaign, targets); break;
    case 'whatsapp': results = await sendWhatsAppCampaign(campaign, targets); break;
    default: throw new Error('Unsupported type');
  }
  await db.update('zeus_campaigns', campaignId, { status: 'enviada', sentAt: new Date().toISOString(), sent: results.sent, failed: results.failed });
  return results;
}
async function getTargetAudience(s){ if(!s){const l=await db.getAll('zeus_leads',{});return l.filter(x=>x.email||x.telefone)} return await db.getAll('zeus_leads',{})}
async function sendEmailCampaign(c,t){let s=0,f=0;for(const x of t){if(!x.email){f++;continue}try{await emailService.sendEmail({to:x.email,subject:c.subject,html:c.content});s++}catch{f++}}return{sent:s,failed:f,type:'email'}}
async function sendSMSCampaign(c,t){return await smsService.sendBulkSMS(t.filter(x=>x.telefone),c.content||c.subject)}
async function sendWhatsAppCampaign(c,t){return await whatsappService.sendBulkWhatsApp(t.filter(x=>x.telefone).map(x=>x.telefone),c.content||c.subject)}
module.exports = { executeCampaign, getTargetAudience };
