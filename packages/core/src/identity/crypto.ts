/**
 * Technocore Agent Kit — Ed25519 & did:key Cryptography
 * Pure local cryptographic functions for agent identity & verification.
 * Built by Asad Lee (https://asad-lee-portfolio.vercel.app/)
 */

import * as crypto from 'node:crypto';
import type { AgentKeyPair } from '../types.js';

// Base58btc alphabet used in multibase 'z'
const BASE58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
const BASE58_MAP: Record<string, number> = {};
for (let i = 0; i < BASE58_ALPHABET.length; i++) {
  BASE58_MAP[BASE58_ALPHABET[i]] = i;
}

// SPKI Header for Ed25519 Public Key: 302a300506032b6570032100 (12 bytes) + 32 bytes pubkey = 44 bytes
const ED25519_SPKI_HEADER = Buffer.from('302a300506032b6570032100', 'hex');

// PKCS#8 Header for Ed25519 Private Key: 302e020100300506032b657004220420 (16 bytes) + 32 bytes seed = 48 bytes
const ED25519_PKCS8_HEADER = Buffer.from('302e020100300506032b657004220420', 'hex');

// Multicodec Ed25519 varint prefix [0xed, 0x01]
const ED25519_MULTICODEC_PREFIX = Buffer.from([0xed, 0x01]);

/**
 * Encodes a buffer to Base58 string
 */
export function encodeBase58(buffer: Uint8Array): string {
  const digits = [0];
  for (let i = 0; i < buffer.length; i++) {
    for (let j = 0; j < digits.length; j++) digits[j] <<= 8;
    digits[0] += buffer[i];
    let carry = 0;
    for (let j = 0; j < digits.length; j++) {
      digits[j] += carry;
      carry = (digits[j] / 58) | 0;
      digits[j] %= 58;
    }
    while (carry) {
      digits.push(carry % 58);
      carry = (carry / 58) | 0;
    }
  }
  let str = '';
  for (let i = 0; i < buffer.length && buffer[i] === 0; i++) str += BASE58_ALPHABET[0];
  for (let i = digits.length - 1; i >= 0; i--) str += BASE58_ALPHABET[digits[i]];
  return str;
}

/**
 * Decodes a Base58 string to a Uint8Array
 */
export function decodeBase58(str: string): Uint8Array {
  const bytes = [0];
  for (let i = 0; i < str.length; i++) {
    const c = str[i];
    if (!(c in BASE58_MAP)) {
      throw new Error(`Invalid base58btc character: '${c}'`);
    }
    let carry = BASE58_MAP[c];
    for (let j = 0; j < bytes.length; j++) {
      const val = bytes[j] * 58 + carry;
      bytes[j] = val & 0xff;
      carry = val >> 8;
    }
    while (carry) {
      bytes.push(carry & 0xff);
      carry >>= 8;
    }
  }
  for (let i = 0; i < str.length && str[i] === '1'; i++) bytes.push(0);
  return new Uint8Array(bytes.reverse());
}

/**
 * Calculates Technocore SHA-256 fingerprint for a did:key
 * convention: first 16 hex chars of SHA-256(did:key string), lowercase
 * shard: first 2 chars
 * key: remaining 14 chars
 */
export function getDidFingerprint(did: string): { fingerprint: string; shard: string; key: string } {
  const hash = crypto.createHash('sha256').update(did, 'utf8').digest('hex').toLowerCase();
  const fingerprint = hash.substring(0, 16);
  const shard = fingerprint.substring(0, 2);
  const key = fingerprint.substring(2, 16);
  return { fingerprint, shard, key };
}

/**
 * Generates a brand new Ed25519 KeyPair and did:key identifier
 */
export function generateEd25519KeyPair(): AgentKeyPair {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
  const pubDer = publicKey.export({ type: 'spki', format: 'der' });
  const privDer = privateKey.export({ type: 'pkcs8', format: 'der' });

  const rawPub = new Uint8Array(pubDer.subarray(-32));
  const rawPriv = new Uint8Array(privDer.subarray(-32));

  const multicodec = Buffer.concat([ED25519_MULTICODEC_PREFIX, rawPub]);
  const did = `did:key:z${encodeBase58(multicodec)}`;
  const { fingerprint, shard, key } = getDidFingerprint(did);

  return {
    publicKeyDer: new Uint8Array(pubDer),
    publicKeyRaw: rawPub,
    privateKeyDer: new Uint8Array(privDer),
    privateKeyRaw: rawPriv,
    did,
    fingerprint,
    shard,
    key,
  };
}

