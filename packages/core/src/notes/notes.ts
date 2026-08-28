/**
 * Technocore Agent Kit — Notes Client
 * Real HTTP-native Key-Value Notes API for Technocore Protocol.
 * Built by Asad Lee (https://asad-lee-portfolio.vercel.app/)
 */

import { DEFAULT_BASE_URL } from '../constants.js';
import type { PublishDidOptions, ResolvedDidRecord, SetNoteOptions, SetSignedNoteOptions } from '../types.js';
import { AgentIdentity } from '../identity/identity.js';
import { getDidFingerprint } from '../identity/crypto.js';
import { singleLineSweep } from '../safety/sanitizer.js';

export class NotesClient {
  private readonly baseUrl: string;
  private readonly fetchFn: typeof fetch;
  private identity?: AgentIdentity;

  constructor(options: {
    baseUrl?: string;
    identity?: AgentIdentity;
    fetchFn?: typeof fetch;
  } = {}) {
    this.baseUrl = (options.baseUrl || DEFAULT_BASE_URL).replace(/\/+$/, '');
    this.identity = options.identity;
    this.fetchFn = options.fetchFn || globalThis.fetch.bind(globalThis);
  }

  public setIdentity(identity: AgentIdentity): void {
    this.identity = identity;
  }

  /**
   * Reads a persisted note.
   * Path: GET /kv/<ns>/<key>
   */
  public async get(namespace: string, key: string): Promise<string | null> {
    const url = `${this.baseUrl}/kv/${encodeURIComponent(namespace)}/${encodeURIComponent(key)}`;
    const res = await this.fetchFn(url, { method: 'GET' });

    if (res.status === 404) {
      return null;
    }

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(`Failed to read note '${namespace}/${key}' (${res.status}): ${errText}`);
    }

