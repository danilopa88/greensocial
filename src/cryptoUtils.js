const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const ALGORITHM = 'aes-256-cbc';
const IV_LENGTH = 16;
let MASTER_KEY = null;

function loadOrGenerateKey() {
    // A chave mestra deve ser guardada localmente perto do banco de dados.
    const keyPath = process.pkg 
        ? path.join(path.dirname(process.execPath), 'greensocial.key')
        : path.resolve(__dirname, '..', 'greensocial.key');

    if (fs.existsSync(keyPath)) {
        MASTER_KEY = fs.readFileSync(keyPath);
    } else {
        // Se ela ainda não existe, criamos uma nova chave super segura (256 bits).
        MASTER_KEY = crypto.randomBytes(32);
        fs.writeFileSync(keyPath, MASTER_KEY);
    }
}

// Executado ao importar o modulo
loadOrGenerateKey();

function encrypt(text) {
    if (!text) return text;
    try {
        const iv = crypto.randomBytes(IV_LENGTH);
        const cipher = crypto.createCipheriv(ALGORITHM, MASTER_KEY, iv);
        let encrypted = cipher.update(text, 'utf8', 'hex');
        encrypted += cipher.final('hex');
        // O IV é guardado junto ao ciphertext. Fundamental para a arquitetura AES-CBC.
        return iv.toString('hex') + ':' + encrypted;
    } catch(err) {
        console.error("Erro ao criptografar mensagem:", err);
        return text;
    }
}

function decrypt(text) {
    if (!text) return text;
    try {
        const parts = text.split(':');
        // Se o banco possuir mensagens antigas em texto plano que não tem o formato do IV, retorne puro.
        if (parts.length !== 2) return text; 
        
        const iv = Buffer.from(parts[0], 'hex');
        const encryptedText = Buffer.from(parts[1], 'hex');
        
        const decipher = crypto.createDecipheriv(ALGORITHM, MASTER_KEY, iv);
        let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        
        return decrypted;
    } catch (err) {
        console.error("Erro ao descriptografar mensagem, servindo texto puro por fallback:", err.message);
        return text;
    }
}

module.exports = {
    encrypt,
    decrypt
};
