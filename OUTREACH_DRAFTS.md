# Outreach Drafts

Draft announcement posts for ReceiptStamp. Not posted anywhere — for review
before manual posting.

Context for whoever reviews these: this is a solo-built, just-launched
service with zero sales so far. Drafts are written to be honest about that
("just launched," not "trusted by") — do not edit them to imply traction
that doesn't exist yet.

---

## 1. Virtuals Protocol Discord / community forum

> Just listed a new ACP agent: **ReceiptStamp**, a stateless proof-of-execution
> notary. Send it a payload, get back a signed hash + timestamp (SHA-256 +
> Ed25519) proving that exact content existed, unaltered, at that exact time —
> useful if your agent needs to prove it produced something without anyone
> having to trust its own word for it. $0.02/receipt, 5-min SLA, live now:
> https://app.virtuals.io/acp/agents/019f2535-118d-7d76-a9bf-3ce023c0bffb.
> Built solo as a small experiment — genuinely curious whether this shape of
> service (independent verification, not self-attestation) has demand in ACP.
> Feedback welcome.

---

## 2. X/Twitter

> Shipped ReceiptStamp: a stateless notary for AI agents. POST a payload,
> get back a SHA-256 hash + Ed25519 signature + timestamp proving it existed
> unaltered at that moment. No DB, no accounts, ~50 lines of core logic.
> $0.02/receipt on Virtuals ACP and x402 (Base/USDC).
> https://receiptstamp.panmediatech.workers.dev

---

## 3. Show HN style / longer-form technical post

**Title:** Show HN: ReceiptStamp – a stateless proof-of-execution notary for AI agents

> I built ReceiptStamp, a small notary service aimed at the emerging
> agent-to-agent economy: an AI agent sends a payload (some output it
> produced), and gets back a signed receipt — SHA-256 hash of the payload,
> Ed25519 signature, ISO-8601 timestamp — proving that exact content existed,
> unaltered, at that exact time. Anyone holding the public key can verify it
> later without trusting the agent's own claim.
>
> The core logic is genuinely small (~50 lines using Node's built-in `crypto`
> module, no dependencies for the notarization itself). It's stateless — no
> database, no per-user storage, no accounts — which keeps marginal cost near
> zero and makes the whole thing easy to audit. It's deployed as a Cloudflare
> Worker: https://receiptstamp.panmediatech.workers.dev (`POST /stamp`,
> `POST /verify`, `GET /pubkey`).
>
> The reasoning for why this is useful at all: as more agents transact with
> each other autonomously, there's a recurring need for one agent to prove to
> another (or to a human) that it actually produced a given output at a given
> time, without the recipient having to just take its word for it. A notary
> only works if it's an independent third party, so "easy to clone" doesn't
> undercut it the way it would a typical thin API wrapper — a clone is just
> another notary, not a replacement for this one specifically.
>
> It's live on two agent marketplaces right now: Virtuals ACP ($0.02/receipt,
> 5-min SLA) and x402 Bazaar ($0.02/receipt, paid in USDC on Base mainnet,
> no account needed — just an on-chain payment per call).
>
> Built and run by one person, not a company, as a deliberately small
> experiment — I set an explicit kill criterion going in (no paid usage after
> two weeks live, and I shut it down) rather than letting sunk cost keep it
> alive past what the market actually says. It just launched, so there's no
> usage history yet — genuinely interested in whether this is a real need or
> a solution looking for a problem. Feedback, especially "here's why this
> wouldn't work for X," is exactly what I'm after.
