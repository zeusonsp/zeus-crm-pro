// ============================================
// ZEUS CRM PRO - Firestore Service Layer
// ============================================
const { getDB } = require('../config/firebase');
const { v4: uuidv4 } = require('uuid');
const logger = require('./logger');

class FirestoreService {
    constructor(collectionName) {
        this.collectionName = collectionName;
    }

    get collection() {
        return getDB().collection(this.collectionName);
    }

    // Create document
    async create(data, customId = null) {
        const id = customId || uuidv4();
        const timestamp = new Date().toISOString();
        const doc = {
            ...data,
            id,
            createdAt: timestamp,
            updatedAt: timestamp
        };
        await this.collection.doc(id).set(doc);
        logger.info(`[Firestore] Created ${this.collectionName}/${id}`);
        return doc;
    }

    // Get by ID
    async getById(id) {
        const doc = await this.collection.doc(id).get();
        if (!doc.exists) return null;
        return { id: doc.id, ...doc.data() };
    }

    // Get all with pagination and filters
    async getAll({ page = 1, limit = 50, sort = 'createdAt', order = 'desc', filters = {} } = {}) {
        let query = this.collection;

        // Apply filters
        for (const [field, value] of Object.entries(filters)) {
            if (value !== undefined && value !== null && value !== '') {
                if (typeof value === 'object' && value.operator) {
                    query = query.where(field, value.operator, value.value);
                } else {
                    query = query.where(field, '==', value);
                }
            }
        }

        // Sort
        query = query.orderBy(sort, order);

        // Get total count (approximation for large collections)
        const countSnapshot = await query.count().get();
        const total = countSnapshot.data().count;

        // Paginate
        const offset = (page - 1) * limit;
        if (offset > 0) {
            query = query.offset(offset);
        }
        query = query.limit(limit);

        const snapshot = await query.get();
        const items = [];
        snapshot.forEach(doc => items.push({ id: doc.id, ...doc.data() }));

        return {
            items,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
                hasMore: page * limit < total
            }
        };
    }

    // Update document
    async update(id, data) {
        const doc = await this.getById(id);
        if (!doc) return null;

        const updated = {
            ...data,
            updatedAt: new Date().toISOString()
        };
        delete updated.id;
        delete updated.createdAt;

        await this.collection.doc(id).update(updated);
        logger.info(`[Firestore] Updated ${this.collectionName}/${id}`);
        return { ...doc, ...updated };
    }

    // Delete document
    async delete(id) {
        const doc = await this.getById(id);
        if (!doc) return false;
        await this.collection.doc(id).delete();
        logger.info(`[Firestore] Deleted ${this.collectionName}/${id}`);
        return true;
    }

    // Bulk create
    async bulkCreate(items) {
        const batch = getDB().batch();
        const timestamp = new Date().toISOString();
        const results = [];

        for (const item of items) {
            const id = item.id || uuidv4();
            const doc = { ...item, id, createdAt: timestamp, updatedAt: timestamp };
            batch.set(this.collection.doc(id), doc);
            results.push(doc);
        }

        await batch.commit();
        logger.info(`[Firestore] Bulk created ${results.length} docs in ${this.collectionName}`);
        return results;
    }

    // Bulk update
    async bulkUpdate(updates) {
        const batch = getDB().batch();
        const timestamp = new Date().toISOString();

        for (const { id, data } of updates) {
            batch.update(this.collection.doc(id), { ...data, updatedAt: timestamp });
        }

        await batch.commit();
        logger.info(`[Firestore] Bulk updated ${updates.length} docs in ${this.collectionName}`);
        return true;
    }

    // Search by field containing text
    async search(field, searchText, limit = 20) {
        const end = searchText + '\uf8ff';
        const snapshot = await this.collection
            .where(field, '>=', searchText)
            .where(field, '<=', end)
            .limit(limit)
            .get();

        const items = [];
        snapshot.forEach(doc => items.push({ id: doc.id, ...doc.data() }));
        return items;
    }

    // Aggregate: count by field
    async countByField(field) {
        const snapshot = await this.collection.get();
        const counts = {};
        snapshot.forEach(doc => {
            const val = doc.data()[field] || 'undefined';
            counts[val] = (counts[val] || 0) + 1;
        });
        return counts;
    }
}

module.exports = FirestoreService;
