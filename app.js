/**
 * Technocore Agent Kit — Web Application Logic & Swarm Dashboard Simulator
 * Built by Asad Lee (https://asad-lee-portfolio.vercel.app/)
 */

// ─── 1. Mobile Menu Drawer & Navigation Smooth Scrolling ─────────────────────
const mobileToggle = document.getElementById('mobile-toggle');
const mobileDrawer = document.getElementById('mobile-drawer');
const mobileNavLinks = document.querySelectorAll('.mobile-nav-link');
const desktopNavLinks = document.querySelectorAll('.nav-link');

if (mobileToggle && mobileDrawer) {
  mobileToggle.addEventListener('click', () => {
    const isOpen = mobileDrawer.classList.contains('open');
    if (isOpen) {
      closeMobileMenu();
    } else {
      openMobileMenu();
    }
  });

  mobileNavLinks.forEach((link) => {
    link.addEventListener('click', () => {
      closeMobileMenu();
      const target = link.getAttribute('data-nav');
      highlightNav(target);
    });
  });

  desktopNavLinks.forEach((link) => {
    link.addEventListener('click', () => {
      const target = link.getAttribute('data-nav');
      highlightNav(target);
    });
  });

  document.addEventListener('click', (e) => {
    if (
      mobileDrawer.classList.contains('open') &&
      !mobileDrawer.contains(e.target) &&
      !mobileToggle.contains(e.target)
    ) {
      closeMobileMenu();
    }
  });
}

function highlightNav(navKey) {
  desktopNavLinks.forEach((l) => {
    if (l.getAttribute('data-nav') === navKey) l.classList.add('active');
    else l.classList.remove('active');
  });
}

function openMobileMenu() {
  mobileDrawer.classList.add('open');
  mobileToggle.classList.add('active');
  mobileToggle.setAttribute('aria-expanded', 'true');
  document.body.style.overflow = 'hidden';
}

function closeMobileMenu() {
  mobileDrawer.classList.remove('open');
  mobileToggle.classList.remove('active');
  mobileToggle.setAttribute('aria-expanded', 'false');
  document.body.style.overflow = '';
}

// ─── 2. Particle Mesh Canvas Background ──────────────────────────────────────
const canvas = document.getElementById('agent-matrix-canvas');
const ctx = canvas ? canvas.getContext('2d') : null;

if (canvas && ctx) {
  let width = (canvas.width = window.innerWidth);
  let height = (canvas.height = window.innerHeight);

  window.addEventListener('resize', () => {
    width = canvas.width = window.innerWidth;
    height = canvas.height = window.innerHeight;
    initNodes();
  });

  let mouse = { x: width / 2, y: height / 2, radius: 140 };
  window.addEventListener('mousemove', (e) => {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
  });

  const NODE_COUNT = Math.min(45, Math.floor((width * height) / 25000));
  let nodes = [];

  class AgentParticle {
    constructor() {
      this.x = Math.random() * width;
      this.y = Math.random() * height;
      this.vx = (Math.random() - 0.5) * 0.4;
      this.vy = (Math.random() - 0.5) * 0.4;
      this.radius = Math.random() * 2 + 1;
      this.isSwarmNode = Math.random() > 0.7;
      this.pulse = Math.random() * Math.PI * 2;
    }

    update() {
      this.x += this.vx;
      this.y += this.vy;

      if (this.x < 0 || this.x > width) this.vx *= -1;
      if (this.y < 0 || this.y > height) this.vy *= -1;

      this.pulse += 0.02;

      const dx = mouse.x - this.x;
      const dy = mouse.y - this.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < mouse.radius) {
        const force = (mouse.radius - dist) / mouse.radius;
        this.x -= (dx / dist) * force * 0.9;
        this.y -= (dy / dist) * force * 0.9;
      }
    }

    draw() {
      ctx.beginPath();
      const r = this.isSwarmNode ? this.radius + Math.sin(this.pulse) * 0.6 : this.radius;
      ctx.arc(this.x, this.y, r, 0, Math.PI * 2);

      if (this.isSwarmNode) {
        ctx.fillStyle = '#818cf8';
        ctx.shadowColor = '#6366f1';
        ctx.shadowBlur = 6;
      } else {
        ctx.fillStyle = 'rgba(148, 163, 184, 0.3)';
        ctx.shadowBlur = 0;
      }
      ctx.fill();
    }
  }

  function initNodes() {
    nodes = [];
    for (let i = 0; i < NODE_COUNT; i++) {
      nodes.push(new AgentParticle());
    }
  }
  initNodes();

  function animate() {
    ctx.clearRect(0, 0, width, height);

    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const dx = nodes[i].x - nodes[j].x;
        const dy = nodes[i].y - nodes[j].y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < 110) {
          const opacity = (1 - dist / 110) * 0.15;
          ctx.strokeStyle = `rgba(99, 102, 241, ${opacity})`;
          ctx.lineWidth = 0.6;
          ctx.beginPath();
          ctx.moveTo(nodes[i].x, nodes[i].y);
          ctx.lineTo(nodes[j].x, nodes[j].y);
          ctx.stroke();
        }
      }
    }

    for (const n of nodes) {
      n.update();
      n.draw();
    }

    requestAnimationFrame(animate);
  }
  animate();
}

