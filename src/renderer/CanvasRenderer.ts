import type {LambdaTerm} from '../core/ast';
import {
  findNextReduction,
  type ReductionFocus,
} from '../core/reducer';
import {
  layoutLambda,
  type DiagramLabel,
  type DiagramLayout,
  type DiagramLine,
} from './layout';

interface ScreenLine extends DiagramLine {
  readonly alpha: number;
}

interface ScreenLabel extends DiagramLabel {
  readonly alpha: number;
}

type FocusRole = 'argument' | 'occurrence' | 'redex';
type AnimationPhase = 'locate' | 'substitute';

const MINIMUM_HEIGHT = 420;
const PADDING = 54;
const LOCATE_PORTION = 0.38;
const FOCUS_COLORS: Readonly<Record<FocusRole, string>> = {
  argument: '#5ce9f1',
  occurrence: '#ffe36a',
  redex: '#ff5470',
};

export class CanvasRenderer {
  private animationFrame: number | undefined;
  private currentLayout: DiagramLayout | undefined;
  private currentTerm: LambdaTerm | undefined;
  private readonly context: CanvasRenderingContext2D;
  private readonly resizeObserver: ResizeObserver;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly onAnimationStateChange: (animating: boolean) => void,
  ) {
    const context = canvas.getContext('2d');
    if (context === null) {
      throw new Error('Canvas 2D is not supported.');
    }
    this.context = context;
    this.resizeObserver = new ResizeObserver(() => this.drawCurrent());
    this.resizeObserver.observe(canvas);
  }

  render(term: LambdaTerm, duration: number): void {
    const nextLayout = layoutLambda(term);
    const previousLayout = this.currentLayout;
    const previousTerm = this.currentTerm;
    this.currentLayout = nextLayout;
    this.currentTerm = term;

    if (this.animationFrame !== undefined) {
      cancelAnimationFrame(this.animationFrame);
    }

    if (previousLayout === undefined || previousTerm === term || duration === 0) {
      this.onAnimationStateChange(false);
      this.draw(nextLayout, nextLayout, 1);
      return;
    }

    const focus = previousTerm === undefined ? null : findNextReduction(previousTerm);
    this.onAnimationStateChange(true);
    const startedAt = performance.now();
    const tick = (now: number): void => {
      const progress = Math.min((now - startedAt) / duration, 1);
      if (progress >= 1) {
        this.draw(nextLayout, nextLayout, 1);
        this.animationFrame = undefined;
        this.onAnimationStateChange(false);
        return;
      }

      if (progress < LOCATE_PORTION) {
        const locateProgress = progress / LOCATE_PORTION;
        const pulse = 0.82 + Math.sin(locateProgress * Math.PI) * 0.18;
        this.draw(
          previousLayout,
          previousLayout,
          1,
          focus,
          pulse,
          'locate',
          locateProgress,
        );
      } else {
        const substituteProgress =
          (progress - LOCATE_PORTION) / (1 - LOCATE_PORTION);
        this.draw(
          previousLayout,
          nextLayout,
          easeInOutCubic(substituteProgress),
          focus,
          1 - substituteProgress,
          'substitute',
          substituteProgress,
        );
      }

      if (progress < 1) {
        this.animationFrame = requestAnimationFrame(tick);
      }
    };
    this.animationFrame = requestAnimationFrame(tick);
  }

  destroy(): void {
    if (this.animationFrame !== undefined) {
      cancelAnimationFrame(this.animationFrame);
    }
    this.onAnimationStateChange(false);
    this.resizeObserver.disconnect();
  }

  private drawCurrent(): void {
    if (this.currentLayout !== undefined) {
      this.draw(this.currentLayout, this.currentLayout, 1);
    }
  }

  private draw(
    previousLayout: DiagramLayout,
    nextLayout: DiagramLayout,
    progress: number,
    focus: ReductionFocus | null = null,
    focusStrength = 0,
    phase: AnimationPhase | null = null,
    phaseProgress = 0,
  ): void {
    this.resizeCanvas();
    const previousLines = this.toScreenLines(previousLayout);
    const nextLines = this.toScreenLines(nextLayout);
    const previousLabels = this.toScreenLabels(previousLayout);
    const nextLabels = this.toScreenLabels(nextLayout);

    this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
    for (const line of mergeLines(previousLines, nextLines, progress)) {
      this.drawLine(line, focusRole(line.key, focus), focusStrength);
    }
    for (const label of mergeLabels(previousLabels, nextLabels, progress)) {
      this.drawLabel(label, focusRole(label.key, focus), focusStrength);
    }
    if (focus !== null && phase !== null) {
      this.drawPhaseCard(focus, phase, phaseProgress);
    }
  }

  private resizeCanvas(): void {
    const ratio = window.devicePixelRatio || 1;
    const width = Math.max(this.canvas.clientWidth, 1);
    const height = Math.max(this.canvas.clientHeight, MINIMUM_HEIGHT);
    const pixelWidth = Math.round(width * ratio);
    const pixelHeight = Math.round(height * ratio);

    if (this.canvas.width !== pixelWidth || this.canvas.height !== pixelHeight) {
      this.canvas.width = pixelWidth;
      this.canvas.height = pixelHeight;
    }
  }

  private toScreenLines(layout: DiagramLayout): readonly ScreenLine[] {
    const transform = this.createTransform(layout);
    return layout.lines.map((line) => ({
      ...line,
      x1: transform.x(line.x1),
      y1: transform.y(line.y1),
      x2: transform.x(line.x2),
      y2: transform.y(line.y2),
      width: Math.max(line.width * transform.scale * 0.44, 2),
      alpha: 1,
    }));
  }

  private toScreenLabels(layout: DiagramLayout): readonly ScreenLabel[] {
    const transform = this.createTransform(layout);
    return layout.labels.map((label) => ({
      ...label,
      x: transform.x(label.x),
      y: transform.y(label.y),
      alpha: 1,
    }));
  }

  private createTransform(layout: DiagramLayout): {
    readonly scale: number;
    readonly x: (value: number) => number;
    readonly y: (value: number) => number;
  } {
    const ratio = window.devicePixelRatio || 1;
    const availableWidth = this.canvas.width - PADDING * 2 * ratio;
    const availableHeight = this.canvas.height - PADDING * 2 * ratio;
    const scale = Math.min(
      availableWidth / Math.max(layout.width, 1),
      availableHeight / Math.max(layout.height + 0.5, 1),
      84 * ratio,
    );
    const offsetX = (this.canvas.width - layout.width * scale) / 2;
    const offsetY = (this.canvas.height - layout.height * scale) / 2;
    return {
      scale,
      x: (value: number) => offsetX + value * scale,
      y: (value: number) => offsetY + value * scale,
    };
  }

  private drawLine(
    line: ScreenLine,
    role: FocusRole | null,
    focusStrength: number,
  ): void {
    this.context.save();
    this.context.globalAlpha = line.alpha *
      (role === null ? 1 - focusStrength * 0.68 : 1);
    if (role !== null) {
      const ratio = window.devicePixelRatio || 1;
      this.context.shadowColor = FOCUS_COLORS[role];
      this.context.shadowBlur = 18 * ratio * focusStrength;
      this.context.strokeStyle = FOCUS_COLORS[role];
      this.context.lineWidth = line.width * (1 + focusStrength * 1.15);
      this.context.lineCap = 'round';
      this.context.beginPath();
      this.context.moveTo(line.x1, line.y1);
      this.context.lineTo(line.x2, line.y2);
      this.context.stroke();
      this.context.shadowBlur = 0;
    }
    this.context.strokeStyle = resolveColor(line.color);
    this.context.lineWidth = line.width;
    this.context.lineCap = 'round';
    this.context.lineJoin = 'round';
    this.context.beginPath();
    this.context.moveTo(line.x1, line.y1);
    this.context.lineTo(line.x2, line.y2);
    this.context.stroke();
    this.context.restore();
  }

  private drawLabel(
    label: ScreenLabel,
    role: FocusRole | null,
    focusStrength: number,
  ): void {
    const ratio = window.devicePixelRatio || 1;
    this.context.save();
    this.context.globalAlpha = label.alpha * 0.92 *
      (role === null ? 1 - focusStrength * 0.68 : 1);
    this.context.fillStyle = role === null ?
      resolveColor(label.color) : FOCUS_COLORS[role];
    this.context.font = role === null ?
      `${13 * ratio}px "IBM Plex Mono", monospace` :
      `600 ${14 * ratio}px "IBM Plex Mono", monospace`;
    if (role !== null) {
      this.context.shadowColor = FOCUS_COLORS[role];
      this.context.shadowBlur = 12 * ratio * focusStrength;
    }
    this.context.textAlign = 'center';
    this.context.textBaseline = 'bottom';
    this.context.fillText(label.text, label.x, label.y);
    this.context.restore();
  }

  private drawPhaseCard(
    focus: ReductionFocus,
    phase: AnimationPhase,
    progress: number,
  ): void {
    const ratio = window.devicePixelRatio || 1;
    const x = 48 * ratio;
    const y = 20 * ratio;
    const width = Math.min(340 * ratio, this.canvas.width - 70 * ratio);
    const height = 74 * ratio;
    const title = phase === 'locate' ?
      '1  Find the next β-redex' :
      `2  Substitute the argument for ${focus.parameter}`;
    const detail = phase === 'locate' ?
      `(λ${focus.parameter}. M) N` :
      'Follow cyan N into the yellow occurrences';

    this.context.save();
    this.context.globalAlpha = 0.94;
    this.context.fillStyle = 'rgba(14, 14, 16, 0.92)';
    this.context.strokeStyle = phase === 'locate' ?
      FOCUS_COLORS.redex : FOCUS_COLORS.argument;
    this.context.lineWidth = 1.5 * ratio;
    this.context.beginPath();
    this.context.roundRect(x, y, width, height, 10 * ratio);
    this.context.fill();
    this.context.stroke();

    this.context.fillStyle = '#f5f5f2';
    this.context.font = `600 ${13 * ratio}px "IBM Plex Mono", monospace`;
    this.context.textAlign = 'left';
    this.context.textBaseline = 'top';
    this.context.fillText(title, x + 14 * ratio, y + 12 * ratio);
    this.context.fillStyle = '#aaa9a4';
    this.context.font = `${11 * ratio}px "IBM Plex Mono", monospace`;
    this.context.fillText(detail, x + 14 * ratio, y + 34 * ratio);

    const barX = x + 14 * ratio;
    const barY = y + 57 * ratio;
    const barWidth = width - 28 * ratio;
    this.context.fillStyle = 'rgba(255, 255, 255, 0.12)';
    this.context.fillRect(barX, barY, barWidth, 3 * ratio);
    this.context.fillStyle = phase === 'locate' ?
      FOCUS_COLORS.redex : FOCUS_COLORS.argument;
    this.context.fillRect(barX, barY, barWidth * progress, 3 * ratio);
    this.context.restore();
  }
}

