# ReceiptStamp

A stateless proof-of-execution notary. An agent sends a payload (some output
it produced), gets back a signed hash + timestamp receipt. Anyone holding the
public key can later verify that exact payload existed, unaltered, at that
exact time — without trusting the agent's own word for it.

Live: https://receiptstamp.panmediatech.workers.dev
Selling on: [Virtuals ACP](https://app.virtuals.io/acp/agents/019f2535-118d-7d76-a9bf-3ce023c0bffb) — $0.02/receipt, 5-min SLA
Selling on: x402 Bazaar — $0.02/receipt, Base mainnet (code done; goes live once a CDP account is set up, see [PLAN.md](PLAN.md))

## How this fits together

One idea, exposed two ways, plus two separate ways it gets paid:

1. **The idea** — [`src/receiptstamp.js`](src/receiptstamp.js): take some text, produce a signed proof it existed at a given time. That's the whole product.
2. **Exposure #1 — the API** — [`src/worker.mjs`](src/worker.mjs), deployed on Cloudflare Workers (the live URL above). This is what actually runs `stamp()`/`verify()` on the internet. [`src/server.js`](src/server.js) is the same thing but for running on a plain computer, local-dev only.
3. **Exposure #2 — getting paid, rail A (ACP)** — [`src/acp-daemon.mjs`](src/acp-daemon.mjs), deployed on Railway. Watches the ACP marketplace for buyers, holds their payment in escrow, calls the Worker's `/stamp` route to produce the receipt, delivers it, releases the payment. Runs continuously, independent of any developer machine.
4. **Exposure #2 — getting paid, rail B (x402 Bazaar)** — no separate daemon needed for this one. It's built directly into the Worker: `/x402/stamp` demands a real on-chain USDC micropayment (via Coinbase's CDP facilitator) before it will run `stamp()`. `/stamp` (used by rail A) stays completely separate and free at the Worker level on purpose — see the note in `worker.mjs` if you're ever tempted to merge them, it would break rail A.

Everything else supports those: [`test/`](test) proves each piece still works after a change, [`keys/`](keys) holds the notary's signing identity (private key never committed), [`PLAN.md`](PLAN.md) is the running status/decision log, [`RAILS.md`](RAILS.md) is the marketplace research.

## API

- `POST /stamp` — `{ "payload": "<string>" }` → signed receipt. Free at the Worker level — this is the ACP-daemon-only internal route (rail A already collected payment via escrow before calling this).
- `POST /x402/stamp` — same request/response shape as `/stamp`, but requires an x402 payment first (rail B — public, anyone can call this, that's the point).
- `POST /verify` — `{ "payload": "<string>", "receipt": {...} }` → `{ valid, reason }` (free, both rails)
- `GET /pubkey` — the public key PEM to verify against (free, both rails)

Receipt shape: `{ hash, timestamp, signature, algo, keyId }` — SHA-256 hash of
the payload, Ed25519 signature over `{hash, timestamp}`, ISO-8601 timestamp.

## Structure

- [`src/receiptstamp.js`](src/receiptstamp.js) — core `stamp()`/`verify()` logic (Ed25519 + SHA-256)
- [`src/server.js`](src/server.js) — Node `http` server, for local dev only
- [`src/worker.mjs`](src/worker.mjs) — Cloudflare Workers app (Hono); **deployed, live**. Serves `/stamp`, `/x402/stamp`, `/verify`, `/pubkey`
- [`src/acp-daemon.mjs`](src/acp-daemon.mjs) — ACP marketplace seller daemon (`@virtuals-protocol/acp-node-v2`); **deployed on Railway, live**
- [`keys/`](keys) — key generation script (`generate-keys.js`); the private key itself is gitignored, never committed
- [`scripts/bootstrap-x402-payment.mjs`](scripts/bootstrap-x402-payment.mjs) — one-time script that pays `/x402/stamp` for real, from a wallet you provide via env var, to trigger Bazaar's first-settlement indexing requirement. Already run once (2026-07-03); not meant to run repeatedly.
- [`test/`](test) — test suites for the core logic, the Node server, and the Worker (all 4 routes, both rails)
- [`package.json`](package.json) — real dependencies: `@virtuals-protocol/acp-node-v2` (rail A's SDK), `hono` + `x402-hono` + `@coinbase/x402` (rail B's paywall + CDP facilitator); dev-only: `x402-fetch` + `viem` (the bootstrap script's client)

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
npx wrangler secret put CDP_API_KEY_ID                  # from portal.cdp.coinbase.com, needed for /x402/stamp
npx wrangler secret put CDP_API_KEY_SECRET              # from portal.cdp.coinbase.com, needed for /x402/stamp
npx wrangler deploy                                     # updates the Worker (all four routes)
```

The Railway daemon (the ACP paid-jobs part) redeploys **automatically** any
time `master` is pushed to GitHub — no separate command needed for that one.
