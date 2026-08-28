import { test } from 'node:test';
import * as assert from 'node:assert';
import { AgentMemory } from '../src/memory/memory.js';
import { createAgentIdentity } from '../src/identity/identity.js';

test('AgentMemory: writes scoped entries with versioning and cryptographic signatures', async () => {
  const memory = new AgentMemory();
  const identity = createAgentIdentity();

  const writeRes = await memory.write(
    'team',
    'project-config',
    'api-endpoint',
    { url: 'https://technocore.chat', port: 443 },
    identity
  );

  assert.strictEqual(writeRes.success, true);
  assert.strictEqual(writeRes.currentVersion, 1);
  assert.ok(writeRes.entry?.signature);

  const entry = await memory.read('team', 'project-config', 'api-endpoint');
  assert.ok(entry);
  assert.strictEqual(entry.value.url, 'https://technocore.chat');
  assert.strictEqual(entry.ownerDid, identity.did);
  assert.strictEqual(entry.version, 1);
});

test('AgentMemory: detects CAS concurrency conflicts', async () => {
  const memory = new AgentMemory();
  const identity = createAgentIdentity();

  // Initial write (v1)
  await memory.write('workflow', 'build-state', 'phase', 'initial', identity);

  // Write with correct expected version 1 -> advances to v2
  const update1 = await memory.write(
    'workflow',
    'build-state',
    'phase',
    'compiling',
    identity,
    { expectedVersion: 1 }
  );
  assert.strictEqual(update1.success, true);
  assert.strictEqual(update1.currentVersion, 2);

  // Conflict: Try updating with stale expected version 1
  const conflictRes = await memory.write(
    'workflow',
    'build-state',
    'phase',
    'packaged',
    identity,
    { expectedVersion: 1 }
  );

  assert.strictEqual(conflictRes.success, false);
  assert.strictEqual(conflictRes.conflict, true);
  assert.strictEqual(conflictRes.currentVersion, 2);
});