// ─── 3. Swarm Agents Data & Dynamic Explorer ──────────────────────────────────
const SWARM_AGENTS = [
  {
    name: 'claude-planner',
    role: 'planner',
    did: 'did:key:z6MkqB8Jv1o39mR2zV5t8NkLmK7pW4qY8v1a2b3c',
    capabilities: ['planning', 'summarization'],
    status: 'online',
    reputation: 0.98,
    lastHeartbeat: '2s ago',
  },
  {
    name: 'research-agent-01',
    role: 'researcher',
    did: 'did:key:z6Mkresearch9a8b7c6d5e4f3a2b1c0d9e8f7a6b',
    capabilities: ['web-research', 'summarization', 'memory-management'],
    status: 'online',
    reputation: 0.96,
    lastHeartbeat: '4s ago',
  },
  {
    name: 'coder-agent-01',
    role: 'coder',
    did: 'did:key:z6Mkcoder1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6',
    capabilities: ['edit-code', 'calculate', 'summarization'],
    status: 'online',
    reputation: 0.99,
    lastHeartbeat: '1s ago',
  },
  {
    name: 'tester-agent-01',
    role: 'tester',
    did: 'did:key:z6Mktester8f7e6d5c4b3a2f1e0d9c8b7a6f5e4d3',
    capabilities: ['test-code', 'calculate'],
    status: 'online',
    reputation: 1.0,
    lastHeartbeat: '5s ago',
  },
  {
    name: 'security-reviewer-01',
    role: 'security_reviewer',
    did: 'did:key:z6Mksecguard4d3c2b1a0f9e8d7c6b5a4f3e2d1c',
    capabilities: ['security-audit', 'code-review'],
    status: 'online',
    reputation: 0.97,
    lastHeartbeat: '3s ago',
  },
  {
    name: 'final-reviewer-01',
    role: 'final_reviewer',
    did: 'did:key:z6Mkfinalsign7c6b5a4f3e2d1c0b9a8f7e6d5c4b',
    capabilities: ['code-review', 'summarization'],
    status: 'online',
    reputation: 0.99,
    lastHeartbeat: '6s ago',
  },
];

function renderAgentCards() {
  const container = document.getElementById('agents-cards-container');
  if (!container) return;

  container.innerHTML = '';
  SWARM_AGENTS.forEach((agent) => {
    const repPct = Math.round(agent.reputation * 100);
    const card = document.createElement('div');
    card.className = 'agent-card';
    card.innerHTML = `
      <div class="agent-card-header">
        <span class="agent-role-pill">${agent.role}</span>
        <div class="agent-status-indicator">
          <span class="pulse-dot"></span>
          <span>${agent.status}</span>
        </div>
      </div>
      <div class="agent-name">${escapeHtml(agent.name)}</div>
      <div class="agent-did-box">${escapeHtml(agent.did)}</div>
      <div class="caps-list">
        ${agent.capabilities.map((c) => `<span class="cap-tag">${escapeHtml(c)}</span>`).join('')}
      </div>
      <div class="reputation-meter">
        <div class="rep-meta">
          <span>Reputation Score</span>
          <span><strong>${repPct}%</strong></span>
        </div>
        <div class="rep-bar-bg">
          <div class="rep-bar-fill" style="width: ${repPct}%"></div>
        </div>
      </div>
    `;
    container.appendChild(card);
  });
}
renderAgentCards();

