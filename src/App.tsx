import React, { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useCoreStore } from './integration/store/coreStore';
import { FinalOutputModal } from './interface/FinalOutputModal';
import Header from './interface/Header';
import OverviewPanel from './interface/OverviewPanel';
import { OutputReviewModal } from './interface/OutputReviewModal';
import UIOverlay from './interface/UIOverlay';
import ToastContainer from './interface/components/ToastContainer';
import SceneLoadingOverlay from './interface/components/SceneLoadingOverlay';
import WebGPUFallbackOverlay from './interface/components/WebGPUFallbackOverlay';
import TeamSwitchModal from './interface/TeamSwitchModal';
import { useUiStore } from './integration/store/uiStore';
import { useKeyboardShortcuts } from './integration/hooks/useKeyboardShortcuts';
import { useThemeSync } from './integration/hooks/useThemeSync';
import { toast } from './integration/store/toastStore';
import { enterWorkspace } from './integration/enterWorkspace';
import { getTextModels, normalizeProviderId } from './core/llm/constants';
import { SceneContext } from './simulation/SceneContext';
import type { SceneManager } from './simulation/SceneManager';

const SimulationView = React.lazy(() => import('./interface/SimulationView'));
const InspectorPanel = React.lazy(() => import('./interface/InspectorPanel'));
const ActionLogPanel = React.lazy(() => import('./interface/ActionLogPanel').then((m) => ({ default: m.ActionLogPanel })));
const KanbanPanel = React.lazy(() => import('./interface/KanbanPanel').then((m) => ({ default: m.KanbanPanel })));

const VisualConfigurator = React.lazy(() =>
  import('./interface/VisualConfigurator/VisualConfigurator').then((m) => ({ default: m.VisualConfigurator }))
);
const OnboardingOverlay = React.lazy(() => import('./interface/OnboardingOverlay'));
const SettingsScreen = React.lazy(() => import('./interface/SettingsScreen'));
const InfoModal = React.lazy(() => import('./interface/InfoModal'));
const ShortcutsModal = React.lazy(() => import('./interface/ShortcutsModal'));

const PanelFallback: React.FC<{ label?: string }> = ({ label = 'Loading…' }) => (
  <div className="flex items-center justify-center p-12 text-[13px] text-[var(--apple-text-secondary)]">
    {label}
  </div>
);

