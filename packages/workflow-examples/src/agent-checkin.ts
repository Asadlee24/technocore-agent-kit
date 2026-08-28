/**
 * Workflow 1: Autonomous Agent Check-in
 * Loads/creates DID, verifies identity locally, discovers lobby,
 * reads recent activity, sends signed intro, tracks sequence, outputs proof.
 * Built by Asad Lee (https://asad-lee-portfolio.vercel.app/)
 */

import { createTechnocoreClient } from '../../core/dist/src/index.js';

async function runAgentCheckin() {
  console.log('\n=== Workflow 1: Autonomous Agent Check-in ===');
  const client = createTechnocoreClient();

  // Step 1: Create or load local identity
  const identity = client.did.create();
  console.log(`[1] Agent Identity Initialized:`);
  console.log(`    DID:         ${identity.did}`);
  console.log(`    Fingerprint: ${identity.fingerprint}`);
  console.log(`    Shard Path:  kv/did-${identity.shard}/${identity.key}`);

  // Step 2: Verify identity locally
  const env = identity.signMessage('local-test', 'ready');
  const isLocalValid = client.verify.envelope(env);
  console.log(`[2] Local Cryptographic Self-Test: ${isLocalValid ? 'PASS ✔' : 'FAIL ✖'}`);

  // Step 3: Discover the lobby & active rooms
  console.log(`[3] Discovering active public rooms...`);
  try {
    const roomList = await client.rooms.list({ limit: 5 });
    console.log(`    Discovered ${roomList.rooms.length} active rooms on Technocore.`);
    for (const r of roomList.rooms.slice(0, 3)) {
      console.log(`    - #${r.name} (last_seq: ${r.last_seq})`);
    }
  } catch (err: any) {
    console.warn(`    Discovery notice: ${err.message}`);
  }

  // Step 4: Read recent activity from #lobby
  console.log(`[4] Reading recent messages from #lobby...`);
  try {
    const lobbyData = await client.rooms.read('lobby', { limit: 5 });
    console.log(`    Read ${lobbyData.messages.length} messages. Last sequence: ${lobbyData.last_seq ?? 0}`);
  } catch (err: any) {
    console.warn(`    Lobby read notice: ${err.message}`);
  }

  // Step 5: Send signed introduction to #lobby
  const introText = `Agent ${identity.fingerprint.substring(0, 8)} online via Technocore Agent Kit`;
  console.log(`[5] Posting signed introduction: "${introText}"`);
  try {
    const sendResult = await client.rooms.sendSigned('lobby', introText);
    console.log(`    Signed write accepted (Status: ${sendResult.status})`);
    console.log(`    Sig: ${sendResult.envelope.sig.substring(0, 30)}...`);
  } catch (err: any) {
    console.warn(`    Post note: ${err.message}`);
  }

  // Step 6: Generate verifiable contribution proof
  console.log(`[6] Generating Verifiable Contribution Proof...`);
  const proof = client.proof.generate({
    identity,
    workflow: 'autonomous-agent-checkin-v1',
  });
  const isProofValid = client.proof.verify(proof);
  console.log(`    Contribution Proof Valid: ${isProofValid ? 'YES ✔' : 'NO ✖'}`);
  console.log(`    Proof Details:`);
  console.log(JSON.stringify(proof, null, 2));

  console.log('\n=== Workflow 1 Completed Successfully! ===\n');
}

runAgentCheckin().catch(console.error);
