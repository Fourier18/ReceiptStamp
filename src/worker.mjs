// ReceiptStamp — Cloudflare Workers entry point (fetch-handler model, no Node http).
// POST /stamp  { "payload": "<string>" }  -> signed receipt (the paid call, once a rail is wired in)
// POST /verify { "payload": "<string>", "receipt": {...} } -> validity result (free, public)
// GET  /pubkey -> the public key PEM anyone can verify against (free, public)
//
// Reads keys from env bindings, not the filesystem (Workers has none):
//   env.RECEIPTSTAMP_PRIVATE_KEY_PEM — set as a Workers *secret* (wrangler secret put)
//   env.RECEIPTSTAMP_PUBLIC_KEY_PEM  — set as a plain var (safe to be non-secret)

import receiptstamp from './receiptstamp.js';
const { stamp, verify } = receiptstamp;

const MAX_BODY_BYTES = 1024 * 1024; // 1 MB cap — stamp the hash of big things, not the things

function json(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

async function readBody(request) {
  const contentLength = request.headers.get('content-length');
  if (contentLength && Number(contentLength) > MAX_BODY_BYTES) {
    throw new Error('payload too large (1 MB max)');
  }
  const text = await request.text();
  if (Buffer.byteLength(text, 'utf8') > MAX_BODY_BYTES) {
    throw new Error('payload too large (1 MB max)');
  }
  return text;
}

async function handle(request, env) {
  const url = new URL(request.url);

  if (request.method === 'GET' && url.pathname === '/pubkey') {
    return json(200, { publicKeyPem: env.RECEIPTSTAMP_PUBLIC_KEY_PEM, algo: 'ed25519-sha256' });
  }

  if (request.method !== 'POST' || (url.pathname !== '/stamp' && url.pathname !== '/verify')) {
    return json(404, { error: 'not found. POST /stamp, POST /verify, GET /pubkey' });
  }

  let body;
  try {
    body = JSON.parse(await readBody(request));
  } catch (e) {
    return json(400, { error: e.message.includes('large') ? e.message : 'invalid JSON body' });
  }

  if (typeof body.payload !== 'string' || body.payload.length === 0) {
    return json(400, { error: 'body must include a non-empty string field "payload"' });
  }

  if (url.pathname === '/stamp') {
    return json(200, {
      receipt: stamp(body.payload, env.RECEIPTSTAMP_PRIVATE_KEY_PEM, env.RECEIPTSTAMP_PUBLIC_KEY_PEM),
    });
  }

  // /verify
  const r = body.receipt;
  if (!r || typeof r.hash !== 'string' || typeof r.timestamp !== 'string' || typeof r.signature !== 'string' || typeof r.keyId !== 'string') {
    return json(400, { error: 'body must include "receipt" with hash, timestamp, signature, keyId' });
  }
  return json(200, verify(body.payload, r, env.RECEIPTSTAMP_PUBLIC_KEY_PEM));
}

export default {
  async fetch(request, env, ctx) {
    try {
      return await handle(request, env);
    } catch (err) {
      return json(500, { error: 'internal error' });
    }
  },
};
