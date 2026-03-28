// ============================================
// ZEUS CRM PRO - Booking Module
// ============================================
const ZeusBooking = (function() {
    async function render() {
        const container = document.getElementById('tab-booking');
        if (!container) return;

        container.innerHTML = `
            <div style="display:flex;justify-content:space-between;margin-bottom:16px">
                <h3 style="color:var(--gold)">Agendamentos</h3>
                <button class="btn btn-gold" onclick="ZeusBooking.showAdd()">+ Novo Agendamento</button>
            </div>
            <div id="bookings-list"><div class="skeleton" style="height:200px;border-radius:var(--radius)"></div></div>
        `;
        await loadData();
    }

    async function loadData() {
        try {
            const res = await ZeusAPI.marketing.bookings.list();
            const bookings = res.items;
            const el = document.getElementById('bookings-list');

            el.innerHTML = bookings.length === 0 ?
                `<div class="empty-state"><div class="empty-icon">📅</div><h3>Nenhum agendamento</h3></div>` :
                `<div class="table-container"><table>
                    <thead><tr><th>Cliente</th><th>Servico</th><th>Data</th><th>Hora</th><th>Status</th><th>Acoes</th></tr></thead>
                    <tbody>${bookings.map(b => `<tr>
                        <td><strong>${b.clientName}</strong></td>
                        <td>${b.service}</td>
                        <td>${b.date}</td>
                        <td>${b.time}</td>
                        <td><span class="badge badge-${b.status === 'confirmado' ? 'success' : b.status === 'cancelado' ? 'danger' : 'warning'}">${b.status}</span></td>
                        <td>
                            ${b.status !== 'cancelado' ? `<button class="btn btn-outline btn-sm" onclick="ZeusBooking.cancel('${b.id}')">❌ Cancelar</button>` : ''}
                        </td>
                    </tr>`).join('')}</tbody>
                </table></div>`;
        } catch (err) {
            document.getElementById('bookings-list').innerHTML = `<div class="empty-state"><p>${err.message}</p></div>`;
        }
    }

    function showAdd() {
        ZeusModal.create({
            title: 'Novo Agendamento',
            content: `
                <div class="form-group"><label>Cliente *</label><input type="text" class="form-control" id="book-client"></div>
                <div class="form-group"><label>Email</label><input type="email" class="form-control" id="book-email"></div>
                <div class="form-group"><label>Servico *</label><input type="text" class="form-control" id="book-service" value="Consulta"></div>
                <div style="display:flex;gap:10px">
                    <div class="form-group" style="flex:1"><label>Data *</label><input type="date" class="form-control" id="book-date"></div>
                    <div class="form-group" style="flex:1"><label>Hora *</label><input type="time" class="form-control" id="book-time"></div>
                </div>
                <div class="form-group"><label>Duracao (min)</label><input type="number" class="form-control" id="book-duration" value="60"></div>
            `,
            confirmText: 'Agendar',
            onConfirm: async () => {
                try {
                    await ZeusAPI.marketing.bookings.create({
                        clientName: document.getElementById('book-client')?.value,
                        clientEmail: document.getElementById('book-email')?.value,
                        service: document.getElementById('book-service')?.value,
                        date: document.getElementById('book-date')?.value,
                        time: document.getElementById('book-time')?.value,
                        duration: parseInt(document.getElementById('book-duration')?.value) || 60
                    });
                    ZeusToast.success('Agendamento criado!');
                    loadData();
                } catch (err) { ZeusToast.error(err.message); }
            }
        });
    }

    async function cancel(id) {
        const ok = await ZeusModal.confirm('Cancelar', 'Cancelar este agendamento?');
        if (!ok) return;
        try { await ZeusAPI.marketing.bookings.cancel(id); ZeusToast.success('Cancelado'); loadData(); }
        catch (err) { ZeusToast.error(err.message); }
    }

    function refresh() { loadData(); }
    return { render, refresh, showAdd, cancel };
})();
