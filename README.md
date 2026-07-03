# ReceiptStamp

A stateless proof-of-execution notary. An agent sends a payload (some output
it produced), gets back a signed hash + timestamp receipt. Anyone holding the
public key can later verify that exact payload existed, unaltered, at that
exact time — without trusting the agent's own word for it.

Live: https://receiptstamp.panmediatech.workers.dev
Selling on: [Virtuals ACP](https://app.virtuals.io/acp/agents/019f2535-118d-7d76-a9bf-3ce023c0bffb) — $0.02/receipt, 5-min SLA

## How this fits together

One idea, exposed two ways, plus one piece that gets paid:

1. **The idea** — [`src/receiptstamp.js`](src/receiptstamp.js): take some text, produce a signed proof it existed at a given time. That's the whole product.
2. **Exposure #1 — the API** — [`src/worker.mjs`](src/worker.mjs), deployed on Cloudflare Workers (the live URL above). This is what actually runs `stamp()`/`verify()` on the internet. [`src/server.js`](src/server.js) is the same thing but for running on a plain computer, local-dev only.
3. **Exposure #2 — getting paid** — [`src/acp-daemon.mjs`](src/acp-daemon.mjs), deployed on Railway. Watches the ACP marketplace for buyers, holds their payment in escrow, calls the Worker above to produce the receipt, delivers it, releases the payment. Runs continuously, independent of any developer machine.

Everything else supports those three: [`test/`](test) proves each piece still works after a change, [`keys/`](keys) holds the notary's signing identity (private key never committed), [`PLAN.md`](PLAN.md) is the running status/decision log, [`RAILS.md`](RAILS.md) is the marketplace research.

## API

- `POST /stamp` — `{ "payload": "<string>" }` → signed receipt (the paid call)
- `POST /verify` — `{ "payload": "<string>", "receipt": {...} }` → `{ valid, reason }` (free)
- `GET /pubkey` — the public key PEM to verify against (free)

Receipt shape: `{ hash, timestamp, signature, algo, keyId }` — SHA-256 hash of
the payload, Ed25519 signature over `{hash, timestamp}`, ISO-8601 timestamp.

## Structure

- [`src/receiptstamp.js`](src/receiptstamp.js) — core `stamp()`/`verify()` logic (Ed25519 + SHA-256)
- [`src/server.js`](src/server.js) — Node `http` server, for local dev only
- [`src/worker.mjs`](src/worker.mjs) — Cloudflare Workers fetch-handler; **deployed, live**
- [`src/acp-daemon.mjs`](src/acp-daemon.mjs) — ACP marketplace seller daemon (`@virtuals-protocol/acp-node-v2`); **deployed on Railway, live**
- [`keys/`](keys) — key generation script (`generate-keys.js`); the private key itself is gitignored, never committed
- [`test/`](test) — test suites for the core logic, the Node server, and the Worker handler
- [`package.json`](package.json) — one real dependency: `@virtuals-protocol/acp-node-v2` (the daemon's marketplace SDK)

See [PLAN.md](PLAN.md) for the project rationale, kill criterion, and current
status (this is the file to check for "where are things right now"), and
[RAILS.md](RAILS.md) for the marketplace-listing research (Virtuals ACP,
x402 Bazaar).

## Testing a change before deploying it

Nothing here is "how to use ReceiptStamp" — the product is the two live
deployments above. This is just how to check a code change didn't break
anything, on your own machine, before pushing it out to the real thing.

```
npm test                     # runs all three test suites (core + HTTP server + Worker)
node src/server.js            # optional: run the notary on your own machine at :8402, to poke at it manually
```

`src/acp-daemon.mjs` (the paid-jobs part) isn't included here — testing it
for real needs live ACP marketplace credentials, and those are the same
credentials tied to the real wallet, so there's no safe "local-only" way to
exercise it. Treat it as: read the code, deploy, watch the Railway logs.

## Deploying a change

Two separate live things, two separate deploy steps — pushing to GitHub does
**not** automatically update the Cloudflare Worker (Railway is different, see
below):

```
npx wrangler secret put RECEIPTSTAMP_PRIVATE_KEY_PEM   # only if the key ever changes
npx wrangler deploy                                     # updates the Worker (the /stamp, /verify, /pubkey API)
```

The Railway daemon (the ACP paid-jobs part) redeploys **automatically** any
time `master` is pushed to GitHub — no separate command needed for that one.
