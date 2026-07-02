// ReceiptStamp core: stateless proof-of-execution notary.
// Given a payload, produces a signed hash+timestamp receipt. Anyone holding
// the public key can later verify the payload existed, unaltered, at that
// timestamp. No database, no server state — the receipt is self-contained.

const crypto = require('node:crypto'); // 'node:' prefix required by Workers' nodejs_compat

function canonicalize(hash, timestamp) {
  // Fixed field order so signer and verifier always sign/check the same bytes.
  return JSON.stringify({ hash, timestamp });
}

function keyFingerprint(publicKeyPem) {
  return crypto.createHash('sha256').update(publicKeyPem).digest('hex').slice(0, 16);
}

function stamp(payload, privateKeyPem, publicKeyPem) {
  const payloadBuf = Buffer.isBuffer(payload) ? payload : Buffer.from(payload);
  const hash = crypto.createHash('sha256').update(payloadBuf).digest('hex');
  const timestamp = new Date().toISOString();
  const message = canonicalize(hash, timestamp);

  const privateKey = crypto.createPrivateKey(privateKeyPem);
  const signature = crypto.sign(null, Buffer.from(message), privateKey).toString('base64');

  return {
    hash,
    timestamp,
    signature,
    algo: 'ed25519-sha256',
    keyId: keyFingerprint(publicKeyPem),
  };
}

function verify(payload, receipt, publicKeyPem) {
  const payloadBuf = Buffer.isBuffer(payload) ? payload : Buffer.from(payload);
  const actualHash = crypto.createHash('sha256').update(payloadBuf).digest('hex');

  if (actualHash !== receipt.hash) {
    return { valid: false, reason: 'payload does not match receipt hash (tampered or wrong payload)' };
  }

  const expectedKeyId = keyFingerprint(publicKeyPem);
  if (expectedKeyId !== receipt.keyId) {
    return { valid: false, reason: 'receipt was not issued by this public key' };
  }

  const message = canonicalize(receipt.hash, receipt.timestamp);
  const publicKey = crypto.createPublicKey(publicKeyPem);
  const sigValid = crypto.verify(
    null,
    Buffer.from(message),
    publicKey,
    Buffer.from(receipt.signature, 'base64')
  );

  if (!sigValid) {
    return { valid: false, reason: 'signature does not verify against this public key (forged or corrupted receipt)' };
  }

  return { valid: true, reason: 'ok', timestamp: receipt.timestamp };
}

module.exports = { stamp, verify };
