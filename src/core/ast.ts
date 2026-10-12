export type LambdaTerm = VariableTerm | AbstractionTerm | ApplicationTerm;

export interface VariableTerm {
  readonly kind: 'variable';
  readonly id: string;
  readonly name: string;
  readonly originId?: string;
}

export interface AbstractionTerm {
  readonly kind: 'abstraction';
  readonly id: string;
  readonly originId?: string;
  readonly parameter: string;
  readonly body: LambdaTerm;
}

export interface ApplicationTerm {
  readonly kind: 'application';
  readonly id: string;
  readonly originId?: string;
  readonly functionTerm: LambdaTerm;
  readonly argument: LambdaTerm;
}

let nextNodeId = 0;

export function createNodeId(): string {
  nextNodeId += 1;
  return `node-${nextNodeId}`;
}

export function createVariable(name: string, originId?: string): VariableTerm {
  return {kind: 'variable', id: createNodeId(), name, originId};
}

export function createAbstraction(
  parameter: string,
  body: LambdaTerm,
  originId?: string,
): AbstractionTerm {
  return {kind: 'abstraction', id: createNodeId(), parameter, body, originId};
}

export function createApplication(
  functionTerm: LambdaTerm,
  argument: LambdaTerm,
  originId?: string,
): ApplicationTerm {
  return {
    kind: 'application',
    id: createNodeId(),
    functionTerm,
    argument,
    originId,
  };
}

export function cloneTerm(term: LambdaTerm): LambdaTerm {
  switch (term.kind) {
    case 'variable':
      return createVariable(term.name, term.originId ?? term.id);
    case 'abstraction':
      return createAbstraction(
        term.parameter,
        cloneTerm(term.body),
        term.originId ?? term.id,
      );
    case 'application':
      return createApplication(
        cloneTerm(term.functionTerm),
        cloneTerm(term.argument),
        term.originId ?? term.id,
      );
  }
}
