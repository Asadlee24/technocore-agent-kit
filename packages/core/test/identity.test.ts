import test from 'node:test';
import assert from 'node:assert';
import { createAgentIdentity, loadAgentIdentity, verifySignature } from '../src/identity/index.js';

test('Ed25519 did:key creation and format validation', () => {
  const identity = createAgentIdentity();
  assert.ok(identity.did.startsWith('did:key:z6Mk'), `DID ${identity.did} should start with did:key:z6Mk`);
  assert.strictEqual(identity.fingerprint.length, 16);
  assert.strictEqual(identity.shard.length, 2);
  assert.strictEqual(identity.key.length, 14);
  assert.strictEqual(identity.shard + identity.key, identity.fingerprint);
  assert.strictEqual(identity.didNotePath.namespace, `did-${identity.shard}`);
  assert.strictEqual(identity.didNotePath.key, identity.key);
});

test('Ed25519 signing and offline verification', () => {
  const identity = createAgentIdentity();
  const room = 'lobby';
  const text = 'Hello Technocore Agents from Asad Lee';
  const env = identity.signMessage(room, text, '12345');

  assert.strictEqual(env.did, identity.did);
  assert.strictEqual(env.nonce, '12345');
  assert.strictEqual(env.room, room);
  assert.strictEqual(env.text, text);
  assert.strictEqual(typeof env.sig, 'string');
  assert.strictEqual(env.sig.length, 86); // 64 bytes in base64url is 86 chars

  const isValid = verifySignature(`${room}|12345|${text}`, env.sig, identity.did);
  assert.strictEqual(isValid, true);

  // Tampered payload fails
  const isTamperedValid = verifySignature(`${room}|12345|tampered text`, env.sig, identity.did);
  assert.strictEqual(isTamperedValid, false);
});

test('Identity reconstruction from private key bytes', () => {
  const id1 = createAgentIdentity();
  const privBytes = id1.getPrivateKeyBytes();
  const id2 = loadAgentIdentity(privBytes);

  assert.strictEqual(id2.did, id1.did);
  assert.strictEqual(id2.fingerprint, id1.fingerprint);

  const env = id2.signMessage('test-room', 'ping', '999');
  assert.strictEqual(verifySignature('test-room|999|ping', env.sig, id1.did), true);
});

test('Zero secret leakage in console inspect / exports', () => {
  const identity = createAgentIdentity();
  const publicRecord = identity.exportPublicRecord();

  assert.strictEqual(Object.prototype.hasOwnProperty.call(publicRecord, 'privateKey'), false);
  assert.strictEqual(Object.prototype.hasOwnProperty.call(publicRecord, 'secret'), false);

  const inspected = (identity as any)[Symbol.for('nodejs.util.inspect.custom')]();
  assert.strictEqual(inspected.privateKey, '[PROTECTED LOCAL SECRET — REDACTED]');
});
