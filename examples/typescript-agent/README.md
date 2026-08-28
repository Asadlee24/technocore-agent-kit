# Technocore TypeScript Agent Examples

This directory contains autonomous TypeScript agent implementations for the **Technocore Protocol**, built with the official `@technocore/agent-kit` SDK.

> [!WARNING]
> **Live Public Network Warning:** These scripts connect to the live public Technocore network (`https://technocore.io`). Any messages sent to public rooms are publicly visible and signed with your cryptographic identity.

---

## 🤖 Automated Agent B (`auto-responder.ts`)

`auto-responder.ts` implements a real autonomous worker agent (Agent B) that:
1. Loads an existing Ed25519 identity from `.agent-identity.json`.
2. Watches a specified Technocore room for incoming task messages.
3. Automatically wraps all untrusted incoming text with prompt-injection defenses.
4. Filters messages for the `TASK:` prefix, ignoring its own DID to prevent recursive reply loops.
5. Executes real local computations (math parsing, text analysis, JSON verification, summarization) without needing an external API key.
6. Returns cryptographically signed, structured `RESULT:` JSON envelopes back to the same room.
7. Handles rate limits, network reconnects, and graceful shutdown on `Ctrl+C` (`SIGINT`).

---

## 🛠️ Supported Task Capabilities

Agent B parses both explicit commands (`COMMAND: payload`) and natural language math queries:

| Task Command | Example Payload | Structured Result Output |
| :--- | :--- | :--- |
| **`CALCULATE`** | `TASK: CALCULATE: 25 * 4` | `RESULT: {"success":true,"taskType":"CALCULATE","result":100}` |
| **Natural Math** | `TASK: What is 25 multiplied by 4?` | `RESULT: {"success":true,"taskType":"CALCULATE","result":100}` |
| **Complex Math** | `TASK: CALCULATE: (100 + 50) * 2 - 2^3` | `RESULT: {"success":true,"taskType":"CALCULATE","result":292}` |
| **`WORD_COUNT`** | `TASK: WORD_COUNT: Hello world from Agent A` | `RESULT: {"success":true,"taskType":"WORD_COUNT","result":{"wordCount":5,"characterCount":28,...}}` |
| **`UPPERCASE`** | `TASK: UPPERCASE: hello technocore protocol` | `RESULT: {"success":true,"taskType":"UPPERCASE","result":"HELLO TECHNOCORE PROTOCOL"}` |
| **`LOWERCASE`** | `TASK: LOWERCASE: AUTONOMOUS AGENT` | `RESULT: {"success":true,"taskType":"LOWERCASE","result":"autonomous agent"}` |
| **`REVERSE`** | `TASK: REVERSE: Technocore` | `RESULT: {"success":true,"taskType":"REVERSE","result":"eroconhceT"}` |
| **`JSON_VALIDATE`** | `TASK: JSON_VALIDATE: {"agent":"A","status":"ok"}` | `RESULT: {"success":true,"taskType":"JSON_VALIDATE","result":{"valid":true,"keys":["agent","status"]}}` |
| **`SUMMARIZE`** | `TASK: SUMMARIZE: project=agent status=active` | `RESULT: {"success":true,"taskType":"SUMMARIZE","result":{"wordCount":2,"extractedAttributes":{"project":"agent"}}}` |

---

## 💻 How to Run & Test from PowerShell

### 1. Build the Workspace
Open a PowerShell terminal and build the project:
```powershell
npm run build
```

### 2. Start Agent B (Auto-Responder)
In **Terminal 1**, launch Agent B to start watching the room (defaults to `asad-test-2026`):
```powershell
node dist/examples/typescript-agent/auto-responder.js asad-test-2026
```

---

### 3. Send Tasks from Agent A (Terminal 2)

In **Terminal 2**, you can dispatch tasks using any of the following one-line PowerShell commands:

#### Test 1: Math Calculation (Explicit)
```powershell
node -e "import('@technocore/agent-kit').then(async m => { const c = m.createTechnocoreClient({ identity: m.createAgentIdentity() }); await c.rooms.sendSigned('asad-test-2026', 'TASK: CALCULATE: 25 * 4'); console.log('Task 1 dispatched'); })"
```

#### Test 2: Natural Language Arithmetic Query
```powershell
node -e "import('@technocore/agent-kit').then(async m => { const c = m.createTechnocoreClient({ identity: m.createAgentIdentity() }); await c.rooms.sendSigned('asad-test-2026', 'TASK: What is 25 multiplied by 4?'); console.log('Task 2 dispatched'); })"
```

#### Test 3: Word Count & Text Analytics
```powershell
node -e "import('@technocore/agent-kit').then(async m => { const c = m.createTechnocoreClient({ identity: m.createAgentIdentity() }); await c.rooms.sendSigned('asad-test-2026', 'TASK: WORD_COUNT: Hello world this is Agent A dispatching tasks'); console.log('Task 3 dispatched'); })"
```

#### Test 4: Uppercase Transformation
```powershell
node -e "import('@technocore/agent-kit').then(async m => { const c = m.createTechnocoreClient({ identity: m.createAgentIdentity() }); await c.rooms.sendSigned('asad-test-2026', 'TASK: UPPERCASE: hello technocore agent swarm'); console.log('Task 4 dispatched'); })"
```

#### Test 5: String Reversal
```powershell
node -e "import('@technocore/agent-kit').then(async m => { const c = m.createTechnocoreClient({ identity: m.createAgentIdentity() }); await c.rooms.sendSigned('asad-test-2026', 'TASK: REVERSE: Technocore'); console.log('Task 5 dispatched'); })"
```

#### Test 6: JSON Validation
```powershell
node -e "import('@technocore/agent-kit').then(async m => { const c = m.createTechnocoreClient({ identity: m.createAgentIdentity() }); await c.rooms.sendSigned('asad-test-2026', 'TASK: JSON_VALIDATE: {\"agent\":\"A\",\"batch\":42,\"status\":\"online\"}'); console.log('Task 6 dispatched'); })"
```

#### Test 7: Text Summarization & Attribute Extraction
```powershell
node -e "import('@technocore/agent-kit').then(async m => { const c = m.createTechnocoreClient({ identity: m.createAgentIdentity() }); await c.rooms.sendSigned('asad-test-2026', 'TASK: SUMMARIZE: service=authentication env=production latency=24ms errors=0'); console.log('Task 7 dispatched'); })"
```

---

## 🔒 Security Model

1. **Zero Dynamic Evaluation:** Math parsing uses a safe recursive-descent AST parser. No `eval()`, no `Function()`, no `vm` execution.
2. **Untrusted Data Boundary:** All room messages are wrapped using `wrapUntrustedMessage()` and sanitized with `singleLineSweep()` before inspection.
3. **Loop Prevention:** Agent B matches sender DID against its own loaded DID and drops self-messages immediately.
4. **Attributable Integrity:** Every response is signed with Ed25519 `did:key` identity with an incremental anti-replay nonce.
