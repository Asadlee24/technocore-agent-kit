/**
 * Technocore Agent Kit — Structured Agent Memory
 * Scoped, signed, and CAS-conflict-protected persistent memory over Technocore.
 * Built by Asad Lee (https://asad-lee-portfolio.vercel.app/)
 */

import type { MemoryEntry, MemoryScope } from '../types.js';
import type { AgentIdentity } from '../identity/identity.js';
import type { NotesClient } from '../notes/notes.js';

export interface WriteMemoryResult {
  success: boolean;
  entry?: MemoryEntry;
  conflict?: boolean;
  currentVersion?: number;
  error?: string;
}

export class AgentMemory {
  private readonly store: Map<string, MemoryEntry> = new Map();
  private readonly notesClient?: NotesClient;

  constructor(options: { notesClient?: NotesClient } = {}) {
    this.notesClient = options.notesClient;
  }

  private compositeKey(scope: MemoryScope, namespace: string, key: string): string {
    return `${scope}::${namespace}::${key}`;
  }

  /**
   * Writes a value into structured memory with atomic version checking and cryptographic attribution.
   */
  public async write(
    scope: MemoryScope,
    namespace: string,
    key: string,
    value: any,
    ownerIdentity: AgentIdentity,
    options: { expectedVersion?: number } = {}
  ): Promise<WriteMemoryResult> {
    const compKey = this.compositeKey(scope, namespace, key);
    const existing = this.store.get(compKey);

    if (options.expectedVersion !== undefined) {
      const currentVer = existing ? existing.version : 0;
      if (currentVer !== options.expectedVersion) {
        return {
          success: false,
          conflict: true,
          currentVersion: currentVer,
          error: `Memory CAS conflict on '${compKey}': Expected version ${options.expectedVersion}, but current is ${currentVer}.`,
        };
      }
    }

    const nextVersion = existing ? existing.version + 1 : 1;
    const now = new Date().toISOString();

    const entry: MemoryEntry = {
      scope,
      namespace,
      key,
      value,
      version: nextVersion,
      timestamp: now,
      ownerDid: ownerIdentity.did,
    };

    // Sign memory entry payload
    const valString = typeof value === 'string' ? value : JSON.stringify(value);
    const sigEnvelope = ownerIdentity.signNote(
      `${scope}-${namespace}`,
      key,
      `v${nextVersion}:${valString}`,
      now
    );
    entry.signature = sigEnvelope.sig;

    this.store.set(compKey, entry);

    // Sync to Technocore KV if shared scope and notes client available
    if (this.notesClient && (scope === 'team' || scope === 'verified' || scope === 'workflow')) {
      try {
        const remoteNs = `mem-${scope}-${namespace}`;
        await this.notesClient.set(remoteNs, key, JSON.stringify(entry), {
          if: existing ? JSON.stringify(existing) : undefined,
          ifAbsent: !existing,
        });
      } catch {
        // Local memory remains responsive even during temporary network partition
      }
    }

    return {
      success: true,
      entry,
      currentVersion: nextVersion,
    };
  }

  /**
   * Reads a memory entry by scope, namespace, and key.
   */
  public async read(
    scope: MemoryScope,
    namespace: string,
    key: string
  ): Promise<MemoryEntry | null> {
    const compKey = this.compositeKey(scope, namespace, key);
    const local = this.store.get(compKey);
    if (local) return local;

    if (this.notesClient && (scope === 'team' || scope === 'verified' || scope === 'workflow')) {
      try {
        const remoteNs = `mem-${scope}-${namespace}`;
        const raw = await this.notesClient.get(remoteNs, key);
        if (raw) {
          const parsed = JSON.parse(raw) as MemoryEntry;
          this.store.set(compKey, parsed);
          return parsed;
        }
      } catch {
        return null;
      }
    }

    return null;
  }

  /**
   * Lists all memory entries under a given scope and namespace.
   */
  public list(scope: MemoryScope, namespace?: string): MemoryEntry[] {
    const prefix = namespace ? `${scope}::${namespace}::` : `${scope}::`;
    const results: MemoryEntry[] = [];

    for (const [k, v] of this.store.entries()) {
      if (k.startsWith(prefix)) {
        results.push(v);
      }
    }

    return results;
  }

  /**
   * Clears memory entries for a particular scope (e.g. at end of workflow).
   */
  public clearScope(scope: MemoryScope, namespace?: string): number {
    const prefix = namespace ? `${scope}::${namespace}::` : `${scope}::`;
    let count = 0;

    for (const k of Array.from(this.store.keys())) {
      if (k.startsWith(prefix)) {
        this.store.delete(k);
        count++;
      }
    }

    return count;
  }
}
