#!/usr/bin/env node
// ============================================
// ZEUS CRM PRO - Data Migration Script
// Migrates data from old localStorage/Firestore format
// to new API-based Firestore collections
// ============================================
// Usage: node server/scripts/migrate.js
//
// This script reads the old Firestore document format
// (single document with arrays) and creates individual
// documents in the new collections.
// ============================================

require('dotenv').config();
const { initializeFirebase, getDB } = require('../config/firebase');

async function migrate() {
    console.log('========================================');
    console.log('  ZEUS CRM PRO - Migration Tool');
    console.log('========================================');

    initializeFirebase();
    const db = getDB();

    // Old format: single document 'zeusData' in 'app' collection
    // with fields like leads: [...], orcamentos: [...], etc.
    const oldDocRef = db.collection('app').doc('zeusData');
    const oldDoc = await oldDocRef.get();

    if (!oldDoc.exists) {
        console.log('[Migration] No old data found in app/zeusData');
        console.log('[Migration] Trying alternative format: zeus_crm/data');

        const altRef = db.collection('zeus_crm').doc('data');
        const altDoc = await altRef.get();

        if (!altDoc.exists) {
            console.log('[Migration] No data found. Nothing to migrate.');
            return;
        }
        await migrateData(db, altDoc.data());
        return;
    }

    await migrateData(db, oldDoc.data());
}

async function migrateData(db, data) {
    let totalMigrated = 0;

    // Migrate Leads
    if (data.leads && Array.isArray(data.leads)) {
        console.log(`\n[Leads] Found ${data.leads.length} leads to migrate...`);
        const batch = db.batch();
        for (const lead of data.leads) {
            const id = lead.id || generateId();
            const doc = {
                id,
                nome: lead.nome || lead.name || '',
                email: lead.email || '',
                telefone: lead.telefone || lead.phone || '',
                empresa: lead.empresa || lead.company || '',
                estagio: mapStage(lead.estagio || lead.stage || 'novo'),
                origem: lead.origem || lead.source || 'migrado',
                vendedor: lead.vendedor || lead.seller || '',
                valor: parseFloat(lead.valor || lead.value || 0),
                notas: lead.notas || lead.notes || '',
                tags: lead.tags || ['migrado'],
                score: lead.score || 0,
                createdAt: lead.createdAt || lead.dataEntrada || new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };
            batch.set(db.collection('zeus_leads').doc(id), doc);
            totalMigrated++;
        }
        await batch.commit();
        console.log(`[Leads] Migrated ${data.leads.length} leads`);
    }

    // Migrate Orcamentos
    if (data.orcamentos && Array.isArray(data.orcamentos)) {
        console.log(`\n[Orcamentos] Found ${data.orcamentos.length} quotes to migrate...`);
        const batch = db.batch();
        for (const orc of data.orcamentos) {
            const id = orc.id || generateId();
            const doc = {
                id,
                numero: orc.numero || `ORC-MIG-${id.substring(0, 6)}`,
                cliente: orc.cliente || orc.client || '',
                clienteEmail: orc.clienteEmail || '',
                items: orc.items || orc.itens || [],
                total: parseFloat(orc.total || 0),
                desconto: parseFloat(orc.desconto || 0),
                totalFinal: parseFloat(orc.totalFinal || orc.total || 0),
                status: orc.status || 'pendente',
                vendedor: orc.vendedor || '',
                validade: orc.validade || 30,
                observacoes: orc.observacoes || '',
                createdAt: orc.createdAt || orc.data || new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };
            batch.set(db.collection('zeus_orcamentos').doc(id), doc);
            totalMigrated++;
        }
        await batch.commit();
        console.log(`[Orcamentos] Migrated ${data.orcamentos.length} quotes`);
    }

    // Migrate Contracts
    const contracts = data.zeusContracts || data.contracts || [];
    if (contracts.length > 0) {
        console.log(`\n[Contracts] Found ${contracts.length} contracts to migrate...`);
        const batch = db.batch();
        for (const c of contracts) {
            const id = c.id || generateId();
            const doc = {
                id,
                clientName: c.clientName || c.cliente || '',
                value: parseFloat(c.value || c.valor || 0),
                description: c.description || '',
                status: c.status || 'rascunho',
                startDate: c.startDate || '',
                endDate: c.endDate || '',
                createdAt: c.createdAt || new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };
            batch.set(db.collection('zeus_contracts').doc(id), doc);
            totalMigrated++;
        }
        await batch.commit();
        console.log(`[Contracts] Migrated ${contracts.length} contracts`);
    }

    // Migrate Products
    const products = data.products || data.produtos || [];
    if (products.length > 0) {
        console.log(`\n[Products] Found ${products.length} products to migrate...`);
        const batch = db.batch();
        for (const p of products) {
            const id = p.id || generateId();
            const doc = {
                id,
                nome: p.nome || p.name || '',
                descricao: p.descricao || p.description || '',
                preco: parseFloat(p.preco || p.price || 0),
                categoria: p.categoria || 'geral',
                sku: p.sku || '',
                estoque: p.estoque || 0,
                ativo: true,
                createdAt: p.createdAt || new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };
            batch.set(db.collection('zeus_products').doc(id), doc);
            totalMigrated++;
        }
        await batch.commit();
        console.log(`[Products] Migrated ${products.length} products`);
    }

    // Migrate Tasks
    const tasks = data.zeusTasks || data.tasks || [];
    if (tasks.length > 0) {
        console.log(`\n[Tasks] Found ${tasks.length} tasks to migrate...`);
        const batch = db.batch();
        for (const t of tasks) {
            const id = t.id || generateId();
            const doc = {
                id,
                title: t.title || t.titulo || '',
                description: t.description || t.descricao || '',
                assignedTo: t.assignedTo || t.responsavel || '',
                priority: t.priority || 'media',
                status: t.status || t.done ? 'concluida' : 'pendente',
                dueDate: t.dueDate || '',
                createdAt: t.createdAt || new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };
            batch.set(db.collection('zeus_tasks').doc(id), doc);
            totalMigrated++;
        }
        await batch.commit();
        console.log(`[Tasks] Migrated ${tasks.length} tasks`);
    }

    console.log('\n========================================');
    console.log(`  Migration Complete! ${totalMigrated} records migrated`);
    console.log('========================================');
}

function mapStage(stage) {
    const mapping = {
        'new': 'novo', 'novo': 'novo',
        'contact': 'contato', 'contato': 'contato',
        'proposal': 'proposta', 'proposta': 'proposta',
        'negotiation': 'negociacao', 'negociacao': 'negociacao',
        'closed': 'fechamento', 'fechamento': 'fechamento', 'won': 'fechamento'
    };
    return mapping[stage.toLowerCase()] || 'novo';
}

function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substring(2, 8);
}

// Run
migrate().then(() => process.exit(0)).catch(err => {
    console.error('[Migration] FATAL ERROR:', err);
    process.exit(1);
});
