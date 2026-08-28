/**
 * Technocore Agent Kit — Contribution Proof Generator
 * Produces clean, verifiable, leak-free proof of agent participation.
 * Built by Asad Lee (https://asad-lee-portfolio.vercel.app/)
 */

import { PROOF_VERSION, PROJECT_AUTHOR, PROJECT_REPO, DEFAULT_BASE_URL } from '../constants.js';
import type { ContributionProof } from '../types.js';
import { AgentIdentity } from '../identity/identity.js';
import { verifySignature } from '../identity/crypto.js';

export interface GenerateProofOptions {
  identity: AgentIdentity;
  workflow?: string;
  commitSha?: string;
  baseUrl?: string;
  customNonce?: string;
}

/**
 * Generates a deterministic, cryptographically signed contribution proof.
 * GUARANTEES zero secret leaks (contains only public DID, signatures, nonces, timestamps, hashes).
 */
export function generateContributionProof(options: GenerateProofOptions): ContributionProof {
  const { identity } = options;
  const workflow = options.workflow || 'agent-kit-core-integration';
  const commitSha = options.commitSha || 'HEAD';
  const baseUrl = (options.baseUrl || DEFAULT_BASE_URL).replace(/\/+$/, '');
  const timestampUtc = new Date().toISOString();
  const nonce = options.customNonce || Date.now().toString();

  // Canonical payload format for proof:
  // PROOF_VERSION|DID|REPOSITORY|WORKFLOW|COMMIT_SHA|TIMESTAMP_UTC|NONCE|ENDPOINT
  const signedPayload = [
    PROOF_VERSION,
    identity.did,
    PROJECT_REPO,
    workflow,
    commitSha,
    timestampUtc,
    nonce,
    baseUrl,
  ].join('|');

  const envelope = identity.signMessage('proof', signedPayload, nonce);

  return {
    proofVersion: PROOF_VERSION,
    agentDid: identity.did,
    agentFingerprint: identity.fingerprint,
    project: 'Technocore Agent Kit',
    repository: PROJECT_REPO,
    author: PROJECT_AUTHOR,
    workflow,
    protocolEndpoint: baseUrl,
    timestampUtc,
    nonce,
    signature: envelope.sig,
    signedPayload,
  };
}

/**
 * Verifies a contribution proof independently offline
 */
export function verifyContributionProof(proof: ContributionProof): boolean {
  if (!proof.agentDid || !proof.signature || !proof.signedPayload || !proof.nonce) {
    return false;
  }
  // The signature was made over payload: proof|<nonce>|<signedPayload>
  const payloadToVerify = `proof|${proof.nonce}|${proof.signedPayload}`;
  return verifySignature(payloadToVerify, proof.signature, proof.agentDid);
}
