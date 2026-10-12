import {describe, expect, it} from 'vitest';
import {parseLambda} from './parser';
import {formatLambda, reduceOnce} from './reducer';
import {expandLambdaShorthands} from './shorthands';

describe('expandLambdaShorthands', () => {
  it('expands the identity combinator', () => {
    const expanded = expandLambdaShorthands('I a');
    expect(formatLambda(reduceOnce(parseLambda(expanded)).term)).toBe('a');
  });

  it('creates Church numerals', () => {
    const expanded = expandLambdaShorthands('2');
    expect(formatLambda(parseLambda(expanded))).toBe('λfx.f (f x)');
  });

  it('leaves ordinary variables unchanged', () => {
    expect(expandLambdaShorthands('λx.x')).toBe('λx.x');
  });
});
