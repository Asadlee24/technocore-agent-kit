#!/usr/bin/env node
/**
 * Technocore Agent Kit — Automated Agent B (Auto-Responder)
 * Listens for TASK: messages on a Technocore room, executes safe processing,
 * and replies with signed RESULT: messages using Ed25519 DID identity.
 * Built by Asad Lee (https://asad-lee-portfolio.vercel.app/)
 */

import * as path from 'node:path';
import { createTechnocoreClient } from '@technocore/agent-kit';
import type { RoomMessage } from '@technocore/agent-kit';

/**
 * Swappable task processing logic.
 * Takes sanitized task text and produces a result string.
 */
export function processTask(taskText: string): string {
  return `RESULT: Agent B received and processed: ${taskText}`;
}

async function runAutoResponder() {
  const room = process.argv[2] || 'asad-test-2026';
  const identityPath = path.resolve(process.cwd(), '.agent-identity.json');

  console.log('\n=============================================================');
  console.log('🤖 Technocore Agent B — Automated Auto-Responder');
  console.log('   Live Network: https://technocore.io');
  console.log('   Author: Asad Lee (https://asad-lee-portfolio.vercel.app/)');
  console.log('=============================================================\n');

  // Initialize client and load existing Agent B identity
  const client = createTechnocoreClient();

  let identity;
  try {
    identity = client.did.loadFromFile(identityPath);
    console.log(`✔ [1] Loaded Agent B Identity from ${identityPath}`);
    console.log(`    DID:         ${identity.did}`);
    console.log(`    Fingerprint: ${identity.fingerprint}\n`);
  } catch (err: any) {
    console.error(`✖ Failed to load Agent B identity from ${identityPath}:`, err.message);
    console.error('  Ensure .agent-identity.json exists in workspace before running Agent B.');
    process.exit(1);
  }

  // Graceful shutdown handling
  const abortController = new AbortController();
  let isShuttingDown = false;

  const handleShutdown = () => {
    if (isShuttingDown) return;
    isShuttingDown = true;
    console.log('\n🛑 Shutdown signal received. Stopping room watch cleanly...');
    abortController.abort();
  };

  process.on('SIGINT', handleShutdown);
  process.on('SIGTERM', handleShutdown);

  console.log(`👂 [2] Watching room #${room} for incoming tasks...`);
  console.log('    Filter: Messages starting with "TASK:"');
  console.log('    Self-Ignore: Active (Agent B will not reply to own DID)');
  console.log('    Safety: Single-line sweep & prompt-injection wrapping enabled');
  console.log('    Press Ctrl+C to stop.\n');

  let processedCount = 0;
  const pollIntervalMs = 1500;

  // Resilient watch loop with reconnection on unexpected network drops
  while (!abortController.signal.aborted) {
    try {
      for await (const msg of client.rooms.watch(room, {
        waitSeconds: 10,
        stopSignal: abortController.signal,
        onRateLimited: (retrySeconds) => {
          console.warn(`⏳ [Rate Limited] Backing off for ${retrySeconds}s...`);
        },
      })) {
        if (abortController.signal.aborted) break;

        const senderDid = msg.did || (msg.from?.startsWith('z6Mk') ? `did:key:${msg.from}` : msg.from);

        // 1. Skip messages sent by Agent B itself (prevent infinite loops)
        if (msg.did === identity.did || senderDid === identity.did) {
          continue;
        }

        // 2. Wrap untrusted message for prompt injection safety (treat strictly as passive data)
        const safeWrapper = client.safety.wrapUntrustedMessage(msg.text);

        if (safeWrapper.containsInjectionRisk) {
          console.warn(`🚨 [SECURITY] Prompt injection pattern detected in seq:${msg.seq} from ${senderDid}`);
          console.warn(`   Patterns: ${safeWrapper.matchedRiskPatterns.join(', ')}`);
          console.warn(`   Treating strictly as inert data without command execution.`);
        }

        // 3. Skip if swept text does not start with TASK:
        if (!safeWrapper.swept.startsWith('TASK:')) {
          continue;
        }

        processedCount++;
        const rawTask = safeWrapper.swept.slice('TASK:'.length).trim();

        console.log(`\n-------------------------------------------------------------`);
        console.log(`📥 [Task Received #${processedCount}]`);
        console.log(`   Sequence:    #${msg.seq}`);
        console.log(`   From DID:    ${senderDid}`);
        console.log(`   Raw Task:    "${rawTask}"`);
        if (msg.sig && msg.nonce) {
          const isSigValid = client.verify.message(room, msg.nonce, msg.text, msg.sig, msg.did || '');
          console.log(`   Signature:   ${isSigValid ? 'VALID ✔ (Ed25519 verified)' : 'INVALID ✖'}`);
        }

        // 4. Generate response using swappable task processor
        const responseText = processTask(rawTask);
        console.log(`⚙ [Processing] Generated Response: "${responseText}"`);

        // 5. Send signed response back to the same room
        try {
          console.log(`📤 [Sending Response] Posting signed message to #${room}...`);
          const sendRes = await client.rooms.sendSigned(room, responseText);
          console.log(`✔ [Response Sent] Status: ${sendRes.status} (OK)`);
          console.log(`   Signed Envelope Nonce: ${sendRes.envelope.nonce}`);
          console.log(`   Signed Envelope Sig:   ${sendRes.envelope.sig.slice(0, 24)}...`);
        } catch (sendErr: any) {
          console.error(`✖ Failed to send response to #${room}:`, sendErr.message);
        }
        console.log(`-------------------------------------------------------------\n`);
      }
    } catch (err: any) {
      if (abortController.signal.aborted) break;

      console.warn(`⚠️ Watch connection interrupted: ${err.message}. Reconnecting in ${pollIntervalMs / 1000}s...`);
      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
    }
  }

  console.log(`\n✔ Agent B stopped cleanly. Total tasks processed: ${processedCount}\n`);
}

runAutoResponder().catch((err) => {
  console.error('Fatal error in Agent B auto-responder:', err);
  process.exit(1);
});
