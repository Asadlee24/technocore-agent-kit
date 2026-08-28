import { test } from 'node:test';
import * as assert from 'node:assert';
import { TaskStateMachine } from '../src/orchestrator/state-machine.js';
import type { TaskDefinition } from '../src/types.js';

test('TaskStateMachine: validates permitted transitions and records transition history', () => {
  const def: TaskDefinition = {
    taskId: 'task-test-01',
    workflowId: 'wf-01',
    title: 'Unit Test Task',
    description: 'Testing state transitions',
    requiredCapabilities: ['calculate'],
    input: { num: 42 },
  };

  let task = TaskStateMachine.createTask(def);
  assert.strictEqual(task.status, 'CREATED');
  assert.strictEqual(task.attempt, 0);
  assert.strictEqual(task.transitions.length, 1);

  // Valid: CREATED -> QUEUED
  task = TaskStateMachine.transition(task, 'QUEUED');
  assert.strictEqual(task.status, 'QUEUED');

  // Valid: QUEUED -> ASSIGNED
  task = TaskStateMachine.transition(task, 'ASSIGNED', { actorDid: 'did:key:z6Mktester' });
  assert.strictEqual(task.status, 'ASSIGNED');

  // Valid: ASSIGNED -> RUNNING
  task = TaskStateMachine.transition(task, 'RUNNING');
  assert.strictEqual(task.status, 'RUNNING');
  assert.strictEqual(task.attempt, 1);

  // Valid: RUNNING -> COMPLETED
  task = TaskStateMachine.transition(task, 'COMPLETED', { result: 84 });
  assert.strictEqual(task.status, 'COMPLETED');
  assert.strictEqual(task.result, 84);
  assert.strictEqual(task.transitions.length, 5);
});

test('TaskStateMachine: blocks illegal state transitions', () => {
  const def: TaskDefinition = {
    taskId: 'task-test-02',
    workflowId: 'wf-01',
    title: 'Invalid Transition Task',
    description: 'Testing illegal jump',
    requiredCapabilities: ['edit-code'],
    input: {},
  };

  const task = TaskStateMachine.createTask(def);
  assert.strictEqual(task.status, 'CREATED');

  // Illegal: CREATED -> COMPLETED directly
  assert.throws(() => {
    TaskStateMachine.transition(task, 'COMPLETED');
  }, /Invalid task state transition/);
});

test('TaskStateMachine: detects task timeouts and expiration', () => {
  const def: TaskDefinition = {
    taskId: 'task-test-03',
    workflowId: 'wf-01',
    title: 'Expiring Task',
    description: 'Testing expiration',
    requiredCapabilities: ['web-research'],
    input: {},
    deadline: new Date(Date.now() - 5000).toISOString(), // Expired 5 seconds ago
  };

  const task = TaskStateMachine.createTask(def);
  assert.strictEqual(TaskStateMachine.isExpired(task), true);
});
