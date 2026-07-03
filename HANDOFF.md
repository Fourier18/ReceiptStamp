# ReceiptStamp — Session Handoff (2026-07-02 → 2026-07-03)

Written for whoever (human or Claude) picks this up next. `PLAN.md` is the
living status doc — this file is the *narrative*: what happened, in order,
and why, so nothing gets silently dropped when this session ends. Read this
once, then use `PLAN.md` for ongoing reference.

---

## How we got here

ReceiptStamp spun out of the sibling `Bounty Engine` project's "agent-economy
income" research. That research's core lesson — don't tunnel into a narrow
scan and declare a market dead, scan wide before concluding — is why this
project exists at all: a wide sweep found Virtuals ACP and x402 Bazaar both
had real, live agent-to-agent transaction volume. ReceiptStamp (a stateless
proof-of-execution notary: sign a hash+timestamp receipt for a payload) was
picked as the thing to build because it's cheap, stateless, and has a live
comparable already selling at ~$0.02/call.

## The build, in order

1. **Core notary logic** (`src/receiptstamp.js`) — Ed25519 sign, SHA-256
   hash, ~50 lines, no dependencies. Built and tested first, before any
   hosting/marketplace decision.
2. **Cloudflare Worker** (`src/worker.mjs`) — chosen over Render/Deno Deploy
   specifically for no cold-starts (buyers paying per-call shouldn't hit a
   multi-second stall) and because it's the shape x402/Bazaar tooling
   already expects. Deployed to `receiptstamp.panmediatech.workers.dev`.
3. **GitHub repo** — `Fourier18/ReceiptStamp`, public, secrets scanned
   before every push.
4. **Virtuals ACP listing** — created the agent, ran into the CLI's
   "+ Add Signer"/"Copy Key" flow not actually being complete until you
   click all the way through (first attempt silently didn't register).
   Registered the offering at $0.02/call, 5-min SLA.
5. **The machine-independence correction** — the first job-servicing
   daemon ran locally, tied to this machine's keychain. Joshua was
   (rightly, forcefully) angry: "agent income" that only works while a
   laptop is on isn't the product. Rewrote as `src/acp-daemon.mjs` on
   `@virtuals-protocol/acp-node-v2` with an env-var signer instead of a
   keychain one, deployed to **Railway**, confirmed running 24/7
   independent of any session or machine. This is recorded permanently in
   memory (`cloud-first-autonomy`) so it doesn't recur on the next project.
6. **Railway build fix** — a Windows-generated `package-lock.json` failed
   `npm ci` on Railway's Linux build (a native optional dependency,
   `utf-8-validate`, resolved differently per-platform). Fixed with
   `.npmrc` (`omit=optional`) rather than chasing the platform drift.
7. **The marketability question, round one** — asked whether this needed
   more than passive listing. Answer at the time: list on x402 Bazaar too
   (the one channel already identified from the original research), plus
   manual outreach. **This answer was incomplete — see the blowup below.**
8. **x402 Bazaar build** — rewrote the Worker on Hono (required by
   `x402-hono`), added a **separate** `/x402/stamp` route deliberately kept
   apart from the ACP daemon's `/stamp` route (paywalling the wrong one
   would have made the daemon pay itself and broken live ACP income). CDP
   account setup hit a real trap: the dashboard's "Verify your business"
   flow (SSN, legal name) is for a *different* product (custodial APIs) —
   the plain developer API key needed no such thing.
9. **A real, hard-to-see bug**: `wrangler secret put`'s interactive masked
   prompt silently corrupted pasted CDP secrets down to a single control
   character, in this specific terminal. Diagnosed by adding a temporary
   debug log inside the Worker (never guessing from outside), fixed by
   always using file redirection (`wrangler secret put NAME < file`)
   instead of the interactive prompt on this machine.
10. **The bootstrap chicken-and-egg problem** — x402 Bazaar only catalogs a
    listing after its *first settled payment*, so nothing could discover it
    until something paid it once. Solved by generating a dedicated,
    small-value throwaway wallet (`scripts/.bootstrap-wallet.key`,
    gitignored) and running a real payment through
    `scripts/bootstrap-x402-payment.mjs`. Confirmed settled on Base mainnet.
