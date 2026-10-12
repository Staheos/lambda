import type {LambdaTerm} from './ast';
import {parseLambda} from './parser';
import {canReduce, formatLambda, reduceOnce} from './reducer';

const PREDECESSOR =
  '(λn.λf.λx.n (λg.λh.h (g f)) (λu.x) (λu.u))';
const TETRATION = '(λm.λn.n (λe.e m) (λf.λx.f x))';

const SHORTHANDS: Readonly<Record<string, string>> = {
  '↑↑': TETRATION,
  '^^': TETRATION,
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

interface KnownExpression {
  readonly display: string;
  readonly source: string;
}

const KNOWN_EXPRESSIONS: readonly KnownExpression[] = [
  {display: '+', source: '+'},
  {display: '-', source: '-'},
  {display: '*', source: '*'},
  {display: '^', source: '^'},
  {display: '↑↑', source: '^^'},
  {display: '>', source: '>'},
  {display: '!', source: '!'},
  {display: 'K', source: 'K'},
  {display: 'T', source: 'T'},
  {display: 'F', source: 'F'},
  {display: 'I', source: 'I'},
  {display: 'S', source: 'S'},
];

const SHORTHAND_TOKENS = Object.keys(SHORTHANDS).sort(
  (left, right) => right.length - left.length,
);
const SHORTHAND_SIGNATURES = buildKnownSignatures();

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

    const shorthand = SHORTHAND_TOKENS.find(
      (token) => source.startsWith(token, index),
    );
    if (shorthand !== undefined) {
      result += SHORTHANDS[shorthand];
      index += shorthand.length;
      continue;
    }

    result += character;
    index += 1;
  }

  return result;
}

export function formatWithLambdaShorthands(term: LambdaTerm): string {
  return formatTerm(term, 0);
}

export function formatWithRecognizedNormalForms(term: LambdaTerm): string {
  return canReduce(term) ? formatLambda(term) : formatWithLambdaShorthands(term);
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

function buildKnownSignatures(): ReadonlyMap<string, string> {
  const signatures = new Map<string, string>();

  for (const expression of KNOWN_EXPRESSIONS) {
    const term = parseLambda(expandLambdaShorthands(expression.source));
    signatures.set(alphaSignature(term), expression.display);
    signatures.set(alphaSignature(normalize(term)), expression.display);
  }

  return signatures;
}

function normalize(term: LambdaTerm): LambdaTerm {
  let current = term;
  const maximumSteps = 2_000;

  for (let step = 0; step < maximumSteps && canReduce(current); step += 1) {
    current = reduceOnce(current).term;
  }

  return current;
}

function identifyShorthand(term: LambdaTerm): string | null {
  const shorthand = SHORTHAND_SIGNATURES.get(alphaSignature(term));
  if (shorthand !== undefined) {
    return shorthand;
  }

  const numeral = identifyChurchNumeral(term);
  if (numeral !== null) {
    return String(numeral);
  }

  return null;
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
