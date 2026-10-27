/**
 * Safe arithmetic evaluator — no eval / Function.
 * Supports +, -, *, /, %, parentheses, unary minus, and decimals.
 */
export function calculate(expression: string): number {
  const cleaned = expression.replace(/\s+/g, '');
  if (!cleaned) throw new Error('Empty expression');
  if (!/^[0-9+\-*/().%]+$/.test(cleaned)) {
    throw new Error('Expression contains invalid characters');
  }
  if (cleaned.length > 200) throw new Error('Expression too long');

  let i = 0;

  function peek(): string {
    return cleaned[i] ?? '';
  }
  function consume(): string {
    return cleaned[i++] ?? '';
  }

  function parseExpression(): number {
    let value = parseTerm();
    while (peek() === '+' || peek() === '-') {
      const op = consume();
      const right = parseTerm();
      value = op === '+' ? value + right : value - right;
    }
    return value;
  }

  function parseTerm(): number {
    let value = parseUnary();
    while (peek() === '*' || peek() === '/' || peek() === '%') {
      const op = consume();
      const right = parseUnary();
      if (op === '*') value *= right;
      else if (op === '/') {
        if (right === 0) throw new Error('Division by zero');
        value /= right;
      } else {
        if (right === 0) throw new Error('Modulo by zero');
        value %= right;
      }
    }
    return value;
  }

  function parseUnary(): number {
    if (peek() === '-') {
      consume();
      return -parseUnary();
    }
    if (peek() === '+') {
      consume();
      return parseUnary();
    }
    return parsePrimary();
  }

  function parsePrimary(): number {
    if (peek() === '(') {
      consume();
      const value = parseExpression();
      if (peek() !== ')') throw new Error('Mismatched parentheses');
      consume();
      return value;
    }
    const start = i;
    while (/[0-9.]/.test(peek())) consume();
    if (start === i) throw new Error('Expected number');
    const num = Number(cleaned.slice(start, i));
    if (!Number.isFinite(num)) throw new Error('Invalid number');
    return num;
  }

  const result = parseExpression();
  if (i !== cleaned.length) throw new Error('Unexpected trailing characters');
  if (!Number.isFinite(result)) throw new Error('Non-finite result');
  return result;
}
