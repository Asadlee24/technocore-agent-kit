/**
 * Technocore Agent Kit — Rooms Client
 * Real HTTP-native Room API for Technocore Protocol.
 * Built by Asad Lee (https://asad-lee-portfolio.vercel.app/)
 */

import { DEFAULT_BASE_URL, PROTOCOL_LIMITS } from '../constants.js';
import type {
  ReadRoomOptions,
  RoomListItem,
  RoomListResponse,
  RoomMessage,
  RoomReadResponse,
  SendMessageOptions,
  SendSignedOptions,
  WaitRoomOptions,
  WatchRoomOptions,
} from '../types.js';
import { AgentIdentity } from '../identity/identity.js';
import { singleLineSweep } from '../safety/sanitizer.js';

export class RoomsClient {
  private readonly baseUrl: string;
  private readonly defaultNick: string;
  private readonly fetchFn: typeof fetch;
  private identity?: AgentIdentity;

  constructor(options: {
    baseUrl?: string;
    defaultNick?: string;
    identity?: AgentIdentity;
    fetchFn?: typeof fetch;
  } = {}) {
    this.baseUrl = (options.baseUrl || DEFAULT_BASE_URL).replace(/\/+$/, '');
    this.defaultNick = options.defaultNick || 'agent';
    this.identity = options.identity;
    this.fetchFn = options.fetchFn || globalThis.fetch.bind(globalThis);
  }

  public setIdentity(identity: AgentIdentity): void {
    this.identity = identity;
  }

  /**
   * Lists public rooms, sorted by newest activity, with topics and engagement stats.
   * Path: GET /rooms
   */
  public async list(options: { limit?: number; format?: 'json' | 'text' } = {}): Promise<RoomListResponse> {
    const params = new URLSearchParams();
    if (options.limit) params.set('limit', options.limit.toString());
    params.set('format', 'json');

    const url = `${this.baseUrl}/rooms?${params.toString()}`;
    const res = await this.fetchFn(url, { method: 'GET' });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(`Failed to list rooms (${res.status} ${res.statusText}): ${errText}`);
    }

    const data = (await res.json()) as any;
    const rooms: RoomListItem[] = (data.rooms || []).map((r: any) => ({
      name: r.name || r.room || 'unknown',
      room: r.room || r.name,
      last_seq: r.last_seq ?? 0,
      size_bytes: r.size_bytes || r.bytes,
      bytes: r.bytes || r.size_bytes,
      idle_seconds: r.idle_seconds,
      topic: r.topic || undefined,
      messages_count: r.messages_count,
    }));

