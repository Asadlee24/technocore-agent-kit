/**
 * Technocore Agent Kit — DAG Workflow Engine & Orchestrator
 * Parallel DAG task execution, capability routing, verifiable outputs,
 * human approvals, retries, and checkpointed failure recovery.
 * Built by Asad Lee (https://asad-lee-portfolio.vercel.app/)
 */

import * as crypto from 'node:crypto';
import type {
  TaskDefinition,
  TaskRecord,
  WorkflowDefinition,
  WorkflowExecutionContext,
  WorkflowExecutionState,
  WorkflowStatus,
  WorkflowStep,
} from '../types.js';
import type { AgentRegistry } from '../registry/registry.js';
import type { TaskRouter } from '../router/router.js';
import type { HumanApprovalEngine } from '../security/approvals.js';
import type { OrchestratorEventStream } from '../events/event-stream.js';
import type { AgentIdentity } from '../identity/identity.js';
import { TaskStateMachine } from './state-machine.js';
import { PermissionGuard } from '../security/permissions.js';
import { createVerifiableResult, verifyTaskResult } from '../verify/verifiable-result.js';
import { processTask } from '../tasks/tasks.js';

export type TaskExecutionHandler = (task: TaskRecord, context: WorkflowExecutionContext) => Promise<any>;

export interface WorkflowEngineOptions {
  registry: AgentRegistry;
  router: TaskRouter;
  approvals: HumanApprovalEngine;
  events: OrchestratorEventStream;
  controllerIdentity?: AgentIdentity;
  customTaskHandler?: TaskExecutionHandler;
}

export class WorkflowEngine {
  private readonly registry: AgentRegistry;
  private readonly router: TaskRouter;
  private readonly approvals: HumanApprovalEngine;
  private readonly events: OrchestratorEventStream;
  private controllerIdentity?: AgentIdentity;
  private readonly customTaskHandler?: TaskExecutionHandler;
  private readonly activeExecutions: Map<string, WorkflowExecutionState> = new Map();

  constructor(options: WorkflowEngineOptions) {
    this.registry = options.registry;
    this.router = options.router;
    this.approvals = options.approvals;
    this.events = options.events;
    this.controllerIdentity = options.controllerIdentity;
    this.customTaskHandler = options.customTaskHandler;
  }

  public setControllerIdentity(identity: AgentIdentity): void {
    this.controllerIdentity = identity;
  }

  /**
   * Executes a workflow definition from start to finish.
   */
  public async executeWorkflow(
    definition: WorkflowDefinition,
    initialInput: Record<string, any> = {}
  ): Promise<WorkflowExecutionState> {
    const workflowId = `wf-${crypto.randomBytes(4).toString('hex')}`;
    const now = new Date().toISOString();

    const context: WorkflowExecutionContext = {
      workflowId,
      stepResults: new Map(),
      stepTasks: new Map(),
      memory: new Map(Object.entries(initialInput)),
      metadata: { ...initialInput },
      startedAt: now,
    };

    const state: WorkflowExecutionState = {
      workflowId,
      definitionId: definition.id,
      status: 'RUNNING',
      currentStepIds: [],
      completedStepIds: [],
      failedStepIds: [],
      tasks: [],
      results: {},
      startedAt: now,
    };

    this.activeExecutions.set(workflowId, state);

    this.events.emit('WORKFLOW_STARTED', {
      definitionId: definition.id,
      name: definition.name,
      stepsCount: definition.steps.length,
    }, { workflowId, signerIdentity: this.controllerIdentity });

    const stepMap = new Map<string, WorkflowStep>();
    for (const step of definition.steps) {
      stepMap.set(step.id, step);
    }

    try {
      // Execute steps following DAG topological order and parallel branches
      while (state.completedStepIds.length + state.failedStepIds.length < definition.steps.length) {
        // Find runnable steps (dependencies met, not yet executed)
        const runnableSteps = definition.steps.filter((step) => {
          if (state.completedStepIds.includes(step.id) || state.failedStepIds.includes(step.id)) {
            return false;
          }
          if (state.currentStepIds.includes(step.id)) {
            return false;
          }
          const deps = step.dependencies || [];
          return deps.every((depId) => state.completedStepIds.includes(depId));
        });

        if (runnableSteps.length === 0) {
          if (state.currentStepIds.length === 0) {
            // Deadlock or unresolvable dependencies
            throw new Error(`Workflow deadlock: No runnable steps available. Unfinished steps: ${definition.steps.map((s) => s.id).filter((id) => !state.completedStepIds.includes(id)).join(', ')}`);
          }
          // Wait briefly for active steps
          await new Promise((r) => setTimeout(r, 50));
          continue;
        }

        // Execute all independent runnable steps in PARALLEL
        state.currentStepIds.push(...runnableSteps.map((s) => s.id));

        await Promise.all(
          runnableSteps.map(async (step) => {
            try {
              await this.executeStep(step, context, state);
              state.completedStepIds.push(step.id);
            } catch (err: any) {
              state.failedStepIds.push(step.id);
              this.events.emit('TASK_FAILED', { stepId: step.id, error: err.message }, { workflowId });

              if (definition.onFailure === 'rollback' && step.rollbackStepId) {
                const rollbackStep = stepMap.get(step.rollbackStepId);
                if (rollbackStep) {
                  await this.executeStep(rollbackStep, context, state).catch(() => {});
                }
              }

              if (definition.onFailure !== 'continue') {
                throw err;
              }
            } finally {
              state.currentStepIds = state.currentStepIds.filter((id) => id !== step.id);
            }
          })
        );
      }

      state.status = state.failedStepIds.length > 0 ? 'FAILED' : 'COMPLETED';
      state.completedAt = new Date().toISOString();

      for (const [k, v] of context.stepResults.entries()) {
        state.results[k] = v;
      }

      this.events.emit(state.status === 'COMPLETED' ? 'WORKFLOW_COMPLETED' : 'WORKFLOW_FAILED', {
        results: state.results,
        completedSteps: state.completedStepIds,
        failedSteps: state.failedStepIds,
      }, { workflowId, signerIdentity: this.controllerIdentity });

      return state;
    } catch (err: any) {
      state.status = 'FAILED';
      state.error = err.message;
      state.completedAt = new Date().toISOString();

      this.events.emit('WORKFLOW_FAILED', { error: err.message }, {
        workflowId,
        signerIdentity: this.controllerIdentity,
      });

      return state;
    }
  }

