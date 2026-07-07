import { X } from 'lucide-react';
import React, { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
  size?: 'md' | 'lg' | 'full';
  icon?: React.ReactNode;
}

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

const Modal: React.FC<ModalProps> = ({
  open,
  onClose,
  title,
  subtitle,
  children,
  size = 'md',
  icon,
}) => {
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const subtitleId = useId();
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;

    previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const focusInitial = () => {
      const panel = panelRef.current;
      if (!panel) return;
      const focusables = panel.querySelectorAll<HTMLElement>(FOCUSABLE);
      if (focusables.length > 0) {
        focusables[0].focus();
      } else {
        closeRef.current?.focus();
      }
    };
    requestAnimationFrame(focusInitial);

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      if (e.key !== 'Tab') return;

      const panel = panelRef.current;
      if (!panel) return;
      const focusables = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (focusables.length === 0) return;

      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
      previousFocusRef.current?.focus();
    };
  }, [open, onClose]);

  if (!open) return null;

  const widthClass =
    size === 'full'
      ? 'max-w-3xl'
      : size === 'lg'
        ? 'max-w-2xl'
        : 'max-w-lg';

  return createPortal(
    <div
      className="modal-overlay fixed inset-0 z-[650]"
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? titleId : undefined}
      aria-describedby={subtitle ? subtitleId : undefined}
    >
      <button
        type="button"
        className="absolute inset-0 z-0 bg-black/30 backdrop-blur-md border-0 p-0 cursor-default"
        onClick={onClose}
        aria-label="Close dialog"
        tabIndex={-1}
      />
      <div className="absolute inset-0 z-10 flex items-center justify-center p-4 sm:p-8 pointer-events-none">
      <div
        ref={panelRef}
        className={`modal-panel pointer-events-auto w-full ${widthClass} max-h-[min(90vh,820px)] flex flex-col glass-panel-elevated rounded-[var(--apple-radius-lg)] shadow-2xl animate-modal-in`}
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
      >
        {(title || subtitle) && (
          <div className="shrink-0 flex items-start gap-4 px-6 pt-6 pb-4 border-b" style={{ borderColor: 'var(--apple-border)' }}>
            {icon && (
              <div className="w-10 h-10 rounded-xl bg-appleBlue/10 flex items-center justify-center shrink-0">
                {icon}
              </div>
            )}
            <div className="flex-1 min-w-0 pr-8">
              {title && (
                <h2 id={titleId} className="text-[20px] font-semibold tracking-tight text-[var(--apple-text)]">
                  {title}
                </h2>
              )}
              {subtitle && (
                <p id={subtitleId} className="text-[13px] mt-0.5 text-[var(--apple-text-secondary)]">{subtitle}</p>
              )}
            </div>
            <button
              ref={closeRef}
              type="button"
              onClick={onClose}
              className="absolute top-5 right-5 p-2 rounded-xl text-zinc-400 hover:text-zinc-600 hover:bg-black/[0.04] transition-apple"
              aria-label="Close"
            >
              <X size={18} />
            </button>
          </div>
        )}
        <div className="flex-1 overflow-y-auto overscroll-contain min-h-0 px-6 py-5 modal-scroll-body">
          {children}
        </div>
      </div>
      </div>
    </div>,
    document.body,
  );
};

export default Modal;
