import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  LayoutGrid,
  Play,
  Radio,
  Sparkles,
  Users,
  Zap,
} from 'lucide-react';
import Logo from './components/Logo';
import './onboarding.css';

const STORAGE_KEY = 'live-agents-onboarding-done';

export function shouldShowOnboarding(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) !== 'true';
  } catch {
    return true;
  }
}

export function resetOnboarding(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

export function markOnboardingDone(): void {
  try {
    localStorage.setItem(STORAGE_KEY, 'true');
  } catch {
    /* ignore */
  }
}

type StepId = 'welcome' | 'workspace' | 'loop' | 'crew' | 'setup' | 'launch';

interface Step {
  id: StepId;
  eyebrow: string;
  title: string;
  lead: string;
  bullets: string[];
}

const STEPS: Step[] = [
  {
    id: 'welcome',
    eyebrow: 'Welcome',
    title: 'Watch your Cursor swarm',
    lead:
      'Live Agents is a side-window companion: Cursor agents and subagents appear as named vinyl workers in a 3D office — like a little game.',
    bullets: [
      'No API key required to watch',
      'One character per agent or subagent',
      'Customize name, color, and accessory anytime',
    ],
  },
  {
    id: 'workspace',
    eyebrow: 'Play',
    title: 'Orbit, follow, read the room',
    lead:
      'Enter the office, look around, and follow whoever is thinking or working.',
    bullets: [
      'Drag to orbit · scroll to zoom',
      'Click an agent (or press 1–9) to follow them',
      'Nameplates and status bubbles show what they’re doing',
      'Click again to customize their look',
    ],
  },
  {
    id: 'loop',
    eyebrow: 'How it works',
    title: 'Cursor talks. The office reacts.',
    lead:
      'Hooks stream agent lifecycle into the office. Thinking, tooling, and done states drive the workers.',
    bullets: [
      'Keep this app open beside Cursor',
      'Start an agent or swarm — characters spawn with names',
      'Or hit Mock Swarm to preview without Cursor',
    ],
  },
  {
    id: 'crew',
    eyebrow: 'Identity',
    title: 'Every worker has a name',
    lead:
      'Defaults use a collective vinyl look. You can rename, recolor, and pick accessories so each agent is recognizable.',
    bullets: [
      'Stable looks persist in your browser',
      'Lead gets the cap; specialists cycle accessories',
      'Swarm count stays visible in the HUD',
    ],
  },
  {
    id: 'setup',
    eyebrow: 'Ready',
    title: 'You’re set — no key needed',
    lead:
      'Mirror mode is the default. Advanced mode (Teams / BYOK) is optional if you want the old in-app runner.',
    bullets: [
      'Enter Office to open the spectator',
      'Enable project hooks so Cursor can stream presence',
      'Advanced tools stay available when you want them',
    ],
  },
  {
    id: 'launch',
    eyebrow: 'Go',
    title: 'Open the office',
    lead:
      'Jump in. When Cursor agents run, they show up here.',
    bullets: [
      'G — Enter Office · 1–9 — follow · E — wave · ? — shortcuts',
      'Mock Swarm — preview with demo agents',
      'Replay this intro from Settings anytime',
    ],
  },
];

export interface OnboardingOverlayProps {
  hasApiKey: boolean;
  onComplete: () => void;
  onOpenSettings: () => void;
  onOpenTeams: () => void;
  onGoLive: () => void;
  onExploreDemo?: () => void;
}

function StepVisual({
  stepId,
  hasApiKey,
  readiness,
  onOpenSettings,
  onOpenTeams,
}: {
  stepId: StepId;
  hasApiKey: boolean;
  readiness: number;
  onOpenSettings: () => void;
  onOpenTeams: () => void;
}) {
  switch (stepId) {
    case 'welcome':
      return (
        <div className="la-onboard__scene la-onboard__scene--hero">
          <div className="la-onboard__hero-ring la-onboard__hero-ring--outer" />
          <div className="la-onboard__hero-ring la-onboard__hero-ring--inner" />
          <Logo variant="mark" className="la-onboard__hero-logo" />
        </div>
      );

    case 'workspace':
      return (
        <div className="la-onboard__scene la-onboard__scene--workspace">
          <div className="la-onboard__workspace-frame">
            <div className="la-onboard__workspace-grid" />
            <div className="la-onboard__workspace-orbit" aria-hidden />
            <div
              className="la-onboard__workspace-agent"
              style={{ left: '22%', top: '42%', background: '#007aff' }}
            />
            <div
              className="la-onboard__workspace-agent is-followed"
              style={{ left: '52%', top: '36%', background: '#af52de', animationDelay: '-0.8s' }}
            >
              <span className="la-onboard__workspace-bubble">Researching…</span>
            </div>
            <div
              className="la-onboard__workspace-agent"
              style={{ left: '72%', top: '58%', background: '#34c759', animationDelay: '-1.6s' }}
            />
            <div
              className="la-onboard__workspace-agent"
              style={{ left: '34%', top: '64%', background: '#ff9500', animationDelay: '-2.4s' }}
            />
            <div className="la-onboard__workspace-keys" aria-hidden>
              <kbd>1</kbd>
              <kbd>2</kbd>
              <kbd>3</kbd>
              <span>…</span>
              <kbd>9</kbd>
            </div>
          </div>
          <p className="la-onboard__workspace-caption">Drag · scroll · click or 1–9</p>
        </div>
      );

    case 'loop':
      return (
        <div className="la-onboard__scene la-onboard__scene--loop">
          <div className="la-onboard__loop-track" />
          <div className="la-onboard__loop-node" style={{ animationDelay: '0s' }}>
            <Radio size={22} />
            <span>Cursor runs</span>
          </div>
          <div className="la-onboard__loop-node" style={{ animationDelay: '-0.75s' }}>
            <Zap size={22} />
            <span>Presence stream</span>
          </div>
          <div className="la-onboard__loop-node" style={{ animationDelay: '-1.5s' }}>
            <Users size={22} />
            <span>Workers spawn</span>
          </div>
          <div className="la-onboard__loop-node" style={{ animationDelay: '-2.25s' }}>
            <Play size={22} />
            <span>You watch</span>
          </div>
        </div>
      );

    case 'crew':
      return (
        <div className="la-onboard__scene la-onboard__scene--crew">
          {[
            { name: 'Cursor', role: 'Lead', color: '#007aff' },
            { name: 'Explore', role: 'Subagent', color: '#af52de' },
            { name: 'Shell', role: 'Subagent', color: '#ff9500' },
            { name: 'Review', role: 'Subagent', color: '#34c759' },
          ].map((agent, i) => (
            <div
              key={agent.name}
              className="la-onboard__crew-card"
              style={{ animationDelay: `${-i * 0.5}s` }}
            >
              <div className="la-onboard__crew-dot" style={{ background: agent.color }} />
              <strong>{agent.name}</strong>
              <span>{agent.role}</span>
            </div>
          ))}
        </div>
      );

    case 'setup': {
      const circumference = 2 * Math.PI * 52;
      const dash = (readiness / 100) * circumference;
      const items = [
        {
          id: 'mirror',
          ok: true,
          title: 'Mirror mode',
          detail: 'Default — no API key required',
          action: null,
          onAction: undefined,
        },
        {
          id: 'office',
          ok: true,
          title: '3D office',
          detail: 'WebGPU browser recommended',
          action: null,
          onAction: undefined,
        },
        {
          id: 'advanced',
          ok: true,
          title: 'Advanced runner',
          detail: hasApiKey ? 'API key on file (optional)' : 'Optional BYOK in Settings',
          action: hasApiKey ? null : 'Settings',
          onAction: hasApiKey ? undefined : onOpenSettings,
        },
      ];

      return (
        <div className="la-onboard__scene la-onboard__scene--setup">
          <div className="la-onboard__setup-ring">
            <svg className="la-onboard__setup-ring-svg" viewBox="0 0 120 120" aria-hidden>
              <circle className="la-onboard__setup-ring-track" cx="60" cy="60" r="52" />
              <circle
                className="la-onboard__setup-ring-fill"
                cx="60"
                cy="60"
                r="52"
                strokeDasharray={`${dash} ${circumference}`}
              />
            </svg>
            <div className="la-onboard__setup-ring-label">
              <strong>{readiness}%</strong>
              <span>Ready</span>
            </div>
          </div>
          <div className="la-onboard__setup-checklist">
            <ul>
              {items.map((item, i) => (
                <li
                  key={item.id}
                  className={`la-onboard__setup-item ${item.ok ? 'is-ok' : 'is-warn'}`}
                  style={{ animationDelay: `${i * 0.08}s` }}
                >
                  <div>
                    <strong>{item.title}</strong>
                    <span>{item.detail}</span>
                  </div>
                  {item.action && item.onAction ? (
                    <button
                      type="button"
                      className="la-onboard__setup-action"
                      onClick={item.onAction}
                    >
                      {item.action}
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        </div>
      );
    }

    case 'launch':
      return (
        <div className="la-onboard__scene la-onboard__scene--launch">
          <div className="la-onboard__launch-burst" />
          <div className="la-onboard__launch-icon">
            <Radio size={48} strokeWidth={1.5} />
          </div>
          <p>Your office is ready</p>
        </div>
      );

    default:
      return null;
  }
}

export function OnboardingOverlay({
  hasApiKey,
  onComplete,
  onOpenSettings,
  onOpenTeams,
  onGoLive,
  onExploreDemo,
}: OnboardingOverlayProps) {
  const [stepIndex, setStepIndex] = useState(0);
  const [direction, setDirection] = useState<'forward' | 'backward'>('forward');
  const [entered, setEntered] = useState(false);

  const step = STEPS[stepIndex];
  const isFirst = stepIndex === 0;
  const isLast = stepIndex === STEPS.length - 1;

  const readiness = useMemo(() => 100, []);

  const finish = useCallback(() => {
    markOnboardingDone();
    onComplete();
  }, [onComplete]);

  const goNext = useCallback(() => {
    if (isLast) {
      finish();
      onGoLive();
      return;
    }
    setDirection('forward');
    setStepIndex((i) => Math.min(i + 1, STEPS.length - 1));
  }, [isLast, finish, onGoLive]);

  const goBack = useCallback(() => {
    setDirection('backward');
    setStepIndex((i) => Math.max(i - 1, 0));
  }, []);

  const goTo = useCallback(
    (index: number) => {
      setDirection(index > stepIndex ? 'forward' : 'backward');
      setStepIndex(index);
    },
    [stepIndex],
  );

  useEffect(() => {
    const t = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(t);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        finish();
        return;
      }
      if (e.key === 'ArrowRight' || e.key === 'Enter') {
        e.preventDefault();
        goNext();
        return;
      }
      if (e.key === 'ArrowLeft' && !isFirst) {
        e.preventDefault();
        goBack();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [finish, goNext, goBack, isFirst]);

  const animClass = direction === 'forward' ? 'is-forward' : 'is-backward';

  return (
    <div
      className={`la-onboard${entered ? ' is-entered' : ''}`}
      role="dialog"
      aria-modal="true"
      aria-label="Live Agents onboarding"
    >
      <div className="la-onboard__ambient" aria-hidden>
        <div className="la-onboard__mesh" />
        <div className="la-onboard__grain" />
        <div className="la-onboard__orb la-onboard__orb--a" />
        <div className="la-onboard__orb la-onboard__orb--b" />
        <div className="la-onboard__orb la-onboard__orb--c" />
      </div>

      <header className="la-onboard__top">
        <div className="la-onboard__brand">
          <Logo variant="mark" />
          <span className="la-onboard__brand-name">Live Agents</span>
          <span className="la-onboard__brand-tag">Intro</span>
        </div>
        <button type="button" className="la-onboard__skip" onClick={finish}>
          Skip intro
        </button>
      </header>

      <div className="la-onboard__body">
        <div className={`la-onboard__copy ${animClass}`} key={`copy-${step.id}`}>
          <p className="la-onboard__eyebrow">{step.eyebrow}</p>
          <h1 className="la-onboard__title">{step.title}</h1>
          <p className="la-onboard__lead">{step.lead}</p>
          <ul className="la-onboard__bullets">
            {step.bullets.map((text, i) => (
              <li key={text} style={{ animationDelay: `${0.12 + i * 0.08}s` }}>
                <Check size={18} strokeWidth={2.5} aria-hidden />
                <span>{text}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className={`la-onboard__stage ${animClass}`} key={`stage-${step.id}`}>
          <StepVisual
            stepId={step.id}
            hasApiKey={hasApiKey}
            readiness={readiness}
            onOpenSettings={onOpenSettings}
            onOpenTeams={onOpenTeams}
          />
        </div>
      </div>

      <footer className="la-onboard__footer">
        <div className="la-onboard__progress" role="tablist" aria-label="Onboarding steps">
          {STEPS.map((s, i) => (
            <button
              key={s.id}
              type="button"
              role="tab"
              aria-selected={i === stepIndex}
              aria-label={`Step ${i + 1}: ${s.title}`}
              className={[
                'la-onboard__dot',
                i === stepIndex ? 'is-active' : '',
                i < stepIndex ? 'is-done' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              onClick={() => goTo(i)}
            />
          ))}
        </div>

        <div className="la-onboard__nav">
          <button
            type="button"
            className="la-onboard__btn la-onboard__btn--ghost"
            onClick={goBack}
            disabled={isFirst}
          >
            <ArrowLeft size={16} />
            Back
          </button>
          {isLast && !hasApiKey && onExploreDemo ? (
            <button
              type="button"
              className="la-onboard__btn la-onboard__btn--ghost"
              onClick={() => {
                finish();
                onExploreDemo();
              }}
            >
              Explore demo
            </button>
          ) : null}
          <button
            type="button"
            className="la-onboard__btn la-onboard__btn--primary"
            onClick={goNext}
          >
            {isLast ? (
              <>
                <Zap size={16} />
                {'Enter Office'}
              </>
            ) : (
              <>
                Continue
                <ArrowRight size={16} />
              </>
            )}
          </button>
        </div>

        <p className="la-onboard__hint">
          {stepIndex + 1} of {STEPS.length}
          {!isLast ? ' · Arrow keys to navigate' : ' · Or press G later to Go Live'}
        </p>
      </footer>
    </div>
  );
}

export default OnboardingOverlay;
