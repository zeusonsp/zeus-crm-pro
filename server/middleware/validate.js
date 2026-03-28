// ============================================
// ZEUS CRM PRO - Request Validation
// ============================================
const { validationResult, body, param, query } = require('express-validator');

function handleValidation(req, res, next) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            success: false,
            error: 'Dados invalidos',
            code: 'VALIDATION_ERROR',
            details: errors.array().map(e => ({
                field: e.path,
                message: e.msg
            }))
        });
    }
    next();
}

// Lead validations
const validateLead = [
    body('nome').trim().notEmpty().withMessage('Nome e obrigatorio'),
    body('email').optional().isEmail().withMessage('Email invalido'),
    body('telefone').optional().trim(),
    body('empresa').optional().trim(),
    body('estagio').optional().isIn(['novo', 'contato', 'proposta', 'negociacao', 'fechamento']),
    body('origem').optional().trim(),
    handleValidation
];

// Orcamento validations
const validateOrcamento = [
    body('cliente').trim().notEmpty().withMessage('Cliente e obrigatorio'),
    body('items').isArray({ min: 1 }).withMessage('Minimo 1 item'),
    body('items.*.descricao').trim().notEmpty().withMessage('Descricao do item obrigatoria'),
    body('items.*.quantidade').isInt({ min: 1 }).withMessage('Quantidade minima: 1'),
    body('items.*.valorUnitario').isFloat({ min: 0 }).withMessage('Valor deve ser positivo'),
    handleValidation
];

// Contract validations
const validateContract = [
    body('clientName').trim().notEmpty().withMessage('Nome do cliente obrigatorio'),
    body('value').isFloat({ min: 0 }).withMessage('Valor deve ser positivo'),
    body('status').optional().isIn(['rascunho', 'enviado', 'assinado', 'cancelado']),
    handleValidation
];

// Product validations
const validateProduct = [
    body('nome').trim().notEmpty().withMessage('Nome do produto obrigatorio'),
    body('preco').isFloat({ min: 0 }).withMessage('Preco deve ser positivo'),
    handleValidation
];

// ID param validation
const validateId = [
    param('id').trim().notEmpty().withMessage('ID obrigatorio'),
    handleValidation
];

// Pagination query
const validatePagination = [
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
    query('sort').optional().trim(),
    query('order').optional().isIn(['asc', 'desc']),
    handleValidation
];

module.exports = {
    handleValidation,
    validateLead,
    validateOrcamento,
    validateContract,
    validateProduct,
    validateId,
    validatePagination
};
