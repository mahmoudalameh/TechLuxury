// ============================================================
// 🔐 TechLuxury — Encryption Module
// الإصدار: 1
// الخوارزمية: PBKDF2 + HKDF + AES-256-GCM
// ============================================================

const ENCRYPTION_VERSION = 1;
const PBKDF2_ITERATIONS = 250000; // يمكن تعديلها حسب اختبار الأداء
const HKDF_INFO = "TechLuxury Encryption v1";

// ============================================================
// 🎲 توليد عشوائي آمن
// ============================================================
function generateSecret() {
    const secret = new Uint8Array(32);
    crypto.getRandomValues(secret);
    return secret;
}

function generateSalt() {
    const salt = new Uint8Array(16);
    crypto.getRandomValues(salt);
    return salt;
}

function generateIV() {
    const iv = new Uint8Array(12);
    crypto.getRandomValues(iv);
    return iv;
}

// ============================================================
// 🔢 Base64URL (مناسب للروابط)
// ============================================================
function bytesToBase64Url(bytes) {
    let binary = "";
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return btoa(binary)
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");
}

function base64UrlToBytes(base64url) {
    const padded = base64url
        .replace(/-/g, "+")
        .replace(/_/g, "/")
        .padEnd(Math.ceil(base64url.length / 4) * 4, "=");
    const binary = atob(padded);
    return Uint8Array.from(binary, char => char.charCodeAt(0));
}

// ============================================================
// 🔑 اشتقاق المفتاح النهائي (Password + Secret → AES Key)
// ============================================================
async function derivePasswordBits(password, salt, iterations) {
    const encoder = new TextEncoder();
    const baseKey = await crypto.subtle.importKey(
        "raw",
        encoder.encode(password),
        "PBKDF2",
        false,
        ["deriveBits"]
    );
    return crypto.subtle.deriveBits(
        { name: "PBKDF2", salt: salt, iterations: iterations, hash: "SHA-256" },
        baseKey,
        256
    );
}

/**
 * اشتقاق المفتاح النهائي من Password + Secret (اختياري) + Salt
 */
async function deriveFinalKey(password, secret, salt, iterations = PBKDF2_ITERATIONS) {
    // 1. اشتقاق من كلمة المرور
    const passwordBits = await derivePasswordBits(password, salt, iterations);

    // 2. دمج passwordBits + secret (إن وُجد)
    const ikm = new Uint8Array(
        passwordBits.byteLength + (secret ? secret.byteLength : 0)
    );
    ikm.set(new Uint8Array(passwordBits), 0);
    if (secret) ikm.set(secret, passwordBits.byteLength);

    // 3. HKDF لاشتقاق المفتاح النهائي
    const hkdfKey = await crypto.subtle.importKey(
        "raw",
        ikm,
        "HKDF",
        false,
        ["deriveKey"]
    );

    return crypto.subtle.deriveKey(
        {
            name: "HKDF",
            hash: "SHA-256",
            salt: salt,
            info: new TextEncoder().encode(HKDF_INFO)
        },
        hkdfKey,
        { name: "AES-GCM", length: 256 },
        false,
        ["encrypt", "decrypt"]
    );
}

// ============================================================
// 🔐 تشفير / فك تشفير البيانات
// ============================================================
async function encryptData(data, key, additionalData = null) {
    const iv = generateIV();
    const params = { name: "AES-GCM", iv: iv };
    if (additionalData) params.additionalData = additionalData;

    const encrypted = await crypto.subtle.encrypt(params, key, data);
    return { iv, ciphertext: new Uint8Array(encrypted) };
}

async function decryptData(ciphertext, iv, key, additionalData = null) {
    try {
        const params = { name: "AES-GCM", iv: iv };
        if (additionalData) params.additionalData = additionalData;

        const decrypted = await crypto.subtle.decrypt(params, key, ciphertext);
        return new Uint8Array(decrypted);
    } catch (error) {
        throw new Error("DECRYPTION_FAILED");
    }
}

