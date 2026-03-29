// ============================================
// ZEUS CRM PRO - Report Exporter Service
// PDF & Excel export using PDFKit and ExcelJS
// ============================================

const PDFDocument = require('pdfkit');
const ExcelJS = require('exceljs');
const logger = require('./logger');

// Brand colors
const COLORS = {
  gold: '#D4AF37',
  dark: '#0A0A0A',
  darkCard: '#1A1A1A',
  text: '#333333',
  textMuted: '#666666',
  white: '#FFFFFF',
  green: '#22C55E',
  red: '#EF4444',
  blue: '#3B82F6'
};

// ================================
// PDF EXPORT
// ================================

/**
 * Generate dashboard PDF report
 */
function generateDashboardPDF(data) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margin: 50, bufferPages: true });
      const buffers = [];

      doc.on('data', chunk => buffers.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', reject);

      // Header
      drawHeader(doc, 'Relatorio Executivo - Dashboard');

      // KPI Cards
      doc.moveDown(1);
      doc.fontSize(14).fillColor(COLORS.dark).text('Indicadores Principais', { underline: true });
      doc.moveDown(0.5);

      const kpis = [
        { label: 'Total Leads', value: data.totalLeads || 0 },
        { label: 'Orcamentos', value: data.totalQuotes || 0 },
        { label: 'Contratos Ativos', value: data.activeContracts || 0 },
        { label: 'Receita Aprovada', value: `R$ ${formatNumber(data.approvedRevenue || 0)}` },
        { label: 'Receita Pendente', value: `R$ ${formatNumber(data.pendingRevenue || 0)}` },
        { label: 'Taxa Conversao', value: `${data.conversionRate || 0}%` },
        { label: 'NPS Score', value: data.npsScore || 0 },
        { label: 'Tarefas Vencidas', value: data.overdueTasks || 0 }
      ];

      kpis.forEach((kpi, i) => {
        const x = 50 + (i % 2) * 250;
        if (i % 2 === 0 && i > 0) doc.moveDown(0.3);
        doc.fontSize(10).fillColor(COLORS.textMuted).text(`${kpi.label}:`, x, doc.y, { continued: true });
        doc.fontSize(11).fillColor(COLORS.dark).text(` ${kpi.value}`);
      });

      // Pipeline
      doc.moveDown(1);
      doc.fontSize(14).fillColor(COLORS.dark).text('Pipeline de Vendas', { underline: true });
      doc.moveDown(0.5);

      if (data.leadsByStage) {
        Object.entries(data.leadsByStage).forEach(([stage, count]) => {
          doc.fontSize(10).fillColor(COLORS.text).text(`  ${stage}: ${count} leads`);
        });
      }

      // Monthly Trend
      if (data.monthlyTrend && data.monthlyTrend.length > 0) {
        doc.moveDown(1);
        doc.fontSize(14).fillColor(COLORS.dark).text('Tendencia Mensal (6 meses)', { underline: true });
        doc.moveDown(0.5);

        // Table header
        const tableTop = doc.y;
        doc.fontSize(9).fillColor(COLORS.textMuted);
        doc.text('Mes', 50, tableTop);
        doc.text('Leads', 200, tableTop);
        doc.text('Receita', 350, tableTop);

        doc.moveTo(50, tableTop + 15).lineTo(500, tableTop + 15).stroke(COLORS.gold);

        data.monthlyTrend.forEach((m, i) => {
          const y = tableTop + 20 + (i * 18);
          doc.fontSize(9).fillColor(COLORS.text);
          doc.text(m.month, 50, y);
          doc.text(String(m.leads), 200, y);
          doc.text(`R$ ${formatNumber(m.revenue)}`, 350, y);
        });
      }

      // Seller Performance
      if (data.sellerPerformance && data.sellerPerformance.length > 0) {
        doc.addPage();
        drawHeader(doc, 'Performance por Vendedor');
        doc.moveDown(1);

        data.sellerPerformance.forEach(seller => {
          doc.fontSize(11).fillColor(COLORS.dark).text(seller.name || seller.id, { underline: true });
          doc.fontSize(10).fillColor(COLORS.text);
          doc.text(`  Leads: ${seller.leads} | Fechados: ${seller.closed} | Receita: R$ ${formatNumber(seller.revenue)}`);
          doc.moveDown(0.5);
        });
      }

      // Footer
      drawFooter(doc);
      doc.end();
    } catch (err) {
      logger.error('[Export] PDF generation error:', err.message);
      reject(err);
    }
  });
}