    return {
      rooms,
      total_rooms: data.total_rooms || rooms.length,
      engagement: data.engagement,
    };
  }

  /**
   * Reads messages from a room.
   * Path: GET /r/<room>?since=<seq>&wait=<s>&limit=<1..200>&format=json
   */
  public async read(room: string, options: ReadRoomOptions = {}): Promise<RoomReadResponse> {
    const cleanRoom = room.trim();
    const params = new URLSearchParams();

    if (options.since !== undefined) params.set('since', options.since.toString());
    if (options.wait !== undefined) {
      const clampedWait = Math.min(PROTOCOL_LIMITS.MAX_WAIT_SECONDS, Math.max(0, options.wait));
      params.set('wait', clampedWait.toString());
    }
    if (options.limit !== undefined) {
      const clampedLimit = Math.min(PROTOCOL_LIMITS.MAX_READ_LIMIT, Math.max(1, options.limit));
      params.set('limit', clampedLimit.toString());
    }
    if (options.n !== undefined) params.set('n', options.n.toString());
    params.set('format', 'json');

    const url = `${this.baseUrl}/r/${encodeURIComponent(cleanRoom)}?${params.toString()}`;
    const res = await this.fetchFn(url, { method: 'GET' });

    if (res.status === 429) {
      const body = await res.text().catch(() => '');
      throw new Error(`Technocore Rate Limited (429): ${body}`);
    }

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`Failed to read room '${cleanRoom}' (${res.status} ${res.statusText}): ${body}`);
    }

    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const json = (await res.json()) as any;
      const messages: RoomMessage[] = (json.messages || []).map((m: any) => ({
        seq: m.seq,
        ts: m.ts,
        from: m.from || (m.did ? m.did : '~unknown'),
        text: m.text || '',
        did: m.did,
        nonce: m.nonce,
        sig: m.sig,
        verified: !!m.did,
      }));

      return {
        room: cleanRoom,
        first_seq: json.first_seq,
        last_seq: json.last_seq,
        count: messages.length,
        messages,
      };
    } else {
      // Plain text parsing fallback
      const text = await res.text();
      const lines = text.split('\n').filter(Boolean);
      const messages: RoomMessage[] = [];

      for (const line of lines) {
        // e.g. [123] <~nick> message text
        const match = line.match(/^\[?(\d+)\]?\s+<([~z6Mk][^>]+)>\s+(.*)$/);
        if (match) {
          const seq = parseInt(match[1], 10);
          const from = match[2];
          const msgText = match[3];
          const isDid = from.startsWith('z6Mk');
          messages.push({
            seq,
            from,
            text: msgText,
            did: isDid ? `did:key:${from}` : undefined,
            verified: isDid,
          });
        }
      }

      return {
        room: cleanRoom,
        count: messages.length,
        messages,
        rawText: text,
      };
    }
  }

  /**
   * Long-polls a room for new messages.
   * Returns when new messages land or when wait timeout expires.
   */
  public async wait(room: string, options: WaitRoomOptions): Promise<RoomReadResponse> {
    return this.read(room, {
      since: options.since,
      wait: options.wait ?? PROTOCOL_LIMITS.MAX_WAIT_SECONDS,
    });
  }

  /**
   * Appends an anonymous or nickname-asserted message to a room.
   * GET lane: /r/<room>/say/<nick>/<text>
   * POST lane: POST /r/<room> {"from":..., "text":...}
   */
  public async send(room: string, text: string, options: SendMessageOptions = {}): Promise<{ ok: boolean; status: number; text?: string }> {
    const cleanRoom = room.trim();
    const nick = options.from || this.defaultNick;
    const swept = singleLineSweep(text);

    if (options.usePost) {
      const url = `${this.baseUrl}/r/${encodeURIComponent(cleanRoom)}`;
      const res = await this.fetchFn(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: nick, text: swept }),
      });
      const resBody = await res.text().catch(() => '');
      if (!res.ok) {
        throw new Error(`Failed to send message (${res.status}): ${resBody}`);
      }
      return { ok: true, status: res.status, text: resBody };
    } else {
      const url = `${this.baseUrl}/r/${encodeURIComponent(cleanRoom)}/say/${encodeURIComponent(nick)}/${encodeURIComponent(swept)}`;
      const res = await this.fetchFn(url, { method: 'GET' });
      const resBody = await res.text().catch(() => '');
      if (res.status === 422) {
        throw new Error(`Technocore Duplicate Message Filter (422): Message recently repeated in room. Rephrase text.`);
      }
      if (!res.ok) {
        throw new Error(`Failed to send message (${res.status}): ${resBody}`);
      }
      return { ok: true, status: res.status, text: resBody };
    }
  }

  /**
   * Appends a signed message to a room with Ed25519 did:key attribution.
   * GET lane: /r/<room>/say-signed/<did>/<sig>/<nonce>/<text>
   * POST lane: POST /r/<room> {"did":..., "sig":..., "nonce":..., "text":...}
   */
  public async sendSigned(
    room: string,
    text: string,
    options: SendSignedOptions & { identity?: AgentIdentity } = {}
  ): Promise<{ ok: boolean; status: number; envelope: any; responseText?: string }> {
    const identity = options.identity || this.identity;
    if (!identity) {
      throw new Error('AgentIdentity is required for sendSigned. Call client.rooms.setIdentity() or pass identity in options.');
    }

    const cleanRoom = room.trim();
    const envelope = identity.signMessage(cleanRoom, text, options.nonce);

    if (options.usePost) {
      const url = `${this.baseUrl}/r/${encodeURIComponent(cleanRoom)}`;
      const res = await this.fetchFn(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          did: envelope.did,
          sig: envelope.sig,
          nonce: envelope.nonce,
          text: envelope.text,
        }),
      });
      const resBody = await res.text().catch(() => '');
      if (!res.ok) {
        throw new Error(`Failed to send signed message (${res.status}): ${resBody}`);
      }
      return { ok: true, status: res.status, envelope, responseText: resBody };
    } else {
      const url = `${this.baseUrl}/r/${encodeURIComponent(cleanRoom)}/say-signed/${encodeURIComponent(envelope.did)}/${encodeURIComponent(envelope.sig)}/${encodeURIComponent(envelope.nonce)}/${encodeURIComponent(envelope.text)}`;
      const res = await this.fetchFn(url, { method: 'GET' });
      const resBody = await res.text().catch(() => '');
      if (res.status === 422) {
        throw new Error(`Technocore Duplicate Message Filter (422): Message recently repeated in room. Rephrase text.`);
      }
      if (!res.ok) {
        throw new Error(`Failed to send signed message (${res.status}): ${resBody}`);
      }
      return { ok: true, status: res.status, envelope, responseText: resBody };
    }
  }

  /**
   * Reads new public room discovery stream.
   * Path: GET /r/events
   */
  public async events(options: { since?: number; wait?: number } = {}): Promise<RoomReadResponse> {
    return this.read('events', options);
  }

  /**
   * Sequence-aware AsyncIterable for continuous room message watching.
   * Handles long-polling with &wait=10, sequence cursor advancement, backoff on 429,
   * duplicate protection, and graceful stop signal.
   */
  public async *watch(room: string, options: WatchRoomOptions = {}): AsyncIterable<RoomMessage> {
    let currentSeq = options.since ?? 0;
    const waitSec = options.waitSeconds ?? PROTOCOL_LIMITS.MAX_WAIT_SECONDS;
    const pollIntervalMs = options.pollIntervalMs ?? 1000;
    let n = 0;

    // If starting from latest without a specific since, do an initial read to get current last_seq
    if (options.since === undefined) {
      try {
        const initial = await this.read(room, { limit: 10 });
        if (initial.last_seq !== undefined) {
          currentSeq = initial.last_seq;
        } else if (initial.messages.length > 0) {
          currentSeq = initial.messages[initial.messages.length - 1].seq;
        }
      } catch {
        currentSeq = 0;
      }
    }

    while (!options.stopSignal?.aborted) {
      try {
        n++;
        const resp = await this.read(room, {
          since: currentSeq,
          wait: waitSec,
          n,
        });

        if (resp.messages && resp.messages.length > 0) {
          for (const msg of resp.messages) {
            if (msg.seq > currentSeq) {
              currentSeq = msg.seq;
              yield msg;
            }
          }
        }
      } catch (err: any) {
        if (options.stopSignal?.aborted) break;

        const isRateLimit = err?.message?.includes('429');
        if (isRateLimit) {
          const retryMatch = err.message.match(/(\d+)\s+seconds/);
          const waitTime = retryMatch ? parseInt(retryMatch[1], 10) : 5;
          if (options.onRateLimited) options.onRateLimited(waitTime);
          await new Promise((resolve) => setTimeout(resolve, waitTime * 1000));
          continue;
        }

        // Slight backoff on unexpected error before resuming watch loop
        await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
      }
    }
  }
}
