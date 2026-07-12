// ReceiptStamp — Cloudflare Workers entry point (Hono; ESM required for the
// x402 paywall middleware, which is ESM-only).
//
// Two separate paid rails hit the same notary logic, kept deliberately apart:
//   POST /stamp       — free at the Worker level. Called ONLY by our own ACP
//                        daemon (src/acp-daemon.mjs), after ACP's own escrow
//                        has already released payment. Do not x402-paywall
//                        this route — it would make our own daemon's calls
//                        demand payment from itself and break the live ACP
//                        income flow.
//   POST /x402/stamp  — the Bazaar-facing paid route. Same stamp() call,
//                        gated by an x402 402-Payment-Required challenge
//                        settled on Base mainnet via the CDP facilitator.
//                        First settled payment here is what gets this
//                        listing auto-catalogued on x402 Bazaar.
//   POST /verify       — free, public, shared by both rails.
//   GET  /pubkey        — free, public, shared by both rails.
//
// Required env (Worker vars/secrets, not filesystem — Workers has none):
//   RECEIPTSTAMP_PRIVATE_KEY_PEM   secret — the notary's Ed25519 signing key
//   RECEIPTSTAMP_PUBLIC_KEY_PEM    var    — safe to be non-secret
//   X402_PAY_TO_ADDRESS            var    — wallet to receive Bazaar USDC
//                                            (reuses the ACP agent wallet)
//   CDP_API_KEY_ID                 secret — from portal.cdp.coinbase.com
//   CDP_API_KEY_SECRET             secret — from portal.cdp.coinbase.com

import { Hono } from 'hono';
import { paymentMiddleware } from 'x402-hono';
import { createFacilitatorConfig } from '@coinbase/x402';
import receiptstamp from './receiptstamp.js';
const { stamp, verify } = receiptstamp;

const MAX_BODY_BYTES = 1024 * 1024; // 1 MB cap — stamp the hash of big things, not the things
const PRICE_USD = '$0.02'; // keep in sync with the ACP offering's price

const STAMP_REQUIREMENT_SCHEMA = {
  body: {
    type: 'object',
    properties: { payload: { type: 'string', minLength: 1, maxLength: 1000000 } },
    required: ['payload'],
  },
};
const STAMP_OUTPUT_SCHEMA = {
  type: 'object',
  properties: {
    receipt: {
      type: 'object',
      properties: {
        hash: { type: 'string' },
        timestamp: { type: 'string' },
        signature: { type: 'string' },
        algo: { type: 'string', const: 'ed25519-sha256' },
        keyId: { type: 'string' },
      },
      required: ['hash', 'timestamp', 'signature', 'algo', 'keyId'],
    },
  },
  required: ['receipt'],
};

async function readValidatedPayload(c) {
  const contentLength = c.req.header('content-length');
  if (contentLength && Number(contentLength) > MAX_BODY_BYTES) {
    return { error: c.json({ error: 'payload too large (1 MB max)' }, 400) };
  }
  let body;
  try {
    body = await c.req.json();
  } catch {
    return { error: c.json({ error: 'invalid JSON body' }, 400) };
  }
  if (!body || typeof body.payload !== 'string' || body.payload.length === 0) {
    return { error: c.json({ error: 'body must include a non-empty string field "payload"' }, 400) };
  }
  return { payload: body.payload };
}

const app = new Hono();

app.get('/pubkey', (c) =>
  c.json({ publicKeyPem: c.env.RECEIPTSTAMP_PUBLIC_KEY_PEM, algo: 'ed25519-sha256' })
);

app.post('/verify', async (c) => {
  let body;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'invalid JSON body' }, 400);
  }
  if (!body || typeof body.payload !== 'string' || body.payload.length === 0) {
    return c.json({ error: 'body must include a non-empty string field "payload"' }, 400);
  }
  const r = body.receipt;
  if (!r || typeof r.hash !== 'string' || typeof r.timestamp !== 'string' || typeof r.signature !== 'string' || typeof r.keyId !== 'string') {
    return c.json({ error: 'body must include "receipt" with hash, timestamp, signature, keyId' }, 400);
  }
  return c.json(verify(body.payload, r, c.env.RECEIPTSTAMP_PUBLIC_KEY_PEM));
});

// Internal route for the ACP daemon — deliberately NOT paywalled here.
// ACP already collected payment via its own escrow before calling this.
// Shares stampHandler with the paid POST /x402/stamp route (declared below;
// function declarations hoist, so referencing it here is safe).
app.post('/stamp', stampHandler);

// Public, paid route for x402 Bazaar. Facilitator config needs env, which is
// only available per-request in Workers — so the x402 middleware is built
// fresh on each call rather than once at module load. Both functions are
// passed to a single app.post() call so Hono chains them via next() —
// registering the same path in two separate app.post() calls is NOT the
// same thing and must not be used here.
async function x402PaywallMiddleware(c, next) {
  const mw = paymentMiddleware(
    c.env.X402_PAY_TO_ADDRESS,
    {
      '/x402/stamp': {
        price: PRICE_USD,
        network: 'base',
        config: {
          description:
            'Signed proof-of-execution notary for AI agents: POST a payload, get hash + timestamp + signature receipt verifiable via /pubkey. Independent attestation for agent jobs and tool outputs. Pay-per-stamp x402 USDC on Base. Not custody, escrow, or delivery verification.',
          inputSchema: STAMP_REQUIREMENT_SCHEMA,
          outputSchema: STAMP_OUTPUT_SCHEMA,
          discoverable: true,
        },
      },
    },
    createFacilitatorConfig(c.env.CDP_API_KEY_ID, c.env.CDP_API_KEY_SECRET)
  );
  return mw(c, next);
}

async function stampHandler(c) {
  const { payload, error } = await readValidatedPayload(c);
  if (error) return error;
  return c.json({ receipt: stamp(payload, c.env.RECEIPTSTAMP_PRIVATE_KEY_PEM, c.env.RECEIPTSTAMP_PUBLIC_KEY_PEM) });
}

// GET variant — reads payload from a query param instead of a JSON body.
// Added because Agentic.Market's auto-crawler listed this endpoint as GET;
// the x402 payment middleware itself already matches any method (route
// patterns default to verb "*"), so this only needed a Hono GET route.
async function stampHandlerFromQuery(c) {
  const payload = c.req.query('payload');
  if (typeof payload !== 'string' || payload.length === 0) {
    return c.json({ error: 'query string must include a non-empty "payload" parameter' }, 400);
  }
  if (payload.length > 1000000) {
    return c.json({ error: 'payload too large (1 MB max)' }, 400);
  }
  return c.json({ receipt: stamp(payload, c.env.RECEIPTSTAMP_PRIVATE_KEY_PEM, c.env.RECEIPTSTAMP_PUBLIC_KEY_PEM) });
}

app.post('/x402/stamp', x402PaywallMiddleware, stampHandler);
app.get('/x402/stamp', x402PaywallMiddleware, stampHandlerFromQuery);

app.notFound((c) => c.json({ error: 'not found. POST /stamp, POST /x402/stamp, POST /verify, GET /pubkey' }, 404));
app.onError((err, c) => {
  console.error(err);
  return c.json({ error: 'internal error' }, 500);
});

export default app;
