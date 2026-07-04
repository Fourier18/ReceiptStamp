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

**x402 Bazaar — LIVE (2026-07-03):**
- `src/worker.mjs` rewritten on Hono (required — `x402-hono` is Hono
  middleware, and Bazaar's own docs/Cloudflare's own guide both assume it).
  Verified against real installed package type definitions, not just docs
  (`x402-hono`, `@coinbase/x402`, `x402` core — all inspected directly in
  `node_modules` before writing any code).
- **Two separate paid routes, deliberately kept apart:** `/stamp` (unchanged,
  still free at the Worker level — the ACP daemon calls this directly *after*
  ACP's own escrow already paid; paywalling it would have made the daemon's
  own calls demand payment from itself and silently broken the live ACP
  income). `/x402/stamp` (new) — same `stamp()` call, gated by a real x402
  402-Payment-Required challenge, $0.02 USDC on **Base mainnet**, routed
  through the **CDP facilitator** (required specifically for Bazaar
  auto-cataloging — the default `x402.org` facilitator does NOT list on
  Bazaar). `test/test-worker.js` now asserts both: `/stamp` stays free (200,
  no payment) AND `/x402/stamp` correctly demands payment (402, correct
  network/price) — 10/10 worker tests pass, 20/20 total across all suites.
- **Wallet reused, not new:** `X402_PAY_TO_ADDRESS` is the same ACP agent
  wallet (`0x7e05d79f914fdac136812af82d304e8272b3dc20`) — no new key custody
  introduced for this rail.
- `discoverable: true` plus matching `inputSchema`/`outputSchema`/
  `description` set on the route config — this is what gets it listed in
  Bazaar search results once a real payment settles (confirmed from the
  actual `x402` package's type definitions, not assumed).
- `wrangler.toml` has `X402_PAY_TO_ADDRESS` as a plain var (safe — it's a
  receiving address, not a secret).

- CDP account created (personal, not business — the "Verify your business"
  KYB flow is for custodial products, not needed for a facilitator API key).
  `CDP_API_KEY_ID` and `CDP_API_KEY_SECRET` set as Worker secrets, IP
  allowlisting opted out (Workers have no fixed egress IP). Deployed
  2026-07-03T03:26Z, confirmed live: `/pubkey` 200, `/stamp` still free
  (200, ACP daemon unaffected), `/x402/stamp` correctly returns 402 with a
  real payment challenge (`base` network, `20000` = $0.02 USDC, correct
  live `resource` URL).
- Bazaar auto-cataloging happens on first *settled* payment (not just a
  402 challenge) — typically indexed within ~10 minutes after that.
- Gotcha for next time: the CDP dashboard's "Create secret API key" flow
  asks for an SSN and legal business name if you land on the wrong page —
  that's the *business/KYB* verification flow (for custodial APIs / holding
  customer funds), a completely different product from the plain developer
  API key we needed. If that SSN/business form appears, back out — go to
  portal.cdp.coinbase.com → API Keys tab directly instead.

**Bootstrap payment — DONE (2026-07-03), Bazaar indexing triggered:**
- Problem: Bazaar only catalogs a listing after its first *settled*
  payment — a chicken-and-egg gap, since nobody could discover it via
  Bazaar search until someone had already paid once some other way.
