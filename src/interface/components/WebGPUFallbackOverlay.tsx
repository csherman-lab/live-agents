import { MonitorSmartphone } from 'lucide-react';
import React from 'react';

interface WebGPUFallbackOverlayProps {
  compact?: boolean;
}

const WebGPUFallbackOverlay: React.FC<WebGPUFallbackOverlayProps> = ({ compact = false }) => (
  <div
    className="absolute inset-0 z-20 flex flex-col items-center justify-center px-6 text-center"
    style={{ background: 'var(--apple-bg)' }}
    role="alert"
  >
    <div className={`flex flex-col items-center max-w-sm ${compact ? 'gap-3' : 'gap-4'}`}>
      <div className={`rounded-2xl theme-panel flex items-center justify-center ${compact ? 'w-14 h-14' : 'w-16 h-16'}`}>
        <MonitorSmartphone size={compact ? 22 : 28} className="text-appleBlue" strokeWidth={1.5} />
      </div>
      <div>
        <p className="text-[14px] font-semibold text-[var(--apple-text)]">
          3D workspace unavailable
        </p>
        <p className="text-[12px] mt-1.5 leading-relaxed text-[var(--apple-text-secondary)]">
          WebGPU is required for the office view. Open this app in Chrome, Edge, or Safari 18+ for the full 3D experience.
          Team design, briefs, and settings still work from Command Center.
        </p>
      </div>
    </div>
  </div>
);

export default WebGPUFallbackOverlay;
