/**
 * Technocore Agent Kit — Capability-Based Task Router
 * Routes tasks to verified agents based on capabilities, status, workload, and reputation.
 * Built by Asad Lee (https://asad-lee-portfolio.vercel.app/)
 */

import type {
  AgentCapability,
  AgentRecord,
  TaskDefinition,
} from '../types.js';
import type { AgentRegistry } from '../registry/registry.js';

export interface RouteTaskOptions {
  excludeDids?: string[];
  minReputationScore?: number;
  preferRole?: string;
}

export class TaskRouter {
  private readonly registry: AgentRegistry;
  private readonly activeWorkloads: Map<string, number> = new Map();

  constructor(registry: AgentRegistry) {
    this.registry = registry;
  }

  /**
   * Routes a task to the most suitable available agent.
   */
  public async routeTask(
    task: TaskDefinition,
    options: RouteTaskOptions = {}
  ): Promise<AgentRecord> {
    const candidates = await this.registry.discoverAgents({
      capabilities: task.requiredCapabilities,
      status: 'online',
      minReputationScore: options.minReputationScore ?? 0.0,
    });

    const eligible = candidates.filter((agent) => {
      if (options.excludeDids?.includes(agent.did)) return false;
      return true;
    });

    if (eligible.length === 0) {
      throw new Error(
        `No eligible agent found for task '${task.taskId}' requiring capabilities: [${task.requiredCapabilities.join(', ')}].`
      );
    }

    // Score candidates based on:
    // 1. Reputation score (0.0 to 1.0) -> weight 40
    // 2. Lowest current workload -> weight 30
    // 3. Exact role preference match -> weight 20
    // 4. Lowest response time -> weight 10
    const scored = eligible.map((agent) => {
      const workload = this.activeWorkloads.get(agent.did) || 0;
      const repScore = agent.reputation.reviewScore;
      const roleMatch = options.preferRole && agent.role === options.preferRole ? 1.0 : 0.5;
      const latencyScore = agent.reputation.averageResponseTimeMs > 0
        ? Math.max(0, 1.0 - agent.reputation.averageResponseTimeMs / 10000)
        : 0.8;
      const workloadPenalty = Math.min(1.0, workload * 0.2);

      const totalScore =
        repScore * 40 +
        (1.0 - workloadPenalty) * 30 +
        roleMatch * 20 +
        latencyScore * 10;

      return { agent, totalScore, workload };
    });

    scored.sort((a, b) => b.totalScore - a.totalScore);
    const chosen = scored[0].agent;

    this.recordTaskAssigned(chosen.did);
    return chosen;
  }

  /**
   * Increments active task count for an agent.
   */
  public recordTaskAssigned(agentDid: string): void {
    const current = this.activeWorkloads.get(agentDid) || 0;
    this.activeWorkloads.set(agentDid, current + 1);
  }

  /**
   * Decrements active task count for an agent.
   */
  public recordTaskFinished(agentDid: string): void {
    const current = this.activeWorkloads.get(agentDid) || 0;
    if (current <= 1) {
      this.activeWorkloads.delete(agentDid);
    } else {
      this.activeWorkloads.set(agentDid, current - 1);
    }
  }

  /**
   * Gets current workload count for an agent.
   */
  public getActiveWorkload(agentDid: string): number {
    return this.activeWorkloads.get(agentDid) || 0;
  }
}
