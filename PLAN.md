# ReceiptStamp — Operating Plan

**One-line:** A stateless proof-of-execution notary. An agent sends a payload
(some output it produced), gets back a signed hash + timestamp receipt.
Anyone holding the public key can later verify that exact payload existed,
unaltered, at that exact time — without trusting the agent's own word for it.

Originated from Bounty Engine's parallel "agent-economy income" research
(2026-07-01/02) — see the sibling `Bounty Engine` project's PROPOSALS.md /
PROPOSALS_R2.md for the full comparative research trail (x402/Apify/MCP
market survey, why this beat the other candidates, why Plain Sheet was
killed). This file now owns ReceiptStamp specifically since the two projects
are separate builds, not one bundle.

---

## Why this one

- Genuine repeat-use case: an agent can't credibly self-notarize its own
  claims — the whole value of a notary is being an independent third party.
  Unlike a thin API wrapper, "easy to clone" doesn't erase this value, because
  a clone is just another notary, not a replacement for THIS one's track record.
- Near-zero marginal cost to run (stateless — no database, no per-user storage).
- Live comparable already selling near-identical service (~$0.02/call, per
  2026-07-02 research) — proof buyers exist for this shape of product.
- Trivial build: the actual notarization logic is ~50 lines of code using
  only Node's built-in `crypto` module. No new dependencies.

## Explicit kill criterion

**Zero paid calls after 2 weeks live on a public marketplace (Bazaar or
equivalent) = kill, don't fund further.** Set in advance so a sunk-cost
attachment doesn't keep this alive past the point the market has answered.

---

## Status (2026-07-02)

**Live and deployed:**
- **https://receiptstamp.panmediatech.workers.dev** — real, public Cloudflare
  Worker. `GET /pubkey`, `POST /stamp`, `POST /verify` all confirmed working
  against the live URL (stamp → verify genuine → verify tampered, all correct).
- Private key lives only as a Workers *secret* (`RECEIPTSTAMP_PRIVATE_KEY_PEM`,
  uploaded via `wrangler secret put`, never in the repo). Public key is a plain
  `[vars]` entry in `wrangler.toml` (safe — it's public by definition).
- Deployed under Cloudflare account `panmediatechnologygroup@gmail.com`,
  workers.dev subdomain `panmediatech` (registered today, first Worker on it).

**Done, code + local tests:**
- `src/receiptstamp.js` — core `stamp()` / `verify()` functions (Ed25519 sign,
  SHA-256 hash, ISO timestamp). `test/test.js`, 5/5 pass.
- `src/server.js` — Node `http` version (for local dev only, not deployed).
  `test/test-server.js`, 7/7 pass.
- `src/worker.mjs` — the deployed Cloudflare Workers fetch-handler (ESM;
  `.mjs` extension required since it uses `import`/`export default` and the
  rest of the project is CommonJS). Keys read from `env` bindings, not the
  filesystem. `test/test-worker.js`, 7/7 pass locally against the same code.

**LISTED ON VIRTUALS ACP (2026-07-02) — the kill-criterion clock is running:**
- ACP agent "ReceiptStamp", created under the panmediatechnologygroup@gmail.com
  Virtuals account (same Google identity as the Cloudflare account — one
  identity owns the whole operation, deliberate choice).
- Wallet: `0x7e05d79f914fdac136812af82d304e8272b3dc20` (non-custodial; signer
  key in this machine's Windows keychain, `restricted` policy — auto-signs ACP
  transactions only, everything else needs manual approval).
- Agent email identity: `receiptstamp_gaon@agents.world` (auto-provisioned).
- Registered on-chain: ERC-8004 on Base (chain 8453).
- Offering `019f253b-fd4c-72c5-acb6-ecbef264b04e`: fixed $0.02/call, 5-min
  SLA, visible, JSON-schema'd requirements (`{payload}`) and deliverable
  (`{receipt}`).
- `src/acp-provider.js` — the servicing daemon: keeps `acp events listen`
  alive, polls/drains events + sweeps `acp job list`, and on a funded job
  calls the live Worker `/stamp` then `acp provider submit`s the receipt.
  Currently running in this session; survives listener crashes.

**Operational constraints to know:**
- The provider daemon MUST run on this machine (the ACP signer key lives in
  the Windows keychain — submissions can only be signed here). Machine off =
  jobs miss the 5-min SLA. If real volume ever appears, revisit hosting the
  signer (Privy-managed SDK) so servicing isn't tied to a desktop being awake.
- **Kill criterion active: zero paid ACP jobs by 2026-07-16 = kill this rail.**

**Not done — each needs a go-ahead first:**
- x402 Bazaar listing (needs CDP account + x402 SDK wrapper on the Worker).
  Near-zero marginal cost — the free second shelf once ACP is proven/failed.
- Exchange account for USDC→USD cash-out — only matters once real earnings
  exist in the wallet.
