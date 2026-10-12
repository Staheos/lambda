import type {LambdaTerm} from '../core/ast';

export interface DiagramLine {
  readonly key: string;
  readonly motionKey: string;
  readonly x1: number;
  readonly y1: number;
  readonly x2: number;
  readonly y2: number;
  readonly color: string;
  readonly width: number;
}

export interface DiagramLabel {
  readonly key: string;
  readonly motionKey: string;
  readonly x: number;
  readonly y: number;
  readonly text: string;
  readonly color: string;
}

export interface DiagramLayout {
  readonly width: number;
  readonly height: number;
  readonly lines: readonly DiagramLine[];
  readonly labels: readonly DiagramLabel[];
}

interface NodeSize {
  readonly width: number;
  readonly height: number;
}

interface NodePlacement extends NodeSize {
  readonly outputX: number;
  readonly outputY: number;
}

interface Binder {
  readonly color: string;
  readonly id: string;
  readonly y: number;
}

interface LayoutContext {
  readonly labels: DiagramLabel[];
  readonly lines: DiagramLine[];
}

const HORIZONTAL_GAP = 1.4;
const LEVEL_GAP = 1.45;
const DIAGRAM_COLORS = [
  'hsl(344 86% 66%)',
  'hsl(18 90% 65%)',
  'hsl(50 92% 66%)',
  'hsl(126 72% 63%)',
  'hsl(174 76% 60%)',
  'hsl(207 88% 67%)',
  'hsl(245 86% 72%)',
  'hsl(286 80% 69%)',
] as const;

export function layoutLambda(term: LambdaTerm): DiagramLayout {
  const size = measure(term);
  const context: LayoutContext = {labels: [], lines: []};
  place(term, 0, 0, new Map(), context);

  return {
    width: size.width,
    height: size.height,
    lines: context.lines,
    labels: context.labels,
  };
}

function measure(term: LambdaTerm): NodeSize {
  if (term.kind === 'variable') {
    return {width: 1.2, height: 1.05};
  }

  if (term.kind === 'abstraction') {
    const body = measure(term.body);
    return {width: Math.max(body.width, 1.8), height: body.height + LEVEL_GAP};
  }

  const functionSize = measure(term.functionTerm);
  const argumentSize = measure(term.argument);
  return {
    width: functionSize.width + argumentSize.width + HORIZONTAL_GAP,
    height: Math.max(functionSize.height, argumentSize.height) + LEVEL_GAP,
  };
}

