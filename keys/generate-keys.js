// One-time key generation. Run with: node keys/generate-keys.js
// Produces private.pem (never share, never commit) and public.pem (shareable —
// this is what a /verify endpoint or a third party checks receipts against).

const { generateKeyPairSync } = require('crypto');
const { writeFileSync, existsSync } = require('fs');
const path = require('path');

const privPath = path.join(__dirname, 'private.pem');
const pubPath = path.join(__dirname, 'public.pem');

if (existsSync(privPath) || existsSync(pubPath)) {
  console.error('Key files already exist — refusing to overwrite. Delete them first if you really want new keys (this invalidates every receipt issued so far).');
  process.exit(1);
}

const { publicKey, privateKey } = generateKeyPairSync('ed25519');

writeFileSync(privPath, privateKey.export({ type: 'pkcs8', format: 'pem' }));
writeFileSync(pubPath, publicKey.export({ type: 'spki', format: 'pem' }));

console.log('Generated keys/private.pem (keep secret) and keys/public.pem (safe to publish).');
