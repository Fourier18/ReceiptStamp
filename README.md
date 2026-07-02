# ReceiptStamp

A stateless proof-of-execution notary. An agent sends a payload (some output
it produced), gets back a signed hash + timestamp receipt. Anyone holding the
public key can later verify that exact payload existed, unaltered, at that
exact time — without trusting the agent's own word for it.

Live: https://receiptstamp.panmediatech.workers.dev

## API

- `POST /stamp` — `{ "payload": "<string>" }` → signed receipt (the paid call)
- `POST /verify` — `{ "payload": "<string>", "receipt": {...} }` → `{ valid, reason }` (free)
- `GET /pubkey` — the public key PEM to verify against (free)

Receipt shape: `{ hash, timestamp, signature, algo, keyId }` — SHA-256 hash of
the payload, Ed25519 signature over `{hash, timestamp}`, ISO-8601 timestamp.

## Structure

- [`src/receiptstamp.js`](src/receiptstamp.js) — core `stamp()`/`verify()` logic (Ed25519 + SHA-256)
- [`src/server.js`](src/server.js) — Node `http` server, for local dev
- [`src/worker.mjs`](src/worker.mjs) — Cloudflare Workers fetch-handler, what's actually deployed
- [`keys/`](keys) — key generation script (`generate-keys.js`); the private key itself is gitignored, never committed
- [`test/`](test) — test suites for the core logic, the Node server, and the Worker handler

See [PLAN.md](PLAN.md) for the project rationale, kill criterion, and current
status, and [RAILS.md](RAILS.md) for the marketplace-listing research (Virtuals
ACP, x402 Bazaar).

## Running locally

```
node keys/generate-keys.js   # generates keys/private.pem + public.pem (gitignored)
node test/test.js            # core logic tests
node test/test-server.js     # HTTP server end-to-end tests
node test/test-worker.js     # Workers fetch-handler tests
node src/server.js            # runs the local dev server on :8402
```

## Deploying

```
npx wrangler secret put RECEIPTSTAMP_PRIVATE_KEY_PEM   # once, from keys/private.pem
npx wrangler deploy
```