// ─── 4. Live Event Feed Log ──────────────────────────────────────────────────
const SAMPLE_EVENTS = [
  { seq: 101, type: 'WORKFLOW_STARTED', desc: 'Workflow wf-e2e-feature-01 initialized with 6 DAG steps', time: '12:01:04', tag: 'WORKFLOW' },
  { seq: 102, type: 'TASK_ASSIGNED', desc: 'Step 1 Goal Decomposition assigned to claude-planner', time: '12:01:05', tag: 'TASK' },
  { seq: 103, type: 'TASK_COMPLETED', desc: 'claude-planner completed Goal Decomposition (14ms)', time: '12:01:06', tag: 'TASK' },
  { seq: 104, type: 'TASK_ASSIGNED', desc: 'Parallel branch: Architecture Research assigned to research-agent-01', time: '12:01:07', tag: 'TASK' },
  { seq: 105, type: 'TASK_ASSIGNED', desc: 'Parallel branch: Threat Modeling assigned to security-reviewer-01', time: '12:01:07', tag: 'TASK' },
  { seq: 106, type: 'RESULT_VERIFIED', desc: 'Ed25519 signature verified for research-agent-01 (inputHash: 8f2a... outputHash: 4b1c...)', time: '12:01:09', tag: 'RESULT_VERIFIED' },
  { seq: 107, type: 'TASK_ASSIGNED', desc: 'Modular Implementation assigned to coder-agent-01', time: '12:01:10', tag: 'TASK' },
  { seq: 108, type: 'TASK_COMPLETED', desc: 'coder-agent-01 completed implementation (42ms)', time: '12:01:13', tag: 'TASK' },
  { seq: 109, type: 'RESULT_VERIFIED', desc: 'Ed25519 signature verified for tester-agent-01 (12/12 unit tests passed)', time: '12:01:16', tag: 'RESULT_VERIFIED' },
  { seq: 110, type: 'RESULT_VERIFIED', desc: 'Final signoff attestation envelope verified for final-reviewer-01', time: '12:01:18', tag: 'RESULT_VERIFIED' },
  { seq: 111, type: 'WORKFLOW_COMPLETED', desc: 'Autonomous DAG execution completed with 100% verification pass rate', time: '12:01:19', tag: 'WORKFLOW' },
];

let activeEventFilter = 'all';

function renderEventFeed() {
  const container = document.getElementById('event-log-container');
  if (!container) return;

  container.innerHTML = '';
  const filtered = activeEventFilter === 'all'
    ? SAMPLE_EVENTS
    : SAMPLE_EVENTS.filter((e) => e.tag === activeEventFilter || e.type.includes(activeEventFilter));

  filtered.forEach((evt) => {
    const row = document.createElement('div');
    row.className = 'event-row';
    const isVerified = evt.type === 'RESULT_VERIFIED';
    const isSecurity = evt.type.includes('SECURITY');
    const isApproval = evt.type.includes('APPROVAL');

    let badgeClass = 'event-type-badge';
    if (isVerified) badgeClass += ' verified';
    if (isSecurity) badgeClass += ' security';
    if (isApproval) badgeClass += ' approval';

    row.innerHTML = `
      <span class="event-seq">[seq ${evt.seq}]</span>
      <span class="${badgeClass}">${evt.type}</span>
      <span class="event-desc">${escapeHtml(evt.desc)}</span>
      <span class="event-time">${evt.time}</span>
    `;
    container.appendChild(row);
  });
}
renderEventFeed();