/**
 * Generate sales report PDF
 */
function generateSalesReportPDF(data) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margin: 50, bufferPages: true });
      const buffers = [];

      doc.on('data', chunk => buffers.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', reject);

      drawHeader(doc, `Relatorio de Vendas${data.from ? ` (${data.from} a ${data.to})` : ''}`);

      doc.moveDown(1);
      doc.fontSize(12).fillColor(COLORS.dark);
      doc.text(`Total de Orcamentos: ${data.totalQuotes}`);
      doc.text(`Orcamentos Aprovados: ${data.approvedQuotes}`);
      doc.text(`Valor Total: R$ ${formatNumber(data.totalValue)}`);
      doc.text(`Ticket Medio: R$ ${formatNumber(data.avgTicket)}`);
      doc.text(`Taxa de Aprovacao: ${data.approvalRate}%`);

      if (data.quotes && data.quotes.length > 0) {
        doc.moveDown(1);
        doc.fontSize(14).fillColor(COLORS.dark).text('Detalhamento', { underline: true });
        doc.moveDown(0.5);

        const tableTop = doc.y;
        doc.fontSize(8).fillColor(COLORS.textMuted);
        doc.text('Numero', 50, tableTop);
        doc.text('Cliente', 150, tableTop);
        doc.text('Valor', 350, tableTop);
        doc.text('Status', 440, tableTop);

        doc.moveTo(50, tableTop + 12).lineTo(520, tableTop + 12).stroke(COLORS.gold);

        data.quotes.slice(0, 30).forEach((q, i) => {
          const y = tableTop + 16 + (i * 16);
          if (y > 750) return; // Page limit
          doc.fontSize(8).fillColor(COLORS.text);
          doc.text(q.numero || '-', 50, y);
          doc.text((q.clientName || '-').substring(0, 30), 150, y);
          doc.text(`R$ ${formatNumber(q.total || 0)}`, 350, y);
          doc.fillColor(q.status === 'aprovado' ? COLORS.green : COLORS.textMuted)
             .text(q.status || '-', 440, y);
        });
      }

      drawFooter(doc);
      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Generate pipeline report PDF
 */
function generatePipelinePDF(data) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margin: 50, bufferPages: true });
      const buffers = [];

      doc.on('data', chunk => buffers.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', reject);

      drawHeader(doc, 'Pipeline de Vendas');

      doc.moveDown(1);
      const stages = data.stages || [];
      const totalValue = stages.reduce((s, st) => s + (st.value || 0), 0);
      const totalCount = stages.reduce((s, st) => s + (st.count || 0), 0);

      doc.fontSize(12).fillColor(COLORS.dark);
      doc.text(`Total no Pipeline: ${totalCount} leads | R$ ${formatNumber(totalValue)}`);
      doc.moveDown(1);

      // Visual pipeline bars
      stages.forEach(stage => {
        const pct = totalCount > 0 ? (stage.count / totalCount) * 100 : 0;
        const barWidth = Math.max(pct * 4, 20);

        doc.fontSize(11).fillColor(COLORS.dark).text(stage.name || stage.stage);
        doc.fontSize(9).fillColor(COLORS.textMuted)
           .text(`${stage.count} leads | R$ ${formatNumber(stage.value || 0)} | ${pct.toFixed(1)}%`);

        // Draw bar
        const barY = doc.y + 2;
        doc.rect(50, barY, barWidth, 12).fill(COLORS.gold);
        doc.moveDown(1.2);
      });

      drawFooter(doc);
      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

// ================================
// EXCEL EXPORT
// ================================

/**
 * Generate leads Excel export
 */
async function generateLeadsExcel(leads) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Zeus CRM Pro';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet('Leads', {
    headerFooter: { oddHeader: 'Zeus CRM Pro - Leads Export' }
  });

  // Style header
  sheet.columns = [
    { header: 'Nome', key: 'nome', width: 25 },
    { header: 'Email', key: 'email', width: 30 },
    { header: 'Telefone', key: 'telefone', width: 18 },
    { header: 'Empresa', key: 'empresa', width: 25 },
    { header: 'Estagio', key: 'estagio', width: 15 },
    { header: 'Origem', key: 'origem', width: 15 },
    { header: 'Vendedor', key: 'vendedor', width: 20 },
    { header: 'Valor', key: 'valor', width: 15 },
    { header: 'AI Score', key: 'aiScore', width: 10 },
    { header: 'AI Tier', key: 'aiTier', width: 10 },
    { header: 'Tags', key: 'tags', width: 20 },
    { header: 'Criado em', key: 'createdAt', width: 20 }
  ];

  // Header row styling
  const headerRow = sheet.getRow(1);
  headerRow.eachCell(cell => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0A0A0A' } };
    cell.font = { color: { argb: 'FFD4AF37' }, bold: true, size: 11 };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.border = { bottom: { style: 'medium', color: { argb: 'FFD4AF37' } } };
  });
  headerRow.height = 30;

  // Data rows
  leads.forEach((lead, i) => {
    const row = sheet.addRow({
      nome: lead.nome,
      email: lead.email || '',
      telefone: lead.telefone || '',
      empresa: lead.empresa || '',
      estagio: lead.estagio || '',
      origem: lead.origem || '',
      vendedor: lead.vendedor || '',
      valor: lead.valor || 0,
      aiScore: lead.aiScore || '',
      aiTier: lead.aiTier || '',
      tags: (lead.tags || []).join(', '),
      createdAt: lead.createdAt ? new Date(lead.createdAt).toLocaleDateString('pt-BR') : ''
    });

    // Alternate row colors
    if (i % 2 === 0) {
      row.eachCell(cell => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F5F5' } };
      });
    }

    // Color code stages
    const stageCell = row.getCell('estagio');
    const stageColors = { novo: 'FF3B82F6', contato: 'FFF59E0B', proposta: 'FF8B5CF6', negociacao: 'FFEF4444', fechamento: 'FF22C55E' };
    if (stageColors[lead.estagio]) {
      stageCell.font = { color: { argb: stageColors[lead.estagio] }, bold: true };
    }
  });

  // Auto filter
  sheet.autoFilter = { from: 'A1', to: `L${leads.length + 1}` };

  // Freeze header
  sheet.views = [{ state: 'frozen', ySplit: 1 }];

  return workbook.xlsx.writeBuffer();
}

