// firebase.js
require('dotenv').config();
const admin = require('firebase-admin');

let db;

try {
    // ✅ FAQAT BIR MARTA INITIALIZE
    if (admin.apps.length === 0) {
        const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
        if (!serviceAccountJson) throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON topilmadi.");
        const serviceAccount = JSON.parse(serviceAccountJson);
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
        });
        console.log("✅ Firebase initialize qilindi.");
    } else {
        console.log("✅ Firebase allaqachon mavjud.");
    }

    db = admin.firestore();
    console.log("✅ Firestore ulandi.");
} catch (error) {
    console.error("❌ Firebase sozlashda xato!", error.message);
}

module.exports = { db, admin };