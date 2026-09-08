const admin = require("firebase-admin");

const REQUIRED_ENV = ["FIREBASE_PROJECT_ID", "FIREBASE_CLIENT_EMAIL"];

function readPrivateKey() {
  if (process.env.FIREBASE_PRIVATE_KEY_BASE64) {
    return Buffer.from(process.env.FIREBASE_PRIVATE_KEY_BASE64, "base64").toString("utf8");
  }

  return process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");
}

function missingFirebaseAdminEnv() {
  const missing = REQUIRED_ENV.filter((key) => !process.env[key]);
  if (!readPrivateKey()) missing.push("FIREBASE_PRIVATE_KEY");
  return missing;
}

function isFirebaseAdminConfigured() {
  return missingFirebaseAdminEnv().length === 0;
}

function getFirebaseAdminApp() {
  if (admin.apps.length) return admin.app();

  const missing = missingFirebaseAdminEnv();
  if (missing.length) {
    throw new Error(`Firebase Admin is missing environment variables: ${missing.join(", ")}`);
  }

  return admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: readPrivateKey(),
    }),
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET || undefined,
  });
}

function getFirebaseMessaging() {
  return admin.messaging(getFirebaseAdminApp());
}

module.exports = {
  getFirebaseAdminApp,
  getFirebaseMessaging,
  isFirebaseAdminConfigured,
  missingFirebaseAdminEnv,
};
