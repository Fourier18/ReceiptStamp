# ReceiptStamp — Listing Rails Decision Sheet (researched 2026-07-02)

Core product is built and tested locally (see PLAN.md). This file documents
exactly what it takes to sell it on the two live agent marketplaces, from
their own docs, so the account/wallet decisions can be made deliberately.
Nothing below has been created or signed up for.

---

## Rail A — Virtuals ACP (where agents are actively hiring agents)

Source: os.virtuals.io/acp (overview, /acp/cli/provider-workflow,
/acp/concepts, /agent-identity/wallet/overview).

**Seller flow (CLI `@virtuals-protocol/acp-cli`):**
1. `acp events listen` — start event listener
2. `acp offering create --name "ReceiptStamp" --price-type fixed
   --price-value 0.02 --sla-minutes 5` — register the service offering
3. Buyer creates job → USDC locked in escrow → deliver via
   `acp provider submit` → escrow releases on completion

**Economics:** priced in USDC. Protocol takes 5% (provider keeps 95%);
if an evaluator agent is involved, 90/5/5. Plus the Revenue Network
distributes up to $1M/month to selling agents (subsidy pool).

**Requirements:**
- EVM and/or Solana wallet anchoring the agent on-chain —
  **non-custodial: the signing key lives in the OS keychain (CLI) or is
  Privy-managed (SDK).** So WE hold keys — real key-custody responsibility.
- Agent identity components: wallet (creator-owned), optional email/card.
- **No KYC, staking, or $VIRTUAL holding documented** for providers.
- **Not documented: fiat cash-out.** Earnings are USDC on-chain; converting
  to dollars means an exchange account (e.g. Coinbase) — a separate,
  explicit decision.

**Risk shape:** crypto custody (keychain key + accrued USDC), young platform,
subsidy-driven volume. Upside: this is the one venue with verified
agent-to-agent job volume (hundreds of thousands of completed jobs).

## Rail B — x402 Bazaar (Coinbase CDP)

Source: docs.cdp.coinbase.com/x402/bazaar.

**Seller flow:**
1. CDP (Coinbase Developer Platform) account + API keys
2. A wallet to receive USDC payments
3. A hosted resource server running the x402 v2 SDK, pointed at the CDP
   Facilitator (api.cdp.coinbase.com/platform/v2/x402)
4. Add `bazaarResourceServerExtension` + JSON schemas for the endpoint
5. **No approval step: the Bazaar catalogs the service automatically the
   first time a payment settles.** Delisted after 30 days of no activity.

**Requirements:** CDP account (free), wallet, hosting (Cloudflare Workers
free tier was the standing candidate). Same USDC/fiat cash-out question.

**Risk shape:** lower platform risk (Coinbase-operated), but buyer volume on
Bazaar is the murky part (wash-trading finding). Listing cost ≈ zero once
hosted, so it's a free second shelf for the same service.

---

## Recommended sequence

1. **Wrap the tested core in one small HTTP server** (`/stamp` paid,
   `/verify` free) — buildable now, no accounts.
2. **List on ACP first** (verified demand + subsidy pool), Bazaar second
   (near-zero marginal cost once the server exists).
3. Defer the Stripe fiat mirror until either rail shows a single real sale.

## Decisions that are Joshua's, in order of need

| # | Decision | Needed for | Notes |
|---|---|---|---|
| 1 | Hosting account (Cloudflare Workers free tier, or other) | any live endpoint | free; no payment info needed for free tier |
| 2 | Create the agent wallet (non-custodial, key on this machine / Privy) | ACP + Bazaar | small key-custody responsibility; holds only accrued fees |
| 3 | CDP (Coinbase developer) account | Bazaar only | free |
| 4 | Exchange account for USDC→USD cash-out | only once real earnings exist | can wait until there's something to cash out |

The 2-week zero-paid-calls kill criterion applies per rail from its listing
date.
