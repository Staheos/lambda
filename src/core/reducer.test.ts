import {describe, expect, it} from 'vitest';
import {parseLambda} from './parser';
import {
  canReduce,
  findNextReduction,
  formatLambda,
  reduceOnce,
} from './reducer';

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

  it('describes the redex, argument, and substitution targets', () => {
    const term = parseLambda('(λx.x x) (λy.y)');
    const focus = findNextReduction(term);

    expect(focus?.parameter).toBe('x');
    expect(focus?.redexIds.size).toBe(5);
    expect(focus?.argumentIds.size).toBe(2);
    expect(focus?.occurrenceIds.size).toBe(2);
  });
});
