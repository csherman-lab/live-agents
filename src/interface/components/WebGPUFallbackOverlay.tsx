import { ExternalLink, MonitorSmartphone, RefreshCw } from 'lucide-react';
import React from 'react';
import { openInExternalBrowser } from '../../utils/openInBrowser';

interface WebGPUFallbackOverlayProps {
  compact?: boolean;
  onRetry?: () => void;
  showStaticPreview?: boolean;
}

const WebGPUFallbackOverlay: React.FC<WebGPUFallbackOverlayProps> = ({
  compact = false,
  onRetry,
  showStaticPreview = true,
}) => (
  <div
    className="absolute inset-0 z-20 flex flex-col items-center justify-center px-6 text-center overflow-hidden"
    style={{ background: 'var(--apple-bg)' }}
    role="alert"
  >
    {showStaticPreview && (
      <img
        src={`${import.meta.env.BASE_URL}images/office-preview.jpg`}
        alt=""
        className="absolute inset-0 w-full h-full object-cover opacity-20 pointer-events-none"
        aria-hidden
      />
    )}
    <div className={`relative flex flex-col items-center max-w-sm ${compact ? 'gap-3' : 'gap-4'}`}>
      <div className={`rounded-2xl theme-panel flex items-center justify-center ${compact ? 'w-14 h-14' : 'w-16 h-16'}`}>
        <MonitorSmartphone size={compact ? 22 : 28} className="text-appleBlue" strokeWidth={1.5} />
      </div>
      <div>
        <p className="text-[14px] font-semibold text-[var(--apple-text)]">
          3D workspace unavailable
        </p>
        <p className="text-[12px] mt-1.5 leading-relaxed text-[var(--apple-text-secondary)]">
          WebGPU is required for the office view. Open in Chrome, Edge, or Safari 18+, or use Command Center without 3D.
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-2 mt-1">
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[12px] font-semibold bg-appleBlue text-white hover:opacity-90 transition-apple"
          >
            <RefreshCw size={14} />
            Retry 3D
          </button>
        )}
        <button
          type="button"
          onClick={openInExternalBrowser}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[12px] font-semibold border border-black/10 bg-white hover:bg-black/[0.03] transition-apple"
        >
          <ExternalLink size={14} />
          Open in browser
        </button>
      </div>
    </div>
  </div>
);

export default WebGPUFallbackOverlay;
