/**
 * Zeus CRM Pro v4.0 - Import/Export de Leads
 * Importação massiva via CSV/Excel + Exportação
 */
const router = require('express').Router();
const multer = require('multer');
const csv = require('csv-parser');
const ExcelJS = require('exceljs');
const { Readable } = require('stream');
const { v4: uuid } = require('uuid');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const allowed = ['.csv', '.xlsx', '.xls'];
    const ext = file.originalname.toLowerCase().slice(file.originalname.lastIndexOf('.'));
    if (allowed.includes(ext)) cb(null, true);
    else cb(new Error('Formato não suportado. Use CSV ou Excel (.xlsx)'));
  }
});

// POST /api/import/leads - Importar leads de CSV/Excel
router.post('/leads', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'Nenhum arquivo enviado' });
    }

    const { buffer, originalname } = req.file;
    const ext = originalname.toLowerCase().slice(originalname.lastIndexOf('.'));
    const { duplicateAction = 'skip', defaultStage = 'novo', defaultOrigin = 'import' } = req.body;

    let rawLeads = [];

    if (ext === '.csv') {
      rawLeads = await parseCSV(buffer);
    } else {
      rawLeads = await parseExcel(buffer);
    }

    if (rawLeads.length === 0) {
      return res.status(400).json({ success: false, error: 'Arquivo vazio ou formato inválido' });
    }

    // Validate and normalize leads
    const { valid, invalid } = validateLeads(rawLeads);

    // Import to Firestore
    const admin = require('firebase-admin');
    const db = admin.firestore();
    const batch = db.batch();

    let imported = 0;
    let skipped = 0;
    let duplicates = 0;
    const errors = [];

    // Get existing leads for dedup check
    const existingSnap = await db.collection('leads').get();
    const existingEmails = new Set();
    const existingPhones = new Set();
    existingSnap.forEach(doc => {
      const d = doc.data();
      if (d.email) existingEmails.add(d.email.toLowerCase().trim());
      if (d.telefone) existingPhones.add(d.telefone.replace(/\D/g, ''));
    });

    for (const lead of valid) {
      const emailNorm = (lead.email || '').toLowerCase().trim();
      const phoneNorm = (lead.telefone || '').replace(/\D/g, '');

      // Check duplicates
      const isDuplicate = (emailNorm && existingEmails.has(emailNorm)) ||
                          (phoneNorm && phoneNorm.length >= 10 && existingPhones.has(phoneNorm));

      if (isDuplicate) {
        duplicates++;
        if (duplicateAction === 'skip') {
          skipped++;
          continue;
        }
        // duplicateAction === 'update' -> proceed to create (overwrite logic can be added)
      }

      const id = uuid();
      const ref = db.collection('leads').doc(id);
      batch.set(ref, {
        id,
        nome: lead.nome || '',
        empresa: lead.empresa || '',
        email: emailNorm,
        telefone: lead.telefone || '',
        valor: parseFloat(lead.valor) || 0,
        estagio: lead.estagio || defaultStage,
        origem: lead.origem || defaultOrigin,
        vendedor: lead.vendedor || req.user?.name || '',
        tags: lead.tags ? lead.tags.split(',').map(t => t.trim()) : [],
        notas: lead.notas || '',
        importedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        importBatch: req.file.originalname
      });
      imported++;
      existingEmails.add(emailNorm);
      if (phoneNorm) existingPhones.add(phoneNorm);
    }

    if (imported > 0) {
      await batch.commit();
    }

    // Real-time notification
    const io = req.app.get('io');
    if (io) io.emit('leads-imported', { count: imported, file: originalname });

    const logger = require('../services/logger');
    logger.info(`[Import] ${imported} leads imported from ${originalname}, ${skipped} skipped, ${duplicates} duplicates, ${invalid.length} invalid`);

    res.json({
      success: true,
      summary: {
        total: rawLeads.length,
        imported,
        skipped,
        duplicates,
        invalid: invalid.length,
        errors: invalid.slice(0, 10) // First 10 errors
      }
    });
  } catch (err) {
    console.error('[Import] Error:', err.message);
    res.status(500).json({ success: false, error: 'Erro ao importar leads', details: err.message });
  }
});

