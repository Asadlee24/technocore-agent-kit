import { test } from 'node:test';
import * as assert from 'node:assert';
import { createAgentIdentity } from '../src/identity/identity.js';
import { createVerifiableResult, verifyTaskResult } from '../src/verify/verifiable-result.js';

test('VerifiableTaskResult: creates cryptographic result envelope and verifies offline', () => {
  const agentIdentity = createAgentIdentity();
  const input = { goal: 'Compute mathematical factorials', n: 5 };
  const output = { result: 120, executionTimeMs: 1.2 };

  const envelope = createVerifiableResult({
    taskId: 'task-fact-01',
    workflowId: 'wf-fact-01',
    input,
    resultPayload: output,
    success: true,
    identity: agentIdentity,
  });

  assert.ok(envelope.signature);
  assert.ok(envelope.inputHash);
  assert.ok(envelope.outputHash);
  assert.strictEqual(envelope.agentDid, agentIdentity.did);

  // Verification succeeds with matching expectations
  const check = verifyTaskResult(envelope, {
    taskId: 'task-fact-01',
    workflowId: 'wf-fact-01',
    expectedInput: input,
    expectedAgentDid: agentIdentity.did,
  });

  assert.strictEqual(check.valid, true);
});

test('VerifiableTaskResult: catches tampering in output payload', () => {
  const agentIdentity = createAgentIdentity();
  const input = { query: 'Check repository status' };
  const output = { status: 'clean', commits: 5 };

  const envelope = createVerifiableResult({
    taskId: 'task-sec-01',
    workflowId: 'wf-sec-01',
    input,
    resultPayload: output,
    success: true,
    identity: agentIdentity,
  });

  // Tamper with payload after signing
  const tamperedEnvelope = {
    ...envelope,
    resultPayload: { status: 'vulnerable', commits: 5 }, // Modified!
  };

  const check = verifyTaskResult(tamperedEnvelope);
  assert.strictEqual(check.valid, false);
  assert.match(check.reason || '', /tampered/i);
});

test('VerifiableTaskResult: catches invalid or forged signature', () => {
  const agentIdentity = createAgentIdentity();
  const imposter = createAgentIdentity();

  const envelope = createVerifiableResult({
    taskId: 'task-auth-01',
    workflowId: 'wf-auth-01',
    input: { test: true },
    resultPayload: { ok: true },
    success: true,
    identity: agentIdentity,
  });

  // Alter DID to imposter without updating signature
  const forgedEnvelope = {
    ...envelope,
    agentDid: imposter.did,
  };

  const check = verifyTaskResult(forgedEnvelope);
  assert.strictEqual(check.valid, false);
  assert.match(check.reason || '', /signature verification failed/i);
});
