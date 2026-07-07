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
    title: 'Meet Live Agents',
    lead:
      'A calm, Apple-inspired command center where AI agents work in a living 3D office — you brief, they deliver.',
    bullets: [
      'Watch your team move, collaborate, and ship in real time',
      'One overview for briefs, teams, templates, and deliverables',
      'Go Live when you are ready for the full immersive workspace',
    ],
  },
  {
    id: 'workspace',
    eyebrow: 'The workspace',
    title: 'A living 3D office',
    lead:
      'Agents are not rows in a chat log. They occupy desks, walk between stations, and show status as they work.',
    bullets: [
      'Spatial layout mirrors how real teams collaborate',
      'Speech bubbles surface what each agent is doing',
      'Overview mode keeps planning separate from immersion',
    ],
  },
  {
    id: 'loop',
    eyebrow: 'How it works',
    title: 'Brief, go live, delegate',
    lead:
      'Start in the Command Center, launch into the 3D workspace, and let specialists handle the work.',
    bullets: [
      'Write a brief or pick a project template',
      'Hit Go Live to enter the immersive simulation',
      'Review outputs, export deliverables, and iterate',
    ],
  },
  {
    id: 'crew',
    eyebrow: 'Your team',
    title: 'Specialists, not one bot',
    lead:
      'Each agent has a role — research, writing, design, engineering — coordinated like a real crew.',
    bullets: [
      'Customize roles and colors in Design mode',
      'Templates jump-start common project types',
      'Memory persists across sessions per team',
    ],
  },
  {
    id: 'setup',
    eyebrow: 'Quick setup',
    title: 'Connect and configure',
    lead:
      'Add your Gemini API key and tune your team. You can always change these in Settings later.',
    bullets: [
      'API keys stay local in your browser',
      'Light, dark, or auto appearance in Settings',
      'Try Explore demo without an API key',
    ],
  },
  {
    id: 'launch',
    eyebrow: 'Ready',
    title: 'Enter the workspace',
    lead:
      'You are set. Open the Command Center, or jump straight into Go Live.',
    bullets: [
      'Press G anytime to toggle Go Live',
      'Press ? for keyboard shortcuts',
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
            <div
              className="la-onboard__workspace-agent"
              style={{ left: '22%', top: '35%', background: '#007aff' }}
            />
            <div
              className="la-onboard__workspace-agent"
              style={{ left: '55%', top: '28%', background: '#af52de', animationDelay: '-0.8s' }}
            />
            <div
              className="la-onboard__workspace-agent"
              style={{ left: '68%', top: '55%', background: '#34c759', animationDelay: '-1.6s' }}
            />
            <div
              className="la-onboard__workspace-agent"
              style={{ left: '35%', top: '62%', background: '#ff9500', animationDelay: '-2.4s' }}
            />
          </div>
        </div>
      );

    case 'loop':
      return (
        <div className="la-onboard__scene la-onboard__scene--loop">
          <div className="la-onboard__loop-track" />
          <div className="la-onboard__loop-node" style={{ animationDelay: '0s' }}>
            <LayoutGrid size={22} />
            <span>Command Center</span>
          </div>
          <div className="la-onboard__loop-node" style={{ animationDelay: '-0.75s' }}>
            <Play size={22} />
            <span>Go Live</span>
          </div>
          <div className="la-onboard__loop-node" style={{ animationDelay: '-1.5s' }}>
            <Users size={22} />
            <span>Agents work</span>
          </div>
          <div className="la-onboard__loop-node" style={{ animationDelay: '-2.25s' }}>
            <Sparkles size={22} />
            <span>Deliverables</span>
          </div>
        </div>
      );

    case 'crew':
      return (
        <div className="la-onboard__scene la-onboard__scene--crew">
          {[
            { name: 'Research', role: 'Analyst', color: '#007aff' },
            { name: 'Writer', role: 'Content', color: '#af52de' },
            { name: 'Design', role: 'Visual', color: '#ff9500' },
            { name: 'Build', role: 'Engineer', color: '#34c759' },
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
          id: 'api',
          ok: hasApiKey,
          title: 'Gemini API key',
          detail: hasApiKey ? 'Connected' : 'Required to run agents',
          action: hasApiKey ? null : 'Add key',
          onAction: onOpenSettings,
        },
        {
          id: 'team',
          ok: true,
          title: 'Agent team',
          detail: 'Default crew loaded',
          action: 'Customize',
          onAction: onOpenTeams,
        },
        {
          id: 'ready',
          ok: hasApiKey,
          title: 'Workspace',
          detail: hasApiKey ? 'Ready to go live' : 'Add API key first',
          action: null,
          onAction: undefined,
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
          <p>Your agents are standing by</p>
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

  const readiness = useMemo(() => {
    let score = 34; // default team
    if (hasApiKey) score += 66;
    return Math.min(100, score);
  }, [hasApiKey]);

  const finish = useCallback(() => {
    markOnboardingDone();
    onComplete();
  }, [onComplete]);

  const goNext = useCallback(() => {
    if (isLast) {
      finish();
      if (hasApiKey) onGoLive();
      return;
    }
    setDirection('forward');
    setStepIndex((i) => Math.min(i + 1, STEPS.length - 1));
  }, [isLast, finish, onGoLive, hasApiKey]);

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
                {hasApiKey ? 'Enter Live Agents' : 'Open Command Center'}
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