// GET /api/import/template - Download template CSV
router.get('/template', (req, res) => {
  const template = 'nome,empresa,email,telefone,valor,estagio,origem,vendedor,tags,notas\n' +
    'João Silva,Tech Corp,joao@tech.com,(11) 99999-0001,15000,novo,site,Carlos,"led,indoor",Cliente interessado em paineis\n' +
    'Maria Santos,Events LLC,maria@events.com,(21) 88888-0002,45000,qualificado,indicacao,Ana,"outdoor,evento",Orçamento para evento';

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename=zeus-import-template.csv');
  res.send(template);
});

// GET /api/import/export-leads - Export all leads as Excel
router.get('/export-leads', async (req, res) => {
  try {
    const admin = require('firebase-admin');
    const db = admin.firestore();
    const snap = await db.collection('leads').orderBy('createdAt', 'desc').get();

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Zeus CRM Pro';
    const sheet = workbook.addWorksheet('Leads', {
      headerFooter: { firstHeader: 'Zeus CRM Pro - Exportação de Leads' }
    });

    sheet.columns = [
      { header: 'Nome', key: 'nome', width: 25 },
      { header: 'Empresa', key: 'empresa', width: 25 },
      { header: 'Email', key: 'email', width: 30 },
      { header: 'Telefone', key: 'telefone', width: 18 },
      { header: 'Valor (R$)', key: 'valor', width: 15 },
      { header: 'Estágio', key: 'estagio', width: 15 },
      { header: 'Origem', key: 'origem', width: 15 },
      { header: 'Vendedor', key: 'vendedor', width: 20 },
      { header: 'Tags', key: 'tags', width: 25 },
      { header: 'Score AI', key: 'aiScore', width: 12 },
      { header: 'Tier', key: 'aiTier', width: 10 },
      { header: 'Criado em', key: 'createdAt', width: 20 }
    ];

    // Style header
    sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD4AF37' } };

    snap.forEach(doc => {
      const d = doc.data();
      sheet.addRow({

        nome: d.nome,
        empresa: d.empresa,
        email: d.email,
        telefone: d.telefone,
        valor: d.valor || 0,
        estagio* d.estagio,
        origem: d.origem,
        vendedor: d.vendedor,
        tags: Array.isArray(d.tags) ? d.tags.join(', ') : '',
        aiScore: d.aiScore || '',
        aiTier: d.aiTier || '',
        createdAt: d.createdAt || ''
      });
    });

    sheet.autoFilter = 'A1:L1';

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=zeus-leads-${new Date().toISOString().split('T')[0]}.xlsx`);
    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error('[Import] Export error:', err.message);
    res.status(500).json({ success: false, error: 'Erro ao exportar leads' });
  }
});

// Helper: Parse CSV buffer
function parseCSV(buffer) {
  return new Promise((resolve, reject) => {
    const results = [];
    const stream = Readable.from(buffer.toString());
    stream.pipe(csv({ separator: ',', skipEmptyLines: true }))
      .on('data', row => results.push(row))
      .on('end', () => resolve(results))
      .on('error', reject);
  });
}

// Helper: Parse Excel buffer
async function parseExcel(buffer) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const sheet = workbook.worksheets[0];
  if (!sheet) return {[];

  const headers = [];
  const results = [];

  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) {
      row.eachCell((cell, colNumber) => {
        headers[colNumber] = String(cell.value || '').toLowerCase().trim()
          .replace(/nome completo|name/, 'nome')
          .replace(/company|empresa/, 'empresa')
          .replace(/e-mail|e_mail/, 'email')
          .replace(/phone|fone|celular/, 'telefone')
          .replace(/value|valor estimado/, 'valor')
          .replace(/stage|estágio|estagio/, 'estagio')
          .replace(/source|origin/, 'origem');
      });
    } else {
      const obj = {};
      row.eachCell((cell, colNumber) => {
        if (headers[colNumber]) obj[headers[colNumber]] = String(cell.value || '');
      });
      if (Object.keys(obj).length > 0) results.push(obj);
    }
  });

  return results;
}

// Helper: Validate leads
function validateLeads(rawLeads) {
  const valid = [];
  const invalid = [];

  rawLeads.forEach((lead, index) => {
    const errors = [];
    if (!lead.nome && !lead.empresa && !lead.email) {
      errors.push('Pelo menos nome, empresa ou email é obrigatório');
    }
    if (lead.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(lead.email)) {
      errors.push('Email inválido');
    }
    if (lead.valor && isNaN(parseFloat(lead.valor))) {
      errors.push('Valor deve ser numérico');
    }

    if (errors.length > 0) {
      invalid.push({ row: index + 2, lead, errors });
    } else {
      valid.push(lead);
    }
  });

  return { valid, invalid };
}

module.exports = router;