- Fix: generated a fresh, dedicated, small-value EVM wallet locally
  (`scripts/.bootstrap-wallet.key`, gitignored, never committed) —
  deliberately NOT the ACP agent wallet's key, which is a Privy P256
  authorization key, a different key type entirely from a standard EVM
  wallet key and unusable with `x402-fetch`. Joshua funded the new wallet
  (~$3 ETH + $1 USDC on Base, via Coinbase). `scripts/bootstrap-x402-payment.mjs`
  (built on `x402-fetch`'s `wrapFetchWithPayment`, verified against the
  installed package's actual type definitions) paid `/x402/stamp` for
  real. **Confirmed settled on Base mainnet:**
  tx `0xf70d779675a962986a6a2694714df994202e198bf0a2b366360f452c1afa2f02`,
  payer `0xD87DbC7Bc6DaA3C03feae2d45C7e545cdb062813`, receipt correctly
  signed and returned. Bazaar indexing should follow within ~10 minutes.
- **Real bug found and fixed along the way:** the CDP secrets
  (`CDP_API_KEY_ID` / `CDP_API_KEY_SECRET`) were silently corrupted to a
  single control character (``) when pasted into `wrangler secret
  put`'s interactive masked prompt in this machine's embedded terminal —
  not a paste-content issue, a bug in how that specific terminal handles
  paste into masked/password-style prompts. Confirmed via a temporary
  debug log inside the Worker (logged only lengths/JSON-escaped values,
  never printed in the clear) — this showed the *actual* runtime value
  Cloudflare had, rather than guessing from the outside. **Fix: always set
  secrets via file redirection** (`wrangler secret put NAME < file.txt`),
  never the interactive prompt, on this machine. This means the earlier
  "CDP account/secrets" step in this file was set correctly by procedure
  but silently corrupted by this terminal bug — worth remembering this
  class of failure (secret *exists* and *looks* right end-to-end, but its
  actual content is wrong) the next time something authenticates
  inexplicably.
- Researched (2026-07-03) and decided **against** further Bazaar-adjacent
  discovery work: x402scan.com requires its own separate discovery
  protocol (`v2` field-naming, an `/openapi.json` document) that diverges
  from what Coinbase's own `x402`/`@coinbase/x402` packages actually
  output today — not worth the compatibility risk to the real paid route
  for a scanner with unverified buyer traffic. PayAPI Market and
  awesome-x402 GitHub lists are free/manual alternatives, not yet acted on.

**Confirmed live on Agentic.Market (2026-07-03)** — the public, human-browsable
side of x402 Bazaar (agentic.market), $51.9M platform-wide payment volume.
ReceiptStamp's service page: agentic.market/services/receiptstamp-panmediatech-workers-dev,
showing correct description and $0.02/request pricing. One real bug found here:
their crawler listed the endpoint as `GET /x402/stamp`, but only `POST` existed
— a buyer following that listing would have hit a 404. **Fixed** by adding a
GET variant (`stampHandlerFromQuery` in `worker.mjs`, reads `payload` from a
query param) alongside the existing POST — purely additive, the POST route
and its response format are untouched. Confirmed via x402's own route-pattern
code that the payment middleware already matched any HTTP method (`verb:
"*"` by default) — only Hono's own router needed the new GET registration.
`test/test-worker.js` now asserts GET also returns a proper 402 challenge —
23/23 tests pass across all suites. Deployed and verified live.
**Real-money verified (2026-07-03):** ran a second real payment through the
new GET route (query-param payload) using the same bootstrap wallet —
settled on Base mainnet, tx
`0xd762d7aa25f55a340d657f06a79c34a22638014bd05a3a109eb4c9757977ed3c`,
receipt correctly signed and returned. Confirms both HTTP methods work
end-to-end with real settlement, not just the 402 challenge shape. Also
noted while reviewing the Agentic.Market listing page: buyers only need
USDC, not ETH — the facilitator sponsors gas (bootstrap wallet's ETH
balance was untouched after two real payments, only USDC was spent).
Reviewed the full listing page (FAQ + "Similar Services") — FAQ content is
accurate, two cosmetic issues found on Agentic.Market's own display (blank
network icon, generic/mismatched "what you get back" example JSON) but
neither is fixable from our side; "Similar Services" shown are unrelated
services with zero calls each, not real competitive signal either way.

**ACP rail — real end-to-end transaction test, DONE (2026-07-03):**
- Discovered a **stray duplicate agent** also named "ReceiptStamp"
  (`019f2534-1efa-7949-ada6-1162998d50a6`, wallet
  `0x7265812f2a34a680ac1175ea3dadfe8ad1fa035c`), created ~1 minute before
  the real one, zero offerings, publicly visible (not hidden) — a leftover
  from earlier agent-creation troubleshooting. Not deleted yet (see below).