function mergeLines(
  previous: readonly ScreenLine[],
  next: readonly ScreenLine[],
  progress: number,
): readonly ScreenLine[] {
  const previousByKey = new Map(previous.map((line) => [line.key, line]));
  const previousByMotionKey = new Map(
    previous.map((line) => [line.motionKey, line]),
  );
  const nextByKey = new Map(next.map((line) => [line.key, line]));
  const matchedPrevious = new Set<string>();
  const lines: ScreenLine[] = [];

  for (const nextLine of next) {
    const previousLine = previousByKey.get(nextLine.key) ??
      previousByMotionKey.get(nextLine.motionKey);
    if (previousLine !== undefined) {
      matchedPrevious.add(previousLine.key);
    }
    lines.push(previousLine === undefined ?
      {...nextLine, alpha: progress} :
      interpolateLine(previousLine, nextLine, progress));
  }

  for (const previousLine of previous) {
    if (!nextByKey.has(previousLine.key) &&
        !matchedPrevious.has(previousLine.key)) {
      lines.push({...previousLine, alpha: 1 - progress});
    }
  }
  return lines;
}

function mergeLabels(
  previous: readonly ScreenLabel[],
  next: readonly ScreenLabel[],
  progress: number,
): readonly ScreenLabel[] {
  const previousByKey = new Map(previous.map((label) => [label.key, label]));
  const previousByMotionKey = new Map(
    previous.map((label) => [label.motionKey, label]),
  );
  const nextByKey = new Map(next.map((label) => [label.key, label]));
  const matchedPrevious = new Set<string>();
  const labels: ScreenLabel[] = [];

  for (const nextLabel of next) {
    const previousLabel = previousByKey.get(nextLabel.key) ??
      previousByMotionKey.get(nextLabel.motionKey);
    if (previousLabel !== undefined) {
      matchedPrevious.add(previousLabel.key);
    }
    labels.push(previousLabel === undefined ?
      {...nextLabel, alpha: progress} : {
        ...nextLabel,
        x: interpolate(previousLabel.x, nextLabel.x, progress),
        y: interpolate(previousLabel.y, nextLabel.y, progress),
        alpha: 1,
      });
  }

  for (const previousLabel of previous) {
    if (!nextByKey.has(previousLabel.key) &&
        !matchedPrevious.has(previousLabel.key)) {
      labels.push({...previousLabel, alpha: 1 - progress});
    }
  }
  return labels;
}