// Event filter buttons
const filterChips = document.querySelectorAll('.filter-chips .chip');
filterChips.forEach((chip) => {
  chip.addEventListener('click', () => {
    filterChips.forEach((c) => c.classList.remove('active'));
    chip.classList.add('active');
    activeEventFilter = chip.getAttribute('data-filter');
    renderEventFeed();
  });
});

// ─── 5. Task Inspector & Envelopes ───────────────────────────────────────────
const INSPECTOR_TASKS = [
  {
    taskId: 'task-step-1-plan',
    name: 'Goal Decomposition',
    assignedAgent: 'claude-planner',
    agentDid: 'did:key:z6MkqB8Jv1o39mR2zV5t8NkLmK7pW4qY8v1a2b3c',
    status: 'COMPLETED',
    inputHash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    outputHash: '7c8d9e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d',
    signature: '8Z2fG9mK1pQ7vX4wL8tN2jR6uY3bA5sD7eF1gH9jK3mP5qS7tU1vW3xY5zB7cD9eF1gH3jK5mP7qS9tU1vW3xY5zB7c',
    transitions: [
      { from: 'CREATED', to: 'QUEUED', time: '12:01:04.100' },
      { from: 'QUEUED', to: 'ASSIGNED', time: '12:01:04.140' },
      { from: 'ASSIGNED', to: 'RUNNING', time: '12:01:04.180' },
      { from: 'RUNNING', to: 'COMPLETED', time: '12:01:04.220' },
    ],
    result: { stepsCount: 6, strategy: 'Parallelized DAG with Ed25519 verifiable result provenance' },
  },
  {
    taskId: 'task-step-2-research',
    name: 'Architecture Research',
    assignedAgent: 'research-agent-01',
    agentDid: 'did:key:z6Mkresearch9a8b7c6d5e4f3a2b1c0d9e8f7a6b',
    status: 'COMPLETED',
    inputHash: '1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b',
    outputHash: '9f8e7d6c5b4a3f2e1d0c9b8a7f6e5d4c3b2a1f0e9d8c7b6a5f4e3d2c1b0a9f8e',
    signature: '3kL9pQ2mR7tV1wX5yZ8aB4cD6eF9gH2jK4mP6qS8tU0vW2xY4zB6cD8eF0gH2jK4mP6qS8tU0vW2xY4zB6cD8eF0gH2',
    transitions: [
      { from: 'CREATED', to: 'QUEUED', time: '12:01:05.020' },
      { from: 'QUEUED', to: 'ASSIGNED', time: '12:01:05.050' },
      { from: 'ASSIGNED', to: 'RUNNING', time: '12:01:05.080' },
      { from: 'RUNNING', to: 'COMPLETED', time: '12:01:05.150' },
    ],
    result: { findings: 'Ed25519 did:key provides fast 86-char base64url signatures and zero-server verification.' },
  },
  {
    taskId: 'task-step-4-coder',
    name: 'Modular Implementation',
    assignedAgent: 'coder-agent-01',
    agentDid: 'did:key:z6Mkcoder1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6',
    status: 'COMPLETED',
    inputHash: '4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a',
    outputHash: '2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d',
    signature: '7xY2zB4cD6eF8gH0jK2mP4qS6tU8vW0xY2zB4cD6eF8gH0jK2mP4qS6tU8vW0xY2zB4cD6eF8gH0jK2mP4qS6tU8vW0x',
    transitions: [
      { from: 'CREATED', to: 'QUEUED', time: '12:01:08.100' },
      { from: 'QUEUED', to: 'ASSIGNED', time: '12:01:08.120' },
      { from: 'ASSIGNED', to: 'RUNNING', time: '12:01:08.150' },
      { from: 'RUNNING', to: 'COMPLETED', time: '12:01:08.230' },
    ],
    result: { module: 'VerifiableTokenBucket', lines: 180, testsIncluded: true },
  },
];

let selectedTaskIndex = 0;