- An agent can't buy its own offering (`acp client create-job` reverted
  on-chain when provider == buyer's own active agent) — needed a genuinely
  separate buyer identity. Repurposed the stray duplicate as the test
  buyer: funded its wallet with 1 USDC (Coinbase → Base), added a signer
  (`restricted` policy, same browser-approval flow as the real agent's),
  then ran the full flow as that buyer against the real ReceiptStamp
  offering: `create-job` → `fund` ($0.02) → **daemon auto-serviced it with
  zero manual intervention** → `job.submitted` with a correctly signed
  receipt → `complete` (approved, escrow released) → job status
  `completed`. Independently re-verified the actual receipt against our
  own `/verify` endpoint: `valid: true`. This is the full real-money proof
  that the ACP rail works end-to-end, not just "daemon is online."
- CLI active agent switched back to the real ReceiptStamp
  (`019f2535-118d-7d76-a9bf-3ce023c0bffb`) afterward — don't leave it
  pointed at the test buyer.
- **Duplicate agent's leftover funds reclaimed (2026-07-03).** Two attempts:
  1. First tried a raw `acp wallet send-transaction` (manual ERC20
     `transfer` calldata) from the duplicate's wallet. The outer
     transaction reported `status: success` on Basescan, but nothing
     actually moved — a classic ERC-4337 gotcha: a bundled UserOperation's
     *outer* transaction can succeed even when the *inner* call reverts.
     Confirmed by decoding the EntryPoint's `UserOperationEvent` log
     directly (`success: false`), not by trusting the outer receipt.
     Root cause: the paymaster likely takes a small fee from the same
     USDC balance being swept, and the transfer tried to send 100% of it,
     leaving nothing for that fee.
  2. **Fix: used Virtuals' own dashboard Withdraw UI instead of raw
     calldata** (app.virtuals.io/profile → Agent Wallets → per-agent
     Withdraw) — built specifically for this, handles the fee/balance
     math correctly. Sent 0.981 USDC to Joshua's own connected wallet
     (`0xb878951d7e70ecc4B792FE202E2063054104642F`). **Confirmed
     on-chain:** tx
     `0xd125a126d69e163a877f9ae8af5ab73b8cc12a39f421074b51f3707bd59def52`,
     duplicate wallet now shows 0 USDC. Lesson for next time: for
     Privy/ERC-4337 smart-wallet transfers, prefer the dashboard's
     built-in Withdraw UI over hand-built `send-transaction` calldata —
     and when checking whether such a transaction really worked, decode
     the EntryPoint's `UserOperationEvent.success` field, not just the
     outer transaction's status.
  - Duplicate agent (`019f2534-1efa-7949-ada6-1162998d50a6`) is now fully
    drained of funds. Still exists, still has zero offerings, still
    publicly visible (not hidden) — hiding/deleting it is a small
    remaining cleanup item, no longer money-at-risk since it's empty.
- **Money reconciliation note, in case it's confusing later:** the real
  ReceiptStamp wallet (`0x7e05d79f914fdac136812af82d304e8272b3dc20`) is
  shared between BOTH rails (it's the ACP agent wallet AND the x402
  `payTo` address — a deliberate reuse, not drift). Its $0.06 balance
  after tonight's testing = three separate real $0.02 payments: the x402
  bootstrap payment, the x402 GET-route test payment, and the ACP test
  job — not one payment plus some unexplained extra.

**RECURRING TRAP — the Railway lockfile drift bit us TWICE (2026-07-03):**
- The `package-lock.json` on this repo has repeatedly gone out of sync in a
  way that passes locally but fails Railway's strict `npm ci` with
  `Missing: utf-8-validate@5.0.10 from lock file` (an optional native dep
  deep in the x402/Solana dependency tree). It happened once during the
  x402 build, got "fixed," then came back after the bootstrap-script
  install (`npm install --save-dev x402-fetch viem`) silently rewrote the
  lockfile incompletely — and only surfaced when a later docs-only push
  triggered a Railway rebuild.
- **What is NOT the cause (verified, do not repeat this wrong theory):**
  `.npmrc`'s `omit=optional` is NOT what makes the lockfile incomplete.
  Both the broken lockfile and the working fix were produced with
  `omit=optional` active — it's a constant, not the culprit. The observed
  difference was *partial* `npm install <pkg>` (leaves it incomplete) vs.
  a *full* clean regenerate (writes it complete). The exact npm internal
  reason a partial install does this is not confidently known — don't
  assert one.
- **The mechanism-agnostic rule that IS reliable:** `npm ci`'s
  "Missing from lock file" completeness check is deterministic and
  platform-independent, so a local `npm ci` pass reliably predicts
  Railway's Linux build. Therefore: **after ANY command that modifies
  `package-lock.json` (including a partial `npm install <pkg>`), before
  pushing, run `rm -rf node_modules && npm ci`. If it errors "Missing
  from lock file," regenerate fully with
  `rm -rf node_modules package-lock.json && npm install`, then re-run
  `npm ci` to confirm, then push.** Do not trust a local dev `npm install`
  or `npm test` alone to prove the lockfile is Railway-safe.
- Confirmed fixed and green on Railway's actual Linux build 2026-07-03
  (commit `336aca1`) — Build stage passed, service Online.

**Not done — needs a go-ahead first:**
- Exchange account for USDC→USD cash-out — only matters once real earnings
  exist in the wallet (applies to both the ACP and x402 rails).
- Hide/delete the now-empty duplicate agent (`019f2534-1efa-7949-ada6-1162998d50a6`)
  — low priority, no funds at risk anymore.
