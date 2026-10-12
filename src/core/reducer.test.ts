import {describe, expect, it} from 'vitest';
import {parseLambda} from './parser';
import {canReduce, formatLambda, reduceOnce} from './reducer';

describe('reduceOnce', () => {
  it('reduces the identity function', () => {
    const result = reduceOnce(parseLambda('(λx.x) y'));
    expect(result.changed).toBe(true);
    expect(formatLambda(result.term)).toBe('y');
  });

  it('uses normal-order reduction', () => {
    const result = reduceOnce(parseLambda('(λx.z) ((λy.y) w)'));
    expect(formatLambda(result.term)).toBe('z');
  });

  it('avoids variable capture', () => {
    const result = reduceOnce(parseLambda('(λx.λy.x) y'));
    expect(formatLambda(result.term)).toBe('λa.y');
  });

  it('detects normal forms', () => {
    const term = parseLambda('λx.x');
    expect(canReduce(term)).toBe(false);
    expect(reduceOnce(term).changed).toBe(false);
  });
});
