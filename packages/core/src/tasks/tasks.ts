/**
 * Technocore Agent Kit — Local Task Execution Engine
 * Safe mathematical evaluation (recursive-descent), text manipulation,
 * JSON verification, and structured response formatting without external API keys.
 * Built by Asad Lee (https://asad-lee-portfolio.vercel.app/)
 */

export interface TaskResultEnvelope {
  success: boolean;
  taskType: string;
  result?: any;
  error?: string;
  input?: string;
  processedAt: string;
}

/**
 * Safe recursive-descent math expression parser & evaluator.
 * Strictly avoids eval(), Function constructor, or any shell/code execution.
 */
export function evaluateMathExpression(expr: string): number {
  // Normalize common natural math phrasing
  let clean = expr
    .replace(/multiplied\s+by|times/gi, '*')
    .replace(/divided\s+by|over/gi, '/')
    .replace(/plus/gi, '+')
    .replace(/minus/gi, '-')
    .replace(/\^/g, '**')
    .replace(/,/g, '') // remove digit group commas like 1,000
    .trim();

  // Validate allowed characters: 0-9, ., +, -, *, /, %, (, ), spaces
  if (!/^[\d\s+\-*/%().*]+$/.test(clean)) {
    throw new Error('Expression contains invalid characters');
  }

  // Tokenize
  const tokens: string[] = [];
  const tokenRegex = /(\d+\.?\d*|\*\*|[+\-*/%()])/g;
  let match;
  while ((match = tokenRegex.exec(clean)) !== null) {
    tokens.push(match[1]);
  }

  if (tokens.length === 0) {
    throw new Error('Empty mathematical expression');
  }

  let index = 0;

  function peek(): string | undefined {
    return tokens[index];
  }

  function consume(expected?: string): string {
    const token = tokens[index++];
    if (expected && token !== expected) {
      throw new Error(`Expected '${expected}' but got '${token}'`);
    }
    return token;
  }

  function parseExpr(): number {
    let result = parseTerm();
    while (peek() === '+' || peek() === '-') {
      const op = consume();
      const right = parseTerm();
      if (op === '+') result += right;
      else result -= right;
    }
    return result;
  }

  function parseTerm(): number {
    let result = parsePower();
    while (peek() === '*' || peek() === '/' || peek() === '%') {
      const op = consume();
      const right = parsePower();
      if (op === '*') result *= right;
      else if (op === '/') {
        if (right === 0) throw new Error('Division by zero');
        result /= right;
      } else if (op === '%') {
        if (right === 0) throw new Error('Modulo by zero');
        result %= right;
      }
    }
    return result;
  }

  function parsePower(): number {
    let base = parseFactor();
    if (peek() === '**') {
      consume();
      const exp = parsePower();
      return Math.pow(base, exp);
    }
    return base;
  }

  function parseFactor(): number {
    if (peek() === '+') {
      consume();
      return parseFactor();
    }
    if (peek() === '-') {
      consume();
      return -parseFactor();
    }
    return parsePrimary();
  }

  function parsePrimary(): number {
    const token = peek();
    if (!token) throw new Error('Unexpected end of expression');

    if (token === '(') {
      consume('(');
      const val = parseExpr();
      consume(')');
      return val;
    }

    const num = parseFloat(consume());
    if (isNaN(num)) throw new Error(`Invalid number '${token}'`);
    return num;
  }

  const result = parseExpr();
  if (index < tokens.length) {
    throw new Error(`Unexpected trailing token '${tokens[index]}'`);
  }
  return result;
}

/**
 * Local task processor for Autonomous Agent workers.
 * Solves math calculations, text processing, JSON validation, and summarization
 * without requiring external API keys.
 */
