// ReceiptStamp HTTP server — Node built-ins only, no dependencies.
// POST /stamp  { "payload": "<string>" }  -> signed receipt (the paid call, once a rail is wired in)
// POST /verify { "payload": "<string>", "receipt": {...} } -> validity result (free, public)
// GET  /pubkey -> the public key PEM anyone can verify against (free, public)
// Run: node src/server.js   (PORT env var optional, defaults to 8402)

const http = require('http');
const { readFileSync } = require('fs');
const path = require('path');
const { stamp, verify } = require('./receiptstamp');

const privateKeyPem = readFileSync(path.join(__dirname, '../keys/private.pem'), 'utf8');
const publicKeyPem = readFileSync(path.join(__dirname, '../keys/public.pem'), 'utf8');

const MAX_BODY_BYTES = 1024 * 1024; // 1 MB cap — stamp the hash of big things, not the things

function json(res, status, body) {
  const data = JSON.stringify(body);
  res.writeHead(status, { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) });
  res.end(data);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(new Error('payload too large (1 MB max)'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === 'GET' && req.url === '/pubkey') {
      return json(res, 200, { publicKeyPem, algo: 'ed25519-sha256' });
    }

    if (req.method !== 'POST' || (req.url !== '/stamp' && req.url !== '/verify')) {
      return json(res, 404, { error: 'not found. POST /stamp, POST /verify, GET /pubkey' });
    }

    let body;
    try {
      body = JSON.parse(await readBody(req));
    } catch (e) {
      return json(res, 400, { error: e.message.includes('large') ? e.message : 'invalid JSON body' });
    }

    if (typeof body.payload !== 'string' || body.payload.length === 0) {
      return json(res, 400, { error: 'body must include a non-empty string field "payload"' });
    }

    if (req.url === '/stamp') {
      return json(res, 200, { receipt: stamp(body.payload, privateKeyPem, publicKeyPem) });
    }

    // /verify
    const r = body.receipt;
    if (!r || typeof r.hash !== 'string' || typeof r.timestamp !== 'string' || typeof r.signature !== 'string' || typeof r.keyId !== 'string') {
      return json(res, 400, { error: 'body must include "receipt" with hash, timestamp, signature, keyId' });
    }
    return json(res, 200, verify(body.payload, r, publicKeyPem));
  } catch (err) {
    return json(res, 500, { error: 'internal error' });
  }
});

const port = process.env.PORT || 8402;
server.listen(port, () => console.log(`ReceiptStamp listening on http://localhost:${port}`));

module.exports = server;
