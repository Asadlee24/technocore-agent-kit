/**
 * Technocore Agent Kit — Verifiable Task Results
 * Cryptographic Ed25519 Result Envelopes & Provenance Attestation.
 * Built by Asad Lee (https://asad-lee-portfolio.vercel.app/)
 */

import * as crypto from 'node:crypto';
import type { VerifiableTaskResultEnvelope } from '../types.js';
import type { AgentIdentity } from '../identity/identity.js';
import { signBytes, verifySignature } from '../identity/crypto.js';

/**
 * Computes canonical SHA-256 hex digest for any JSON-serializable value.
 */
export function canonicalHash(value: any): string {
  const jsonStr = typeof value === 'string' ? value : JSON.stringify(value, Object.keys(value || {}).sort());
  return crypto.createHash('sha256').update(jsonStr, 'utf8').digest('hex');
}

/**
 * Creates a cryptographically signed VerifiableTaskResultEnvelope.
 */
export function createVerifiableResult(options: {
  taskId: string;
  workflowId: string;
  input: any;
  resultPayload: any;
  success: boolean;
  identity: AgentIdentity;
  customNonce?: string | number;
}): VerifiableTaskResultEnvelope {
  const now = new Date().toISOString();
  const nonce = options.customNonce !== undefined ? options.customNonce.toString() : Date.now().toString();
  const inputHash = canonicalHash(options.input);
  const outputHash = canonicalHash(options.resultPayload);

  // Signed payload format: <taskId>|<workflowId>|<inputHash>|<outputHash>|<timestamp>|<nonce>
  const payloadToSign = `${options.taskId}|${options.workflowId}|${inputHash}|${outputHash}|${now}|${nonce}`;
  const signature = options.identity.signMessage('task-result-attestation', payloadToSign, nonce).sig;

  return {
    taskId: options.taskId,
    workflowId: options.workflowId,
    agentDid: options.identity.did,
    inputHash,
    outputHash,
    timestamp: now,
    nonce,
    signature,
    success: options.success,
    resultPayload: options.resultPayload,
  };
}

/**
 * Verifies the cryptographic provenance, integrity, and authenticity of a task result.
 */
export function verifyTaskResult(
  envelope: VerifiableTaskResultEnvelope,
  expected?: {
    taskId?: string;
    workflowId?: string;
    expectedInput?: any;
    expectedAgentDid?: string;
  }
): { valid: boolean; reason?: string } {
  if (!envelope || !envelope.agentDid || !envelope.signature) {
    return { valid: false, reason: 'Malformed result envelope: missing DID or signature' };
  }

  if (expected?.taskId && envelope.taskId !== expected.taskId) {
    return { valid: false, reason: `Task ID mismatch: expected '${expected.taskId}', got '${envelope.taskId}'` };
  }

  if (expected?.workflowId && envelope.workflowId !== expected.workflowId) {
    return { valid: false, reason: `Workflow ID mismatch: expected '${expected.workflowId}', got '${envelope.workflowId}'` };
  }

  if (expected?.expectedAgentDid && envelope.agentDid !== expected.expectedAgentDid) {
    return { valid: false, reason: `Agent DID mismatch: expected '${expected.expectedAgentDid}', got '${envelope.agentDid}'` };
  }

  // Verify input hash if expectedInput provided
  if (expected?.expectedInput !== undefined) {
    const computedInputHash = canonicalHash(expected.expectedInput);
    if (computedInputHash !== envelope.inputHash) {
      return { valid: false, reason: 'Input hash mismatch: Task input does not match signed provenance' };
    }
  }

  // Verify output payload hash
  const computedOutputHash = canonicalHash(envelope.resultPayload);
  if (computedOutputHash !== envelope.outputHash) {
    return { valid: false, reason: 'Output payload has been tampered with: Hash does not match signed outputHash' };
  }

  // Reconstruct signed message payload for offline signature verification
  // Message format from AgentIdentity.signMessage: <room>|<nonce>|<swept_text>
  const payloadToSign = `${envelope.taskId}|${envelope.workflowId}|${envelope.inputHash}|${envelope.outputHash}|${envelope.timestamp}|${envelope.nonce}`;
  const signedEnvelopeText = `task-result-attestation|${envelope.nonce}|${payloadToSign}`;

  const isSigValid = verifySignature(signedEnvelopeText, envelope.signature, envelope.agentDid);
  if (!isSigValid) {
    return { valid: false, reason: 'Cryptographic signature verification failed for agent DID' };
  }

  return { valid: true };
}
