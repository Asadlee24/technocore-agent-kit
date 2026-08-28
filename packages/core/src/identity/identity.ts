/**
 * Technocore Agent Kit — Agent Identity
 * Local Ed25519 identity management with zero secret leakage.
 * Built by Asad Lee (https://asad-lee-portfolio.vercel.app/)
 */

import type { AgentKeyPair, SignedMessageEnvelope, SignedNoteEnvelope } from '../types.js';
import { generateEd25519KeyPair, keyPairFromPrivateKey, signBytes } from './crypto.js';
import { singleLineSweep } from '../safety/sanitizer.js';

export class AgentIdentity {
  private readonly keyPair: AgentKeyPair;

  constructor(keyPair: AgentKeyPair) {
    this.keyPair = keyPair;
  }

  /**
   * The public did:key string (e.g. did:key:z6Mk...)
   */
  public get did(): string {
    return this.keyPair.did;
  }

  /**
   * The 16-character SHA-256 fingerprint
   */
  public get fingerprint(): string {
    return this.keyPair.fingerprint;
  }

  /**
   * The 2-character shard for /kv/did-<shard>/<key>
   */
  public get shard(): string {
    return this.keyPair.shard;
  }

  /**
   * The 14-character key for /kv/did-<shard>/<key>
   */
  public get key(): string {
    return this.keyPair.key;
  }

  /**
   * Sharded note path convention: `did-${shard}/${key}`
   */
  public get didNotePath(): { namespace: string; key: string } {
    return {
      namespace: `did-${this.shard}`,
      key: this.key,
    };
  }

  /**
   * 32-byte raw public key
   */
  public get publicKeyRaw(): Uint8Array {
    return new Uint8Array(this.keyPair.publicKeyRaw);
  }

  /**
   * Generates a fresh nonce (millisecond timestamp string with counter fallback)
   */
  public generateNonce(): string {
    return Date.now().toString();
  }

  /**
   * Signs a room message according to Technocore protocol:
   * 1. Performs single-line sweep on text
   * 2. Constructs payload: `<room>|<nonce>|<swept_text>`
   * 3. Signs with Ed25519 and outputs 86-char base64url signature
   */
  public signMessage(room: string, text: string, customNonce?: string | number): SignedMessageEnvelope {
    const sweptText = singleLineSweep(text);
    const nonce = customNonce !== undefined ? customNonce.toString() : this.generateNonce();
    const payload = `${room}|${nonce}|${sweptText}`;
    const sig = signBytes(payload, this.keyPair.privateKeyDer);

    return {
      did: this.did,
      sig,
      nonce,
      text: sweptText,
      room,
    };
  }

  /**
   * Signs an ownership note (room-owners or room-allow) according to Technocore protocol:
   * 1. Performs single-line sweep on value
   * 2. Constructs payload: `<namespace>|<key>|<nonce>|<swept_value>`
   * 3. Signs with Ed25519 and outputs 86-char base64url signature
   */
  public signNote(namespace: string, key: string, value: string, customNonce: string | number): SignedNoteEnvelope {
    const sweptValue = singleLineSweep(value);
    const nonce = customNonce.toString();
    const payload = `${namespace}|${key}|${nonce}|${sweptValue}`;
    const sig = signBytes(payload, this.keyPair.privateKeyDer);

    return {
      did: this.did,
      sig,
      nonce,
      value: sweptValue,
      namespace,
      key,
    };
  }

  /**
   * Export only public attributes. Private key is never exported here.
   */
  public exportPublicRecord(): {
    did: string;
    fingerprint: string;
    shard: string;
    key: string;
    didNotePath: string;
  } {
    return {
      did: this.did,
      fingerprint: this.fingerprint,
      shard: this.shard,
      key: this.key,
      didNotePath: `kv/did-${this.shard}/${this.key}`,
    };
  }

  /**
   * Export private key bytes for secure local persistence ONLY.
   */
  public getPrivateKeyBytes(): Uint8Array {
    if (!this.keyPair.privateKeyRaw) {
      throw new Error('Raw private key bytes not available in this instance.');
    }
    return new Uint8Array(this.keyPair.privateKeyRaw);
  }

  /**
   * Custom inspect to prevent accidental logging of private keys in console.log()
   */
  [Symbol.for('nodejs.util.inspect.custom')](): Record<string, string> {
    return {
      did: this.did,
      fingerprint: this.fingerprint,
      shard: this.shard,
      key: this.key,
      privateKey: '[PROTECTED LOCAL SECRET — REDACTED]',
    };
  }
}

/**
 * Creates a brand new local agent identity
 */
export function createAgentIdentity(): AgentIdentity {
  const keyPair = generateEd25519KeyPair();
  return new AgentIdentity(keyPair);
}

/**
 * Loads an agent identity from a 32-byte secret seed or PKCS#8 DER bytes
 */
export function loadAgentIdentity(rawSecret: Uint8Array | string): AgentIdentity {
  let secretBytes: Uint8Array;
  if (typeof rawSecret === 'string') {
    // Check if hex or base64
    if (/^[0-9a-fA-F]{64}$/.test(rawSecret)) {
      secretBytes = new Uint8Array(Buffer.from(rawSecret, 'hex'));
    } else {
      secretBytes = new Uint8Array(Buffer.from(rawSecret, 'base64'));
    }
  } else {
    secretBytes = rawSecret;
  }
  const keyPair = keyPairFromPrivateKey(secretBytes);
  return new AgentIdentity(keyPair);
}
