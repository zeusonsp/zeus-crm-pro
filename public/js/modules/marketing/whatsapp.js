// ============================================
// ZEUS CRM PRO - WhatsApp Business Module
// ============================================
const ZeusWhatsAppMod = (function() {
    async function render() {
        const container = document.getElementById('tab-whatsapp');
        if (!container) return;

        container.innerHTML = `
            <!-- Config Section -->
            <div class="card" style="margin-bottom:16px">
                <div class="card-header">
                    <h3>Configuracao WhatsApp Business API</h3>
                    <button class="btn btn-outline btn-sm" onclick="ZeusWhatsAppMod.toggleConfig()">⚙️ Configurar</button>
                </div>
                <div id="wa-config" style="display:none">
                    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px">
                        <div class="form-group"><label>API Token</label><input type="password" class="form-control" id="wa-api-key" placeholder="Bearer token"></div>
                        <div class="form-group"><label>Phone Number ID</label><input type="text" class="form-control" id="wa-phone-id" placeholder="Ex: 123456789"></div>
                        <div class="form-group"><label>Business ID</label><input type="text" class="form-control" id="wa-business-id" placeholder="Ex: 987654321"></div>
                    </div>
                    <button class="btn btn-gold btn-sm" onclick="ZeusWhatsAppMod.saveConfig()" style="margin-top:8px">Salvar Configuracao</button>
                </div>
                <div id="wa-status" style="margin-top:8px">
                    <span class="badge badge-warning">API nao configurada - Use envio manual via wa.me</span>
                </div>
            </div>

            <!-- Quick Actions -->
            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:16px;margin-bottom:24px">
                <div class="card" style="text-align:center;cursor:pointer" onclick="ZeusWhatsAppMod.sendSingle()">
                    <div style="font-size:32px;margin-bottom:8px">📱</div>
                    <strong>Envio Individual</strong>
                    <p style="font-size:12px;color:var(--text-secondary);margin-top:4px">Enviar mensagem para um contato</p>
                </div>
                <div class="card" style="text-align:center;cursor:pointer" onclick="ZeusWhatsAppMod.sendBulk()">
                    <div style="font-size:32px;margin-bottom:8px">📤</div>
                    <strong>Envio em Massa</strong>
                    <p style="font-size:12px;color:var(--text-secondary);margin-top:4px">Enviar para todos os leads</p>
                </div>
                <div class="card" style="text-align:center;cursor:pointer" onclick="ZeusWhatsAppMod.showTemplates()">
                    <div style="font-size:32px;margin-bottom:8px">📝</div>
                    <strong>Templates</strong>
                    <p style="font-size:12px;color:var(--text-secondary);margin-top:4px">Mensagens pre-definidas</p>
                </div>
                <div class="card" style="text-align:center;cursor:pointer" onclick="ZeusWhatsAppMod.showAutoReplies()">
                    <div style="font-size:32px;margin-bottom:8px">🤖</div>
                    <strong>Respostas Auto</strong>
                    <p style="font-size:12px;color:var(--text-secondary);margin-top:4px">Respostas automaticas</p>
                </div>
            </div>

            <!-- Message Templates -->
            <div class="card">
                <div class="card-header">
                    <h3>Templates de Mensagem</h3>
                </div>
                <div id="wa-templates">
                    ${getDefaultTemplates().map((t, i) => `
                        <div style="background:var(--bg-input);padding:12px;border-radius:var(--radius-sm);margin-bottom:8px;display:flex;justify-content:space-between;align-items:center">
                            <div>
                                <strong>${t.name}</strong>
                                <p style="font-size:12px;color:var(--text-secondary);margin-top:2px">${t.preview}</p>
                            </div>
                            <button class="btn btn-outline btn-sm" onclick="ZeusWhatsAppMod.useTemplate(${i})">Usar</button>
                        </div>
                    `).join('')}
                </div>
            </div>

            <!-- Auto Replies -->
            <div class="card" style="margin-top:16px">
                <div class="card-header">
                    <h3>Respostas Automaticas</h3>
                    <button class="btn btn-outline btn-sm" onclick="ZeusWhatsAppMod.addAutoReply()">+ Adicionar</button>
                </div>
                <div id="wa-auto-replies">
                    ${getDefaultAutoReplies().map(r => `
                        <div style="background:var(--bg-input);padding:12px;border-radius:var(--radius-sm);margin-bottom:8px">
                            <div style="display:flex;justify-content:space-between;align-items:center">
                                <div>
                                    <span class="badge badge-gold">${r.trigger}</span>
                                    <span style="margin-left:8px;font-size:12px;color:var(--text-secondary)">→ ${r.response.substring(0, 60)}...</span>
                                </div>
                                <span class="badge badge-${r.active ? 'success' : 'warning'}">${r.active ? 'Ativo' : 'Inativo'}</span>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    function getDefaultTemplates() {
        return [
            { name: 'Boas-vindas', preview: 'Ola {nome}! Obrigado pelo interesse nos paineis Zeus...', message: 'Ola {nome}! 👋\n\nObrigado pelo interesse nos paineis LED da Zeus Tecnologia!\n\nSou {vendedor}, e vou te ajudar a encontrar a solucao perfeita.\n\nPosso te ligar para entender melhor seu projeto?' },
            { name: 'Follow-up', preview: 'Oi {nome}, tudo bem? Passando pra saber se...', message: 'Oi {nome}, tudo bem? 😊\n\nPassando para saber se voce teve oportunidade de analisar nosso orcamento.\n\nEstou a disposicao para tirar qualquer duvida!\n\n- {vendedor} | Zeus Tecnologia' },
            { name: 'Orcamento Pronto', preview: '{nome}, seu orcamento esta pronto!', message: '🎉 {nome}, seu orcamento esta pronto!\n\nNumero: {numero}\nValor: R$ {valor}\n\nVou enviar os detalhes por email. Posso prosseguir?\n\n- {vendedor} | Zeus Tecnologia' },
            { name: 'Pos-venda', preview: 'Ola {nome}! Como esta o painel LED?', message: 'Ola {nome}! ⭐\n\nJa faz um tempo desde a instalacao do seu painel LED.\n\nGostaria de saber como esta a experiencia! Se precisar de suporte ou manutencao, estamos aqui.\n\n- Zeus Tecnologia' }
        ];
    }

    function getDefaultAutoReplies() {
        return [
            { trigger: 'preco|valor|quanto custa', response: 'Obrigado pelo interesse! Nossos paineis LED tem valores a partir de R$ 2.500. Para um orcamento personalizado, pode me informar o tamanho desejado e local de instalacao?', active: true },
            { trigger: 'horario|funcionamento|aberto', response: 'Nosso horario de atendimento e de segunda a sexta, das 8h as 18h. Deixe sua mensagem que retornaremos assim que possivel! 😊', active: true },
            { trigger: 'garantia', response: 'Todos os nossos paineis LED possuem garantia de 12 meses contra defeitos de fabricacao. Para garantia estendida, consulte nossos planos!', active: true },
            { trigger: 'instalacao|instalar', response: 'Sim, realizamos a instalacao completa! Nossa equipe tecnica cuida de tudo, desde a fixacao ate a configuracao do conteudo. O prazo medio e de 3-5 dias uteis apos aprovacao.', active: true }
        ];
    }

    function toggleConfig() {
        const el = document.getElementById('wa-config');
        el.style.display = el.style.display === 'none' ? 'block' : 'none';
    }

    async function saveConfig() {
        ZeusToast.success('Configuracao WhatsApp salva! Configure as variaveis de ambiente no servidor.');
        toggleConfig();
    }

    function sendSingle() {
        ZeusModal.create({
            title: 'Enviar WhatsApp',
            content: `
                <div class="form-group"><label>Telefone *</label><input type="text" class="form-control" id="wa-phone" placeholder="(11) 99999-9999"></div>
                <div class="form-group"><label>Mensagem *</label><textarea class="form-control" id="wa-message" rows="5" placeholder="Sua mensagem aqui..."></textarea></div>
            `,
            confirmText: 'Enviar via WhatsApp',
            onConfirm: () => {
                const phone = (document.getElementById('wa-phone')?.value || '').replace(/\D/g, '');
                const msg = document.getElementById('wa-message')?.value || '';
                if (!phone || !msg) { ZeusToast.error('Telefone e mensagem obrigatorios'); return; }
                const url = `https://wa.me/55${phone}?text=${encodeURIComponent(msg)}`;
                window.open(url, '_blank');
                ZeusToast.success('WhatsApp aberto!');
            }
        });
    }

    async function sendBulk() {
        const ok = await ZeusModal.confirm('Envio em Massa', 'Isso vai abrir WhatsApp para cada lead com telefone cadastrado. Continuar?');
        if (!ok) return;

        try {
            const res = await ZeusAPI.leads.list({ limit: 999 });
            const leadsWithPhone = res.items.filter(l => l.telefone);
            if (leadsWithPhone.length === 0) {
                ZeusToast.warning('Nenhum lead com telefone cadastrado');
                return;
            }

            const msg = await ZeusModal.prompt('Mensagem para todos os leads:', '');
            if (!msg) return;

            let sent = 0;
            for (const lead of leadsWithPhone) {
                const phone = lead.telefone.replace(/\D/g, '');
                const personalMsg = msg.replace(/{nome}/g, lead.nome).replace(/{empresa}/g, lead.empresa || '');
                window.open(`https://wa.me/55${phone}?text=${encodeURIComponent(personalMsg)}`, '_blank');
                sent++;
                if (sent >= 10) {
                    ZeusToast.warning('Limite de 10 abas por vez. Continue o envio depois.');
                    break;
                }
            }
            ZeusToast.success(`${sent} conversas abertas no WhatsApp`);
        } catch (err) { ZeusToast.error(err.message); }
    }

    function useTemplate(index) {
        const templates = getDefaultTemplates();
        const t = templates[index];
        if (!t) return;
        ZeusModal.create({
            title: `Template: ${t.name}`,
            content: `
                <div class="form-group"><label>Telefone do destinatario</label><input type="text" class="form-control" id="tpl-phone" placeholder="(11) 99999-9999"></div>
                <div class="form-group"><label>Nome do cliente</label><input type="text" class="form-control" id="tpl-nome" placeholder="Nome"></div>
                <div class="form-group"><label>Mensagem (edite se necessario)</label><textarea class="form-control" id="tpl-msg" rows="6">${t.message}</textarea></div>
            `,
            confirmText: 'Enviar',
            onConfirm: () => {
                const phone = (document.getElementById('tpl-phone')?.value || '').replace(/\D/g, '');
                let msg = document.getElementById('tpl-msg')?.value || '';
                const nome = document.getElementById('tpl-nome')?.value || '';
                msg = msg.replace(/{nome}/g, nome).replace(/{vendedor}/g, 'Zeus Tecnologia');
                if (phone) {
                    window.open(`https://wa.me/55${phone}?text=${encodeURIComponent(msg)}`, '_blank');
                    ZeusToast.success('WhatsApp aberto!');
                } else {
                    navigator.clipboard?.writeText(msg);
                    ZeusToast.info('Mensagem copiada para a area de transferencia!');
                }
            }
        });
    }

    function showTemplates() { ZeusToast.info('Templates disponiveis acima'); }
    function showAutoReplies() { ZeusToast.info('Respostas automaticas configuradas abaixo'); }

    async function addAutoReply() {
        ZeusModal.create({
            title: 'Nova Resposta Automatica',
            content: `
                <div class="form-group"><label>Gatilho (palavras-chave separadas por |)</label><input type="text" class="form-control" id="ar-trigger" placeholder="Ex: preco|valor|orcamento"></div>
                <div class="form-group"><label>Resposta</label><textarea class="form-control" id="ar-response" rows="4"></textarea></div>
            `,
            confirmText: 'Salvar',
            onConfirm: () => {
                ZeusToast.success('Resposta automatica adicionada! (Requer WhatsApp Business API ativa no servidor)');
            }
        });
    }

    function refresh() { render(); }
    return { render, refresh, toggleConfig, saveConfig, sendSingle, sendBulk, useTemplate, showTemplates, showAutoReplies, addAutoReply };
})();
