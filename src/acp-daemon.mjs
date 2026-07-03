// ReceiptStamp ACP provider daemon — cloud-native, machine-independent.
//
// Runs as a long-lived process on any Node host (Railway in production).
// Uses @virtuals-protocol/acp-node-v2: the signer key is an env secret
// (generated in the Virtuals dashboard Signers tab), NOT an OS keychain,
// so this runs anywhere — no dependency on any particular machine.
//
// Job flow (seller side):
//   requirement message arrives -> setBudget($PRICE_USDC)
//   job.funded (USDC in escrow)  -> POST payload to the Worker /stamp
//                                 -> session.submit(signed receipt)
//   job.completed                -> escrow released, logged
//
// Required env:
//   ACP_WALLET_ADDRESS    agent wallet (0x7e05d79f914fdac136812af82d304e8272b3dc20)
//   ACP_WALLET_ID         from the agent's Signers tab on app.virtuals.io
//   ACP_SIGNER_PRIVATE_KEY signer key from "+ Add Signer" -> Copy Key
// Optional env:
//   ACP_BUILDER_CODE      Base builder code from the Settings tab (bc-...)
//   STAMP_URL             default https://receiptstamp.panmediatech.workers.dev/stamp
//   PRICE_USDC            default 0.02 (must match the listed offering price)

import {
  AcpAgent,
  PrivyAlchemyEvmProviderAdapter,
  AssetToken,
} from "@virtuals-protocol/acp-node-v2";
import { base } from "@account-kit/infra";

const STAMP_URL = process.env.STAMP_URL || "https://receiptstamp.panmediatech.workers.dev/stamp";
const PRICE_USDC = Number(process.env.PRICE_USDC || "0.02");

function log(...args) {
  console.log(`[${new Date().toISOString()}]`, ...args);
}

for (const name of ["ACP_WALLET_ADDRESS", "ACP_WALLET_ID", "ACP_SIGNER_PRIVATE_KEY"]) {
  if (!process.env[name]) {
    console.error(`Missing required env var ${name} — see file header.`);
    process.exit(1);
  }
}

async function stampPayload(payload) {
  const res = await fetch(STAMP_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ payload }),
  });
  if (!res.ok) throw new Error(`/stamp returned ${res.status}: ${await res.text()}`);
  const body = await res.json();
  if (!body.receipt?.signature) throw new Error("/stamp returned no receipt");
  return body.receipt;
}

// Requirement can be {payload}, a JSON string of that, or a bare string.
function extractPayload(raw) {
  let r = raw;
  if (typeof r === "string") {
    try { r = JSON.parse(r); } catch { return r; }
  }
  if (r && typeof r === "object") {
    if (typeof r.payload === "string" && r.payload.length > 0) return r.payload;
    if (r.requirements) return extractPayload(r.requirements);
  }
  return null;
}

const payloads = new Map(); // jobId -> payload, captured from the requirement message
const delivered = new Set(); // jobIds we've already submitted for, this process lifetime

async function main() {
  const agent = await AcpAgent.create({
    provider: await PrivyAlchemyEvmProviderAdapter.create({
      walletAddress: process.env.ACP_WALLET_ADDRESS,
      walletId: process.env.ACP_WALLET_ID,
      signerPrivateKey: process.env.ACP_SIGNER_PRIVATE_KEY,
      chains: [base],
      ...(process.env.ACP_BUILDER_CODE ? { builderCode: process.env.ACP_BUILDER_CODE } : {}),
    }),
  });

  agent.on("entry", async (session, entry) => {
    try {
      if (entry.kind === "message" && entry.contentType === "requirement" && session.status === "open") {
        const payload = extractPayload(entry.content);
        if (!payload) {
          log(`job ${session.jobId}: requirement has no usable payload — rejecting`);
          await session.reject("Requirement must include a non-empty string field \"payload\".");
          return;
        }
        payloads.set(session.jobId, payload);
        log(`job ${session.jobId}: requirement ok (${payload.length} chars) — setting budget $${PRICE_USDC}`);
        await session.setBudget(AssetToken.usdc(PRICE_USDC, session.chainId));
        return;
      }

      if (entry.kind !== "system") return;

      switch (entry.event.type) {
        case "job.created":
          log(`job ${session.jobId}: created`);
          break;

        case "job.funded": {
          if (delivered.has(session.jobId)) return;
          const payload = payloads.get(session.jobId);
          if (!payload) {
            log(`job ${session.jobId}: funded but no stored payload (daemon restarted mid-job?) — needs a look`);
            return;
          }
          const receipt = await stampPayload(payload);
          await session.submit(JSON.stringify({ receipt }));
          delivered.add(session.jobId);
          log(`job ${session.jobId}: DELIVERED — keyId=${receipt.keyId} hash=${receipt.hash.slice(0, 12)}…`);
          break;
        }

        case "job.completed":
          log(`job ${session.jobId}: COMPLETED — escrow released`);
          payloads.delete(session.jobId);
          break;

        case "job.rejected":
        case "job.expired":
          log(`job ${session.jobId}: ${entry.event.type}`);
          payloads.delete(session.jobId);
          break;
      }
    } catch (e) {
      log(`job ${session.jobId}: handler error —`, e.message);
    }
  });

  await agent.start(() => log(`ReceiptStamp provider online — stamping via ${STAMP_URL}, price $${PRICE_USDC}`));

  setInterval(() => log(`heartbeat — ${payloads.size} job(s) in flight`), 10 * 60 * 1000);
}

process.on("unhandledRejection", (e) => log("unhandledRejection:", e?.message || e));

main().catch((e) => {
  console.error("fatal:", e);
  process.exit(1); // let the host restart us
});