11. **Found live on Agentic.Market** (x402 Bazaar's public storefront) —
    and found a real bug in *their* crawler's listing: it recorded the
    endpoint as `GET /x402/stamp`, but only `POST` existed. Fixed by adding
    a GET variant (query-param payload) alongside POST, purely additive.
    Verified with a second real payment.
12. **Full ACP transaction proven end-to-end** — discovered a stray,
    empty duplicate "ReceiptStamp" agent from earlier troubleshooting along
    the way; repurposed it as a genuinely separate test buyer (an agent
    can't buy its own offering — the contract reverts), ran the complete
    job lifecycle for real: create → fund → daemon auto-serviced it with
    zero manual steps → complete → independently re-verified the receipt.
13. **Reclaiming the duplicate's leftover funds** hit a real ERC-4337
    gotcha: a raw `send-transaction` reported "success" on the outer
    transaction while the *inner* transfer silently reverted (caught by
    decoding the EntryPoint's `UserOperationEvent`, not by trusting the
    receipt status). Fixed by using Virtuals' own dashboard Withdraw UI
    instead of hand-built calldata. Reconciled the resulting wallet
    balance ($0.06 = three separate real $0.02 test payments across both
    rails, not a mystery — the ACP and x402 wallets are the same address
    on purpose).
14. **The marketability blowup, round two** — Joshua brought in a separate
    claude.ai conversation (different product, different session) where
    Coinbase's own docs surfaced several more real channels: **Skyfire**
    (confirmed genuine — real paid-listing marketplace, worth pursuing),
    plus MCP, Google AP2, and OpenAI's tool ecosystem (all considered and
    explicitly **deprioritized** — MCP has no built-in payment layer,
    AP2/GPT-Store are too early/unproven to chase right now). The real
    issue underneath: when asked "how do I make this more marketable"
    earlier in *this* session, I answered from channels already built
    instead of running a fresh search — the same tunnel-vision the
    original Bounty Engine research had already taught us to avoid, and a
    written memory of that lesson existed and simply wasn't applied. This
    is now a **permanent global rule** (`C:\Users\Admin\.claude\CLAUDE.md`):
    "look for / search for / find / is there more" is a literal
    instruction to run a search immediately, not a cue to reason from
    existing context.

---

## What's actually live right now

- **Cloudflare Worker** — `receiptstamp.panmediatech.workers.dev`. Routes:
  `GET /pubkey` (free), `POST /verify` (free), `POST /stamp` (free —
  ACP-daemon-only, do not paywall), `POST /x402/stamp` + `GET
  /x402/stamp?payload=...` (paid, x402/CDP facilitator, Base mainnet).
- **Railway daemon** — `src/acp-daemon.mjs`, project `pleasant-delight`,
  auto-deploys on push to `master`, servicing ACP jobs continuously.
- **Virtuals ACP** — agent `019f2535-118d-7d76-a9bf-3ce023c0bffb`, offering
  live at $0.02/call, 5-min SLA. Real transaction proven.
- **x402 Bazaar / Agentic.Market** — live at
  agentic.market/services/receiptstamp-panmediatech-workers-dev. Real
  transactions proven on both POST and GET.
- **Kill criterion, both rails: zero paid (non-test) jobs by 2026-07-16 =
  kill.** The clock started 2026-07-02.

## Open items for the next session

1. **Research Skyfire properly** — same rigor as the ACP/x402 build:
   account creation requirements, wallet/custody model, actual effort to
   list ReceiptStamp there. This is the one new channel from tonight
   that's real and worth the work; the others (MCP, AP2, GPT Store) were
   deliberately set aside, not forgotten.
2. **Hide/delete the duplicate ACP agent** (`019f2534-1efa-7949-ada6-1162998d50a6`)
   — fully drained of funds already, just a cosmetic cleanup now.
3. **Exchange account for USDC→USD cash-out** — not set up yet; only
   matters once real (non-test) earnings exist in the wallet.
4. **Watch for the first genuine, non-test paid job** on either rail —
   that's the actual signal the kill criterion is waiting on.
5. When advising on distribution/marketability for this or any project:
   the new global rule means a fresh search happens automatically now —
   no need to re-prompt for it, but worth knowing it's there.

## Where to look for detail, not narrative

- **`PLAN.md`** — the full technical status log, kept current throughout;
  this is the file to trust for exact IDs, addresses, tx hashes, and
  current deploy state.
- **`RAILS.md`** — the original ACP-vs-Bazaar research comparison.
- **`README.md`** — plain-English "how this fits together" for anyone
  (including a future me) who needs the shape of the project fast.
- Cross-session memory (`C:\Users\Admin\.claude\projects\...\memory\`) —
  `cloud-first-autonomy`, `verify-dont-blame-user`,
  `stable-complete-instructions`, `literal-search-instructions` all carry
  standing behavioral corrections from this session forward.