// ============================================================
// 📸 تشفير / فك تشفير ملف
// ============================================================
async function encryptFile(file, key, additionalData = null) {
    const buffer = await file.arrayBuffer();
    const result = await encryptData(buffer, key, additionalData);
    return {
        encryptedBlob: new Blob([result.ciphertext], { type: "application/octet-stream" }),
        iv: result.iv
    };
}

async function decryptFile(encryptedBlob, iv, key, additionalData = null) {
    const buffer = await encryptedBlob.arrayBuffer();
    const decrypted = await decryptData(new Uint8Array(buffer), iv, key, additionalData);
    return new Blob([decrypted]);
}

// ============================================================
// 📜 تشفير / فك تشفير النصوص
// ============================================================
async function encryptText(text, key) {
    const encoder = new TextEncoder();
    const result = await encryptData(encoder.encode(text), key);
    return {
        ciphertext: bytesToBase64Url(result.ciphertext),
        iv: bytesToBase64Url(result.iv)
    };
}

async function decryptText(ciphertextB64, ivB64, key) {
    const ciphertext = base64UrlToBytes(ciphertextB64);
    const iv = base64UrlToBytes(ivB64);
    const decrypted = await decryptData(ciphertext, iv, key);
    return new TextDecoder().decode(decrypted);
}

// ============================================================
// 📋 Manifest (للتحقق من كلمة المرور)
// ============================================================
function createManifest(cardId) {
    return JSON.stringify({
        version: ENCRYPTION_VERSION,
        cardId: cardId,
        verification: "TECHLUXURY",
        createdAt: new Date().toISOString()
    });
}

async function encryptManifest(cardId, key) {
    const manifest = createManifest(cardId);
    const encoder = new TextEncoder();
    const result = await encryptData(encoder.encode(manifest), key);
    return {
        ciphertext: bytesToBase64Url(result.ciphertext),
        iv: bytesToBase64Url(result.iv)
    };
}

async function verifyManifest(encryptedManifest, key) {
    try {
        const ciphertext = base64UrlToBytes(encryptedManifest.ciphertext);
        const iv = base64UrlToBytes(encryptedManifest.iv);
        const decrypted = await decryptData(ciphertext, iv, key);
        const manifest = JSON.parse(new TextDecoder().decode(decrypted));
        
        if (manifest.verification !== "TECHLUXURY") {
            throw new Error("INVALID_MANIFEST");
        }
        return manifest;
    } catch (error) {
        throw new Error("WRONG_PASSWORD_OR_TAMPERED");
    }
}

// ============================================================
// 🎫 قراءة Card ID و Secret من الرابط
// ============================================================
function getCardCredentialsFromURL() {
    // دعم كلا الصيغتين:
    // 1. customer-view.html?id=CARDID
    // 2. /c/CARDID#k=SECRET
    const params = new URLSearchParams(window.location.search);
    let cardId = params.get("id") || params.get("card") || params.get("c");

    const pathParts = window.location.pathname.split("/").filter(Boolean);
    const cIndex = pathParts.indexOf("c");
    if (cIndex !== -1 && pathParts[cIndex + 1]) {
        cardId = pathParts[cIndex + 1].toUpperCase();
    }

    // استخراج Secret من Fragment #k=SECRET
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    const secretB64 = hashParams.get("k");
    const secret = secretB64 ? base64UrlToBytes(secretB64) : null;

    return { cardId, secret };
}

// ============================================================
// 🌐 بناء رابط NFC
// ============================================================
function createNfcUrl(baseUrl, cardId, secretBytes) {
    const secretB64 = bytesToBase64Url(secretBytes);
    return `${baseUrl}/c/${cardId}#k=${secretB64}`;
}

// ============================================================
// 🎯 تصدير الدوال
// ============================================================
export {
    ENCRYPTION_VERSION,
    PBKDF2_ITERATIONS,
    generateSecret,
    generateSalt,
    generateIV,
    bytesToBase64Url,
    base64UrlToBytes,
    deriveFinalKey,
    encryptData,
    decryptData,
    encryptFile,
    decryptFile,
    encryptText,
    decryptText,
    createManifest,
    encryptManifest,
    verifyManifest,
    getCardCredentialsFromURL,
    createNfcUrl
};
