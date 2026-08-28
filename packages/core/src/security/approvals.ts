/**
 * Technocore Agent Kit — Human Approval Engine
 * Interactive and programmatic approval gates for high-risk autonomous actions.
 * Built by Asad Lee (https://asad-lee-portfolio.vercel.app/)
 */

import * as crypto from 'node:crypto';
import type { ApprovalRequest } from '../types.js';

export class HumanApprovalEngine {
  private readonly requests: Map<string, ApprovalRequest> = new Map();
  private readonly listeners: Map<string, Array<(req: ApprovalRequest) => void>> = new Map();

  /**
   * Enqueues a new human approval request for a high-risk operation.
   */
  public requestApproval(options: {
    taskId: string;
    workflowId: string;
    agentDid: string;
    action: string;
    description: string;
    riskLevel?: 'medium' | 'high' | 'critical';
    details?: Record<string, any>;
  }): ApprovalRequest {
    const id = `apr-${crypto.randomBytes(4).toString('hex')}`;
    const req: ApprovalRequest = {
      id,
      taskId: options.taskId,
      workflowId: options.workflowId,
      agentDid: options.agentDid,
      action: options.action,
      description: options.description,
      riskLevel: options.riskLevel || 'high',
      details: options.details || {},
      status: 'PENDING',
      requestedAt: new Date().toISOString(),
    };

    this.requests.set(id, req);
    return req;
  }

  /**
   * Lists all currently pending approval requests.
   */
  public listPending(): ApprovalRequest[] {
    return Array.from(this.requests.values()).filter((r) => r.status === 'PENDING');
  }

  /**
   * Lists all approval requests regardless of status.
   */
  public listAll(): ApprovalRequest[] {
    return Array.from(this.requests.values());
  }

  /**
   * Resolves an approval request by its ID.
   */
  public getApproval(id: string): ApprovalRequest | null {
    return this.requests.get(id) || null;
  }

  /**
   * Approves a pending request.
   */
  public approve(id: string, decider = 'human-operator', reason?: string): ApprovalRequest {
    const req = this.requests.get(id);
    if (!req) {
      throw new Error(`Approval request '${id}' not found.`);
    }
    if (req.status !== 'PENDING') {
      throw new Error(`Approval request '${id}' is already resolved with status '${req.status}'.`);
    }

    req.status = 'APPROVED';
    req.decidedAt = new Date().toISOString();
    req.decidedBy = decider;
    req.decisionReason = reason || 'Approved by operator';

    this.notify(id, req);
    return req;
  }

  /**
   * Rejects a pending request.
   */
  public reject(id: string, decider = 'human-operator', reason?: string): ApprovalRequest {
    const req = this.requests.get(id);
    if (!req) {
      throw new Error(`Approval request '${id}' not found.`);
    }
    if (req.status !== 'PENDING') {
      throw new Error(`Approval request '${id}' is already resolved with status '${req.status}'.`);
    }

    req.status = 'REJECTED';
    req.decidedAt = new Date().toISOString();
    req.decidedBy = decider;
    req.decisionReason = reason || 'Rejected by operator';

    this.notify(id, req);
    return req;
  }

  /**
   * Asynchronously waits for a human decision or timeout.
   */
  public async waitForDecision(id: string, timeoutMs = 60_000): Promise<ApprovalRequest> {
    const req = this.requests.get(id);
    if (!req) throw new Error(`Approval request '${id}' not found.`);
    if (req.status !== 'PENDING') return req;

    return new Promise((resolve) => {
      let timer: NodeJS.Timeout | undefined;

      const callback = (resolvedReq: ApprovalRequest) => {
        if (timer) clearTimeout(timer);
        resolve(resolvedReq);
      };

      if (timeoutMs > 0) {
        timer = setTimeout(() => {
          req.status = 'EXPIRED';
          req.decidedAt = new Date().toISOString();
          req.decisionReason = `Approval timed out after ${timeoutMs / 1000}s`;
          resolve(req);
        }, timeoutMs);
      }

      const list = this.listeners.get(id) || [];
      list.push(callback);
      this.listeners.set(id, list);
    });
  }

  private notify(id: string, req: ApprovalRequest): void {
    const list = this.listeners.get(id);
    if (list) {
      for (const cb of list) {
        try {
          cb(req);
        } catch {
          // ignore
        }
      }
      this.listeners.delete(id);
    }
  }
}
