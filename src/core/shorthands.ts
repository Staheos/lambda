import type {LambdaTerm} from './ast';
import {parseLambda} from './parser';

const PREDECESSOR =
  '(λn.λf.λx.n (λg.λh.h (g f)) (λu.x) (λu.u))';

const SHORTHANDS: Readonly<Record<string, string>> = {
  T: '(λt.λf.t)',
  F: '(λt.λf.f)',
  I: '(λx.x)',
  K: '(λx.λy.x)',
  S: '(λx.λy.λz.x z (y z))',
  '!': '(λb.b (λt.λf.f) (λt.λf.t))',
  '+': '(λm.λn.λf.λx.m f (n f x))',
  '-': `(λm.λn.n ${PREDECESSOR} m)`,
  '*': '(λm.λn.λf.m (n f))',
  '^': '(λb.λe.e b)',
  '>': '(λn.λf.λx.f (n f x))',
};

const COLLAPSE_ORDER = [
  '+',
  '-',
  '*',
  '^',
  '>',
  '!',
  'K',
  'T',
  'F',
  'I',
  'S',
];
const SHORTHAND_SIGNATURES = new Map(
  COLLAPSE_ORDER.map((symbol) => [
    alphaSignature(parseLambda(SHORTHANDS[symbol])),
    symbol,
  ]),
);

export function expandLambdaShorthands(source: string): string {
  let result = '';

  for (let index = 0; index < source.length;) {
    const character = source[index];
    if (/^[0-9]$/.test(character)) {
      let end = index + 1;
      while (end < source.length && /^[0-9]$/.test(source[end])) {
        end += 1;
      }
      result += churchNumeral(Number(source.slice(index, end)));
      index = end;
      continue;
    }

    result += SHORTHANDS[character] ?? character;
    index += 1;
  }

  return result;
}

export function formatWithLambdaShorthands(term: LambdaTerm): string {
  return formatTerm(term, 0);
}

function formatTerm(term: LambdaTerm, parentPrecedence: number): string {
  const shorthand = identifyShorthand(term);
  if (shorthand !== null) {
    return shorthand;
  }

  if (term.kind === 'variable') {
    return term.name;
  }

  if (term.kind === 'abstraction') {
    const parameters = [term.parameter];
    let body = term.body;

    while (body.kind === 'abstraction' && identifyShorthand(body) === null) {
      parameters.push(body.parameter);
      body = body.body;
    }

    const result = `λ${parameters.join('')}.${formatTerm(body, 0)}`;
    return parentPrecedence > 0 ? `(${result})` : result;
  }

  const result = `${formatTerm(term.functionTerm, 1)} ${formatTerm(term.argument, 2)}`;
  return parentPrecedence > 1 ? `(${result})` : result;
}

function identifyShorthand(term: LambdaTerm): string | null {
  const numeral = identifyChurchNumeral(term);
  if (numeral !== null) {
    return String(numeral);
  }

  return SHORTHAND_SIGNATURES.get(alphaSignature(term)) ?? null;
}

function identifyChurchNumeral(term: LambdaTerm): number | null {
  if (term.kind !== 'abstraction' || term.body.kind !== 'abstraction') {
    return null;
  }

  const functionName = term.parameter;
  const valueName = term.body.parameter;
  if (functionName === valueName) {
    return null;
  }

  let body = term.body.body;
  let value = 0;
  while (
    body.kind === 'application' &&
    body.functionTerm.kind === 'variable' &&
    body.functionTerm.name === functionName
  ) {
    value += 1;
    body = body.argument;
  }

  return body.kind === 'variable' && body.name === valueName ? value : null;
}

function alphaSignature(
  term: LambdaTerm,
  boundVariables: readonly string[] = [],
): string {
  if (term.kind === 'variable') {
    const reversedIndex = [...boundVariables].reverse().indexOf(term.name);
    return reversedIndex === -1 ? `free:${term.name}` : `bound:${reversedIndex}`;
  }

  if (term.kind === 'abstraction') {
    return `lambda(${alphaSignature(
      term.body,
      [...boundVariables, term.parameter],
    )})`;
  }

  return `apply(${alphaSignature(
    term.functionTerm,
    boundVariables,
  )},${alphaSignature(term.argument, boundVariables)})`;
}

function churchNumeral(value: number): string {
  let body = 'x';
  for (let index = 0; index < value; index += 1) {
    body = `f (${body})`;
  }
  return `(λf.λx.${body})`;
}
