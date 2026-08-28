/**
 * Technocore Agent Kit — Observability Event Stream
 * Cryptographically verifiable event stream and real-time subscription bus.
 * Built by Asad Lee (https://asad-lee-portfolio.vercel.app/)
 */

import * as crypto from 'node:crypto';
import type { EventType, OrchestratorEvent } from '../types.js';
import type { AgentIdentity } from '../identity/identity.js';

export type EventListener = (event: OrchestratorEvent) => void;

export class OrchestratorEventStream {
  private readonly events: OrchestratorEvent[] = [];
  private readonly listeners: Map<string, Set<EventListener>> = new Map();
  private readonly allListeners: Set<EventListener> = new Set();
  private seqCounter = 0;

  /**
   * Emits an orchestrator event and notifies all registered subscribers.
   */
  public emit(
    type: EventType,
    payload: any,
    options: {
      workflowId?: string;
      taskId?: string;
      agentDid?: string;
      actorDid?: string;
      signerIdentity?: AgentIdentity;
    } = {}
  ): OrchestratorEvent {
    this.seqCounter++;
    const now = new Date().toISOString();
    const id = `evt-${this.seqCounter}-${crypto.randomBytes(3).toString('hex')}`;

    let signature: string | undefined;
    if (options.signerIdentity) {
      const payloadStr = typeof payload === 'string' ? payload : JSON.stringify(payload);
      const textToSign = `${id}|${type}|${now}|${payloadStr}`;
      signature = options.signerIdentity.signMessage('event-stream', textToSign).sig;
    }

    const event: OrchestratorEvent = {
      id,
      seq: this.seqCounter,
      type,
      timestamp: now,
      workflowId: options.workflowId,
      taskId: options.taskId,
      agentDid: options.agentDid,
      actorDid: options.actorDid,
      payload,
      signature,
    };

    this.events.push(event);

    // Notify specific type listeners
    const typed = this.listeners.get(type);
    if (typed) {
      for (const listener of typed) {
        try {
          listener(event);
        } catch {
          // Keep stream resilient
        }
      }
    }

    // Notify global subscribers
    for (const listener of this.allListeners) {
      try {
        listener(event);
      } catch {
        // Keep stream resilient
      }
    }

    return event;
  }

  /**
   * Subscribes to events of a specific type. Returns unsubscribe function.
   */
  public on(type: EventType, listener: EventListener): () => void {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set());
    }
    this.listeners.get(type)!.add(listener);

    return () => {
      this.listeners.get(type)?.delete(listener);
    };
  }

  /**
   * Subscribes to all events in the stream. Returns unsubscribe function.
   */
  public subscribeAll(listener: EventListener): () => void {
    this.allListeners.add(listener);
    return () => {
      this.allListeners.delete(listener);
    };
  }

  /**
   * Reads events since a specific sequence number or with filter.
   */
  public getEvents(options: {
    sinceSeq?: number;
    limit?: number;
    type?: EventType;
    workflowId?: string;
  } = {}): OrchestratorEvent[] {
    let filtered = this.events;

    if (options.sinceSeq !== undefined) {
      filtered = filtered.filter((e) => e.seq > options.sinceSeq!);
    }

    if (options.type) {
      filtered = filtered.filter((e) => e.type === options.type);
    }

    if (options.workflowId) {
      filtered = filtered.filter((e) => e.workflowId === options.workflowId);
    }

    if (options.limit && options.limit > 0) {
      filtered = filtered.slice(-options.limit);
    }

    return filtered;
  }

  /**
   * Clears event history (useful in test teardowns).
   */
  public clear(): void {
    this.events.length = 0;
    this.seqCounter = 0;
  }
}
