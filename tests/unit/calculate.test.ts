import { describe, expect, it } from 'vitest';
import { calculate } from '../../apps/server/src/utils/calculate.js';

describe('calculate', () => {
  it('evaluates arithmetic', () => {
    expect(calculate('1+2*3')).toBe(7);
    expect(calculate('(1+2)*3')).toBe(9);
    expect(calculate('-5+2')).toBe(-3);
  });

  it('rejects invalid characters', () => {
    expect(() => calculate('1+alert(1)')).toThrow();
    expect(() => calculate('process.exit()')).toThrow();
  });

  it('rejects division by zero', () => {
    expect(() => calculate('1/0')).toThrow(/zero/);
  });
});