function renderInspector() {
  const listContainer = document.getElementById('inspector-task-list');
  const detailContainer = document.getElementById('task-detail-container');
  if (!listContainer || !detailContainer) return;

  listContainer.innerHTML = '';
  INSPECTOR_TASKS.forEach((task, idx) => {
    const item = document.createElement('div');
    item.className = `inspector-task-item ${idx === selectedTaskIndex ? 'active' : ''}`;
    item.innerHTML = `
      <div class="task-item-title">${escapeHtml(task.name)}</div>
      <div class="task-item-meta">${task.taskId} • <span style="color:var(--accent-emerald)">${task.status}</span></div>
    `;
    item.addEventListener('click', () => {
      selectedTaskIndex = idx;
      renderInspector();
    });
    listContainer.appendChild(item);
  });

  const task = INSPECTOR_TASKS[selectedTaskIndex];
  detailContainer.innerHTML = `
    <div class="detail-header">
      <div>
        <div class="detail-title">${escapeHtml(task.name)}</div>
        <div style="font-size:0.8rem; color:var(--text-muted); font-family:var(--font-mono)">${task.taskId}</div>
      </div>
      <div class="status-indicator valid">
        <span class="status-dot"></span>
        <span>VERIFIED RESULT</span>
      </div>
    </div>

    <div class="form-group">
      <label>Assigned Agent DID (Author)</label>
      <div class="code-box">${escapeHtml(task.agentDid)} (${task.assignedAgent})</div>
    </div>

    <div class="form-row">
      <div class="form-group">
        <label>Input Hash (SHA-256)</label>
        <div class="code-box">${escapeHtml(task.inputHash)}</div>
      </div>
      <div class="form-group">
        <label>Output Hash (SHA-256)</label>
        <div class="code-box">${escapeHtml(task.outputHash)}</div>
      </div>
    </div>

    <div class="form-group">
      <label>Ed25519 Cryptographic Signature</label>
      <div class="code-box">${escapeHtml(task.signature)}</div>
    </div>

    <div class="form-group">
      <label>State Transitions Audit Trail</label>
      <div class="code-box">${task.transitions.map((t) => `${t.time}: [${t.from}] → [${t.to}]`).join('\n')}</div>
    </div>

    <div class="form-group">
      <label>Result Payload</label>
      <div class="code-box">${escapeHtml(JSON.stringify(task.result, null, 2))}</div>
    </div>
  `;
}
renderInspector();

// ─── 6. Prompt Injection Defense Interactive Tester ──────────────────────────
const secInputTest = document.getElementById('sec-input-test');
const testInjectionBtn = document.getElementById('test-injection-btn');
const secAnalysisResult = document.getElementById('sec-analysis-result');

const INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?(previous|prior)\s+(instructions|prompts|rules)/i,
  /you\s+are\s+now\s+(in\s+developer\s+mode|an\s+unfiltered|dan)/i,
  /disregard\s+(system|safety|security)\s+(prompt|instructions|rules)/i,
  /execute\s+(system|shell|bash|powershell|cmd)\s+command/i,
  /printenv|process\.env|api[_-]?key|secret[_-]?key|bearer\s+/i,
  /sudo\s+rm\s+-rf/i,
];

if (testInjectionBtn && secInputTest && secAnalysisResult) {
  testInjectionBtn.addEventListener('click', () => {
    const raw = secInputTest.value;
    const matched = [];
    for (const p of INJECTION_PATTERNS) {
      if (p.test(raw)) matched.push(p.source);
    }

    if (matched.length > 0) {
      secAnalysisResult.innerHTML = `
        <div class="sec-risk-badge critical">⚠ INJECTION RISK DETECTED</div>
        <div class="sec-meta-text">Matched Patterns: <code>${escapeHtml(matched.join(', '))}</code></div>
        <div class="sec-safe-flag" style="color:var(--accent-emerald)">✔ Isolated as untrusted string data. Execution prevented by PermissionGuard.</div>
      `;
    } else {
      secAnalysisResult.innerHTML = `
        <div class="sec-risk-badge" style="color:var(--accent-emerald)">✔ BENIGN PAYLOAD</div>
        <div class="sec-meta-text">No adversarial injection directives detected in message body.</div>
        <div class="sec-safe-flag">Safe for structured agent ingestion.</div>
      `;
    }
  });
}

