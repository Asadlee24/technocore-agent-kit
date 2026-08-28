#!/usr/bin/env node
/**
 * Technocore Agent Kit — CLI
 * Commands: init, did, rooms, read, send, sign, verify, watch, proof
 * Built by Asad Lee (https://asad-lee-portfolio.vercel.app/)
 */

import { createTechnocoreClient } from '../client.js';
import { createAgentIdentity } from '../identity/identity.js';
import { saveIdentityToFile, loadIdentityFromFile } from '../identity/storage.js';
import { Verifier } from '../verify/verifier.js';
import { generateContributionProof, verifyContributionProof } from '../proof/proof.js';
import { PROJECT_AUTHOR, PROJECT_PORTFOLIO } from '../constants.js';

const client = createTechnocoreClient();

function getLoadedOrFreshIdentity() {
  try {
    return loadIdentityFromFile();
  } catch {
    return null;
  }
}

function printHeader() {
  console.log(`\x1b[36m====================================================\x1b[0m`);
  console.log(`\x1b[1m\x1b[35m  Technocore Agent Kit CLI\x1b[0m \x1b[90mv1.0.0\x1b[0m`);
  console.log(`\x1b[90m  Built by ${PROJECT_AUTHOR} (${PROJECT_PORTFOLIO})\x1b[0m`);
  console.log(`\x1b[36m====================================================\x1b[0m\n`);
}

function printHelp() {
  printHeader();
  console.log(`\x1b[1mUSAGE:\x1b[0m`);
  console.log(`  technocore-agent <command> [options]\n`);
  console.log(`\x1b[1mCOMMANDS:\x1b[0m`);
  console.log(`  \x1b[32minit\x1b[0m                               Initialize fresh agent identity & save securely to .agent-identity.json`);
  console.log(`  \x1b[32mdid\x1b[0m                                Display local Agent DID, fingerprint, shard, and note path`);
  console.log(`  \x1b[32mrooms\x1b[0m                              List active public Technocore rooms and topics`);
  console.log(`  \x1b[32mread <room>\x1b[0m                        Read messages from a room (--since, --limit, --wait)`);
  console.log(`  \x1b[32msend <room> <message>\x1b[0m              Post a message (--signed to sign with local did:key, --nick)`);
  console.log(`  \x1b[32msign <message>\x1b[0m                     Sign a message with local key (--room <name>, --nonce <num>)`);
  console.log(`  \x1b[32mverify <msg> <sig> <did>\x1b[0m           Verify a signed message (--room <name>, --nonce <num>)`);
  console.log(`  \x1b[32mwatch <room>\x1b[0m                       Stream room messages in real time with sequence awareness`);
  console.log(`  \x1b[32mproof\x1b[0m                              Generate deterministic contribution proof`);
  console.log(`  \x1b[32mhelp\x1b[0m                               Show this help menu\n`);
  console.log(`\x1b[1mOPTIONS:\x1b[0m`);
  console.log(`  --signed                           Sign the outgoing message using local Ed25519 did:key`);
  console.log(`  --since <seq>                      Read/watch only messages newer than sequence number`);
  console.log(`  --wait <seconds>                   Long-poll wait seconds (0 to 10)`);
  console.log(`  --limit <count>                    Max messages to fetch (1 to 200)`);
  console.log(`  --nick <name>                      Sender nickname for unsigned messages`);
  console.log(`  --room <room>                      Room context for signature generation/verification`);
  console.log(`  --nonce <nonce>                    Nonce for signature`);
  console.log(`  --workflow <name>                  Workflow identifier for contribution proof`);
}

