import {describe, expect, it} from 'vitest';
import {parseLambda} from './parser';
import {formatLambda} from './reducer';

describe('parseLambda', () => {
  it('parses consecutive abstraction parameters', () => {
    const term = parseLambda('λxy.x y');
    expect(formatLambda(term)).toBe('λxy.x y');
  });

  it('treats application as left associative', () => {
    const term = parseLambda('a b c');
    expect(term.kind).toBe('application');

    if (term.kind === 'application') {
      expect(term.functionTerm.kind).toBe('application');
    }
  });

  it('accepts a backslash as lambda', () => {
    expect(formatLambda(parseLambda('\\x.x'))).toBe('λx.x');
  });

  it('reports the location of invalid characters', () => {
    expect(() => parseLambda('λx.x @ y')).toThrow('Unexpected character “@”');
  });
});