export function processTask(taskText: string): string {
  const trimmed = taskText.trim();
  const now = new Date().toISOString();

  // 1. Check for explicit command prefixes (e.g. "CALCULATE: ...")
  const prefixMatch = trimmed.match(/^([A-Z_]+):\s*(.*)$/s);

  if (prefixMatch) {
    const command = prefixMatch[1].toUpperCase();
    const payload = prefixMatch[2].trim();

    switch (command) {
      case 'CALCULATE':
      case 'CALC':
      case 'MATH': {
        try {
          const numResult = evaluateMathExpression(payload);
          const response: TaskResultEnvelope = {
            success: true,
            taskType: 'CALCULATE',
            result: numResult,
            input: payload,
            processedAt: now,
          };
          return `RESULT: ${JSON.stringify(response)}`;
        } catch (err: any) {
          const response: TaskResultEnvelope = {
            success: false,
            taskType: 'CALCULATE',
            error: err.message,
            input: payload,
            processedAt: now,
          };
          return `RESULT: ${JSON.stringify(response)}`;
        }
      }

      case 'WORD_COUNT':
      case 'COUNT_WORDS': {
        const words = payload.split(/\s+/).filter(Boolean);
        const characters = payload.length;
        const charactersNoSpaces = payload.replace(/\s/g, '').length;
        const lines = payload.split(/\r?\n/).filter(Boolean).length || (payload.length > 0 ? 1 : 0);
        const sentences = payload.split(/[.!?]+/).filter((s) => s.trim().length > 0).length;

        const response: TaskResultEnvelope = {
          success: true,
          taskType: 'WORD_COUNT',
          result: {
            wordCount: words.length,
            characterCount: characters,
            characterCountNoSpaces: charactersNoSpaces,
            lineCount: lines,
            sentenceCount: sentences,
          },
          processedAt: now,
        };
        return `RESULT: ${JSON.stringify(response)}`;
      }

      case 'UPPERCASE':
      case 'TO_UPPER': {
        const response: TaskResultEnvelope = {
          success: true,
          taskType: 'UPPERCASE',
          result: payload.toUpperCase(),
          processedAt: now,
        };
        return `RESULT: ${JSON.stringify(response)}`;
      }

      case 'LOWERCASE':
      case 'TO_LOWER': {
        const response: TaskResultEnvelope = {
          success: true,
          taskType: 'LOWERCASE',
          result: payload.toLowerCase(),
          processedAt: now,
        };
        return `RESULT: ${JSON.stringify(response)}`;
      }

      case 'REVERSE': {
        const reversed = Array.from(payload).reverse().join('');
        const response: TaskResultEnvelope = {
          success: true,
          taskType: 'REVERSE',
          result: reversed,
          processedAt: now,
        };
        return `RESULT: ${JSON.stringify(response)}`;
      }

      case 'JSON_VALIDATE':
      case 'VALIDATE_JSON': {
        try {
          const parsed = JSON.parse(payload);
          const isObj = typeof parsed === 'object' && parsed !== null;
          const response: TaskResultEnvelope = {
            success: true,
            taskType: 'JSON_VALIDATE',
            result: {
              valid: true,
              valueType: Array.isArray(parsed) ? 'array' : typeof parsed,
              keys: isObj && !Array.isArray(parsed) ? Object.keys(parsed) : undefined,
              itemCount: Array.isArray(parsed) ? parsed.length : isObj ? Object.keys(parsed).length : 1,
              byteSize: Buffer.byteLength(payload, 'utf8'),
            },
            processedAt: now,
          };
          return `RESULT: ${JSON.stringify(response)}`;
        } catch (err: any) {
          const response: TaskResultEnvelope = {
            success: false,
            taskType: 'JSON_VALIDATE',
            error: `Invalid JSON: ${err.message}`,
            processedAt: now,
          };
          return `RESULT: ${JSON.stringify(response)}`;
        }
      }

      case 'SUMMARIZE': {
        const words = payload.split(/\s+/).filter(Boolean);
        const lines = payload.split(/\r?\n/).filter(Boolean);

        const kvPairs: Record<string, string> = {};
        const kvRegex = /([a-zA-Z0-9_-]+)\s*[:=]\s*([^\s,;]+)/g;
        let kvMatch;
        while ((kvMatch = kvRegex.exec(payload)) !== null) {
          kvPairs[kvMatch[1]] = kvMatch[2];
        }

        const preview = payload.length > 100 ? `${payload.slice(0, 97)}...` : payload;

        const response: TaskResultEnvelope = {
          success: true,
          taskType: 'SUMMARIZE',
          result: {
            wordCount: words.length,
            lineCount: lines.length || 1,
            preview,
            extractedAttributes: Object.keys(kvPairs).length > 0 ? kvPairs : undefined,
          },
          processedAt: now,
        };
        return `RESULT: ${JSON.stringify(response)}`;
      }
    }
  }

  // 2. Natural language arithmetic query detection:
  // e.g. "What is 25 multiplied by 4?", "What is (10 + 5) * 3?", "Calculate 100 / 4"
  const naturalMathMatch = trimmed.match(/^(?:what\s+is|calculate|solve|evaluate)\s+(.+?)\??$/i);
  if (naturalMathMatch) {
    const rawExpr = naturalMathMatch[1].trim();
    try {
      const numResult = evaluateMathExpression(rawExpr);
      const response: TaskResultEnvelope = {
        success: true,
        taskType: 'CALCULATE',
        result: numResult,
        input: rawExpr,
        processedAt: now,
      };
      return `RESULT: ${JSON.stringify(response)}`;
    } catch (err: any) {
      // Fall through
    }
  }

  // 3. Direct math expression fallback (e.g. "25 * 4", "(100 + 50) / 2")
  if (/^[\d\s+\-*/%().*^]+$/.test(trimmed) && /\d/.test(trimmed)) {
    try {
      const numResult = evaluateMathExpression(trimmed);
      const response: TaskResultEnvelope = {
        success: true,
        taskType: 'CALCULATE',
        result: numResult,
        input: trimmed,
        processedAt: now,
      };
      return `RESULT: ${JSON.stringify(response)}`;
    } catch (err: any) {
      // Fall through
    }
  }

  // 4. Default structured fallback for custom tasks
  const response: TaskResultEnvelope = {
    success: true,
    taskType: 'CUSTOM_TEXT',
    result: `Agent B received and processed: ${trimmed}`,
    input: trimmed,
    processedAt: now,
  };
  return `RESULT: ${JSON.stringify(response)}`;
}