/**
 * Generate quotes Excel export
 */
async function generateQuotesExcel(quotes) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Zeus CRM Pro';

  const sheet = workbook.addWorksheet('Orcamentos');

  sheet.columns = [
    { header: 'Numero', key: 'numero', width: 18 },
    { header: 'Cliente', key: 'clientName', width: 25 },
    { header: 'Email', key: 'clientEmail', width: 30 },
    { header: 'Subtotal', key: 'subtotal', width: 15 },
    { header: 'Desconto', key: 'discount', width: 12 },
    { header: 'Total', key: 'total', width: 15 },
    { header: 'Status', key: 'status', width: 15 },
    { header: 'Validade', key: 'validUntil', width: 15 },
    { header: 'Criado em', key: 'createdAt', width: 18 }
  ];

  // Header styling
  const headerRow = sheet.getRow(1);
  headerRow.eachCell(cell => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0A0A0A' } };
    cell.font = { color: { argb: 'FFD4AF37' }, bold: true };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
  });
  headerRow.height = 28;

  quotes.forEach(q => {
    sheet.addRow({
      numero: q.numero || '',
      clientName: q.clientName || '',
      clientEmail: q.clientEmail || '',
      subtotal: q.subtotal || 0,
      discount: q.discount || 0,
      total: q.total || 0,
      status: q.status || '',
      validUntil: q.validUntil ? new Date(q.validUntil).toLocaleDateString('pt-BR') : '',
      createdAt: q.createdAt ? new Date(q.createdAt).toLocaleDateString('pt-BR') : ''
    });
  });

  // Format currency columns
  ['subtotal', 'discount', 'total'].forEach(col => {
    sheet.getColumn(col).numFmt = 'R$ #,##0.00';
  });

  sheet.autoFilter = { from: 'A1', to: `I${quotes.length + 1}` };
  sheet.views = [{ state: 'frozen', ySplit: 1 }];

  return workbook.xlsx.writeBuffer();
}

