// Local proof that stamp/verify actually works, including tamper detection.
// Run with: node test/test.js

const { readFileSync } = require('fs');
const path = require('path');
const { stamp, verify } = require('../src/receiptstamp');

const privateKeyPem = readFileSync(path.join(__dirname, '../keys/private.pem'), 'utf8');
const publicKeyPem = readFileSync(path.join(__dirname, '../keys/public.pem'), 'utf8');

function assert(cond, msg) {
  if (!cond) {
    console.error('FAIL:', msg);
    process.exitCode = 1;
  } else {
    console.log('PASS:', msg);
  }
}

// 1. Round trip: stamp then verify the same payload
const payload = 'agent output: task #42 completed, result = 3.14159';
const receipt = stamp(payload, privateKeyPem, publicKeyPem);
console.log('Receipt:', receipt);

const result1 = verify(payload, receipt, publicKeyPem);
assert(result1.valid === true, 'genuine payload + genuine receipt verifies true');

// 2. Tamper detection: change the payload after stamping
const tamperedPayload = 'agent output: task #42 completed, result = 9999999';
const result2 = verify(tamperedPayload, receipt, publicKeyPem);
assert(result2.valid === false, 'tampered payload fails verification');
assert(result2.reason.includes('does not match'), 'tamper failure reason is the hash mismatch');

// 3. Forged signature detection: hand-edit the receipt's signature
const forgedReceipt = { ...receipt, signature: Buffer.from('not a real signature').toString('base64') };
const result3 = verify(payload, forgedReceipt, publicKeyPem);
assert(result3.valid === false, 'forged/corrupted signature fails verification');

// 4. Wrong key detection: verify against a different keypair
const { generateKeyPairSync } = require('crypto');
const otherKeys = generateKeyPairSync('ed25519');
const otherPublicPem = otherKeys.publicKey.export({ type: 'spki', format: 'pem' });
const result4 = verify(payload, receipt, otherPublicPem);
assert(result4.valid === false, 'verifying against an unrelated public key fails');

console.log(process.exitCode === 1 ? '\nSOME TESTS FAILED' : '\nALL TESTS PASSED');
