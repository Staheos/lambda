# Lambda Lab

An interactive lambda calculus visualizer with animated beta reduction.

## Expression syntax

Function application is written by juxtaposition, so addition is `+ 2 3`
rather than `2 + 3`. The input supports Church numerals and the shorthand
operators `+`, `-`, `*`, `/`, `^`, `^^` (displayed as `↑↑`), `>`, and `!`,
together with the combinators `T`, `F`, `I`, `K`, and `S`. Division is integer
division on Church numerals: `/ 7 2` reduces to `3`. Division by zero reduces
to the zero/false Church term, displayed as `F` by the configured boolean
priority.

The **Collapse recognized expressions** option formats exact, structurally
equivalent lambda terms back into known semantic notation. Recognition runs
only after beta reduction reaches a normal form, so it never hides a reducible
expression or reconstructs the original input. It is alpha-equivalence aware:
`λa.λb.a (a b)` is displayed as `2` even though its parameter names differ
from the canonical definition. `^^` denotes tetration, so `^^ 2 3` reduces to
`16`. Ambiguous terms follow the established Church boolean convention:
`λxy.x` is displayed as `T` and `λxy.y` as `F`.

## Development

```sh
pnpm install
pnpm dev
```

## Checks

```sh
pnpm test
pnpm build
```

The site is deployed to GitHub Pages after every push to `master`.
