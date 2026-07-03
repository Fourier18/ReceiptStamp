// ONE-TIME bootstrap script — pays ReceiptStamp's own /x402/stamp endpoint
// for real, from the wallet you control, to trigger x402 Bazaar's
// first-settlement indexing requirement (Bazaar only catalogs a resource
// AFTER its first real settled payment — this is what breaks that
// chicken-and-egg loop).
//
// Costs real USDC: ~$0.02 + a small amount of Base mainnet gas (ETH).
// The wallet needs both, already on Base (chain 8453).
//
// This is NOT meant to be run repeatedly or automated — run it once,
// confirm the receipt comes back, done.
//
// Usage:
//   X402_CLIENT_PRIVATE_KEY=0x... node scripts/bootstrap-x402-payment.mjs
//
// The private key is read only from the environment — never hardcode it
// here, never commit it, never paste it into chat.

import { wrapFetchWithPayment, decodeXPaymentResponse } from 'x402-fetch';
import { createSigner } from 'x402/types';

const STAMP_URL = process.env.X402_STAMP_URL || 'https://receiptstamp.panmediatech.workers.dev/x402/stamp';
const NETWORK = 'base'; // must match src/worker.mjs's route config

async function main() {
  const privateKey = process.env.X402_CLIENT_PRIVATE_KEY;
  if (!privateKey) {
    console.error('Missing X402_CLIENT_PRIVATE_KEY env var. This must be a funded wallet');
    console.error('(USDC + a little ETH for gas) on Base mainnet. Not set — aborting, nothing sent.');
    process.exit(1);
  }

  console.log(`Paying ${STAMP_URL} once, on ${NETWORK}, to bootstrap Bazaar indexing...`);

  const signer = await createSigner(NETWORK, privateKey);
  const fetchWithPayment = wrapFetchWithPayment(fetch, signer);

  const payload = `ReceiptStamp x402 Bazaar bootstrap payment — ${new Date().toISOString()}`;

  const res = await fetchWithPayment(STAMP_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ payload }),
  });

  if (!res.ok) {
    console.error(`Request failed: ${res.status} ${await res.text()}`);
    process.exit(1);
  }

  const body = await res.json();
  console.log('Success. Receipt:', JSON.stringify(body.receipt, null, 2));

  const paymentResponseHeader = res.headers.get('x-payment-response');
  if (paymentResponseHeader) {
    console.log('Settlement details:', JSON.stringify(decodeXPaymentResponse(paymentResponseHeader), null, 2));
  }

  console.log('\nDone. This payment should trigger Bazaar indexing within ~10 minutes.');
}

main().catch((e) => {
  console.error('Bootstrap payment failed:', e.message || e);
  process.exit(1);
});
