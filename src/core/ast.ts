export type LambdaTerm = VariableTerm | AbstractionTerm | ApplicationTerm;

export interface VariableTerm {
  readonly kind: 'variable';
  readonly id: string;
  readonly name: string;
}

export interface AbstractionTerm {
  readonly kind: 'abstraction';
  readonly id: string;
  readonly parameter: string;
  readonly body: LambdaTerm;
}

export interface ApplicationTerm {
  readonly kind: 'application';
  readonly id: string;
  readonly functionTerm: LambdaTerm;
  readonly argument: LambdaTerm;
}

let nextNodeId = 0;

export function createNodeId(): string {
  nextNodeId += 1;
  return `node-${nextNodeId}`;
}

export function createVariable(name: string): VariableTerm {
  return {kind: 'variable', id: createNodeId(), name};
}

export function createAbstraction(
  parameter: string,
  body: LambdaTerm,
): AbstractionTerm {
  return {kind: 'abstraction', id: createNodeId(), parameter, body};
}

export function createApplication(
  functionTerm: LambdaTerm,
  argument: LambdaTerm,
): ApplicationTerm {
  return {kind: 'application', id: createNodeId(), functionTerm, argument};
}

export function cloneTerm(term: LambdaTerm): LambdaTerm {
  switch (term.kind) {
    case 'variable':
      return createVariable(term.name);
    case 'abstraction':
      return createAbstraction(term.parameter, cloneTerm(term.body));
    case 'application':
      return createApplication(
        cloneTerm(term.functionTerm),
        cloneTerm(term.argument),
      );
  }
}
