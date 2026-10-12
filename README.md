# Lambda Lab

An interactive lambda calculus visualizer with animated beta reduction.

## Expression syntax

Function application is written by juxtaposition, so addition is `+ 2 3`
rather than `2 + 3`. The input supports Church numerals and the shorthand
operators `+`, `-`, `*`, `^`, `>`, and `!`, together with the combinators
`T`, `F`, `I`, `K`, and `S`.

The **Collapse recognized expressions** option formats exact, structurally
equivalent lambda terms back into their shortest known notation. Recognition
is alpha-equivalence aware, so `λa.λb.a (a b)` is displayed as `2` even though
its parameter names differ from the canonical definition. Operator-only
application chains are compacted, for example `+ + +` becomes `+++` and
`+ * +` becomes `+*+`. Ambiguous terms follow the established Church boolean
convention: `λxy.x` is displayed as `T` and `λxy.y` as `F`.

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
