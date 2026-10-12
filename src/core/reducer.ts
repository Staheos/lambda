import {
  cloneTerm,
  createAbstraction,
  createApplication,
  createVariable,
  type LambdaTerm,
} from './ast';

export interface ReductionResult {
  readonly changed: boolean;
  readonly term: LambdaTerm;
}

export function reduceOnce(term: LambdaTerm): ReductionResult {
  if (term.kind === 'application') {
    if (term.functionTerm.kind === 'abstraction') {
      return {
        changed: true,
        term: substitute(
          term.functionTerm.body,
          term.functionTerm.parameter,
          term.argument,
        ),
      };
    }

    const reducedFunction = reduceOnce(term.functionTerm);
    if (reducedFunction.changed) {
      return {
        changed: true,
        term: createApplication(reducedFunction.term, term.argument),
      };
    }

    const reducedArgument = reduceOnce(term.argument);
    if (reducedArgument.changed) {
      return {
        changed: true,
        term: createApplication(term.functionTerm, reducedArgument.term),
      };
    }

    return {changed: false, term};
  }

  if (term.kind === 'abstraction') {
    const reducedBody = reduceOnce(term.body);
    if (reducedBody.changed) {
      return {
        changed: true,
        term: createAbstraction(term.parameter, reducedBody.term),
      };
    }
  }

  return {changed: false, term};
}

export function canReduce(term: LambdaTerm): boolean {
  if (term.kind === 'variable') {
    return false;
  }

  if (term.kind === 'abstraction') {
    return canReduce(term.body);
  }

  return term.functionTerm.kind === 'abstraction' ||
    canReduce(term.functionTerm) ||
    canReduce(term.argument);
}

export function formatLambda(term: LambdaTerm): string {
  return formatTerm(term, 0);
}

function formatTerm(term: LambdaTerm, parentPrecedence: number): string {
  if (term.kind === 'variable') {
    return term.name;
  }

  if (term.kind === 'abstraction') {
    const parameters = [term.parameter];
    let body = term.body;

    while (body.kind === 'abstraction') {
      parameters.push(body.parameter);
      body = body.body;
    }

    const result = `λ${parameters.join('')}.${formatTerm(body, 0)}`;
    return parentPrecedence > 0 ? `(${result})` : result;
  }

  const result = `${formatTerm(term.functionTerm, 1)} ${formatTerm(term.argument, 2)}`;
  return parentPrecedence > 1 ? `(${result})` : result;
}

function substitute(
  term: LambdaTerm,
  variable: string,
  replacement: LambdaTerm,
): LambdaTerm {
  if (term.kind === 'variable') {
    return term.name === variable ? cloneTerm(replacement) : term;
  }

  if (term.kind === 'application') {
    return createApplication(
      substitute(term.functionTerm, variable, replacement),
      substitute(term.argument, variable, replacement),
    );
  }

  if (term.parameter === variable) {
    return term;
  }

  const replacementVariables = freeVariables(replacement);
  if (!replacementVariables.has(term.parameter)) {
    return createAbstraction(
      term.parameter,
      substitute(term.body, variable, replacement),
    );
  }

  const usedVariables = new Set([
    ...allVariables(term.body),
    ...replacementVariables,
    variable,
  ]);
  const freshParameter = findFreshVariable(usedVariables);
  const renamedBody = renameBoundVariable(
    term.body,
    term.parameter,
    freshParameter,
  );

  return createAbstraction(
    freshParameter,
    substitute(renamedBody, variable, replacement),
  );
}

function renameBoundVariable(
  term: LambdaTerm,
  oldName: string,
  newName: string,
): LambdaTerm {
  if (term.kind === 'variable') {
    return term.name === oldName ? createVariable(newName) : term;
  }

  if (term.kind === 'application') {
    return createApplication(
      renameBoundVariable(term.functionTerm, oldName, newName),
      renameBoundVariable(term.argument, oldName, newName),
    );
  }

  if (term.parameter === oldName) {
    return term;
  }

  return createAbstraction(
    term.parameter,
    renameBoundVariable(term.body, oldName, newName),
  );
}

function freeVariables(term: LambdaTerm, bound = new Set<string>()): Set<string> {
  if (term.kind === 'variable') {
    return bound.has(term.name) ? new Set() : new Set([term.name]);
  }

  if (term.kind === 'application') {
    return new Set([
      ...freeVariables(term.functionTerm, bound),
      ...freeVariables(term.argument, bound),
    ]);
  }

  return freeVariables(term.body, new Set([...bound, term.parameter]));
}

function allVariables(term: LambdaTerm): Set<string> {
  if (term.kind === 'variable') {
    return new Set([term.name]);
  }

  if (term.kind === 'application') {
    return new Set([
      ...allVariables(term.functionTerm),
      ...allVariables(term.argument),
    ]);
  }

  return new Set([term.parameter, ...allVariables(term.body)]);
}

function findFreshVariable(usedVariables: ReadonlySet<string>): string {
  const candidates = 'abcdefghijklmnopqrstuvwxyz';
  for (const candidate of candidates) {
    if (!usedVariables.has(candidate)) {
      return candidate;
    }
  }

  let suffix = 1;
  while (usedVariables.has(`v${suffix}`)) {
    suffix += 1;
  }
  return `v${suffix}`;
}
