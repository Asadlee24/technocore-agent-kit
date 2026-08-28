import test from 'node:test';
import assert from 'node:assert';
import { createAgentIdentity } from '../src/identity/index.js';
import { generateContributionProof, verifyContributionProof } from '../src/proof/index.js';

test('Contribution proof generation and offline verification', () => {
  const identity = createAgentIdentity();
  const proof = generateContributionProof({
    identity,
    workflow: 'autonomous-a2a-coordination',
    commitSha: 'a1b2c3d4e5f6',
  });

  assert.strictEqual(proof.agentDid, identity.did);
  assert.strictEqual(proof.workflow, 'autonomous-a2a-coordination');
  assert.strictEqual(proof.author, 'Asad Lee');
  assert.strictEqual(typeof proof.signature, 'string');
  assert.strictEqual(proof.signature.length, 86);

  // Assert no secret keys or private fields in proof
  const proofJson = JSON.stringify(proof);
  assert.strictEqual(proofJson.includes('privateKey'), false);
  assert.strictEqual(proofJson.includes('secret_seed'), false);
  assert.strictEqual(proofJson.includes('token'), false);

  // Independent verification
  const isValid = verifyContributionProof(proof);
  assert.strictEqual(isValid, true);
});
