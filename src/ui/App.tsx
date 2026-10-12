import {useCallback, useEffect, useMemo, useState} from 'react';
import type {LambdaTerm} from '../core/ast';
import {LambdaSyntaxError, parseLambda} from '../core/parser';
import {canReduce, formatLambda, reduceOnce} from '../core/reducer';
import {LambdaCanvas} from './LambdaCanvas';

interface Example {
  readonly expression: string;
  readonly label: string;
}

const EXAMPLES: readonly Example[] = [
  {label: 'Identity', expression: '(λx.x) (λy.y)'},
  {label: 'Constant', expression: '(λx.λy.x) a b'},
  {label: 'Composition', expression: '(λf.λg.λx.f (g x)) (λn.n) (λm.m)'},
  {label: 'Boolean true', expression: '(λt.λf.t) a b'},
  {label: 'Church successor', expression: '(λn.λf.λx.f (n f x)) (λf.λx.f x)'},
  {label: 'Omega', expression: '(λx.x x) (λx.x x)'},
];

const INITIAL_EXPRESSION = EXAMPLES[0].expression;
const MAX_AUTOMATIC_STEPS = 250;

export function App(): React.JSX.Element {
  const [source, setSource] = useState(INITIAL_EXPRESSION);
  const [term, setTerm] = useState<LambdaTerm>(() => parseLambda(INITIAL_EXPRESSION));
  const [initialTerm, setInitialTerm] = useState<LambdaTerm>(term);
  const [history, setHistory] = useState<readonly string[]>([formatLambda(term)]);
  const [error, setError] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [stepCount, setStepCount] = useState(0);
  const isReducible = useMemo(() => canReduce(term), [term]);
  const animationDuration = Math.round(620 / speed);

  const applyReduction = useCallback((): boolean => {
    const result = reduceOnce(term);
    if (!result.changed) {
      setIsPlaying(false);
      return false;
    }

    const formatted = formatLambda(result.term);
    setTerm(result.term);
    setSource(formatted);
    setHistory((items) => [...items, formatted]);
    setStepCount((count) => count + 1);
    return true;
  }, [term]);

  useEffect(() => {
    if (!isPlaying) {
      return;
    }

    if (!isReducible || stepCount >= MAX_AUTOMATIC_STEPS) {
      setIsPlaying(false);
      return;
    }

    const timeout = window.setTimeout(
      () => applyReduction(),
      Math.max(animationDuration + 80, 140),
    );
    return () => window.clearTimeout(timeout);
  }, [animationDuration, applyReduction, isPlaying, isReducible, stepCount]);

  function handleSourceChange(value: string): void {
    const normalizedValue = value.replaceAll('\\', 'λ');
    setSource(normalizedValue);
    setIsPlaying(false);

    try {
      const parsedTerm = parseLambda(normalizedValue);
      setTerm(parsedTerm);
      setInitialTerm(parsedTerm);
      setHistory([formatLambda(parsedTerm)]);
      setStepCount(0);
      setError(null);
    } catch (caughtError) {
      setError(formatError(caughtError));
    }
  }

  function loadExample(expression: string): void {
    const parsedTerm = parseLambda(expression);
    setSource(expression);
    setTerm(parsedTerm);
    setInitialTerm(parsedTerm);
    setHistory([formatLambda(parsedTerm)]);
    setStepCount(0);
    setError(null);
    setIsPlaying(false);
  }

  function reset(): void {
    setTerm(initialTerm);
    setSource(formatLambda(initialTerm));
    setHistory([formatLambda(initialTerm)]);
    setStepCount(0);
    setError(null);
    setIsPlaying(false);
  }

  return (
    <div className="app-shell">
      <header className="site-header">
        <a className="brand" href="#top" aria-label="Lambda Lab home">
          <span className="brand-mark">λ</span>
          <span>Lambda Lab</span>
        </a>
        <a
          className="github-link"
          href="https://github.com/Staheos/lambda"
          rel="noreferrer"
          target="_blank"
        >
          Source
          <ExternalIcon />
        </a>
      </header>

      <main id="top">
        <section className="hero">
          <p className="eyebrow">Interactive lambda calculus</p>
          <h1>Watch expressions<br />reduce into shape.</h1>
          <p className="hero-copy">
            Build a lambda term, follow every binding, and step through beta
            reduction as the diagram reorganizes itself.
          </p>
        </section>

        <section className="workspace" aria-label="Lambda calculus workspace">
          <div className="workspace-main">
            <div className="canvas-heading">
              <div>
                <p className="section-kicker">Diagram</p>
                <h2>Binding map</h2>
              </div>
              <div className="status-group">
                <span className={`status-dot ${isPlaying ? 'active' : ''}`} />
                <span>{isPlaying ? 'Reducing' : isReducible ? 'Ready' : 'Normal form'}</span>
                <span className="step-counter">β {stepCount}</span>
              </div>
            </div>
            <div className="canvas-wrap">
              <LambdaCanvas
                animationDuration={animationDuration}
                term={term}
              />
              <div className="canvas-legend">
                <span><i className="legend-line" /> bound variable</span>
                <span><i className="legend-line neutral" /> free variable</span>
              </div>
            </div>
          </div>

          <aside className="control-panel">
            <div className="panel-section expression-section">
              <label htmlFor="expression">Expression</label>
              <textarea
                aria-describedby={error === null ? 'expression-help' : 'expression-error'}
                className={error === null ? '' : 'invalid'}
                id="expression"
                onChange={(event) => handleSourceChange(event.target.value)}
                spellCheck={false}
                value={source}
              />
              <div className="input-meta">
                <span id={error === null ? 'expression-help' : 'expression-error'}>
                  {error ?? 'Use λ or \\ to create an abstraction.'}
                </span>
                <span>{source.length}</span>
              </div>
            </div>

            <div className="panel-section">
              <label htmlFor="example">Examples</label>
              <div className="select-wrap">
                <select
                  defaultValue=""
                  id="example"
                  onChange={(event) => {
                    if (event.target.value !== '') {
                      loadExample(event.target.value);
                    }
                  }}
                >
                  <option value="" disabled>Choose an expression</option>
                  {EXAMPLES.map((example) => (
                    <option key={example.label} value={example.expression}>
                      {example.label}
                    </option>
                  ))}
                </select>
                <ChevronIcon />
              </div>
            </div>

            <div className="panel-section action-section">
              <button
                className="primary-action"
                disabled={error !== null || !isReducible}
                onClick={() => setIsPlaying((playing) => !playing)}
                type="button"
              >
                {isPlaying ? <PauseIcon /> : <PlayIcon />}
                {isPlaying ? 'Pause' : 'Reduce'}
              </button>
              <button
                aria-label="Reduce one step"
                className="icon-action"
                disabled={error !== null || !isReducible || isPlaying}
                onClick={applyReduction}
                title="Reduce one step"
                type="button"
              >
                <StepIcon />
              </button>
              <button
                aria-label="Reset expression"
                className="icon-action"
                disabled={stepCount === 0}
                onClick={reset}
                title="Reset expression"
                type="button"
              >
                <ResetIcon />
              </button>
            </div>

            <div className="panel-section speed-section">
              <div className="range-heading">
                <label htmlFor="speed">Animation speed</label>
                <output>{speed.toFixed(2)}×</output>
              </div>
              <input
                id="speed"
                max="2.5"
                min="0.25"
                onChange={(event) => setSpeed(Number(event.target.value))}
                step="0.25"
                type="range"
                value={speed}
              />
              <div className="range-labels"><span>Slow</span><span>Fast</span></div>
            </div>

            <div className="panel-section history-section">
              <div className="history-heading">
                <span>Reduction history</span>
                <span>{history.length}</span>
              </div>
              <ol>
                {history.slice(-6).map((expression, index) => (
                  <li key={`${index}-${expression}`}>
                    <span>{Math.max(0, history.length - 6) + index}</span>
                    <code>{expression}</code>
                  </li>
                ))}
              </ol>
            </div>
          </aside>
        </section>

        <section className="notation-note">
          <span className="note-number">01</span>
          <div>
            <h2>Read the lines</h2>
            <p>
              A horizontal line introduces a lambda. Every vertical line below
              it traces an occurrence of the bound variable. Applications join
              a function on the left to its argument on the right.
            </p>
          </div>
        </section>
      </main>

      <footer>
        <span>Lambda Lab</span>
        <span>Built for exploring computation.</span>
      </footer>
    </div>
  );
}

function formatError(error: unknown): string {
  if (error instanceof LambdaSyntaxError) {
    return `${error.message} Position ${error.position + 1}.`;
  }
  return 'The expression could not be parsed.';
}

function PlayIcon(): React.JSX.Element {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m8 5 11 7-11 7V5Z" /></svg>;
}

function PauseIcon(): React.JSX.Element {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 5h4v14H7zM14 5h4v14h-4z" /></svg>;
}

function StepIcon(): React.JSX.Element {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 5 9 7-9 7V5Zm10 0h2v14h-2V5Z" /></svg>;
}

function ResetIcon(): React.JSX.Element {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.2 7.8A7 7 0 1 1 5 14h2a5 5 0 1 0 1-3l3 3H3V6l3.2 1.8Z" /></svg>;
}

function ChevronIcon(): React.JSX.Element {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m7 10 5 5 5-5" /></svg>;
}

function ExternalIcon(): React.JSX.Element {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 5h5v5M19 5l-8 8M17 13v6H5V7h6" /></svg>;
}
