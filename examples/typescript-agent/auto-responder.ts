#!/usr/bin/env node
/**
 * Technocore Agent Kit — Automated Agent B (Task Worker & Auto-Responder)
 * Listens for TASK: messages on a Technocore room, executes local safe calculations,
 * text manipulations, JSON verification, and replies with signed RESULT: messages.
 * Built by Asad Lee (https://asad-lee-portfolio.vercel.app/)
 */

import * as path from 'node:path';
import { createTechnocoreClient } from '@technocore/agent-kit';
import { processTask } from '@technocore/agent-kit/tasks';
import type { RoomMessage } from '@technocore/agent-kit';

/**
 * Formats the raw processTask() output into a clean, human-readable RESULT: string.
 *
 * processTask() always returns:
 *   RESULT: <JSON envelope>
 *
 * This formatter extracts the meaningful value from the envelope so that:
 *   RESULT: {"success":true,"taskType":"CALCULATE","result":100,...}
 * becomes:
 *   RESULT: 100
 *
 * For structured results (WORD_COUNT, JSON_VALIDATE, SUMMARIZE) it formats
 * a compact human-readable summary.
 */
function formatResult(rawResponse: string): string {
  // Strip the "RESULT: " prefix to get the JSON
  const jsonStr = rawResponse.startsWith('RESULT: ')
    ? rawResponse.slice('RESULT: '.length)
    : rawResponse;

  let envelope: any;
  try {
    envelope = JSON.parse(jsonStr);
  } catch {
    // If it's not JSON, return as-is
    return rawResponse;
  }

  if (!envelope.success) {
    return `RESULT: ERROR: ${envelope.error ?? 'Unknown error'}`;
  }

  const result = envelope.result;
  const taskType: string = envelope.taskType ?? '';

  switch (taskType) {
    case 'CALCULATE':
      // Return bare number (integer if whole, else up to 10 significant digits)
      return `RESULT: ${Number.isInteger(result) ? result : parseFloat(result.toPrecision(10))}`;

    case 'UPPERCASE':
    case 'LOWERCASE':
    case 'REVERSE':
      // Return bare transformed string
      return `RESULT: ${result}`;

    case 'WORD_COUNT':
      return `RESULT: ${result.wordCount} words, ${result.characterCount} characters`;

    case 'JSON_VALIDATE':
      if (result.valid) {
        const keys = result.keys ? `, keys: [${result.keys.join(', ')}]` : '';
        return `RESULT: Valid JSON (${result.valueType}${keys})`;
      }
      return `RESULT: Invalid JSON`;

    case 'SUMMARIZE': {
      const attrs = result.extractedAttributes
        ? ' | ' + Object.entries(result.extractedAttributes).map(([k, v]) => `${k}=${v}`).join(' ')
        : '';
      return `RESULT: ${result.wordCount} words${attrs}`;
    }

    case 'CUSTOM_TEXT':
      return `RESULT: ${result}`;

    default:
      // Fallback: pretty-print the result field
      return `RESULT: ${typeof result === 'object' ? JSON.stringify(result) : result}`;
  }
}

async function runAutoResponder() {
  const room = process.argv[2] || 'asad-test-2026';
  const identityPath = path.resolve(process.cwd(), '.agent-identity.json');

  console.log('\n=============================================================');
  console.log('🤖 Technocore Agent B — Automated Real Task Worker');
  console.log('   Capabilities: CALCULATE, WORD_COUNT, UPPERCASE, LOWERCASE,');
  console.log('                 REVERSE, JSON_VALIDATE, SUMMARIZE');
  console.log('   Task Engine:  @technocore/agent-kit/tasks (local, no API key)');
  console.log('   Live Network: https://technocore.io');
  console.log('   Author: Asad Lee (https://asad-lee-portfolio.vercel.app/)');
  console.log('=============================================================\n');

  // Initialize client and load existing Agent B identity
  const client = createTechnocoreClient();

  let identity: Awaited<ReturnType<typeof client.did.loadFromFile>>;
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
  console.log('    Filter:     Messages starting with "TASK:"');
  console.log('    Self-Ignore: Active (Agent B will not reply to own DID)');
  console.log('    Safety:     Single-line sweep & prompt-injection wrapping enabled');
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

        // 4. Process task using the core task engine, then format into human-readable result
        const rawEnvelope = processTask(rawTask);
        const responseText = formatResult(rawEnvelope);

        console.log(`⚙ [Processing]`);
        console.log(`   Engine Output:   ${rawEnvelope}`);
        console.log(`   Formatted Reply: ${responseText}`);

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

// Only run standalone execution when directly invoked as CLI
if (process.argv[1] && process.argv[1].endsWith('auto-responder.js')) {
  runAutoResponder().catch((err) => {
    console.error('Fatal error in Agent B auto-responder:', err);
    process.exit(1);
  });
}
