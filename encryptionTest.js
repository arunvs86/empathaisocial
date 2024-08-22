const crypto = require('crypto');

// Encryption and Decryption functions
const algorithm = 'aes-256-cbc';
envKey = "8c14982db794659d700ca7a92f6a70d9287817bfdd98ff378d6089f9f02e5744"
envIV = "f3362ff43fc7ca3cc3fa674d841f4f75" 

const key = Buffer.from(envKey, 'hex'); // Load key from environment
const iv = Buffer.from(envIV, 'hex'); // Load IV from environment

function encrypt(text) {
    let cipher = crypto.createCipheriv(algorithm, key, iv);
    let encrypted = cipher.update(text, 'utf-8', 'hex');
    encrypted += cipher.final('hex');
    return iv.toString('hex') + ':' + encrypted;
}

function decrypt(encryptedText) {
    let textParts = encryptedText.split(':');
    let iv = Buffer.from(textParts.shift(), 'hex');
    let encrypted = textParts.join(':');
    let decipher = crypto.createDecipheriv(algorithm, key, iv);
    let decrypted = decipher.update(encrypted, 'hex', 'utf-8');
    decrypted += decipher.final('utf-8');
    return decrypted;
}