function interpolateLine(
  previous: ScreenLine,
  next: ScreenLine,
  progress: number,
): ScreenLine {
  return {
    ...next,
    x1: interpolate(previous.x1, next.x1, progress),
    y1: interpolate(previous.y1, next.y1, progress),
    x2: interpolate(previous.x2, next.x2, progress),
    y2: interpolate(previous.y2, next.y2, progress),
    width: interpolate(previous.width, next.width, progress),
    alpha: 1,
  };
}

function interpolate(start: number, end: number, progress: number): number {
  return start + (end - start) * progress;
}

function easeInOutCubic(value: number): number {
  return value < 0.5 ? 4 * value ** 3 : 1 - (-2 * value + 2) ** 3 / 2;
}

function resolveColor(color: string): string {
  if (!color.startsWith('var(')) {
    return color;
  }
  const property = color.slice(4, -1);
  return getComputedStyle(document.documentElement).getPropertyValue(property).trim();
}

function focusRole(
  key: string,
  focus: ReductionFocus | null,
): FocusRole | null {
  if (focus === null) {
    return null;
  }

  const nodeId = key.slice(0, key.indexOf(':'));
  if (focus.occurrenceIds.has(nodeId)) {
    return 'occurrence';
  }
  if (focus.argumentIds.has(nodeId)) {
    return 'argument';
  }
  if (focus.redexIds.has(nodeId)) {
    return 'redex';
  }
  return null;
}
