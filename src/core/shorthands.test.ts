import {describe, expect, it} from 'vitest';
import {parseLambda} from './parser';
import {canReduce, formatLambda, reduceOnce} from './reducer';
import {
  expandLambdaShorthands,
  formatWithLambdaShorthands,
  formatWithRecognizedNormalForms,
} from './shorthands';

describe('expandLambdaShorthands', () => {
  it('expands the identity combinator', () => {
    const expanded = expandLambdaShorthands('I a');
    expect(formatLambda(reduceOnce(parseLambda(expanded)).term)).toBe('a');
  });

  it('creates Church numerals', () => {
    const expanded = expandLambdaShorthands('2');
    expect(formatLambda(parseLambda(expanded))).toBe('λfx.f (f x)');
  });

  it('expands multi-digit Church numerals as one value', () => {
    const expanded = expandLambdaShorthands('12');
    expect(formatWithLambdaShorthands(parseLambda(expanded))).toBe('12');
  });

  it('expands subtraction', () => {
    let term = parseLambda(expandLambdaShorthands('- 3 1'));
    for (let step = 0; step < 100 && canReduce(term); step += 1) {
      term = reduceOnce(term).term;
    }
    expect(formatWithLambdaShorthands(term)).toBe('2');
  });

  it('leaves ordinary variables unchanged', () => {
    expect(expandLambdaShorthands('λx.x')).toBe('λx.x');
  });
});

describe('formatWithLambdaShorthands', () => {
  it('recognizes Church numerals regardless of parameter names', () => {
    const term = parseLambda('λab.a (a (a (a b)))');
    expect(formatWithLambdaShorthands(term)).toBe('4');
  });

  it('recognizes operators inside applications', () => {
    const term = parseLambda(expandLambdaShorthands('+ 2 3'));
    expect(formatWithLambdaShorthands(term)).toBe('+ 2 3');
  });

  it('does not reconstruct an operator chain from its input', () => {
    const term = parseLambda(expandLambdaShorthands('*++'));
    expect(formatWithLambdaShorthands(term)).toBe('* + +');
  });

  it('recognizes conventional tetration notation', () => {
    const term = parseLambda(expandLambdaShorthands('^^'));
    expect(formatWithLambdaShorthands(term)).toBe('↑↑');
  });

  it('evaluates a power tower of two with height three', () => {
    let term = parseLambda(expandLambdaShorthands('^^ 2 3'));
    for (let step = 0; step < 2_000 && canReduce(term); step += 1) {
      term = reduceOnce(term).term;
    }
    expect(formatWithLambdaShorthands(term)).toBe('16');
  });

  it('prefers conventional Church booleans for ambiguous terms', () => {
    expect(formatWithLambdaShorthands(parseLambda('λxy.x'))).toBe('T');
    expect(formatWithLambdaShorthands(parseLambda('λxy.y'))).toBe('F');
  });

  it('does not collapse a similar but different expression', () => {
    const term = parseLambda('λf.λx.f (x f)');
    expect(formatWithLambdaShorthands(term)).toBe('λfx.f (x f)');
  });
});

describe('formatWithRecognizedNormalForms', () => {
  it('keeps reducible expressions fully expanded', () => {
    const term = parseLambda(expandLambdaShorthands('*++'));
    expect(formatWithRecognizedNormalForms(term)).toBe(formatLambda(term));
  });

  it('collapses only after reaching a normal form', () => {
    let term = parseLambda(expandLambdaShorthands('+ 2 3'));
    expect(formatWithRecognizedNormalForms(term)).toBe(formatLambda(term));

    for (let step = 0; step < 2_000 && canReduce(term); step += 1) {
      term = reduceOnce(term).term;
    }
    expect(formatWithRecognizedNormalForms(term)).toBe('5');
  });
});
