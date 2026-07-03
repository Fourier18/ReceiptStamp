// Exercises the Workers fetch-handler directly in plain Node (no wrangler/account
// needed) — Node 18+ has global Request/Response/fetch, so this is a faithful
// stand-in for how Cloudflare will actually invoke module.exports.fetch(request, env).
// Run: node test/test-worker.js

const { readFileSync } = require('fs');
const path = require('path');
let worker; // loaded via dynamic import() in main() — worker.mjs is an ES module

const env = {
  RECEIPTSTAMP_PRIVATE_KEY_PEM: readFileSync(path.join(__dirname, '../keys/private.pem'), 'utf8'),
  RECEIPTSTAMP_PUBLIC_KEY_PEM: readFileSync(path.join(__dirname, '../keys/public.pem'), 'utf8'),
  // x402 route test only checks the 402 challenge is issued correctly —
  // that doesn't require real CDP credentials, so these stay unset here.
  X402_PAY_TO_ADDRESS: '0x7e05d79f914fdac136812af82d304e8272b3dc20',
};

async function req(method, urlPath, body) {
  const request = new Request(`http://worker.local${urlPath}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  // await, not .then() — Hono's fetch may return a Response directly rather
  // than always a Promise; await handles both, .then() only handles one.
  const r = await worker.fetch(request, env, { waitUntil: () => {}, passThroughOnException: () => {} });
  return { status: r.status, body: await r.json() };
}

let failed = false;
function assert(cond, msg) {
  console.log(cond ? 'PASS:' : 'FAIL:', msg);
  if (!cond) failed = true;
}

async function main() {
  worker = (await import('../src/worker.mjs')).default;

  const pk = await req('GET', '/pubkey');
  assert(pk.status === 200 && pk.body.publicKeyPem.includes('PUBLIC KEY'), 'GET /pubkey returns public key PEM');

  const payload = 'agent run 77: transformed 1,204 rows, checksum ok';
  const stamped = await req('POST', '/stamp', { payload });
  assert(stamped.status === 200 && stamped.body.receipt.signature, 'POST /stamp returns a signed receipt');

  const ok = await req('POST', '/verify', { payload, receipt: stamped.body.receipt });
  assert(ok.status === 200 && ok.body.valid === true, 'POST /verify confirms genuine payload');

  const bad = await req('POST', '/verify', { payload: payload + ' (edited)', receipt: stamped.body.receipt });
  assert(bad.status === 200 && bad.body.valid === false, 'POST /verify rejects tampered payload');

  const noPayload = await req('POST', '/stamp', {});
  assert(noPayload.status === 400, 'POST /stamp without payload returns 400');
  const badReceipt = await req('POST', '/verify', { payload, receipt: { hash: 'x' } });
  assert(badReceipt.status === 400, 'POST /verify with malformed receipt returns 400');
  const notFound = await req('GET', '/nope');
  assert(notFound.status === 404, 'unknown route returns 404');

  // /stamp must stay free (unpaywalled) — the ACP daemon depends on this.
  const stampStillFree = await req('POST', '/stamp', { payload });
  assert(stampStillFree.status === 200 && stampStillFree.body.receipt, 'POST /stamp remains unpaywalled for the ACP daemon');

  // /x402/stamp must demand payment — no CDP credentials needed to reach the 402 challenge itself.
  const x402Challenge = await req('POST', '/x402/stamp', { payload });
  assert(x402Challenge.status === 402 && Array.isArray(x402Challenge.body.accepts), 'POST /x402/stamp without payment returns a 402 challenge');
  const accepted = x402Challenge.body.accepts && x402Challenge.body.accepts[0];
  assert(accepted && accepted.network === 'base' && accepted.maxAmountRequired === '20000', 'x402 challenge specifies base mainnet and $0.02 USDC (20000 = 6-decimal units)');

  // GET /x402/stamp must also demand payment — added after Agentic.Market's
  // crawler listed the endpoint as GET; buyers following that listing must work.
  const x402GetChallenge = await req('GET', '/x402/stamp?payload=' + encodeURIComponent(payload));
  assert(x402GetChallenge.status === 402 && Array.isArray(x402GetChallenge.body.accepts), 'GET /x402/stamp without payment also returns a 402 challenge');

  console.log(failed ? '\nSOME WORKER TESTS FAILED' : '\nALL WORKER TESTS PASSED');
  process.exitCode = failed ? 1 : 0;
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
