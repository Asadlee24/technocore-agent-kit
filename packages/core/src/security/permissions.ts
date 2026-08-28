/**
 * Technocore Agent Kit — Security Policy & Capability Permissions
 * Enforces least-privilege capability boundaries and risk evaluation.
 * Built by Asad Lee (https://asad-lee-portfolio.vercel.app/)
 */

import type { AgentCapability, AgentPermissions, AgentRecord, AgentRole } from '../types.js';

export const ROLE_DEFAULT_PERMISSIONS: Record<AgentRole, AgentPermissions> = {
  planner: {
    allowedCapabilities: ['planning', 'summarization'],
    forbiddenCapabilities: ['deploy', 'edit-code', 'access-secrets', 'destructive-ops'],
    canDeploy: false,
    canAccessSecrets: false,
    canRunDestructiveOps: false,
    maxWorkload: 10,
  },
  researcher: {
    allowedCapabilities: ['web-research', 'summarization', 'memory-management'],
    forbiddenCapabilities: ['deploy', 'edit-code', 'access-secrets', 'destructive-ops'],
    canDeploy: false,
    canAccessSecrets: false,
    canRunDestructiveOps: false,
    maxWorkload: 5,
  },
  coder: {
    allowedCapabilities: ['edit-code', 'test-code', 'calculate', 'summarization', 'memory-management'],
    forbiddenCapabilities: ['deploy', 'access-secrets', 'modify-security-policy'],
    canDeploy: false,
    canAccessSecrets: false,
    canRunDestructiveOps: false,
    maxWorkload: 3,
  },
  tester: {
    allowedCapabilities: ['test-code', 'calculate', 'summarization'],
    forbiddenCapabilities: ['deploy', 'edit-code', 'access-secrets', 'destructive-ops'],
    canDeploy: false,
    canAccessSecrets: false,
    canRunDestructiveOps: false,
    maxWorkload: 5,
  },
  security_reviewer: {
    allowedCapabilities: ['security-audit', 'code-review', 'summarization'],
    forbiddenCapabilities: ['deploy', 'edit-code', 'access-secrets', 'destructive-ops'],
    canDeploy: false,
    canAccessSecrets: false,
    canRunDestructiveOps: false,
    maxWorkload: 5,
  },
  final_reviewer: {
    allowedCapabilities: ['code-review', 'summarization'],
    forbiddenCapabilities: ['deploy', 'access-secrets', 'destructive-ops'],
    canDeploy: false,
    canAccessSecrets: false,
    canRunDestructiveOps: false,
    maxWorkload: 5,
  },
  deployer: {
    allowedCapabilities: ['deploy', 'summarization'],
    forbiddenCapabilities: ['access-secrets', 'modify-security-policy'],
    canDeploy: true,
    canAccessSecrets: false,
    canRunDestructiveOps: false,
    maxWorkload: 2,
  },
  controller: {
    allowedCapabilities: ['planning', 'summarization', 'code-review'],
    forbiddenCapabilities: ['access-secrets'],
    canDeploy: false,
    canAccessSecrets: false,
    canRunDestructiveOps: false,
    maxWorkload: 20,
  },
  custom: {
    allowedCapabilities: [],
    forbiddenCapabilities: ['access-secrets', 'destructive-ops'],
    canDeploy: false,
    canAccessSecrets: false,
    canRunDestructiveOps: false,
    maxWorkload: 5,
  },
};

const HIGH_RISK_ACTION_PATTERNS = [
  /git\s+push/i,
  /deploy|production|release|publish\s+package/i,
  /database\s+migration|drop\s+table|delete\s+from/i,
  /rm\s+-rf|unlink|delete-all|format\s+drive/i,
  /access[_\s-]+secrets?|reveal[_\s-]+api[_\s-]?key|leak[_\s-]+credentials?/i,
  /payment|financial\s+transfer|charge\s+credit\s+card|billing\s+charge/i,
];

export class PermissionGuard {
  /**
   * Validates if an agent is authorized to execute an action or capability.
   */
  public static isActionAllowed(
    agent: AgentRecord,
    capability: AgentCapability
  ): { allowed: boolean; reason?: string } {
    const rolePerms = ROLE_DEFAULT_PERMISSIONS[agent.role] || ROLE_DEFAULT_PERMISSIONS.custom;

    // Check if explicitly forbidden for role
    if (rolePerms.forbiddenCapabilities.includes(capability)) {
      return {
        allowed: false,
        reason: `Capability '${capability}' is forbidden for agent role '${agent.role}'.`,
      };
    }

    // Check if agent declared capability
    if (!agent.capabilities.includes(capability)) {
      return {
        allowed: false,
        reason: `Agent '${agent.name}' (${agent.did}) has not declared capability '${capability}'.`,
      };
    }

    return { allowed: true };
  }

  /**
   * Evaluates the risk tier for a proposed task or action payload.
   */
  public static assessRisk(action: string, payload?: any): 'low' | 'medium' | 'high' | 'critical' {
    const payloadStr = typeof payload === 'string' ? payload : JSON.stringify(payload || '');
    const combined = `${action} ${payloadStr}`;

    for (const pattern of HIGH_RISK_ACTION_PATTERNS) {
      if (pattern.test(combined)) {
        if (/rm\s+-rf|drop\s+table|delete-all|financial|payment/i.test(combined)) {
          return 'critical';
        }
        return 'high';
      }
    }

    if (/write|update|edit|modify/i.test(action)) {
      return 'medium';
    }

    return 'low';
  }

  /**
   * Checks if an action strictly requires human operator approval before execution.
   */
  public static requiresHumanApproval(action: string, payload?: any): boolean {
    const risk = this.assessRisk(action, payload);
    return risk === 'high' || risk === 'critical';
  }
}
