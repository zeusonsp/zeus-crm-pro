// ============================================
// ZEUS CRM PRO - Email Service (Nodemailer)
// ============================================
const nodemailer = require('nodemailer');
const config = require('../config/env');
const logger = require('./logger');

let transporter = null;

function getTransporter() {
    if (!transporter && config.smtp.host) {
        transporter = nodemailer.createTransport({
            host: config.smtp.host,
            port: config.smtp.port,
            secure: config.smtp.port === 465,
            auth: {
                user: config.smtp.user,
                pass: config.smtp.pass
            }
        });
    }
    return transporter;
}

async function sendEmail({ to, subject, html, text, attachments = [] }) {
    const transport = getTransporter();
    if (!transport) {
        logger.warn('[Email] SMTP not configured, skipping send');
        return { success: false, error: 'SMTP nao configurado' };
    }

    try {
        const info = await transport.sendMail({
            from: config.smtp.from,
            to,
            subject,
            html,
            text: text || html.replace(/<[^>]*>/g, ''),
            attachments
        });
        logger.info(`[Email] Sent to ${to}: ${info.messageId}`);
        return { success: true, messageId: info.messageId };
    } catch (err) {
        logger.error(`[Email] Send error to ${to}:`, err.message);
        return { success: false, error: err.message };
    }
}

// Email templates
function getOrcamentoTemplate(orcamento) {
    return `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#0A0A0A;color:#fff;padding:30px;border-radius:12px">
        <div style="text-align:center;margin-bottom:30px">
            <h1 style="color:#D4AF37;margin:0">ZEUS TECNOLOGIA</h1>
            <p style="color:#888;margin:5px 0">Paineis LED Premium</p>
        </div>
        <h2 style="color:#D4AF37">Orcamento #${orcamento.numero}</h2>
        <p>Prezado(a) ${orcamento.cliente},</p>
        <p>Segue seu orcamento conforme solicitado:</p>
        <table style="width:100%;border-collapse:collapse;margin:20px 0">
            <tr style="background:#1a1a1a">
                <th style="padding:10px;text-align:left;color:#D4AF37;border-bottom:1px solid #333">Item</th>
                <th style="padding:10px;text-align:center;color:#D4AF37;border-bottom:1px solid #333">Qtd</th>
                <th style="padding:10px;text-align:right;color:#D4AF37;border-bottom:1px solid #333">Valor</th>
            </tr>
            ${(orcamento.items || []).map(item => `
                <tr>
                    <td style="padding:8px;border-bottom:1px solid #222">${item.descricao=}</td>
                    <td style="padding:8px;text-align:center;border-bottom:1px solid #222">${item.quantidade}</td>
                    <td style="padding:8px;text-align:right;border-bottom:1px solid #222">R$ ${(item.subtotal || 0).toFixed(2)}</td>
                </tr>
            `).join('')}
        </table>
        <div style="text-align:right;margin:20px 0;padding:15px;background:#1a1a1a;border-radius:8px">
            <p style="color:#888;margin:5px 0">Subtotal: R$ ${(orcamento.total || 0).toFixed(2)}</p>
            ${orcamento.desconto ? `<p style="color:#888;margin:5px 0">Desconto: -R$ $xorcamento.desconto.toFixed(2)}</p>` : ''}
            <p style="color:#D4AF37;font-size:20px;font-weight:bold;margin:10px 0">
                Total: R$ ${(aorcamento.totalFinal || orcamento.total || 0).toFixed(2)}
            </p>
        </div>
        <p style="color:#888;font-size:12px;text-align:center;margin-top:30px">
            Zeus Tecnologia | @zeustecnologiaonlife | zeusgetquote.com
        </p>
    </div>`;
}

function getWelcomeTemplate(name) {
    return `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#0A0A0C;color:#fff;padding:30px;border-radius:12px">
        <h1 style="color:#D4AF37;text-align:center">Bem-vindo a Zeus!</h1>
        <p>Ola ${name},</p>
        <p>Obrigado pelo seu interesse nos nossos paineis LED premium.</p>
        <p>Nossa equipe entrara em contato em breve para entender melhor suas necessidades.</p>
        <div style="text-align:center;margin:30px 0">
            <a href="https://zeusgetquote.com" style="background:#D4AF37;color:#000;padding:12px 30px;border-radius:8px;text-decoration:none;font-weight:bold">
                Visite nosso site
            </a>
        </div>
        <p style="color:#888;font-size:12px;text-align:center">Zeus Tecnologia</p>
    </div>`;
}

module.exports = { sendEmail, getOrcamentoTemplate, getWelcomeTemplate };
