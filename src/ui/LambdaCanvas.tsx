import {useEffect, useRef} from 'react';
import type {LambdaTerm} from '../core/ast';
import {CanvasRenderer} from '../renderer/CanvasRenderer';

interface LambdaCanvasProps {
  readonly animationDuration: number;
  readonly term: LambdaTerm;
}

export function LambdaCanvas({
  animationDuration,
  term,
}: LambdaCanvasProps): React.JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<CanvasRenderer | null>(null);

  useEffect(() => {
    if (canvasRef.current === null) {
      return;
    }

    const renderer = new CanvasRenderer(canvasRef.current);
    rendererRef.current = renderer;
    renderer.render(term, 0);

    return () => {
      renderer.destroy();
      rendererRef.current = null;
    };
  }, []);

  useEffect(() => {
    rendererRef.current?.render(term, animationDuration);
  }, [animationDuration, term]);

  return (
    <canvas
      aria-label="Lambda expression diagram"
      className="lambda-canvas"
      ref={canvasRef}
      role="img"
    />
  );
}
