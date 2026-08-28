import test from 'node:test';
import assert from 'node:assert';
import { evaluateMathExpression, processTask } from '../src/tasks/index.js';

test('evaluateMathExpression computes basic arithmetic and precedence', () => {
  assert.strictEqual(evaluateMathExpression('25 * 4'), 100);
  assert.strictEqual(evaluateMathExpression('100 / 4'), 25);
  assert.strictEqual(evaluateMathExpression('50 + 25'), 75);
  assert.strictEqual(evaluateMathExpression('100 - 45'), 55);
  assert.strictEqual(evaluateMathExpression('2 + 3 * 4'), 14);
  assert.strictEqual(evaluateMathExpression('(2 + 3) * 4'), 20);
  assert.strictEqual(evaluateMathExpression('2 ^ 8'), 256);
  assert.strictEqual(evaluateMathExpression('2 ** 3'), 8);
  assert.strictEqual(evaluateMathExpression('10 % 3'), 1);
});

test('evaluateMathExpression parses natural language math queries', () => {
  assert.strictEqual(evaluateMathExpression('25 multiplied by 4'), 100);
  assert.strictEqual(evaluateMathExpression('100 divided by 5'), 20);
  assert.strictEqual(evaluateMathExpression('50 plus 30'), 80);
  assert.strictEqual(evaluateMathExpression('90 minus 45'), 45);
});

test('evaluateMathExpression rejects invalid characters and division by zero', () => {
  assert.throws(() => evaluateMathExpression('100 / 0'), /Division by zero/);
  assert.throws(() => evaluateMathExpression('process.exit(1)'), /invalid characters/);
  assert.throws(() => evaluateMathExpression('require("fs")'), /invalid characters/);
});

test('processTask handles CALCULATE task format and natural queries', () => {
  const res1 = JSON.parse(processTask('CALCULATE: 25 * 4').replace('RESULT: ', ''));
  assert.strictEqual(res1.success, true);
  assert.strictEqual(res1.taskType, 'CALCULATE');
  assert.strictEqual(res1.result, 100);

  const res2 = JSON.parse(processTask('What is 25 multiplied by 4?').replace('RESULT: ', ''));
  assert.strictEqual(res2.success, true);
  assert.strictEqual(res2.taskType, 'CALCULATE');
  assert.strictEqual(res2.result, 100);
});

test('processTask handles WORD_COUNT task', () => {
  const res = JSON.parse(processTask('WORD_COUNT: Hello world this is Agent A').replace('RESULT: ', ''));
  assert.strictEqual(res.success, true);
  assert.strictEqual(res.taskType, 'WORD_COUNT');
  assert.strictEqual(res.result.wordCount, 6);
  assert.strictEqual(res.result.characterCount, 27);
});

test('processTask handles UPPERCASE and LOWERCASE tasks', () => {
  const resUpper = JSON.parse(processTask('UPPERCASE: hello technocore').replace('RESULT: ', ''));
  assert.strictEqual(resUpper.success, true);
  assert.strictEqual(resUpper.taskType, 'UPPERCASE');
  assert.strictEqual(resUpper.result, 'HELLO TECHNOCORE');

  const resLower = JSON.parse(processTask('LOWERCASE: HELLO TECHNOCORE').replace('RESULT: ', ''));
  assert.strictEqual(resLower.success, true);
  assert.strictEqual(resLower.taskType, 'LOWERCASE');
  assert.strictEqual(resLower.result, 'hello technocore');
});

test('processTask handles REVERSE task', () => {
  const res = JSON.parse(processTask('REVERSE: Technocore').replace('RESULT: ', ''));
  assert.strictEqual(res.success, true);
  assert.strictEqual(res.taskType, 'REVERSE');
  assert.strictEqual(res.result, 'eroconhceT');
});

test('processTask handles JSON_VALIDATE task', () => {
  const validJson = JSON.parse(processTask('JSON_VALIDATE: {"agent":"A","status":"online"}').replace('RESULT: ', ''));
  assert.strictEqual(validJson.success, true);
  assert.strictEqual(validJson.taskType, 'JSON_VALIDATE');
  assert.strictEqual(validJson.result.valid, true);
  assert.deepStrictEqual(validJson.result.keys, ['agent', 'status']);

  const invalidJson = JSON.parse(processTask('JSON_VALIDATE: {invalid_json').replace('RESULT: ', ''));
  assert.strictEqual(invalidJson.success, false);
  assert.strictEqual(invalidJson.taskType, 'JSON_VALIDATE');
  assert.ok(invalidJson.error.includes('Invalid JSON'));
});

test('processTask handles SUMMARIZE task', () => {
  const res = JSON.parse(processTask('SUMMARIZE: project=agent status=active message=completed').replace('RESULT: ', ''));
  assert.strictEqual(res.success, true);
  assert.strictEqual(res.taskType, 'SUMMARIZE');
  assert.strictEqual(res.result.extractedAttributes.project, 'agent');
  assert.strictEqual(res.result.extractedAttributes.status, 'active');
});
