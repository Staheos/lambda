import {useCallback, useEffect, useMemo, useState} from 'react';
import type {LambdaTerm} from '../core/ast';
import {LambdaSyntaxError, parseLambda} from '../core/parser';
import {canReduce, formatLambda, reduceOnce} from '../core/reducer';
import {expandLambdaShorthands} from '../core/shorthands';
import {LambdaCanvas} from './LambdaCanvas';

interface Example {
  readonly expression: string;
  readonly label: string;
}

interface OptionToggleProps {
  readonly checked: boolean;
  readonly label: string;
  readonly onChange: (checked: boolean) => void;
}

const EXAMPLES: readonly Example[] = [
  {label: 'Identity', expression: 'I (λy.y)'},
  {label: 'Returning a lambda', expression: '(λx.λy.x) a'},
  {label: 'Beta reduction', expression: '(λz.z z) (λx.λy.x)'},
  {label: 'Boolean true', expression: 'T a b'},
  {label: 'Successor', expression: '> 2'},
  {label: 'Addition', expression: '+ 2 3'},
  {label: 'Multiplication', expression: '* 2 3'},
  {label: 'Exponentiation', expression: '^ 2 3'},
  {label: 'Omega', expression: '(λx.x x) (λx.x x)'},
];

const INITIAL_EXPRESSION = '* 2 3';
const MAX_AUTOMATIC_STEPS = 250;

function parseSource(source: string): LambdaTerm {
  return parseLambda(expandLambdaShorthands(source));
}

