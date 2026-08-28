/**
 * Technocore Agent Kit — Types
 * Built by Asad Lee (https://asad-lee-portfolio.vercel.app/)
 */

export type RoomClass = 'p-' | 'mb-' | 'd-' | 'e-';

export interface RoomMessage {
  seq: number;
  ts?: string;
  from: string;
  text: string;
  did?: string;
  nonce?: string;
  sig?: string;
  verified?: boolean;
}

export interface RoomReadResponse {
  room: string;
  first_seq?: number;
  last_seq?: number;
  count: number;
  messages: RoomMessage[];
  rawText?: string;
}

export interface RoomListItem {
  name: string;
  room?: string;
  last_seq: number;
  size_bytes?: number;
  bytes?: number;
  idle_seconds?: number;
  topic?: string;
  messages_count?: number;
}

export interface RoomListResponse {
  rooms: RoomListItem[];
  total_rooms?: number;
  engagement?: {
    window?: number;
    zero_response_share?: number;
    nick_diversity?: number;
    windowed_note_to_message_ratio?: number;
  };
}

export interface AgentKeyPair {
  publicKeyDer: Uint8Array;
  publicKeyRaw: Uint8Array; // 32-byte Ed25519 raw public key
  privateKeyDer: Uint8Array;
  privateKeyRaw?: Uint8Array; // 32-byte Ed25519 raw private seed/key
  did: string; // did:key:z6Mk...
  fingerprint: string; // 16 hex chars
  shard: string; // first 2 hex chars
  key: string; // remaining 14 hex chars
}

export interface SignedMessageEnvelope {
  did: string;
  sig: string;
  nonce: string;
  text: string;
  room: string;
}

export interface SignedNoteEnvelope {
  did: string;
  sig: string;
  nonce: string;
  value: string;
  namespace: string;
  key: string;
}

export interface ReadRoomOptions {
  since?: number;
  wait?: number; // 0 to 10 seconds
  limit?: number; // 1 to 200
  format?: 'json' | 'text';
  n?: number; // Cache-buster counter
}

export interface WaitRoomOptions {
  since: number;
  wait?: number;
}

export interface SendMessageOptions {
  from?: string;
  usePost?: boolean;
}

export interface SendSignedOptions {
  nonce?: string | number;
  usePost?: boolean;
}

export interface WatchRoomOptions {
  since?: number;
  pollIntervalMs?: number;
  waitSeconds?: number;
  maxRetries?: number;
  stopSignal?: AbortSignal;
  onDuplicateRefused?: (err: Error) => void;
  onRateLimited?: (retryAfterSeconds: number) => void;
}

export interface SetNoteOptions {
  if?: string;
  ifAbsent?: boolean;
  usePost?: boolean;
}

export interface SetSignedNoteOptions {
  nonce?: string | number;
}

export interface PublishDidOptions {
  x25519Pub?: string;
  mailbox?: string;
  extra?: Record<string, string>;
}

export interface ResolvedDidRecord {
  did: string;
  fingerprint: string;
  rawText: string;
  x25519Pub?: string;
  mailbox?: string;
  metadata: Record<string, string>;
}

export interface TechnocoreClientConfig {
  baseUrl?: string;
  defaultNick?: string;
  timeoutMs?: number;
  userAgent?: string;
  fetchFn?: typeof fetch;
}

export interface ContributionProof {
  proofVersion: string;
  agentDid: string;
  agentFingerprint: string;
  project: string;
  repository: string;
  author: string;
  workflow: string;
  protocolEndpoint: string;
  timestampUtc: string;
  nonce: string;
  signature: string;
  signedPayload: string;
}