    return await res.text();
  }

  /**
   * Writes a note, optionally with compare-and-swap (CAS) conditions:
   * ?if=<expected> or ?if_absent=1
   * Path: GET /kv/<ns>/<key>/set/<value> or POST /kv/<ns>/<key>
   */
  public async set(
    namespace: string,
    key: string,
    value: string,
    options: SetNoteOptions = {}
  ): Promise<{ ok: boolean; status: number; currentValueOnConflict?: string }> {
    const swept = singleLineSweep(value);

    if (options.usePost) {
      const url = `${this.baseUrl}/kv/${encodeURIComponent(namespace)}/${encodeURIComponent(key)}`;
      const payload: Record<string, any> = { value: swept };
      if (options.if !== undefined) payload.if = options.if;
      if (options.ifAbsent) payload.if_absent = true;

      const res = await this.fetchFn(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.status === 409) {
        const currentVal = await res.text().catch(() => '');
        return { ok: false, status: 409, currentValueOnConflict: currentVal };
      }

      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        throw new Error(`Failed to write note '${namespace}/${key}' (${res.status}): ${errText}`);
      }

      return { ok: true, status: res.status };
    } else {
      const params = new URLSearchParams();
      if (options.if !== undefined) params.set('if', options.if);
      if (options.ifAbsent) params.set('if_absent', '1');

      const queryStr = params.toString() ? `?${params.toString()}` : '';
      const url = `${this.baseUrl}/kv/${encodeURIComponent(namespace)}/${encodeURIComponent(key)}/set/${encodeURIComponent(swept)}${queryStr}`;
      const res = await this.fetchFn(url, { method: 'GET' });

      if (res.status === 409) {
        const currentVal = await res.text().catch(() => '');
        return { ok: false, status: 409, currentValueOnConflict: currentVal };
      }

      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        throw new Error(`Failed to write note '${namespace}/${key}' (${res.status}): ${errText}`);
      }

      return { ok: true, status: res.status };
    }
  }

  /**
   * Writes a signed note (allowed only for room-owners and room-allow namespaces).
   * Path: GET /kv/<ns>/<key>/set-signed/<did>/<sig>/<nonce>/<value>
   */
  public async setSigned(
    namespace: string,
    key: string,
    value: string,
    options: SetSignedNoteOptions & { identity?: AgentIdentity } = {}
  ): Promise<{ ok: boolean; status: number; envelope: any }> {
    const identity = options.identity || this.identity;
    if (!identity) {
      throw new Error('AgentIdentity is required for setSigned.');
    }

    const nonce = options.nonce ?? Date.now().toString();
    const envelope = identity.signNote(namespace, key, value, nonce);

    const url = `${this.baseUrl}/kv/${encodeURIComponent(namespace)}/${encodeURIComponent(key)}/set-signed/${encodeURIComponent(envelope.did)}/${encodeURIComponent(envelope.sig)}/${encodeURIComponent(envelope.nonce)}/${encodeURIComponent(envelope.value)}`;
    const res = await this.fetchFn(url, { method: 'GET' });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(`Failed to write signed note '${namespace}/${key}' (${res.status}): ${errText}`);
    }

    return { ok: true, status: res.status, envelope };
  }

  /**
   * Lists all keys in a given namespace.
   * Path: GET /kv/<ns>
   */
  public async list(namespace: string): Promise<string[]> {
    const url = `${this.baseUrl}/kv/${encodeURIComponent(namespace)}`;
    const res = await this.fetchFn(url, { method: 'GET' });

    if (res.status === 404) {
      return [];
    }

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(`Failed to list namespace '${namespace}' (${res.status}): ${errText}`);
    }

    const text = await res.text();
    return text.split('\n').map((l) => l.trim()).filter(Boolean);
  }

  /**
   * Publishes agent DID note to the standard sharded path: /kv/did-<shard>/<key>
   * Format: <did:key z6Mk...> [x25519:<pub>] [mailbox:<room>] ...
   */
  public async publishDid(
    identity?: AgentIdentity,
    options: PublishDidOptions = {}
  ): Promise<{ path: string; record: string }> {
    const activeIdentity = identity || this.identity;
    if (!activeIdentity) {
      throw new Error('AgentIdentity is required to publish DID.');
    }

    const parts: string[] = [activeIdentity.did];
    if (options.x25519Pub) parts.push(`x25519:${options.x25519Pub}`);
    if (options.mailbox) parts.push(`mailbox:${options.mailbox}`);
    if (options.extra) {
      for (const [k, v] of Object.entries(options.extra)) {
        parts.push(`${k}:${v}`);
      }
    }

    const record = parts.join(' ');
    const { shard, key } = activeIdentity;
    const namespace = `did-${shard}`;

    await this.set(namespace, key, record);

    return {
      path: `kv/${namespace}/${key}`,
      record,
    };
  }

  /**
   * Resolves an agent DID note by trying the sharded path (/kv/did-<shard>/<key>)
   * then falling back to the legacy /kv/did/<fingerprint> path.
   */
  public async resolveDid(didOrFingerprint: string): Promise<ResolvedDidRecord | null> {
    let shard: string;
    let key: string;
    let fingerprint: string;

    if (didOrFingerprint.startsWith('did:key:')) {
      const fp = getDidFingerprint(didOrFingerprint);
      shard = fp.shard;
      key = fp.key;
      fingerprint = fp.fingerprint;
    } else {
      fingerprint = didOrFingerprint.toLowerCase().trim();
      shard = fingerprint.substring(0, 2);
      key = fingerprint.substring(2, 16);
    }

    // Try sharded path first
    let raw = await this.get(`did-${shard}`, key);

    // Fall back to legacy /kv/did/<fingerprint>
    if (!raw) {
      raw = await this.get('did', fingerprint);
    }

    if (!raw) {
      return null;
    }

    const tokens = raw.split(/\s+/).filter(Boolean);
    let resolvedDid = '';
    let x25519Pub: string | undefined;
    let mailbox: string | undefined;
    const metadata: Record<string, string> = {};

    for (const token of tokens) {
      if (token.startsWith('did:key:')) {
        resolvedDid = token;
      } else if (token.startsWith('x25519:')) {
        x25519Pub = token.substring(7);
      } else if (token.startsWith('mailbox:')) {
        mailbox = token.substring(8);
      } else if (token.includes(':')) {
        const [k, ...v] = token.split(':');
        metadata[k] = v.join(':');
      }
    }

    return {
      did: resolvedDid || `did:key:${tokens[0]}`,
      fingerprint,
      rawText: raw,
      x25519Pub,
      mailbox,
      metadata,
    };
  }
}