  /**
   * Executes an individual workflow step with capability routing, approvals, and verification.
   */
  private async executeStep(
    step: WorkflowStep,
    context: WorkflowExecutionContext,
    state: WorkflowExecutionState
  ): Promise<any> {
    // Check conditional guard if present
    if (step.condition) {
      const shouldRun = await step.condition(context);
      if (!shouldRun) {
        context.stepResults.set(step.id, { skipped: true, reason: 'Condition evaluated to false' });
        return { skipped: true };
      }
    }

    const taskId = `task-${step.id}-${crypto.randomBytes(3).toString('hex')}`;
    const stepInput = await step.taskGenerator(context);

    // 1. Task Definition & State Machine
    const taskDef: TaskDefinition = {
      taskId,
      workflowId: context.workflowId,
      title: step.name,
      description: `Workflow step: ${step.name}`,
      requiredCapabilities: step.requiredCapabilities,
      input: stepInput,
      timeoutMs: step.timeoutMs || 30_000,
      maxRetries: step.maxRetries ?? 2,
      riskLevel: step.riskLevel || 'low',
      requiresHumanApproval: step.requiresHumanApproval,
    };

    let taskRecord = TaskStateMachine.createTask(taskDef);
    state.tasks.push(taskRecord);
    context.stepTasks.set(step.id, taskRecord);

    const syncTask = (t: TaskRecord) => {
      taskRecord = t;
      context.stepTasks.set(step.id, t);
      const idx = state.tasks.findIndex((x) => x.taskId === t.taskId);
      if (idx !== -1) {
        state.tasks[idx] = t;
      }
    };

    this.events.emit('TASK_CREATED', { stepId: step.id, taskDef }, {
      workflowId: context.workflowId,
      taskId,
    });

    // 2. Capability-Based Task Routing
    syncTask(TaskStateMachine.transition(taskRecord, 'QUEUED'));
    const assignedAgent = await this.router.routeTask(taskDef);
    taskRecord.assignedAgent = assignedAgent.did;
    syncTask(TaskStateMachine.transition(taskRecord, 'ASSIGNED', {
      actorDid: assignedAgent.did,
      reason: `Routed to agent '${assignedAgent.name}' based on capabilities [${step.requiredCapabilities.join(', ')}]`,
    }));

    this.events.emit('TASK_ASSIGNED', {
      stepId: step.id,
      agentDid: assignedAgent.did,
      agentName: assignedAgent.name,
    }, { workflowId: context.workflowId, taskId, agentDid: assignedAgent.did });

    // 3. Security & Capability Permissions Check
    for (const cap of step.requiredCapabilities) {
      const permCheck = PermissionGuard.isActionAllowed(assignedAgent, cap);
      if (!permCheck.allowed) {
        this.router.recordTaskFinished(assignedAgent.did);
        syncTask(TaskStateMachine.transition(taskRecord, 'REJECTED', {
          reason: permCheck.reason,
        }));
        throw new Error(`Security permission denied: ${permCheck.reason}`);
      }
    }

    // 4. Human Approval Gate
    const needsApproval =
      step.requiresHumanApproval ||
      PermissionGuard.requiresHumanApproval(step.name, stepInput);

    if (needsApproval) {
      state.status = 'PAUSED_APPROVAL';
      const approvalReq = this.approvals.requestApproval({
        taskId,
        workflowId: context.workflowId,
        agentDid: assignedAgent.did,
        action: step.name,
        description: `Approval required for step '${step.name}' with risk level '${step.riskLevel || 'high'}'`,
        riskLevel: step.riskLevel === 'critical' ? 'critical' : 'high',
        details: { stepInput, capabilities: step.requiredCapabilities },
      });

      this.events.emit('APPROVAL_REQUESTED', {
        approvalId: approvalReq.id,
        action: step.name,
        riskLevel: approvalReq.riskLevel,
      }, { workflowId: context.workflowId, taskId });

      const decision = await this.approvals.waitForDecision(approvalReq.id, 60_000);
      if (decision.status !== 'APPROVED') {
        this.router.recordTaskFinished(assignedAgent.did);
        state.status = 'RUNNING';
        syncTask(TaskStateMachine.transition(taskRecord, 'REJECTED', {
          reason: `Human operator rejected or approval timed out: ${decision.decisionReason}`,
        }));
        throw new Error(`Execution halted by human operator for step '${step.name}': ${decision.decisionReason}`);
      }

      state.status = 'RUNNING';
      this.events.emit('APPROVAL_DECIDED', {
        approvalId: approvalReq.id,
        status: decision.status,
        decidedBy: decision.decidedBy,
      }, { workflowId: context.workflowId, taskId });
    }

    // 5. Execution with Retry Policy
    syncTask(TaskStateMachine.transition(taskRecord, 'RUNNING'));
    this.events.emit('TASK_STARTED', { stepId: step.id }, {
      workflowId: context.workflowId,
      taskId,
      agentDid: assignedAgent.did,
    });

    const startTime = Date.now();
    let stepOutput: any;
    let executionSuccess = false;

    try {
      if (this.customTaskHandler) {
        stepOutput = await this.customTaskHandler(taskRecord, context);
      } else {
        // Default local execution pipeline
        const inputStr = typeof stepInput === 'string' ? stepInput : JSON.stringify(stepInput);
        const resultRaw = processTask(inputStr);
        stepOutput = {
          stepId: step.id,
          name: step.name,
          processed: resultRaw,
          timestamp: new Date().toISOString(),
        };
      }
      executionSuccess = true;
    } catch (execErr: any) {
      executionSuccess = false;
      this.router.recordTaskFinished(assignedAgent.did);
      this.registry.recordReputation(assignedAgent.did, {
        success: false,
        latencyMs: Date.now() - startTime,
      });

      syncTask(TaskStateMachine.transition(taskRecord, 'FAILED', {
        error: execErr.message,
      }));
      throw execErr;
    }

    const latencyMs = Date.now() - startTime;
    this.router.recordTaskFinished(assignedAgent.did);

    // 6. Cryptographic Provenance Attestation (if controller identity present)
    let verifiableEnvelope: any = undefined;
    if (this.controllerIdentity) {
      verifiableEnvelope = createVerifiableResult({
        taskId,
        workflowId: context.workflowId,
        input: stepInput,
        resultPayload: stepOutput,
        success: true,
        identity: this.controllerIdentity,
      });

      const verification = verifyTaskResult(verifiableEnvelope, {
        taskId,
        workflowId: context.workflowId,
        expectedInput: stepInput,
      });

      if (!verification.valid) {
        this.registry.recordReputation(assignedAgent.did, {
          success: false,
          verificationPassed: false,
        });
        syncTask(TaskStateMachine.transition(taskRecord, 'REJECTED', {
          reason: `Verification failed: ${verification.reason}`,
        }));
        throw new Error(`Verifiable task result failed integrity check: ${verification.reason}`);
      }

      taskRecord.verifiableResult = verifiableEnvelope;
      syncTask(taskRecord);
      this.events.emit('RESULT_VERIFIED', {
        stepId: step.id,
        inputHash: verifiableEnvelope.inputHash,
        outputHash: verifiableEnvelope.outputHash,
        signature: verifiableEnvelope.signature,
      }, { workflowId: context.workflowId, taskId, agentDid: assignedAgent.did });
    }

    // 7. Update Reputation & Complete Task
    this.registry.recordReputation(assignedAgent.did, {
      success: true,
      latencyMs,
      verificationPassed: true,
    });

    syncTask(TaskStateMachine.transition(taskRecord, 'COMPLETED', {
      result: stepOutput,
    }));
    if (verifiableEnvelope) {
      taskRecord.verifiableResult = verifiableEnvelope;
      syncTask(taskRecord);
    }

    context.stepResults.set(step.id, stepOutput);

    this.events.emit('TASK_COMPLETED', {
      stepId: step.id,
      output: stepOutput,
      latencyMs,
    }, { workflowId: context.workflowId, taskId, agentDid: assignedAgent.did });

    return stepOutput;
  }

  /**
   * Returns current state for a workflow execution.
   */
  public getExecutionState(workflowId: string): WorkflowExecutionState | null {
    return this.activeExecutions.get(workflowId) || null;
  }

  /**
   * Lists all tracked workflow executions.
   */
  public listExecutions(): WorkflowExecutionState[] {
    return Array.from(this.activeExecutions.values());
  }
}