const App: React.FC = () => {
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const managerRef = useRef<SceneManager | null>(null);
  const initPromiseRef = useRef<Promise<void> | null>(null);
  const initGenerationRef = useRef(0);
  const [sceneManager, setSceneManager] = useState<SceneManager | null>(null);
  const [sceneReady, setSceneReady] = useState(false);
  const [sceneError, setSceneError] = useState(false);
  const { isLogOpen, isKanbanOpen, setIsResizing, viewMode, setViewMode } = useCoreStore();
  const { isSettingsOpen, isAboutOpen, isShortcutsOpen, setSettingsOpen, setAboutOpen, setShortcutsOpen, setDemoMode, llmConfig, isDemoMode } = useUiStore();

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [kanbanHeight, setKanbanHeight] = useState(220);
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    const provider = normalizeProviderId(useUiStore.getState().llmConfig.provider);
    useCoreStore.setState({ availableModels: [...getTextModels(provider)] });
  }, []);

  useEffect(() => {
    import('./interface/OnboardingOverlay').then((m) => {
      if (m.shouldShowOnboarding()) setShowOnboarding(true);
    });
  }, []);

  const isOverview = viewMode === 'overview';
  const isSimulation = viewMode === 'simulation';
  const isDesign = viewMode === 'design';

  const startResizing = useCallback(() => setIsResizing(true), [setIsResizing]);
  const stopResizing = useCallback(() => setIsResizing(false), [setIsResizing]);

  const resize = useCallback((e: MouseEvent) => {
    if (useCoreStore.getState().isResizing) {
      const windowHeight = window.innerHeight;
      const newHeight = windowHeight - e.clientY;
      const minHeight = windowHeight * 0.2;
      const maxHeight = windowHeight * 0.5;
      if (newHeight >= minHeight && newHeight <= maxHeight) {
        setKanbanHeight(newHeight);
      }
    }
  }, []);

  useEffect(() => {
    window.addEventListener('mousemove', resize);
    window.addEventListener('mouseup', stopResizing);
    return () => {
      window.removeEventListener('mousemove', resize);
      window.removeEventListener('mouseup', stopResizing);
    };
  }, [resize, stopResizing]);

  useEffect(() => {
    return () => {
      initGenerationRef.current += 1;
      if (managerRef.current) {
        managerRef.current.dispose();
        managerRef.current = null;
        setSceneManager(null);
        setSceneReady(false);
      }
    };
  }, []);

  const attachCanvas = useCallback((node: HTMLDivElement | null) => {
    canvasRef.current = node;
    if (!node) return;

    if (managerRef.current) {
      managerRef.current.reparentTo(node);
      return;
    }

    if (initPromiseRef.current) {
      void initPromiseRef.current.then(() => {
        if (managerRef.current && canvasRef.current === node) {
          managerRef.current.reparentTo(node);
        }
      });
      return;
    }

    const generation = ++initGenerationRef.current;
    setSceneReady(false);
    setSceneError(false);

    initPromiseRef.current = (async () => {
      const [{ checkWebGPUSupport }, { withTimeout }, { SceneManager }] = await Promise.all([
        import('./utils/webgpu'),
        import('./utils/timeout'),
        import('./simulation/SceneManager'),
      ]);

      if (generation !== initGenerationRef.current) return;

      const supported = await checkWebGPUSupport();
      if (!supported) {
        throw new Error('WebGPU unavailable');
      }

      const container = canvasRef.current;
      if (!container || managerRef.current || generation !== initGenerationRef.current) return;

      const manager = new SceneManager(container);
      managerRef.current = manager;
      setSceneManager(manager);

      await withTimeout(manager.ready, 45000, '3D workspace initialization timed out');

      if (generation !== initGenerationRef.current || managerRef.current !== manager) return;
    })()
      .then(() => {
        if (generation !== initGenerationRef.current || !managerRef.current) return;
        setSceneReady(true);
        setSceneError(false);
      })
      .catch((err) => {
        if (generation !== initGenerationRef.current) return;
        console.error('[App] Failed to load 3D workspace:', err);
        if (managerRef.current) {
          managerRef.current.dispose();
          managerRef.current = null;
        }
        setSceneManager(null);
        setSceneError(true);
        setSceneReady(false);
        toast('3D workspace needs WebGPU — open in Chrome, Edge, or Safari 18+', 'error');
      })
      .finally(() => {
        initPromiseRef.current = null;
      });
  }, []);

  const handleGoLive = () => {
    enterWorkspace();
  };
  const handleBackToOverview = () => setViewMode('overview');
  const handleExploreDemo = () => {
    setDemoMode(true);
    setViewMode('simulation');
  };

  useKeyboardShortcuts({
    onGoLive: handleGoLive,
    onOpenSettings: () => setSettingsOpen(true),
  });

  useThemeSync();

  return (
    <SceneContext.Provider value={sceneManager}>
      <div className="w-screen h-screen overflow-hidden flex flex-col app-shell">
        {!isFullscreen && <Header onBackToOverview={isSimulation ? handleBackToOverview : undefined} />}

        <div className="flex-1 flex flex-row min-h-0 min-w-0 overflow-hidden">
          {isOverview && !isFullscreen && (
            <div className="w-[min(400px,38vw)] shrink-0 border-r panel-sidebar flex flex-col min-h-0 h-full">
              <OverviewPanel
                onGoLive={handleGoLive}
                onManageTeams={() => setViewMode('design')}
                onExploreDemo={handleExploreDemo}
              />
            </div>
          )}

          {isLogOpen && !isFullscreen && isSimulation && (
            <Suspense fallback={null}>
              <ActionLogPanel />
            </Suspense>
          )}

          <div className="relative flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden">
            <div
              className="flex-1 flex flex-col min-w-0 min-h-0 transition-apple view-mode-enter"
              style={{ visibility: isDesign ? 'hidden' : 'visible' }}
            >
              {isOverview ? (
                <div className="flex-1 flex flex-col items-center justify-center p-6 md:p-10 min-h-0 relative">
                  <div className="w-full max-w-4xl flex flex-col gap-5 h-full max-h-[calc(100vh-120px)]">
                    <div className="flex items-end justify-between shrink-0">
                      <div>
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className="w-2 h-2 rounded-full bg-appleGreen live-dot" />
                          <span className="text-[11px] font-semibold uppercase tracking-widest text-appleGreen">Live Preview</span>
                        </div>
                        <h2 className="text-[22px] font-bold tracking-tight text-[var(--apple-text)]">
                          Agent Workspace
                        </h2>
                        <p className="text-[13px] mt-1 text-[var(--apple-text-secondary)]">
                          Your team is active in the office
                        </p>
                      </div>
                    </div>

                    <div className="flex-1 preview-frame relative min-h-0">
                      <div ref={attachCanvas} className="absolute inset-0" style={{ background: 'var(--apple-bg)' }}>
                        {sceneError ? (
                          <WebGPUFallbackOverlay compact />
                        ) : (
                          <SceneLoadingOverlay visible={!(sceneReady && sceneManager)} compact />
                        )}
                        {!sceneError && <UIOverlay />}
                      </div>
                      <div className="absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-white/30 to-transparent pointer-events-none z-[1]" />
                      <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/15 to-transparent pointer-events-none z-[1]" />
                    </div>
                  </div>
                </div>
              ) : (
                <Suspense fallback={<PanelFallback label="Loading workspace…" />}>
                  <SimulationView
                    canvasRef={attachCanvas}
                    isFullscreen={isFullscreen}
                    setIsFullscreen={setIsFullscreen}
                    sceneReady={sceneReady && !!sceneManager}
                    sceneError={sceneError}
                  />
                </Suspense>
              )}

              {isKanbanOpen && !isFullscreen && isSimulation && (
                <Suspense fallback={null}>
                  <>
                    <div
                      className={`h-2 hover:h-2 bg-transparent hover:bg-zinc-200/50 border-t border-black/5 transition-colors cursor-row-resize z-30 flex items-center justify-center group shrink-0 ${useCoreStore.getState().isResizing ? 'bg-zinc-300/50' : ''}`}
                      onMouseDown={startResizing}
                    >
                      <div className="w-12 h-1 bg-zinc-300 rounded-full group-hover:bg-zinc-400" />
                    </div>
                    <KanbanPanel height={kanbanHeight} />
                  </>
                </Suspense>
              )}
            </div>
          </div>

          {!isFullscreen && isSimulation && (
            <Suspense fallback={<PanelFallback label="Loading inspector…" />}>
              <InspectorPanel />
            </Suspense>
          )}
        </div>

        {isDesign && (
          <div className="fixed top-[52px] left-0 right-0 bottom-0 z-[200] flex items-center justify-center p-4 sm:p-8 bg-black/25 backdrop-blur-xl">
            <div
              className="w-full h-full glass-panel-elevated rounded-[var(--apple-radius-lg)] overflow-hidden flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <Suspense fallback={<PanelFallback label="Loading team designer…" />}>
                <VisualConfigurator />
              </Suspense>
            </div>
          </div>
        )}

        <FinalOutputModal />
        <OutputReviewModal />
        <ToastContainer />
        <TeamSwitchModal />

        <Suspense fallback={null}>
          <SettingsScreen
            open={isSettingsOpen}
            onClose={() => setSettingsOpen(false)}
            onReplayOnboarding={() => {
              setSettingsOpen(false);
              setShowOnboarding(true);
            }}
            onOpenShortcuts={() => {
              setSettingsOpen(false);
              setShortcutsOpen(true);
            }}
          />
          <InfoModal open={isAboutOpen} onClose={() => setAboutOpen(false)} />
          <ShortcutsModal open={isShortcutsOpen} onClose={() => setShortcutsOpen(false)} />
        </Suspense>

        {showOnboarding && (
          <Suspense fallback={<PanelFallback label="Loading welcome…" />}>
            <OnboardingOverlay
              hasApiKey={!!llmConfig.apiKey}
              onComplete={() => setShowOnboarding(false)}
              onOpenSettings={() => {
                setShowOnboarding(false);
                setSettingsOpen(true);
              }}
              onOpenTeams={() => {
                setShowOnboarding(false);
                setViewMode('design');
              }}
              onGoLive={handleGoLive}
              onExploreDemo={handleExploreDemo}
            />
          </Suspense>
        )}
      </div>
    </SceneContext.Provider>
  );
};

export default App;
