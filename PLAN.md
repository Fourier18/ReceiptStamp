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

**Cloud servicing daemon — LIVE on Railway (2026-07-03), fully machine-independent:**
- Standing rule (from Joshua, forcefully): every runtime component must work
  with his machine OFF. "Runs on this desktop" is never a deliverable. The
  first provider daemon (`acp-provider.js`, CLI + Windows-keychain signer)
  violated that and was deleted. See memory `cloud-first-autonomy`.
- `src/acp-daemon.mjs` — built on `@virtuals-protocol/acp-node-v2`
  (event-driven SDK: requirement → setBudget; job.funded → Worker `/stamp` →
  session.submit; heartbeat log every 10 min).
- Deployed on **Railway** (project `pleasant-delight`, service `ReceiptStamp`,
  auto-deploys from `Fourier18/ReceiptStamp` master). Usage capped: $10
  Compute hard limit / $8 email alert (Railway's separate "Agent" usage limit
  is their own AI assistant feature, unrelated to this daemon — left at
  default). Confirmed running: logs show "ReceiptStamp provider online —
  stamping via https://receiptstamp.panmediatech.workers.dev/stamp, price
  $0.02" (2026-07-03T00:42:53Z).
- **Second signer** `RecStamp002` created via the dashboard's "+ Add Key" (the
  CLI-generated signer's key is keychain-locked, non-exportable — a fresh key
  was required for a server-side/env-var signer). Policy: **Virtuals Only**
  (auto-authorizes ACP/tokenisation transactions, same semantics as the CLI
  signer's `restricted`). Its raw private key lives only in Railway's
  `ACP_SIGNER_PRIVATE_KEY` env var — never committed, never pasted in chat.
- Env vars set on Railway: `ACP_WALLET_ADDRESS`
  (0x7e05d79f914fdac136812af82d304e8272b3dc20), `ACP_WALLET_ID`
  (x1zd1uqfbtzj9mycdxr1e0hm), `ACP_SIGNER_PRIVATE_KEY` (RecStamp002's key).
  `ACP_BUILDER_CODE` not set (optional, skipped).
- Architecture split: Cloudflare Worker keeps the Ed25519 notary key and does
  all stamping; the daemon only services ACP job flow. Two secrets, two
  cloud homes, neither on the desktop.
- Debugging note for next time: a signer added via the dashboard isn't live
  until you click all the way through — "Copy Key" alone doesn't finish the
  flow. First attempt looked done but Signers count stayed at 1, and Railway
  failed with a generic `BaseError: Server error 500` from
  `privyAlchemyEvmProviderAdapter.js` (unregistered signer key, server-side
  rejection with no useful detail message). Confirm via the Wallet tab's
  Signers count before trusting a "key generated" step is complete.

**Operational constraints to know:**
- The old CLI signer (Windows keychain) still exists and is fine for admin
  commands (`acp offering …`) — production job servicing is the cloud daemon.
- **Kill criterion active: zero paid ACP jobs by 2026-07-16 = kill this rail.**

**Not done — each needs a go-ahead first:**
- x402 Bazaar listing (needs CDP account + x402 SDK wrapper on the Worker).
  Near-zero marginal cost — the free second shelf once ACP is proven/failed.
- Exchange account for USDC→USD cash-out — only matters once real earnings
  exist in the wallet.