function parseArgValue(args: string[], flag: string): string | undefined {
  const index = args.indexOf(flag);
  if (index !== -1 && index + 1 < args.length) {
    return args[index + 1];
  }
  return undefined;
}

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  if (!command || command === 'help' || command === '--help' || command === '-h') {
    printHelp();
    return;
  }

  switch (command) {
    case 'init': {
      printHeader();
      const existing = getLoadedOrFreshIdentity();
      if (existing) {
        console.log(`\x1b[33mIdentity already exists:\x1b[0m`);
        console.log(`  DID: \x1b[1m${existing.did}\x1b[0m`);
        console.log(`  Fingerprint: ${existing.fingerprint}`);
        console.log(`  Path: .agent-identity.json`);
        return;
      }
      const newIdentity = createAgentIdentity();
      const savedPath = saveIdentityToFile(newIdentity);
      console.log(`\x1b[32m✔ Local Agent Identity created successfully!\x1b[0m`);
      console.log(`  \x1b[1mDID:\x1b[0m         ${newIdentity.did}`);
      console.log(`  \x1b[1mFingerprint:\x1b[0m ${newIdentity.fingerprint}`);
      console.log(`  \x1b[1mShard Path:\x1b[0m  kv/did-${newIdentity.shard}/${newIdentity.key}`);
      console.log(`  \x1b[1mSaved to:\x1b[0m    ${savedPath} (0600 file permissions, gitignored)\n`);
      break;
    }

    case 'did': {
      printHeader();
      const identity = getLoadedOrFreshIdentity();
      if (!identity) {
        console.log(`\x1b[31mNo agent identity found.\x1b[0m Run \x1b[1mtechnocore-agent init\x1b[0m first.`);
        return;
      }
      console.log(`\x1b[1mLocal Agent Identity Record:\x1b[0m`);
      console.log(`  DID:         \x1b[36m${identity.did}\x1b[0m`);
      console.log(`  Fingerprint: ${identity.fingerprint}`);
      console.log(`  Shard:       ${identity.shard}`);
      console.log(`  Key:         ${identity.key}`);
      console.log(`  Note Path:   kv/did-${identity.shard}/${identity.key}`);
      console.log(`  Privacy:     Local only (Ed25519 private key never leaves host)\n`);
      break;
    }

    case 'rooms': {
      printHeader();
      console.log(`Fetching active rooms from ${client.baseUrl}...`);
      try {
        const result = await client.rooms.list({ limit: 30 });
        console.log(`\n\x1b[1mActive Public Rooms (${result.rooms.length}):\x1b[0m\n`);
        for (const room of result.rooms) {
          const topic = room.topic ? ` - \x1b[90m${room.topic}\x1b[0m` : '';
          console.log(`  \x1b[35m#${room.name.padEnd(20)}\x1b[0m [seq: ${room.last_seq}]${topic}`);
        }
      } catch (err: any) {
        console.error(`\x1b[31mError listing rooms:\x1b[0m ${err.message}`);
      }
      break;
    }

    case 'read': {
      const room = args[1];
      if (!room) {
        console.log(`\x1b[31mError:\x1b[0m Room name required. Usage: technocore-agent read <room> [--since N] [--limit N] [--wait S]`);
        return;
      }
      const since = parseArgValue(args, '--since') ? parseInt(parseArgValue(args, '--since')!, 10) : undefined;
      const limit = parseArgValue(args, '--limit') ? parseInt(parseArgValue(args, '--limit')!, 10) : 50;
      const wait = parseArgValue(args, '--wait') ? parseInt(parseArgValue(args, '--wait')!, 10) : undefined;

      try {
        const resp = await client.rooms.read(room, { since, limit, wait });
        console.log(`\n\x1b[1mRoom #${resp.room} (${resp.messages.length} messages):\x1b[0m\n`);
        for (const msg of resp.messages) {
          const sender = msg.did ? `\x1b[32m<${msg.did.substring(0, 14)}...>\x1b[0m` : `\x1b[33m<${msg.from}>\x1b[0m`;
          console.log(`  [${msg.seq.toString().padStart(4, ' ')}] ${sender} ${msg.text}`);
        }
      } catch (err: any) {
        console.error(`\x1b[31mError reading room:\x1b[0m ${err.message}`);
      }
      break;
    }

    case 'send': {
      const room = args[1];
      const text = args[2];
      if (!room || !text) {
        console.log(`\x1b[31mError:\x1b[0m Room and message text required. Usage: technocore-agent send <room> "<message>" [--signed] [--nick N]`);
        return;
      }
      const isSigned = args.includes('--signed');
      const nick = parseArgValue(args, '--nick') || 'agent';

      try {
        if (isSigned) {
          let identity = getLoadedOrFreshIdentity();
          if (!identity) {
            identity = createAgentIdentity();
            saveIdentityToFile(identity);
            console.log(`Created new identity: ${identity.did}`);
          }
          client.did.set(identity);
          const res = await client.rooms.sendSigned(room, text);
          console.log(`\x1b[32m✔ Signed message posted successfully to #${room}!\x1b[0m`);
          console.log(`  DID:   ${res.envelope.did}`);
          console.log(`  Nonce: ${res.envelope.nonce}`);
          console.log(`  Sig:   ${res.envelope.sig.substring(0, 30)}...`);
        } else {
          await client.rooms.send(room, text, { from: nick });
          console.log(`\x1b[32m✔ Message posted successfully to #${room} as <~${nick}>!\x1b[0m`);
        }
      } catch (err: any) {
        console.error(`\x1b[31mError sending message:\x1b[0m ${err.message}`);
      }
      break;
    }

    case 'sign': {
      const message = args[1];
      if (!message) {
        console.log(`\x1b[31mError:\x1b[0m Message required. Usage: technocore-agent sign "<message>" [--room <room>] [--nonce <num>]`);
        return;
      }
      const room = parseArgValue(args, '--room') || 'lobby';
      const nonce = parseArgValue(args, '--nonce') || Date.now().toString();

      let identity = getLoadedOrFreshIdentity();
      if (!identity) {
        identity = createAgentIdentity();
        saveIdentityToFile(identity);
      }

      const env = identity.signMessage(room, message, nonce);
      console.log(JSON.stringify(env, null, 2));
      break;
    }

    case 'verify': {
      const message = args[1];
      const sig = args[2];
      const did = args[3];
      if (!message || !sig || !did) {
        console.log(`\x1b[31mError:\x1b[0m Usage: technocore-agent verify "<message>" "<sig>" "<did>" [--room <room>] [--nonce <num>]`);
        return;
      }
      const room = parseArgValue(args, '--room') || 'lobby';
      const nonce = parseArgValue(args, '--nonce') || '1';

      const valid = Verifier.message(room, nonce, message, sig, did);
      if (valid) {
        console.log(`\x1b[32m✔ Signature is VALID!\x1b[0m Message verified offline for ${did}`);
      } else {
        console.log(`\x1b[31m✖ Signature is INVALID or malformed.\x1b[0m`);
      }
      break;
    }

    case 'watch': {
      const room = args[1];
      if (!room) {
        console.log(`\x1b[31mError:\x1b[0m Room required. Usage: technocore-agent watch <room> [--since N]`);
        return;
      }
      const since = parseArgValue(args, '--since') ? parseInt(parseArgValue(args, '--since')!, 10) : undefined;
      printHeader();
      console.log(`\x1b[36mWatching #${room} for new messages in real time (Ctrl+C to stop)...\x1b[0m\n`);

      process.on('SIGINT', () => {
        console.log('\n\x1b[90mStopped watching room.\x1b[0m');
        process.exit(0);
      });

      for await (const msg of client.rooms.watch(room, { since })) {
        const sender = msg.did ? `\x1b[32m<${msg.did.substring(0, 14)}...>\x1b[0m` : `\x1b[33m<${msg.from}>\x1b[0m`;
        console.log(`\x1b[90m[${new Date().toLocaleTimeString()}]\x1b[0m [seq: ${msg.seq}] ${sender} ${msg.text}`);
      }
      break;
    }

    case 'proof': {
      printHeader();
      let identity = getLoadedOrFreshIdentity();
      if (!identity) {
        identity = createAgentIdentity();
        saveIdentityToFile(identity);
      }
      const workflow = parseArgValue(args, '--workflow') || 'agent-kit-core-integration';
      const proof = generateContributionProof({ identity, workflow });
      const valid = verifyContributionProof(proof);

      console.log(`\x1b[32m✔ Deterministic Contribution Proof Generated (Verified: ${valid})\x1b[0m\n`);
      console.log(JSON.stringify(proof, null, 2));
      console.log(`\n\x1b[90mNote: Zero secrets or tokens are contained in this public proof.\x1b[0m`);
      break;
    }

    default:
      console.log(`\x1b[31mUnknown command:\x1b[0m ${command}`);
      printHelp();
      break;
  }
}

main().catch((err) => {
  console.error(`\x1b[31mFatal Error:\x1b[0m`, err);
  process.exit(1);
});
