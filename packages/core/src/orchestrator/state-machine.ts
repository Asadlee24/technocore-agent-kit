/**
 * Technocore Agent Kit — Task State Machine
 * Deterministic, fully audited state machine for autonomous agent tasks.
 * Built by Asad Lee (https://asad-lee-portfolio.vercel.app/)
 */

import type {
  TaskDefinition,
  TaskRecord,
  TaskStateTransition,
  TaskStatus,
} from '../types.js';

const ALLOWED_TRANSITIONS: Record<TaskStatus, readonly TaskStatus[]> = {
  CREATED: ['QUEUED', 'ASSIGNED', 'CANCELLED'],
  QUEUED: ['ASSIGNED', 'CANCELLED'],
  ASSIGNED: ['RUNNING', 'CANCELLED', 'REJECTED', 'FAILED'],
  RUNNING: ['COMPLETED', 'FAILED', 'WAITING', 'RETRYING', 'CANCELLED', 'REJECTED'],
  WAITING: ['RUNNING', 'CANCELLED', 'FAILED', 'COMPLETED'],
  RETRYING: ['QUEUED', 'ASSIGNED', 'RUNNING', 'FAILED', 'CANCELLED'],
  REJECTED: ['RETRYING', 'FAILED', 'CANCELLED'],
  FAILED: ['RETRYING', 'CANCELLED'],
  COMPLETED: ['RETRYING'], // Allow retry if verification or reviewer rejects afterwards
  CANCELLED: [],
};

export class TaskStateMachine {
  /**
   * Initializes a fresh TaskRecord from a TaskDefinition.
   */
  public static createTask(def: TaskDefinition): TaskRecord {
    const now = new Date().toISOString();
    return {
      ...def,
      status: 'CREATED',
      attempt: 0,
      createdAt: now,
      updatedAt: now,
      transitions: [
        {
          from: 'CREATED',
          to: 'CREATED',
          timestamp: now,
          reason: 'Task initialized',
        },
      ],
    };
  }

  /**
   * Validates if a transition from current status to next status is permitted.
   */
  public static canTransition(currentStatus: TaskStatus, nextStatus: TaskStatus): boolean {
    if (currentStatus === nextStatus) return true;
    const allowed = ALLOWED_TRANSITIONS[currentStatus] || [];
    return allowed.includes(nextStatus);
  }

  /**
   * Transitions a task to the next state, recording an audit log entry.
   * Throws Error on invalid state transition.
   */
  public static transition(
    task: TaskRecord,
    nextStatus: TaskStatus,
    options: {
      reason?: string;
      actorDid?: string;
      result?: any;
      error?: string;
    } = {}
  ): TaskRecord {
    if (!this.canTransition(task.status, nextStatus)) {
      throw new Error(
        `Invalid task state transition: Cannot move task '${task.taskId}' from '${task.status}' to '${nextStatus}'.`
      );
    }

    const now = new Date().toISOString();
    const transition: TaskStateTransition = {
      from: task.status,
      to: nextStatus,
      timestamp: now,
      reason: options.reason,
      actorDid: options.actorDid,
    };

    const updated: TaskRecord = {
      ...task,
      status: nextStatus,
      updatedAt: now,
      transitions: [...task.transitions, transition],
    };

    if (nextStatus === 'RUNNING' && task.status !== 'RUNNING') {
      updated.attempt = task.attempt + 1;
    }

    if (options.result !== undefined) {
      updated.result = options.result;
    }
    if (options.error !== undefined) {
      updated.error = options.error;
    }

    return updated;
  }

  /**
   * Checks if a task has expired based on its deadline or timeout.
   */
  public static isExpired(task: TaskRecord): boolean {
    const now = Date.now();
    if (task.deadline) {
      const deadlineMs = new Date(task.deadline).getTime();
      if (now > deadlineMs) return true;
    }
    if (task.timeoutMs && task.status === 'RUNNING') {
      const lastRunning = [...task.transitions]
        .reverse()
        .find((t) => t.to === 'RUNNING');
      if (lastRunning) {
        const startMs = new Date(lastRunning.timestamp).getTime();
        if (now - startMs > task.timeoutMs) return true;
      }
    }
    return false;
  }

  /**
   * Returns true if the task is in a terminal status (COMPLETED, CANCELLED, or non-retriable FAILED).
   */
  public static isTerminal(task: TaskRecord): boolean {
    if (task.status === 'COMPLETED' || task.status === 'CANCELLED') return true;
    if (task.status === 'FAILED') {
      const maxRetries = task.maxRetries ?? 3;
      return task.attempt >= maxRetries;
    }
    return false;
  }
}
