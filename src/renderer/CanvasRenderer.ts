import type {LambdaTerm} from '../core/ast';
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

const MINIMUM_HEIGHT = 420;
const PADDING = 54;

export class CanvasRenderer {
  private animationFrame: number | undefined;
  private currentLayout: DiagramLayout | undefined;
  private readonly context: CanvasRenderingContext2D;
  private readonly resizeObserver: ResizeObserver;

  constructor(private readonly canvas: HTMLCanvasElement) {
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
    this.currentLayout = nextLayout;

    if (this.animationFrame !== undefined) {
      cancelAnimationFrame(this.animationFrame);
    }

    if (previousLayout === undefined || duration === 0) {
      this.draw(nextLayout, nextLayout, 1);
      return;
    }

    const startedAt = performance.now();
    const tick = (now: number): void => {
      const progress = Math.min((now - startedAt) / duration, 1);
      this.draw(previousLayout, nextLayout, easeInOutCubic(progress));

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
  ): void {
    this.resizeCanvas();
    const previousLines = this.toScreenLines(previousLayout);
    const nextLines = this.toScreenLines(nextLayout);
    const previousLabels = this.toScreenLabels(previousLayout);
    const nextLabels = this.toScreenLabels(nextLayout);

    this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
    for (const line of mergeLines(previousLines, nextLines, progress)) {
      this.drawLine(line);
    }
    for (const label of mergeLabels(previousLabels, nextLabels, progress)) {
      this.drawLabel(label);
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
      width: Math.max(line.width * transform.scale, 2.5),
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

  private drawLine(line: ScreenLine): void {
    this.context.save();
    this.context.globalAlpha = line.alpha;
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

  private drawLabel(label: ScreenLabel): void {
    const ratio = window.devicePixelRatio || 1;
    this.context.save();
    this.context.globalAlpha = label.alpha * 0.92;
    this.context.fillStyle = resolveColor(label.color);
    this.context.font = `${13 * ratio}px "IBM Plex Mono", monospace`;
    this.context.textAlign = 'center';
    this.context.textBaseline = 'bottom';
    this.context.fillText(label.text, label.x, label.y);
    this.context.restore();
  }
}

function mergeLines(
  previous: readonly ScreenLine[],
  next: readonly ScreenLine[],
  progress: number,
): readonly ScreenLine[] {
  const previousByKey = new Map(previous.map((line) => [line.key, line]));
  const nextByKey = new Map(next.map((line) => [line.key, line]));
  const lines: ScreenLine[] = [];

  for (const nextLine of next) {
    const previousLine = previousByKey.get(nextLine.key);
    lines.push(previousLine === undefined ?
      {...nextLine, alpha: progress} :
      interpolateLine(previousLine, nextLine, progress));
  }

  for (const previousLine of previous) {
    if (!nextByKey.has(previousLine.key)) {
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
  const nextByKey = new Map(next.map((label) => [label.key, label]));
  const labels: ScreenLabel[] = [];

  for (const nextLabel of next) {
    const previousLabel = previousByKey.get(nextLabel.key);
    labels.push(previousLabel === undefined ?
      {...nextLabel, alpha: progress} : {
        ...nextLabel,
        x: interpolate(previousLabel.x, nextLabel.x, progress),
        y: interpolate(previousLabel.y, nextLabel.y, progress),
        alpha: 1,
      });
  }

  for (const previousLabel of previous) {
    if (!nextByKey.has(previousLabel.key)) {
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