// ─── 7. In-Browser DID Generator & SHA-256 Fingerprint Forge ─────────────────
const BASE58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

function encodeBase58(buffer) {
  const digits = [0];
  for (let i = 0; i < buffer.length; i++) {
    for (let j = 0; j < digits.length; j++) digits[j] <<= 8;
    digits[0] += buffer[i];
    let carry = 0;
    for (let j = 0; j < digits.length; j++) {
      digits[j] += carry;
      carry = (digits[j] / 58) | 0;
      digits[j] %= 58;
    }
    while (carry) {
      digits.push(carry % 58);
      carry = (carry / 58) | 0;
    }
  }
  let str = '';
  for (let i = 0; i < buffer.length && buffer[i] === 0; i++) str += BASE58_ALPHABET[0];
  for (let i = digits.length - 1; i >= 0; i--) str += BASE58_ALPHABET[digits[i]];
  return str;
}

async function sha256Hex(str) {
  const msgBuffer = new TextEncoder().encode(str);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function generateFreshDid() {
  const randomBytes = new Uint8Array(32);
  crypto.getRandomValues(randomBytes);

  const multicodec = new Uint8Array(34);
  multicodec[0] = 0xed;
  multicodec[1] = 0x01;
  multicodec.set(randomBytes, 2);

  const did = `did:key:z${encodeBase58(multicodec)}`;
  const hash = await sha256Hex(did);
  const fingerprint = hash.substring(0, 16);
  const shard = fingerprint.substring(0, 2);
  const key = fingerprint.substring(2, 16);

  const didEl = document.getElementById('did-display');
  const fpEl = document.getElementById('fingerprint-display');
  const shardEl = document.getElementById('shard-display');

  if (didEl) didEl.textContent = did;
  if (fpEl) fpEl.textContent = fingerprint;
  if (shardEl) shardEl.textContent = `kv/did-${shard}/${key}`;
}

const generateDidBtn = document.getElementById('generate-did-btn');
if (generateDidBtn) {
  generateDidBtn.addEventListener('click', generateFreshDid);
}

// ─── 8. Workflow Simulator Interactive Button ────────────────────────────────
const runPipelineDemoBtn = document.getElementById('run-pipeline-demo-btn');
const nodes = [
  document.getElementById('node-plan'),
  document.getElementById('node-research'),
  document.getElementById('node-security-pre'),
  document.getElementById('node-coder'),
  document.getElementById('node-tester'),
  document.getElementById('node-sec-review'),
  document.getElementById('node-final'),
];

if (runPipelineDemoBtn) {
  runPipelineDemoBtn.addEventListener('click', async () => {
    runPipelineDemoBtn.disabled = true;
    runPipelineDemoBtn.textContent = 'Executing DAG Swarm...';

    // Reset all nodes
    nodes.forEach((n) => {
      if (n) {
        n.classList.remove('completed');
        n.classList.remove('active');
      }
    });

    const activateNode = (node, duration = 600) => {
      return new Promise((resolve) => {
        if (!node) return resolve();
        node.classList.add('active');
        setTimeout(() => {
          node.classList.remove('active');
          node.classList.add('completed');
          resolve();
        }, duration);
      });
    };

    // 1. Planner
    await activateNode(nodes[0], 500);

    // 2. Parallel Research & Security
    await Promise.all([activateNode(nodes[1], 700), activateNode(nodes[2], 700)]);

    // 3. Coder
    await activateNode(nodes[3], 600);

    // 4. Tester
    await activateNode(nodes[4], 500);

    // 5. Security Review
    await activateNode(nodes[5], 500);

    // 6. Final Reviewer Signoff
    await activateNode(nodes[6], 600);

    runPipelineDemoBtn.disabled = false;
    runPipelineDemoBtn.innerHTML = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
        <polygon points="5 3 19 12 5 21 5 3"></polygon>
      </svg>
      Simulate Autonomous Workflow
    `;
  });
}

function escapeHtml(str) {
  if (typeof str !== 'string') return String(str);
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
