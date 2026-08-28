import test from 'node:test';
import assert from 'node:assert';
import { createTechnocoreClient } from '../src/client.js';
import { createAgentIdentity } from '../src/identity/index.js';

test('Notes CRUD, CAS conditional writes, and sharded DID resolution', async () => {
  const noteStorage = new Map<string, string>();

  const mockFetch: any = async (input: any, init?: any) => {
    const url = input.toString();

    // GET note
    const getMatch = url.match(/\/kv\/([^/?]+)\/([^/?]+)$/);
    if (getMatch && (!init || init.method === 'GET')) {
      const ns = decodeURIComponent(getMatch[1]);
      const key = decodeURIComponent(getMatch[2]);
      const val = noteStorage.get(`${ns}/${key}`);
      if (val === undefined) return new Response('Not found', { status: 404 });
      return new Response(val, { status: 200 });
    }

    // SET note
    const setMatch = url.match(/\/kv\/([^/]+)\/([^/]+)\/set\/([^?]+)/);
    if (setMatch) {
      const parsedUrl = new URL(url, 'https://technocore.chat');
      const ns = decodeURIComponent(setMatch[1]);
      const key = decodeURIComponent(setMatch[2]);
      const val = decodeURIComponent(setMatch[3]);
      const storageKey = `${ns}/${key}`;
      const existing = noteStorage.get(storageKey);

      const ifAbsent = parsedUrl.searchParams.get('if_absent');
      if (ifAbsent && existing !== undefined) {
        return new Response(existing, { status: 409 });
      }

      const ifExpected = parsedUrl.searchParams.get('if');
      if (ifExpected !== null && existing !== ifExpected) {
        return new Response(existing || '', { status: 409 });
      }

      noteStorage.set(storageKey, val);
      return new Response('OK', { status: 200 });
    }

    return new Response('Not found', { status: 404 });
  };

  const client = createTechnocoreClient({ fetchFn: mockFetch });
  const identity = createAgentIdentity();
  client.did.set(identity);

  // Set note
  await client.notes.set('my-project', 'step-1', 'initial state');
  const readVal = await client.notes.get('my-project', 'step-1');
  assert.strictEqual(readVal, 'initial state');

  // CAS update with matching if
  const updateRes = await client.notes.set('my-project', 'step-1', 'updated state', { if: 'initial state' });
  assert.strictEqual(updateRes.ok, true);

  // CAS update with mismatching if returns 409 conflict
  const conflictRes = await client.notes.set('my-project', 'step-1', 'overwritten', { if: 'stale state' });
  assert.strictEqual(conflictRes.ok, false);
  assert.strictEqual(conflictRes.status, 409);
  assert.strictEqual(conflictRes.currentValueOnConflict, 'updated state');

  // Publish and Resolve DID
  const pub = await client.notes.publishDid(identity, { mailbox: 'mb-p-my-inbox' });
  assert.strictEqual(pub.path, `kv/did-${identity.shard}/${identity.key}`);

  const resolved = await client.notes.resolveDid(identity.did);
  assert.ok(resolved !== null);
  assert.strictEqual(resolved?.did, identity.did);
  assert.strictEqual(resolved?.mailbox, 'mb-p-my-inbox');
});
