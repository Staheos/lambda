const SHORTHANDS: Readonly<Record<string, string>> = {
  T: '(λt.λf.t)',
  F: '(λt.λf.f)',
  I: '(λx.x)',
  K: '(λx.λy.x)',
  S: '(λx.λy.λz.x z (y z))',
  '!': '(λb.b (λt.λf.f) (λt.λf.t))',
  '+': '(λm.λn.λf.λx.m f (n f x))',
  '*': '(λm.λn.λf.m (n f))',
  '^': '(λb.λe.e b)',
  '>': '(λn.λf.λx.f (n f x))',
};

export function expandLambdaShorthands(source: string): string {
  return [...source].map((character) => {
    if (/^[0-9]$/.test(character)) {
      return churchNumeral(Number(character));
    }
    return SHORTHANDS[character] ?? character;
  }).join('');
}

function churchNumeral(value: number): string {
  let body = 'x';
  for (let index = 0; index < value; index += 1) {
    body = `f (${body})`;
  }
  return `(λf.λx.${body})`;
}
