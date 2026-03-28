// ============================================
// ZEUS CRM PRO - Firebase Admin Configuration
// ============================================
const admin = require('firebase-admin');

let db = null;
let auth = null;

function initializeFirebase() {
    if (admin.apps.length === 0) {
        const projectId = process.env.FIREBASE_PROJECT_ID;
        const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
        const privateKey = process.env.FIREBASE_PRIVATE_KEY;

        if (projectId && clientEmail && privateKey) {
            admin.initializeApp({
                credential: admin.credential.cert({
                    projectId,
                    clientEmail,
                    privateKey: privateKey.replace(/\\n/g, '\n')
                }),
                databaseURL: process.env.FIREBASE_DATABASE_URL
            });
            db = admin.firestore();
            auth = admin.auth();
            db.settings({ ignoreUndefinedProperties: true });
            console.log('[Firebase] Connected to project:', projectId);
        } else {
            console.warn('[Firebase] Missing credentials - running without Firebase.');
            console.warn('[Firebase] Set FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY to enable.');
        }
    }
    return { db, auth, admin };
}

function getDB() {
    if (!db) initializeFirebase();
    return db;
}

function getAuth() {
    if (!auth) initializeFirebase();
    return auth;
}

module.exports = { initializeFirebase, getDB, getAuth, admin };