/**
 * Generate dashboard Excel with multiple sheets
 */
async function generateDashboardExcel(data) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Zeus CRM Pro';

  // Overview sheet
  const overview = workbook.addWorksheet('Resumo');
  overview.columns = [
    { header: 'Metrica', key: 'metric', width: 30 },
    { header: 'Valor', key: 'value', width: 25 }
  ];

  const headerRow = overview.getRow(1);
  headerRow.eachCell(cell => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0A0A0A' } };
    cell.font = { color: { argb: 'FFD4AF37' }, bold: true, size: 12 };
  });

  const metrics = [
    { metric: 'Total de Leads', value: data.totalLeads },
    { metric: 'Total de Orcamentos', value: data.totalQuotes },
    { metric: 'Contratos Ativos', value: data.activeContracts },
    { metric: 'Receita Aprovada', value: `R$ ${formatNumber(data.approvedRevenue || 0)}` },
    { metric: 'Receita Pendente', value: `R$ ${formatNumber(data.pendingRevenue || 0)}` },
    { metric: 'Taxa de Conversao', value: `${data.conversionRate || 0}%` },
    { metric: 'NPS Score', value: data.npsScore },
    { metric: 'Tarefas Pendentes', value: data.pendingTasks },
    { metric: 'Tarefas Vencidas', value: data.overdueTasks }
  ];

  metrics.forEach(m => overview.addRow(m));

  // Monthly trend sheet
  if (data.monthlyTrend) {
    const trend = workbook.addWorksheet('Tendencia Mensal');
    trend.columns = [
      { header: 'Mes', key: 'month', width: 15 },
      { header: 'Leads', key: 'leads', width: 12 },
      { header: 'Receita', key: 'revenue', width: 18 }
    ];

    const trendHeader = trend.getRow(1);
    trendHeader.eachCell(cell => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0A0A0A' } };
      cell.font = { color: { argb: 'FFD4AF37' }, bold: true };
    });

    data.monthlyTrend.forEach(m => trend.addRow(m));
    trend.getColumn('revenue').numFmt = 'R$ #,##0.00';
  }

  return workbook.xlsx.writeBuffer();
}

// ================================
// HELPERS
// ================================

function drawHeader(doc, title) {
  // Gold bar at top
  doc.rect(0, 0, 595.28, 60).fill(COLORS.dark);
  doc.fontSize(20).fillColor(COLORS.gold).text('ZEUS', 50, 15, { continued: true });
  doc.fontSize(10).fillColor(COLORS.white).text('  CRM PRO', { baseline: 'bottom' });
  doc.fontSize(8).fillColor(COLORS.gold).text('ALTA PERFORMANCE', 50, 38);
  doc.moveTo(50, 55).lineTo(545, 55).stroke(COLORS.gold);

  // Title
  doc.moveDown(2);
  doc.fontSize(18).fillColor(COLORS.dark).text(title, { align: 'center' });
  doc.fontSize(9).fillColor(COLORS.textMuted).text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')} as ${new Date().toLocaleTimeString('pt-BR')}`, { align: 'center' });
}

function drawFooter(doc) {
  const pages = doc.bufferedPageRange();
  for (let i = pages.start; i < pages.start + pages.count; i++) {
    doc.switchToPage(i);
    doc.fontSize(8).fillColor(COLORS.textMuted);
    doc.text(
      `Zeus Tecnologia | Pagina ${i + 1} de ${pages.count}`,
      50, 780,
      { align: 'center', width: 495 }
    );
  }
}

function formatNumber(num) {
  return Number(num).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

module.exports = {
  generateDashboardPDF,
  generateSalesReportPDF,
  generatePipelinePDF,
  generateLeadsExcel,
  generateQuotesExcel,
  generateDashboardExcel
};
