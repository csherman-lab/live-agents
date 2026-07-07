import { CheckCircle2, Info, AlertTriangle, X, XCircle } from 'lucide-react';
import React from 'react';
import { ToastTone, useToastStore } from '../../integration/store/toastStore';

const ICON: Record<ToastTone, React.ReactNode> = {
  info: <Info size={16} className="text-appleBlue" />,
  success: <CheckCircle2 size={16} className="text-appleGreen" />,
  warning: <AlertTriangle size={16} className="text-orange-500" />,
  error: <XCircle size={16} className="text-red-500" />,
};

const ToastContainer: React.FC = () => {
  const { toasts, dismiss } = useToastStore();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[700] flex flex-col gap-2 w-[min(420px,calc(100vw-2rem))] pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          className="pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-2xl glass-panel-elevated shadow-lg border border-black/5 animate-modal-in"
        >
          {ICON[t.tone]}
          <p className="flex-1 text-[13px] font-medium text-[var(--apple-text)]">{t.message}</p>
          <button
            type="button"
            onClick={() => dismiss(t.id)}
            className="p-1 rounded-lg text-zinc-400 hover:text-zinc-600"
            aria-label="Dismiss"
          >
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
};

export default ToastContainer;
