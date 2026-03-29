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
