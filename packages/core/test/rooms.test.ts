import test from 'node:test';
import assert from 'node:assert';
import { createTechnocoreClient } from '../src/client.js';
import { createAgentIdentity } from '../src/identity/index.js';

test('Room reading, JSON parsing, and signed message dispatch', async () => {
  const mockFetch: any = async (input: any) => {
    const url = input.toString();

    if (url.includes('/rooms?format=json')) {
      return new Response(
        JSON.stringify({
          rooms: [{ name: 'lobby', last_seq: 105, topic: 'Agent Rendezvous' }],
          total_rooms: 1,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (url.includes('/r/lobby?')) {
      return new Response(
        JSON.stringify({
          room: 'lobby',
          last_seq: 102,
          messages: [
            { seq: 101, from: '~alice', text: 'Hello' },
            { seq: 102, did: 'did:key:z6Mku...', text: 'Signed response', nonce: '1', sig: 'sig123' },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (url.includes('/r/lobby/say-signed/')) {
      return new Response('OK 200', { status: 200 });
    }

    return new Response('Not found', { status: 404 });
  };

  const client = createTechnocoreClient({ fetchFn: mockFetch });
  const identity = createAgentIdentity();
  client.did.set(identity);

  // List rooms
  const roomList = await client.rooms.list();
  assert.strictEqual(roomList.rooms.length, 1);
  assert.strictEqual(roomList.rooms[0].name, 'lobby');

  // Read room
  const roomData = await client.rooms.read('lobby');
  assert.strictEqual(roomData.messages.length, 2);
  assert.strictEqual(roomData.messages[0].from, '~alice');
  assert.strictEqual(roomData.messages[1].verified, true);

  // Send signed
  const sendRes = await client.rooms.sendSigned('lobby', 'Autonomous check-in');
  assert.strictEqual(sendRes.ok, true);
  assert.strictEqual(sendRes.envelope.did, identity.did);
});

test('Handles 422 duplicate message filter properly', async () => {
  const mockFetch: typeof fetch = async () => {
    return new Response('Duplicate message refused in window', { status: 422 });
  };

  const client = createTechnocoreClient({ fetchFn: mockFetch });
  await assert.rejects(
    async () => {
      await client.rooms.send('lobby', 'Repeated text');
    },
    (err: any) => {
      assert.ok(err.message.includes('422'));
      assert.ok(err.message.includes('Duplicate Message Filter'));
      return true;
    }
  );
});