export function App(): React.JSX.Element {
  const [source, setSource] = useState(INITIAL_EXPRESSION);
  const [initialSource, setInitialSource] = useState(INITIAL_EXPRESSION);
  const [term, setTerm] = useState<LambdaTerm>(() => parseSource(INITIAL_EXPRESSION));
  const [initialTerm, setInitialTerm] = useState<LambdaTerm>(term);
  const [history, setHistory] = useState<readonly string[]>([formatLambda(term)]);
  const [error, setError] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [stepCount, setStepCount] = useState(0);
  const [expandShorthands, setExpandShorthands] = useState(false);
  const [animateSubstitutions, setAnimateSubstitutions] = useState(true);
  const [updateExpression, setUpdateExpression] = useState(true);
  const isReducible = useMemo(() => canReduce(term), [term]);
  const animationDuration = animateSubstitutions ? Math.round(620 / speed) : 0;

  const applyReduction = useCallback((): boolean => {
    const result = reduceOnce(term);
    if (!result.changed) {
      setSource(formatLambda(term));
      setIsPlaying(false);
      return false;
    }

    const formatted = formatLambda(result.term);
    setTerm(result.term);
    if (updateExpression || !isPlaying) {
      setSource(formatted);
    }
    setHistory((items) => [...items, formatted]);
    setStepCount((count) => count + 1);
    return true;
  }, [isPlaying, term, updateExpression]);

  useEffect(() => {
    if (!isPlaying) {
      return;
    }

    if (!isReducible || stepCount >= MAX_AUTOMATIC_STEPS) {
      setSource(formatLambda(term));
      setIsPlaying(false);
      return;
    }

    const timeout = window.setTimeout(
      () => applyReduction(),
      Math.max(animationDuration + 80, 140),
    );
    return () => window.clearTimeout(timeout);
  }, [animationDuration, applyReduction, isPlaying, isReducible, stepCount, term]);

  function handleSourceChange(value: string): void {
    const normalizedValue = value.replaceAll('\\', 'λ');
    setSource(normalizedValue);
    setIsPlaying(false);

    try {
      const parsedTerm = parseSource(normalizedValue);
      setTerm(parsedTerm);
      setInitialTerm(parsedTerm);
      setInitialSource(normalizedValue);
      setHistory([formatLambda(parsedTerm)]);
      setStepCount(0);
      setError(null);
    } catch (caughtError) {
      setError(formatError(caughtError));
    }
  }

  function loadExample(expression: string): void {
    const visibleExpression = expandShorthands ?
      expandLambdaShorthands(expression) : expression;
    handleSourceChange(visibleExpression);
  }

  function toggleShorthandExpansion(checked: boolean): void {
    setExpandShorthands(checked);
    if (checked) {
      handleSourceChange(expandLambdaShorthands(source));
    }
  }

  function reset(): void {
    setTerm(initialTerm);
    setSource(initialSource);
    setHistory([formatLambda(initialTerm)]);
    setStepCount(0);
    setError(null);
    setIsPlaying(false);
  }

  function downloadDiagram(): void {
    const canvas = document.querySelector<HTMLCanvasElement>('.lambda-canvas');
    if (canvas === null) {
      return;
    }
    const link = document.createElement('a');
    link.download = 'lambda-diagram.png';
    link.href = canvas.toDataURL('image/png');
    link.click();
  }

  async function toggleFullscreen(): Promise<void> {
    const canvasWrap = document.querySelector<HTMLElement>('.canvas-wrap');
    if (canvasWrap === null) {
      return;
    }
    if (document.fullscreenElement === null) {
      await canvasWrap.requestFullscreen();
    } else {
      await document.exitFullscreen();
    }
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
          <div className="hero-mark">λ</div>
          <p className="eyebrow">Interactive visualizer</p>
          <h1>Lambda Calculus</h1>
          <p className="hero-copy">
            Enter a lambda expression and watch its bindings reorganize through
            beta reduction. Type <code>\</code> to insert a lambda.
          </p>
        </section>

        <div className="example-row">
          <div className="select-wrap compact-select">
            <select
              aria-label="Examples"
              defaultValue=""
              onChange={(event) => {
                if (event.target.value !== '') {
                  loadExample(event.target.value);
                }
              }}
            >
              <option value="" disabled>Examples</option>
              {EXAMPLES.map((example) => (
                <option key={example.label} value={example.expression}>
                  {example.label}
                </option>
              ))}
            </select>
            <ChevronIcon />
          </div>
        </div>

        <section className="workspace" aria-label="Lambda calculus workspace">
          <aside className="option-panel" aria-label="Diagram options">
            <OptionToggle
              checked={expandShorthands}
              label="Expand shorthands"
              onChange={toggleShorthandExpansion}
            />
            <OptionToggle
              checked={animateSubstitutions}
              label="Animate single substitutions"
              onChange={setAnimateSubstitutions}
            />
            <OptionToggle
              checked={updateExpression}
              label="Update expression during reduction"
              onChange={setUpdateExpression}
            />
          </aside>

          <div className="workspace-main">
            <div className="canvas-wrap">
              <LambdaCanvas
                animationDuration={animationDuration}
                term={term}
              />
              <button
                aria-label="Show diagram guide"
                className="canvas-tool help-tool"
                onClick={() => document.querySelector('.notation-note')?.scrollIntoView({
                  behavior: 'smooth',
                })}
                type="button"
              >
                ?
              </button>
              <button
                aria-label="Toggle fullscreen"
                className="canvas-tool fullscreen-tool"
                onClick={() => void toggleFullscreen()}
                type="button"
              >
                <FullscreenIcon />
              </button>
              <div className="canvas-status">
                <span className={`status-dot ${isPlaying ? 'active' : ''}`} />
                <span>{isPlaying ? 'Reducing' : isReducible ? 'Ready' : 'Normal form'}</span>
                <span>β {stepCount}</span>
              </div>
            </div>
          </div>

          <aside className="control-panel">
            <div className="expression-section">
              <textarea
                aria-label="Expression"
                aria-describedby={error === null ? 'expression-help' : 'expression-error'}
                className={error === null ? '' : 'invalid'}
                id="expression"
                onChange={(event) => handleSourceChange(event.target.value)}
                spellCheck={false}
                value={source}
              />
              <label htmlFor="expression">Expression</label>
              <span
                className={`expression-message ${error === null ? '' : 'error'}`}
                id={error === null ? 'expression-help' : 'expression-error'}
              >
                {error ?? `${source.length} characters`}
              </span>
            </div>

            <div className="action-section primary-actions">
              <button
                disabled={error !== null || !isReducible || isPlaying}
                onClick={() => setIsPlaying(true)}
                type="button"
              >
                Reduce
              </button>
              <button
                disabled={!isPlaying}
                onClick={() => setIsPlaying(false)}
                type="button"
              >
                Pause
              </button>
            </div>

            <div className="speed-section">
              <input
                aria-label="Animation speed"
                id="speed"
                max="2.5"
                min="0.25"
                onChange={(event) => setSpeed(Number(event.target.value))}
                step="0.25"
                type="range"
                value={speed}
              />
              <label htmlFor="speed">Animation Speed: {speed.toFixed(2)}</label>
            </div>

            <div className="action-section secondary-actions">
              <button
                disabled={error !== null || !isReducible || isPlaying}
                onClick={applyReduction}
                type="button"
              >
                Step
              </button>
              <button disabled={stepCount === 0} onClick={reset} type="button">
                Reset
              </button>
            </div>

            <button className="download-button" onClick={downloadDiagram} type="button">
              Download
            </button>

            <div className="history-section">
              <div className="history-heading">
                <span>History</span>
                <span>{history.length}</span>
              </div>
              <ol>
                {history.slice(-4).map((expression, index) => (
                  <li key={`${index}-${expression}`}>
                    <span>{Math.max(0, history.length - 4) + index}</span>
                    <code>{expression}</code>
                  </li>
                ))}
              </ol>
            </div>
          </aside>
        </section>

        <section className="notation-note">
          <span className="note-number">Guide</span>
          <div>
            <h2>Reading the diagram</h2>
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

function OptionToggle({
  checked,
  label,
  onChange,
}: OptionToggleProps): React.JSX.Element {
  return (
    <label className="option-toggle">
      <input
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        type="checkbox"
      />
      <span className="checkbox-mark" />
      <span>{label}</span>
    </label>
  );
}

function formatError(error: unknown): string {
  if (error instanceof LambdaSyntaxError) {
    return `${error.message} Position ${error.position + 1}.`;
  }
  return 'The expression could not be parsed.';
}

function ChevronIcon(): React.JSX.Element {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m7 10 5 5 5-5" /></svg>;
}

function ExternalIcon(): React.JSX.Element {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 5h5v5M19 5l-8 8M17 13v6H5V7h6" /></svg>;
}

function FullscreenIcon(): React.JSX.Element {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M8 3H3v5M16 3h5v5M8 21H3v-5M16 21h5v-5" />
    </svg>
  );
}
