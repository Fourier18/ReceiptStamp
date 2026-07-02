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
};

function req(method, urlPath, body) {
  const request = new Request(`http://worker.local${urlPath}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return worker.fetch(request, env, {}).then(async (r) => ({ status: r.status, body: await r.json() }));
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

  console.log(failed ? '\nSOME WORKER TESTS FAILED' : '\nALL WORKER TESTS PASSED');
  process.exitCode = failed ? 1 : 0;
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
