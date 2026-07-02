// ReceiptStamp ACP provider loop — services jobs from the Virtuals ACP listing.
//
// What it does, forever:
//   1. keeps `acp events listen` running in the background (restarts it if it dies)
//   2. drains new job events every POLL_MS
//   3. on any event for a job: pulls full state via `acp job history`
//   4. if the job is funded and awaiting delivery: extracts `payload` from the
//      job requirements, POSTs it to the live Worker /stamp, and submits the
//      signed receipt via `acp provider submit` (escrow then releases)
//
// MUST run on the machine holding the ACP signer key (Windows keychain here) —
// `acp provider submit` signs locally. The Worker only does the stamping.
//
// Run: node src/acp-provider.js          (logs to logs/acp-provider.log too)
// Env: STAMP_URL to override the Worker endpoint (default: live deployment)

const { spawn, execFile } = require('child_process');
const { appendFileSync, mkdirSync, existsSync } = require('fs');
const path = require('path');

const STAMP_URL = process.env.STAMP_URL || 'https://receiptstamp.panmediatech.workers.dev/stamp';
const POLL_MS = 5000;
const EVENTS_FILE = path.join(__dirname, '../logs/acp-events.jsonl');
const LOG_FILE = path.join(__dirname, '../logs/acp-provider.log');
const ACP = process.platform === 'win32' ? 'acp.cmd' : 'acp';

mkdirSync(path.join(__dirname, '../logs'), { recursive: true });

function log(...args) {
  const line = `[${new Date().toISOString()}] ${args.map((a) => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ')}`;
  console.log(line);
  appendFileSync(LOG_FILE, line + '\n');
}

// On Windows the .cmd shim forces shell:true, where Node concatenates args
// unescaped — paths with spaces and JSON args break without explicit quoting.
function q(arg) {
  if (process.platform !== 'win32') return arg;
  return `"${String(arg).replace(/"/g, '\\"')}"`;
}

function acp(args) {
  return new Promise((resolve, reject) => {
    execFile(ACP, [...args.map(q), '--json'], { shell: process.platform === 'win32' }, (err, stdout, stderr) => {
      if (err) return reject(new Error(`acp ${args.join(' ')} failed: ${stderr || err.message}`));
      try {
        resolve(JSON.parse(stdout));
      } catch {
        resolve(stdout.trim()); // some commands emit plain text even with --json
      }
    });
  });
}

// --- the one piece of real work: stamp a payload via the live Worker ---
async function stampPayload(payload) {
  const res = await fetch(STAMP_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ payload }),
  });
  if (!res.ok) throw new Error(`/stamp returned ${res.status}: ${await res.text()}`);
  const body = await res.json();
  if (!body.receipt || !body.receipt.signature) throw new Error('/stamp returned no receipt');
  return body.receipt;
}

// Requirements can arrive as a JSON string, an object, or nested one level —
// dig the payload string out of the common shapes without being precious.
function extractPayload(requirements) {
  let r = requirements;
  if (typeof r === 'string') {
    try { r = JSON.parse(r); } catch { return r; } // plain-string requirement: stamp it as-is
  }
  if (r && typeof r === 'object') {
    if (typeof r.payload === 'string') return r.payload;
    if (r.requirements) return extractPayload(r.requirements);
  }
  return null;
}

const handled = new Set(); // job ids we've already submitted for, this process lifetime

async function serviceJob(jobId) {
  if (handled.has(jobId)) return;
  let history;
  try {
    history = await acp(['job', 'history', '--job-id', String(jobId)]);
  } catch (e) {
    log(`job ${jobId}: history fetch failed —`, e.message);
    return;
  }

  const phase = (history && (history.phase || history.status || '')).toString().toUpperCase();
  log(`job ${jobId}: phase=${phase || 'unknown'}`);

  // Only act when the client's USDC is locked and it's on us to deliver.
  // Phase names per ACP docs: REQUEST -> NEGOTIATION -> TRANSACTION (funded) -> EVALUATION -> COMPLETED
  if (!phase.includes('TRANSACTION')) return;

  const payload = extractPayload(history.requirements || history.serviceRequirement || history.request);
  if (!payload) {
    log(`job ${jobId}: funded but no payload found in requirements — needs a human look`, history);
    return;
  }

  try {
    const receipt = await stampPayload(payload);
    await acp(['provider', 'submit', '--job-id', String(jobId), '--deliverable', JSON.stringify({ receipt })]);
    handled.add(jobId);
    log(`job ${jobId}: DELIVERED — keyId=${receipt.keyId} hash=${receipt.hash.slice(0, 12)}…`);
  } catch (e) {
    log(`job ${jobId}: delivery failed —`, e.message);
  }
}

function startListener() {
  const child = spawn(ACP, ['events', 'listen', '--output', q(EVENTS_FILE)], {
    shell: process.platform === 'win32',
    stdio: 'ignore',
  });
  log(`events listener started (pid ${child.pid}) -> ${EVENTS_FILE}`);
  child.on('exit', (code) => {
    log(`events listener exited (code ${code}) — restarting in 5s`);
    setTimeout(startListener, 5000);
  });
}

async function poll() {
  try {
    if (existsSync(EVENTS_FILE)) {
      const drained = await acp(['events', 'drain', '--file', EVENTS_FILE, '--limit', '50']);
      const events = Array.isArray(drained) ? drained : drained && drained.events ? drained.events : [];
      const jobIds = new Set();
      for (const ev of events) {
        const id = ev.jobId || ev.job_id || (ev.job && ev.job.id) || ev.onChainJobId;
        if (id !== undefined && id !== null) jobIds.add(id);
        log('event:', ev.type || ev.event || 'unknown', id !== undefined ? `job=${id}` : '');
      }
      for (const id of jobIds) await serviceJob(id);
    }
    // Belt and braces: also sweep active jobs, in case an event was missed.
    const jobs = await acp(['job', 'list']);
    const active = Array.isArray(jobs) ? jobs : jobs && jobs.jobs ? jobs.jobs : [];
    for (const j of active) {
      const id = j.id || j.jobId || j.onChainJobId;
      if (id !== undefined && id !== null) await serviceJob(id);
    }
  } catch (e) {
    log('poll error:', e.message);
  }
  setTimeout(poll, POLL_MS);
}

log(`ReceiptStamp ACP provider starting — stamping via ${STAMP_URL}`);
startListener();
poll();
