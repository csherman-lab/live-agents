import { ArrowLeft, ExternalLink, Info, LayoutDashboard, Maximize2, Settings, Users } from 'lucide-react';
import React from 'react';
import packageJson from '../../package.json';
import { useCoreStore } from '../integration/store/coreStore';
import { useUiStore } from '../integration/store/uiStore';
import { enterWorkspace } from '../integration/enterWorkspace';
import { openInExternalBrowser } from '../utils/openInBrowser';
import Logo from './components/Logo';

const version = packageJson.version;

interface HeaderProps {
  onBackToOverview?: () => void;
  onDismissOnboarding?: () => void;
}

const Header: React.FC<HeaderProps> = ({ onBackToOverview, onDismissOnboarding }) => {
  const { llmConfig, setSettingsOpen, setAboutOpen, isDemoMode } = useUiStore();
  const { setViewMode, viewMode } = useCoreStore();
  const hasKey = !!llmConfig.apiKey;

  const handleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
    } else {
      document.exitFullscreen?.();
    }
  };

  const toggleWorkspace = () => {
    if (viewMode === 'overview') {
      enterWorkspace();
    } else {
      setViewMode('overview');
    }
  };

  const openSettings = () => {
    onDismissOnboarding?.();
    setSettingsOpen(true);
  };

  const openTeams = () => {
    onDismissOnboarding?.();
    setViewMode('design');
  };

  return (
    <header className="app-header h-[52px] border-b flex items-center justify-between px-5 backdrop-blur-2xl shrink-0 relative z-[620]">
      <div className="flex items-center gap-3 min-w-0">
        {onBackToOverview && (
          <button
            onClick={onBackToOverview}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[13px] font-medium text-appleBlue hover:bg-appleBlue/10 transition-apple active:scale-95"
          >
            <ArrowLeft size={15} />
            <span className="hidden sm:inline">Overview</span>
          </button>
        )}

        <Logo />
        <span className="text-[10px] font-medium text-zinc-400/80 font-mono hidden lg:inline tabular-nums">v{version}</span>
      </div>

      {viewMode === 'simulation' && (
        <div className="absolute left-1/2 -translate-x-1/2 hidden md:flex items-center">
          <span className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-[12px] font-medium theme-badge shadow-sm">
            <LayoutDashboard size={13} className="text-appleBlue" />
            Workspace
            {isDemoMode && !hasKey && (
              <span className="text-[10px] font-medium text-orange-500">· Demo</span>
            )}
          </span>
        </div>
      )}

      <div className="flex items-center gap-1">
        <button
          onClick={openTeams}
          className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-[13px] font-semibold text-white transition-apple active:scale-95 bg-appleBlue hover:opacity-90 shadow-sm"
          title="Manage Teams"
        >
          <Users size={14} />
          <span className="hidden sm:inline">Teams</span>
        </button>

        <div className="w-px h-5 bg-black/8 mx-1 hidden sm:block" />

        <HeaderIcon
          onClick={toggleWorkspace}
          active={viewMode === 'overview'}
          title={viewMode === 'overview' ? 'Enter workspace' : 'Back to overview'}
        >
          <LayoutDashboard size={16} />
        </HeaderIcon>

        <HeaderIcon
          onClick={openSettings}
          title="Settings & API"
          dot={hasKey}
          dotColor="bg-appleGreen"
        >
          <Settings size={16} className={hasKey ? 'text-appleGreen' : ''} />
        </HeaderIcon>

        <HeaderIcon onClick={openInExternalBrowser} title="Open in browser" className="hidden sm:flex">
          <ExternalLink size={16} />
        </HeaderIcon>

        <HeaderIcon onClick={handleFullscreen} title="Fullscreen" className="hidden sm:flex">
          <Maximize2 size={16} />
        </HeaderIcon>

        <HeaderIcon onClick={() => setAboutOpen(true)} title="About">
          <Info size={16} />
        </HeaderIcon>
      </div>
    </header>
  );
};

const HeaderIcon: React.FC<{
  children: React.ReactNode;
  onClick: () => void;
  title: string;
  active?: boolean;
  dot?: boolean;
  dotColor?: string;
  className?: string;
}> = ({ children, onClick, title, active, dot, dotColor = 'bg-appleGreen', className = '' }) => (
  <button
    onClick={onClick}
    title={title}
    aria-label={title}
    className={`relative p-2 rounded-xl transition-apple ${
      active
        ? 'bg-appleBlue/10 text-appleBlue'
        : 'text-zinc-400 hover:text-zinc-600 hover:bg-black/[0.04]'
    } ${className}`}
  >
    {children}
    {dot && <span className={`absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full ${dotColor}`} />}
  </button>
);

export default Header;
