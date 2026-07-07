import { Building2 } from 'lucide-react';
import React from 'react';

interface SceneLoadingOverlayProps {
  visible: boolean;
  compact?: boolean;
}

const SceneLoadingOverlay: React.FC<SceneLoadingOverlayProps> = ({ visible, compact = false }) => {
  if (!visible) return null;

  return (
    <div
      className={`absolute inset-0 z-20 flex flex-col items-center justify-center transition-opacity duration-500 ${
        visible ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
      }`}
      style={{ background: 'var(--apple-bg)' }}
      aria-live="polite"
      aria-busy="true"
      aria-label="Loading 3D workspace"
    >
      <div className={`flex flex-col items-center ${compact ? 'gap-3' : 'gap-5'}`}>
        <div className="relative">
          <div
            className={`rounded-2xl theme-panel backdrop-blur-xl shadow-lg flex items-center justify-center scene-load-icon ${
              compact ? 'w-14 h-14' : 'w-20 h-20'
            }`}
          >
            <Building2 size={compact ? 24 : 32} className="text-appleBlue" strokeWidth={1.5} />
          </div>
          <span className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-appleGreen border-2 border-white scene-load-pulse" />
        </div>

        {!compact && (
          <div className="text-center">
            <p className="text-[14px] font-semibold text-[var(--apple-text)] tracking-tight">
              Preparing your office
            </p>
            <p className="text-[12px] mt-1 text-[var(--apple-text-secondary)]">
              Loading 3D workspace and agents…
            </p>
          </div>
        )}

        <div className={`flex gap-1.5 ${compact ? 'mt-1' : ''}`}>
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="w-1.5 h-1.5 rounded-full bg-appleBlue/60 scene-load-dot"
              style={{ animationDelay: `${i * 0.15}s` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default SceneLoadingOverlay;
