/**
 * Technocore Agent Kit — Agent Registry
 * Distributed Agent Catalog with Capability Discovery & Cryptographic Identity over Technocore.
 * Built by Asad Lee (https://asad-lee-portfolio.vercel.app/)
 */

import type {
  AgentAdvertisement,
  AgentCapability,
  AgentRecord,
  AgentReputation,
  AgentRole,
} from '../types.js';
import type { NotesClient } from '../notes/notes.js';
import { getDidFingerprint } from '../identity/crypto.js';

export interface DiscoverAgentsFilter {
  capabilities?: AgentCapability[];
  role?: AgentRole;
  status?: 'online' | 'busy' | 'offline' | 'degraded';
  minReputationScore?: number;
}

const DEFAULT_REPUTATION: AgentReputation = {
  tasksCompleted: 0,
  tasksFailed: 0,
  verificationFailures: 0,
  averageResponseTimeMs: 0,
  successfulRetries: 0,
  reviewScore: 1.0,
  lastUpdated: new Date().toISOString(),
};

export class AgentRegistry {
  private readonly agents: Map<string, AgentRecord> = new Map();
  private readonly notesClient?: NotesClient;
  private readonly namespace = 'registry-agents';
  private readonly staleThresholdMs: number;

  constructor(options: {
    notesClient?: NotesClient;
    staleThresholdMs?: number;
  } = {}) {
    this.notesClient = options.notesClient;
    this.staleThresholdMs = options.staleThresholdMs || 120_000; // 2 minutes
  }

  /**
   * Registers or updates an agent in the registry.
   */
  public async registerAgent(ad: AgentAdvertisement): Promise<AgentRecord> {
    if (!ad.did.startsWith('did:key:')) {
      throw new Error(`Invalid agent DID format: '${ad.did}'. Must be a valid did:key.`);
    }

    const now = new Date().toISOString();
    const existing = this.agents.get(ad.did);

    const record: AgentRecord = {
      did: ad.did,
      name: ad.name || 'Unnamed Agent',
      role: ad.role || 'custom',
      capabilities: Array.from(new Set(ad.capabilities || [])),
      status: ad.status || 'online',
      version: ad.version || '1.0.0',
      mailbox: ad.mailbox,
      reputation: existing ? existing.reputation : { ...DEFAULT_REPUTATION, lastUpdated: now },
      lastHeartbeat: now,
      metadata: ad.metadata || {},
    };

    this.agents.set(ad.did, record);

    // Sync to Technocore KV storage if notes client is available
    if (this.notesClient) {
      try {
        const { fingerprint } = getDidFingerprint(ad.did);
        const payload = JSON.stringify({
          did: record.did,
          name: record.name,
          role: record.role,
          caps: record.capabilities.join(','),
          status: record.status,
          ver: record.version,
          score: record.reputation.reviewScore,
          hb: record.lastHeartbeat,
        });
        await this.notesClient.set(this.namespace, fingerprint, payload);
      } catch {
        // Local registry remains resilient even if remote KV sync encounters network latency
      }
    }

    return record;
  }

  /**
   * Discovers active agents matching the specified filter criteria.
   */
  public async discoverAgents(filter: DiscoverAgentsFilter = {}): Promise<AgentRecord[]> {
    const results: AgentRecord[] = [];
    const now = Date.now();

    for (const agent of this.agents.values()) {
      // Check freshness
      const hbTime = new Date(agent.lastHeartbeat).getTime();
      const isFresh = now - hbTime <= this.staleThresholdMs;
      const status = isFresh ? agent.status : 'offline';

      if (filter.status && status !== filter.status) {
        continue;
      }

      if (filter.role && agent.role !== filter.role) {
        continue;
      }

      if (
        filter.minReputationScore !== undefined &&
        agent.reputation.reviewScore < filter.minReputationScore
      ) {
        continue;
      }

      if (filter.capabilities && filter.capabilities.length > 0) {
        const hasAllCaps = filter.capabilities.every((cap) =>
          agent.capabilities.includes(cap)
        );
        if (!hasAllCaps) continue;
      }

      results.push({ ...agent, status });
    }

    return results;
  }

  /**
   * Resolves an agent by their DID.
   */
  public async resolveAgent(did: string): Promise<AgentRecord | null> {
    const local = this.agents.get(did);
    if (local) return local;

    if (this.notesClient) {
      try {
        const { fingerprint } = getDidFingerprint(did);
        const raw = await this.notesClient.get(this.namespace, fingerprint);
        if (raw) {
          const parsed = JSON.parse(raw);
          const record: AgentRecord = {
            did: parsed.did,
            name: parsed.name,
            role: parsed.role,
            capabilities: (parsed.caps || '').split(',').filter(Boolean),
            status: parsed.status || 'online',
            version: parsed.ver || '1.0.0',
            reputation: {
              ...DEFAULT_REPUTATION,
              reviewScore: parsed.score ?? 1.0,
            },
            lastHeartbeat: parsed.hb || new Date().toISOString(),
          };
          this.agents.set(did, record);
          return record;
        }
      } catch {
        return null;
      }
    }

    return null;
  }

  /**
   * Records a heartbeat for an active agent.
   */
  public heartbeat(did: string): boolean {
    const agent = this.agents.get(did);
    if (!agent) return false;

    agent.lastHeartbeat = new Date().toISOString();
    if (agent.status === 'offline') {
      agent.status = 'online';
    }
    return true;
  }

  /**
   * Updates an agent's capability list.
   */
  public updateCapabilities(did: string, capabilities: AgentCapability[]): boolean {
    const agent = this.agents.get(did);
    if (!agent) return false;

    agent.capabilities = Array.from(new Set(capabilities));
    agent.lastHeartbeat = new Date().toISOString();
    return true;
  }

  /**
   * Removes an agent from active registry.
   */
  public removeAgent(did: string): boolean {
    return this.agents.delete(did);
  }

  /**
   * Records a task execution outcome for agent reputation scoring.
   */
  public recordReputation(
    did: string,
    outcome: {
      success: boolean;
      latencyMs?: number;
      verificationPassed?: boolean;
    }
  ): void {
    const agent = this.agents.get(did);
    if (!agent) return;

    const rep = agent.reputation;
    const now = new Date().toISOString();

    if (outcome.success) {
      rep.tasksCompleted += 1;
    } else {
      rep.tasksFailed += 1;
    }

    if (outcome.verificationPassed === false) {
      rep.verificationFailures += 1;
    }

    if (outcome.latencyMs !== undefined && outcome.latencyMs > 0) {
      if (rep.averageResponseTimeMs === 0) {
        rep.averageResponseTimeMs = outcome.latencyMs;
      } else {
        rep.averageResponseTimeMs = Math.round(
          rep.averageResponseTimeMs * 0.8 + outcome.latencyMs * 0.2
        );
      }
    }

    const total = rep.tasksCompleted + rep.tasksFailed;
    if (total > 0) {
      const baseScore = rep.tasksCompleted / total;
      const penalty = rep.verificationFailures * 0.15;
      rep.reviewScore = Math.max(0.0, Math.min(1.0, baseScore - penalty));
    }

    rep.lastUpdated = now;
  }

  /**
   * Returns all currently known agents.
   */
  public getAllAgents(): AgentRecord[] {
    return Array.from(this.agents.values());
  }
}
