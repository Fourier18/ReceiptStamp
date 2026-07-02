// End-to-end HTTP test: starts the server, exercises /stamp, /verify, /pubkey,
// tamper rejection, and bad-input handling. Run: node test/test-server.js

process.env.PORT = 8402;
const server = require('../src/server');

function req(method, urlPath, body) {
  return fetch(`http://localhost:8402${urlPath}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  }).then(async (r) => ({ status: r.status, body: await r.json() }));
}

let failed = false;
function assert(cond, msg) {
  console.log(cond ? 'PASS:' : 'FAIL:', msg);
  if (!cond) failed = true;
}

async function main() {
  await new Promise((r) => setTimeout(r, 200)); // let server bind

  // pubkey endpoint
  const pk = await req('GET', '/pubkey');
  assert(pk.status === 200 && pk.body.publicKeyPem.includes('PUBLIC KEY'), 'GET /pubkey returns public key PEM');

  // stamp + verify round trip
  const payload = 'agent run 77: transformed 1,204 rows, checksum ok';
  const stamped = await req('POST', '/stamp', { payload });
  assert(stamped.status === 200 && stamped.body.receipt.signature, 'POST /stamp returns a signed receipt');

  const ok = await req('POST', '/verify', { payload, receipt: stamped.body.receipt });
  assert(ok.status === 200 && ok.body.valid === true, 'POST /verify confirms genuine payload');

  // tamper rejection over HTTP
  const bad = await req('POST', '/verify', { payload: payload + ' (edited)', receipt: stamped.body.receipt });
  assert(bad.status === 200 && bad.body.valid === false, 'POST /verify rejects tampered payload');

  // input validation
  const noPayload = await req('POST', '/stamp', {});
  assert(noPayload.status === 400, 'POST /stamp without payload returns 400');
  const badReceipt = await req('POST', '/verify', { payload, receipt: { hash: 'x' } });
  assert(badReceipt.status === 400, 'POST /verify with malformed receipt returns 400');
  const notFound = await req('GET', '/nope');
  assert(notFound.status === 404, 'unknown route returns 404');

  console.log(failed ? '\nSOME TESTS FAILED' : '\nALL SERVER TESTS PASSED');
  server.close();
  process.exitCode = failed ? 1 : 0;
}

main().catch((e) => { console.error(e); server.close(); process.exitCode = 1; });