function place(
  term: LambdaTerm,
  x: number,
  y: number,
  binders: ReadonlyMap<string, Binder>,
  context: LayoutContext,
): NodePlacement {
  const size = measure(term);

  if (term.kind === 'variable') {
    const outputX = x + size.width / 2;
    const outputY = y + size.height;
    const binder = binders.get(term.name);
    const color = binder?.color ?? 'var(--diagram-free)';

    context.lines.push({
      key: `${term.id}:variable`,
      motionKey: `${visualId(term)}:variable`,
      x1: outputX,
      y1: binder?.y ?? y + 0.24,
      x2: outputX,
      y2: outputY,
      color,
      width: 0.13,
    });
    context.labels.push({
      key: `${term.id}:label`,
      motionKey: `${visualId(term)}:label`,
      x: outputX,
      y: outputY + 0.14,
      text: term.name,
      color,
    });
    return {...size, outputX, outputY};
  }

  if (term.kind === 'abstraction') {
    const bodySize = measure(term.body);
    const bodyX = x + (size.width - bodySize.width) / 2;
    const color = colorForId(visualId(term));
    const barY = y + 0.34;
    const nextBinders = new Map(binders);
    nextBinders.set(term.parameter, {color, id: term.id, y: barY});

    context.lines.push({
      key: `${term.id}:abstraction`,
      motionKey: `${visualId(term)}:abstraction`,
      x1: x + 0.1,
      y1: barY,
      x2: x + size.width - 0.1,
      y2: barY,
      color,
      width: 0.16,
    });
    context.labels.push({
      key: `${term.id}:parameter`,
      motionKey: `${visualId(term)}:parameter`,
      x: x + 0.1,
      y: barY - 0.18,
      text: `λ${term.parameter}`,
      color,
    });

    const body = place(
      term.body,
      bodyX,
      y + LEVEL_GAP,
      nextBinders,
      context,
    );
    return {...size, outputX: body.outputX, outputY: body.outputY};
  }

  const functionSize = measure(term.functionTerm);
  const argumentSize = measure(term.argument);
  const functionY = y + Math.max(0, argumentSize.height - functionSize.height);
  const argumentX = x + functionSize.width + HORIZONTAL_GAP;
  const argumentY = y + Math.max(0, functionSize.height - argumentSize.height);
  const functionPlacement = place(
    term.functionTerm,
    x,
    functionY,
    binders,
    context,
  );
  const argumentPlacement = place(
    term.argument,
    argumentX,
    argumentY,
    binders,
    context,
  );
  const barY = y + Math.max(functionSize.height, argumentSize.height) + 0.55;
  const outputY = y + size.height;
  const color = mixColors(
    colorForTerm(term.functionTerm),
    colorForTerm(term.argument),
  );

  context.lines.push(
    {
      key: `${term.id}:function-connector`,
      motionKey: `${visualId(term)}:function-connector`,
      x1: functionPlacement.outputX,
      y1: functionPlacement.outputY,
      x2: functionPlacement.outputX,
      y2: barY,
      color: colorForTerm(term.functionTerm),
      width: 0.13,
    },
    {
      key: `${term.id}:argument-connector`,
      motionKey: `${visualId(term)}:argument-connector`,
      x1: argumentPlacement.outputX,
      y1: argumentPlacement.outputY,
      x2: argumentPlacement.outputX,
      y2: barY,
      color: colorForTerm(term.argument),
      width: 0.13,
    },
    {
      key: `${term.id}:application`,
      motionKey: `${visualId(term)}:application`,
      x1: functionPlacement.outputX,
      y1: barY,
      x2: argumentPlacement.outputX,
      y2: barY,
      color,
      width: 0.16,
    },
    {
      key: `${term.id}:output`,
      motionKey: `${visualId(term)}:output`,
      x1: functionPlacement.outputX,
      y1: barY,
      x2: functionPlacement.outputX,
      y2: outputY,
      color,
      width: 0.16,
    },
  );

  return {...size, outputX: functionPlacement.outputX, outputY};
}

function colorForTerm(term: LambdaTerm): string {
  if (term.kind === 'abstraction') {
    return colorForId(visualId(term));
  }
  if (term.kind === 'variable') {
    return 'var(--diagram-free)';
  }
  return mixColors(colorForTerm(term.functionTerm), colorForTerm(term.argument));
}

function visualId(term: LambdaTerm): string {
  return term.originId ?? term.id;
}

function colorForId(id: string): string {
  let hash = 0;
  for (const character of id) {
    hash = (hash * 31 + character.charCodeAt(0)) % 360;
  }
  return DIAGRAM_COLORS[hash % DIAGRAM_COLORS.length];
}

function mixColors(first: string, second: string): string {
  if (first.startsWith('hsl') && second.startsWith('hsl')) {
    const firstHue = Number(first.match(/hsl\(([-\d.]+)/)?.[1] ?? 200);
    const secondHue = Number(second.match(/hsl\(([-\d.]+)/)?.[1] ?? 200);
    let difference = secondHue - firstHue;
    if (Math.abs(difference) > 180) {
      difference -= Math.sign(difference) * 360;
    }
    const hue = (firstHue + difference / 2 + 360) % 360;
    return `hsl(${hue} 82% 67%)`;
  }
  return first;
}
