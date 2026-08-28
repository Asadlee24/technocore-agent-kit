/**
 * Workflow 3: Persistent Agent Memory & Atomic State Transitions
 * Demonstrates structured note storage, atomic Compare-And-Swap (CAS), and identity proof verification.
 * Built by Asad Lee (https://asad-lee-portfolio.vercel.app/)
 */

import { createTechnocoreClient, createAgentIdentity } from '../../core/dist/src/index.js';

async function runPersistentMemoryWorkflow() {
  console.log('\n=== Workflow 3: Persistent Agent Memory & Atomic CAS ===');
  const identity = createAgentIdentity();
  const client = createTechnocoreClient({ identity });

  console.log(`[1] Agent Identity: ${identity.did}`);

  // Distinct namespace for agent workflow state
  const namespace = `p-agent-state-${identity.fingerprint.substring(0, 8)}`;
  const stateKey = 'pipeline-checkpoint';

  console.log(`[2] Memory Note Path: /kv/${namespace}/${stateKey}`);
  console.log(`    NOTE: Technocore notes persist across agent sessions and have no ring rotation,`);
  console.log(`    but are not permanent cold storage (7-day idle cleanup applies).`);

  // Step 1: Initial state write with ?if_absent=1 (Atomic creation)
  const initialState = JSON.stringify({
    phase: 'INITIALIZATION',
    completedSteps: [1],
    lastUpdated: new Date().toISOString(),
    agentDid: identity.did,
  });

  console.log(`[3] Writing initial state conditionally (?if_absent=1)...`);
  try {
    const initRes = await client.notes.set(namespace, stateKey, initialState, { ifAbsent: true });
    console.log(`    Initial state written successfully (Status: ${initRes.status})`);
  } catch (err: any) {
    console.warn(`    Write notice: ${err.message}`);
  }

  // Step 2: Retrieve stored state later in workflow
  console.log(`[4] Reading back stored agent state...`);
  let storedRaw: string | null = null;
  try {
    storedRaw = await client.notes.get(namespace, stateKey);
    console.log(`    Retrieved State: ${storedRaw}`);
  } catch (err: any) {
    console.warn(`    Read notice: ${err.message}`);
  }

  // Step 3: Perform atomic Compare-And-Swap (CAS) state transition
  if (storedRaw) {
    console.log(`[5] Transitioning state: INITIALIZATION -> PROCESSING...`);
    const nextState = JSON.stringify({
      phase: 'PROCESSING',
      completedSteps: [1, 2],
      lastUpdated: new Date().toISOString(),
      agentDid: identity.did,
    });

    try {
      // CAS ensures no other concurrent agent modified state in the meantime
      const casRes = await client.notes.set(namespace, stateKey, nextState, { if: storedRaw });
      if (casRes.ok) {
        console.log(`    Atomic CAS Update Succeeded ✔`);
      } else if (casRes.status === 409) {
        console.log(`    CAS Conflict Detected (409): Another agent modified the state concurrently.`);
        console.log(`    Current Remote Value: ${casRes.currentValueOnConflict}`);
      }
    } catch (err: any) {
      console.warn(`    CAS update notice: ${err.message}`);
    }
  }

  // Step 4: Publish agent's public DID note
  console.log(`[6] Publishing Agent Public DID Note (/kv/did-${identity.shard}/${identity.key})...`);
  try {
    const didNoteRes = await client.notes.publishDid(identity, {
      mailbox: `mb-p-${identity.fingerprint.substring(0, 10)}`,
      extra: { role: 'orchestrator', version: '1.0' },
    });
    console.log(`    Published to: ${didNoteRes.path}`);
    console.log(`    Record content: "${didNoteRes.record}"`);

    // Verify resolving back
    const resolved = await client.notes.resolveDid(identity.did);
    console.log(`    Resolved DID: ${resolved?.did}`);
    console.log(`    Resolved Mailbox: ${resolved?.mailbox}`);
  } catch (err: any) {
    console.warn(`    DID publish notice: ${err.message}`);
  }

  console.log('\n=== Workflow 3 Completed Successfully! ===\n');
}

runPersistentMemoryWorkflow().catch(console.error);
