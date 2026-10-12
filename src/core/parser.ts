import {
  createAbstraction,
  createApplication,
  createVariable,
  type LambdaTerm,
} from './ast';

type TokenKind = 'lambda' | 'dot' | 'leftParen' | 'rightParen' | 'identifier';

interface Token {
  readonly kind: TokenKind;
  readonly value: string;
  readonly position: number;
}

export class LambdaSyntaxError extends Error {
  constructor(
    message: string,
    readonly position: number,
  ) {
    super(message);
    this.name = 'LambdaSyntaxError';
  }
}

export function parseLambda(source: string): LambdaTerm {
  const tokens = tokenize(source);

  if (tokens.length === 0) {
    throw new LambdaSyntaxError('Enter a lambda expression.', 0);
  }

  const parser = new Parser(tokens, source.length);
  const term = parser.parseExpression();
  parser.expectEnd();
  return term;
}

function tokenize(source: string): readonly Token[] {
  const tokens: Token[] = [];

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];

    if (/\s/.test(character)) {
      continue;
    }

    switch (character) {
      case 'λ':
      case '\\':
        tokens.push({kind: 'lambda', value: character, position: index});
        break;
      case '.':
        tokens.push({kind: 'dot', value: character, position: index});
        break;
      case '(':
        tokens.push({kind: 'leftParen', value: character, position: index});
        break;
      case ')':
        tokens.push({kind: 'rightParen', value: character, position: index});
        break;
      default:
        if (/^[a-zA-Z0-9_]$/.test(character)) {
          tokens.push({kind: 'identifier', value: character, position: index});
          break;
        }
        throw new LambdaSyntaxError(
          `Unexpected character “${character}”.`,
          index,
        );
    }
  }

  return tokens;
}

class Parser {
  private index = 0;

  constructor(
    private readonly tokens: readonly Token[],
    private readonly sourceLength: number,
  ) {}

  parseExpression(): LambdaTerm {
    if (this.peek()?.kind === 'lambda') {
      return this.parseAbstraction();
    }
    return this.parseApplication();
  }

  expectEnd(): void {
    const token = this.peek();
    if (token !== undefined) {
      throw new LambdaSyntaxError(
        `Unexpected token “${token.value}”.`,
        token.position,
      );
    }
  }

  private parseAbstraction(): LambdaTerm {
    this.consume('lambda');
    const parameters: string[] = [];

    while (this.peek()?.kind === 'identifier') {
      parameters.push(this.consume('identifier').value);
    }

    if (parameters.length === 0) {
      throw this.errorAtCurrent('A lambda needs at least one parameter.');
    }

    this.consume('dot', 'Add a dot after the lambda parameter.');
    const body = this.parseExpression();

    return parameters.reduceRight<LambdaTerm>(
      (currentBody, parameter) => createAbstraction(parameter, currentBody),
      body,
    );
  }

  private parseApplication(): LambdaTerm {
    let term = this.parseAtom();

    while (this.startsAtom(this.peek())) {
      term = createApplication(term, this.parseAtom());
    }

    return term;
  }

  private parseAtom(): LambdaTerm {
    const token = this.peek();

    if (token === undefined) {
      throw this.errorAtCurrent('Expected an expression.');
    }

    if (token.kind === 'identifier') {
      this.index += 1;
      return createVariable(token.value);
    }

    if (token.kind === 'lambda') {
      return this.parseAbstraction();
    }

    if (token.kind === 'leftParen') {
      this.index += 1;
      const term = this.parseExpression();
      this.consume('rightParen', 'Close the parenthesized expression.');
      return term;
    }

    throw new LambdaSyntaxError('Expected an expression.', token.position);
  }

  private startsAtom(token: Token | undefined): boolean {
    return token?.kind === 'identifier' ||
      token?.kind === 'leftParen' ||
      token?.kind === 'lambda';
  }

  private consume(kind: TokenKind, message?: string): Token {
    const token = this.peek();

    if (token?.kind !== kind) {
      throw this.errorAtCurrent(message ?? `Expected ${kind}.`);
    }

    this.index += 1;
    return token;
  }

  private peek(): Token | undefined {
    return this.tokens[this.index];
  }

  private errorAtCurrent(message: string): LambdaSyntaxError {
    return new LambdaSyntaxError(
      message,
      this.peek()?.position ?? this.sourceLength,
    );
  }
}
