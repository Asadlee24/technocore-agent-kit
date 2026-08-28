#!/usr/bin/env node
/**
 * Technocore Agent Kit — Autonomous TypeScript Agent
 * Full autonomous agent loop: check-in, watch for tasks, A2A coordination, persist memory.
 * Built by Asad Lee (https://asad-lee-portfolio.vercel.app/)
 */

import { createTechnocoreClient } from '../../packages/core/dist/src/index.js';
import { createAgentIdentity, saveIdentityToFile, loadIdentityFromFile } from '../../packages/core/dist/src/identity/index.js';
import * as fs from 'node:fs';
import * as path from 'node:path';

const IDENTITY_PATH = path.join(process.cwd(), '.ts-agent-identity.json');
const STATE_NS = 'p-ts-agent-state';

async function main() {
  console.log('\n🤖 Autonomous TypeScript Agent — Technocore Agent Kit');
  console.log('   Built by Asad Lee (https://asad-lee-portfolio.vercel.app/)\n');

  const client = createTechnocoreClient();

  // Load or create identity
  let identity;
  if (fs.existsSync(IDENTITY_PATH)) {
    identity = loadIdentityFromFile(IDENTITY_PATH);
    console.log(`✔ Loaded identity: ${identity.did}`);
  } else {
    identity = createAgentIdentity();
    saveIdentityToFile(identity, { filePath: IDENTITY_PATH });
    console.log(`✔ New identity created: ${identity.did}`);
  }

  client.did.set(identity);

  // Verify local identity
  const testEnv = identity.signMessage('self-test', 'ready');
  const selfVerified = client.verify.envelope(testEnv);
  console.log(`✔ Self-verification: ${selfVerified ? 'PASS' : 'FAIL'}`);
  if (!selfVerified) process.exit(1);

  // Publish DID note
  console.log('📡 Publishing DID note...');
  try {
    const pub = await client.notes.publishDid(identity);
    console.log(`   Published to: ${pub.path}`);
  } catch (err: any) {
    console.warn(`   Publish note: ${err.message}`);
  }

  // Check in to lobby
  console.log('📢 Posting signed check-in to #lobby...');
  try {
    await client.rooms.sendSigned('lobby', `TypeScript agent ${identity.fingerprint.slice(0, 8)} online`);
    console.log('   Check-in posted.');
  } catch (err: any) {
    console.warn(`   Check-in note: ${err.message}`);
  }

  // Store session state
  const sessionKey = `session-${Date.now()}`;
  await client.notes.set(STATE_NS, sessionKey, JSON.stringify({
    did: identity.did,
    startedAt: new Date().toISOString(),
    status: 'active',
  }), { ifAbsent: true }).catch(() => {});

  // Autonomous watch loop
  console.log('\n👂 Watching #lobby for tasks (Ctrl+C to stop)...\n');
  const ac = new AbortController();
  process.on('SIGINT', () => { ac.abort(); console.log('\nStopping agent.'); });

  let processed = 0;
  for await (const msg of client.rooms.watch('lobby', {
    waitSeconds: 10,
    stopSignal: ac.signal,
    onRateLimited: (s) => console.warn(`⏳ Rate limited — waiting ${s}s`),
  })) {
    const safe = client.safety.wrapUntrustedMessage(msg.text);
    if (safe.containsInjectionRisk) {
      console.warn(`🚨 [seq:${msg.seq}] Injection attempt detected — skipping`);
      continue;
    }

    processed++;
    const sender = msg.did ? `<${msg.did.slice(0, 20)}...>` : `<${msg.from}>`;
    console.log(`[${processed}] seq:${msg.seq} ${sender} → ${safe.swept.slice(0, 80)}`);

    // Respond to agents that mention "ping"
    if (safe.swept.toLowerCase().includes('ping') && msg.did && msg.did !== identity.did) {
      await client.rooms.sendSigned('lobby', `pong from ${identity.fingerprint.slice(0, 8)}`).catch(() => {});
    }
  }

  console.log(`\n✔ Agent shut down. Processed ${processed} messages.`);
}

main().catch(console.error);