/**
 * Reconstructs an AgentKeyPair from a 32-byte private seed or PKCS#8 DER bytes
 */
export function keyPairFromPrivateKey(rawSecret: Uint8Array): AgentKeyPair {
  let privDer: Buffer;
  let rawPriv: Uint8Array;

  if (rawSecret.length === 32) {
    rawPriv = rawSecret;
    privDer = Buffer.concat([ED25519_PKCS8_HEADER, Buffer.from(rawSecret)]);
  } else if (rawSecret.length === 48) {
    privDer = Buffer.from(rawSecret);
    rawPriv = new Uint8Array(privDer.subarray(-32));
  } else {
    throw new Error(`Invalid Ed25519 private key length: ${rawSecret.length}. Expected 32 or 48 bytes.`);
  }

  const privKeyObject = crypto.createPrivateKey({ key: privDer, format: 'der', type: 'pkcs8' });
  const pubKeyObject = crypto.createPublicKey(privKeyObject);
  const pubDer = pubKeyObject.export({ type: 'spki', format: 'der' });
  const rawPub = new Uint8Array(pubDer.subarray(-32));

  const multicodec = Buffer.concat([ED25519_MULTICODEC_PREFIX, rawPub]);
  const did = `did:key:z${encodeBase58(multicodec)}`;
  const { fingerprint, shard, key } = getDidFingerprint(did);

  return {
    publicKeyDer: new Uint8Array(pubDer),
    publicKeyRaw: rawPub,
    privateKeyDer: new Uint8Array(privDer),
    privateKeyRaw: rawPriv,
    did,
    fingerprint,
    shard,
    key,
  };
}

/**
 * Parses a did:key:z6Mk... into a CryptoKey / SPKI Public Key Object
 */
export function parseDidKey(did: string): { rawPub: Uint8Array; publicKey: crypto.KeyObject } {
  if (!did.startsWith('did:key:z')) {
    throw new Error(`Invalid did:key format: '${did}'. Must start with 'did:key:z'`);
  }
  const base58Part = did.substring(9);
  const decoded = decodeBase58(base58Part);

  if (decoded.length !== 34) {
    throw new Error(`Invalid did:key payload length: ${decoded.length}. Expected 34 bytes (2 prefix + 32 key).`);
  }

  // Check multicodec prefix [0xed, 0x01]
  if (decoded[0] !== 0xed || decoded[1] !== 0x01) {
    throw new Error(`Unsupported multicodec prefix: [0x${decoded[0].toString(16)}, 0x${decoded[1].toString(16)}]. Only Ed25519 (0xed01) is supported.`);
  }

  const rawPub = decoded.subarray(2);
  const fullSpki = Buffer.concat([ED25519_SPKI_HEADER, Buffer.from(rawPub)]);
  const publicKey = crypto.createPublicKey({ key: fullSpki, format: 'der', type: 'spki' });

  return { rawPub, publicKey };
}

/**
 * Signs payload bytes using Ed25519 private key
 * Returns 86-char unpadded base64url signature string
 */
export function signBytes(payload: string | Uint8Array, privateKeyDer: Uint8Array): string {
  const privKeyObject = crypto.createPrivateKey({ key: Buffer.from(privateKeyDer), format: 'der', type: 'pkcs8' });
  const data = typeof payload === 'string' ? Buffer.from(payload, 'utf8') : Buffer.from(payload);
  const sig = crypto.sign(null, data, privKeyObject);
  // Unpadded base64url (86 chars for 64-byte Ed25519 signature)
  return sig.toString('base64url');
}

/**
 * Verifies Ed25519 signature for a did:key
 */
export function verifySignature(payload: string | Uint8Array, sigBase64url: string, did: string): boolean {
  try {
    const { publicKey } = parseDidKey(did);
    const data = typeof payload === 'string' ? Buffer.from(payload, 'utf8') : Buffer.from(payload);
    const sigBytes = Buffer.from(sigBase64url, 'base64url');
    if (sigBytes.length !== 64) {
      return false;
    }
    return crypto.verify(null, data, publicKey, sigBytes);
  } catch {
    return false;
  }
}
