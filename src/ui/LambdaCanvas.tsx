import {useEffect, useRef} from 'react';
import type {LambdaTerm} from '../core/ast';
import {CanvasRenderer} from '../renderer/CanvasRenderer';

interface LambdaCanvasProps {
  readonly animationDuration: number;
  readonly animationStep: number;
  readonly onAnimationStateChange: (animating: boolean) => void;
  readonly term: LambdaTerm;
}

export function LambdaCanvas({
  animationDuration,
  animationStep,
  onAnimationStateChange,
  term,
}: LambdaCanvasProps): React.JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<CanvasRenderer | null>(null);
  const renderedStepRef = useRef(animationStep);

  useEffect(() => {
    if (canvasRef.current === null) {
      return;
    }

    const renderer = new CanvasRenderer(
      canvasRef.current,
      onAnimationStateChange,
    );
    rendererRef.current = renderer;
    renderer.render(term, 0);

    return () => {
      renderer.destroy();
      rendererRef.current = null;
    };
  }, [onAnimationStateChange]);

  useEffect(() => {
    const shouldAnimate = animationStep > renderedStepRef.current;
    rendererRef.current?.render(
      term,
      shouldAnimate ? animationDuration : 0,
    );
    renderedStepRef.current = animationStep;
  }, [animationDuration, animationStep, term]);

  return (
    <canvas
      aria-label="Lambda expression diagram"
      className="lambda-canvas"
      ref={canvasRef}
      role="img"
    />
  );
}
