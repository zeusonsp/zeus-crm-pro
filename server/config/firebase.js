// ============================================
// ZEUS CRM PRO - Firebase Admin Configuration
// ============================================
const admin = require('firebase-admin');

let db = null;
let auth = null;

function initializeFirebase() {
    if (admin.apps.length === 0) {
        const serviceAccount = {
            projectId: process.env.FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')
        };

        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
            databaseURL: process.env.FIREBASE_DATABASE_URL
        });
    }

    db = admin.firestore();
    auth = admin.auth();

    // Firestore settings
    db.settings({ ignoreUndefinedProperties: true });

    console.log('[Firebase] Connected to project:', process.env.FIREBASE_PROJECT_ID);
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
