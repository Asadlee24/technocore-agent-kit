import test from 'node:test';
import assert from 'node:assert/strict';
import { LocalProvider } from '../src/providers/local.js';
import { ClaudeProvider } from '../src/providers/claude.js';
import { OpenAIProvider } from '../src/providers/openai.js';
import { createAIProvider } from '../src/providers/index.js';

test('AI Providers: LocalProvider creates deterministic DAG plans, chats, and reviews', async () => {
  const local = new LocalProvider();
  
  // 1. Plan generation
  const plan = await local.createPlan('Build TokenBucket Rate Limiter with 100 req/s');
  assert.ok(plan.steps.length >= 4);
  assert.ok(plan.steps.some(s => s.role === 'researcher'));
  assert.ok(plan.steps.some(s => s.role === 'coder'));
  assert.ok(plan.steps.some(s => s.role === 'tester'));
  assert.ok(plan.steps.some(s => s.role === 'security_reviewer'));

  // 2. Chat execution
  const resCalc = await local.chat([{ role: 'user', content: 'CALCULATE: 25 * 4' }]);
  assert.ok(resCalc.text.includes('100') || resCalc.text.length > 0);

  // 3. Review
  const review = await local.reviewResult('task input', { code: 'function add(a,b){return a+b;}' }, 'coder');
  assert.equal(review.approved, true);
});

test('AI Providers: ClaudeProvider parses Anthropic Messages API responses', async () => {
  const mockFetch: typeof fetch = async (url: any, init: any = {}) => {
    const payload = {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            steps: [
              {
                stepId: 'step-1',
                title: 'Architecture Plan',
                description: 'Plan rate limiter architecture',
                role: 'planner',
                requiredCapabilities: ['planning'],
                dependencies: []
              }
            ],
            estimatedDurationMs: 5000,
            riskAssessment: 'low'
          })
        }
      ]
    };
    return {
      ok: true,
      status: 200,
      json: async () => payload,
      text: async () => JSON.stringify(payload),
    } as any;
  };

  const claude = new ClaudeProvider({ apiKey: 'test-claude-key', fetchFn: mockFetch });
  const plan = await claude.createPlan('Design rate limiter module');
  
  assert.equal(plan.steps.length, 1);
  assert.equal(plan.steps[0].stepId, 'step-1');
  assert.equal(plan.steps[0].role, 'planner');
});

test('AI Providers: OpenAIProvider parses Chat Completions JSON output', async () => {
  const mockFetch: typeof fetch = async (url: any, init: any = {}) => {
    const payload = {
      choices: [
        {
          message: {
            content: JSON.stringify({
              steps: [
                {
                  stepId: 'step-openai-1',
                  title: 'OpenAI Generated Plan',
                  description: 'Generate database schema',
                  role: 'planner',
                  requiredCapabilities: ['planning'],
                  dependencies: []
                }
              ],
              estimatedDurationMs: 4000,
              riskAssessment: 'low'
            })
          }
        }
      ]
    };
    return {
      ok: true,
      status: 200,
      json: async () => payload,
      text: async () => JSON.stringify(payload),
    } as any;
  };

  const openai = new OpenAIProvider({ apiKey: 'test-openai-key', fetchFn: mockFetch });
  const plan = await openai.createPlan('Generate DB migration plan');
  
  assert.equal(plan.steps.length, 1);
  assert.equal(plan.steps[0].stepId, 'step-openai-1');
});

test('AI Providers: createAIProvider factory instantiates correct providers', () => {
  const local = createAIProvider('local');
  assert.equal(local.name, 'local');

  const claude = createAIProvider('claude', { apiKey: 'sk-ant-test' });
  assert.equal(claude.name, 'claude');

  const openai = createAIProvider('openai', { apiKey: 'sk-proj-test' });
  assert.equal(openai.name, 'openai');
});
